/**
 * T57 — Reproduction LIVE du bug « patronat national » :
 * enregistre un patronat NATIONAL de test + un TERRITORIAL de test,
 * se connecte, puis chronomètre les 4 endpoints signalés en échec.
 *
 * Objectif : déterminer si le problème est le code NATIONAL déployé
 * (indépendant des données) ou spécifique au patronat PESP Bénin.
 */
const API = 'https://api.academiahelm.com/api';
const STAMP = Date.now().toString(36);
const PASSWORD = 'T57Qa#2026Repro';

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

async function registerPatronat(level, name, email, countryCode = 'BJ') {
  const { body: countries } = await jsonFetch(`${API}/federis/public/countries`);
  const country = (countries ?? []).find((c) => c.code === countryCode);
  if (!country) throw new Error(`Pays ${countryCode} introuvable`);
  const levelCode =
    level === 'NATIONAL'
      ? 'NATIONAL'
      : country.territorialLevels.find((l) => l.code !== 'NATIONAL')?.code ?? level;
  const reg = await jsonFetch(`${API}/federis/public/register`, {
    method: 'POST',
    body: {
      countryId: country.id,
      territorialLevelCode: levelCode,
      name,
      territoryName: level === 'NATIONAL' ? country.name : 'Borgou',
      responsibleName: 'Test T57',
      email,
      phone: '+22901970001',
      password: PASSWORD,
    },
  });
  if (reg.status !== 201 && reg.body?.success !== true) {
    throw new Error(`register ${level}: HTTP ${reg.status} ${JSON.stringify(reg.body).slice(0, 300)}`);
  }
  const login = await jsonFetch(`${API}/auth/login`, {
    method: 'POST',
    body: { email, password: PASSWORD, portal_type: 'PATRONAT' },
  });
  const token = login.body?.accessToken ?? login.body?.access_token;
  const tenantId = login.body?.tenant_id ?? login.body?.tenantId ?? login.body?.user?.tenantId;
  if (!token) throw new Error(`login ${level}: HTTP ${login.status} ${JSON.stringify(login.body).slice(0, 400)}`);
  return { token, tenantId, patronatId: reg.body.patronat?.id };
}

async function testSuite(label, { token, tenantId }) {
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
    const r = await jsonFetch(`${API}${ep}`, { token, tenantId });
    const icon = r.status < 400 ? '✅' : '❌';
    log(`${icon} GET ${ep} → HTTP ${r.status} en ${r.ms} ms`);
    if (r.status >= 400) {
      console.log(`     ↳ ${JSON.stringify(r.body).slice(0, 300)}`);
    } else if (ep.endsWith('dashboard')) {
      console.log(
        `     ↳ patronat=${r.body?.patronat?.orgLevel} kpis.candidates=${r.body?.kpis?.candidates} departments=${r.body?.departments?.length ?? '-'}`,
      );
    } else if (ep.endsWith('delegations')) {
      console.log(`     ↳ isNational=${r.body?.isNational} departments=${r.body?.departments?.length ?? '?'}`);
    }
  }
}

// ── 1. National de test (Burkina — un seul national par pays) ───────
log('Enregistrement patronat NATIONAL de test (BF)…');
const nat = await registerPatronat(
  'NATIONAL',
  `Patronat QA T57 Nat ${STAMP}`,
  `qa.t57.nat.${STAMP}@academiahelm.test`,
  'BF',
);
log(`National créé — tenant=${nat.tenantId}`);

// ── 2. Territorial de test ──────────────────────────────────────────
log('Enregistrement patronat TERRITORIAL de test…');
const ter = await registerPatronat('TERRITORIAL', `Patronat QA T57 Ter ${STAMP}`, `qa.t57.ter.${STAMP}@academiahelm.test`, 'BJ');
log(`Territorial créé — tenant=${ter.tenantId}`);

// ── 3. Suites de tests ──────────────────────────────────────────────
await testSuite('PATRONAT NATIONAL (nouveau, sans enfants)', nat);
await testSuite('PATRONAT TERRITORIAL (nouveau)', ter);

console.log('\n✓ Reproduction terminée');
