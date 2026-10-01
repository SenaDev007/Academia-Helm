/**
 * T57 — Test DIRECT de l'API de production en tant que coordinateur
 * du PATRONAT NATIONAL, pour reproduire les échecs signalés :
 *   - /federis/patronat/dashboard   → « Tableau de bord indisponible »
 *   - /federis/patronat/bureau      → « impossible de charger la composition du bureau »
 *   - /federis/users                → « impossible de charger l'équipe »
 *   - /federis/patronat/schools     → « impossible de charger les écoles rattachées »
 */
const BASE = 'https://api.academiahelm.com/api';
const EMAIL = 'dawesakpovi@gmail.com';
const PASSWORD = 'er7oNlc1b4o';

async function timed(label, fn) {
  const t0 = Date.now();
  try {
    const out = await fn();
    const ms = Date.now() - t0;
    console.log(`✅ ${label} — ${ms} ms`);
    return out;
  } catch (e) {
    const ms = Date.now() - t0;
    console.log(`❌ ${label} — ${ms} ms — ${e.message}`);
    return null;
  }
}

// 1. Login patronat
const login = await timed('LOGIN /auth/login (portal PATRONAT)', async () => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      portal_type: 'PATRONAT',
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  return body;
});

if (!login) process.exit(1);
const token = login.access_token ?? login.accessToken ?? login.token;
console.log('Token OK:', token ? `${token.slice(0, 25)}...` : 'MANQUANT');
console.log('user:', JSON.stringify(login.user ?? {}, null, 1).slice(0, 600));

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
  'X-Tenant-ID': login.tenant_id ?? login.tenantId ?? login.user?.tenantId ?? '',
  'User-Agent': 'T57-Diag/1.0',
};

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`, { headers });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, ms: Date.now(), json, text: text.slice(0, 400) };
};

// 2. Les 4 endpoints signalés en échec + profile (référence)
const paths = [
  '/federis/patronat/profile',
  '/federis/patronat/dashboard',
  '/federis/patronat/bureau',
  '/federis/patronat/users',
  '/federis/patronat/schools',
  '/federis/patronat/delegations',
];

for (const p of paths) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}${p}`, { headers });
    const ms = Date.now() - t0;
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 200) };
    }
    const ok = res.ok ? '✅' : '❌';
    console.log(`${ok} GET ${p} — HTTP ${res.status} — ${ms} ms`);
    if (!res.ok) console.log('   body:', JSON.stringify(json).slice(0, 500));
    else if (p.includes('dashboard'))
      console.log(
        '   dashboard.patronat:',
        JSON.stringify(json?.patronat ?? {}),
        '| kpis.candidates:',
        json?.kpis?.candidates,
        '| departments:',
        json?.departments?.length,
      );
    else console.log('   keys:', Object.keys(json ?? {}).join(', '));
  } catch (e) {
    const ms = Date.now() - t0;
    console.log(`❌ GET ${p} — réseau: ${e.message} — ${ms} ms`);
  }
}
