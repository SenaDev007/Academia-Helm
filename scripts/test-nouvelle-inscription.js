/**
 * Test du bouton "Nouvelle inscription" — simule exactement ce que fait le frontend
 * pour identifier d'où vient l'erreur "school level is not defined"
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
  // 1. Login
  const login = await httpReq('POST', '/api/auth/login', {
    email: EMAIL, password: PASSWORD, tenant_id: TENANT_ID,
  });
  const token = login.body.accessToken;
  console.log('Login:', login.status, token ? 'OK' : 'FAIL');

  // 2. Test /api/students/pre-register SANS header x-school-level-id
  //    (simule un utilisateur qui n'a pas sélectionné de niveau scolaire dans le contexte)
  console.log('\n=== Test 1 : POST /api/students/pre-register SANS x-school-level-id ===');
  const payload = {
    academicYearId: 'a7593470-e4f4-460a-b3b6-4dabe53bec2a',
    schoolLevelId: 'ea2e2f8a-d1bf-4c25-a4fd-8a48ad989f80',
    firstName: 'Test',
    lastName: 'Test',
  };
  const res1 = await httpReq('POST', '/api/students/pre-register', payload, {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': TENANT_ID,
    // PAS de x-school-level-id
  });
  console.log('Status:', res1.status);
  console.log('Body:', JSON.stringify(res1.body, null, 2).substring(0, 800));
  if (res1.status === 201 || res1.status === 200) {
    // Supprimer l'élève test créé
    const testId = res1.body.id;
    if (testId) {
      console.log('   → Élève test créé, suppression:', testId);
      await httpReq('DELETE', `/api/students/${testId}`, null, {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': TENANT_ID,
      });
    }
  }

  // 3. Test /api/students (POST create direct) SANS header x-school-level-id
  console.log('\n=== Test 2 : POST /api/students (StudentsPrismaController.create) SANS x-school-level-id ===');
  const payload2 = {
    academicYearId: 'a7593470-e4f4-460a-b3b6-4dabe53bec2a',
    schoolLevelId: 'ea2e2f8a-d1bf-4c25-a4fd-8a48ad989f80',
    firstName: 'Test2',
    lastName: 'Test2',
  };
  const res2 = await httpReq('POST', '/api/students', payload2, {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': TENANT_ID,
    // PAS de x-school-level-id
  });
  console.log('Status:', res2.status);
  console.log('Body:', JSON.stringify(res2.body, null, 2).substring(0, 800));
  if ((res2.status === 201 || res2.status === 200) && res2.body?.id) {
    console.log('   → Élève test créé, suppression:', res2.body.id);
    await httpReq('DELETE', `/api/students/${res2.body.id}`, null, {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': TENANT_ID,
    });
  }

  // 4. Test /api/classes SANS header x-school-level-id (simule le useEffect du StudentEnrollmentForm)
  console.log('\n=== Test 3 : GET /api/classes (avec PaginationDto) SANS x-school-level-id ===');
  const res3 = await httpReq('GET', '/api/classes?limit=100', null, {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': TENANT_ID,
  });
  console.log('Status:', res3.status);
  console.log('Body:', JSON.stringify(res3.body, null, 2).substring(0, 800));

  // 5. Test /api/students/enrollments SANS header x-school-level-id
  console.log('\n=== Test 4 : GET /api/students/enrollments SANS x-school-level-id ===');
  const res4 = await httpReq('GET', '/api/students/enrollments?academicYearId=a7593470-e4f4-460a-b3b6-4dabe53bec2a', null, {
    'Authorization': `Bearer ${token}`,
    'X-Tenant-ID': TENANT_ID,
  });
  console.log('Status:', res4.status);
  console.log('Body:', JSON.stringify(res4.body, null, 2).substring(0, 800));
}

main().catch(e => { console.error(e); process.exit(1); });
