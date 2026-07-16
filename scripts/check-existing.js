/**
 * Vérifie les school_levels, academic_classes, classes existants pour le tenant.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== school_levels ===');
  const sl = await client.query(`SELECT id, name, code FROM school_levels WHERE "tenantId" = $1 ORDER BY name`, [TENANT_ID]);
  sl.rows.forEach(r => console.log(`  ${r.id} | ${r.name} | ${r.code}`));

  console.log('\n=== academic_classes (officielles) pour 2025-2026 ===');
  const ac = await client.query(`SELECT id, name, code, "levelId" FROM pedagogy_academic_classes WHERE "tenantId" = $1 AND "academicYearId" = $2 ORDER BY name`, [TENANT_ID, ACADEMIC_YEAR_ID]);
  ac.rows.forEach(r => console.log(`  ${r.id} | ${r.name} | ${r.code} | levelId=${r.levelId}`));

  console.log('\n=== classes (physiques) pour 2025-2026 ===');
  const cls = await client.query(`SELECT id, name, code, "officialClassId", "schoolLevelId" FROM classes WHERE "tenantId" = $1 AND "academicYearId" = $2 ORDER BY name`, [TENANT_ID, ACADEMIC_YEAR_ID]);
  cls.rows.forEach(r => console.log(`  ${r.id} | ${r.name} | ${r.code} | official=${r.officialClassId} | level=${r.schoolLevelId}`));

  console.log('\n=== Comptes élèves existants ===');
  const cnt = await client.query(`SELECT COUNT(*) as n FROM student_accounts WHERE "tenantId" = $1 AND "academicYearId" = $2`, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  ${cnt.rows[0].n} comptes existants`);

  console.log('\n=== Élèves existants ===');
  const stCnt = await client.query(`SELECT COUNT(*) as n FROM students WHERE "tenantId" = $1`, [TENANT_ID]);
  console.log(`  ${stCnt.rows[0].n} élèves existants`);

  console.log('\n=== fee_structures existantes ===');
  const fs = await client.query(`SELECT id, name, "feeType", "totalAmount", "academicClassId" FROM fee_structures WHERE "tenantId" = $1 AND "academicYearId" = $2`, [TENANT_ID, ACADEMIC_YEAR_ID]);
  fs.rows.forEach(r => console.log(`  ${r.id} | ${r.name} | ${r.feeType} | ${r.totalAmount} | class=${r.academicClassId}`));

  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
