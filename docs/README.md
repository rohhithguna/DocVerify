# DocuTrust Documentation

Complete production-grade documentation for the DocuTrust blockchain certificate system.

## Overview

DocuTrust is a decentralized certificate issuance and verification platform built on Ethereum blockchain. It enables organizations to issue tamper-proof certificates and allows anyone to verify their authenticity in seconds.

**Key Documentation Files**:

1. **[01-overview.md](01-overview.md)** - System overview, problem statement, key features
2. **[02-architecture.md](02-architecture.md)** - Three-tier architecture and request lifecycle
3. **[03-backend.md](03-backend.md)** - Backend structure, services, and business logic
4. **[04-frontend.md](04-frontend.md)** - Frontend pages, components, and state management
5. **[05-blockchain.md](05-blockchain.md)** - Smart contract, merkle trees, and verification logic
6. **[06-database.md](06-database.md)** - PostgreSQL schema, relationships, and queries
7. **[07-api.md](07-api.md)** - Complete API reference with all endpoints
8. **[08-verification-flow.md](08-verification-flow.md)** - Step-by-step verification process
9. **[09-certificate-system.md](09-certificate-system.md)** - Certificate lifecycle and operations
10. **[10-error-handling.md](10-error-handling.md)** - Error types, responses, and recovery
11. **[11-known-limitations.md](11-known-limitations.md)** - Current constraints and workarounds
12. **[12-future-improvements.md](12-future-improvements.md)** - Roadmap and enhancement opportunities

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Git
- Ethereum wallet with testnet funds (for blockchain testing)

### Environment Setup

1. **Clone repository**:
```bash
git clone https://github.com/your-org/docutrust.git
cd docutrust
```

2. **Install dependencies**:
```bash
npm install
cd contracts && npm install && cd ..
```

3. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

Key environment variables:
```
DATABASE_URL=postgresql://user:password@localhost/docutrust
BLOCKCHAIN_RPC_URL=http://localhost:8545  # or Sepolia URL
PRIVATE_KEY=0x...                         # Issuer wallet key
JWT_SECRET=your-secret-key
```

4. **Start development server**:
```bash
npm run dev
```

This starts:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- Database client: PostgreSQL on 5432

### Running Tests

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Database Setup

```bash
# Create database
createdb docutrust

# Run migrations
npm run db:migrate

# Seed test data
npm run db:seed
```

### Smart Contract Deployment

```bash
# Compile contracts
cd contracts
npx hardhat compile

# Deploy to local network
npx hardhat run scripts/deploy.js --network localhost

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia

# Copy contract address to .env
CONTRACT_ADDRESS=0x...
```

---

## Architecture at a Glance

### Three-Tier Architecture

```
┌─────────────────────────────────────────┐
│  Frontend (React + TypeScript)          │
│  - Certificate creation & signing UI    │
│  - Verification interface               │
│  - Issuer/verifier dashboards          │
└──────────────┬──────────────────────────┘
               │ HTTP/JSON
               ▼
┌─────────────────────────────────────────┐
│  Backend API (Express + TypeScript)     │
│  - Authentication & authorization       │
│  - Certificate management               │
│  - Blockchain interaction               │
│  - Database operations                  │
└──────────────┬──────────────────────────┘
               │
     ┌─────────┴──────────┐
     ▼                    ▼
┌────────────────┐  ┌──────────────────┐
│ PostgreSQL DB  │  │ Ethereum Network │
│ - Metadata     │  │ - Hash registry  │
│ - History      │  │ - Merkle roots   │
│ - Audit logs   │  │ - Revocations    │
└────────────────┘  └──────────────────┘
```

### Data Flow - Certificate Issuance

```
1. Issuer creates batch
   ├─ Backend: INSERT certificate_batches (status='draft')
   └─ Frontend: Show batch management UI

2. Issuer adds certificates
   ├─ Frontend: Form for name, course, issuer, date
   ├─ Backend: Validate & INSERT certificate_documents
   └─ Frontend: Add to batch list

3. Issuer signs batch
   ├─ Backend: Compute hashes for all certificates
   ├─ Backend: Build merkle tree
   ├─ Backend: Sign root with private key
   └─ Backend: UPDATE batch (merkleRoot, rootSignature)

4. Issuer issues to blockchain
   ├─ Backend: Prepare transaction (submitMerkleRoot)
   ├─ Backend: Broadcast to blockchain
   ├─ Backend: UPDATE batch (blockchainTxHash, status='issued')
   └─ Frontend: Show "pending confirmation"

5. Blockchain mines transaction
   ├─ Blockchain: Execute submitMerkleRoot
   ├─ Blockchain: Store root + emit event
   └─ Backend: Poll for confirmation

6. Backend confirms
   ├─ Backend: Get transaction receipt
   ├─ Backend: UPDATE batch (blockchainStatus='confirmed')
   └─ Frontend: Show "issued"
```

### Data Flow - Verification

```
1. Verifier uploads file or scans QR
   ├─ Extract metadata (name, course, issuer, date)
   ├─ Compute file hash (Keccak256)
   └─ Construct certificate hash

2. Backend verifies with blockchain
   ├─ Stage 1: Query direct hash existence
   ├─ Stage 6: Verify merkle proof against root
   └─ Return {exists, revoked, timestamp, ...}

3. Backend saves verification record
   ├─ INSERT verifications (status, blockchainHash, etc)
   ├─ Try to match to existing certificate
   └─ Return results to frontend

4. Frontend displays results
   ├─ Show status: verified/revoked/not_found/error
   ├─ Show certificate details if matched
   └─ Offer next actions
```

---

## Core Concepts

### Merkle Tree for Batch Efficiency

**Problem**: Submitting hashes individually costs \$0.30 each (\$300 for 1000 certs)

**Solution**: Group hashes into a merkle tree, submit only the root (~\$0.0003 per cert)

```
Certificates:
  [hash1, hash2, hash3, hash4]
       ↓
Build merkle tree:
       root
      /    \
    h12    h34
   / \    / \
  h1 h2  h3 h4
       ↓
Submit only root to blockchain
       ↓
Verifier provides proof path [h2, h34]
       ↓
Blockchain reconstructs: hash(hash(h1, h2), h34) == root ✓
```

### Two-Stage Verification

**Stage 1 (Direct Hash)**:
- For certificates issued individually
- Query blockchain: is this hash registered?
- One blockchain call per certificate

**Stage 6 (Merkle Proof)**:
- For certificates in batches
- Provide merkle proof: prove this hash is in the root
- One blockchain call per root (shared across many certs)

Both stages verified on-chain by the smart contract.

### State Transitions

```
Certificate states:
drafted → signed → issued → (verified)
                   ↓
                revoked

Batch states:
draft → signed → issued → (confirmed) → (revoked)
         ↓
     error
```

---

## Key Workflows

### Issuer Workflow

1. **Create Batch**
   - Endpoint: `POST /api/issuer/batch`
   - Creates batch in `draft` status
   - URL: Open issuer dashboard

2. **Add Certificates**
   - Endpoint: `POST /api/issuer/batch/:batchId/certificate`
   - One request per certificate
   - Can add/remove/edit in draft status

3. **Review & Sign**
   - Endpoint: `POST /api/issuer/batch/:batchId/sign`
   - Computes merkle root
   - Signs with private key
   - Moves to `signed` status

4. **Issue to Blockchain**
   - Endpoint: `POST /api/issuer/batch/:batchId/issue`
   - Submits merkle root to blockchain
   - Moves to `issued` status
   - Polling begins for confirmation

5. **Manage After Issuance**
   - View batch details
   - View individual certificates
   - Revoke batch or individual certificates
   - Monitor blockchain confirmation

### Verifier Workflow

1. **Prepare for Verification**
   - Option A: Scan QR code on certificate
   - Option B: Upload certificate file
   - Or manually enter metadata

2. **Submit Verification Request**
   - Endpoint: `POST /api/verifier/verify`
   - Includes metadata + optional QR data
   - Backend computes hash
   - Backend queries blockchain

3. **Receive Results**
   - Response includes: {status, details, matched_document}
   - Status: verified | revoked | not_found | error
   - Details: blockchain confirmation, block number, timestamp

4. **View History**
   - Endpoint: `GET /api/verifier/history`
   - Paginated list of past verifications
   - Filter by status, date range
   - Export results (CSV/JSON)

---

## API Quick Reference

### Authentication

All endpoints require Bearer token:
```bash
curl -H "Authorization: Bearer TOKEN" https://api.docutrust.app/...
```

Get token via login:
```bash
curl -X POST https://api.docutrust.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'
```

### Common Endpoints

**Issuers**:
- `GET /api/issuer/batches` - List batches
- `POST /api/issuer/batch` - Create batch
- `POST /api/issuer/batch/:batchId/certificate` - Add certificate
- `POST /api/issuer/batch/:batchId/sign` - Sign batch
- `POST /api/issuer/batch/:batchId/issue` - Submit to blockchain

**Verifiers**:
- `POST /api/verifier/verify` - Verify certificate
- `GET /api/verifier/history` - Verification history
- `GET /api/verifier/stats` - Verification statistics

**Public**:
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

See [07-api.md](07-api.md) for complete reference.

---

## Common Tasks

### How to Deploy to Production

1. **Prepare environment**:
```bash
# Set production env vars
export DATABASE_URL=postgresql://prod-db-host/docutrust
export BLOCKCHAIN_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
export PRIVATE_KEY=0x... # Mainnet issuer key
```

2. **Build & test**:
```bash
npm run build
npm run test:e2e
```

3. **Deploy**:
```bash
# Deploy to your hosting (Heroku, AWS, GCP, etc)
npm run deploy
```

4. **Verify**:
```bash
curl https://api.docutrust.app/health
```

### How to Add a New Certificate Field

1. **Extend `documentContent` schema**:
```typescript
// backend/services/crypto.ts
interface CertificateData {
  name: string;
  course: string;
  issuer: string;
  date: string;
  certificateId: string;
  gpa?: string;           // NEW
  honors?: string;        // NEW
}
```

2. **Update creation endpoint**:
```typescript
// backend/controllers/issuer.controller.ts
const cert = await createCertificate({
  ...data,
  documentContent: {
    ...data,
    gpa: data.gpa,
    honors: data.honors
  }
});
```

3. **Update frontend form**:
```typescript
// frontend/src/components/certificate-form.tsx
<Input 
  label="GPA"
  value={formData.gpa}
  onChange={(e) => setFormData({...formData, gpa: e.target.value})}
/>

<Input 
  label="Honors"
  value={formData.honors}
  onChange={(e) => setFormData({...formData, honors: e.target.value})}
/>
```

4. **Test**:
```bash
npm run test
```

### How to Change Blockchain Network

1. **Update `.env`**:
```bash
# From Sepolia
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
CONTRACT_ADDRESS=0xSepolia...

# To Ethereum Mainnet
BLOCKCHAIN_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
CONTRACT_ADDRESS=0xMainnet...
```

2. **Redeploy contract (if needed)**:
```bash
cd contracts
npx hardhat run scripts/deploy.js --network mainnet
```

3. **Update configuration**:
```typescript
// backend/services/blockchain.ts
const config = {
  network: 'mainnet',
  rpc: process.env.BLOCKCHAIN_RPC_URL,
  contractAddress: process.env.CONTRACT_ADDRESS
};
```

4. **Restart backend**:
```bash
npm run dev
```

### How to Debug Verification Issues

1. **Check frontend logs** (browser console):
   - `Verification request sent` → metadata captured
   - `Blockchain response received` → blockchain replied
   - Check response status

2. **Check backend logs**:
```bash
# Watch backend logs in real-time
tail -f logs/combined.log | grep "verification"

# Check for errors
tail -f logs/error.log
```

3. **Query blockchain directly**:
```bash
# Check if hash exists on blockchain
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[...]}'
```

4. **Check database**:
```bash
# Verify transaction hash
SELECT * FROM certificate_batches WHERE blockchain_tx_hash = '0x...';

# Check verification record
SELECT * FROM verifications ORDER BY created_at DESC LIMIT 5;
```

---

## Monitoring & Observability

### Health Check

```bash
curl https://api.docutrust.app/health
```

Returns:
```json
{
  "status": "healthy",
  "database": "up",
  "blockchain": "up",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Key Metrics

**Backend**:
- API response time (p50, p95, p99)
- Error rate (by endpoint)
- Database query time
- Blockchain call time
- Cache hit rate

**Blockchain**:
- Block confirmation time
- Gas price trend
- Transaction success rate
- Verification latency

**Database**:
- Connection pool utilization
- Query count (by query type)
- Disk usage
- Backup success

### Alerting

Critical alerts:
- Database connection pool > 80%
- Blockchain RPC timeout
- API error rate > 1%
- Certificate signing failure
- Batch confirmation timeout

---

## Troubleshooting

### Common Issues

**Q: "Database connection error"**
- Check PostgreSQL is running: `psql docutrust`
- Check `DATABASE_URL` in `.env`
- Check network connectivity to database

**Q: "Blockchain service unavailable"**
- Check `BLOCKCHAIN_RPC_URL` is reachable
- Check wallet has balance (for gas)
- Check network selection (Sepolia vs Mainnet)

**Q: "Verification returns 'not_found'"**
- Check hash computation: canonical string format
- Verify batch was submitted to blockchain
- Check blockchain confirmation status (pending vs confirmed)
- Try blockchain explorer directly

**Q: "Rate limit exceeded"**
- Wait 1 minute before retrying
- Check API usage patterns
- Consider batch verification API for multiple certs

### Debug Mode

Enable verbose logging:

```bash
# Backend
export LOG_LEVEL=debug
npm run dev

# Frontend
localStorage.setItem('debug', 'docutrust:*')
# Then refresh page
```

---

## Support & Contact

- **Issues**: GitHub Issues on repository
- **Email**: support@docutrust.app
- **Documentation**: https://docs.docutrust.app
- **Status Page**: https://status.docutrust.app

---

## License

This project is licensed under the MIT License - see LICENSE file for details.

---

## Security Considerations

### For Production Deployment

1. **Environment Variables**:
   - Never commit `.env` to git
   - Use secrets manager (AWS Secrets Manager, HashiCorp Vault)
   - Rotate keys regularly

2. **Database**:
   - Use SSL connections
   - Enable point-in-time recovery backups
   - Restrict network access

3. **Blockchain**:
   - Use dedicated wallet for issuing
   - Monitor for suspicious transactions
   - Consider contract audit before mainnet

4. **API Security**:
   - Use HTTPS only
   - Implement rate limiting
   - Add DDoS protection
   - Regular security audits

See [10-error-handling.md](10-error-handling.md) for security best practices.

---

## Next Steps

1. **Follow [01-overview.md](01-overview.md)** for complete system overview
2. **Read [02-architecture.md](02-architecture.md)** for technical deep dive
3. **Reference [07-api.md](07-api.md)** for API integration
4. **Review [11-known-limitations.md](11-known-limitations.md)** for production considerations
5. **Check [12-future-improvements.md](12-future-improvements.md)** for roadmap

---

**Documentation Version**: 1.0.0  
**Last Updated**: January 15, 2024  
**Status**: Production Ready
