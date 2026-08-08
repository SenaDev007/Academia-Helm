const { Client } = require('/tmp/node_modules/pg');
const fs = require('fs');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const SQL_FILE = '/home/z/my-project/apps/api-server/prisma/migrations/create_app_releases.sql';

async function main() {
  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Connecting to Neon PostgreSQL...');
  await client.connect();
  console.log('Connected!\n');

  console.log('Executing migration: create_app_releases.sql\n');

  // Execute the entire SQL file
  try {
    await client.query(sql);
    console.log('✅ Migration executed successfully!\n');

    // Verify the table was created
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'app_releases'
      ORDER BY ordinal_position;
    `);

    console.log('Table app_releases columns:');
    console.log('─'.repeat(80));
    result.rows.forEach(row => {
      console.log(`  ${row.column_name.padEnd(20)} ${row.data_type.padEnd(20)} nullable=${row.is_nullable}`);
    });
    console.log('─'.repeat(80));
    console.log(`Total: ${result.rows.length} columns\n`);

    // Check if the trigger was created
    const triggerResult = await client.query(`
      SELECT trigger_name, event_object_table, action_timing, event_manipulation
      FROM information_schema.triggers
      WHERE event_object_table = 'app_releases';
    `);

    if (triggerResult.rows.length > 0) {
      console.log('Triggers on app_releases:');
      triggerResult.rows.forEach(row => {
        console.log(`  ${row.trigger_name} — ${row.action_timing} ${row.event_manipulation}`);
      });
    } else {
      console.log('⚠️  No triggers found on app_releases');
    }

    // Check indexes
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'app_releases';
    `);

    console.log(`\nIndexes (${indexResult.rows.length}):`);
    indexResult.rows.forEach(row => {
      console.log(`  ${row.indexname}`);
    });

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Connection closed.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
