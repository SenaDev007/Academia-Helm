const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();

  // 1. Students with guardians
  console.log('═══ Students with guardians ═══');
  const students = await db.query(`
    SELECT s.id, s."firstName", s."lastName", s."matricule", s."tenantId",
           sg."guardianId", sg."relationship"
    FROM students s
    INNER JOIN student_guardians sg ON sg."studentId" = s.id
    LIMIT 5
  `);
  students.rows.forEach(s => {
    console.log(`  ${s.lastName} ${s.firstName} (${s.matricule}) → guardian ${s.guardianId.substring(0,8)}`);
  });

  if (students.rows.length === 0) {
    console.log('No students with guardians found!');
    await db.end();
    return;
  }

  const student = students.rows[0];
  const studentId = student.id;
  const tenantId = student.tenantId;

  // 2. Academic years
  console.log('\n═══ Academic Years ═══');
  const ay = await db.query('SELECT id, name, label FROM academic_years ORDER BY "startDate" DESC LIMIT 5');
  ay.rows.forEach(y => console.log(`  ${y.id.substring(0,8)}... | ${y.name} | ${y.label}`));

  if (ay.rows.length === 0) {
    console.log('No academic years found!');
    await db.end();
    return;
  }

  // Try each academic year
  for (const year of ay.rows) {
    const ayId = year.id;
    console.log(`\n═══ Checking ${year.name} (${year.label}) ═══`);

    // StudentAccount
    const acc = await db.query(`
      SELECT id, "totalDue", "totalPaid", balance, "arrearsAmount", status, "academicYearId"
      FROM student_accounts
      WHERE "studentId" = $1 AND "academicYearId" = $2
      LIMIT 1
    `, [studentId, ayId]);
    console.log(`  StudentAccount: ${acc.rows.length > 0 ? JSON.stringify(acc.rows[0]) : 'NONE'}`);

    if (acc.rows.length > 0) {
      const accId = acc.rows[0].id;
      const bd = await db.query(`
        SELECT ab.id, ab."initialAmount", ab."adjustedAmount", ab."paidAmount", ab."remainingAmount",
               fs.name as "feeName", fs."feeType"
        FROM account_breakdowns ab
        INNER JOIN fee_structures fs ON fs.id = ab."feeStructureId"
        WHERE ab."studentAccountId" = $1
      `, [accId]);
      console.log(`  AccountBreakdowns (${bd.rows.length}):`);
      bd.rows.forEach(b => {
        console.log(`    - ${b.feeName} (${b.feeType}) | initial=${b.initialAmount} adjusted=${b.adjustedAmount} paid=${b.paidAmount} remaining=${b.remainingAmount}`);
      });
    }
  }

  // 3. FeeStructures for this tenant
  console.log(`\n═══ FeeStructures for tenant ${tenantId.substring(0,8)}... ═══`);
  const fees = await db.query(`
    SELECT fs.id, fs.name, fs."feeType", fs."totalAmount", fs."isActive", fs."academicYearId",
           ay.name as "ayName"
    FROM fee_structures fs
    LEFT JOIN academic_years ay ON ay.id = fs."academicYearId"
    WHERE fs."tenantId" = $1
    LIMIT 20
  `, [tenantId]);
  console.log(`  Found ${fees.rows.length} fee structures:`);
  fees.rows.forEach(f => {
    console.log(`    - ${f.name} (${f.feeType}) | amount=${f.totalAmount} | active=${f.isActive} | year=${f.ayName || '?'}`);
  });

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
