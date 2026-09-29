/**
 * ============================================================================
 * CLEANUP SECONDAIRE — Supprimer le type EC (Évaluation certificative)
 * ============================================================================
 *
 * ⭐ Correction : au niveau secondaire, il n'y a PAS d'évaluation certificative.
 *    Les types sont uniquement : INT1, INT2, DS1, DS2.
 *    Maternelle et Primaire utilisent EM1, EM2, EC, EP.
 *
 * Ce script supprime :
 * 1. Toutes les évaluations de type EC pour la classe 6e (24 évals = 3 trim × 8 matières).
 * 2. Tous les grades liés à ces évaluations (24 × 3 élèves = 72 grades).
 * 3. Le type d'évaluation EC pour le niveau SECONDAIRE (tenant 59b8c348).
 *
 * Idempotent.
 * ============================================================================
 */
import pg from 'pg';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const ACADEMIC_YEAR_ID = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';
const SECONDAIRE_LEVEL_CODE = 'SECONDAIRE';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected to Neon DB\n');

  // 1) Trouver le school_level SECONDAIRE
  const secLevel = await client.query(
    `SELECT id FROM school_levels WHERE "tenantId" = $1 AND code = $2`,
    [TENANT_ID, SECONDAIRE_LEVEL_CODE]
  );
  if (secLevel.rows.length === 0) {
    console.error('❌ Niveau SECONDAIRE introuvable');
    process.exit(1);
  }
  const SECONDAIRE_LEVEL_ID = secLevel.rows[0].id;
  console.log(`Niveau SECONDAIRE : ${SECONDAIRE_LEVEL_ID}\n`);

  // 2) Trouver le type EC pour SECONDAIRE
  const ecType = await client.query(
    `SELECT id, code, name FROM evaluation_types
      WHERE "tenantId" = $1 AND code = 'EC' AND "schoolLevelId" = $2`,
    [TENANT_ID, SECONDAIRE_LEVEL_ID]
  );
  if (ecType.rows.length === 0) {
    console.log('✓ Type EC pour SECONDAIRE n\'existe pas — rien à supprimer.');
    await client.end();
    return;
  }
  const ecTypeId = ecType.rows[0].id;
  console.log(`Type EC trouvé : ${ecTypeId} (${ecType.rows[0].name})\n`);

  // 3) Lister les évaluations EC pour ce tenant (toutes classes confondues)
  const ecEvals = await client.query(
    `SELECT e.id, e."classId", c.name AS class_name, ap.name AS period_name
       FROM evaluations e
       LEFT JOIN classes c ON c.id = e."classId"
       LEFT JOIN academic_periods ap ON ap.id = e."periodId"
      WHERE e."evaluationTypeId" = $1
        AND e."tenantId" = $2
        AND e."academicYearId" = $3`,
    [ecTypeId, TENANT_ID, ACADEMIC_YEAR_ID]
  );
  console.log(`Évaluations EC pour SECONDAIRE (2026-2027) : ${ecEvals.rows.length}`);
  ecEvals.rows.forEach(r => console.log(`  • ${r.class_name || '—'} | ${r.period_name || '—'} | ${r.id.substring(0,8)}`));

  if (ecEvals.rows.length === 0) {
    console.log('\nAucune évaluation EC à supprimer — on supprime juste le type.');
  } else {
    const evalIds = ecEvals.rows.map(r => r.id);

    // 4) Supprimer les grades liés à ces évaluations
    const deletedGrades = await client.query(
      `DELETE FROM grades WHERE "evaluationId" = ANY($1::text[]) RETURNING id`,
      [evalIds]
    );
    console.log(`\n✓ Grades supprimés : ${deletedGrades.rowCount}`);

    // 5) Supprimer les évaluations EC
    const deletedEvals = await client.query(
      `DELETE FROM evaluations WHERE id = ANY($1::text[]) RETURNING id`,
      [evalIds]
    );
    console.log(`✓ Évaluations supprimées : ${deletedEvals.rowCount}`);
  }

  // 6) Supprimer le type d'évaluation EC pour SECONDAIRE
  const deletedType = await client.query(
    `DELETE FROM evaluation_types WHERE id = $1 RETURNING id, code`,
    [ecTypeId]
  );
  console.log(`\n✓ Type d'évaluation EC supprimé pour SECONDAIRE : ${deletedType.rows[0].code} (${deletedType.rows[0].id.substring(0,8)})`);

  // 7) Vérification finale
  const remainingTypes = await client.query(
    `SELECT id, code, name, "defaultMaxScore", "defaultCoefficient"
       FROM evaluation_types
      WHERE "tenantId" = $1 AND "schoolLevelId" = $2
      ORDER BY code`,
    [TENANT_ID, SECONDAIRE_LEVEL_ID]
  );
  console.log(`\nTypes d'évaluation restants pour SECONDAIRE (${remainingTypes.rows.length}):`);
  remainingTypes.rows.forEach(t => console.log(`  • ${t.code} — ${t.name} (max=${t.defaultMaxScore}, coef=${t.defaultCoefficient})`));

  // Vérifier les évaluations restantes pour la 6e
  const sixeEvals = await client.query(`
    SELECT et.code AS eval_type, ap.name AS period_name, COUNT(*)::int AS cnt
      FROM evaluations e
      JOIN evaluation_types et ON et.id = e."evaluationTypeId"
      LEFT JOIN academic_periods ap ON ap.id = e."periodId"
      JOIN classes c ON c.id = e."classId"
      JOIN school_levels sl ON sl.id = c."schoolLevelId"
     WHERE sl.code = 'SECONDAIRE' AND e."tenantId" = $1 AND e."academicYearId" = $2
     GROUP BY et.code, ap.name
     ORDER BY ap.name, et.code
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`\nCouverture restante pour la 6e :`);
  sixeEvals.rows.forEach(r => console.log(`  • ${r.period_name || '—'} | ${r.eval_type} : ${r.cnt} évaluations`));

  await client.end();
  console.log('\n✅ Cleanup terminé');
}

main().catch(err => {
  console.error('❌ FATAL:', err);
  console.error(err.stack);
  process.exit(1);
});
