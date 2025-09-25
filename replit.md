# DocuVerify

## Overview

DocuVerify is a blockchain-powered document verification system that provides secure, transparent, and tamper-proof document validation using Merkle trees and blockchain technology. The system operates with two distinct user roles: issuers who upload and secure document batches, and verifiers who validate document authenticity. The application combines modern web technologies with cryptographic security to ensure document integrity throughout the verification process.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The client is built as a Single Page Application (SPA) using React with TypeScript, utilizing a modern component-based architecture:

- **Framework**: React 18 with TypeScript for type safety and modern development patterns
- **Routing**: Wouter for lightweight client-side routing, supporting issuer and verifier dashboard paths
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Framework**: Radix UI primitives with shadcn/ui components for consistent, accessible design
- **Styling**: Tailwind CSS with CSS variables for theming, supporting light/dark modes
- **Build Tool**: Vite for fast development and optimized production builds

The application follows a role-based navigation pattern where users select between issuer and verifier roles, each leading to specialized dashboards with distinct functionality.

### Backend Architecture

The server follows a RESTful API architecture built on Express.js with TypeScript:

- **Framework**: Express.js with TypeScript for robust server-side development
- **Database ORM**: Drizzle ORM for type-safe database operations
- **File Processing**: Multer for handling CSV file uploads with memory storage
- **CSV Parsing**: PapaParse for processing uploaded document files
- **API Design**: RESTful endpoints organized by functionality (issuer, verifier, blockchain status)

The server implements a modular service layer pattern with dedicated services for cryptographic operations, Merkle tree construction, and blockchain interactions.

### Data Storage Solutions

**Database Schema Design**:
- **DocumentBatches**: Store batch metadata, issuer information, and blockchain transaction details
- **Documents**: Individual document records with hashes, signatures, and Merkle proofs
- **Verifications**: Track verification attempts with confidence scores and validation results
- **BlockchainStatus**: Monitor network connectivity and transaction status

**Storage Strategy**:
- PostgreSQL as the primary database with Drizzle ORM for schema management
- JSON columns for storing complex data structures (Merkle proofs, verification data)
- Indexed fields for efficient querying of document hashes and batch lookups

### Authentication and Authorization Mechanisms

The system implements a simplified demo-style authentication approach:

- **Role-Based Access**: Users self-identify as either issuers or verifiers
- **Session Management**: Simple ID-based routing without complex authentication flows
- **Data Isolation**: Queries filtered by issuer/verifier IDs to maintain data separation

This approach prioritizes demonstration and development simplicity over production-grade security.

### Cryptographic Security Implementation

**Digital Signatures**:
- RSA-based digital signing for document integrity verification
- Fixed keypair for demonstration purposes (would use secure key management in production)
- SHA-256 hashing for consistent document fingerprinting

**Merkle Tree Construction**:
- Binary tree structure for efficient batch verification
- Cryptographic proofs enabling individual document validation without revealing batch contents
- Bottom-up tree construction with duplicate handling for odd-numbered datasets

**Blockchain Integration**:
- Ethereum testnet integration for immutable Merkle root storage
- Ethers.js for blockchain interaction and transaction management
- Transaction monitoring with gas price tracking and network status

## External Dependencies

### UI and Component Libraries
- **Radix UI**: Comprehensive set of unstyled, accessible UI primitives
- **shadcn/ui**: Pre-built component library built on Radix UI with Tailwind styling
- **Lucide React**: Icon library for consistent iconography

### Database and ORM
- **Neon Database**: Serverless PostgreSQL hosting platform
- **Drizzle ORM**: Type-safe ORM with excellent TypeScript integration
- **Drizzle Kit**: Database migration and schema management tools

### Blockchain Infrastructure
- **Ethers.js**: Ethereum library for blockchain interactions
- **Ethereum Sepolia Testnet**: Test network for blockchain transaction storage

### Development and Build Tools
- **Vite**: Fast build tool with hot module replacement
- **TypeScript**: Static type checking and enhanced development experience
- **Tailwind CSS**: Utility-first CSS framework
- **PostCSS**: CSS processing with autoprefixer

### File Processing and Utilities
- **Multer**: Middleware for handling multipart/form-data file uploads
- **PapaParse**: CSV parsing library for processing document files
- **date-fns**: Date manipulation and formatting utilities

### Query and State Management
- **TanStack Query**: Server state management with caching and synchronization
- **React Hook Form**: Form state management with validation
- **Zod**: Schema validation for type-safe form handling

The architecture emphasizes type safety, modern development practices, and clear separation of concerns while maintaining the flexibility needed for a demonstration application focused on blockchain-based document verification.