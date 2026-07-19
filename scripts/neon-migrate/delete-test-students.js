const { Client } = require('pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  // Find test students
  const tests = await client.query(`
    SELECT id, "firstName", "lastName", matricule FROM students
    WHERE "firstName" ILIKE 'Test%' OR "lastName" ILIKE 'EleveTest%' OR "firstName" = 'TestFictif' OR "firstName" = 'TestAgent'
  `);
  console.log('Test students found:', tests.rows.length);
  tests.rows.forEach(s => console.log('  -', s.id, s.firstName, s.lastName, s.matricule));
  
  for (const s of tests.rows) {
    // Delete in order (FK constraints): audit logs, breakdowns, accounts, enrollments, photos, student
    await client.query('DELETE FROM student_audit_logs WHERE "studentId" = $1', [s.id]).catch(() => {});
    await client.query('DELETE FROM account_breakdowns WHERE "studentAccountId" IN (SELECT id FROM student_accounts WHERE "studentId" = $1)', [s.id]).catch(() => {});
    await client.query('DELETE FROM student_accounts WHERE "studentId" = $1', [s.id]).catch(() => {});
    await client.query('DELETE FROM student_enrollments WHERE "studentId" = $1', [s.id]).catch(() => {});
    await client.query('DELETE FROM student_photos WHERE "studentId" = $1', [s.id]).catch(() => {});
    await client.query('DELETE FROM student_guardians WHERE "studentId" = $1', [s.id]).catch(() => {});
    await client.query('DELETE FROM students WHERE id = $1', [s.id]).catch(() => {});
    console.log('  ✅ Deleted:', s.firstName, s.lastName);
  }
  
  await client.end();
  console.log('Done');
}
main().catch(e => { console.error(e.message); process.exit(1); });
