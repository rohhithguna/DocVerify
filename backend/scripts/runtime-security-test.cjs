const BASE_URL = process.env.RUNTIME_SECURITY_BASE_URL || "http://localhost:5014";

async function request(method, path, { body, token, isForm } = {}) {
  const headers = isForm ? {} : { "content-type": "application/json" };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
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
      email: "alice.runtime@example.com",
    },
    certificateDetails: {
      certificateId,
      course: "Runtime Security",
      level: "Advanced",
      duration: "4 weeks",
      grade: "A",
    },
    issuer: {
      issuerName: "DocuTrust Institute",
      issuerId: "ISS-001",
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
      signature: "U2lnbmVkQnlSdW50aW1l",
      signedBy: "Runtime Signer",
    },
    verification: {
      qrCodeUrl: `${BASE_URL}/verify/${certificateId}`,
    },
  };
}

async function run() {
  const runId = Date.now();
  const userA = {
    email: `runtime_a_${runId}@example.com`,
    password: "Secret123!",
    name: "Runtime User A",
  };

  const userB = {
    email: `runtime_b_${runId}@example.com`,
    password: "Secret123!",
    name: "Runtime User B",
  };

  const regA = await request("POST", "/api/auth/register", { body: userA });
  const regB = await request("POST", "/api/auth/register", { body: userB });
  const loginA = await request("POST", "/api/auth/login", {
    body: { email: userA.email, password: userA.password },
  });
  const loginB = await request("POST", "/api/auth/login", {
    body: { email: userB.email, password: userB.password },
  });

  const tokenA = loginA.data?.token;
  const tokenB = loginB.data?.token;
  const issuerA = loginA.data?.user?.id;
  const issuerB = loginB.data?.user?.id;
  const holderNameB = `Alice Runtime ${runId}`;

  const createByB = await request(
    "POST",
    `/api/issuer/${issuerB}/create-certificate`,
    {
      body: certificatePayload(`CERT-B-${runId}`, `SID-B-${runId}`, holderNameB),
      token: tokenB,
    }
  );

  const batchesByB = await request("GET", `/api/issuer/${issuerB}/batches`, {
    token: tokenB,
  });

  const targetBatch = Array.isArray(batchesByB.data)
    ? batchesByB.data.find(
        (batch) =>
          batch?.issuerId === issuerB &&
          typeof batch?.batchName === "string" &&
          batch.batchName.includes(holderNameB)
      )
    : null;

  const batchId = targetBatch?.id;

  const unauthorizedCreate = await request(
    "POST",
    `/api/issuer/${issuerB}/create-certificate`,
    {
      body: certificatePayload(
        `CERT-AFORB-${runId}`,
        `SID-AFORB-${runId}`,
        `Alice Intruder ${runId}`
      ),
      token: tokenA,
    }
  );

  const unauthorizedRevoke = await request("POST", "/api/issuer/revoke", {
    body: { batchId },
    token: tokenA,
  });

  const noTokenStats = await request("GET", `/api/issuer/${issuerA}/stats`);
  const noTokenBatches = await request("GET", `/api/issuer/${issuerA}/batches`);

  const invalidTokenStats = await request("GET", `/api/issuer/${issuerA}/stats`, {
    token: "fake.jwt.token",
  });

  const formData = new FormData();
  formData.append("verifierId", "runtime-public-verifier");
  formData.append(
    "file",
    new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: "application/octet-stream" }),
    "test.bin"
  );

  const publicVerify = await request("POST", "/api/verifier/verify", {
    body: formData,
    isForm: true,
  });

  const checks = [
    {
      name: "UNAUTHORIZED_CREATE",
      expected: 403,
      actual: unauthorizedCreate.status,
      pass: unauthorizedCreate.status === 403,
    },
    {
      name: "UNAUTHORIZED_REVOKE",
      expected: 403,
      actual: unauthorizedRevoke.status,
      pass: unauthorizedRevoke.status === 403,
    },
    {
      name: "NO_TOKEN_STATS",
      expected: 401,
      actual: noTokenStats.status,
      pass: noTokenStats.status === 401,
    },
    {
      name: "NO_TOKEN_BATCHES",
      expected: 401,
      actual: noTokenBatches.status,
      pass: noTokenBatches.status === 401,
    },
    {
      name: "INVALID_TOKEN_STATS",
      expected: 401,
      actual: invalidTokenStats.status,
      pass: invalidTokenStats.status === 401,
    },
    {
      name: "PUBLIC_VERIFY_NO_TOKEN",
      expected: "not 401/403",
      actual: publicVerify.status,
      pass: ![401, 403].includes(publicVerify.status),
    },
  ];

  const failed = checks.filter((check) => !check.pass);
  const summary = {
    bootstrap: {
      registerA: regA.status,
      registerB: regB.status,
      loginA: loginA.status,
      loginB: loginB.status,
      issuerA,
      issuerB,
      issueByB: createByB.status,
      fetchedBatchIdForB: batchId || null,
    },
    evidence: {
      unauthorizedCreate: unauthorizedCreate.status,
      unauthorizedRevoke: unauthorizedRevoke.status,
      noTokenStats: noTokenStats.status,
      noTokenBatches: noTokenBatches.status,
      invalidTokenStats: invalidTokenStats.status,
      publicVerifyNoToken: publicVerify.status,
    },
    failedEndpoints: failed,
    runtimeSecurity: failed.length === 0 ? "PASS" : "FAIL",
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});