const BASE_URL = process.env.DELETE_TEST_BASE_URL || "http://localhost:500";

type ApiResult = {
  status: number;
  data: any;
};

async function request(path: string, init?: RequestInit): Promise<ApiResult> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  const text = await res.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return { status: res.status, data };
}

async function main() {
  const runId = Date.now().toString(36);

  const register = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `delete-test-${runId}@docutrust.local`,
      password: "DeleteTest!123",
      name: "Delete Test",
      organization: "DocuTrust QA",
    }),
  });

  if (register.status !== 201 || !register.data?.token || !register.data?.user?.id) {
    throw new Error(`Registration failed: ${register.status} ${JSON.stringify(register.data)}`);
  }

  const token = register.data.token as string;
  const issuerId = register.data.user.id as string;

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const certUnverified = {
    name: "Delete Normal",
    course: "Safety",
    issuer: "DocuTrust QA",
    date: "2026-03-19",
    certificateId: `CERT-DEL-N-${runId}`,
  };

  const issueUnverified = await request(`/api/issuer/${issuerId}/create-certificate`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(certUnverified),
  });

  const unverifiedDocId = issueUnverified.data?.certificate?.id as string | undefined;

  const deleteUnverified = unverifiedDocId
    ? await request(`/api/issuer/document/${unverifiedDocId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
    : { status: 0, data: {} };

  const normalDeletePass = deleteUnverified.status === 200 && deleteUnverified.data?.success === true;

  const certVerified = {
    name: "Delete Verified",
    course: "Safety",
    issuer: "DocuTrust QA",
    date: "2026-03-19",
    certificateId: `CERT-DEL-V-${runId}`,
  };

  const issueVerified = await request(`/api/issuer/${issuerId}/create-certificate`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(certVerified),
  });

  const verifiedDocId = issueVerified.data?.certificate?.id as string | undefined;

  await request("/api/verifier/verify-metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      verifierId: "delete-test-verifier",
      ...certVerified,
    }),
  });

  const deleteVerified = verifiedDocId
    ? await request(`/api/issuer/document/${verifiedDocId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
    : { status: 0, data: {} };

  const verifiedBlockPass =
    deleteVerified.status === 403 && deleteVerified.data?.error === "DOCUMENT_VERIFIED";

  const forceDeleteVerified = verifiedDocId
    ? await request(`/api/issuer/document/${verifiedDocId}?force=true`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
    : { status: 0, data: {} };

  const forceDeletePass = forceDeleteVerified.status === 200 && forceDeleteVerified.data?.success === true;

  console.log("DELETE SYSTEM STATUS");
  console.log(`NORMAL DELETE: ${normalDeletePass ? "PASS" : "FAIL"}`);
  console.log(`VERIFIED BLOCK: ${verifiedBlockPass ? "PASS" : "FAIL"}`);
  console.log(`FORCE DELETE: ${forceDeletePass ? "PASS" : "FAIL"}`);

  if (!normalDeletePass || !verifiedBlockPass || !forceDeletePass) {
    console.log("DEBUG RESPONSES");
    console.log("issueUnverified:", JSON.stringify(issueUnverified));
    console.log("deleteUnverified:", JSON.stringify(deleteUnverified));
    console.log("issueVerified:", JSON.stringify(issueVerified));
    console.log("deleteVerified:", JSON.stringify(deleteVerified));
    console.log("forceDeleteVerified:", JSON.stringify(forceDeleteVerified));
    process.exit(1);
  }
}

main().catch((error) => {
  console.log("DELETE SYSTEM STATUS");
  console.log("NORMAL DELETE: FAIL");
  console.log("VERIFIED BLOCK: FAIL");
  console.log("FORCE DELETE: FAIL");
  console.error("Delete system test failed:", error.message);
  process.exit(1);
});
