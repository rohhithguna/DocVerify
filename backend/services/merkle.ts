import { cryptoService } from "./crypto";

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  isLeaf: boolean;
  data?: any;
}

export interface MerkleProof {
  leaf: string;
  path: Array<{
    hash: string;
    direction: 'left' | 'right';
  }>;
  root: string;
}

export class MerkleTree {
  private root: MerkleNode | null = null;
  private leaves: MerkleNode[] = [];

  constructor(data: string[]) {
    this.buildTree(data);
  }

  private buildTree(data: string[]): void {
    if (data.length === 0) {
      throw new Error("Cannot build Merkle tree with empty data");
    }

    // Create leaf nodes
    this.leaves = data.map(item => ({
      hash: cryptoService.computeHash(item),
      isLeaf: true,
      data: item,
    }));

    // Build tree bottom-up
    let currentLevel = [...this.leaves];

    while (currentLevel.length > 1) {
      const nextLevel: MerkleNode[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;

        const combinedHash = cryptoService.computeHash(left.hash + right.hash);
        const parentNode: MerkleNode = {
          hash: combinedHash,
          left,
          right: right !== left ? right : undefined,
          isLeaf: false,
        };

        nextLevel.push(parentNode);
      }

      currentLevel = nextLevel;
    }

    this.root = currentLevel[0];
  }

  public getRoot(): string {
    if (!this.root) {
      throw new Error("Tree not built");
    }
    return this.root.hash;
  }

  public generateProof(leafData: string): MerkleProof | null {
    const leafHash = cryptoService.computeHash(leafData);
    const leafNode = this.leaves.find(leaf => leaf.hash === leafHash);
    
    if (!leafNode) {
      return null;
    }

    const proof: MerkleProof = {
      leaf: leafHash,
      path: [],
      root: this.getRoot(),
    };

    this.buildProofPath(this.root!, leafHash, proof.path);
    return proof;
  }

  private buildProofPath(
    node: MerkleNode, 
    targetHash: string, 
    path: Array<{ hash: string; direction: 'left' | 'right' }>
  ): boolean {
    if (!node) return false;

    if (node.isLeaf) {
      return node.hash === targetHash;
    }

    // Check left subtree
    if (node.left && this.buildProofPath(node.left, targetHash, path)) {
      if (node.right) {
        path.push({ hash: node.right.hash, direction: 'right' });
      }
      return true;
    }

    // Check right subtree
    if (node.right && this.buildProofPath(node.right, targetHash, path)) {
      if (node.left) {
        path.push({ hash: node.left.hash, direction: 'left' });
      }
      return true;
    }

    return false;
  }

  public static verifyProof(proof: MerkleProof): boolean {
    let computedHash = proof.leaf;

    for (const step of proof.path) {
      if (step.direction === 'left') {
        computedHash = cryptoService.computeHash(step.hash + computedHash);
      } else {
        computedHash = cryptoService.computeHash(computedHash + step.hash);
      }
    }

    return computedHash === proof.root;
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

export const merkleService = {
  createTree: (data: string[]) => new MerkleTree(data),
  verifyProof: MerkleTree.verifyProof,
  groupDocuments: MerkleTree.groupDocuments,
};
