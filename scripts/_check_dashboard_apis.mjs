import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// Find "Mon Avenir Plus" tenant
const tenant = await client.query(`
  SELECT id, name, slug, subdomain FROM tenants
  WHERE name ILIKE '%avenir%plus%' OR name ILIKE '%mon avenir%' OR slug ILIKE '%avenir%'
  LIMIT 5
`);
console.log('=== Tenant ===');
console.log(JSON.stringify(tenant.rows, null, 2));

if (tenant.rows.length === 0) {
  console.log('No tenant found');
  await client.end();
  process.exit(0);
}

const tenantId = tenant.rows[0].id;

// Active academic year
const ay = await client.query(`
  SELECT id, label, "isActive" FROM academic_years WHERE "tenantId" = $1 ORDER BY "isActive" DESC, label DESC LIMIT 3
`, [tenantId]);
console.log('\n=== Academic years ===');
console.log(JSON.stringify(ay.rows, null, 2));

const ayId = ay.rows[0]?.id;

// Students statistics
const stats = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS total_active,
    COUNT(*)::int AS total
  FROM students WHERE "tenantId" = $1
`, [tenantId]);
console.log('\n=== Students stats ===');
console.log(JSON.stringify(stats.rows, null, 2));

// By gender
const gender = await client.query(`
  SELECT gender, COUNT(*)::int AS count
  FROM students WHERE "tenantId" = $1 AND status = 'ACTIVE'
  GROUP BY gender
`, [tenantId]);
console.log('\n=== By gender ===');
console.log(JSON.stringify(gender.rows, null, 2));

// By class
const byClass = await client.query(`
  SELECT c.name AS class_name, COUNT(se.id)::int AS count
  FROM classes c
  JOIN student_enrollments se ON se."classId" = c.id
  WHERE c."tenantId" = $1 AND se."academicYearId" = $2
    AND se.status IN ('ACTIVE', 'VALIDATED', 'ADMITTED', 'ENROLLED')
  GROUP BY c.name ORDER BY count DESC LIMIT 10
`, [tenantId, ayId]);
console.log('\n=== By class ===');
console.log(JSON.stringify(byClass.rows, null, 2));

// Finance KPIs
const fin = await client.query(`
  SELECT
    COALESCE(SUM(amount), 0)::float AS total_revenue,
    COUNT(*)::int AS payment_count
  FROM payments
  WHERE "tenantId" = $1 AND status = 'COMPLETED'
    AND "createdAt" >= '2026-01-01'
`, [tenantId]);
console.log('\n=== Finance (year) ===');
console.log(JSON.stringify(fin.rows, null, 2));

// Today's revenue
const today = await client.query(`
  SELECT COALESCE(SUM(amount), 0)::float AS today_revenue
  FROM payments
  WHERE "tenantId" = $1 AND status = 'COMPLETED'
    AND DATE("createdAt") = CURRENT_DATE
`, [tenantId]);
console.log('\n=== Today revenue ===');
console.log(JSON.stringify(today.rows, null, 2));

// Unpaid/arrears
const arrears = await client.query(`
  SELECT
    COALESCE(SUM("arrearsAmount"), 0)::float AS total_arrears,
    COUNT(*) FILTER (WHERE "arrearsAmount" > 0)::int AS students_with_arrears
  FROM student_accounts
  WHERE "tenantId" = $1
`, [tenantId]);
console.log('\n=== Arrears ===');
console.log(JSON.stringify(arrears.rows, null, 2));

// Grades averages
const grades = await client.query(`
  SELECT
    COALESCE(AVG(score), 0)::float AS avg_score,
    COUNT(*)::int AS grade_count
  FROM grades
  WHERE "tenantId" = $1
`, [tenantId]);
console.log('\n=== Grades ===');
console.log(JSON.stringify(grades.rows, null, 2));

// Attendance rate (last 30 days)
const att = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE status = 'PRESENT')::float AS present,
    COUNT(*)::float AS total_records
  FROM attendance_records
  WHERE "tenantId" = $1
    AND date >= CURRENT_DATE - INTERVAL '30 days'
`, [tenantId]);
console.log('\n=== Attendance (30 days) ===');
console.log(JSON.stringify(att.rows, null, 2));

await client.end();
