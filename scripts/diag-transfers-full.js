/**
 * Diagnostic complet : vérifier les transferts en DB + tester les requêtes SQL
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // 1. Vérifier le contenu de cash_register_transfers
  console.log('\n=== 1. cash_register_transfers (toutes) ===');
  const trf = await client.query(`
    SELECT id, "tenantId", "fromCashRegisterId", "toCashRegisterId",
           amount, note, reference, status, "createdAt"
    FROM cash_register_transfers
    ORDER BY "createdAt" DESC
  `);
  console.log(`Total: ${trf.rows.length} transferts`);
  for (const row of trf.rows) {
    console.log(`  id=${row.id}`);
    console.log(`  tenantId=${row.tenantid}`);
    console.log(`  from=${row.fromcashregisterid}`);
    console.log(`  to=${row.tocashregisterid}`);
    console.log(`  amount=${row.amount} | note=${row.note} | ref=${row.reference}`);
    console.log(`  createdAt=${row.createdat}`);
    console.log('  ---');
  }

  // 2. Voir les cash_registers avec tenantId
  console.log('\n=== 2. cash_registers (avec tenantId) ===');
  const cr = await client.query(`
    SELECT id, code, name, "tenantId", "currentBalance"
    FROM cash_registers ORDER BY code
  `);
  for (const row of cr.rows) {
    console.log(`  [${row.code}] ${row.name} | tenantId=${row.tenantid} | solde=${row.currentbalance}`);
  }

  // 3. Tester la requête exacte que fait le backend getTransfers
  console.log('\n=== 3. Test requête getTransfers (avec paramètre $1) ===');
  if (trf.rows.length > 0) {
    const tenantId = trf.rows[0].tenantid;
    console.log(`Test avec tenantId = '${tenantId}'`);

    try {
      // Requête paramétrée comme le fait le backend maintenant
      const result = await client.query(`
        SELECT
          t.*,
          fr."code" AS "fromCode", fr."name" AS "fromName",
          tr."code" AS "toCode", tr."name" AS "toName"
        FROM cash_register_transfers t
        LEFT JOIN cash_registers fr ON fr."id" = t."fromCashRegisterId"
        LEFT JOIN cash_registers tr ON tr."id" = t."toCashRegisterId"
        WHERE t."tenantId" = $1
        ORDER BY t."createdAt" DESC
        LIMIT $2
      `, [tenantId, 100]);
      console.log(`✅ Requête réussie : ${result.rows.length} transferts trouvés`);
      for (const row of result.rows) {
        console.log(`  ${row.fromcode || '?'} → ${row.tocode || '?'} | ${row.amount} | ${row.note}`);
      }
    } catch (err) {
      console.error(`❌ Erreur requête: ${err.message}`);
    }
  }

  // 4. Vérifier les tenants pour comprendre qui est connecté
  console.log('\n=== 4. Tenants ===');
  const tenants = await client.query('SELECT id, name FROM tenants ORDER BY name');
  for (const t of tenants.rows) {
    console.log(`  ${t.name.substring(0, 50)} | ${t.id}`);
  }

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
