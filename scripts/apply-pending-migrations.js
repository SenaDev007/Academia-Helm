/**
 * Apply pending Prisma migrations directly to Neon via pg.
 * Reads each migration.sql file and executes it, then records in _prisma_migrations.
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
  console.log(`Applied: ${applied.size}`);
  console.log(`Pending: ${pending.length}\n`);

  let ok = 0;
  let err = 0;
  let skip = 0;

  for (const migrationName of pending) {
    const sqlFile = path.join(MIGRATIONS_DIR, migrationName, 'migration.sql');
    if (!fs.existsSync(sqlFile)) {
      console.log(`⏭️  SKIP ${migrationName} (no migration.sql)`);
      skip++;
      continue;
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    process.stdout.write(`▶️  ${migrationName}... `);

    try {
      // Execute the migration SQL
      await db.query('BEGIN');
      await db.query(sql);
      await db.query('COMMIT');

      // Record in _prisma_migrations
      await db.query(
        `INSERT INTO _prisma_migrations (id, checksum, migration_name, logs, started_at, finished_at, applied_steps_count)
         VALUES (gen_random_uuid(), $1, $2, NULL, NOW(), NOW(), 0)
         ON CONFLICT (migration_name) DO NOTHING`,
        [Buffer.from(checksum, 'hex'), migrationName]
      );

      console.log('✅');
      ok++;
    } catch (e) {
      await db.query('ROLLBACK').catch(() => {});
      console.log(`❌ ${e.message.substring(0, 100)}`);
      err++;
    }
  }

  console.log(`\n═══ Summary ═══`);
  console.log(`  Applied: ${ok}`);
  console.log(`  Skipped: ${skip}`);
  console.log(`  Errors:  ${err}`);

  // Final count
  const final = await db.query('SELECT COUNT(*)::int as c FROM _prisma_migrations');
  console.log(`  Total in DB: ${final.rows[0].c}`);

  await db.end();
}

main().catch(e => { console.error('❌ FATAL:', e.message); process.exit(1); });
