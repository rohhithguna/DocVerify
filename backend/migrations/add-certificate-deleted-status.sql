-- Add DELETED state for certificate soft-delete workflow
ALTER TYPE certificate_status ADD VALUE IF NOT EXISTS 'DELETED';
