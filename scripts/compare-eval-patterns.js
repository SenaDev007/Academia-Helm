const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const TENANT = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

  // 1. Évaluations VALIDATED (créées manuellement)
  console.log('=== Évaluations VALIDATED (créées manuellement) ===');
  const validated = await db.query(`
    SELECT e.id, e.title, e.status, e."classId", e."subjectId", e."periodId",
           e."evaluationTypeId", e."academicYearId",
           c.name as "className", c."schoolLevelId",
           s.name as "subjectName", et.name as "evalTypeName",
           sl.name as "levelName", sl.code as "levelCode"
    FROM evaluations e
    LEFT JOIN classes c ON c.id = e."classId"
    LEFT JOIN subjects s ON s.id = e."subjectId"
    LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
    LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
    WHERE e."tenantId" = $1 AND e.status = 'VALIDATED'
  `, [TENANT]);

  validated.rows.forEach(e => {
    console.log(`  title: ${e.title}`);
    console.log(`  status: ${e.status}`);
    console.log(`  class: ${e.className} | level: ${e.levelName} (${e.levelCode})`);
    console.log(`  subject: ${e.subjectName}`);
    console.log(`  evalType: ${e.evalTypeName}`);
    console.log(`  periodId: ${e.periodId?.substring(0,8) || 'NULL'}`);
    console.log(`  academicYearId: ${e.academicYearId?.substring(0,8)}`);
    console.log('  ---');
  });

  // 2. Grades pour ces évaluations VALIDATED
  if (validated.rows.length > 0) {
    const evalIds = validated.rows.map(e => e.id);
    console.log('\n=== Grades pour évaluations VALIDATED ===');
    const grades = await db.query(`
      SELECT g.score, g."qualitativeCode", g.status, g."isAbsent",
             g."classId", g."periodId", g."evaluationId",
             g."schoolLevelId", g."academicTrackId", g.language,
             s."firstName", s."lastName"
      FROM grades g
      LEFT JOIN students s ON s.id = g."studentId"
      WHERE g."evaluationId" = ANY($1)
      LIMIT 15
    `, [evalIds]);
    grades.rows.forEach(g => {
      console.log(`  ${g.firstName} ${g.lastName} | score=${g.score} | qual=${g.qualitativeCode} | status=${g.status} | classId=${g.classId?.substring(0,8) || 'NULL'} | periodId=${g.periodId?.substring(0,8) || 'NULL'} | schoolLevelId=${g.schoolLevelId?.substring(0,8) || 'NULL'} | lang=${g.language}`);
    });
  }

  // 3. Évaluations SEED
  console.log('\n=== Évaluations SEED (PLANNED/OPEN_FOR_GRADING/SUBMITTED) ===');
  const seed = await db.query(`
    SELECT e.status, COUNT(*) as c, MIN(e.title) as sample_title
    FROM evaluations e
    WHERE e."tenantId" = $1 AND e.status != 'VALIDATED'
    GROUP BY e.status
  `, [TENANT]);
  seed.rows.forEach(r => {
    console.log(`  status=${r.status} → ${r.c} evaluations (ex: ${r.sample_title})`);
  });

  // 4. Grades pour évaluations SEED
  const seedEvalIds = (await db.query(`
    SELECT id FROM evaluations WHERE "tenantId" = $1 AND status != 'VALIDATED'
  `, [TENANT])).rows.map(r => r.id);

  if (seedEvalIds.length > 0) {
    const seedGrades = await db.query(`
      SELECT g.status, COUNT(*) as c,
             COUNT(g."qualitativeCode") as with_qual,
             COUNT(g.score) as with_score
      FROM grades g
      WHERE g."evaluationId" = ANY($1)
      GROUP BY g.status
    `, [seedEvalIds]);
    console.log('\n=== Grades pour évaluations SEED ===');
    seedGrades.rows.forEach(r => {
      console.log(`  status=${r.status} → ${r.c} grades | with_qual=${r.with_qual} | with_score=${r.with_score}`);
    });

    // Sample seed grades
    const sampleSeed = await db.query(`
      SELECT g.score, g."qualitativeCode", g.status,
             g."classId", g."periodId", g."evaluationId",
             g."schoolLevelId", g.language,
             s."firstName", s."lastName",
             e.title as "evalTitle"
      FROM grades g
      LEFT JOIN students s ON s.id = g."studentId"
      LEFT JOIN evaluations e ON e.id = g."evaluationId"
      WHERE g."evaluationId" = ANY($1)
      LIMIT 5
    `, [seedEvalIds]);
    console.log('\nSample SEED grades:');
    sampleSeed.rows.forEach(g => {
      console.log(`  ${g.firstName} ${g.lastName} | eval=${g.evalTitle?.substring(0, 30)} | score=${g.score} | qual=${g.qualitativeCode} | status=${g.status} | schoolLevelId=${g.schoolLevelId?.substring(0,8) || 'NULL'} | lang=${g.language}`);
    });
  }

  // 5. Academic periods
  console.log('\n=== Academic periods ===');
  const periods = await db.query(`
    SELECT id, name, type FROM academic_periods WHERE "tenantId" = $1 LIMIT 10
  `, [TENANT]);
  if (periods.rows.length === 0) {
    console.log('  ❌ NO academic_periods for this tenant!');
  } else {
    periods.rows.forEach(p => console.log(`  ${p.name} | type=${p.type} | id=${p.id.substring(0,8)}`));
  }

  // 6. Check evaluation_periods (maybe periods are in a different table)
  console.log('\n=== Academic year periods ===');
  const ayPeriods = await db.query(`
    SELECT id, name, "startDate", "endDate", "academicYearId"
    FROM academic_years WHERE "tenantId" = $1 LIMIT 5
  `, [TENANT]);
  ayPeriods.rows.forEach(y => console.log(`  ${y.name} | id=${y.id.substring(0,8)}`));

  // 7. Check what periodId is set on evaluations
  console.log('\n=== Evaluations periodId distribution ===');
  const periodDist = await db.query(`
    SELECT "periodId", COUNT(*) as c
    FROM evaluations WHERE "tenantId" = $1
    GROUP BY "periodId"
  `, [TENANT]);
  periodDist.rows.forEach(r => {
    console.log(`  periodId=${r.periodId?.substring(0,8) || 'NULL'} → ${r.c} evaluations`);
  });

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
