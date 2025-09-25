import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { cryptoService } from "./services/crypto";
import { merkleService } from "./services/merkle";
import { blockchainService } from "./services/blockchain";
import multer from "multer";
import { insertDocumentBatchSchema, insertVerificationSchema } from "@shared/schema";
import Papa from "papaparse";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get blockchain status
  app.get("/api/blockchain/status", async (req, res) => {
    try {
      const status = await storage.getBlockchainStatus();
      const networkStatus = await blockchainService.getNetworkStatus();
      
      // Update status in storage
      await storage.updateBlockchainStatus({
        network: "sepolia",
        blockHeight: networkStatus.blockHeight.toString(),
        gasPrice: networkStatus.gasPrice,
        status: networkStatus.isConnected ? "connected" : "disconnected",
      });

      const updatedStatus = await storage.getBlockchainStatus();
      res.json(updatedStatus);
    } catch (error) {
      console.error("Blockchain status error:", error);
      res.status(500).json({ error: "Failed to get blockchain status" });
    }
  });

  // Upload and process CSV documents (Issuer)
  app.post("/api/issuer/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { batchName, issuerId, issuerName, groupingCriterion } = req.body;
      
      if (!batchName || !issuerId || !issuerName || !groupingCriterion) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Parse CSV file
      const csvContent = req.file.buffer.toString('utf-8');
      const parseResult = Papa.parse(csvContent, { 
        header: true, 
        skipEmptyLines: true 
      });

      if (parseResult.errors.length > 0) {
        return res.status(400).json({ error: "Invalid CSV format", details: parseResult.errors });
      }

      const csvData = parseResult.data as Record<string, any>[];
      
      if (csvData.length === 0) {
        return res.status(400).json({ error: "CSV file is empty" });
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

      // For now, we'll use the first group or all documents if only one group
      const mainGroup = documentGroups.length > 0 ? documentGroups[0] : [];
      const hashes = mainGroup.map(doc => doc.hash);
      
      if (hashes.length > 0) {
        const merkleTree = merkleService.createTree(hashes);
        const merkleRoot = merkleTree.getRoot();

        // Generate proofs for all documents
        await Promise.all(
          documents.map(async (doc, index) => {
            if (index < hashes.length) {
              const proof = merkleTree.generateProof(hashes[index]);
              if (proof) {
                await storage.updateDocument(doc.id, { merkleProof: proof });
              }
            }
          })
        );

        // Store Merkle root on blockchain
        try {
          const blockchainTx = await blockchainService.storeMerkleRoot(merkleRoot, batch.id);
          
          await storage.updateDocumentBatch(batch.id, {
            merkleRoot,
            blockchainTxHash: blockchainTx.hash,
            blockNumber: blockchainTx.blockNumber.toString(),
            status: blockchainTx.status === 'confirmed' ? 'completed' : 'blockchain_stored',
          });
        } catch (blockchainError) {
          console.error("Blockchain storage failed:", blockchainError);
          await storage.updateDocumentBatch(batch.id, {
            merkleRoot,
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

    } catch (error) {
      console.error("Upload processing error:", error);
      res.status(500).json({ error: "Failed to process upload" });
    }
  });

  // Get issuer batches
  app.get("/api/issuer/:issuerId/batches", async (req, res) => {
    try {
      const { issuerId } = req.params;
      const batches = await storage.getDocumentBatchesByIssuer(issuerId);
      res.json(batches);
    } catch (error) {
      console.error("Get batches error:", error);
      res.status(500).json({ error: "Failed to get batches" });
    }
  });

  // Get issuer statistics
  app.get("/api/issuer/:issuerId/stats", async (req, res) => {
    try {
      const { issuerId } = req.params;
      const stats = await storage.getIssuerStats(issuerId);
      res.json(stats);
    } catch (error) {
      console.error("Get issuer stats error:", error);
      res.status(500).json({ error: "Failed to get statistics" });
    }
  });

  // Verify document (Verifier)
  app.post("/api/verifier/verify", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { verifierId } = req.body;
      
      if (!verifierId) {
        return res.status(400).json({ error: "Verifier ID required" });
      }

      // Extract document fields
      const documentContent = req.file.buffer.toString('utf-8');
      const extractedFields = cryptoService.extractDocumentFields(documentContent, req.file.originalname);
      
      // Create data string for hashing (this is simplified - in production you'd have better field extraction)
      const dataString = cryptoService.csvRowToDataString(extractedFields);
      const documentHash = cryptoService.computeHash(dataString);

      // Create verification record
      const verification = await storage.createVerification({
        verifierId,
        fileName: req.file.originalname,
        documentHash,
        status: "pending",
        verificationData: extractedFields,
      });

      // Find matching document
      const matchedDocument = await storage.getDocumentByHash(documentHash);
      
      let digitalSignatureValid = false;
      let merkleProofValid = false;
      let blockchainVerified = false;
      let confidenceScore = 0;
      let matchedBatch = null;

      if (matchedDocument) {
        // Verify digital signature
        digitalSignatureValid = cryptoService.verifySignature(dataString, matchedDocument.digitalSignature || '');
        
        // Verify Merkle proof
        if (matchedDocument.merkleProof) {
          merkleProofValid = merkleService.verifyProof(matchedDocument.merkleProof as any);
        }

        // Get batch information
        matchedBatch = await storage.getDocumentBatch(matchedDocument.batchId);
        
        // Verify against blockchain
        if (matchedBatch?.blockchainTxHash && matchedBatch?.merkleRoot) {
          blockchainVerified = await blockchainService.verifyMerkleRoot(
            matchedBatch.merkleRoot, 
            matchedBatch.blockchainTxHash
          );
        }

        // Calculate confidence score
        let score = 0;
        if (digitalSignatureValid) score += 40;
        if (merkleProofValid) score += 30;
        if (blockchainVerified) score += 30;
        
        confidenceScore = score;
      }

      // Update verification record
      const updatedVerification = await storage.updateVerification(verification.id, {
        digitalSignatureValid,
        merkleProofValid,
        blockchainVerified,
        confidenceScore,
        matchedBatchId: matchedDocument?.batchId,
        matchedDocumentId: matchedDocument?.id,
        status: confidenceScore > 70 ? 'verified' : 'failed',
      });

      res.json({
        verification: updatedVerification,
        results: {
          digitalSignatureValid,
          merkleProofValid,
          blockchainVerified,
          confidenceScore,
          matchedBatch: matchedBatch ? {
            id: matchedBatch.id,
            batchName: matchedBatch.batchName,
            issuerName: matchedBatch.issuerName,
            createdAt: matchedBatch.createdAt,
          } : null,
        },
      });

    } catch (error) {
      console.error("Verification error:", error);
      res.status(500).json({ error: "Failed to verify document" });
    }
  });

  // Get verifier history
  app.get("/api/verifier/:verifierId/history", async (req, res) => {
    try {
      const { verifierId } = req.params;
      const verifications = await storage.getVerificationsByVerifier(verifierId);
      res.json(verifications);
    } catch (error) {
      console.error("Get verifier history error:", error);
      res.status(500).json({ error: "Failed to get verification history" });
    }
  });

  // Get verifier statistics
  app.get("/api/verifier/:verifierId/stats", async (req, res) => {
    try {
      const { verifierId } = req.params;
      const stats = await storage.getVerifierStats(verifierId);
      res.json(stats);
    } catch (error) {
      console.error("Get verifier stats error:", error);
      res.status(500).json({ error: "Failed to get statistics" });
    }
  });

  // Get recent activity (for dashboard)
  app.get("/api/activity/recent", async (req, res) => {
    try {
      const verifications = await storage.getRecentVerifications(10);
      res.json(verifications);
    } catch (error) {
      console.error("Get recent activity error:", error);
      res.status(500).json({ error: "Failed to get recent activity" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
