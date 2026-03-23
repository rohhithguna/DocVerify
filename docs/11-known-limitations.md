# 11 - Known Limitations

## Current System Constraints

## Overview

This document honestly outlines DocuTrust's current limitations, constraints, and architectural boundaries. Understanding these limitations is critical for production deployment decisions and feature roadmapping.

## Blockchain Limitations

### Network Dependency

**Limitation**: System requires active blockchain network connection

- **Impact**: Verification fails if blockchain RPC unreachable
- **Recovery**: Cached verification results (5-minute TTL)
- **Workaround**: Implement offline mode with cached merkle proofs
- **Timeline**: Phase 2 (post-launch)

**Current Behavior**:
```
User verifies certificate
    ↓
Backend queries blockchain
    ↓
RPC timeout (30 seconds)
    ↓
Returns "Unable to verify" error
    ↓
No fallback mechanism
```

**Future Solution**:
```
User verifies certificate
    ↓
Check Redis cache first (5 min TTL)
    ↓
If cached: Return cached result
    ↓
If not cached: Try blockchain
    ↓
On timeout: Degrade gracefully
```

### Gas Cost Scalability

**Limitation**: Single hash verification costs ~25,000 gas per certificate

**Current Costs** (Ethereum Mainnet, 30 gwei):
- 1 certificate: $0.30-0.60 USD
- 100 certificates: $30-60 USD
- 1,000 certificates: $300-600 USD

**Merkle batching reduces costs**:
- Batch 250 certs: $0.40 per certificate (97% reduction)
- But increases submission latency: 2-30 minutes (vs immediate)

**Trade-offs**:
| Approach | Cost | Speed | Setup |
|----------|------|-------|-------|
| **Direct hash** | High | Immediate | Simple |
| **Merkle batch** | Low | 2-30 min wait | Complex |
| **Combination** | Medium | Variable | Most complex |

**Implication**: High-volume issuers must batch to remain economical

### Smart Contract Limitations

#### No Built-in Revocation List
- Individual certificate revocation must track separately
- Blockchain only knows merkle root revocation
- Verifiers must query backend database for individual revocation status
- Cannot verify revocation status from smart contract alone

#### No Authorization Check On Chain
- Smart contract trusts issuer address implicitly
- No granular access control (who can revoke, submit, etc.)
- All operations by authorized wallet treated equally
- Would require oracle for on-chain authorization

#### No Timestamp Verification
- Contract records block timestamp (not wall clock)
- Block timestamps can be manipulated by miners (±900 seconds)
- Not suitable for strict time-dependent verification

#### No Signature Verification On Chain
- Backend verifies issuer signatures
- Smart contract doesn't validate signature authenticity
- Removes one layer of proof-of-authorization

**Workaround**: Backend signature verification provides sufficient security for current use case

### Merkle Tree Limitations

#### Fixed Tree Height
- Maximum batch size: ~10,000 certificates
- Tree depth: ~14 (doubles with each level)
- Beyond 10k, merkle proof becomes impractical

**Limitation**: 10,000 certificate batch
- Proof size: ~14 hashes × 32 bytes = 448 bytes ✓ (acceptable)
- Computation time: ~100ms ✓ (acceptable)
- Gas cost: ~35,000 (fixed) ✓

**Current Constraint**: System configured for ~256 certificate batches (practical limit)

**Future**: Implement multi-tree batching for 50,000+ certificates

#### No Partial Batch Submission
- Must sign and submit entire batch
- Cannot add certificates mid-submission
- Entire batch blocked if single certificate invalid

**Workaround**: Validate all certificates before signing

#### One-Way Hash
- Cannot reverse merkle proof to find individual hashes
- But hash itself is immutable and deterministic
- Same certificate always produces same hash

## Scalability Constraints

### Concurrent User Limits

**Current Tested Load**:
- 10 simultaneous issuers
- 50 simultaneous verifiers
- 100 certificates per batch

**Bottlenecks**:
- Database connection pool: 20 connections
- Node.js event loop: Single-threaded
- Blockchain RPC rate limits: 10 req/sec (varies by provider)

**When Constraints Hit**:
```
100+ concurrent users
    ↓
Database pool exhausted
    ↓
Requests queue up
    ↓
Response time: > 30 seconds
    ↓
User timeout
```

### Database Limits

#### Query Performance

**Slow Queries** (>100ms):
- Join across batches + certificates + verifications
- Full-text search on large datasets
- Aggregation queries (stats dashboards)

**Performance Table**:
| Query | < 100ms | < 500ms | < 5s | Slow |
|-------|---------|---------|------|------|
| Single batch lookup | ✓ | | | |
| Batch with 100 certs | ✓ | | | |
| User's 1000 batches | | ✓ | | |
| Verification history (paginated) | ✓ | | | |
| Dashboard stats (aggregate) | | | ✓ | |
| Search across all issuers | | | ✓ | |

**Optimization**: Pagination mandatory for large result sets

#### Storage Capacity

**Current Usage**:
- 100,000 certificates: ~500 MB (5 KB per certificate)
- PostgreSQL max on basic tier: 5 GB
- With growth rate: ~1 year at current demo scale

**Future**: Archive old certificates to cold storage

### Frontend Limitations

#### QR Code Size Limit
- QR version 40 max capacity: ~2953 bytes
- Current merkle proof + metadata: ~500-800 bytes
- Safely supports batches up to ~250 certificates

**Beyond 250 certificates**:
- Merkle proof becomes too large for QR
- Must use URL-based transmission (longer QR, slower scan)
- Or use alternate encoding (not barcode)

#### Browser File Upload
- Max single file: Limited by browser memory
- PDF parsing: Works but slow for large files
- No built-in resume on network failure

### Time & Latency Limits

#### Blockchain Confirmation Time

| Network | Block Time | Confirmation | Practical Max |
|---------|-----------|--------------|---------------|
| **Ethereum Mainnet** | 12-15s | 12 blocks (~3 min) | Variable |
| **Sepolia Testnet** | 12-15s | 12 blocks (~3 min) | Variable |
| **Private/Local** | 1s | 1 block | ~1 second |

**Current Timeout**: 30 seconds per blockchain call

**Limitation**: User must wait 3-30 minutes for batch confirmation before displaying "issued" status

#### API Response Time Targets
- Verification: < 5 seconds
- Certificate creation: < 1 second
- Dashboard queries: < 2 seconds
- Batch signing: < 3 seconds (100 certs)

**Under Load**: Double these times

## Authentication & Security Limitations

### Single-Factor Authentication
- Only email + password
- No 2FA or social login
- No session management
- Lost password requires admin reset

### Token Expiration
- Fixed 24-hour expiration
- No refresh token mechanism
- User must re-login after 24 hours
- Session not invalidated on logout

### Private Key Management
- Keys stored in environment variables
- No key rotation mechanism
- No HSM (Hardware Security Module) support
- Single point of failure if env compromised

### Rate Limiting
- Per-IP based (shared VPN fails)
- No user-based rate limiting
- No DDoS protection (relies on infrastructure)

## Integration Limitations

### No Cross-Blockchain Support
- Single blockchain only (Ethereum/Sepolia/Local)
- Cannot verify across chains
- No atomic cross-chain operations

### No Batch Verification API
- Must verify certificates one-by-one
- No bulk verification endpoint
- 100 verifications = 100 API calls

### No WebSocket Support
- No real-time verification status
- Verifier must poll for results
- No push notifications

### No Email Integration
- No automatic notifications
- No certificate delivery via email
- No revocation alerts

## Data Limitations

### Metadata Immutability
- Certificate metadata cannot be updated after creation
- Must create new batch for corrections
- Prior batches remain unchanged (by design)

### Retention Policy
- No automatic data deletion
- No configurable retention period
- Soft deletes only (logical, not physical)

### Privacy & GDPR
- No built-in GDPR deletion mechanisms
- Personal data stored in verifications table
- No encryption at rest currently

### Cross-Issuer Deduplication
- No mechanism to detect same certificate from multiple issuers
- Potential for duplicate certificates
- Verifiers cannot distinguish legitimate duplicates

## Testing Limitations

### No Multiple Network Support
- Hardcoded to single blockchain network
- Must redeploy for different networks
- No simple network switching in UI

### Limited Test Scenarios
- No scenario for invalid merkle proofs
- No scenario for partial blockchain failure
- No scenario for concurrent batch signing

### No Load Testing Tools
- No built-in load testing suite
- External tools required (k6, JMeter)
- No baseline metrics recorded

## UI/UX Limitations

### Mobile Responsiveness
- Optimized for desktop
- Mobile layout untested
- QR code scanning requires external app

### Accessibility
- No WCAG 2.1 AA compliance
- Limited keyboard navigation
- No screen reader optimization

### Offline Functionality
- Requires internet connection
- Cannot read certificates offline
- Cannot prepare batch offline

## Documentation Limitations

### API Documentation
- No OpenAPI/Swagger spec
- Manual documentation (this file)
- No automated API docs generation

### Error Messages
- Some errors don't explain recovery steps
- Error codes not standardized
- No user-friendly error translations

### Setup Documentation
- Assumes Linux/Mac
- No Windows setup guide
- Database setup not automated

## Known Bugs

### QR Code Edge Cases
- Very long certificate names fail QR generation
- Special characters in issuer names sometimes break encoding
- QR code decoding fails on certain phone models

**Workaround**: Limit name length to 60 chars, use ASCII only

### Certificate Sign Timing
- Race condition if batch modified during signing
- Users can add certs while signing in progress
- Results in merkle root mismatch

**Workaround**: Lock batch during signing (not yet implemented)

### Verification Cache Synchronization
- Cached results not invalidated on revocation
- Verifier sees unrevoked status even after revocation
- Cache TTL: 5 minutes (eventual consistency)

**Workaround**: Restart app to clear cache

### Dashboard Stats Accuracy
- Dashboard stats not real-time
- Counts might not match actual database
- Refreshing doesn't update (cached)

**Workaround**: Refresh entire page (hard refresh)

## Future Roadmap to Address Limitations

### Phase 1 (Q1 2024) - Demo
- ✓ Current state
- Merkle batching
- Basic verification
- Dashboard UI

### Phase 2 (Q2 2024) - MVP
- [ ] Offline mode with cached proofs
- [ ] Batch verification API
- [ ] Email notifications
- [ ] 2FA authentication
- [ ] Archive/retention policies

### Phase 3 (Q3 2024) - Scale
- [ ] Multi-chain support
- [ ] Database sharding
- [ ] WebSocket real-time updates
- [ ] GDPR compliance tooling
- [ ] Load testing suite

### Phase 4 (Q4 2024) - Enterprise
- [ ] HSM key management
- [ ] SSO/OAuth integration
- [ ] Webhook events
- [ ] Audit trail API
- [ ] Advanced analytics

## Workaround Summary

For each limitation, here are immediate workarounds:

| Issue | Workaround | Trade-off |
|-------|-----------|-----------|
| **Network dependent** | Check health endpoint first | Adds latency |
| **High gas cost** | Use merkle batching | 30 min wait |
| **No 2FA** | Use strong password + IP allowlist | Manual config |
| **Fixed token expiration** | Implement client refresh logic | Client complexity |
| **No concurrent modification** | Lock batch manually | User coordination |
| **Cache staleness** | Hard refresh page | UX friction |
| **QR size limit** | Use URL-based transmission | Slower QR generation |
| **Mobile issues** | Use desktop only | Limited accessibility |

## Breaking Changes Alert

These changes will break current implementations:

### Planned (Will Break)
1. **Database Schema v2.0**: Column renames, new required fields
2. **API v2.0**: Endpoint changes, response structure updates
3. **Smart Contract v2.0**: New functions, revoke logic changes

### Backwards Compatibility Plan
- Maintain v1.0 endpoints for 6 months post-launch
- Migration guide provided for each breaking change
- Staged rollout (10% → 50% → 100%)

## Recommendations for Production Use

1. **Always implement retry logic** for blockchain operations
2. **Cache verification results** (5-10 minute TTL)
3. **Monitor blockchain RPC health** with alerting
4. **Use Ethereum Mainnet carefully** (high gas costs) — consider L2 solutions
5. **Implement batch signing workflows** for economies of scale
6. **Add application-level 2FA** for issuers
7. **Monitor database connection pool** for exhaustion
8. **Set up regular backups** of PostgreSQL database
9. **Implement QR code generation caching** to reduce load
10. **Use CDN for static assets** (certificates, PDFs)

## Support & Escalation

For issues hitting these limitations:
1. Check the workaround in table above
2. Review relevant phase in roadmap
3. Consider interim solutions
4. Contact support@docutrust.app for enterprise needs
