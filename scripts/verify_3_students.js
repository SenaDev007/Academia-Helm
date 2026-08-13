/**
 * Vérification détaillée des 3 élèves avec doublons INSCRIPTION
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tenantId = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
  const yearId = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

  // 3 élèves à vérifier
  const targets = [
    { lastName: 'DAKO', firstName: 'Doreen' },
    { lastName: 'DEGNON', firstName: 'Camel' },
    { lastName: 'MAMOUDOU', firstName: 'Rudwane' },
  ];

  for (const t of targets) {
    console.log('\n' + '='.repeat(100));
    console.log(`ÉLÈVE: ${t.lastName} ${t.firstName}`);
    console.log('='.repeat(100));

    const s = await client.query(`
      SELECT id FROM students
      WHERE "tenantId"=$1 AND "lastName" ILIKE $2 AND "firstName" ILIKE $3
    `, [tenantId, t.lastName, t.firstName]);

    if (s.rows.length === 0) {
      console.log('  ❌ non trouvé');
      continue;
    }
    const studentId = s.rows[0].id;

    const acc = await client.query(`
      SELECT id, "totalDue", "totalPaid", "balance", "arrearsAmount"
      FROM student_accounts WHERE "tenantId"=$1 AND "academicYearId"=$2 AND "studentId"=$3
    `, [tenantId, yearId, studentId]);

    if (acc.rows.length === 0) continue;
    const a = acc.rows[0];
    console.log(`\n  Compte: totalDue=${a.totalDue} totalPaid=${a.totalPaid} balance=${a.balance} arrears=${a.arrearsAmount}`);

    // Toutes les transactions INSCRIPTION (IMP-* et autres)
    const allInscriptTxs = await client.query(`
      SELECT ft.id, ft.amount, ft."receiptNumber", ft."createdAt",
             ab.id as "bdId", fs."feeType", ab."paidAmount" as "bdPaidAtTxTime"
      FROM finance_transactions ft
      JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
      JOIN account_breakdowns ab ON ab.id = fta."accountBreakdownId"
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE ft."studentAccountId" = $1 AND fs."feeType" = 'INSCRIPTION'
      ORDER BY ft."createdAt"
    `, [a.id]);

    console.log(`\n  📋 Toutes les transactions INSCRIPTION (${allInscriptTxs.rows.length}):`);
    for (const t of allInscriptTxs.rows) {
      const isImport = t.receiptNumber.startsWith('IMP-');
      console.log(`    ${isImport ? '📥' : '📄'} ${t.receiptNumber}`.padEnd(50)
                  + ` amount=${t.amount}`.padEnd(15)
                  + ` createdAt=${t.createdAt.toISOString()}`);
    }

    // Breakdown INSCRIPTION
    const bd = await client.query(`
      SELECT ab.id, ab."initialAmount", ab."paidAmount", ab."remainingAmount"
      FROM account_breakdowns ab
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE ab."studentAccountId" = $1 AND fs."feeType" = 'INSCRIPTION'
    `, [a.id]);

    if (bd.rows.length > 0) {
      const b = bd.rows[0];
      console.log(`\n  📊 Breakdown INSCRIPTION:`);
      console.log(`    initial=${b.initialAmount} paid=${b.paidAmount} remaining=${b.remainingAmount}`);
      console.log(`    Excès: ${Number(b.paidAmount) - Number(b.initialAmount)} FCFA`);
    }
  }

  await client.end();
  console.log('\n🔌 Done');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
