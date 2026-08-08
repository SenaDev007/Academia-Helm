import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const cspebId = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

console.log('=== [1] Find staff with employeeId CSPEBE-26-00009 ===');
const staff = await client.query(`
  SELECT s.id, s.email, s."firstName", s."lastName", s."tenantMatricule", s."globalMatricule", s.position, s.status
  FROM staff s
  WHERE s."tenantId" = $1 AND s."tenantMatricule" = 'CSPEBE-26-00009'
`, [cspebId]);
console.log(JSON.stringify(staff.rows, null, 2));

const staffEmail = staff.rows[0]?.email;

console.log('\n=== [2] User with that email ===');
const user = await client.query(`
  SELECT id, email, role, status
  FROM users
  WHERE "tenantId" = $1 AND email = $2
`, [cspebId, staffEmail]);
console.log(JSON.stringify(user.rows, null, 2));

const userId = user.rows[0]?.id;
const userEmail = user.rows[0]?.email;

console.log('\n=== [3] Teacher record by email ===');
const teacher = await client.query(`
  SELECT id, email, "firstName", "lastName"
  FROM teachers
  WHERE "tenantId" = $1 AND email = $2
`, [cspebId, userEmail]);
console.log(JSON.stringify(teacher.rows, null, 2));

const teacherId = teacher.rows[0]?.id;
console.log(`\nteacherId=${teacherId}, userId=${userId}, userEmail=${userEmail}`);

console.log('\n=== [4] TeacherClassAssignments ===');
if (teacherId) {
  const assigns = await client.query(`
    SELECT tca.id, tca."classId", tca."academicYearId", c.name AS class_name, csl.code AS level_code
    FROM teacher_class_assignments tca
    LEFT JOIN classes c ON c.id = tca."classId"
    LEFT JOIN school_levels csl ON csl.id = c."schoolLevelId"
    WHERE tca."teacherId" = $1
  `, [teacherId]);
  console.log(JSON.stringify(assigns.rows, null, 2));
}

console.log('\n=== [5] Current academic year ===');
const ay = await client.query(`SELECT id, label, "isActive" FROM academic_years WHERE "tenantId" = $1 ORDER BY "isActive" DESC, label DESC LIMIT 3`, [cspebId]);
console.log(JSON.stringify(ay.rows, null, 2));

const ayId = ay.rows[0]?.id;

console.log('\n=== [6] Evaluations assigned to teacher ===');
if (teacherId) {
  const evals = await client.query(`
    SELECT e.id, e.title, e.status, e."teacherId", e."classId", c.name AS class_name, e."evaluationDate", e."academicYearId"
    FROM evaluations e
    LEFT JOIN classes c ON c.id = e."classId"
    WHERE e."tenantId" = $1 AND (e."teacherId" = $2 OR e."academicYearId" = $3)
    ORDER BY e."evaluationDate" DESC NULLS LAST
    LIMIT 10
  `, [cspebId, teacherId, ayId]);
  console.log(`Found ${evals.rows.length} evaluations`);
  console.log(JSON.stringify(evals.rows, null, 2));
}

console.log('\n=== [7] ReportCards summary (current year) ===');
const rcSummary = await client.query(`
  SELECT status, COUNT(*)::int AS n
  FROM report_cards
  WHERE "tenantId" = $1 AND "academicYearId" = $2
  GROUP BY status
`, [cspebId, ayId]);
console.log(JSON.stringify(rcSummary.rows, null, 2));

console.log('\n=== [8] ReportCards TEACHER_DISTRIBUTED or TEACHER_SIGNED (current year) ===');
const rcDistrib = await client.query(`
  SELECT rc.id, rc.status, rc."studentId", rc."quarterId", s."firstName", s."lastName",
         se."classId", c.name AS class_name
  FROM report_cards rc
  JOIN students s ON s.id = rc."studentId"
  LEFT JOIN student_enrollments se ON se."studentId" = rc."studentId" AND se."academicYearId" = rc."academicYearId"
  LEFT JOIN classes c ON c.id = se."classId"
  WHERE rc."tenantId" = $1 AND rc."academicYearId" = $2
    AND rc.status IN ('TEACHER_DISTRIBUTED', 'TEACHER_SIGNED')
  LIMIT 10
`, [cspebId, ayId]);
console.log(JSON.stringify(rcDistrib.rows, null, 2));

await client.end();
