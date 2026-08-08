/**
 * ============================================================================
 * SEED COMPLETION SCRIPT — Module Examen (BULK INSERT VERSION)
 * ============================================================================
 *
 * Goal: Complete the seed for PRIMAIRE classes (CI A, CP, CE1, CE2, CM1, CM2)
 * for the active academic year 2026-2027 of tenant 59b8c348.
 *
 * Uses BULK INSERT for evaluations and grades to be fast (vs. per-row inserts).
 *
 * Structure:
 *   - Each class × 3 trimesters × 3 evaluation types (EM1, EM2, EC) × subjects
 *   - Each evaluation: status=VALIDATED, maxScore=20, coef=1 (EM1/EM2) or 2 (EC)
 *   - Each grade: random realistic score (7-18 for PRIMAIRE)
 *
 * Also fixes:
 *   - Backfills grades.periodId (mapping academic_periods → quarters)
 *   - Fixes 18 PLANNED evaluations (CP + CE2): assigns teacherId, marks VALIDATED
 *
 * Idempotent: only creates what's missing.
 * ============================================================================
 */
import pg from 'pg';
import crypto from 'crypto';

const DATABASE_URL =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const ACADEMIC_YEAR_ID = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';
const PRIMAIRE_LEVEL_ID = 'bc434610-8cf6-4415-a51a-cc5300cd99da';

const TEACHER_BY_CLASS = {
  '3c28f595-8a35-4d80-b3a1-5cdec5e9a0d0': '9ed8201c-42e0-431d-abd6-71ec6a4c4501', // CE1
  'e63fc9d8-fb0c-4be5-9b47-7c9cbaf4061d': '9ed8201c-42e0-431d-abd6-71ec6a4c4501', // CE2
  'f33e8383-627d-4ecb-8a91-4e084eb13075': '77324610-1f48-41a0-93c7-73d99fb6537a', // CI A
  '65b9d2be-70c1-439d-b58c-7ff299453adb': 'd464fc8c-565c-4427-a344-c3e24631f96e', // CM1
  '09bedade-7649-46ce-be69-e4abb81a9c45': '741da4d1-8800-4953-994f-4dbd82c9c95c', // CM2
  '210650ac-9ad3-40b0-aa7e-44db0061ec01': '9ed8201c-42e0-431d-abd6-71ec6a4c4501', // CP
};

function randomScore(min = 7, max = 18) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDateInPeriod(start, end) {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s));
}

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Add error handlers to capture silent exits
client.on('error', (err) => console.error('⚠️ CLIENT ERROR:', err.message));
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ UNHANDLED REJECTION:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});
process.on('exit', (code) => {
  console.log(`\n[process exit code=${code}]`);
});

// Make console.log synchronous (no buffering)
if (process.stdout._handle && process.stdout._handle.setBlocking) {
  process.stdout._handle.setBlocking(true);
}
if (process.stderr._handle && process.stderr._handle.setBlocking) {
  process.stderr._handle.setBlocking(true);
}

async function main() {
  await client.connect();
  console.log('✅ Connected to Neon DB\n');

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Backfill grades.periodId (academic_periods → quarters mapping)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━'.repeat(80));
  console.log('STEP 1: Backfill grades.periodId');
  console.log('━'.repeat(80));

  const mappingRows = await client.query(`
    SELECT
      ap.id AS ap_id, ap.name AS period_name,
      (SELECT q.id FROM quarters q
       WHERE q."academicYearId" = ap."academicYearId"
         AND q."tenantId" = ap."tenantId"
         AND ((ap.name ILIKE '%trimestre 1%' AND q.number = 1)
           OR (ap.name ILIKE '%trimestre 2%' AND q.number = 2)
           OR (ap.name ILIKE '%trimestre 3%' AND q.number = 3))
       ORDER BY q."createdAt" ASC LIMIT 1) AS q_id
    FROM academic_periods ap WHERE ap."tenantId" = $1
  `, [TENANT_ID]);

  const periodToQuarter = new Map();
  for (const r of mappingRows.rows) {
    if (r.q_id) {
      periodToQuarter.set(r.ap_id, r.q_id);
      console.log(`  • ${r.period_name} → ap=${r.ap_id.substring(0,8)} → q=${r.q_id.substring(0,8)}`);
    }
  }

  let backfilled = 0;
  for (const [apId, qId] of periodToQuarter) {
    const r = await client.query(`
      UPDATE grades g SET "periodId" = $1
      FROM evaluations e WHERE e.id = g."evaluationId"
        AND e."periodId" = $2 AND g."periodId" IS NULL
    `, [qId, apId]);
    backfilled += r.rowCount;
  }
  console.log(`✓ Backfilled ${backfilled} grades\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Fix PLANNED evaluations — assign teacherId + mark VALIDATED
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━'.repeat(80));
  console.log('STEP 2: Fix PLANNED evaluations');
  console.log('━'.repeat(80));

  const plannedEvals = await client.query(`
    SELECT id, "classId" FROM evaluations WHERE "teacherId" IS NULL AND status = 'PLANNED'
  `);
  console.log(`Found ${plannedEvals.rowCount} PLANNED evaluations`);
  for (const ev of plannedEvals.rows) {
    const teacherId = TEACHER_BY_CLASS[ev.classId] || '9ed8201c-42e0-431d-abd6-71ec6a4c4501';
    await client.query(`UPDATE evaluations SET "teacherId" = $1, status = 'VALIDATED', "validatedAt" = NOW() WHERE id = $2`, [teacherId, ev.id]);
  }
  console.log(`✓ Fixed ${plannedEvals.rowCount} evaluations\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Gather data (classes, periods, eval types, subjects, students)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━'.repeat(80));
  console.log('STEP 3: Gather seed data');
  console.log('━'.repeat(80));

  const classes = await client.query(`
    SELECT c.id, c.name, c."officialClassId"
    FROM classes c
    JOIN school_levels sl ON sl.id = c."schoolLevelId" AND sl.code = 'PRIMAIRE'
    WHERE c."tenantId" = $1 AND c."academicYearId" = $2
    ORDER BY c.name
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`✓ ${classes.rows.length} PRIMAIRE classes`);

  const periods = await client.query(`
    SELECT id, name, "startDate", "endDate" FROM academic_periods
    WHERE "academicYearId" = $1 ORDER BY "startDate"
  `, [ACADEMIC_YEAR_ID]);
  console.log(`✓ ${periods.rows.length} periods`);

  const evalTypes = await client.query(`
    SELECT id, code, name, "defaultMaxScore", "defaultCoefficient"
    FROM evaluation_types
    WHERE "tenantId" = $1 AND "schoolLevelId" = $2 ORDER BY code
  `, [TENANT_ID, PRIMAIRE_LEVEL_ID]);
  console.log(`✓ ${evalTypes.rows.length} evaluation types: ${evalTypes.rows.map(t => t.code).join(', ')}\n`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Create missing evaluations + grades (BULK)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('━'.repeat(80));
  console.log('STEP 4: Create missing evaluations + grades (BULK)');
  console.log('━'.repeat(80));

  let totalEvalsCreated = 0;
  let totalEvalsSkipped = 0;
  let totalGradesCreated = 0;

  for (const cls of classes.rows) {
    console.log(`\n── Class: ${cls.name} ──`);

    try {
      // Load subjects — FR ONLY (Francophone track)
      // ⭐ Important: filter subjects by language='FR' OR language IS NULL
      // to avoid seeding Anglophone subjects on the Francophone track
      const subjects = (await client.query(`
        SELECT s.id, s.name, s.code, cs.coefficient, s.language
        FROM class_subjects cs JOIN subjects s ON s.id = cs."subjectId"
        WHERE cs."academicClassId" = $1 AND cs."tenantId" = $2
          AND (s.language = 'FR' OR s.language IS NULL)
        ORDER BY s.name
      `, [cls.officialClassId, TENANT_ID])).rows;

    // Load students
    const students = (await client.query(`
      SELECT s.id FROM student_enrollments se
      JOIN students s ON s.id = se."studentId"
      WHERE se."classId" = $1 AND se."academicYearId" = $2 AND se.status = 'ACTIVE'
    `, [cls.id, ACADEMIC_YEAR_ID])).rows;

    const teacherId = TEACHER_BY_CLASS[cls.id] || '9ed8201c-42e0-431d-abd6-71ec6a4c4501';
    console.log(`  ${subjects.length} subjects, ${students.length} students, teacher=${teacherId.substring(0,8)}`);

    let classEvalsCreated = 0;
    let classEvalsSkipped = 0;
    let classGradesCreated = 0;

    for (const period of periods.rows) {
      const quarterId = periodToQuarter.get(period.id);
      if (!quarterId) {
        console.log(`  ⚠️ No quarter for ${period.name} — skipping`);
        continue;
      }

      for (const evalType of evalTypes.rows) {
        // Get existing evaluations for this (class, period, evalType) combo
        const existing = (await client.query(`
          SELECT id, "subjectId" FROM evaluations
          WHERE "classId" = $1 AND "periodId" = $2 AND "evaluationTypeId" = $3
            AND "tenantId" = $4 AND "academicYearId" = $5
        `, [cls.id, period.id, evalType.id, TENANT_ID, ACADEMIC_YEAR_ID])).rows;

        const existingSubjectIds = new Set(existing.map(e => e.subjectId));

        // Find subjects that need new evaluations
        const missingSubjects = subjects.filter(s => !existingSubjectIds.has(s.id));

        // For existing evals, check if grades need to be created (batch count)
        if (existing.length > 0) {
          const evalIds = existing.map(e => e.id);
          const gradesByEval = (await client.query(`
            SELECT "evaluationId", COUNT(*)::int AS cnt
            FROM grades WHERE "evaluationId" = ANY($1::text[])
            GROUP BY "evaluationId"
          `, [evalIds])).rows;
          const gradesMap = new Map(gradesByEval.map(r => [r.evaluationId, r.cnt]));

          for (const ev of existing) {
            classEvalsSkipped++;
            totalEvalsSkipped++;
            const gradesCount = gradesMap.get(ev.id) || 0;
            if (gradesCount === 0 && students.length > 0) {
              const subject = subjects.find(s => s.id === ev.subjectId);
              const coef = evalType.code === 'EC' ? 2 : (subject?.coefficient || 1);
              const created = await bulkCreateGrades(client, {
                evalId: ev.id, students, subjectId: ev.subjectId,
                quarterId, classId: cls.id, coefficient: coef, maxScore: evalType.defaultMaxScore || 20,
              });
              classGradesCreated += created;
              totalGradesCreated += created;
            }
          }
        }

        // BULK CREATE missing evaluations
        if (missingSubjects.length > 0) {
          const evalValues = [];
          const evalParams = [];
          let paramIdx = 1;
          for (const subject of missingSubjects) {
            const evaluationDate = randomDateInPeriod(period.startDate, period.endDate);
            const title = `${evalType.name} - ${period.name}`;
            const coef = evalType.code === 'EC' ? 2 : (subject.coefficient || evalType.defaultCoefficient || 1);
            const maxScore = evalType.defaultMaxScore || 20;
            const newEvalId = crypto.randomUUID();
            evalValues.push(`($${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6}, $${paramIdx+7}, $${paramIdx+8}, $${paramIdx+9}, $${paramIdx+10}, $${paramIdx+11}, 'VALIDATED', NOW(), NOW(), NOW())`);
            evalParams.push(
              newEvalId, TENANT_ID, ACADEMIC_YEAR_ID, cls.id, subject.id,
              period.id, evalType.id, title, evaluationDate, maxScore, coef, teacherId
            );
            paramIdx += 12;
            // Remember the new eval ID for grade creation
            subject._newEvalId = newEvalId;
            subject._coef = coef;
          }

          const insertQuery = `
            INSERT INTO evaluations (
              id, "tenantId", "academicYearId", "classId", "subjectId",
              "periodId", "evaluationTypeId", title, "evaluationDate",
              "maxScore", coefficient, "teacherId", status, "validatedAt", "createdAt", "updatedAt"
            ) VALUES ${evalValues.join(', ')}
            RETURNING id, "subjectId"
          `;
          const inserted = await client.query(insertQuery, evalParams);
          classEvalsCreated += inserted.rowCount;
          totalEvalsCreated += inserted.rowCount;

          // BULK CREATE grades for each newly-inserted evaluation
          for (const subject of missingSubjects) {
            if (students.length > 0) {
              const created = await bulkCreateGrades(client, {
                evalId: subject._newEvalId, students, subjectId: subject.id,
                quarterId, classId: cls.id, coefficient: subject._coef, maxScore: evalType.defaultMaxScore || 20,
              });
              classGradesCreated += created;
              totalGradesCreated += created;
            }
          }
        }
      }
    }
    console.log(`  ✓ evals_created=${classEvalsCreated}, evals_skipped=${classEvalsSkipped}, grades_created=${classGradesCreated}`);
    } catch (err) {
      console.error(`\n❌ FAILED for class ${cls.name}:`, err.message);
      console.error(err.stack);
      // Continue to next class
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('SEED COMPLETE');
  console.log('═'.repeat(80));
  console.log(`  Total evaluations created: ${totalEvalsCreated}`);
  console.log(`  Total evaluations skipped: ${totalEvalsSkipped}`);
  console.log(`  Total grades created: ${totalGradesCreated}`);

  // Final stats
  const finalStats = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM evaluations WHERE "tenantId" = $1) AS total_evals,
      (SELECT COUNT(*)::int FROM evaluations WHERE "tenantId" = $1 AND status = 'VALIDATED') AS validated,
      (SELECT COUNT(*)::int FROM evaluations WHERE "tenantId" = $1 AND "teacherId" IS NULL) AS null_teacher,
      (SELECT COUNT(*)::int FROM grades WHERE "tenantId" = $1) AS total_grades,
      (SELECT COUNT(*)::int FROM grades WHERE "tenantId" = $1 AND "periodId" IS NULL) AS null_period_grades
  `, [TENANT_ID]);
  console.log('\nFinal stats:', finalStats.rows[0]);

  await client.end();
}

async function bulkCreateGrades(client, { evalId, students, subjectId, quarterId, classId, coefficient, maxScore }) {
  if (students.length === 0) return 0;
  const values = [];
  const params = [];
  let paramIdx = 1;
  for (const student of students) {
    const score = randomScore(7, 18);
    const isAbsent = Math.random() < 0.03;
    values.push(`(gen_random_uuid(), $${paramIdx}, $${paramIdx+1}, $${paramIdx+2}, $${paramIdx+3}, $${paramIdx+4}, $${paramIdx+5}, $${paramIdx+6}, $${paramIdx+7}, $${paramIdx+8}, $${paramIdx+9}, $${paramIdx+10}, $${paramIdx+11}, NULL, 'VALIDATED', NOW(), NOW())`);
    params.push(
      TENANT_ID, ACADEMIC_YEAR_ID, PRIMAIRE_LEVEL_ID,
      student.id, subjectId, evalId, quarterId, classId,
      isAbsent ? null : score, maxScore, coefficient, isAbsent
    );
    paramIdx += 12;
  }

  const query = `
    INSERT INTO grades (
      id, "tenantId", "academicYearId", "schoolLevelId", "studentId", "subjectId",
      "evaluationId", "periodId", "classId",
      score, "maxScore", coefficient, "isAbsent", "qualitativeCode",
      status, "createdAt", "updatedAt"
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
