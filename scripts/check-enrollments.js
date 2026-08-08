const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // 1. With status filter
  const r1 = await db.query(`
    SELECT se.id, se."studentId", se.status, s."firstName", s."lastName"
    FROM student_enrollments se
    INNER JOIN students s ON s.id = se."studentId"
    WHERE se."classId" = $1 AND se."tenantId" = $2 AND se."academicYearId" = $3
      AND se.status IN ('ACTIVE', 'ADMITTED', 'ENROLLED', 'CONFIRMED')
  `, ['2f2b0dd1-e41e-4876-aea5-5750f7e076ef', '59b8c348-ae5f-4d67-8fbd-af6aefa1f394', 'a7593470-e4f4-460a-b3b6-4dabe53bec2a']);
  console.log('With status filter:', r1.rows.length);
  r1.rows.forEach(e => console.log(`  ${e.firstName} ${e.lastName} | status=${e.status}`));

  // 2. Without status filter
  const r2 = await db.query(`
    SELECT se.id, se."studentId", se.status
    FROM student_enrollments se
    WHERE se."classId" = $1 AND se."tenantId" = $2 AND se."academicYearId" = $3
  `, ['2f2b0dd1-e41e-4876-aea5-5750f7e076ef', '59b8c348-ae5f-4d67-8fbd-af6aefa1f394', 'a7593470-e4f4-460a-b3b6-4dabe53bec2a']);
  console.log('\nWithout status filter:', r2.rows.length);
  r2.rows.forEach(e => console.log(`  status=${e.status}`));

  // 3. Check the column name - maybe it's "enrollmentStatus" not "status"
  const cols = await db.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'student_enrollments' AND column_name LIKE '%status%'
    OR (table_name = 'student_enrollments' AND column_name LIKE '%enrollment%')
  `);
  console.log('\nStatus columns:', cols.rows.map(c => c.column_name));

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
