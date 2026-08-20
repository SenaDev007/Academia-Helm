// Verify subjects per tenant + school level
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

  // 1. List tenants with their school levels + subject count
  const tenantStats = await client.query(`
    SELECT t."id", t."name",
      COUNT(DISTINCT sl."id") as school_levels_count,
      COUNT(DISTINCT s."id") as subjects_count
    FROM "tenants" t
    LEFT JOIN "school_levels" sl ON sl."tenantId" = t."id"
    LEFT JOIN "subjects" s ON s."tenantId" = t."id"
    GROUP BY t."id", t."name"
    ORDER BY t."name";
  `);
  console.log('=== Tenants ===');
  for (const r of tenantStats.rows) {
    console.log(`  ${r.name} (${r.id.substring(0, 8)}...) — ${r.school_levels_count} niveaux, ${r.subjects_count} matières`);
  }

  // 2. For each tenant, list subjects by school level
  const subs = await client.query(`
    SELECT s."tenantId", sl."name" as level, COUNT(s."id") as count
    FROM "subjects" s
    LEFT JOIN "school_levels" sl ON sl."id" = s."schoolLevelId"
    GROUP BY s."tenantId", sl."name"
    ORDER BY s."tenantId", sl."name";
  `);
  console.log('\n=== Subjects by tenant × school level ===');
  for (const r of subs.rows) {
    console.log(`  tenantId=${r.tenantId?.substring(0, 8)}... level=${r.level || 'NULL'} — ${r.count} matières`);
  }

  // 3. List academic years per tenant
  const ays = await client.query(`
    SELECT "tenantId", "id", "name", "label", "isActive", "startDate", "endDate"
    FROM "academic_years"
    ORDER BY "tenantId", "startDate" DESC;
  `);
  console.log('\n=== Academic years ===');
  for (const r of ays.rows) {
    console.log(`  tenantId=${r.tenantId?.substring(0, 8)}... ${r.name} (${r.label}) active=${r.isActive}`);
  }

  await client.end();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
