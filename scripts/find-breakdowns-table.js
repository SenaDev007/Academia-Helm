const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&connect_timeout=30';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  // Find tables containing 'breakdown' or 'fee'
  const r = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND (table_name ILIKE '%breakdown%' OR table_name ILIKE '%student_fee%')
    ORDER BY table_name;
  `);
  console.log('=== Tables containing breakdown/student_fee ===');
  r.rows.forEach(t => console.log(`  ${t.table_name}`));
  
  // Also list payment_summaries columns
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'student_accounts' AND column_name IN ('balance', 'totalPaid', 'totalDue', 'status')
  `);
  console.log('\nstudent_accounts cols:', cols.rows.map(c => c.column_name).join(', '));
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
