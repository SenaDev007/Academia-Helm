/**
 * Test end-to-end du flux "Nouvelle inscription" avec photo + NPI
 * Simule : preRegister → uploadPhoto → admit
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

  // Génère une petite image JPEG 1x1 rouge en base64 (data URL valide)
  const photoDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD/2Q==';

  // 1. preRegister avec photoUrl (comme l'ancien code)
  console.log('\n=== Test 1 : preRegister AVEC photoUrl dans payload ===');
  const payload1 = {
    academicYearId: 'a7593470-e4f4-460a-b3b6-4dabe53bec2a',
    schoolLevelId: 'ea2e2f8a-d1bf-4c25-a4fd-8a48ad989f80',
    firstName: 'TestPhoto',
    lastName: 'TestNPI',
    npi: 'BJ-TEST-001',
    photoUrl: photoDataUrl,
  };
  const res1 = await httpReq('POST', '/api/students/pre-register', payload1, {
    'Authorization': `Bearer ${token}`, 'X-Tenant-ID': TENANT_ID,
  });
  console.log('Status:', res1.status);
  console.log('Réponse (extrait):', JSON.stringify({ id: res1.body?.id, npi: res1.body?.npi, photoUrl: res1.body?.photoUrl ? `[${res1.body.photoUrl.length} chars]` : null }));
  const student1Id = res1.body?.id;

  // Vérifier en DB si la photo a été persistée dans student_photos
  if (student1Id) {
    console.log('   → Élève créé, vérification photo...');
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
      ssl: { rejectUnauthorized: false },
    });
    const c = await pool.connect();
    try {
      const photoRow = await c.query('SELECT id, "originalUrl" FROM student_photos WHERE "studentId" = $1', [student1Id]);
      console.log('   → Photo en DB:', photoRow.rows.length ? `[${String(photoRow.rows[0].originalUrl || '').substring(0, 40)}...]` : 'AUCUNE');
      const studentRow = await c.query('SELECT npi, "photoUrl" FROM students WHERE id = $1', [student1Id]);
      console.log('   → Student.npi:', studentRow.rows[0]?.npi, '| Student.photoUrl:', studentRow.rows[0]?.photoUrl ? `[${studentRow.rows[0].photoUrl.length} chars]` : 'NULL');
    } finally { c.release(); await pool.end(); }
  }

  // 2. Test uploadPhoto séparé (pattern RH)
  if (student1Id) {
    console.log('\n=== Test 2 : uploadPhoto (endpoint dédié) ===');
    const res2 = await httpReq('POST', `/api/students/${student1Id}/upload-photo`, { photoDataUrl }, {
      'Authorization': `Bearer ${token}`, 'X-Tenant-ID': TENANT_ID,
    });
    console.log('Status:', res2.status);
    console.log('Réponse (extrait):', JSON.stringify({ id: res2.body?.id, originalUrl: res2.body?.originalUrl ? `[${res2.body.originalUrl.length} chars]` : null }));
  }

  // 3. Cleanup : supprimer l'élève test
  if (student1Id) {
    console.log('\n=== Cleanup : suppression élève test ===');
    // D'abord supprimer les photos, enrollments, etc.
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
      ssl: { rejectUnauthorized: false },
    });
    const c = await pool.connect();
    try {
      await c.query('DELETE FROM student_photos WHERE "studentId" = $1', [student1Id]);
      await c.query('DELETE FROM student_enrollments WHERE "studentId" = $1', [student1Id]);
      await c.query('DELETE FROM students WHERE id = $1', [student1Id]);
      console.log('   → Élève test supprimé');
    } finally { c.release(); await pool.end(); }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
