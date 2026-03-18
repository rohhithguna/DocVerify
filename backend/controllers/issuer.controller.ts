import type { Request, Response } from "express";
import { storage } from "../storage";
import { cryptoService } from "../services/crypto";
import { merkleService } from "../services/merkle";
import { blockchainService } from "../services/blockchain";
import { asyncHandler, NotFoundError, UnauthorizedError, BadRequestError } from "../middleware/error-handler";
import Papa from "papaparse";
import type { CreateCertificateBody, UploadBody } from "../middleware/validation";

// Upload and process CSV documents
export const uploadDocuments = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new BadRequestError("No file uploaded");
    }

    const { batchName, issuerId, issuerName, groupingCriterion } = req.body as UploadBody;

    // Parse CSV file
    const csvContent = req.file.buffer.toString('utf-8');
    const parseResult = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true
    });

    if (parseResult.errors.length > 0) {
        const errorMessages = parseResult.errors
            .slice(0, 3)
            .map(err => `Line ${(err.row ?? 0) + 1}: ${err.message}`)
            .join('\n');

        throw new BadRequestError(
            `Invalid CSV format: ${errorMessages}. Ensure your CSV has proper headers and no empty rows.`
        );
    }

    const csvData = parseResult.data as Record<string, any>[];

    if (csvData.length === 0) {
        throw new BadRequestError("CSV file is empty. Please upload a CSV file with at least one data row.");
    }

    // Process documents
    const processedDocuments = cryptoService.processDocumentData(csvData);

    // Create document batch
    const batch = await storage.createDocumentBatch({
        batchName,
        issuerId,
        issuerName,
        fileName: req.file.originalname,
        documentCount: processedDocuments.length,
        groupingCriterion,
        status: "processing",
    });

    // Store individual documents
    const documents = await Promise.all(
        processedDocuments.map(doc =>
            storage.createDocument({
                batchId: batch.id,
                documentHash: doc.hash,
                digitalSignature: doc.signature,
                originalData: doc.originalData,
            })
        )
    );

    // Group documents and create Merkle trees
    const documentGroups = merkleService.groupDocuments(
        processedDocuments.map(doc => ({ hash: doc.hash, originalData: doc.originalData })),
        groupingCriterion
    );

    // Process ALL groups
    let primaryMerkleRoot: string | null = null;
    let primaryBlockchainTx: any = null;

    for (let groupIndex = 0; groupIndex < documentGroups.length; groupIndex++) {
        const group = documentGroups[groupIndex];

        if (group.length === 0) continue;

        const hashes = group.map(doc => doc.hash);
        const merkleTree = merkleService.createTree(hashes);
        const merkleRoot = merkleTree.getRoot();

        if (groupIndex === 0) {
            primaryMerkleRoot = merkleRoot;
        }

        // Generate and store proofs for all documents in this group
        for (let i = 0; i < hashes.length; i++) {
            const documentHash = hashes[i];
            const document = documents.find(doc => doc.documentHash === documentHash);

            if (document) {
                const proof = merkleTree.generateProof(documentHash);
                if (proof) {
                    await storage.updateDocument(document.id, { merkleProof: proof });
                }
            }
        }

        // Store each group's Merkle root on blockchain
        try {
            const blockchainTx = await blockchainService.storeMerkleRoot(
                merkleRoot,
                `${batch.id}-group-${groupIndex}`
            );

            if (groupIndex === 0) {
                primaryBlockchainTx = blockchainTx;
            }

            console.log(`Group ${groupIndex} Merkle root stored on blockchain: ${merkleRoot}`);
        } catch (blockchainError) {
            console.error(`Blockchain storage failed for group ${groupIndex}:`, blockchainError);
        }
    }

    // Update batch with primary Merkle root and blockchain TX
    if (primaryMerkleRoot) {
        try {
            await storage.updateDocumentBatch(batch.id, {
                merkleRoot: primaryMerkleRoot,
                blockchainTxHash: primaryBlockchainTx?.hash,
                blockNumber: primaryBlockchainTx?.blockNumber?.toString(),
                status: primaryBlockchainTx?.status === 'confirmed' ? 'completed' : 'blockchain_stored',
            });
        } catch (updateError) {
            console.error('Failed to update batch with blockchain info:', updateError);
            await storage.updateDocumentBatch(batch.id, {
                merkleRoot: primaryMerkleRoot,
                status: 'signed',
            });
        }
    }

    const updatedBatch = await storage.getDocumentBatch(batch.id);
    res.json({
        success: true,
        batch: updatedBatch,
        documentsProcessed: processedDocuments.length
    });
});

// Get issuer batches
export const getBatches = asyncHandler(async (req: Request, res: Response) => {
    const { issuerId } = req.params;
    const batches = await storage.getDocumentBatchesByIssuer(issuerId);
    res.json(batches);
});

// Delete a batch
export const deleteBatch = asyncHandler(async (req: Request, res: Response) => {
    const { issuerId, batchId } = req.params;

    const batch = await storage.getDocumentBatch(batchId);
    if (!batch) {
        throw new NotFoundError("Batch");
    }
    if (batch.issuerId !== issuerId) {
        throw new UnauthorizedError("You are not authorized to delete this batch");
    }

    const deleted = await storage.deleteDocumentBatch(batchId);
    if (!deleted) {
        throw new Error("Failed to delete batch");
    }

    res.json({ success: true, message: "Batch deleted successfully" });
});

// Create certificate (form-based)
export const createCertificate = asyncHandler(async (req: Request, res: Response) => {
    const { issuerId } = req.params;
    const { recipientName, certificateTitle, eventName, issueDate, issuerName, certificateId, imageData } =
        req.body as CreateCertificateBody;

    // Create a data string from certificate details for hashing
    const certificateData = {
        recipientName,
        certificateTitle,
        eventName,
        issueDate,
        issuerName,
        certificateId,
        issuerId,
    };

    const dataString = cryptoService.csvRowToDataString(certificateData);
    const documentHash = cryptoService.computeHash(dataString);

    // Extract raw base64 from data URL
    let rawImageBase64 = imageData || '';
    if (rawImageBase64.includes(',')) {
        rawImageBase64 = rawImageBase64.split(',')[1];
    }
    const imageHash = rawImageBase64 ? cryptoService.computeHash(rawImageBase64) : null;
    const signature = cryptoService.signData(dataString);

    console.log('[CREATE-CERT] Certificate ID:', certificateId);
    console.log('[CREATE-CERT] Document Hash:', documentHash);
    console.log('[CREATE-CERT] Image Hash:', imageHash);

    // Create batch for this certificate
    const batch = await storage.createDocumentBatch({
        batchName: `Certificate: ${recipientName}`,
        issuerId,
        issuerName,
        fileName: `${certificateId}.png`,
        documentCount: 1,
        groupingCriterion: "certificate",
        status: "processing",
    });

    // Create document record
    const document = await storage.createDocument({
        batchId: batch.id,
        documentHash,
        digitalSignature: signature,
        originalData: {
            ...certificateData,
            imageHash,
        },
    });

    // Create Merkle tree with single document
    const merkleTree = merkleService.createTree([documentHash]);
    const merkleRoot = merkleTree.getRoot();
    const proof = merkleTree.generateProof(documentHash);

    // Update document with Merkle proof
    if (proof) {
        await storage.updateDocument(document.id, { merkleProof: proof });
    }

    // Store on blockchain
    let blockchainTx = null;
    try {
        blockchainTx = await blockchainService.storeMerkleRoot(merkleRoot, batch.id);
    } catch (blockchainError) {
        console.error("Blockchain storage failed:", blockchainError);
    }

    // Update batch with Merkle root and blockchain info
    await storage.updateDocumentBatch(batch.id, {
        merkleRoot,
        blockchainTxHash: blockchainTx?.hash,
        blockNumber: blockchainTx?.blockNumber?.toString(),
        status: blockchainTx?.status === 'confirmed' ? 'completed' : 'signed',
    });

    const updatedBatch = await storage.getDocumentBatch(batch.id);

    res.json({
        success: true,
        certificate: {
            id: document.id,
            certificateId,
            documentHash,
            imageHash,
            recipientName,
            eventName,
        },
        batch: updatedBatch,
    });
});

// Get issuer statistics
export const getStats = asyncHandler(async (req: Request, res: Response) => {
    const { issuerId } = req.params;
    const stats = await storage.getIssuerStats(issuerId);
    res.json(stats);
});
