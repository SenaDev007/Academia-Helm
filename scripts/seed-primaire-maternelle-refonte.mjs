/**
 * ============================================================================
 * SEED PRIMAIRE + MATERNELLE — Refonte complète
 * ============================================================================
 *
 * Tenant : 59b8c348 (Academia Helm)
 * Année : 2026-2027
 *
 * Objectifs :
 *   1. Pour chaque classe PRIMAIRE (CI, CP, CE1, CE2, CM1, CM2) :
 *      - Pour chaque trimestre (T1, T2, T3) :
 *        • Créer EM1 (Évaluation mensuelle 1) × 9 matières FR — 9 évaluations
 *        • Créer EM2 (Évaluation mensuelle 2) × 9 matières FR — 9 évaluations
 *        • Créer EC  (Évaluation certificative) × 9 matières FR — 9 évaluations
 *          ⭐ SCISION IDENTIQUE à EM1/EM2 (1 eval par matière, pas 2 evals globales)
 *      - Pour T3 uniquement : ajouter EP (Évaluation de passage) × 9 matières FR
 *      - Total par classe : 3 trimestres × 27 evals (EM1+EM2+EC) + 9 EP (T3) = 90 evals
 *      - Grades numériques /20 (random 7-18), 5% absentéisme
 *
 *   2. Pour chaque classe MATERNELLE (Maternelle 1, Maternelle 2) :
 *      - Même pattern : EM1, EM2, EC × 9 matières × 3 trimestres + EP × 9 matières (T3)
 *      - Grades qualitatifs TS/S/PS (pas de note numérique)
 *
 *   3. Filter strictement sur matières FR (lang=FR OR lang IS NULL).
 *      ⭐ AUCUNE matière anglophone ne doit être introduite.
 *
 * Idempotent : ne crée que ce qui manque. Ne supprime rien.
 * ============================================================================
 */
import pg from 'pg';
import crypto from 'crypto';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const ACADEMIC_YEAR_ID = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';

// Types d'évaluation à seedder, par ordre de scission
const EVAL_TYPE_CODES = ['EM1', 'EM2', 'EC', 'EP'];

function randomScore(min = 7, max = 18) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomQualitative() {
  // TS=40%, S=45%, PS=15%
  const r = Math.random();
  if (r < 0.40) return 'TS';
  if (r < 0.85) return 'S';
  return 'PS';
}

function randomDateInPeriod(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s));
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected to Neon DB\n');

  // ════════════════════════════════════════════════════════════════════
  // STEP 1: Périodes (trimestres) + mapping vers quarters
  // ════════════════════════════════════════════════════════════════════
  const periods = await client.query(
    `SELECT id, name, "startDate", "endDate" FROM academic_periods
      WHERE "academicYearId" = $1 ORDER BY "startDate"`,
    [ACADEMIC_YEAR_ID]
  );
  console.log(`Périodes: ${periods.rows.length}`);
  periods.rows.forEach(p => console.log(`  • ${p.name} (${p.startDate.toISOString().substring(0,10)} → ${p.endDate.toISOString().substring(0,10)})`));

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
    }
  }
  console.log();

  // ════════════════════════════════════════════════════════════════════
  // STEP 2: Pour chaque niveau (PRIMAIRE, MATERNELLE), traiter toutes les classes
  // ════════════════════════════════════════════════════════════════════
  const levels = await client.query(`
    SELECT id, code, name FROM school_levels
     WHERE "tenantId" = $1 AND code IN ('PRIMAIRE', 'MATERNELLE')
     ORDER BY code
  `, [TENANT_ID]);

  let totalEvalsCreated = 0;
  let totalEvalsSkipped = 0;
  let totalGradesCreated = 0;

  for (const level of levels.rows) {
    console.log('\n' + '═'.repeat(80));
    console.log(`NIVEAU : ${level.code} — ${level.name} (id=${level.id.substring(0,8)})`);
    console.log('═'.repeat(80));

    const isMaternelle = level.code === 'MATERNELLE';

    // Types d'évaluation pour ce niveau
    const evalTypes = await client.query(
      `SELECT id, code, name, "defaultMaxScore", "defaultCoefficient"
         FROM evaluation_types
        WHERE "tenantId" = $1 AND "schoolLevelId" = $2
          AND code = ANY($3::text[])
        ORDER BY code`,
      [TENANT_ID, level.id, EVAL_TYPE_CODES]
    );
    console.log(`Types d'évaluation : ${evalTypes.rows.length}`);
    evalTypes.rows.forEach(t => console.log(`  • ${t.code} — ${t.name} (max=${t.defaultMaxScore}, coef=${t.defaultCoefficient})`));

    // Classes de ce niveau
    const classes = await client.query(
      `SELECT id, name, "officialClassId" FROM classes
        WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "schoolLevelId" = $3
        ORDER BY name`,
      [TENANT_ID, ACADEMIC_YEAR_ID, level.id]
    );
    console.log(`\nClasses ${level.code} : ${classes.rows.length}`);
    classes.rows.forEach(c => console.log(`  • ${c.name} (id=${c.id.substring(0,8)}, officialId=${c.officialClassId.substring(0,8)})`));

    for (const cls of classes.rows) {
      console.log(`\n── Classe : ${cls.name} ──`);

      // Récupérer les matières FR rattachées à la classe (filter strict FR)
      const subjects = await client.query(`
        SELECT s.id, s.name, s.code, s.language, cs.coefficient
          FROM class_subjects cs
          JOIN subjects s ON s.id = cs."subjectId"
         WHERE cs."tenantId" = $1 AND cs."academicClassId" = $2
           AND (s.language = 'FR' OR s.language IS NULL)
         ORDER BY s.name
      `, [TENANT_ID, cls.officialClassId]);
      console.log(`  Matières FR : ${subjects.rows.length}`);
      if (subjects.rows.length === 0) {
        console.log('  ⚠️ Aucune matière FR — SKIP');
        continue;
      }

      // Élèves inscrits
      const students = await client.query(
        `SELECT s.id FROM student_enrollments se
           JOIN students s ON s.id = se."studentId"
          WHERE se."classId" = $1 AND se."academicYearId" = $2 AND se.status = 'ACTIVE'`,
        [cls.id, ACADEMIC_YEAR_ID]
      );
      console.log(`  Élèves inscrits : ${students.rows.length}`);
      if (students.rows.length === 0) {
        console.log('  ⚠️ Aucun élève — SKIP');
        continue;
      }

      // Trouver un teacher (fallback sur 1er staff du tenant)
      let teacherId;
      const teacherQ = await client.query(
        `SELECT id FROM staff WHERE "tenantId" = $1 AND "schoolLevelId" = $2
          AND (position ILIKE '%enseignant%' OR "roleType" ILIKE '%TEACHER%') LIMIT 1`,
        [TENANT_ID, level.id]
      );
      if (teacherQ.rows.length > 0) {
        teacherId = teacherQ.rows[0].id;
      } else {
        const anyStaff = await client.query(`SELECT id FROM staff WHERE "tenantId" = $1 LIMIT 1`, [TENANT_ID]);
        teacherId = anyStaff.rows[0]?.id;
      }
      console.log(`  Teacher : ${teacherId?.substring(0,8) || '—'}`);

      // Identifier le trimestre 3 (pour EP)
      const t3Period = periods.rows.find(p => /trimestre 3/i.test(p.name));

      let classEvalsCreated = 0;
      let classEvalsSkipped = 0;
      let classGradesCreated = 0;

      for (const period of periods.rows) {
        const quarterId = periodToQuarter.get(period.id);
        if (!quarterId) {
          console.log(`  ⚠️ Pas de quarter pour ${period.name} — SKIP`);
          continue;
        }
        const isT3 = t3Period && period.id === t3Period.id;

        for (const evalType of evalTypes.rows) {
          // ⭐ EP est créé UNIQUEMENT pour T3 (évaluation de passage — fin d'année)
          if (evalType.code === 'EP' && !isT3) continue;

          for (const subject of subjects.rows) {
            // Vérifier si l'évaluation existe déjà
            const existing = await client.query(
              `SELECT id FROM evaluations
                WHERE "classId" = $1 AND "periodId" = $2 AND "evaluationTypeId" = $3
                  AND "subjectId" = $4 AND "tenantId" = $5 AND "academicYearId" = $6`,
              [cls.id, period.id, evalType.id, subject.id, TENANT_ID, ACADEMIC_YEAR_ID]
            );

            let evalId;
            if (existing.rows.length > 0) {
              evalId = existing.rows[0].id;
              classEvalsSkipped++;
              // Vérifier les grades
              const existingGrades = await client.query(
                `SELECT COUNT(*)::int AS cnt FROM grades WHERE "evaluationId" = $1`,
                [evalId]
              );
              if (existingGrades.rows[0].cnt > 0) {
                // Déjà complet, on skip
                continue;
              }
            } else {
              // Créer l'évaluation
              evalId = crypto.randomUUID();
              const evaluationDate = randomDateInPeriod(period.startDate, period.endDate);
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
                 period.id, evalType.id, title, evaluationDate, maxScore, coef, teacherId]
              );
              classEvalsCreated++;
            }

            // Créer les grades pour chaque élève
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

      console.log(`  ✓ ${cls.name} : ${classEvalsCreated} évals créées, ${classEvalsSkipped} skippées, ${classGradesCreated} grades créés`);
      totalEvalsCreated += classEvalsCreated;
      totalEvalsSkipped += classEvalsSkipped;
      totalGradesCreated += classGradesCreated;
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // STEP 3: Stats finales
  // ════════════════════════════════════════════════════════════════════
  console.log('\n\n' + '═'.repeat(80));
  console.log('SEED TERMINÉ');
  console.log('═'.repeat(80));
  console.log(`  Total évaluations créées : ${totalEvalsCreated}`);
  console.log(`  Total évaluations skippées (existaient déjà) : ${totalEvalsSkipped}`);
  console.log(`  Total grades créés : ${totalGradesCreated}`);

  // Couverture par niveau × trimestre × type
  console.log('\nCouverture par niveau × trimestre × type :');
  const coverage = await client.query(`
    SELECT sl.code AS level_code, c.name AS class_name, ap.name AS period_name,
           et.code AS eval_type, COUNT(*)::int AS eval_count,
           COUNT(g.id)::int AS grade_count
      FROM evaluations e
      JOIN classes c ON c.id = e."classId"
      JOIN school_levels sl ON sl.id = c."schoolLevelId"
      LEFT JOIN evaluation_types et ON et.id = e."evaluationTypeId"
      LEFT JOIN academic_periods ap ON ap.id = e."periodId"
      LEFT JOIN grades g ON g."evaluationId" = e.id
     WHERE e."tenantId" = $1 AND e."academicYearId" = $2
       AND sl.code IN ('PRIMAIRE', 'MATERNELLE')
     GROUP BY sl.code, c.name, ap.name, et.code
     ORDER BY sl.code, c.name, ap.name, et.code
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);

  // Affichage condensé par classe
  const byClass = new Map();
  for (const r of coverage.rows) {
    const k = `${r.level_code} ${r.class_name}`;
    if (!byClass.has(k)) byClass.set(k, { periods: new Map() });
    if (!byClass.get(k).periods.has(r.period_name)) byClass.get(k).periods.set(r.period_name, {});
    byClass.get(k).periods.get(r.period_name)[r.eval_type] = { eval: r.eval_count, grades: r.grade_count };
  }
  for (const [cls, info] of byClass) {
    console.log(`\n── ${cls} ──`);
    for (const [period, types] of info.periods) {
      const summary = Object.entries(types).map(([t, d]) => `${t}:${d.eval}/${d.grades}`).join(' | ');
      console.log(`  ${period} → ${summary}`);
    }
  }

  await client.end();
}

async function bulkCreateGrades(client, { evalId, students, subjectId, quarterId, classId, levelId, coefficient, maxScore, isMaternelle }) {
  if (students.length === 0) return 0;
  const values = [];
  const params = [];
  let paramIdx = 1;
  for (const student of students) {
    const isAbsent = Math.random() < 0.05; // 5% absentéisme
    if (isMaternelle) {
      const qualitativeCode = isAbsent ? null : randomQualitative();
      // grades columns : id, tenantId, academicYearId, schoolLevelId, academicTrackId, language,
      //                  studentId, subjectId, examId, score, maxScore, coefficient,
      //                  createdAt, updatedAt, classId, comment, evaluationId, isAbsent,
      //                  periodId, qualitativeCode, status, gradeComponent
      values.push(`(gen_random_uuid(), $${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, NULL, NULL, $${paramIdx+3}, $${paramIdx+4}, NULL, NULL, $${paramIdx+5}, $${paramIdx+6}, NOW(), NOW(), $${paramIdx+7}, NULL, $${paramIdx+8}, $${paramIdx+9}, $${paramIdx+10}, $${paramIdx+11}, 'VALIDATED', NULL)`);
      params.push(
        TENANT_ID,           // 1 — tenantId
        ACADEMIC_YEAR_ID,    // 2 — academicYearId
        levelId,             // 3 — schoolLevelId
        student.id,          // 4 — studentId
        subjectId,           // 5 — subjectId
        maxScore,            // 6 — maxScore
        coefficient,         // 7 — coefficient
        classId,             // 8 — classId
        evalId,              // 9 — evaluationId
        isAbsent,            // 10 — isAbsent
        quarterId,           // 11 — periodId
        qualitativeCode     // 12 — qualitativeCode
      );
      paramIdx += 12;
    } else {
      const score = isAbsent ? null : randomScore(7, 18);
      values.push(`(gen_random_uuid(), $${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, NULL, NULL, $${paramIdx+3}, $${paramIdx+4}, NULL, $${paramIdx+5}, $${paramIdx+6}, $${paramIdx+7}, NOW(), NOW(), $${paramIdx+8}, NULL, $${paramIdx+9}, $${paramIdx+10}, $${paramIdx+11}, NULL, 'VALIDATED', NULL)`);
      params.push(
        TENANT_ID,           // 1 — tenantId
        ACADEMIC_YEAR_ID,    // 2 — academicYearId
        levelId,             // 3 — schoolLevelId
        student.id,          // 4 — studentId
        subjectId,           // 5 — subjectId
        score,               // 6 — score
        maxScore,            // 7 — maxScore
        coefficient,         // 8 — coefficient
        classId,             // 9 — classId
        evalId,              // 10 — evaluationId
        isAbsent,            // 11 — isAbsent
        quarterId            // 12 — periodId
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
