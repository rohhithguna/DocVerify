# DocuVerify - Quick Start Testing Guide

## Prerequisites

1. **Generate RSA Keys:**
```bash
cd /Users/rohhithg/Desktop/DocuTrustChain
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
```

2. **Get Blockchain Access:**
- Sign up at https://infura.io (free tier)
- Create project → get Sepolia RPC URL
- Create wallet at https://metamask.io
- Get Sepolia testnet ETH from https://sepoliafaucet.com

3. **Create .env file:**
```bash
cp .env.example .env
```

4. **Edit .env with your values:**
```bash
# Copy entire content of private.pem (including BEGIN/END lines)
SIGNING_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...paste here...
-----END PRIVATE KEY-----"

# Copy entire content of public.pem
SIGNING_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
...paste here...
-----END PUBLIC KEY-----"

# Your Infura URL
BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# Your wallet private key from MetaMask (Settings → Security → Export Private Key)
BLOCKCHAIN_PRIVATE_KEY=0x...your key...

DATABASE_URL=postgresql://user:password@localhost:5432/docuverify
```

---

## Testing Workflow

### Step 1: Start Server

```bash
npm install
npm run dev
```

**Expected output:**
```
✓ Cryptographic keys loaded from environment variables
✓ Blockchain configuration validated for network: sepolia
serving on port 5000
```

### Step 2: Test Issuer Upload

1. Open http://localhost:5000
2. Click **"Continue as Issuer"**
3. Create test CSV file `test_batch.csv`:
   ```csv
   name,id,department,email
   John Doe,12345,Engineering,john@example.com
   Jane Smith,67890,Engineering,jane@example.com
   Bob Johnson,11111,Sales,bob@example.com
   ```

4. Upload file and fill form:
   - **Issuer Name:** Test University
   - **Batch Name:** December 2025 Batch
   - **Grouping:** Department

5. Click **"Process & Sign"**

**What to watch for:**
- Processing animation shows 5 steps
- Console logs show: `Group 0 Merkle root stored on blockchain`
- Console logs show: `Group 1 Merkle root stored on blockchain`
- Batch appears in table with "Completed" status

### Step 3: Test Verification (Success Case)

1. Click **"Back to Home"** → **"Continue as Verifier"**
2. Create single-row CSV `verify.csv`:
   ```csv
   name,id,department,email
   John Doe,12345,Engineering,john@example.com
   ```

3. Upload file

**Expected Result:**
```json
{
  "digitalSignatureValid": true,
  "merkleProofValid": true,
  "blockchainVerified": true,
  "confidenceScore": 100
}
```

UI should show:
- Green circle with "100%"
- ✓ Digital Signature: Valid
- ✓ Blockchain Verification: Confirmed
- ✓ Merkle Proof: Valid
- Issuer: Test University

### Step 4: Test Verification (Failure Case)

Create CSV with wrong data:
```csv
name,id,department,email
WRONG NAME,99999,Unknown,fake@example.com
```

**Expected Result:**
```json
{
  "digitalSignatureValid": false,
  "merkleProofValid": false,
  "blockchainVerified": false,
  "confidenceScore": 0
}
```

---

## Troubleshooting

### Server won't start

**Error:** "Missing required environment variables"
- **Fix:** Check .env file exists and has all required variables
- **Fix:** Ensure keys include BEGIN/END lines
- **Fix:** Blockchain private key must be exactly 66 characters (0x + 64 hex)

**Error:** "Invalid key format"
- **Fix:** Re-generate RSA keys with OpenSSL commands
- **Fix:** Copy ENTIRE content including -----BEGIN----- and -----END-----

### Verification always fails

**Error:** `confidenceScore: 0`
- **Fix:** Ensure CSV row data EXACTLY matches uploaded batch
- **Fix:** Column names AND values must match
- **Fix:** Same column order helps but not required (sorted alphabetically)

### Merkle proof missing

**Check console logs for:** `Group X Merkle root stored on blockchain`
- If only "Group 0" appears → BUG #7 not fixed correctly
- Should see one log per group

---

## Test Cases

### Test Case 1: Single Group
**CSV:** All same department
**Expected:** 1 blockchain transaction, all docs verified

### Test Case 2: Multiple Groups
**CSV:** 2+ departments  
**Expected:** 2+ blockchain transactions, all docs verified

### Test Case 3: Invalid Document
**CSV:** Modified data
**Expected:** score = 0, all checks fail

### Test Case 4: Partial Match
**CSV:** Correct name/id but wrong department
**Expected:** Hash doesn't match, score = 0

---

## Success Indicators

✅ Server starts with green checkmarks  
✅ Issuer upload completes in ~30 seconds  
✅ Multiple "Group X Merkle root" logs appear  
✅ Batch shows "Completed" status  
✅ Valid document verification = 100% score  
✅ Invalid document verification = 0% score  
✅ No server crashes on errors  

---

## Common Issues

**Issue:** Upload takes forever  
**Cause:** Blockchain transaction blocking (BUG #9 - not fixed yet)  
**Workaround:** Wait 15-30 seconds for Sepolia confirmation

**Issue:** Some documents don't verify  
**Cause:** Part of group 2+ that didn't get Merkle proof  
**Check:** Was BUG #7 fix applied? Look for multiple blockchain logs

**Issue:** All verifications fail  
**Cause:** Hash computation mismatch  
**Check:** Was BUG #8 fix applied? Verifier should parse CSV, not extract metadata

---

## Next Steps After Testing

1. **If verification works:** ✅ Phase 1 complete
2. **Implement database:** Fix BUG #1 (replace MemStorage)  
3. **Optimize blockchain:** Fix BUG #9 (async transactions)
4. **Add authentication:** Fix BUG #4 (no auth system)

---

**Quick Reference:**

| Action | URL |
|--------|-----|
| Landing | http://localhost:5000 |
| Issuer | http://localhost:5000/issuer/{issuerId} |
| Verifier | http://localhost:5000/verifier/{verifierId} |

**Test CSVs Location:**
```bash
/Users/rohhithg/Desktop/DocuTrustChain/test_data/
```

(Create this folder and save your test CSVs there)
