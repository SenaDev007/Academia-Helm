#!/usr/bin/env node
/**
 * ============================================================================
 * verify_task23b.cjs — Crash conteneur Railway « Cannot find module » — Task 23b
 * ============================================================================
 *
 * CONTEXTE : après le fix du build (Task 23), le conteneur démarre puis crashe
 *   en boucle : Error: Cannot find module '../../hr/recruitment-email-templates'
 *   depuis /app/dist/modules/exams/distinctions/distinctions-notification.service.js
 *
 *   CAUSE : import '../../hr/recruitment-email-templates' dans un fichier à la
 *   profondeur 3 (src/modules/exams/distinctions/) — '../..'' résout vers
 *   src/modules/ alors que le fichier réel est src/hr/recruitment-email-templates.ts
 *   (profondeur 1). Bug masqué jusqu'ici par l'erreur de SYNTAXE du build : le
 *   conteneur n'avait jamais atteint le runtime. SWC (typeCheck:false) ne valide
 *   PAS les chemins d'import — seule la résolution Node au démarrage le fait.
 *
 *   FIX : '../../hr/recruitment-email-templates' → '../../../hr/recruitment-email-templates'
 *   (cohérent avec les 5 autres imports du même fichier, tous en ../../../)
 *
 * VÉRIFICATIONS :
 *   1. Fix appliqué : import corrigé + cible existe + cohérence profondeur.
 *   2. ⭐ RÉSOLUTION D'IMPORTS EXHAUSTIVE (équivalent runtime Node) sur TOUS les
 *      .ts/.tsx de src/ + api/ : chaque import relatif (from / require / import()
 *      / export from) est résolu depuis le répertoire du fichier avec les
 *      candidats [.ts, .tsx, .js, .jsx, .mjs, .cjs, .json, /index.*] — comme le
 *      fera Node dans dist/ (SWC préserve les spécificateurs, .ts→.js).
 *      Couvre aussi l'alias @/* → src/*.
 *   3. SWC re-passe sur les fichiers modifiés (pas de régression syntaxe).
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project/ah';
const API = path.join(ROOT, 'apps/api-server');
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

/** Extrait les spécificateurs d'import relatifs ou alias @/ d'un fichier. */
function extractImports(code) {
  const specs = new Set();
  const patterns = [
    /(?:^|[^\w$.])from\s*['"]([^'"]+)['"]/g,        // import ... from / export ... from
    /(?:^|[^\w$.])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // require('...')
    /(?:^|[^\w$.])import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,  // import dynamique
    /(?:^|[^\w$.])import\s+['"]([^'"]+)['"]/g,             // import '...' (effets)
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code))) specs.add(m[1]);
  }
  return [...specs].filter((s) => s.startsWith('.') || s.startsWith('@/'));
}

/** Résout un spécificateur comme Node le ferait ; retourne true si trouvé. */
function resolves(fromDir, spec, srcDir) {
  let target;
  if (spec.startsWith('@/')) target = path.join(srcDir, spec.slice(2));
  else target = path.resolve(fromDir, spec);
  // Candidats directs : exact + extensions TS/JS (Node dans dist/ : .ts→.js)
  const exts = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];
  for (const ext of exts) {
    if (fs.existsSync(target + ext) && fs.statSync(target + ext).isFile()) return true;
  }
  // Convention TS : './x.js' peut désigner la source x.ts / x.tsx
  // (compilée en x.js au même endroit dans dist/)
  const jsExt = /\.(js|jsx|mjs|cjs)$/.exec(target);
  if (jsExt) {
    const base = target.slice(0, -jsExt[0].length);
    for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
      if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return true;
    }
  }
  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']) {
    const idx = path.join(target, 'index' + ext);
    if (fs.existsSync(idx)) return true;
  }
  return false;
}

console.log('════════════════════════════════════════════════════════════════');
console.log(' TASK 23b — CRASH RUNTIME « Cannot find module » (résolution imports)');
console.log('════════════════════════════════════════════════════════════════');

// ─── 1. Fix appliqué ────────────────────────────────────────────────────────
console.log('\n── 1. distinctions-notification.service.ts (fichier corrigé) ──');
const notifPath = path.join(API, 'src/modules/exams/distinctions/distinctions-notification.service.ts');
const notif = fs.readFileSync(notifPath, 'utf8');

check(
  "import corrigé : '../../../hr/recruitment-email-templates'",
  /from\s+['"]\.\.\/\.\.\/\.\.\/hr\/recruitment-email-templates['"]/.test(notif)
);
check("plus aucun '../../hr/' (2 niveaux) dans le fichier", !/['"]\.\.\/\.\.\/hr\//.test(notif));
check('cible existe : src/hr/recruitment-email-templates.ts', fs.existsSync(path.join(API, 'src/hr/recruitment-email-templates.ts')));
check(
  'cohérence : les 5 autres imports du fichier sont bien en ../../../',
  [
    '../../../database/prisma.service',
    '../../../communication/services/email.service',
    '../../../communication/services/chat.service',
    '../../../notifications/notification.service',
    '../../../students/services/parent-user-provisioning.service',
  ].every((p) => notif.includes(`'${p}'`))
);
check(
  'fonction importée existe dans recruitment-email-templates.ts : renderEmail, escHtml',
  (() => {
    const t = fs.readFileSync(path.join(API, 'src/hr/recruitment-email-templates.ts'), 'utf8');
    return /export (function|const) renderEmail/.test(t) && /export (function|const) escHtml/.test(t);
  })()
);

// ─── 2. Résolution d'imports exhaustive (src + api) ─────────────────────────
console.log('\n── 2. Résolution exhaustive des imports relatifs (runtime Node) ──');
const srcDir = path.join(API, 'src');
const files = [...walk(srcDir), ...walk(path.join(API, 'api'))];
const broken = [];
let totalImports = 0;
for (const f of files) {
  const code = fs.readFileSync(f, 'utf8');
  for (const spec of extractImports(code)) {
    totalImports++;
    if (!resolves(path.dirname(f), spec, srcDir)) {
      broken.push(`${path.relative(ROOT, f)} → '${spec}'`);
    }
  }
}
check(
  `${totalImports} imports relatifs/alias analysés dans ${files.length} fichiers — TOUS résolvent vers un fichier existant`,
  broken.length === 0,
  broken.slice(0, 10).join('  ;;  ')
);

// ─── 3. Anti-régression SWC (fichiers modifiés + distinctions) ──────────────
console.log('\n── 3. SWC — pas de régression de syntaxe ──');
const swcTargets = [
  notifPath,
  ...[
    'render.service.ts',
    'Board.tsx',
    'Maternel.tsx',
    'Primaire.tsx',
    'Secondaire.tsx',
    'shared.tsx',
    'pack.ts',
  ].map((f) => path.join(API, 'src/modules/exams/distinctions', f)),
];
let swcOk = true;
for (const f of swcTargets) {
  try {
    swc.transformSync(fs.readFileSync(f, 'utf8'), {
      jsc: {
        target: 'es2021',
        parser: { syntax: 'typescript', tsx: f.endsWith('.tsx'), decorators: true, dynamicImport: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        keepClassNames: true,
      },
      module: { type: 'commonjs' },
    });
  } catch { swcOk = false; }
}
check('SWC compile les fichiers modifiés sans erreur', swcOk);

// ─── Bilan ──────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════════════════════');
console.log(` BILAN : ${pass} ✅ / ${fail} ❌`);
console.log('════════════════════════════════════════════════════════════════');
if (fail > 0 && broken.length > 0) {
  console.log('\nImports non résolus (complet) :');
  broken.forEach((b) => console.log('  • ' + b));
}
process.exit(fail === 0 ? 0 : 1);
