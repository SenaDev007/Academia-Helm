/**
 * Vérification syntaxe + tests logiques — Task 29
 * (dashboard par défaut portails + sélecteur de classe modale encaissement)
 */
import { readFileSync } from 'fs';

const ROOT = '/home/z/my-project/academia-helm/';
let pass = 0, fail = 0;
function check(label, ok, detail) {
  console.log(`${ok ? '  ✓' : '  ✗'} ${label}${detail && !ok ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
}

// ── 0. Transpilation des fichiers modifiés ──
console.log('\n[0] Transpilation des fichiers modifiés');
const FILES = [
  'apps/web-app/src/app/api/all-classes/route.ts',
  'apps/web-app/src/app/app/secretaire/page.tsx',
  'apps/web-app/src/app/app/secretaire-comptable/page.tsx',
  'apps/web-app/src/lib/auth/admin-portal-map.ts',
];
for (const f of FILES) {
  const code = readFileSync(ROOT + f, 'utf8');
  const loader = f.endsWith('.tsx') ? 'tsx' : 'ts';
  try {
    new Bun.Transpiler({ loader }).transformSync(code);
    check(`syntaxe ${loader} OK — ${f.split('/').pop()}`, true);
  } catch (e) {
    check(`syntaxe ${loader} OK — ${f.split('/').pop()}`, false, e.message);
  }
}

// ── 1. Portails : la home est le tableau de bord ──
console.log('\n[1] Pages d\'accueil des portails = tableau de bord');
const secPage = readFileSync(ROOT + 'apps/web-app/src/app/app/secretaire/page.tsx', 'utf8');
check('secretaire/page.tsx rend PilotageDashboardV2 (pas StudentsModulePage)',
  secPage.includes('PilotageDashboardV2') && !secPage.includes("import('@/components/pilotage/modules/StudentsModulePage')"));
const secCptPage = readFileSync(ROOT + 'apps/web-app/src/app/app/secretaire-comptable/page.tsx', 'utf8');
check('secretaire-comptable/page.tsx rend PilotageDashboardV2 (pas TransactionsContent)',
  secCptPage.includes('PilotageDashboardV2') && !secCptPage.includes("import('@/components/finance/TransactionsContent')"));
const cptPage = readFileSync(ROOT + 'apps/web-app/src/app/app/comptable/page.tsx', 'utf8');
check('comptable/page.tsx rend toujours FinanceDashboardV2 (inchangé)',
  cptPage.includes('FinanceDashboardV2'));
const dirPage = readFileSync(ROOT + 'apps/web-app/src/app/app/director/page.tsx', 'utf8');
check('director/page.tsx inchangé (PilotageDashboardV2)',
  dirPage.includes('PilotageDashboardV2'));

// ── 2. Navigation : premier module = Tableau de bord, outils métier accessibles ──
console.log('\n[2] Navigation des portails (admin-portal-map.ts)');
const mapCode = readFileSync(ROOT + 'apps/web-app/src/lib/auth/admin-portal-map.ts', 'utf8');
const map = await import(ROOT + 'apps/web-app/src/lib/auth/admin-portal-map.ts');

const sec = map.ADMIN_PORTALS.secretaire;
check('secretaire : module n°1 = Tableau de bord (home /app/secretaire, icône LayoutDashboard)',
  sec.modules[0].path === '/app/secretaire' && sec.modules[0].icon === 'LayoutDashboard' && sec.modules[0].label === 'Tableau de bord');
check('secretaire : Élèves & Scolarité reste dans la nav (/app/students)',
  sec.modules.some((m) => m.path === '/app/students' && m.icon === 'Users'));
check('secretaire : la home n\'est plus l\'outil Élèves & Scolarité',
  !(sec.modules[0].path === '/app/secretaire' && sec.modules[0].icon === 'Users'));

const secCpt = map.ADMIN_PORTALS['secretaire-comptable'];
check('secretaire-comptable : module n°1 = Tableau de bord (home, icône LayoutDashboard)',
  secCpt.modules[0].path === '/app/secretaire-comptable' && secCpt.modules[0].icon === 'LayoutDashboard' && secCpt.modules[0].label === 'Tableau de bord');
check('secretaire-comptable : Encaissements reste dans la nav (/app/finance/payments)',
  secCpt.modules.some((m) => m.path === '/app/finance/payments' && m.icon === 'Receipt'));
check('secretaire-comptable : la home n\'est plus l\'outil Encaissements',
  !(secCpt.modules[0].path === '/app/secretaire-comptable' && secCpt.modules[0].icon === 'Receipt'));
check('secretaire-comptable : Tableau de bord financier (/app/comptable) conservé',
  secCpt.modules.some((m) => m.path === '/app/comptable'));

const cpt = map.ADMIN_PORTALS.comptable;
check('comptable : module n°1 = Tableau de bord (déjà conforme)',
  cpt.modules[0].path === '/app/comptable' && cpt.modules[0].icon === 'LayoutDashboard');

// Redirection post-login : chaque métier atterrit sur SA home
check('getAdminPortalHomeForRole(SECRETAIRE) → /app/secretaire (dashboard)',
  map.getAdminPortalHomeForRole('SECRETAIRE') === '/app/secretaire');
check('getAdminPortalHomeForRole(SECRETAIRE_COMPTABLE) → /app/secretaire-comptable (dashboard)',
  map.getAdminPortalHomeForRole('SECRETAIRE_COMPTABLE') === '/app/secretaire-comptable');
check('getAdminPortalHomeForRole(COMPTABLE) → /app/comptable (dashboard)',
  map.getAdminPortalHomeForRole('COMPTABLE') === '/app/comptable');

// ── 3. Route BFF /api/all-classes — scope-aware ──
console.log('\n[3] Route BFF /api/all-classes (fix sélecteur de classe vide)');
const routeCode = readFileSync(ROOT + 'apps/web-app/src/app/api/all-classes/route.ts', 'utf8');
check('récupère le scope via /context/bootstrap',
  routeCode.includes('/context/bootstrap'));
check('compte restreint : n\'envoie JAMAIS la sentinelle ALL (header par niveau du périmètre)',
  routeCode.includes('scope.levelIds') && routeCode.includes("scope.allLevels === false"));
check('compte restreint : interroge /classes par niveau (x-school-level-id: <uuid>)',
  routeCode.includes("levelUuids.map") && routeCode.includes("'x-school-level-id': levelId"));
check('compte transverse : comportement historique ALL conservé',
  routeCode.includes("'x-school-level-id': 'ALL'"));
check('déduplication des classes entre niveaux',
  routeCode.includes('seen.has(c.id)'));
check('filtre de défense : classes restreintes au périmètre',
  routeCode.includes('scopeLevelIds.has(c.schoolLevelId)'));
check('le filtre officialClass actif est conservé',
  routeCode.includes('officialClass && c.officialClass.isActive === false'));

// Simulation de la logique d'agrégation (extraction du comportement)
console.log('\n[4] Simulation agrégation multi-niveaux (comptes restreints)');
const scope = {
  allLevels: false,
  levelCodes: ['MATERNELLE', 'PRIMAIRE'],
  levelIds: ['ea2e2f8a-1111-4111-8111-aaaaaaaaaaa1', 'bc434610-2222-4222-8222-bbbbbbbbbbb2', 'MAT_PRI'], // MAT_PRI = composite non-UUID
};
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const levelUuids = Array.from(new Set(scope.levelIds.filter((id) => uuidRegex.test(id))));
check('MAT_PRI (composite non-UUID) écarté — 2 appels backend seulement',
  levelUuids.length === 2 && !levelUuids.includes('MAT_PRI'));

// Simuler les réponses par niveau + la fusion
const backendLists = [
  [{ id: 'c-cp', name: 'CP', schoolLevelId: 'bc434610-2222-4222-8222-bbbbbbbbbbb2' }, { id: 'c-ce1', name: 'CE1', schoolLevelId: 'bc434610-2222-4222-8222-bbbbbbbbbbb2' }],
  [{ id: 'c-mat1', name: 'MAT1', schoolLevelId: 'ea2e2f8a-1111-4111-8111-aaaaaaaaaaa1' }, { id: 'c-cp', name: 'CP', schoolLevelId: 'bc434610-2222-4222-8222-bbbbbbbbbbb2' }], // doublon CP
];
let aggregated = [];
const seen = new Set();
for (const list of backendLists) {
  for (const c of list) {
    if (c.id && !seen.has(c.id)) { seen.add(c.id); aggregated.push(c); }
  }
}
check('fusion des niveaux sans doublon (3 classes uniques)', aggregated.length === 3);
const scopeLevelIds = new Set(scope.levelIds);
const filtered = aggregated.filter((c) => !c.schoolLevelId || scopeLevelIds.has(c.schoolLevelId));
check('défense en profondeur : toutes les classes restent dans le périmètre',
  filtered.length === 3 && filtered.every((c) => scopeLevelIds.has(c.schoolLevelId)));

// Le garde-403 du route.ts : renvoie [] (et non une erreur) si le backend échoue
check('échec backend → [] silencieux conservé (comportement historique)',
  routeCode.includes('NextResponse.json([], { status: 200') || routeCode.includes("NextResponse.json([], {\n        status: 200"));

// ── 5. Modale encaissement : consommateurs de la route ──
console.log('\n[5] NewPaymentModal — sélecteurs alimentés par les routes corrigées');
const modalCode = readFileSync(ROOT + 'apps/web-app/src/components/finance/NewPaymentModal.tsx', 'utf8');
check('niveaux via /api/school-levels (fix Task 27)',
  modalCode.includes('/api/school-levels'));
check('classes via /api/all-classes (fix Task 29)',
  modalCode.includes('/api/all-classes'));
check('filtrage des classes par schoolLevelId UUID (pas education_levels)',
  modalCode.includes('c.schoolLevelId === schoolLevelId'));

// ── Résumé ──
console.log(`\n════════ RÉSULTAT : ${pass} pass / ${fail} fail ════════`);
if (fail > 0) process.exit(1);
