import pg from 'pg';
const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log('⚠️  SUPPRESSION DE TOUTES LES DONNÉES DU MODULE EXAMEN');
console.log('Cette opération est IRRÉVERSIBLE.\n');

// List of tables to clear (exam-related data only)
const tablesToDelete = [
  // Grades & evaluations
  'grades',
  'evaluations',
  // Report cards & bulletins
  'report_card_items',
  'report_cards',
  // Class councils
  'class_councils',
  // Exam unlock requests
  'exam_unlock_requests',
  // Averages (calculated)
  'student_period_averages',
  'student_subject_averages',
  // Bulletin annotations (stored in report_cards but also separate)
  // Note: report_cards already covered above
];

for (const table of tablesToDelete) {
  try {
    // First count
    const count = await client.query(`SELECT COUNT(*)::int n FROM "${table}"`);
    console.log(`  ${table}: ${count.rows[0].n} enregistrements`);

    // Delete all
    const result = await client.query(`DELETE FROM "${table}"`);
    console.log(`    → ${result.rowCount} supprimés ✅`);
  } catch (e) {
    console.log(`  ${table}: table non trouvée ou erreur — ${e.message}`);
  }
}

// Also delete institutional exam data
const institutionalTables = [
  'institutional_exams_grades',
  'institutional_exams_evaluations',
];
for (const table of institutionalTables) {
  try {
    const count = await client.query(`SELECT COUNT(*)::int n FROM "${table}"`);
    console.log(`  ${table}: ${count.rows[0].n} enregistrements`);
    const result = await client.query(`DELETE FROM "${table}"`);
    console.log(`    → ${result.rowCount} supprimés ✅`);
  } catch (e) {
    console.log(`  ${table}: table non trouvée — skip`);
  }
}

// Verify
console.log('\n=== Vérification post-suppression ===');
for (const table of tablesToDelete) {
  try {
    const count = await client.query(`SELECT COUNT(*)::int n FROM "${table}"`);
    console.log(`  ${table}: ${count.rows[0].n} (devrait être 0)`);
  } catch {}
}

await client.end();
console.log('\n✅ Suppression terminée.');
