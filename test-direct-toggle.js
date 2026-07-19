const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const studentId = '188fca64-a57a-4d9b-a997-357e58b42af1';
  const academicYearId = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';
  const tenantId = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
  
  // Check the student's schoolLevelId
  const student = await client.query('SELECT "schoolLevelId" FROM students WHERE id = $1', [studentId]);
  console.log('Student schoolLevelId:', student.rows[0]?.schoolLevelId);
  
  // Check the enrollment's classId
  const enr = await client.query('SELECT "classId", "academicClassId", "enrollmentType" FROM student_enrollments WHERE "studentId" = $1 AND "academicYearId" = $2', [studentId, academicYearId]);
  console.log('Enrollment:', JSON.stringify(enr.rows[0]));
  
  // Check if there's a REINSCRIPTION fee type for this tenant/year
  const reinFees = await client.query(`
    SELECT id, "feeType", "totalAmount", "levelId", "classId"
    FROM fee_structures
    WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "feeType" = 'REINSCRIPTION'
  `, [tenantId, academicYearId]);
  console.log('REINSCRIPTION fees:', reinFees.rows.length);
  reinFees.rows.forEach(f => console.log('  -', f.id, f.feeType, f.totalAmount, 'level:', f.levelId));
  
  // Check INSCRIPTION fees
  const inscFees = await client.query(`
    SELECT id, "feeType", "totalAmount", "levelId", "classId"
    FROM fee_structures
    WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "feeType" = 'INSCRIPTION'
  `, [tenantId, academicYearId]);
  console.log('INSCRIPTION fees:', inscFees.rows.length);
  inscFees.rows.forEach(f => console.log('  -', f.id, f.feeType, f.totalAmount, 'level:', f.levelId));
  
  // Check TUITION fees matching student's level
  const studentLevelId = student.rows[0]?.schoolLevelId;
  const tuitionFees = await client.query(`
    SELECT id, "feeType", "totalAmount", "levelId", "classId"
    FROM fee_structures
    WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "feeType" = 'TUITION'
    AND ("levelId" = $3 OR "levelId" IS NULL)
  `, [tenantId, academicYearId, studentLevelId]);
  console.log('TUITION fees for student level:', tuitionFees.rows.length);
  tuitionFees.rows.forEach(f => console.log('  -', f.id, f.feeType, f.totalAmount, 'level:', f.levelId, 'class:', f.classId));
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
