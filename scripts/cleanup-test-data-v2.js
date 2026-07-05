/**
 * Nettoyage : soft-delete des élèves de test (trigger empêche DELETE physique)
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // 1. Trouver les élèves de test
  console.log('\n=== 1. Élèves de test ===');
  const testStudents = await client.query(`
    SELECT id, "firstName", "lastName", "tenantId"
    FROM students
    WHERE "firstName" ILIKE 'Test%' OR "lastName" ILIKE 'Diag%'
       OR ("firstName" = 'Test' AND "lastName" = 'Diagnostic')
  `);
  console.log(`Trouvés: ${testStudents.rows.length}`);
  for (const row of testStudents.rows) {
    console.log(`  ${row.firstname} ${row.lastname} | id=${row.id}`);
  }

  // 2. Désactiver (soft delete) — status = WITHDRAWN, is_active = false
  if (testStudents.rows.length > 0) {
    const testIds = testStudents.rows.map(r => r.id);
    console.log(`\n=== 2. Soft-delete de ${testIds.length} élève(s) ===`);

    // Désactiver les enrollments
    await client.query(`UPDATE student_enrollments SET status = 'WITHDRAWN' WHERE "studentId" = ANY($1::text[])`, [testIds]);
    console.log('  ✅ enrollments → WITHDRAWN');

    // Soft-delete students
    const result = await client.query(`
      UPDATE students
      SET status = 'WITHDRAWN', "isActive" = false
      WHERE id = ANY($1::text[])
      RETURNING id, "firstName", "lastName"
    `, [testIds]);
    console.log(`  ✅ ${result.rowCount} students → WITHDRAWN + isActive=false`);
    for (const row of result.rows) {
      console.log(`    - ${row.firstname} ${row.lastname}`);
    }
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

  // 5. Vérifier l'élève Akpovi Beroukhyah mentionné
  console.log('\n=== 5. Recherche Akpovi Beroukhyah ===');
  const akpovi = await client.query(`
    SELECT id, "firstName", "lastName", status, "isActive"
    FROM students
    WHERE "lastName" ILIKE '%Akpovi%' OR "firstName" ILIKE '%Beroukhyah%'
       OR "lastName" ILIKE '%Beroukhyah%' OR "firstName" ILIKE '%Akpovi%'
  `);
  console.log(`Trouvés: ${akpovi.rows.length}`);
  for (const row of akpovi.rows) {
    console.log(`  ${row.firstname} ${row.lastname} | status=${row.status} | active=${row.isactive}`);
  }

  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
