import { ethers } from "ethers";
import { DOCUTRUST_ABI } from "./docutrust-abi";

export interface BlockchainConfig {
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
  networkName: string;
}

export interface BlockchainTransaction {
  hash: string | null;
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

export type BlockchainConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";

export interface BlockchainNetworkStatus {
  blockHeight: number;
  gasPrice: string;
  isConnected: boolean;
  status: BlockchainConnectionStatus;
  contractAddress: string;
  totalDocuments: number;
  error?: string;
}

export class BlockchainService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.NonceManager;
  private contract: ethers.Contract;
  private config: BlockchainConfig;
  private blockchainRequired: boolean;
  private testMode: boolean;
  private mockMode: boolean;

  constructor(config: BlockchainConfig, options?: { blockchainRequired?: boolean; testMode?: boolean; mockMode?: boolean }) {
    this.config = config;
    this.blockchainRequired = options?.blockchainRequired ?? false;
    this.testMode = options?.testMode ?? false;
    this.mockMode = options?.mockMode ?? false;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl, undefined, { staticNetwork: true });
    const signer = new ethers.Wallet(config.privateKey, this.provider);
    this.wallet = new ethers.NonceManager(signer);
    this.contract = new ethers.Contract(config.contractAddress, DOCUTRUST_ABI, this.wallet);
  }

  private mockTransaction(status: "pending" | "confirmed" | "failed" = "confirmed"): BlockchainTransaction {
    return {
      hash: status === "confirmed" ? "mock_tx_hash" : null,
      blockNumber: 0,
      gasUsed: "0",
      status,
    };
  }

  private toBytes32(hexHash: string): string {
    const prefixed = hexHash.startsWith("0x") ? hexHash : `0x${hexHash}`;
    if (prefixed.length !== 66) {
      throw new Error(
        `Invalid hash length: expected 64 hex chars, got ${hexHash.length}. Ensure a SHA-256/bytes32 value.`
      );
    }
    return prefixed;
  }

  private async sendTxWithRetry(
    action: () => Promise<ethers.ContractTransactionResponse>,
    operationName: string,
    maxRetries: number = 3
  ): Promise<BlockchainTransaction> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const tx = await action();
        const receipt = await tx.wait();

        return {
          hash: tx.hash,
          blockNumber: receipt?.blockNumber ?? 0,
          gasUsed: receipt?.gasUsed?.toString() ?? "0",
          status: receipt?.status === 1 ? "confirmed" : "failed",
        };
      } catch (error) {
        lastError = error as Error;
        const isRetryable = this.isRetryableTxError(lastError);
        if (!isRetryable || attempt === maxRetries) {
          break;
        }

        const delayMs = Math.pow(2, attempt - 1) * 500;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw new Error(`${operationName} failed after retries: ${lastError?.message || "unknown error"}`);
  }

  private isRetryableTxError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("timeout") ||
      msg.includes("nonce") ||
      msg.includes("replacement fee too low") ||
      msg.includes("already known") ||
      msg.includes("temporarily unavailable") ||
      msg.includes("network")
    );
  }

  public async storeMerkleRoot(
    merkleRoot: string,
    _batchIdOrMaxRetries?: string | number
  ): Promise<BlockchainTransaction> {
    if (this.testMode || this.mockMode) {
      return this.mockTransaction("confirmed");
    }

    try {
      const rootBytes32 = this.toBytes32(merkleRoot);
      return this.sendTxWithRetry(() => this.contract.storeRoot(rootBytes32), "storeMerkleRoot");
    } catch (error) {
      if (!this.blockchainRequired) {
        return this.mockTransaction("pending");
      }
      throw error;
    }
  }

  public async verifyMerkleRoot(
    merkleRoot: string,
    _transactionHash?: string
  ): Promise<VerificationResult> {
    if (this.testMode || this.mockMode) {
      return {
        exists: true,
        revoked: false,
        issuer: "0x0000000000000000000000000000000000000001",
        timestamp: Math.floor(Date.now() / 1000),
      };
    }

    try {
      const rootBytes32 = this.toBytes32(merkleRoot);
      const [exists, revoked, issuer, timestamp] = await this.contract.verifyRoot(rootBytes32);

      return {
        exists: Boolean(exists),
        revoked: Boolean(revoked),
        issuer: String(issuer),
        timestamp: Number(timestamp),
      };
    } catch (error) {
      if (!this.blockchainRequired) {
        return {
          exists: false,
          revoked: false,
          issuer: "0x0",
          timestamp: 0,
        };
      }
      throw error;
    }
  }

  public async rootExists(merkleRoot: string): Promise<boolean> {
    if (this.testMode || this.mockMode) {
      return true;
    }

    try {
      const rootBytes32 = this.toBytes32(merkleRoot);
      return Boolean(await this.contract.validRoots(rootBytes32));
    } catch (error) {
      if (!this.blockchainRequired) {
        return false;
      }
      throw error;
    }
  }

  public async revokeMerkleRoot(merkleRoot: string): Promise<BlockchainTransaction> {
    if (this.testMode || this.mockMode) {
      return this.mockTransaction("confirmed");
    }

    try {
      const rootBytes32 = this.toBytes32(merkleRoot);
      return this.sendTxWithRetry(() => this.contract.revokeRoot(rootBytes32), "revokeMerkleRoot");
    } catch (error) {
      if (!this.blockchainRequired) {
        return this.mockTransaction("pending");
      }
      throw error;
    }
  }

  public async issueDocument(documentHash: string): Promise<BlockchainTransaction> {
    if (this.testMode || this.mockMode) {
      return this.mockTransaction("confirmed");
    }

    try {
      const docBytes32 = this.toBytes32(documentHash);
      return this.sendTxWithRetry(() => this.contract.issueDocument(docBytes32), "issueDocument");
    } catch (error) {
      if (!this.blockchainRequired) {
        return this.mockTransaction("pending");
      }
      throw error;
    }
  }

  public async verifyDocument(documentHash: string): Promise<VerificationResult> {
    if (this.testMode || this.mockMode) {
      return {
        exists: true,
        revoked: false,
        issuer: "0x0000000000000000000000000000000000000001",
        timestamp: Math.floor(Date.now() / 1000),
      };
    }

    try {
      const docBytes32 = this.toBytes32(documentHash);
      const [exists, revoked, issuer, timestamp] = await this.contract.verifyDocument(docBytes32);

      return {
        exists: Boolean(exists),
        revoked: Boolean(revoked),
        issuer: String(issuer),
        timestamp: Number(timestamp),
      };
    } catch (error) {
      if (!this.blockchainRequired) {
        return {
          exists: false,
          revoked: false,
          issuer: "0x0",
          timestamp: 0,
        };
      }
      throw error;
    }
  }

  public async revokeDocument(documentHash: string): Promise<BlockchainTransaction> {
    if (this.testMode || this.mockMode) {
      return this.mockTransaction("confirmed");
    }

    try {
      const docBytes32 = this.toBytes32(documentHash);
      return this.sendTxWithRetry(() => this.contract.revokeDocument(docBytes32), "revokeDocument");
    } catch (error) {
      if (!this.blockchainRequired) {
        return this.mockTransaction("pending");
      }
      throw error;
    }
  }

  public async checkConnection(): Promise<boolean> {
    if (this.testMode || this.mockMode) {
      return true;
    }

    try {
      await this.provider.getBlockNumber();
      return true;
    } catch {
      return false;
    }
  }

  public async getNetworkStatus(): Promise<BlockchainNetworkStatus> {
    const isConnected = await this.checkConnection();

    if (!isConnected) {
      return {
        blockHeight: 0,
        gasPrice: "0",
        isConnected: false,
        status: "DISCONNECTED",
        contractAddress: this.config.contractAddress,
        totalDocuments: 0,
      };
    }

    try {
      const blockNumber = await this.provider.getBlockNumber();
      const feeData = await this.provider.getFeeData();
      let totalDocuments = 0;
      let status: BlockchainConnectionStatus = "CONNECTED";
      let error: string | undefined;

      try {
        totalDocuments = Number(await this.contract.totalDocuments());
      } catch (contractError) {
        status = "ERROR";
        error = contractError instanceof Error ? contractError.message : "Contract call failed";
      }

      return {
        blockHeight: blockNumber,
        gasPrice: ethers.formatUnits(feeData.gasPrice || 0, "gwei"),
        isConnected: status === "CONNECTED",
        status,
        contractAddress: this.config.contractAddress,
        totalDocuments,
        ...(error ? { error } : {}),
      };
    } catch (error) {
      return {
        blockHeight: 0,
        gasPrice: "0",
        isConnected: false,
        status: "ERROR",
        contractAddress: this.config.contractAddress,
        totalDocuments: 0,
        error: error instanceof Error ? error.message : "Network status lookup failed",
      };
    }
  }
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseBooleanEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function createBlockchainService(): BlockchainService {
  const blockchainRequired = parseBooleanEnv("BLOCKCHAIN_REQUIRED", false);
  const testMode = (process.env.NODE_ENV || "").toLowerCase() === "test";
  const mockMode = testMode || !blockchainRequired;

  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL?.trim() || "http://127.0.0.1:8545";
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY?.trim() || "0x59c6995e998f97a5a0044966f0945387d64f5f6f84d2d36c2f5f9f3f2cb49952";
  const contractAddress =
    process.env.DOCUTRUST_CONTRACT_ADDRESS?.trim() ||
    process.env.DOCTRUST_CONTRACT_ADDRESS?.trim() ||
    "0x0000000000000000000000000000000000000001";
  const networkName = process.env.BLOCKCHAIN_NETWORK?.trim() || "sepolia";

  if (blockchainRequired && !/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    throw new Error("Invalid BLOCKCHAIN_PRIVATE_KEY format. Expected 0x + 64 hex chars.");
  }

  if (blockchainRequired && !ethers.isAddress(contractAddress)) {
    throw new Error("Invalid contract address. Set DOCUTRUST_CONTRACT_ADDRESS or DOCTRUST_CONTRACT_ADDRESS.");
  }

  if (blockchainRequired && !rpcUrl.startsWith("http://") && !rpcUrl.startsWith("https://")) {
    throw new Error("Invalid BLOCKCHAIN_RPC_URL. Must start with http:// or https://");
  }

  const service = new BlockchainService({
    rpcUrl,
    privateKey,
    contractAddress,
    networkName,
  }, {
    blockchainRequired,
    testMode,
    mockMode,
  });

  console.log(`✓ Blockchain service initialized on ${networkName}`);
  console.log(`✓ Contract address: ${contractAddress}`);
  console.log(`✓ Blockchain required: ${blockchainRequired}`);
  if (mockMode) {
    console.log("✓ Blockchain mock mode enabled (test/safe mode)");
  }

  return service;
}

export const blockchainService = createBlockchainService();
