import {
  type User,
  type InsertUser,
  type DocumentBatch,
  type InsertDocumentBatch,
  type Document,
  type InsertDocument,
  type Certificate,
  type InsertCertificate,
  type Verification,
  type InsertVerification,
  type BlockchainStatus,
  type InsertBlockchainStatus,
  type DocumentBatchWithStats,
  type VerificationWithDetails,
  users,
  documentBatches,
  documents,
  certificates,
  verifications,
  blockchainStatus
} from "@shared/schema";
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';

export interface IStorage {
  // Users
  createUser(user: InsertUser): Promise<User>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;

  // Document Batches
  createDocumentBatch(batch: InsertDocumentBatch): Promise<DocumentBatch>;
  getDocumentBatch(id: string): Promise<DocumentBatch | undefined>;
  getDocumentBatchesByIssuer(issuerId: string, limit?: number, offset?: number): Promise<{ batches: DocumentBatchWithStats[]; total: number }>;
  updateDocumentBatch(id: string, updates: Partial<DocumentBatch>): Promise<DocumentBatch | undefined>;
  getAllDocumentBatches(): Promise<DocumentBatch[]>;
  deleteDocumentBatch(id: string): Promise<boolean>;

  // Documents
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentByHash(hash: string): Promise<Document | undefined>;
  getDocumentByCertificateId(certificateId: string): Promise<Document | undefined>;
  getDocumentsByBatch(batchId: string): Promise<Document[]>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;
  cascadeDeleteDocument(id: string): Promise<boolean>;

  // Certificates
  createCertificate(certificate: InsertCertificate): Promise<Certificate>;
  getCertificateByCertificateId(certificateId: string): Promise<Certificate | undefined>;
  getCertificateByStudentId(studentId: string): Promise<Certificate | undefined>;
  getCertificateByDocumentId(documentId: string): Promise<Certificate | undefined>;
  updateCertificate(id: string, updates: Partial<Certificate>): Promise<Certificate | undefined>;

  // Verifications
  createVerification(verification: InsertVerification): Promise<Verification>;
  getVerification(id: string): Promise<Verification | undefined>;
  getVerificationsByVerifier(verifierId: string, limit?: number, offset?: number): Promise<{ verifications: VerificationWithDetails[]; total: number }>;
  getVerificationsByDocumentId(documentId: string): Promise<Verification[]>;
  deleteVerificationsByDocumentId(documentId: string): Promise<number>;
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
  private pool: Pool;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error(
        'Missing DATABASE_URL environment variable.\n' +
        'Please set DATABASE_URL to your PostgreSQL connection string.\n' +
        'Example: postgresql://user:password@localhost:5432/docuverify'
      );
    }

    this.pool = new Pool({ connectionString: databaseUrl });
    this.db = drizzle(this.pool);

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

  async getDocumentBatchesByIssuer(
    issuerId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ batches: DocumentBatchWithStats[]; total: number }> {
    // OPTIMIZATION: Single paginated query instead of fetching all batches
    const [countResult, batches] = await Promise.all([
      this.db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(documentBatches)
        .where(eq(documentBatches.issuerId, issuerId)),
      this.db
        .select()
        .from(documentBatches)
        .where(eq(documentBatches.issuerId, issuerId))
        .orderBy(desc(documentBatches.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = countResult[0]?.count || 0;
    const batchIds = batches.map(b => b.id);

    if (batchIds.length === 0) {
      return { batches: [], total };
    }

    // OPTIMIZATION: Fetch all related data in 3 parallel queries instead of N+3
    const [allDocuments, allCertificates, allVerifications] = await Promise.all([
      this.db
        .select({ id: documents.id, batchId: documents.batchId })
        .from(documents)
        .where(inArray(documents.batchId, batchIds)),
      this.db
        .select({
          id: certificates.id,
          documentId: certificates.documentId,
          status: certificates.status,
          blockchainStatus: certificates.blockchainStatus,
        })
        .from(certificates)
        .where(inArray(certificates.documentId, this.db.select({ id: documents.id }).from(documents).where(inArray(documents.batchId, batchIds)))),
      this.db
        .select()
        .from(verifications)
        .where(inArray(verifications.matchedBatchId, batchIds)),
    ]);

    // Process in-memory to build results
    const documentsByBatch = new Map<string, string[]>();
    const documentToBatchId = new Map<string, string>();
    allDocuments.forEach(doc => {
      documentToBatchId.set(doc.id, doc.batchId);
      if (!documentsByBatch.has(doc.batchId)) {
        documentsByBatch.set(doc.batchId, []);
      }
      documentsByBatch.get(doc.batchId)!.push(doc.id);
    });

    const verificationsByBatch = new Map<string, typeof allVerifications>();
    allVerifications.forEach(v => {
      if (v.matchedBatchId) {
        if (!verificationsByBatch.has(v.matchedBatchId)) {
          verificationsByBatch.set(v.matchedBatchId, []);
        }
        verificationsByBatch.get(v.matchedBatchId)!.push(v);
      }
    });

    const batchesWithStats = batches
      .map((batch) => {
        const batchDocIds = documentsByBatch.get(batch.id) || [];
        if (batchDocIds.length === 0) return null;

        const batchCerts = allCertificates.filter(
          (certificate) =>
            typeof certificate.documentId === "string" &&
            documentToBatchId.get(certificate.documentId) === batch.id
        );
        const hasCertificateRows = batchCerts.length > 0;
        const activeDocumentIds = new Set(
          batchCerts
            .filter((certificate) => certificate.status === "ACTIVE" && !!certificate.documentId)
            .map((certificate) => certificate.documentId as string)
        );

        if (hasCertificateRows && activeDocumentIds.size === 0) {
          return null;
        }

        const scopedDocumentIds = hasCertificateRows ? Array.from(activeDocumentIds) : batchDocIds;
        const scopedBatchVerifications = verificationsByBatch.get(batch.id) || [];

        const verificationCount = scopedBatchVerifications.length;
        const successfulVerifications = scopedBatchVerifications.filter(v => v.status === 'verified').length;
        const successRate = verificationCount > 0 ? (successfulVerifications / verificationCount) * 100 : 0;

        return {
          ...batch,
          documentCount: scopedDocumentIds.length,
          verificationCount,
          successRate,
          documentId: scopedDocumentIds[0] as string | undefined,
          blockchainStatus: batchCerts.find(
            (certificate) => certificate.documentId === scopedDocumentIds[0]
          )?.blockchainStatus as "CONFIRMED" | "PENDING" | "FAILED" | undefined,
        } as DocumentBatchWithStats;
      })
      .filter((batch): batch is DocumentBatchWithStats => batch !== null);

    return { batches: batchesWithStats, total };
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
    try {
      // Execute all deletes within a transaction to ensure atomicity
      const result = await this.db.transaction(async (tx) => {
        // Step 1: Get all documents in batch to delete their dependent records
        const docsInBatch = await tx
          .select()
          .from(documents)
          .where(eq(documents.batchId, id));

        const docIds = docsInBatch.map(doc => doc.id);

        // Step 2: Delete all verifications linked to documents in this batch
        if (docIds.length > 0) {
          await tx
            .delete(verifications)
            .where(inArray(verifications.matchedDocumentId, docIds));
        }

        // Step 3: Delete all certificates linked to documents in this batch
        if (docIds.length > 0) {
          await tx
            .delete(certificates)
            .where(inArray(certificates.documentId, docIds));
        }

        // Step 4: Delete all documents in batch
        await tx
          .delete(documents)
          .where(eq(documents.batchId, id));

        // Step 5: Delete the batch itself
        const deletedBatch = await tx
          .delete(documentBatches)
          .where(eq(documentBatches.id, id))
          .returning();

        return deletedBatch.length > 0;
      });

      return result;
    } catch (error) {
      console.error(`[deleteDocumentBatch] Transaction failed for batch ${id}:`, error);
      throw error;
    }
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const originalData = (insertDocument.originalData as Record<string, any> | null) || {};
    const proof = insertDocument.merkleProof as Record<string, any> | null | undefined;
    const isRevoked = insertDocument.revoked === true;
    const revokedAt = isRevoked
      ? (insertDocument.revokedAt ? new Date(insertDocument.revokedAt) : new Date())
      : null;

    const normalizedDocument = {
      ...insertDocument,
      certificateId: typeof originalData.certificateId === "string" ? originalData.certificateId : null,
      name: typeof originalData.name === "string" ? originalData.name : null,
      course: typeof originalData.course === "string" ? originalData.course : null,
      issuer: typeof originalData.issuer === "string" ? originalData.issuer : null,
      date: typeof originalData.date === "string" ? originalData.date : null,
      issuedDate: typeof originalData.date === "string" ? originalData.date : null,
      hash:
        typeof originalData.hash === "string"
          ? originalData.hash
          : insertDocument.documentHash,
      merkleRoot:
        typeof proof?.root === "string"
          ? proof.root
          : (typeof originalData.merkleRoot === "string" ? originalData.merkleRoot : null),
      revoked: isRevoked,
      revokedAt,
    };

    const [document] = await this.db.insert(documents).values(normalizedDocument).returning();
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

  async getDocumentByCertificateId(certificateId: string): Promise<Document | undefined> {
    // Prefer indexed explicit column; fall back to legacy JSON payload for backward compatibility.
    const [document] = await this.db
      .select()
      .from(documents)
      .where(sql`certificate_id = ${certificateId} OR original_data->>'certificateId' = ${certificateId}`);
    return document;
  }

  // OPTIMIZATION: Combine document + certificate queries into single fetch
  async getDocumentAndCertificateByCertificateId(certificateId: string): Promise<
    { document: Document | undefined; certificate: Certificate | undefined }
  > {
    const [document, certificate] = await Promise.all([
      this.getDocumentByCertificateId(certificateId),
      this.getCertificateByCertificateId(certificateId),
    ]);
    return { document, certificate };
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

  async deleteDocument(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(documents)
      .where(eq(documents.id, id))
      .returning({ id: documents.id });

    return deleted.length > 0;
  }

  /**
   * CASCADE DELETE with transaction safety.
   * 
   * Deletion order (respects FK constraints):
   * 1. verifications (FK → documents.id)
   * 2. certificates (FK → documents.id)
   * 3. documents (PK)
   * 4. Update batch documentCount
   * 
   * Wrapped in transaction to ensure atomicity.
   */
  async cascadeDeleteDocument(id: string): Promise<boolean> {
    try {
      // Execute all deletes within a transaction
      const result = await this.db.transaction(async (tx) => {
        // Get document to find its batch
        const document = await tx.select().from(documents).where(eq(documents.id, id));
        if (document.length === 0) return { success: false, batchId: null };

        const batchId = document[0].batchId;

        // Step 1: Delete all verifications linked to this document
        const deletedVerifications = await tx
          .delete(verifications)
          .where(eq(verifications.matchedDocumentId, id))
          .returning({ id: verifications.id });

        // Step 2: Delete all certificates linked to this document
        const deletedCertificates = await tx
          .delete(certificates)
          .where(eq(certificates.documentId, id))
          .returning({ id: certificates.id });

        // Step 3: Delete the document itself
        const deletedDocument = await tx
          .delete(documents)
          .where(eq(documents.id, id))
          .returning({ id: documents.id });

        return {
          success: deletedDocument.length > 0,
          verificationCount: deletedVerifications.length,
          certificateCount: deletedCertificates.length,
          batchId,
        };
      });

      // Step 4: Update batch documentCount if deletion succeeded
      if (result.success && result.batchId) {
        const batch = await this.db
          .select()
          .from(documentBatches)
          .where(eq(documentBatches.id, result.batchId));

        if (batch.length > 0) {
          const newCount = Math.max(0, batch[0].documentCount - 1);
          await this.db
            .update(documentBatches)
            .set({ documentCount: newCount })
            .where(eq(documentBatches.id, result.batchId));
        }
      }

      return result.success;
    } catch (error) {
      console.error(`[cascadeDeleteDocument] Transaction failed for document ${id}:`, error);
      throw error;
    }
  }

  async createCertificate(insertCertificate: InsertCertificate): Promise<Certificate> {
    const [certificate] = await this.db
      .insert(certificates)
      .values(insertCertificate)
      .returning();
    return certificate;
  }

  async getCertificateByCertificateId(certificateId: string): Promise<Certificate | undefined> {
    const [certificate] = await this.db
      .select()
      .from(certificates)
      .where(eq(certificates.certificateId, certificateId));
    return certificate;
  }

  async getCertificateByStudentId(studentId: string): Promise<Certificate | undefined> {
    const [certificate] = await this.db
      .select()
      .from(certificates)
      .where(eq(certificates.studentId, studentId));
    return certificate;
  }

  async getCertificateByDocumentId(documentId: string): Promise<Certificate | undefined> {
    const [certificate] = await this.db
      .select()
      .from(certificates)
      .where(eq(certificates.documentId, documentId));
    return certificate;
  }

  async updateCertificate(id: string, updates: Partial<Certificate>): Promise<Certificate | undefined> {
    const [updated] = await this.db
      .update(certificates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(certificates.id, id))
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

  async getVerificationsByVerifier(
    verifierId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ verifications: VerificationWithDetails[]; total: number }> {
    // OPTIMIZATION: Single paginated query with proper pagination support
    const countQuery = await this.db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(verifications)
      .where(eq(verifications.verifierId, verifierId));

    const queryResults = await this.db
      .select({
        verification: verifications,
        batch: documentBatches,
      })
      .from(verifications)
      .leftJoin(documentBatches, eq(verifications.matchedBatchId, documentBatches.id))
      .where(eq(verifications.verifierId, verifierId))
      .orderBy(desc(verifications.createdAt))
      .limit(limit)
      .offset(offset);

    const total = countQuery[0]?.count || 0;
    const verificationsList = queryResults.map(({ verification: v, batch: b }) => ({
      ...v,
      batchName: b?.batchName,
      issuerName: b?.issuerName,
    }));

    return { verifications: verificationsList, total };
  }

  async getVerificationsByDocumentId(documentId: string): Promise<Verification[]> {
    return await this.db
      .select()
      .from(verifications)
      .where(eq(verifications.matchedDocumentId, documentId));
  }

  async deleteVerificationsByDocumentId(documentId: string): Promise<number> {
    const deleted = await this.db
      .delete(verifications)
      .where(eq(verifications.matchedDocumentId, documentId))
      .returning({ id: verifications.id });

    return deleted.length;
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
    const activeCertificates = await this.db
      .select({ documentId: certificates.documentId })
      .from(certificates)
      .where(and(eq(certificates.issuerId, issuerId), eq(certificates.status, "ACTIVE")));

    const activeDocumentIds = activeCertificates
      .map((certificate) => certificate.documentId)
      .filter((documentId): documentId is string => !!documentId);

    const totalDocuments = activeDocumentIds.length;

    if (activeDocumentIds.length === 0) {
      return { totalDocuments: 0, totalBatches: 0, totalVerifications: 0, successRate: 0 };
    }

    const activeDocuments = await this.db
      .select({ id: documents.id, batchId: documents.batchId })
      .from(documents)
      .where(inArray(documents.id, activeDocumentIds));

    // Get unique batch IDs, then filter out revoked batches
    const uniqueBatchIds = Array.from(new Set(activeDocuments.map((document) => document.batchId)));
    const activeBatches = uniqueBatchIds.length > 0
      ? await this.db
          .select({ id: documentBatches.id })
          .from(documentBatches)
          .where(and(
            inArray(documentBatches.id, uniqueBatchIds),
            eq(documentBatches.revoked, false)
          ))
      : [];
    const totalBatches = activeBatches.length;

    const scopedVerifications = await this.db
      .select()
      .from(verifications)
      .where(inArray(verifications.matchedDocumentId, activeDocumentIds));

    const totalVerifications = scopedVerifications.length;
    const successfulVerifications = scopedVerifications.filter(v => v.status === 'verified').length;
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

// Production-only storage: database is mandatory.
export const storage = new DbStorage();
