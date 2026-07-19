const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  // List columns of users table
  const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE '%pass%' OR column_name LIKE '%pwd%' OR column_name LIKE '%hash%'`);
  console.log('Password columns:', cols.rows.map(r => r.column_name));
  
  // Check auth_methods table
  const authMethods = await client.query(`SELECT * FROM auth_methods WHERE email = 'salumerhel2036@gmail.com' LIMIT 5`);
  console.log('Auth methods:', JSON.stringify(authMethods.rows.map(r => ({method: r.method, identifier: r.identifier, has_secret: !!r.secret})), null, 2));
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
