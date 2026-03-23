# 06 - Database Schema & Design

## PostgreSQL Data Model

## Overview

The PostgreSQL database serves as the system of record for certificate metadata, user information, and blockchain status tracking. The schema is designed for ACID compliance, referential integrity, and efficient querying of certificate batches and verification history.

## ER Diagram

```
┌─────────────────┐
│     users       │
├─────────────────┤
│ id (PK)         │
│ email           │
│ password_hash   │
│ issuer_id       │
│ role            │
│ created_at      │
└────────┬────────┘
         │
    ┌────▼────────────────┐
    │                     │
    │  ┌─────────────────────┐
    │  │ certificate_batches │
    │  ├─────────────────────┤
    │  │ id (PK)             │
    │  │ user_id (FK)        │
    │  │ batch_id (UUID)     │
    │  │ status              │
    │  │ merkle_root         │──┐
    │  │ root_signature      │  │
    │  │ blockchain_status   │  │
    │  │ created_at          │  │
    │  │ issued_at           │  │
    │  └─────────────────────┘  │
    │           │               │
    │           │               │
    │  ┌────────▼──────────────────┐
    └──│ certificate_documents     │
       ├──────────────────────────┤
       │ id (PK)                  │
       │ batch_id (FK)            │
       │ certificate_id           │
       │ name                     │
       │ course                   │
       │ issuer                   │
       │ date                     │
       │ document_content         │
       │ file_hash                │
       │ status                   │
       │ blockchain_hash (indexed)│
       │ signed                   │
       │ revoked                  │
       │ created_at               │
       └──────────────────────────┘
              │
              │
       ┌──────▼──────────────────┐
       │ verifications           │
       ├──────────────────────────┤
       │ id (PK)                  │
       │ verifier_id (FK)         │
       │ document_id (FK)         │
       │ file_hash                │
       │ blockchain_hash          │
       │ merkle_root              │
       │ merkle_proof             │
       │ status                   │
       │ blockchain_result        │
       │ verified_at              │
       │ created_at               │
       └──────────────────────────┘
```

## Table Schema Definitions

### `users` Table

Stores user accounts with authentication and role information.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  issuer_id VARCHAR(255),           -- Organization ID
  role VARCHAR(50) NOT NULL,         -- 'issuer' | 'verifier' | admin'
  full_name VARCHAR(255),
  organization VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP             -- Soft delete
);

-- Indexes for authentication and queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_issuer_id ON users(issuer_id);
CREATE INDEX idx_users_role ON users(role);
```

**Purpose**: Authenticate users and manage role-based access control

**Fields**:
- `id`: UUID primary key for referential integrity
- `email`: Unique login identifier
- `password_hash`: Bcrypt hash (~60 chars)
- `issuer_id`: Organization identifier (alpha-numeric)
- `role`: Determines feature access (issuer creates/signs, verifier verifies)
- `full_name`: Display name in UI
- `organization`: Organization name for profile
- `created_at`: Account creation timestamp
- `updated_at`: Last modification timestamp
- `deleted_at`: Soft delete for audit trail (NULL if active)

**Constraints**:
- `email`: Unique to prevent duplicate accounts
- `role`: Must be valid option (enforced by application enum)

---

### `certificate_batches` Table

Groups multiple certificates issued together, tracking batch-level lifecycle and blockchain status.

```sql
CREATE TABLE certificate_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  batch_id VARCHAR(36) NOT NULL UNIQUE,      -- UUID string
  status VARCHAR(50) NOT NULL,               -- 'draft' | 'signed' | 'issued' | 'revoked'
  merkle_root VARCHAR(66),                   -- 0x-prefixed hash
  root_signature TEXT,                       -- JSON: {r, s, v} ECDSA sig
  blockchain_status VARCHAR(50),             -- 'pending' | 'confirmed' | 'failed' | 'revoked'
  blockchain_tx_hash VARCHAR(66),            -- Transaction hash if submitted
  blockchain_block_number INTEGER,           -- Block number if confirmed
  blockchain_confirmed_at TIMESTAMP,         -- Confirmation timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  issued_at TIMESTAMP,                       -- When batch was issued
  revoked_at TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_batch_user ON certificate_batches(user_id);
CREATE INDEX idx_batch_merkle ON certificate_batches(merkle_root);
CREATE INDEX idx_batch_status ON certificate_batches(status);
CREATE INDEX idx_batch_blockchain_status ON certificate_batches(blockchain_status);
```

**Purpose**: Track batch lifecycle from creation through blockchain submission

**Fields**:
- `batch_id`: Immutable batch identifier (UUID format)
- `status`: Batch-level workflow status
- `merkle_root`: Keccak256 root of certificate tree
- `root_signature`: ECDSA signature from private key
  - Format: `{r: "0x...", s: "0x...", v: 27|28}`
  - Used to prove authorization
- `blockchain_status`: Blockchain submission state
  - `pending`: Transaction queued
  - `confirmed`: Mined in block
  - `failed`: Submission error
  - `revoked`: Revocation submitted
- `blockchain_tx_hash`: Ethereum transaction hash (0x-prefixed 66 char)
- `blockchain_block_number`: Block containing transaction

**Indexes**:
- `user_id`: Fast lookup of issuer's batches
- `merkle_root`: Verification lookup during QR verification
- `status`: Filter by batch state
- `blockchain_status`: Track pending confirmations

---

### `certificate_documents` Table

Individual certificates with content, signing status, and blockchain hashes.

```sql
CREATE TABLE certificate_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  certificate_id VARCHAR(255) NOT NULL,      -- Human-readable ID
  name VARCHAR(255) NOT NULL,                -- Recipient name
  course VARCHAR(255) NOT NULL,              -- Course/achievement
  issuer VARCHAR(255) NOT NULL,              -- Issuing organization
  date VARCHAR(20) NOT NULL,                 -- ISO 8601 date
  document_content TEXT,                     -- JSON: full certificate data
  file_hash VARCHAR(66),                     -- File upload hash (Keccak256)
  signature TEXT,                            -- JSON: {r, s, v, message}
  status VARCHAR(50) NOT NULL,               -- 'drafted' | 'signed' | 'issued'
  blockchain_hash VARCHAR(66),               -- Certificate hash (0x-prefixed)
  blockchain_status VARCHAR(50),             -- 'pending' | 'confirmed' | 'revoked'
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  issued_at TIMESTAMP,
  
  FOREIGN KEY (batch_id) REFERENCES certificate_batches(id) ON DELETE CASCADE
);

CREATE INDEX idx_cert_batch ON certificate_documents(batch_id);
CREATE INDEX idx_cert_id ON certificate_documents(certificate_id);
CREATE INDEX idx_cert_hash ON certificate_documents(blockchain_hash);
CREATE INDEX idx_cert_status ON certificate_documents(status);
CREATE INDEX idx_cert_file_hash ON certificate_documents(file_hash);
CREATE INDEX idx_cert_revoked ON certificate_documents(revoked);
```

**Purpose**: Store individual certificate data with signing and blockchain tracking

**Fields**:
- `certificate_id`: Human-readable identifier (e.g., "CERT-2024-001")
- `name`: Recipient full name
- `course`: Achievement/course title
- `issuer`: Issuing organization
- `date`: Certificate issue date (ISO 8601)
- `document_content`: JSON object with full certificate data
  ```json
  {
    "name": "John Doe",
    "course": "Q1 2024",
    "issuer": "University",
    "date": "2024-01-15",
    "certificateId": "CERT-001",
    "customFields": {...}
  }
  ```
- `file_hash`: Hash of uploaded file (if imported from file)
- `signature`: Signed commitment
  ```json
  {
    "message": "certificate_data_hash",
    "r": "0x...",
    "s": "0x...",
    "v": 27
  }
  ```
- `blockchain_hash`: Computed hash from `name|course|issuer|date|id`
- `revoked`: Boolean flat for soft revocation tracking

**Constraints**:
- `batch_id` FK: Cascade delete (orphaned certs removed with batch)
- `certificate_id` + `batch_id`: Should be unique per batch

---

### `verifications` Table

Tracks verification requests and results.

```sql
CREATE TABLE verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verifier_id UUID NOT NULL,                 -- Who performed verification
  document_id UUID,                          -- Linked certificate if known
  file_hash VARCHAR(66),                     -- Hash of uploaded file
  blockchain_hash VARCHAR(66),               -- Computed certificate hash
  merkle_root VARCHAR(66),                   -- If in batch
  merkle_proof TEXT,                         -- JSON array: proof path
  status VARCHAR(50) NOT NULL,               -- 'verified' | 'not_found' | 'revoked' | 'error'
  blockchain_result TEXT,                    -- JSON: full blockchain response
  blockchain_timestamp TIMESTAMP,            -- When blockchain confirmed
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (verifier_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (document_id) REFERENCES certificate_documents(id) ON DELETE SET NULL
);

CREATE INDEX idx_verification_verifier ON verifications(verifier_id);
CREATE INDEX idx_verification_document ON verifications(document_id);
CREATE INDEX idx_verification_hash ON verifications(blockchain_hash);
CREATE INDEX idx_verification_status ON verifications(status);
CREATE INDEX idx_verification_created ON verifications(created_at DESC);
```

**Purpose**: Maintain audit trail of all verification requests

**Fields**:
- `verifier_id`: User performing verification
- `document_id`: Link to matched certificate (if found)
- `file_hash`: Hash of file user uploaded for verification
- `blockchain_hash`: Computed hash from QR metadata
- `merkle_root`: If certificate in batch (Stage 6 verification)
- `merkle_proof`: JSON array of hashes proving membership
  ```json
  [
    "0x...",  // sibling hash 1
    "0x...",  // sibling hash 2
    "0x..."   // sibling hash 3
  ]
  ```
- `status`: Outcome of verification
  - `verified`: Hash found on blockchain, not revoked
  - `not_found`: Hash not submitted to blockchain
  - `revoked`: Hash revoked by issuer
  - `error`: Blockchain verification failed
- `blockchain_result`: Full response from blockchain service
  ```json
  {
    "exists": true,
    "revoked": false,
    "issuer": "0x...",
    "timestamp": 1234567890,
    "blockNumber": 12345
  }
  ```

**Indexes**:
- `created_at` DESC: Latest verifications first (for dashboard)
- `blockchain_hash`: Deduplication and result lookup
- `status`: Filter by outcome
- `verifier_id`: User's verification history

---

## Data Relationships

### Issuance Workflow Flow

```
1. User creates batch
   CREATE users → CREATE certificate_batches (status='draft')

2. User adds certificates to batch
   INSERT certificate_documents (batch_id, status='drafted')

3. User signs batch
   UPDATE certificate_batches SET merkle_root, root_signature
   UPDATE certificate_documents SET status='signed'

4. User issues (submits to blockchain)
   UPDATE certificate_batches SET blockchain_status='pending'
   Blockchain responds with tx_hash
   UPDATE certificate_batches SET blockchain_tx_hash, blockchain_status='confirmed'
   UPDATE certificate_documents SET issued_at

5. Blockchain mines confirmation
   UPDATE certificate_batches SET blockchain_confirmed_at
   UPDATE certificate_documents SET blockchain_status='confirmed'
```

### Verification Workflow Flow

```
1. Verifier uploads file
   COMPUTE file_hash

2. Verifier scans QR or extracts metadata
   COMPUTE blockchain_hash from metadata

3. Query blockchain service
   SELECT blockchain_hash FROM blockchain

4. If found on blockchain:
   INSERT verifications (status='verified')
   Match to document_id if exists
   UPDATE verifications SET document_id

5. If not found:
   INSERT verifications (status='not_found')

6. Dashboard queries:
   SELECT * FROM verifications WHERE verifier_id = $1
   ORDER BY created_at DESC
   LIMIT 10 OFFSET $2
```

## Migration History

All schema changes tracked in `backend/migrations/`:

1. **Initial Schema** (implicit)
   - users, certificate_batches, certificate_documents

2. **add-certificate-columns.sql**
   - Added blockchain_hash, blockchain_status
   - Added signature, revoked fields
   - Added blockchain_tx_hash tracking

3. **add-certificate-blockchain-status.sql**
   - Added blockchain_status enum: pending|confirmed|failed|revoked
   - Added blockchain_confirmed_at timestamp
   - Added blockchain_block_number integer

4. **add-indexes.sql**
   - Created all field indexes
   - Full-text search on certificate data
   - Composite indexes for common queries

5. **add-certificate-deleted-status.sql**
   - Added revoked_at timestamp
   - Added soft-delete support

6. **add-structured-certificates-table.sql**
   - Added document_content JSON field
   - Restructured metadata storage

7. **production-hardening-documents.sql**
   - Added merkle_proof storage
   - Added blockchain_result JSON
   - Added constraints and triggers

## Query Patterns

### Certificate Lookup (Issuer Dashboard)

```sql
-- Get all batches for issuer with cert counts
SELECT 
  b.id,
  b.batch_id,
  b.status,
  b.blockchain_status,
  b.created_at,
  COUNT(d.id) as certificate_count,
  SUM(CASE WHEN d.revoked THEN 1 ELSE 0 END) as revoked_count
FROM certificate_batches b
LEFT JOIN certificate_documents d ON b.id = d.batch_id
WHERE b.user_id = $1
GROUP BY b.id
ORDER BY b.created_at DESC
LIMIT 20 OFFSET $2;
```

### Verification History (Verifier Dashboard)

```sql
-- Get verification history with document matching
SELECT 
  v.id,
  v.file_hash,
  v.blockchain_hash,
  v.status,
  v.created_at,
  d.name,
  d.certificate_id,
  d.issuer
FROM verifications v
LEFT JOIN certificate_documents d ON v.document_id = d.id
WHERE v.verifier_id = $1
ORDER BY v.created_at DESC
LIMIT 10 OFFSET $2;
```

### Batch Status Check

```sql
-- Check if batch ready for blockchain submission
SELECT 
  COUNT(*) as total_certs,
  COUNT(CASE WHEN status = 'signed' THEN 1 END) as signed_certs
FROM certificate_documents
WHERE batch_id = $1;

-- Hash unsubmitted certificates
SELECT blockchain_hash, signed
FROM certificate_documents
WHERE batch_id = $1
AND status = 'signed'
AND blockchain_status IS NULL;
```

### Revocation Record

```sql
-- Revoke individual certificate
UPDATE certificate_documents
SET revoked = true, revoked_at = NOW()
WHERE id = $1;

-- Revoke entire batch
UPDATE certificate_documents
SET revoked = true, revoked_at = NOW()
WHERE batch_id = $1;
```

## Performance Considerations

### Index Strategy

| Index | Purpose | Query Pattern |
|-------|---------|---------------|
| `idx_batch_user` | Dashboard batches | Filter by issuer |
| `idx_cert_batch` | Batch certs | INNER JOIN on batch_id |
| `idx_cert_hash` | Blockchain lookup | WHERE blockchain_hash = ? |
| `idx_verification_created DESC` | Recent verifications | ORDER BY created at |
| `idx_verification_hash` | Dedup submissions | WHERE blockchain_hash = ? |

### Query Optimization

```sql
-- SLOW: Full table scan
SELECT * FROM certificate_documents;

-- FAST: Use indexes
SELECT * FROM certificate_documents
WHERE batch_id = $1
AND blockchain_hash = $2;

-- FAST: Pagination
SELECT * FROM verifications
WHERE verifier_id = $1
ORDER BY created_at DESC
LIMIT 10 OFFSET 20;
```

### Connection Pooling

```typescript
// Drizzle ORM with connection pool
const db = drizzle(new Pool({
  host: process.env.DATABASE_HOST,
  port: 5432,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  max: 20,           // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}));
```

## Backup & Recovery

### Automated Backups

```bash
# Daily backup to disk
pg_dump -U docutrust docutrust_db > /backups/docutrust-$(date +%Y%m%d).sql

# Hourly backup to S3
aws s3 cp /tmp/docutrust.sql s3://docutrust-backups/$(date +%Y%m%d-%H).sql
```

### Disaster Recovery

```sql
-- Restore from backup
psql -U docutrust docutrust_db < /backups/docutrust-20240115.sql

-- Point-in-time recovery
pg_restore -d docutrust_db /backups/docutrust-20240115.dump
```

## Consistency & ACID Properties

### Transaction Isolation

All multi-step operations wrapped in transactions:

```typescript
await db.transaction(async (tx) => {
  // Step 1: Create batch
  const batch = await tx.insert(certificateBatches).values({...});
  
  // Step 2: Add certificates
  await tx.insert(certificateDocuments).values([...]);
  
  // Step 3: Sign batch
  await tx.update(certificateBatches)
    .set({merkleRoot, rootSignature})
    .where(eq(certificateBatches.id, batch.id));
});
```

**Properties Guaranteed**:
- **Atomic**: All-or-nothing (fully inserted or fully rolled back)
- **Consistent**: No partial states visible
- **Isolated**: Concurrent transactions don't interfere
- **Durable**: Committed data survives crashes

## Future Schema Evolution

Planned changes:

1. **Sharding by Issuer ID**
   - Distribute large datasets across multiple tables
   - Improve query performance for high-volume issuers

2. **Temporal Tables**
   - Track history of all changes
   - Enable point-in-time queries

3. **Partitioning by Date**
   - Archive old certificates
   - Improve dashboard query speed

4. **Materialized Views**
   - Precomputed verification statistics
   - Analytics dashboard
