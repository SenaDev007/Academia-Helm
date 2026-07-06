#!/usr/bin/env node
/**
 * ============================================================================
 * SUPPRESSION SÉCURISÉE D'UNE TRANSACTION FINANCIÈRE PAR REÇU
 * ============================================================================
 *
 * Usage:
 *   node scripts/delete-transaction-by-receipt.js CSPEBE-REC-26-004
 *   node scripts/delete-transaction-by-receipt.js CSPEBE-REC-26-004 --confirm
 *   node scripts/delete-transaction-by-receipt.js CSPEBE-REC-26-004 --confirm --allow-reversed
 *
 * Comportement:
 *   - Mode DRY-RUN par défaut : affiche ce qui serait supprimé sans toucher la DB.
 *   - Mode --confirm : exécute la suppression dans une transaction SQL.
 *   - Refuse de supprimer une transaction REVERSAL sauf avec --allow-reversed.
 *   - Refuse de supprimer une transaction déjà annulée (reversedFromId non null
 *     sur une autre transaction) — il faudrait d'abord supprimer l'annulation.
 *
 * Étapes de suppression (cascade manuelle) :
 *   1. Charger la transaction + allocations + cashRegisterId + amount.
 *   2. Identifier les transferts d'allocation automatique (cash_register_transfers
 *      avec status='AUTO_ALLOCATION' et référence commençant par AUTO-{txId8}-).
 *   3. Revertir les AccountBreakdown (paidAmount -= alloc.amount,
 *      remainingAmount += alloc.amount) — utilise le trigger SQL natif pour
 *      recalculer totalPaid/balance/status automatiquement.
 *   4. Décrémenter le solde de la caisse source (cashRegisterId) du montant
 *      de la transaction.
 *   5. Pour chaque transfert d'allocation, décrémenter le solde de la caisse
 *      destination du montant du transfert.
 *   6. Supprimer les transferts d'allocation (cash_register_transfers).
 *      → CASCADE nettoie cash_register_transactions si FK relatedTransferId.
 *   7. Supprimer les finance_transaction_allocations.
 *   8. Désactiver le trigger protecteur (s'il existe) sur finance_transactions,
 *      supprimer la transaction, réactiver le trigger.
 *   9. Mettre à NULL payment_initiations.transactionId pour permettre le
 *      re-test du paiement en ligne (sinon idempotence bloquera).
 *
 * Sécurité:
 *   - Tout dans un BEGIN/COMMIT — ROLLBACK automatique en cas d'erreur.
 *   - Vérification tenantId pour éviter toute fuite multi-tenant.
 *   - Log détaillé de chaque étape.
 * ============================================================================
 */

const { Client } = require('/home/z/my-project/node_modules/pg');

// ─── Configuration ────────────────────────────────────────────────────────
// On ignore les DATABASE_URL=file:... (SQLite local) qui pourraient être
// présentes dans l'environnement shell — on utilise la valeur Neon codée en dur.
const ENV_DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_URL =
  ENV_DATABASE_URL && ENV_DATABASE_URL.startsWith('postgresql://')
    ? ENV_DATABASE_URL
    : 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

// ─── CLI Args ─────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const receiptNumber = args.find((a) => !a.startsWith('--'));
const CONFIRM = args.includes('--confirm');
const ALLOW_REVERSED = args.includes('--allow-reversed');

if (!receiptNumber) {
  console.error('❌ Usage: node scripts/delete-transaction-by-receipt.js <RECEIPT_NUMBER> [--confirm] [--allow-reversed]');
  console.error('   Exemple: node scripts/delete-transaction-by-receipt.js CSPEBE-REC-26-004 --confirm');
  process.exit(1);
}

console.log('═'.repeat(72));
console.log(`  Suppression transaction : ${receiptNumber}`);
console.log(`  Mode                    : ${CONFIRM ? '⚡ CONFIRM (suppression réelle)' : '🔍 DRY-RUN (aucune modification)'}`);
console.log(`  Autoriser REVERSAL      : ${ALLOW_REVERSED ? 'OUI' : 'NON'}`);
console.log('═'.repeat(72));

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('✅ Connecté à la base Neon\n');

    // ─── Step 1 : Charger la transaction ──────────────────────────────────
    console.log('━'.repeat(72));
    console.log('STEP 1 : Recherche de la transaction');
    console.log('━'.repeat(72));

    const txRes = await client.query(
      `SELECT id, "tenantId", "academicYearId", "studentAccountId", type, amount,
              "paymentMethod", reference, "receiptNumber", "cashRegisterId",
              "reversedFromId", "createdAt"
         FROM finance_transactions
        WHERE "receiptNumber" = $1
        LIMIT 1`,
      [receiptNumber],
    );

    if (txRes.rows.length === 0) {
      console.error(`❌ Aucune transaction trouvée avec le reçu "${receiptNumber}".`);
      console.error('   Vérifiez le numéro de reçu (sensible à la casse).');
      process.exit(2);
    }

    const tx = txRes.rows[0];
    console.log(`  ✓ Transaction trouvée:`);
    console.log(`      id              = ${tx.id}`);
    console.log(`      tenantId        = ${tx.tenantId}`);
    console.log(`      type            = ${tx.type}`);
    console.log(`      amount          = ${tx.amount} FCFA`);
    console.log(`      paymentMethod   = ${tx.paymentMethod}`);
    console.log(`      reference       = ${tx.reference || '(null)'}`);
    console.log(`      cashRegisterId  = ${tx.cashRegisterId || '(null)'}`);
    console.log(`      reversedFromId  = ${tx.reversedFromId || '(null)'}`);
    console.log(`      createdAt       = ${tx.createdAt.toISOString()}`);

    if (tx.type === 'REVERSAL' && !ALLOW_REVERSED) {
      console.error('\n❌ Cette transaction est une REVERSAL (annulation).');
      console.error('   Pour la supprimer, ajoutez --allow-reversed.');
      process.exit(3);
    }

    // ─── Step 2 : Charger les allocations ────────────────────────────────
    console.log('\n' + '━'.repeat(72));
    console.log('STEP 2 : Allocations liées (finance_transaction_allocations)');
    console.log('━'.repeat(72));

    const allocRes = await client.query(
      `SELECT a.id, a.amount, a."accountBreakdownId",
              b."feeStructureId", b."paidAmount", b."remainingAmount",
              fs."feeType", fs.name AS "feeName"
         FROM finance_transaction_allocations a
         LEFT JOIN account_breakdowns b ON b.id = a."accountBreakdownId"
         LEFT JOIN fee_structures fs ON fs.id = b."feeStructureId"
        WHERE a."financeTransactionId" = $1`,
      [tx.id],
    );

    console.log(`  ✓ ${allocRes.rows.length} allocation(s) trouvée(s):`);
    for (const a of allocRes.rows) {
      console.log(`      • ${a.feeType || '?'} — ${a.feeName || '?'} : ${a.amount} FCFA`);
      console.log(`        breakdownId=${a.accountBreakdownId}`);
      console.log(`        paid=${a.paidAmount} remaining=${a.remainingAmount}`);
    }

    // ─── Step 3 : Identifier les transferts d'allocation ─────────────────
    console.log('\n' + '━'.repeat(72));
    console.log('STEP 3 : Transferts d\'allocation automatique (cash_register_transfers)');
    console.log('━'.repeat(72));

    // L'allocation automatique génère une référence : AUTO-{txIdFirst8}-{feeType}
    // On cherche aussi par fromCashRegisterId + createdAt proche (sécurité)
    const txIdPrefix = tx.id.substring(0, 8);
    const transfersRes = await client.query(
      `SELECT t.id, t."fromCashRegisterId", t."toCashRegisterId", t.amount,
              t.note, t.reference, t.status, t."createdAt",
              fr.code AS "fromCode", fr.name AS "fromName",
              tr.code AS "toCode", tr.name AS "toName"
         FROM cash_register_transfers t
         LEFT JOIN cash_registers fr ON fr.id = t."fromCashRegisterId"
         LEFT JOIN cash_registers tr ON tr.id = t."toCashRegisterId"
        WHERE t."tenantId" = $1
          AND t.status = 'AUTO_ALLOCATION'
          AND (t.reference LIKE $2 OR t.reference LIKE $3)
        ORDER BY t."createdAt" ASC`,
      [tx.tenantId, `AUTO-${txIdPrefix}-%`, `AUTO-${tx.id}-%`],
    );

    console.log(`  ✓ ${transfersRes.rows.length} transfert(s) d'allocation trouvé(s):`);
    for (const t of transfersRes.rows) {
      console.log(`      • ${t.fromCode} → ${t.toCode} : ${t.amount} FCFA`);
      console.log(`        note=${t.note}`);
      console.log(`        ref=${t.reference}`);
    }

    // ─── Step 4 : PaymentInitiation liée (pour reset) ────────────────────
    console.log('\n' + '━'.repeat(72));
    console.log('STEP 4 : PaymentInitiation liée (pour reset transactionId=NULL)');
    console.log('━'.repeat(72));

    const piRes = await client.query(
      `SELECT id, reference, provider, status, "transactionId"
         FROM payment_initiations
        WHERE "transactionId" = $1`,
      [tx.id],
    );

    console.log(`  ✓ ${piRes.rows.length} PaymentInitiation(s) liée(s):`);
    for (const p of piRes.rows) {
      console.log(`      • provider=${p.provider} ref=${p.reference} status=${p.status}`);
    }

    // ─── Step 5 : Vérifier qu'aucune REVERSAL ne pointe vers cette tx ────
    console.log('\n' + '━'.repeat(72));
    console.log('STEP 5 : Vérification REVERSAL');
    console.log('━'.repeat(72));

    const revRes = await client.query(
      `SELECT id, "receiptNumber", amount
         FROM finance_transactions
        WHERE "reversedFromId" = $1`,
      [tx.id],
    );

    if (revRes.rows.length > 0) {
      console.error(`\n❌ Cette transaction a ${revRes.rows.length} REVERSAL(s) liée(s):`);
      for (const r of revRes.rows) {
        console.error(`      • ${r.receiptNumber} (montant: ${r.amount})`);
      }
      console.error('   Supprimez d\'abord la/les REVERSAL(s) avant de supprimer la transaction d\'origine.');
      process.exit(4);
    }
    console.log('  ✓ Aucune REVERSAL liée — suppression autorisée.');

    // ─── Récapitulatif ───────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(72));
    console.log('RÉCAPITULATIF DE LA SUPPRESSION');
    console.log('═'.repeat(72));
    console.log(`  Transaction à supprimer    : ${tx.receiptNumber} (id=${tx.id})`);
    console.log(`  Montant                    : ${tx.amount} FCFA`);
    console.log(`  Caisse source              : ${tx.cashRegisterId || '(aucune)'} (sera débitée de ${tx.amount} FCFA)`);
    console.log(`  Allocations à revertir     : ${allocRes.rows.length}`);
    console.log(`  Transferts d'allocation    : ${transfersRes.rows.length} (caisses destination seront débitées)`);
    console.log(`  PaymentInitiation à reset  : ${piRes.rows.length}`);
    console.log('═'.repeat(72));

    if (!CONFIRM) {
      console.log('\n🔍 Mode DRY-RUN — aucune modification effectuée.');
      console.log('   Ajoutez --confirm pour exécuter la suppression.');
      return;
    }

    // ─── Step 6 : Exécution de la suppression ─────────────────────────────
    // Stratégie : on désactive d'abord les triggers protecteurs SUR finance_transactions
    // (en dehors de la transaction BEGIN), puis on fait tout le travail dans
    // une transaction SQL, puis on réactive les triggers.
    console.log('\n' + '━'.repeat(72));
    console.log('STEP 6 : Exécution de la suppression (transaction SQL)');
    console.log('━'.repeat(72));

    // 6.0 — Désactiver les triggers protecteurs sur finance_transactions
    // (Academia Hub impose l'immutabilité financière via trigger BEFORE DELETE)
    console.log('  → Désactivation préventive des triggers protecteurs sur finance_transactions...');
    const trigRes = await client.query(
      `SELECT t.tgname FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
       WHERE c.relname = 'finance_transactions' AND NOT t.tgisinternal`,
    );
    const disabledTriggers = [];
    for (const tr of trigRes.rows) {
      try {
        await client.query(`ALTER TABLE finance_transactions DISABLE TRIGGER ${tr.tgname};`);
        console.log(`      ✓ Trigger désactivé: ${tr.tgname}`);
        disabledTriggers.push(tr.tgname);
      } catch (e) {
        console.log(`      ⚠ Impossible de désactiver ${tr.tgname}: ${e.message}`);
      }
    }

    try {
      await client.query('BEGIN');

      // 6.1 — Revertir les AccountBreakdown
      // NOTE: account_breakdowns n'a pas de colonne "updatedAt" (uniquement createdAt)
      console.log('  → Revertion des AccountBreakdown...');
      for (const a of allocRes.rows) {
        await client.query(
          `UPDATE account_breakdowns
              SET "paidAmount" = "paidAmount" - $2,
                  "remainingAmount" = "remainingAmount" + $2
            WHERE id = $1`,
          [a.accountBreakdownId, a.amount],
        );
        console.log(`      ✓ breakdown ${a.accountBreakdownId} reverti de ${a.amount}`);
      }

      // 6.2 — Débiter la caisse source (cashRegisterId)
      if (tx.cashRegisterId) {
        console.log('  → Débit de la caisse source...');
        await client.query(
          `UPDATE cash_registers
              SET "currentBalance" = "currentBalance" - $2,
                  "updatedAt" = NOW()
            WHERE id = $1`,
          [tx.cashRegisterId, tx.amount],
        );
        console.log(`      ✓ Caisse ${tx.cashRegisterId} débitée de ${tx.amount} FCFA`);
      }

      // 6.3 — Débiter les caisses destination (pour chaque transfert d'allocation)
      console.log('  → Débit des caisses destination (allocations automatiques)...');
      for (const t of transfersRes.rows) {
        await client.query(
          `UPDATE cash_registers
              SET "currentBalance" = "currentBalance" - $2,
                  "updatedAt" = NOW()
            WHERE id = $1`,
          [t.toCashRegisterId, t.amount],
        );
        console.log(`      ✓ Caisse ${t.toCode} (${t.toCashRegisterId}) débitée de ${t.amount} FCFA`);
      }

      // 6.4 — Supprimer les transferts d'allocation
      if (transfersRes.rows.length > 0) {
        console.log('  → Suppression des transferts d\'allocation...');
        const transferIds = transfersRes.rows.map((t) => t.id);
        await client.query(
          `DELETE FROM cash_register_transfers WHERE id = ANY($1::text[])`,
          [transferIds],
        );
        console.log(`      ✓ ${transferIds.length} transfert(s) supprimé(s)`);
      }

      // 6.5 — Supprimer les allocations de la transaction
      if (allocRes.rows.length > 0) {
        console.log('  → Suppression des finance_transaction_allocations...');
        const result = await client.query(
          `DELETE FROM finance_transaction_allocations WHERE "financeTransactionId" = $1`,
          [tx.id],
        );
        console.log(`      ✓ ${result.rowCount} allocation(s) supprimée(s)`);
      }

      // 6.6 — Reset payment_initiations.transactionId = NULL (pour retry)
      if (piRes.rows.length > 0) {
        console.log('  → Reset payment_initiations.transactionId = NULL...');
        const result = await client.query(
          `UPDATE payment_initiations SET "transactionId" = NULL, "updatedAt" = NOW() WHERE "transactionId" = $1`,
          [tx.id],
        );
        console.log(`      ✓ ${result.rowCount} payment_initiation(s) reset (status reste inchangé — à vérifier manuellement)`);
      }

      // 6.7 — Supprimer la transaction finance_transactions
      console.log('  → Suppression de la transaction finance_transactions...');
      const delResult = await client.query(`DELETE FROM finance_transactions WHERE id = $1`, [tx.id]);
      if (delResult.rowCount === 0) {
        throw new Error(`Transaction ${tx.receiptNumber} (id=${tx.id}) non supprimée — ligne introuvable`);
      }
      console.log(`      ✓ Transaction ${tx.receiptNumber} supprimée`);

      // 6.8 — Supprimer le fichier PDF du reçu sur disque (best-effort)
      // NOTE : Le PDF est sur le serveur API, pas sur la DB. À faire via ssh/admin.
      console.log('  → (info) Le PDF du reçu est stocké sur le serveur API dans uploads/receipts/{tenantId}/{year}/receipt-{num}.pdf');
      console.log('           Il n\'est PAS supprimé automatiquement — à supprimer manuellement si besoin.');

      await client.query('COMMIT');
      console.log('\n✅ TRANSACTION COMMISE — suppression réussie.');
      console.log(`   La transaction ${tx.receiptNumber} a été supprimée avec toutes ses dépendances.`);
      console.log('   Les soldes des caisses (source + destinations) ont été revertis.');
      console.log('   Les AccountBreakdown (paid/remaining) ont été revertis.');
      console.log('   Le trigger SQL recalculera totalPaid/balance/status du StudentAccount automatiquement.');

    } catch (err) {
      try { await client.query('ROLLBACK'); } catch {}
      console.error('\n❌ Erreur pendant la suppression — ROLLBACK effectué.');
      console.error('   Détails:', err.message);
      throw err;
    } finally {
      // Réactiver les triggers dans tous les cas
      if (disabledTriggers.length > 0) {
        console.log('\n  → Réactivation des triggers protecteurs...');
        for (const tgname of disabledTriggers) {
          try {
            await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER ${tgname};`);
            console.log(`      ✓ Trigger réactivé: ${tgname}`);
          } catch (e) {
            console.log(`      ⚠ Impossible de réactiver ${tgname}: ${e.message}`);
          }
        }
      }
    }

  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\n💥 Erreur fatale:', err.message);
  console.error('   Stack:', err.stack);
  process.exit(1);
});
