/**
 * T57 — TEST DÉCISIF : tous les endpoints Fédéris sur le VRAI patronat
 * national PESP Bénin (tenant 97c57b3c, 4 enfants, données réelles),
 * avec le coordinateur QA créé pour l'occasion.
 */
const API = 'https://api.academiahelm.com/api';
const EMAIL = 'qa.t57.natcoord.mupnp6ce@academiahelm.test';
const PASSWORD = 'T57Qa#2026NatCoord';

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

const login = await jsonFetch(`${API}/auth/login`, {
  method: 'POST',
  body: { email: EMAIL, password: PASSWORD, portal_type: 'PATRONAT' },
});
const token = login.body?.accessToken;
if (!token) throw new Error(`login: HTTP ${login.status} ${JSON.stringify(login.body).slice(0, 400)}`);
const tenantId = login.body?.tenant?.id ?? login.body?.user?.tenantId;
log(`Login coordinateur QA sur le VRAI national — tenant=${tenantId}`);

const endpoints = [
  '/federis/patronat/profile',
  '/federis/patronat/dashboard',
  '/federis/patronat/bureau',
  '/federis/patronat/users',
  '/federis/patronat/schools',
  '/federis/patronat/delegations',
  '/federis/patronat/children',
  '/federis/exams',
  '/federis/subjects',
  '/federis/candidates',
  '/federis/centers',
];

for (const ep of endpoints) {
  const r = await jsonFetch(`${API}${ep}`, { token, tenantId });
  const icon = r.status < 400 ? '✅' : '❌';
  log(`${icon} GET ${ep} → HTTP ${r.status} en ${r.ms} ms`);
  if (r.status >= 400) {
    console.log(`     ↳ ${JSON.stringify(r.body).slice(0, 400)}`);
  } else if (ep.endsWith('dashboard')) {
    console.log(
      `     ↳ orgLevel=${r.body?.patronat?.orgLevel} | kpis: schools=${r.body?.kpis?.schoolsAttached} candidates=${r.body?.kpis?.candidates} exams=${r.body?.kpis?.activeExams} | departments=${r.body?.departments?.length} | orion alerts=${r.body?.orion?.alerts?.length}`,
    );
    if (Array.isArray(r.body?.departments)) {
      for (const d of r.body.departments)
        console.log(`       • ${d.territoryName ?? d.name}: exams=${d.examsCount} cand=${d.candidatesCount}`);
    }
  } else if (ep.endsWith('delegations')) {
    console.log(`     ↳ isNational=${r.body?.isNational} departments=${r.body?.departments?.length}`);
  } else if (ep.endsWith('schools')) {
    console.log(
      `     ↳ totals: attached=${r.body?.totals?.attached} pending=${r.body?.totals?.pending} | linked=${r.body?.linked?.length} manual=${r.body?.manual?.length}`,
    );
  } else if (ep.endsWith('children')) {
    console.log(`     ↳ ${r.body?.length ?? '?'} enfants`);
  } else if (ep === '/federis/exams') {
    const arr = Array.isArray(r.body) ? r.body : r.body?.exams;
    console.log(`     ↳ ${Array.isArray(arr) ? arr.length : '?'} examens`);
  }
}

console.log('\n✓ Test sur le VRAI national terminé');
