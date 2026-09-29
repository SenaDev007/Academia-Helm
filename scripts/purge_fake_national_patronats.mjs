/**
 * Purge des patronats nationaux FICTIFS (données de test E2E) — production Neon
 *
 * Contexte : les validations E2E des sessions précédentes ont créé 14 patronats
 * nationaux de test pour le Bénin (TESTQA, Zébu QA, Verify QA, …) qui polluent
 * le sélecteur « Patronat national de rattachement » de /federis/register.
 *
 * Règle métier (utilisateur) : UN SEUL patronat national par pays. Le vrai
 * patronat national du Bénin est « Patronat des Établissements Scolaires
 * Privés du Bénin » — il est conservé.
 *
 * Usage :
 *   node scripts/purge_fake_patronats.mjs          → dry-run (aucune suppression)
 *   node scripts/purge_fake_patronats.mjs EXECUTE  → purge réelle en transaction
 */
import pg from 'pg';
import crypto from 'crypto';

const REAL_PATRONAT_ID = '62df0f31-94bc-4260-886d-d7ee255d964f';
const EXECUTE = process.argv[2] === 'EXECUTE';

const pool = new pg.Pool({
  connectionString:
    'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function main() {
  const client = await pool.connect();
  try {
    // ── 0. Vérification préalable : le vrai patronat national est bien celui attendu
    const real = await client.query(
      `SELECT p."id", p."name", p."status", p."subscriptionStatus", t."subdomain"
       FROM patronats p LEFT JOIN tenants t ON t."id" = p."tenantId"
       WHERE p."id" = $1`,
      [REAL_PATRONAT_ID],
    );
    if (real.rows.length === 0) {
      throw new Error('Le patronat national RÉEL est introuvable — ABANDON (sécurité).');
    }
    console.log(
      `✅ Patronat national RÉEL conservé : « ${real.rows[0].name} » (sub=${real.rows[0].subscriptionStatus}, sous-domaine=${real.rows[0].subdomain ?? '—'})`,
    );

    // ── 1. Identification des fictifs : tous les NATIONAL du Bénin sauf le vrai
    const fakes = await client.query(`
      SELECT p."id", p."name", p."tenantId"
      FROM patronats p
      WHERE p."id" != $1
        AND NOT EXISTS (
          SELECT 1 FROM patronats ch
          WHERE ch."parentPatronatId" = p."id"
        )
      ORDER BY p."createdAt"
    `, [REAL_PATRONAT_ID]);
    const fakeIds = fakes.rows.map((r) => r.id);
    const tenantIds = fakes.rows.map((r) => r.tenantId).filter(Boolean);

    console.log(`\n${fakeIds.length} patronats fictifs identifiés :`);
    for (const f of fakes.rows) console.log(`  - ${f.name} (${f.id})`);

    if (fakeIds.length === 0) {
      console.log('Rien à purger.');
      await pool.end();
      return;
    }

    // ── 2. Comptage de tout ce qui sera supprimé (dry-run + audit)
    const count = async (label, sql, params) => {
      const r = await client.query(sql, params);
      const n = parseInt(r.rows[0].n, 10);
      console.log(`  ${label} : ${n}`);
      return n;
    };
    console.log('\n=== DONNÉES QUI SERONT SUPPRIMÉES ===');
    await count('federis_payments', `SELECT COUNT(*) AS n FROM federis_payments fp WHERE fp."invoiceId" IN (SELECT fi."id" FROM federis_invoices fi WHERE fi."patronatId" = ANY($1))`, [fakeIds]);
    await count('federis_invoices', `SELECT COUNT(*) AS n FROM federis_invoices fi WHERE fi."patronatId" = ANY($1)`, [fakeIds]);
    await count('patronat_bureau_members', `SELECT COUNT(*) AS n FROM patronat_bureau_members pbm WHERE pbm."patronatId" = ANY($1)`, [fakeIds]);
    await count('patronat_users', `SELECT COUNT(*) AS n FROM patronat_users pu WHERE pu."patronatId" = ANY($1)`, [fakeIds]);
    await count('patronat_schools', `SELECT COUNT(*) AS n FROM patronat_schools ps WHERE ps."patronatId" = ANY($1)`, [fakeIds]);
    await count('question_bank_resources', `SELECT COUNT(*) AS n FROM question_bank_resources qbr WHERE qbr."patronatId" = ANY($1)`, [fakeIds]);
    await count('national_exams', `SELECT COUNT(*) AS n FROM national_exams ne WHERE ne."patronatId" = ANY($1)`, [fakeIds]);
    await count('sessions', `SELECT COUNT(*) AS n FROM sessions s WHERE s."userId" IN (SELECT u."id" FROM users u WHERE u."tenantId" = ANY($1))`, [tenantIds]);
    await count('audit_logs', `SELECT COUNT(*) AS n FROM audit_logs al WHERE al."tenant_id" = ANY($1)`, [tenantIds]);
    await count('academic_years', `SELECT COUNT(*) AS n FROM academic_years ay WHERE ay."tenantId" = ANY($1)`, [tenantIds]);
    await count('users', `SELECT COUNT(*) AS n FROM users u WHERE u."tenantId" = ANY($1)`, [tenantIds]);
    await count('tenant_domains', `SELECT COUNT(*) AS n FROM tenant_domains td WHERE td."tenantId" = ANY($1)`, [tenantIds]);
    await count('patronats', `SELECT COUNT(*) AS n FROM patronats p WHERE p."id" = ANY($1)`, [fakeIds]);
    await count('tenants', `SELECT COUNT(*) AS n FROM tenants t WHERE t."id" = ANY($1)`, [tenantIds]);

    if (!EXECUTE) {
      console.log('\n🔍 DRY-RUN — rien n’a été supprimé. Relancez avec EXECUTE pour purger.');
      return;
    }

    // ── 3. Purge en transaction (tout ou rien)
    console.log('\n=== PURGE (transaction) ===');
    await client.query('BEGIN');

    // 3a. Paiements puis factures (FK RESTRICT)
    await client.query(`DELETE FROM federis_payments fp WHERE fp."invoiceId" IN (SELECT fi."id" FROM federis_invoices fi WHERE fi."patronatId" = ANY($1))`, [fakeIds]);
    await client.query(`DELETE FROM federis_invoices fi WHERE fi."patronatId" = ANY($1)`, [fakeIds]);

    // 3b. Membres du bureau (CASCADE de toute façon), liens, annexes
    await client.query(`DELETE FROM patronat_bureau_members pbm WHERE pbm."patronatId" = ANY($1)`, [fakeIds]);
    await client.query(`DELETE FROM patronat_users pu WHERE pu."patronatId" = ANY($1)`, [fakeIds]);
    await client.query(`DELETE FROM patronat_schools ps WHERE ps."patronatId" = ANY($1)`, [fakeIds]);
    await client.query(`DELETE FROM question_bank_resources qbr WHERE qbr."patronatId" = ANY($1)`, [fakeIds]);
    await client.query(`DELETE FROM national_exams ne WHERE ne."patronatId" = ANY($1)`, [fakeIds]);

    // 3c. Sessions des utilisateurs de test
    await client.query(`DELETE FROM sessions s WHERE s."userId" IN (SELECT u."id" FROM users u WHERE u."tenantId" = ANY($1))`, [tenantIds]);

    // 3d. Audit logs + années scolaires + utilisateurs des tenants de test
    await client.query(`DELETE FROM audit_logs al WHERE al."tenant_id" = ANY($1)`, [tenantIds]);
    await client.query(`DELETE FROM academic_years ay WHERE ay."tenantId" = ANY($1)`, [tenantIds]);
    await client.query(`DELETE FROM users u WHERE u."tenantId" = ANY($1)`, [tenantIds]);

    // 3e. Patronats fictifs
    await client.query(`DELETE FROM patronats p WHERE p."id" = ANY($1)`, [fakeIds]);

    // 3f. Domaines + tenants de test
    await client.query(`DELETE FROM tenant_domains td WHERE td."tenantId" = ANY($1)`, [tenantIds]);
    await client.query(`DELETE FROM tenants t WHERE t."id" = ANY($1)`, [tenantIds]);

    await client.query('COMMIT');
    console.log('✅ Transaction validée.');

    // ── 4. Vérification post-purge
    const remaining = await client.query(`
      SELECT p."id", p."name", p."orgLevel", p."status"
      FROM patronats p ORDER BY p."createdAt"
    `);
    console.log(`\n=== PATRONATS RESTANTS (${remaining.rows.length}) ===`);
    for (const r of remaining.rows) {
      console.log(`  - ${r.name} (${r.orgLevel}, ${r.status})`);
    }
    const nationals = remaining.rows.filter((r) => r.orgLevel === 'NATIONAL');
    if (nationals.length !== 1) {
      console.log(`⚠️ Il reste ${nationals.length} patronats nationaux (attendu : 1).`);
    } else {
      console.log('✅ Un unique patronat national reste en base — règle « 1 national par pays » respectée.');
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
      console.error('❌ ERREUR — ROLLBACK effectué :', err.message);
    } catch (rbErr) {
      console.error('❌ ERREUR (rollback impossible) :', err.message);
    }
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
