const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const T = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
  const Y = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';

  const e = await db.query('SELECT COUNT(*)::int as c FROM evaluations WHERE "tenantId" = $1 AND "academicYearId" = $2', [T, Y]);
  const g = await db.query('SELECT COUNT(*)::int as c FROM grades WHERE "tenantId" = $1 AND "academicYearId" = $2', [T, Y]);

  console.log('Evaluations:', e.rows[0].c);
  console.log('Grades:', g.rows[0].c);

  // Check by class
  const byClass = await db.query(`
    SELECT c.name, e.status, COUNT(*) as cnt
    FROM evaluations e
    JOIN classes c ON c.id = e."classId"
    WHERE e."tenantId" = $1 AND e."academicYearId" = $2
    GROUP BY c.name, e.status
    ORDER BY c.name, e.status
  `, [T, Y]);
  console.log('\nBy class:');
  byClass.rows.forEach(r => console.log(`  ${r.name} | ${r.status} | ${r.cnt}`));

  await db.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
