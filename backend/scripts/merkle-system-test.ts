import "dotenv/config";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import keccak256 from "keccak256";

import { merkleService } from "../services/merkle";
import { cryptoService } from "../services/crypto";
import { blockchainService } from "../services/blockchain";
import { storage } from "../storage";

type PassFail = "PASS" | "FAIL";

type StageResult = {
  stage1: PassFail;
  stage2: PassFail;
  stage3: PassFail;
  stage4: PassFail;
  validTest: PassFail;
  tamperTest: PassFail;
  proofTest: PassFail;
  revokeTest: PassFail;
};

function passFail(value: boolean): PassFail {
  return value ? "PASS" : "FAIL";
}

async function verifyCertificate(metadata: {
  name: string;
  course: string;
  issuer: string;
  date: string;
  certificateId: string;
}): Promise<{ isValid: boolean; isRevoked: boolean; message: "VALID" | "INVALID" | "REVOKED" }> {
  const canonical = cryptoService.buildCanonicalCertificateData(metadata);
  const hash = cryptoService.computeCertificateHash(canonical);

  const doc = await storage.getDocumentByCertificateId(canonical.certificateId);
  if (!doc) {
    return { isValid: false, isRevoked: false, message: "INVALID" };
  }

  const batch = await storage.getDocumentBatch(doc.batchId);
  const proofObj = doc.merkleProof as { path?: string[]; root?: string } | null;
  const root = proofObj?.root || batch?.merkleRoot || "";
  const path = Array.isArray(proofObj?.path) ? proofObj.path : [];

  const leaf = path.length === 0 && root === hash ? hash : `0x${keccak256(hash).toString("hex")}`;
  const proofValid = root
    ? merkleService.verifyProof({ leaf, path, root })
    : false;

  const rootExists = root ? await blockchainService.rootExists(root) : false;
  const rootStatus = root ? await blockchainService.verifyMerkleRoot(root) : { exists: false, revoked: false };
  const revoked = !!(batch?.revoked || rootStatus.revoked) && rootExists;

  if (revoked) return { isValid: false, isRevoked: true, message: "REVOKED" };
  if (proofValid && rootExists) return { isValid: true, isRevoked: false, message: "VALID" };
  return { isValid: false, isRevoked: false, message: "INVALID" };
}

async function main() {
  const results: StageResult = {
    stage1: "FAIL",
    stage2: "FAIL",
    stage3: "FAIL",
    stage4: "FAIL",
    validTest: "FAIL",
    tamperTest: "FAIL",
    proofTest: "FAIL",
    revokeTest: "FAIL",
  };

  const runId = randomUUID().slice(0, 8).toUpperCase();

  const certA = {
    name: "Alice Merkle",
    course: "Blockchain Security",
    issuer: "DocuTrust QA",
    date: "2026-03-18",
    certificateId: `CERT-MERKLE-${runId}-A`,
  };

  const certB = {
    name: "Bob Merkle",
    course: "Blockchain Security",
    issuer: "DocuTrust QA",
    date: "2026-03-18",
    certificateId: `CERT-MERKLE-${runId}-B`,
  };

  const certs = [certA, certB];

  // Stage 1: Merkle generation correctness
  let stage1Ok = false;
  const batch1 = merkleService.generateCertificateMerkleBatch(certs);
  const batch2 = merkleService.generateCertificateMerkleBatch(certs);
  const deterministicRoot = batch1.root === batch2.root;
  const allProofsPresent = batch1.certificates.every((c) => c.proof.length > 0);
  const allHashesMatch = batch1.certificates.every((c) => {
    const expectedHash = cryptoService.computeCertificateHash(c.metadata);
    return expectedHash === c.hash;
  });
  const allProofsValid = batch1.certificates.every((c) => {
    const leaf = `0x${keccak256(c.hash).toString("hex")}`;
    return merkleService.verifyProof({
      leaf,
      path: c.proof,
      root: batch1.root,
    });
  });
  stage1Ok = deterministicRoot && allProofsPresent && allHashesMatch && allProofsValid;
  results.stage1 = passFail(stage1Ok);

  const issuedBatch = merkleService.generateCertificateMerkleBatch(certs);
  const batchRoot = issuedBatch.root;

  const batch = await storage.createDocumentBatch({
    batchName: `Merkle QA Batch ${runId}`,
    issuerId: `qa-${runId}`,
    issuerName: certA.issuer,
    fileName: `merkle-qa-${runId}.json`,
    documentCount: issuedBatch.certificates.length,
    groupingCriterion: "certificate",
    status: "processing",
  });

  const blockchainTx = await blockchainService.storeMerkleRoot(batchRoot, batch.id);
  await storage.updateDocumentBatch(batch.id, {
    merkleRoot: batchRoot,
    blockchainTxHash: blockchainTx.hash,
    blockNumber: String(blockchainTx.blockNumber),
    status: "completed",
  });

  for (const cert of issuedBatch.certificates) {
    const hashInput = cryptoService.certificateDataToHashString(cert.metadata);
    const signature = cryptoService.signData(hashInput);
    const certificateRecord = {
      certificateId: cert.metadata.certificateId,
      metadata: cert.metadata,
      hash: cert.hash,
      merkleProof: cert.proof,
      merkleRoot: batchRoot,
    };

    await storage.createDocument({
      batchId: batch.id,
      documentHash: cert.hash,
      digitalSignature: signature,
      originalData: {
        ...cert.metadata,
        hash: cert.hash,
        merkleProof: cert.proof,
        merkleRoot: batchRoot,
        certificateRecord,
      },
      merkleProof: {
        leaf: `0x${keccak256(cert.hash).toString("hex")}`,
        path: cert.proof,
        root: batchRoot,
      },
    });
  }

  const batchId = batch.id;

  // Stage 2: Blockchain root storage
  const contractPath = path.resolve(process.cwd(), "contracts/src/DocuTrust.sol");
  const contractSource = fs.readFileSync(contractPath, "utf8");
  const hasValidRootsMapping = /mapping\(bytes32\s*=>\s*bool\)\s+public\s+validRoots\s*;/.test(contractSource);
  const hasStoreRootFunction = /function\s+storeRoot\s*\(bytes32\s+root\)/.test(contractSource);
  const onChainRootExists = await blockchainService.rootExists(batchRoot);
  const stage2Ok = hasValidRootsMapping && hasStoreRootFunction && onChainRootExists;
  results.stage2 = passFail(stage2Ok);

  // Stage 3: DB proof storage
  let stage3Ok = true;
  for (const cert of issuedBatch.certificates) {
    const doc = await storage.getDocumentByCertificateId(cert.metadata.certificateId);
    if (!doc) {
      stage3Ok = false;
      break;
    }

    const data = doc.originalData as Record<string, any>;
    const certificateRecord = data?.certificateRecord as
      | {
          certificateId: string;
          metadata: typeof certA;
          hash: string;
          merkleProof: string[];
          merkleRoot: string;
        }
      | undefined;

    const hashFromMetadata = cryptoService.computeCertificateHash(
      cryptoService.buildCanonicalCertificateData(cert.metadata)
    );

    const proofNotEmpty = Array.isArray(certificateRecord?.merkleProof) && certificateRecord.merkleProof.length > 0;
    const rootMatches = certificateRecord?.merkleRoot === batchRoot;
    const hashMatches = hashFromMetadata === cert.hash && certificateRecord?.hash === cert.hash;
    const blockchainRootMatches = await blockchainService.rootExists(certificateRecord?.merkleRoot || "");

    if (!(proofNotEmpty && rootMatches && hashMatches && blockchainRootMatches)) {
      stage3Ok = false;
      break;
    }
  }
  results.stage3 = passFail(stage3Ok);

  // Stage 4 and behavior tests
  const validRes = await verifyCertificate(certA);
  results.validTest = passFail(validRes.message === "VALID" && validRes.isValid === true && validRes.isRevoked === false);

  const tamperRes = await verifyCertificate({ ...certA, course: "Tampered Course" });
  results.tamperTest = passFail(tamperRes.message === "INVALID" && tamperRes.isValid === false);

  // Wrong proof test by intentionally tampering DB proof for certB.
  const docB = await storage.getDocumentByCertificateId(certB.certificateId);
  let originalProof: unknown = null;
  if (docB) {
    originalProof = docB.merkleProof;
    const badProof = {
      ...(docB.merkleProof as Record<string, any>),
      path: ["0x" + "00".repeat(32)],
    };
    await storage.updateDocument(docB.id, { merkleProof: badProof as any });
  }

  const wrongProofRes = await verifyCertificate(certB);
  results.proofTest = passFail(wrongProofRes.message === "INVALID" && wrongProofRes.isValid === false);

  // Restore original proof before revoke check.
  if (docB && originalProof) {
    await storage.updateDocument(docB.id, { merkleProof: originalProof as any });
  }

  await blockchainService.revokeMerkleRoot(batchRoot);
  await storage.updateDocumentBatch(batchId, {
    revoked: true,
    revokedAt: new Date(),
    status: "revoked",
  });

  const revokeRes = await verifyCertificate(certA);
  results.revokeTest = passFail(revokeRes.message === "REVOKED" && revokeRes.isRevoked === true);

  const stage4Ok =
    results.validTest === "PASS" &&
    results.tamperTest === "PASS" &&
    results.proofTest === "PASS" &&
    results.revokeTest === "PASS";
  results.stage4 = passFail(stage4Ok);

  console.log("MERKLE SYSTEM TEST RESULT");
  console.log("STAGE 1:", results.stage1);
  console.log("STAGE 2:", results.stage2);
  console.log("STAGE 3:", results.stage3);
  console.log("STAGE 4:", results.stage4);
  console.log("VALID TEST:", results.validTest);
  console.log("TAMPER TEST:", results.tamperTest);
  console.log("PROOF TEST:", results.proofTest);
  console.log("REVOKE TEST:", results.revokeTest);

  const allPassed = Object.values(results).every((v) => v === "PASS");
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.log("MERKLE SYSTEM TEST RESULT");
  console.log("STAGE 1:", "FAIL");
  console.log("STAGE 2:", "FAIL");
  console.log("STAGE 3:", "FAIL");
  console.log("STAGE 4:", "FAIL");
  console.log("VALID TEST:", "FAIL");
  console.log("TAMPER TEST:", "FAIL");
  console.log("PROOF TEST:", "FAIL");
  console.log("REVOKE TEST:", "FAIL");
  console.error("Merkle system test failed:", error.message);
  process.exit(1);
});
