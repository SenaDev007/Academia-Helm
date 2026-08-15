/**
 * Diagnostic complet des problèmes de données Mon Avenir Plus
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const YEAR_2025 = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';
const YEAR_2026 = '0117c957-2a19-48a7-9308-1bfbc817710b';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Classes par année
  const c2025 = await client.query('SELECT COUNT(*) as c FROM classes WHERE "tenantId"=$1 AND "academicYearId"=$2', [TENANT_ID, YEAR_2025]);
  const c2026 = await client.query('SELECT COUNT(*) as c FROM classes WHERE "tenantId"=$1 AND "academicYearId"=$2', [TENANT_ID, YEAR_2026]);
  const cnull = await client.query('SELECT COUNT(*) as c FROM classes WHERE "tenantId"=$1 AND "academicYearId" IS NULL', [TENANT_ID]);
  console.log('=== Classes ===');
  console.log('  2025-2026:', c2025.rows[0].c);
  console.log('  2026-2027:', c2026.rows[0].c);
  console.log('  NULL academicYearId:', cnull.rows[0].c);

  // 2. School levels
  const sl = await client.query('SELECT id, code, name FROM school_levels WHERE "tenantId"=$1 ORDER BY name', [TENANT_ID]);
  console.log('\n=== School levels ===');
  sl.rows.forEach(x => console.log('  ', x.code, '|', x.name, '| id=' + x.id));

  // 3. Enrollments par année
  const e2025 = await client.query('SELECT status, COUNT(*) as c FROM student_enrollments WHERE "tenantId"=$1 AND "academicYearId"=$2 GROUP BY status', [TENANT_ID, YEAR_2025]);
  const e2026 = await client.query('SELECT status, COUNT(*) as c FROM student_enrollments WHERE "tenantId"=$1 AND "academicYearId"=$2 GROUP BY status', [TENANT_ID, YEAR_2026]);
  console.log('\n=== Enrollments 2025-2026 ===');
  e2025.rows.forEach(x => console.log('  ', x.status, ':', x.c));
  console.log('\n=== Enrollments 2026-2027 ===');
  e2026.rows.forEach(x => console.log('  ', x.status, ':', x.c));

  // 4. Classes dupliquées (même nom, années différentes)
  const dupes = await client.query(`
    SELECT name, COUNT(*) as c FROM classes WHERE "tenantId"=$1
    GROUP BY name HAVING COUNT(*) > 1 ORDER BY c DESC
  `, [TENANT_ID]);
  console.log('\n=== Classes dupliquées (même nom, années différentes) ===');
  dupes.rows.forEach(x => console.log('  ', x.name, ':', x.c, 'occurrences'));

  // 5. Total students (sans filtre année)
  const totalStudents = await client.query('SELECT COUNT(*) as c FROM students WHERE "tenantId"=$1 AND status != $2', [TENANT_ID, 'WITHDRAWN']);
  console.log('\n=== Students ===');
  console.log('  Total (non WITHDRAWN):', totalStudents.rows[0].c);

  // 6. Vérifier si des classes ont academicYearId = année 2025 mais sont affichées en 2026
  // Check what the BFF /api/all-classes returns (sans filtre année)
  const allClasses = await client.query(`
    SELECT id, name, code, "academicYearId", "schoolLevelId"
    FROM classes WHERE "tenantId"=$1 ORDER BY name
  `, [TENANT_ID]);
  console.log('\n=== Toutes les classes (sans filtre année) ===');
  console.log('Total:', allClasses.rows.length);
  // Grouper par academicYearId
  const byYear = {};
  allClasses.rows.forEach(c => {
    const key = c.academicYearId || 'NULL';
    if (!byYear[key]) byYear[key] = [];
    byYear[key].push(c.name);
  });
  for (const [yearId, names] of Object.entries(byYear)) {
    const yearName = yearId === YEAR_2025 ? '2025-2026' : yearId === YEAR_2026 ? '2026-2027' : 'NULL';
    console.log(`  ${yearName} (${yearId.substring(0,8)}...): ${names.length} classes`);
  }

  // 7. Check pedagogy_academic_classes
  const pac = await client.query(`
    SELECT "academicYearId", COUNT(*) as c FROM pedagogy_academic_classes
    WHERE "tenantId"=$1 GROUP BY "academicYearId"
  `, [TENANT_ID]);
  console.log('\n=== pedagogy_academic_classes par année ===');
  pac.rows.forEach(x => {
    const yearName = x.academicYearId === YEAR_2025 ? '2025-2026' : x.academicYearId === YEAR_2026 ? '2026-2027' : x.academicYearId;
    console.log('  ', yearName, ':', x.c);
  });

  await client.end();
}
main().catch(e => console.error(e.message));
