const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const TENANT = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

  // 1. Sample evaluations (without schoolLevelId - it's on grades, not evaluations)
  const cspebEval = await db.query(`
    SELECT e.id, e.title, e.status, e."classId", e."subjectId", e."periodId",
           e."evaluationTypeId", e."academicYearId",
           c.name as "className", c."schoolLevelId",
           s.name as "subjectName", et.name as "evalTypeName"
    FROM evaluations e
    LEFT JOIN classes c ON c.id = e."classId"
    LEFT JOIN subjects s ON s.id = e."subjectId"
    LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
    WHERE e."tenantId" = $1
    LIMIT 10
  `, [TENANT]);
  console.log('Sample evaluations (CSPEB):');
  cspebEval.rows.forEach(e => {
    console.log(`  ${e.title} | status=${e.status} | class=${e.className} | subject=${e.subjectName} | type=${e.evalTypeName}`);
    console.log(`    yearId=${e.academicYearId?.substring(0,8)} | class.schoolLevelId=${e.schoolLevelId?.substring(0,8) || 'NULL'}`);
  });

  // 2. Count grades for CSPEB
  const gradeCount = await db.query('SELECT COUNT(*)::int as c FROM grades WHERE "tenantId" = $1', [TENANT]);
  console.log('\nGrades for CSPEB:', gradeCount.rows[0].c);

  // 3. Sample grades
  const cspebGrades = await db.query(`
    SELECT g.score, g."qualitativeCode", g.status, g."isAbsent",
           g."classId", g."periodId", g."evaluationId",
           s."firstName", s."lastName"
    FROM grades g
    LEFT JOIN students s ON s.id = g."studentId"
    WHERE g."tenantId" = $1
    LIMIT 10
  `, [TENANT]);
  console.log('\nSample grades (CSPEB):');
  cspebGrades.rows.forEach(g => {
    console.log(`  ${g.firstName} ${g.lastName} | score=${g.score} | qual=${g.qualitativeCode} | status=${g.status} | classId=${g.classId?.substring(0,8) || 'NULL'} | periodId=${g.periodId?.substring(0,8) || 'NULL'} | evalId=${g.evaluationId?.substring(0,8) || 'NULL'}`);
  });

  // 4. Grades status distribution
  const statusDist = await db.query(`
    SELECT status, COUNT(*) as c FROM grades WHERE "tenantId" = $1 GROUP BY status
  `, [TENANT]);
  console.log('\nGrades by status:');
  statusDist.rows.forEach(r => console.log(`  ${r.status}: ${r.c}`));

  // 5. Evaluation status distribution
  const evalStatus = await db.query(`
    SELECT status, COUNT(*) as c FROM evaluations WHERE "tenantId" = $1 GROUP BY status
  `, [TENANT]);
  console.log('\nEvaluations by status:');
  evalStatus.rows.forEach(r => console.log(`  ${r.status}: ${r.c}`));

  // 6. Check academic periods
  const periods = await db.query(`
    SELECT id, name, type, "orderIndex" FROM academic_periods WHERE "tenantId" = $1 LIMIT 10
  `, [TENANT]);
  console.log('\nAcademic periods:');
  periods.rows.forEach(p => console.log(`  ${p.name} | type=${p.type} | order=${p.orderIndex}`));

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
