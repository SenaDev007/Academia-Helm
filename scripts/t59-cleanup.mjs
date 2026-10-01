/**
 * T59 — Nettoyage des données de test.
 *
 * Cibles (TOUTES vérifiées par nom/email avant exécution) :
 *   1. Compte QA t59 (créé par t59-login-diag.mjs dans le national RÉEL) :
 *      user + lien patronat_users + sessions.
 *   2. Trois patronats QA résiduels (enfants du national réel, créés pendant
 *      les sessions de dev des 28-30/09 — jamais nettoyés) :
 *      « Patronat QA Design Atlantique », « Patronat QA Perf muntt9d5 »,
 *      « Patronat QA Browser muntxfl1 » + tenants + users (@academiahelm.test)
 *      + années scolaires + sessions + dépendants (bureau, écoles, examens…).
 *
 * Ils polluent la grille des départements du patronat national (module T58) :
 *      le promoteur verrait 3 faux « Atlantique » alongside le vrai Borgou.
 *
 * Usage : node t59-cleanup.mjs          → dry-run (aucune écriture)
 *         node t59-cleanup.mjs EXECUTE  → purge réelle en transaction
 *
 * INTOUCHABLES (vérifiés après commit) : promoteur dawesakpovi, patronat
 * national réel, patronat du Borgou, tout le reste.
 */
import pg from 'pg';

const EXECUTE = process.argv[2] === 'EXECUTE';
const NEON =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const NAT_PATRONAT = '62df0f31-94bc-4260-886d-d7ee255d964f'; // national réel
const REAL_PROMOTER = '82b262e7-257f-43de-a7a6-e60cfd703056'; // dawesakpovi
const T59_USER = 'c2923424-ce8a-4d50-8705-7ba4342e261d'; // qa.t59.natcoord…

/** Tables référençant les patronats (cf. t59-tables.mjs) + leur(s) colonne(s). */
const PATRONAT_REF_TABLES = [
  'federis_communities',
  'federis_conversations',
  'federis_exam_papers',
  'federis_groups',
  'federis_inter_patronat_connections',
  'federis_invoices',
  'federis_official_notices',
  'national_exams',
  'patronat_bureau_members',
  'patronat_manual_schools',
  'patronat_schools',
  'patronat_users',
  'question_bank_resources',
  'school_releve_dispatches',
];
const PATRONAT_REF_COLS = ['patronatId', 'parentPatronatId', 'ownerPatronatId', 'receiverPatronatId', 'requesterPatronatId'];

const pool = new pg.Pool({ connectionString: NEON, ssl: { rejectUnauthorized: false }, max: 1 });
const c = await pool.connect();

async function verifyTargets() {
  const pats = await c.query(
    `SELECT id, name, "tenantId" FROM patronats
     WHERE "parentPatronatId" = $1 AND name ILIKE '%QA%'`,
    [NAT_PATRONAT],
  );
  if (pats.rows.length !== 3)
    throw new Error(`Attendu 3 patronats QA, trouvé ${pats.rows.length} — ABANDON.`);
  for (const p of pats.rows)
    if (!p.name.includes('QA') || !p.tenantId)
      throw new Error(`Patronat ${p.name} invalide — ABANDON.`);

  const qaPatronatIds = pats.rows.map((r) => r.id);
  const qaTenantIds = pats.rows.map((r) => r.tenantId);

  const links = await c.query(
    `SELECT u.id, u.email FROM patronat_users pu JOIN users u ON u.id = pu."userId"
     WHERE pu."patronatId" = ANY($1) OR u.id = $2`,
    [qaPatronatIds, T59_USER],
  );
  for (const u of links.rows)
    if (!u.email.endsWith('@academiahelm.test'))
      throw new Error(`User ${u.email} n'est pas un compte de test — ABANDON.`);

  const userIds = links.rows.map((r) => r.id);
  if (!userIds.includes(T59_USER)) throw new Error('compte t59 introuvable — ABANDON.');

  return { qaPatronatIds, qaTenantIds, userIds };
}

/** Compte les dépendants : chaque table patronat-réf + sessions/années. */
async function buildPlan(qaPatronatIds, qaTenantIds, userIds) {
  const plan = [];
  // Tables référençant les patronats — détecter la(les) colonne(s) réelle(s)
  for (const table of PATRONAT_REF_TABLES) {
    const cols = await c.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name = ANY($2)`,
      [table, PATRONAT_REF_COLS],
    );
    for (const col of cols.rows) {
      const r = await c.query(
        `SELECT count(*)::int n FROM ${table} WHERE "${col.column_name}" = ANY($1)`,
        [qaPatronatIds],
      );
      if (r.rows[0].n > 0)
        plan.push({ table, column: col.column_name, ids: qaPatronatIds, n: r.rows[0].n });
    }
  }
  // Sessions par userId
  const sess = await c.query(`SELECT count(*)::int n FROM sessions WHERE "userId" = ANY($1)`, [userIds]);
  if (sess.rows[0].n > 0) plan.push({ table: 'sessions', column: 'userId', ids: userIds, n: sess.rows[0].n });
  // ⭐ Liens patronat_users PAR USER (le compte t59 pointe vers le NATIONAL,
  //    pas vers un patronat QA — le filtre par patronatId ne le couvre pas).
  const linksByUser = await c.query(
    `SELECT count(*)::int n FROM patronat_users WHERE "userId" = ANY($1)`,
    [userIds],
  );
  if (linksByUser.rows[0].n > 0)
    plan.push({ table: 'patronat_users', column: 'userId', ids: userIds, n: linksByUser.rows[0].n });
  // Années scolaires par tenantId
  const years = await c.query(`SELECT count(*)::int n FROM academic_years WHERE "tenantId" = ANY($1)`, [
    qaTenantIds,
  ]);
  if (years.rows[0].n > 0)
    plan.push({ table: 'academic_years', column: 'tenantId', ids: qaTenantIds, n: years.rows[0].n });
  return plan;
}

try {
  const { qaPatronatIds, qaTenantIds, userIds } = await verifyTargets();
  console.log(`✅ Cibles vérifiées : 3 patronats QA, ${qaTenantIds.length} tenants, ${userIds.length} users de test`);

  const plan = await buildPlan(qaPatronatIds, qaTenantIds, userIds);
  console.log('\n── Dépendants à supprimer ──');
  if (!plan.length) console.log('   (aucun)');
  for (const x of plan) console.log(`   ${x.table}.${x.column} : ${x.n}`);

  if (!EXECUTE) {
    console.log('\n💡 DRY-RUN — relancer avec « EXECUTE » pour purger réellement.');
  } else {
    console.log('\n── EXECUTION (transaction) ──');
    await c.query('BEGIN');
    try {
      for (const x of plan) {
        await c.query(`DELETE FROM ${x.table} WHERE "${x.column}" = ANY($1)`, [x.ids]);
        console.log(`   🗑 ${x.table} (${x.n})`);
      }
      await c.query('DELETE FROM patronats WHERE id = ANY($1)', [qaPatronatIds]);
      console.log('   🗑 patronats (3)');
      await c.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
      console.log(`   🗑 users (${userIds.length})`);
      await c.query('DELETE FROM tenants WHERE id = ANY($1)', [qaTenantIds]);
      console.log(`   🗑 tenants (${qaTenantIds.length})`);
      await c.query('COMMIT');
      console.log('   ✅ COMMIT');
    } catch (e) {
      await c.query('ROLLBACK');
      console.error('   ❌ ROLLBACK :', e.message);
      throw e;
    }

    // ── Vérification finale : les intouchables ──
    const promo = await c.query(`SELECT email, status FROM users WHERE id = $1`, [REAL_PROMOTER]);
    const nat = await c.query(`SELECT name, status FROM patronats WHERE id = $1`, [NAT_PATRONAT]);
    const children = await c.query(
      `SELECT name, status FROM patronats WHERE "parentPatronatId" = $1 ORDER BY name`,
      [NAT_PATRONAT],
    );
    console.log('\n── Vérification post-commit ──');
    console.log(`   promoteur: ${promo.rows[0]?.email} (${promo.rows[0]?.status})`);
    console.log(`   national: ${nat.rows[0]?.name} (${nat.rows[0]?.status})`);
    console.log(`   enfants du national: ${children.rows.map((r) => `${r.name}(${r.status})`).join(', ')}`);
    if (children.rows.length !== 1 || !children.rows[0].name.includes('Borgou'))
      throw new Error('Anomalie enfants post-cleanup !');
  }
} finally {
  c.release();
}
await pool.end();
