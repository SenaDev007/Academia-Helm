// Apply Phase 2 spec tables migration to Neon DB
import fs from 'fs';
import pg from 'pg';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const MIGRATION_FILE = '/home/z/my-project/apps/api-server/prisma/migrations/20260723120000_add_exams_spec_tables/migration.sql';

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected\n🚀 Executing migration...\n');

  const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(s => s.length > 5);
  let success = 0, skipped = 0;
  for (const stmt of statements) {
    const stripped = stmt.replace(/--[^\n]*\n/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!stripped || stripped.length < 5) continue;
    try {
      await client.query('BEGIN');
      await client.query(stmt + ';');
      await client.query('COMMIT');
      success++;
      if (stripped.startsWith('CREATE TABLE')) {
        console.log(`  ✓ ${stripped.split('\n')[0].substring(0, 80)}...`);
      }
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        skipped++;
      } else {
        console.error(`  ❌ ${stripped.substring(0, 80)}\n     ${err.message.substring(0, 200)}`);
        throw err;
      }
    }
  }
  console.log(`\n✅ ${success} statements OK, ${skipped} skipped`);

  // Verify
  const result = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN (
      'qualitative_scales', 'level_evaluation_policies', 'bilingual_pedagogy_policies',
      'bulletin_templates', 'bulletin_publication_policies', 'exam_advanced_settings',
      'academic_mention_rules', 'academic_decision_rules', 'academic_analytics_snapshots'
    ) ORDER BY table_name;
  `);
  console.log(`\n📊 Verification — ${result.rows.length}/9 spec tables found:`);
  for (const r of result.rows) console.log(`  ✓ ${r.table_name}`);
  await client.end();
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
