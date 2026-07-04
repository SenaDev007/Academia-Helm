/**
 * Diagnostic avec colonnes quoted correctement
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // 1. Voir les vraies valeurs avec colonnes quoted
  console.log('\n=== 1. cash_register_transfers (raw) ===');
  const trf = await client.query(`
    SELECT id, "tenantId", "fromCashRegisterId", "toCashRegisterId",
           amount, note, reference, status, "createdAt"
    FROM cash_register_transfers
    ORDER BY "createdAt" DESC
  `);
  console.log(`Total: ${trf.rows.length} transferts`);
  for (const row of trf.rows) {
    // Le driver pg renvoie les colonnes en lowercase par défaut
    // Mais quand on quote "tenantId", la clé reste "tenantId"
    console.log('  Row:', JSON.stringify(row, null, 2));
  }

  // 2. Voir les cash_registers
  console.log('\n=== 2. cash_registers ===');
  const cr = await client.query(`
    SELECT id, code, name, "tenantId", "currentBalance"
    FROM cash_registers ORDER BY code LIMIT 3
  `);
  for (const row of cr.rows) {
    console.log('  Row:', JSON.stringify(row, null, 2));
  }

  // 3. Comparer les tenantId
  console.log('\n=== 3. Comparaison tenantId ===');
  if (trf.rows.length > 0 && cr.rows.length > 0) {
    const trfTenant = trf.rows[0].tenantId || trf.rows[0].tenantid;
    const crTenant = cr.rows[0].tenantId || cr.rows[0].tenantid;
    console.log(`  Transfert tenantId: ${trfTenant}`);
    console.log(`  Caisse tenantId: ${crTenant}`);
    console.log(`  Match: ${trfTenant === crTenant}`);
  }

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
