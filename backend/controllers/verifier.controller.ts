import type { Request, Response } from "express";
import { storage } from "../storage";
import { cryptoService } from "../services/crypto";
import { merkleService } from "../services/merkle";
import { blockchainService } from "../services/blockchain";
import { asyncHandler, AppError, BadRequestError } from "../middleware/error-handler";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import keccak256 from "keccak256";
import type { VerifyBody, VerifyMetadataBody } from "../middleware/validation";

type CertificateMetadata = {
    name: string;
    course: string;
    issuer: string;
    date: string;
    certificateId: string;
};

function decodeQrDataFromImage(fileBuffer: Buffer, mimeType?: string): string {
    let imageData: Uint8ClampedArray;
    let width: number;
    let height: number;

    if (mimeType?.includes("png")) {
        const png = PNG.sync.read(fileBuffer);
        width = png.width;
        height = png.height;
        imageData = new Uint8ClampedArray(png.data);
    } else if (mimeType?.includes("jpeg") || mimeType?.includes("jpg")) {
        const jpg = jpeg.decode(fileBuffer, { useTArray: true });
        width = jpg.width;
        height = jpg.height;
        imageData = new Uint8ClampedArray(jpg.data);
    } else {
        // Try PNG first, then JPEG as a fallback based on content.
        try {
            const png = PNG.sync.read(fileBuffer);
            width = png.width;
            height = png.height;
            imageData = new Uint8ClampedArray(png.data);
        } catch {
            const jpg = jpeg.decode(fileBuffer, { useTArray: true });
            width = jpg.width;
            height = jpg.height;
            imageData = new Uint8ClampedArray(jpg.data);
        }
    }

    const qr = jsQR(imageData, width, height);
    if (!qr?.data) {
        throw new BadRequestError("QR code not found in certificate image");
    }

    return qr.data;
}

function extractCertificateIdFromVerifyUrl(qrData: string): string | null {
    try {
        const parsedUrl = new URL(qrData);
        const pathMatch = parsedUrl.pathname.match(/\/verify\/([^/]+)$/i);
        if (pathMatch?.[1]) {
            return decodeURIComponent(pathMatch[1]);
        }

        const fromQuery = parsedUrl.searchParams.get("certificateId");
        return fromQuery ? decodeURIComponent(fromQuery) : null;
    } catch {
        return null;
    }
}

async function resolveCertificateMetadataFromQrData(qrData: string): Promise<CertificateMetadata> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(qrData);
    } catch {
        parsed = null;
    }

    if (parsed) {
        const certificateData = cryptoService.buildCanonicalCertificateData(parsed as Record<string, any>);
        if (!certificateData.name || !certificateData.course || !certificateData.issuer || !certificateData.date || !certificateData.certificateId) {
            throw new BadRequestError("QR metadata is missing required certificate fields");
        }
        return certificateData;
    }

    const certificateIdFromUrl = extractCertificateIdFromVerifyUrl(qrData);
    if (!certificateIdFromUrl) {
        throw new BadRequestError("Invalid QR payload format");
    }

    const normalizedCertificateId = certificateIdFromUrl.toUpperCase();
    const matchedDocument =
        await storage.getDocumentByCertificateId(certificateIdFromUrl) ||
        await storage.getDocumentByCertificateId(normalizedCertificateId);

    if (!matchedDocument) {
        throw new BadRequestError("Certificate not found in system");
    }

    const metadata = cryptoService.buildCanonicalCertificateData(matchedDocument.originalData as Record<string, any>);
    if (!metadata.name || !metadata.course || !metadata.issuer || !metadata.date || !metadata.certificateId) {
        throw new BadRequestError("Certificate metadata is incomplete");
    }

    const certificateData = {
        ...metadata,
        certificateId: normalizedCertificateId,
    };

    return certificateData;
}

function hasRequiredCertificateData(data: { name: string; course: string; issuer: string; date: string; certificateId: string }): boolean {
    return !!(data.name && data.course && data.issuer && data.date && data.certificateId);
}

async function performVerification(
    verifierId: string,
    sourceLabel: string,
    certificateData: { name: string; course: string; issuer: string; date: string; certificateId: string },
) {
    const normalizedIssuer =
        typeof certificateData.issuer === "string"
            ? certificateData.issuer.trim()
            : "";

    if (typeof normalizedIssuer !== "string" || normalizedIssuer.length === 0) {
        throw new BadRequestError("Invalid issuer format");
    }

    const canonicalCertificateData = {
        ...certificateData,
        issuer: normalizedIssuer,
    };

    const hashInput = cryptoService.certificateDataToHashString(canonicalCertificateData);
    const verifyHash = cryptoService.computeHash(hashInput);

    const verification = await storage.createVerification({
        verifierId,
        fileName: sourceLabel,
        documentHash: verifyHash,
        status: "pending",
        verificationData: canonicalCertificateData,
    });

    const matchedDocument = await storage.getDocumentByCertificateId(canonicalCertificateData.certificateId);
    const matchedCertificate = await storage.getCertificateByCertificateId(canonicalCertificateData.certificateId);

    const issueHash = matchedDocument?.documentHash ?? null;
    const hashMatched = issueHash === verifyHash;

    const isInactiveCertificate = !!matchedCertificate && matchedCertificate.status !== "ACTIVE";
    if (isInactiveCertificate) {
        const updatedVerification = await storage.updateVerification(verification.id, {
            digitalSignatureValid: false,
            merkleProofValid: false,
            blockchainVerified: false,
            confidenceScore: 0,
            matchedBatchId: matchedDocument?.batchId,
            matchedDocumentId: matchedDocument?.id,
            status: "failed",
        });

        return {
            success: true,
            status: "INVALID",
            reason: "Certificate revoked or deleted",
            isValid: false,
            isRevoked: true,
            confidence: 0,
            message: "INVALID",
            issueHash,
            verifyHash,
            verification: updatedVerification,
            results: {
                documentFound: !!matchedDocument,
                isRevoked: true,
                digitalSignatureValid: false,
                merkleProofValid: false,
                blockchainVerified: false,
                confidenceScore: 0,
                status: "INVALID",
                hashMatched,
                merkleRoot: matchedDocument?.merkleRoot || null,
                blockchainRootExists: false,
                directHashOnChain: false,
                blockchain: {
                    exists: false,
                    revoked: false,
                    issuer: "0x0",
                    timestamp: 0,
                },
                matchedBatch: null,
            },
        };
    }

    const isPendingBlockchain = !!matchedCertificate && matchedCertificate.blockchainStatus === "PENDING";
    if (isPendingBlockchain) {
        const updatedVerification = await storage.updateVerification(verification.id, {
            digitalSignatureValid: false,
            merkleProofValid: false,
            blockchainVerified: false,
            confidenceScore: 0,
            matchedBatchId: matchedDocument?.batchId,
            matchedDocumentId: matchedDocument?.id,
            status: "pending",
        });

        return {
            success: true,
            status: "PARTIAL",
            reason: "Blockchain confirmation pending",
            isValid: false,
            isRevoked: false,
            confidence: 0,
            message: "Blockchain confirmation pending",
            issueHash,
            verifyHash,
            verification: updatedVerification,
            results: {
                documentFound: !!matchedDocument,
                isRevoked: false,
                digitalSignatureValid: false,
                merkleProofValid: false,
                blockchainVerified: false,
                confidenceScore: 0,
                status: "PARTIAL",
                hashMatched,
                merkleRoot: matchedDocument?.merkleRoot || null,
                blockchainRootExists: false,
                directHashOnChain: false,
                blockchain: {
                    exists: false,
                    revoked: false,
                    issuer: "0x0",
                    timestamp: 0,
                },
                matchedBatch: null,
            },
        };
    }

    let matchedBatch = null;
    let blockchainResult = {
        exists: false,
        revoked: false,
        issuer: "0x0",
        timestamp: 0,
    };

    if (matchedDocument) {
        matchedBatch = await storage.getDocumentBatch(matchedDocument.batchId);
    }

    const storedProof = matchedDocument?.merkleProof as
        | { leaf?: string; path?: unknown; root?: string }
        | null
        | undefined;
    const proofPath = Array.isArray(storedProof?.path) ? storedProof?.path : [];
    const proofRoot =
        (typeof storedProof?.root === "string" && storedProof.root) ||
        matchedBatch?.merkleRoot ||
        null;

    // Build leaf from recreated hash. Stage-1 singleton roots use raw hash with empty proof path.
    const reconstructedLeaf =
        proofPath.length === 0 && proofRoot === verifyHash
            ? verifyHash
            : `0x${keccak256(verifyHash).toString("hex")}`;

    let merkleProofValid = false;
    if (matchedDocument && proofRoot) {
        try {
            merkleProofValid = merkleService.verifyProof({
                leaf: reconstructedLeaf,
                path: proofPath as string[],
                root: proofRoot,
            });
        } catch {
            merkleProofValid = false;
        }
    }

    const directHashBlockchain = await blockchainService.verifyDocument(verifyHash);
    const blockchainRootExists = proofRoot
        ? await blockchainService.rootExists(proofRoot)
        : false;
    const merkleRootBlockchain = proofRoot
        ? await blockchainService.verifyMerkleRoot(proofRoot)
        : blockchainResult;

    // Prefer direct hash verification (Stage-6); keep Merkle-root fallback for older batches.
    blockchainResult = directHashBlockchain.exists ? directHashBlockchain : merkleRootBlockchain;

    const digitalSignatureValid = !!matchedDocument?.digitalSignature
        ? cryptoService.verifySignature(hashInput, matchedDocument.digitalSignature)
        : false;
    const directHashChainValid = directHashBlockchain.exists && !directHashBlockchain.revoked;
    const merkleChainValid = blockchainRootExists && !merkleRootBlockchain.revoked;
    const blockchainVerified = directHashBlockchain.exists || blockchainRootExists;

    const isRevoked = (blockchainResult.revoked || matchedBatch?.revoked === true) && blockchainVerified;
    const isValid = !!matchedDocument && hashMatched && (directHashChainValid || (merkleProofValid && merkleChainValid)) && !isRevoked;
    const isOrphaned = !matchedDocument && directHashBlockchain.exists;

    let confidenceScore = 0;
    if (isRevoked) confidenceScore = 0;
    else if (isValid) confidenceScore = 100;
    else if (isOrphaned) confidenceScore = 0;
    else confidenceScore = merkleProofValid && blockchainRootExists ? 90 : 0;

    const finalStatus = !matchedDocument
        ? "failed"
        : isRevoked
            ? "failed"
            : isValid
                ? "verified"
                : "failed";

    const updatedVerification = await storage.updateVerification(verification.id, {
        digitalSignatureValid,
        merkleProofValid,
        blockchainVerified,
        confidenceScore,
        matchedBatchId: matchedDocument?.batchId,
        matchedDocumentId: matchedDocument?.id,
        status: finalStatus,
    });

    const verificationStatus = !matchedDocument
        ? (isOrphaned ? "ORPHANED" : "NOT_FOUND")
        : isRevoked
            ? "REVOKED"
            : isValid
                ? "VALID"
                : "INVALID";

    const message = verificationStatus === "ORPHANED"
        ? "Certificate deleted from system but exists on blockchain"
        : verificationStatus === "NOT_FOUND"
            ? "Certificate not found (possibly deleted)"
            : verificationStatus;

    return {
        success: true,
        status: verificationStatus,
        isValid,
        isRevoked,
        confidence: confidenceScore,
        message,
        issueHash,
        verifyHash,
        verification: updatedVerification,
        results: {
            documentFound: !!matchedDocument,
            isRevoked,
            digitalSignatureValid,
            merkleProofValid,
            blockchainVerified,
            confidenceScore,
            status: verificationStatus,
            hashMatched,
            merkleRoot: proofRoot,
            blockchainRootExists,
            directHashOnChain: directHashBlockchain.exists,
            blockchain: {
                exists: blockchainResult.exists,
                revoked: blockchainResult.revoked,
                issuer: blockchainResult.issuer,
                timestamp: blockchainResult.timestamp,
            },
            matchedBatch: matchedBatch
                ? {
                    id: matchedBatch.id,
                    batchName: matchedBatch.batchName,
                    issuerName: matchedBatch.issuerName,
                    createdAt: matchedBatch.createdAt,
                    revoked: matchedBatch.revoked,
                    revokedAt: matchedBatch.revokedAt,
                }
                : null,
        },
    };
}

// Verify document
export const verifyDocument = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
        throw new BadRequestError("No file uploaded");
    }

    const { verifierId } = req.body as VerifyBody;

    const fileName = req.file.originalname;
    const fileExtension = fileName.split('.').pop() || '';
    const normalizedExtension = fileExtension.toLowerCase();
    const mimeType = (req.file.mimetype || "").toLowerCase();

    const isSupportedImage =
        normalizedExtension === "png" ||
        normalizedExtension === "jpg" ||
        normalizedExtension === "jpeg";

    if (!isSupportedImage) {
        throw new BadRequestError("Unsupported file type. Verification accepts PNG, JPG, or JPEG only.");
    }

    if (!mimeType.includes("png") && !mimeType.includes("jpeg") && !mimeType.includes("jpg")) {
        throw new BadRequestError("Invalid image upload. Provide a PNG or JPEG certificate image containing QR metadata.");
    }

    const qrData = decodeQrDataFromImage(req.file.buffer, req.file.mimetype);

    const certificateIdFromUrl = extractCertificateIdFromVerifyUrl(qrData);
    if (certificateIdFromUrl) {
        const normalizedCertificateId = certificateIdFromUrl.toUpperCase();
        const matchedDocument =
            await storage.getDocumentByCertificateId(certificateIdFromUrl) ||
            await storage.getDocumentByCertificateId(normalizedCertificateId);

        if (!matchedDocument) {
            return res.json({
                success: true,
                status: "NOT_FOUND",
                isValid: false,
                confidence: 0,
                message: "Certificate not found (possibly deleted)",
                results: {
                    documentFound: false,
                    isRevoked: false,
                    digitalSignatureValid: false,
                    merkleProofValid: false,
                    blockchainVerified: false,
                    confidenceScore: 0,
                    status: "NOT_FOUND",
                },
            });
        }
    }

    const certificateData = await resolveCertificateMetadataFromQrData(qrData);

    const response = await performVerification(verifierId, req.file.originalname, certificateData);
    res.json(response);
});

// Get certificate metadata by certificateId
export const getCertificateById = asyncHandler(async (req: Request, res: Response) => {
    const { certificateId } = req.params;
    const normalizedCertificateId = decodeURIComponent(certificateId).toUpperCase();

    const certificate =
        await storage.getCertificateByCertificateId(certificateId) ||
        await storage.getCertificateByCertificateId(normalizedCertificateId);

    if (!certificate) {
        throw new AppError("Certificate not found in system", 404, "NOT_FOUND");
    }

    const toDate = (value: Date | null) => {
        if (!value) return null;
        return value.toISOString().split("T")[0];
    };

    const document =
        (certificate.documentId ? await storage.getDocument(certificate.documentId) : undefined) ||
        await storage.getDocumentByCertificateId(certificate.certificateId) ||
        await storage.getDocumentByCertificateId(normalizedCertificateId);

    const effectiveStatus = document?.revoked ? "REVOKED" : certificate.status;
    const effectiveHash = document?.hash || document?.documentHash || certificate.hash;
    const effectiveIssuer = document?.issuer || certificate.issuerName;

    res.json({
        certificateId: certificate.certificateId,
        holderName: certificate.holderName,
        course: certificate.course,
        issuer: effectiveIssuer,
        issueDate: toDate(certificate.issueDate),
        expiryDate: toDate(certificate.expiryDate),
        status: effectiveStatus,
        blockchainStatus: certificate.blockchainStatus,
        hash: effectiveHash,
    });
});

// Verify using canonical certificate metadata (primary flow)
export const verifyMetadata = asyncHandler(async (req: Request, res: Response) => {
    const { verifierId, name, course, issuer, date, certificateId } = req.body as VerifyMetadataBody;

    const certificateData = cryptoService.buildCanonicalCertificateData({
        name,
        course,
        issuer,
        date,
        certificateId,
    });

    if (!hasRequiredCertificateData(certificateData)) {
        throw new BadRequestError("Missing required certificate data for verification");
    }

    const response = await performVerification(
        verifierId,
        `metadata-${certificateId}.json`,
        certificateData,
    );

    res.json(response);
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
