/**
 * ============================================================================
 * RE-SEED PRIMAIRE + MATERNELLE — avec dates uniformes par groupe
 * ============================================================================
 *
 * Problème :
 *   Le seed précédent créait des évaluations avec des dates aléatoires pour
 *   chaque matière. Le registre (apps/web-app/src/app/app/exams/registre/page.tsx)
 *   groupe les évaluations par (classId × evaluationTypeId × periodId × startDate × endDate).
 *   Avec des dates aléatoires, chaque matière était dans un groupe séparé →
 *   l'utilisateur voyait 9 groupes "EC" au lieu d'un seul groupe "EC" avec
 *   9 matières dedans → impression de fragmentation.
 *
 * Solution :
 *   1. Supprimer toutes les évaluations + grades existants pour primaire + maternelle.
 *   2. Recréer en utilisant une date UNIFORME pour toutes les évaluations d'un
 *      même groupe (classId × evalTypeId × periodId) — par exemple la date de
 *      début de la période.
 *   3. Suivre rigoureusement le pattern de création d'évaluation :
 *      - Pour chaque classe × chaque type d'évaluation × chaque trimestre :
 *        créer UNE évaluation par matière (9 matières FR par classe).
 *      - Pour T3 uniquement : ajouter EP (Évaluation de passage) × 9 matières.
 *   4. Filtre strict FR : ne prendre que les matières avec language='FR' OR
 *      language IS NULL. Aucune matière anglophone.
 *
 * Attendu après re-seed :
 *   Pour chaque classe × trimestre × type d'évaluation : 1 groupe avec 9 matières
 *   dedans (au lieu de 9 groupes avec 1 matière).
 * ============================================================================
 */
import pg from 'pg';
import crypto from 'crypto';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const ACADEMIC_YEAR_ID = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';
const EVAL_TYPE_CODES = ['EM1', 'EM2', 'EC', 'EP'];

function randomScore(min = 7, max = 18) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomQualitative() {
  const r = Math.random();
  if (r < 0.40) return 'TS';
  if (r < 0.85) return 'S';
  return 'PS';
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected to Neon DB\n');

  // ════════════════════════════════════════════════════════════════════
  // STEP 1: Supprimer toutes les évaluations + grades pour PRIMAIRE + MATERNELLE
  // ════════════════════════════════════════════════════════════════════
  console.log('━'.repeat(80));
  console.log('STEP 1: Supprimer toutes les évaluations + grades pour PRIMAIRE + MATERNELLE');
  console.log('━'.repeat(80));

  // Trouver toutes les évaluations des classes primaire + maternelle
  const evalsToDelete = await client.query(`
    SELECT e.id FROM evaluations e
      JOIN classes c ON c.id = e."classId"
      JOIN school_levels sl ON sl.id = c."schoolLevelId"
     WHERE e."tenantId" = $1 AND e."academicYearId" = $2
       AND sl.code IN ('PRIMAIRE', 'MATERNELLE')
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  Évaluations à supprimer : ${evalsToDelete.rows.length}`);

  if (evalsToDelete.rows.length > 0) {
    const evalIds = evalsToDelete.rows.map(r => r.id);
    // Supprimer les grades liés
    const gradesDeleted = await client.query(
      `DELETE FROM grades WHERE "evaluationId" = ANY($1::text[]) RETURNING id`,
      [evalIds]
    );
    console.log(`  Grades supprimés : ${gradesDeleted.rowCount}`);

    // Supprimer les évaluations
    const evalsDeleted = await client.query(
      `DELETE FROM evaluations WHERE id = ANY($1::text[]) RETURNING id`,
      [evalIds]
    );
    console.log(`  Évaluations supprimées : ${evalsDeleted.rowCount}`);
  }
  console.log();

  // ════════════════════════════════════════════════════════════════════
  // STEP 2: Périodes (trimestres) + mapping vers quarters
  // ════════════════════════════════════════════════════════════════════
  console.log('━'.repeat(80));
  console.log('STEP 2: Récupérer les périodes + quarters');
  console.log('━'.repeat(80));

  const periods = await client.query(
    `SELECT id, name, "startDate", "endDate" FROM academic_periods
      WHERE "academicYearId" = $1 ORDER BY "startDate"`,
    [ACADEMIC_YEAR_ID]
  );
  console.log(`Périodes: ${periods.rows.length}`);

  const periodToQuarter = new Map();
  for (const p of periods.rows) {
    const qRes = await client.query(
      `SELECT id FROM quarters
        WHERE "academicYearId" = $1 AND "tenantId" = $2
          AND (($3 ILIKE '%trimestre 1%' AND number = 1)
            OR ($3 ILIKE '%trimestre 2%' AND number = 2)
            OR ($3 ILIKE '%trimestre 3%' AND number = 3))
       ORDER BY "createdAt" ASC LIMIT 1`,
      [ACADEMIC_YEAR_ID, TENANT_ID, p.name]
    );
    if (qRes.rows.length > 0) {
      periodToQuarter.set(p.id, qRes.rows[0].id);
      console.log(`  ${p.name} → quarter ${qRes.rows[0].id.substring(0,8)} | startDate=${p.startDate.toISOString().substring(0,10)}`);
    }
  }
  console.log();

  // ════════════════════════════════════════════════════════════════════
  // STEP 3: Pour chaque niveau (PRIMAIRE, MATERNELLE), traiter toutes les classes
  // ════════════════════════════════════════════════════════════════════
  const levels = await client.query(`
    SELECT id, code, name FROM school_levels
     WHERE "tenantId" = $1 AND code IN ('PRIMAIRE', 'MATERNELLE')
     ORDER BY code
  `, [TENANT_ID]);

  let totalEvalsCreated = 0;
  let totalGradesCreated = 0;

  for (const level of levels.rows) {
    console.log('\n' + '═'.repeat(80));
    console.log(`NIVEAU : ${level.code} — ${level.name}`);
    console.log('═'.repeat(80));

    const isMaternelle = level.code === 'MATERNELLE';

    const evalTypes = await client.query(
      `SELECT id, code, name, "defaultMaxScore", "defaultCoefficient"
         FROM evaluation_types
        WHERE "tenantId" = $1 AND "schoolLevelId" = $2
          AND code = ANY($3::text[])
        ORDER BY code`,
      [TENANT_ID, level.id, EVAL_TYPE_CODES]
    );
    console.log(`Types d'évaluation : ${evalTypes.rows.length}`);

    // ⭐ Récupérer les matières FR du niveau (pas par class_subjects — par subjects)
    //    C'est exactement ce que fait l'application frontend via pedagogyService.getSubjects
    //    + filter matchesLevelLanguage(scopeLang='FR') → prend FR + NULL
    const subjects = await client.query(`
      SELECT id, name, code, coefficient, language
        FROM subjects
       WHERE "tenantId" = $1 AND "schoolLevelId" = $2
         AND (language = 'FR' OR language IS NULL)
       ORDER BY name
    `, [TENANT_ID, level.id]);
    console.log(`Matières FR/NULL pour ce niveau : ${subjects.rows.length}`);
    subjects.rows.forEach(s => console.log(`  • ${s.name} (${s.code}, lang=${s.language || 'NULL'})`));

    if (subjects.rows.length === 0) {
      console.log('  ⚠️ Aucune matière FR — SKIP niveau');
      continue;
    }

    // Classes de ce niveau
    const classes = await client.query(
      `SELECT id, name, "officialClassId" FROM classes
        WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "schoolLevelId" = $3
        ORDER BY name`,
      [TENANT_ID, ACADEMIC_YEAR_ID, level.id]
    );
    console.log(`\nClasses : ${classes.rows.length}`);

    for (const cls of classes.rows) {
      console.log(`\n── Classe : ${cls.name} ──`);

      // Élèves inscrits
      const students = await client.query(
        `SELECT s.id FROM student_enrollments se
           JOIN students s ON s.id = se."studentId"
          WHERE se."classId" = $1 AND se."academicYearId" = $2 AND se.status = 'ACTIVE'`,
        [cls.id, ACADEMIC_YEAR_ID]
      );
      console.log(`  Élèves : ${students.rows.length}`);
      if (students.rows.length === 0) {
        console.log('  ⚠️ Aucun élève — SKIP classe');
        continue;
      }

      // Trouver un teacher
      let teacherId;
      const teacherQ = await client.query(
        `SELECT id FROM staff WHERE "tenantId" = $1 AND "schoolLevelId" = $2
          AND (position ILIKE '%enseignant%' OR "roleType" ILIKE '%TEACHER%') LIMIT 1`,
        [TENANT_ID, level.id]
      );
      if (teacherQ.rows.length > 0) teacherId = teacherQ.rows[0].id;
      else {
        const anyStaff = await client.query(`SELECT id FROM staff WHERE "tenantId" = $1 LIMIT 1`, [TENANT_ID]);
        teacherId = anyStaff.rows[0]?.id;
      }

      // Identifier le trimestre 3 (pour EP)
      const t3Period = periods.rows.find(p => /trimestre 3/i.test(p.name));

      let classEvalsCreated = 0;
      let classGradesCreated = 0;

      for (const period of periods.rows) {
        const quarterId = periodToQuarter.get(period.id);
        if (!quarterId) continue;
        const isT3 = t3Period && period.id === t3Period.id;

        for (const evalType of evalTypes.rows) {
          // EP uniquement pour T3
          if (evalType.code === 'EP' && !isT3) continue;

          // ⭐⭐⭐ FIX CLÉ : utiliser une date UNIFORME pour toutes les évaluations
          //    d'un même groupe (classId × evalTypeId × periodId).
          //    Le registre groupe par (classId × evalTypeId × periodId × startDate × endDate).
          //    Si on donne la même date à toutes les évaluations d'un même groupe,
          //    le registre affichera 1 seul groupe avec toutes les matières dedans.
          //
          //    On utilise la date de début de la période comme date d'évaluation
          //    (les évaluations sont censées avoir lieu pendant la période).
          const uniformEvalDate = period.startDate;

          for (const subject of subjects.rows) {
            // Vérifier si l'évaluation existe déjà
            const existing = await client.query(
              `SELECT id FROM evaluations
                WHERE "classId" = $1 AND "periodId" = $2 AND "evaluationTypeId" = $3
                  AND "subjectId" = $4 AND "tenantId" = $5 AND "academicYearId" = $6
                  AND "evaluationDate" = $7`,
              [cls.id, period.id, evalType.id, subject.id, TENANT_ID, ACADEMIC_YEAR_ID, uniformEvalDate]
            );

            let evalId;
            if (existing.rows.length > 0) {
              evalId = existing.rows[0].id;
              // Vérifier les grades
              const existingGrades = await client.query(
                `SELECT COUNT(*)::int AS cnt FROM grades WHERE "evaluationId" = $1`,
                [evalId]
              );
              if (existingGrades.rows[0].cnt > 0) continue;
            } else {
              evalId = crypto.randomUUID();
              const title = `${evalType.name} - ${subject.name} - ${period.name}`;
              const coef = evalType.code === 'EC' ? 2 : (subject.coefficient || evalType.defaultCoefficient || 1);
              const maxScore = evalType.defaultMaxScore || 20;

              await client.query(
                `INSERT INTO evaluations (
                  id, "tenantId", "academicYearId", "classId", "subjectId",
                  "periodId", "evaluationTypeId", title, "evaluationDate",
                  "maxScore", coefficient, "teacherId", status, "validatedAt", "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'VALIDATED', NOW(), NOW(), NOW())`,
                [evalId, TENANT_ID, ACADEMIC_YEAR_ID, cls.id, subject.id,
                 period.id, evalType.id, title, uniformEvalDate, maxScore, coef, teacherId]
              );
              classEvalsCreated++;
            }

            // Créer les grades
            const created = await bulkCreateGrades(client, {
              evalId,
              students: students.rows,
              subjectId: subject.id,
              quarterId,
              classId: cls.id,
              levelId: level.id,
              coefficient: evalType.code === 'EC' ? 2 : (subject.coefficient || 1),
              maxScore: evalType.defaultMaxScore || 20,
              isMaternelle,
            });
            classGradesCreated += created;
          }
        }
      }

      console.log(`  ✓ ${cls.name} : ${classEvalsCreated} évals créées, ${classGradesCreated} grades créés`);
      totalEvalsCreated += classEvalsCreated;
      totalGradesCreated += classGradesCreated;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // STEP 4: Stats finales
  // ════════════════════════════════════════════════════════════════════
  console.log('\n\n' + '═'.repeat(80));
  console.log('RE-SEED TERMINÉ');
  console.log('═'.repeat(80));
  console.log(`  Total évaluations créées : ${totalEvalsCreated}`);
  console.log(`  Total grades créés : ${totalGradesCreated}`);

  // Vérifier la couverture : pour chaque classe × trimestre × type,
  // il ne doit y avoir qu'1 seul groupe (1 date unique).
  console.log('\nVérification — groupes par classe × trimestre × type :');
  const groups = await client.query(`
    SELECT sl.code AS level_code, c.name AS class_name, ap.name AS period_name,
           et.code AS eval_type, e."evaluationDate"::date AS eval_date,
           COUNT(*)::int AS eval_count
      FROM evaluations e
      JOIN classes c ON c.id = e."classId"
      JOIN school_levels sl ON sl.id = c."schoolLevelId"
      JOIN evaluation_types et ON et.id = e."evaluationTypeId"
      LEFT JOIN academic_periods ap ON ap.id = e."periodId"
     WHERE e."tenantId" = $1 AND e."academicYearId" = $2
       AND sl.code IN ('PRIMAIRE', 'MATERNELLE')
     GROUP BY sl.code, c.name, ap.name, et.code, e."evaluationDate"
     ORDER BY sl.code, c.name, ap.name, et.code, e."evaluationDate"
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  const byClassPeriod = new Map();
  for (const r of groups.rows) {
    const k = `${r.level_code} ${r.class_name} | ${r.period_name}`;
    if (!byClassPeriod.has(k)) byClassPeriod.set(k, new Map());
    const m = byClassPeriod.get(k);
    if (!m.has(r.eval_type)) m.set(r.eval_type, { groups: 0, totalEvals: 0 });
    m.get(r.eval_type).groups++;
    m.get(r.eval_type).totalEvals += r.eval_count;
  }
  for (const [k, types] of byClassPeriod) {
    console.log(`\n  ── ${k} ──`);
    for (const [t, d] of types) {
      const status = d.groups === 1 ? '✓' : '❌';
      console.log(`    ${status} ${t} : ${d.groups} groupe(s) avec ${d.totalEvals} évals total`);
    }
  }

  await client.end();
  console.log('\n✅ Re-seed terminé');
}

async function bulkCreateGrades(client, { evalId, students, subjectId, quarterId, classId, levelId, coefficient, maxScore, isMaternelle }) {
  if (students.length === 0) return 0;
  const values = [];
  const params = [];
  let paramIdx = 1;
  for (const student of students) {
    const isAbsent = Math.random() < 0.05;
    if (isMaternelle) {
      const qualitativeCode = isAbsent ? null : randomQualitative();
      // grades columns : id, tenantId, academicYearId, schoolLevelId, academicTrackId, language,
      //                  studentId, subjectId, examId, score, maxScore, coefficient,
      //                  createdAt, updatedAt, classId, comment, evaluationId, isAbsent,
      //                  periodId, qualitativeCode, status, gradeComponent
      values.push(`(gen_random_uuid(), $${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, NULL, NULL, $${paramIdx+3}, $${paramIdx+4}, NULL, NULL, $${paramIdx+5}, $${paramIdx+6}, NOW(), NOW(), $${paramIdx+7}, NULL, $${paramIdx+8}, $${paramIdx+9}, $${paramIdx+10}, $${paramIdx+11}, 'VALIDATED', NULL)`);
      params.push(
        TENANT_ID, ACADEMIC_YEAR_ID, levelId,
        student.id, subjectId, maxScore, coefficient,
        classId, evalId, isAbsent, quarterId, qualitativeCode
      );
      paramIdx += 12;
    } else {
      const score = isAbsent ? null : randomScore(7, 18);
      values.push(`(gen_random_uuid(), $${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, NULL, NULL, $${paramIdx+3}, $${paramIdx+4}, NULL, $${paramIdx+5}, $${paramIdx+6}, $${paramIdx+7}, NOW(), NOW(), $${paramIdx+8}, NULL, $${paramIdx+9}, $${paramIdx+10}, $${paramIdx+11}, NULL, 'VALIDATED', NULL)`);
      params.push(
        TENANT_ID, ACADEMIC_YEAR_ID, levelId,
        student.id, subjectId, score, maxScore, coefficient,
        classId, evalId, isAbsent, quarterId
      );
      paramIdx += 12;
    }
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
