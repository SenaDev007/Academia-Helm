/**
 * Simule la requête exacte envoyée par le frontend lors de la modification
 * de l'élève AKPOVI pour identifier le message d'erreur 400 du backend.
 */
const https = require('https');

const API_BASE = 'https://api.academiahelm.com';
const STUDENT_ID = 'c9a4b7d0-fadd-40a8-8ec0-c472772b5708';  // AKPOVI
const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const EMAIL = 'salumerhel2036@gmail.com';
const PASSWORD = 'CSPEB.fondé2021';

function httpReq(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers,
      },
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  // 1. Login
  console.log('1. Login as salumerhel2036@gmail.com...');
  const loginRes = await httpReq('POST', '/api/auth/login', {
    email: EMAIL,
    password: PASSWORD,
    tenant_id: TENANT_ID,
  });
  console.log('   Status:', loginRes.status);
  if (loginRes.status !== 200) {
    console.log('   Body:', JSON.stringify(loginRes.body, null, 2).substring(0, 500));
    return;
  }
  const accessToken = loginRes.body.accessToken || loginRes.body.access_token;
  console.log('   accessToken:', accessToken ? `[${accessToken.substring(0, 30)}...]` : 'MISSING');

  // Le header x-school-level-id est requis pour certains endpoints ; récupérer depuis /students/:id d'abord
  console.log('\n2. GET student pour récupérer schoolLevelId...');
  const getRes = await httpReq('GET', `/api/students/${STUDENT_ID}`, null, {
    'Authorization': `Bearer ${accessToken}`,
    'X-Tenant-ID': TENANT_ID,
    'x-tenant-id': TENANT_ID,
  });
  console.log('   Status:', getRes.status);

  // 3. Tester le PUT avec le payload exact du frontend
  console.log('\n3. PUT /api/students/{id} avec payload du frontend...');

  // === Payload #1 : minimal — juste nom + date ===
  const payload1 = {
    firstName: 'AKPOVI TOHOU',
    lastName: 'Sèhomie Pénielle Béroukhyah',
    dateOfBirth: new Date('2023-08-20').toISOString(),
  };
  console.log('\n=== Test 1 : payload minimal (nom + date) ===');
  console.log('   Payload:', JSON.stringify(payload1, null, 2));
  const res1 = await httpReq('PUT', `/api/students/${STUDENT_ID}`, payload1, {
    'Authorization': `Bearer ${accessToken}`,
    'X-Tenant-ID': TENANT_ID,
    'x-tenant-id': TENANT_ID,
    'x-school-level-id': 'ea2e2f8a-d1bf-4c25-a4fd-8a48ad989f80',
  });
  console.log('   Status:', res1.status);
  console.log('   Body:', JSON.stringify(res1.body, null, 2).substring(0, 2000));

  if (res1.status === 200) {
    // Restaurer les valeurs d'origine pour la suite des tests
    console.log('\n   → Restauration des valeurs initiales pour les tests suivants...');
    await httpReq('PUT', `/api/students/${STUDENT_ID}`, {
      firstName: 'Béroukhyah',
      lastName: 'AKPOVI TOHOU',
      dateOfBirth: '2023-08-20T00:00:00.000Z',
    }, {
      'Authorization': `Bearer ${accessToken}`,
      'X-Tenant-ID': TENANT_ID,
      'x-tenant-id': TENANT_ID,
    });
  }

  // === Payload #2 : complet comme le frontend ===
  const payload2 = {
    firstName: 'Sèhomie Pénielle Béroukhyah',
    lastName: 'AKPOVI TOHOU',
    dateOfBirth: new Date('2023-08-20').toISOString(),
    gender: 'F',
    nationality: 'Béninoise',
    placeOfBirth: 'Parakou',
    npi: 'null',  // la DB a la chaîne "null"
  };
  console.log('\n=== Test 2 : payload complet (frontend) ===');
  console.log('   Payload:', JSON.stringify(payload2, null, 2));
  const res2 = await httpReq('PUT', `/api/students/${STUDENT_ID}`, payload2, {
    'Authorization': `Bearer ${accessToken}`,
    'X-Tenant-ID': TENANT_ID,
    'x-tenant-id': TENANT_ID,
    'x-school-level-id': 'ea2e2f8a-d1bf-4c25-a4fd-8a48ad989f80',
  });
  console.log('   Status:', res2.status);
  console.log('   Body:', JSON.stringify(res2.body, null, 2).substring(0, 2000));

  // === Payload #3 : sans npi (au cas où "null" pose problème) ===
  const payload3 = {
    firstName: 'Sèhomie Pénielle Béroukhyah',
    lastName: 'AKPOVI TOHOU',
    dateOfBirth: new Date('2023-08-20').toISOString(),
    gender: 'F',
    nationality: 'Béninoise',
    placeOfBirth: 'Parakou',
  };
  console.log('\n=== Test 3 : sans npi ===');
  const res3 = await httpReq('PUT', `/api/students/${STUDENT_ID}`, payload3, {
    'Authorization': `Bearer ${accessToken}`,
    'X-Tenant-ID': TENANT_ID,
    'x-tenant-id': TENANT_ID,
    'x-school-level-id': 'ea2e2f8a-d1bf-4c25-a4fd-8a48ad989f80',
  });
  console.log('   Status:', res3.status);
  console.log('   Body:', JSON.stringify(res3.body, null, 2).substring(0, 2000));

  // === Test 4 : un champ non whitelisté pour confirmer que forbidNonWhitelisted marche ===
  const payload4 = {
    firstName: 'Test',
    lastName: 'Test',
    classId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  // ← non whitelisté !
  };
  console.log('\n=== Test 4 : avec classId (non whitelisté) ===');
  const res4 = await httpReq('PUT', `/api/students/${STUDENT_ID}`, payload4, {
    'Authorization': `Bearer ${accessToken}`,
    'X-Tenant-ID': TENANT_ID,
    'x-tenant-id': TENANT_ID,
    'x-school-level-id': 'ea2e2f8a-d1bf-4c25-a4fd-8a48ad989f80',
  });
  console.log('   Status:', res4.status);
  console.log('   Body:', JSON.stringify(res4.body, null, 2).substring(0, 2000));
}

main().catch(e => { console.error('Erreur:', e); process.exit(1); });
