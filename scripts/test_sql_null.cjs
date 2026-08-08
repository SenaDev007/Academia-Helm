const pg = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Test with null
  const r1 = await client.query('SELECT id FROM "classes" WHERE id = $1 AND "tenantId" = $2 LIMIT 1', ['f33e8383-627d-4ecb-8a91-4e084eb13075', null]);
  console.log('With null tenantId:', r1.rows.length, 'rows');

  // Test with empty string
  const r2 = await client.query('SELECT id FROM "classes" WHERE id = $1 AND "tenantId" = $2 LIMIT 1', ['f33e8383-627d-4ecb-8a91-4e084eb13075', '']);
  console.log('With empty string tenantId:', r2.rows.length, 'rows');

  // Test the fallback condition: !tenantId when tenantId is null
  console.log('!null:', !null, '→ fallback triggers:', !null);
  console.log('!"":', !'', '→ fallback triggers:', !'');
  console.log('!"59b8...":', !'59b8c348', '→ fallback triggers:', !'59b8c348');

  await client.end();
}
main().catch(e => console.error(e.message));
