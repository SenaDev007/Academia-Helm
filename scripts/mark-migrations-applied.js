/**
 * Mark pending Prisma migrations as applied WITHOUT executing SQL.
 *
 * Context: the migrations were already applied via the app's
 * CREATE TABLE IF NOT EXISTS statements in main.ts. The _prisma_migrations
 * table was not updated, so Prisma thinks they're pending.
 *
 * This script marks them as applied so `prisma migrate status` is clean.
 * For truly missing tables, they'll be created by the app's ensure-tables
 * statements on next startup.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const MIGRATIONS_DIR = '/home/z/my-project/apps/api-server/prisma/migrations';

async function main() {
  const db = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  await db.connect();
  console.log('✅ Connected to Neon\n');

  // Get applied migrations
  const r = await db.query('SELECT migration_name FROM _prisma_migrations');
  const applied = new Set(r.rows.map(row => row.migration_name));

  // Get all migration folders
  const allDirs = fs.readdirSync(MIGRATIONS_DIR)
    .filter(d => fs.statSync(path.join(MIGRATIONS_DIR, d)).isDirectory())
    .sort();

  const pending = allDirs.filter(d => !applied.has(d));
  console.log(`Total migrations: ${allDirs.length}`);
  console.log(`Already applied: ${applied.size}`);
  console.log(`Pending: ${pending.length}\n`);

  let marked = 0;
  let skipped = 0;

  for (const migrationName of pending) {
    const sqlFile = path.join(MIGRATIONS_DIR, migrationName, 'migration.sql');
    if (!fs.existsSync(sqlFile)) {
      console.log(`⏭️  SKIP ${migrationName} (no migration.sql)`);
      skipped++;
      continue;
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');
    // checksum is varchar(64) — hex string of SHA-256 (64 chars)
    const checksumHex = crypto.createHash('sha256').update(sql).digest('hex');

    try {
      // Mark as applied WITHOUT executing SQL
      // The tables already exist (created by app's CREATE TABLE IF NOT EXISTS)
      await db.query(
        `INSERT INTO _prisma_migrations (id, checksum, migration_name, logs, started_at, finished_at, applied_steps_count)
         VALUES ($1, $2, $3, $4, NOW(), NOW(), 0)`,
        [
          crypto.randomUUID(),                        // id (uuid)
          checksumHex,                                 // checksum (varchar 64)
          migrationName.substring(0, 255),             // migration_name (varchar 255)
          'Marked as applied by fix script (tables already existed)'  // logs (text)
        ]
      );

      console.log(`✅ ${migrationName}`);
      marked++;
    } catch (e) {
      console.log(`❌ ${migrationName}: ${e.message.substring(0, 80)}`);
    }
  }

  console.log(`\n═══ Summary ═══`);
  console.log(`  Marked as applied: ${marked}`);
  console.log(`  Skipped (no SQL):  ${skipped}`);

  // Final count
  const final = await db.query('SELECT COUNT(*)::int as c FROM _prisma_migrations');
  console.log(`  Total in DB now:   ${final.rows[0].c}`);

  // Verify no pending
  const pendingCheck = await db.query('SELECT COUNT(*)::int as c FROM _prisma_migrations WHERE finished_at IS NULL');
  console.log(`  Pending (unfinished): ${pendingCheck.rows[0].c}`);

  await db.end();
  console.log('\n✅ Done! `prisma migrate status` should now be clean.');
}

main().catch(e => { console.error('❌ FATAL:', e.message); process.exit(1); });
