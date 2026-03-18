import type { Request, Response } from "express";
import { storage } from "../storage";
import { cryptoService } from "../services/crypto";
import { merkleService } from "../services/merkle";
import { blockchainService } from "../services/blockchain";
import { asyncHandler, BadRequestError } from "../middleware/error-handler";
import Papa from "papaparse";
import type { VerifyBody } from "../middleware/validation";

// Verify document
export const verifyDocument = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new BadRequestError("No file uploaded");
    }

    const { verifierId } = req.body as VerifyBody;

    const fileName = req.file.originalname.toLowerCase();
    const fileExtension = fileName.split('.').pop() || '';

    let documentHash: string;
    let verificationData: any = {};

    // Handle different file types
    if (fileExtension === 'csv') {
        // CSV files - parse and hash the data
        const csvContent = req.file.buffer.toString('utf-8');
        const parseResult = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true
        });

        if (parseResult.errors.length > 0) {
            throw new BadRequestError(
                `Invalid CSV format: ${parseResult.errors.map(e => `Line ${e.row ?? 0}: ${e.message}`).join('; ')}`
            );
        }

        const csvData = parseResult.data as Record<string, any>[];

        if (csvData.length === 0) {
            throw new BadRequestError("CSV file is empty. Please upload a CSV file with at least one data row.");
        }

        // Process first row
        const rowData = csvData[0];
        const dataString = cryptoService.csvRowToDataString(rowData);
        documentHash = cryptoService.computeHash(dataString);
        verificationData = rowData;
    } else {
        // PDF/Image files - hash the binary content directly
        // For PNG/JPG images from certificates, we need to compute hash the same way
        // as when the certificate was created (base64 of raw image data)
        const base64Content = req.file.buffer.toString('base64');

        // Compute hash same way as certificate creation (raw base64, no data URL prefix)
        documentHash = cryptoService.computeHash(base64Content);

        verificationData = {
            fileName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            fileType: fileExtension.toUpperCase()
        };

        console.log('[VERIFY] File type:', fileExtension);
        console.log('[VERIFY] Computed hash from uploaded file (base64):', documentHash);
        console.log('[VERIFY] File size:', req.file.size);
        console.log('[VERIFY] Base64 length:', base64Content.length);
    }

    // Create verification record
    const verification = await storage.createVerification({
        verifierId,
        fileName: req.file.originalname,
        documentHash,
        status: "pending",
        verificationData,
    });

    // Find matching document - first try by documentHash
    let matchedDocument = await storage.getDocumentByHash(documentHash);
    console.log('[VERIFY] Match by documentHash:', matchedDocument ? 'FOUND' : 'NOT FOUND');

    // If not found and it's an image file, try matching by imageHash
    if (!matchedDocument && ['png', 'jpg', 'jpeg', 'webp'].includes(fileExtension)) {
        console.log('[VERIFY] Trying to match by imageHash...');
        matchedDocument = await storage.getDocumentByImageHash(documentHash);
        console.log('[VERIFY] Match by imageHash:', matchedDocument ? 'FOUND' : 'NOT FOUND');
    }

    // Certificate-specific fallback: try to match by certificateId from filename
    // Filename format: certificate-{recipientName}-{certificateId}.png
    if (!matchedDocument && ['png', 'jpg', 'jpeg', 'webp'].includes(fileExtension)) {
        const filenameMatch = fileName.match(/certificate-.*?-(CERT-[A-Z0-9-]+)\./i);
        if (filenameMatch) {
            const extractedCertId = filenameMatch[1];
            console.log('[VERIFY] Trying to match by certificateId:', extractedCertId);
            matchedDocument = await storage.getDocumentByCertificateId(extractedCertId);
            console.log('[VERIFY] Match by certificateId:', matchedDocument ? 'FOUND' : 'NOT FOUND');
        }
    }

    let digitalSignatureValid = false;
    let merkleProofValid = false;
    let blockchainVerified = false;
    let confidenceScore = 0;
    let matchedBatch = null;

    if (matchedDocument) {
        // Verify digital signature
        if (matchedDocument.digitalSignature) {
            if (fileExtension === 'csv') {
                const dataString = cryptoService.csvRowToDataString(verificationData);
                digitalSignatureValid = cryptoService.verifySignature(
                    dataString,
                    matchedDocument.digitalSignature
                );
            } else {
                const originalData = matchedDocument.originalData as Record<string, any>;
                if (originalData && originalData.certificateId) {
                    const { imageHash, ...certificateData } = originalData;
                    const dataString = cryptoService.csvRowToDataString(certificateData);
                    digitalSignatureValid = cryptoService.verifySignature(
                        dataString,
                        matchedDocument.digitalSignature
                    );
                    console.log('[VERIFY] Certificate signature verification using originalData');
                } else {
                    digitalSignatureValid = cryptoService.verifySignature(
                        req.file.buffer.toString('base64'),
                        matchedDocument.digitalSignature
                    );
                }
            }
        }

        // Verify Merkle proof
        if (matchedDocument.merkleProof) {
            try {
                merkleProofValid = merkleService.verifyProof(matchedDocument.merkleProof as any);
            } catch (error) {
                console.error('Merkle proof verification error:', error);
                merkleProofValid = false;
            }
        }

        // Get batch information
        matchedBatch = await storage.getDocumentBatch(matchedDocument.batchId);

        // Check if revoked FIRST
        const isRevoked = matchedBatch?.revoked === true;

        // Verify against blockchain
        if (matchedBatch?.blockchainTxHash && matchedBatch?.merkleRoot) {
            blockchainVerified = await blockchainService.verifyMerkleRoot(
                matchedBatch.merkleRoot,
                matchedBatch.blockchainTxHash
            );
        }

        // Calculate confidence score
        if (isRevoked) {
            // Revoked documents get 0 confidence
            confidenceScore = 0;
        } else {
            let score = 0;
            if (digitalSignatureValid) score += 40;
            if (merkleProofValid) score += 30;
            if (blockchainVerified) score += 30;
            confidenceScore = score;
        }
    } else {
        console.log(`Document hash ${documentHash} not found in database`);
    }

    // Determine final status
    const isRevoked = matchedBatch?.revoked === true;
    let finalStatus: string;
    if (!matchedDocument) {
        finalStatus = 'not_found';
    } else if (isRevoked) {
        finalStatus = 'revoked';
    } else if (confidenceScore >= 70) {
        finalStatus = 'verified';
    } else {
        finalStatus = 'failed';
    }

    // Update verification record
    const updatedVerification = await storage.updateVerification(verification.id, {
        digitalSignatureValid,
        merkleProofValid,
        blockchainVerified,
        confidenceScore,
        matchedBatchId: matchedDocument?.batchId,
        matchedDocumentId: matchedDocument?.id,
        status: finalStatus,
    });

    res.json({
        verification: updatedVerification,
        results: {
            documentFound: !!matchedDocument,
            isRevoked,
            digitalSignatureValid,
            merkleProofValid,
            blockchainVerified,
            confidenceScore,
            matchedBatch: matchedBatch ? {
                id: matchedBatch.id,
                batchName: matchedBatch.batchName,
                issuerName: matchedBatch.issuerName,
                createdAt: matchedBatch.createdAt,
                revoked: matchedBatch.revoked,
                revokedAt: matchedBatch.revokedAt,
            } : null,
        },
    });
});

// Get verifier history
export const getHistory = asyncHandler(async (req: Request, res: Response) => {
    const { verifierId } = req.params;
    const verifications = await storage.getVerificationsByVerifier(verifierId);
    res.json(verifications);
});

// Get verifier statistics
export const getStats = asyncHandler(async (req: Request, res: Response) => {
    const { verifierId } = req.params;
    const stats = await storage.getVerifierStats(verifierId);
    res.json(stats);
});
