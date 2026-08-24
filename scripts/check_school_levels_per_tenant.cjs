// Check school levels per tenant + match with subjects' schoolLevelId
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 30000,
    query_timeout: 60000,
  });
  await client.connect();

  // 1. Show all school levels with their tenantId
  const sls = await client.query(`
    SELECT sl."id", sl."name", sl."code", sl."tenantId"
    FROM "school_levels" sl
    ORDER BY sl."tenantId", sl."order";
  `);
  console.log('=== School levels by tenant ===');
  for (const r of sls.rows) {
    console.log(`  tenant=${r.tenantId?.substring(0,8)}... ${r.name} (${r.code}) — id=${r.id}`);
  }

  // 2. Check subjects' schoolLevelId matches school levels for the same tenant
  const matchCheck = await client.query(`
    SELECT s."id" as subject_id, s."name" as subject_name, s."tenantId" as subject_tenant,
           s."schoolLevelId", sl."tenantId" as level_tenant, sl."name" as level_name
    FROM "subjects" s
    LEFT JOIN "school_levels" sl ON sl."id" = s."schoolLevelId"
    WHERE sl."tenantId" IS NULL OR sl."tenantId" != s."tenantId"
    LIMIT 10;
  `);
  console.log(`\n=== Mismatched subjects (schoolLevelId from different tenant) ===`);
  console.log(`Count: ${matchCheck.rows.length}`);
  for (const r of matchCheck.rows) {
    console.log(`  ${r.subject_name} — subject tenant=${r.subject_tenant?.substring(0,8)}... level tenant=${r.level_tenant?.substring(0,8)}... (${r.level_name || 'NULL'})`);
  }

  await client.end();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
