const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  // 1. Check existing timetable config
  const config = await client.query(`
    SELECT * FROM timetable_configs WHERE "tenantId" = $1 LIMIT 5
  `, [TENANT_ID]);
  console.log('1. Timetable configs:', config.rows.length);
  config.rows.forEach(c => console.log('  -', JSON.stringify({id: c.id, academicYearId: c.academicYearId, days: c.daysOfWeek, active: c.isActive})));
  
  // 2. Check academic classes for this tenant
  const classes = await client.query(`
    SELECT id, name FROM academic_classes WHERE "tenantId" = $1 AND "isActive" = true
  `, [TENANT_ID]);
  console.log('\n2. Academic classes:', classes.rows.length);
  classes.rows.forEach(c => console.log('  -', c.id, c.name));
  
  // 3. Check subjects
  const subjects = await client.query(`
    SELECT id, name, code FROM subjects WHERE "tenantId" = $1
  `, [TENANT_ID]);
  console.log('\n3. Subjects:', subjects.rows.length);
  subjects.rows.slice(0, 5).forEach(s => console.log('  -', s.id, s.name, s.code));
  
  // 4. Check teachers
  const teachers = await client.query(`
    SELECT id, "firstName", "lastName" FROM teachers WHERE "tenantId" = $1
  `, [TENANT_ID]);
  console.log('\n4. Teachers:', teachers.rows.length);
  teachers.rows.slice(0, 5).forEach(t => console.log('  -', t.id, t.firstName, t.lastName));
  
  // 5. Check teacher availability
  const avail = await client.query(`
    SELECT * FROM teacher_availability WHERE "tenantId" = $1 LIMIT 5
  `, [TENANT_ID]);
  console.log('\n5. Teacher availability:', avail.rows.length);
  
  // 6. Check constraints
  const constraints = await client.query(`
    SELECT * FROM timetable_constraints WHERE "tenantId" = $1 LIMIT 5
  `, [TENANT_ID]);
  console.log('\n6. Constraints:', constraints.rows.length);
  
  // 7. Check solutions
  const solutions = await client.query(`
    SELECT * FROM timetable_solutions WHERE "tenantId" = $1 LIMIT 5
  `, [TENANT_ID]);
  console.log('\n7. Solutions:', solutions.rows.length);
  
  // 8. Check entries
  const entries = await client.query(`
    SELECT * FROM timetable_entries WHERE "tenantId" = $1 LIMIT 5
  `, [TENANT_ID]);
  console.log('\n8. Entries:', entries.rows.length);
  
  // 9. Check academic year
  const year = await client.query(`
    SELECT id, name FROM academic_years WHERE "tenantId" = $1 AND "isActive" = true LIMIT 1
  `, [TENANT_ID]);
  console.log('\n9. Active academic year:', year.rows.length ? year.rows[0] : 'NONE');
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
