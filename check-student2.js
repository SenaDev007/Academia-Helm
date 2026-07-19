const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  // Find column names for student_enrollments
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'student_enrollments' ORDER BY ordinal_position
  `);
  console.log('student_enrollments columns:', cols.rows.map(r => r.column_name).join(', '));
  
  // Find the student
  const students = await client.query(`
    SELECT id, first_name, last_name, matricule, tenant_id
    FROM students
    WHERE last_name ILIKE '%GORADO%' OR first_name ILIKE '%Charbaniath%'
    LIMIT 5
  `);
  console.log('Students found:', students.rows.length);
  students.rows.forEach(s => console.log('  -', s.id, s.first_name, s.last_name, s.matricule));
  
  if (students.rows.length > 0) {
    const s = students.rows[0];
    const enrollments = await client.query(`
      SELECT * FROM student_enrollments WHERE "studentId" = $1
    `, [s.id]);
    console.log('Enrollments:', JSON.stringify(enrollments.rows, null, 2));
    
    const accounts = await client.query(`
      SELECT * FROM student_accounts WHERE "studentId" = $1
    `, [s.id]);
    console.log('Accounts:', JSON.stringify(accounts.rows, null, 2));
  }
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
