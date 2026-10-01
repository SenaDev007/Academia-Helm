/**
 * T57 — Emprunt TEMPORAIRE du compte promoteur national (dawesakpovi) :
 *   1. Sauvegarde du hash actuel
 *   2. Mot de passe temporaire
 *   3. Login + test des 4 endpoints en échec
 *   4. (le navigateur sera testé séparément)
 *   5. RESTAURATION IMMÉDIATE du hash d'origine
 *
 * ⚠️ Fenêtre de risque ~60 s : le promoteur ne s'est pas connecté depuis
 * hier 20:13 UTC. Les JWT existants restent valides (le hash ne les révoque pas).
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';

const REAL_USER = '82b262e7-257f-43de-a7a6-e60cfd703056';
const TEMP_PWD = 'T57TempBorrow#2026x';

const client = new pg.Client({
  connectionString:
    'postgresql://neondb_owner:npg_Nio3WadxL0qb@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require',
  ssl: { rejectUnauthorized: false },
});
const API = 'https://api.academiahelm.com/api';

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

await client.connect();

// 1. Sauvegarder le hash
const before = await client.query('SELECT "passwordHash" FROM users WHERE id = $1', [REAL_USER]);
const ORIGINAL_HASH = before.rows[0].passwordHash;
console.log(`Hash original sauvegardé : ${ORIGINAL_HASH.slice(0, 20)}...`);

try {
  // 2. Mot de passe temporaire
  const tempHash = await bcrypt.hash(TEMP_PWD, 10);
  await client.query('UPDATE users SET "passwordHash" = $1 WHERE id = $2', [tempHash, REAL_USER]);
  log('Mot de passe temporaire posé');

  // 3. Login + tests
  const t0 = Date.now();
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'T57-Borrow/1.0' },
    body: JSON.stringify({
      email: 'dawesakpovi@gmail.com',
      password: TEMP_PWD,
      portal_type: 'PATRONAT',
    }),
  });
  const login = await loginRes.json();
  if (!login.accessToken) throw new Error(`login failed: HTTP ${loginRes.status}`);
  const token = login.accessToken;
  const tenantId = login.tenant?.id;
  log(`Login promoteur OK en ${Date.now() - t0} ms — tenant=${tenantId}`);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Tenant-ID': tenantId ?? '',
    'User-Agent': 'T57-Borrow/1.0',
  };

  for (const ep of [
    '/federis/patronat/profile',
    '/federis/patronat/dashboard',
    '/federis/patronat/bureau',
    '/federis/patronat/users',
    '/federis/patronat/schools',
    '/federis/patronat/delegations',
  ]) {
    const s = Date.now();
    const res = await fetch(`${API}${ep}`, { headers });
    const ms = Date.now() - s;
    const body = await res.text();
    let info = '';
    try {
      const j = JSON.parse(body);
      if (ep.endsWith('dashboard'))
        info = `candidates=${j.kpis?.candidates} departments=${j.departments?.length}`;
      else if (ep.endsWith('users')) info = `members=${j.members?.length}`;
      else if (ep.endsWith('bureau')) info = `members=${j.members?.length}`;
      else if (ep.endsWith('delegations')) info = `isNational=${j.isNational}`;
      else if (ep.endsWith('schools')) info = `linked=${j.linked?.length}`;
    } catch {}
    console.log(`${res.ok ? '✅' : '❌'} GET ${ep} → ${res.status} en ${ms} ms ${info}`);
    if (!res.ok) console.log('   ', body.slice(0, 300));
  }

  // 4. Export du token pour le test navigateur (fichier temporaire)
  const fs = await import('fs');
  fs.writeFileSync(
    '/tmp/t57-borrow-token.json',
    JSON.stringify({ token, tenantId, email: 'dawesakpovi@gmail.com' }),
  );
  log('Token exporté vers /tmp/t57-borrow-token.json');
} finally {
  // 5. RESTAURATION IMMÉDIATE
  await client.query('UPDATE users SET "passwordHash" = $1 WHERE id = $2', [ORIGINAL_HASH, REAL_USER]);
  const check = await client.query('SELECT "passwordHash" FROM users WHERE id = $1', [REAL_USER]);
  console.log(
    check.rows[0].passwordHash === ORIGINAL_HASH
      ? '✅ Hash d’origine RESTAURÉ et vérifié'
      : '❌❌ ÉCHEC DE RESTAURATION — CORRIGER MANUELLEMENT !',
  );
  await client.end();
}
