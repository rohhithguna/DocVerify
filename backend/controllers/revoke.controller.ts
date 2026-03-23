import type { Response } from "express";
import { storage } from "../storage";
import { blockchainService } from "../services/blockchain";
import { asyncHandler, NotFoundError, BadRequestError } from "../middleware/error-handler";
import type { AuthRequest } from "../middleware/auth";
import { createLogger } from "../services/logger";

const logger = createLogger("revoke-controller");

/**
 * POST /api/issuer/revoke
 * Revoke a document batch (marks it on blockchain + database).
 *
 * Body: { batchId: string }
 * Auth: requireAuth (only the original issuer can revoke)
 */
export const revokeDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { batchId } = req.body;

  if (!batchId) {
    throw new BadRequestError("batchId is required");
  }

  // Get the batch
  const batch = await storage.getDocumentBatch(batchId);
  if (!batch) {
    throw new NotFoundError("Document batch");
  }

  // Authorization: only the original issuer can revoke
  if (batch.issuerId !== req.user?.userId) {
    return res.status(403).json({
      error: "Only the original issuer can revoke this document",
    });
  }

  // Check if already revoked
  if (batch.revoked) {
    return res.status(409).json({
      error: "This document has already been revoked",
      revokedAt: batch.revokedAt,
    });
  }

  // Check if the batch has a Merkle root stored on-chain
  if (!batch.merkleRoot) {
    throw new BadRequestError(
      "Cannot revoke: this batch has no blockchain record (no Merkle root)"
    );
  }

  // Call smart contract to revoke with retry logic
  let blockchainTx = null;
  const MAX_RETRIES = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      blockchainTx = await blockchainService.revokeDocument(batch.merkleRoot);
      break; // Success - exit retry loop
    } catch (error: any) {
      lastError = error;
      if (attempt < MAX_RETRIES - 1) {
        const delayMs = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  if (!blockchainTx) {
    logger.error("Blockchain revocation failed after retries", {
      batchId,
      revokedBy: req.user?.email,
      error: lastError?.message || "Unknown blockchain error",
    });
    return res.status(500).json({
      error: "Blockchain revocation failed after retries",
    });
  }

  // Update database
  await storage.updateDocumentBatch(batchId, {
    revoked: true,
    revokedAt: new Date(),
    status: "revoked",
  });

  const docsInBatch = await storage.getDocumentsByBatch(batchId);
  const revokedAt = new Date();
  await Promise.all(
    docsInBatch.map((doc) =>
      storage.updateDocument(doc.id, {
        revoked: true,
        revokedAt,
      })
    )
  );

  const updatedBatch = await storage.getDocumentBatch(batchId);

  logger.info("Batch revoked successfully", {
    batchId,
    revokedBy: req.user?.email,
    documentCount: docsInBatch.length,
    txHash: blockchainTx?.hash,
  });

  res.json({
    success: true,
    message: "Document revoked successfully",
    batch: updatedBatch,
    blockchain: {
      txHash: blockchainTx.hash,
      blockNumber: blockchainTx.blockNumber,
      status: blockchainTx.status,
    },
  });
});

/**
 * POST /api/issuer/unrevoke
 * Unrevoke a document batch (marks it unrevoked on blockchain + database).
 *
 * Body: { batchId: string }
 * Auth: requireAuth (only the original issuer can unrevoke)
 */
export const unrevokeDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { batchId } = req.body;

  if (!batchId) {
    throw new BadRequestError("batchId is required");
  }

  // Get the batch
  const batch = await storage.getDocumentBatch(batchId);
  if (!batch) {
    throw new NotFoundError("Document batch");
  }

  // Authorization: only the original issuer can unrevoke
  if (batch.issuerId !== req.user?.userId) {
    return res.status(403).json({
      error: "Only the original issuer can unrevoke this document",
    });
  }

  // Check if actually revoked
  if (!batch.revoked) {
    return res.status(409).json({
      error: "This document is not currently revoked",
    });
  }

  // Check if the batch has a Merkle root stored on-chain
  if (!batch.merkleRoot) {
    throw new BadRequestError(
      "Cannot unrevoke: this batch has no blockchain record (no Merkle root)"
    );
  }

  // Call smart contract to unrevoke with retry logic
  let blockchainTx = null;
  const MAX_RETRIES = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      blockchainTx = await blockchainService.unrevokeMerkleRoot(batch.merkleRoot);
      break; // Success - exit retry loop
    } catch (error: any) {
      lastError = error;
      if (attempt < MAX_RETRIES - 1) {
        const delayMs = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  if (!blockchainTx) {
    logger.error("Blockchain unrevocation failed after retries", {
      batchId,
      unrevokedBy: req.user?.email,
      error: lastError?.message || "Unknown blockchain error",
    });
    return res.status(500).json({
      error: "Blockchain unrevocation failed after retries",
    });
  }

  // Update database
  await storage.updateDocumentBatch(batchId, {
    revoked: false,
    revokedAt: null,
    status: "completed",
  });

  const docsInBatch = await storage.getDocumentsByBatch(batchId);
  await Promise.all(
    docsInBatch.map((doc) =>
      storage.updateDocument(doc.id, {
        revoked: false,
        revokedAt: null,
      })
    )
  );

  const updatedBatch = await storage.getDocumentBatch(batchId);

  logger.info("Batch unrevoked successfully", {
    batchId,
    unrevokedBy: req.user?.email,
    documentCount: docsInBatch.length,
    txHash: blockchainTx?.hash,
  });

  res.json({
    success: true,
    message: "Document reconnected successfully",
    batch: updatedBatch,
    blockchain: {
      txHash: blockchainTx.hash,
      blockNumber: blockchainTx.blockNumber,
      status: blockchainTx.status,
    },
  });
});

