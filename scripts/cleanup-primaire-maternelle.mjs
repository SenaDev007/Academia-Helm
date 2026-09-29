/**
 * Cleanup des anomalies restantes :
 *  1. Supprimer les 18 évaluations ED (Évaluation diagnostique) PLANNED sans grades
 *     — elles polluent le bulletin (l'ED est hors périmètre des bulletins trimestriels).
 *  2. Supprimer le sujet orphelin "Mathématiques" MATH-04 (doublon avec MATH-04 primaire).
 *  3. Supprimer le sujet orphelin "Conte" CONTE (non rattaché, langue NULL).
 *  4. Vérifier qu'aucune matière anglophone n'est rattachée à une classe FR.
 */
import pg from 'pg';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const ACADEMIC_YEAR_ID = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected\n');

  // ════════════════════════════════════════════════════════════════════
  // STEP 1: Supprimer les évaluations ED (Évaluation diagnostique) pour primaire
  // ════════════════════════════════════════════════════════════════════
  console.log('━'.repeat(80));
  console.log('STEP 1: Supprimer les évaluations ED (Évaluation diagnostique)');
  console.log('━'.repeat(80));

  // Trouver le type ED pour PRIMAIRE
  const edType = await client.query(
    `SELECT id FROM evaluation_types WHERE "tenantId" = $1 AND code = 'ED'`,
    [TENANT_ID]
  );
  if (edType.rows.length > 0) {
    const edTypeId = edType.rows[0].id;
    // Compter les évals ED
    const cnt = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM evaluations WHERE "evaluationTypeId" = $1 AND "tenantId" = $2`,
      [edTypeId, TENANT_ID]
    );
    console.log(`  Évaluations ED trouvées : ${cnt.rows[0].cnt}`);

    // Supprimer d'abord les grades liés (s'il y en a)
    const gradesDeleted = await client.query(
      `DELETE FROM grades WHERE "evaluationId" IN (
        SELECT id FROM evaluations WHERE "evaluationTypeId" = $1 AND "tenantId" = $2
      ) RETURNING id`,
      [edTypeId, TENANT_ID]
    );
    console.log(`  Grades supprimés : ${gradesDeleted.rowCount}`);

    // Supprimer les évaluations ED
    const evalsDeleted = await client.query(
      `DELETE FROM evaluations WHERE "evaluationTypeId" = $1 AND "tenantId" = $2 RETURNING id`,
      [edTypeId, TENANT_ID]
    );
    console.log(`  Évaluations ED supprimées : ${evalsDeleted.rowCount}`);

    // Supprimer le type ED pour PRIMAIRE
    const typeDeleted = await client.query(
      `DELETE FROM evaluation_types WHERE id = $1 RETURNING id, code`,
      [edTypeId]
    );
    console.log(`  Type ED supprimé : ${typeDeleted.rows[0]?.code} (${typeDeleted.rows[0]?.id.substring(0,8)})`);
  } else {
    console.log('  ✓ Type ED n\'existe pas');
  }
  console.log();

  // ════════════════════════════════════════════════════════════════════
  // STEP 2: Supprimer les sujets orphelins (Conte + Mathématiques MATH-04 duplicate)
  // ════════════════════════════════════════════════════════════════════
  console.log('━'.repeat(80));
  console.log('STEP 2: Supprimer les sujets orphelins');
  console.log('━'.repeat(80));

  // 2a) Sujet "Conte" (CONTE) — non rattaché, langue NULL
  const conte = await client.query(
    `SELECT s.id, s.name, s.code, s.language
       FROM subjects s
       LEFT JOIN class_subjects cs ON cs."subjectId" = s.id
      WHERE s."tenantId" = $1 AND s.code = 'CONTE' AND cs.id IS NULL`,
    [TENANT_ID]
  );
  if (conte.rows.length > 0) {
    await client.query(`DELETE FROM subjects WHERE id = $1`, [conte.rows[0].id]);
    console.log(`  ✓ Sujet orphelin supprimé : "${conte.rows[0].name}" (${conte.rows[0].code}, lang=${conte.rows[0].language || 'NULL'})`);
  } else {
    console.log('  ✓ Pas de sujet "Conte" orphelin');
  }

  // 2b) Sujet "Mathématiques" avec code MATH-04 mais schoolLevelId NULL
  //     (différent du MATH-04 rattaché à PRIMAIRE)
  const orphanMath = await client.query(
    `SELECT s.id, s.name, s.code, s.language, s."schoolLevelId"
       FROM subjects s
       LEFT JOIN class_subjects cs ON cs."subjectId" = s.id
      WHERE s."tenantId" = $1 AND s.code = 'MATH-04' AND cs.id IS NULL`,
    [TENANT_ID]
  );
  if (orphanMath.rows.length > 0) {
    await client.query(`DELETE FROM subjects WHERE id = $1`, [orphanMath.rows[0].id]);
    console.log(`  ✓ Sujet orphelin supprimé : "${orphanMath.rows[0].name}" (${orphanMath.rows[0].code}, schoolLevelId=${orphanMath.rows[0].schoolLevelId || 'NULL'})`);
  } else {
    console.log('  ✓ Pas de sujet MATH-04 orphelin (peut être rattaché quelque part — vérifier)');
    // Vérifier s'il y a un MATH-04 attaché à une classe maternelle (anomalie)
    const mInMaternelle = await client.query(`
      SELECT s.id, s.name, s.code, s.language, c.name AS class_name, sl.code AS level_code
        FROM subjects s
        JOIN class_subjects cs ON cs."subjectId" = s.id
        JOIN classes c ON c."officialClassId" = cs."academicClassId"
        JOIN school_levels sl ON sl.id = c."schoolLevelId"
       WHERE s."tenantId" = $1 AND s.code = 'MATH-04' AND sl.code = 'MATERNELLE'
    `, [TENANT_ID]);
    if (mInMaternelle.rows.length > 0) {
      console.log(`  ⚠️ MATH-04 trouvé rattaché à une classe MATERNELLE — anomalie !`);
      mInMaternelle.rows.forEach(r => console.log(`     • ${r.name} (${r.code}) → ${r.level_code} ${r.class_name}`));
      // Supprimer ce rattachement inapproprié
      for (const r of mInMaternelle.rows) {
        await client.query(`DELETE FROM class_subjects WHERE "subjectId" = $1 AND "academicClassId" IN (
          SELECT c."officialClassId" FROM classes c
          JOIN school_levels sl ON sl.id = c."schoolLevelId"
          WHERE sl.code = 'MATERNELLE' AND c."tenantId" = $2
        )`, [r.id, TENANT_ID]);
        console.log(`     → rattachement supprimé`);
      }
    }
  }
  console.log();

  // ════════════════════════════════════════════════════════════════════
  // STEP 3: Vérifier qu'aucune matière anglophone (lang='EN') n'est rattachée
  // ════════════════════════════════════════════════════════════════════
  console.log('━'.repeat(80));
  console.log('STEP 3: Vérifier qu\'aucune matière anglophone n\'est rattachée');
  console.log('━'.repeat(80));

  const enAttached = await client.query(`
    SELECT s.id, s.name, s.code, s.language, c.name AS class_name, sl.code AS level_code
      FROM subjects s
      JOIN class_subjects cs ON cs."subjectId" = s.id
      JOIN classes c ON c."officialClassId" = cs."academicClassId"
      JOIN school_levels sl ON sl.id = c."schoolLevelId"
     WHERE s."tenantId" = $1 AND s.language = 'EN'
  `, [TENANT_ID]);
  if (enAttached.rows.length > 0) {
    console.log(`  ⚠️ ${enAttached.rows.length} matières anglophones rattachées :`);
    enAttached.rows.forEach(r => console.log(`    • ${r.name} (${r.code}) → ${r.level_code} ${r.class_name}`));
    // Les supprimer
    for (const r of enAttached.rows) {
      await client.query(`DELETE FROM class_subjects WHERE "subjectId" = $1`, [r.id]);
    }
    console.log(`  → Rattachements supprimés`);
  } else {
    console.log('  ✓ Aucune matière anglophone rattachée — système FR pur');
  }
  console.log();

  // ════════════════════════════════════════════════════════════════════
  // STEP 4: Vérification finale — toutes les matières rattachées par classe
  // ════════════════════════════════════════════════════════════════════
  console.log('━'.repeat(80));
  console.log('STEP 4: Vérification finale — matières rattachées par classe');
  console.log('━'.repeat(80));

  const classes = await client.query(`
    SELECT c.id, c.name, c."officialClassId", sl.code AS level_code
      FROM classes c
      JOIN school_levels sl ON sl.id = c."schoolLevelId"
     WHERE c."tenantId" = $1 AND c."academicYearId" = $2
     ORDER BY sl.code, c.name
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  for (const cls of classes.rows) {
    const subs = await client.query(`
      SELECT s.name, s.code, s.language
        FROM class_subjects cs
        JOIN subjects s ON s.id = cs."subjectId"
       WHERE cs."tenantId" = $1 AND cs."academicClassId" = $2
       ORDER BY s.language NULLS FIRST, s.name
    `, [TENANT_ID, cls.officialClassId]);
    const langs = new Set(subs.rows.map(s => s.language || 'NULL'));
    console.log(`  ${cls.level_code} ${cls.name} : ${subs.rows.length} matières (langues: ${[...langs].join(', ')})`);
  }

  await client.end();
  console.log('\n✅ Cleanup terminé');
}

main().catch(err => { console.error('❌', err); process.exit(1); });
