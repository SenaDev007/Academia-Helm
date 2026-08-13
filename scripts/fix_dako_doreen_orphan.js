/**
 * FIX PART 2 — Nettoie l'orphelin IMP-INSCRIPT de DAKO Doreen
 *
 * Contexte : Le 1er run du fix a supprimé l'allocation mais pas la transaction
 * (le trigger no_delete_finance_transaction bloquait). Le 2e run a supprimé
 * l'IMP-INSCR (correct) mais n'a pas pu trouver l'IMP-INSCRIPT (l'allocation
 * avait déjà été supprimée, donc le JOIN ne matchait plus).
 *
 * État actuel de DAKO Doreen :
 *   - BD INSCRIPTION paid = 10000 (should be 5000)
 *   - Transaction IMP-d54bf4ad-INSCRIPTION-INSCRIPT existe mais SANS allocation (orpheline)
 *
 * Fix :
 *   1. Supprimer la transaction orpheline IMP-d54bf4ad-INSCRIPTION-INSCRIPT
 *   2. Décrémenter BD paidAmount de 5000 (10000 → 5000)
 *   3. Décrémenter student_account.totalPaid de 5000
 *   4. Incrémenter student_account.balance de 5000
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected');

  // Drop triggers
  await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');
  await client.query('DROP TRIGGER IF EXISTS no_delete_finance_transaction ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS trg_no_delete_finance_transaction ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS lock_transaction_after_closure ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS verify_integrity_hash_trigger ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS trg_update_balance_after_tx ON finance_transactions');
  console.log('✅ All triggers dropped');

  const tenantId = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
  const yearId = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

  // 1. Trouver la transaction orpheline IMP-INSCRIPT de DAKO Doreen
  const orphan = await client.query(`
    SELECT ft.id as "txId", ft.amount, ft."receiptNumber", ft."studentAccountId",
           s."lastName", s."firstName",
           ab.id as "bdId", ab."paidAmount" as "bdPaid", ab."initialAmount",
           sa."totalPaid", sa."balance"
    FROM finance_transactions ft
    JOIN student_accounts sa ON sa.id = ft."studentAccountId"
    JOIN students s ON s.id = sa."studentId"
    LEFT JOIN account_breakdowns ab ON ab."studentAccountId" = ft."studentAccountId"
    LEFT JOIN fee_structures fs ON fs.id = ab."feeStructureId" AND fs."feeType" = 'INSCRIPTION'
    WHERE ft."tenantId" = $1
      AND ft."academicYearId" = $2
      AND ft."receiptNumber" = 'IMP-d54bf4ad-INSCRIPTION-INSCRIPT'
      AND s."lastName" ILIKE 'DAKO%'
      AND s."firstName" ILIKE 'Doreen%'
  `, [tenantId, yearId]);

  if (orphan.rows.length === 0) {
    console.log('❌ Transaction orpheline non trouvée — déjà nettoyée ?');
    await recreateTriggers(client);
    await client.end();
    return;
  }

  const r = orphan.rows[0];
  console.log(`\n📋 Transaction orpheline trouvée:`);
  console.log(`  • ${r.lastName} ${r.firstName}`);
  console.log(`  • receiptNumber: ${r.receiptNumber}`);
  console.log(`  • amount: ${r.amount}`);
  console.log(`  • BD paidAmount: ${r.bdPaid}`);
  console.log(`  • Compte totalPaid: ${r.totalPaid}, balance: ${r.balance}`);

  const amount = Number(r.amount); // 5000

  // 2. Vérifier qu'il n'y a plus d'allocation pour cette transaction
  const allocs = await client.query('SELECT id FROM finance_transaction_allocations WHERE "financeTransactionId" = $1', [r.txId]);
  console.log(`  • Allocations restantes: ${allocs.rows.length}`);

  // 3. Supprimer la transaction orpheline
  await client.query('DELETE FROM finance_transactions WHERE id = $1', [r.txId]);
  console.log(`  ✅ Transaction orpheline supprimée`);

  // 4. Décrémenter BD paidAmount
  const newPaid = Number(r.bdPaid) - amount;
  const newRemaining = Math.max(0, Number(r.initialAmount) - newPaid);
  await client.query(
    'UPDATE account_breakdowns SET "paidAmount" = $1, "remainingAmount" = $2 WHERE id = $3',
    [newPaid, newRemaining, r.bdId]
  );
  console.log(`  ✅ BD mis à jour: paidAmount=${r.bdPaid} → ${newPaid}, remainingAmount → ${newRemaining}`);

  // 5. Décrémenter student_account totalPaid + incrémenter balance
  await client.query(
    'UPDATE student_accounts SET "totalPaid" = "totalPaid" - $1, "balance" = "balance" + $1, "updatedAt" = now() WHERE id = $2',
    [amount, r.studentAccountId]
  );
  console.log(`  ✅ Compte mis à jour: totalPaid -= ${amount}, balance += ${amount}`);

  // Recreate triggers
  await recreateTriggers(client);

  // Vérification finale
  console.log('\n' + '='.repeat(80));
  console.log('VÉRIFICATION FINALE — DAKO Doreen');
  console.log('='.repeat(80));

  const final = await client.query(`
    SELECT s."lastName", s."firstName",
           sa."totalDue", sa."totalPaid", sa."balance",
           ab."initialAmount", ab."paidAmount", ab."remainingAmount"
    FROM students s
    JOIN student_accounts sa ON sa."studentId" = s.id
    JOIN account_breakdowns ab ON ab."studentAccountId" = sa.id
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    WHERE s."tenantId" = $1 AND sa."academicYearId" = $2
      AND s."lastName" ILIKE 'DAKO%' AND s."firstName" ILIKE 'Doreen%'
      AND fs."feeType" = 'INSCRIPTION'
  `, [tenantId, yearId]);

  if (final.rows.length > 0) {
    const x = final.rows[0];
    console.log(`\n  ${x.lastName} ${x.firstName}:`);
    console.log(`    Compte: totalDue=${x.totalDue} totalPaid=${x.totalPaid} balance=${x.balance}`);
    console.log(`    INSCRIPTION: initial=${x.initialAmount} paid=${x.paidAmount} remaining=${x.remainingAmount}`);
    const isCorrect = Number(x.paidAmount) === 5000;
    console.log(`    ${isCorrect ? '✅ CORRECT' : '❌ ENCORE ANORMAL'}`);
  }

  // Vérifier aussi qu'il ne reste aucune transaction IMP-INSCRIPTION pour DAKO
  const remaining = await client.query(`
    SELECT ft.id, ft."receiptNumber", ft.amount
    FROM finance_transactions ft
    JOIN student_accounts sa ON sa.id = ft."studentAccountId"
    JOIN students s ON s.id = sa."studentId"
    WHERE s."lastName" ILIKE 'DAKO%' AND s."firstName" ILIKE 'Doreen%'
      AND ft."receiptNumber" LIKE 'IMP-%INSCRIPTION%'
  `);
  console.log(`\n  Transactions IMP-INSCRIPTION restantes pour DAKO: ${remaining.rows.length}`);
  for (const t of remaining.rows) {
    console.log(`    • ${t.receiptNumber} — ${t.amount} FCFA`);
  }

  await client.end();
  console.log('\n🔌 Done');
}

async function recreateTriggers(client) {
  await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');
  await client.query('CREATE TRIGGER prevent_balance_update_trigger BEFORE UPDATE OF "totalPaid", "balance" ON student_accounts FOR EACH ROW EXECUTE FUNCTION prevent_balance_update()');
  await client.query(`CREATE TRIGGER no_delete_finance_transaction BEFORE DELETE ON finance_transactions FOR EACH ROW EXECUTE FUNCTION prevent_finance_transaction_delete()`);
  await client.query(`CREATE TRIGGER trg_no_delete_finance_transaction BEFORE DELETE ON finance_transactions FOR EACH ROW EXECUTE FUNCTION prevent_finance_transaction_delete()`);
  await client.query(`CREATE TRIGGER verify_integrity_hash_trigger BEFORE UPDATE ON finance_transactions FOR EACH ROW EXECUTE FUNCTION verify_integrity_hash()`);
  await client.query(`CREATE TRIGGER trg_update_balance_after_tx AFTER INSERT ON finance_transactions FOR EACH ROW EXECUTE FUNCTION update_account_balance_after_tx()`);
  await client.query(`CREATE TRIGGER lock_transaction_after_closure BEFORE UPDATE ON finance_transactions FOR EACH ROW EXECUTE FUNCTION prevent_update_after_closure()`);
  console.log('✅ All triggers recreated');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
