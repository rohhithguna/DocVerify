import {
  type User,
  type InsertUser,
  type DocumentBatch,
  type InsertDocumentBatch,
  type Document,
  type InsertDocument,
  type Verification,
  type InsertVerification,
  type BlockchainStatus,
  type InsertBlockchainStatus,
  type DocumentBatchWithStats,
  type VerificationWithDetails,
  users,
  documentBatches,
  documents,
  verifications,
  blockchainStatus
} from "@shared/schema";
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';

export interface IStorage {
  // Users
  createUser(user: InsertUser): Promise<User>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;

  // Document Batches
  createDocumentBatch(batch: InsertDocumentBatch): Promise<DocumentBatch>;
  getDocumentBatch(id: string): Promise<DocumentBatch | undefined>;
  getDocumentBatchesByIssuer(issuerId: string): Promise<DocumentBatchWithStats[]>;
  updateDocumentBatch(id: string, updates: Partial<DocumentBatch>): Promise<DocumentBatch | undefined>;
  getAllDocumentBatches(): Promise<DocumentBatch[]>;
  deleteDocumentBatch(id: string): Promise<boolean>;

  // Documents
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentByHash(hash: string): Promise<Document | undefined>;
  getDocumentByImageHash(imageHash: string): Promise<Document | undefined>;
  getDocumentByCertificateId(certificateId: string): Promise<Document | undefined>;
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

// Database Storage Implementation using Drizzle ORM (FIX for BUG #1)
export class DbStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        'Missing DATABASE_URL environment variable.\n' +
        'Please set DATABASE_URL to your PostgreSQL connection string.\n' +
        'Example: postgresql://user:password@localhost:5432/docuverify'
      );
    }

    const neonSql = neon(databaseUrl);
    this.db = drizzle(neonSql);

    console.log('✓ Database connection established');
  }

  // ── Users ──────────────────────────────────

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    return user;
  }

  // ── Document Batches ───────────────────────

  async createDocumentBatch(insertBatch: InsertDocumentBatch): Promise<DocumentBatch> {
    const [batch] = await this.db.insert(documentBatches).values(insertBatch).returning();
    return batch;
  }

  async getDocumentBatch(id: string): Promise<DocumentBatch | undefined> {
    const [batch] = await this.db.select().from(documentBatches).where(eq(documentBatches.id, id));
    return batch;
  }

  async getDocumentBatchesByIssuer(issuerId: string): Promise<DocumentBatchWithStats[]> {
    const batches = await this.db
      .select()
      .from(documentBatches)
      .where(eq(documentBatches.issuerId, issuerId))
      .orderBy(desc(documentBatches.createdAt));

    // Get verification stats for each batch
    const batchesWithStats = await Promise.all(
      batches.map(async (batch) => {
        const batchVerifications = await this.db
          .select()
          .from(verifications)
          .where(eq(verifications.matchedBatchId, batch.id));

        const verificationCount = batchVerifications.length;
        const successfulVerifications = batchVerifications.filter(v => v.status === 'verified').length;
        const successRate = verificationCount > 0 ? (successfulVerifications / verificationCount) * 100 : 0;

        return {
          ...batch,
          verificationCount,
          successRate,
        };
      })
    );

    return batchesWithStats;
  }

  async updateDocumentBatch(id: string, updates: Partial<DocumentBatch>): Promise<DocumentBatch | undefined> {
    const [updated] = await this.db
      .update(documentBatches)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documentBatches.id, id))
      .returning();
    return updated;
  }

  async getAllDocumentBatches(): Promise<DocumentBatch[]> {
    return await this.db.select().from(documentBatches);
  }

  async deleteDocumentBatch(id: string): Promise<boolean> {
    // First delete all documents in this batch
    await this.db.delete(documents).where(eq(documents.batchId, id));
    // Then delete the batch itself
    const result = await this.db.delete(documentBatches).where(eq(documentBatches.id, id)).returning();
    return result.length > 0;
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await this.db.insert(documents).values(insertDocument).returning();
    return document;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await this.db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async getDocumentByHash(hash: string): Promise<Document | undefined> {
    const [document] = await this.db
      .select()
      .from(documents)
      .where(eq(documents.documentHash, hash));
    return document;
  }

  async getDocumentByImageHash(imageHash: string): Promise<Document | undefined> {
    // Use SQL JSON operator for efficient lookup instead of fetching all documents
    const [document] = await this.db
      .select()
      .from(documents)
      .where(sql`original_data->>'imageHash' = ${imageHash}`);
    return document;
  }

  async getDocumentByCertificateId(certificateId: string): Promise<Document | undefined> {
    // Search for document with matching certificateId in originalData
    const [document] = await this.db
      .select()
      .from(documents)
      .where(sql`original_data->>'certificateId' = ${certificateId}`);
    return document;
  }

  async getDocumentsByBatch(batchId: string): Promise<Document[]> {
    return await this.db
      .select()
      .from(documents)
      .where(eq(documents.batchId, batchId));
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined> {
    const [updated] = await this.db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    return updated;
  }

  async createVerification(insertVerification: InsertVerification): Promise<Verification> {
    const [verification] = await this.db.insert(verifications).values(insertVerification).returning();
    return verification;
  }

  async getVerification(id: string): Promise<Verification | undefined> {
    const [verification] = await this.db.select().from(verifications).where(eq(verifications.id, id));
    return verification;
  }

  async getVerificationsByVerifier(verifierId: string): Promise<VerificationWithDetails[]> {
    const results = await this.db
      .select({
        verification: verifications,
        batch: documentBatches,
      })
      .from(verifications)
      .leftJoin(documentBatches, eq(verifications.matchedBatchId, documentBatches.id))
      .where(eq(verifications.verifierId, verifierId))
      .orderBy(desc(verifications.createdAt));

    return results.map(({ verification, batch }) => ({
      ...verification,
      batchName: batch?.batchName,
      issuerName: batch?.issuerName,
    }));
  }

  async updateVerification(id: string, updates: Partial<Verification>): Promise<Verification | undefined> {
    const [updated] = await this.db
      .update(verifications)
      .set(updates)
      .where(eq(verifications.id, id))
      .returning();
    return updated;
  }

  async getRecentVerifications(limit: number = 10): Promise<VerificationWithDetails[]> {
    const results = await this.db
      .select({
        verification: verifications,
        batch: documentBatches,
      })
      .from(verifications)
      .leftJoin(documentBatches, eq(verifications.matchedBatchId, documentBatches.id))
      .orderBy(desc(verifications.createdAt))
      .limit(limit);

    return results.map(({ verification, batch }) => ({
      ...verification,
      batchName: batch?.batchName,
      issuerName: batch?.issuerName,
    }));
  }

  async updateBlockchainStatus(insertStatus: InsertBlockchainStatus): Promise<BlockchainStatus> {
    // First, try to get existing status
    const [existing] = await this.db.select().from(blockchainStatus).limit(1);

    if (existing) {
      // Update existing
      const [updated] = await this.db
        .update(blockchainStatus)
        .set({ ...insertStatus, lastUpdated: new Date() })
        .where(eq(blockchainStatus.id, existing.id))
        .returning();
      return updated;
    } else {
      // Insert new
      const [created] = await this.db.insert(blockchainStatus).values(insertStatus).returning();
      return created;
    }
  }

  async getBlockchainStatus(): Promise<BlockchainStatus | undefined> {
    const [status] = await this.db.select().from(blockchainStatus).limit(1);
    return status;
  }

  async getIssuerStats(issuerId: string): Promise<{
    totalDocuments: number;
    totalBatches: number;
    totalVerifications: number;
    successRate: number;
  }> {
    const batches = await this.db
      .select()
      .from(documentBatches)
      .where(eq(documentBatches.issuerId, issuerId));

    const batchIds = batches.map(b => b.id);
    const totalBatches = batches.length;
    const totalDocuments = batches.reduce((sum, batch) => sum + batch.documentCount, 0);

    if (batchIds.length === 0) {
      return { totalDocuments: 0, totalBatches: 0, totalVerifications: 0, successRate: 0 };
    }

    const batchVerifications = await this.db
      .select()
      .from(verifications)
      .where(inArray(verifications.matchedBatchId, batchIds));

    const totalVerifications = batchVerifications.length;
    const successfulVerifications = batchVerifications.filter(v => v.status === 'verified').length;
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
    const allVerifications = await this.db
      .select()
      .from(verifications)
      .where(eq(verifications.verifierId, verifierId));

    const totalVerifications = allVerifications.length;
    const failedVerifications = allVerifications.filter(v => v.status === 'failed').length;

    const validScores = allVerifications
      .filter(v => v.confidenceScore !== null && v.confidenceScore !== undefined)
      .map(v => v.confidenceScore as number);

    const averageScore = validScores.length > 0
      ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
      : 0;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentCount = allVerifications.filter(v => v.createdAt > oneDayAgo).length;

    return {
      totalVerifications,
      averageScore,
      failedVerifications,
      recentCount,
    };
  }
}

// In-Memory Storage (kept for fallback/testing)
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private documentBatches: Map<string, DocumentBatch>;
  private documents: Map<string, Document>;
  private verifications: Map<string, Verification>;
  private blockchainStatus: BlockchainStatus | undefined;

  constructor() {
    this.users = new Map();
    this.documentBatches = new Map();
    this.documents = new Map();
    this.verifications = new Map();
    this.blockchainStatus = undefined;
    console.warn('⚠️  Using in-memory storage - data will be lost on restart!');
  }

  // ── Users ──────────────────────────────────

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = crypto.randomUUID();
    const user: User = {
      id,
      email: insertUser.email,
      passwordHash: insertUser.passwordHash,
      name: insertUser.name,
      organization: insertUser.organization || null,
      role: insertUser.role || "issuer",
      createdAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  // ── Document Batches ───────────────────────

  // ... (keeping original MemStorage implementation for fallback)
  // [Rest of MemStorage methods remain unchanged]

  async createDocumentBatch(insertBatch: InsertDocumentBatch): Promise<DocumentBatch> {
    const { randomUUID } = await import('crypto');
    const id = randomUUID();
    const batch: DocumentBatch = {
      ...insertBatch,
      id,
      status: insertBatch.status || 'processing',
      revoked: false,
      revokedAt: null,
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

  async deleteDocumentBatch(id: string): Promise<boolean> {
    // First delete all documents in this batch
    const docsToDelete = Array.from(this.documents.entries())
      .filter(([, doc]) => doc.batchId === id);
    for (const [docId] of docsToDelete) {
      this.documents.delete(docId);
    }
    // Then delete the batch itself
    return this.documentBatches.delete(id);
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const { randomUUID } = await import('crypto');
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

  async getDocumentByImageHash(imageHash: string): Promise<Document | undefined> {
    return Array.from(this.documents.values())
      .find(doc => {
        const originalData = doc.originalData as Record<string, any> | null;
        return originalData?.imageHash === imageHash;
      });
  }

  async getDocumentByCertificateId(certificateId: string): Promise<Document | undefined> {
    return Array.from(this.documents.values())
      .find(doc => {
        const originalData = doc.originalData as Record<string, any> | null;
        return originalData?.certificateId === certificateId;
      });
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
    const { randomUUID } = await import('crypto');
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
    const { randomUUID } = await import('crypto');
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

// Use database storage if DATABASE_URL is set, otherwise fall back to memory
export const storage = process.env.DATABASE_URL
  ? new DbStorage()
  : new MemStorage();
