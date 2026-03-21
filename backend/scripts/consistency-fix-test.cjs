#!/usr/bin/env node

const QRCode = require("qrcode");

const BASE_URL = process.env.CONSISTENCY_TEST_BASE_URL || "http://localhost:5000";

let passCount = 0;
let failCount = 0;

function pass(message) {
  passCount += 1;
  console.log(`✅ ${message}`);
}

function fail(message) {
  failCount += 1;
  console.log(`❌ ${message}`);
}

async function jsonRequest(method, path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return { res, data };
}

async function multipartRequest(path, formData) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    body: formData,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return { res, data };
}

async function setupIssuer() {
  const email = `consistency-${Date.now()}@test.com`;
  const password = "TestPassword123";

  const register = await jsonRequest("POST", "/api/auth/register", {
    email,
    password,
    name: "Consistency Issuer",
    organization: "Consistency QA",
  });

  if (!register.res.ok || !register.data?.user?.id) {
    throw new Error(`Register failed: ${register.res.status} ${JSON.stringify(register.data)}`);
  }

  const issuerId = register.data.user.id;

  const login = await jsonRequest("POST", "/api/auth/login", {
    email,
    password,
  });

  if (!login.res.ok || !login.data?.token) {
    throw new Error(`Login failed: ${login.res.status} ${JSON.stringify(login.data)}`);
  }

  return { issuerId, token: login.data.token };
}

async function run() {
  console.log("\n🧪 CONSISTENCY_FIX test starting\n");

  try {
    const { issuerId, token } = await setupIssuer();
    const certificateId = `CERT-CONS-${Date.now()}`;

    const createPayload = {
      holder: {
        name: "Consistency User",
        studentId: `SID-${Date.now()}`,
        email: "consistency.user@test.com",
      },
      certificateDetails: {
        certificateId,
        course: "System Consistency",
        level: "Advanced",
        duration: "12 weeks",
      },
      issuer: {
        issuerName: "Consistency QA",
        issuerId,
        issuerWallet: "0x1234567890abcdef1234567890ABCDEF12345678",
      },
      validity: {
        issueDate: "2026-03-19",
        expiryDate: "2027-03-19",
        status: "ACTIVE",
      },
      security: {
        txHash: "",
        merkleRoot: "",
      },
      signature: {
        signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        signedBy: "Consistency QA",
      },
      verification: {
        qrCodeUrl: `${BASE_URL}/verify/${encodeURIComponent(certificateId)}`,
      },
    };

    const createRes = await jsonRequest("POST", `/api/issuer/${issuerId}/create-certificate`, createPayload, token);
    if (!createRes.res.ok || !createRes.data?.documentId) {
      throw new Error(`Create certificate failed: ${createRes.res.status} ${JSON.stringify(createRes.data)}`);
    }

    const documentId = createRes.data.documentId;

    // 1. Delete once should succeed.
    const deleteRes = await jsonRequest("DELETE", `/api/issuer/document/${documentId}`, null, token);
    if (deleteRes.res.ok && deleteRes.data?.success) {
      pass("Delete -> backend success response");
    } else {
      fail(`Delete -> expected success, got ${deleteRes.res.status} ${JSON.stringify(deleteRes.data)}`);
    }

    // 2. Delete again should not crash with 500.
    const deleteAgainRes = await jsonRequest("DELETE", `/api/issuer/document/${documentId}`, null, token);
    if (deleteAgainRes.res.status !== 500) {
      pass("Delete again -> no backend crash (non-500 response)");
    } else {
      fail(`Delete again -> got 500 ${JSON.stringify(deleteAgainRes.data)}`);
    }

    // 3. Verify deleted certificate by QR URL -> should return NOT_FOUND.
    const qrVerifyUrl = `${BASE_URL}/verify/${encodeURIComponent(certificateId)}`;
    const qrBuffer = await QRCode.toBuffer(qrVerifyUrl, { type: "png", width: 256, margin: 1 });

    const formData = new FormData();
    formData.append("verifierId", "consistency-tester");
    formData.append("file", new Blob([qrBuffer], { type: "image/png" }), "deleted-cert-qr.png");

    const verifyRes = await multipartRequest("/api/verifier/verify", formData);

    if (verifyRes.res.ok && verifyRes.data?.status === "NOT_FOUND") {
      pass("Verify deleted certificate -> NOT_FOUND");
    } else {
      fail(`Verify deleted certificate -> expected NOT_FOUND, got ${verifyRes.res.status} ${JSON.stringify(verifyRes.data)}`);
    }

    // 4. Ensure no backend 500 in tested flow.
    const hadServerError = [deleteRes.res.status, deleteAgainRes.res.status, verifyRes.res.status].some((status) => status === 500);
    if (!hadServerError) {
      pass("No backend 500 errors in consistency flow");
    } else {
      fail("Unexpected backend 500 error detected in consistency flow");
    }

    console.log("\n-------------------------------------");
    console.log(`Passed: ${passCount}`);
    console.log(`Failed: ${failCount}`);

    if (failCount === 0) {
      console.log("\nCONSISTENCY_FIX: PASS\n");
      process.exit(0);
    }

    console.log("\nCONSISTENCY_FIX: FAIL\n");
    process.exit(1);
  } catch (error) {
    console.log(`❌ Test execution failed: ${error.message}`);
    console.log("\nCONSISTENCY_FIX: FAIL\n");
    process.exit(1);
  }
}

run();
