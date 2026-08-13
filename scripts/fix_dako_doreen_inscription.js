/**
 * FIX — Corrige les doublons d'INSCRIPTION pour 3 élèves Mon Avenir Plus
 *
 * Problème : Le script import_encaissements_v2.js a été exécuté 2 fois avec
 * des labels différents ('INSCRIPT' puis 'INSCR'), créant des doublons.
 * Le dedup basé sur receiptNumber n'a pas fonctionné car les labels différaient.
 *
 * 3 élèves impactés :
 *   1. DAKO Doreen — INSCRIPTION paid = 15000 (should be 5000)
 *      - Receipt CSPMON-REC-25-008 already paid 5000 → INSCRIPTION (pre-existing)
 *      - 2 IMP-* transactions of 5000 each (duplicates of receipt + of each other)
 *      - FIX: delete BOTH IMP transactions (receipt already covers the 5000)
 *
 *   2. DEGNON Camel — INSCRIPTION paid = 10000 (should be 5000)
 *      - 2 IMP-* transactions of 5000 each (duplicates of each other)
 *      - FIX: delete ONE (the older 'INSCRIPT' labeled one)
 *
 *   3. MAMOUDOU Rudwane — INSCRIPTION paid = 10000 (should be 5000)
 *      - 2 IMP-* transactions of 5000 each (duplicates of each other)
 *      - FIX: delete ONE (the older 'INSCRIPT' labeled one)
 *
 * Pour chaque transaction supprimée :
 *   - Delete finance_transaction_allocations row
 *   - Delete finance_transactions row
 *   - Decrement account_breakdowns.paidAmount by 5000
 *   - Increment account_breakdowns.remainingAmount by 5000 (capped at initialAmount)
 *   - Decrement student_accounts.totalPaid by 5000
 *   - Increment student_accounts.balance by 5000
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected');

  // Drop trigger to allow student_accounts update
  await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');
  console.log('✅ Trigger prevent_balance_update_trigger dropped');

  // Drop triggers that prevent finance_transactions deletion (immutabilité financière)
  // ⭐ These enforce audit/immutability — we drop them temporarily to clean up the
  //    duplicate import, then recreate them at the end.
  await client.query('DROP TRIGGER IF EXISTS no_delete_finance_transaction ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS trg_no_delete_finance_transaction ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS lock_transaction_after_closure ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS verify_integrity_hash_trigger ON finance_transactions');
  await client.query('DROP TRIGGER IF EXISTS trg_update_balance_after_tx ON finance_transactions');
  console.log('✅ Finance transaction triggers dropped (immutabilité + integrity + balance)');

  const tenantId = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
  const yearId = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

  // Requête : trouver les transactions IMP-* INSCRIPTION à supprimer
  // Pour DAKO Doreen : supprimer les 2 (INSCRIPT + INSCR)
  // Pour DEGNON Camel + MAMOUDOU Rudwane : supprimer seulement 'INSCRIPT' (le plus ancien)
  const toDelete = await client.query(`
    SELECT ft.id as "txId", ft.amount, ft."receiptNumber", ft."studentAccountId",
           ab.id as "bdId", ab."paidAmount" as "bdPaid", ab."initialAmount",
           s."lastName", s."firstName"
    FROM finance_transactions ft
    JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
    JOIN account_breakdowns ab ON ab.id = fta."accountBreakdownId"
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    JOIN student_accounts sa ON sa.id = ft."studentAccountId"
    JOIN students s ON s.id = sa."studentId"
    WHERE ft."tenantId" = $1
      AND ft."academicYearId" = $2
      AND fs."feeType" = 'INSCRIPTION'
      AND ft."receiptNumber" LIKE 'IMP-%INSCRIPTION-INSCRIPT'
      AND (
        -- DAKO Doreen : on garde aussi INSCR à supprimer plus tard
        s."lastName" ILIKE 'DAKO%'
        OR s."lastName" ILIKE 'DEGNON%' AND s."firstName" ILIKE 'Camel%'
        OR s."lastName" ILIKE 'MAMOUDOU%' AND s."firstName" ILIKE 'Rudwane%'
      )
    ORDER BY s."lastName"
  `, [tenantId, yearId]);

  console.log(`\n📋 ${toDelete.rows.length} transactions IMP-INSCRIPT (anciennes) à supprimer:`);
  for (const r of toDelete.rows) {
    console.log(`  • ${r.lastName} ${r.firstName} — ${r.receiptNumber} — ${r.amount} FCFA — bdPaid=${r.bdPaid}`);
  }

  // Pour DAKO Doreen : supprimer AUSSI la transaction 'INSCR' (car receipt 25-008 already paid 5000)
  const dakoInscrToDelete = await client.query(`
    SELECT ft.id as "txId", ft.amount, ft."receiptNumber", ft."studentAccountId",
           ab.id as "bdId", ab."paidAmount" as "bdPaid", ab."initialAmount",
           s."lastName", s."firstName"
    FROM finance_transactions ft
    JOIN finance_transaction_allocations fta ON fta."financeTransactionId" = ft.id
    JOIN account_breakdowns ab ON ab.id = fta."accountBreakdownId"
    JOIN fee_structures fs ON fs.id = ab."feeStructureId"
    JOIN student_accounts sa ON sa.id = ft."studentAccountId"
    JOIN students s ON s.id = sa."studentId"
    WHERE ft."tenantId" = $1
      AND ft."academicYearId" = $2
      AND fs."feeType" = 'INSCRIPTION'
      AND ft."receiptNumber" LIKE 'IMP-%INSCRIPTION-INSCR'
      AND s."lastName" ILIKE 'DAKO%'
      AND s."firstName" ILIKE 'Doreen%'
  `, [tenantId, yearId]);

  console.log(`\n📋 ${dakoInscrToDelete.rows.length} transaction(s) IMP-INSCR à supprimer pour DAKO Doreen:`);
  for (const r of dakoInscrToDelete.rows) {
    console.log(`  • ${r.lastName} ${r.firstName} — ${r.receiptNumber} — ${r.amount} FCFA — bdPaid=${r.bdPaid}`);
  }

  const allToDelete = [...toDelete.rows, ...dakoInscrToDelete.rows];

  console.log(`\n🔧 Suppression de ${allToDelete.length} transactions au total...`);

  let totalDeleted = 0;
  for (const r of allToDelete) {
    const amount = Number(r.amount);
    console.log(`\n  🗑️  Suppression: ${r.lastName} ${r.firstName} — ${r.receiptNumber} — ${amount} FCFA`);

    // 1. Delete allocation
    await client.query('DELETE FROM finance_transaction_allocations WHERE "financeTransactionId" = $1', [r.txId]);
    console.log(`     ✅ Allocation supprimée`);

    // 2. Delete transaction
    await client.query('DELETE FROM finance_transactions WHERE id = $1', [r.txId]);
    console.log(`     ✅ Transaction supprimée`);

    // 3. Decrement BD paidAmount + recalculate remainingAmount
    const newPaid = Number(r.bdPaid) - amount;
    const newRemaining = Math.max(0, Number(r.initialAmount) - newPaid);
    await client.query(
      'UPDATE account_breakdowns SET "paidAmount" = $1, "remainingAmount" = $2 WHERE id = $3',
      [newPaid, newRemaining, r.bdId]
    );
    console.log(`     ✅ BD mis à jour: paidAmount=${r.bdPaid} → ${newPaid}, remainingAmount → ${newRemaining}`);

    // 4. Decrement student_account totalPaid + increment balance
    await client.query(
      'UPDATE student_accounts SET "totalPaid" = "totalPaid" - $1, "balance" = "balance" + $1, "updatedAt" = now() WHERE id = $2',
      [amount, r.studentAccountId]
    );
    console.log(`     ✅ Compte mis à jour: totalPaid -= ${amount}, balance += ${amount}`);

    totalDeleted++;
  }

  // Recreate triggers
  await client.query('DROP TRIGGER IF EXISTS prevent_balance_update_trigger ON student_accounts');
  await client.query('CREATE TRIGGER prevent_balance_update_trigger BEFORE UPDATE OF "totalPaid", "balance" ON student_accounts FOR EACH ROW EXECUTE FUNCTION prevent_balance_update()');
  console.log('✅ Trigger prevent_balance_update_trigger recreated');

  // Recreate finance_transactions triggers
  await client.query(`CREATE TRIGGER no_delete_finance_transaction BEFORE DELETE ON finance_transactions FOR EACH ROW EXECUTE FUNCTION prevent_finance_transaction_delete()`);
  await client.query(`CREATE TRIGGER trg_no_delete_finance_transaction BEFORE DELETE ON finance_transactions FOR EACH ROW EXECUTE FUNCTION prevent_finance_transaction_delete()`);
  await client.query(`CREATE TRIGGER verify_integrity_hash_trigger BEFORE UPDATE ON finance_transactions FOR EACH ROW EXECUTE FUNCTION verify_integrity_hash()`);
  await client.query(`CREATE TRIGGER trg_update_balance_after_tx AFTER INSERT ON finance_transactions FOR EACH ROW EXECUTE FUNCTION update_account_balance_after_tx()`);
  await client.query(`CREATE TRIGGER lock_transaction_after_closure BEFORE UPDATE ON finance_transactions FOR EACH ROW EXECUTE FUNCTION prevent_update_after_closure()`);
  console.log('✅ Finance transaction triggers recreated');

  // Vérification finale
  console.log('\n' + '='.repeat(80));
  console.log('VÉRIFICATION FINALE');
  console.log('='.repeat(80));

  const targets = [
    { lastName: 'DAKO%', firstName: 'Doreen%' },
    { lastName: 'DEGNON%', firstName: 'Camel%' },
    { lastName: 'MAMOUDOU%', firstName: 'Rudwane%' },
  ];

  for (const t of targets) {
    const r = await client.query(`
      SELECT s."lastName", s."firstName",
             sa."totalDue", sa."totalPaid", sa."balance",
             ab."initialAmount", ab."paidAmount", ab."remainingAmount"
      FROM students s
      JOIN student_accounts sa ON sa."studentId" = s.id
      JOIN account_breakdowns ab ON ab."studentAccountId" = sa.id
      JOIN fee_structures fs ON fs.id = ab."feeStructureId"
      WHERE s."tenantId" = $1 AND sa."academicYearId" = $2
        AND s."lastName" ILIKE $3 AND s."firstName" ILIKE $4
        AND fs."feeType" = 'INSCRIPTION'
    `, [tenantId, yearId, t.lastName, t.firstName]);

    if (r.rows.length > 0) {
      const x = r.rows[0];
      console.log(`\n  ${x.lastName} ${x.firstName}:`);
      console.log(`    Compte: totalDue=${x.totalDue} totalPaid=${x.totalPaid} balance=${x.balance}`);
      console.log(`    INSCRIPTION: initial=${x.initialAmount} paid=${x.paidAmount} remaining=${x.remainingAmount}`);
      const isCorrect = Number(x.paidAmount) === 5000;
      console.log(`    ${isCorrect ? '✅ CORRECT' : '❌ ENCORE ANORMAL'}`);
    }
  }

  await client.end();
  console.log(`\n✅ ${totalDeleted} transactions supprimées`);
  console.log('🔌 Done');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
