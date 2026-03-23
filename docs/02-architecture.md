# 02 - System Architecture

## Architecture Overview

DocuTrustChain follows a **three-tier classical architecture** with blockchain as a fourth trust layer:

```
┌──────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                      │
│  ┌─────────────────────────┐  ┌──────────────────────────┐  │
│  │   Web Frontend (React)  │  │   Mobile Responsive UI   │  │
│  │   - Issuer Dashboard    │  │   - QR Scanner View      │  │
│  │   - Verifier Interface  │  │   - Results Display      │  │
│  │   - Certificate Create  │  │   - History Timeline     │  │
│  └──────────┬──────────────┘  └──────────┬───────────────┘  │
│             │ HTTP/JSON                  │ HTTP/JSON         │
└─────────────┼──────────────────────────────┼─────────────────┘
              │                              │
┌─────────────┼──────────────────────────────┼─────────────────┐
│             │  APPLICATION / API LAYER    │                 │
│  ┌──────────▼──────────────────────────────▼────────────┐   │
│  │         Express.js REST API Server                   │   │
│  │  ┌───────────────┐  ┌────────────────┐             │   │
│  │  │  Controllers  │  │   Middleware   │             │   │
│  │  │  - Auth       │  │  - Auth Guard  │             │   │
│  │  │  - Issue      │  │  - Validation  │             │   │
│  │  │  - Verify     │  │  - Error Hdl   │             │   │
│  │  │  - Revoke     │  │  - Rate Limit  │             │   │
│  │  │  - Dashboard  │  │  - CORS        │             │   │
│  │  └────────┬──────┘  └────────────────┘             │   │
│  │           │                                         │   │
│  │  ┌────────▼──────────────────────────────────────┐ │   │
│  │  │         Service Layer                        │ │   │
│  │  │  ┌──────────────┐  ┌──────────────────────┐ │ │   │
│  │  │  │ Crypto Srv   │  │  Blockchain Service  │ │ │   │
│  │  │  │ - Hash       │  │  - Verify Doc        │ │ │   │
│  │  │  │ - Sign       │  │  - Check Revoked     │ │ │   │
│  │  │  │ - Verify Sig │  │  - Submit Root       │ │ │   │
│  │  │  │ - QR Gen     │  │  - Get Status        │ │ │   │
│  │  │  └──────────────┘  └──────────────────────┘ │ │   │
│  │  │  ┌──────────────┐  ┌──────────────────────┐ │ │   │
│  │  │  │ Merkle Srv   │  │  Issuer Service      │ │ │   │
│  │  │  │ - Tree Build │  │  - Normalize Data    │ │ │   │
│  │  │  │ - Proof Gen  │  │  - Process CSV       │ │ │   │
│  │  │  │ - Verify Prf │  │  - Create Batches    │ │ │   │
│  │  │  └──────────────┘  └──────────────────────┘ │ │   │
│  │  └────────┬──────────────────────────────────────┘ │   │
│  │           │                                        │   │
│  └───────────┼────────────────────────────────────────┘   │
│              │                                            │
└──────────────┼────────────────────────────────────────────┘
               │
┌──────────────┼────────────────────────────────────────────┐
│              │        DATA ACCESS LAYER                  │
│  ┌───────────▼─────────────────────────────────────────┐ │
│  │      Drizzle ORM + PostgreSQL                       │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │           Data Repositories                  │  │ │
│  │  │  - Users & Auth                              │  │ │
│  │  │  - Documents & Batches                       │  │ │
│  │  │  - Certificates                              │  │ │
│  │  │  - Verifications                             │  │ │
│  │  │  - Blockchain Status                         │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────┘ │
│              │                                            │
│  ┌───────────▼─────────────────────────────────────────┐ │
│  │       PostgreSQL Database                          │ │
│  │  - Connection Pool: 10-50 connections              │ │
│  │  - Automatic schema migration via Drizzle          │ │
│  │  - JSONB support for flexible document storage     │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
               │
┌──────────────┼────────────────────────────────────────────┐
│              │      BLOCKCHAIN / TRUST LAYER             │
│  ┌───────────▼─────────────────────────────────────────┐ │
│  │         Ethereum Smart Contract Layer              │ │
│  │  ┌──────────────────────────────────────────────┐  │ │
│  │  │     DocuTrust.sol Smart Contract             │  │ │
│  │  │  - hashRegistry (direct hash storage)        │  │ │
│  │  │  - merkleRoots (batch root storage)          │  │ │
│  │  │  - revocations (revoked hash tracking)       │  │ │
│  │  │  - submitHash()                              │  │ │
│  │  │  - submitMerkleRoot()                        │  │ │
│  │  │  - revokeHash()                              │  │ │
│  │  │  - verify()                                  │  │ │
│  │  │  - isRevoked()                               │  │ │
│  │  └──────────────────────────────────────────────┘  │ │
│  └───────────┬──────────────────────────────────────────┘ │
│              │                                            │
│  ┌───────────▼─────────────────────────────────────────┐ │
│  │     Ethereum Network (Sepolia Testnet/Mainnet)     │ │
│  │  - RPC Endpoint: http://localhost:8545             │ │
│  │  - Chain ID: 11155111 (Sepolia) or 1 (mainnet)     │ │
│  │  - Transactions: ~12-15 seconds per block           │ │
│  │  - Gas costs: varies by network                     │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Detailed Layer Responsibilities

### Presentation Layer (Frontend)

**Technology**: React 18 + TypeScript + React Router + TanStack Query

**Responsibilities**:
- User interface rendering
- Form validation and submission
- State management via context and query state
- Route navigation and deep linking
- File upload handling (CSV, images)
- QR code generation and scanning
- Real-time status updates via polling

**Key Components**:
```
Pages:
  ├── Landing          (unauthenticated entry point)
  ├── Login/Register   (authentication)
  ├── Dashboard        (authenticated user hub)
  ├── Certificate      (creation, signing, preview, issuance)
  │   ├── Create       (step-by-step form)
  │   ├── Sign         (digital signature interface)
  │   └── Preview      (QR display, final review)
  ├── Verify           (QR scanning, verification)
  ├── Results          (verification report)
  └── NotFound         (404 fallback)

Components:
  ├── FileUpload       (CSV and image upload)
  ├── QRCode Gen/Scan  (QR handling)
  ├── Navbar           (navigation UI)
  ├── StatusIndicator  (progress tracking)
  └── DataDisplay      (tables, timelines)

Context:
  ├── AuthContext      (user session, JWT)
  └── CertificateDraft (multi-step form state)
```

**Data Flow in Presentation**:
1. User input → React state/context
2. Form validation → error display
3. API call → TanStack Query mutation
4. Server response → state update
5. UI re-render with new data

### Application / API Layer

**Technology**: Express.js + TypeScript + Middleware chain

**Responsibility**: 
- HTTP request routing
- Business logic orchestration
- Service composition
- Error handling and response formatting
- Authentication and authorization
- Input validation

**Request Lifecycle**:
```
1. HTTP Request arrives
   │
2. CORS Middleware    (allow cross-origin)
   │
3. Body Parser        (parse JSON/form)
   │
4. Auth Middleware    (extract & validate JWT)
   │
5. Validation Mid     (check request schema)
   │
6. Rate Limit Mid     (throttle requests)
   │
7. Route Handler (Controller)
   │
   ├─> Call Services
   │   ├─> Database queries
   │   ├─> Crypto operations
   │   ├─> Blockchain calls
   │   └─> Service composition
   │
   └─> Build Response
       ├─> Data transformation
       ├─> Status code assignment
       └─> Error handling
   │
8. Error Middleware   (if any errors)
   │
9. HTTP Response      (JSON payload)
```

**Controllers** (route handlers):
- `auth.controller.ts` - login, register, logout
- `issuer.controller.ts` - upload, batch management, statistics
- `blockchain.controller.ts` - status, contract info
- `verifier.controller.ts` - verify endpoint, history, stats
- `revoke.controller.ts` - revocation operations

### Service Layer

**Crypto Service** (`backend/services/crypto.ts`):
- Hash computation (Keccak256)
- Certificate data normalization
- Digital signature generation (RSA)
- Digital signature verification
- QR code generation

**Merkle Service** (`backend/services/merkle.ts`):
- Merkle tree construction
- Merkle proof generation
- Merkle proof verification
- Root hash computation

**Blockchain Service** (`backend/services/blockchain.ts`):
- Smart contract interaction via Web3.js
- Document verification against blockchain
- Merkle root verification
- Hash revocation checking
- Transaction submission
- Gas estimation and error handling

**Issuer Service** (`backend/services/issuer-utils.ts`):
- CSV parsing and validation
- Document field extraction
- Issuer normalization
- Batch initialization

### Data Access Layer (ORM)

**Technology**: Drizzle ORM + PostgreSQL

**Pattern**: Repository pattern with TypeScript-first schema

**Responsibilities**:
- Type-safe database queries
- Connection pooling
- Transaction management
- Cascade deletion handling
- Pagination and sorting

**Database Operations**:
```
Query       → Drizzle → PostgreSQL → Result
Insert      → Drizzle → PostgreSQL → ID
Update      → Drizzle → PostgreSQL → Modified Row
Delete      → Drizzle → PostgreSQL → Success
Batch Ops   → Transaction → PostgreSQL → All or Nothing
```

### Blockchain Layer

**Technology**: Ethereum smart contracts + Web3.js

**Responsibility**: 
- Immutable record storage
- Proof of existence
- Revocation management
- Decentralized verification

**Smart Contract Interface**:
```solidity
contract DocuTrust {
  // Hash verification
  function submitHash(bytes32 hash) → void
  function isHashOnChain(bytes32 hash) → bool
  function isHashRevoked(bytes32 hash) → bool
  
  // Merkle root batching
  function submitMerkleRoot(bytes32 root) → void
  function isMerkleRootOnChain(bytes32 root) → bool
  
  // Revocation
  function revokeHash(bytes32 hash) → void
  function revokeRoot(bytes32 root) → void
  
  // Queries
  function getHashDetails(bytes32 hash) → {exists, revoked, timestamp}
  function getRootDetails(bytes32 root) → {exists, revoked}
}
```

## Component Interaction Patterns

### Certificate Issuance

```
Frontend (User uploads CSV)
    │
    ▼
Backend /api/issuer/upload
    │
    ├─> Validation (file size, format)
    │
    ├─> CSV Parsing → Extract rows
    │
    ├─> For each row:
    │   ├─> Normalize data
    │   ├─> Compute hash
    │   └─> Create document record
    │
    ├─> Build Merkle tree
    │
    ├─> Compute Merkle root
    │
    ├─> Store batch in database
    │
    └─> Return batch ID to frontend

Frontend [NEW STATE]
    ├─> batch.id = UUID
    ├─> batch.status = "processing"
    └─> Navigate to signing interface
```

### Verification Flow

```
Frontend (User scans QR)
    │
    ▼
Extract certificateId from URL in QR
    │
    ▼
Database lookup (document + certificate)
    │
    ├─> NOT FOUND → Return 404
    │
    └─> FOUND → Fetch DB records
        │
        ├─> Reconstruct metadata
        │
        ├─> Compute hash
        │
        └─> Database hash comparison
            │
            ├─> NOT MATCHED → Return FAILED
            │
            └─> MATCHED → Continue
                │
                ├─> Check signature (if signed document exists)
                │
                ├─> Build Merkle proof (if batched)
                │
                ├─> Query blockchain for hash/root
                │
                ├─> Check revocation status on-chain
                │
                └─> Compute confidence score
                    │
                    └─> Return verification result
                        {status: VALID|INVALID|REVOKED|ORPHANED, score: 0-100}
```

## Data Flow Patterns

### Synchronous Request-Response

```
Client → API Request
         ├─ Validation
         ├─ Database query
         ├─ Process logic
         └─ Response payload ← Client
```

**Used for**: Verification, statistics, metadata retrieval

**Characteristics**:
- Immediate feedback
- < 5 second typical latency
- Stateless server
- Client waits for response

### Asynchronous Batch Processing

```
Client → API Request (start batch)
         │
         └─ Return: {batchId, status: "processing"}
         │
         ├─ Backend async job:
         │  ├─ Parse CSV
         │  ├─ Hash each row
         │  ├─ Build Merkle tree
         │  └─ Update DB status
         │
         └─ Client polls for status
            GET /api/batch/{id}/status
            ├─ Response: {status: "processing|complete|failed"}
            └─ Repeat until complete
```

**Used for**: CSV upload, batch signing, blockchain submission

**Characteristics**:
- Long-running operations (seconds to minutes)
- Initial response is immediate
- Status polling for progress
- Database state tracking

## Security Architecture

### Authentication Flow

```
User Login
    │
    ├─ Submit (email, password)
    │
    ├─ Backend validates credentials
    │
    ├─ Generate JWT token
    │  ├─ Payload: {userId, email, role, organization}
    │  ├─ Expiry: 24 hours
    │  └─ Signed with RS256
    │
    ├─ Return token to frontend
    │
    └─ Store in secure storage
```

### Authorization Pattern

```
Every API Request
    │
    ├─ Extract JWT from header
    │
    ├─ Validate signature
    │
    ├─ Check expiry
    │
    ├─ Extract claims (userId, role)
    │
    ├─ Route-specific validation
    │  ├─ Resource ownership check
    │  └─ Role-based access control
    │
    └─ If valid → proceed; else → 401/403
```

### Data Validation Layers

```
API Boundary (Zod schema)
    ↓ Type validation
Business Logic (context checks)
    ↓ Logical constraints
Database Constraints (NOT NULL, UNIQUE, FK)
    ↓ Physical integrity
Blockchain Immutability
    ↓ Permanent record
```

## Scalability Considerations

### Current Architecture Limits

1. **Database**: Single PostgreSQL instance
   - Typical throughput: 1000+ TPS
   - Connection pool: 50 max connections
   - Growth path: Read replicas, connection pooling service

2. **Frontend**: SPA with client-side rendering
   - Browser caching: Service workers
   - Growth path: Edge CDN, static asset caching

3. **Backend**: Single server instance
   - Horizontal scaling: Load balancer + multiple instances
   - Session state: Stateless design enables easy scaling

4. **Blockchain**: Network throughput dependent
   - Typical: 15 TPS (Ethereum)
   - Growth path: Layer 2 solutions (Polygon, Arbitrum)

### Bottlenecks

1. **CSV Upload**: Large files (50+ MB) require chunking
2. **Merkle Tree Construction**: O(n) for n documents
3. **Blockchain Submission**: Limited by network throughput
4. **QR Scanning**: Image processing latency

## Error Handling Architecture

```
Business Logic Throws Error
    │
    ├─ Custom Error Classes (AppError, BadRequestError)
    │  ├─ message: string
    │  ├─ statusCode: number
    │  ├─ errorType: string
    │  └─ details: object
    │
    ├─ Middleware catches error
    │
    ├─ Log error (file + console)
    │
    ├─ Transform to JSON response
    │  {
    │    success: false,
    │    error: {
    │      message: string,
    │      type: string,
    │      statusCode: number
    │    }
    │  }
    │
    └─ Return appropriate HTTP status
       ├─ 400: Validation error
       ├─ 401: Authentication error
       ├─ 403: Authorization error
       ├─ 404: Not found
       ├─ 500: Server error
       └─ 503: Service unavailable (blockchain down)
```

## Network Architecture

```
Internet
    │
    ▼
Load Balancer (if scaled)
    │
    ▼
API Server (Express on Port 5000)
    │
    ├─ Inbound: HTTPS from frontend
    ├─ Outbound: PostgreSQL (port 5432)
    └─ Outbound: RPC endpoint (http/wss)

Database
    │
    └─ Persistent storage

Ethereum Node
    │
    └─ Blockchain RPC
```

## Deployment Topology

```
Development Environment
├─ Frontend: http://localhost:5173 (Vite dev server)
├─ Backend: http://localhost:5000 (Express)
├─ Database: postgresql://localhost:5432
└─ Blockchain: Hardhat local network (port 8545)

Staging/Production
├─ Frontend: CDN + Edge
├─ Backend: Container (Docker) + Kubernetes
├─ Database: Managed PostgreSQL (AWS RDS)
└─ Blockchain: Ethereum Sepolia Testnet (Alchemy RPC)
```
