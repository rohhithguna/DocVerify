# 05 - Blockchain System

## Ethereum Smart Contract Architecture

## Overview

The **DocuTrust.sol** smart contract serves as the immutable registry for certificate proof-of-existence and revocation state. All hash submissions and revocations are permanent and decentralized.

## Contract State

```solidity
contract DocuTrust {
  // Direct hash storage (Stage-1 Verification)
  mapping(bytes32 => HashRecord) public hashRegistry;
  
  // Merkle root batch storage (Stage-6 Verification)
  mapping(bytes32 => MerkleRootRecord) public merkleRoots;
  
  // Revocation tracking
  mapping(bytes32 => bool) public revokedHashes;
  mapping(bytes32 => bool) public revokedRoots;
  
  // Access control
  mapping(address => bool) public authorizedIssuers;
  address public contractOwner;
  
  // Event emissions
  event HashSubmitted(bytes32 indexed hash, address indexed issuer);
  event MerkleRootSubmitted(bytes32 indexed root, bytes32 batchId);
  event HashRevoked(bytes32 indexed hash, address indexed revoker);
  event RootRevoked(bytes32 indexed root, address indexed revoker);
}
```

## Data Structures

### Hash Record
```solidity
struct HashRecord {
  address issuer;              // Address that submitted hash
  uint256 timestamp;           // Block timestamp of submission
  bool exists;                 // True if hash submitted
  bool revoked;                // True if hash marked revoked
  bytes32 merkleRoot;          // If part of batch, the root
  uint256 blockNumber;         // Block number of submission
}
```

### Merkle Root Record
```solidity
struct MerkleRootRecord {
  address issuer;              // Issuing organization address
  uint256 timestamp;           // Submission timestamp
  bytes32 batchId;             // Unique batch identifier (UUID)
  bool exists;                 // True if merkle root submitted
  bool revoked;                // True if batch revoked
  uint256 certificateCount;    // Number of certs in batch
  bytes signature;             // Issuer's signature of root
  uint256 blockNumber;         // Block number of submission
}
```

## Core Functions

### Verification Functions (Read-Only)

```solidity
function isHashOnChain(bytes32 hash) public view returns (bool) {
  // Check if hash exists in registry
  // Lookup: O(1) mapping access
  // Returns: true if hash was submitted
  return hashRegistry[hash].exists && !hashRegistry[hash].revoked;
}

function isHashRevoked(bytes32 hash) public view returns (bool) {
  // Check if hash marked revoked
  // Returns: true if revoked
  return revokedHashes[hash] || (hashRegistry[hash].revoked);
}

function getHashDetails(bytes32 hash) 
  public view returns (HashRecord memory) {
  // Retrieve full details of hash record
  // Returns: {issuer, timestamp, exists, revoked, blockNumber}
  return hashRegistry[hash];
}

function isMerkleRootOnChain(bytes32 root) public view returns (bool) {
  // Check if merkle root exists
  // Returns: true if batch was submitted
  return merkleRoots[root].exists && !merkleRoots[root].revoked;
}

function isMerkleRootRevoked(bytes32 root) public view returns (bool) {
  // Check merkle root revocation status
  // Returns: true if batch revoked
  return revokedRoots[root] || merkleRoots[root].revoked;
}
```

### Submission Functions (Write)

```solidity
function submitHash(bytes32 hash) public onlyAuthorized {
  // Submit single document hash
  // Requires: authorized issuer
  // Effects:
  //   - Records hash and timestamp
  //   - Emits HashSubmitted event
  //   - Gas cost: ~25,000 per hash
  
  require(!hashRegistry[hash].exists, "Hash already submitted");
  require(authorizedIssuers[msg.sender], "Not authorized issuer");
  
  hashRegistry[hash] = HashRecord({
    issuer: msg.sender,
    timestamp: block.timestamp,
    exists: true,
    revoked: false,
    merkleRoot: bytes32(0),
    blockNumber: block.number
  });
  
  emit HashSubmitted(hash, msg.sender);
}

function submitMerkleRoot(bytes32 root, bytes32 batchId, uint256 certCount) 
  public onlyAuthorized {
  // Submit merkle root for batch
  // Requires: authorized issuer, valid batch
  // Benefits: ~250 hashes in single transaction
  // Gas cost: ~35,000 base + 100 per cert (vs 25k per individual hash)
  
  require(!merkleRoots[root].exists, "Root already submitted");
  require(authorizedIssuers[msg.sender], "Not authorized issuer");
  require(certCount > 0, "Invalid certificate count");
  
  merkleRoots[root] = MerkleRootRecord({
    issuer: msg.sender,
    timestamp: block.timestamp,
    batchId: batchId,
    exists: true,
    revoked: false,
    certificateCount: certCount,
    signature: "",
    blockNumber: block.number
  });
  
  emit MerkleRootSubmitted(root, batchId);
}
```

### Revocation Functions (Write)

```solidity
function revokeHash(bytes32 hash) public onlyAuthorizedOrOwner {
  // Revoke single hash
  // Requires: issuer of hash OR contract owner
  // Effects: Mark hash permanently revoked
  
  require(hashRegistry[hash].exists, "Hash not found");
  require(msg.sender == hashRegistry[hash].issuer || msg.sender == contractOwner,
    "Only issuer or owner can revoke");
  
  revokedHashes[hash] = true;
  hashRegistry[hash].revoked = true;
  
  emit HashRevoked(hash, msg.sender);
}

function revokeMerkleRoot(bytes32 root) public onlyAuthorizedOrOwner {
  // Revoke entire batch via merkle root
  // Requires: issuer of root OR contract owner
  // Effects: Mark batch permanently revoked
  // Implication: All certificates in batch considered revoked
  
  require(merkleRoots[root].exists, "Root not found");
  require(msg.sender == merkleRoots[root].issuer || msg.sender == contractOwner,
    "Only issuer or owner can revoke");
  
  revokedRoots[root] = true;
  merkleRoots[root].revoked = true;
  
  emit RootRevoked(root, msg.sender);
}
```

## Verification Logic On-Chain

### Hash Verification
```solidity
function verifyHashProof(bytes32 hash) public view returns (VerificationResult) {
  // Verify hash exists and is not revoked
  bool exists = hashRegistry[hash].exists;
  bool revoked = isHashRevoked(hash);
  
  return VerificationResult({
    isValid: exists && !revoked,
    isRevoked: revoked,
    timestamp: hashRegistry[hash].timestamp,
    issuer: hashRegistry[hash].issuer,
    blockNumber: hashRegistry[hash].blockNumber
  });
}
```

### Merkle Root Verification
```solidity
function verifyMerkleProof(bytes32 root, bytes32 leaf, bytes32[] memory proof)
  public view returns (VerificationResult) {
  // Verify merkle proof (computed off-chain)
  // Proof verification logic:
  //   1. Start with leaf
  //   2. For each proof element: hash(current, element)
  //   3. Compare final result with root
  // Returns: whether proof is valid and root exists
  
  bool exists = isMerkleRootOnChain(root);
  bool revoked = isHashRevoked(leaf) || isMerkleRootRevoked(root);
  
  bytes32 computed = leaf;
  for (uint i = 0; i < proof.length; i++) {
    if (computed < proof[i]) {
      computed = keccak256(abi.encodePacked(computed, proof[i]));
    } else {
      computed = keccak256(abi.encodePacked(proof[i], computed));
    }
  }
  
  return VerificationResult({
    isValid: (computed == root) && exists && !revoked,
    isRevoked: revoked,
    timestamp: merkleRoots[root].timestamp,
    issuer: merkleRoots[root].issuer,
    blockNumber: merkleRoots[root].blockNumber
  });
}
```

## Hashing Strategy

### Document Hash Computation

```typescript
// Backend service (crypto.ts)

function certificateDataToHashString(data: CertificateData): string {
  // Create canonical string representation
  // Format: "name|course|issuer|date|certificateId"
  // Example: "john-doe|q1-2024|university|2024-01-15|CERT-001"
  
  return [
    data.name.toLowerCase().trim(),
    data.course.toLowerCase().trim(),
    data.issuer.toLowerCase().trim(),
    data.date, // ISO 8601 format
    data.certificateId.toLowerCase().trim(),
  ].join('|');
}

function computeHash(canonicalString: string): string {
  // Use Keccak256 (same as Ethereum)
  // Library: keccak256
  // Returns: 0x-prefixed hex string (66 chars total)
  
  const hash = keccak256(Buffer.from(canonicalString, 'utf8'));
  return '0x' + hash.toString('hex');
}

// Example
const data = {name: "john", course: "q1", issuer: "uni", date: "2024-01-15", id: "001"};
const canonical = certificateDataToHashString(data);
const hash = computeHash(canonical);
// hash = "0x1a2b3c4d5e6f..."
```

### Hash Properties

| Property | Value |
|----------|-------|
| **Algorithm** | Keccak256 (same as Ethereum) |
| **Output length** | 256 bits (32 bytes / 64 hex chars) |
| **Output format** | 0x-prefixed hex string |
| **Collision probability** | < 2^-128 |
| **Deterministic** | Same input → same hash always |
| **Irreversible** | Cannot compute input from hash |

## Merkle Tree Deep Dive

### Tree Construction for Batch

```
Input: [hash1, hash2, hash3, hash4, hash5]

Step 1: Pad to power of 2
→ [hash1, hash2, hash3, hash4, hash5, hash5] (duplicate last)

Step 2: Create leaf level (depth 0)
hash1  hash2  hash3  hash4  hash5  hash5

Step 3: Hash pairs → next level (depth 1)
H(1,2) H(3,4) H(5,5)

Step 4: Hash pairs → next level (depth 2)
H(H(1,2), H(3,4))  H(H(5,5), hash(empty))

Step 5: Hash final pair → root (depth 3)
H(H(H(1,2), H(3,4)), H(H(5,5), hash(empty)))

Final Root: 0x...(merkle root for batch)
Proof for hash1: [H(2), H(3,4), H(H(5,5), ...)]
```

### Proof Verification Algorithm

```
To prove hash1 is in tree:

Given:
- leaf = hash1
- proof = [H(2), H(3,4), H(H(5,5), ...)]
- root = computed_root

Process:
1. current = leaf
   current = hash1

2. For proof[0] = H(2):
   current = Keccak256(hash1 || H(2))
   = H(1,2)

3. For proof[1] = H(3,4):
   current = Keccak256(H(1,2) || H(3,4))
   = H(H(1,2), H(3,4))

4. For proof[2] = H(H(5,5), ...):
   current = Keccak256(H(H(1,2), H(3,4)) || H(H(5,5), ...))
   = root

5. Compare: current == root?
   ✓ YES → Proof valid, hash1 is in batch
   ✗ NO → Proof invalid
```

## Gas Optimization

### Cost Comparison

| Operation | Cost | Batch Size | Total Gas |
|-----------|------|-----------|-----------|
| **Submit single hash** | 25,000 | 1 | 25,000 |
| **Submit 100 hashes individually** | 25,000 × 100 | 100 | 2,500,000 |
| **Submit 100 hashes via batch** | 35,000 | 100 | 35,000 |
| **Savings** | - | 100 | 98.6% |

### Storage Efficiency

```
Stage 1 (per certificate):
├─ Hash storage: 32 bytes
├─ Metadata: 96 bytes (timestamp, issuer, flags)
└─ Total: 128 bytes per certificate

Stage 6 (batch of 100):
├─ Single merkle root: 32 bytes
├─ Batch metadata: 192 bytes
└─ Total: 224 bytes ÷ 100 = 2.24 bytes per certificate

Reduction: 98.2%
```

## Security Considerations

### Threat Model

1. **Hash Collision**
   - Keccak256 strength: 2^128 resistance
   - Mitigated by: cryptographic hash properties
   - Probability: < 1 in 10^38

2. **Unauthorized Submission**
   - Mitigated by: onlyAuthorized modifier
   - Requires: valid Ethereum account with permissions
   - Checked: on-chain before recording

3. **Revocation Abuse**
   - Current: Any issuer can revoke their own hashes
   - Risk: Issuer could revoke valid certificate
   - Mitigation: Verifiers can query revocation event logs

4. **Merkle Proof Forgery**
   - Mitigated by: cryptographic proof verification
   - Requires: valid path of hashes
   - Resistance: Impossible without breaking Keccak256

### Access Control

```solidity
modifier onlyAuthorized() {
  require(authorizedIssuers[msg.sender], "Not authorized");
  _;
}

modifier onlyOwner() {
  require(msg.sender == contractOwner, "Only owner");
  _;
}
```

## Integration with Backend

### Web3.js Connection

```typescript
class BlockchainService {
  private web3: Web3;
  private contract: Contract;
  
  constructor(rpcUrl: string, contractAddress: string, abi: ABI) {
    this.web3 = new Web3(rpcUrl);
    this.contract = new this.web3.eth.Contract(abi, contractAddress);
  }
  
  async verifyDocument(hash: string): Promise<VerificationResult> {
    try {
      // Call contract (read-only, no gas)
      const result = await this.contract.methods
        .verifyHashProof(hash)
        .call();
      
      return {
        exists: result.isValid,
        revoked: result.isRevoked,
        issuer: result.issuer,
        timestamp: parseInt(result.timestamp),
      };
    } catch (error) {
      console.error('Blockchain verification failed:', error);
      throw new BlockchainError('Hash verification failed');
    }
  }
}
```

### Transaction Lifecycle

```
1. Backend prepares transaction
   ├─ Function: submitHash(hash)
   ├─ From: issuer wallet
   └─ Gas estimate: 25,000

2. Sign with issuer private key
   ├─ Signature confirms authorization
   └─ Transaction nonce incremented

3. Broadcast to network
   ├─ Propagated to nodes
   └─ Entered in mempool

4. Wait for confirmation
   ├─ Miner includes in block
   ├─ Block mined (~12s Ethereum)
   └─ Confirmation threshold reached

5. Update backend status
   ├─ Record transaction hash
   ├─ Update certificate status
   └─ Notify verifiers of completion
```

## Network Configuration

### Supported Networks

| Network | Chain ID | RPC | Status |
|---------|----------|-----|--------|
| **Sepolia (Testnet)** | 11155111 | https://sepolia.infura.io | Testing |
| **Mainnet (Production)** | 1 | https://mainnet.infura.io | Production |
| **Localhost (Dev)** | 31337 | http://localhost:8545 | Development |

### Environment Configuration

```bash
# Development (local Hardhat)
BLOCKCHAIN_RPC_URL=http://localhost:8545
CONTRACT_ADDRESS=0x5FbDB2315678afccb333f8a9c45b65d30061dE94
NETWORK=localhost

# Testing (Sepolia)
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io
CONTRACT_ADDRESS=0x...
NETWORK=sepolia

# Production (Mainnet)
BLOCKCHAIN_RPC_URL=https://mainnet.infura.io
CONTRACT_ADDRESS=0x...
NETWORK=mainnet
```

## Event Monitoring

Smart contract emits events for off-chain indexing:

```solidity
event HashSubmitted(bytes32 indexed hash, address indexed issuer);
event MerkleRootSubmitted(bytes32 indexed root, bytes32 batchId);
event HashRevoked(bytes32 indexed hash, address indexed revoker);
event RootRevoked(bytes32 indexed root, address indexed revoker);
```

These events allow:
- Verifiers to subscribe to real-time submissions
- Auditing of all blockchain activity
- Historical analysis via event logs
- Creation of activity feeds

## Future Enhancements

1. **Batch Verification**
   - Submit array of hashes in single transaction
   - Further reduce gas costs

2. **Signature Verification On-Chain**
   - Verify issuer signature directly in contract
   - Remove dependency on backend signature check

3. **Access Control (ACL)**
   - Fine-grained permissions per organization
   - Role-based submission rights

4. **Cross-Chain Bridge**
   - Submit hashes to multiple chains
   - Distribute trust across networks
