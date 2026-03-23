import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";

// Controllers
import * as authController from "../controllers/auth.controller";
import * as issuerController from "../controllers/issuer.controller";
import * as revokeController from "../controllers/revoke.controller";
import * as verifierController from "../controllers/verifier.controller";
import * as blockchainController from "../controllers/blockchain.controller";

// Middleware
import { errorHandler, notFoundHandler } from "../middleware/error-handler";
import { requireAuth, requireTrustedOriginForMutations } from "../middleware/auth";
import {
  generalLimiter,
  uploadLimiter,
  verifyLimiter,
  blockchainLimiter
} from "../middleware/rate-limit";
import {
  validateBody,
  validateParams,
  issuerIdParamSchema,
  batchIdParamSchema,
  documentIdParamSchema,
  uploadBodySchema,
  createCertificateBodySchema,
  createCertificateBatchBodySchema,
  revokeBodySchema,
  validateCreateCertificateUniqueness,
  certificateIdParamSchema,
  verifierIdParamSchema,
  verifyBodySchema,
  verifyMetadataBodySchema,
} from "../middleware/validation";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply general rate limiting to all API routes
  app.use("/api/", generalLimiter);
  app.use("/api/", requireTrustedOriginForMutations);

  // ============================================
  // Auth Routes (public)
  // ============================================
  app.post("/api/auth/register", authController.register);
  app.post("/api/auth/login", authController.login);
  app.get("/api/auth/me", requireAuth, authController.getMe);

  // ============================================
  // Blockchain Routes
  // ============================================
  app.get(
    "/api/blockchain/status",
    blockchainLimiter,
    blockchainController.getStatus
  );

  // ============================================
  // Issuer Routes (protected)
  // ============================================
  // Upload and process CSV documents
  app.post(
    "/api/issuer/upload",
    requireAuth,
    uploadLimiter,
    upload.single('file'),
    validateBody(uploadBodySchema),
    issuerController.uploadDocuments
  );

  // Get issuer batches
  app.get(
    "/api/issuer/:issuerId/batches",
    requireAuth,
    validateParams(issuerIdParamSchema),
    issuerController.getBatches
  );

  // Delete a batch
  app.delete(
    "/api/issuer/:issuerId/batch/:batchId",
    requireAuth,
    validateParams(batchIdParamSchema),
    issuerController.deleteBatch
  );

  // Soft-delete a single certificate document
  app.patch(
    "/api/issuer/certificate/:id/delete",
    requireAuth,
    validateParams(documentIdParamSchema),
    issuerController.deleteDocument
  );

  // Create certificate (form-based)
  app.post(
    "/api/issuer/:issuerId/create-certificate",
    requireAuth,
    uploadLimiter,
    validateParams(issuerIdParamSchema),
    validateBody(createCertificateBodySchema),
    validateCreateCertificateUniqueness,
    issuerController.createCertificate
  );

  // Create certificate batch Merkle root + proofs
  app.post(
    "/api/issuer/:issuerId/create-certificate-batch",
    requireAuth,
    uploadLimiter,
    validateParams(issuerIdParamSchema),
    validateBody(createCertificateBatchBodySchema),
    issuerController.createCertificateBatch
  );

  // Get issuer statistics
  app.get(
    "/api/issuer/:issuerId/stats",
    requireAuth,
    validateParams(issuerIdParamSchema),
    issuerController.getStats
  );

  // Revoke a document batch
  app.post(
    "/api/issuer/revoke",
    requireAuth,
    validateBody(revokeBodySchema),
    revokeController.revokeDocument
  );

  // Unrevoke a document batch
  app.post(
    "/api/issuer/unrevoke",
    requireAuth,
    validateBody(revokeBodySchema), // same schema (just needs batchId)
    revokeController.unrevokeDocument
  );

  // ============================================
  // Verifier Routes
  // ============================================

  // Verify document
  app.post(
    "/api/verifier/verify",
    verifyLimiter,
    upload.single('file'),
    validateBody(verifyBodySchema),
    verifierController.verifyDocument
  );

  // Verify certificate by structured metadata (canonical flow)
  app.post(
    "/api/verifier/verify-metadata",
    verifyLimiter,
    validateBody(verifyMetadataBodySchema),
    verifierController.verifyMetadata
  );

  // Lookup certificate metadata by certificate ID
  app.get(
    "/api/certificate/:certificateId",
    validateParams(certificateIdParamSchema),
    verifierController.getCertificateById
  );

  // Get verifier history
  app.get(
    "/api/verifier/:verifierId/history",
    validateParams(verifierIdParamSchema),
    verifierController.getHistory
  );

  // Get verifier statistics
  app.get(
    "/api/verifier/:verifierId/stats",
    validateParams(verifierIdParamSchema),
    verifierController.getStats
  );

  // ============================================
  // Activity Routes
  // ============================================

  // Get recent activity (for dashboard)
  app.get("/api/activity/recent", blockchainController.getRecentActivity);

  // ============================================
  // Error Handling
  // ============================================

  // 404 handler for unknown routes
  app.use("/api/*", notFoundHandler);

  // Centralized error handler
  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}
