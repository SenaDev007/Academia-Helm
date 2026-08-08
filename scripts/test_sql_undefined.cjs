const pg = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Test 1: With tenantId
  const r1 = await client.query('SELECT id FROM "classes" WHERE id = $1 AND "tenantId" = $2 LIMIT 1', ['f33e8383-627d-4ecb-8a91-4e084eb13075', '59b8c348-ae5f-4d67-8fbd-af6aefa1f394']);
  console.log('With tenantId:', r1.rows.length, 'rows');

  // Test 2: With undefined tenantId (simulates the bug)
  const r2 = await client.query('SELECT id FROM "classes" WHERE id = $1 AND "tenantId" = $2 LIMIT 1', ['f33e8383-627d-4ecb-8a91-4e084eb13075', undefined]);
  console.log('With undefined tenantId:', r2.rows.length, 'rows');

  // Test 3: Without tenantId
  const r3 = await client.query('SELECT id FROM "classes" WHERE id = $1 LIMIT 1', ['f33e8383-627d-4ecb-8a91-4e084eb13075']);
  console.log('Without tenantId:', r3.rows.length, 'rows');

  await client.end();
}
main().catch(e => console.error(e.message));
