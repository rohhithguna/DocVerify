const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');
const QRCode = require('qrcode');
const { spawn } = require('child_process');

const BASE = 'http://localhost:5011';
const results = [];

function add(name, pass, details) {
  results.push({ name, pass: !!pass, details: details || '' });
}

async function req(method, p, body, token) {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function waitForServer(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (_) {
      // continue polling
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

(async () => {
  const run = Date.now();
  const email = 'system_' + run + '@example.com';
  const password = 'secret123';
  const certId = 'CERT-SYS-' + run;
  const studentId = 'SID-SYS-' + run;
  const verifierId = 'verifier-' + run;

  const reg = await req('POST', '/api/auth/register', { email, password, name: 'System QA' });
  const login = await req('POST', '/api/auth/login', { email, password });
  const token = login.data && login.data.token;
  const issuerId = login.data && login.data.user && login.data.user.id;

  add('auth bootstrap', reg.status === 201 && login.status === 200 && !!token && !!issuerId, 'register=' + reg.status + ' login=' + login.status);

  const payload = {
    holder: { name: 'Alice System', studentId, email: 'alice.system@example.com' },
    certificateDetails: {
      certificateId: certId,
      course: 'Full Lifecycle QA',
      level: 'Advanced',
      duration: '10 weeks',
      grade: 'A+',
    },
    issuer: {
      issuerName: 'DocuTrust Institute',
      issuerId: 'ISS-001',
      issuerWallet: '0x1234567890abcdef1234567890ABCDEF12345678',
    },
    validity: {
      issueDate: '2026-03-19',
      expiryDate: '2027-03-19',
      status: 'ACTIVE',
    },
    security: { hash: '', txHash: '', merkleRoot: '' },
    signature: {
      signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5m9nQAAAAASUVORK5CYII=',
      signedBy: 'System QA Issuer',
    },
    verification: { qrCodeUrl: BASE + '/verify/' + certId },
  };

  const issue = await req('POST', '/api/issuer/' + issuerId + '/create-certificate', payload, token);
  const issuePass = issue.status === 200 && typeof issue.data.hash === 'string' && issue.data.hash.length === 64 && typeof issue.data.txHash === 'string' && issue.data.txHash.startsWith('0x');
  add('create/sign/store hash+tx', issuePass, 'status=' + issue.status + ' hash=' + issue.data.hash + ' txHash=' + issue.data.txHash);

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const dbRow = await client.query(
    "select c.certificate_id, c.hash as cert_hash, c.tx_hash, c.signature, c.status as cert_status, d.id as document_id, d.batch_id, d.document_hash, d.hash as doc_hash, d.revoked from certificates c left join documents d on d.id = c.document_id where c.certificate_id = $1 limit 1",
    [certId]
  );
  const row = dbRow.rows[0] || null;

  add('db persistence on issue', !!row && !!row.tx_hash && !!row.signature && !!row.cert_hash && !!row.document_hash, row ? ('certHash=' + row.cert_hash + ' docHash=' + row.document_hash + ' txHash=' + row.tx_hash) : 'row missing');
  add('hash consistency', !!row && row.cert_hash === row.document_hash && row.cert_hash === issue.data.hash, row ? ('cert=' + row.cert_hash + ' doc=' + row.document_hash + ' api=' + issue.data.hash) : 'row missing');

  const verifyValid = await req('POST', '/api/verifier/verify-metadata', {
    verifierId,
    name: 'Alice System',
    course: 'Full Lifecycle QA',
    issuer: 'DocuTrust Institute',
    date: '2026-03-19',
    certificateId: certId,
  });
  add('verify valid', verifyValid.status === 200 && verifyValid.data.message === 'VALID' && verifyValid.data.isValid === true, 'status=' + verifyValid.status + ' msg=' + verifyValid.data.message);

  const qrPng = await QRCode.toBuffer(BASE + '/verify/' + certId, { width: 220, margin: 1 });
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(qrPng)], { type: 'image/png' }), certId + '.png');
  form.append('verifierId', verifierId);
  const qrRaw = await fetch(BASE + '/api/verifier/verify', { method: 'POST', body: form });
  const qrData = await qrRaw.json().catch(() => ({}));
  add('qr scan verify', qrRaw.status === 200 && qrData.message === 'VALID', 'status=' + qrRaw.status + ' msg=' + qrData.message);

  const verifyTamper = await req('POST', '/api/verifier/verify-metadata', {
    verifierId,
    name: 'Alice System',
    course: 'Full Lifecycle QA - Tampered',
    issuer: 'DocuTrust Institute',
    date: '2026-03-19',
    certificateId: certId,
  });
  add('tamper invalid', verifyTamper.status === 200 && verifyTamper.data.message === 'INVALID' && verifyTamper.data.isValid === false, 'status=' + verifyTamper.status + ' msg=' + verifyTamper.data.message);

  const batchId = row && row.batch_id;
  const revoke = await req('POST', '/api/issuer/revoke', { batchId }, token);
  add('revoke action', revoke.status === 200, 'status=' + revoke.status + ' msg=' + (revoke.data.message || ''));

  const revokedDoc = await client.query('select revoked from documents where id = $1', [row && row.document_id]);
  add('db revoked marked', revokedDoc.rows[0] && revokedDoc.rows[0].revoked === true, 'revoked=' + (revokedDoc.rows[0] ? revokedDoc.rows[0].revoked : 'null'));

  const verifyRevoked = await req('POST', '/api/verifier/verify-metadata', {
    verifierId,
    name: 'Alice System',
    course: 'Full Lifecycle QA',
    issuer: 'DocuTrust Institute',
    date: '2026-03-19',
    certificateId: certId,
  });
  add('verify revoked', verifyRevoked.status === 200 && verifyRevoked.data.message === 'REVOKED' && verifyRevoked.data.isRevoked === true, 'status=' + verifyRevoked.status + ' msg=' + verifyRevoked.data.message);

  const stats = await req('GET', '/api/issuer/' + issuerId + '/stats');
  const statsPass = stats.status === 200 && typeof stats.data.totalDocuments === 'number' && stats.data.totalDocuments >= 1 && typeof stats.data.totalBatches === 'number' && stats.data.totalBatches >= 1;
  add('dashboard stats sanity', statsPass, JSON.stringify(stats.data));

  const formPath = path.join(process.cwd(), 'frontend/src/components/certificate-form.tsx');
  const templatePath = path.join(process.cwd(), 'frontend/src/components/certificate-template.tsx');
  const formCode = fs.readFileSync(formPath, 'utf8');
  const templateCode = fs.readFileSync(templatePath, 'utf8');

  const previewPass = formCode.includes('Generate Certificate') && formCode.includes('previewData') && formCode.includes('Proceed to Sign');
  add('preview flow present', previewPass, 'markers found in certificate-form.tsx');

  const signatureUiPass = templateCode.includes('Digitally signed by') && templateCode.includes('signatureDataUrl');
  add('signature displayed UI', signatureUiPass, 'markers found in certificate-template.tsx');

  await client.end();

  const env = {
    ...process.env,
    PORT: '5012',
    BLOCKCHAIN_RPC_URL: 'http://127.0.0.1:8545',
    BLOCKCHAIN_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    DOCUTRUST_CONTRACT_ADDRESS: process.env.DOCUTRUST_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    DOCTRUST_CONTRACT_ADDRESS: process.env.DOCTRUST_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    BLOCKCHAIN_NETWORK: 'localhost',
  };

  const child = spawn('npm', ['run', 'dev'], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] });
  const ready = await waitForServer('http://localhost:5012/api/blockchain/status', 30000);
  if (!ready) {
    add('db persistence after restart', false, 'restart server not reachable on 5012');
  } else {
    const after = await fetch('http://localhost:5012/api/certificate/' + encodeURIComponent(certId));
    const afterData = await after.json().catch(() => ({}));
    add('db persistence after restart', after.status === 200 && afterData.status === 'REVOKED', 'status=' + after.status + ' certStatus=' + afterData.status);
  }

  try {
    child.kill('SIGTERM');
  } catch (_) {
    // no-op
  }

  const failed = results.filter((r) => !r.pass);
  const summary = {
    checks: results,
    passed: results.length - failed.length,
    total: results.length,
    system_test: failed.length === 0 ? 'PASS' : 'FAIL',
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
