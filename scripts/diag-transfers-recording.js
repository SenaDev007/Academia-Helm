/**
 * Diagnostic : vérifier si les transferts sont enregistrés
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // 1. Vérifier que les tables existent
  console.log('\n=== Tables cash_register_* ===');
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'cash_register_%'
    ORDER BY table_name
  `);
  for (const row of tables.rows) console.log(`  ${row.table_name}`);

  // 2. Vérifier le contenu des tables
  console.log('\n=== cash_register_transfers ===');
  const trf = await client.query('SELECT COUNT(*) FROM cash_register_transfers');
  console.log(`  ${trf.rows[0].count} transferts enregistrés`);

  console.log('\n=== cash_register_transactions ===');
  const tx = await client.query('SELECT COUNT(*) FROM cash_register_transactions');
  console.log(`  ${tx.rows[0].count} transactions enregistrées`);

  // 3. Vérifier les soldes des caisses pour confirmer que les transferts ont eu lieu
  console.log('\n=== Soldes actuels des caisses ===');
  const caisses = await client.query(`
    SELECT id, code, name, "currentBalance", "openingBalance", "isOpen"
    FROM cash_registers ORDER BY code LIMIT 10
  `);
  for (const row of caisses.rows) {
    console.log(`  [${row.code}] ${row.name} | solde=${row.currentbalance} | ouvert=${row.isopen}`);
  }

  // 4. Tester un INSERT manuel pour voir l'erreur
  console.log('\n=== Test INSERT manuel ===');
  try {
    const testId = `test-${Date.now()}`;
    const tenantId = caisses.rows[0]?.tenantid;
    const fromId = caisses.rows[0]?.id;
    const toId = caisses.rows[1]?.id;
    if (fromId && toId && tenantId) {
      await client.query(`
        INSERT INTO "cash_register_transfers"
          ("id", "tenantId", "fromCashRegisterId", "toCashRegisterId",
           "amount", "note", "reference", "userId", "status", "createdAt")
        VALUES ($1, $2, $3, $4, 100, 'Test manuel', 'TEST-001', NULL, 'COMPLETED', NOW())
      `, [testId, tenantId, fromId, toId]);
      console.log('  ✅ INSERT réussi');
      await client.query('DELETE FROM cash_register_transfers WHERE id = $1', [testId]);
      console.log('  (test supprimé)');
    } else {
      console.log('  ❌ Pas assez de caisses pour tester');
    }
  } catch (err) {
    console.error('  ❌ Erreur INSERT:', err.message);
  }

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
