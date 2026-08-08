const pg = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Check if the class exists
  const r = await client.query(`
    SELECT c.id, c.name, c."tenantId", c."schoolLevelId"
    FROM classes c
    WHERE c.id = 'f33e8383-627d-4ecb-8a91-4e084eb13075'
  `);
  console.log('Class lookup (no tenant filter):', r.rows[0] || 'NOT FOUND');

  // Check with tenant filter
  const r2 = await client.query(`
    SELECT c.id, c.name, c."tenantId"
    FROM classes c
    WHERE c.id = 'f33e8383-627d-4ecb-8a91-4e084eb13075' AND c."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
  `);
  console.log('Class lookup (with tenant):', r2.rows[0] || 'NOT FOUND');

  // Check what tenantId the class actually has
  if (r.rows.length > 0) {
    console.log('Class tenantId:', r.rows[0].tenantId);
    console.log('Expected tenantId: 59b8c348-ae5f-4d67-8fbd-af6aefa1f394');
    console.log('Match:', r.rows[0].tenantId === '59b8c348-ae5f-4d67-8fbd-af6aefa1f394');
  }

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
