const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const studentId = '188fca64-a57a-4d9b-a997-357e58b42af1';
  const academicYearId = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';
  const enrollmentId = 'c468772d-cfdb-4032-a0a9-3104e49c2268';
  const tenantId = (await client.query('SELECT "tenantId" FROM students WHERE id = $1', [studentId])).rows[0].tenantId;
  console.log('Tenant:', tenantId);
  
  // Check fee structures for this tenant/year
  const fees = await client.query(`
    SELECT id, "feeType", "totalAmount", "isActive", "classId", "levelId"
    FROM fee_structures
    WHERE "tenantId" = $1 AND "academicYearId" = $2
  `, [tenantId, academicYearId]);
  console.log('Fee structures:', JSON.stringify(fees.rows, null, 2));
  
  // Check account breakdowns
  const breakdowns = await client.query(`
    SELECT id, "feeStructureId", "initialAmount", "paidAmount", "remainingAmount"
    FROM account_breakdowns
    WHERE "studentAccountId" = '73ecf57a-38d6-4aef-bc1a-532681316181'
  `);
  console.log('Breakdowns:', JSON.stringify(breakdowns.rows, null, 2));
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
