/**
 * Applique les migrations 016 et 017 sur Neon PostgreSQL.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const fs = require('fs');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const migrations = [
    { name: '016', file: '/home/z/my-project/apps/api-server/migrations/016_finance_expenses_cashRegister_pendingApprover.sql' },
    { name: '017', file: '/home/z/my-project/apps/api-server/migrations/017_cash_register_transfers_transactions.sql' },
  ];

  for (const m of migrations) {
    console.log(`\n🚀 Migration ${m.name}...`);
    const sql = fs.readFileSync(m.file, 'utf8');
    await client.query(sql);
    console.log(`✅ Migration ${m.name} appliquée.`);
  }

  // Vérification
  console.log('\n📊 Vérification:');
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'finance_expenses' AND column_name IN ('cashRegisterId', 'pendingApproverId')
  `);
  console.log('  finance_expenses columns:', cols.rows.map(r => r.column_name));

  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('cash_register_transfers', 'cash_register_transactions')
  `);
  console.log('  Tables créées:', tables.rows.map(r => r.table_name));

  await client.end();
  console.log('\n✅ Toutes les migrations appliquées.');
}
main().catch(e => { console.error(e); process.exit(1); });
