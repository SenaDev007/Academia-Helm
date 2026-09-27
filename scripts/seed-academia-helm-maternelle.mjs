/**
 * ============================================================================
 * SEED MATERNELLE — Academia Helm uniquement
 * ============================================================================
 *
 * ⚠️ Tenant cible : Academia Helm (178d5b6b-d4f3-4246-bc8c-76a2e8fc2e4b)
 *    Subdomain : academia-helm
 *
 * Scope STRICT :
 *   - Niveau MATERNELLE uniquement (Maternelle 1 + Maternelle 2)
 *   - Primaire et secondaire NON touchés
 *   - Autres tenants NON touchés
 *
 * Processus suivi (aligné avec l'onglet Évaluations + l'onglet Paramètres) :
 *   - Types d'évaluation depuis evaluation_types : EM1, EM2, EC (coef=1) + EP (coef=1).
 *   - Matières FR du niveau MATERNELLE (filtre : subjects.schoolLevelId = MATERNELLE
 *     AND (language='FR' OR language IS NULL)) — comme pedagogyService.getSubjects
 *     + matchesLevelLanguage(scopeLang='FR').
 *   - Pour chaque classe × trimestre × type : 1 évaluation par matière.
 *   - Date d'évaluation uniforme par groupe (period.startDate) → registre affiche
 *     1 seul groupe par type avec toutes les matières dedans (pas de fragmentation).
 *   - EP créé uniquement pour T3 (évaluation de passage).
 *   - Teacher : Sandra HELM (Institutrice) ou Nadège HELM (Enseignante de Maternelle).
 *
 * Notes qualitatives (depuis school_academic_settings.maternelle) :
 *   - TS = Très Satisfaisant (value=3) — ~40% des grades
 *   - S  = Satisfaisant (value=2)        — ~45% des grades
 *   - PS = Peu Satisfaisant (value=1)   — ~15% des grades
 *   - 3% absentéisme (qualitativeCode=NULL, isAbsent=true)
 *   - Status VALIDATED pour toutes les évaluations.
 *
 * Idempotent : ne crée que ce qui manque.
 * ============================================================================
 */
import pg from 'pg';
import crypto from 'crypto';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const TENANT_ID = '178d5b6b-d4f3-4246-bc8c-76a2e8fc2e4b'; // ⭐ ACADEMIA HELM
const ACADEMIC_YEAR_ID = '276096de-9c33-4d44-9c8e-4b1f3ad2a99f'; // à confirmer
const MATERNELLE_LEVEL_ID = 'e3da9c7c-fab5-4cb8-8a95-9f7e1a99478e';

// Types d'évaluation à seeder (depuis l'onglet paramètres maternelle)
const EVAL_TYPES_TO_SEED = ['EM1', 'EM2', 'EC', 'EP'];

function randomQualitative() {
  const r = Math.random();
  if (r < 0.40) return 'TS';   // 40% Très Satisfaisant
  if (r < 0.85) return 'S';    // 45% Satisfaisant
  return 'PS';                  // 15% Peu Satisfaisant
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected to Neon DB\n');

  // ── VÉRIFICATION DE SÉCURITÉ — confirmer le tenant ─────────────────────
  console.log('═'.repeat(80));
  console.log('VÉRIFICATION DE SÉCURITÉ — tenant cible');
  console.log('═'.repeat(80));
  const check = await client.query(`SELECT name, subdomain FROM tenants WHERE id = $1`, [TENANT_ID]);
  if (check.rows.length === 0) {
    console.error('❌ Tenant introuvable — ABORT');
    process.exit(1);
  }
  if (check.rows[0].subdomain !== 'academia-helm') {
    console.error(`❌ MAUVAIS TENANT ! subdomain=${check.rows[0].subdomain} — ABORT`);
    process.exit(1);
  }
  console.log(`✓ Tenant : ${check.rows[0].name} (subdomain=${check.rows[0].subdomain})\n`);

  // ── Récupérer l'année académique active ──────────────────────────────
  const activeYear = await client.query(`
    SELECT id, label FROM academic_years
     WHERE "tenantId" = $1 AND "isActive" = true
     ORDER BY "startDate" DESC LIMIT 1
  `, [TENANT_ID]);
  if (activeYear.rows.length === 0) {
    console.error('❌ Aucune année académique active — ABORT');
    process.exit(1);
  }
  const ACADEMIC_YEAR_ID = activeYear.rows[0].id;
  console.log(`✓ Année active : ${activeYear.rows[0].label} (id=${ACADEMIC_YEAR_ID.substring(0,8)})\n`);

  // ── STEP 1: Types d'évaluation maternelle ───────────────────────────
  console.log('━'.repeat(80));
  console.log('STEP 1: Types d\'évaluation maternelle');
  console.log('━'.repeat(80));
  const evalTypes = await client.query(`
    SELECT id, code, name, "defaultMaxScore", "defaultCoefficient"
      FROM evaluation_types
     WHERE "tenantId" = $1 AND "schoolLevelId" = $2
       AND code = ANY($3::text[])
     ORDER BY code
  `, [TENANT_ID, MATERNELLE_LEVEL_ID, EVAL_TYPES_TO_SEED]);
  console.log(`  Types trouvés : ${evalTypes.rows.length}`);
  evalTypes.rows.forEach(t => console.log(`    • ${t.code} — ${t.name} (id=${t.id.substring(0,8)}, max=${t.defaultMaxScore}, coef=${t.defaultCoefficient})`));
  console.log();

  // ── STEP 2: Périodes + mapping quarters ─────────────────────────────
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

  // ── STEP 3: Matières FR du niveau MATERNELLE ─────────────────────────
  console.log('━'.repeat(80));
  console.log('STEP 3: Matières FR du niveau MATERNELLE');
  console.log('━'.repeat(80));
  const subjects = await client.query(`
    SELECT id, name, code, coefficient, language
      FROM subjects
     WHERE "tenantId" = $1 AND "schoolLevelId" = $2
       AND (language = 'FR' OR language IS NULL)
     ORDER BY name
  `, [TENANT_ID, MATERNELLE_LEVEL_ID]);
  console.log(`  ${subjects.rows.length} matières FR trouvées`);
  subjects.rows.forEach(s => console.log(`    • ${s.name} (${s.code}, coef=${s.coefficient})`));
  console.log();

  // ── STEP 4: Classes maternelles + élèves + teacher ───────────────────
  console.log('━'.repeat(80));
  console.log('STEP 4: Classes maternelles + élèves + teacher');
  console.log('━'.repeat(80));
  const classes = await client.query(`
    SELECT id, name, "officialClassId" FROM classes
     WHERE "tenantId" = $1 AND "academicYearId" = $2 AND "schoolLevelId" = $3
     ORDER BY name
  `, [TENANT_ID, ACADEMIC_YEAR_ID, MATERNELLE_LEVEL_ID]);
  console.log(`  ${classes.rows.length} classes maternelles\n`);

  // Trouver un teacher maternelle
  const teacherQ = await client.query(`
    SELECT id, "firstName", "lastName" FROM staff
     WHERE "tenantId" = $1 AND "schoolLevelId" = $2
       AND (position ILIKE '%enseignant%' OR "roleType" ILIKE '%TEACHER%')
     LIMIT 1
  `, [TENANT_ID, MATERNELLE_LEVEL_ID]);
  const teacherId = teacherQ.rows[0]?.id;
  console.log(`  Teacher : ${teacherQ.rows[0]?.firstName} ${teacherQ.rows[0]?.lastName} (${teacherId?.substring(0,8)})\n`);

  // Identifier T3 pour EP
  const t3Period = periods.rows.find(p => /trimestre 3/i.test(p.name));

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
    students.rows.forEach(s => console.log(`    • ${s.firstName} ${s.lastName} (${s.id.substring(0,8)})`));

    if (students.rows.length === 0) {
      console.log('  ⚠️ Aucun élève — SKIP classe');
      continue;
    }

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
        // EP uniquement pour T3
        if (evalType.code === 'EP' && !isT3) continue;

        console.log(`  ── ${period.name} | ${evalType.code} ──`);

        // Date uniforme pour tout le groupe (commun à toutes les matières du groupe)
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
            if (existingGrades.rows[0].cnt > 0) {
              continue;
            }
          } else {
            // Créer l'évaluation
            evalId = crypto.randomUUID();
            const title = `${evalType.name} - ${subject.name} - ${period.name}`;
            const coef = evalType.defaultCoefficient ?? 1;
            const maxScore = evalType.defaultMaxScore ?? 20;

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

          // Créer les grades qualitatifs pour chaque élève
          const created = await bulkCreateQualitativeGrades(client, {
            evalId,
            students: students.rows,
            subjectId: subject.id,
            quarterId,
            classId: cls.id,
            coefficient: evalType.defaultCoefficient ?? 1,
            maxScore: evalType.defaultMaxScore ?? 20,
            academicYearId: ACADEMIC_YEAR_ID,
          });
          classGradesCreated += created;
        }
      }
    }

    console.log(`  ✓ ${cls.name} : ${classEvalsCreated} évals créées, ${classEvalsSkipped} skippées, ${classGradesCreated} grades qualitatifs créés\n`);
    totalEvalsCreated += classEvalsCreated;
    totalEvalsSkipped += classEvalsSkipped;
    totalGradesCreated += classGradesCreated;
  }

  // ── STEP 6: Stats finales ────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80));
  console.log('SEED MATERNELLE TERMINÉ (Academia Helm)');
  console.log('═'.repeat(80));
  console.log(`  Total évaluations créées : ${totalEvalsCreated}`);
  console.log(`  Total évaluations skippées (existaient déjà) : ${totalEvalsSkipped}`);
  console.log(`  Total grades qualitatifs créés : ${totalGradesCreated}`);

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
  `, [TENANT_ID, ACADEMIC_YEAR_ID, MATERNELLE_LEVEL_ID]);

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

  // Distribution des notes qualitatives
  console.log('\nDistribution des notes qualitatives :');
  const dist = await client.query(`
    SELECT "qualitativeCode", COUNT(*)::int AS cnt
      FROM grades g
      JOIN evaluations e ON e.id = g."evaluationId"
     WHERE g."tenantId" = $1 AND e."academicYearId" = $2
       AND e."classId" IN (SELECT id FROM classes WHERE "schoolLevelId" = $3)
     GROUP BY "qualitativeCode" ORDER BY "qualitativeCode"
  `, [TENANT_ID, ACADEMIC_YEAR_ID, MATERNELLE_LEVEL_ID]);
  dist.rows.forEach(r => console.log(`  • ${r.qualitativeCode || 'NULL (absent)'} : ${r.cnt} grades`));

  await client.end();
  console.log('\n✅ Seed maternelle terminé pour Academia Helm');
}

async function bulkCreateQualitativeGrades(client, { evalId, students, subjectId, quarterId, classId, coefficient, maxScore, academicYearId }) {
  if (students.length === 0) return 0;
  const values = [];
  const params = [];
  let paramIdx = 1;

  for (const student of students) {
    const isAbsent = Math.random() < 0.03; // 3% absentéisme
    const qualitativeCode = isAbsent ? null : randomQualitative();
    // grades columns : id, tenantId, academicYearId, schoolLevelId, academicTrackId, language,
    //                  studentId, subjectId, examId, score, maxScore, coefficient,
    //                  createdAt, updatedAt, classId, comment, evaluationId, isAbsent,
    //                  periodId, qualitativeCode, status, gradeComponent
    values.push(`(gen_random_uuid(), $${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, NULL, NULL, $${paramIdx+3}, $${paramIdx+4}, NULL, NULL, $${paramIdx+5}, $${paramIdx+6}, NOW(), NOW(), $${paramIdx+7}, NULL, $${paramIdx+8}, $${paramIdx+9}, $${paramIdx+10}, $${paramIdx+11}, 'VALIDATED', NULL)`);
    params.push(
      TENANT_ID,                  // 1 — tenantId
      academicYearId,             // 2 — academicYearId
      MATERNELLE_LEVEL_ID,        // 3 — schoolLevelId
      student.id,                 // 4 — studentId
      subjectId,                  // 5 — subjectId
      maxScore,                   // 6 — maxScore
      coefficient,                // 7 — coefficient
      classId,                    // 8 — classId
      evalId,                     // 9 — evaluationId
      isAbsent,                   // 10 — isAbsent
      quarterId,                  // 11 — periodId
      qualitativeCode             // 12 — qualitativeCode
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
