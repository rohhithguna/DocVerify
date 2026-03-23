# 03 - Backend System

## Overview

The backend is built with **Express.js and TypeScript**, following a controller-service-repository pattern. It handles all business logic, data persistence, and blockchain interactions.

## Folder Structure

```
backend/
├── controllers/              # HTTP request handlers
│   ├── auth.controller.ts           # Login, register, logout
│   ├── issuer.controller.ts         # Certificate upload, batch ops
│   ├── verifier.controller.ts       # QR verification
│   ├── revoke.controller.ts         # Revocation operations
│   └── blockchain.controller.ts     # Contract status
│
├── services/                 # Business logic
│   ├── crypto.ts                    # Hashing, signing, QR generation
│   ├── blockchain.ts                # Ethereum interactions
│   ├── merkle.ts                    # Merkle tree operations
│   ├── issuer-utils.ts              # Issuer-specific utilities
│   ├── docutrust-abi.ts             # Smart contract ABI
│   └── jwt-utils.ts                 # Token management
│
├── middleware/               # Request processing
│   ├── auth.ts                      # JWT validation
│   ├── validation.ts                # Zod schema validators
│   ├── error-handler.ts             # Error wrapping
│   └── rate-limit.ts                # Request throttling
│
├── routes/
│   └── index.ts                     # Route definitions
│
├── scripts/                  # Utility scripts
│   ├── db-reset.ts                  # Database initialization
│   └── [systemic-test-*.ts]         # Integration tests
│
├── index.ts                  # Application entry point
├── storage.ts                # ORM abstraction
├── vite.ts                   # SSR setup (if applicable)
└── .env                      # Configuration
```

## Core Modules

### 1. Authentication System (`auth.controller.ts`)

**Endpoints**:
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate and get JWT
- `POST /api/auth/logout` - Invalidate session
- `GET /api/auth/me` - Get current user info

**Implementation**:
```typescript
// Register user
1. Validate email format & password strength
2. Hash password using bcryptjs
3. Create user record in database
4. Generate initial JWT token
5. Return token + user metadata

// Login user
1. Find user by email
2. Compare submitted password with hash
3. If match: generate JWT token
4. If mismatch: return 401 Unauthorized
5. Frontend stores JWT in localStorage/sessionStorage

// Token Structure (JWT)
Header: { alg: "RS256", typ: "JWT" }
Payload: {
  userId: "uuid",
  email: "user@org.com",
  role: "issuer|verifier|admin",
  organization: "org-id",
  iat: 1234567890,
  exp: 1234567890 + (24 * 3600)  // 24 hour expiry
}
Signature: RS256(header + payload, private_key)
```

**Error Handling**:
- Missing credentials → 400 Bad Request
- Weak password → 400 Bad Request
- Email already exists → 409 Conflict
- Invalid credentials (login) → 401 Unauthorized
- Expired token → 401 Unauthorized

### 2. Issuer Controller (`issuer.controller.ts`)

**Endpoints**:

#### Upload and Process Documents
```
POST /api/issuer/upload
Content-Type: multipart/form-data

Request:
{
  "file": <CSV file>,
  "batchName": "Q1 2024 Awards",
  "issuerId": "user-id",
  "issuerName": "University of Example",
  "groupingCriterion": "department"
}

Response:
{
  "success": true,
  "batchId": "batch-uuid",
  "documentsCount": 250,
  "status": "processing",
  "merkleRoot": "0x...",
  "message": "Batch created and processing"
}
```

**Processing Pipeline**:
```
1. File Validation
   ├─ Check MIME type (text/csv)
   ├─ Verify file size (< 50 MB)
   └─ Validate extension (.csv)

2. CSV Parsing
   ├─ Parse CSV into rows
   ├─ Extract headers
   └─ Validate column count

3. Data Normalization
   ├─ For each row:
   │  ├─ Map CSV columns to certificate fields
   │  ├─ Normalize string values (trim, case)
   │  ├─ Validate required fields
   │  └─ Handle missing optional fields
   
4. Hash Generation
   ├─ Create canonical form of each certificate
   ├─ Compute Keccak256 hash
   └─ Store hash with document

5. Merkle Tree Construction
   ├─ Collect all document hashes
   ├─ Build binary tree structure
   ├─ Compute intermediate hashes
   └─ Compute root hash

6. Document Storage
   ├─ Create batch record
   ├─ Insert all documents with hashes
   ├─ Store Merkle tree structure
   └─ Return batch ID to user

7. Status Update
   ├─ Mark batch as "processing"
   └─ Ready for signing
```

**Error Conditions**:
- Malformed CSV → 400 Bad Request
- Missing required fields → 400 Bad Request
- Duplicate entries → 409 Conflict (optional, can deduplicate)
- File too large → 413 Payload Too Large
- Unauthorized issuer → 403 Forbidden

#### Get Batches
```
GET /api/issuer/:issuerId/batches?page=1&pageSize=20

Response:
{
  "batches": [
    {
      "id": "batch-uuid",
      "batchName": "Q1 Awards",
      "documentCount": 250,
      "status": "signed|blockchain_stored|completed",
      "createdAt": "2024-01-15T10:00:00Z",
      "merkleRoot": "0x...",
      "verificationCount": 45,
      "successRate": 95.5,
      "revoked": false,
      "revokedAt": null
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

#### Get Statistics
```
GET /api/issuer/:issuerId/stats

Response:
{
  "totalDocuments": 1250,
  "totalBatches": 8,
  "totalVerifications": 450,
  "successRate": 94.2,
  "averageVerificationTime": "2.3 seconds",
  "blockchainStatus": "connected",
  "revokedCount": 12
}
```

#### Revoke Batch
```
POST /api/issuer/:issuerId/revoke/:batchId

Request:
{
  "reason": "Data quality issues"
}

Response:
{
  "success": true,
  "batchId": "batch-uuid",
  "revokedCount": 250,
  "blockchainTx": "0x...",
  "status": "revoked"
}
```

### 3. Verifier Controller (`verifier.controller.ts`)

**Endpoints**:

#### Verify Document
```
POST /api/verifier/verify
Content-Type: multipart/form-data

Request:
{
  "file": <certificate image>,
  "verifierId": "verifier-uuid"
}

Response:
{
  "success": true,
  "status": "VALID|INVALID|REVOKED|NOT_FOUND|ORPHANED",
  "isValid": true|false,
  "isRevoked": false,
  "confidence": 95,
  "message": "Certificate verified successfully",
  "results": {
    "documentFound": true,
    "digitalSignatureValid": true,
    "merkleProofValid": true,
    "blockchainVerified": true,
    "confidenceScore": 95,
    "matchedBatchId": "batch-uuid",
    "matchedDocumentId": "doc-uuid",
    "blockchainStatus": {
      "exists": true,
      "revoked": false,
      "issuer": "0x...",
      "timestamp": 1234567890
    }
  }
}
```

**Verification Algorithm**:

```
INPUT: Certificate image file
OUTPUT: Verification result with confidence score

STEP 1: QR Extraction
├─ Decode image (PNG/JPEG)
├─ Extract QR code data
└─ Parse QR format (JSON or URL)

STEP 2: Data Source Determination
├─ If URL format: Extract certificateId
├─ If JSON format: Use provided metadata
└─ Reconstruct certificate data object

STEP 3: Hash Computation
├─ Normalize certificate data (trim, lowercase)
├─ Serialize to canonical form
└─ Compute Keccak256 hash

STEP 4: Database Lookup
├─ Query for document by certificateId
├─ Query for certificate record
├─ If not found → Status: NOT_FOUND, Score: 0
├─ Retrieve batch information
└─ Check certificate status

STEP 5: Hash Validation
├─ Compare computed hash with stored hash
├─ If mismatch → Status: INVALID, Score: 0
└─ If match → Continue

STEP 6: Digital Signature Verification
├─ If signed document exists:
│  ├─ Retrieve signature from database
│  ├─ Verify signature using issuer's public key
│  ├─ If valid → Continue
│  └─ If invalid → Mark signature check as failed
└─ If not signed → Skip

STEP 7: Merkle Tree Verification
├─ If document in batch (not Stage-1):
│  ├─ Retrieve merkle proof from document
│  ├─ Verify proof leads to batch's merkle root
│  ├─ If valid → Continue
│  └─ If invalid → Mark merkle check as failed
└─ If Stage-1 (direct) → Skip

STEP 8: Blockchain Verification
├─ Query blockchain for hash/root match
├─ If direct hash found:
│  ├─ Record exists on blockchain
│  ├─ Check if hash is revoked
│  └─ Continue
├─ If merkle root found:
│  ├─ Batch submitted to blockchain
│  ├─ Check if root is revoked
│  └─ Continue
└─ If not found:
    ├─ Check document.revoked flag
    ├─ If revoked locally → Status: REVOKED, Score: 0
    └─ If not revoked → Orphaned certificate

STEP 9: Revocation Check
├─ Check blockchain revocation registry
├─ Check local database revocation flag
├─ If revoked → Status: REVOKED, Score: 0
└─ Continue if not revoked

STEP 10: Confidence Score Calculation
├─ Base score: 100 if all checks pass
├─ Deductions:
│  ├─ -10: Signature invalid
│  ├─ -20: Merkle proof invalid
│  ├─ -30: Not found on blockchain
│  └─ -100: Revoked or deleted
├─ Special cases:
│  ├─ Orphaned: Score 0 (exists on-chain but deleted DB)
│  └─ Pending blockchain: Score 85 (likely valid, awaiting confirmati!)
└─ Final score: 0-100

STEP 11: Final Status Assignment
├─ VALID: All checks pass, confidence ≥ 90
├─ INVALID: Any check fails, confidence < 90
├─ REVOKED: Deliberately revoked by issuer
├─ NOT_FOUND: No matching certificate in system
└─ ORPHANED: Deleted from DB but exists on blockchain

STEP 12: Result Logging
├─ Create verification record
├─ Store result in database
├─ Return to frontend with details
└─ Update verifier statistics
```

#### Get Verification History
```
GET /api/verifier/:verifierId/history?page=1&pageSize=20

Response:
{
  "verifications": [
    {
      "id": "verification-uuid",
      "fileName": "certificate.png",
      "status": "verified|failed|pending",
      "confidenceScore": 95,
      "certificateId": "cert-uuid",
      "documentHash": "0x...",
      "createdAt": "2024-01-15T10:00:00Z",
      "batchName": "Q1 Awards",
      "issuerName": "University"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 450,
    "totalPages": 23
  }
}
```

#### Get Verifier Statistics
```
GET /api/verifier/:verifierId/stats

Response:
{
  "totalVerifications": 450,
  "averageScore": 87.5,
  "failedVerifications": 25,
  "recentCount": 12,
  "successRate": 94.4
}
```

### 4. Blockchain Controller (`blockchain.controller.ts`)

**Endpoints**:

#### Contract Status
```
GET /api/blockchain/status

Response:
{
  "network": "sepolia",
  "blockHeight": "5234567",
  "gasPrice": "25",
  "status": "connected|disconnected|syncing",
  "lastUpdated": "2024-01-15T10:00:00Z",
  "contractAddress": "0x...",
  "blockchainError": null
}
```

**Status Determination**:
- Attempts connection to RPC endpoint
- Fetches latest block information
- Checks contract availability
- Returns connection status

### 5. Revoke Controller (`revoke.controller.ts`)

**Endpoints**:

#### Revoke Certificate
```
POST /api/revoke/:certificateId

Request:
{
  "reason": "Certificate expired"
}

Response:
{
  "success": true,
  "certificateId": "cert-uuid",
  "status": "revoked",
  "blockchainTx": "0x...",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

**Revocation Flow**:
```
1. Validate certificate exists
2. Mark certificate as revoked in database
3. Find associated batch/document
4. If on blockchain:
   ├─ Prepare revocation transaction
   ├─ Submit to smart contract
   └─ Wait for confirmation
5. Return revocation confirmation
6. Broadcast revocation event
```

## Service Layer Details

### Crypto Service (`services/crypto.ts`)

**Key Functions**:

#### Hash Generation
```typescript
computeHash(input: string): string {
  // Use Keccak256 (same as Ethereum)
  // Input: normalized certificate data
  // Output: 66-character hex string (0x + 64 hex chars)
  // Used for: document fingerprinting, merkle tree
  
  Algorithm:
  1. Normalize input (trim, lowercase)
  2. Serialize to canonical format
  3. Compute Keccak256
  4. Return 0x-prefixed hex
}
```

#### Certificate Data Normalization
```typescript
buildCanonicalCertificateData(data: object): CertificateData {
  // Create canonical form for hashing
  // Ensures same certificate always produces same hash
  // Field order: name, course, issuer, date, certificateId
  // Field processing:
  //   - Strings: lowercase, trim whitespace
  //   - Dates: normalize to ISO 8601
  //   - Numbers: convert to string
  // Returns: ordered object ready for hashing
}
```

#### Digital Signature Operations
```typescript
generateSignature(data: string): string {
  // Generate RSA signature of data
  // Uses private key from environment
  // Returns: base64-encoded signature
  // Used for: batch signing, authenticity proof
}

verifySignature(data: string, signature: string): boolean {
  // Verify signature against data
  // Uses issuer's public key
  // Returns: true if valid, false otherwise
  // Used for: verification of signed batches
}
```

#### QR Operations
```typescript
generateQRCode(data: string): Promise<string> {
  // Generate QR code image
  // Input: verification URL containing certificateId
  // Output: data URL (base64 PNG)
  // Size: 220x220 pixels
  // Error correction: Medium (L=7%, M=15%, Q=25%, H=30%)
  // Timeout: 8 seconds max
  
  Generated QR Value:
  https://localhost:5173/verify/{certificateId}
}

decodeQRCode(imageBuffer: Buffer): string {
  // Extract data from QR image
  // Supports: PNG, JPEG
  // Uses jsQR library for decoding
  // Returns: original data string (URL or JSON)
  // Throws: BadRequestError if QR not found
}
```

### Merkle Service (`services/merkle.ts`)

**Merkle Tree Structure**:
```
               Root
              /    \
           H(1,2)  H(3,4)
           /  \     /  \
          H1  H2   H3   H4
          |   |    |    |
         D1  D2   D3   D4

Where:
- D1-D4: Data (document hashes)
- H1-H4: Leaf level hashes
- H(1,2): Hash of H1 + H2
- H(3,4): Hash of H3 + H4
- Root: Hash of H(1,2) + H(3,4)
```

**Key Functions**:

#### Build Merkle Tree
```typescript
buildMerkleTree(hashes: string[]): MerkleTree {
  // Create tree from array of document hashes
  // Algorithm:
  //   1. Pad array to power of 2 (duplicate last if odd)
  //   2. Create leaf nodes (depth 0)
  //   3. Iteratively hash pairs → parent level
  //   4. Continue until single root
  // Returns: complete tree structure with all nodes
  // Time complexity: O(n log n)
  // Space complexity: O(n)
}
```

#### Generate Merkle Proof
```typescript
generateProof(tree: MerkleTree, leafIndex: number): string[] {
  // Generate proof that leaf exists in tree
  // Returns: array of intermediate hashes needed to reconstruct root
  // Proof size: ~256 bytes per certificate (32 bytes × log2(batch_size))
  // Used by: verifier to prove document is in batch
  
  Example for leaf index 0:
  Proof = [H2, H(3,4)]
  Reconstruction: Hash(H(Hash(H1, H2), H(3,4)))
}
```

#### Verify Merkle Proof
```typescript
verifyProof(leaf: string, proof: string[], root: string): boolean {
  // Verify that leaf + proof produces root
  // Algorithm:
  //   1. Start with leaf hash
  //   2. For each proof element:
  //      - Hash current with proof element (order matters)
  //      - Result becomes current
  //   3. Compare final with root
  // Returns: true if proof valid for this tree
  // Time complexity: O(log n)
}
```

### Blockchain Service (`services/blockchain.ts`)

**Web3 Integration**:
```typescript
constructor(rpcUrl: string, contractAddress: string, contractABI: ABI) {
  // Initialize Web3 connection
  // rpcUrl: "http://localhost:8545" or Alchemy/Infura endpoint
  // Use HTTP provider with timeout: 30 seconds
  // Connection pooling: reuse single Web3 instance
}
```

**Key Functions**:

#### Submit Hash to Blockchain
```typescript
submitHash(documentHash: string): Promise<TransactionReceipt> {
  // Stage 1: Direct hash submission (modern certificates)
  // Process:
  //   1. Prepare transaction
  //      - to: contract address
  //      - data: encodeFunction('submitHash', [hash])
  //      - gas: estimate based on batch
  //   2. Send transaction
  //   3. Wait for confirmation (1-50 blocks depending on gas)
  //   4. Log transaction hash
  // Returns: transaction receipt {hash, blockNumber, gasUsed}
  // Success: hash persisted on blockchain
}
```

#### Submit Merkle Root
```typescript
submitMerkleRoot(batchId: string, merkleRoot: string, signature: string): Promise<TransactionReceipt> {
  // Stage 6: Batch Merkle root submission
  // Parameters:
  //   - batchId: UUID for audit trail
  //   - merkleRoot: computed Merkle tree root
  //   - signature: issuer's signature of root
  // Process:
  //   1. Verify signature validity
  //   2. Encode contract call
  //   3. Execute submitMerkleRoot(merkleRoot, batchId)
  //   4. Wait for confirmation
  // Returns: receipt proving batch on-chain
  // Benefit: ~250 hashes in single transaction (gas efficient)
}
```

#### Verify Document
```typescript
verifyDocument(documentHash: string): Promise<VerificationResult> {
  // Query blockchain for direct hash existence
  // Process:
  //   1. Call contract: isHashOnChain(documentHash)
  //   2. If exists:
  //      - Return {exists: true, timestamp, issuer}
  //   3. If not exists:
  //      - Return {exists: false}
  // Uses: call (no gas cost, read-only)
  // Timeout: 3 seconds with fallback
}
```

#### Check Revocation Status
```typescript
isHashRevoked(documentHash: string): Promise<boolean> {
  // Query revocation registry on blockchain
  // Returns: true if hash marked revoked, false otherwise
  // Used by: verification flow to mark revoked certificates
  // Fallback logic: if blockchain unreachable, check local DB
}
```

#### Get Current Gas Price
```typescript
getGasPrice(): Promise<string> {
  // Fetch current network gas price
  // Units: wei (1 gwei = 10^9 wei)
  // Used for: transaction cost estimation, user visibility
  // Updated: every time external call made
}
```

## Middleware

### Authentication (`auth.ts`)
```typescript
// Purpose: Validate JWT token on protected routes
// Location: All routes except /auth/*, /verify/*, /status

Process:
1. Extract Authorization header
2. Remove "Bearer " prefix
3. Verify signature (RS256)
4. Check expiration
5. Extract claims (userId, role)
6. Attach to request.user
7. Proceed to next handler

Throws:
- 401: Missing token
- 401: Invalid signature
- 401: Expired token
```

### Validation (`validation.ts`)
```typescript
// Purpose: Validate request bodies against Zod schemas

Schemas defined for:
- RegisterBody (email, password)
- LoginBody (email, password)
- UploadBody (batchName, issuerId, issuerName, groupingCriterion)
- VerifyBody (verifierId)
- RevokeBody (reason)

Process:
1. Receive request body
2. Parse against schema
3. If invalid: return 400 with error details
4. If valid: attach to request.body
5. Proceed to handler
```

### Error Handler (`error-handler.ts`)
```typescript
// Purpose: Catch all errors and format consistently

Error classes:
- AppError(message, statusCode, type)
- BadRequestError(message) - 400
- UnauthorizedError(message) - 401
- ForbiddenError(message) - 403
- NotFoundError(message) - 404
- ConflictError(message) - 409
- ServerError(message) - 500

Process:
1. Middleware catches error
2. Check if custom AppError
3. If custom: extract statusCode, message, type
4. If generic: convert to ServerError (500)
5. Format JSON response
6. Log error (file + console)
7. Send to client
```

### Rate Limiting (`rate-limit.ts`)
```typescript
// Purpose: Prevent abuse and DDoS

Configuration:
- Per IP address
- Window: 15 minutes
- Limit: 100 requests per window

Protected routes:
- /api/auth/* (login, register)
- /api/issuer/upload
- /api/verifier/verify

Process:
1. Extract client IP
2. Check request count in window
3. If under limit: increment counter, continue
4. If over limit: return 429 Too Many Requests
5. Include Retry-After header
```

## Data Storage with Drizzle ORM

### Connection Configuration
```typescript
// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 50, // Maximum concurrent connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const db = drizzle(pool);
```

### Example Query Patterns
```typescript
// Select
const user = await db.select().from(users)
  .where(eq(users.email, 'user@example.com'));

// Insert
const [newUser] = await db.insert(users)
  .values({email, passwordHash, name})
  .returning();

// Update
const [updated] = await db.update(documents)
  .set({revoked: true, revokedAt: new Date()})
  .where(eq(documents.id, docId))
  .returning();

// Delete (with cascade)
await db.transaction(async (tx) => {
  // Delete dependents first
  await tx.delete(verifications).where(...);
  // Then parent
  await tx.delete(documents).where(...);
});

// Complex query
const batches = await db.select({
  id: documentBatches.id,
  name: documentBatches.batchName,
  docCount: sql`count(*)`,
}).from(documentBatches)
  .leftJoin(documents, eq(...))
  .where(eq(documentBatches.issuerId, issuerId))
  .groupBy(documentBatches.id)
  .orderBy(desc(documentBatches.createdAt))
  .limit(20)
  .offset(0);
```

## Error Recovery Strategies

### Blockchain Unavailability
```
Scenario: RPC endpoint offline

1. Timeout set to 3 seconds
2. If failure: catch error
3. Check blockchain status endpoint
4. If confirmed unavailable:
   ├─ Return partial success (stored in DB)
   ├─ Mark certificate as "pending_blockchain"
   ├─ Queue for retry (exponential backoff)
   └─ Notify issuer of pending status
5. Frontend polls blockchain/status endpoint
6. Once available: automatically submit queued items
```

### Database Connection Failures
```
Scenario: PostgreSQL connection lost

1. Connection pool handles reconnection
2. Retry logic: exponential backoff (1s, 2s, 4s...)
3. Fail after 5 retries (~30 seconds)
4. Return 503 Service Unavailable
5. Suggest user retry operation
6. Log incident for monitoring
```

### Hash Collision Handling
```
Scenario: Two certificates produce same hash (theoretically impossible with Keccak256, but protocol for completeness)

1. Check for hash uniqueness before insert
2. If collision detected:
   ├─ Log security incident
   ├─ Alert administrators
   ├─ Reject operation
   └─ Investigate root cause
3. Mitigated by: cryptographic strength of Keccak256
```

## Performance Optimization

### Query Optimization
```
Frequently slow queries:

1. Get batches with statistics → Use database views or cached aggregates
2. Merkle tree construction → O(n) optimized with indexed lookups
3. Blockchain verification → Cached recent results (5-minute TTL)

Implemented:
- Database indexes on certificateId, documentHash, batchId
- Query result caching for blockchain checks
- Batch operations to minimize round-trips
```

### Scaling Considerations
```
Current single server can handle:
- 1000+ requests/second API
- 10,000+ documents per batch
- 50 concurrent users

Bottlenecks to address:
1. Blockchain throughput (15 TPS Ethereum) → Layer 2
2. CSV parsing for 50+ MB files → Streaming parser
3. Merkle tree for 100k+ documents → Sparse tree implementation
```
