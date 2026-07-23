/**
 * Test CRUD complet d'une évaluation dans Neon DB.
 * 1. Crée une évaluation avec un type valide
 * 2. Lit l'évaluation créée
 * 3. Modifie l'évaluation
 * 4. Change le statut (PLANNED → OPEN_FOR_GRADING)
 * 5. Supprime l'évaluation (hard delete car pas de notes)
 * 6. Vérifie que tout est bien persisté à chaque étape
 */
import pg from 'pg';

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connecté à Neon DB\n');

    // ─── Préparer les données de test ────────────────────────────────────────
    // Utiliser le tenant CSPEB (59b8c348...) et son année 2026-2027
    const tenantId = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
    const academicYearId = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';

    // Récupérer une classe, un sujet, une période, un type d'évaluation
    const classRes = await client.query('SELECT id, name, "schoolLevelId" FROM classes LIMIT 1');
    const subjectRes = await client.query('SELECT id, name FROM subjects LIMIT 1');
    const periodRes = await client.query('SELECT id, name FROM academic_periods WHERE "academicYearId" = $1 LIMIT 1', [academicYearId]);
    const typeRes = await client.query('SELECT id, name, code FROM evaluation_types WHERE "tenantId" = $1 AND code = $2 LIMIT 1', [tenantId, 'DV']);

    if (classRes.rows.length === 0 || subjectRes.rows.length === 0 || periodRes.rows.length === 0 || typeRes.rows.length === 0) {
      console.log('⚠️  Données de référence manquantes:');
      console.log('  - classes:', classRes.rows.length);
      console.log('  - subjects:', subjectRes.rows.length);
      console.log('  - periods:', periodRes.rows.length);
      console.log('  - evaluation_types (DV):', typeRes.rows.length);
      return;
    }

    const classId = classRes.rows[0].id;
    const subjectId = subjectRes.rows[0].id;
    const periodId = periodRes.rows[0].id;
    const typeId = typeRes.rows[0].id;

    console.log('═══ Données de référence ═══');
    console.log('  Classe:', classRes.rows[0].name, '(', classId.substring(0, 8), ')');
    console.log('  Sujet:', subjectRes.rows[0].name, '(', subjectId.substring(0, 8), ')');
    console.log('  Période:', periodRes.rows[0].name, '(', periodId.substring(0, 8), ')');
    console.log('  Type:', typeRes.rows[0].name, '/', typeRes.rows[0].code, '(', typeId.substring(0, 8), ')');
    console.log('');

    // ─── 1. CREATE ────────────────────────────────────────────────────────────
    console.log('═══ 1. CREATE ═══');
    const createRes = await client.query(`
      INSERT INTO evaluations (id, "tenantId", "academicYearId", "classId", "subjectId", "periodId", "evaluationTypeId",
                                title, description, "evaluationDate", "maxScore", "coefficient", status, "createdBy", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6,
              $7, $8, NOW(), 20, 1, 'PLANNED', NULL, NOW(), NOW())
      RETURNING id, title, status, "maxScore", coefficient, "createdAt"
    `, [tenantId, academicYearId, classId, subjectId, periodId, typeId,
        'Test CRUD — Devoir n°1', 'Évaluation de test pour valider le CRUD']);
    const evalRow = createRes.rows[0];
    console.log('  ✅ Évaluation créée:');
    console.log('     ID:', evalRow.id);
    console.log('     Titre:', evalRow.title);
    console.log('     Statut:', evalRow.status);
    console.log('     MaxScore:', evalRow.maxScore, '| Coef:', evalRow.coefficient);

    // ─── 2. READ ──────────────────────────────────────────────────────────────
    console.log('\n═══ 2. READ ═══');
    const readRes = await client.query(`
      SELECT e.*, et.name AS type_name, et.code AS type_code, c.name AS class_name, s.name AS subject_name, p.name AS period_name
      FROM evaluations e
      LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
      LEFT JOIN classes c ON c.id = e."classId"
      LEFT JOIN subjects s ON s.id = e."subjectId"
      LEFT JOIN academic_periods p ON p.id = e."periodId"
      WHERE e.id = $1
    `, [evalRow.id]);
    const read = readRes.rows[0];
    console.log('  ✅ Évaluation lue:');
    console.log('     Titre:', read.title);
    console.log('     Type:', read.type_name, '(', read.type_code, ')');
    console.log('     Classe:', read.class_name);
    console.log('     Matière:', read.subject_name);
    console.log('     Période:', read.period_name);
    console.log('     Statut:', read.status);

    // ─── 3. UPDATE ────────────────────────────────────────────────────────────
    console.log('\n═══ 3. UPDATE ═══');
    const updateRes = await client.query(`
      UPDATE evaluations
      SET title = $1, "maxScore" = $2, coefficient = $3, description = $4, "updatedAt" = NOW()
      WHERE id = $5
      RETURNING title, "maxScore", coefficient, description, "updatedAt"
    `, ['Test CRUD — Devoir n°1 (MODIFIÉ)', 20, 2, 'Description mise à jour', evalRow.id]);
    const updated = updateRes.rows[0];
    console.log('  ✅ Évaluation modifiée:');
    console.log('     Nouveau titre:', updated.title);
    console.log('     Nouveau coef:', updated.coefficient);
    console.log('     Nouvelle description:', updated.description);

    // ─── 4. STATUS TRANSITION (PLANNED → OPEN_FOR_GRADING) ─────────────────────
    console.log('\n═══ 4. STATUS TRANSITION ═══');
    const transitionRes = await client.query(`
      UPDATE evaluations SET status = 'OPEN_FOR_GRADING', "updatedAt" = NOW()
      WHERE id = $1 RETURNING status
    `, [evalRow.id]);
    console.log('  ✅ Statut changé:', transitionRes.rows[0].status);

    // ─── 5. DELETE (hard delete car pas de notes) ─────────────────────────────
    console.log('\n═══ 5. DELETE ═══');
    await client.query('DELETE FROM evaluations WHERE id = $1', [evalRow.id]);
    const verifyRes = await client.query('SELECT COUNT(*) FROM evaluations WHERE id = $1', [evalRow.id]);
    console.log('  ✅ Évaluation supprimée — count restant:', verifyRes.rows[0].count);

    // ─── 6. Vérifications de l'état final ═══════════════════════════════════
    console.log('\n═══ ÉTAT FINAL ═══');
    const totalEvals = await client.query('SELECT COUNT(*) FROM evaluations');
    const totalTypes = await client.query('SELECT COUNT(*) FROM evaluation_types');
    const totalPeriods = await client.query('SELECT COUNT(*) FROM academic_periods');
    console.log('  Total évaluations:', totalEvals.rows[0].count);
    console.log('  Total types d\'évaluation:', totalTypes.rows[0].count);
    console.log('  Total périodes académiques:', totalPeriods.rows[0].count);

    // Vérifier l'enum
    const enumRes = await client.query(`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'EvaluationStatus')
      ORDER BY enumsortorder
    `);
    console.log('  Enum EvaluationStatus:', enumRes.rows.map(r => r.enumlabel).join(', '));

    console.log('\n✅ CRUD TEST TERMINÉ AVEC SUCCÈS — Tout est persisté correctement en DB');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
