const pg = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const r = await client.query(`
    SELECT id, code, name, "schoolLevelId", "defaultMaxScore", "defaultCoefficient", "isSystem"
    FROM evaluation_types
    WHERE "tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    ORDER BY "schoolLevelId", code
  `);
  for (const row of r.rows) {
    console.log(`  [${row.code}] ${row.name} — level=${row.schoolLevelId?.substring(0,8)} max=${row.defaultMaxScore} coef=${row.defaultCoefficient} sys=${row.isSystem}`);
  }

  await client.end();
}
main().catch(e => console.error(e.message));
