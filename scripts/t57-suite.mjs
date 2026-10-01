/**
 * T57 — Suite : test des endpoints sur le NATIONAL BF créé + création
 * d'un territorial rattaché au national BF (agrégation avec enfant !).
 */
const API = 'https://api.academiahelm.com/api';
const PASSWORD = 'T57Qa#2026Repro';
const NAT_EMAIL = process.argv[2];
const NAT_TENANT = process.argv[3];

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function jsonFetch(url, { method = 'GET', body, token, tenantId } = {}) {
  const t0 = Date.now();
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'T57-Repro/1.0',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
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
  return { status: res.status, body: parsed, ms: Date.now() - t0 };
}

if (!NAT_EMAIL) {
  console.error('Usage: node t57-suite.mjs <email> <tenantId>');
  process.exit(1);
}

// Login national BF
const login = await jsonFetch(`${API}/auth/login`, {
  method: 'POST',
  body: { email: NAT_EMAIL, password: PASSWORD, portal_type: 'PATRONAT' },
});
const token = login.body?.accessToken ?? login.body?.access_token;
if (!token) throw new Error(`login: HTTP ${login.status} ${JSON.stringify(login.body).slice(0, 400)}`);
const tenantId = login.body?.tenant_id ?? login.body?.tenantId ?? NAT_TENANT;
log(`Login national OK — tenant=${tenantId}`);

async function testSuite(label, tok, tid) {
  console.log(`\n════════ ${label} ════════`);
  const endpoints = [
    '/federis/patronat/profile',
    '/federis/patronat/dashboard',
    '/federis/patronat/bureau',
    '/federis/patronat/users',
    '/federis/patronat/schools',
    '/federis/patronat/delegations',
    '/federis/patronat/children',
  ];
  for (const ep of endpoints) {
    const r = await jsonFetch(`${API}${ep}`, { token: tok, tenantId: tid });
    const icon = r.status < 400 ? '✅' : '❌';
    log(`${icon} GET ${ep} → HTTP ${r.status} en ${r.ms} ms`);
    if (r.status >= 400) console.log(`     ↳ ${JSON.stringify(r.body).slice(0, 400)}`);
    else if (ep.endsWith('dashboard'))
      console.log(
        `     ↳ orgLevel=${r.body?.patronat?.orgLevel} candidates=${r.body?.kpis?.candidates} departments=${r.body?.departments?.length ?? '-'}`,
      );
    else if (ep.endsWith('delegations'))
      console.log(`     ↳ isNational=${r.body?.isNational} departments=${r.body?.departments?.length ?? '?'}`);
  }
}

// ── A. National SANS enfant ─────────────────────────────────────────
await testSuite('NATIONAL BF — SANS enfant', token, tenantId);

// ── B. Créer un enfant territorial sous le national BF ──────────────
const { body: countries } = await jsonFetch(`${API}/federis/public/countries`);
const bf = countries.find((c) => c.code === 'BF');
const deptLevel = bf.territorialLevels.find((l) => l.code !== 'NATIONAL');
log(`Niveaux BF : ${JSON.stringify(bf.territorialLevels.map((l) => l.code))}`);

if (deptLevel) {
  const stamp = Date.now().toString(36);
  const reg = await jsonFetch(`${API}/federis/public/register`, {
    method: 'POST',
    body: {
      countryId: bf.id,
      territorialLevelCode: deptLevel.code,
      name: `Patronat QA T57 Dept ${stamp}`,
      territoryName: 'Centre',
      nationalPatronatId: login.body?.patronat?.id ?? undefined,
      parentPatronatId: login.body?.patronat?.id ?? undefined,
      responsibleName: 'Test T57 Dept',
      email: `qa.t57.dept.${stamp}@academiahelm.test`,
      phone: '+22901970002',
      password: PASSWORD,
    },
  });
  log(`Register dept: HTTP ${reg.status} — ${JSON.stringify(reg.body).slice(0, 250)}`);

  // Alternative : créer l'enfant via l'endpoint protégé du national
  if (reg.status >= 400) {
    const profile = await jsonFetch(`${API}/federis/patronat/profile`, { token, tenantId });
    const natPatronatId = profile.body?.id;
    log(`Retry avec nationalPatronatId=${natPatronatId}`);
    const reg2 = await jsonFetch(`${API}/federis/public/register`, {
      method: 'POST',
      body: {
        countryId: bf.id,
        territorialLevelCode: deptLevel.code,
        name: `Patronat QA T57 DeptB ${stamp}`,
        territoryName: 'Centre-Ouest',
        nationalPatronatId: natPatronatId,
        responsibleName: 'Test T57 DeptB',
        email: `qa.t57.deptb.${stamp}@academiahelm.test`,
        phone: '+22901970003',
        password: PASSWORD,
      },
    });
    log(`Register deptB: HTTP ${reg2.status} — ${JSON.stringify(reg2.body).slice(0, 250)}`);
  }

  // ── C. National AVEC enfant ───────────────────────────────────────
  await testSuite('NATIONAL BF — AVEC enfant(s)', token, tenantId);
}

console.log('\n✓ Suite terminée');
