/**
 * ============================================================================
 * SEED SECONDAIRE — Academia Helm uniquement
 * ============================================================================
 *
 * ⚠️ Tenant cible : Academia Helm (178d5b6b-d4f3-4246-bc8c-76a2e8fc2e4b)
 *    Subdomain : academia-helm
 *
 * Scope STRICT :
 *   - Niveau SECONDAIRE uniquement (7 classes : 6e, 5e, 4e, 3e, 1ère C,
 *     Seconde A1, Terminale D)
 *   - Maternelle, primaire et autres tenants NON touchés.
 *
 * Processus suivi (aligné avec l'onglet Évaluations + l'onglet Paramètres) :
 *   - Types d'évaluation depuis evaluation_types : INT1, INT2, DS1, DS2
 *     (pas de EC, pas de EP — spécifique au secondaire).
 *   - 8 matières sélectionnées parmi les 13 matières FR du niveau secondaire
 *     (tronc commun, sans options/spécialités) :
 *       1. Français (FR-04)
 *       2. Mathématiques (MATH-07)
 *       3. Histoire-Géographie (HG-11)
 *       4. Anglais (ANG-03)
 *       5. Éducation Physique et Sportive (EPS-13)
 *       6. Science de la Vie et de la Terre (SVT-09)
 *       7. Physique Chimie et Technologie (PCT-08)
 *       8. Communication Écrite (CE-01)
 *     (Exclues : Allemand, Espagnol, Informatique, Lecture, Philosophie —
 *      options/spécialités non universelles.)
 *   - Filtre : subjects.schoolLevelId = SECONDAIRE AND language='FR' OR NULL.
 *   - Pour chaque classe × trimestre × type : 1 évaluation par matière (8 au total).
 *   - Date d'évaluation uniforme par groupe (period.startDate).
 *   - 3 trimestres × 4 types = 12 groupes par classe × 8 matières = 96 évals/classe.
 *
 * Notes quantitatives /20 (règle secondaire — pas de CM/CP) :
 *   - Random 6-18 (évite trop de mauvaises notes pour avoir un échantillon
 *     réaliste et tester les moyennes).
 *   - 5% absentéisme (score null, isAbsent true).
 *   - Status VALIDATED pour toutes les évaluations.
 *
 * Cas particulier : classes sans élèves (5e, 4e, 3e, 1ère C, Seconde A1,
 * Terminale D) — on crée quand même les évaluations (sans grades) pour
 * qu'elles soient visibles dans l'onglet Évaluations et qu'on puisse tester
 * le flux de saisie. La classe 6e (3 élèves) aura des grades.
 *
 * Idempotent : ne crée que ce qui manque.
 * ============================================================================
 */
import pg from 'pg';
import crypto from 'crypto';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const TENANT_ID = '178d5b6b-d4f3-4246-bc8c-76a2e8fc2e4b'; // ⭐ ACADEMIA HELM
const SECONDAIRE_LEVEL_ID = 'c40ca12e-463c-4bfb-94de-466e897e5962';

const EVAL_TYPES_TO_SEED = ['INT1', 'INT2', 'DS1', 'DS2'];

// 8 matières tronc commun (codes correspondants dans la DB Academia Helm)
const SUBJECT_CODES_TRONC_COMMUN = [
  'FR-04',       // Français
  'MATH-07',     // Mathématiques
  'HG-11',       // Histoire-Géographie
  'ANG-03',      // Anglais
  'EPS-13',      // Éducation Physique et Sportive
  'SVT-09',      // Science de la Vie et de la Terre
  'PCT-08',      // Physique Chimie et Technologie
  'CE-01',       // Communication Écrite
];

function randomScore(min = 6, max = 18) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected to Neon DB\n');

  // ── VÉRIFICATION DE SÉCURITÉ ──────────────────────────────────────────
  console.log('═'.repeat(80));
  console.log('VÉRIFICATION DE SÉCURITÉ — tenant cible');
  console.log('═'.repeat(80));
  const check = await client.query(`SELECT name, subdomain FROM tenants WHERE id = $1`, [TENANT_ID]);
  if (check.rows.length === 0 || check.rows[0].subdomain !== 'academia-helm') {
    console.error('❌ MAUVAIS TENANT ! ABORT');
    process.exit(1);
  }
  console.log(`✓ Tenant : ${check.rows[0].name} (subdomain=${check.rows[0].subdomain})\n`);

  // ── Année académique active ──────────────────────────────────────────
  const activeYear = await client.query(`
    SELECT id, label FROM academic_years
     WHERE "tenantId" = $1 AND "isActive" = true
     ORDER BY "startDate" DESC LIMIT 1
  `, [TENANT_ID]);
  const ACADEMIC_YEAR_ID = activeYear.rows[0].id;
  console.log(`✓ Année active : ${activeYear.rows[0].label} (id=${ACADEMIC_YEAR_ID.substring(0,8)})\n`);

  // ── STEP 1: Types d'évaluation secondaire ────────────────────────────
  console.log('━'.repeat(80));
  console.log('STEP 1: Types d\'évaluation secondaire');
  console.log('━'.repeat(80));
  const evalTypes = await client.query(`
    SELECT id, code, name, "defaultMaxScore", "defaultCoefficient"
      FROM evaluation_types
     WHERE "tenantId" = $1 AND "schoolLevelId" = $2
       AND code = ANY($3::text[])
     ORDER BY code
  `, [TENANT_ID, SECONDAIRE_LEVEL_ID, EVAL_TYPES_TO_SEED]);
  console.log(`  Types trouvés : ${evalTypes.rows.length}`);
  evalTypes.rows.forEach(t => console.log(`    • ${t.code} — ${t.name} (id=${t.id.substring(0,8)}, max=${t.defaultMaxScore}, coef=${t.defaultCoefficient})`));
  console.log();

  // ── STEP 2: Périodes + quarters ─────────────────────────────────────
  console.log('━'.repeat(80));
  console.log('STEP 2: Périodes (trimestres) + quarters');
  console.log('━'.repeat(80));
  const periods = await client.query(`
    SELECT id, name, "startDate", "endDate"
      FROM academic_periods WHERE "academicYearId" = $1 ORDER BY "startDate"
  `, [ACADEMIC_YEAR_ID]);
  periods.rows.forEach(p => console.log(`  • ${p.name} (${p.startDate.toISOString().substring(0,10)} → ${p.endDate.toISOString().substring(0,10)})`));

  const periodToQuarter = new Map();
  for (const p of periods.rows) {
    const num = parseInt((p.name.match(/(\d)/) || [])[1] || '0', 10);
    if (!num) continue;
    const qRes = await client.query(`
      SELECT id FROM quarters
       WHERE "tenantId" = $1 AND "academicYearId" = $2 AND number = $3
       ORDER BY "createdAt" ASC LIMIT 1
    `, [TENANT_ID, ACADEMIC_YEAR_ID, num]);
    if (qRes.rows.length > 0) {
      periodToQuarter.set(p.id, qRes.rows[0].id);
      console.log(`  Mapping: ${p.name} → Q${num} (${qRes.rows[0].id.substring(0,8)})`);
    }
  }
  console.log();

  // ── STEP 3: 8 matières tronc commun ──────────────────────────────────
  console.log('━'.repeat(80));
  console.log('STEP 3: 8 matières tronc commun secondaire');
  console.log('━'.repeat(80));
  const subjects = await client.query(`
    SELECT id, name, code, coefficient, language
      FROM subjects
     WHERE "tenantId" = $1 AND "schoolLevelId" = $2
       AND (language = 'FR' OR language IS NULL)
       AND code = ANY($3::text[])
     ORDER BY name
  `, [TENANT_ID, SECONDAIRE_LEVEL_ID, SUBJECT_CODES_TRONC_COMMUN]);
  console.log(`  ${subjects.rows.length} matières tronc commun trouvées`);
  subjects.rows.forEach(s => console.log(`    • ${s.name} (${s.code}, coef=${s.coefficient})`));
  if (subjects.rows.length !== 8) {
    console.log(`  ⚠️ Attendu 8 matières — trouvé ${subjects.rows.length}`);
  }
  console.log();

  // ── STEP 4: Classes secondaires + élèves + teacher ──────────────────
  console.log('━'.repeat(80));
  console.log('STEP 4: Classes secondaires + élèves + teacher');
  console.log('━'.repeat(80));
  const classes = await client.query(`
    SELECT id, name, "officialClassId" FROM classes
     WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "schoolLevelId" = $3
     ORDER BY name
  `, [TENANT_ID, ACADEMIC_YEAR_ID, SECONDAIRE_LEVEL_ID]);
  console.log(`  ${classes.rows.length} classes secondaires\n`);

  // Trouver un teacher — fallback sur Blaise HELM (Professeur d'Anglais)
  // qui a la double casquette et peut servir pour le secondaire
  const teacherQ = await client.query(`
    SELECT id, "firstName", "lastName", position FROM staff
     WHERE "tenantId" = $1 AND position ILIKE '%professeur%'
     LIMIT 1
  `, [TENANT_ID]);
  const teacherId = teacherQ.rows[0]?.id;
  console.log(`  Teacher : ${teacherQ.rows[0]?.firstName} ${teacherQ.rows[0]?.lastName} (${teacherId?.substring(0,8)})\n`);

  let totalEvalsCreated = 0;
  let totalEvalsSkipped = 0;
  let totalGradesCreated = 0;

  // ── STEP 5: Boucle de création ──────────────────────────────────────
  for (const cls of classes.rows) {
    console.log('═'.repeat(80));
    console.log(`Classe : ${cls.name} (id=${cls.id.substring(0,8)})`);
    console.log('═'.repeat(80));

    // Élèves inscrits
    const students = await client.query(`
      SELECT s.id, s."firstName", s."lastName"
        FROM student_enrollments se
        JOIN students s ON s.id = se."studentId"
       WHERE se."classId" = $1 AND se."academicYearId" = $2 AND se.status = 'ACTIVE'
       ORDER BY s."firstName"
    `, [cls.id, ACADEMIC_YEAR_ID]);
    console.log(`  Élèves inscrits : ${students.rows.length}`);

    let classEvalsCreated = 0;
    let classEvalsSkipped = 0;
    let classGradesCreated = 0;

    for (const period of periods.rows) {
      const quarterId = periodToQuarter.get(period.id);
      if (!quarterId) {
        console.log(`  ⚠️ Pas de quarter pour ${period.name} — SKIP`);
        continue;
      }

      for (const evalType of evalTypes.rows) {
        console.log(`  ── ${period.name} | ${evalType.code} ──`);

        // Date uniforme pour tout le groupe
        const uniformEvalDate = period.startDate;

        for (const subject of subjects.rows) {
          // Vérifier si l'évaluation existe déjà
          const existing = await client.query(`
            SELECT id FROM evaluations
             WHERE "classId" = $1 AND "periodId" = $2 AND "evaluationTypeId" = $3
               AND "subjectId" = $4 AND "tenantId" = $5 AND "academicYearId" = $6
          `, [cls.id, period.id, evalType.id, subject.id, TENANT_ID, ACADEMIC_YEAR_ID]);

          let evalId;
          if (existing.rows.length > 0) {
            evalId = existing.rows[0].id;
            classEvalsSkipped++;
            // Vérifier les grades
            const existingGrades = await client.query(`
              SELECT COUNT(*)::int AS cnt FROM grades WHERE "evaluationId" = $1
            `, [evalId]);
            if (existingGrades.rows[0].cnt > 0) continue;
          } else {
            // Créer l'évaluation
            evalId = crypto.randomUUID();
            const title = `${evalType.name} - ${subject.name} - ${period.name}`;
            const coef = subject.coefficient || evalType.defaultCoefficient || 1;
            const maxScore = evalType.defaultMaxScore || 20;

            await client.query(`
              INSERT INTO evaluations (
                id, "tenantId", "academicYearId", "classId", "subjectId",
                "periodId", "evaluationTypeId", title, "evaluationDate",
                "maxScore", coefficient, "teacherId", status, "validatedAt", "createdAt", "updatedAt"
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'VALIDATED', NOW(), NOW(), NOW())
            `, [evalId, TENANT_ID, ACADEMIC_YEAR_ID, cls.id, subject.id,
                 period.id, evalType.id, title, uniformEvalDate, maxScore, coef, teacherId]);
            classEvalsCreated++;
          }

          // Créer les grades quantitatifs /20 pour chaque élève
          // (seulement si la classe a des élèves)
          if (students.rows.length > 0) {
            const created = await bulkCreateSecondaireGrades(client, {
              evalId,
              students: students.rows,
              subjectId: subject.id,
              quarterId,
              classId: cls.id,
              coefficient: subject.coefficient || 1,
              maxScore: evalType.defaultMaxScore || 20,
              academicYearId: ACADEMIC_YEAR_ID,
            });
            classGradesCreated += created;
          }
        }
      }
    }

    console.log(`  ✓ ${cls.name} : ${classEvalsCreated} évals créées, ${classEvalsSkipped} skippées, ${classGradesCreated} grades créés\n`);
    totalEvalsCreated += classEvalsCreated;
    totalEvalsSkipped += classEvalsSkipped;
    totalGradesCreated += classGradesCreated;
  }

  // ── STEP 6: Stats finales ────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80));
  console.log('SEED SECONDAIRE TERMINÉ (Academia Helm)');
  console.log('═'.repeat(80));
  console.log(`  Total évaluations créées : ${totalEvalsCreated}`);
  console.log(`  Total évaluations skippées : ${totalEvalsSkipped}`);
  console.log(`  Total grades créés : ${totalGradesCreated}`);

  // Vérification par classe × trimestre × type
  console.log('\nVérification par classe × trimestre × type :');
  const coverage = await client.query(`
    SELECT c.name AS class_name, ap.name AS period_name, et.code AS eval_type,
           COUNT(*)::int AS eval_count, COUNT(g.id)::int AS grade_count
      FROM evaluations e
      JOIN classes c ON c.id = e."classId"
      JOIN evaluation_types et ON et.id = e."evaluationTypeId"
      LEFT JOIN academic_periods ap ON ap.id = e."periodId"
      LEFT JOIN grades g ON g."evaluationId" = e.id
     WHERE e."tenantId" = $1 AND e."academicYearId" = $2
       AND c."schoolLevelId" = $3
     GROUP BY c.name, ap.name, et.code
     ORDER BY c.name, ap.name, et.code
  `, [TENANT_ID, ACADEMIC_YEAR_ID, SECONDAIRE_LEVEL_ID]);

  const byClassPeriod = new Map();
  for (const r of coverage.rows) {
    const k = `${r.class_name} | ${r.period_name}`;
    if (!byClassPeriod.has(k)) byClassPeriod.set(k, {});
    byClassPeriod.get(k)[r.eval_type] = { evals: r.eval_count, grades: r.grade_count };
  }
  for (const [k, types] of byClassPeriod) {
    const summary = Object.entries(types).map(([t, d]) => `${t}:${d.evals}évals/${d.grades}g`).join(' | ');
    console.log(`  ${k} → ${summary}`);
  }

  // Distribution des notes
  console.log('\nDistribution des notes secondaire :');
  const dist = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE "isAbsent" = true)::int AS absent,
      COUNT(*) FILTER (WHERE "isAbsent" = false AND score >= 16)::int AS tres_bien,
      COUNT(*) FILTER (WHERE "isAbsent" = false AND score >= 14 AND score < 16)::int AS bien,
      COUNT(*) FILTER (WHERE "isAbsent" = false AND score >= 12 AND score < 14)::int AS assez_bien,
      COUNT(*) FILTER (WHERE "isAbsent" = false AND score >= 10 AND score < 12)::int AS passable,
      COUNT(*) FILTER (WHERE "isAbsent" = false AND score < 10)::int AS insufficient,
      AVG(score) FILTER (WHERE "isAbsent" = false)::float AS avg_score
      FROM grades g
      JOIN evaluations e ON e.id = g."evaluationId"
     WHERE g."tenantId" = $1 AND e."academicYearId" = $2
       AND e."classId" IN (SELECT id FROM classes WHERE "schoolLevelId" = $3)
  `, [TENANT_ID, ACADEMIC_YEAR_ID, SECONDAIRE_LEVEL_ID]);
  const d = dist.rows[0];
  console.log(`  • Très Bien (≥16) : ${d.tres_bien}`);
  console.log(`  • Bien (14-15.99) : ${d.bien}`);
  console.log(`  • Assez Bien (12-13.99) : ${d.assez_bien}`);
  console.log(`  • Passable (10-11.99) : ${d.passable}`);
  console.log(`  • Insuffisant (<10) : ${d.insufficient}`);
  console.log(`  • Absents : ${d.absent}`);
  console.log(`  • Moyenne générale : ${d.avg_score ? d.avg_score.toFixed(2) : 'N/A'} / 20`);

  await client.end();
  console.log('\n✅ Seed secondaire terminé pour Academia Helm');
}

async function bulkCreateSecondaireGrades(client, { evalId, students, subjectId, quarterId, classId, coefficient, maxScore, academicYearId }) {
  if (students.length === 0) return 0;
  const values = [];
  const params = [];
  let paramIdx = 1;

  for (const student of students) {
    const isAbsent = Math.random() < 0.05; // 5% absentéisme
    const score = isAbsent ? null : randomScore(6, 18);
    // grades columns : id, tenantId, academicYearId, schoolLevelId, academicTrackId, language,
    //                  studentId, subjectId, examId, score, maxScore, coefficient,
    //                  createdAt, updatedAt, classId, comment, evaluationId, isAbsent,
    //                  periodId, qualitativeCode, status, gradeComponent
    values.push(`(gen_random_uuid(), $${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, NULL, NULL, $${paramIdx+3}, $${paramIdx+4}, NULL, $${paramIdx+5}, $${paramIdx+6}, $${paramIdx+7}, NOW(), NOW(), $${paramIdx+8}, NULL, $${paramIdx+9}, $${paramIdx+10}, $${paramIdx+11}, NULL, 'VALIDATED', NULL)`);
    params.push(
      TENANT_ID,                  // 1 — tenantId
      academicYearId,             // 2 — academicYearId
      SECONDAIRE_LEVEL_ID,        // 3 — schoolLevelId
      student.id,                 // 4 — studentId
      subjectId,                  // 5 — subjectId
      score,                      // 6 — score /20
      maxScore,                   // 7 — maxScore (20)
      coefficient,                // 8 — coefficient
      classId,                    // 9 — classId
      evalId,                     // 10 — evaluationId
      isAbsent,                   // 11 — isAbsent
      quarterId                   // 12 — periodId
    );
    paramIdx += 12;
  }

  const query = `
    INSERT INTO grades (
      id, "tenantId", "academicYearId", "schoolLevelId", "academicTrackId", "language",
      "studentId", "subjectId", "examId", score, "maxScore", coefficient,
      "createdAt", "updatedAt", "classId", comment, "evaluationId", "isAbsent",
      "periodId", "qualitativeCode", status, "gradeComponent"
    ) VALUES ${values.join(', ')}
  `;
  try {
    const r = await client.query(query, params);
    return r.rowCount;
  } catch (err) {
    console.error(`  ❌ Grade bulk insert failed for eval ${evalId.substring(0,8)}:`, err.message);
    return 0;
  }
}

main().catch(err => {
  console.error('❌ FATAL:', err);
  console.error(err.stack);
  process.exit(1);
});
