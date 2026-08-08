const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // Test WITH periodId filter
  const result = await db.query(`
    SELECT g.id, g.score, g."qualitativeCode", g.status,
           e."periodId", e."evaluationTypeId",
           et."name" as "evalTypeName"
    FROM grades g
    LEFT JOIN evaluations e ON e.id = g."evaluationId"
    LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
    WHERE g."tenantId" = $1
      AND g."academicYearId" = $2
      AND g."classId" = $3
      AND g.status IN ('VALIDATED', 'SUBMITTED')
      AND e."periodId" = $4
  `, ['59b8c348-ae5f-4d67-8fbd-af6aefa1f394', 'a7593470-e4f4-460a-b3b6-4dabe53bec2a', '2f2b0dd1-e41e-4876-aea5-5750f7e076ef', '0e65f84b-2fa3-4c88-a4aa-8a52b278200c']);

  console.log('Grades WITH periodId filter:', result.rows.length);
  result.rows.slice(0, 3).forEach(g => {
    console.log(`  score=${g.score} qual=${g.qualitativeCode} status=${g.status} evalType=${g.evalTypeName}`);
  });

  // Test WITHOUT periodId filter
  const result2 = await db.query(`
    SELECT g.id, g.score, g."qualitativeCode", g.status,
           e."periodId", et."name" as "evalTypeName"
    FROM grades g
    LEFT JOIN evaluations e ON e.id = g."evaluationId"
    LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
    WHERE g."tenantId" = $1
      AND g."academicYearId" = $2
      AND g."classId" = $3
      AND g.status IN ('VALIDATED', 'SUBMITTED')
  `, ['59b8c348-ae5f-4d67-8fbd-af6aefa1f394', 'a7593470-e4f4-460a-b3b6-4dabe53bec2a', '2f2b0dd1-e41e-4876-aea5-5750f7e076ef']);

  console.log('\nGrades WITHOUT periodId filter:', result2.rows.length);
  result2.rows.slice(0, 5).forEach(g => {
    console.log(`  score=${g.score} qual=${g.qualitativeCode} status=${g.status} periodId=${g.periodId?.substring(0,8) || 'NULL'} evalType=${g.evalTypeName}`);
  });

  // Check the periodId from evaluations
  const evalPeriods = await db.query(`
    SELECT DISTINCT e."periodId"
    FROM evaluations e
    WHERE e."classId" = $1 AND e."tenantId" = $2
  `, ['2f2b0dd1-e41e-4876-aea5-5750f7e076ef', '59b8c348-ae5f-4d67-8fbd-af6aefa1f394']);
  console.log('\nEvaluation periodIds:', evalPeriods.rows.map(r => r.periodId?.substring(0,8) || 'NULL'));

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
