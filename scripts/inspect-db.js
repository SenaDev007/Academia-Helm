const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&connect_timeout=30';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. List triggers on student_accounts
  const triggers = await client.query(`
    SELECT trigger_name, event_object_table, action_timing, event_manipulation
    FROM information_schema.triggers
    WHERE event_object_table IN ('student_accounts', 'student_fee_breakdowns', 'finance_transactions')
    ORDER BY event_object_table, trigger_name;
  `);
  console.log('=== TRIGGERS ===');
  triggers.rows.forEach(t => console.log(`  ${t.event_object_table}.${t.trigger_name} (${t.action_timing} ${t.event_manipulation})`));

  // 2. List tables related to cash + encaissements
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
      'finance_transactions', 'finance_transaction_allocations', 'payment_receipts',
      'payment_initiations', 'recovery_reminders', 'fee_arrears',
      'collection_reminders', 'payment_promises', 'collection_actions', 'collection_cases',
      'cash_registers', 'cash_register_entries', 'daily_closures',
      'payment_summaries', 'payment_notifications'
    )
    ORDER BY table_name;
  `);
  console.log('\n=== TABLES TO TRUNCATE ===');
  tables.rows.forEach(t => console.log(`  ${t.table_name}`));

  // 3. Count rows in each
  console.log('\n=== ROW COUNTS ===');
  for (const t of tables.rows) {
    const c = await client.query(`SELECT COUNT(*) as n FROM "${t.table_name}"`);
    console.log(`  ${t.table_name}: ${c.rows[0].n} rows`);
  }

  // 4. Student accounts count
  const sa = await client.query(`SELECT COUNT(*) as n, SUM(CASE WHEN "balance" > 0 THEN 1 ELSE 0 END) as with_balance, SUM(CASE WHEN "totalPaid" > 0 THEN 1 ELSE 0 END) as with_paid FROM student_accounts`);
  console.log('\n=== STUDENT ACCOUNTS ===');
  console.log(`  Total: ${sa.rows[0].n}, Avec solde: ${sa.rows[0].with_balance}, Avec paiements: ${sa.rows[0].with_paid}`);

  const sfb = await client.query(`SELECT COUNT(*) as n, SUM(CASE WHEN "paidAmount" > 0 THEN 1 ELSE 0 END) as with_paid FROM student_fee_breakdowns`);
  console.log(`  Breakdowns: ${sfb.rows[0].n} total, ${sfb.rows[0].with_paid} avec paiements`);

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
