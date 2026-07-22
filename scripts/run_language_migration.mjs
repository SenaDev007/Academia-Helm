import fs from 'fs';
import pg from 'pg';
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const sql = fs.readFileSync('apps/api-server/prisma/migrations/20260723160000_add_language_to_academic_settings/migration.sql', 'utf8');
const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(s => s.length > 5);
for (const stmt of statements) {
  const stripped = stmt.replace(/--[^\n]*\n/g, '').trim();
  if (!stripped || stripped.length < 5) continue;
  try {
    await client.query('BEGIN');
    await client.query(stmt + ';');
    await client.query('COMMIT');
    console.log(`  ✓ ${stripped.substring(0, 70)}...`);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.message.includes('already exists')) console.log('  ⏭️ skipped (exists)');
    else throw err;
  }
}
// Verify
const cols = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'school_academic_settings' AND column_name IN ('language', 'secondaryCycle')
`);
console.log(`\n✅ ${cols.rows.length}/2 colonnes ajoutées: ${cols.rows.map(r => r.column_name).join(', ')}`);
await client.end();
