import { cryptoService } from "./crypto";
import { MerkleTree as JsMerkleTree } from "merkletreejs";
import keccak256 from "keccak256";

type CertificateMetadata = {
  name: string;
  course: string;
  issuer: string;
  date: string;
  certificateId: string;
};

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  isLeaf: boolean;
  data?: any;
}

export interface MerkleProof {
  leaf: string;
  path: string[];
  root: string;
}

export class MerkleTree {
  private tree: JsMerkleTree;
  private leafMap: Map<string, Buffer>;
  private root: string;

  constructor(data: string[]) {
    if (data.length === 0) {
      throw new Error("Cannot build Merkle tree with empty data");
    }

    const leaves = data.map((hash) => keccak256(hash));
    this.tree = new JsMerkleTree(leaves, keccak256, { sortPairs: true });
    this.root = this.tree.getHexRoot();

    this.leafMap = new Map();
    for (let i = 0; i < data.length; i++) {
      this.leafMap.set(data[i], leaves[i]);
    }
  }

  public getRoot(): string {
    return this.root;
  }

  public generateProof(hash: string): MerkleProof | null {
    const leaf = this.leafMap.get(hash);
    if (!leaf) {
      return null;
    }

    return {
      leaf: `0x${leaf.toString("hex")}`,
      path: this.tree.getHexProof(leaf),
      root: this.root,
    };
  }

  public static verifyProof(proof: MerkleProof): boolean {
    return JsMerkleTree.verify(proof.path, proof.leaf, proof.root, keccak256, { sortPairs: true });
  }

  public static groupDocuments(
    documents: Array<{ hash: string; originalData: any }>,
    criterion: string
  ): Array<Array<{ hash: string; originalData: any }>> {
    const groups: Record<string, Array<{ hash: string; originalData: any }>> = {};

    documents.forEach(doc => {
      let groupKey: string;

      switch (criterion) {
        case 'department':
          groupKey = doc.originalData.department || 'unknown';
          break;
        case 'date':
          // Group by month-year
          const date = new Date(doc.originalData.date || doc.originalData.createdDate || Date.now());
          groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'type':
          groupKey = doc.originalData.type || doc.originalData.documentType || 'general';
          break;
        case 'organization':
          groupKey = doc.originalData.organization || doc.originalData.org || 'default';
          break;
        default:
          groupKey = 'all';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(doc);
    });

    return Object.values(groups);
  }
}

function generateCertificateMerkleBatch(certificates: CertificateMetadata[]) {
  const normalized = certificates.map((metadata) =>
    cryptoService.buildCanonicalCertificateData(metadata as Record<string, any>)
  );
  const hashes = normalized.map((metadata) => cryptoService.computeCertificateHash(metadata));
  const leaves = hashes.map((hash) => keccak256(hash));
  const tree = new JsMerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getHexRoot();

  return {
    root,
    certificates: normalized.map((metadata, index) => ({
      metadata,
      hash: hashes[index],
      proof: tree.getHexProof(leaves[index]),
    })),
  };
}

export const merkleService = {
  createTree: (data: string[]) => new MerkleTree(data),
  verifyProof: MerkleTree.verifyProof,
  groupDocuments: MerkleTree.groupDocuments,
  generateCertificateMerkleBatch,
};
