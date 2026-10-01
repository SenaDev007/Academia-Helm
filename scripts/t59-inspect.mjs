/**
 * T59 — Étape 2 : (a) miroir exact du promoteur (lien PATRONAT_ADMIN) puis
 * test profile ; (b) inspection des 3 patronats QA résiduels (enfants du
 * national réel) : origine, dépendants, pour cleanup sécurisé.
 */
import pg from 'pg';

const NEON =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const QA_USER = 'c2923424-ce8a-4d50-8705-7ba4342e261d';
const NAT_PATRONAT = '62df0f31-94bc-4260-886d-d7ee255d964f';
const API = 'https://api.academiahelm.com/api';
const QA_EMAIL = 'qa.t59.natcoord.muprh4qr@academiahelm.test';
const QA_PASSWORD = 'T59Qa#2026Login';

const pool = new pg.Pool({ connectionString: NEON, ssl: { rejectUnauthorized: false }, max: 1 });
const c = await pool.connect();
try {
  // ── (a) Miroir exact du promoteur ──
  await c.query(`UPDATE patronat_users SET role='PATRONAT_ADMIN' WHERE "userId"=$1`, [QA_USER]);
  await c.query(`UPDATE users SET role='PATRONAT_ADMIN' WHERE id=$1`, [QA_USER]);
  console.log('✅ QA link+user role → PATRONAT_ADMIN (miroir du promoteur)');

  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: QA_EMAIL, password: QA_PASSWORD, portal_type: 'PATRONAT' }),
  });
  const loginBody = await login.json();
  const token = loginBody?.accessToken;
  console.log(`login: HTTP ${login.status} token=${token ? 'ok' : 'ABSENT'}`);
  const prof = await fetch(`${API}/federis/patronat/profile`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-ID': loginBody?.tenant?.id ?? '' },
  });
  const profBody = await prof.json();
  console.log(
    `profile [PATRONAT_ADMIN]: HTTP ${prof.status} → id=${profBody?.id ?? '?'} userRole=${profBody?.userRole} userFunction=${profBody?.userFunction} label=${profBody?.userFunctionLabel}`,
  );

  // ── (b) Inspection des patronats QA résiduels ──
  console.log('\n═══ Patronats QA résiduels (enfants du national réel) ═══');
  const qa = await c.query(
    `SELECT p.id, p.name, p."territoryName", p."orgLevel", p."tenantId", p."createdAt",
            t.name AS tenant_name, t.slug AS tenant_slug
     FROM patronats p LEFT JOIN tenants t ON t.id = p."tenantId"
     WHERE p."parentPatronatId" = $1 AND p.name ILIKE '%QA%'
     ORDER BY p."createdAt"`,
    [NAT_PATRONAT],
  );
  const qaIds = qa.rows.map((r) => r.id);
  const qaTenants = qa.rows.map((r) => r.tenantId).filter(Boolean);
  for (const r of qa.rows)
    console.log(` • ${r.name} | ${r.territoryName} | créé=${r.createdAt?.toISOString?.().slice(0, 16)} | tenant=${r.tenant_name}`);

  if (qaIds.length) {
    // Dépendants : users liés, sessions, années, et FK génériques
    const links = await c.query(
      `SELECT pu."patronatId", u.id AS user_id, u.email, u.role, u.status
       FROM patronat_users pu JOIN users u ON u.id = pu."userId"
       WHERE pu."patronatId" = ANY($1)`,
      [qaIds],
    );
    for (const l of links.rows)
      console.log(`   ↳ membre: ${l.email} (${l.role}/${l.status}) user=${l.user_id}`);
    const qaUsers = links.rows.map((l) => l.user_id);

    const years = await c.query(
      `SELECT id, label, "tenantId", "isActive" FROM academic_years WHERE "tenantId" = ANY($1)`,
      [qaTenants],
    );
    console.log(`   ↳ années scolaires: ${years.rows.map((y) => `${y.label}${y.isActive ? '(active)' : ''}`).join(', ') || 'aucune'}`);

    // Compter les dépendants métier éventuels sur ces patronats
    for (const [label, sql, params] of [
      ['examens', `SELECT count(*)::int n FROM exams WHERE patronat_id = ANY($1)`, [qaIds]],
      ['centres', `SELECT count(*)::int n FROM centers WHERE patronat_id = ANY($1)`, [qaIds]],
      ['candidats', `SELECT count(*)::int n FROM candidates WHERE patronat_id = ANY($1)`, [qaIds]],
    ]) {
      try {
        const r = await c.query(sql, params);
        console.log(`   ↳ ${label}: ${r.rows[0].n}`);
      } catch (e) {
        console.log(`   ↳ ${label}: table/colonne absente (${e.message.slice(0, 60)})`);
      }
    }

    if (qaUsers.length) {
      const sess = await c.query(
        `SELECT count(*)::int n FROM sessions WHERE "userId" = ANY($1)`,
        [qaUsers],
      );
      console.log(`   ↳ sessions: ${sess.rows[0].n}`);
    }
    console.log('\nIDs pour cleanup :');
    console.log(JSON.stringify({ qaIds, qaTenants, qaUsers }, null, 1));
  }
} finally {
  c.release();
}
await pool.end();
