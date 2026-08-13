/**
 * Audit détaillé des transactions IMP-* INSCRIPTION (issues de l'import Excel)
 * Identifie les doublons créés par 2 exécutions du script avec labels différents
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tenantId = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
  const yearId = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

  console.log('='.repeat(100));
  console.log('AUDIT — Transactions IMP-* INSCRIPTION (doublons potentiels)');
  console.log('='.repeat(100));

  // Find all IMP-* INSCRIPTION transactions
  const imps = await client.query(`
    SELECT ft.id, ft.amount, ft."receiptNumber", ft."createdAt",
           s."lastName", s."firstName", s.id as "studentId",
           sa.id as "accountId", sa."totalPaid", sa."balance",
           ab.id as "bdId", ab."paidAmount" as "bdPaid"
    FROM finance_transactions ft
    JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
    JOIN account_breakdowns ab ON ab.id = fta."accountBreakdownId"
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    JOIN student_accounts sa ON sa.id = ft."studentAccountId"
    JOIN students s ON s.id = sa."studentId"
    WHERE ft."tenantId" = $1
      AND ft."academicYearId" = $2
      AND fs."feeType" = 'INSCRIPTION'
      AND ft."receiptNumber" LIKE 'IMP-%'
    ORDER BY s."lastName", ft."receiptNumber"
  `, [tenantId, yearId]);

  console.log(`\n📊 ${imps.rows.length} transactions IMP-* INSCRIPTION trouvées:\n`);

  // Group by student
  const byStudent = new Map();
  for (const r of imps.rows) {
    const key = r.studentId;
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key).push(r);
  }

  let duplicates = 0;
  for (const [studentId, txs] of byStudent) {
    const hasMultiple = txs.length > 1;
    if (hasMultiple) {
      duplicates++;
      const s = txs[0];
      console.log(`\n⚠️  DOUBLON: ${s.lastName} ${s.firstName} (${txs.length} transactions INSCRIPTION importées)`);
      console.log(`    Compte: totalPaid=${s.totalPaid} balance=${s.balance}`);
      console.log(`    Breakdown INSCRIPTION: paid=${s.bdPaid}`);
      for (const t of txs) {
        console.log(`    • ${t.receiptNumber} — ${t.amount} FCFA — ${t.createdAt.toISOString()}`);
      }
    } else {
      const s = txs[0];
      console.log(`✅ ${s.lastName} ${s.firstName}: 1 transaction INSCRIPTION (${s.amount} FCFA, ${s.receiptNumber})`);
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log(`RÉSUMÉ: ${duplicates} élèves avec doublons INSCRIPTION (sur ${byStudent.size} total)`);
  console.log('='.repeat(100));

  // Check the BD paidAmount for INSCRIPTION breakdowns (any > 5000 or > 8000)
  console.log('\n📊 Breakdowns INSCRIPTION avec paidAmount > initialAmount:');
  const overpaid = await client.query(`
    SELECT ab.id, ab."initialAmount", ab."paidAmount", ab."remainingAmount",
           s."lastName", s."firstName",
           sa.id as "accountId"
    FROM account_breakdowns ab
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    JOIN student_accounts sa ON sa.id = ab."studentAccountId"
    JOIN students s ON s.id = sa."studentId"
    WHERE sa."tenantId" = $1
      AND sa."academicYearId" = $2
      AND fs."feeType" = 'INSCRIPTION'
      AND ab."paidAmount" > ab."initialAmount"
    ORDER BY ab."paidAmount" DESC
  `, [tenantId, yearId]);

  console.log(`\n${overpaid.rows.length} breakdowns INSCRIPTION overpaid:`);
  for (const r of overpaid.rows) {
    const excess = Number(r.paidAmount) - Number(r.initialAmount);
    console.log(`  • ${r.lastName} ${r.firstName}`.padEnd(40)
                + ` initial=${r.initialAmount} paid=${r.paidAmount} (excès: ${excess})`
                + ` accountId=${r.accountId}`);
  }

  await client.end();
  console.log('\n🔌 Done');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
