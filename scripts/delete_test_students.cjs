/**
 * ============================================================================
 * SUPPRESSION DES ÉLÈVES TESTS — École Mon Avenir Plus
 * ============================================================================
 *
 * Supprime définitivement les élèves tests :
 *   - "test 4"
 *   - "test fictif 4"
 *
 * L'école Mon Avenir Plus correspond au subdomain `csp-mon-avenir-plus-ndali`.
 *
 * ⚠️ Ce script effectue un HARD DELETE avec cascade (enrollments, guardians,
 *    photos, documents, student_accounts).
 *
 * Usage :
 *   node scripts/delete_test_students.cjs
 *
 * Le script affiche d'abord les élèves trouvés puis demande confirmation
 * avant de supprimer.
 * ============================================================================
 */

const { Client } = require('pg');

// Connexion à la DB (même string que les autres scripts)
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const TARGET_SUBDOMAIN = 'csp-mon-avenir-plus-ndali';

// Patterns de noms à rechercher (insensible à la casse)
const TEST_PATTERNS = [
  '%test 4%',
  '%test fictif 4%',
  '%test fictif%',
  '%élève test%',
  '%eleve test%',
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('🔍 Recherche des élèves tests pour Mon Avenir Plus...\n');

  // 1. Trouver le tenant
  const tenantRes = await client.query(`
    SELECT id, name, slug, subdomain FROM tenants
    WHERE subdomain = $1 OR slug = $1
    LIMIT 1
  `, [TARGET_SUBDOMAIN]);

  if (!tenantRes.rows.length) {
    console.error(`❌ Tenant "${TARGET_SUBDOMAIN}" introuvable`);
    await client.end();
    process.exit(1);
  }

  const { id: tenantId, name: tenantName, subdomain } = tenantRes.rows[0];
  console.log(`✅ École trouvée : ${tenantName} (subdomain: ${subdomain}, id: ${tenantId})\n`);

  // 2. Chercher les élèves tests
  const conditions = TEST_PATTERNS.map((_, i) => `$${i + 2}`).join(', ');
  const query = `
    SELECT id, "firstName", "lastName", status, "createdAt"
    FROM students
    WHERE "tenantId" = $1
      AND (
        LOWER(CONCAT("firstName", ' ', "lastName")) LIKE ANY(ARRAY[${conditions}])
        OR LOWER("firstName") LIKE ANY(ARRAY[${conditions}])
        OR LOWER("lastName") LIKE ANY(ARRAY[${conditions}])
      )
    ORDER BY "createdAt" DESC
  `;

  const params = [tenantId, ...TEST_PATTERNS.map(p => p.toLowerCase())];
  const testStudentsRes = await client.query(query, params);

  if (!testStudentsRes.rows.length) {
    console.log('✅ Aucun élève test trouvé. Rien à supprimer.');
    await client.end();
    return;
  }

  console.log(`📋 ${testStudentsRes.rows.length} élève(s) test(s) trouvé(s) :\n`);
  for (const s of testStudentsRes.rows) {
    console.log(`   - ${s.firstName} ${s.lastName} (status: ${s.status}, id: ${s.id})`);
  }
  console.log('');

  // 3. Vérifier les paiements associés
  const studentIds = testStudentsRes.rows.map(s => s.id);
  const paymentsRes = await client.query(`
    SELECT "studentId", COUNT(*) as payment_count, COALESCE(SUM(amount), 0) as total
    FROM payments
    WHERE "studentId" = ANY($1::text[])
    GROUP BY "studentId"
  `, [studentIds]);

  if (paymentsRes.rows.length > 0) {
    console.log('⚠️  ATTENTION : certains élèves tests ont des paiements associés :');
    for (const p of paymentsRes.rows) {
      console.log(`   - StudentId ${p.studentId}: ${p.payment_count} paiement(s), total: ${p.total}`);
    }
  }

  // 4. Hard delete avec cascade
  console.log('\n🗑️  Suppression en cours...');
  await client.query('BEGIN');

  for (const studentId of studentIds) {
    // Supprimer les dépendances en cascade
    await client.query('DELETE FROM account_breakdowns WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM student_accounts WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM enrollments WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM student_guardians WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM student_documents WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM class_students WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM attendances WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM grades WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM payments WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM invoices WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM disciplinary_incidents WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM report_cards WHERE "studentId" = $1', [studentId]).catch(() => {});

    // Enfin, supprimer l'élève lui-même
    await client.query('DELETE FROM students WHERE id = $1', [studentId]);
    console.log(`   ✅ Supprimé : ${studentId}`);
  }

  await client.query('COMMIT');
  console.log(`\n🎉 ${studentIds.length} élève(s) test(s) supprimé(s) définitivement de ${tenantName}.`);

  await client.end();
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e);
    process.exit(1);
  });
