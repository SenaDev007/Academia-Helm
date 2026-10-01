#!/usr/bin/env node
/**
 * verify_task16.cjs — Vérification du lot 2026-09-30 (retour utilisateur) :
 *   1. FENÊTRE du répertoire officiel (SchoolDirectoryModal) ouverte par les
 *      boutons « Créer une école hors Helm » (Écoles rattachées) et
 *      « Ajouter un centre » (Centres, salles & Surveillants) — liste
 *      intégrale scrollable + recherche intégrée + « Saisir manuellement ».
 *   2. Téléphones du répertoire au nouveau plan de numérotation béninois :
 *      préfixe « 01 » ajouté à tous les numéros (seed + migration DB
 *      idempotente + normalisation à la lecture).
 *   3. Paramètre « limit » sur GET /federis/patronat/schools/directory/search
 *      (le modal demande la liste intégrale du département).
 *
 * Exécution : node scripts/verify_task16.cjs
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
let ok = 0;
let fail = 0;

function check(label, condition, detail = '') {
  if (condition) {
    ok++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function read(p) {
  return fs.readFileSync(path.join(ROOT, p), 'utf8');
}

// TypeScript (pour transpiler les extraits testés + les fichiers complets)
// — le sandbox n'a pas node_modules dans le dépôt : TypeScript partagé du
//   dossier tscheck (même pattern que verify_task15.cjs).
let ts;
const TS_PATHS = [
  '/home/z/my-project/scripts/tscheck/node_modules/typescript',
  path.join(ROOT, 'node_modules/typescript'),
  'typescript',
];
for (const p of TS_PATHS) {
  try {
    ts = require(p);
    break;
  } catch {
    /* essayer le suivant */
  }
}

// ══════════════════════════════════════════════════════════════════════
// 1. NORMALISATION TÉLÉPHONE « 01 » — tests unitaires de la fonction
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 1. Normalisation téléphone « 01 » (fonction normalizeBeninPhone) ──');

const svcPath = path.join(ROOT, 'apps/api-server/src/federis/federis-school-directory.service.ts');
const svc = fs.readFileSync(svcPath, 'utf8');

// Extraction + transpilation de la fonction pure pour les tests runtime
const fnMatch = svc.match(/export function normalizeBeninPhone[\s\S]*?\n}/);
check('Fonction normalizeBeninPhone exportée', !!fnMatch);
if (fnMatch) {
  // Transpilation de l'extrait TS (suppression des annotations de types)
  // avant écriture en CommonJS.
  if (!ts) {
    check('TypeScript disponible (transpilation extrait)', false, 'typescript introuvable');
  } else {
    const transpiled = ts.transpileModule(`${fnMatch[0]}\nexport { normalizeBeninPhone };`, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task16-'));
    const tmpFile = path.join(tmpDir, 'phone.cjs');
    fs.writeFileSync(tmpFile, transpiled);
    const { normalizeBeninPhone } = require(tmpFile);

  const cases = [
    // [entrée, attendu, libellé]
    ['95 34 71 54', '01 95 34 71 54', '8 chiffres espacés → 01'],
    ['96243400', '01 96243400', '8 chiffres collés → 01'],
    ['97 1 04 26', '01 97 1 04 26', '7 chiffres (source) → 01'],
    ['95 71 12 56 / 97 68 05 95', '01 95 71 12 56 / 97 68 05 95', 'numéro double → 01'],
    ['95 I7 4I II', '01 95 I7 4I II', 'OCR corrompu (≥4 chiffres) → 01'],
    ['01 95 34 71 54', '01 95 34 71 54', 'déjà préfixé → inchangé'],
    ['(+225) 07 31 06 82', '(+225) 07 31 06 82', 'indicatif étranger → inchangé'],
    ['+229 97 12 34 56', '+229 97 12 34 56', 'format international → inchangé'],
    ['SERO Manou Aristide', 'SERO Manou Aristide', 'champ corrompu (0 chiffre) → inchangé'],
    ['', null, 'vide → null'],
    [null, null, 'null → null'],
    [undefined, null, 'undefined → null'],
    ['  95 34 71 54  ', '01 95 34 71 54', 'espaces périphériques trimés'],
  ];
  for (const [input, expected, label] of cases) {
    const got = normalizeBeninPhone(input);
    check(`${label}`, got === expected, `obtenu=${JSON.stringify(got)}`);
  }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Application dans le service
check('Seed : toEntryData normalise founderPhone/directorPhone',
  /founderPhone:\s*normalizeBeninPhone\(s\.founderPhone\)/.test(svc)
  && /directorPhone:\s*normalizeBeninPhone\(s\.directorPhone\)/.test(svc));
check('Migration DB idempotente UPDATE founderPhone (01 + gardes)',
  /SET "founderPhone" = '01 ' \|\| "founderPhone"/.test(svc)
  && /"founderPhone" NOT LIKE '01%'/.test(svc));
check('Migration DB idempotente UPDATE directorPhone (01 + gardes)',
  /SET "directorPhone" = '01 ' \|\| "directorPhone"/.test(svc)
  && /"directorPhone" NOT LIKE '01%'/.test(svc));
check('Garde anti-indicatif international dans la migration',
  /"founderPhone" NOT LIKE '%\+%/.test(svc));
check('Garde ≥ 4 chiffres (champs corrompus) dans la migration',
  /LENGTH\(REGEXP_REPLACE\("founderPhone", '\[\^0-9\]', '', 'g'\)\) >= 4/.test(svc));
check('Normalisation aussi à la lecture (searchDirectory)',
  /founderPhone:\s*normalizeBeninPhone\(e\.founderPhone\)/.test(svc));

// ══════════════════════════════════════════════════════════════════════
// 2. PARAMÈTRE « limit » — liste intégrale pour le modal
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 2. Paramètre « limit » (liste intégrale du département) ──');

check('DTO SearchDirectoryDto : champ limit déclaré', /limit\?: number;/.test(svc));
check('Service : take plafonné (1..2000, défaut 25)',
  /const take = Math\.min\(Math\.max\(Number\(dto\.limit \?\? 25\) \|\| 25, 1\), 2000\)/.test(svc));

const ctrl = read('apps/api-server/src/federis/federis-patronat.controller.ts');
check('Contrôleur : @Query(\'limit\') accepté', /@Query\('limit'\) limit\?: string/.test(ctrl));
check('Contrôleur : limit transmis au service (Number)', /limit: limit \? Number\(limit\) : undefined/.test(ctrl));

// ══════════════════════════════════════════════════════════════════════
// 3. MODAL SchoolDirectoryModal — structure du composant
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 3. Composant SchoolDirectoryModal ──');

const modalPath = 'apps/web-app/src/components/federis/SchoolDirectoryModal.tsx';
check('Fichier créé', fs.existsSync(path.join(ROOT, modalPath)));
const modal = read(modalPath);

check('Chargement liste intégrale à l\'ouverture (limit: 2000)',
  /limit: 2000/.test(modal));
check('Recherche intégrée debounced (400 ms, ≥ 2 caractères)',
  /}, 400\);/.test(modal) && /q\.length < 2/.test(modal));
check('Rendu incrémental par lots (protection grands départements)',
  /const LOT = 80;/.test(modal) && /visible < entries\.length/.test(modal));
check('Bouton « Saisir manuellement » (établissement absent)',
  /onManual/.test(modal) && /Saisir manuellement/.test(modal));
check('Clic sur un établissement → onPick + fermeture',
  /const handlePick = \(entry: DirectoryEntry\) => \{\s*onClose\(\);\s*onPick\(entry\);/.test(modal));
check('Fermeture Échap + clic sur le fond', /e\.key === 'Escape'/.test(modal) && /e\.target === e\.currentTarget/.test(modal));
check('Scroll verrouillé à l\'arrière-plan (body overflow)', /document\.body\.style\.overflow = 'hidden'/.test(modal));
check('Focus automatique sur le champ de recherche', /inputRef\.current\?\.focus\(\)/.test(modal));
check('Contextes school | center (titres adaptés)', /context === 'center'/.test(modal) && /context === 'school'|context = 'school'/.test(modal));
check('Téléphone affiché (directorPhone ?? founderPhone)', /entry\.directorPhone \?\? entry\.founderPhone/.test(modal));
check('Filtre départemental affiché (scope)', /Département de \$\{departments\[0\]\}/.test(modal));

// ══════════════════════════════════════════════════════════════════════
// 4. INTÉGRATION ÉCOLES RATTACHÉES (FederisSchoolsPage)
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 4. Intégration « Écoles rattachées » ──');

const schools = read('apps/web-app/src/components/federis/FederisSchoolsPage.tsx');
check('Import SchoolDirectoryModal', /import SchoolDirectoryModal from/.test(schools));
check('État showDirectoryModal', /const \[showDirectoryModal, setShowDirectoryModal\] = useState\(false\)/.test(schools));
check('Bouton « Créer une école hors Helm » ouvre la FENÊTRE (plus de toggle direct)',
  /if \(showManual\) \{\s*setShowManual\(false\);\s*\} else \{\s*setShowDirectoryModal\(true\);/.test(schools));
check('Sélection répertoire → fiche pré-remplie + formulaire ouvert',
  /onPick=\{\(entry\) => \{\s*handlePickDirectoryEntry\(entry\);\s*setShowManual\(true\);/.test(schools));
check('« Saisir manuellement » → formulaire vierge (directoryPick réinitialisé)',
  /setDirectoryPick\(null\);\s*setManualForm\(EMPTY_MANUAL_FORM\);/.test(schools));
check('Placeholder téléphone au format « 01 … »', /placeholder="01 …"/.test(schools));

// ══════════════════════════════════════════════════════════════════════
// 5. INTÉGRATION CENTRES (FederisCentersPage)
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 5. Intégration « Centres, salles & Surveillants » ──');

const centers = read('apps/web-app/src/components/federis/FederisCentersPage.tsx');
check('Import SchoolDirectoryModal', /import SchoolDirectoryModal from '\.\/SchoolDirectoryModal'/.test(centers));
check('État showDirectoryModal', /const \[showDirectoryModal, setShowDirectoryModal\] = useState\(false\)/.test(centers));
check('Bouton « Ajouter un centre » ouvre la FENÊTRE (plus de toggle direct)',
  /if \(showCenterForm\) \{\s*setShowCenterForm\(false\);\s*\} else \{\s*setShowDirectoryModal\(true\);/.test(centers));
check('Sélection répertoire → fiche du centre pré-remplie + formulaire ouvert',
  /onPick=\{\(entry\) => \{\s*pickDirectoryCenter\(entry\);\s*setShowCenterForm\(true\);/.test(centers));
check('« Saisir manuellement » → formulaire du centre ouvert',
  /onManual=\{\(\) => \{\s*setShowCenterForm\(true\);/.test(centers));
check('Placeholder téléphone au format « 01 … »', /placeholder="01 …"/.test(centers));

// ══════════════════════════════════════════════════════════════════════
// 6. TRANSPIRATION — les 5 fichiers modifiés/créés compilent
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 6. Transpilation (TypeScript → JS, ts.transpileModule) ──');

check('TypeScript disponible pour la vérification', !!ts);

if (ts) {
  const files = [
    'apps/api-server/src/federis/federis-school-directory.service.ts',
    'apps/api-server/src/federis/federis-patronat.controller.ts',
    'apps/web-app/src/components/federis/SchoolDirectoryModal.tsx',
    'apps/web-app/src/components/federis/FederisSchoolsPage.tsx',
    'apps/web-app/src/components/federis/FederisCentersPage.tsx',
  ];
  for (const f of files) {
    try {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const out = ts.transpileModule(src, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.React,
          esModuleInterop: true,
        },
        reportDiagnostics: true,
      });
      const diags = (out.diagnostics ?? []).filter(
        (d) => d.category === ts.DiagnosticCategory.Error,
      );
      check(`Transpile OK — ${path.basename(f)}`, diags.length === 0,
        diags.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join(' | '));
    } catch (e) {
      check(`Transpile OK — ${path.basename(f)}`, false, e.message);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════
// RÉSULTAT
// ══════════════════════════════════════════════════════════════════════
console.log(`\n═══ RÉSULTAT : ${ok} OK / ${fail} ÉCHEC(S) ════`);
process.exit(fail > 0 ? 1 : 0);
