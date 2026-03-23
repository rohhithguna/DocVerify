# 08 - Verification Flow

## Complete Verification Process

## Overview

The verification flow is the critical path for end-users (verifiers) to validate certificate authenticity. This document details every step, decision point, fallback mechanism, and error scenario.

## Two-Stage Verification System

DocuTrust supports two complementary verification methods:

### Stage 1: Direct Hash Verification
- **When**: Certificates issued before batching was available
- **Process**: Single certificate hash submitted directly to blockchain
- **Blockchain call**: `verifyHashProof(certificateHash)`
- **Cost**: Full gas cost per certificate
- **Speed**: 1 blockchain call

### Stage 6: Merkle Batch Verification
- **When**: Certificates issued as part of batches
- **Process**: Certificate hash proved against merkle root
- **Blockchain call**: `verifyMerkleProof(merkleRoot, certificateHash, proof)`
- **Cost**: Batch submitted once (250+ certs possible)
- **Speed**: Off-chain proof verification + 1 blockchain call

## Verification Entry Points

### File Upload Verification

```
User uploads certificate file
        ↓
Extract/Compute file hash
        ↓
Display metadata form
        ↓
User shows QR code (optional)
        ↓
Two paths converge...
```

### QR Code Verification

```
User scans QR code from certificate
        ↓
Decode QR data (JSON)
        ↓
→ Metadata embedded in QR
→ Merkle root (if batch)
→ Merkle proof (if batch)
        ↓
Two paths converge...
```

## Verification Flow Diagram

```
┌──────────────────────┐
│  Verifier scans QR   │
│  or uploads file     │
└──────┬───────────────┘
       │
       ├─ QR Code Path ─┐      ┌─ File Upload Path
       │                │      │
       ▼                │      ▼
   Decode QR    ─┐     │   Compute file hash
   Data         │     │   (Keccak256)
   Extract:     │     │        │
   - metadata   │     │        │
   - merkleRoot │     │        ▼
   - proof      │     │   Display metadata form
       │        └─────┼──────────┐
       │              │          │
       ▼              ▼          ▼
   ┌──────────────────────────────────┐
   │  Reconstruct certificate hash    │
   │  from metadata or QR             │
   │  hash = Keccak256(                │
   │    name + course +               │
   │    issuer + date +               │
   │    certificateId)                │
   └──────────────┬───────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
    ▼                           ▼
Stage 1 Path          Stage 6 Path
(Direct Hash)         (Merkle Batch)
    │                           │
    ▼                           ▼
Backend: Query         Backend: Query
blockchain for        blockchain for
hash existence        merkle root +
                      validate proof
    │                           │
    ▼                           ▼
Chain returns:        Chain returns:
{                     {
  exists: bool        exists: bool
  revoked: bool       revoked: bool
  issuer: addr        issuer: addr
  timestamp: uint     timestamp: uint
  blockNum: uint      blockNum: uint
}                     }
    │                           │
    └─────────────┬─────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │ Determine result   │
         │ status from chain  │
         └──────┬─────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
  exists=true  revoked=true  exists=false
  revoked=false    │            │
    │              ▼            ▼
    ▼         "revoked"     "not_found"
 "verified"
    │              │            │
    └──────────────┴────────────┘
                  │
                  ▼
        Display results to user
```

## Detailed Backend Process

### File Verification Handler

**File**: [backend/controllers/verifier.controller.ts](backend/controllers/verifier.controller.ts#L50)

```typescript
async function verifyDocument(req: Request, res: Response) {
  // Step 1: Extract certificate data from request
  const certificateData = req.body.certificateMetadata;
  const uploadedFile = req.files?.file;
  
  // Validate required metadata
  if (!certificateData?.name || !certificateData?.course) {
    return res.status(400).json({
      error: 'Missing required metadata fields'
    });
  }
  
  // Step 2: Compute hash from metadata
  // This reconstructs what issuer computed
  const canonical = certificateDataToHashString(certificateData);
  // canonical = "john-doe|advanced-blockchain|university|2024-01-15|cert-001"
  
  const blockchainHash = computeHash(canonical);
  // blockchainHash = "0x1a2b3c4d5e6f7a8b..."
  
  // Step 3: Handle QR vs manual metadata
  let certificateData_for_blockchain = null;
  let merkleProof = null;
  let merkleRoot = null;
  
  // If QR was scanned, it contains metadata + batch info
  if (req.body.qrData) {
    const qrParsed = JSON.parse(req.body.qrData);
    
    // Check if this is a batch certificate (has merkleRoot)
    if (qrParsed.merkleRoot) {
      // Stage 6: Merkle batch verification
      merkleRoot = qrParsed.merkleRoot;
      merkleProof = qrParsed.merkleProof || [];
      
      // Use QR metadata instead of form metadata
      certificateData_for_blockchain = qrParsed.metadata;
    } else {
      // Stage 1: Use QR metadata
      certificateData_for_blockchain = qrParsed.metadata;
    }
  } else {
    // Manual entry: use form metadata only
    certificateData_for_blockchain = certificateData;
  }
  
  // Step 4: Query blockchain
  const verificationResult = await blockchainService.verifyDocument(
    blockchainHash,
    {
      merkleRoot,
      merkleProof,
      certificateData: certificateData_for_blockchain
    }
  );
  
  // Step 5: Save verification record to database
  const verification = await db.insert(verifications).values({
    verifierId: req.user.id,
    blockchainHash,
    fileHash: uploadedFile?.hash,
    status: verificationResult.status,      // 'verified' | 'not_found' | 'revoked'
    blockchainResult: verificationResult,
    createdAt: new Date()
  });
  
  // Step 6: Try to match to existing certificate
  if (verificationResult.status === 'verified') {
    const matchedCert = await db.query.certificateDocuments
      .findFirst({
        where: eq(certificateDocuments.blockchainHash, blockchainHash)
      });
    
    if (matchedCert) {
      await db.update(verifications)
        .set({ documentId: matchedCert.id })
        .where(eq(verifications.id, verification.id));
    }
  }
  
  // Step 7: Return result to frontend
  return res.json({
    success: true,
    data: {
      verification: {
        id: verification.id,
        status: verificationResult.status,
        blockchainHash,
        blockchainDetails: verificationResult,
        document: matchedCert || null
      }
    }
  });
}
```

### Blockchain Verification Service

**File**: [backend/services/blockchain.ts](backend/services/blockchain.ts#L80)

```typescript
async verifyDocument(
  hash: string,
  options?: {
    merkleRoot?: string;
    merkleProof?: string[];
    certificateData?: any;
  }
): Promise<VerificationResult> {
  
  // Timeout: 30 seconds per blockchain call
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Blockchain timeout')), 30000)
  );
  
  try {
    let result;
    
    if (options?.merkleRoot && options?.merkleProof?.length > 0) {
      // Stage 6: Merkle proof verification
      result = await Promise.race([
        this.verifyMerkleProof(
          options.merkleRoot,
          hash,
          options.merkleProof
        ),
        timeoutPromise
      ]);
    } else {
      // Stage 1: Direct hash verification
      result = await Promise.race([
        this.verifyHashProof(hash),
        timeoutPromise
      ]);
    }
    
    return {
      exists: result.isValid,
      revoked: result.isRevoked,
      issuer: result.issuer,
      timestamp: result.timestamp,
      blockNumber: result.blockNumber,
      status: this.computeStatus(result.isValid, result.isRevoked),
      confirmedBlocks: this.currentBlockNumber - result.blockNumber
    };
    
  } catch (error) {
    console.error('Blockchain verification error:', error);
    return {
      exists: false,
      revoked: false,
      status: 'error',
      error: 'Unable to verify with blockchain service'
    };
  }
}

private computeStatus(exists: boolean, revoked: boolean): string {
  if (revoked) return 'revoked';
  if (exists) return 'verified';
  return 'not_found';
}
```

### Stage 1 Verification (Direct Hash)

```typescript
private async verifyHashProof(hash: string): Promise<HashRecord> {
  // Contract call: isHashOnChain(hash)
  const result = await this.contract.methods
    .verifyHashProof(hash)
    .call();
  
  // Result format:
  // {
  //   isValid: boolean,
  //   isRevoked: boolean,
  //   timestamp: uint256,
  //   issuer: address,
  //   blockNumber: uint256
  // }
  
  return {
    isValid: result.isValid,
    isRevoked: result.isRevoked,
    timestamp: parseInt(result.timestamp),
    issuer: result.issuer,
    blockNumber: parseInt(result.blockNumber)
  };
}
```

### Stage 6 Verification (Merkle Proof)

```typescript
private async verifyMerkleProof(
  root: string,
  leaf: string,
  proof: string[]
): Promise<MerkleProofResult> {
  // Contract call: verifyMerkleProof(root, leaf, proof)
  const result = await this.contract.methods
    .verifyMerkleProof(root, leaf, proof)
    .call();
  
  return {
    isValid: result.isValid,
    isRevoked: result.isRevoked,
    timestamp: parseInt(result.timestamp),
    issuer: result.issuer,
    blockNumber: parseInt(result.blockNumber),
    proofValid: this.validateProofOffChain(root, leaf, proof)
  };
}

private validateProofOffChain(
  root: string,
  leaf: string,
  proof: string[]
): boolean {
  // Recreate merkle tree computation off-chain
  // This verifies proof syntax before sending to blockchain
  
  let computed = leaf;
  for (const element of proof) {
    const combined = [computed, element].sort();
    computed = keccak256(Buffer.concat([
      Buffer.from(combined[0], 'hex'),
      Buffer.from(combined[1], 'hex')
    ]));
  }
  
  return computed.toString('hex') === root.replace('0x', '');
}
```

## Frontend Verification Component

**File**: [frontend/src/pages/verification-results.tsx](frontend/src/pages/verification-results.tsx)

```typescript
export function VerificationResults() {
  const { verification } = useVerificationContext();
  
  if (!verification) {
    return <div>No verification result</div>;
  }
  
  const statusConfig = {
    verified: {
      icon: <CheckCircle className="text-green-500" />,
      title: 'Certificate Verified',
      color: 'border-green-200 bg-green-50'
    },
    revoked: {
      icon: <XCircle className="text-red-500" />,
      title: 'Certificate Revoked',
      color: 'border-red-200 bg-red-50'
    },
    not_found: {
      icon: <AlertCircle className="text-yellow-500" />,
      title: 'Certificate Not Found',
      color: 'border-yellow-200 bg-yellow-50'
    },
    error: {
      icon: <AlertCircle className="text-gray-500" />,
      title: 'Verification Error',
      color: 'border-gray-200 bg-gray-50'
    }
  };
  
  const config = statusConfig[verification.status];
  
  return (
    <div className={`border ${config.color} rounded-lg p-6`}>
      <div className="flex gap-4">
        {config.icon}
        <div>
          <h2 className="text-2xl font-bold">{config.title}</h2>
          
          {verification.status === 'verified' && (
            <div className="mt-4 space-y-2">
              <p>
                <strong>Certificate ID:</strong>{' '}
                {verification.document?.certificateId}
              </p>
              <p>
                <strong>Recipient:</strong> {verification.document?.name}
              </p>
              <p>
                <strong>Issued:</strong>{' '}
                {new Date(verification.blockchainDetails.timestamp * 1000)
                  .toLocaleDateString()}
              </p>
              <p>
                <strong>Issuer:</strong> {verification.document?.issuer}
              </p>
              <p className="text-sm text-gray-600 mt-4">
                Blockchain confirmed at block{' '}
                {verification.blockchainDetails.blockNumber} (
                {verification.blockchainDetails.confirmedBlocks} blocks ago)
              </p>
            </div>
          )}
          
          {verification.status === 'revoked' && (
            <p className="mt-2 text-red-700">
              This certificate has been revoked by the issuer.
            </p>
          )}
          
          {verification.status === 'not_found' && (
            <p className="mt-2 text-yellow-700">
              This certificate was not found on the blockchain.
              Ensure all details are correct.
            </p>
          )}
          
          {verification.status === 'error' && (
            <p className="mt-2 text-gray-700">
              Could not verify certificate due to a system error.
              Please try again later.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

## Verification Data Flow

### Complete Request/Response Cycle

```
1. Frontend: User submits file + metadata
   {
     file: Blob,
     certificateMetadata: {
       name, course, issuer, date, certificateId
     },
     qrData: "..." (optional)
   }
   
2. Backend: Compute hashes
   - canonical string = "name|course|issuer|date|id"
   - blockchainHash = Keccak256(canonical)
   
3. Backend: Query blockchain
   Stage 1: contract.verifyHashProof(blockchainHash)
   Stage 6: contract.verifyMerkleProof(root, hash, proof)
   
4. Blockchain: Execute verification
   - Check hash existence in registry
   - Check revocation status
   - Return result with metadata
   
5. Backend: Record in database
   INSERT INTO verifications (
     verifierId, blockchainHash, status,
     blockchainResult, documentId (if matched)
   )
   
6. Frontend: Display results
   - Show status badge (verified/revoked/not_found/error)
   - Show certificate details if matched
   - Show blockchain confirmation details
   - Offer next actions (save, share, new verification)
```

## Error Handling & Recovery

### Network Errors

```typescript
// Blockchain service unreachable
if (error.code === 'ECONNREFUSED') {
  return {
    status: 'error',
    message: 'Blockchain service temporarily unavailable'
  };
}

// RPC timeout
if (error.message.includes('timeout')) {
  // Retry up to 3 times with exponential backoff
  return await retryWithBackoff(() => verifyDocument(), 3);
}
```

### Invalid Input Handling

```typescript
// Missing metadata
if (!certificateData.name || !certificateData.course) {
  return res.status(400).json({
    error: 'MISSING_FIELDS',
    message: 'name and course are required'
  });
}

// Invalid hash format
if (!/^0x[0-9a-f]{64}$/i.test(blockchainHash)) {
  return res.status(400).json({
    error: 'INVALID_HASH',
    message: 'Hash format invalid'
  });
}
```

### Partial Data Scenarios

```typescript
// QR scanned but missing merkle proof
if (qrData.merkleRoot && !qrData.merkleProof) {
  // Fall back to Stage 1 verification
  // QR indicates batch but no proof provided
  log.warn('Merkle proof missing, using direct hash');
  
  return await verifyHashProof(blockchainHash);
}

// File upload but no metadata
if (!req.body.certificateMetadata) {
  // Cannot verify without metadata
  return res.status(400).json({
    error: 'METADATA_REQUIRED',
    message: 'File verification requires metadata'
  });
}
```

## Performance Optimization

### Caching Strategy

```typescript
// Cache blockchain lookups for 5 minutes
const cacheKey = `verification:${blockchainHash}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached); // Instant response
}

// If not cached, query blockchain
const result = await blockchainService.verifyDocument(blockchainHash);
await redis.setex(cacheKey, 300, JSON.stringify(result));
```

### Parallel Verification

```typescript
// Verify multiple certificates simultaneously
const verifications = await Promise.all(
  certificateHashes.map(hash => 
    blockchainService.verifyDocument(hash)
  )
);
```

### Batch Loading

```typescript
// Load historical verifications in batches
async function loadVerificationHistory(page: number) {
  const BATCH_SIZE = 20;
  
  const verifications = await db.query.verifications
    .findMany({
      where: eq(verifications.verifierId, userId),
      limit: BATCH_SIZE,
      offset: (page - 1) * BATCH_SIZE,
      orderBy: desc(verifications.createdAt)
    });
  
  return verifications;
}
```

## Edge Cases & Solutions

| Case | Problem | Solution |
|------|---------|----------|
| **QR corrupted** | Cannot decode QR | Fall back to manual metadata entry |
| **Metadata mismatch** | User enters different name than certificate | Hash still computes correctly; show warning |
| **File vs QR hash differs** | Uploaded file hash ≠ QR hash | Prefer QR (more authoritative) |
| **Batch revoked** | Individual cert in revoked batch | Show revoked status (batch-level revocation) |
| **No blockchain response** | Timeout waiting for chain | Show "Unable to verify" with retry button |
| **Wrong issuer** | Cert issued by different org | Hash won't match; show not_found |

## Future Improvements

1. **Batch Verification API**
   - Submit multiple certificates at once
   - Single endpoint call for 10-50 certificates

2. **Webhook Notifications**
   - Notify verifier when batch confirmed on-chain
   - Real-time verification status updates

3. **Advanced Analytics**
   - Track verification trends by issuer
   - Detect suspicious patterns (mass revocation)

4. **Offline Mode**
   - Cache certificates locally
   - Verify without blockchain access (fallback)

5. **QR Enhancement**
   - Add timestamp to QR
   - Include issuer signature in QR
   - Support multiple QR formats
