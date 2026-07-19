const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  // Get the current hash to understand the format
  const u = await client.query(`SELECT email, "passwordHash" FROM users WHERE email = 'salumerhel2036@gmail.com'`);
  if (u.rows.length > 0) {
    const hash = u.rows[0].passwordHash;
    console.log('Hash prefix:', hash.substring(0, 10));
    console.log('Hash length:', hash.length);
    console.log('Looks like bcrypt:', hash.startsWith('$2'));
  }
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
