/**
 * Assign teacherId to seed evaluations based on teacher_class_assignments.
 * Maps each evaluation's classId → teacherId from teacher_class_assignments table.
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  console.log('✅ Connected to Neon\n');

  const TENANT = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
  const YEAR = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';

  // 1. Get all teacher_class_assignments
  const assignments = await db.query(`
    SELECT "teacherId", "classId" FROM "teacher_class_assignments"
    WHERE "tenantId" = $1 AND "academicYearId" = $2
  `, [TENANT, YEAR]);
  console.log(`Teacher assignments: ${assignments.rows.length}`);
  assignments.rows.forEach(a => {
    console.log(`  teacher=${a.teacherId.substring(0,8)} → class=${a.classId.substring(0,8)}`);
  });

  // 2. For each evaluation without teacherId, assign based on classId
  let updated = 0;
  for (const a of assignments.rows) {
    const result = await db.query(`
      UPDATE "evaluations"
      SET "teacherId" = $1, "updatedAt" = NOW()
      WHERE "tenantId" = $2 AND "academicYearId" = $3
        AND "classId" = $4 AND "teacherId" IS NULL
    `, [a.teacherId, TENANT, YEAR, a.classId]);
    if (result.rowCount > 0) {
      console.log(`  ✅ Assigned teacher ${a.teacherId.substring(0,8)} to ${result.rowCount} evaluations in class ${a.classId.substring(0,8)}`);
      updated += result.rowCount;
    }
  }

  console.log(`\n✅ Total evaluations updated: ${updated}`);

  // 3. Verify
  const withTeacher = await db.query('SELECT COUNT(*)::int as c FROM evaluations WHERE "tenantId" = $1 AND "teacherId" IS NOT NULL', [TENANT]);
  console.log(`Evaluations with teacherId: ${withTeacher.rows[0].c}`);

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
