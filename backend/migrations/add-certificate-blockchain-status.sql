DO $$
BEGIN
  CREATE TYPE certificate_blockchain_status AS ENUM ('CONFIRMED', 'PENDING', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE certificates
ADD COLUMN IF NOT EXISTS blockchain_status certificate_blockchain_status NOT NULL DEFAULT 'PENDING';
