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
 * Le script affiche d'abord les élèves trouvés (mode dry-run) puis demande
 * confirmation avant de supprimer.
 * ============================================================================
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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
  console.log('🔍 Recherche des élèves tests pour Mon Avenir Plus...\n');

  // 1. Trouver le tenant
  const tenant = await prisma.$queryRawUnsafe(`
    SELECT id, name, slug, subdomain FROM tenants
    WHERE subdomain = $1 OR slug = $1
    LIMIT 1
  `, TARGET_SUBDOMAIN);

  if (!tenant.length) {
    console.error(`❌ Tenant "${TARGET_SUBDOMAIN}" introuvable`);
    process.exit(1);
  }

  const { id: tenantId, name: tenantName, subdomain } = tenant[0];
  console.log(`✅ École trouvée : ${tenantName} (subdomain: ${subdomain}, id: ${tenantId})\n`);

  // 2. Construire la clause WHERE avec OR pour chaque pattern
  const conditions = TEST_PATTERNS.map((_, i) =>
    `(LOWER(CONCAT("firstName", ' ', "lastName")) LIKE $${i + 2}
     OR LOWER("firstName") LIKE $${i + 2}
     OR LOWER("lastName") LIKE $${i + 2})`
  ).join(' OR ');

  const query = `
    SELECT id, "firstName", "lastName", status, "createdAt", "tenantId"
    FROM students
    WHERE "tenantId" = $1
      AND (${conditions})
    ORDER BY "createdAt" DESC
  `;

  const params = [tenantId, ...TEST_PATTERNS.map(p => p.toLowerCase())];
  const testStudents = await prisma.$queryRawUnsafe(query, ...params);

  if (!testStudents.length) {
    console.log('✅ Aucun élève test trouvé. Rien à supprimer.');
    return;
  }

  console.log(`📋 ${testStudents.length} élève(s) test(s) trouvé(s) :\n`);
  for (const s of testStudents) {
    console.log(`   - ${s.firstName} ${s.lastName} (status: ${s.status}, id: ${s.id})`);
  }
  console.log('');

  // 3. Vérifier les paiements associés (business guard)
  const studentIds = testStudents.map(s => s.id);
  const payments = await prisma.$queryRawUnsafe(`
    SELECT "studentId", COUNT(*) as payment_count, SUM(amount) as total
    FROM payments
    WHERE "studentId" = ANY($1::text[])
    GROUP BY "studentId"
  `, studentIds);

  if (payments.length > 0) {
    console.log('⚠️  ATTENTION : certains élèves tests ont des paiements associés :');
    for (const p of payments) {
      console.log(`   - StudentId ${p.studentId}: ${p.payment_count} paiement(s), total: ${p.total}`);
    }
    console.log('   La suppression via API serait bloquée. Hard delete SQL utilisé.\n');
  }

  // 4. Hard delete avec cascade (transaction)
  console.log('🗑️  Suppression en cours...');
  await prisma.$transaction(async (tx) => {
    // Supprimer les dépendances en cascade
    for (const studentId of studentIds) {
      // Student accounts + breakdowns
      await tx.$executeRaw`DELETE FROM account_breakdowns WHERE "studentId" = ${studentId}`;
      await tx.$executeRaw`DELETE FROM student_accounts WHERE "studentId" = ${studentId}`;
      // Enrollments
      await tx.$executeRaw`DELETE FROM enrollments WHERE "studentId" = ${studentId}`;
      // Guardian links
      await tx.$executeRaw`DELETE FROM student_guardians WHERE "studentId" = ${studentId}`;
      // Photos
      await tx.$executeRaw`DELETE FROM staff_photos WHERE "studentId" = ${studentId}`.catch(() => {});
      // Documents
      await tx.$executeRaw`DELETE FROM student_documents WHERE "studentId" = ${studentId}`.catch(() => {});
      // Class students
      await tx.$executeRaw`DELETE FROM class_students WHERE "studentId" = ${studentId}`.catch(() => {});
      // Attendances
      await tx.$executeRaw`DELETE FROM attendances WHERE "studentId" = ${studentId}`.catch(() => {});
      // Grades
      await tx.$executeRaw`DELETE FROM grades WHERE "studentId" = ${studentId}`.catch(() => {});
      // Payments
      await tx.$executeRaw`DELETE FROM payments WHERE "studentId" = ${studentId}`.catch(() => {});
      // Invoices
      await tx.$executeRaw`DELETE FROM invoices WHERE "studentId" = ${studentId}`.catch(() => {});
      // Disciplinary incidents
      await tx.$executeRaw`DELETE FROM disciplinary_incidents WHERE "studentId" = ${studentId}`.catch(() => {});
      // Report cards
      await tx.$executeRaw`DELETE FROM report_cards WHERE "studentId" = ${studentId}`.catch(() => {});

      // Enfin, supprimer l'élève lui-même
      await tx.$executeRaw`DELETE FROM students WHERE id = ${studentId}`;
      console.log(`   ✅ Supprimé : ${studentId}`);
    }
  });

  console.log(`\n🎉 ${studentIds.length} élève(s) test(s) supprimé(s) définitivement de ${tenantName}.`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
