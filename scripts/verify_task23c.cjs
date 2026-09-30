#!/usr/bin/env node
/**
 * ============================================================================
 * verify_task23c.cjs — Login Federis « profileRes is not defined » — Task 23c
 * ============================================================================
 *
 * CONTEXTE : plus aucune connexion Federis ne passe — après authentification
 *   réussie, la page login lève ReferenceError: profileRes is not defined.
 *
 *   CAUSE (régression commit a29c54fe8 — Task 21, redirection secrétaires) :
 *   `const profileRes` était déclaré DANS le try interne de la vérification
 *   profil (bloc-scoped), puis référencé APRÈS le bloc pour lire le rôle :
 *   profileRes?.data?.userRole → ReferenceError → attrapé par le catch externe
 *   → message d'erreur affiché, connexion bloquée pour TOUT utilisateur.
 *
 *   FIX : `let profileRole` hissé AVANT le try ; assigné dans le try depuis
 *   profileRes ; la redirection ne référence plus que profileRole.
 *
 * VÉRIFICATIONS :
 *   1. Structurels : profileRole hissé, plus aucun profileRes hors de son try,
 *      vieux pattern détruit.
 *   2. ⭐ RUNTIME : le SEGMENT COMPILÉ RÉEL (SWC, comme Next.js) du login —
 *      try/catch profil + redirection — exécuté en sandbox vm avec mocks :
 *      6 scénarios (secrétaire, coordonnateur, fonction SAISIE_NOTES,
 *      404 sans espace patronat, profil vide, paramètre redirect).
 *   3. ⭐ ANTI-RÉGRESSION : balayage de TOUT web-app/src à la recherche du même
 *      bug de classe (const/let déclaré dans un bloc {try, if, for...} et
 *      référencé APRÈS la fermeture du bloc, à une profondeur d'accolade
 *      inférieure) — analyseur de profondeur avec revue manuelle des hits.
 *   4. SWC : syntaxe du fichier corrigé.
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = '/home/z/my-project/ah';
const swc = require('/home/z/node_modules/@swc/core');

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'dist', '.turbo', 'coverage'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

console.log('════════════════════════════════════════════════════════════════');
console.log(' TASK 23c — LOGIN FEDERIS « profileRes is not defined »');
console.log('════════════════════════════════════════════════════════════════');

// ─── 1. Structurels ─────────────────────────────────────────────────────────
console.log('\n── 1. Structure du fix (login/page.tsx) ──');
const loginPath = path.join(ROOT, 'apps/web-app/src/app/(patronat)/federis/login/page.tsx');
const src = fs.readFileSync(loginPath, 'utf8');

check('`let profileRole: string | null = null;` déclaré AVANT le try du profil', /let profileRole: string \| null = null;\s*\n\s*try \{/.test(src));
check('profileRole assigné dans le try depuis profileRes (userRole ?? userFunction)', /profileRole = profileRes\.data\?\.userRole \?\? profileRes\.data\?\.userFunction \?\? null;/.test(src));
check("redirection basée sur profileRole ('/saisie' vs '/dashboard')", /profileRole === 'PATRONAT_SAISIE_NOTES' \|\| profileRole === 'SAISIE_NOTES'/.test(src));

// profileRes ne doit apparaître QUE dans le try interne (lignes entre `try {` et `} catch (profileErr`)
// — les COMMENTAIRES (lignes //) sont exclus : le fix documente l'ancien bug.
const allLines = src.split('\n');
const profResLines = allLines
  .map((l, i) => ({ l, i: i + 1 }))
  .filter((x) => x.l.includes('profileRes') && !x.l.trim().startsWith('//'));
const lineOf = (needle) => allLines.findIndex((l) => l.includes(needle)) + 1;
const tryLine = lineOf('let profileRole');
const catchLine = lineOf('catch (profileErr');
const inTry = profResLines.every((x) => x.i > tryLine && x.i < catchLine);
check(`les ${profResLines.length} références à profileRes (hors commentaires) sont toutes DANS le try interne`, inTry, profResLines.map((x) => 'L' + x.i).join(','));

check('vieux pattern cassé détruit (profileRes référencé après le catch)', !/catch \(profileErr[\s\S]*?\)\s*\{[\s\S]*?\}\s*\n[\s\S]*?profileRes\?\.data/.test(src));

// ─── 2. RUNTIME du segment compilé réel ─────────────────────────────────────
console.log('\n── 2. Runtime — segment compilé réel (SWC/Next) en sandbox ──');
const compiled = swc.transformSync(src, {
  jsc: {
    target: 'es2021',
    parser: { syntax: 'typescript', tsx: true, decorators: true, dynamicImport: true },
    transform: { legacyDecorator: true, decoratorMetadata: true },
    keepClassNames: true,
  },
  module: { type: 'commonjs' },
  sourceMaps: false,
}).code;

const segStart = compiled.indexOf('let profileRole = null;');
const segEndMarker = "window.location.href =";
const segEnd = compiled.indexOf(segEndMarker, segStart);
let segment = '';
if (segStart >= 0 && segEnd > segStart) {
  segment = compiled.slice(segStart, compiled.indexOf(';', segEnd) + 1);
}
check('segment profil+redirection extrait du build SWC réel', segment.length > 200, segStart < 0 ? 'marqueur profileRole introuvable' : '');

if (segment) {
  const makeFlow = (profileData, profileErr, redirectParam) => {
    const calls = { logout: 0, errors: null, fresh: 0, href: null };
    const apiClient = { get: async () => { if (profileErr) throw profileErr; return { data: profileData }; } };
    const sandboxWindow = { location: { href: '' } };
    Object.defineProperty(sandboxWindow, 'location', { value: { set href(v) { calls.href = v; }, get href() { return calls.href || ''; } }, writable: false, configurable: true });
    const fn = new Function(
      'apiClient', 'logoutCleanup', 'setErrors', 'markFreshLogin', 'searchParams', 'federisBase', 'window', '_client', '_clientaccesstoken',
      `"use strict"; return (async () => {\n${segment}\n})();`
    );
    const p = fn(
      apiClient,
      async () => { calls.logout++; },
      (e) => { calls.errors = e; },
      () => { calls.fresh++; },
      { get: (k) => (k === 'redirect' ? redirectParam : null) },
      '/federis',
      sandboxWindow,
      { apiClient },                          // module '@/lib/api/client'
      { markFreshLogin: () => { calls.fresh++; } }, // module '@/lib/auth/client-access-token'
    );
    return p.then(() => calls);
  };

  const scenarios = [
    ['secrétaire PATRONAT_SAISIE_NOTES → /federis/saisie (redirect /saisie de la Task 21)',
      { id: 'p1', userRole: 'PATRONAT_SAISIE_NOTES', userFunction: null }, null, null,
      (t) => t.href === '/federis/saisie' && t.fresh === 1 && !t.errors],
    ['coordonnateur patronat → /federis/dashboard',
      { id: 'p2', userRole: 'PATRONAT_COORDONNATEUR', userFunction: 'COORDONNATEUR' }, null, null,
      (t) => t.href === '/federis/dashboard'],
    ['fonction SAISIE_NOTES (userRole absent) → /federis/saisie',
      { id: 'p3', userRole: null, userFunction: 'SAISIE_NOTES' }, null, null,
      (t) => t.href === '/federis/saisie'],
    ['compte sans espace patronat (404) → logout + « Aucun espace patronat », PAS de redirection',
      null, { response: { status: 404 } }, null,
      (t) => t.logout === 1 && (t.errors?.submit || '').includes('Aucun espace patronat') && !t.href && t.fresh === 0],
    ['profil vide (id absent) → « Impossible de vérifier », PAS de redirection',
      { id: null }, null, null,
      (t) => t.logout === 1 && (t.errors?.submit || '').includes('Impossible de vérifier') && !t.href],
    ['paramètre redirect honoré (/federis/exams?tab=notes)',
      { id: 'p6', userRole: 'PATRONAT_TRESORIER' }, null, '/federis/exams?tab=notes',
      (t) => t.href === '/federis/exams?tab=notes'],
  ];

  (async () => {
    for (const [label, data, err, redirect, ok] of scenarios) {
      const t = await makeFlow(data, err, redirect);
      check(label, ok(t), JSON.stringify(t));
    }
    finishScan();
  })().catch((e) => { console.log('  ❌ runtime : ' + e.message); fail++; finishScan(); });
} else {
  finishScan();
}

function finishScan() {

// ─── 3. Anti-régression : balayage web-app du même bug de classe ────────────
console.log('\n── 3. Balayage web-app — variables hors de leur bloc ──');
/**
 * Heuristique v2 : profondeur d'accolades par caractère (hors chaînes et
 * commentaires approximés).
 *   - profondeur de DÉCLARATION = min(début de ligne, fin de ligne) — une ligne
 *     « const f = (x) => { » appartient à la portée AVANT l'accolade qu'elle ouvre ;
 *   - profondeur d'USAGE = début de ligne — l'usage est évalué avant les
 *     accolades ouvertes sur sa ligne ;
 *   - un identifiant utilisé à une profondeur < sa déclaration, sans autre
 *     déclaration du même nom à profondeur ≤ l'usage AVANT la ligne, est hors
 *     de portée → bug de classe « profileRes ».
 */
function scanScopeBugs(files) {
  const hits = [];
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    const lineStart = [];
    const lineEnd = [];
    let depth = 0;
    for (const line of lines) {
      lineStart.push(depth);
      let inS = null, inC = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i], n = line[i + 1];
        if (inC) { if (c === '*' && n === '/') { inC = false; i++; } continue; }
        if (!inS && c === '/' && n === '/') break;
        if (!inS && c === '/' && n === '*') { inC = true; i++; continue; }
        if (inS) { if (c === inS && line[i - 1] !== '\\') inS = null; continue; }
        if (c === "'" || c === '"') { inS = c; continue; }
        if (c === '`') { inS = inS === '`' ? null : (inS ? inS : '`'); continue; }
        if (c === '{') depth++;
        else if (c === '}') depth--;
      }
      lineEnd.push(depth);
    }
    // Toutes les déclarations const/let simples avec leur profondeur effective
    const decls = new Map(); // name -> [{line, depth}]
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line) || /^\s*import\b/.test(line)) return;
      const m = /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=/.exec(line);
      if (m) {
        const d = Math.min(lineStart[i], lineEnd[i]);
        if (!decls.has(m[1])) decls.set(m[1], []);
        decls.get(m[1]).push({ line: i, depth: d });
      }
    });
    for (const [name, ds] of decls) {
      const re = new RegExp(`(?<![\\w$.])${name}(?![\\w$?]|\\s*[:=])`);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // commentaires exclus
        if (!re.test(line)) continue;
        const uDepth = lineStart[i];
        const before = ds.some((d) => d.line < i && d.depth <= uDepth);
        const outOfScope = ds.some((d) => d.line < i && d.depth > uDepth);
        if (outOfScope && !before) {
          hits.push(`${path.relative(ROOT, f)}:${i + 1} « ${name} » ${ds.map((d) => `L${d.line + 1}(prof ${d.depth})`).join(',')} utilisé L${i + 1} (prof ${uDepth}) → ${line.trim().slice(0, 90)}`);
          break;
        }
      }
    }
  }
  return hits;
}
const webFiles = walk(path.join(ROOT, 'apps/web-app/src'));
const hits = scanScopeBugs(webFiles);
// Le fichier corrigé ne doit plus rien déclencher
const loginHits = hits.filter((h) => h.includes('federis/login'));
check(`login/page.tsx ne déclenche PLUS l'analyse de portée (${webFiles.length} fichiers scannés)`, loginHits.length === 0, loginHits.join(' ;; '));

if (hits.length > 0) {
  console.log(`\n  ⚠ ${hits.length} candidat(s) dans web-app à examiner (possibles faux positifs — redeclaration sœur, template literals…) :`);
  hits.slice(0, 20).forEach((h) => console.log('    • ' + h));
}

// ─── 4. SWC syntaxe ─────────────────────────────────────────────────────────
console.log('\n── 4. SWC — syntaxe du fichier corrigé ──');
let swcOk = true;
try {
  swc.transformSync(src, {
    jsc: { target: 'es2021', parser: { syntax: 'typescript', tsx: true, decorators: true, dynamicImport: true }, transform: { legacyDecorator: true, decoratorMetadata: true }, keepClassNames: true },
    module: { type: 'commonjs' },
  });
} catch (e) { swcOk = false; console.log('    ' + String(e.message).slice(0, 120)); }
check('SWC compile login/page.tsx sans erreur', swcOk);

// ─── Bilan ──────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════════════════════');
console.log(` BILAN : ${pass} ✅ / ${fail} ❌`);
console.log('════════════════════════════════════════════════════════════════');
process.exit(fail === 0 ? 0 : 1);
}
