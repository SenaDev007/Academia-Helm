/**
 * Audit Mon Avenir Plus — 2025-2026
 * - Liste des classes (AcademicClass) pour 2025-2026
 * - Liste des effectifs par classe
 * - Vérifie si 2026-2027 existe déjà
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';
const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Années scolaires ===');
  const years = await client.query(`
    SELECT id, name, "startDate", "endDate", "isActive", "isClosed"
    FROM academic_years WHERE "tenantId" = $1 ORDER BY name
  `, [TENANT_ID]);
  years.rows.forEach(y => console.log(`  ${y.name} | id=${y.id} | active=${y.isActive} | closed=${y.isClosed}`));

  const year2025 = years.rows.find(y => y.name.includes('2025-2026'));
  const year2026 = years.rows.find(y => y.name.includes('2026-2027'));
  console.log(`\n2025-2026 ID: ${year2025?.id || 'NOT FOUND'}`);
  console.log(`2026-2027 ID: ${year2026?.id || 'NOT FOUND'}`);

  if (!year2025) { console.log('❌ 2025-2026 not found'); await client.end(); return; }

  console.log('\n=== Classes 2025-2026 ===');
  const classes2025 = await client.query(`
    SELECT ac.id, ac.name, ac.code,
           g.code as grade_code, g.name as grade_name,
           c.name as cycle_name, l.name as level_name,
           COUNT(se."studentId") as effectif
    FROM academic_classes ac
    LEFT JOIN student_enrollments se ON se."academicClassId" = ac.id
      AND se."academicYearId" = $1 AND se.status = 'ACTIVE'
    LEFT JOIN education_grades g ON g.id = ac."gradeId"
    LEFT JOIN education_cycles c ON c.id = g."cycleId"
    LEFT JOIN education_levels l ON l.id = c."levelId"
    WHERE ac."tenantId" = $2 AND ac."academicYearId" = $1
    GROUP BY ac.id, ac.name, ac.code, g.code, g.name, c.name, l.name
    ORDER BY l.order, c.order, g.order, ac.name
  `, [year2025.id, TENANT_ID]);

  console.log('Name | Code | Grade | Cycle | Level | Effectif');
  classes2025.rows.forEach(c => {
    console.log(`  ${c.name} | ${c.code || '-'} | ${c.grade_code || '-'} (${c.grade_name || '-'}) | ${c.cycle_name || '-'} | ${c.level_name || '-'} | ${c.effectif} élèves`);
  });

  console.log(`\nTotal classes 2025-2026: ${classes2025.rows.length}`);
  console.log(`Total élèves actifs: ${classes2025.rows.reduce((s, c) => s + Number(c.effectif), 0)}`);

  // Check if 2026-2027 classes already exist
  if (year2026) {
    const classes2026 = await client.query(`
      SELECT COUNT(*) as c FROM academic_classes WHERE "tenantId" = $1 AND "academicYearId" = $2
    `, [TENANT_ID, year2026.id]);
    console.log(`\nClasses 2026-2027 existantes: ${classes2026.rows[0].c}`);

    const enrollments2026 = await client.query(`
      SELECT COUNT(*) as c FROM student_enrollments WHERE "tenantId" = $1 AND "academicYearId" = $2 AND status = 'ACTIVE'
    `, [TENANT_ID, year2026.id]);
    console.log(`Inscriptions 2026-2027 existantes: ${enrollments2026.rows[0].c}`);
  }

  // Check education_grades available
  console.log('\n=== Education Grades disponibles ===');
  const grades = await client.query(`
    SELECT g.id, g.code, g.name, g."isEnabled", c.name as cycle, l.name as level
    FROM education_grades g
    JOIN education_cycles c ON c.id = g."cycleId"
    JOIN education_levels l ON l.id = c."levelId"
    WHERE l."tenantId" = $1
    ORDER BY l.order, c.order, g.order
  `, [TENANT_ID]);
  grades.rows.forEach(g => console.log(`  ${g.level} > ${g.cycle} > ${g.code} (${g.name}) | enabled=${g.isEnabled} | id=${g.id}`));

  await client.end();
}
main().catch(e => console.error(e.message));
