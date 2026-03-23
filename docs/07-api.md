# 07 - API Reference

## Overview

The DocuTrust API is a RESTful service providing certificate lifecycle management, verification, and blockchain integration. All endpoints require authentication via Bearer token (JWT).

## Base URL

```
Development:  http://localhost:5000/api
Staging:      https://staging.docutrust.dev/api
Production:   https://api.docutrust.app/api
```

## Authentication

All requests require an `Authorization: Bearer <token>` header. Tokens are obtained via login.

### Error Responses

All error responses follow standard format:

```json
{
  "error": "Error code",
  "message": "Human-readable message",
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Authentication Endpoints

### `/auth/login` (POST)

Authenticate user and receive session token.

**Request**:
```json
{
  "email": "issuer@university.edu",
  "password": "secure-password"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "id": "uuid-...",
    "email": "issuer@university.edu",
    "role": "issuer",
    "organization": "University",
    "issuerId": "UNI-001"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 86400
}
```

**Error Cases**:
- `401 Unauthorized`: Invalid email or password
- `403 Forbidden`: Account disabled or deleted
- `429 Too Many Requests`: Rate limited (5 failed attempts)

**Rate Limit**: 10 requests/minute per IP

---

### `/auth/logout` (POST)

Invalidate current session token.

**Request**: Empty body with valid Authorization header

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Issuer Endpoints

### `/issuer/batches` (GET)

Retrieve all certificate batches for authenticated issuer.

**Query Parameters**:
```
page:     integer (default: 1)          - Page number (1-indexed)
pageSize: integer (default: 20, max: 100) - Results per page
status:   string (optional)             - Filter by status: draft|signed|issued|revoked
sortBy:   string (default: created_at)  - Sort field: created_at|status|certificate_count
order:    string (default: desc)        - ASC or DESC
```

**Example Request**:
```
GET /api/issuer/batches?page=1&pageSize=20&status=issued&sortBy=created_at&order=desc
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "batches": [
      {
        "id": "uuid-...",
        "batchId": "BATCH-2024-001",
        "status": "issued",
        "certificateCount": 150,
        "revokedCount": 0,
        "merkleRoot": "0x1a2b3c4d...",
        "blockchainStatus": "confirmed",
        "blockchainTxHash": "0xe5f6g7h8...",
        "blockchainBlockNumber": 18234567,
        "blockchainConfirmedAt": "2024-01-15T09:30:00Z",
        "createdAt": "2024-01-15T08:00:00Z",
        "issuedAt": "2024-01-15T09:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 42,
      "totalPages": 3
    }
  }
}
```

**Status Values**:
- `draft`: Batch created, certificates being added
- `signed`: Merkle root and signatures computed
- `issued`: Submitted to blockchain
- `revoked`: Batch revocation submitted

---

### `/issuer/batches/:batchId/certificates` (GET)

Retrieve all certificates in batch.

**Route Parameters**:
```
batchId: UUID - Batch identifier
```

**Query Parameters**:
```
page: integer (default: 1)
pageSize: integer (default: 50, max: 500)
status: string (optional) - drafted|signed|issued
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "batch": {
      "id": "uuid-...",
      "batchId": "BATCH-2024-001",
      "status": "issued"
    },
    "certificates": [
      {
        "id": "uuid-...",
        "certificateId": "CERT-2024-001",
        "name": "John Doe",
        "course": "Advanced Blockchain",
        "issuer": "University",
        "date": "2024-01-15",
        "status": "issued",
        "blockchainHash": "0x...",
        "blockchainStatus": "confirmed",
        "revoked": false,
        "revokedAt": null,
        "issuedAt": "2024-01-15T09:30:00Z"
      }
    ],
    "pagination": {...}
  }
}
```

---

### `/issuer/batch` (POST)

Create new certificate batch.

**Request**:
```json
{
  "batchName": "Q1 2024 Graduates",
  "issuerName": "University",
  "organizationId": "UNI-001"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "batch": {
      "id": "uuid-...",
      "batchId": "550e8400-e29b-41d4-a716-446655440000",
      "status": "draft",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

---

### `/issuer/batch/:batchId/certificate` (POST)

Add certificate to batch.

**Route Parameters**:
```
batchId: UUID - Target batch
```

**Request**:
```json
{
  "name": "Jane Smith",
  "course": "Advanced Blockchain",
  "issuer": "University",
  "date": "2024-01-15",
  "certificateId": "CERT-2024-001"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "certificate": {
      "id": "uuid-...",
      "certificateId": "CERT-2024-001",
      "name": "Jane Smith",
      "status": "drafted",
      "createdAt": "2024-01-15T10:05:00Z"
    }
  }
}
```

**Error Cases**:
- `400 Bad Request`: Missing required fields
- `404 Not Found`: Batch doesn't exist
- `409 Conflict`: Certificate ID already exists in batch

---

### `/issuer/batch/:batchId/sign` (POST)

Sign batch and compute merkle root.

**Route Parameters**:
```
batchId: UUID - Batch to sign
```

**Request Body**: Empty (uses private key from session)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "batch": {
      "id": "uuid-...",
      "batchId": "BATCH-2024-001",
      "status": "signed",
      "merkleRoot": "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
      "certificateCount": 150
    }
  }
}
```

**Internal Process**:
1. Fetch all drafted certificates in batch
2. Compute Keccak256 hash for each certificate
3. Build merkle tree from hashes
4. Compute root hash
5. Sign root with issuer private key
6. Update batch status to `signed`

---

### `/issuer/batch/:batchId/issue` (POST)

Submit signed batch to blockchain.

**Route Parameters**:
```
batchId: UUID - Signed batch to submit
```

**Request Body**: Empty

**Response** (202 Accepted):
```json
{
  "success": true,
  "data": {
    "batch": {
      "id": "uuid-...",
      "status": "issued",
      "blockchainStatus": "pending",
      "blockchainTxHash": "0xe5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4",
      "message": "Batch submitted to blockchain. Waiting for confirmation..."
    }
  }
}
```

**Blockchain Process**:
1. Prepare transaction: `submitMerkleRoot(merkleRoot, batchId, certificateCount)`
2. Sign with issuer wallet key
3. Broadcast to network (Ethereum/Sepolia/etc)
4. Store transaction hash
5. Poll for confirmation (background job)

**Error Cases**:
- `400 Bad Request`: Batch not in `signed` status
- `402 Payment Required`: Insufficient wallet balance
- `503 Service Unavailable`: Blockchain RPC temporarily unavailable

---

### `/issuer/batch/:batchId/revoke` (POST)

Revoke entire batch (mark hashes revoked on blockchain).

**Route Parameters**:
```
batchId: UUID - Batch to revoke
```

**Request Body**: Empty

**Response** (202 Accepted):
```json
{
  "success": true,
  "data": {
    "batch": {
      "id": "uuid-...",
      "status": "revoked",
      "blockchainStatus": "pending",
      "revokedAt": "2024-01-15T11:00:00Z"
    }
  }
}
```

**Blockchain Process**:
1. Prepare transaction: `revokeMerkleRoot(merkleRoot)`
2. Sign with issuer wallet key
3. Broadcast revocation transaction
4. Update local certificate status to `revoked`

---

### `/issuer/certificate/:certificateId/revoke` (POST)

Revoke individual certificate.

**Route Parameters**:
```
certificateId: UUID - Certificate to revoke
```

**Request Body**: Empty

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "certificate": {
      "id": "uuid-...",
      "certificateId": "CERT-2024-001",
      "revoked": true,
      "revokedAt": "2024-01-15T11:05:00Z"
    }
  }
}
```

---

## Verifier Endpoints

### `/verifier/verify` (POST)

Verify a certificate document.

**Request**:
```json
{
  "file": <multipart file>,
  "certificateMetadata": {
    "name": "John Doe",
    "course": "Advanced Blockchain",
    "issuer": "University",
    "date": "2024-01-15",
    "certificateId": "CERT-001"
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "verification": {
      "id": "uuid-...",
      "status": "verified",
      "fileHash": "0x1a2b3c...",
      "blockchainHash": "0x4d5e6f...",
      "issuedAt": "2024-01-15T09:30:00Z",
      "issuer": "University",
      "blockchainDetails": {
        "exists": true,
        "revoked": false,
        "blockNumber": 18234567,
        "confirmed": true,
        "blocksAgo": 1024
      },
      "document": {
        "id": "uuid-...",
        "certificateId": "CERT-001",
        "name": "John Doe",
        "issuer": "University"
      }
    }
  }
}
```

**Status Values**:
- `verified`: Hash found on blockchain, not revoked
- `not_found`: Hash not on blockchain
- `revoked`: Hash on blockchain but marked revoked
- `error`: Verification failed

**Verification Process**:
1. Compute hash of uploaded file
2. Extract/reconstruct hash from QR metadata
3. Query blockchain for hash existence
4. Check revocation status
5. Match to certificate if possible
6. Return comprehensive result

---

### `/verifier/batch/:batchId/verify` (POST)

Verify certificate batch via merkle proof.

**Route Parameters**:
```
batchId: UUID - Batch to verify (from QR)
```

**Request**:
```json
{
  "certificateHash": "0x...",
  "merkleProof": ["0x...", "0x...", "0x..."],
  "metadata": {
    "name": "Jane Smith",
    "course": "Q1 2024",
    "issuer": "University",
    "date": "2024-01-15",
    "certificateId": "CERT-2024-001"
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "verification": {
      "id": "uuid-...",
      "status": "verified",
      "merkleRoot": "0x1a2b3c...",
      "proofValid": true,
      "blockchainConfirmed": true,
      "batchDetails": {
        "batchId": "BATCH-2024-001",
        "certificateCount": 150,
        "issuedAt": "2024-01-15T09:00:00Z",
        "issuer": "University"
      }
    }
  }
}
```

**Merkle Proof Verification**:
1. Start with provided certificateHash
2. For each element in merkleProof:
   - Hash(current, proof_element)
   - Compare with expected merkleRoot
3. If matches, proof is valid
4. Query blockchain to confirm merkleRoot exists

---

### `/verifier/history` (GET)

Get verification history for authenticated verifier.

**Query Parameters**:
```
page:     integer (default: 1)
pageSize: integer (default: 10, max: 100)
status:   string (optional) - verified|not_found|revoked|error
fromDate: string (optional) - ISO 8601 date
toDate:   string (optional) - ISO 8601 date
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "verifications": [
      {
        "id": "uuid-...",
        "status": "verified",
        "fileHash": "0x1a2b3c...",
        "blockchainHash": "0x4d5e6f...",
        "createdAt": "2024-01-15T11:30:00Z",
        "document": {
          "name": "John Doe",
          "certificateId": "CERT-2024-001",
          "issuer": "University"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 47,
      "totalPages": 5
    }
  }
}
```

---

### `/verifier/stats` (GET)

Get verification statistics for authenticated verifier.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalVerifications": 127,
      "verifiedCount": 118,
      "notFoundCount": 5,
      "revokedCount": 2,
      "errorCount": 2,
      "verificationRate": 92.9,
      "thisMonth": {
        "total": 38,
        "verified": 35,
        "notFound": 2,
        "revoked": 1
      },
      "topIssuers": [
        {
          "issuer": "University",
          "count": 42,
          "verifiedCount": 40
        }
      ]
    }
  }
}
```

---

## Error Codes & Http Status

| Status | Code | Meaning |
|--------|------|---------|
| **200** | OK | Request succeeded |
| **201** | Created | Resource created successfully |
| **202** | Accepted | Async operation queued |
| **400** | Bad Request | Invalid parameters |
| **401** | Unauthorized | Invalid/missing token |
| **403** | Forbidden | Insufficient permissions |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | Resource already exists |
| **429** | Too Many Requests | Rate limited |
| **500** | Internal Error | Server error |
| **503** | Unavailable | Service temporarily down |

---

## Rate Limiting

Rate limits are enforced per user/IP:

| Endpoint | Limit |
|----------|-------|
| `/auth/login` | 10 req/min per IP |
| `/issuer/*` | 100 req/min per user |
| `/verifier/*` | 30 req/min per user |
| Blockchain endpoints | 5 req/min per user |

**Response Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1705319400
```

When limit exceeded: `429 Too Many Requests`

---

## Request/Response Patterns

### Pagination

All list endpoints support cursor-based pagination:

```
GET /api/issuer/batches?page=2&pageSize=20
```

Response:
```json
{
  "data": {...},
  "pagination": {
    "page": 2,
    "pageSize": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

### Sorting

Sortable fields vary by endpoint:

```
GET /api/issuer/batches?sortBy=created_at&order=desc
```

Valid `order` values: `asc`, `desc`

### Filtering

Filters available on most list endpoints:

```
GET /api/issuer/batches?status=issued&blockchainStatus=confirmed
```

### Async Operations

Long-running operations return `202 Accepted` with status tracking:

```json
{
  "success": true,
  "data": {
    "batch": {...},
    "blockchainStatus": "pending",
    "message": "Processing..."
  }
}
```

Poll `/issuer/batches/:batchId` to check status.

---

## Security Headers

All responses include:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'
```

---

## Version Management

Current API version: **v1.0**

Future versions will be accessible via `/api/v2/...`, maintaining backward compatibility.

To request specific version:
```
Accept: application/json; version=1.0
```
