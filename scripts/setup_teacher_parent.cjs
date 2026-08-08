const pg = require('pg');
const bcrypt = require('bcryptjs');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

  // Set teacher password to NeufMont111
  const teacherPwd = 'NeufMont111';
  const hash = await bcrypt.hash(teacherPwd, 10);
  const r1 = await client.query(`
    UPDATE users SET "passwordHash" = $1
    WHERE email = 'dawesakpovi@gmail.com'
    RETURNING id, email, role, "firstName", "lastName"
  `, [hash]);
  console.log('Teacher password set:', r1.rows[0]);

  // Verify teacher login
  const loginRes = await fetch('https://api.academiahelm.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'cspeb-eveildafriqueeducation' },
    body: JSON.stringify({ email: 'dawesakpovi@gmail.com', password: teacherPwd }),
  });
  console.log('Teacher login:', loginRes.status, loginRes.status === 200 ? '✓ SUCCESS' : '✗ FAILED');

  // Find the children (students) of the parent (guardian userId = dffe5ffb...)
  const guardianUserId = 'dffe5ffb-06ec-4301-8ee7-4c17b396f82b';
  console.log('\n[Children] Students linked to guardian:');
  const children = await client.query(`
    SELECT s.id, s."firstName", s."lastName", s.matricule, s.gender,
           c.name AS class_name, sl.code AS level_code
    FROM student_guardians sg
    JOIN students s ON s.id = sg."studentId"
    LEFT JOIN student_enrollments se ON se."studentId" = s.id AND se.status = 'ACTIVE'
      AND se."academicYearId" = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a'
    LEFT JOIN classes c ON c.id = se."classId"
    LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
    WHERE sg."guardianId" IN (
      SELECT id FROM guardians WHERE "userId" = $1
    )
  `, [guardianUserId]);
  for (const c of children.rows) {
    console.log(`  • ${c.lastName} ${c.firstName} — matricule=${c.matricule} class=${c.class_name||'—'} level=${c.level_code||'—'}`);
  }

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
