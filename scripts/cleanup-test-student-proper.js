/**
 * Suppression propre de l'élève de test :
 * 1. Désactiver le trigger trg_prevent_student_delete
 * 2. Supprimer proprement l'élève et ses dépendances
 * 3. Réactiver le trigger
 */
const { Client } = require('/home/z/my-project/node_modules/pg');
const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const testStudentId = '4c7c5e39-049e-4fe2-97db-06c5cfff2732';

  // 0. Vérifier que l'élève existe (même soft-deleté)
  console.log('=== 0. Vérification élève de test ===');
  const check = await client.query('SELECT id, "firstName", "lastName", status, "isActive" FROM students WHERE id = $1', [testStudentId]);
  if (check.rows.length === 0) {
    console.log('✅ Élève déjà supprimé — rien à faire');
    await client.end();
    return;
  }
  console.log(`  Trouvé: ${check.rows[0].firstname} ${check.rows[0].lastname} | status=${check.rows[0].status} | active=${check.rows[0].isactive}`);

  // 1. Désactiver le trigger
  console.log('\n=== 1. Désactivation trigger trg_prevent_student_delete ===');
  await client.query('ALTER TABLE students DISABLE TRIGGER trg_prevent_student_delete');
  console.log('  ✅ Trigger désactivé');

  try {
    // 2. Supprimer les dépendances
    console.log('\n=== 2. Suppression des dépendances ===');

    const sfp = await client.query('DELETE FROM student_fee_profiles WHERE "studentId" = $1 RETURNING id', [testStudentId]);
    console.log(`  - ${sfp.rowCount} student_fee_profiles`);

    const se = await client.query('DELETE FROM student_enrollments WHERE "studentId" = $1 RETURNING id', [testStudentId]);
    console.log(`  - ${se.rowCount} student_enrollments`);

    const sg = await client.query('DELETE FROM student_guardians WHERE "studentId" = $1 RETURNING id', [testStudentId]);
    console.log(`  - ${sg.rowCount} student_guardians`);

    const sar = await client.query('DELETE FROM student_academic_records WHERE "studentId" = $1 RETURNING id', [testStudentId]);
    console.log(`  - ${sar.rowCount} student_academic_records`);

    // Vérifier s'il y a des student_accounts
    const sa = await client.query('DELETE FROM student_accounts WHERE "studentId" = $1 RETURNING id', [testStudentId]);
    console.log(`  - ${sa.rowCount} student_accounts`);

    // 3. Supprimer l'élève
    console.log('\n=== 3. Suppression de l\'élève ===');
    const s = await client.query('DELETE FROM students WHERE id = $1 RETURNING id, "firstName", "lastName"', [testStudentId]);
    console.log(`  ✅ ${s.rowCount} élève supprimé: ${s.rows[0]?.firstname} ${s.rows[0]?.lastname}`);

  } finally {
    // 4. Réactiver le trigger (même en cas d'erreur)
    console.log('\n=== 4. Réactivation trigger trg_prevent_student_delete ===');
    await client.query('ALTER TABLE students ENABLE TRIGGER trg_prevent_student_delete');
    console.log('  ✅ Trigger réactivé');
  }

  // Vérification finale
  console.log('\n=== 5. Vérification finale ===');
  const finalCheck = await client.query('SELECT id FROM students WHERE id = $1', [testStudentId]);
  if (finalCheck.rows.length === 0) {
    console.log('  ✅ Élève de test définitivement supprimé');
  } else {
    console.log('  ⚠️ Élève encore présent');
  }

  // Vérifier que le trigger est bien réactivé
  const trigCheck = await client.query("SELECT tgenabled FROM pg_trigger WHERE tgname = 'trg_prevent_student_delete'");
  console.log(`  Trigger status: ${trigCheck.rows[0]?.tgenabled} (O = activé)`);

  await client.end();
}
main().catch(e => { console.error('Erreur:', e.message); process.exit(1); });
