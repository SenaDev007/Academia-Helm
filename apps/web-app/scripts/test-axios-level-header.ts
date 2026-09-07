/**
 * ============================================================================
 * TEST intercepteur axios (src/lib/api/client.ts) — FIX 2026-09-07
 * ============================================================================
 * Vérifie la décision du header x-school-level-id :
 *  1. schoolLevel 'ALL' + périmètre restreint (scope.allLevels=false) → PAS de header
 *  2. schoolLevel 'ALL' + profil transverse (allLevels=true) → header 'ALL' (historique)
 *  3. schoolLevel avec schoolLevelId (UUID school_levels) → header = schoolLevelId
 *     (correction de la mauvaise table education_levels)
 *
 * Exécution : npx tsx scripts/test-axios-level-header.ts (depuis apps/web-app)
 * ============================================================================
 */
/* eslint-disable @typescript-eslint/no-var-requires */

// ─── Stubs navigateur AVANT l'import du client (l'intercepteur lit window/localStorage) ───
const store: Record<string, string> = {};
(globalThis as any).window = globalThis;
(globalThis as any).location = {
  href: 'http://localhost:3000/',
  hostname: 'localhost',
  pathname: '/app/students',
  origin: 'http://localhost:3000',
};
(globalThis as any).document = { cookie: '', createElement: () => ({}) };
try {
  (globalThis as any).navigator = { userAgent: 'node-test' };
} catch {
  /* navigator est déjà défini en lecture seule — axios l'utilise seulement en option */
}
(globalThis as any).localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
};

const { apiClient } = require('../src/lib/api/client');

// Adapter axios : capture la config au lieu d'émettre une vraie requête
const seen: any[] = [];
apiClient.defaults.adapter = async (config: any) => {
  seen.push(config);
  return {
    status: 200,
    data: {},
    statusText: 'OK',
    headers: {},
    config,
  };
};

async function headerForRequest(): Promise<string | undefined> {
  seen.length = 0;
  await apiClient.get('/students');
  const h = seen[0]?.headers;
  return h?.['x-school-level-id'] ?? h?.['X-School-Level-ID'] ?? undefined;
}

let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✅ ${label}`);
  else {
    failures++;
    console.error(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
  }
}

async function main() {
  console.log('\n── Intercepteur : décision x-school-level-id ──');

  // Cas 1 : 'ALL' + périmètre restreint (secrétaire) → pas de header
  store['schoolLevel'] = JSON.stringify({ id: 'ALL', code: 'ALL', label: 'Tous les niveaux' });
  store['user_scope'] = JSON.stringify({
    allLevels: false,
    levelIds: ['sl-pri'],
    levelCodes: ['PRIMAIRE'],
  });
  const c1 = await headerForRequest();
  check(
    "'ALL' + périmètre restreint → header ABSENT (scope serveur appliqué)",
    c1 === undefined,
    `header=${JSON.stringify(c1)}`,
  );

  // Cas 2 : 'ALL' + transverse (promoteur) → header 'ALL' (comportement historique)
  store['user_scope'] = JSON.stringify({ allLevels: true, levelIds: [], levelCodes: [] });
  const c2 = await headerForRequest();
  check("'ALL' + profil transverse → header 'ALL'", c2 === 'ALL', `header=${JSON.stringify(c2)}`);

  // Cas 2b : 'ALL' sans scope connu → 'ALL' (rétro-compat)
  delete store['user_scope'];
  const c2b = await headerForRequest();
  check("'ALL' sans scope → header 'ALL' (rétro-compat)", c2b === 'ALL', `header=${JSON.stringify(c2b)}`);

  // Cas 3 : vrai UUID school_levels prioritaire sur education_levels
  store['schoolLevel'] = JSON.stringify({ id: 'edu-pri', code: 'PRIMAIRE', schoolLevelId: 'sl-pri' });
  store['user_scope'] = JSON.stringify({
    allLevels: false,
    levelIds: ['sl-pri'],
    levelCodes: ['PRIMAIRE'],
  });
  const c3 = await headerForRequest();
  check(
    'schoolLevelId (UUID school_levels) prioritaire sur id (education_levels)',
    c3 === 'sl-pri',
    `header=${JSON.stringify(c3)}`,
  );

  // Cas 4 : sans objet schoolLevel → aucun header (comportement inchangé)
  delete store['schoolLevel'];
  const c4 = await headerForRequest();
  check('sans schoolLevel stocké → aucun header', c4 === undefined, `header=${JSON.stringify(c4)}`);

  console.log(
    failures === 0
      ? '\n✅ TOUS LES TESTS PASSENT (intercepteur axios)'
      : `\n❌ ${failures} échec(s)`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('💥 Erreur test :', e);
  process.exit(1);
});
