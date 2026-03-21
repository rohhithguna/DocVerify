#!/usr/bin/env node

const BASE_URL = process.env.VALIDATION_TEST_BASE_URL || "http://localhost:5000";

async function request(method, path, body, token) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { ok: response.ok, status: response.status, json };
}

async function registerAndLogin() {
  const email = `validation-fix-${Date.now()}@test.com`;
  const password = "TestPassword123";

  const registerRes = await request("POST", "/api/auth/register", {
    email,
    password,
    name: "Validation Fix Issuer",
    organization: "Validation QA",
  });

  if (!registerRes.ok) {
    throw new Error(`Register failed: ${registerRes.status} ${JSON.stringify(registerRes.json)}`);
  }

  const userId = registerRes.json?.user?.id;
  if (!userId) {
    throw new Error("Register response missing user.id");
  }

  const loginRes = await request("POST", "/api/auth/login", { email, password });
  if (!loginRes.ok || !loginRes.json?.token) {
    throw new Error(`Login failed: ${loginRes.status} ${JSON.stringify(loginRes.json)}`);
  }

  return { token: loginRes.json.token, userId };
}

async function run() {
  console.log("\n🧪 VALIDATION_FIX test starting\n");

  try {
    const { token, userId } = await registerAndLogin();

    const badPayload = {
      holder: {
        name: "John Doe",
        studentId: "SID-2026-001",
        email: "john@example.com",
      },
      certificateDetails: {
        certificateId: `CERT-${Date.now()}`,
        course: "Blockchain Security",
        level: "Advanced",
        duration: "12 weeks",
      },
      issuer: {
        issuerId: userId,
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
        signedBy: "Validation Fix Issuer",
      },
      verification: {
        qrCodeUrl: `http://localhost:5000/verify/CERT-${Date.now()}`,
      },
    };

    const res = await request(
      "POST",
      `/api/issuer/${userId}/create-certificate`,
      badPayload,
      token
    );

    const expectedError = "Missing field: issuerName";
    const gotError = res.json?.error;

    if (res.status === 400 && gotError === expectedError) {
      console.log("✅ Wrong input -> clear error response");
      console.log(`✅ Response: ${JSON.stringify(res.json)}`);
      console.log("\nVALIDATION_FIX: PASS\n");
      process.exit(0);
    }

    console.log("❌ Unexpected validation response");
    console.log(`Status: ${res.status}`);
    console.log(`Body: ${JSON.stringify(res.json)}`);
    console.log("\nVALIDATION_FIX: FAIL\n");
    process.exit(1);
  } catch (error) {
    console.log(`❌ Test execution failed: ${error.message}`);
    console.log("\nVALIDATION_FIX: FAIL\n");
    process.exit(1);
  }
}

run();
