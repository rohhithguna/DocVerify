import { randomUUID } from "crypto";
import QRCode from "qrcode";

const BASE_URL = process.env.STAGE1_BASE_URL || "http://localhost:5000";

type RegisterResponse = {
  token: string;
  user: {
    id: string;
    email: string;
  };
};

type IssueResponse = {
  success: boolean;
  certificate: {
    certificateId: string;
    name: string;
    course: string;
    issuer: string;
    date: string;
    documentHash: string;
  };
  batch: {
    id: string;
  };
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.text();
  const parsed = body ? JSON.parse(body) : {};

  if (!res.ok) {
    throw new Error(parsed?.message || parsed?.error || `HTTP ${res.status}`);
  }

  return parsed as T;
}

async function verifyByUpload(
  payload: Record<string, string>,
  fileName: string,
  verifierId: string
): Promise<any> {
  const qrText = JSON.stringify(payload);
  const qrPngBuffer = await QRCode.toBuffer(qrText, { width: 220, margin: 1 });

  const formData = new FormData();
  const pngBytes = new Uint8Array(qrPngBuffer);
  formData.append("file", new Blob([pngBytes], { type: "image/png" }), fileName);
  formData.append("verifierId", verifierId);

  const res = await fetch(`${BASE_URL}/api/verifier/verify`, {
    method: "POST",
    body: formData,
  });

  const body = await res.text();
  const parsed = body ? JSON.parse(body) : {};
  if (!res.ok) {
    throw new Error(parsed?.message || parsed?.error || `HTTP ${res.status}`);
  }

  return parsed;
}

async function main() {
  const runId = randomUUID().slice(0, 8);
  const email = `stage1-${runId}@docutrust.local`;
  const password = "Stage1Pass!123";
  const testCertId = `CERT-STAGE1-${Date.now().toString(36).toUpperCase()}`;

  const register = await requestJson<RegisterResponse>(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      name: "Stage1 Issuer",
      organization: "DocuTrust QA",
    }),
  });

  const token = register.token;
  const issuerId = register.user.id;

  const issuePayload = {
    name: "Alice Stage",
    course: "Blockchain Security",
    issuer: "DocuTrust QA",
    date: "2026-03-18",
    certificateId: testCertId,
  };

  const issue = await requestJson<IssueResponse>(`${BASE_URL}/api/issuer/${issuerId}/create-certificate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(issuePayload),
  });

  // TEST 1: Same certificate => VALID
  const validResult = await verifyByUpload(issuePayload, `${testCertId}.png`, "stage1-verifier");
  const validPass = validResult?.message === "VALID" && validResult?.isValid === true && validResult?.isRevoked === false;

  // TEST 2: Changed certificateId => INVALID
  const invalidResult = await requestJson<any>(`${BASE_URL}/api/verifier/verify-metadata`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      verifierId: "stage1-verifier",
      ...issuePayload,
      certificateId: `${testCertId}-X`,
    }),
  });
  const invalidPass = invalidResult?.message === "INVALID" && invalidResult?.isValid === false;

  // TEST 3: Revoke certificate => REVOKED
  await requestJson<any>(`${BASE_URL}/api/issuer/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ batchId: issue.batch.id }),
  });

  const revokedResult = await requestJson<any>(`${BASE_URL}/api/verifier/verify-metadata`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      verifierId: "stage1-verifier",
      ...issuePayload,
    }),
  });
  const revokePass = revokedResult?.message === "REVOKED" && revokedResult?.isRevoked === true;

  console.log("SYSTEM TEST RESULT");
  console.log("VALID TEST:", validPass ? "pass" : "fail");
  console.log("INVALID TEST:", invalidPass ? "pass" : "fail");
  console.log("REVOKE TEST:", revokePass ? "pass" : "fail");

  if (!validPass || !invalidPass || !revokePass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("SYSTEM TEST RESULT");
  console.log("VALID TEST:", "fail");
  console.log("INVALID TEST:", "fail");
  console.log("REVOKE TEST:", "fail");
  console.error("Stage-1 system test failed:", error.message);
  process.exitCode = 1;
});
