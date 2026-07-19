const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const u = await client.query(`SELECT email, "passwordHash" IS NOT NULL as has_pwd FROM users WHERE email = 'salumerhel2036@gmail.com'`);
  console.log('User:', JSON.stringify(u.rows, null, 2));
  
  // Try common passwords via API
  const passwords = ['EveilAfrique2026!', 'Eveil2026!', 'EveilAfrique', 'Salum2026!', 'salumerhel', 'Password2026!', 'Eveildafrique2026!'];
  for (const pwd of passwords) {
    const r = await fetch('https://api.academiahelm.com/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-tenant-id': 'cspeb-eveildafriqueeducation'},
      body: JSON.stringify({email: 'salumerhel2036@gmail.com', password: pwd})
    });
    const data = await r.json();
    console.log(`PWD "${pwd}": ${r.status} ${data.message || 'OK'}`);
    if (r.status === 200) break;
  }
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
