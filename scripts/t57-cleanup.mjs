/**
 * T57 — Nettoyage des données de test créées pendant le diagnostic.
 *
 * Entités à supprimer (créées le 2026-10-01 ~14:53-14:59 UTC) :
 *   1. Patronat QA T57 Nat mupnlqwr (BF, national) + tenant + user + annexes
 *   2. Patronat QA T57 Dept Centre (enfant BF) + tenant + année scolaire
 *   3. User QA T57 natcoord (membre créé DANS le patronat national RÉEL)
 *      + son lien patronat_users + ses sessions
 *   4. Session créée par l'emprunt temporaire du compte promoteur (14:59)
 *
 * Usage : node t57-cleanup.mjs          → dry-run
 *         node t57-cleanup.mjs EXECUTE  → purge réelle en transaction
 */
import pg from 'pg';

const EXECUTE = process.argv[2] === 'EXECUTE';

const NAT_PATRONAT_ID = '048980bf-4508-429d-95b2-dd041cf43f8c'; // QA T57 Nat (BF)
const CHILD_PATRONAT_ID = '655dbe57-1a32-4387-b2ac-fe2ac6c015c4'; // QA T57 Dept Centre
const NAT_TENANT = '639b5a00-815d-4287-be28-1c8e1bb96a44';
const CHILD_TENANT = 'feccf7bd-d227-4e27-8021-818830fd2200';
const NATCOORD_USER = '775eb6db-711d-4704-8ed5-a5a98ac04f54'; // dans le national RÉEL
const REAL_NATIONAL_TENANT = '97c57b3c-8d92-4d3f-b1c8-76c2f9c1c9ac';
const REAL_PROMOTER = '82b262e7-257f-43de-a7a6-e60cfd703056'; // dawesakpovi

const pool = new pg.Pool({
  connectionString:
    'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const patronatIds = [NAT_PATRONAT_ID, CHILD_PATRONAT_ID];
const tenantIds = [NAT_TENANT, CHILD_TENANT];

async function main() {
  const client = await pool.connect();
  try {
    // Sécurité : vérifier que les cibles sont bien les entités de test
    const check = await client.query(
      `SELECT id, name FROM patronats WHERE id = ANY($1) ORDER BY name`,
      [patronatIds],
    );
    for (const r of check.rows) console.log(`Cible patronat : ${r.name} (${r.id})`);
    if (!check.rows.every((r) => r.name.includes('T57'))) {
      throw new Error('Vérification de sécurité échouée — ABANDON (pas des patronats T57).');
    }
    const natcoord = await client.query(
      `SELECT email FROM users WHERE id = $1`,
      [NATCOORD_USER],
    );
    if (natcoord.rows[0] && !natcoord.rows[0].email.includes('t57')) {
      throw new Error('Vérification de sécurité échouée — ABANDON (user natcoord inattendu).');
    }
    console.log(`Cible user : ${natcoord.rows[0]?.email ?? '(déjà supprimé)'}\n`);

    const count = async (label, sql, params) => {
      const r = await client.query(sql, params);
      const n = parseInt(r.rows[0].n, 10);
      console.log(`  ${label} : ${n}`);
      return n;
    };

    console.log('=== DONNÉES QUI SERONT SUPPRIMÉES ===');
    await count(
      'users (tenants test)',
      `SELECT COUNT(*) AS n FROM users WHERE "tenantId" = ANY($1)`,
      [tenantIds],
    );
    await count(
      'sessions (users test)',
      `SELECT COUNT(*) AS n FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE "tenantId" = ANY($1))`,
      [tenantIds],
    );
    await count(
      'sessions (natcoord)',
      `SELECT COUNT(*) AS n FROM sessions WHERE "userId" = $1`,
      [NATCOORD_USER],
    );
    await count(
      'sessions (emprunt promoteur 14:59)',
      `SELECT COUNT(*) AS n FROM sessions WHERE "userId" = $1 AND "createdAt" > '2026-10-01 14:59:00'`,
      [REAL_PROMOTER],
    );
    await count(
      'patronat_users (patronats test)',
      `SELECT COUNT(*) AS n FROM patronat_users WHERE "patronatId" = ANY($1)`,
      [patronatIds],
    );
    await count(
      'patronat_users (natcoord, tenant national RÉEL)',
      `SELECT COUNT(*) AS n FROM patronat_users WHERE "userId" = $1 AND "tenantId" = $2`,
      [NATCOORD_USER, REAL_NATIONAL_TENANT],
    );
    await count(
      'patronat_bureau_members (test)',
      `SELECT COUNT(*) AS n FROM patronat_bureau_members WHERE "patronatId" = ANY($1)`,
      [patronatIds],
    );
    await count(
      'academic_years (tenants test)',
      `SELECT COUNT(*) AS n FROM academic_years WHERE "tenantId" = ANY($1)`,
      [tenantIds],
    );
    await count(
      'federis_invoices (test)',
      `SELECT COUNT(*) AS n FROM federis_invoices WHERE "patronatId" = ANY($1)`,
      [patronatIds],
    );
    await count(
      'audit_logs (tenants test)',
      `SELECT COUNT(*) AS n FROM audit_logs WHERE "tenant_id" = ANY($1)`,
      [tenantIds],
    );
    await count(
      'audit_logs (natcoord)',
      `SELECT COUNT(*) AS n FROM audit_logs WHERE "userId" = $1`,
      [NATCOORD_USER],
    );
    await count(
      'patronats (test)',
      `SELECT COUNT(*) AS n FROM patronats WHERE id = ANY($1)`,
      [patronatIds],
    );
    await count(
      'tenants (test)',
      `SELECT COUNT(*) AS n FROM tenants WHERE id = ANY($1)`,
      [tenantIds],
    );

    if (!EXECUTE) {
      console.log('\n🔍 DRY-RUN — rien supprimé. Relancez avec EXECUTE.');
      return;
    }

    console.log('\n=== PURGE (transaction) ===');
    await client.query('BEGIN');

    // Sessions des users de test + natcoord + emprunt promoteur
    await client.query(
      `DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE "tenantId" = ANY($1))`,
      [tenantIds],
    );
    await client.query(`DELETE FROM sessions WHERE "userId" = $1`, [NATCOORD_USER]);
    await client.query(
      `DELETE FROM sessions WHERE "userId" = $1 AND "createdAt" > '2026-10-01 14:59:00'`,
      [REAL_PROMOTER],
    );

    // Lien natcoord dans le patronat national RÉEL (AVANT de supprimer l'user)
    await client.query(
      `DELETE FROM patronat_users WHERE "userId" = $1 AND "tenantId" = $2`,
      [NATCOORD_USER, REAL_NATIONAL_TENANT],
    );

    // Factures/payments éventuels des patronats test
    await client.query(
      `DELETE FROM federis_payments WHERE "invoiceId" IN (SELECT id FROM federis_invoices WHERE "patronatId" = ANY($1))`,
      [patronatIds],
    );
    await client.query(`DELETE FROM federis_invoices WHERE "patronatId" = ANY($1)`, [
      patronatIds,
    ]);

    // Annexes des patronats test
    await client.query(`DELETE FROM patronat_bureau_members WHERE "patronatId" = ANY($1)`, [
      patronatIds,
    ]);
    await client.query(`DELETE FROM patronat_users WHERE "patronatId" = ANY($1)`, [patronatIds]);
    await client.query(`DELETE FROM patronat_schools WHERE "patronatId" = ANY($1)`, [patronatIds]);
    await client.query(`DELETE FROM audit_logs WHERE "tenant_id" = ANY($1)`, [tenantIds]);

    // Années scolaires + users des tenants test
    await client.query(`DELETE FROM academic_years WHERE "tenantId" = ANY($1)`, [tenantIds]);
    await client.query(`DELETE FROM users WHERE "tenantId" = ANY($1)`, [tenantIds]);

    // User natcoord (tenant national RÉEL)
    await client.query(`DELETE FROM audit_logs WHERE "userId" = $1`, [NATCOORD_USER]);
    await client.query(`DELETE FROM users WHERE id = $1`, [NATCOORD_USER]);

    // Patronats + tenants test
    await client.query(`DELETE FROM patronats WHERE id = ANY($1)`, [patronatIds]);
    await client.query(`DELETE FROM tenants WHERE id = ANY($1)`, [tenantIds]);

    await client.query('COMMIT');
    console.log('✅ Transaction validée.');

    // Vérification finale
    const remaining = await client.query(
      `SELECT name, "orgLevel" FROM patronats ORDER BY "createdAt"`,
    );
    console.log(`\n=== PATRONATS RESTANTS (${remaining.rows.length}) ===`);
    for (const r of remaining.rows) console.log(`  - ${r.name} (${r.orgLevel})`);
    const natMembers = await client.query(
      `SELECT u.email FROM patronat_users pu JOIN users u ON u.id = pu."userId" WHERE pu."tenantId" = $1`,
      [REAL_NATIONAL_TENANT],
    );
    console.log(
      `\nMembres du national réel : ${natMembers.rows.map((r) => r.email).join(', ')}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('ERREUR :', e.message);
  process.exit(1);
});
