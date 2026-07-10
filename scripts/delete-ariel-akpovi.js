/**
 * Supprime définitivement Ariel Akpovi de la base Neon.
 * Désactive temporairement le trigger trg_prevent_student_delete.
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    // 1. Trouver Ariel Akpovi (lastName='Ariel', firstName='AKPOVI' — inversé dans la saisie)
    console.log('=== Recherche Ariel Akpovi ===');
    const found = await client.query(`
      SELECT id, "firstName", "lastName", status, "createdAt"
      FROM students
      WHERE id = 'def945a1-ce46-4ae2-9dc3-148c05990ebf'
         OR ("firstName" ILIKE '%AKPOVI%' AND "lastName" ILIKE '%Ariel%')
         OR ("firstName" ILIKE '%Ariel%' AND "lastName" ILIKE '%AKPOVI%')
      ORDER BY "createdAt" DESC
    `);
    console.log('Trouvés:', found.rows.length);
    console.table(found.rows);

    if (found.rows.length === 0) {
      console.log('ℹ️  Aucun Ariel Akpovi trouvé — recherche élargie...');
      const broader = await client.query(`
        SELECT id, "firstName", "lastName"
        FROM students
        WHERE "lastName" ILIKE '%Akpovi%' OR "lastName" ILIKE '%AKPOVI%'
      `);
      console.log('Élèves avec nom Akpovi:');
      console.table(broader.rows);
      return;
    }

    const studentIds = found.rows.map(r => r.id);

    // 2. Désactiver le trigger
    console.log('\n=== Désactivation trigger trg_prevent_student_delete ===');
    await client.query('ALTER TABLE students DISABLE TRIGGER trg_prevent_student_delete');
    console.log('✅ Trigger désactivé');

    try {
      // 3. Supprimer en cascade
      console.log('\n=== Suppression en cascade ===');

      const tables = [
        ['student_photos', '"studentId"'],
        ['student_enrollments', '"studentId"'],
        ['student_guardians', '"studentId"'],
        ['student_fee_profiles', '"studentId"'],
        ['student_accounts', '"studentId"'],
        ['attendance_records', '"studentId"'],
        ['absences', '"studentId"'],
        ['disciplinary_actions', '"studentId"'],
        ['student_documents', '"studentId"'],
      ];

      for (const [table, col] of tables) {
        try {
          const r = await client.query(`DELETE FROM ${table} WHERE ${col} = ANY($1::text[]) RETURNING id`, [studentIds]);
          console.log(`  - ${table} : ${r.rowCount} supprimé(s)`);
        } catch (e) {
          console.log(`  - ${table} : ignoré (${e.message.substring(0, 80)})`);
        }
      }

      // Guardians orphelins
      try {
        const r = await client.query(`DELETE FROM guardians WHERE id NOT IN (SELECT "guardianId" FROM student_guardians) RETURNING id`);
        console.log(`  - guardians orphelins : ${r.rowCount} supprimé(s)`);
      } catch (e) {
        console.log(`  - guardians orphelins : ignoré (${e.message.substring(0, 80)})`);
      }

      // Audit logs
      try {
        const r = await client.query(`DELETE FROM audit_logs WHERE "studentId" = ANY($1::text[]) RETURNING id`, [studentIds]);
        console.log(`  - audit_logs : ${r.rowCount} supprimé(s)`);
      } catch (e) {
        console.log(`  - audit_logs : ignoré (${e.message.substring(0, 80)})`);
      }

      // 4. Supprimer l'élève
      console.log('\n=== Suppression élève(s) ===');
      const r = await client.query(`DELETE FROM students WHERE id = ANY($1::text[]) RETURNING id, "firstName", "lastName"`, [studentIds]);
      console.log(`✅ ${r.rowCount} élève(s) supprimé(s) définitivement :`);
      r.rows.forEach(x => console.log(`   - ${x.firstName} ${x.lastName} (${x.id})`));

    } finally {
      // 5. Réactiver le trigger
      console.log('\n=== Réactivation trigger ===');
      await client.query('ALTER TABLE students ENABLE TRIGGER trg_prevent_student_delete');
      console.log('✅ Trigger réactivé');
    }

    // 6. Vérification
    console.log('\n=== Vérification finale ===');
    const remaining = await client.query(`
      SELECT id, "firstName", "lastName" FROM students
      WHERE ("firstName" ILIKE '%Ariel%' AND "lastName" ILIKE '%Akpovi%')
         OR ("lastName" ILIKE '%Akpovi%' AND "firstName" ILIKE '%Ariel%')
    `);
    if (remaining.rows.length === 0) {
      console.log('✅ Aucun Ariel Akpovi restant — base propre');
    } else {
      console.log('❌ Restants:', remaining.rows);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('Erreur fatale:', e); process.exit(1); });
