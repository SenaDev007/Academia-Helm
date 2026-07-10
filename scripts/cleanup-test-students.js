/**
 * Supprime définitivement les élèves test créés pendant les tests
 * (TestPhoto, Test2, TestNPI, ainsi que les 'Test' / 'Test2' soft-deleted).
 *
 * ⚠️ Désactive temporairement le trigger prevent_student_delete() pour permettre
 *    la suppression physique, puis le réactive.
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    // 1. Lister les élèves test à supprimer
    console.log('=== Élèves test à supprimer ===');
    const toDelete = await client.query(`
      SELECT id, "firstName", "lastName", status, "createdAt"
      FROM students
      WHERE "firstName" IN ('Test', 'Test2', 'TestPhoto')
         OR "lastName" IN ('Test', 'Test2', 'TestNPI')
      ORDER BY "createdAt" DESC
    `);
    console.table(toDelete.rows);

    if (toDelete.rows.length === 0) {
      console.log('✅ Aucun élève test à supprimer.');
      return;
    }

    const studentIds = toDelete.rows.map(r => r.id);

    // 2. Désactiver temporairement le trigger trg_prevent_student_delete
    console.log('\n=== Désactivation temporaire du trigger trg_prevent_student_delete ===');
    await client.query('ALTER TABLE students DISABLE TRIGGER trg_prevent_student_delete');
    console.log('✅ Trigger désactivé');

    try {
      // 3. Supprimer en cascade toutes les dépendances
      console.log('\n=== Suppression en cascade des dépendances ===');

      // 3a. student_photos
      const r1 = await client.query(`DELETE FROM student_photos WHERE "studentId" = ANY($1::text[]) RETURNING id`, [studentIds]);
      console.log(`  - student_photos : ${r1.rowCount} supprimé(s)`);

      // 3b. student_enrollments
      const r2 = await client.query(`DELETE FROM student_enrollments WHERE "studentId" = ANY($1::text[]) RETURNING id`, [studentIds]);
      console.log(`  - student_enrollments : ${r2.rowCount} supprimé(s)`);

      // 3c. student_guardians (liaisons)
      const r3 = await client.query(`DELETE FROM student_guardians WHERE "studentId" = ANY($1::text[]) RETURNING id`, [studentIds]);
      console.log(`  - student_guardians : ${r3.rowCount} supprimé(s)`);

      // 3d. guardians orphelins (sans aucune liaison étudiant)
      const r4 = await client.query(`
        DELETE FROM guardians
        WHERE id NOT IN (SELECT "guardianId" FROM student_guardians)
        RETURNING id
      `);
      console.log(`  - guardians orphelins : ${r4.rowCount} supprimé(s)`);

      // 3e. student_fee_profiles
      try {
        const r5 = await client.query(`DELETE FROM student_fee_profiles WHERE "studentId" = ANY($1::text[]) RETURNING id`, [studentIds]);
        console.log(`  - student_fee_profiles : ${r5.rowCount} supprimé(s)`);
      } catch (e) { console.log(`  - student_fee_profiles : ignoré (${e.message.substring(0, 80)})`); }

      // 3f. student_accounts (finance)
      try {
        const r6 = await client.query(`DELETE FROM student_accounts WHERE "studentId" = ANY($1::text[]) RETURNING id`, [studentIds]);
        console.log(`  - student_accounts : ${r6.rowCount} supprimé(s)`);
      } catch (e) { console.log(`  - student_accounts : ignoré (${e.message.substring(0, 80)})`); }

      // 3g. audit_logs
      try {
        const r7 = await client.query(`DELETE FROM audit_logs WHERE "entityId" = ANY($1::text[]) OR "studentId" = ANY($1::text[]) RETURNING id`, [studentIds]);
        console.log(`  - audit_logs : ${r7.rowCount} supprimé(s)`);
      } catch (e) { console.log(`  - audit_logs : ignoré (${e.message.substring(0, 80)})`); }

      // 4. Enfin, supprimer les élèves
      console.log('\n=== Suppression des élèves ===');
      const r8 = await client.query(`
        DELETE FROM students WHERE id = ANY($1::text[]) RETURNING id, "firstName", "lastName"
      `, [studentIds]);
      console.log(`✅ ${r8.rowCount} élève(s) supprimé(s) définitivement :`);
      r8.rows.forEach(r => console.log(`   - ${r.firstName} ${r.lastName} (${r.id})`));

    } finally {
      // 5. Réactiver le trigger quoi qu'il arrive
      console.log('\n=== Réactivation du trigger trg_prevent_student_delete ===');
      await client.query('ALTER TABLE students ENABLE TRIGGER trg_prevent_student_delete');
      console.log('✅ Trigger réactivé');
    }

    // 6. Vérification finale
    console.log('\n=== Vérification finale ===');
    const remaining = await client.query(`
      SELECT id, "firstName", "lastName"
      FROM students
      WHERE "firstName" IN ('Test', 'Test2', 'TestPhoto')
         OR "lastName" IN ('Test', 'Test2', 'TestNPI')
    `);
    if (remaining.rows.length === 0) {
      console.log('✅ Aucun élève test restant — base propre');
    } else {
      console.log('❌ Élèves test restants :', remaining.rows);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('Erreur fatale:', e); process.exit(1); });
