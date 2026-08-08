import pg from 'pg';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

console.log('=== [1] CSPEB Tenant ===');
const tenant = await client.query(`
  SELECT id, name, slug, subdomain
  FROM tenants
  WHERE slug ILIKE '%cspeb%' OR subdomain ILIKE '%cspeb%' OR name ILIKE '%eveil%'
  LIMIT 5
`);
console.log(JSON.stringify(tenant.rows, null, 2));

const cspebId = tenant.rows[0]?.id;
if (!cspebId) {
  console.error('CSPEB tenant not found!');
  await client.end();
  process.exit(1);
}

console.log('\n=== [2] Find staff with employeeId CSPEBE-26-00009 ===');
const staff = await client.query(`
  SELECT s.id, s."userId", s."employeeId", s."firstName", s."lastName", s.role, u.email
  FROM staff s
  JOIN users u ON u.id = s."userId"
  WHERE s."tenantId" = $1 AND s."employeeId" = 'CSPEBE-26-00009'
`, [cspebId]);
console.log(JSON.stringify(staff.rows, null, 2));

const userId = staff.rows[0]?.userId;
if (!userId) {
  console.error('No staff found for employeeId CSPEBE-26-00009');
  await client.end();
  process.exit(1);
}

console.log(`\n=== [4] Teacher record for user ${userId} ===`);
const teacher = await client.query(`
  SELECT t.id, t."userId", t."firstName", t."lastName", t.email
  FROM teachers t
  WHERE t."userId" = $1
`, [userId]);
console.log(JSON.stringify(teacher.rows, null, 2));

const teacherId = teacher.rows[0]?.id;

console.log(`\n=== [5] TeacherClassAssignments for teacher ${teacherId} ===`);
const assignments = await client.query(`
  SELECT tca.id, tca."classId", tca."academicYearId", c.name AS class_name, csl.name AS level_name, csl.code AS level_code
  FROM teacher_class_assignments tca
  LEFT JOIN classes c ON c.id = tca."classId"
  LEFT JOIN school_levels csl ON csl.id = c."schoolLevelId"
  WHERE tca."teacherId" = $1
`, [teacherId]);
console.log(JSON.stringify(assignments.rows, null, 2));

console.log('\n=== [6] Current academic year ===');
const ay = await client.query(`SELECT id, label, "isActive" FROM academic_years WHERE "tenantId" = $1 ORDER BY "isActive" DESC, label DESC LIMIT 3`, [cspebId]);
console.log(JSON.stringify(ay.rows, null, 2));

const academicYearId = ay.rows[0]?.id;
console.log(`\nUsing academicYearId=${academicYearId}`);

console.log('\n=== [7] ReportCards for CSPEB (current year) ===');
const rcs = await client.query(`
  SELECT rc.id, rc.status, rc."studentId", rc."quarterId", rc."classId",
         rc."directorSignedAt", rc."distributedToTeacherAt", rc."teacherSignedAt",
         s."firstName", s."lastName"
  FROM report_cards rc
  JOIN students s ON s.id = rc."studentId"
  WHERE rc."tenantId" = $1 AND rc."academicYearId" = $2
  ORDER BY rc."createdAt" DESC
  LIMIT 20
`, [cspebId, academicYearId]);
console.log(JSON.stringify(rcs.rows, null, 2));

console.log('\n=== [8] ReportCard status summary ===');
const summary = await client.query(`
  SELECT status, COUNT(*)::int AS n
  FROM report_cards
  WHERE "tenantId" = $1 AND "academicYearId" = $2
  GROUP BY status
`, [cspebId, academicYearId]);
console.log(JSON.stringify(summary.rows, null, 2));

console.log('\n=== [9] Classes where teacher is assigned (via TeacherClassAssignment) ===');
const teacherClasses = await client.query(`
  SELECT DISTINCT c.id, c.name, csl.code AS level_code, csl.name AS level_name
  FROM teacher_class_assignments tca
  JOIN classes c ON c.id = tca."classId"
  LEFT JOIN school_levels csl ON csl.id = c."schoolLevelId"
  WHERE tca."teacherId" = $1
`, [teacherId]);
console.log(JSON.stringify(teacherClasses.rows, null, 2));

console.log('\n=== [10] Evaluations assigned to this teacher (current year) ===');
const evals = await client.query(`
  SELECT e.id, e.title, e.status, e."teacherId", e."classId", c.name AS class_name,
         e."academicYearId", e."evaluationDate"
  FROM evaluations e
  LEFT JOIN classes c ON c.id = e."classId"
  WHERE e."teacherId" = $1 AND e."academicYearId" = $2
  ORDER BY e."evaluationDate" DESC
  LIMIT 10
`, [teacherId, academicYearId]);
console.log(`Found ${evals.rows.length} evaluations assigned to teacher ${teacherId}`);
console.log(JSON.stringify(evals.rows, null, 2));

console.log('\n=== [11] Periods for current academic year ===');
const periods = await client.query(`
  SELECT id, name, "startDate", "endDate", "isActive"
  FROM quarters
  WHERE "tenantId" = $1 AND "academicYearId" = $2
  ORDER BY "startDate"
`, [cspebId, academicYearId]);
console.log(JSON.stringify(periods.rows, null, 2));

await client.end();
console.log('\n✅ Done');
