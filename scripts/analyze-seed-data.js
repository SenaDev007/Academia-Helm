const { Client } = require('pg');
const crypto = require('crypto');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  console.log('✅ Connected to Neon\n');

  const TENANT = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
  const YEAR = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';

  // 1. Classes
  const classes = await db.query(`
    SELECT c.id, c.name, c."schoolLevelId", c."officialClassId", sl.code as "levelCode"
    FROM classes c
    LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
    WHERE c."tenantId" = $1
    ORDER BY sl.code, c.name
  `, [TENANT]);
  console.log('Classes:', classes.rows.length);
  classes.rows.forEach(c => console.log(`  ${c.name} | level=${c.levelCode} | id=${c.id.substring(0,8)}`));

  // 2. Periods (3 trimesters)
  const periods = await db.query(`
    SELECT id, name FROM academic_periods WHERE "tenantId" = $1 AND type = 'TRIMESTER'
    ORDER BY name
  `, [TENANT]);
  console.log('\nPeriods:');
  periods.rows.forEach(p => console.log(`  ${p.name} | id=${p.id.substring(0,8)}`));

  // 3. Evaluation types - we need EM1, EM2, EC per trimester
  // Check existing
  const evalTypes = await db.query('SELECT id, name, code FROM evaluation_types WHERE "tenantId" = $1', [TENANT]);
  console.log('\nEvaluation types:');
  evalTypes.rows.forEach(et => console.log(`  ${et.name} | code=${et.code} | id=${et.id.substring(0,8)}`));

  // 4. Subjects per class (via officialClassId → academicClassId in class_subjects)
  const subjects = await db.query(`
    SELECT cs."academicClassId", cs."subjectId", s.name as "subjectName"
    FROM class_subjects cs
    INNER JOIN subjects s ON s.id = cs."subjectId"
    WHERE cs."tenantId" = $1 AND cs."academicYearId" = $2
  `, [TENANT, YEAR]);
  console.log('\nClass subjects:', subjects.rows.length);

  const subjectsByClass = {};
  subjects.rows.forEach(s => {
    if (!subjectsByClass[s.academicClassId]) subjectsByClass[s.academicClassId] = [];
    subjectsByClass[s.academicClassId].push({ subjectId: s.subjectId, name: s.subjectName });
  });

  // 5. Students per class
  const students = await db.query(`
    SELECT se."classId", se."studentId", s."firstName", s."lastName"
    FROM student_enrollments se
    INNER JOIN students s ON s.id = se."studentId"
    WHERE se."tenantId" = $1 AND se."academicYearId" = $2
      AND se.status = 'ACTIVE'
  `, [TENANT, YEAR]);
  console.log('\nStudents:', students.rows.length);

  const studentsByClass = {};
  students.rows.forEach(s => {
    if (!studentsByClass[s.classId]) studentsByClass[s.classId] = [];
    studentsByClass[s.classId].push(s);
  });

  // 6. Teacher assignments (classId → teacherId)
  const teacherAssignments = await db.query(`
    SELECT DISTINCT tca."classId", tca."teacherId"
    FROM teacher_class_assignments tca
    WHERE tca."tenantId" = $1 AND tca."academicYearId" = $2
  `, [TENANT, YEAR]);
  const teacherByClass = {};
  teacherAssignments.rows.forEach(t => {
    teacherByClass[t.classId] = t.teacherId;
  });

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Classes: ${classes.rows.length}`);
  console.log(`Periods: ${periods.rows.length}`);
  console.log(`Eval types: ${evalTypes.rows.length}`);
  console.log(`Class-subjects: ${subjects.rows.length}`);
  console.log(`Active students: ${students.rows.length}`);
  console.log(`Teacher assignments: ${teacherAssignments.rows.length}`);

  // For each class, show what we have
  console.log('\n=== Per-class detail ===');
  for (const cls of classes.rows) {
    const classStudents = studentsByClass[cls.id] || [];
    const classSubjects = subjectsByClass[cls.officialClassId] || [];
    const teacherId = teacherByClass[cls.id];
    console.log(`  ${cls.name} (${cls.levelCode}): ${classStudents.length} students, ${classSubjects.length} subjects, teacher=${teacherId ? teacherId.substring(0,8) : 'NONE'}`);
  }

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
