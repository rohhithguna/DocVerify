const BASE_URL = process.env.CASCADE_DELETE_BASE_URL || "http://localhost:5000";

async function request(method, path, { body, token } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return { status: response.status, data };
}

function certificatePayload(certificateId, studentId, holderName) {
  return {
    holder: {
      name: holderName,
      studentId,
      email: `${holderName.toLowerCase().replace(/ /g, '.')}@example.com`,
    },
    certificateDetails: {
      certificateId,
      course: "Cascade Delete Test",
      level: "Advanced",
      duration: "4 weeks",
      grade: "A",
    },
    issuer: {
      issuerName: "CascadeTest Institute",
      issuerId: "ISS-CASCADE",
      issuerWallet: "0x1234567890abcdef1234567890ABCDEF12345678",
    },
    validity: {
      issueDate: "2026-03-19",
      expiryDate: "2027-03-19",
      status: "ACTIVE",
    },
    security: {
      hash: "",
      txHash: "",
      merkleRoot: "",
    },
    signature: {
      signature: "U2lnbmVkQnlDYXNjYWRl",
      signedBy: "Cascade Test Signer",
    },
    verification: {
      qrCodeUrl: `${BASE_URL}/verify/${certificateId}`,
    },
  };
}

async function run() {
  const runId = Date.now();
  console.log(`\n🧪 CASCADE DELETE TEST [${runId}]\n`);

  // Step 1: Create a test issuer
  const issuer = {
    email: `cascade_issuer_${runId}@example.com`,
    password: "SecurePass123!",
    name: "Cascade Test Issuer",
  };

  const registerIssuer = await request("POST", "/api/auth/register", { body: issuer });
  if (registerIssuer.status !== 201) {
    console.error("❌ Failed to register issuer:", registerIssuer.data);
    process.exit(1);
  }

  const loginIssuer = await request("POST", "/api/auth/login", {
    body: { email: issuer.email, password: issuer.password },
  });
  if (loginIssuer.status !== 200) {
    console.error("❌ Failed to login issuer:", loginIssuer.data);
    process.exit(1);
  }

  const issuerToken = loginIssuer.data?.token;
  const issuerId = loginIssuer.data?.user?.id;

  console.log(`✓ Issuer registered: ${issuerId}`);

  // Step 2: Create certificate (unverified)
  const cert1 = await request(
    "POST",
    `/api/issuer/${issuerId}/create-certificate`,
    {
      body: certificatePayload(`CERT-UNVERIFIED-${runId}`, `SID-UNVERIFIED-${runId}`, "Alice Unverified"),
      token: issuerToken,
    }
  );

  if (cert1.status !== 200) {
    console.error("❌ Failed to create unverified certificate:", cert1.data);
    process.exit(1);
  }

  const unverifiedBatchId = cert1.data?.batchId;
  const unverifiedDocId = cert1.data?.documentId;
  console.log(`✓ Created unverified certificate with documentId: ${unverifiedDocId}`);

  // Step 3: Create another certificate for verification testing
  const cert2 = await request(
    "POST",
    `/api/issuer/${issuerId}/create-certificate`,
    {
      body: certificatePayload(`CERT-VERIFIED-${runId}`, `SID-VERIFIED-${runId}`, "Bob Verified"),
      token: issuerToken,
    }
  );

  if (cert2.status !== 200) {
    console.error("❌ Failed to create verified certificate:", cert2.data);
    process.exit(1);
  }

  const verifiedBatchId = cert2.data?.batchId;
  const verifiedDocId = cert2.data?.documentId;
  console.log(`✓ Created verified certificate with documentId: ${verifiedDocId}`);

  // Step 4: Verify the second certificate using metadata
  const verify = await request("POST", "/api/verifier/verify-metadata", {
    body: {
      verifierId: "test-verifier",
      name: "Bob Verified",
      course: "Cascade Delete Test",
      issuer: "CascadeTest Institute",
      date: "2026-03-19",
      certificateId: `CERT-VERIFIED-${runId}`,
    },
  });

  if (verify.status !== 200) {
    console.log(`⚠️  Verification creation returned ${verify.status}, but continuing tests`);
  } else {
    console.log(`✓ Created verification record linked to document`);
  }

  // Step 5: Test normal delete (unverified document) → SHOULD SUCCEED
  console.log("\n[TEST 1] Delete unverified document...");
  const deleteUnverified = await request("DELETE", `/api/issuer/document/${unverifiedDocId}`, {
    token: issuerToken,
  });

  const test1Pass = deleteUnverified.status === 200;
  console.log(test1Pass ? "✅ PASS - Unverified document deleted" : `❌ FAIL - Status ${deleteUnverified.status}`);

  // Step 6: Test delete verified without force → SHOULD RETURN 403
  console.log("\n[TEST 2] Delete verified document without force...");
  const deleteVerifiedNoForce = await request("DELETE", `/api/issuer/document/${verifiedDocId}`, {
    token: issuerToken,
  });

  const test2Pass =
    deleteVerifiedNoForce.status === 403 &&
    deleteVerifiedNoForce.data?.error === "DOCUMENT_VERIFIED";
  console.log(
    test2Pass
      ? `✅ PASS - Correctly blocked (403 DOCUMENT_VERIFIED)`
      : `❌ FAIL - Expected 403, got ${deleteVerifiedNoForce.status}`
  );

  // Step 7: Test force delete → SHOULD SUCCEED WITH CASCADE
  console.log("\n[TEST 3] Force delete verified document...");
  const deleteVerifiedForce = await request(
    "DELETE",
    `/api/issuer/document/${verifiedDocId}?force=true`,
    {
      token: issuerToken,
    }
  );

  const test3Pass =
    deleteVerifiedForce.status === 200 &&
    deleteVerifiedForce.data?.success === true &&
    deleteVerifiedForce.data?.verificationsCascaded > 0;
  console.log(
    test3Pass
      ? `✅ PASS - Force deleted with cascade (${deleteVerifiedForce.data?.verificationsCascaded} verifications removed)`
      : `❌ FAIL - Status ${deleteVerifiedForce.status}`
  );

  // Step 8: Verify document no longer exists
  console.log("\n[TEST 4] Verify document cascade deleted...");
  const getDeleted = await request("GET", `/api/issuer/${issuerId}/batches`, {
    token: issuerToken,
  });

  // Check if either document appears in any batch
  let docStillExists = false;
  if (Array.isArray(getDeleted.data)) {
    docStillExists = getDeleted.data.some(batch =>
      batch.documents && batch.documents.some(doc =>
        doc.id === unverifiedDocId || doc.id === verifiedDocId
      )
    );
  }

  const test4Pass = !docStillExists;
  console.log(
    test4Pass
      ? "✅ PASS - Deleted documents not found in batches"
      : "❌ FAIL - Deleted documents still appear in active batches"
  );

  // Summary
  const allPass = test1Pass && test2Pass && test3Pass && test4Pass;
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY:");
  console.log(`  Test 1 (normal delete):             ${test1Pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Test 2 (403 on verified):           ${test2Pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Test 3 (force delete cascade):      ${test3Pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  Test 4 (verify cascade):            ${test4Pass ? "✅ PASS" : "❌ FAIL"}`);
  console.log("=".repeat(60));
  console.log(`\nDELETE_FIX: ${allPass ? "PASS" : "FAIL"}\n`);

  process.exit(allPass ? 0 : 1);
}

run().catch((error) => {
  console.error("❌ Test error:", error);
  process.exit(1);
});
