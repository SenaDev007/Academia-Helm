const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const TENANT = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

  // 1. Check evaluation.periodId vs academic_periods.id
  console.log('=== evaluation.periodId matching ===');
  const match = await db.query(`
    SELECT DISTINCT e."periodId",
           ap.id as match_id, ap.name as period_name
    FROM evaluations e
    LEFT JOIN academic_periods ap ON ap.id = e."periodId"
    WHERE e."tenantId" = $1
  `, [TENANT]);
  match.rows.forEach(r => {
    const pid = r.periodId ? r.periodId.substring(0,8) : 'NULL';
    const matched = r.match_id ? `YES (${r.period_name})` : 'NO MATCH!';
    console.log(`  eval.periodId=${pid} → ${matched}`);
  });

  // 2. Active academic year
  console.log('\n=== Academic years ===');
  const ay = await db.query('SELECT id, name, "isActive" FROM academic_years WHERE "tenantId" = $1 ORDER BY "startDate" DESC LIMIT 5', [TENANT]);
  ay.rows.forEach(y => console.log(`  ${y.name} | id=${y.id.substring(0,8)} | active=${y.isactive}`));

  // 3. Academic periods with tenantId check
  console.log('\n=== Academic periods ===');
  const ap = await db.query(`
    SELECT id, name, "tenantId", type
    FROM academic_periods
    WHERE "tenantId" = $1 OR "tenantId" IS NULL
    LIMIT 20
  `, [TENANT]);
  ap.rows.forEach(p => {
    console.log(`  ${p.name} | id=${p.id.substring(0,8)} | type=${p.type} | tenantId=${p.tenantId ? p.tenantId.substring(0,8) : 'NULL'}`);
  });

  // 4. Test the exact query the averages engine uses
  console.log('\n=== Test: grades with evaluation.periodId filter ===');
  const periodId = '0e65f84b-2fa3-4c88-a4aa-8a52b278200c'; // Trimestre 1 from earlier query
  const classId = '2f2b0dd1-e41e-4876-aea5-5750f7e076ef'; // Maternelle 1
  const academicYearId = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'; // 2026-2027

  const grades = await db.query(`
    SELECT g.score, g."qualitativeCode", g.status,
           s."firstName", s."lastName"
    FROM grades g
    LEFT JOIN students s ON s.id = g."studentId"
    WHERE g."tenantId" = $1
      AND g."academicYearId" = $2
      AND g."classId" = $3
      AND g.status IN ('VALIDATED', 'SUBMITTED')
      AND g."evaluationId" IN (
        SELECT id FROM evaluations WHERE "periodId" = $4
      )
    LIMIT 10
  `, [TENANT, academicYearId, classId, periodId]);
  console.log(`Found ${grades.rows.length} grades`);
  grades.rows.forEach(g => {
    console.log(`  ${g.firstName} ${g.lastName} | score=${g.score} | qual=${g.qualitativeCode} | status=${g.status}`);
  });

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
