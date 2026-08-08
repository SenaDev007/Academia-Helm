/**
 * Inspect class_councils schema to confirm available columns
 */
const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('✓ Connected');

  const r = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'class_councils'
    ORDER BY ordinal_position
  `);

  console.log('\nclass_councils columns:');
  for (const row of r.rows) {
    console.log(`  • ${row.column_name.padEnd(25)} ${row.data_type.padEnd(20)} nullable=${row.is_nullable}`);
  }

  // Also check academic_periods to confirm it exists for joins
  const ap = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('academic_periods', 'quarters')
  `);
  console.log('\nRelated tables:');
  for (const row of ap.rows) {
    console.log(`  • ${row.table_name}`);
  }

  await client.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
