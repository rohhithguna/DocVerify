import type { Response } from "express";
import { storage } from "../storage";
import { blockchainService } from "../services/blockchain";
import { asyncHandler, NotFoundError, BadRequestError } from "../middleware/error-handler";
import type { AuthRequest } from "../middleware/auth";

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

  // Call smart contract to revoke
  let blockchainTx = null;
  try {
    blockchainTx = await blockchainService.revokeDocument(batch.merkleRoot);
  } catch (error: any) {
    console.error("[Revoke] Blockchain revocation failed:", error);
    return res.status(500).json({
      error: "Blockchain revocation failed",
      details: error.message,
    });
  }

  // Update database
  await storage.updateDocumentBatch(batchId, {
    revoked: true,
    revokedAt: new Date(),
    status: "revoked",
  });

  const updatedBatch = await storage.getDocumentBatch(batchId);

  console.log(`[Revoke] ✅ Batch ${batchId} revoked by ${req.user?.email}`);

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
