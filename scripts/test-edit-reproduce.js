/**
 * Reproduit l'erreur "property academicYearId should not exist"
 * en simulant le flux exact du mode édition du EnrollmentsContent.
 */
const https = require('https');

const API_BASE = 'https://api.academiahelm.com';
const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const EMAIL = 'salumerhel2036@gmail.com';
const PASSWORD = 'CSPEB.fondé2021';

function httpReq(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      method, hostname: url.hostname, path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...headers },
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request(opts, (res) => {
      let data = ''; res.on('data', c => data += c);
      res.on('end', () => { let p; try { p = JSON.parse(data); } catch { p = data; } resolve({ status: res.statusCode, body: p }); });
    });
    req.on('error', reject); if (payload) req.write(payload); req.end();
  });
}

async function main() {
  // Login
  const login = await httpReq('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD, tenant_id: TENANT_ID });
  const token = login.body.accessToken;
  console.log('Login:', login.status, token ? 'OK' : 'FAIL');

  // Trouver l'élève AKPOVI
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
    ssl: { rejectUnauthorized: false },
  });
  const c = await pool.connect();
  const r = await c.query(`SELECT id, "firstName", "lastName" FROM students WHERE "lastName" ILIKE '%AKPOVI%' LIMIT 1`);
  await c.release(); await pool.end();
  const studentId = r.rows[0].id;
  console.log('Élève:', r.rows[0].firstname, r.rows[0].lastname, '(', studentId, ')');

  // Test 1 : payload EXACT comme EnrollmentsContent mode édition (sans academicYearId)
  console.log('\n=== Test 1 : payload mode édition (sans academicYearId) ===');
  const payload1 = {
    firstName: 'Béroukhyah',
    lastName: 'AKPOVI TOHOU',
    dateOfBirth: '2023-08-20',
    gender: 'F',
    nationality: 'Béninoise',
    primaryLanguage: 'FR',
    npi: undefined,
    photoUrl: undefined,
    placeOfBirth: 'Parakou',
  };
  const res1 = await httpReq('PUT', `/api/students/${studentId}`, payload1, {
    'Authorization': `Bearer ${token}`, 'X-Tenant-ID': TENANT_ID,
  });
  console.log('Status:', res1.status);
  console.log('Body:', JSON.stringify(res1.body).substring(0, 600));

  // Test 2 : payload avec academicYearId (pour voir si le backend le rejette)
  console.log('\n=== Test 2 : payload avec academicYearId (devrait être rejeté) ===');
  const payload2 = { ...payload1, academicYearId: 'a7593470-e4f4-460a-b3b6-4dabe53bec2a' };
  const res2 = await httpReq('PUT', `/api/students/${studentId}`, payload2, {
    'Authorization': `Bearer ${token}`, 'X-Tenant-ID': TENANT_ID,
  });
  console.log('Status:', res2.status);
  console.log('Body:', JSON.stringify(res2.body).substring(0, 600));

  // Test 3 : payload avec academicYearId ET schoolLevelId
  console.log('\n=== Test 3 : payload avec academicYearId + schoolLevelId ===');
  const payload3 = { ...payload1, academicYearId: 'a7593470-e4f4-460a-b3b6-4dabe53bec2a', schoolLevelId: 'ea2e2f8a-d1bf-4c25-a4fd-8a48ad989f80' };
  const res3 = await httpReq('PUT', `/api/students/${studentId}`, payload3, {
    'Authorization': `Bearer ${token}`, 'X-Tenant-ID': TENANT_ID,
  });
  console.log('Status:', res3.status);
  console.log('Body:', JSON.stringify(res3.body).substring(0, 600));

  // Test 4 : dateOfBirth non converti en ISO (comme le frontend le fait)
  console.log('\n=== Test 4 : dateOfBirth string "2023-08-20" (non ISO) ===');
  const payload4 = { ...payload1, dateOfBirth: '2023-08-20' };
  const res4 = await httpReq('PUT', `/api/students/${studentId}`, payload4, {
    'Authorization': `Bearer ${token}`, 'X-Tenant-ID': TENANT_ID,
  });
  console.log('Status:', res4.status);
  console.log('Body:', JSON.stringify(res4.body).substring(0, 600));
}

main().catch(e => { console.error(e); process.exit(1); });
