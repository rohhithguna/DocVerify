-- Add explicit certificate metadata columns for fast lookups and stronger data contracts.
-- Safe to run multiple times.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS certificate_id text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS course text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS issuer text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS issued_date text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS merkle_root text;

-- Backfill explicit columns from legacy JSON payloads where possible.
UPDATE documents
SET
  certificate_id = COALESCE(certificate_id, original_data->>'certificateId'),
  name = COALESCE(name, original_data->>'name'),
  course = COALESCE(course, original_data->>'course'),
  issuer = COALESCE(issuer, original_data->>'issuer'),
  issued_date = COALESCE(issued_date, original_data->>'date'),
  merkle_root = COALESCE(merkle_root, merkle_proof->>'root', original_data->>'merkleRoot')
WHERE
  certificate_id IS NULL
  OR name IS NULL
  OR course IS NULL
  OR issuer IS NULL
  OR issued_date IS NULL
  OR merkle_root IS NULL;

-- Keep frequently used verification lookups fast.
CREATE INDEX IF NOT EXISTS idx_documents_certificate_id ON documents(certificate_id);
CREATE INDEX IF NOT EXISTS idx_documents_merkle_root ON documents(merkle_root);
