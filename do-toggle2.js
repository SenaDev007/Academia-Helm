const { Client } = require('pg');
const crypto = require('crypto');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const accountId = '73ecf57a-38d6-4aef-bc1a-532681316181';
  
  // Check current state (enrollment was already updated to REPEAT in previous run)
  const state = await client.query(`
    SELECT se."enrollmentType", sa."totalDue", sa.balance,
           (SELECT COUNT(*) FROM account_breakdowns ab WHERE ab."studentAccountId" = sa.id) as breakdown_count
    FROM student_accounts sa
    JOIN student_enrollments se ON se."studentId" = sa."studentId"
    WHERE sa.id = $1
  `, [accountId]);
  console.log('Current state:', JSON.stringify(state.rows[0], null, 2));
  
  // Create breakdown with explicit UUID
  const breakdownId = crypto.randomUUID();
  console.log('Creating breakdown with id:', breakdownId);
  await client.query(`
    INSERT INTO account_breakdowns (id, "studentAccountId", "feeStructureId", "initialAmount", "adjustedAmount", "paidAmount", "remainingAmount")
    VALUES ($1, $2, 'd8d74634-f30b-4225-8287-df873c8d6bc4', 50000, 50000, 0, 50000)
  `, [breakdownId, accountId]);
  console.log('✅ Breakdown created');
  
  // Update account totals
  await client.query(`SET LOCAL app.allow_balance_update = 'true'`);
  await client.query(`
    UPDATE student_accounts 
    SET "totalDue" = 50000, balance = 50000, "updatedAt" = NOW()
    WHERE id = $1
  `, [accountId]);
  console.log('✅ Account updated');
  
  // Final state
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
