const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  // Check if classId d4f4f1f2 exists in classes table
  const classResult = await client.query(`
    SELECT id, name, code FROM classes WHERE id = 'd4f4f1f2-805b-4d4d-86c4-01f73c6e9679'
  `);
  console.log('Class lookup:', JSON.stringify(classResult.rows, null, 2));
  
  // Check if it's in academic_classes
  const academicClassResult = await client.query(`
    SELECT id, name, code FROM academic_classes WHERE id = 'd4f4f1f2-805b-4d4d-86c4-01f73c6e9679'
  `);
  console.log('Academic class lookup:', JSON.stringify(academicClassResult.rows, null, 2));
  
  // Check the student's schoolLevelId
  const student = await client.query(`
    SELECT id, "schoolLevelId" FROM students WHERE id = '188fca64-a57a-4d9b-a997-357e58b42af1'
  `);
  console.log('Student schoolLevelId:', JSON.stringify(student.rows, null, 2));
  
  // Check what the enrollment classId actually points to
  const enrollment = await client.query(`
    SELECT "classId", "academicClassId" FROM student_enrollments WHERE id = 'c468772d-cfdb-4032-a0a9-3104e49c2268'
  `);
  console.log('Enrollment:', JSON.stringify(enrollment.rows, null, 2));
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
