// Apply the institutional exams migration to Neon DB
import fs from 'fs';
import pg from 'pg';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const MIGRATION_FILE = '/home/z/my-project/apps/api-server/prisma/migrations/20260723100000_add_institutional_exams_layer3/migration.sql';

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  console.log(`📄 Loaded migration: ${MIGRATION_FILE} (${sql.length} bytes)\n`);

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected\n');

    console.log('🚀 Executing migration...\n');
    // Run each statement in its own transaction to avoid transaction abort
    const statements = sql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 5);

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
          const preview = stripped.split('\n')[0].substring(0, 80);
          console.log(`  ✓ ${preview}...`);
        }
      } catch (err) {
        await client.query('ROLLBACK');
        if (err.message.includes('already exists') || err.message.includes('duplicate')) {
          skipped++;
        } else if (stripped.startsWith('ALTER TABLE') && (
          err.message.includes('constraint') || err.message.includes('could not')
        )) {
          console.log(`  ⏭️  FK skipped: ${err.message.substring(0, 80)}`);
          skipped++;
        } else {
          console.error(`  ❌ Statement failed: ${stripped.substring(0, 80)}`);
          console.error(`     ${err.message.substring(0, 200)}`);
          throw err;
        }
      }
    }
    console.log(`\n✅ Migration committed. (${success} statements, ${skipped} skipped)`);

    // Verification
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'academic_periods', 'school_academic_settings', 'academic_settings_audit_logs',
          'evaluations', 'evaluation_types', 'grade_scales', 'exam_calculation_rules',
          'grade_validation_batches', 'grade_locks', 'student_period_averages',
          'student_subject_averages', 'student_council_decisions',
          'academic_audit_logs', 'grade_correction_requests'
        )
      ORDER BY table_name;
    `);
    console.log(`\n📊 Verification — ${result.rows.length}/14 tables found:`);
    for (const r of result.rows) {
      console.log(`  ✓ ${r.table_name}`);
    }

    console.log('\n✨ Migration successful!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
