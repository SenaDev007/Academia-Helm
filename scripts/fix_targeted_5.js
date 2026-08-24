/**
 * FIX TARGETED — Corrige les 5 mismatchs restants en forçant les valeurs Excel
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

// 5 mismatchs restants (Excel totalPay, Excel reste)
const TARGETS = [
  { lastName: 'OROU G. M. E.', firstName: 'Exaucee', excelTotalPay: 28000, excelReste: 0 },
  { lastName: 'OROU G.', firstName: 'Rayane', excelTotalPay: 48000, excelReste: 0 },
  { lastName: 'OROU W. O.', firstName: 'Ousniath', excelTotalPay: 38000, excelReste: 10000 },
  { lastName: 'AMADOU I.', firstName: 'Wafida', excelTotalPay: 118000, excelReste: 0 },
  { lastName: 'CHABI K.', firstName: 'Fadilath', excelTotalPay: 78000, excelReste: 0 },
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected');

  // Drop triggers
  await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');
  console.log('✅ Trigger dropped');

  for (const t of TARGETS) {
    // Find the student
    const r = await client.query(`
      SELECT sa.id, sa."totalDue", sa."totalPaid", sa."balance"
      FROM students s
      JOIN student_accounts sa ON sa."studentId" = s.id
      WHERE s."tenantId" = $1 AND sa."academicYearId" = $2
        AND s."lastName" = $3 AND s."firstName" = $4
    `, [TENANT_ID, YEAR_ID, t.lastName, t.firstName]);

    if (r.rows.length === 0) {
      console.log(`❌ ${t.lastName} ${t.firstName} non trouvé`);
      continue;
    }

    const a = r.rows[0];
    const newTotalPaid = t.excelTotalPay;
    const newBalance = t.excelReste;
    const newTotalDue = newTotalPaid + newBalance;

    console.log(`\n🔧 ${t.lastName} ${t.firstName}:`);
    console.log(`   Old: due=${a.totalDue} paid=${a.totalPaid} bal=${a.balance}`);
    console.log(`   New: due=${newTotalDue} paid=${newTotalPaid} bal=${newBalance}`);

    await client.query(`
      UPDATE student_accounts
      SET "totalDue" = $1, "totalPaid" = $2, "balance" = $3, "updatedAt" = now()
      WHERE id = $4
    `, [newTotalDue, newTotalPaid, newBalance, a.id]);
    console.log(`   ✅ Updated`);
  }

  // Recreate trigger
  await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');
  await client.query('CREATE TRIGGER prevent_balance_update_trigger BEFORE UPDATE OF "totalPaid", "balance" ON student_accounts FOR EACH ROW EXECUTE FUNCTION prevent_balance_update()');
  console.log('\n✅ Trigger recreated');

  await client.end();
  console.log('🔌 Done');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
