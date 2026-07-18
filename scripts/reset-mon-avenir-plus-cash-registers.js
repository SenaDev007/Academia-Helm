/**
 * Reset des soldes des caisses Mon Avenir Plus à 0.
 *
 * - Remet currentBalance = 0 pour toutes les caisses du tenant.
 * - Préserve les configurations (code, name, isActive, isOpen, etc.).
 * - Supprime les transferts inter-caisses (cash_register_transfers).
 * - Supprime les transactions de caisse (cash_register_transactions).
 * - Supprime les clôtures de caisse (cash_closures).
 *
 * ⚠️ Ne supprime PAS les caisses elles-mêmes (config préservée).
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const DRY_RUN = false; // ⚠️ Mettre à true pour dry-run

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    query_timeout: 120000,
  });
  await client.connect();

  console.log(`\n${DRY_RUN ? '🔍 DRY RUN' : '⚠️  APPLICATION RÉELLE'} — Reset soldes caisses Mon Avenir Plus`);
  console.log(`   Tenant: ${TENANT_ID}\n`);

  // 1. Afficher l'état actuel
  console.log('=== ÉTAT ACTUEL DES CAISSES ===');
  const before = await client.query(`
    SELECT id, code, name, "currentBalance", "openingBalance", "isOpen", "isActive"
    FROM cash_registers WHERE "tenantId" = $1 ORDER BY code
  `, [TENANT_ID]);
  before.rows.forEach(cr => {
    console.log(`  ${cr.code} | ${cr.name}`);
    console.log(`    currentBalance=${cr.currentBalance} | openingBalance=${cr.openingBalance}`);
    console.log(`    isOpen=${cr.isOpen} | isActive=${cr.isActive}`);
  });

  // Compter les éléments à supprimer
  const transfers = await client.query(`SELECT COUNT(*) as nb FROM cash_register_transfers WHERE "tenantId" = $1`, [TENANT_ID]);
  const transactions = await client.query(`SELECT COUNT(*) as nb FROM cash_register_transactions WHERE "tenantId" = $1`, [TENANT_ID]);
  const closures = await client.query(`SELECT COUNT(*) as nb FROM cash_closures WHERE "tenantId" = $1`, [TENANT_ID]);

  console.log('\n=== ÉLÉMENTS À SUPPRIMER ===');
  console.log(`  cash_register_transfers: ${transfers.rows[0].nb}`);
  console.log(`  cash_register_transactions: ${transactions.rows[0].nb}`);
  console.log(`  cash_closures: ${closures.rows[0].nb}`);

  console.log('\n=== ÉLÉMENTS À RESET ===');
  console.log(`  cash_registers.currentBalance → 0 (${before.rows.length} caisses)`);
  console.log(`  cash_registers.openedAt, closedAt → NULL (préserve isOpen/isActive)`);

  console.log('\n=== ÉLÉMENTS PRÉSERVÉS ===');
  console.log(`  cash_registers (config: code, name, description, location, isActive, etc.)`);

  if (DRY_RUN) {
    console.log('\n⚠️  DRY_RUN = true → aucune modification appliquée.');
    await client.end();
    return;
  }

  // === APPLICATION RÉELLE ===
  console.log('\n=== APPLICATION ===');

  try {
    await client.query('BEGIN');

    // 1. Supprimer cash_register_transfers
    console.log('  → Suppression cash_register_transfers...');
    const delTransfers = await client.query(`DELETE FROM cash_register_transfers WHERE "tenantId" = $1`, [TENANT_ID]);
    console.log(`    ${delTransfers.rowCount} transferts supprimés`);

    // 2. Supprimer cash_register_transactions
    console.log('  → Suppression cash_register_transactions...');
    const delTransactions = await client.query(`DELETE FROM cash_register_transactions WHERE "tenantId" = $1`, [TENANT_ID]);
    console.log(`    ${delTransactions.rowCount} transactions caisse supprimées`);

    // 3. Supprimer cash_closures
    console.log('  → Suppression cash_closures...');
    const delClosures = await client.query(`DELETE FROM cash_closures WHERE "tenantId" = $1`, [TENANT_ID]);
    console.log(`    ${delClosures.rowCount} clôtures supprimées`);

    // 4. Reset currentBalance = 0 + ouvrir/fermer les timestamps
    console.log('  → Reset cash_registers (currentBalance=0, openedAt=NULL, closedAt=NULL)...');
    const reset = await client.query(`
      UPDATE cash_registers
      SET "currentBalance" = 0,
          "openingBalance" = 0,
          "openedAt" = NULL,
          "closedAt" = NULL,
          "openedByUserId" = NULL,
          "closedByUserId" = NULL,
          "updatedAt" = NOW()
      WHERE "tenantId" = $1
    `, [TENANT_ID]);
    console.log(`    ${reset.rowCount} caisses reset`);

    await client.query('COMMIT');
    console.log('\n✅ Reset appliqué avec succès.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n❌ Erreur: ${err.message}`);
    throw err;
  }

  // Vérification finale
  console.log('\n=== ÉTAT FINAL DES CAISSES ===');
  const after = await client.query(`
    SELECT code, name, "currentBalance", "openingBalance", "isOpen", "isActive"
    FROM cash_registers WHERE "tenantId" = $1 ORDER BY code
  `, [TENANT_ID]);
  after.rows.forEach(cr => {
    console.log(`  ${cr.code} | ${cr.name}`);
    console.log(`    currentBalance=${cr.currentBalance} | openingBalance=${cr.openingBalance}`);
    console.log(`    isOpen=${cr.isOpen} | isActive=${cr.isActive}`);
  });

  await client.end();
  console.log('\n✅ Terminé');
}

main().catch(e => { console.error(e); process.exit(1); });
