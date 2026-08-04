const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  const TENANT = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

  // 1. Count evaluations
  const evalCount = await db.query('SELECT COUNT(*)::int as c FROM evaluations');
  console.log('Total evaluations:', evalCount.rows[0].c);

  // 2. Sample evaluations for CSPEB
  const cspebEval = await db.query(`
    SELECT e.id, e.title, e.status, e."classId", e."subjectId", e."periodId",
           e."evaluationTypeId", e."academicYearId", e."schoolLevelId",
           c.name as "className", s.name as "subjectName", et.name as "evalTypeName"
    FROM evaluations e
    LEFT JOIN classes c ON c.id = e."classId"
    LEFT JOIN subjects s ON s.id = e."subjectId"
    LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
    WHERE e."tenantId" = $1
    LIMIT 10
  `, [TENANT]);
  console.log('\nSample evaluations (CSPEB):');
  cspebEval.rows.forEach(e => {
    console.log(`  ${e.title} | status=${e.status} | class=${e.className} | subject=${e.subjectName} | type=${e.evalTypeName}`);
    console.log(`    academicYearId=${e.academicYearId?.substring(0,8)} | schoolLevelId=${e.schoolLevelId?.substring(0,8) || 'NULL'}`);
  });

  // 3. Count grades
  const gradeCount = await db.query('SELECT COUNT(*)::int as c FROM grades');
  console.log('\nTotal grades:', gradeCount.rows[0].c);

  // 4. Sample grades
  const cspebGrades = await db.query(`
    SELECT g.score, g."qualitativeCode", g.status, g."isAbsent",
           s."firstName", s."lastName"
    FROM grades g
    LEFT JOIN students s ON s.id = g."studentId"
    WHERE g."tenantId" = $1
    LIMIT 10
  `, [TENANT]);
  console.log('\nSample grades (CSPEB):');
  cspebGrades.rows.forEach(g => {
    console.log(`  ${g.firstName} ${g.lastName} | score=${g.score} | qual=${g.qualitativeCode} | status=${g.status} | absent=${g.isAbsent}`);
  });

  // 5. Check academicYearId
  const noYear = await db.query('SELECT COUNT(*)::int as c FROM evaluations WHERE "academicYearId" IS NULL');
  console.log('\nEvaluations without academicYearId:', noYear.rows[0].c);

  const withYear = await db.query(`
    SELECT "academicYearId", COUNT(*) as c
    FROM evaluations WHERE "tenantId" = $1
    GROUP BY "academicYearId"
  `, [TENANT]);
  console.log('Evaluations by academicYearId:');
  withYear.rows.forEach(r => console.log(`  ${r.academicYearId?.substring(0,8)}... → ${r.c}`));

  // 6. Check schoolLevelId
  const noLevel = await db.query('SELECT COUNT(*)::int as c FROM evaluations WHERE "schoolLevelId" IS NULL');
  console.log('\nEvaluations without schoolLevelId:', noLevel.rows[0].c);

  // 7. Check evaluation_types
  const evalTypes = await db.query('SELECT id, name, code FROM evaluation_types WHERE "tenantId" = $1 LIMIT 10', [TENANT]);
  console.log('\nEvaluation types:');
  evalTypes.rows.forEach(et => console.log(`  ${et.name} | code=${et.code}`));

  // 8. Check what the evaluations page actually queries
  // The frontend calls institutionalExamsService.getEvaluations({academicYearId, schoolLevelId, status, language})
  // Let's check if schoolLevelId is set on evaluations
  const evalLevels = await db.query(`
    SELECT "schoolLevelId", COUNT(*) as c
    FROM evaluations WHERE "tenantId" = $1
    GROUP BY "schoolLevelId"
  `, [TENANT]);
  console.log('\nEvaluations by schoolLevelId:');
  evalLevels.rows.forEach(r => console.log(`  ${r.schoolLevelId?.substring(0,8) || 'NULL'}... → ${r.c}`));

  // 9. Check if grades have classId and periodId set
  const gradesMeta = await db.query(`
    SELECT COUNT(*) as total,
           COUNT("classId") as with_class,
           COUNT("periodId") as with_period,
           COUNT("evaluationId") as with_eval
    FROM grades WHERE "tenantId" = $1
  `, [TENANT]);
  console.log('\nGrades metadata:');
  console.log(`  total=${gradesMeta.rows[0].total} with_class=${gradesMeta.rows[0].with_class} with_period=${gradesMeta.rows[0].with_period} with_eval=${gradesMeta.rows[0].with_eval}`);

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
