import pg from 'pg';
const c = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const TID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const AYID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

// Check students.academicYearId
console.log('=== Students.academicYearId ===');
const s = await c.query(`SELECT "academicYearId", COUNT(*)::int n FROM students WHERE "tenantId"=$1 GROUP BY "academicYearId"`, [TID]);
console.log(JSON.stringify(s.rows, null, 2));

// Count students with that academicYearId + ACTIVE
const sa = await c.query(`SELECT COUNT(*)::int n FROM students WHERE "tenantId"=$1 AND "academicYearId"=$2 AND status='ACTIVE' AND "isActive"=true`, [TID, AYID]);
console.log(`\nActive students with AY ${AYID}: ${sa.rows[0].n}`);

// Count via enrollments
const se = await c.query(`SELECT COUNT(*)::int n FROM student_enrollments WHERE "tenantId"=$1 AND "academicYearId"=$2 AND status='ACTIVE'`, [TID, AYID]);
console.log(`Via enrollments: ${se.rows[0].n}`);

// Check finance KPI actual response
console.log('\n=== finance KPI query ===');
const fk = await c.query(`
  SELECT
    COALESCE(SUM("totalDue"),0)::float AS total_due,
    COALESCE(SUM("totalPaid"),0)::float AS total_paid,
    COALESCE(SUM("arrearsAmount"),0)::float AS arrears
  FROM student_accounts
  WHERE "tenantId"=$1 AND "academicYearId"=$2
`, [TID, AYID]);
console.log(JSON.stringify(fk.rows[0], null, 2));

await c.end();
