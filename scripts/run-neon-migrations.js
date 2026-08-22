/**
 * ⭐ Run the chat_messaging migration directly on Neon DB
 *    Uses the connection string found in scripts/migrate-logos-to-r2.ts
 *
 * Reads the SQL file and executes each statement separately.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const fs = require('fs');

const NEON_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function runMigration(sqlFilePath) {
  const sql = fs.readFileSync(sqlFilePath, 'utf8');
  console.log(`📄 Loaded migration: ${sqlFilePath} (${sql.length} chars)`);

  const client = new Client({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  try {
    console.log('🔌 Connecting to Neon...');
    await client.connect();
    console.log('✅ Connected.');

    // ⭐ Strip comment lines (-- ...) BEFORE splitting, then split on ';'
    //    Without this, comments attached to CREATE TABLE statements would
    //    cause them to be filtered out as "starting with --".
    const sqlNoComments = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = sqlNoComments
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`📋 Found ${statements.length} SQL statements to execute.\n`);

    let ok = 0, failed = 0;
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (!stmt) continue;
      const preview = stmt.substring(0, 80).replace(/\s+/g, ' ');
      try {
        await client.query(stmt + ';');
        ok++;
        console.log(`✅ [${i + 1}/${statements.length}] ${preview}...`);
      } catch (e) {
        // Ignore "already exists" errors (idempotent migration)
        if (e.message.includes('already exists') || e.message.includes('duplicate')) {
          console.log(`⚠️  [${i + 1}/${statements.length}] Already exists: ${preview}...`);
          ok++;
        } else {
          failed++;
          console.error(`❌ [${i + 1}/${statements.length}] FAILED: ${e.message}`);
          console.error('   Statement:', preview);
        }
      }
    }

    console.log(`\n📊 Migration summary: ${ok} OK, ${failed} failed (out of ${statements.length}).`);

    // Verify by listing tables that should now exist
    console.log('\n🔍 Verifying tables...');
    const res = await client.query(`
      SELECT tablename FROM pg_tables
      WHERE tablename LIKE 'chat_%' OR tablename LIKE 'annual_plans%' OR tablename LIKE 'monthly_plans%'
      ORDER BY tablename;
    `);
    console.log('📋 Chat/Planning tables in DB:');
    for (const row of res.rows) {
      console.log(`   - ${row.tablename}`);
    }
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n👋 Disconnected.');
  }
}

// Run for all migrations
(async () => {
  const migrations = [
    '/home/z/my-project/apps/api-server/prisma/migrations/20260822200000_add_annual_plans/migration.sql',
    '/home/z/my-project/apps/api-server/prisma/migrations/20260823200000_add_monthly_plans/migration.sql',
    '/home/z/my-project/apps/api-server/prisma/migrations/20260823210000_add_chat_messaging/migration.sql',
    '/home/z/my-project/apps/api-server/prisma/migrations/20260824000000_add_monthly_plans_status_signatures/migration.sql',
    '/home/z/my-project/apps/api-server/prisma/migrations/20260824010000_add_user_presence/migration.sql',
    '/home/z/my-project/apps/api-server/prisma/migrations/20260824020000_add_channels_e2e_avatar/migration.sql',
  ];
  for (const m of migrations) {
    if (fs.existsSync(m)) {
      console.log(`\n${'═'.repeat(80)}`);
      console.log(`▶ Running: ${m}`);
      console.log('═'.repeat(80));
      await runMigration(m);
    } else {
      console.log(`⚠️  Migration file not found: ${m}`);
    }
  }
})();
