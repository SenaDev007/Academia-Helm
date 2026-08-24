/**
 * Audit DB pour DAKO Doreen + tous les élèves Mon Avenir Plus
 * Vérifie les finance_transactions de type INSCRIPTION
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tenantId = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
  const yearId = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

  console.log('='.repeat(80));
  console.log('AUDIT DB — transactions INSCRIPTION pour Mon Avenir Plus');
  console.log('='.repeat(80));

  // 1. Find DAKO Doreen
  const dako = await client.query(`
    SELECT id, "firstName", "lastName"
    FROM students
    WHERE "tenantId"=$1 AND "lastName" ILIKE 'DAKO%' AND "firstName" ILIKE 'Doreen%'
  `, [tenantId]);

  if (dako.rows.length === 0) {
    console.log('❌ DAKO Doreen non trouvée');
  } else {
    for (const s of dako.rows) {
      console.log(`\n👤 ${s.lastName} ${s.firstName} (id: ${s.id})`);

      // Get account
      const acc = await client.query(`
        SELECT id, "totalDue", "totalPaid", "balance", "arrearsAmount"
        FROM student_accounts
        WHERE "tenantId"=$1 AND "academicYearId"=$2 AND "studentId"=$3
      `, [tenantId, yearId, s.id]);

      if (acc.rows.length === 0) {
        console.log('  ❌ Pas de compte');
        continue;
      }
      const a = acc.rows[0];
      console.log(`  💰 Compte: totalDue=${a.totalDue} totalPaid=${a.totalPaid} balance=${a.balance} arrears=${a.arrearsAmount}`);

      // Get all transactions for this account
      const txs = await client.query(`
        SELECT ft.id, ft.amount, ft.type, ft."receiptNumber", ft."createdAt",
               ab.id as "bdId", fs."feeType", ab."initialAmount", ab."adjustedAmount", ab."paidAmount", ab."remainingAmount"
        FROM finance_transactions ft
        LEFT JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
        LEFT JOIN account_breakdowns ab ON ab.id = fta."accountBreakdownId"
        LEFT JOIN fee_structures fs ON fs.id = ab."feeStructureId"
        WHERE ft."studentAccountId" = $1
        ORDER BY ft."createdAt"
      `, [a.id]);

      console.log(`  📋 ${txs.rows.length} transactions:`);
      for (const t of txs.rows) {
        const bdInfo = t.feeType ? ` [${t.feeType}: initial=${t.initialAmount} paid=${t.paidAmount} remaining=${t.remainingAmount}]` : '';
        console.log(`    • ${t.type} ${t.amount} FCFA — ${t.receiptNumber}${bdInfo}`);
      }

      // Get all breakdowns
      const bds = await client.query(`
        SELECT ab.id, fs."feeType", ab."initialAmount", ab."adjustedAmount", ab."paidAmount", ab."remainingAmount"
        FROM account_breakdowns ab
        JOIN fee_structures fs ON fs.id = ab."feeStructureId"
        WHERE ab."studentAccountId" = $1
        ORDER BY fs."feeType"
      `, [a.id]);

      console.log(`  📊 ${bds.rows.length} breakdowns:`);
      for (const b of bds.rows) {
        console.log(`    • ${b.feeType}: initial=${b.initialAmount} adjusted=${b.adjustedAmount} paid=${b.paidAmount} remaining=${b.remainingAmount}`);
      }
    }
  }

  // 2. Audit ALL inscription transactions (find any anomalies)
  console.log('\n' + '='.repeat(80));
  console.log('AUDIT GLOBAL — toutes les transactions INSCRIPTION anormales');
  console.log('='.repeat(80));

  const anomalies = await client.query(`
    SELECT s."lastName", s."firstName", ft.amount, ft."receiptNumber",
           ab."initialAmount", ab."paidAmount",
           CASE WHEN ft.amount != 5000 AND ft.amount != 8000 THEN '⚠️ AMOUNT != 5000/8000' END as flag
    FROM finance_transactions ft
    JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
    JOIN account_breakdowns ab ON ab.id = fta."accountBreakdownId"
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    JOIN student_accounts sa ON sa.id = ft."studentAccountId"
    JOIN students s ON s.id = sa."studentId"
    WHERE ft."tenantId" = $1 AND ft."academicYearId" = $2 AND fs."feeType" = 'INSCRIPTION'
    ORDER BY ft.amount DESC, s."lastName"
  `, [tenantId, yearId]);

  console.log(`\n📊 ${anomalies.rows.length} transactions INSCRIPTION trouvées:\n`);
  for (const r of anomalies.rows) {
    const expected = r.initialAmount;
    const isAnomaly = r.amount !== 5000 && r.amount !== 8000;
    const overPaid = r.amount > r.initialAmount ? ' ⚠️ OVERPAID vs initial' : '';
    console.log(`  ${r.lastName} ${r.firstName}`.padEnd(40)
                + ` amount=${String(r.amount).padStart(6)}`
                + ` initial=${String(expected).padStart(6)}`
                + ` paid=${String(r.paidAmount).padStart(6)}`
                + ` ${r.flag || ''}${overPaid}`);
  }

  await client.end();
  console.log('\n🔌 Done');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
