import { randomUUID } from "crypto";
import QRCode from "qrcode";

const BASE_URL = process.env.STAGE2_BASE_URL || "http://localhost:5000";

type RegisterResponse = {
  token: string;
  user: {
    id: string;
  };
};

type IssueResponse = {
  success: boolean;
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

async function verifyWithQrPayload(payload: Record<string, string>, verifierId: string, fileName: string): Promise<any> {
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
  const email = `stage2-${runId}@docutrust.local`;
  const password = "Stage2Pass!123";
  const certificateId = `CERT-STAGE2-${Date.now().toString(36).toUpperCase()}`;

  const register = await requestJson<RegisterResponse>(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      name: "Stage2 Issuer",
      organization: "DocuTrust QA",
    }),
  });

  const token = register.token;
  const issuerId = register.user.id;

  const canonicalPayload = {
    name: "Bob Stage2",
    course: "Zero Trust Certificates",
    issuer: "DocuTrust QA",
    date: "2026-03-18",
    certificateId,
  };

  const issue = await requestJson<IssueResponse>(`${BASE_URL}/api/issuer/${issuerId}/create-certificate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(canonicalPayload),
  });

  // TEST 1: Original certificate QR => VALID
  const validResult = await verifyWithQrPayload(canonicalPayload, "stage2-verifier", `${certificateId}.png`);
  const validPass = validResult?.message === "VALID" && validResult?.isValid === true && validResult?.isRevoked === false;

  // TEST 2: Modified QR data => INVALID
  const modifiedPayload = {
    ...canonicalPayload,
    certificateId: `${certificateId}-TAMPERED`,
  };
  const invalidResult = await verifyWithQrPayload(modifiedPayload, "stage2-verifier", `${certificateId}-tampered.png`);
  const invalidPass = invalidResult?.message === "INVALID" && invalidResult?.isValid === false;

  // TEST 3: Revoke then verify original => REVOKED
  await requestJson<any>(`${BASE_URL}/api/issuer/revoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ batchId: issue.batch.id }),
  });

  const revokeResult = await verifyWithQrPayload(canonicalPayload, "stage2-verifier", `${certificateId}-revoked.png`);
  const revokePass = revokeResult?.message === "REVOKED" && revokeResult?.isRevoked === true;

  console.log("SYSTEM TEST RESULT");
  console.log("VALID TEST:", validPass ? "pass" : "fail");
  console.log("INVALID TEST:", invalidPass ? "pass" : "fail");
  console.log("REVOKE TEST:", revokePass ? "pass" : "fail");

  if (!validPass || !invalidPass || !revokePass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.log("SYSTEM TEST RESULT");
  console.log("VALID TEST:", "fail");
  console.log("INVALID TEST:", "fail");
  console.log("REVOKE TEST:", "fail");
  console.error("Stage-2 system test failed:", error.message);
  process.exitCode = 1;
});
