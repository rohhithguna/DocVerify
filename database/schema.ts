import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const certificateLevelEnum = pgEnum("certificate_level", [
  "Beginner",
  "Intermediate",
  "Advanced",
]);

export const certificateStatusEnum = pgEnum("certificate_status", [
  "ACTIVE",
  "REVOKED",
  "DELETED",
]);

export const certificateBlockchainStatusEnum = pgEnum("certificate_blockchain_status", [
  "CONFIRMED",
  "PENDING",
  "FAILED",
]);

// ──────────────────────────────────────────────
//  Users (Authentication)
// ──────────────────────────────────────────────

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  organization: text("organization"),
  role: text("role").notNull().default("issuer"), // issuer | verifier | admin
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

// ──────────────────────────────────────────────
//  Document System
// ──────────────────────────────────────────────
export const documentBatches = pgTable("document_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchName: text("batch_name").notNull(),
  issuerId: text("issuer_id").notNull(),
  issuerName: text("issuer_name").notNull(),
  fileName: text("file_name").notNull(),
  documentCount: integer("document_count").notNull(),
  groupingCriterion: text("grouping_criterion").notNull(),
  merkleRoot: text("merkle_root"),
  blockchainTxHash: text("blockchain_tx_hash"),
  blockNumber: text("block_number"),
  status: text("status").notNull().default("processing"), // processing, signed, blockchain_stored, completed, revoked
  revoked: boolean("revoked").notNull().default(false),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// Individual documents within batches
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").references(() => documentBatches.id).notNull(),
  certificateId: text("certificate_id"),
  name: text("name"),
  course: text("course"),
  issuer: text("issuer"),
  date: text("date"),
  issuedDate: text("issued_date"),
  hash: text("hash"),
  documentHash: text("document_hash").notNull(),
  digitalSignature: text("digital_signature"),
  merkleRoot: text("merkle_root"),
  originalData: jsonb("original_data").notNull(), // Store original CSV row data
  merkleProof: jsonb("merkle_proof"), // Store Merkle proof as JSON array
  revoked: boolean("revoked").notNull().default(false),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

// Structured certificate records with strict holder/issuer/security metadata.
export const certificates = pgTable("certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id),

  holderName: text("holder_name").notNull(),
  studentId: text("student_id").notNull().unique(),
  holderEmail: text("holder_email"),

  certificateId: text("certificate_id").notNull().unique(),
  course: text("course").notNull(),
  level: certificateLevelEnum("level").notNull(),
  duration: text("duration").notNull(),
  grade: text("grade"),

  issuerName: text("issuer_name").notNull(),
  issuerId: text("issuer_id").notNull(),
  issuerWallet: text("issuer_wallet").notNull(),

  issueDate: timestamp("issue_date").notNull(),
  expiryDate: timestamp("expiry_date").notNull(),
  status: certificateStatusEnum("status").notNull().default("ACTIVE"),
  blockchainStatus: certificateBlockchainStatusEnum("blockchain_status").notNull().default("PENDING"),

  hash: text("hash").notNull(),
  txHash: text("tx_hash"),
  merkleRoot: text("merkle_root"),

  signature: text("signature").notNull(),
  signedBy: text("signed_by").notNull(),

  qrCodeUrl: text("qr_code_url").notNull(),

  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// Verification attempts by verifiers
export const verifications = pgTable("verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  verifierId: text("verifier_id").notNull(),
  fileName: text("file_name").notNull(),
  documentHash: text("document_hash").notNull(),
  digitalSignatureValid: boolean("digital_signature_valid"),
  merkleProofValid: boolean("merkle_proof_valid"),
  blockchainVerified: boolean("blockchain_verified"),
  confidenceScore: integer("confidence_score"), // 0-100
  matchedBatchId: varchar("matched_batch_id").references(() => documentBatches.id),
  matchedDocumentId: varchar("matched_document_id").references(() => documents.id),
  status: text("status").notNull().default("pending"), // pending, verified, failed
  errorMessage: text("error_message"),
  verificationData: jsonb("verification_data"), // Store extracted document data
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

// Blockchain network status and configuration
export const blockchainStatus = pgTable("blockchain_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  network: text("network").notNull().default("sepolia"),
  blockHeight: text("block_height"),
  gasPrice: text("gas_price"),
  status: text("status").notNull().default("disconnected"), // connected, disconnected, syncing
  lastUpdated: timestamp("last_updated").default(sql`now()`).notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentBatchSchema = createInsertSchema(documentBatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertCertificateSchema = createInsertSchema(certificates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVerificationSchema = createInsertSchema(verifications).omit({
  id: true,
  createdAt: true,
});

export const insertBlockchainStatusSchema = createInsertSchema(blockchainStatus).omit({
  id: true,
  lastUpdated: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type DocumentBatch = typeof documentBatches.$inferSelect;
export type InsertDocumentBatch = z.infer<typeof insertDocumentBatchSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;

export type Verification = typeof verifications.$inferSelect;
export type InsertVerification = z.infer<typeof insertVerificationSchema>;

export type BlockchainStatus = typeof blockchainStatus.$inferSelect;
export type InsertBlockchainStatus = z.infer<typeof insertBlockchainStatusSchema>;

// Extended types for API responses
export type DocumentBatchWithStats = DocumentBatch & {
  verificationCount: number;
  successRate: number;
  documentId?: string;
  blockchainStatus?: "CONFIRMED" | "PENDING" | "FAILED";
};

export type VerificationWithDetails = Verification & {
  batchName?: string;
  issuerName?: string;
};
