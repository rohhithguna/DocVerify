import { ethers } from "ethers";
import { DOCUTRUST_ABI } from "./docutrust-abi";

// ──────────────────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────────────────

export interface BlockchainConfig {
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
  networkName: string;
}

export interface BlockchainTransaction {
  hash: string;
  blockNumber: number;
  gasUsed: string;
  status: "pending" | "confirmed" | "failed";
}

export interface VerificationResult {
  exists: boolean;
  revoked: boolean;
  issuer: string;
  timestamp: number;
}

// ──────────────────────────────────────────────────────────
//  Service
// ──────────────────────────────────────────────────────────

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private config: BlockchainConfig;

  constructor(config: BlockchainConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.contract = new ethers.Contract(
      config.contractAddress,
      DOCUTRUST_ABI,
      this.wallet
    );
  }

  // ────────────────────────────────────────────────────────
  //  Convert hex hash string to bytes32
  // ────────────────────────────────────────────────────────

  /**
   * Convert a SHA-256 hex string (64 chars) to a bytes32 value
   * that Solidity understands. Pads with 0x prefix if missing.
   */
  private toBytes32(hexHash: string): string {
    // Ensure the hash has 0x prefix
    const prefixed = hexHash.startsWith("0x") ? hexHash : `0x${hexHash}`;

    // bytes32 = 32 bytes = 64 hex chars + "0x"
    if (prefixed.length !== 66) {
      throw new Error(
        `Invalid hash length: expected 64 hex chars, got ${hexHash.length}. ` +
        `Ensure you are passing a SHA-256 hash.`
      );
    }

    return prefixed;
  }

  // ────────────────────────────────────────────────────────
  //  Core: Issue Document
  // ────────────────────────────────────────────────────────

  /**
   * Store a document hash on the blockchain via the smart contract.
   * Calls DocuTrust.issueDocument(bytes32 docHash).
   */
  public async issueDocument(
    documentHash: string,
    maxRetries: number = 3
  ): Promise<BlockchainTransaction> {
    const docHashBytes32 = this.toBytes32(documentHash);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[Blockchain] Issuing document (attempt ${attempt}/${maxRetries})...`
        );

        const tx = await this.contract.issueDocument(docHashBytes32);
        const receipt = await tx.wait();

        console.log(`[Blockchain] ✅ Document issued: ${tx.hash}`);

        return {
          hash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          status: receipt.status === 1 ? "confirmed" : "failed",
        };
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[Blockchain] Attempt ${attempt} failed:`,
          (error as Error).message
        );

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to issue document after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  // ────────────────────────────────────────────────────────
  //  Core: Verify Document
  // ────────────────────────────────────────────────────────

  /**
   * Verify a document hash against the smart contract.
   * Calls DocuTrust.verifyDocument(bytes32 docHash) — this is a FREE read call.
   */
  public async verifyDocument(
    documentHash: string
  ): Promise<VerificationResult> {
    try {
      const docHashBytes32 = this.toBytes32(documentHash);
      const [exists, revoked, issuer, timestamp] =
        await this.contract.verifyDocument(docHashBytes32);

      return {
        exists,
        revoked,
        issuer,
        timestamp: Number(timestamp),
      };
    } catch (error) {
      console.error("[Blockchain] Verification error:", error);
      return {
        exists: false,
        revoked: false,
        issuer: ethers.ZeroAddress,
        timestamp: 0,
      };
    }
  }

  // ────────────────────────────────────────────────────────
  //  Core: Revoke Document
  // ────────────────────────────────────────────────────────

  /**
   * Revoke a previously issued document.
   * Calls DocuTrust.revokeDocument(bytes32 docHash).
   */
  public async revokeDocument(
    documentHash: string
  ): Promise<BlockchainTransaction> {
    const docHashBytes32 = this.toBytes32(documentHash);

    const tx = await this.contract.revokeDocument(docHashBytes32);
    const receipt = await tx.wait();

    console.log(`[Blockchain] ✅ Document revoked: ${tx.hash}`);

    return {
      hash: tx.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status === 1 ? "confirmed" : "failed",
    };
  }

  // ────────────────────────────────────────────────────────
  //  Legacy Compatibility: storeMerkleRoot
  // ────────────────────────────────────────────────────────

  /**
   * Store a Merkle root hash on blockchain.
   * This wraps issueDocument() for backward compatibility with routes.ts
   */
  public async storeMerkleRoot(
    merkleRoot: string,
    _batchId: string
  ): Promise<BlockchainTransaction> {
    return this.issueDocument(merkleRoot);
  }

  /**
   * Verify if a Merkle root was stored on blockchain.
   * This wraps verifyDocument() for backward compatibility with routes.ts
   */
  public async verifyMerkleRoot(
    merkleRoot: string,
    _transactionHash: string
  ): Promise<boolean> {
    const result = await this.verifyDocument(merkleRoot);
    return result.exists && !result.revoked;
  }

  // ────────────────────────────────────────────────────────
  //  Network Status
  // ────────────────────────────────────────────────────────

  /**
   * Get current blockchain network status.
   */
  public async getNetworkStatus(): Promise<{
    blockHeight: number;
    gasPrice: string;
    isConnected: boolean;
    contractAddress: string;
    totalDocuments: number;
  }> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      const feeData = await this.provider.getFeeData();

      let totalDocuments = 0;
      try {
        totalDocuments = Number(await this.contract.totalDocuments());
      } catch {
        // Contract might not be deployed yet
      }

      return {
        blockHeight: blockNumber,
        gasPrice: ethers.formatUnits(feeData.gasPrice || 0, "gwei"),
        isConnected: true,
        contractAddress: this.config.contractAddress,
        totalDocuments,
      };
    } catch (error) {
      console.error("[Blockchain] Network status error:", error);
      return {
        blockHeight: 0,
        gasPrice: "0",
        isConnected: false,
        contractAddress: this.config.contractAddress,
        totalDocuments: 0,
      };
    }
  }
}

// ──────────────────────────────────────────────────────────
//  Mock Service (when blockchain is not configured)
// ──────────────────────────────────────────────────────────

class MockBlockchainService {
  async issueDocument(documentHash: string): Promise<BlockchainTransaction> {
    console.log(`[Blockchain-Mock] Simulated issue: ${documentHash.slice(0, 16)}...`);
    return {
      hash: `0xmock_${Date.now().toString(16)}`,
      blockNumber: Math.floor(Math.random() * 1000000),
      gasUsed: "21000",
      status: "confirmed",
    };
  }

  async verifyDocument(documentHash: string): Promise<VerificationResult> {
    return { exists: false, revoked: false, issuer: "0x0", timestamp: 0 };
  }

  async revokeDocument(documentHash: string): Promise<BlockchainTransaction> {
    console.log(`[Blockchain-Mock] Simulated revoke: ${documentHash.slice(0, 16)}...`);
    return {
      hash: `0xmock_revoke_${Date.now().toString(16)}`,
      blockNumber: Math.floor(Math.random() * 1000000),
      gasUsed: "21000",
      status: "confirmed",
    };
  }

  async storeMerkleRoot(merkleRoot: string, _batchId: string): Promise<BlockchainTransaction> {
    return this.issueDocument(merkleRoot);
  }

  async verifyMerkleRoot(merkleRoot: string, _txHash: string): Promise<boolean> {
    return true; // Simulated verification always passes in dev
  }

  async getNetworkStatus() {
    return {
      blockHeight: 0,
      gasPrice: "0",
      isConnected: false,
      contractAddress: "0x0000000000000000000000000000000000000000",
      totalDocuments: 0,
    };
  }
}

// ──────────────────────────────────────────────────────────
//  Configuration & Initialization
// ──────────────────────────────────────────────────────────

function createBlockchainService(): BlockchainService | MockBlockchainService {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
  const contractAddress = process.env.DOCTRUST_CONTRACT_ADDRESS;
  const networkName = process.env.BLOCKCHAIN_NETWORK || "sepolia";

  // Check if blockchain is properly configured
  if (!rpcUrl || !privateKey || rpcUrl.includes("placeholder")) {
    console.warn("⚠️  Blockchain not configured — using mock service (demo mode)");
    console.warn("   Set BLOCKCHAIN_RPC_URL, BLOCKCHAIN_PRIVATE_KEY, and DOCTRUST_CONTRACT_ADDRESS in .env");
    return new MockBlockchainService();
  }

  if (!privateKey.match(/^0x[a-fA-F0-9]{64}$/)) {
    console.warn("⚠️  Invalid BLOCKCHAIN_PRIVATE_KEY format — using mock service");
    return new MockBlockchainService();
  }

  if (!contractAddress) {
    console.warn("⚠️  DOCTRUST_CONTRACT_ADDRESS not set — using mock service");
    console.warn("   Deploy: cd contracts && npm run deploy:sepolia");
    return new MockBlockchainService();
  }

  try {
    const service = new BlockchainService({
      rpcUrl,
      privateKey,
      contractAddress,
      networkName,
    });
    console.log(`✓ Blockchain connected (network: ${networkName})`);
    console.log(`✓ Contract address: ${contractAddress}`);
    return service;
  } catch (error) {
    console.warn("⚠️  Blockchain connection failed — using mock service");
    return new MockBlockchainService();
  }
}

export const blockchainService = createBlockchainService() as BlockchainService;

