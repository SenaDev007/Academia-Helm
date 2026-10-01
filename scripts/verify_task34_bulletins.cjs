#!/usr/bin/env node
/**
 * ============================================================================
 * verify_task34_bulletins.cjs — Task 34 (2026-10-01) : 5 retours promoteur
 * sur les bulletins SECONDAIRE Academia Helm (trimestriel + évaluation).
 * ============================================================================
 *
 * FIX VÉRIFIÉS :
 *   1. EN-TÊTE DU TABLEAU DES NOTES MIS EN VALEUR : fond navy #0A2A5E +
 *      texte blanc (comme la ligne « Moyenne ») + séparateurs internes blancs
 *      translucides + filet inférieur noir → ne se confond plus avec les
 *      matières. (Les 2 lignes d'en-tête du trimestriel + l'en-tête simple
 *      de l'évaluation.)
 *   2. TITRES CENTRÉS : « Mention du conseil de classe » et « Appréciation
 *      du conseil de classe » centrés comme « Signature et cachet du chef
 *      d'établissement ».
 *   3. CASES À COCHER VIDES VISIBLES : carré 9px avec bordure navy DANS LES
 *      DEUX états (coché = fond navy, non coché = fond blanc).
 *   4. ORDRE DES BLOCS T3 : notes → assiduité → résultats de classe →
 *      RÉCAPITULATIF DE L'ANNÉE → conseil (le récap était collé au tableau
 *      des notes avant).
 *   5. ANTI-LIGNES-MANQUANTES : break-inside:avoid/page-break-inside:avoid
 *      sur TOUS les blocs (assiduité, résultats, récap, conseil, QR, infos
 *      élève) + lignes du tableau insécables + thead répété — un bloc ne
 *      doit jamais être fragmenté entre deux pages (Chromium perd des
 *      bordures de façon intermittente au point de fragmentation selon la
 *      hauteur réelle des données → « certaines générations seulement »).
 *
 * MÉTHODE :
 *   A. Transpile le VRAI service (typescript.transpileModule) → appelle les
 *      builders privés buildHtmlSecondaire / buildHtmlSecondaireEval.
 *   B. Assertions structurelles (5 fixes × 2 builders + régressions T30/T32).
 *   C. Décompte de colonnes de la grille (12 senior / 10 junior / 5 éval).
 *   D. RENDU RÉEL : puppeteer-core + Chromium local, réglages de PRODUCTION
 *      (A4 portrait, printBackground, marges 8mm, setContent domcontentloaded
 *      + 150ms) → PDF → pdftoppm 150dpi PPM.
 *   E. ANALYSE PIXELS : (a) bande navy de l'en-tête détectée + texte blanc ;
 *      (b) comptage des filets horizontaux longs par page (aucune page
 *      « vide de filets ») ; (c) si 2 pages, la page 2 porte bien des blocs.
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ts = require('/home/z/my-project/ah/apps/api-server/node_modules/typescript');

const ROOT = '/home/z/my-project/ah';
const SRC = path.join(ROOT, 'apps/api-server/src/modules/exams/services/bulletin-pdf.service.ts');
const OUT = '/home/z/my-project/download/task34';
fs.mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const check = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

// ── 1. Transpile le service (code de production, pas une copie) ────────────
const source = fs.readFileSync(SRC, 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

// ── 2. Stub des imports ────────────────────────────────────────────────────
const Module = require('module');
const origResolve = Module._resolveFilename;
const STUBS = {
  '@nestjs/common': { Injectable: () => (c) => c, InternalServerErrorException: class extends Error {}, Logger: class { log() {} warn() {} error() {} } },
  '../../../common/services/puppeteer-pool.service': { PuppeteerPoolService: class {} },
  '@nestjs/config': { ConfigService: class {} },
  'qrcode': { toDataURL: async () => 'data:image/png;base64,QRSTUB' },
};
Module._resolveFilename = function (request, ...args) {
  if (STUBS[request]) return request;
  return origResolve.call(this, request, ...args);
};
const origRequire = Module.prototype.require;
Module.prototype.require = function (request) {
  if (STUBS[request]) return STUBS[request];
  return origRequire.call(this, request);
};
const mod = { exports: {} };
new Function('module', 'exports', 'require', outputText)(mod, mod.exports, require);
const { BulletinPdfService } = mod.exports;
const svc = new BulletinPdfService({}, {});

// ── 3. Données factices réalistes ──────────────────────────────────────────
const mkSubject = (name, cat, m, coef, rank, teacher) => ({
  name, subjectCategory: cat,
  secInt1: m - 1, secInt2: m + 1, secMoyInter: m, secDs1: m - 0.5, secDs2: m + 0.5,
  secMoyenne: m, secCoef: coef, secNoteCoef: +(m * coef).toFixed(2), secRank: rank,
  appreciation: m >= 14 ? 'Très bien' : m >= 12 ? 'Bien' : m >= 10 ? 'Assez bien' : 'Insuffisant',
  teacherName: teacher, secHasSlot: true,
});
const subjectsSeniorT3 = [
  mkSubject('Français', 'LETTRES', 13, 3, 4, 'M. AGOSSOU Félix'),
  mkSubject('Communication écrite', 'LETTRES', 14, 2, 6, 'M. AGOSSOU Félix'),
  mkSubject('Lecture', 'LETTRES', 12, 2, 8, 'Mme LOKO Grace'),
  mkSubject('Anglais', 'LETTRES', 11, 2, 9, 'Mme LOKO Grace'),
  mkSubject('Philosophie', 'LETTRES', 15, 2, 3, 'M. HOUNKPATIN J.'),
  mkSubject('Histoire-Géographie', 'LETTRES', 10, 2, 12, 'M. ZANNOU M.'),
  mkSubject('Allemand', 'LETTRES', 12, 2, 7, 'Mme ADJO Marie'),
  mkSubject('Espagnol', 'LETTRES', 13, 2, 5, 'M. KOUTON P.'),
  mkSubject('Mathématiques', 'SCIENCES', 15.92, 3, 2, 'M. BIO Samir'),
  mkSubject('Physique-Chimie', 'SCIENCES', 9.83, 2, 18, 'M. ZANNOU M.'),
  mkSubject('SVT', 'SCIENCES', 14, 2, 5, 'M. HOUNKPATIN J.'),
  mkSubject('Est', 'SCIENCES', 11.5, 1, 10, 'M. BIO Samir'),
  mkSubject('Éducation physique et sportive', 'AUTRES', 15, 1, 3, 'M. DOSSOU K.'),
  mkSubject('Informatique', 'AUTRES', 12.5, 1, 7, 'M. ADAM I.'),
  mkSubject('Conduite', 'AUTRES', 16, 1, 1, 'M. DOSSOU K.'),
  mkSubject('Musique', 'AUTRES', 13, 1, 6, 'Mme ADJO Marie'),
  mkSubject('Arts plastiques', 'AUTRES', 14.5, 1, 4, 'Mme ADJO Marie'),
  mkSubject('Éducation sociale', 'AUTRES', 15.5, 1, 2, 'M. KOUTON P.'),
];
const base = {
  schoolName: 'CEP SAINT-ESPRIT DE PARAKOU',
  schoolLogo: null, schoolAddress: 'Quartier Albarika, Parakou',
  schoolPhone: '+229 97 00 00 00', schoolEmail: 'contact@cspeb.bj',
  schoolSlogan: 'Travail - Discipline - Réussite',
  academicYearName: '2025-2026', periodName: '3e trimestre', className: 'Terminale A',
  studentName: 'KOUSSI Amina', studentMatricule: 'MT-2025-0142', studentGender: 'FEMALE',
  studentPhotoUrl: null, generalAverage: 13.42, classRank: 3, totalStudents: 42,
  classAverage: 11.87, highestAverage: 16.05, lowestAverage: 6.4,
  assiduityHours: 4.5, sanctionCount: 1, teacherName: 'M. BIO Samir',
  directorName: 'Mme TCHAKPO Adjoa',
  councilAppreciation: 'Élève sérieuse, résultats en nette progression. Continuer ainsi.',
  distinctionLabel: 'Félicitations',
  allDistinctions: [
    { type: 'DISTINCTION', label: 'Félicitations' },
    { type: 'DISTINCTION', label: 'Encouragements' },
    { type: 'SANCTION', label: 'Avertissement' },
  ],
  isSecondary: true, isSecondaryEval: false, secJunior: false,
  secTotalCoef: 23, secTotalNotesCoef: 296.14,
};
const dataTrimT3 = { ...base, subjects: subjectsSeniorT3, secRecap: { period1Average: 12.8, period2Average: 13.1, annualAverage: 13.11, annualRank: 3, decision: 'Admis(e) en classe supérieure' } };
const dataTrimJunior = { ...base, periodName: '1er trimestre', className: '6e B', secJunior: true, subjects: subjectsSeniorT3.slice(0, 6), secTotalCoef: null, secTotalNotesCoef: null, secRecap: null };
const dataEval = { ...base, periodName: '1er trimestre', isSecondaryEval: true, evaluationTypeName: 'Devoir surveillé', evaluationTypeCode: 'DS2', subjects: subjectsSeniorT3.map(s => ({ name: s.name, score: s.secMoyenne, subjectPosition: s.secRank, appreciation: s.appreciation, teacherName: s.teacherName, isAbsent: false })), secRecap: null };

// ── 4. Génère les HTML ─────────────────────────────────────────────────────
const htmlT3 = svc['buildHtmlSecondaire'](dataTrimT3, 'data:image/png;base64,QR', 'BULL-T34-T3');
const htmlJunior = svc['buildHtmlSecondaire'](dataTrimJunior, 'data:image/png;base64,QR', 'BULL-T34-JUNIOR');
const htmlEval = svc['buildHtmlSecondaireEval'](dataEval, 'data:image/png;base64,QR', 'BULL-T34-EVAL');
fs.writeFileSync(path.join(OUT, 'task34-trimestriel-T3-senior.html'), htmlT3);
fs.writeFileSync(path.join(OUT, 'task34-trimestriel-junior.html'), htmlJunior);
fs.writeFileSync(path.join(OUT, 'task34-evaluation.html'), htmlEval);
console.log('HTML générés (3 variantes)');

// ═══════════════════════════════════════════════════════════════════════════
// A. FIX 1 — EN-TÊTE NAVY (les 2 builders)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── A. FIX 1 : en-tête du tableau des notes mis en valeur ──');
for (const [name, html] of [['TRIMESTRIEL', htmlT3], ['JUNIOR', htmlJunior], ['ÉVALUATION', htmlEval]]) {
  check(`${name} : CSS th = fond navy + texte blanc`,
    /table\.notes th \{ background:#0A2A5E; color:#fff;/.test(html));
  check(`${name} : plus aucun fond blanc sur les th (ni CSS ni inline)`,
    !/table\.notes th \{ background:#fff/.test(html) && !/<tr style="background:#fff;color:#000;">\s*<th/.test(html));
  check(`${name} : séparateurs internes clairs (rgba blanc 0.35)`,
    /border-right:1px solid rgba\(255,255,255,0\.35\)/.test(html));
  check(`${name} : filet inférieur noir de l'en-tête (séparation matières)`,
    /table\.notes th \{[^}]*border-bottom:1px solid #000/.test(html));
  check(`${name} : thead répété à la fragmentation (display:table-header-group)`,
    /table\.notes thead \{ display:table-header-group; \}/.test(html));
}
check('TRIMESTRIEL : ligne parente « Inter. écrites » garde un séparateur interne clair',
  (htmlT3.match(/<th colspan="2"[^>]*border-bottom:1px solid rgba\(255,255,255,0\.35\);[^>]*>(Inter\. écrites|Devoirs surveillés)</g) || []).length === 2);
check('TRIMESTRIEL : DS2 garde son filet vertical interne (th:last-child neutralisé) — séparation DS2/Moy',
  /border-right:1px solid rgba\(255,255,255,0\.35\);">DS2<\/th>/.test(htmlT3));

// ═══════════════════════════════════════════════════════════════════════════
// B. FIX 2 — TITRES CENTRÉS
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── B. FIX 2 : titres du conseil centrés ──');
for (const [name, html] of [['TRIMESTRIEL', htmlT3], ['ÉVALUATION', htmlEval]]) {
  check(`${name} : « Mention du conseil de classe » centré`,
    /text-align:center;">Mention du conseil de classe<\/div>/.test(html));
  check(`${name} : « Appréciation du conseil de classe » centrée`,
    /text-align:center;">Appréciation du conseil de classe<\/div>/.test(html));
  check(`${name} : « Signature et cachet du chef d'établissement » toujours centré (référence)`,
    /text-align:center;">Signature et cachet du chef d'établissement<\/div>/.test(html));
}

// ═══════════════════════════════════════════════════════════════════════════
// C. FIX 3 — CASES À COCHER VIDES VISIBLES
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── C. FIX 3 : cases à cocher vides visibles ──');
// sq() est une IIFE : son CODE n'apparaît pas dans le HTML rendu → la
// vérification structurelle se fait sur le SERVICE transpilé (source), et
// la vérification du RENDU (3 carrés, 1 coché, 2 vides bordés) sur le HTML.
for (const [name, html] of [['TRIMESTRIEL', htmlT3], ['ÉVALUATION', htmlEval]]) {
  const sqMatch = outputText.match(/const sq = \(d\) => \{\s*const checked = data\.distinctionLabel === d\.label;\s*return `([^`]*)`;\s*\};/);
  check(`${name} : sq() présent dans le service`, !!sqMatch);
  if (sqMatch) {
    const sqSrc = sqMatch[1];
    check(`${name} : case avec bordure navy (visible même vide)`, sqSrc.includes('border:1px solid #0A2A5E'));
    check(`${name} : cochée = fond navy`, sqSrc.includes(`checked ? 'background:#0A2A5E;'`));
    check(`${name} : non cochée = fond blanc (carré vide visible)`, sqSrc.includes(`: 'background:#fff;'`));
  }
}
// Rendu réel : 3 distinctions (Félicitations cochée, Encouragements, Avertissement)
const sqRenderedT = htmlT3.match(/<span style="display:inline-block;width:9px;height:9px;[^"]*">/g) || [];
const sqRenderedE = htmlEval.match(/<span style="display:inline-block;width:9px;height:9px;[^"]*">/g) || [];
check('TRIMESTRIEL : 3 carrés rendus — TOUS avec bordure navy (vides visibles)',
  sqRenderedT.length === 3 && sqRenderedT.every(s => s.includes('border:1px solid #0A2A5E')));
check('TRIMESTRIEL : exactement 1 carré coché (fond navy) et 2 carrés vides bordés',
  sqRenderedT.filter(s => s.includes('background:#0A2A5E;')).length === 1
  && sqRenderedT.filter(s => s.includes('background:#fff;')).length === 2);
check('ÉVALUATION : 3 carrés rendus — TOUS avec bordure navy, 1 coché + 2 vides',
  sqRenderedE.length === 3 && sqRenderedE.every(s => s.includes('border:1px solid #0A2A5E'))
  && sqRenderedE.filter(s => s.includes('background:#0A2A5E;')).length === 1
  && sqRenderedE.filter(s => s.includes('background:#fff;')).length === 2);

// ═══════════════════════════════════════════════════════════════════════════
// D. FIX 4 — ORDRE DES BLOCS (T3)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── D. FIX 4 : ordre des blocs (récap après résultats de classe) ──');
{
  const idxNotes = htmlT3.indexOf('<table class="notes">');
  const idxAssiduite = htmlT3.indexOf('>Assiduité</div>');
  const idxResultats = htmlT3.indexOf('>Résultats de classe</div>');
  const idxRecap = htmlT3.indexOf('Récapitulatif de l\'année (3e trimestre)');
  const idxConseil = htmlT3.indexOf('Mention du conseil de classe</div>');
  check('T3 : les 5 sections présentes', idxNotes > 0 && idxAssiduite > 0 && idxResultats > 0 && idxRecap > 0 && idxConseil > 0);
  check('T3 : ordre notes → assiduité → résultats → RÉCAP → conseil',
    idxNotes < idxAssiduite && idxAssiduite < idxResultats && idxResultats < idxRecap && idxRecap < idxConseil,
    `notes=${idxNotes} assiduité=${idxAssiduite} résultats=${idxResultats} récap=${idxRecap} conseil=${idxConseil}`);
  check('T3 : le récap N\'EST PLUS collé au tableau des notes (distance > 500 chars)',
    idxRecap - idxNotes > 500);
  // T1/T2 : le récap est absent → l'ordre reste notes → assiduité → résultats → conseil
  const jNotes = htmlJunior.indexOf('<table class="notes">');
  const jAssiduite = htmlJunior.indexOf('>Assiduité</div>');
  const jResultats = htmlJunior.indexOf('>Résultats de classe</div>');
  const jConseil = htmlJunior.indexOf('Mention du conseil de classe</div>');
  check('T1 (junior) : pas de récap + ordre notes → assiduité → résultats → conseil',
    !htmlJunior.includes('Récapitulatif de l\'année') && jNotes < jAssiduite && jAssiduite < jResultats && jResultats < jConseil);
  // récap : marges cohérentes (8px au-dessus via le bloc précédent, 8px en-dessous)
  check('T3 : récap margin-top:0 (le bloc Résultats fournit l\'espacement) + margin-bottom:8px',
    /margin-top:0;margin-bottom:8px;border:2px solid #000;border-radius:8px;overflow:hidden;[^"]*">\s*<div[^>]*>Récapitulatif de l'année/.test(htmlT3));
}

// ═══════════════════════════════════════════════════════════════════════════
// E. FIX 5 — ANTI-LIGNES-MANQUANTES (blocs insécables)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── E. FIX 5 : blocs insécables (anti-lignes-mançantes) ──');
for (const [name, html] of [['TRIMESTRIEL', htmlT3], ['JUNIOR', htmlJunior], ['ÉVALUATION', htmlEval]]) {
  check(`${name} : classe .blk-avoid définie dans le <style>`,
    /\.blk-avoid \{ break-inside:avoid; page-break-inside:avoid; \}/.test(html));
  check(`${name} : lignes du tableau insécables (fragmentation ENTRE lignes)`,
    /table\.notes tr \{ break-inside:avoid; page-break-inside:avoid; \}/.test(html));
  check(`${name} : infos élève insécables`, /\.info-wrap \{[^}]*break-inside:avoid/.test(html));
  const blkCount = (html.match(/class="blk-avoid"/g) || []).length;
  check(`${name} : 6 blocs/groupes portent blk-avoid (assiduité, résultats, [récap], conseil, QR + groupe final)`,
    blkCount === (html.includes('Récapitulatif de l\'année') ? 6 : 5), `${blkCount} trouvés`);
  const recapBlk = /class="blk-avoid" style="margin-top:0;[^"]*">\s*<div[^>]*>Récapitulatif de l'année/.test(html);
  check(`${name} : récap insécable${html.includes('Récapitulatif de l\'année') ? '' : ' (absent → OK)'}`,
    !html.includes('Récapitulatif de l\'année') || recapBlk);
  check(`${name} : le wrapper du tableau des notes reste FRAGMENTABLE (pas de blk-avoid dessus)`,
    !/<div class="blk-avoid" style="border:2px solid #000;border-radius:8px;overflow:hidden;">\s*<table class="notes">/.test(html));
}

// ═══════════════════════════════════════════════════════════════════════════
// F. RÉGRESSIONS T30/T32 (grille, filets continus, footer, assiduité)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── F. Régressions T30/T32 ──');
function analyzeGrid(html, expectedCols, label) {
  const results = [];
  const tableMatch = html.match(/<table class="notes">[\s\S]*?<\/table>/);
  if (!tableMatch) return [{ ok: false, msg: `${label} : table introuvable` }];
  const trs = tableMatch[0].match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  const rowspans = [];
  trs.forEach((tr, i) => {
    const occupied = new Set();
    for (const rs of rowspans) {
      if (i > rs.startLine && i < rs.startLine + rs.len) {
        for (let c = rs.colFrom; c < rs.colTo; c++) occupied.add(c);
      }
    }
    const tds = tr.match(/<(td|th)[^>]*>[\s\S]*?<\/(td|th)>/g) || [];
    let col = 0;
    for (const tdHtml of tds) {
      while (occupied.has(col)) col++;
      const cs = parseInt((tdHtml.match(/colspan="(\d+)"/) || [null, '1'])[1], 10);
      const rsLen = parseInt((tdHtml.match(/rowspan="(\d+)"/) || [null, '1'])[1], 10);
      if (rsLen > 1) rowspans.push({ startLine: i, len: rsLen, colFrom: col, colTo: col + cs });
      col += cs;
    }
    let maxOcc = -1;
    for (const c of occupied) if (c >= maxOcc) maxOcc = c;
    const width = Math.max(col, maxOcc + 1);
    results.push({ ok: width === expectedCols, msg: `${label} ligne ${i + 1} : ${width} col. (attendu ${expectedCols})` });
  });
  return results;
}
for (const r of analyzeGrid(htmlT3, 12, 'T3 SENIOR')) check(r.msg, r.ok);
for (const r of analyzeGrid(htmlJunior, 10, 'JUNIOR')) check(r.msg, r.ok);
for (const r of analyzeGrid(htmlEval, 5, 'ÉVALUATION')) check(r.msg, r.ok);
for (const [name, html] of [['TRIMESTRIEL', htmlT3], ['ÉVALUATION', htmlEval]]) {
  check(`${name} : grille en border-collapse:collapse (filets continus T32)`,
    /table\.notes \{ width:100%; border-collapse:collapse; \}/.test(html));
  check(`${name} : cadre 2px sur wrapper du tableau (pas sur <table>)`,
    /<div style="border:2px solid #000;border-radius:8px;overflow:hidden;">\s*<table class="notes">/.test(html));
  check(`${name} : assiduité détachée du tableau (margin-top:10px T32)`,
    /margin-top:10px;margin-bottom:8px;[^"]*">\s*<div[^>]*>Assiduité<\/div>/.test(html));
  check(`${name} : footer +229 0141360803 (T30)`, html.includes('Tél: +229 0141360803'));
  check(`${name} : infos élève sur wrapper .info-wrap (T32)`, /<div class="info-wrap">\s*<table class="info-table">/.test(html));
}

// ═══════════════════════════════════════════════════════════════════════════
// G. RENDU RÉEL (production settings) + ANALYSE PIXELS
// ═══════════════════════════════════════════════════════════════════════════
(async () => {
  console.log('\n── G. Rendu réel Chromium (réglages production) ──');
  const puppeteer = require('/home/z/my-project/ah/apps/api-server/node_modules/puppeteer-core');
  const CHROME = '/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome';
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const variants = [
    { name: 'trimestriel-T3-senior', html: htmlT3, format: 'A4' },
    { name: 'trimestriel-junior', html: htmlJunior, format: 'A4' },
    { name: 'evaluation', html: htmlEval, format: 'A4' },
  ];
  const rendered = [];
  for (const v of variants) {
    const page = await browser.newPage();
    await page.setContent(v.html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 150)); // délai production (bulletin-pdf.service.ts)
    const pdf = await page.pdf({
      format: v.format, landscape: false, printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
      timeout: 60000, preferCSSPageSize: false,
    });
    await page.close();
    const pdfPath = path.join(OUT, `task34-${v.name}.pdf`);
    fs.writeFileSync(pdfPath, pdf);
    // Rastérise en PPM 150dpi (P6, parsing direct sans dépendance)
    // (poppler ≥ 25 : PPM est le format PAR DÉFAUT, l'option -ppm a été retirée)
    const prefix = path.join(OUT, `task34-${v.name}`);
    execFileSync('pdftoppm', ['-r', '150', pdfPath, prefix]);
    const pages = fs.readdirSync(OUT).filter(f => f.startsWith(`task34-${v.name}-`) && f.endsWith('.ppm'))
      .sort().map(f => path.join(OUT, f));
    rendered.push({ ...v, pages, pageCount: pages.length });
    console.log(`  📄 ${v.name} : ${pages.length} page(s) rendue(s)`);
  }
  await browser.close();

  // ── Parsing PPM (P6) ──
  function loadPPM(file) {
    const buf = fs.readFileSync(file);
    const m = buf.toString('latin1').match(/^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/);
    const off = Buffer.byteLength(buf.toString('latin1').split(/\s/).slice(0, 4).join(' ') + '\n', 'latin1') + 0;
    const headerLen = buf.indexOf('\n', buf.indexOf('\n', buf.indexOf('\n', 0) + 1) + 1) + 1;
    return { w: +m[1], h: +m[2], data: buf.slice(headerLen) };
  }
  const lum = (ppm, x, y) => {
    const i = (y * ppm.w + x) * 3;
    return 0.299 * ppm.data[i] + 0.587 * ppm.data[i + 1] + 0.114 * ppm.data[i + 2];
  };
  const rgb = (ppm, x, y) => {
    const i = (y * ppm.w + x) * 3;
    return [ppm.data[i], ppm.data[i + 1], ppm.data[i + 2]];
  };

  // (a) En-tête navy détecté sur la 1re page de chaque variante
  //     (ignore les filets navy fins — ex. bordure 2px du header officiel —
  //     et ne retient que la BANDE de l'en-tête du tableau, ≥ 12px de haut)
  for (const v of rendered) {
    const ppm = loadPPM(v.pages[0]);
    const rowNavyRatio = (y) => {
      let navy = 0, n = 0;
      for (let x = Math.round(ppm.w * 0.15); x < ppm.w * 0.85; x += 4) {
        const [r, g, b] = rgb(ppm, x, y);
        n++;
        if (r < 70 && g < 90 && b > 80 && b > r + 30) navy++;   // navy #0A2A5E ≈ (10,42,94)
      }
      return navy / n;
    };
    let bandStart = -1, bandEnd = -1;
    for (let y = 100; y < ppm.h - 50; y++) {
      if (rowNavyRatio(y) <= 0.6) continue;
      // bande candidate : mesure son étendue réelle
      let e = y;
      while (e + 1 < ppm.h && rowNavyRatio(e + 1) > 0.4) e++;
      if (e - y + 1 >= 12) { bandStart = y; bandEnd = e; break; }  // ignore les filets fins
    }
    check(`${v.name} : bande NAVY de l'en-tête du tableau détectée en pixels`, bandStart >= 0,
      bandStart < 0 ? 'aucune bande navy pleine largeur trouvée' : `bande y=${bandStart}→${bandEnd} (${bandEnd - bandStart + 1}px)`);
    if (bandStart >= 0) {
      // Texte blanc : pixels clairs SUR TOUTE la hauteur de la bande
      let light = 0, n = 0;
      for (let y = bandStart; y <= bandEnd; y++) {
        for (let x = Math.round(ppm.w * 0.15); x < ppm.w * 0.85; x += 3) {
          n++;
          if (lum(ppm, x, y) > 200) light++;
        }
      }
      check(`${v.name} : texte BLANC lisible dans l'en-tête navy (bande ${bandEnd - bandStart + 1}px)`,
        light / n > 0.01 && bandEnd - bandStart >= 12,
        `ratio pixels clairs = ${((light / n) * 100).toFixed(1)}%, hauteur bande = ${bandEnd - bandStart + 1}px`);
    }
    // (b) filets horizontaux longs par page
    const linesPerPage = v.pages.map((p) => {
      const ppm2 = loadPPM(p);
      const x0 = Math.round(ppm2.w * 0.10), x1 = Math.round(ppm2.w * 0.90);
      let bands = 0, inBand = false;
      for (let y = 0; y < ppm2.h; y++) {
        let dark = 0, n = 0;
        for (let x = x0; x < x1; x += 2) { n++; if (lum(ppm2, x, y) < 110) dark++; }
        const isLine = dark / n > 0.55;
        if (isLine && !inBand) { bands++; inBand = true; }
        if (!isLine) inBand = false;
      }
      return bands;
    });
    const total = linesPerPage.reduce((a, b) => a + b, 0);
    check(`${v.name} : filets horizontaux présents (${total} au total sur ${v.pages.length} page(s))`, total >= 18,
      `par page : [${linesPerPage.join(', ')}]`);
    check(`${v.name} : AUCUNE page « vide de filets » (bordures perdues)`, linesPerPage.every(c => c > 0),
      `par page : [${linesPerPage.join(', ')}]`);
    if (v.pages.length > 1) {
      // Page 2 = groupe conseil+QR : les filets pleine largeur attendus sont
      // le cadre HAUT + BAS du bloc conseil (les séparateurs internes du bloc
      // conseil sont VERTICAUX — 3 colonnes ; les lignes de signature sont
      // courtes) → ≥ 2 filets pleine largeur = cadre complet.
      check(`${v.name} : page 2 porte le bloc conseil complet (cadre haut+bas ≥ 2 filets)`, linesPerPage[1] >= 2,
        `${linesPerPage[1]} filets`);
    }
  }

  // (c) T3 senior : doit paginer (2 pages) avec 13 matières + récap — le cas
  //     qui déclenchait les lignes manquantes en production
  const t3 = rendered.find(v => v.name === 'trimestriel-T3-senior');
  check('T3 SENIOR (18 matières + récap) : contenu paginé sur 2 pages (cas fragmentation)',
    t3.pageCount === 2, `${t3.pageCount} page(s)`);
  // Le groupe insécable conseil+QR doit aller ENSEMBLE sur la page 2 :
  // la page 2 porte alors le bloc conseil complet (filets) + QR, jamais un
  // QR orphelin seul.
  if (t3.pageCount === 2) {
    const ppm2 = loadPPM(t3.pages[1]);
    let nonWhite = 0, n = 0;
    for (let y = 0; y < ppm2.h; y += 2) {
      for (let x = 0; x < ppm2.w; x += 2) {
        n++;
        const i = (y * ppm2.w + x) * 3;
        if (ppm2.data[i] < 240 || ppm2.data[i + 1] < 240 || ppm2.data[i + 2] < 240) nonWhite++;
      }
    }
    check('T3 page 2 : contenu substantiel (groupe conseil+QR, pas un fragment orphelin)',
      nonWhite / n > 0.008, `${((nonWhite / n) * 100).toFixed(2)}% non blancs`);
  }

  console.log(`\n═══ TASK 34 : ${pass} ✅ / ${fail} ❌ ═══`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('ERREUR FATALE :', e); process.exit(1); });
