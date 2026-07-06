/**
 * Nettoyage complet des données de caisses + encaissements
 * ========================================================
 *
 * - Désactive les triggers sur student_accounts et finance_transactions
 * - Truncate toutes les tables liées aux encaissements et caisses
 * - Remet à zéro les soldes des élèves (balance, totalPaid)
 * - Réactive les triggers
 *
 * Usage : node scripts/cleanup-finance-data.js
 */

const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&connect_timeout=30';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connecté à Neon DB\n');

  // ─────────────────────────────────────────────────────────────
  // 1. Désactiver les triggers qui empêchent la modification des soldes
  // ─────────────────────────────────────────────────────────────
  console.log('🔧 Désactivation des triggers...');

  // Triggers sur student_accounts (empêchent la mise à jour de balance)
  await client.query(`ALTER TABLE student_accounts DISABLE TRIGGER prevent_balance_update_trigger;`);
  await client.query(`ALTER TABLE student_accounts DISABLE TRIGGER prevent_manual_block_update_trigger;`);
  await client.query(`ALTER TABLE student_accounts DISABLE TRIGGER audit_block_update;`);
  await client.query(`ALTER TABLE student_accounts DISABLE TRIGGER trg_audit_account_blocking;`);
  await client.query(`ALTER TABLE student_accounts DISABLE TRIGGER set_updated_at_student_accounts;`);
  console.log('  ✅ Triggers student_accounts désactivés');

  // Triggers sur finance_transactions (empêchent DELETE/UPDATE)
  await client.query(`ALTER TABLE finance_transactions DISABLE TRIGGER lock_transaction_after_closure;`);
  await client.query(`ALTER TABLE finance_transactions DISABLE TRIGGER no_delete_finance_transaction;`);
  await client.query(`ALTER TABLE finance_transactions DISABLE TRIGGER trg_no_delete_finance_transaction;`);
  await client.query(`ALTER TABLE finance_transactions DISABLE TRIGGER trg_update_balance_after_tx;`);
  await client.query(`ALTER TABLE finance_transactions DISABLE TRIGGER verify_integrity_hash_trigger;`);
  console.log('  ✅ Triggers finance_transactions désactivés\n');

  // ─────────────────────────────────────────────────────────────
  // 2. Truncate toutes les tables d'encaissements et caisses
  // ─────────────────────────────────────────────────────────────
  console.log('🗑️  Suppression des données...');

  const tablesToTruncate = [
    'payment_notifications',
    'payment_receipts',
    'payment_initiations',
    'finance_transaction_allocations',
    'finance_transactions',
    'recovery_reminders',
    'collection_reminders',
    'payment_promises',
    'collection_actions',
    'collection_cases',
    'fee_arrears',
    'daily_closures',
    'cash_closures',
    'cash_register_transfers',
    'cash_register_transactions',
    'cash_registers',
    'payment_summaries',
  ];

  // TRUNCATE avec CASCADE pour les tables avec FK
  // On le fait en une seule transaction pour l'atomicité
  await client.query('BEGIN');
  try {
    for (const table of tablesToTruncate) {
      await client.query(`TRUNCATE TABLE "${table}" CASCADE;`);
      console.log(`  ✅ ${table} vidé`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
  console.log('');

  // ─────────────────────────────────────────────────────────────
  // 3. Remettre à zéro les soldes des élèves
  // ─────────────────────────────────────────────────────────────
  console.log('🔄 Réinitialisation des soldes élèves...');

  // student_accounts : remettre balance, totalPaid à 0, status à ACTIVE
  const saResult = await client.query(`
    UPDATE student_accounts
    SET "balance" = "totalDue",
        "totalPaid" = 0,
        "status" = 'ACTIVE',
        "updatedAt" = NOW()
    WHERE "totalPaid" > 0 OR "balance" <> "totalDue" OR "status" <> 'ACTIVE';
  `);
  console.log(`  ✅ ${saResult.rowCount} student_accounts réinitialisés (balance=totalDue, totalPaid=0, status=ACTIVE)`);

  // account_breakdowns : remettre paidAmount à 0, remainingAmount = initialAmount
  const abResult = await client.query(`
    UPDATE account_breakdowns
    SET "paidAmount" = 0,
        "remainingAmount" = "initialAmount"
    WHERE "paidAmount" > 0 OR "remainingAmount" <> "initialAmount";
  `);
  console.log(`  ✅ ${abResult.rowCount} account_breakdowns réinitialisés (paidAmount=0, remainingAmount=initialAmount)`);
  console.log('');

  // ─────────────────────────────────────────────────────────────
  // 4. Réactiver les triggers
  // ─────────────────────────────────────────────────────────────
  console.log('🔧 Réactivation des triggers...');

  await client.query(`ALTER TABLE student_accounts ENABLE TRIGGER prevent_balance_update_trigger;`);
  await client.query(`ALTER TABLE student_accounts ENABLE TRIGGER prevent_manual_block_update_trigger;`);
  await client.query(`ALTER TABLE student_accounts ENABLE TRIGGER audit_block_update;`);
  await client.query(`ALTER TABLE student_accounts ENABLE TRIGGER trg_audit_account_blocking;`);
  await client.query(`ALTER TABLE student_accounts ENABLE TRIGGER set_updated_at_student_accounts;`);
  console.log('  ✅ Triggers student_accounts réactivés');

  await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER lock_transaction_after_closure;`);
  await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER no_delete_finance_transaction;`);
  await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER trg_no_delete_finance_transaction;`);
  await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER trg_update_balance_after_tx;`);
  await client.query(`ALTER TABLE finance_transactions ENABLE TRIGGER verify_integrity_hash_trigger;`);
  console.log('  ✅ Triggers finance_transactions réactivés\n');

  // ─────────────────────────────────────────────────────────────
  // 5. Vérification finale
  // ─────────────────────────────────────────────────────────────
  console.log('📊 Vérification finale...');

  for (const table of tablesToTruncate) {
    const c = await client.query(`SELECT COUNT(*) as n FROM "${table}"`);
    console.log(`  ${table}: ${c.rows[0].n} rows`);
  }

  const sa = await client.query(`SELECT COUNT(*) as n, SUM(CASE WHEN "totalPaid" > 0 THEN 1 ELSE 0 END) as with_paid, SUM(CASE WHEN "balance" > 0 THEN 1 ELSE 0 END) as with_balance FROM student_accounts`);
  console.log(`\n  student_accounts: ${sa.rows[0].n} total, ${sa.rows[0].with_paid} avec paiements, ${sa.rows[0].with_balance} avec solde dû`);

  const ab = await client.query(`SELECT COUNT(*) as n, SUM(CASE WHEN "paidAmount" > 0 THEN 1 ELSE 0 END) as with_paid FROM account_breakdowns`);
  console.log(`  account_breakdowns: ${ab.rows[0].n} total, ${ab.rows[0].with_paid} avec paiements`);

  console.log('\n✅ Nettoyage terminé avec succès !');
  await client.end();
}

main().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
