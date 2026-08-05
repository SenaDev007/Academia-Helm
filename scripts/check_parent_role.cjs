const pg = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

  // Check user dawesakpovi@gmail.com role + guardian
  const u = await client.query(`
    SELECT id, email, role, "firstName", "lastName"
    FROM users WHERE email = 'dawesakpovi@gmail.com'
  `);
  console.log('User:', u.rows[0]);

  // Check guardian
  const g = await client.query(`
    SELECT id, "firstName", "lastName", phone, email, "userId"
    FROM guardians WHERE "userId" = $1
  `, [u.rows[0].id]);
  console.log('Guardian:', g.rows[0]);

  // Check if user role is PARENT or ENSEIGNANT
  // The login form probably has a portal selector or auto-detects
  // We need to login as PARENT portal

  // Check children
  const children = await client.query(`
    SELECT s.id, s."firstName", s."lastName", s.matricule
    FROM student_guardians sg
    JOIN students s ON s.id = sg."studentId"
    WHERE sg."guardianId" = $1
  `, [g.rows[0].id]);
  console.log('Children:', children.rows);

  // Check grades for the child
  if (children.rows.length > 0) {
    const childId = children.rows[0].id;
    const grades = await client.query(`
      SELECT COUNT(*)::int AS cnt
      FROM grades WHERE "studentId" = $1 AND status = 'VALIDATED'
    `, [childId]);
    console.log(`Grades for ${children.rows[0].firstName}:`, grades.rows[0]);
  }

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
