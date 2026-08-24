import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, '../apps/api-server/prisma/migrations/20260823200000_add_helm_connect_announcements/migration.sql');
const sql = readFileSync(migrationPath, 'utf8');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('⭐ Applying Helm Connect announcements migration...');
  try {
    await pool.query(sql);
    console.log('✓ Migration applied successfully');
  } catch (e) {
    // Try splitting on semicolons that end statements (not inside functions/strings)
    console.log('Bulk apply failed, trying statement-by-statement...');
    const statements = sql
      .split(/^([A-Z][^;\n]*(?:;|[\r\n]+))/m)
      .filter(s => s && s.trim().length > 5 && !s.trim().startsWith('--'));
    
    let ok = 0;
    let fail = 0;
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      try {
        await pool.query(trimmed.endsWith(';') ? trimmed : trimmed + ';');
        ok++;
        console.log(`  ✓ ${trimmed.substring(0, 70).replace(/\n/g, ' ')}...`);
      } catch (e2) {
        fail++;
        console.error(`  ✗ ${e2.message.substring(0, 100)}`);
      }
    }
    console.log(`✓ ${ok} OK, ${fail} failed`);
  }
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
