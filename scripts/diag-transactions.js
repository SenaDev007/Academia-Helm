/**
 * Vérifie les tables disponibles pour les transferts de caisse
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // 1. Lister les tables qui contiennent 'transfer' ou 'transaction' ou 'movement'
  console.log('\n=== Tables liées aux transferts/mouvements ===');
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (table_name LIKE '%transfer%' OR table_name LIKE '%transaction%' OR table_name LIKE '%movement%')
    ORDER BY table_name
  `);
  for (const row of tables.rows) console.log(`  ${row.table_name}`);

  // 2. Voir les finance_transactions existantes
  console.log('\n=== finance_transactions (10 derniers) ===');
  const tx = await client.query(`
    SELECT id, type, amount, "paymentMethod", "cashRegisterId", reference, "createdAt"
    FROM finance_transactions
    ORDER BY "createdAt" DESC
    LIMIT 10
  `);
  console.log(`  Total: ${tx.rows.length} transactions`);
  for (const row of tx.rows) {
    console.log(`  [${row.type}] ${row.amount} | method=${row.paymentmethod} | cashReg=${row.cashregisterid?.substring(0, 8) || 'NULL'} | ${row.reference || ''}`);
  }

  // 3. Colonnes de finance_transactions
  console.log('\n=== Colonnes finance_transactions ===');
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'finance_transactions'
    ORDER BY ordinal_position
  `);
  for (const row of cols.rows) {
    console.log(`  ${row.column_name.padEnd(25)} | ${row.data_type.padEnd(20)} | nullable=${row.is_nullable}`);
  }

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
