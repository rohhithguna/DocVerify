/**
 * DocuTrust Contract ABI
 * 
 * This is the Application Binary Interface for the DocuTrust smart contract.
 * It tells ethers.js how to encode/decode function calls to the contract.
 * 
 * After compiling with Hardhat, the full ABI is also available at:
 *   contracts/artifacts/DocuTrust.sol/DocuTrust.json
 */
export const DOCUTRUST_ABI = [
  // ── Core Functions ──────────────────────────────────────

  // issueDocument(bytes32 docHash)
  {
    inputs: [{ name: "docHash", type: "bytes32" }],
    name: "issueDocument",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // verifyDocument(bytes32 docHash) → (bool, bool, address, uint256)
  {
    inputs: [{ name: "docHash", type: "bytes32" }],
    name: "verifyDocument",
    outputs: [
      { name: "exists_", type: "bool" },
      { name: "revoked_", type: "bool" },
      { name: "issuer_", type: "address" },
      { name: "timestamp_", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },

  // revokeDocument(bytes32 docHash)
  {
    inputs: [{ name: "docHash", type: "bytes32" }],
    name: "revokeDocument",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ── Admin Functions ─────────────────────────────────────

  // addIssuer(address issuer)
  {
    inputs: [{ name: "issuer", type: "address" }],
    name: "addIssuer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // removeIssuer(address issuer)
  {
    inputs: [{ name: "issuer", type: "address" }],
    name: "removeIssuer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ── View Functions ──────────────────────────────────────

  // owner() → address
  {
    inputs: [],
    name: "owner",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },

  // totalDocuments() → uint256
  {
    inputs: [],
    name: "totalDocuments",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },

  // authorizedIssuers(address) → bool
  {
    inputs: [{ name: "", type: "address" }],
    name: "authorizedIssuers",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },

  // documents(bytes32) → (address issuer, uint256 timestamp, bool exists, bool revoked)
  {
    inputs: [{ name: "", type: "bytes32" }],
    name: "documents",
    outputs: [
      { name: "issuer", type: "address" },
      { name: "timestamp", type: "uint256" },
      { name: "exists", type: "bool" },
      { name: "revoked", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },

  // ── Events ──────────────────────────────────────────────

  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "docHash", type: "bytes32" },
      { indexed: true, name: "issuer", type: "address" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "DocumentIssued",
    type: "event",
  },

  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "docHash", type: "bytes32" },
      { indexed: true, name: "revokedBy", type: "address" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    name: "DocumentRevoked",
    type: "event",
  },
] as const;
