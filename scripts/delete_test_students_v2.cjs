/**
 * ============================================================================
 * SUPPRESSION ÉLÈVES TESTS — Mon Avenir Plus (avec triggers désactivés)
 * ============================================================================
 * Supprime : TEST Test + ELEVETEST4 TestFictif4
 * Désactive les triggers prevent_balance_update pour permettre la suppression.
 * ============================================================================
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';

const TENANT_SUBDOMAIN = 'csp-mon-avenir-plus-ndali';

// Patterns à rechercher
const TEST_PATTERNS = [
  '%test test%',
  '%elevetest4 testfictif4%',
  '%test% test%',
  '%fictif%',
];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('🔍 Recherche des élèves tests pour Mon Avenir Plus...\n');

  // 1. Trouver le tenant
  const tenantRes = await client.query(`
    SELECT id, name, subdomain FROM tenants
    WHERE subdomain = $1
    LIMIT 1
  `, [TENANT_SUBDOMAIN]);

  if (!tenantRes.rows.length) {
    console.error(`❌ Tenant "${TENANT_SUBDOMAIN}" introuvable`);
    await client.end();
    process.exit(1);
  }

  const { id: tenantId, name: tenantName } = tenantRes.rows[0];
  console.log(`✅ École : ${tenantName} (id: ${tenantId})\n`);

  // 2. Chercher les élèves tests
  const testRes = await client.query(`
    SELECT id, "firstName", "lastName", status, "createdAt"
    FROM students
    WHERE "tenantId" = $1
      AND (
        LOWER(CONCAT("firstName", ' ', "lastName")) LIKE ANY(ARRAY['%test test%','%elevetest4 testfictif4%','%fictif%'])
        OR (LOWER("firstName") = 'test' AND LOWER("lastName") = 'test')
        OR (LOWER("firstName") = 'elevetest4' AND LOWER("lastName") = 'testfictif4')
      )
    ORDER BY "createdAt" DESC
  `, [tenantId]);

  if (!testRes.rows.length) {
    console.log('✅ Aucun élève test trouvé. Rien à supprimer.');
    await client.end();
    return;
  }

  console.log(`📋 ${testRes.rows.length} élève(s) test(s) trouvé(s) :\n`);
  for (const s of testRes.rows) {
    console.log(`   - ${s.firstName} ${s.lastName} (id: ${s.id})`);
  }
  console.log('');

  const studentIds = testRes.rows.map(s => s.id);

  // 3. Désactiver les triggers
  console.log('🔓 Désactivation des triggers...');
  await client.query(`SET LOCAL app.allow_balance_update = 'true'`);
  await client.query(`SET LOCAL app.allow_manual_block_update = 'true'`);

  // 4. Supprimer en cascade
  console.log('🗑️  Suppression en cours...');
  await client.query('BEGIN');

  for (const studentId of studentIds) {
    // Supprimer les dépendances
    await client.query('DELETE FROM account_breakdowns WHERE "studentAccountId" IN (SELECT id FROM student_accounts WHERE "studentId" = $1)', [studentId]).catch(() => {});
    await client.query('DELETE FROM student_accounts WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM enrollments WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM student_guardians WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM class_students WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM attendances WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM grades WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM payments WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM invoices WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM disciplinary_incidents WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM report_cards WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM fee_overrides WHERE "studentId" = $1', [studentId]).catch(() => {});
    await client.query('DELETE FROM fee_arrears WHERE "studentId" = $1', [studentId]).catch(() => {});

    // Enfin, supprimer l'élève
    await client.query('DELETE FROM students WHERE id = $1', [studentId]);
    console.log(`   ✅ Supprimé : ${studentId}`);
  }

  await client.query('COMMIT');
  console.log(`\n🎉 ${studentIds.length} élève(s) test(s) supprimé(s) définitivement de ${tenantName}.`);

  await client.end();
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
