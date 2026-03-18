-- Database Indexes for DocuTrustChain
-- Run these after initial schema setup for better query performance

-- Speed up document hash lookups during verification
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(document_hash);

-- Speed up image hash lookups using JSONB
CREATE INDEX IF NOT EXISTS idx_documents_image_hash ON documents ((original_data->>'imageHash'));

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
COMMENT ON INDEX idx_documents_image_hash IS 'Speeds up certificate image verification';
COMMENT ON INDEX idx_batches_issuer IS 'Speeds up issuer dashboard queries';
COMMENT ON INDEX idx_verifications_verifier IS 'Speeds up verifier history queries';
