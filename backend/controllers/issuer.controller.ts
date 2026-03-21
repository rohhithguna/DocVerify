import type { Request, Response } from "express";
import { storage } from "../storage";
import { cryptoService } from "../services/crypto";
import { merkleService } from "../services/merkle";
import { blockchainService } from "../services/blockchain";
import { asyncHandler, NotFoundError, UnauthorizedError, BadRequestError } from "../middleware/error-handler";
import type { AuthRequest } from "../middleware/auth";
import Papa from "papaparse";
import keccak256 from "keccak256";
import type { CreateCertificateBatchBody, CreateCertificateBody, UploadBody } from "../middleware/validation";

function requireIssuerOwnership(userId: string | undefined, issuerId: string): void {
    if (!userId || userId !== issuerId) {
        throw new UnauthorizedError("You are not authorized to access this issuer resource");
    }
}

function scheduleBlockchainRetry(params: {
    documentId: string;
    batchId: string;
    certificateRecordId: string;
    documentHash: string;
}) {
    const retryDelaysMs = [30_000, 120_000, 300_000];

    retryDelaysMs.forEach((delayMs, index) => {
        setTimeout(async () => {
            try {
                const tx = await blockchainService.issueDocument(params.documentHash);
                if (tx.status !== "confirmed") {
                    return;
                }

                await storage.updateDocumentBatch(params.batchId, {
                    blockchainTxHash: tx.hash || null,
                    blockNumber: String(tx.blockNumber || 0),
                    status: "completed",
                });

                await storage.updateCertificate(params.certificateRecordId, {
                    blockchainStatus: "CONFIRMED",
                    txHash: tx.hash,
                });

                console.log(`[BlockchainRetry] Certificate ${params.documentId} confirmed on attempt ${index + 1}`);
            } catch (error) {
                // Retry sequence is best-effort by design.
            }
        }, delayMs);
    });
}

// Upload and process CSV documents
export const uploadDocuments = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.file) {
        throw new BadRequestError("No file uploaded");
    }

    const fileName = req.file.originalname.toLowerCase();
    if (!fileName.endsWith(".csv")) {
        throw new BadRequestError("Unsupported file type. Issuer upload accepts CSV files only.");
    }

    const { batchName, issuerName, groupingCriterion } = req.body as UploadBody;
    const issuerId = req.user?.userId;

    if (!issuerId) {
        throw new UnauthorizedError("Authentication required");
    }

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
                certificateId: typeof doc.originalData?.certificateId === "string" ? doc.originalData.certificateId : null,
                name: typeof doc.originalData?.name === "string" ? doc.originalData.name : null,
                course: typeof doc.originalData?.course === "string" ? doc.originalData.course : null,
                issuer: typeof doc.originalData?.issuer === "string" ? doc.originalData.issuer : null,
                issuedDate: typeof doc.originalData?.date === "string" ? doc.originalData.date : null,
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

        // Store each group's Merkle root on blockchain (strict mode: fail if unavailable)
        const blockchainTx = await blockchainService.storeMerkleRoot(
            merkleRoot,
            `${batch.id}-group-${groupIndex}`
        );

        if (groupIndex === 0) {
            primaryBlockchainTx = blockchainTx;
        }
    }

    // Update batch with primary Merkle root and blockchain TX
    if (primaryMerkleRoot) {
        await storage.updateDocumentBatch(batch.id, {
            merkleRoot: primaryMerkleRoot,
            blockchainTxHash: primaryBlockchainTx?.hash,
            blockNumber: primaryBlockchainTx?.blockNumber?.toString(),
            status: primaryBlockchainTx?.status === 'confirmed' ? 'completed' : 'blockchain_stored',
        });
    }

    const updatedBatch = await storage.getDocumentBatch(batch.id);
    res.json({
        success: true,
        batch: updatedBatch,
        documentsProcessed: processedDocuments.length
    });
});

// Get issuer batches
export const getBatches = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { issuerId } = req.params;
    requireIssuerOwnership(req.user?.userId, issuerId);
    const batches = await storage.getDocumentBatchesByIssuer(issuerId);
    res.json(batches);
});

// Delete a batch
export const deleteBatch = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { issuerId, batchId } = req.params;
    requireIssuerOwnership(req.user?.userId, issuerId);

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

// Soft-delete a certificate document: keep DB row, mark certificate status as DELETED.
export const deleteDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id: documentId } = req.params;

    // Fetch document
    const document = await storage.getDocument(documentId);
    if (!document) {
        throw new NotFoundError("Document");
    }

    // Verify batch exists and authorize
    const batch = await storage.getDocumentBatch(document.batchId);
    if (!batch) {
        throw new NotFoundError("Batch");
    }

    if (!req.user || batch.issuerId !== req.user.userId) {
        throw new UnauthorizedError("You are not authorized to delete this document");
    }

    const certificate = await storage.getCertificateByDocumentId(documentId);
    if (!certificate) {
        throw new NotFoundError("Certificate");
    }

    if (certificate.status === "DELETED") {
        return res.status(404).json({
            success: false,
            error: "ALREADY_DELETED",
            message: "Certificate already deleted",
        });
    }

    const now = new Date();

    // Source of truth is DB status; blockchain remains immutable.
    await storage.updateCertificate(certificate.id, { status: "DELETED" });
    await storage.updateDocument(documentId, { revoked: true, revokedAt: now });

    console.log(`[Delete] Soft-deleted certificate ${certificate.certificateId} (${documentId}) by ${req.user?.email}`);

    return res.json({
        success: true,
        message: "Certificate marked as deleted",
        deletedDocumentId: documentId,
        certificateId: certificate.certificateId,
        status: "DELETED",
    });
});

// Create certificate (form-based — lightweight metadata only, no images)
export const createCertificate = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { issuerId } = req.params;
    requireIssuerOwnership(req.user?.userId, issuerId);
    const {
        holder,
        certificateDetails,
        issuer,
        validity,
        security,
        signature,
        verification,
    } = req.body as CreateCertificateBody;

    const issuerValue: unknown = issuer as unknown;
    const normalizedIssuer =
        typeof issuerValue === "string"
            ? issuerValue.trim()
            : (typeof (issuerValue as { name?: unknown; issuerName?: unknown })?.name === "string"
                ? String((issuerValue as { name?: string }).name).trim()
                : String((issuerValue as { issuerName?: string })?.issuerName || "").trim());

    if (typeof normalizedIssuer !== "string" || normalizedIssuer.length === 0) {
        throw new BadRequestError("Invalid issuer format");
    }

    // Canonical certificate data for Stage-6 hashing and verification.
    const certificateData = {
        name: holder.name,
        course: certificateDetails.course,
        issuer: normalizedIssuer,
        date: validity.issueDate,
        certificateId: certificateDetails.certificateId,
    };

    const canonicalJson = JSON.stringify(certificateData);
    const computedHash = cryptoService.computeHash(canonicalJson);
    const systemSignature = cryptoService.signData(canonicalJson);
    const blockchainRequired = String(process.env.BLOCKCHAIN_REQUIRED || "false").toLowerCase() === "true";
    const isTestMode = (process.env.NODE_ENV || "").toLowerCase() === "test";

    const networkStatus = await blockchainService.getNetworkStatus();
    const blockchainAvailable = networkStatus.status === "CONNECTED";

    if (blockchainRequired && !blockchainAvailable) {
        return res.status(503).json({
            success: false,
            error: "BLOCKCHAIN_UNAVAILABLE",
            message: "Blockchain network is currently unavailable",
        });
    }

    // Stage-1 uses direct document hash anchoring for certificate verification.
    const merkleRoot = computedHash;
    const proof = {
        leaf: computedHash,
        path: [],
        root: computedHash,
    };

    // Create batch for this certificate
    const batch = await storage.createDocumentBatch({
        batchName: `Certificate: ${holder.name}`,
        issuerId,
        issuerName: normalizedIssuer,
        fileName: `${certificateDetails.certificateId}.cert`,
        documentCount: 1,
        groupingCriterion: "certificate",
        status: "processing",
    });

    // Create document record (metadata only — no image data stored)
    const document = await storage.createDocument({
        batchId: batch.id,
        certificateId: certificateDetails.certificateId,
        name: holder.name,
        course: certificateDetails.course,
        issuer: normalizedIssuer,
        issuedDate: validity.issueDate,
        documentHash: computedHash,
        digitalSignature: systemSignature,
        merkleRoot,
        originalData: {
            ...certificateData,
            holder,
            certificateDetails,
            issuerDetails: issuer,
            issuerName: normalizedIssuer,
            issuer: normalizedIssuer,
            validity,
            security,
            signature,
            verification,
            hash: computedHash,
        },
        merkleProof: proof,
    });

    let blockchainTx: { hash: string | null; blockNumber: number; gasUsed: string; status: "pending" | "confirmed" | "failed" } | null = null;
    let blockchainStatus: "CONFIRMED" | "PENDING" | "FAILED" = "PENDING";

    if (isTestMode) {
        blockchainTx = { hash: "mock_tx_hash", blockNumber: 0, gasUsed: "0", status: "confirmed" };
        blockchainStatus = "CONFIRMED";
    } else if (!blockchainAvailable && !blockchainRequired) {
        blockchainStatus = "PENDING";
        blockchainTx = { hash: null, blockNumber: 0, gasUsed: "0", status: "pending" };
    } else {
        try {
            blockchainTx = await blockchainService.issueDocument(computedHash);
            if (blockchainTx.status === "failed") {
                blockchainStatus = "FAILED";
            } else if (blockchainTx.status === "pending") {
                blockchainStatus = "PENDING";
            } else {
                blockchainStatus = "CONFIRMED";
            }

            // Strict mode verifies immediate on-chain presence.
            if (blockchainRequired) {
                const onChainState = await blockchainService.verifyDocument(computedHash);
                if (!onChainState.exists || onChainState.revoked) {
                    throw new BadRequestError("Issued certificate hash could not be verified on blockchain");
                }
                blockchainStatus = "CONFIRMED";
            }
        } catch (error) {
            if (blockchainRequired) {
                throw error;
            }

            blockchainStatus = "PENDING";
            blockchainTx = { hash: null, blockNumber: 0, gasUsed: "0", status: "pending" };
        }
    }

    // Persist batch state with on-chain tx linkage.
    await storage.updateDocumentBatch(batch.id, {
        merkleRoot,
        blockchainTxHash: blockchainTx?.hash || null,
        blockNumber: blockchainTx?.blockNumber?.toString() || null,
        status:
            blockchainStatus === "CONFIRMED"
                ? "completed"
                : blockchainStatus === "FAILED"
                    ? "blockchain_stored"
                    : "pending_blockchain",
    });

    let createdCertificate: Awaited<ReturnType<typeof storage.createCertificate>> | null = null;

    try {
        createdCertificate = await storage.createCertificate({
            documentId: document.id,
            holderName: holder.name,
            studentId: holder.studentId,
            holderEmail: holder.email || null,
            certificateId: certificateDetails.certificateId,
            course: certificateDetails.course,
            level: certificateDetails.level,
            duration: certificateDetails.duration,
            grade: certificateDetails.grade || null,
            issuerName: normalizedIssuer,
            issuerId: issuer.issuerId,
            issuerWallet: issuer.issuerWallet,
            issueDate: new Date(validity.issueDate),
            expiryDate: new Date(validity.expiryDate),
            status: "ACTIVE",
            blockchainStatus,
            hash: computedHash,
            txHash: blockchainTx?.hash || null,
            merkleRoot: merkleRoot || security.merkleRoot || null,
            signature: signature.signature,
            signedBy: signature.signedBy,
            qrCodeUrl: verification.qrCodeUrl,
        });
    } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505") {
            return res.status(409).json({
                success: false,
                error: "DUPLICATE_CERTIFICATE",
                message: "Certificate already exists",
            });
        }
        throw error;
    }

    if (blockchainStatus === "PENDING" && createdCertificate) {
        scheduleBlockchainRetry({
            documentId: document.id,
            batchId: batch.id,
            certificateRecordId: createdCertificate.id,
            documentHash: computedHash,
        });
    }

    return res.json({
        success: true,
        certificateId: certificateDetails.certificateId,
        documentId: document.id,
        batchId: batch.id,
        hash: computedHash,
        txHash: blockchainTx?.hash || null,
        blockchainStatus,
    });
});

// Create Merkle root and proofs for a certificate batch
export const createCertificateBatch = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { issuerId } = req.params;
    requireIssuerOwnership(req.user?.userId, issuerId);
    const { certificates } = req.body as CreateCertificateBatchBody;

    const missingCertificate = certificates.find((certificate) => {
        const canonical = cryptoService.buildCanonicalCertificateData(certificate);
        return !(canonical.name && canonical.course && canonical.issuer && canonical.date && canonical.certificateId);
    });

    if (missingCertificate) {
        throw new BadRequestError("Each certificate must include name, course, issuer, date, and certificateId");
    }

    const duplicateId = (() => {
        const seen = new Set<string>();
        for (const certificate of certificates) {
            const id = certificate.certificateId.toUpperCase();
            if (seen.has(id)) return id;
            seen.add(id);
        }
        return null;
    })();

    if (duplicateId) {
        throw new BadRequestError(`Duplicate certificateId in batch: ${duplicateId}`);
    }

    const batchResult = merkleService.generateCertificateMerkleBatch(certificates);

    // Validate proof integrity before persisting.
    const invalidProof = batchResult.certificates.find((item) => {
        const leaf = `0x${keccak256(item.hash).toString("hex")}`;
        return !merkleService.verifyProof({
            leaf,
            path: item.proof,
            root: batchResult.root,
        });
    });

    if (invalidProof) {
        throw new BadRequestError(`Merkle proof validation failed for certificateId: ${invalidProof.metadata.certificateId}`);
    }

    const batch = await storage.createDocumentBatch({
        batchName: `Certificate Batch ${new Date().toISOString()}`,
        issuerId,
        issuerName: batchResult.certificates[0]?.metadata.issuer || "Unknown Issuer",
        fileName: `cert-batch-${Date.now()}.json`,
        documentCount: batchResult.certificates.length,
        groupingCriterion: "certificate",
        status: "processing",
    });

    let blockchainTx: Awaited<ReturnType<typeof blockchainService.storeMerkleRoot>> | null = null;
    try {
        blockchainTx = await blockchainService.storeMerkleRoot(batchResult.root, batch.id);

        const rootStatus = await blockchainService.verifyMerkleRoot(batchResult.root, blockchainTx.hash ?? undefined);
        if (!rootStatus.exists || rootStatus.revoked) {
            throw new BadRequestError("Stored Merkle root could not be verified on blockchain");
        }
    } catch (error) {
        await storage.updateDocumentBatch(batch.id, {
            merkleRoot: batchResult.root,
            status: "processing",
        });
        throw error;
    }

    const persistedCertificates = await Promise.all(
        batchResult.certificates.map(async (item) => {
            const hashInput = cryptoService.certificateDataToHashString(item.metadata);
            const signature = cryptoService.signData(hashInput);
            const merkleProofRecord = {
                leaf: `0x${keccak256(item.hash).toString("hex")}`,
                path: item.proof,
                root: batchResult.root,
            };

            const certificateRecord = {
                certificateId: item.metadata.certificateId,
                metadata: item.metadata,
                hash: item.hash,
                merkleProof: item.proof,
                merkleRoot: batchResult.root,
            };

            const document = await storage.createDocument({
                batchId: batch.id,
                certificateId: item.metadata.certificateId,
                name: item.metadata.name,
                course: item.metadata.course,
                issuer: item.metadata.issuer,
                issuedDate: item.metadata.date,
                documentHash: item.hash,
                digitalSignature: signature,
                merkleRoot: batchResult.root,
                originalData: {
                    ...item.metadata,
                    hash: item.hash,
                    merkleProof: item.proof,
                    merkleRoot: batchResult.root,
                    certificateRecord,
                },
                merkleProof: merkleProofRecord,
            });

            return {
                id: document.id,
                certificateId: item.metadata.certificateId,
                metadata: item.metadata,
                hash: item.hash,
                merkleProof: item.proof,
                merkleRoot: batchResult.root,
            };
        })
    );

    await storage.updateDocumentBatch(batch.id, {
        merkleRoot: batchResult.root,
        blockchainTxHash: blockchainTx?.hash,
        blockNumber: blockchainTx?.blockNumber?.toString(),
        status: blockchainTx?.status === "confirmed" ? "completed" : "signed",
    });

    const updatedBatch = await storage.getDocumentBatch(batch.id);

    res.json({
        success: true,
        batch: updatedBatch,
        root: batchResult.root,
        certificates: persistedCertificates,
    });
});

// Get issuer statistics
export const getStats = asyncHandler(async (req: AuthRequest, res: Response) => {
    const { issuerId } = req.params;
    requireIssuerOwnership(req.user?.userId, issuerId);
    const stats = await storage.getIssuerStats(issuerId);
    res.json(stats);
});
