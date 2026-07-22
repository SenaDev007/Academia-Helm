const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
const ACADEMIC_YEAR_ID = 'a7593470-e4f4-460a-b3b6-4dabe53bec2a';
const SCHOOL_LEVEL_ID = '82417850-f9cc-4be6-8a6b-370db5509e11';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  // Check classes table (physical classes)
  const classes = await client.query(`
    SELECT id, name, "schoolLevelId", "academicYearId" FROM classes 
    WHERE "tenantId" = $1
  `, [TENANT_ID]);
  console.log('Physical classes (table: classes):', classes.rows.length);
  classes.rows.forEach(c => console.log('  -', c.id, c.name, 'level:', c.schoolLevelId, 'year:', c.academicYearId));
  
  // Check pedagogy_academic_classes
  const acClasses = await client.query(`
    SELECT id, name, "levelId", "academicYearId" FROM pedagogy_academic_classes 
    WHERE "tenantId" = $1 AND "isActive" = true
  `, [TENANT_ID]);
  console.log('\nPedagogy academic classes:', acClasses.rows.length);
  acClasses.rows.forEach(c => console.log('  -', c.id, c.name, 'level:', c.levelId));
  
  // Check subjects with schoolLevelId
  const subjects = await client.query(`
    SELECT id, name, "schoolLevelId" FROM subjects WHERE "tenantId" = $1
  `, [TENANT_ID]);
  console.log('\nSubjects:', subjects.rows.length);
  subjects.rows.slice(0, 3).forEach(s => console.log('  -', s.id, s.name, 'level:', s.schoolLevelId));
  
  // Check subject_assignments
  const assignments = await client.query(`
    SELECT COUNT(*) as count FROM subject_assignments WHERE "tenantId" = $1
  `, [TENANT_ID]);
  console.log('\nSubject assignments:', assignments.rows[0].count);
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
