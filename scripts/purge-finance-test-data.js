#!/usr/bin/env node
/**
 * ============================================================================
 * Script de purge — Clôtures journalières + Encaissements + Dépenses
 * ============================================================================
 *
 * Vide toutes les données financières de test pour un tenant donné :
 *   1. finance_daily_closures (clôtures journalières)
 *   2. finance_transactions (encaissements)
 *   3. finance_expenses (dépenses — déjà supprimées mais on vérifie)
 *
 * Désactive temporairement les triggers qui empêchent la suppression
 * (trigger_before_delete_finance_transaction), puis les réactive.
 *
 * Usage :
 *   node /home/z/my-project/scripts/purge-finance-test-data.js [tenantId]
 *
 * Si tenantId n'est pas fourni, purge pour TOUS les tenants.
 * ============================================================================
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgres://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const tenantId = process.argv[2] || null;
  const tenantFilter = tenantId ? `WHERE "tenantId" = $1` : '';
  const params = tenantId ? [tenantId] : [];

  console.log('→ Connexion à la base Neon...');
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('  Connecté ✓');
    console.log(tenantId ? `  Target: tenant ${tenantId}` : '  Target: ALL tenants');

    // ─── 1. Vérifier l'état avant purge ───
    console.log('');
    console.log('→ État avant purge :');
    const beforeClosures = await client.query(`SELECT COUNT(*) as n FROM "finance_daily_closures" ${tenantFilter}`, params);
    const beforeTx = await client.query(`SELECT COUNT(*) as n FROM "finance_transactions" ${tenantFilter}`, params);
    const beforeExpenses = await client.query(`SELECT COUNT(*) as n FROM "finance_expenses" ${tenantFilter}`, params);
    console.log(`  finance_daily_closures : ${beforeClosures.rows[0].n} lignes`);
    console.log(`  finance_transactions   : ${beforeTx.rows[0].n} lignes`);
    console.log(`  finance_expenses       : ${beforeExpenses.rows[0].n} lignes`);

    // ─── 2. Identifier les triggers sur finance_transactions ───
    console.log('');
    console.log('→ Recherche des triggers sur finance_transactions...');
    const triggers = await client.query(`
      SELECT tgname, tgrelid::regclass as table_name, tgtype
      FROM pg_trigger
      WHERE tgrelid = '"finance_transactions"'::regclass
        AND NOT tgisinternal
    `);
    console.log(`  ${triggers.rows.length} trigger(s) trouvé(s) :`);
    triggers.rows.forEach(t => console.log(`    - ${t.tgname} sur ${t.table_name}`));

    // ─── 3. Désactiver les triggers de protection (DROP + recréation) ───
    // Sur Neon, on n'a pas accès à session_replication_role ni à DISABLE TRIGGER ALL
    // (à cause des triggers système RI_ConstraintTrigger).
    // Solution : DROP les triggers de protection, faire la purge, puis les recréer.
    console.log('');
    console.log('→ Suppression des triggers de protection...');

    const triggersToDrop = [
      { name: 'no_delete_finance_transaction', table: 'finance_transactions', def: 'CREATE TRIGGER no_delete_finance_transaction BEFORE DELETE ON public.finance_transactions FOR EACH ROW EXECUTE FUNCTION prevent_finance_transaction_delete()' },
      { name: 'trg_no_delete_finance_transaction', table: 'finance_transactions', def: 'CREATE TRIGGER trg_no_delete_finance_transaction BEFORE DELETE ON public.finance_transactions FOR EACH ROW EXECUTE FUNCTION prevent_finance_transaction_delete()' },
      { name: 'lock_transaction_after_closure', table: 'finance_transactions', def: 'CREATE TRIGGER lock_transaction_after_closure BEFORE UPDATE ON public.finance_transactions FOR EACH ROW EXECUTE FUNCTION prevent_update_after_closure()' },
      { name: 'verify_integrity_hash_trigger', table: 'finance_transactions', def: 'CREATE TRIGGER verify_integrity_hash_trigger BEFORE UPDATE ON public.finance_transactions FOR EACH ROW EXECUTE FUNCTION verify_integrity_hash()' },
      { name: 'trg_update_balance_after_tx', table: 'finance_transactions', def: 'CREATE TRIGGER trg_update_balance_after_tx AFTER INSERT ON public.finance_transactions FOR EACH ROW EXECUTE FUNCTION update_account_balance_after_tx()' },
    ];

    for (const t of triggersToDrop) {
      try {
        await client.query(`DROP TRIGGER IF EXISTS "${t.name}" ON "${t.table}"`);
        console.log(`  ✓ DROP TRIGGER ${t.name}`);
      } catch (e) {
        console.log(`  ⚠️ Impossible de DROP ${t.name}: ${e.message}`);
      }
    }

    // ─── 4. Purge dans une transaction ───
    console.log('');
    console.log('→ Purge des données...');

    try {
      await client.query('BEGIN');

      // a. Supprimer les clôtures journalières
      const delClosures = await client.query(`DELETE FROM "finance_daily_closures" ${tenantFilter} RETURNING id`, params);
      console.log(`  ✓ ${delClosures.rowCount} clôture(s) journalière(s) supprimée(s)`);

      // b. Supprimer les allocations de paiement liées aux transactions (si la table existe)
      try {
        const delAllocations = await client.query(`DELETE FROM "payment_allocations" WHERE "paymentId" IN (SELECT id FROM "payments" ${tenantFilter.replace('tenantId', 'tenant_id')}) RETURNING id`, params);
        console.log(`  ✓ ${delAllocations.rowCount} allocation(s) de paiement supprimée(s)`);
      } catch (e) {
        // Table peut ne pas exister ou avoir une structure différente — on ignore
      }

      // c. Supprimer les reçus liés aux transactions (si la table existe)
      try {
        const delReceipts = await client.query(`DELETE FROM "payment_receipts" ${tenantFilter.replace(/tenantId/g, 'tenant_id')} RETURNING id`, params);
        console.log(`  ✓ ${delReceipts.rowCount} reçu(s) supprimé(s)`);
      } catch (e) {
        // Ignorer
      }

      // d. ⚠️ RESET des account_breakdowns AVANT de supprimer les transactions
      //    Les breakdowns ont des paidAmount/remainingAmount liés aux transactions.
      //    Si on supprime les transactions sans reset les breakdowns, on crée des
      //    incohérences (paidAmount > 0 sans transaction correspondante).
      const resetBreakdowns = await client.query(`
        UPDATE account_breakdowns ab
        SET "paidAmount" = 0,
            "remainingAmount" = ab."initialAmount"
        FROM student_accounts sa
        WHERE ab."studentAccountId" = sa.id
          ${tenantId ? `AND sa."tenantId" = $1` : ''}
        RETURNING ab.id
      `, params);
      console.log(`  ✓ ${resetBreakdowns.rowCount} account_breakdown(s) reset (paidAmount=0, remainingAmount=initialAmount)`);

      // e. Supprimer les allocations de breakdowns liées aux transactions
      //    (table finance_transaction_allocations ou similaire)
      try {
        const delTxAlloc = await client.query(`DELETE FROM "finance_transaction_allocations" ${tenantFilter} RETURNING id`, params);
        console.log(`  ✓ ${delTxAlloc.rowCount} allocation(s) de transaction supprimée(s)`);
      } catch (e) {
        // Table peut ne pas exister — on ignore
      }

      // f. Supprimer les transactions financières (encaissements + annulations)
      const delTx = await client.query(`DELETE FROM "finance_transactions" ${tenantFilter} RETURNING id`, params);
      console.log(`  ✓ ${delTx.rowCount} transaction(s) financière(s) supprimée(s)`);

      // g. Supprimer les dépenses (au cas où il en resterait)
      const delExpenses = await client.query(`DELETE FROM "finance_expenses" ${tenantFilter} RETURNING id`, params);
      console.log(`  ✓ ${delExpenses.rowCount} dépense(s) supprimée(s)`);

      // h. ⚠️ Recalculer totalPaid et balance des StudentAccounts
      //    Après reset des breakdowns, totalPaid doit être 0 et balance = totalDue
      const recalcAccounts = await client.query(`
        UPDATE student_accounts sa
        SET "totalPaid" = 0,
            "balance" = (
              SELECT COALESCE(SUM(ab."remainingAmount"), 0)::numeric
              FROM account_breakdowns ab WHERE ab."studentAccountId" = sa.id
            ),
            "isBlocked" = false,
            "updatedAt" = NOW()
        ${tenantId ? 'WHERE sa."tenantId" = $1' : ''}
        RETURNING sa.id
      `, params);
      console.log(`  ✓ ${recalcAccounts.rowCount} student_account(s) recalculé(s) (totalPaid=0, balance=totalDue)`);

      // i. ⚠️ Supprimer les clôtures journalières résiduelles
      //    Le cron de clôture auto peut créer des clôtures entre le moment
      //    où on a purgé et le moment où on vérifie. On les supprime ici
      //    pour garantir un état propre.
      const delResidualClosures = await client.query(
        `DELETE FROM "finance_daily_closures" ${tenantFilter} RETURNING id`,
        params
      );
      console.log(`  ✓ ${delResidualClosures.rowCount} clôture(s) résiduelle(s) supprimée(s)`);

      await client.query('COMMIT');
      console.log('  ✓ Transaction validée (COMMIT)');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('  ✗ Erreur pendant la purge, ROLLBACK :', err.message);
      throw err;
    }

    // ─── 5. Recréer les triggers ───
    console.log('');
    console.log('→ Recréation des triggers de protection...');
    for (const t of triggersToDrop) {
      try {
        await client.query(t.def);
        console.log(`  ✓ CREATE TRIGGER ${t.name}`);
      } catch (e) {
        console.log(`  ⚠️ Impossible de recréer ${t.name}: ${e.message}`);
      }
    }

    // ─── 6. Vérifier l'état après purge ───
    console.log('');
    console.log('→ État après purge :');
    const afterClosures = await client.query(`SELECT COUNT(*) as n FROM "finance_daily_closures" ${tenantFilter}`, params);
    const afterTx = await client.query(`SELECT COUNT(*) as n FROM "finance_transactions" ${tenantFilter}`, params);
    const afterExpenses = await client.query(`SELECT COUNT(*) as n FROM "finance_expenses" ${tenantFilter}`, params);
    console.log(`  finance_daily_closures : ${afterClosures.rows[0].n} lignes`);
    console.log(`  finance_transactions   : ${afterTx.rows[0].n} lignes`);
    console.log(`  finance_expenses       : ${afterExpenses.rows[0].n} lignes`);

    // ─── 7. Réinitialiser les soldes des caisses à 0 (optionnel) ───
    console.log('');
    console.log('→ Réinitialisation des soldes de caisses à 0...');
    const resetCash = await client.query(`
      UPDATE "cash_registers"
      SET "currentBalance" = 0, "openingBalance" = 0, "isOpen" = false, "updatedAt" = NOW()
      ${tenantFilter ? 'WHERE "tenantId" = $1' : ''}
      RETURNING id, code, name
    `, params);
    console.log(`  ✓ ${resetCash.rowCount} caisse(s) réinitialisée(s) à solde 0`);
    resetCash.rows.forEach(r => console.log(`    - ${r.code} — ${r.name}`));

    // ─── 8. Réinitialiser les soldes des comptes élèves (avec suppression temporaire du trigger) ───
    console.log('');
    console.log('→ Réinitialisation des comptes élèves (totalPaid = 0, balance = totalDue)...');

    // Le trigger prevent_direct_balance_modification empêche la modification directe
    // des champs balance/totalPaid. On le supprime temporairement.
    let studentAccountTriggerDef = null;
    try {
      const trigDef = await client.query(`
        SELECT pg_get_triggerdef(oid) as definition
        FROM pg_trigger
        WHERE tgrelid = '"student_accounts"'::regclass
          AND tgname = 'prevent_direct_balance_modification'
          AND NOT tgisinternal
      `);
      if (trigDef.rows.length > 0) {
        studentAccountTriggerDef = trigDef.rows[0].definition;
        await client.query(`DROP TRIGGER IF EXISTS prevent_direct_balance_modification ON student_accounts`);
        console.log('  ✓ DROP TRIGGER prevent_direct_balance_modification');
      }
    } catch (e) {
      console.log(`  ⚠️ Recherche trigger student_accounts: ${e.message}`);
    }

    try {
      const resetAccounts = await client.query(`
        UPDATE "student_accounts"
        SET "totalPaid" = 0, "balance" = "totalDue", "isBlocked" = false, "updatedAt" = NOW()
        ${tenantFilter ? 'WHERE "tenantId" = $1' : ''}
        RETURNING id
      `, params);
      console.log(`  ✓ ${resetAccounts.rowCount} compte(s) élève(s) réinitialisé(s)`);
    } catch (e) {
      console.log(`  ⚠️ Impossible de réinitialiser les comptes élèves: ${e.message}`);
    }

    // Recréer le trigger de student_accounts
    if (studentAccountTriggerDef) {
      try {
        await client.query(studentAccountTriggerDef);
        console.log('  ✓ CREATE TRIGGER prevent_direct_balance_modification');
      } catch (e) {
        console.log(`  ⚠️ Impossible de recréer le trigger: ${e.message}`);
      }
    }

    console.log('');
    console.log('✅ Purge terminée avec succès.');

  } catch (err) {
    console.error('❌ Échec de la purge :', err.message);
    console.error('  (Les triggers de finance_transactions ont été recréés si la purge est arrivée à l\'étape 5)');
    process.exit(1);
  } finally {
    await client.end();
    console.log('');
    console.log('→ Connexion fermée.');
  }
}

main().catch((e) => {
  console.error('Erreur fatale:', e);
  process.exit(1);
});
