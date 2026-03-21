-- Structured certificate model with strict uniqueness and data integrity constraints.

CREATE TABLE IF NOT EXISTS certificates (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id varchar REFERENCES documents(id),

  holder_name text NOT NULL,
  student_id text NOT NULL UNIQUE,
  holder_email text,

  certificate_id text NOT NULL UNIQUE,
  course text NOT NULL,
  level text NOT NULL CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
  duration text NOT NULL,
  grade text,

  issuer_name text NOT NULL,
  issuer_id text NOT NULL,
  issuer_wallet text NOT NULL CHECK (issuer_wallet ~* '^0x[a-f0-9]{40}$'),

  issue_date timestamp NOT NULL,
  expiry_date timestamp NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),

  hash text NOT NULL CHECK (hash ~* '^[a-f0-9]{64}$'),
  tx_hash text,
  merkle_root text,

  signature text NOT NULL,
  signed_by text NOT NULL,
  qr_code_url text NOT NULL,

  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT certificates_expiry_after_issue CHECK (expiry_date > issue_date)
);

CREATE INDEX IF NOT EXISTS idx_certificates_document_id ON certificates(document_id);
CREATE INDEX IF NOT EXISTS idx_certificates_issuer_id ON certificates(issuer_id);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
