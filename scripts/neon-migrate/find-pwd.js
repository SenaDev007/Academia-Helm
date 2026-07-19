const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  // Check if user has a password
  const u = await client.query(`SELECT email, password IS NOT NULL as has_pwd FROM users WHERE email = 'salumerhel2036@gmail.com'`);
  console.log('User:', JSON.stringify(u.rows, null, 2));
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
