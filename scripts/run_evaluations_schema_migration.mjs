/**
 * Apply the evaluations schema fix migration to Neon DB.
 * Migration : 20260724100000_fix_evaluations_schema
 *
 * Changements :
 * 1. Enum EvaluationStatus : +DRAFT, +LOCKED, +CANCELLED
 * 2. Table evaluations : +description, +teacherId, +gradeScaleId
 * 3. FK evaluations.periodId : quarters → academic_periods
 * 4. FK evaluations.gradeScaleId → grade_scales
 * 5. Table evaluation_types : +code, +schoolLevelId, +isSystem
 * 6. Index unique (tenantId, code) partiel (code non-null)
 */
import fs from 'fs';
import pg from 'pg';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const MIGRATION_FILE = '/home/z/my-project/apps/api-server/prisma/migrations/20260724100000_fix_evaluations_schema/migration.sql';

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
  console.log(`📄 Loaded migration: ${MIGRATION_FILE} (${sql.length} bytes)\n`);

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to Neon DB\n');

    // ⚠️ ALTER TYPE ADD VALUE doit être exécuté HORS transaction.
    // On sépare les statements ALTER TYPE des autres.
    const statements = sql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 5 && !s.startsWith('--'));

    let success = 0, skipped = 0;
    for (const stmt of statements) {
      const stripped = stmt.replace(/--[^\n]*\n/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
      if (!stripped || stripped.length < 5) continue;

      const isAlterType = stripped.toUpperCase().startsWith('ALTER TYPE');
      try {
        if (isAlterType) {
          // ALTER TYPE ADD VALUE ne peut pas être dans une transaction
          await client.query(stmt + ';');
        } else {
          await client.query('BEGIN');
          await client.query(stmt + ';');
          await client.query('COMMIT');
        }
        success++;
        const preview = stripped.split('\n')[0].substring(0, 80);
        console.log(`  ✓ ${preview}...`);
      } catch (err) {
        if (isAlterType) {
          // ALTER TYPE ADD VALUE IF NOT EXISTS peut échouer si la valeur existe déjà
          if (err.message.includes('already exists') || err.message.includes('duplicate')) {
            console.log(`  ⊙ SKIP (already exists): ${stripped.substring(0, 80)}...`);
            skipped++;
            continue;
          }
        }
        try { await client.query('ROLLBACK'); } catch {}
        console.error(`  ✗ FAILED: ${stripped.substring(0, 80)}`);
        console.error(`    Error: ${err.message}`);
      }
    }

    console.log(`\n✅ Migration terminée — ${success} succès, ${skipped} ignorés\n`);

    // Vérification post-migration
    console.log('═══ Vérifications post-migration ═══\n');

    // 1. Enum values
    const enumCheck = await client.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EvaluationStatus')
      ORDER BY enumsortorder
    `);
    console.log(`Enum EvaluationStatus (${enumCheck.rows.length} valeurs):`);
    enumCheck.rows.forEach(r => console.log(`  • ${r.enumlabel}`));

    // 2. evaluations schema
    const evalSchema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'evaluations'
      ORDER BY ordinal_position
    `);
    console.log(`\nTable evaluations (${evalSchema.rows.length} colonnes):`);
    evalSchema.rows.forEach(r => console.log(`  • ${r.column_name} (${r.data_type})`));

    // 3. evaluation_types schema
    const etSchema = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'evaluation_types'
      ORDER BY ordinal_position
    `);
    console.log(`\nTable evaluation_types (${etSchema.rows.length} colonnes):`);
    etSchema.rows.forEach(r => console.log(`  • ${r.column_name} (${r.data_type})`));

    // 4. FK constraints on evaluations
    const fkCheck = await client.query(`
      SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS ref_table
      FROM pg_constraint
      WHERE contype = 'f' AND conrelid = 'evaluations'::regclass
    `);
    console.log(`\nFK sur evaluations (${fkCheck.rows.length}):`);
    fkCheck.rows.forEach(r => console.log(`  • ${r.conname} → ${r.ref_table}`));

    console.log('\n✅ Toutes les vérifications terminées');

  } catch (err) {
    console.error('❌ Erreur fatale:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
