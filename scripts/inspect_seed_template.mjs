/**
 * Show detailed structure of existing evaluations (Maternelle 1 - all 3 trimesters)
 * to understand the pattern for finishing the PRIMAIRE seed.
 *
 * Also: list PRIMAIRE classes + their subjects + student counts.
 */
import pg from 'pg';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const SEP = '═'.repeat(80);
console.log(SEP); console.log('SEED TEMPLATE INSPECTION'); console.log(SEP);

// 1. Show evaluations for Maternelle 1 - T1 - EM1
console.log('\n[1] MATERNELLE 1 — T1 × EM1 EVALUATIONS (template)');
const template = await client.query(`
  SELECT e.id, e.title, e.status, e."teacherId", e."evaluationDate", e."maxScore", e.coefficient,
         s.name AS subject_name, s.code AS subject_code,
         et.code AS type_code, et.name AS type_name
  FROM evaluations e
  JOIN classes c ON c.id = e."classId"
  JOIN evaluation_types et ON et.id = e."evaluationTypeId"
  LEFT JOIN subjects s ON s.id = e."subjectId"
  WHERE c.name = 'Maternelle 1'
    AND et.code = 'EM1'
  ORDER BY s.name
  LIMIT 10
`);
for (const e of template.rows) {
  console.log(`  • ${e.title} — subj=${e.subject_name} (${e.subject_code}) type=${e.type_code} status=${e.status} teacher=${e.teacherId?.substring(0,8)} maxScore=${e.maxScore} coef=${e.coefficient}`);
}

// 2. Show grades for one of those evaluations
console.log('\n[2] GRADES for first Maternelle 1 / EM1 evaluation');
if (template.rows.length > 0) {
  const evalId = template.rows[0].id;
  const grades = await client.query(`
    SELECT g.id, g.score, g."qualitativeCode", g."isAbsent", g.comment,
           g."studentId", g."periodId",
           st."firstName", st."lastName", st.gender
    FROM grades g
    LEFT JOIN students st ON st.id = g."studentId"
    WHERE g."evaluationId" = $1
    LIMIT 10
  `, [evalId]);
  console.log(`  Evaluation: ${evalId.substring(0,8)} (${template.rows[0].title})`);
  console.log(`  Grades count: ${grades.rowCount}`);
  for (const g of grades.rows) {
    console.log(`    • ${g.lastName} ${g.firstName} (${g.gender}) — score=${g.score} qualCode=${g.qualitativeCode} absent=${g.isAbsent} periodId=${g.periodId?.substring(0,8)||'NULL'}`);
  }
}

// 3. Show PRIMAIRE classes (CI, CP, CE1, CE2, CM1, CM2)
console.log('\n[3] PRIMAIRE CLASSES for tenant 59b8c348');
const primaClasses = await client.query(`
  SELECT c.id, c.name, c."schoolLevelId", c."academicYearId",
         (SELECT COUNT(*) FROM students s WHERE s."classId" = c.id) AS student_count
  FROM classes c
  WHERE c."tenantId" = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394'
    AND c."schoolLevelId" = 'bc434610-7f49-47e2-947b-8f9e6a14b1a4'
  ORDER BY c.name
`);
for (const c of primaClasses.rows) {
  console.log(`  • ${c.name} — id=${c.id.substring(0,8)} students=${c.student_count}`);
}

// 4. Show subjects for one PRIMAIRE class (CP)
console.log('\n[4] SUBJECTS for CP class');
const cpClass = primaClasses.rows.find(c => c.name === 'CP');
if (cpClass) {
  const cpSubjects = await client.query(`
    SELECT cs.id, cs."academicClassId", cs."classId", cs.subjectid, cs.coefficient,
           s.name, s.code, s.language
    FROM class_subjects cs
    JOIN subjects s ON s.id = cs."subjectId"
    WHERE cs."academicClassId" = (
      SELECT id FROM academic_classes WHERE "classId" = $1 LIMIT 1
    ) OR cs."classId" = $1
    ORDER BY s.name
  `, [cpClass.id]);
  console.log(`  CP class id: ${cpClass.id}`);
  console.log(`  Subjects count: ${cpSubjects.rowCount}`);
  for (const s of cpSubjects.rows) {
    console.log(`    • ${s.name} (${s.code}) lang=${s.language} coef=${s.coefficient}`);
  }
}

// 5. Show existing evaluations per PRIMAIRE class
console.log('\n[5] EXISTING EVALUATIONS per PRIMAIRE class');
for (const cls of primaClasses.rows) {
  const evals = await client.query(`
    SELECT et.code AS type_code, ap.name AS period, COUNT(*)::int AS cnt
    FROM evaluations e
    JOIN evaluation_types et ON et.id = e."evaluationTypeId"
    LEFT JOIN academic_periods ap ON ap.id = e."periodId"
    WHERE e."classId" = $1
    GROUP BY et.code, ap.name
    ORDER BY ap.name, et.code
  `, [cls.id]);
  console.log(`  • ${cls.name}: ${evals.rows.map(r => `${r.period}/${r.type_code}=${r.cnt}`).join(', ') || '(no evaluations)'}`);
}

// 6. Show academic_classes table (referenced by class_subjects.academicClassId)
console.log('\n[6] academic_classes TABLE');
try {
  const acCols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'academic_classes' ORDER BY ordinal_position
  `);
  console.log(`  Columns: ${acCols.rows.map(r => r.column_name).join(', ')}`);
  const acSample = await client.query(`SELECT * FROM academic_classes LIMIT 5`);
  for (const r of acSample.rows) console.log('  -', r);
} catch (e) {
  console.log(`  Table doesn't exist: ${e.message}`);
}

// helper for student query (column names differ)
async function fetchStudents(client, classId) {
  // discover columns
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='students' AND column_name IN ('firstName','lastName','firstname','lastname')
  `);
  const colNames = cols.rows.map(r => r.column_name);
  const firstCol = colNames.find(c => c.toLowerCase().includes('first')) || 'firstName';
  const lastCol = colNames.find(c => c.toLowerCase().includes('last')) || 'lastName';
  const res = await client.query(`
    SELECT id, "${firstCol}" AS "firstName", "${lastCol}" AS "lastName", gender, "classId"
    FROM students WHERE "classId" = $1 LIMIT 10
  `, [classId]);
  return res.rows;
}

// 7. Show students for one PRIMAIRE class
console.log('\n[7] STUDENTS for CP class');
if (cpClass) {
  const students = await fetchStudents(client, cpClass.id);
  console.log(`  CP class id: ${cpClass.id}`);
  for (const s of students) console.log(`  • ${s.lastName} ${s.firstName} (${s.gender}) id=${s.id.substring(0,8)}`);
}

// 8. Show teacher_class_assignments for one PRIMAIRE class
console.log('\n[8] TEACHER_CLASS_ASSIGNMENTS for CP class');
if (cpClass) {
  const tca = await client.query(`
    SELECT tca.id, tca."teacherId", tca."classSubjectId", tca."classId",
           u.email, u."firstName", u."lastName"
    FROM teacher_class_assignments tca
    LEFT JOIN users u ON u.id = tca."teacherId"
    WHERE tca."classId" = $1
  `, [cpClass.id]);
  console.log(`  TCA count: ${tca.rowCount}`);
  for (const t of tca.rows) console.log(`  • teacher=${t.email||t.teacherId?.substring(0,8)} (${t.lastName||''} ${t.firstName||''}) classSubject=${t.classSubjectId?.substring(0,8)||'NULL'}`);
}

// 9. Grades table columns
console.log('\n[9] GRADES TABLE COLUMNS');
const gradesCols = await client.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'grades' ORDER BY ordinal_position
`);
for (const c of gradesCols.rows) console.log(`  - ${c.column_name.padEnd(28)} ${c.data_type}`);

await client.end();
console.log(`\n${SEP}\nEND\n${SEP}`);
