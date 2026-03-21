-- Production hardening for documents table.
-- Adds canonical verification columns and revocation metadata.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS date text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS hash text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS revoked boolean NOT NULL DEFAULT false;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS revoked_at timestamp;

-- Backfill canonical columns from existing data.
UPDATE documents
SET
	date = COALESCE(date, issued_date, original_data->>'date'),
	hash = COALESCE(hash, document_hash),
	revoked = COALESCE(revoked, false)
WHERE
	date IS NULL
	OR hash IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(date);
CREATE INDEX IF NOT EXISTS idx_documents_hash_canonical ON documents(hash);
CREATE INDEX IF NOT EXISTS idx_documents_revoked ON documents(revoked);
