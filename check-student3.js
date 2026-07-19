const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const students = await client.query(`
    SELECT id, "firstName", "lastName", matricule, "tenantId"
    FROM students
    WHERE "lastName" ILIKE '%GORADO%' OR "firstName" ILIKE '%Charbaniath%'
    LIMIT 5
  `);
  console.log('Students found:', students.rows.length);
  students.rows.forEach(s => console.log('  -', s.id, s.firstName, s.lastName, s.matricule));
  
  if (students.rows.length > 0) {
    const s = students.rows[0];
    const enrollments = await client.query(`
      SELECT id, "enrollmentType", "academicYearId", "classId", "academicClassId", status
      FROM student_enrollments WHERE "studentId" = $1
    `, [s.id]);
    console.log('Enrollments:', JSON.stringify(enrollments.rows, null, 2));
    
    const accounts = await client.query(`
      SELECT id, "totalDue", "totalPaid", balance, status
      FROM student_accounts WHERE "studentId" = $1
    `, [s.id]);
    console.log('Accounts:', JSON.stringify(accounts.rows, null, 2));
  }
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
