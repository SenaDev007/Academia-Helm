const { Client } = require('pg');
const crypto = require('crypto');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const accountId = '73ecf57a-38d6-4aef-bc1a-532681316181';
  
  // Use a transaction with SET LOCAL
  await client.query('BEGIN');
  await client.query(`SET LOCAL app.allow_balance_update = 'true'`);
  
  // The breakdown was already created in previous run. Just update the account.
  await client.query(`
    UPDATE student_accounts 
    SET "totalDue" = 50000, balance = 50000, "updatedAt" = NOW()
    WHERE id = $1
  `, [accountId]);
  
  await client.query('COMMIT');
  console.log('✅ Account updated in transaction');
  
  // Final state
  const result = await client.query(`
    SELECT sa."totalDue", sa.balance, se."enrollmentType",
           (SELECT COUNT(*) FROM account_breakdowns ab WHERE ab."studentAccountId" = sa.id) as breakdown_count
    FROM student_accounts sa
    JOIN student_enrollments se ON se."studentId" = sa."studentId"
    WHERE sa.id = $1
  `, [accountId]);
  console.log('Final state:', JSON.stringify(result.rows[0], null, 2));
  
  await client.end();
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
