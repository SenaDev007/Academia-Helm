/**
 * ============================================================================
 * SEED COMPLET : 3 trimestres × 3 évaluations × toutes les classes × notes
 * ============================================================================
 *
 * Pour chaque classe MATERNELLE + PRIMAIRE :
 *   - Trimestre 1: EM1 + EM2 + EC (avec notes pour chaque élève × matière)
 *   - Trimestre 2: EM1 + EM2 + EC
 *   - Trimestre 3: EM1 + EM2 + EC
 *
 * Maternelle : notes qualitatives (TS/S/PS)
 * Primaire : notes numériques /20
 *
 * Total estimé :
 *   8 classes × 3 trimestres × 3 evals × ~23 matières = ~1656 évaluations
 *   8 classes × ~12 élèves × ~23 matières × 9 evals = ~19872 grades
 * ============================================================================
 */

const { Client } = require('pg');
const crypto = require('crypto');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  console.log('✅ Connected to Neon\n');

  const TENANT = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
  const YEAR = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';

  // Get classes (MATERNELLE + PRIMAIRE only — skip SECONDAIRE which has no students)
  const classes = (await db.query(`
    SELECT c.id, c.name, c."schoolLevelId", c."officialClassId", sl.code as "levelCode"
    FROM classes c
    LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
    WHERE c."tenantId" = $1 AND sl.code IN ('MATERNELLE', 'PRIMAIRE')
    ORDER BY sl.code, c.name
  `, [TENANT])).rows;

  // Get periods (use first set of 3 trimesters)
  const periods = (await db.query(`
    SELECT DISTINCT ON (name) id, name FROM academic_periods
    WHERE "tenantId" = $1 AND type = 'TRIMESTER'
    ORDER BY name, id
  `, [TENANT])).rows;
  // Sort by name to get T1, T2, T3
  periods.sort((a, b) => a.name.localeCompare(b.name));

  // Get evaluation types (use first set)
  const evalTypes = (await db.query(`
    SELECT DISTINCT ON (code) id, name, code FROM evaluation_types
    WHERE "tenantId" = $1 AND code IN ('EM1', 'EM2', 'EC')
    ORDER BY code, id
  `, [TENANT])).rows;

  // Get subjects per class
  const subjectsData = (await db.query(`
    SELECT cs."academicClassId", cs."subjectId", s.name as "subjectName"
    FROM class_subjects cs
    INNER JOIN subjects s ON s.id = cs."subjectId"
    WHERE cs."tenantId" = $1 AND cs."academicYearId" = $2
  `, [TENANT, YEAR])).rows;

  const subjectsByClass = {};
  subjectsData.forEach(s => {
    if (!subjectsByClass[s.academicClassId]) subjectsByClass[s.academicClassId] = [];
    subjectsByClass[s.academicClassId].push({ subjectId: s.subjectId, name: s.subjectName });
  });

  // Get students per class
  const studentsData = (await db.query(`
    SELECT se."classId", se."studentId", s."firstName", s."lastName"
    FROM student_enrollments se
    INNER JOIN students s ON s.id = se."studentId"
    WHERE se."tenantId" = $1 AND se."academicYearId" = $2 AND se.status = 'ACTIVE'
  `, [TENANT, YEAR])).rows;

  const studentsByClass = {};
  studentsData.forEach(s => {
    if (!studentsByClass[s.classId]) studentsByClass[s.classId] = [];
    studentsByClass[s.classId].push(s);
  });

  // Get teacher per class
  const teacherData = (await db.query(`
    SELECT DISTINCT ON ("classId") "classId", "teacherId"
    FROM teacher_class_assignments
    WHERE "tenantId" = $1 AND "academicYearId" = $2
  `, [TENANT, YEAR])).rows;
  const teacherByClass = {};
  teacherData.forEach(t => { teacherByClass[t.classId] = t.teacherId; });

  // Stats
  console.log(`Classes: ${classes.length}`);
  console.log(`Periods: ${periods.map(p => p.name).join(', ')}`);
  console.log(`Eval types: ${evalTypes.map(et => `${et.code}(${et.name})`).join(', ')}`);

  // Delete existing seed evaluations (keep user-created VALIDATED ones)
  console.log('\n--- Cleaning old seed evaluations ---');
  const deleted = await db.query(`
    DELETE FROM "grades" WHERE "tenantId" = $1 AND "academicYearId" = $2
      AND "evaluationId" IN (
        SELECT id FROM "evaluations" WHERE "tenantId" = $1
        AND "academicYearId" = $2 AND "teacherId" IS NOT NULL
        AND status IN ('PLANNED', 'OPEN_FOR_GRADING', 'SUBMITTED')
      )
  `, [TENANT, YEAR]);
  console.log(`  Deleted ${deleted.rowCount} grades`);

  const deletedEvals = await db.query(`
    DELETE FROM "evaluations" WHERE "tenantId" = $1 AND "academicYearId" = $2
      AND "teacherId" IS NOT NULL AND status IN ('PLANNED', 'OPEN_FOR_GRADING', 'SUBMITTED')
  `, [TENANT, YEAR]);
  console.log(`  Deleted ${deletedEvals.rowCount} evaluations`);

  // Seed data
  let evalCount = 0;
  let gradeCount = 0;
  const qualitativeCodes = ['TS', 'S', 'PS'];
  const startDate = new Date('2026-09-21');

  for (const cls of classes) {
    const classStudents = studentsByClass[cls.id] || [];
    const classSubjects = subjectsByClass[cls.officialClassId] || [];
    const teacherId = teacherByClass[cls.id];
    const isMaternelle = cls.levelCode === 'MATERNELLE';

    if (classStudents.length === 0 || classSubjects.length === 0) {
      console.log(`  ⏭️  ${cls.name}: no students or subjects, skipping`);
      continue;
    }

    console.log(`\n▶️  ${cls.name} (${cls.levelCode}): ${classStudents.length} students, ${classSubjects.length} subjects, teacher=${teacherId ? teacherId.substring(0,8) : 'NONE'}`);

    for (let pIdx = 0; pIdx < periods.length; pIdx++) {
      const period = periods[pIdx];

      for (const evalType of evalTypes) {
        // Create ONE evaluation PER SUBJECT (subjectId is NOT NULL)
        for (const subject of classSubjects) {
          const evalId = crypto.randomUUID();
          const evalTitle = `${evalType.name} - ${period.name}`;

          const evalDate = new Date(startDate);
          evalDate.setDate(evalDate.getDate() + (pIdx * 90) + (evalTypes.indexOf(evalType) * 15));

          await db.query(`
            INSERT INTO "evaluations" ("id", "tenantId", "academicYearId", "classId", "subjectId",
              "periodId", "evaluationTypeId", "title", "evaluationDate", "maxScore",
              "coefficient", "status", "createdBy", "teacherId", "startDate", "endDate",
              "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, 'VALIDATED', NULL, $11, $12, $13, NOW(), NOW())
          `, [
            evalId, TENANT, YEAR, cls.id, subject.subjectId, period.id, evalType.id, evalTitle,
            evalDate, isMaternelle ? 0 : 20,
            teacherId || null,
            evalDate, new Date(evalDate.getTime() + 3 * 86400000),
          ]);
          evalCount++;

          // Create grades for each student
          for (const student of classStudents) {
            const gradeId = crypto.randomUUID();

            if (isMaternelle) {
              const qualCode = qualitativeCodes[Math.floor(Math.random() * 3)];
              await db.query(`
                INSERT INTO "grades" ("id", "tenantId", "academicYearId", "schoolLevelId",
                  "studentId", "subjectId", "evaluationId", "classId", "score",
                  "qualitativeCode", "maxScore", "coefficient", "isAbsent", "status",
                  "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, 0, 1, false, 'VALIDATED', NOW(), NOW())
              `, [
                gradeId, TENANT, YEAR, cls.schoolLevelId,
                student.studentId, subject.subjectId, evalId, cls.id,
                qualCode,
              ]);
            } else {
              const score = Math.floor(Math.random() * 13) + 6;
              await db.query(`
                INSERT INTO "grades" ("id", "tenantId", "academicYearId", "schoolLevelId",
                  "studentId", "subjectId", "evaluationId", "classId", "score",
                  "qualitativeCode", "maxScore", "coefficient", "isAbsent", "status",
                  "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, 20, 1, false, 'VALIDATED', NOW(), NOW())
              `, [
                gradeId, TENANT, YEAR, cls.schoolLevelId,
                student.studentId, subject.subjectId, evalId, cls.id,
                score,
              ]);
            }
            gradeCount++;
          }
        }
      }
    }
    console.log(`  ✅ Created evaluations and grades for ${cls.name}`);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════');
  console.log('  SEED COMPLETE');
  console.log('═══════════════════════════════════════════');
  console.log(`  Evaluations created: ${evalCount}`);
  console.log(`  Grades created: ${gradeCount}`);
  console.log(`  Classes: ${classes.length}`);
  console.log(`  Periods: ${periods.length}`);
  console.log(`  Eval types per period: ${evalTypes.length}`);

  // Verify
  const totalEvals = await db.query('SELECT COUNT(*)::int as c FROM "evaluations" WHERE "tenantId" = $1 AND "academicYearId" = $2', [TENANT, YEAR]);
  const totalGrades = await db.query('SELECT COUNT(*)::int as c FROM "grades" WHERE "tenantId" = $1 AND "academicYearId" = $2', [TENANT, YEAR]);
  console.log(`\n  Total evaluations in DB: ${totalEvals.rows[0].c}`);
  console.log(`  Total grades in DB: ${totalGrades.rows[0].c}`);

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
