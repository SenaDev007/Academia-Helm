#!/usr/bin/env node
/**
 * verify_task19.cjs — Vérification du lot 2026-09-30 (module « Épreuves et
 * documents » — Academia Frederis) :
 *
 *   1. IMAGES DE LA BIBLIOTHÈQUE CASSÉES (éditeur enrichi) : le middleware
 *      réécrivait /pedagogy-assets/** et /pedagogy-images/** en
 *      /federis/… sur les sous-domaines patronat + satellite academiafederis
 *      → 404 → vignettes cassées + insertion impossible. Désormais exclus
 *      du matcher ET gardés par isPublicStaticAsset dans les 3 branches de
 *      rewrite (academiafederis, patronat*, saisiemaster).
 *   2. HABILLAGE / DÉPLACEMENT / REDIMENSIONNEMENT : le commit « Win Agro »
 *      (57ee58634) avait SUPPRIMÉ de globals.css tout le bloc CSS de l'éditeur
 *      (poignées .ah-handle, curseur main .ah-media-selected, fantôme de
 *      déplacement, outils tableau V14) ET les 14 @font-face → restauration.
 *   3. EN-TÊTE PDF : doublon « Année scolaire : Année scolaire 2026-2027 »
 *      supprimé (strip du préfixe) ; session (« Examen blanc ») déplacée
 *      SOUS l'en-tête ; titre : la ligne système « ÉPREUVE : {matière} »
 *      disparaît dès qu'un titre est saisi, sinon elle reste CENTRÉE.
 *   4. MISE EN VALEUR DES INTITULÉS (labelStyle : gras/souligné/italique/
 *      taille) — Situation d'évaluation, Tâche, titres de sections.
 *   5. COPIES DU SUJET PAR PAGE A4 (copiesPerPage 1|2|3) avec lignes de
 *      découpe ✂ pour les petites épreuves.
 *   6. FILIGRANE (watermarkMode none|logo|text) — logo du patronat (module
 *      Paramètres) ou texte personnalisé, répété sur toutes les pages.
 *
 * Exécution : node scripts/verify_task19.cjs
 */

const fs = require('fs');
const path = require('path');

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

// TypeScript partagé (même pattern que verify_task15/16.cjs)
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
  } catch { /* essayer le suivant */ }
}

/** Transpile un extrait TS et l'évalue en CommonJS (retourne les exports). */
function evalTsModule(code) {
  const out = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', out)(mod, mod.exports, require);
  return mod.exports;
}

console.log('════════════════════════════════════════════════════════════════════');
console.log(' TASK 19 — Module « Épreuves et documents » : 6 retours utilisateur');
console.log('════════════════════════════════════════════════════════════════════');

// ══════════════════════════════════════════════════════════════════════
// 1. MIDDLEWARE — images de la bibliothèque (rewrite satellite → 404)
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 1. Middleware — /pedagogy-assets & /pedagogy-images jamais réécrits ──');

const mw = read('apps/web-app/src/middleware.ts');

check('Constante PUBLIC_STATIC_PREFIXES définie', mw.includes('PUBLIC_STATIC_PREFIXES'));
check('Dossiers pédagogiques dans PUBLIC_STATIC_PREFIXES',
  mw.includes("'/pedagogy-assets/'") && mw.includes("'/pedagogy-images/'"));
check('Helper isPublicStaticAsset défini', /function isPublicStaticAsset\(/.test(mw));

// Le matcher exclut les dossiers (le middleware ne s'exécute même plus dessus)
const matcherMatch = mw.match(/'\/\(\(\?![^']*\)\.\*\)'/);
check('Matcher présent', !!matcherMatch);
if (matcherMatch) {
  const m = matcherMatch[0];
  check('Matcher exclut pedagogy-assets/', m.includes('pedagogy-assets/'));
  check('Matcher exclut pedagogy-images/', m.includes('pedagogy-images/'));
}

// Les 3 branches de rewrite gardent les assets statiques
const branchFederis = mw.slice(mw.indexOf("hostParts[0] === 'academiafederis'"), mw.indexOf("hostParts[0] === 'saisiemaster'"));
check('Branche satellite academiafederis : garde isPublicStaticAsset',
  branchFederis.includes('isPublicStaticAsset(pathname)'));
const branchSaisie = mw.slice(mw.indexOf("hostParts[0] === 'saisiemaster'"), mw.indexOf('Sous-domaines PATRONAT'));
check('Branche satellite saisiemaster : garde isPublicStaticAsset',
  branchSaisie.includes('isPublicStaticAsset(pathname)'));
const patronatIdx = mw.indexOf('Sous-domaines PATRONAT');
const branchPatronat = mw.slice(patronatIdx, mw.indexOf('Routes Patronat (Academia Federis)'));
check('Branche sous-domaines patronat : garde isPublicStaticAsset',
  branchPatronat.includes('isPublicStaticAsset(pathname)'));

// RUNTIME — la fonction elle-même (extraite + transpilée)
if (ts) {
  const fnMatch = mw.match(/const PUBLIC_STATIC_PREFIXES[\s\S]*?\nfunction isPublicStaticAsset[\s\S]*?\n}/);
  check('Extrait PUBLIC_STATIC_PREFIXES + isPublicStaticAsset récupérable', !!fnMatch);
  if (fnMatch) {
    const exports = evalTsModule(`${fnMatch[0]}\nmodule.exports = { isPublicStaticAsset };`);
    const isa = exports.isPublicStaticAsset;
    check('RUNTIME /pedagogy-assets/anatomie/cerveau.svg → statique', isa('/pedagogy-assets/anatomie/cerveau.svg') === true);
    check('RUNTIME /pedagogy-images/botanique/fleur.jpg → statique', isa('/pedagogy-images/botanique/fleur.jpg') === true);
    check('RUNTIME /fonts/playwrite-fr-moderne.woff2 → statique', isa('/fonts/playwrite-fr-moderne.woff2') === true);
    check('RUNTIME /federis/documents (app) → PAS statique', isa('/federis/documents') === false);
    check('RUNTIME /app/pedagogy/production → PAS statique', isa('/app/pedagogy/production') === false);
    check('RUNTIME /patronat/federis/exams → PAS statique', isa('/patronat/federis/exams') === false);
    check('RUNTIME /videos/intro.mp4 → statique', isa('/videos/intro.mp4') === true);
  }
} else {
  check('TypeScript disponible (tests runtime middleware)', false, 'typescript introuvable');
}

// ══════════════════════════════════════════════════════════════════════
// 2. CSS ÉDITEUR RESTAURÉ (supprimé par erreur par le commit Win Agro)
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 2. globals.css — styles .ah-* + 14 @font-face restaurés ──');

const css = read('apps/web-app/src/app/globals.css');

check('.ah-media-hover (survol : contour pointillé + curseur main)',
  /\.ah-media-hover\s*\{[^}]*cursor:\s*pointer/.test(css));
check('.ah-media-selected (sélection : contour + curseur move)',
  /\.ah-media-selected\s*\{[^}]*cursor:\s*move/.test(css));
check('.ah-handle (poignées de redimensionnement)',
  /\.ah-handle\s*\{[^}]*position:\s*absolute/.test(css));
check('.ah-handle[data-dir] (curseurs de coin nw/ne/sw/se)',
  css.includes('.ah-handle[data-dir="nw"]') && css.includes('.ah-handle[data-dir="se"]'));
check('.ah-media-dragging (fantôme de déplacement)', /\.ah-media-dragging\s*\{[^}]*opacity/.test(css));
check('.ah-float-devant / .ah-float-derriere (habillage devant/derrière)',
  css.includes('.ah-float-devant'));
check('Filet de sécurité SVG historiques (span.ah-fig inline-block)',
  css.includes('span.ah-fig[style*="inline-block"] > svg[viewBox]:not([width]):not([style])'));
check('.ah-tab (taquets de tabulation V14)', /\.ah-tab\s*\{/.test(css));
check('.ah-tablehandle (poignée ⬛ de sélection tableau)',
  /\.ah-tablehandle\s*\{[^}]*cursor:\s*move/.test(css));
check('.ah-colhandle (séparateurs de colonnes Word/Excel)',
  /\.ah-colhandle\s*\{[^}]*cursor:\s*col-resize/.test(css));
check('Cellules ah-table : curseur texte (édition)',
  css.includes('table.ah-table td,') && css.includes('table.ah-table th {'));

const fontFamilies = [
  'Playwrite FR Moderne', 'Playwrite FR Trad', 'Comic Neue', 'Montserrat',
  'Playfair Display', 'EB Garamond', 'Merriweather', 'Dancing Script',
  'Caveat', 'Patrick Hand', 'Lobster Two', 'Arimo', 'Tinos', 'Carlito',
];
let fontsOk = 0;
for (const fam of fontFamilies) {
  if (new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*'${fam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 's').test(css)) fontsOk++;
}
check(`14 @font-face de l'éditeur présents (${fontsOk}/14)`, fontsOk === 14);

// ══════════════════════════════════════════════════════════════════════
// 3. SERVICE ÉPREUVES — helpers purs (runtime) + template PDF
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 3. Service épreuves — helpers runtime ──');

const svc = read('apps/api-server/src/federis/federis-epreuve.service.ts');

if (ts) {
  // stripAcademicYearPrefix
  const stripMatch = svc.match(/private stripAcademicYearPrefix[\s\S]*?\n  \}/);
  check('Méthode stripAcademicYearPrefix présente', !!stripMatch);
  if (stripMatch) {
    // Retire le "private" pour l'évaluer comme fonction autonome
    const fnCode = stripMatch[0].replace('private stripAcademicYearPrefix', 'function stripAcademicYearPrefix');
    const exports = evalTsModule(`${fnCode}\nmodule.exports = { stripAcademicYearPrefix };`);
    const strip = exports.stripAcademicYearPrefix;
    check('RUNTIME « Année scolaire 2026-2027 » → « 2026-2027 »', strip('Année scolaire 2026-2027') === '2026-2027');
    check('RUNTIME « Année scolaire : 2026-2027 » → « 2026-2027 »', strip('Année scolaire : 2026-2027') === '2026-2027');
    check('RUNTIME « Année académique 2025-2026 » → « 2025-2026 »', strip('Année académique 2025-2026') === '2025-2026');
    check('RUNTIME « 2026-2027 » inchangé', strip('2026-2027') === '2026-2027');
    check('RUNTIME null → null', strip(null) === null);
    check('RUNTIME « Année scolaire » seule → conservée (non vide)', strip('Année scolaire') === 'Année scolaire');
  }

  // sanitizeLabelStyle — ⚠️ signature multi-ligne : le type de retour contient
  // un « } » à 2 espaces → on exige que l'accolade fermante soit suivie d'une
  // nouvelle ligne (fin réelle de la méthode).
  const lsMatch = svc.match(/private sanitizeLabelStyle[\s\S]*?\n  \}\n/);
  check('Méthode sanitizeLabelStyle présente', !!lsMatch);
  if (lsMatch) {
    const fnCode = lsMatch[0].replace('private sanitizeLabelStyle', 'function sanitizeLabelStyle');
    const exports = evalTsModule(`${fnCode}\nmodule.exports = { sanitizeLabelStyle };`);
    const sls = exports.sanitizeLabelStyle;
    const def = sls(undefined);
    check('RUNTIME défaut : gras OUI (style historique)', def.bold === true);
    check('RUNTIME défaut : souligné/italique NON', def.underline === false && def.italic === false);
    check('RUNTIME défaut : taille 12 px', def.fontSize === 12);
    const custom = sls({ bold: false, underline: true, italic: true, fontSize: 16 });
    check('RUNTIME personnalisé conservé (non gras, souligné, italique, 16 px)',
      custom.bold === false && custom.underline === true && custom.italic === true && custom.fontSize === 16);
    check('RUNTIME taille hors bornes ramenée à 12 (999 → 12)', sls({ fontSize: 999 }).fontSize === 12);
    check('RUNTIME taille hors bornes ramenée à 12 (2 → 12)', sls({ fontSize: 2 }).fontSize === 12);
    check('RUNTIME valeurs corrompues → défauts (string, array)', Array.isArray(sls('x')) === false && sls(['x']).bold === true);
  }

  // sanitizeCopiesPerPage
  const cpMatch = svc.match(/private sanitizeCopiesPerPage[\s\S]*?\n  \}/);
  check('Méthode sanitizeCopiesPerPage présente', !!cpMatch);
  if (cpMatch) {
    const fnCode = cpMatch[0].replace('private sanitizeCopiesPerPage', 'function sanitizeCopiesPerPage');
    const exports = evalTsModule(`${fnCode}\nmodule.exports = { sanitizeCopiesPerPage };`);
    const scp = exports.sanitizeCopiesPerPage;
    check('RUNTIME 1 → 1, 2 → 2, 3 → 3', scp(1) === 1 && scp(2) === 2 && scp(3) === 3);
    check('RUNTIME 4 → 1 (hors bornes)', scp(4) === 1);
    check('RUNTIME undefined → 1 (défaut)', scp(undefined) === 1);
    check('RUNTIME "2" (JSON string) → 2', scp('2') === 2);
  }

  // sanitizeWatermarkMode
  const wmMatch = svc.match(/private sanitizeWatermarkMode[\s\S]*?\n  \}/);
  check('Méthode sanitizeWatermarkMode présente', !!wmMatch);
  if (wmMatch) {
    const fnCode = wmMatch[0].replace('private sanitizeWatermarkMode', 'function sanitizeWatermarkMode');
    const exports = evalTsModule(`${fnCode}\nmodule.exports = { sanitizeWatermarkMode };`);
    const swm = exports.sanitizeWatermarkMode;
    check('RUNTIME logo/texte acceptés, invalide → none',
      swm('logo') === 'logo' && swm('text') === 'text' && swm('LOGO') === 'none' && swm(undefined) === 'none');
  }
} else {
  check('TypeScript disponible (tests runtime service)', false, 'typescript introuvable');
}

// ══════════════════════════════════════════════════════════════════════
// 4. TEMPLATE PDF — en-tête, session, titre, intitulés, copies, filigrane
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 4. Template PDF — en-tête / session / titre / mise en page ──');

check('Doublon « Année scolaire » : stripAcademicYearPrefix appliqué au label',
  svc.includes('const yearLabel = this.stripAcademicYearPrefix(ctx.academicYearLabel)'));
check('Label rendu avec le préfixe unique « Année scolaire : »',
  svc.includes('`Année scolaire : ${esc(yearLabel)}`'));
check('La session n\'est PLUS dans la meta-row de l\'en-tête (meta-center supprimé)',
  !svc.includes('meta-center'));
check('Ligne dédiée .session-line SOUS l\'en-tête (tous modes)',
  svc.includes('<div class="session-line">') && svc.includes('${sessionLine}'));
check('Session injectée dans le contenu du sujet (avant le titre)',
  svc.indexOf('${headerHtml}') < svc.indexOf('${sessionLine}') &&
  svc.indexOf('${sessionLine}') < svc.indexOf('${titleHtml}'));

check('Logique hasCustomTitle (titre saisi vs ligne système)',
  svc.includes('hasCustomTitle') && svc.includes("/^épreuve sans titre$/i.test(rawTitle)"));
check('Titre personnalisé → ligne système « ÉPREUVE : {matière} » absente',
  svc.includes('const titleHtml = hasCustomTitle') &&
  svc.includes('? `<div class="eval-title">${esc(rawTitle).toUpperCase()}</div>`'));
check('Ligne système (sans titre) rendue via .eval-title CENTRÉE',
  svc.includes('paper.subject') && svc.includes('`ÉPREUVE : ${esc(paper.subject).toUpperCase()}`'));
check('Ancien badge bleu .epreuve-title aligné à gauche SUPPRIMÉ du template Fédéris',
  !/class=\\"epreuve-title\\"/.test(svc) && !svc.includes('<div class="epreuve-title">'));
check('CSS .eval-title centré (text-align: center)', /\.eval-title\s*\{[^}]*text-align:\s*center/.test(svc));

check('Intitulés paramétrables : .section-label piloté par labelStyle',
  svc.includes('${ls.bold ? \'700\' : \'400\'}') && svc.includes('${ls.fontSize}px'));
check('Section-label appliqué à Situation d\'évaluation + Tâche',
  svc.includes("<div class=\"section-label\">Situation d'évaluation</div>") &&
  svc.includes('<div class="section-label">Tâche</div>'));

check('Copies par A4 : branches .copy-2 / .copy-3 + lignes de découpe',
  svc.includes('.copy-2 { height: 124mm; }') && svc.includes('.copy-3 { height: 80mm; }'));
check('Ligne de découpe ✂ (« Découper ici »)', svc.includes('✂ Découper ici') && svc.includes('.cut-line'));
check('Duplication du sujet (copiesPerPage > 1 → N bandes)', svc.includes('copiesPerPage > 1') && svc.includes('class="copy copy-'));
check('Hauteurs des bandes cohérentes avec un A4 (265 mm utiles)',
  /height:\s*124mm/.test(svc) && /height:\s*80mm/.test(svc));

check('Filigrane : .wm répété sur toutes les pages (position: fixed)',
  /\.wm\s*\{[^}]*position:\s*fixed/.test(svc));
check('Filigrane logo du patronat (module Paramètres)', svc.includes('wmMode === \'logo\' && ctx.logo'));
check('Filigrane texte personnalisé', svc.includes('wmMode === \'text\''));
check('${watermarkHtml} injecté dans le <body>', svc.includes('${watermarkHtml}'));

// ══════════════════════════════════════════════════════════════════════
// 4-bis. E2E — RENDU RÉEL DU TEMPLATE PDF (buildEpreuvePdfHtml exécuté)
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 4-bis. E2E — rendu réel du template PDF ──');

if (ts) {
  try {
    // 1. Extraire les pièces réelles du service : esc, constantes, helpers,
    //    et la méthode buildEpreuvePdfHtml ENTIÈRE (jusqu'au marqueur suivant).
    const escSrc = svc.match(/function esc\(value: unknown\): string \{[\s\S]*?\n\}/)[0];
    const constsSrc = `const CATEGORY_LABELS = { CEP: 'x', BEPC: 'x', BAC: 'x', CAP: 'x' };\nconst CATEGORY_SHORT_LABELS = { CEP: 'CEP', BEPC: 'BEPC', BAC: 'Baccalauréat', CAP: 'CAP' };`;
    const helperNames = ['sanitizeRichHtml', 'sanitizeLabelStyle', 'sanitizeCopiesPerPage', 'sanitizeWatermarkMode', 'stripAcademicYearPrefix'];
    const helpersSrc = helperNames.map((name) => {
      const m = svc.match(new RegExp(`private ${name}[\\s\\S]*?\\n  \\}\\n`));
      if (!m) throw new Error(`helper ${name} introuvable`);
      return m[0].replace(`private ${name}`, `function ${name}`);
    }).join('\n\n');
    const buildStart = svc.indexOf('private buildEpreuvePdfHtml');
    const buildEnd = svc.indexOf('// ── Helpers internes');
    let buildSrc = svc.slice(buildStart, buildEnd).trim();
    // « private m(…) » (méthode de classe) → « function m(…) » autonome
    buildSrc = buildSrc.replace('private buildEpreuvePdfHtml', 'function buildEpreuvePdfHtml');

    const testModule = evalTsModule(`
${constsSrc}
${escSrc}
${helpersSrc}
const SCHOOL_FONTS_CSS = '/* polices stub */';
${buildSrc}
module.exports = { buildEpreuvePdfHtml, sanitizeRichHtml, sanitizeLabelStyle, sanitizeCopiesPerPage, sanitizeWatermarkMode, stripAcademicYearPrefix };
`);

    const buildFn = testModule.buildEpreuvePdfHtml;
    const fakeThis = {
      sanitizeRichHtml: testModule.sanitizeRichHtml,
      sanitizeLabelStyle: testModule.sanitizeLabelStyle,
      sanitizeCopiesPerPage: testModule.sanitizeCopiesPerPage,
      sanitizeWatermarkMode: testModule.sanitizeWatermarkMode,
      stripAcademicYearPrefix: testModule.stripAcademicYearPrefix,
    };
    const baseCtx = {
      patronatName: 'Patronat des Établissements Privés du Borgou',
      patronatShortName: 'PPEPB',
      abbreviation: 'PPEPB',
      country: 'Bénin',
      logo: 'https://example.test/logo.png',
      reusableHeader: null,
      academicYearLabel: 'Année scolaire 2026-2027',
    };
    const basePaper = {
      title: 'Épreuve de expression écrite',
      subject: 'Expression écrite',
      sessionLabel: 'Examen blanc',
      durationLabel: '2h',
      maxScoreLabel: '20 pts',
      coefficient: '2',
      showIdentityFields: true,
      examCategory: 'CEP',
      situation: '<p>Traite le sujet suivant.</p>',
      tache: '<p>Rédige un texte.</p>',
      sections: [{ id: 's1', title: 'Exercice 1', content: '<p>Consigne…</p>' }],
      cleCorrection: '',
      grilleCorrection: '',
      footerText: 'Bon courage.',
      customHeader: '',
      labelStyle: null,
      copiesPerPage: 1,
      watermarkMode: 'none',
      watermarkText: null,
    };

    // ── Cas 1 : titre saisi + session + en-tête par défaut ──
    let html = buildFn.call(fakeThis, { ...basePaper }, { ...baseCtx });
    check('E2E : « Année scolaire : 2026-2027 » SANS doublon',
      html.includes('Année scolaire : 2026-2027') && !html.includes('Année scolaire : Année scolaire'));
    const headerEnd = html.indexOf('</div>\n        <div class="session-line">') >= 0
      ? html.indexOf('class="session-line"')
      : html.indexOf('class="session-line"');
    const headerIdx = html.indexOf('class="header"');
    const titleIdx = html.indexOf('class="eval-title"');
    check('E2E : session APRÈS le bloc en-tête et AVANT le titre',
      headerIdx > -1 && headerEnd > headerIdx && titleIdx > headerEnd);
    check('E2E : « Examen blanc » sur sa propre ligne (session-line)',
      html.includes('class="session-line"') && html.includes('Examen blanc'));
    check('E2E : titre personnalisé affiché (EXPRESSION ÉCRITE)',
      html.includes('ÉPREUVE DE EXPRESSION ÉCRITE'));
    check('E2E : ligne système « ÉPREUVE : » ABSENTE (titre saisi)',
      !html.includes('ÉPREUVE : EXPRESSION ÉCRITE</div>'));
    check('E2E : une seule page (1 copie), aucun élément de découpe',
      (html.match(/class="copy /g) || []).length === 0 && !html.includes('<div class="cut-line"'));
    check('E2E : aucun filigrane (mode none)', !html.includes('class="wm"'));
    check('E2E : intitulés Situation d\'évaluation + Tâche rendus',
      html.includes("Situation d'évaluation") && html.includes('Tâche'));

    // ── Cas 2 : PAS de titre → ligne système CENTRÉE (eval-title) ──
    html = buildFn.call(fakeThis, { ...basePaper, title: 'Épreuve sans titre' }, { ...baseCtx });
    check('E2E : sans titre → « ÉPREUVE : EXPRESSION ÉCRITE » en .eval-title (centrée)',
      html.includes('class="eval-title">ÉPREUVE : EXPRESSION ÉCRITE</div>'));
    check('E2E : sans titre → aucune seconde ligne de titre',
      (html.match(/class="eval-title"/g) || []).length === 1);

    // ── Cas 3 : 2 copies par A4 + filigrane logo + intitulés soulignés ──
    html = buildFn.call(fakeThis, {
      ...basePaper,
      copiesPerPage: 2,
      watermarkMode: 'logo',
      labelStyle: { bold: true, underline: true, italic: false, fontSize: 14 },
    }, { ...baseCtx });
    check('E2E : 2 copies du sujet sur la page (bandes .copy-2)',
      (html.match(/class="copy copy-2"/g) || []).length === 2);
    check('E2E : 1 ligne de découpe ✂ entre les 2 copies',
      (html.match(/class="cut-line"/g) || []).length === 1 && html.includes('✂ Découper ici'));
    check('E2E : chaque copie contient le titre + l\'identité + le corps',
      (html.match(/ÉPREUVE DE EXPRESSION ÉCRITE/g) || []).length === 2 &&
      (html.match(/class="identity"/g) || []).length === 2);
    check('E2E : filigrane logo du patronat présent',
      html.includes('class="wm"') && html.includes('https://example.test/logo.png'));
    check('E2E : intitulés soulignés 14 px (labelStyle appliqué au CSS)',
      html.includes('text-decoration: underline') && html.includes('font-size: 14px'));

    // ── Cas 4 : 3 copies + filigrane TEXTE ──
    html = buildFn.call(fakeThis, {
      ...basePaper,
      title: 'Épreuve sans titre',
      copiesPerPage: 3,
      watermarkMode: 'text',
      watermarkText: 'examen blanc',
    }, { ...baseCtx });
    check('E2E : 3 copies + 2 lignes de découpe',
      (html.match(/class="copy copy-3"/g) || []).length === 3 &&
      (html.match(/class="cut-line"/g) || []).length === 2);
    check('E2E : filigrane texte en MAJUSCULES',
      html.includes('EXAMEN BLANC') && html.includes('class="wm-text"'));

    // ── Cas 5 : en-tête réutilisable → session quand même visible ──
    html = buildFn.call(fakeThis, { ...basePaper }, { ...baseCtx, reusableHeader: '<p>MON EN-TÊTE PATRONAT</p>' });
    check('E2E : en-tête réutilisable rendu + session SOUS l\'en-tête',
      html.includes('MON EN-TÊTE PATRONAT') && html.includes('class="session-line"') &&
      html.indexOf('MON EN-TÊTE PATRONAT') < html.indexOf('class="session-line"'));

    // ── Cas 6 : filigrane logo sans logo défini → aucun filigrane ──
    html = buildFn.call(fakeThis, { ...basePaper, watermarkMode: 'logo' }, { ...baseCtx, logo: null });
    check('E2E : mode logo sans logo défini → repli silencieux (aucun .wm)',
      !html.includes('class="wm"'));
  } catch (e) {
    check('E2E : rendu du template sans exception', false, String(e && e.message ? e.message : e));
  }
} else {
  check('TypeScript disponible (E2E template)', false, 'typescript introuvable');
}

// ══════════════════════════════════════════════════════════════════════
// 5. DTO + persistance + schéma
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 5. DTO, persistance, schéma DB ──');

const createDtoIdx = svc.indexOf('export class CreateEpreuveDto');
const updateDtoIdx = svc.indexOf('export class UpdateEpreuveDto');
const headerDtoIdx = svc.indexOf('export class UpdateEpreuveHeaderDto');
const createDto = svc.slice(createDtoIdx, updateDtoIdx);
const updateDto = svc.slice(updateDtoIdx, headerDtoIdx);

for (const [name, dto] of [['CreateEpreuveDto', createDto], ['UpdateEpreuveDto', updateDto]]) {
  check(`${name} : labelStyle`, dto.includes('labelStyle'));
  check(`${name} : copiesPerPage (IsIn 1|2|3)`, dto.includes('copiesPerPage'));
  check(`${name} : watermarkMode (IsIn none|logo|text)`, dto.includes('watermarkMode'));
  check(`${name} : watermarkText (MaxLength 60)`, dto.includes('watermarkText'));
}

const createIdx = svc.indexOf('await this.prisma.federisExamPaper.create');
const createBlock = svc.slice(createIdx, createIdx + 2200);
check('createEpreuve persiste les 4 nouveaux champs',
  createBlock.includes('labelStyle') && createBlock.includes('copiesPerPage') &&
  createBlock.includes('watermarkMode') && createBlock.includes('watermarkText'));

const updateIdx = svc.indexOf('const data: any = {};');
const updateBlock = svc.slice(updateIdx, updateIdx + 2600);
check('updateEpreuve persiste les 4 nouveaux champs (autosave)',
  updateBlock.includes('dto.labelStyle') && updateBlock.includes('dto.copiesPerPage') &&
  updateBlock.includes('dto.watermarkMode') && updateBlock.includes('dto.watermarkText'));

check('serializeEpreuve expose les 4 nouveaux champs (édition)',
  svc.includes('labelStyle: this.sanitizeLabelStyle((paper as any).labelStyle)') &&
  svc.includes('copiesPerPage: this.sanitizeCopiesPerPage((paper as any).copiesPerPage)'));

// ensureSchema : colonnes + fast-path
const ensureIdx = svc.indexOf('private async ensureSchema');
const ensureBlock = svc.slice(ensureIdx, svc.indexOf('private sanitizeSections'));
check('ensureSchema : ALTER idempotents des 4 colonnes',
  ensureBlock.includes('"labelStyle" JSONB') && ensureBlock.includes('"copiesPerPage" INTEGER NOT NULL DEFAULT 1') &&
  ensureBlock.includes('"watermarkMode" TEXT NOT NULL DEFAULT \'none\'') && ensureBlock.includes('"watermarkText" TEXT'));
check('ensureSchema : fast-path invalide si watermarkMode manque (bases existantes)',
  ensureBlock.includes("column_name='watermarkMode'"));

const schema = read('apps/api-server/prisma/schema.prisma');
check('Prisma : FederisExamPaper.labelStyle Json?', /labelStyle\s+Json\?/.test(schema));
check('Prisma : copiesPerPage Int @default(1)', /copiesPerPage\s+Int\s+@default\(1\)/.test(schema));
check('Prisma : watermarkMode String @default("none")', /watermarkMode\s+String\s+@default\("none"\)/.test(schema));
check('Prisma : watermarkText String?', /watermarkText\s+String\?/.test(schema));

const migrationPath = 'apps/api-server/prisma/migrations/20261001050000_federis_epreuve_layout/migration.sql';
check('Migration présente', fs.existsSync(path.join(ROOT, migrationPath)));
if (fs.existsSync(path.join(ROOT, migrationPath))) {
  const mig = read(migrationPath);
  check('Migration : 4 ALTER TABLE IF NOT EXISTS', (mig.match(/ADD COLUMN IF NOT EXISTS/g) || []).length === 4);
}

// ══════════════════════════════════════════════════════════════════════
// 6. FRONTEND — éditeur d'épreuves
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 6. Frontend — FederisEpreuvesPage (formulaire + panneaux) ──');

const page = read('apps/web-app/src/components/federis/FederisEpreuvesPage.tsx');

check('Interface LabelStyle + DEFAULT_LABEL_STYLE', page.includes('interface LabelStyle') && page.includes('DEFAULT_LABEL_STYLE'));
check('EpreuveDetail : 4 nouveaux champs', page.includes('labelStyle: LabelStyle | null') && page.includes('copiesPerPage: number') && page.includes('watermarkMode:') && page.includes('watermarkText: string | null'));
check('EMPTY_FORM : valeurs par défaut (gras 12 px, 1 copie, aucun filigrane)',
  page.includes('labelStyle: { ...DEFAULT_LABEL_STYLE }') && page.includes('copiesPerPage: 1') && page.includes("watermarkMode: 'none'"));
check('openEdit : mapping tolérant des nouveaux champs',
  page.includes('{ ...DEFAULT_LABEL_STYLE, ...(d.labelStyle ?? {}) }') &&
  page.includes('d.copiesPerPage === 2 || d.copiesPerPage === 3'));
check('buildPayload : les 4 champs envoyés à l\'API',
  page.includes('labelStyle: form.labelStyle') && page.includes('copiesPerPage: form.copiesPerPage') &&
  page.includes('watermarkMode: form.watermarkMode') && page.includes('watermarkText: form.watermarkMode === \'text\''));

check('Panneau « Mise en page du sujet (PDF) » présent', page.includes('Mise en page du sujet (PDF)'));
check('Toggles Gras / Souligné / Italique', page.includes("['bold', 'Gras']") && page.includes("['underline', 'Souligné']") && page.includes("['italic', 'Italique']"));
check('Sélecteur de taille (LABEL_SIZE_OPTIONS)', page.includes('LABEL_SIZE_OPTIONS.map'));
check('Aperçu en direct du style (texte + styles calculés)',
  page.includes('fontWeight: form.labelStyle.bold ? 700 : 400') &&
  page.includes('Situation d&apos;évaluation'));
check('Boutons 2× / 3× par A4', page.includes("'2× — deux sujets par A4'") && page.includes("'3× — trois sujets par A4'"));
check('Mention lignes de découpe ✂', page.includes('✂'));
check('Filigrane : Aucun / Logo du patronat / Texte personnalisé',
  page.includes("['none', 'Aucun']") && page.includes("['logo', 'Logo du patronat']") && page.includes("['text', 'Texte personnalisé']"));
check('Filigrane texte : input maxLength 60 + mention Paramètres',
  page.includes('maxLength={60}') && page.includes('module Paramètres de Fédéris'));
check('Hint titre : ligne système disparaît si titre saisi',
  page.includes('dès que vous saisissez un titre'));

// ══════════════════════════════════════════════════════════════════════
// 7. TRANSPILE — les 3 fichiers modifiés (syntaxe)
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 7. Transpilation (syntaxe, 0 diagnostic) ──');

if (ts) {
  const files = [
    'apps/api-server/src/federis/federis-epreuve.service.ts',
    'apps/web-app/src/components/federis/FederisEpreuvesPage.tsx',
    'apps/web-app/src/middleware.ts',
  ];
  for (const f of files) {
    try {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const out = ts.transpileModule(src, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.React,
        },
        reportDiagnostics: true,
        fileName: f,
      });
      const errs = (out.diagnostics || []).filter((d) => d.category === 1);
      check(`Syntaxe OK : ${path.basename(f)}`, errs.length === 0,
        errs.slice(0, 2).map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join(' | '));
    } catch (e) {
      check(`Syntaxe OK : ${path.basename(f)}`, false, String(e));
    }
  }
} else {
  check('TypeScript disponible (transpilation)', false, 'typescript introuvable');
}

// ══════════════════════════════════════════════════════════════════════
// BILAN
// ══════════════════════════════════════════════════════════════════════
console.log('\n════════════════════════════════════════════════════════════════════');
console.log(` BILAN : ${ok} OK, ${fail} ÉCHEC${fail > 1 ? 'S' : ''}`);
console.log('════════════════════════════════════════════════════════════════════');
process.exit(fail > 0 ? 1 : 0);
