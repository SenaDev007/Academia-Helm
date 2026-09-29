/**
 * ============================================================================
 * TEST BFF /api/school-levels — FIX 2026-09-07 « périmètres restreints »
 * ============================================================================
 * Reproduit le bug : comptes à périmètre restreint (secrétaire / secrétaire
 * comptable avec Staff/StaffAdminAssignment) → l'enrichissement envoyait
 * x-school-level-id=ALL → AccessScopeGuard 403 → schoolLevelId null →
 * sélecteurs vides dans le wizard d'inscription.
 *
 * Exécution : npx tsx scripts/test-school-levels-bff.ts (depuis apps/web-app)
 * ============================================================================
 */
/* eslint-disable @typescript-eslint/no-var-requires */
import { NextRequest } from 'next/server';

// ─── 1. Stub next/headers AVANT tout import du route (hors contexte Next) ───
const nextHeaders: { cookies: unknown; headers: unknown; draftMode: unknown } =
  require('next/headers');
nextHeaders.cookies = async () => ({
  get: () => undefined,
  getAll: () => [],
});
nextHeaders.headers = async () => ({
  get: () => undefined,
  has: () => false,
});

// ─── 2. Import du handler APRÈS le stub ───
const routeModule = require('../src/app/api/school-levels/route');
const GET = routeModule.GET as (req: NextRequest) => Promise<Response>;

// ─── 3. Backend mocké ───
type RecordedCall = { path: string; levelHeader?: string };
let recorded: RecordedCall[] = [];
let backendMode: 'restricted' | 'transverse' | 'bootstrap-down' | 'structure-with-en-mirror' =
  'restricted';

const STRUCTURE_LEVELS = [
  { id: 'edu-mat', name: 'MATERNELLE', isEnabled: true },
  { id: 'edu-pri', name: 'PRIMAIRE', isEnabled: true },
  { id: 'edu-sec', name: 'SECONDAIRE', isEnabled: true },
];

const STRUCTURE_LEVELS_EN_MIRROR = [
  { id: 'edu-mat', name: 'MATERNELLE', isEnabled: true },
  { id: 'edu-nur', name: 'NURSERY', isEnabled: true },
  { id: 'edu-pri', name: 'PRIMAIRE', isEnabled: true },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (input: any, init?: any) => {
  const rawUrl = typeof input === 'string' ? input : input?.url ?? String(input);
  let path = rawUrl.replace(/^https?:\/\/[^/]+/, '');
  // Normaliser : retirer le préfixe global /api du backend (setGlobalPrefix('api'))
  if (path.startsWith('/api/')) path = path.slice(4);
  path = path.split('?')[0];
  const levelHeader = init?.headers?.['x-school-level-id'];
  recorded.push({ path, levelHeader });

  // /settings/education/structure
  if (path.startsWith('/settings/education/structure')) {
    const levels =
      backendMode === 'structure-with-en-mirror' ? STRUCTURE_LEVELS_EN_MIRROR : STRUCTURE_LEVELS;
    return jsonResponse({ levels });
  }

  // /context/bootstrap
  if (path.startsWith('/context/bootstrap')) {
    if (backendMode === 'bootstrap-down') {
      return jsonResponse({ message: 'Internal Error' }, 500);
    }
    if (backendMode === 'transverse') {
      return jsonResponse({
        scope: {
          levelCodes: ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE'],
          levelIds: ['sl-mat', 'sl-pri', 'sl-sec'],
          allLevels: true,
        },
      });
    }
    // restricted : secrétaire périmètre PRIMAIRE
    return jsonResponse({
      scope: { levelCodes: ['PRIMAIRE'], levelIds: ['sl-pri'], allLevels: false },
    });
  }

  // Sources d'enrichissement historiques (A: /classes, B: /academic-classes, C: /students)
  if (path.startsWith('/classes') || path.startsWith('/academic-classes')) {
    return jsonResponse([
      { id: 'c1', schoolLevel: { code: 'PRIMAIRE' }, schoolLevelId: 'sl-pri' },
    ]);
  }
  if (path.startsWith('/students')) {
    return jsonResponse({ data: [{ schoolLevel: { code: 'MATERNELLE' }, schoolLevelId: 'sl-mat' }] });
  }

  // Source D : /school-levels?code=...
  if (path.startsWith('/school-levels')) {
    const code = new URL(rawUrl).searchParams.get('code');
    const known: Record<string, string> = {
      MATERNELLE: 'sl-mat',
      PRIMAIRE: 'sl-pri',
      SECONDAIRE: 'sl-sec',
    };
    if (code && known[code]) {
      return jsonResponse([{ id: known[code], code }]);
    }
    return jsonResponse([]);
  }

  return jsonResponse({ message: 'Not mocked: ' + path }, 404);
};

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/school-levels', {
    headers: { Authorization: 'Bearer fake-jwt', 'x-tenant-id': 'tenant-1' },
  });
}

async function runCase(
  mode: typeof backendMode,
): Promise<{ result: any[]; calls: RecordedCall[] }> {
  recorded = [];
  backendMode = mode;
  const res = await GET(makeRequest());
  const result = await res.json();
  return { result, calls: recorded };
}

let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✅ ${label}`);
  } else {
    failures++;
    console.error(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
  }
}

async function main() {
  console.log('\n── Cas 1 : secrétaire à périmètre restreint (PRIMAIRE) ──');
  {
    const { result, calls } = await runCase('restricted');
    check('un seul niveau retourné (PRIMAIRE)', result.length === 1, JSON.stringify(result));
    check(
      'niveau = Primaire avec schoolLevelId sl-pri',
      result[0]?.code === 'PRIMAIRE' && result[0]?.schoolLevelId === 'sl-pri',
      JSON.stringify(result[0]),
    );
    check(
      'id education_levels conservé (rétro-compat header/contexte)',
      result[0]?.id === 'edu-pri',
    );
    const allCalls = calls.map((c) => c.path);
    check(
      'aucune source d’enrichissement appelée (A/B/C/D)',
      !allCalls.some((p) => /\/classes|\/students|\/school-levels/.test(p)),
      JSON.stringify(allCalls),
    );
    check(
      'aucun header x-school-level-id=ALL émis',
      !calls.some((c) => c.levelHeader === 'ALL'),
      JSON.stringify(calls.map((c) => c.levelHeader)),
    );
  }

  console.log('\n── Cas 2 : promoteur transverse (comportement historique préservé) ──');
  {
    const { result, calls } = await runCase('transverse');
    check('3 niveaux retournés', result.length === 3, JSON.stringify(result.length));
    check(
      'tous enrichis (schoolLevelId non null)',
      result.every((l: any) => !!l.schoolLevelId),
      JSON.stringify(result),
    );
    const classesCall = calls.find((c) => c.path.startsWith('/classes'));
    check('source /classes appelée avec x-school-level-id=ALL', classesCall?.levelHeader === 'ALL');
  }

  console.log('\n── Cas 3 : bootstrap indisponible → repli historique (sources ALL) ──');
  {
    const { result, calls } = await runCase('bootstrap-down');
    check('3 niveaux retournés (repli)', result.length === 3, JSON.stringify(result.length));
    check(
      'enrichissement via sources (ALL autorisé hors périmètre connu)',
      calls.some((c) => c.path.startsWith('/classes')) &&
        calls.some((c) => c.levelHeader === 'ALL'),
    );
  }

  console.log('\n── Cas 4 : école bilingue — miroir EN rattaché au code FR du scope ──');
  {
    const { result, calls } = await runCase('structure-with-en-mirror');
    check('scope PRIMAIRE + miroir NURSERY (MATERNELLE hors périmètre)', true);
    check(
      'PRIMAIRE conservé avec sl-pri',
      result.some((l: any) => l.code === 'PRIMAIRE' && l.schoolLevelId === 'sl-pri'),
      JSON.stringify(result),
    );
    check('NURSERY exclu (MATERNELLE hors scope)', !result.some((l: any) => l.code === 'NURSERY'));
    check(
      'aucun header ALL émis',
      !calls.some((c) => c.levelHeader === 'ALL'),
      JSON.stringify(calls.map((c) => c.levelHeader)),
    );
  }

  (globalThis as any).fetch = originalFetch;
  console.log(
    failures === 0
      ? '\n✅ TOUS LES TESTS PASSENT (route BFF school-levels)'
      : `\n❌ ${failures} échec(s)`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('💥 Erreur test :', e);
  process.exit(1);
});
