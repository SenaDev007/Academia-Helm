/**
 * T59 — DIAGNOSTIC : « Impossible de vérifier votre espace patronat » au LOGIN
 * (page /federis/login, étape 4 : GET /federis/patronat/profile après BFF OK)
 *
 * Reproduction EXACTE du flux navigateur, sans toucher au compte du promoteur :
 *   Phase A — Inscription lecture-seule de l'état réel (national + promoteur)
 *   Phase B — Création d'un membre QA (COORDONNATEUR) DANS le national réel
 *   Phase C — Chaîne API directe : POST /auth/login (portal_type PATRONAT)
 *             → GET /federis/patronat/profile (Bearer + X-Tenant-ID, comme
 *             l'apiClient axios du navigateur)
 *   Phase D — Chaîne BFF complète comme le navigateur :
 *             POST https://patronatnational.academiahelm.com/api/auth/login
 *             (fetch same-origin → SW) puis GET profile cross-origin (XHR)
 *   Phase E — décodage du JWT (claims tenantId/sub) + variantes (sans
 *             X-Tenant-ID, avec cookie uniquement)
 *
 * Le compte QA est supprimé par t59-cleanup.mjs (jamais le promoteur).
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const NEON =
  'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require';
const API = 'https://api.academiahelm.com/api';
const BFF = 'https://patronatnational.academiahelm.com';
const NAT_TENANT = '97c57b3c-8d92-4d3f-b1c8-76c2f9c1c9ac';
const NAT_PATRONAT = '62df0f31-94bc-4260-886d-d7ee255d964f';
const REAL_PROMOTER = '82b262e7-257f-43de-a7a6-e60cfd703056'; // dawesakpovi
const QA_EMAIL = `qa.t59.natcoord.${Date.now().toString(36)}@academiahelm.test`;
const QA_PASSWORD = 'T59Qa#2026Login';

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const line = (c, t) => console.log(`   ${c} ${t}`);

async function jsonFetch(url, { method = 'GET', body, token, tenantId, headers = {} } = {}) {
  const t0 = Date.now();
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'T59-Diag/1.0',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 300);
  }
  return { status: res.status, body: parsed, ms: Date.now() - t0, headers: res.headers };
}

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

// ═══════════════ PHASE A — état réel (lecture seule) ═══════════════
log('═══ PHASE A — État réel (lecture seule) ═══');
const pool = new pg.Pool({ connectionString: NEON, ssl: { rejectUnauthorized: false }, max: 1 });
const db = await pool.connect();
try {
  const nat = await db.query(
    `SELECT id, name, "orgLevel", status, "subscriptionPlan", "tenantId", "countryId", "territorialLevelId"
     FROM patronats WHERE id = $1`,
    [NAT_PATRONAT],
  );
  if (nat.rows.length) {
    const p = nat.rows[0];
    line('🏛', `national: ${p.name} | orgLevel=${p.orgLevel} status=${p.status} plan=${p.subscriptionPlan} tenant=${p.tenantId}`);
  } else {
    line('❌', 'patronat national INTROUVABLE (id mismatch ?!)');
  }

  const promo = await db.query(
    `SELECT u.id, u.email, u.status, u.role, u."tenantId",
            (u."passwordHash" IS NOT NULL AND length(u."passwordHash") > 20) AS hash_ok,
            left(u."passwordHash", 7) AS hash_prefix
     FROM users u WHERE u.id = $1`,
    [REAL_PROMOTER],
  );
  if (promo.rows.length) {
    const u = promo.rows[0];
    line('👤', `promoteur: ${u.email} | status=${u.status} role=${u.role} tenant=${u.tenantId} hashOK=${u.hash_ok} (${u.hash_prefix}…)`);
  } else {
    line('❌', 'promoteur INTROUVABLE');
  }

  const links = await db.query(
    `SELECT pu.role, pu."isActive", pu."patronatId" FROM patronat_users pu
     WHERE pu."userId" = $1`,
    [REAL_PROMOTER],
  );
  for (const l of links.rows)
    line('🔗', `lien promoteur: patronat=${l.patronatId} role=${l.role} actif=${l.isActive}`);

  const children = await db.query(
    `SELECT id, name, "territoryName", status, "tenantId" FROM patronats
     WHERE "parentPatronatId" = $1 ORDER BY name`,
    [NAT_PATRONAT],
  );
  line('🌐', `${children.rows.length} enfants nationaux : ${children.rows.map((c) => `${c.name}(${c.status})`).join(', ')}`);

  const sessions = await db.query(
    `SELECT count(*)::int AS n FROM sessions WHERE "userId" = $1`,
    [REAL_PROMOTER],
  );
  line('🗂', `sessions promoteur: ${sessions.rows[0].n}`);
} finally {
  db.release();
}
await pool.end();

// ═══════════════ PHASE B — membre QA dans le national réel ═══════════════
log('═══ PHASE B — Création membre QA (national réel) ═══');
const poolB = new pg.Pool({ connectionString: NEON, ssl: { rejectUnauthorized: false }, max: 1 });
const dbB = await poolB.connect();
const qaUserId = randomUUID();
try {
  const hash = await bcrypt.hash(QA_PASSWORD, 10);
  await dbB.query(
    `INSERT INTO users (id, "tenantId", email, "passwordHash", "firstName", "lastName", role, status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'QA', 'T59 LoginDiag', 'PATRONAT_COORDONNATEUR', 'active', NOW(), NOW())`,
    [qaUserId, NAT_TENANT, QA_EMAIL, hash],
  );
  await dbB.query(
    `INSERT INTO patronat_users (id, "patronatId", "tenantId", "userId", role, "isActive", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 'COORDONNATEUR', true, NOW(), NOW())`,
    [randomUUID(), NAT_PATRONAT, NAT_TENANT, qaUserId],
  );
  line('✅', `QA créé : ${QA_EMAIL} (user=${qaUserId})`);
} finally {
  dbB.release();
}
await poolB.end();

// ═══════════════ PHASE C — API directe (comme t57) ═══════════════
log('═══ PHASE C — API directe : login + profile ═══');
const loginApi = await jsonFetch(`${API}/auth/login`, {
  method: 'POST',
  body: { email: QA_EMAIL, password: QA_PASSWORD, portal_type: 'PATRONAT' },
});
line(loginApi.status < 400 ? '✅' : '❌', `POST /auth/login → ${loginApi.status} en ${loginApi.ms} ms`);
if (loginApi.status >= 400) {
  console.log(JSON.stringify(loginApi.body).slice(0, 500));
  throw new Error('login API KO — abandon');
}
const apiToken = loginApi.body?.accessToken;
const apiTenant = loginApi.body?.tenant?.id ?? loginApi.body?.user?.tenantId;
const claims = decodeJwt(apiToken);
line('🔑', `JWT claims: sub=${claims?.sub} id=${claims?.id} tenantId=${claims?.tenantId} role=${claims?.role} exp=${claims?.exp ? new Date(claims.exp * 1000).toISOString() : '?'}`);
line('🏢', `login.tenant=${apiTenant} user.tenantId=${loginApi.body?.user?.tenantId}`);

const profApi = await jsonFetch(`${API}/federis/patronat/profile`, { token: apiToken, tenantId: apiTenant });
line(profApi.status < 400 ? '✅' : '❌', `GET /federis/patronat/profile → ${profApi.status} en ${profApi.ms} ms`);
if (profApi.status < 400) {
  line('   ', `id=${profApi.body?.id} name=${profApi.body?.name} orgLevel=${profApi.body?.orgLevel} children=${profApi.body?.childrenCount} role=${profApi.body?.userRole}`);
} else {
  console.log('   ↳ ' + JSON.stringify(profApi.body).slice(0, 400));
}

// ═══════════════ PHASE D — chaîne BFF complète (flux navigateur exact) ═══════════════
log('═══ PHASE D — BFF (patronatnational) + profile cross-origin ═══');
const loginBff = await jsonFetch(`${BFF}/api/auth/login`, {
  method: 'POST',
  body: { email: QA_EMAIL, password: QA_PASSWORD, portal_type: 'PATRONAT' },
});
line(loginBff.status < 400 ? '✅' : '❌', `POST ${BFF}/api/auth/login → ${loginBff.status} en ${loginBff.ms} ms`);
if (loginBff.status >= 400) {
  console.log(JSON.stringify(loginBff.body).slice(0, 500));
} else {
  const bffToken = loginBff.body?.accessToken;
  const bffTenant = loginBff.body?.tenant?.id ?? loginBff.body?.user?.tenantId;
  line('🔑', `BFF accessToken: ${bffToken ? bffToken.slice(0, 24) + '… (' + bffToken.length + ' chars)' : 'ABSENT !'}`);
  line('🏢', `BFF tenant: ${bffTenant} | user.tenantId=${loginBff.body?.user?.tenantId}`);

  // Variante 1 : Bearer + X-Tenant-ID (exactement l'apiClient)
  const v1 = await jsonFetch(`${API}/federis/patronat/profile`, { token: bffToken, tenantId: bffTenant });
  line(v1.status < 400 ? '✅' : '❌', `profile [Bearer+X-Tenant] → ${v1.status} en ${v1.ms} ms`);
  if (v1.status >= 400) console.log('   ↳ ' + JSON.stringify(v1.body).slice(0, 400));
  else if (!v1.body?.id) {
    line('⚠️', `200 MAIS data.id absent → NO_PATRONAT côté login page ! body: ${JSON.stringify(v1.body).slice(0, 200)}`);
  } else {
    line('   ', `id=${v1.body.id} name=${v1.body.name}`);
  }

  // Variante 2 : sans X-Tenant-ID
  const v2 = await jsonFetch(`${API}/federis/patronat/profile`, { token: bffToken });
  line(v2.status < 400 ? '✅' : '❌', `profile [Bearer seul] → ${v2.status} en ${v2.ms} ms`);
  if (v2.status >= 400) console.log('   ↳ ' + JSON.stringify(v2.body).slice(0, 300));

  // Variantes complémentaires des modules (contexte)
  for (const ep of ['/federis/patronat/dashboard', '/federis/patronat/children']) {
    const r = await jsonFetch(`${API}${ep}`, { token: bffToken, tenantId: bffTenant });
    line(r.status < 400 ? '✅' : '❌', `GET ${ep} → ${r.status} en ${r.ms} ms`);
    if (r.status >= 400) console.log('   ↳ ' + JSON.stringify(r.body).slice(0, 300));
  }
}

console.log('\n──── Résumé T59 ────');
console.log(`QA à nettoyer (t59-cleanup.mjs) : user=${qaUserId} email=${QA_EMAIL}`);
