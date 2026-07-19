const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const newPwd = 'CSPEB.fondé2021';
  const hash = await bcrypt.hash(newPwd, 10);
  
  await client.query(`UPDATE users SET "passwordHash" = $1 WHERE email = 'salumerhel2036@gmail.com'`, [hash]);
  console.log('Password updated to:', newPwd);
  
  // Verify via API
  const r = await fetch('https://api.academiahelm.com/api/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-tenant-id': 'cspeb-eveildafriqueeducation'},
    body: JSON.stringify({email: 'salumerhel2036@gmail.com', password: newPwd})
  });
  console.log('Login test:', r.status, r.status === 200 ? 'SUCCESS' : 'FAILED');
  if (r.status === 200) {
    const data = await r.json();
    console.log('Token:', data.accessToken?.substring(0, 30) + '...');
  } else {
    const data = await r.json();
    console.log('Error:', JSON.stringify(data));
  }
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
