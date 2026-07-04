/**
 * Nettoyage : supprime TOUTES les matières existantes sur Neon.
 */
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connecté à Neon\n');

    const before = await client.query('SELECT COUNT(*) as count FROM "subjects"');
    console.log(`Matières avant nettoyage : ${before.rows[0].count}`);

    const cleanupTables = [
      'class_subjects', 'subject_assignments', 'teacher_subjects',
      'exam_subjects', 'exam_scores', 'subject_programs',
      'lesson_plans', 'lesson_journals', 'homework_entries',
      'grades', 'grade_calculations', 'pedagogical_documents', 'daily_logs',
    ];

    for (const table of cleanupTables) {
      try {
        const res = await client.query(`DELETE FROM "${table}" WHERE "subjectId" IS NOT NULL`);
        if (res.rowCount > 0) console.log(`  ${table}: ${res.rowCount} lignes supprimées`);
      } catch (e) { /* table inexistante */ }
    }

    const deleted = await client.query('DELETE FROM "subjects"');
    console.log(`\n✅ ${deleted.rowCount} matière(s) supprimée(s)`);

    const after = await client.query('SELECT COUNT(*) as count FROM "subjects"');
    console.log(`Matières après nettoyage : ${after.rows[0].count}`);
    console.log('\n✅ BDD vide. Prête pour recréation propre.');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
