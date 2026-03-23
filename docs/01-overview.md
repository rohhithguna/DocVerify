# 01 - System Overview

## Executive Summary

DocuTrustChain is a blockchain-based digital certificate verification and revocation system designed to issue, sign, and verify digital credentials with cryptographic authenticity guarantees. The system combines traditional digital signature verification with blockchain-based proof of existence to create a tamper-evident certificate ecosystem.

## Problem Statement

Traditional digital certificates suffer from several critical vulnerabilities:

1. **Single Point of Failure**: Reliance on issuing institution for validation
2. **No Revocation Proof**: Difficult to prove a certificate has been revoked once revoked
3. **Forgery Risk**: Digital documents can be modified without detection
4. **Loss of Trust**: If issuing institution database is compromised or goes offline, verification becomes impossible
5. **No Cryptographic Proof**: No way to prove a specific institution issued a specific certificate at a specific time

DocuTrustChain solves these problems by:
- Using cryptographic hashing to create immutable fingerprints of certificates
- Storing certificate hashes on a blockchain (Ethereum) for permanent, distributed proof
- Implementing digital signatures for source authentication
- Providing a Merkle tree structure for batch certificate operations
- Maintaining a decentralized revocation registry on-chain

## Key Features

### 1. Certificate Issuance Flow
- Bulk certificate upload via CSV files
- Automatic hash computation for each certificate
- Digital signature generation by issuer
- QR code generation containing verifiable metadata
- Batch Merkle tree construction for efficient verification

### 2. Digital Signing System
- RSA-based digital signature generation
- Draw-based or upload-based signature collection from signers
- Canvas-to-PNG conversion for signature storage
- Timestamp and signer validation

### 3. Blockchain Integration
- Stage 1: Direct hash storage on-chain (modern certificates)
- Stage 6: Merkle root batch submission for efficiency
- Automatic revocation tracking on blockchain
- Gas-optimized batch operations
- Network status monitoring

### 4. Verification System
- QR code scanning and metadata extraction
- Multi-stage verification:
  - Hash matching against database
  - Digital signature validation
  - Merkle proof verification (for batched certificates)
  - Blockchain existence check
  - Revocation status check
- Confidence scoring (0-100%)
- Orphaned certificate detection

### 5. User Management
- Role-based access control (Issuer, Verifier, Admin)
- JWT-based session management
- Email-based authentication
- Organization-level isolation

### 6. Revocation Management
- Individual certificate revocation
- Batch revocation with on-chain update
- Revoked state persistence
- Orphaned certificate tracking (deleted locally but exists on-chain)

## System Components

### Frontend (React/TypeScript)
- Single-page application for issuer and verifier workflows
- Real-time certificate creation and status tracking
- Interactive QR verification interface
- Dashboard with statistics and history

### Backend (Express/TypeScript)
- RESTful API for all operations
- Database abstraction layer (Drizzle ORM)
- Cryptographic services (hashing, signing, verification)
- Blockchain integration service
- Validation middleware for data integrity

### Database (PostgreSQL)
- Users and authentication
- Certificate and document records
- Verification history
- Batch management
- Blockchain status tracking

### Blockchain (Ethereum)
- DocuTrust smart contract
- Direct hash storage
- Merkle root batch storage
- Revocation registry
- Event emission for verification

## High-Level Data Flow

```
ISSUER FLOW:
┌─────────────┐
│ CSV Upload  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│ Parse & Hash Each Row   │
│ Create Documents        │
└──────┬──────────────────┘
       │
       ▼
┌──────────────────────┐
│ Build Merkle Tree    │
│ Compute Merkle Root  │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐  ┌──────────────────┐
│ Store in Database    │──│ Create QR Codes  │
└──────┬───────────────┘  └──────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Digital Signature Step   │
│ (Signer signs the batch) │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────┐
│ Submit to Blockchain │
│ Store Merkle Root    │
└──────────────────────┘
```

```
VERIFIER FLOW:
┌──────────────────────┐
│ Upload Certificate   │
│ (Image with QR)      │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Scan & Extract QR    │
│ Get Metadata         │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────┐
│ Compute Hash of Data     │
│ Compare with Database    │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐  ┌──────────────────┐
│ Check Revocation Status  │  │ Verify Signature │
└──────┬───────────────────┘  └──────────────────┘
       │                              │
       └──────────────┬───────────────┘
                      ▼
           ┌──────────────────────┐
           │ Query Blockchain for │
           │ Hash or Merkle Root  │
           └──────┬───────────────┘
                  │
                  ▼
           ┌──────────────────────┐
           │ Final Verdict:       │
           │ VALID / INVALID /    │
           │ REVOKED / ORPHANED   │
           └──────────────────────┘
```

## Key Definitions

| Term | Definition |
|------|-----------|
| **Hash** | Keccak256 cryptographic hash of normalized certificate data |
| **Merkle Root** | Single hash representing all certificates in a batch |
| **Merkle Proof** | Path of hashes proving a certificate exists in a batch |
| **Digital Signature** | RSA-based signature of the batch by authorized signer |
| **QR Metadata** | Structured data embedded in QR code (name, course, issuer, date, certificateId) |
| **Batch** | Collection of certificates processed as a single unit |
| **Revocation** | Mark certificate as invalid (deleted or expired) |
| **Orphaned** | Certificate deleted from database but still exists on blockchain |
| **Confidence Score** | Percentage (0-100%) representing verification reliability |
| **Stage-1 Verification** | Direct hash storage on blockchain (per-certificate) |
| **Stage-6 Verification** | Merkle root batch storage on blockchain (efficient) |

## System Capabilities

### Issuers Can:
- Upload bulk certificates via CSV
- Monitor batch processing status
- View and revoke issued certificates
- Track verification statistics
- Access blockchain status

### Verifiers Can:
- Upload certificate images for verification
- Scan QR codes automatically
- View detailed verification results (confidence score, component checks)
- Maintain verification history
- Access verification dashboard with statistics

### System Can:
- Handle thousands of certificates per batch
- Store immutable records on public blockchain
- Process 100+ MB CSV files
- Track revocation state in real-time
- Compute cryptographic proofs instantly
- Monitor blockchain network status
- Detect and flag orphaned certificates
- Provide confidence scoring for verification results

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, TanStack Query, React Router, Tailwind CSS |
| **Backend** | Express.js, TypeScript, Node.js |
| **Database** | PostgreSQL, Drizzle ORM |
| **Blockchain** | Ethereum (Sepolia testnet or mainnet), Solidity smart contracts |
| **Cryptography** | Keccak256 (hashing), RSA (signatures), ECDSA (blockchain) |
| **QR** | jsQR (decoding), qrcode library (generation) |
| **Image Processing** | pngjs, jpeg-js (certificate parsing) |

## Success Metrics

The system is considered successful when:
1. Newly issued certificates can be verified 100% of the time
2. Revoked certificates correctly report as revoked
3. Forged certificates are detected with 100% accuracy
4. Verification completes in < 5 seconds
5. Blockchain submission succeeds > 99% of the time
6. Certificate history is maintained indefinitely
7. No data loss occurs during batch operations

## Scope and Boundaries

### In Scope:
- Certificate issuance and bulk processing
- Digital signing workflow
- QR-based verification
- Blockchain integration for proof of existence
- Revocation management
- Multi-role user access control

### Out of Scope:
- Privacy-preserving verification (current system is transparent)
- Zero-knowledge proofs
- Cross-chain interoperability
- Legacy certificate format support
- Non-Ethereum blockchain support
- Distributed issuer networks
