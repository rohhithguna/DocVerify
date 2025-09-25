import { 
  type DocumentBatch, 
  type InsertDocumentBatch,
  type Document,
  type InsertDocument,
  type Verification,
  type InsertVerification,
  type BlockchainStatus,
  type InsertBlockchainStatus,
  type DocumentBatchWithStats,
  type VerificationWithDetails
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Document Batches
  createDocumentBatch(batch: InsertDocumentBatch): Promise<DocumentBatch>;
  getDocumentBatch(id: string): Promise<DocumentBatch | undefined>;
  getDocumentBatchesByIssuer(issuerId: string): Promise<DocumentBatchWithStats[]>;
  updateDocumentBatch(id: string, updates: Partial<DocumentBatch>): Promise<DocumentBatch | undefined>;
  getAllDocumentBatches(): Promise<DocumentBatch[]>;

  // Documents
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentByHash(hash: string): Promise<Document | undefined>;
  getDocumentsByBatch(batchId: string): Promise<Document[]>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;

  // Verifications
  createVerification(verification: InsertVerification): Promise<Verification>;
  getVerification(id: string): Promise<Verification | undefined>;
  getVerificationsByVerifier(verifierId: string): Promise<VerificationWithDetails[]>;
  updateVerification(id: string, updates: Partial<Verification>): Promise<Verification | undefined>;
  getRecentVerifications(limit?: number): Promise<VerificationWithDetails[]>;

  // Blockchain Status
  updateBlockchainStatus(status: InsertBlockchainStatus): Promise<BlockchainStatus>;
  getBlockchainStatus(): Promise<BlockchainStatus | undefined>;

  // Statistics
  getIssuerStats(issuerId: string): Promise<{
    totalDocuments: number;
    totalBatches: number;
    totalVerifications: number;
    successRate: number;
  }>;

  getVerifierStats(verifierId: string): Promise<{
    totalVerifications: number;
    averageScore: number;
    failedVerifications: number;
    recentCount: number;
  }>;
}

export class MemStorage implements IStorage {
  private documentBatches: Map<string, DocumentBatch>;
  private documents: Map<string, Document>;
  private verifications: Map<string, Verification>;
  private blockchainStatus: BlockchainStatus | undefined;

  constructor() {
    this.documentBatches = new Map();
    this.documents = new Map();
    this.verifications = new Map();
    this.blockchainStatus = undefined;
  }

  async createDocumentBatch(insertBatch: InsertDocumentBatch): Promise<DocumentBatch> {
    const id = randomUUID();
    const batch: DocumentBatch = {
      ...insertBatch,
      id,
      status: insertBatch.status || 'processing',
      merkleRoot: insertBatch.merkleRoot || null,
      blockchainTxHash: insertBatch.blockchainTxHash || null,
      blockNumber: insertBatch.blockNumber || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.documentBatches.set(id, batch);
    return batch;
  }

  async getDocumentBatch(id: string): Promise<DocumentBatch | undefined> {
    return this.documentBatches.get(id);
  }

  async getDocumentBatchesByIssuer(issuerId: string): Promise<DocumentBatchWithStats[]> {
    const batches = Array.from(this.documentBatches.values())
      .filter(batch => batch.issuerId === issuerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return batches.map(batch => {
      const verifications = Array.from(this.verifications.values())
        .filter(v => v.matchedBatchId === batch.id);
      
      const verificationCount = verifications.length;
      const successfulVerifications = verifications.filter(v => v.status === 'verified').length;
      const successRate = verificationCount > 0 ? (successfulVerifications / verificationCount) * 100 : 0;

      return {
        ...batch,
        verificationCount,
        successRate,
      };
    });
  }

  async updateDocumentBatch(id: string, updates: Partial<DocumentBatch>): Promise<DocumentBatch | undefined> {
    const existing = this.documentBatches.get(id);
    if (!existing) return undefined;

    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.documentBatches.set(id, updated);
    return updated;
  }

  async getAllDocumentBatches(): Promise<DocumentBatch[]> {
    return Array.from(this.documentBatches.values());
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const document: Document = {
      ...insertDocument,
      id,
      digitalSignature: insertDocument.digitalSignature || null,
      merkleProof: insertDocument.merkleProof || null,
      createdAt: new Date(),
    };
    this.documents.set(id, document);
    return document;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
  }

  async getDocumentByHash(hash: string): Promise<Document | undefined> {
    return Array.from(this.documents.values())
      .find(doc => doc.documentHash === hash);
  }

  async getDocumentsByBatch(batchId: string): Promise<Document[]> {
    return Array.from(this.documents.values())
      .filter(doc => doc.batchId === batchId);
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const existing = this.documents.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates };
    this.documents.set(id, updated);
    return updated;
  }

  async createVerification(insertVerification: InsertVerification): Promise<Verification> {
    const id = randomUUID();
    const verification: Verification = {
      ...insertVerification,
      id,
      status: insertVerification.status || 'pending',
      digitalSignatureValid: insertVerification.digitalSignatureValid || null,
      merkleProofValid: insertVerification.merkleProofValid || null,
      blockchainVerified: insertVerification.blockchainVerified || null,
      confidenceScore: insertVerification.confidenceScore || null,
      matchedBatchId: insertVerification.matchedBatchId || null,
      matchedDocumentId: insertVerification.matchedDocumentId || null,
      errorMessage: insertVerification.errorMessage || null,
      verificationData: insertVerification.verificationData || null,
      createdAt: new Date(),
    };
    this.verifications.set(id, verification);
    return verification;
  }

  async getVerification(id: string): Promise<Verification | undefined> {
    return this.verifications.get(id);
  }

  async getVerificationsByVerifier(verifierId: string): Promise<VerificationWithDetails[]> {
    const verifications = Array.from(this.verifications.values())
      .filter(v => v.verifierId === verifierId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return verifications.map(verification => {
      const batch = verification.matchedBatchId ? 
        this.documentBatches.get(verification.matchedBatchId) : undefined;

      return {
        ...verification,
        batchName: batch?.batchName,
        issuerName: batch?.issuerName,
      };
    });
  }

  async updateVerification(id: string, updates: Partial<Verification>): Promise<Verification | undefined> {
    const existing = this.verifications.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates };
    this.verifications.set(id, updated);
    return updated;
  }

  async getRecentVerifications(limit: number = 10): Promise<VerificationWithDetails[]> {
    const verifications = Array.from(this.verifications.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    return verifications.map(verification => {
      const batch = verification.matchedBatchId ? 
        this.documentBatches.get(verification.matchedBatchId) : undefined;

      return {
        ...verification,
        batchName: batch?.batchName,
        issuerName: batch?.issuerName,
      };
    });
  }

  async updateBlockchainStatus(insertStatus: InsertBlockchainStatus): Promise<BlockchainStatus> {
    const id = this.blockchainStatus?.id || randomUUID();
    const status: BlockchainStatus = {
      ...insertStatus,
      id,
      network: insertStatus.network || 'sepolia',
      blockHeight: insertStatus.blockHeight || null,
      gasPrice: insertStatus.gasPrice || null,
      status: insertStatus.status || 'disconnected',
      lastUpdated: new Date(),
    };
    this.blockchainStatus = status;
    return status;
  }

  async getBlockchainStatus(): Promise<BlockchainStatus | undefined> {
    return this.blockchainStatus;
  }

  async getIssuerStats(issuerId: string): Promise<{
    totalDocuments: number;
    totalBatches: number;
    totalVerifications: number;
    successRate: number;
  }> {
    const batches = Array.from(this.documentBatches.values())
      .filter(batch => batch.issuerId === issuerId);
    
    const batchIds = batches.map(b => b.id);
    const totalDocuments = batches.reduce((sum, batch) => sum + batch.documentCount, 0);
    const totalBatches = batches.length;

    const verifications = Array.from(this.verifications.values())
      .filter(v => v.matchedBatchId && batchIds.includes(v.matchedBatchId));
    
    const totalVerifications = verifications.length;
    const successfulVerifications = verifications.filter(v => v.status === 'verified').length;
    const successRate = totalVerifications > 0 ? (successfulVerifications / totalVerifications) * 100 : 0;

    return {
      totalDocuments,
      totalBatches,
      totalVerifications,
      successRate,
    };
  }

  async getVerifierStats(verifierId: string): Promise<{
    totalVerifications: number;
    averageScore: number;
    failedVerifications: number;
    recentCount: number;
  }> {
    const verifications = Array.from(this.verifications.values())
      .filter(v => v.verifierId === verifierId);

    const totalVerifications = verifications.length;
    const failedVerifications = verifications.filter(v => v.status === 'failed').length;
    
    const validScores = verifications
      .filter(v => v.confidenceScore !== null && v.confidenceScore !== undefined)
      .map(v => v.confidenceScore as number);
    
    const averageScore = validScores.length > 0 ? 
      validScores.reduce((sum, score) => sum + score, 0) / validScores.length : 0;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = verifications.filter(v => v.createdAt > oneDayAgo).length;

    return {
      totalVerifications,
      averageScore,
      failedVerifications,
      recentCount,
    };
  }
}

export const storage = new MemStorage();
