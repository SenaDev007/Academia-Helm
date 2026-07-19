const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const TENANT_ID = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  // Check pedagogy_academic_classes
  const classes = await client.query(`
    SELECT id, name, code, "levelId" FROM pedagogy_academic_classes WHERE "tenantId" = $1 AND "isActive" = true
  `, [TENANT_ID]);
  console.log('1. Pedagogy academic classes:', classes.rows.length);
  classes.rows.forEach(c => console.log('  -', c.id, c.name, c.code));
  
  // Check subjects
  const subjects = await client.query(`
    SELECT id, name, code FROM subjects WHERE "tenantId" = $1
  `, [TENANT_ID]);
  console.log('\n2. Subjects:', subjects.rows.length);
  subjects.rows.slice(0, 10).forEach(s => console.log('  -', s.id, s.name, s.code));
  
  // Check teachers
  const teachers = await client.query(`
    SELECT id, "firstName", "lastName" FROM teachers WHERE "tenantId" = $1
  `, [TENANT_ID]);
  console.log('\n3. Teachers:', teachers.rows.length);
  teachers.rows.slice(0, 10).forEach(t => console.log('  -', t.id, t.firstName, t.lastName));
  
  // Check class_subjects (links between classes and subjects)
  const classSubjects = await client.query(`
    SELECT cs.*, s.name as subject_name, s.code as subject_code
    FROM class_subjects cs
    LEFT JOIN subjects s ON s.id = cs."subjectId"
    WHERE cs."tenantId" = $1
    LIMIT 10
  `, [TENANT_ID]);
  console.log('\n4. Class-subjects links:', classSubjects.rows.length);
  classSubjects.rows.slice(0, 5).forEach(cs => console.log('  -', cs.subject_name, cs.subject_code));
  
  // Check teacher_class_assignments
  const assignments = await client.query(`
    SELECT tca.*, t."firstName", t."lastName"
    FROM teacher_class_assignments tca
    LEFT JOIN teachers t ON t.id = tca."teacherId"
    WHERE tca."tenantId" = $1
    LIMIT 10
  `, [TENANT_ID]);
  console.log('\n5. Teacher-class assignments:', assignments.rows.length);
  assignments.rows.slice(0, 5).forEach(a => console.log('  -', a.firstName, a.lastName));
  
  // Check teacher_availability
  const avail = await client.query(`
    SELECT * FROM teacher_availability WHERE "tenantId" = $1 LIMIT 5
  `, [TENANT_ID]);
  console.log('\n6. Teacher availability:', avail.rows.length);
  
  // Check timetable_constraints
  const constraints = await client.query(`
    SELECT * FROM timetable_constraints WHERE "tenantId" = $1 LIMIT 5
  `, [TENANT_ID]);
  console.log('\n7. Constraints:', constraints.rows.length);
  
  // Check timetable_solutions
  const solutions = await client.query(`
    SELECT * FROM timetable_solutions WHERE "tenantId" = $1 LIMIT 5
  `, [TENANT_ID]);
  console.log('\n8. Solutions:', solutions.rows.length);
  
  // Check timetable_entries
  const entries = await client.query(`
    SELECT * FROM timetable_entries WHERE "tenantId" = $1 LIMIT 5
  `, [TENANT_ID]);
  console.log('\n9. Entries:', entries.rows.length);
  
  // Check school_levels
  const levels = await client.query(`
    SELECT id, name, code FROM school_levels WHERE "tenantId" = $1
  `, [TENANT_ID]);
  console.log('\n10. School levels:', levels.rows.length);
  levels.rows.forEach(l => console.log('  -', l.id, l.name, l.code));
  
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
