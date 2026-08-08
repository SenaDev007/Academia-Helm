const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

async function main() {
  const db = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  
  const TENANT = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
  const YEAR = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';

  // 1. Delete grade_validation_batches
  const r1 = await db.query('DELETE FROM "grade_validation_batches" WHERE "tenantId" = $1', [TENANT]);
  console.log('Deleted validation batches:', r1.rowCount);

  // 2. Delete grades for old seed evaluations
  const r2 = await db.query(`
    DELETE FROM "grades" WHERE "tenantId" = $1 AND "academicYearId" = $2
      AND "evaluationId" IN (
        SELECT id FROM "evaluations" WHERE "tenantId" = $1
        AND "academicYearId" = $2 AND "teacherId" IS NOT NULL
        AND status IN ('PLANNED', 'OPEN_FOR_GRADING', 'SUBMITTED')
      )
  `, [TENANT, YEAR]);
  console.log('Deleted grades:', r2.rowCount);

  // 3. Delete old seed evaluations
  const r3 = await db.query(`
    DELETE FROM "evaluations" WHERE "tenantId" = $1 AND "academicYearId" = $2
      AND "teacherId" IS NOT NULL AND status IN ('PLANNED', 'OPEN_FOR_GRADING', 'SUBMITTED')
  `, [TENANT, YEAR]);
  console.log('Deleted evaluations:', r3.rowCount);

  // Also delete old VALIDATED seed evaluations (not user-created)
  const r4 = await db.query(`
    DELETE FROM "grades" WHERE "tenantId" = $1 AND "academicYearId" = $2
      AND "evaluationId" IN (
        SELECT id FROM "evaluations" WHERE "tenantId" = $1
        AND "academicYearId" = $2 AND "teacherId" IS NOT NULL AND status = 'VALIDATED'
        AND "createdBy" IS NULL
      )
  `, [TENANT, YEAR]);
  console.log('Deleted old VALIDATED grades:', r4.rowCount);

  const r5 = await db.query(`
    DELETE FROM "evaluations" WHERE "tenantId" = $1 AND "academicYearId" = $2
      AND "teacherId" IS NOT NULL AND status = 'VALIDATED' AND "createdBy" IS NULL
  `, [TENANT, YEAR]);
  console.log('Deleted old VALIDATED evaluations:', r5.rowCount);

  // Verify remaining
  const remaining = await db.query('SELECT COUNT(*)::int as c FROM "evaluations" WHERE "tenantId" = $1 AND "academicYearId" = $2', [TENANT, YEAR]);
  console.log('Remaining evaluations:', remaining.rows[0].c);

  const remainingGrades = await db.query('SELECT COUNT(*)::int as c FROM "grades" WHERE "tenantId" = $1 AND "academicYearId" = $2', [TENANT, YEAR]);
  console.log('Remaining grades:', remainingGrades.rows[0].c);

  await db.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
