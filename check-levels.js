const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  // Check if the schoolLevelId exists
  const level1 = await client.query('SELECT id, name FROM school_levels WHERE id = $1', ['ebc3251d-bf4d-4d60-b68c-2102227f3477']);
  console.log('Level ebc3251d:', level1.rows);
  
  const level2 = await client.query('SELECT id, name FROM school_levels WHERE id = $1', ['6ec8a1e5-df45-43f2-afbc-266ed153b828']);
  console.log('Level 6ec8a1e5:', level2.rows);
  
  // List all school levels for this tenant
  const allLevels = await client.query('SELECT id, name, code FROM school_levels WHERE "tenantId" = $1', ['e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb']);
  console.log('All levels for tenant:', allLevels.rows);
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
