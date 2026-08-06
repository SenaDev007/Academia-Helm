import pg from 'pg';
import crypto from 'crypto';

const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

client.on('error', (err) => console.error('CLIENT ERROR:', err));
process.on('unhandledRejection', (r) => console.error('UNHANDLED REJECTION:', r));
process.on('uncaughtException', (e) => { console.error('UNCAUGHT:', e); process.exit(1); });

await client.connect();
console.log('Connected');

const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const ACADEMIC_YEAR_ID = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';
const PRIMAIRE_LEVEL_ID = 'bc434610-8cf6-4415-a51a-cc5300cd99da';

// Get CE1 class
const cls = (await client.query(`
  SELECT c.id, c.name, c."officialClassId" FROM classes c
  JOIN school_levels sl ON sl.id = c."schoolLevelId" AND sl.code = 'PRIMAIRE'
  WHERE c."tenantId" = $1 AND c."academicYearId" = $2 AND c.name = 'CE1'
`, [TENANT_ID, ACADEMIC_YEAR_ID])).rows[0];
console.log(`Class: ${cls.name} id=${cls.id}`);

// Get subjects
const subjects = (await client.query(`
  SELECT s.id, s.name FROM class_subjects cs JOIN subjects s ON s.id = cs."subjectId"
  WHERE cs."academicClassId" = $1 AND cs."tenantId" = $2
`, [cls.officialClassId, TENANT_ID])).rows;
console.log(`Subjects: ${subjects.length}`);

// Get students
const students = (await client.query(`
  SELECT s.id FROM student_enrollments se JOIN students s ON s.id = se."studentId"
  WHERE se."classId" = $1 AND se."academicYearId" = $2 AND se.status = 'ACTIVE'
`, [cls.id, ACADEMIC_YEAR_ID])).rows;
console.log(`Students: ${students.length}`);

// Get T1 period
const t1 = (await client.query(`SELECT id FROM academic_periods WHERE "academicYearId" = $1 ORDER BY "startDate" LIMIT 1`, [ACADEMIC_YEAR_ID])).rows[0];
console.log(`T1 period id: ${t1.id}`);

// Get EM1 eval type
const em1 = (await client.query(`SELECT id, code FROM evaluation_types WHERE "tenantId" = $1 AND "schoolLevelId" = $2 AND code = 'EM1'`, [TENANT_ID, PRIMAIRE_LEVEL_ID])).rows[0];
console.log(`EM1 type id: ${em1.id}`);

// Get quarter for T1
const t1q = (await client.query(`SELECT id FROM quarters WHERE "tenantId" = $1 AND "academicYearId" = $2 AND number = 1 ORDER BY "createdAt" LIMIT 1`, [TENANT_ID, ACADEMIC_YEAR_ID])).rows[0];
console.log(`T1 quarter id: ${t1q.id}`);

// Test: bulk insert 3 evaluations + their grades
console.log('\n--- TEST: Bulk insert 3 evaluations ---');
await client.query('BEGIN');
try {
  const evalValues = [];
  const evalParams = [];
  let paramIdx = 1;
  const subjectsToInsert = subjects.slice(0, 3);
  for (const subject of subjectsToInsert) {
    const newEvalId = crypto.randomUUID();
    const title = `Évaluation mensuelle 1 - Trimestre 1`;
    const evalDate = new Date();
    const coef = 1;
    const maxScore = 20;
    const teacherId = '9ed8201c-42e0-431d-abd6-71ec6a4c4501';
    evalValues.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6}, $${paramIdx+7}, $${paramIdx+8}, $${paramIdx+9}, $${paramIdx+10}, $${paramIdx+11}, 'VALIDATED', NOW(), NOW(), NOW())`);
    evalParams.push(newEvalId, TENANT_ID, ACADEMIC_YEAR_ID, cls.id, subject.id, t1.id, em1.id, title, evalDate, maxScore, coef, teacherId);
    paramIdx += 12;
    subject._newEvalId = newEvalId;
  }

  const insertQuery = `
    INSERT INTO evaluations (
      id, "tenantId", "academicYearId", "classId", "subjectId",
      "periodId", "evaluationTypeId", title, "evaluationDate",
      "maxScore", coefficient, "teacherId", status, "validatedAt", "createdAt", "updatedAt"
    ) VALUES ${evalValues.join(', ')}
    RETURNING id, "subjectId"
  `;
  console.log(`Executing INSERT with ${evalParams.length} params...`);
  const inserted = await client.query(insertQuery, evalParams);
  console.log(`✓ Inserted ${inserted.rowCount} evaluations`);

  // Bulk insert grades for the first newly-inserted evaluation
  console.log('\n--- TEST: Bulk insert grades for first eval ---');
  const firstEval = subjectsToInsert[0];
  const gradeValues = [];
  const gradeParams = [];
  let gParamIdx = 1;
  for (const student of students) {
    const score = Math.floor(Math.random() * 12) + 7;
    const isAbsent = Math.random() < 0.03;
    gradeValues.push(`(gen_random_uuid(), $${gParamIdx}, $${gParamIdx+1}, $${gParamIdx+2}, $${gParamIdx+3}, $${gParamIdx+4}, $${gParamIdx+5}, $${gParamIdx+6}, $${gParamIdx+7}, $${gParamIdx+8}, $${gParamIdx+9}, $${gParamIdx+10}, $${gParamIdx+11}, NULL, 'VALIDATED', NOW(), NOW())`);
    gradeParams.push(
      TENANT_ID, ACADEMIC_YEAR_ID, PRIMAIRE_LEVEL_ID,
      student.id, firstEval.id, firstEval._newEvalId, t1q.id, cls.id,
      isAbsent ? null : score, 20, 1, isAbsent
    );
    gParamIdx += 12;
  }
  const gradeInsertQuery = `
    INSERT INTO grades (
      id, "tenantId", "academicYearId", "schoolLevelId", "studentId", "subjectId",
      "evaluationId", "periodId", "classId",
      score, "maxScore", coefficient, "isAbsent", "qualitativeCode",
      status, "createdAt", "updatedAt"
    ) VALUES ${gradeValues.join(', ')}
  `;
  console.log(`Executing grades INSERT with ${gradeParams.length} params, ${gradeValues.length} rows...`);
  const gradesResult = await client.query(gradeInsertQuery, gradeParams);
  console.log(`✓ Inserted ${gradesResult.rowCount} grades`);

  await client.query('ROLLBACK');
  console.log('\n--- ROLLED BACK (test only) ---');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('❌ FAILED:', err.message);
  console.error('Detail:', err.detail);
  console.error('Constraint:', err.constraint);
}

await client.end();
