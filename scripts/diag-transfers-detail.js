/**
 * Diagnostic détaillé des transferts enregistrés
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // 1. Voir le transfert enregistré
  console.log('\n=== cash_register_transfers (détails) ===');
  const trf = await client.query(`
    SELECT t.*, fr."code" AS "fromCode", tr."code" AS "toCode"
    FROM cash_register_transfers t
    LEFT JOIN cash_registers fr ON fr."id" = t."fromCashRegisterId"
    LEFT JOIN cash_registers tr ON tr."id" = t."toCashRegisterId"
    ORDER BY t."createdAt" DESC
  `);
  for (const row of trf.rows) {
    console.log(`  [${row.tenantid?.substring(0, 8)}] ${row.fromcode} → ${row.tocode} | ${row.amount} | ${row.note} | ${row.createdat}`);
  }

  // 2. Voir les transactions
  console.log('\n=== cash_register_transactions (détails) ===');
  const tx = await client.query(`
    SELECT t.*, c."code" AS "cashCode"
    FROM cash_register_transactions t
    LEFT JOIN cash_registers c ON c."id" = t."cashRegisterId"
    ORDER BY t."createdAt" DESC
  `);
  for (const row of tx.rows) {
    console.log(`  [${row.cashcode}] ${row.transactiontype} | ${row.direction} | ${row.amount} | ${row.createdat}`);
  }

  // 3. Voir le tenantId des caisses
  console.log('\n=== cash_registers (avec tenantId) ===');
  const cr = await client.query(`
    SELECT id, code, name, "tenantId", "currentBalance", "isOpen"
    FROM cash_registers ORDER BY code
  `);
  for (const row of cr.rows) {
    console.log(`  [${row.code}] ${row.name} | tenant=${row.tenantid?.substring(0, 8)} | solde=${row.currentbalance} | ouvert=${row.isopen}`);
  }

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
