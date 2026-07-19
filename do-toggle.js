const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const studentId = '188fca64-a57a-4d9b-a997-357e58b42af1';
  const academicYearId = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';
  const accountId = '73ecf57a-38d6-4aef-bc1a-532681316181';
  
  // 1. Update enrollment type: NEW → REPEAT
  console.log('1. Updating enrollment type NEW → REPEAT...');
  await client.query(`
    UPDATE student_enrollments 
    SET "enrollmentType" = 'REPEAT'
    WHERE "studentId" = $1 AND "academicYearId" = $2
  `, [studentId, academicYearId]);
  console.log('   ✅ Done');
  
  // 2. Delete old breakdowns (paidAmount = 0)
  console.log('2. Deleting old breakdowns (paidAmount = 0)...');
  const deleted = await client.query(`
    DELETE FROM account_breakdowns 
    WHERE "studentAccountId" = $1 AND "paidAmount" = 0
    RETURNING id
  `, [accountId]);
  console.log(`   ✅ Deleted ${deleted.rowCount} breakdowns`);
  
  // 3. Create new breakdowns for REPEAT (no INSCRIPTION, only TUITION)
  // Student level: 6ec8a1e5-df45-43f2-afbc-266ed153b828
  // TUITION fee for this level: d8d74634 (50000)
  console.log('3. Creating new breakdown (TUITION only, no INSCRIPTION)...');
  await client.query(`
    INSERT INTO account_breakdowns ("studentAccountId", "feeStructureId", "initialAmount", "adjustedAmount", "paidAmount", "remainingAmount")
    VALUES ($1, 'd8d74634-f30b-4225-8287-df873c8d6bc4', 50000, 50000, 0, 50000)
  `, [accountId]);
  console.log('   ✅ Done');
  
  // 4. Update account totals (with allow_balance_update flag)
  console.log('4. Updating account totals...');
  await client.query(`SET LOCAL app.allow_balance_update = 'true'`);
  await client.query(`
    UPDATE student_accounts 
    SET "totalDue" = 50000, balance = 50000, "updatedAt" = NOW()
    WHERE id = $1
  `, [accountId]);
  console.log('   ✅ Done');
  
  // Verify
  const result = await client.query(`
    SELECT sa."totalDue", sa.balance, se."enrollmentType",
           (SELECT COUNT(*) FROM account_breakdowns ab WHERE ab."studentAccountId" = sa.id) as breakdown_count
    FROM student_accounts sa
    JOIN student_enrollments se ON se."studentId" = sa."studentId"
    WHERE sa.id = $1
  `, [accountId]);
  console.log('\n✅ Final state:', JSON.stringify(result.rows[0], null, 2));
  
  await client.end();
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
