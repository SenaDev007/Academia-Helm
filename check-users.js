const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  // Find users for this tenant
  const users = await client.query(`
    SELECT id, email, role, "firstName", "lastName"
    FROM users 
    WHERE "tenantId" = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb'
    LIMIT 10
  `);
  console.log('Users:', JSON.stringify(users.rows, null, 2));
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
