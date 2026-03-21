-- Database Indexes for DocuTrustChain
-- Run these after initial schema setup for better query performance

-- Speed up document hash lookups during verification
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(document_hash);

-- Speed up certificate ID lookups in canonical verification flow
CREATE INDEX IF NOT EXISTS idx_documents_certificate_id ON documents(certificate_id);

-- Speed up Merkle root lookups for proof/root diagnostics
CREATE INDEX IF NOT EXISTS idx_documents_merkle_root ON documents(merkle_root);

-- Speed up canonical hash and revocation checks
CREATE INDEX IF NOT EXISTS idx_documents_hash_canonical ON documents(hash);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(date);
CREATE INDEX IF NOT EXISTS idx_documents_revoked ON documents(revoked);

-- Speed up batch queries by issuer
CREATE INDEX IF NOT EXISTS idx_batches_issuer ON document_batches(issuer_id);

-- Speed up verification queries by verifier
CREATE INDEX IF NOT EXISTS idx_verifications_verifier ON verifications(verifier_id);

-- Speed up verification lookups by matched batch
CREATE INDEX IF NOT EXISTS idx_verifications_batch ON verifications(matched_batch_id);

-- Speed up date-based queries
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON document_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verifications_created_at ON verifications(created_at DESC);

-- Add comments
COMMENT ON INDEX idx_documents_hash IS 'Speeds up document verification by hash lookup';
COMMENT ON INDEX idx_documents_certificate_id IS 'Speeds up certificate metadata verification lookups';
COMMENT ON INDEX idx_documents_merkle_root IS 'Speeds up Merkle root diagnostics and audits';
COMMENT ON INDEX idx_documents_hash_canonical IS 'Speeds up canonical certificate hash lookups';
COMMENT ON INDEX idx_documents_date IS 'Speeds up certificate date queries and audits';
COMMENT ON INDEX idx_documents_revoked IS 'Speeds up revoked-state queries';
COMMENT ON INDEX idx_batches_issuer IS 'Speeds up issuer dashboard queries';
COMMENT ON INDEX idx_verifications_verifier IS 'Speeds up verifier history queries';
