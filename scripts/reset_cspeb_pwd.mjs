import pg from 'pg';
import bcrypt from 'bcryptjs';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const newPwd = 'TestEveil2026!';
const hash = await bcrypt.hash(newPwd, 10);

const r = await client.query(`
  UPDATE users SET "passwordHash" = $1
  WHERE email = 'salumerhel2036@gmail.com'
  RETURNING id, email, role, "tenantId"
`, [hash]);
console.log('Updated:', r.rows[0]);

// Verify via API with the right tenant header
const loginRes = await fetch('https://api.academiahelm.com/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-tenant-id': 'cspeb-eveildafriqueeducation',
  },
  body: JSON.stringify({ email: 'salumerhel2036@gmail.com', password: newPwd }),
});
console.log('Login test status:', loginRes.status, loginRes.status === 200 ? '✓ SUCCESS' : '✗ FAILED');
if (loginRes.status !== 200) {
  console.log('Response:', await loginRes.text());
} else {
  const data = await loginRes.json();
  console.log('Token (first 40):', data.accessToken?.substring(0, 40));
}

await client.end();
