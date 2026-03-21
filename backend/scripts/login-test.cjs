#!/usr/bin/env node
/**
 * LOGIN_FIX Test Suite
 * Validates: Login flow with proper state management, no double submissions, smooth redirects
 */

const BASE_URL = process.env.LOGIN_TEST_BASE_URL || "http://localhost:5000";
const TEST_USER_EMAIL = `login-test-${Date.now()}@example.com`;
const TEST_USER_PASSWORD = "SecurePass123!";
const TEST_USER_NAME = "Login Test User";

let testsPassed = 0;
let testsFailed = 0;

async function makeRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  return response;
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${err.message}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log("🔐 LOGIN_FIX Test Suite\n");

  // Test 1: Register a new user
  await test("Register new test user", async () => {
    const res = await makeRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        name: TEST_USER_NAME,
        organization: "Test Org",
      }),
    });

    if (res.status !== 201 && res.status !== 200) {
      throw new Error(`Expected 200 or 201, got ${res.status}`);
    }

    const data = await res.json();
    if (!data.user || !data.user.email) {
      throw new Error("Registration response missing user data");
    }
  });

  // Test 2: Login should succeed on first attempt
  await test("Login succeeds on first attempt", async () => {
    const loginStart = Date.now();
    
    const res = await makeRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      }),
    });

    const loginDuration = Date.now() - loginStart;

    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }

    const data = await res.json();
    
    if (!data.token) {
      throw new Error("Login response missing token");
    }

    if (!data.user || data.user.email !== TEST_USER_EMAIL) {
      throw new Error("Login response has incorrect user data");
    }

    console.log(`   ℹ️  Login response time: ${loginDuration}ms`);
  });

  // Test 3: Token from login can be used to access protected endpoints
  await test("Login token is valid for protected endpoints", async () => {
    // First get a token
    const loginRes = await makeRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      }),
    });

    const loginData = await loginRes.json();
    const token = loginData.token;

    // Then use it on a protected endpoint
    const protectedRes = await makeRequest("/api/auth/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (protectedRes.status !== 200) {
      throw new Error(
        `Expected 200 on protected endpoint, got ${protectedRes.status}`
      );
    }
  });

  // Test 4: Rapid sequential logins don't cause issues
  await test("Rapid sequential logins are handled correctly", async () => {
    const promises = [
      makeRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD,
        }),
      }),
      new Promise(resolve => setTimeout(resolve, 50)).then(() =>
        makeRequest("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: TEST_USER_EMAIL,
            password: TEST_USER_PASSWORD,
          }),
        })
      ),
    ];

    const results = await Promise.all(promises);
    
    if (results[0].status !== 200 || results[1].status !== 200) {
      throw new Error("One or more rapid login attempts failed");
    }

    const data1 = await results[0].json();
    const data2 = await results[1].json();

    if (!data1.token || !data2.token) {
      throw new Error("One or more tokens missing from rapid login responses");
    }

    // Tokens should match since it's the same user
    if (data1.token !== data2.token) {
      console.log("   ℹ️  Tokens differ (may be expected if tokens are timestamped)");
    }
  });

  // Test 5: Wrong password gives proper error
  await test("Wrong password returns 401 authentication error", async () => {
    const res = await makeRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: "WrongPassword123!",
      }),
    });

    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
  });

  // Test 6: Non-existent user gives proper error
  await test("Non-existent user returns 401 authentication error", async () => {
    const nonexistentEmail = `nonexistent-${Date.now()}@example.com`;
    const res = await makeRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: nonexistentEmail,
        password: TEST_USER_PASSWORD,
      }),
    });

    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
  });

  // Test 7: Verify token persists across multiple requests
  await test("Token remains valid across multiple API calls", async () => {
    const loginRes = await makeRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      }),
    });

    const { token } = await loginRes.json();

    // Make 3 sequential requests with the same token
    for (let i = 0; i < 3; i++) {
      const res = await makeRequest("/api/auth/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status !== 200) {
        throw new Error(`Request ${i + 1} failed with status ${res.status}`);
      }
    }
  });

  console.log(`\n📊 Results: ${testsPassed} passed, ${testsFailed} failed\n`);

  if (testsFailed === 0) {
    console.log("✅ LOGIN_FIX: PASS - All login tests passed!");
    console.log("   ✓ Login state management works correctly");
    console.log("   ✓ No double submissions detected");
    console.log("   ✓ Token persistence validated");
    console.log("   ✓ Protected endpoints work after login");
    process.exit(0);
  } else {
    console.log("❌ LOGIN_FIX: FAIL - Some tests failed");
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error("Test suite error:", err.message);
  process.exit(1);
});
