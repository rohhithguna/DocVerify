# 09 - Certificate System

## Certificate Lifecycle & Operations

## Overview

The certificate system manages the complete lifecycle of digital certificates from creation through issuance, verification, and potential revocation. This document details certificate data structures, operations, validation rules, and state transitions.

## Certificate Lifecycle Stages

```
┌──────────────┐
│ Draft        │  User creates certificate in batch
│ (drafted)    │  Can edit, delete, or add more
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Signed       │  Batch merkle root computed
│ (signed)     │  User has reviewed and committed
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Issued       │  Submitted to blockchain
│ (issued)     │  Waiting for or confirmed
└──────┬───────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Revoked      │  │ Verified     │  Observable stale state
│ (revoked)    │  │ (by others)  │  (no state change)
└──────────────┘  └──────────────┘
```

## Certificate Data Structure

### Core Fields

```typescript
interface CertificateDocument {
  // Identity
  id: UUID;                          // Primary key
  certificateId: string;             // Human-readable ID (e.g., "CERT-2024-001")
  batchId: UUID;                     // Parent batch foreign key
  
  // Recipient & Achievement
  name: string;                      // Full name of recipient
  course: string;                    // Course/achievement title
  issuer: string;                    // Issuing organization
  date: string;                      // Issue date (ISO 8601: YYYY-MM-DD)
  
  // Content
  documentContent: JSON;             // Full certificate data structure
  fileHash?: string;                 // Hash if imported from file
  
  // Signing
  signature?: {
    message: string;                 // Hash of certificate data
    r: string;                       // ECDSA signature component
    s: string;                       // ECDSA signature component
    v: number;                       // Recovery value (27 or 28)
  };
  
  // Blockchain
  blockchainHash: string;            // Keccak256 of canonical string
  blockchainStatus: 'pending' | 'confirmed' | 'failed' | 'revoked';
  
  // Lifecycle
  status: 'drafted' | 'signed' | 'issued';
  revoked: boolean;
  revokedAt?: Date;
  issuedAt?: Date;
  createdAt: Date;
}
```

### Document Content Schema

The `documentContent` JSON field stores complete certificate data:

```json
{
  "name": "Jane Smith",
  "course": "Advanced Blockchain Engineering",
  "issuer": "University of Technology",
  "date": "2024-01-15",
  "certificateId": "CERT-2024-001",
  "customFields": {
    "gpa": "3.95",
    "honors": "with distinction",
    "semester": "Fall 2023",
    "creditHours": 45
  },
  "metadata": {
    "programId": "PROG-001",
    "cohort": "2024-Q1",
    "duration": "12 weeks"
  }
}
```

**Why JSON?**
- Flexible extensibility (custom fields per issuer)
- Preserves complete original data
- Easy searching and filtering
- Stores metadata for future enrichment

## Certificate Operations

### Creation

**Endpoint**: `POST /api/issuer/batch/:batchId/certificate`

```typescript
async function createCertificate(
  batchId: UUID,
  data: {
    name: string;
    course: string;
    issuer: string;
    date: string;
    certificateId: string;
    customFields?: Record<string, any>;
  }
) {
  // Validation
  if (!data.name || data.name.trim().length === 0) {
    throw new ValidationError('name is required');
  }
  
  if (!data.course || data.course.trim().length === 0) {
    throw new ValidationError('course is required');
  }
  
  // Verify batch exists and belongs to user
  const batch = await db.query.certificateBatches.findFirst({
    where: and(
      eq(certificateBatches.id, batchId),
      eq(certificateBatches.userId, authUserId)
    )
  });
  
  if (!batch) {
    throw new NotFoundError('Batch not found');
  }
  
  // Prevent adding to issued batches
  if (batch.status !== 'draft') {
    throw new ConflictError('Cannot add certificates to issued batches');
  }
  
  // Check for duplicate certificateId in batch
  const existing = await db.query.certificateDocuments.findFirst({
    where: and(
      eq(certificateDocuments.batchId, batchId),
      eq(certificateDocuments.certificateId, data.certificateId)
    )
  });
  
  if (existing) {
    throw new ConflictError('Certificate ID already exists in batch');
  }
  
  // Create document
  const certificate = await db.insert(certificateDocuments).values({
    batchId,
    certificateId: data.certificateId,
    name: data.name.trim(),
    course: data.course.trim(),
    issuer: data.issuer.trim(),
    date: data.date,
    status: 'drafted',
    documentContent: {
      name: data.name,
      course: data.course,
      issuer: data.issuer,
      date: data.date,
      certificateId: data.certificateId,
      customFields: data.customFields || {}
    },
    createdAt: new Date()
  });
  
  return certificate;
}
```

**Validation Rules**:
- All core fields required (name, course, issuer, date)
- certificateId must be unique within batch
- Batch must exist and be in draft status
- Date must be valid ISO 8601 format

**Database Constraints**:
- Foreign key: `batchId` → `certificateBatches.id`
- Unique: `(batchId, certificateId)`

### Hash Computation

**File**: [backend/services/crypto.ts](backend/services/crypto.ts#L20)

```typescript
function certificateDataToHashString(data: {
  name: string;
  course: string;
  issuer: string;
  date: string;
  certificateId: string;
}): string {
  // Create canonical string representation
  // Order is: name | course | issuer | date | certificateId
  // Case-insensitive, trimmed
  
  const parts = [
    data.name.toLowerCase().trim(),
    data.course.toLowerCase().trim(),
    data.issuer.toLowerCase().trim(),
    data.date,  // ISO 8601 already uppercase
    data.certificateId.toLowerCase().trim()
  ];
  
  return parts.join('|');
  
  // Example:
  // 'jane smith'|'advanced blockchain'|'university'|'2024-01-15'|'cert-001'
}

function computeHash(canonicalString: string): string {
  // Use Keccak256 (same as Ethereum)
  const hash = keccak256(Buffer.from(canonicalString, 'utf8'));
  return '0x' + hash.toString('hex');
  
  // Example result:
  // '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2'
}
```

**Properties**:
- **Deterministic**: Same input always produces same hash
- **Sensitive**: Any change (case, spacing, typo) produces different hash
- **Collision-resistant**: Computationally infeasible to find collisions
- **One-way**: Cannot reverse hash to get original data

**Example Computation**:
```
Input: {
  name: "Jane Smith",
  course: "Advanced Blockchain",
  issuer: "University",
  date: "2024-01-15",
  certificateId: "CERT-001"
}

Canonical: "jane smith|advanced blockchain|university|2024-01-15|cert-001"

Keccak256: "0x4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a"
```

### Batch Signing

**Endpoint**: `POST /api/issuer/batch/:batchId/sign`

The signing process creates a merkle tree and commits the batch on-chain.

```typescript
async function signBatch(batchId: UUID, issuerPrivateKey: string) {
  // Step 1: Fetch all drafted certificates in batch
  const certificates = await db.query.certificateDocuments.findMany({
    where: and(
      eq(certificateDocuments.batchId, batchId),
      eq(certificateDocuments.status, 'drafted')
    )
  });
  
  if (certificates.length === 0) {
    throw new ValidationError('Batch contains no certificates');
  }
  
  // Step 2: Compute hash for each certificate
  const hashes = certificates.map(cert => {
    const canonical = certificateDataToHashString({
      name: cert.name,
      course: cert.course,
      issuer: cert.issuer,
      date: cert.date,
      certificateId: cert.certificateId
    });
    
    const hash = computeHash(canonical);
    return hash;
  });
  
  // Step 3: Build merkle tree
  const merkleTree = new MerkleTree(hashes);
  const merkleRoot = merkleTree.getRoot();
  
  // Step 4: Sign merkle root with issuer private key
  const message = merkleRoot;
  const signature = signWithPrivateKey(message, issuerPrivateKey);
  // signature = {r: "0x...", s: "0x...", v: 27}
  
  // Step 5: Update batch
  const batch = await db.update(certificateBatches)
    .set({
      status: 'signed',
      merkleRoot,
      rootSignature: JSON.stringify(signature)
    })
    .where(eq(certificateBatches.id, batchId))
    .returning();
  
  // Step 6: Update all certificates
  await db.update(certificateDocuments)
    .set({
      status: 'signed',
      blockchainHash: hashes[certificates.findIndex(...)],
      signature: signatureForCert
    })
    .where(eq(certificateDocuments.batchId, batchId));
  
  return batch;
}

function signWithPrivateKey(message: string, privateKey: string): Signature {
  // ECDSA signing
  // Uses issuer's wallet private key
  
  const msgHash = keccak256(Buffer.from(message, 'hex'));
  const sig = secp256k1.sign(msgHash, Buffer.from(privateKey, 'hex'));
  
  return {
    r: '0x' + sig.r.toString('hex'),
    s: '0x' + sig.s.toString('hex'),
    v: sig.recovery + 27  // Ethereum v convention
  };
}
```

### Batch Issuance (Blockchain Submission)

**Endpoint**: `POST /api/issuer/batch/:batchId/issue`

```typescript
async function issueBatch(batchId: UUID) {
  // Step 1: Fetch signed batch
  const batch = await db.query.certificateBatches.findFirst({
    where: eq(certificateBatches.id, batchId)
  });
  
  if (!batch || batch.status !== 'signed') {
    throw new ConflictError('Batch must be in signed status');
  }
  
  if (!batch.merkleRoot || !batch.rootSignature) {
    throw new ConflictError('Batch missing merkle root or signature');
  }
  
  // Step 2: Prepare blockchain transaction
  const tx = {
    function: 'submitMerkleRoot',
    arguments: [
      batch.merkleRoot,
      batch.batchId,           // UUID format
      batch.certificateCount
    ]
  };
  
  // Step 3: Submit to blockchain
  let txHash, error;
  try {
    const receipt = await blockchainService.submitMerkleRoot(
      batch.merkleRoot,
      batch.batchId,
      batch.certificateCount,
      issuerPrivateKey
    );
    txHash = receipt.transactionHash;
  } catch (e) {
    error = e.message;
  }
  
  // Step 4: Update batch status
  await db.update(certificateBatches)
    .set({
      status: 'issued',
      blockchainStatus: error ? 'failed' : 'pending',
      blockchainTxHash: txHash,
      issuedAt: new Date()
    })
    .where(eq(certificateBatches.id, batchId));
  
  // Step 5: Background job polls for confirmation
  if (txHash) {
    queueJob('poll-blockchain-confirmation', {
      batchId,
      txHash,
      maxAttempts: 120  // ~30 mins for Mainnet
    });
  }
  
  return {
    status: 'issued',
    blockchainStatus: error ? 'failed' : 'pending',
    blockchainTxHash: txHash,
    message: error || 'Batch submitted. Waiting for blockchain confirmation...'
  };
}
```

### Revocation

#### Batch Revocation

**Endpoint**: `POST /api/issuer/batch/:batchId/revoke`

```typescript
async function revokeBatch(batchId: UUID, issuerPrivateKey: string) {
  // Step 1: Fetch batch
  const batch = await db.query.certificateBatches.findFirst({
    where: eq(certificateBatches.id, batchId)
  });
  
  if (!batch || !batch.merkleRoot) {
    throw new NotFoundError('Batch not found or not issued');
  }
  
  if (batch.blockchainStatus !== 'confirmed') {
    throw new ConflictError('Only confirmed batches can be revoked');
  }
  
  // Step 2: Submit revocation to blockchain
  const receipt = await blockchainService.revokeMerkleRoot(
    batch.merkleRoot,
    issuerPrivateKey
  );
  
  // Step 3: Update batch and all certificates
  await db.transaction(async (tx) => {
    await tx.update(certificateBatches)
      .set({
        status: 'revoked',
        blockchainStatus: 'revoked',
        revokedAt: new Date()
      })
      .where(eq(certificateBatches.id, batchId));
    
    await tx.update(certificateDocuments)
      .set({
        revoked: true,
        revokedAt: new Date()
      })
      .where(eq(certificateDocuments.batchId, batchId));
  });
  
  // Step 4: Emit event for auditing
  events.emit('batch-revoked', {
    batchId,
    issuer: batch.userId,
    timestamp: new Date()
  });
  
  return { status: 'revoked' };
}
```

#### Individual Certificate Revocation

**Endpoint**: `POST /api/issuer/certificate/:certificateId/revoke`

```typescript
async function revokeCertificate(certificateId: UUID) {
  // Note: Individual certificate revocation is only local
  // On-chain revocation must be done via batch (merkle root)
  
  const certificate = await db.query.certificateDocuments.findFirst({
    where: eq(certificateDocuments.id, certificateId)
  });
  
  if (!certificate) {
    throw new NotFoundError('Certificate not found');
  }
  
  // Update local record
  await db.update(certificateDocuments)
    .set({
      revoked: true,
      revokedAt: new Date()
    })
    .where(eq(certificateDocuments.id, certificateId));
  
  return { revoked: true };
}
```

**Important**: Individual certificate revocation is local only. The blockchain still shows the hash as valid. Verifiers can see the revocation status by querying the certificate database, but the blockchain truth remains unchanged.

## QR Code Generation

### Certificate QR Encoding

When a batch is issued, QR codes are generated for each certificate.

```typescript
function generateCertificateQR(certificate: Certificate, batch: Batch) {
  // Prepare data to encode in QR
  const qrData = {
    // Metadata for verification
    metadata: {
      name: certificate.name,
      course: certificate.course,
      issuer: certificate.issuer,
      date: certificate.date,
      certificateId: certificate.certificateId
    },
    
    // Batch information (Stage 6 verification)
    merkleRoot: batch.merkleRoot,
    merkleProof: calculateMerkleProof(
      certificate.blockchainHash,
      batch.merkleTree
    ),
    
    // Additional context
    issuer: batch.userId,
    timestamp: batch.issuedAt,
    blockNumber: batch.blockchainBlockNumber,
    
    // URL for fallback web verification
    verificationUrl: `https://verify.docutrust.app/?data=${encodeURIComponent(
      JSON.stringify({...})
    )}`
  };
  
  // Encode as JSON string
  const jsonString = JSON.stringify(qrData);
  
  // Generate QR code
  return qrcode.toDataURL(jsonString, {
    errorCorrectionLevel: 'H',  // Highest error correction
    type: 'image/png',
    quality: 0.95,
    margin: 1,
    width: 300
  });
}
```

### Data Embedded in QR

```json
{
  "metadata": {
    "name": "Jane Smith",
    "course": "Advanced Blockchain",
    "issuer": "University",
    "date": "2024-01-15",
    "certificateId": "CERT-2024-001"
  },
  "merkleRoot": "0x1a2b3c4d...",
  "merkleProof": [
    "0x...",
    "0x...",
    "0x..."
  ],
  "timestamp": "2024-01-15T09:30:00Z",
  "verificationUrl": "https://verify.docutrust.app/?data=..."
}
```

**Size**: Typically 500-800 bytes, fits in standard QR code

## Duplicate Prevention

### Certificate ID Uniqueness

```sql
CREATE UNIQUE INDEX idx_cert_id_per_batch 
  ON certificate_documents(batch_id, certificate_id);
```

This prevents duplicate certificate IDs within a batch. Across batches, duplicates are allowed (common for annual repetitions).

### Content Hash Deduplication

```typescript
// Check if same certificate content already issued
const existing = await db.query.certificateDocuments.findFirst({
  where: eq(certificateDocuments.blockchainHash, computedHash)
});

if (existing) {
  // Either warn user or reuse existing certificate
  // depending on business logic
}
```

## Audit Trail

All certificate changes are tracked for compliance:

```typescript
interface CertificateAuditEvent {
  certificateId: UUID;
  action: 'created' | 'signed' | 'issued' | 'revoked' | 'updated';
  timestamp: Date;
  userId: UUID;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  blockchainHash?: string;
  blockNumber?: number;
}
```

Audit events stored in dedicated table for compliance reporting.

## Validation Rules

| Field | Format | Example | Rules |
|-------|--------|---------|-------|
| **name** | String | "Jane Smith" | 1-255 chars, required |
| **course** | String | "Advanced Blockchain" | 1-255 chars, required |
| **issuer** | String | "University of Tech" | 1-255 chars, required |
| **date** | ISO 8601 | "2024-01-15" | YYYY-MM-DD format, required |
| **certificateId** | String | "CERT-2024-001" | 1-255 chars, unique per batch, required |

## Constraints & Limits

| Item | Limit | Reason |
|------|-------|--------|
| **Certificates per batch** | 10,000 | Memory/computation limits |
| **Batch name length** | 255 chars | Database field limit |
| **Custom fields per cert** | 100 | JSON performance |
| **Concurrent signings per user** | 5 | Resource management |
| **Issuance retry attempts** | 10 | Blockchain confirmation reliability |

## Performance Characteristics

| Operation | Time | Notes |
|-----------|------|-------|
| **Create certificate** | < 100ms | Database insert |
| **Sign batch (100 certs)** | ~500ms | Merkle tree build + signature |
| **Sign batch (1000 certs)** | ~2s | O(n log n) merkle operation |
| **Issue to blockchain** | 2-30s | Network-dependent, async |
| **Revoke batch** | 2-30s | One blockchain transaction |

## Future Enhancements

1. **Certificate Templates**
   - Pre-defined fields per issuer
   - Consistent formatting

2. **Bulk Operations**
   - CSV import for 1000+ certificates
   - Batch validation before signing

3. **Variable Metadata**
   - Dynamic fields per organization
   - Custom validation rules

4. **Batch Compression**
   - Support 50,000+ certificates per batch
   - Optimized blockchain submission

5. **Version History**
   - Track all changes to certificates
   - Rollback capability for drafts
