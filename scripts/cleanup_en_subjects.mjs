/**
 * ============================================================================
 * CLEAN UP SEED — Delete evaluations+grades for non-FR subjects
 * ============================================================================
 *
 * The previous seed included ALL subjects (FR + EN) for PRIMAIRE classes.
 * Per Academia Helm spec, only FR-track subjects should be seeded for the
 * Francophone track (the Anglophone track has its own separate subjects).
 *
 * This script:
 *   1. Identifies subjects with language='EN' (or English-named subjects)
 *   2. Deletes grades linked to evaluations for those subjects
 *   3. Deletes the evaluations themselves
 *
 * After cleanup, re-seeds FR-only grades for the remaining evaluations.
 * ============================================================================
 */
import pg from 'pg';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const ACADEMIC_YEAR_ID = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';
const PRIMAIRE_LEVEL_ID = 'bc434610-8cf6-4415-a51a-cc5300cd99da';

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log('✅ Connected\n');

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Find all EN subjects for this tenant
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━'.repeat(80));
  console.log('STEP 1: Find EN subjects');
  console.log('━'.repeat(80));

  // Subjects with language='EN' OR with English names (codes ending in -EN-)
  const enSubjects = await client.query(`
    SELECT id, name, code, language
    FROM subjects
    WHERE "tenantId" = $1
      AND (language = 'EN' OR code LIKE '%-EN-%' OR name IN (
        'Agricultural Science', 'Basic Science', 'Christian Religious Knowledge (CRK)',
        'Civic Education', 'Computer Science', 'Cultural and Creative Arts (CCA)',
        'Drawing', 'English Language', 'Handwriting',
        'Mathematics', 'Physical and Health Education (PHE)'
      ))
    ORDER BY name
  `, [TENANT_ID]);
  console.log(`✓ Found ${enSubjects.rows.length} EN subjects:`);
  for (const s of enSubjects.rows) {
    console.log(`  • ${s.name} (${s.code || '—'}) lang=${s.language || '—'}`);
  }
  const enSubjectIds = enSubjects.rows.map(s => s.id);

  if (enSubjectIds.length === 0) {
    console.log('No EN subjects found — nothing to clean up.');
    await client.end();
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Find evaluations linked to those EN subjects
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '━'.repeat(80));
  console.log('STEP 2: Find evaluations for EN subjects');
  console.log('━'.repeat(80));

  const enEvals = await client.query(`
    SELECT e.id, e.title, c.name AS class_name, s.name AS subject_name
    FROM evaluations e
    JOIN classes c ON c.id = e."classId"
    JOIN subjects s ON s.id = e."subjectId"
    WHERE e."tenantId" = $1
      AND e."subjectId" = ANY($2::text[])
  `, [TENANT_ID, enSubjectIds]);
  console.log(`✓ Found ${enEvals.rows.length} evaluations linked to EN subjects`);
  const enEvalIds = enEvals.rows.map(e => e.id);

  if (enEvalIds.length === 0) {
    console.log('No evaluations to delete.');
    await client.end();
    return;
  }

  // Show breakdown by class
  const byClass = {};
  for (const e of enEvals.rows) {
    if (!byClass[e.class_name]) byClass[e.class_name] = 0;
    byClass[e.class_name]++;
  }
  for (const [cls, cnt] of Object.entries(byClass)) {
    console.log(`  • ${cls}: ${cnt} evaluations to delete`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Delete grades for those evaluations
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '━'.repeat(80));
  console.log('STEP 3: Delete grades for EN-subject evaluations');
  console.log('━'.repeat(80));

  const deletedGrades = await client.query(`
    DELETE FROM grades
    WHERE "evaluationId" = ANY($1::text[])
    RETURNING id
  `, [enEvalIds]);
  console.log(`✓ Deleted ${deletedGrades.rowCount} grades`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Delete the evaluations themselves
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '━'.repeat(80));
  console.log('STEP 4: Delete EN-subject evaluations');
  console.log('━'.repeat(80));

  const deletedEvals = await client.query(`
    DELETE FROM evaluations
    WHERE id = ANY($1::text[])
    RETURNING id
  `, [enEvalIds]);
  console.log(`✓ Deleted ${deletedEvals.rowCount} evaluations`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 5: Verify final state
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '━'.repeat(80));
  console.log('STEP 5: Final verification');
  console.log('━'.repeat(80));

  const finalStats = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM evaluations WHERE "tenantId" = $1) AS total_evals,
      (SELECT COUNT(*)::int FROM grades WHERE "tenantId" = $1) AS total_grades,
      (SELECT COUNT(DISTINCT s."subjectId")::int FROM evaluations e
       JOIN subjects s ON s.id = e."subjectId"
       WHERE e."tenantId" = $1 AND s.language = 'EN') AS remaining_en_evals
  `, [TENANT_ID]);
  console.log('Final stats:', finalStats.rows[0]);

  // Per-class breakdown
  console.log('\nPer-class breakdown (FR subjects only):');
  const perClass = await client.query(`
    SELECT c.name,
      COUNT(DISTINCT e.id)::int AS eval_count,
      COUNT(DISTINCT s.id)::int AS subject_count,
      COUNT(g.id)::int AS grade_count
    FROM classes c
    JOIN school_levels sl ON sl.id = c."schoolLevelId" AND sl.code = 'PRIMAIRE'
    LEFT JOIN evaluations e ON e."classId" = c.id
    LEFT JOIN subjects s ON s.id = e."subjectId" AND (s.language = 'FR' OR s.language IS NULL)
    LEFT JOIN grades g ON g."evaluationId" = e.id
    WHERE c."tenantId" = $1 AND c."academicYearId" = $2
    GROUP BY c.name ORDER BY c.name
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  for (const r of perClass.rows) {
    console.log(`  • ${r.class_name}: ${r.eval_count} evals, ${r.subject_count} subjects, ${r.grade_count} grades`);
  }

  await client.end();
  console.log('\n✅ Cleanup complete');
}

main().catch(err => {
  console.error('❌ FATAL:', err);
  process.exit(1);
});
