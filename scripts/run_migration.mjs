// Execute the weekly_seminar_tables migration directly via Node.js pg client
// Usage: node /home/z/my-project/scripts/run_migration.js
import fs from 'fs';
import pg from 'pg';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const MIGRATION_FILE = '/home/z/my-project/apps/api-server/prisma/migrations/20260722100000_add_weekly_seminar_tables/migration.sql';

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  console.log(`📄 Loaded migration: ${MIGRATION_FILE}`);
  console.log(`   Size: ${sql.length} bytes\n`);

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔌 Connecting to Neon DB...');
    await client.connect();
    console.log('✅ Connected\n');

    // Pre-check: see if tables already exist
    const checkQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('weekly_seminar_config', 'weekly_seminar_daily_report', 'weekly_seminar_weekly_report')
      ORDER BY table_name;
    `;
    const existing = await client.query(checkQuery);
    if (existing.rows.length > 0) {
      console.log(`⚠️  ${existing.rows.length} table(s) already exist:`);
      for (const row of existing.rows) {
        console.log(`     - ${row.table_name}`);
      }
      console.log('   The migration uses IF NOT EXISTS, so it will be safe to re-run.');
    } else {
      console.log('✅ No existing weekly_seminar_* tables found — fresh install.\n');
    }

    // Execute the migration
    console.log('🚀 Executing migration...\n');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log('✅ Migration committed successfully.\n');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    // Post-check: verify all 3 tables exist with their column counts
    const verifyQuery = `
      SELECT t.table_name,
             COUNT(c.column_name)::int AS column_count
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c
        ON c.table_schema = t.table_schema
        AND c.table_name = t.table_name
      WHERE t.table_schema = 'public'
        AND t.table_name IN ('weekly_seminar_config', 'weekly_seminar_daily_report', 'weekly_seminar_weekly_report')
      GROUP BY t.table_name
      ORDER BY t.table_name;
    `;
    const verify = await client.query(verifyQuery);
    console.log('📊 Verification — tables created:');
    console.log('   ┌──────────────────────────────────────┬───────────────┐');
    console.log('   │ table_name                           │ column_count  │');
    console.log('   ├──────────────────────────────────────┼───────────────┤');
    for (const row of verify.rows) {
      const name = row.table_name.padEnd(36);
      const cnt = String(row.column_count).padStart(11);
      console.log(`   │ ${name} │ ${cnt}  │`);
    }
    console.log('   └──────────────────────────────────────┴───────────────┘');

    // Also verify indexes
    const idxQuery = `
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('weekly_seminar_config', 'weekly_seminar_daily_report', 'weekly_seminar_weekly_report')
      ORDER BY tablename, indexname;
    `;
    const idx = await client.query(idxQuery);
    console.log(`\n📊 Indexes created: ${idx.rows.length}`);
    for (const row of idx.rows) {
      console.log(`   - ${row.tablename}.${row.indexname}`);
    }

    // Verify FKs
    const fkQuery = `
      SELECT conname, conrelid::regclass AS table_name
      FROM pg_constraint
      WHERE contype = 'f'
        AND conrelid::regclass::text IN
          ('weekly_seminar_daily_report', 'weekly_seminar_weekly_report')
      ORDER BY conname;
    `;
    const fks = await client.query(fkQuery);
    console.log(`\n📊 Foreign keys: ${fks.rows.length}`);
    for (const row of fks.rows) {
      console.log(`   - ${row.table_name}: ${row.conname}`);
    }

    console.log('\n✨ Migration successful!');
  } catch (err) {
    console.error('\n❌ Migration failed:');
    console.error(err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
