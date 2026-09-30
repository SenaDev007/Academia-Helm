#!/usr/bin/env node
/**
 * ============================================================================
 * verify_task23.cjs — Fix build Railway/Vercel (api-server) — Task 23
 * ============================================================================
 *
 * CONTEXTE : 5 builds Docker échoués (2026-09-30 14:55 → 15:55) :
 *   x Unexpected token `interface`. Expected * for generator, private key,
 *     identifier or async — src/modules/exams/distinctions/render.service.ts:85
 *
 *   CAUSE : `export interface BatchFile { ... }` déclaré À L'INTÉRIEUR du
 *           corps de la classe DistinctionsRenderService (entre deux méthodes).
 *           Une déclaration interface (a fortiori avec `export`) est interdite
 *           dans un corps de classe — erreur de SYNTAXE pour SWC, donc
 *           nest build (builder swc, typeCheck:false) échoue.
 *
 *   FIX   : interface déplacée au NIVEAU DU MODULE (après les imports, avant
 *           les helpers), classe inchangée par ailleurs. pack.ts (code hérité
 *           non importé, import mort './render.js') reste hors du chemin de
 *           build runtime — aucun impact.
 *
 * VÉRIFICATIONS :
 *   1. Contrôles structurels render.service.ts (interface niveau module,
 *      ordre, plus aucun export indenté, generateBatch intact).
 *   2. Anti-régression : AUCUN `export` indenté dans tout api-server/src
 *      (la même classe de bug ne peut plus se glisser nulle part ailleurs).
 *   3. ⭐ BALAYAGE SWC AUTORITATIF — même moteur et même config que le build
 *      Railway (.swcrc : typescript, decorators, es2021, commonjs) sur TOUS
 *      les .ts/.tsx de src/ + api/ (patterns include du tsconfig).
 *      0 erreur ici = `npm run build` (nest build swc) passera.
 *   4. Bonus web : balayage SWC de apps/web-app (le build Vercel suivant).
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project/ah';
const swc = require('/home/z/node_modules/@swc/core');

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`);
  }
}

/** Liste récursive des .ts/.tsx d'un répertoire (sans node_modules/.next/dist). */
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

/** Transpile via @swc/core avec la config .swcrc du api-server (erreur = throw). */
function swcCompile(file) {
  const code = fs.readFileSync(file, 'utf8');
  const isTsx = file.endsWith('.tsx');
  return swc.transformSync(code, {
    jsc: {
      target: 'es2021',
      parser: { syntax: 'typescript', tsx: isTsx, decorators: true, dynamicImport: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
      keepClassNames: true,
    },
    module: { type: 'commonjs' },
    sourceMaps: false,
  });
}

console.log('════════════════════════════════════════════════════════════════');
console.log(' TASK 23 — FIX BUILD (export interface dans une classe)');
console.log('════════════════════════════════════════════════════════════════');

// ─── 1. Contrôles structurels : render.service.ts ──────────────────────────
console.log('\n── 1. render.service.ts (fichier corrigé) ──');
const svcPath = path.join(ROOT, 'apps/api-server/src/modules/exams/distinctions/render.service.ts');
const src = fs.readFileSync(svcPath, 'utf8');

const ifaceAtModuleLevel = /^export interface BatchFile \{ fileName: string; pdf: Buffer; input: DistinctionInput \}$/m.test(src);
check('interface BatchFile exportée au NIVEAU MODULE (colonne 0, une ligne complète)', ifaceAtModuleLevel);

const ifacePos = src.indexOf('export interface BatchFile');
const classPos = src.indexOf('export class DistinctionsRenderService');
check('interface déclarée AVANT la classe (lisible, importable)', ifacePos >= 0 && classPos > ifacePos);

check('plus AUCUN export indenté dans render.service.ts', !/^\s+export\s+(interface|type|class|function|const|enum|abstract)\s/m.test(src));

check(
  'méthode generateBatch intacte (signature + retour { merged, files: BatchFile[] })',
  /async generateBatch\(inputs: DistinctionInput\[\]\): Promise<\{ merged: Buffer; files: BatchFile\[\] \}>/.test(src)
);
check('corps generateBatch : garde 0 entrée + découpe pdf-lib conservés', /Aucun certificat à générer/.test(src) && /PDFDocument\.load\(merged\)/.test(src));
check('imports inchangés (pdf-lib, PuppeteerPool, templates React)', /from 'pdf-lib'/.test(src) && /puppeteer-pool\.service/.test(src) && /from '\.\/Secondaire'/.test(src));

// ─── 2. Anti-régression : aucun export indenté dans tout api-server ─────────
console.log('\n── 2. Anti-régression (tous les fichiers api-server) ──');
const apiSrcFiles = walk(path.join(ROOT, 'apps/api-server/src'));
const apiDirFiles = walk(path.join(ROOT, 'apps/api-server/api'));
const indentedExports = [];
for (const f of [...apiSrcFiles, ...apiDirFiles]) {
  const code = fs.readFileSync(f, 'utf8');
  const m = code.match(/^[ \t]+export\s+(interface|type|class|function|const|enum|abstract)\s+\w+/m);
  if (m) indentedExports.push(`${path.relative(ROOT, f)} (${m[1].trim()})`);
}
check(
  `aucun 'export' indenté (déclaration dans un corps de classe/bloc) dans ${apiSrcFiles.length + apiDirFiles.length} fichiers`,
  indentedExports.length === 0,
  indentedExports.slice(0, 5).join(' ; ')
);

// ─── 3. ⭐ Balayage SWC autoritatif (même moteur que le build Railway) ──────
console.log('\n── 3. Balayage SWC api-server (src + api — config .swcrc) ──');
const buildFiles = [...apiSrcFiles, ...apiDirFiles];
const swcFailures = [];
for (const f of buildFiles) {
  try {
    swcCompile(f);
  } catch (e) {
    const msg = String((e && e.message) || e)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(' | ');
    swcFailures.push(`${path.relative(ROOT, f)} → ${msg}`);
  }
}
check(
  `SWC compile les ${buildFiles.length} fichiers sans ERREUR DE SYNTAXE (génération complète du build Docker)`,
  swcFailures.length === 0,
  swcFailures.slice(0, 5).join('  ;;  ')
);

// Le fichier qui échouait sur Railway doit maintenant passer :
try {
  swcCompile(svcPath);
  check('render.service.ts transpile OK en SWC (l\'erreur Railway est éliminée)', true);
} catch (e) {
  check('render.service.ts transpile OK en SWC (l\'erreur Railway est éliminée)', false, String(e.message).slice(0, 120));
}

// ─── 4. Bonus : balayage web-app (build Vercel suivant) ─────────────────────
console.log('\n── 4. Bonus web-app (build Vercel) ──');
const webFiles = walk(path.join(ROOT, 'apps/web-app'));
const webFailures = [];
for (const f of webFiles) {
  try {
    swcCompile(f);
  } catch (e) {
    // Le web-app utilise d'autres réglages Next (ex. décorateurs expérimentaux
    // spécifiques) — on ne comptabilise que de vraies erreurs de syntaxe.
    const msg = String((e && e.message) || e);
    webFailures.push(`${path.relative(ROOT, f)} → ${msg.split('\n').filter(Boolean).slice(0, 2).join(' | ')}`);
  }
}
check(
  `SWC compile les ${webFiles.length} fichiers web-app sans erreur de syntaxe`,
  webFailures.length === 0,
  webFailures.slice(0, 5).join('  ;;  ')
);

// ─── Bilan ──────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════════════════════');
console.log(` BILAN : ${pass} ✅ / ${fail} ❌`);
console.log('════════════════════════════════════════════════════════════════');
process.exit(fail === 0 ? 0 : 1);
