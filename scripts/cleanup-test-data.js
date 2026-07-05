/**
 * Nettoyage : supprimer les données de test insérées pendant le diagnostic
 * - Élève "Test Diagnostic" (prénom=Test, nom=Diagnostic)
 * - Élève "Test2 Diag2"
 * - Élève "Test3 Diag3"
 * - Élève "Akpovi Beroukhyah" créé par erreur (à vérifier)
 * - Niveau primaire en double (si créé)
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // 1. Trouver les élèves de test
  console.log('\n=== 1. Élèves de test (Test* / Diag*) ===');
  const testStudents = await client.query(`
    SELECT id, "firstName", "lastName", "tenantId", "createdAt"
    FROM students
    WHERE "firstName" ILIKE 'Test%' OR "lastName" ILIKE 'Diag%'
       OR ("firstName" = 'Test' AND "lastName" = 'Diagnostic')
    ORDER BY "createdAt" DESC
  `);
  for (const row of testStudents.rows) {
    console.log(`  ${row.firstname} ${row.lastname} | id=${row.id} | created=${row.createdat}`);
  }

  // 2. Supprimer leurs enrollments, guardians, fee profiles, puis l'élève
  if (testStudents.rows.length > 0) {
    const testIds = testStudents.rows.map(r => r.id);
    console.log(`\n=== 2. Suppression de ${testIds.length} élève(s) de test ===`);

    // Supprimer les student_fee_profiles
    const sfp = await client.query(`DELETE FROM student_fee_profiles WHERE "studentId" = ANY($1::text[]) RETURNING id`, [testIds]);
    console.log(`  - ${sfp.rowCount} student_fee_profiles supprimés`);

    // Supprimer les student_enrollments
    const se = await client.query(`DELETE FROM student_enrollments WHERE "studentId" = ANY($1::text[]) RETURNING id`, [testIds]);
    console.log(`  - ${se.rowCount} student_enrollments supprimés`);

    // Supprimer les student_guardians (liaisons)
    const sg = await client.query(`DELETE FROM student_guardians WHERE "studentId" = ANY($1::text[]) RETURNING id`, [testIds]);
    console.log(`  - ${sg.rowCount} student_guardians supprimés`);

    // Supprimer les student_academic_records
    const sar = await client.query(`DELETE FROM student_academic_records WHERE "studentId" = ANY($1::text[]) RETURNING id`, [testIds]);
    console.log(`  - ${sar.rowCount} student_academic_records supprimés`);

    // Supprimer les students
    const s = await client.query(`DELETE FROM students WHERE id = ANY($1::text[]) RETURNING id`, [testIds]);
    console.log(`  - ${s.rowCount} students supprimés`);
  }

  // 3. Vérifier les niveaux education_levels en double
  console.log('\n=== 3. education_levels (tous) ===');
  const el = await client.query('SELECT id, name, "isEnabled" FROM education_levels ORDER BY name');
  for (const row of el.rows) {
    console.log(`  ${row.name} | id=${row.id} | enabled=${row.isenabled}`);
  }

  // 4. Vérifier les school_levels en double
  console.log('\n=== 4. school_levels (tous) ===');
  const sl = await client.query('SELECT id, code, name FROM school_levels ORDER BY code');
  for (const row of sl.rows) {
    console.log(`  ${row.code} | id=${row.id} | name=${row.name}`);
  }

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
