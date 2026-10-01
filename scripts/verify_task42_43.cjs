#!/usr/bin/env node
/**
 * ============================================================================
 * verify_task42_43.cjs — Task 42 + Task 43 (2026-10-01)
 * ============================================================================
 * TASK 42 — Bulletins MATERNELLE + PRIMAIRE (Academia Helm) : appliquer
 * partout les corrections faites au secondaire (T30/T32/T34) :
 *   1. SUPPRESSION DES DOUBLONS DE CONTENEURS : plus de wrapper navy 2px
 *      AUTOUR d'une table qui porte elle-même une bordure 2px — un SEUL
 *      cadre (le wrapper div), la table n'a plus de bordure propre ;
 *      le code mort (leftColumn/rightColumn, jamais rendus) est supprimé.
 *   2. FILETS PLEINS ET CONTINUS : border-collapse:collapse (plus de
 *      border-collapse:separate qui peignait chaque cellule séparément =
 *      joints visibles / aspect haché).
 *   3. EN-TÊTE DU TABLEAU NAVY + BLANC (comme la ligne moyenne, T34).
 *   4. COHÉRENCE DE DESIGN AVEC LE SECONDAIRE : titre en barre encadrée
 *      navy, infos élève sur wrapper .info-wrap en 2 lignes (Année / Nom /
 *      Classe / Effectif / Matricule / Rang), libellés complets du carnet.
 *   5. ANTI-LIGNES-MANQUANTES : lignes insécables, thead répété, blocs
 *      blk-avoid, footer STATIQUE (plus de position:fixed qui chevauchait
 *      signatures/QR de la page 2 selon la hauteur des données).
 * Couvre : buildHtml (évaluation maternelle + primaire) et
 * buildHtmlVueParMatiere (bulletin trimestriel « vue par matière »,
 * maternelle + primaire) — PDF générés par Puppeteer.
 *
 * TASK 43 — Page publique de consultation des résultats (Academia Federis) :
 *   a. Header Academia SUPPRIMÉ de la page (retour promoteur) ;
 *   b. FIX « examen blanc [object Object] » : session = libellé officiel ;
 *   c. Animation de particules / feux d'artifice dans le bandeau ;
 *   d. RÉSULTAT DANS UN MODAL CENTRÉ : effets waouh (admis) / emoji triste
 *      animé (ajourné), toutes les infos clés structurées.
 *
 * MÉTHODE :
 *   A/B. Transpile le VRAI service (typescript.transpileModule) → appelle
 *        les builders privés → assertions structurelles.
 *   C.  RENDU RÉEL : puppeteer-core + Chromium local (réglages production)
 *        → PDF → pdftoppm 150dpi → analyse pixels (bande navy, filets,
 *        aucune page vide).
 *   D.  Assertions structurelles T43 sur les fichiers (page publique, client,
 *        services API).
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ts = require('/home/z/my-project/ah/apps/api-server/node_modules/typescript');

const ROOT = '/home/z/my-project/ah';
const SRC = path.join(ROOT, 'apps/api-server/src/modules/exams/services/bulletin-pdf.service.ts');
const OUT = '/home/z/my-project/download/task42_43';
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
const base = {
  schoolName: 'LES FAROUCHE DE DJIDJA',
  schoolLogo: null, schoolAddress: 'Quartier Zoungoudo, Djidja',
  schoolPhone: '+229 97 00 00 00', schoolEmail: 'contact@faroche.bj',
  schoolSlogan: 'Travail - Discipline - Réussite',
  academicYearName: '2025-2026', periodName: '1er trimestre', className: 'Grande Section',
  studentName: 'ADJO Bérangère', studentMatricule: 'MAT-2025-0071', studentGender: 'FEMALE',
  studentPhotoUrl: null, classRank: 2, totalStudents: 28,
  classAverage: null, highestAverage: null, lowestAverage: null,
  teacherName: 'Mme HOUNGBEDJI Rosine', directorName: 'Mme TCHAKPO Adjoa',
  appreciationGlobale: 'Très Satisfaisant',
};

// Maternelle — matières qualitatives (TS/S/PS), triées par domaine 1→5
const matSubjects = [
  { name: 'Éducation pour la santé', qualitativeCode: 'TS', appreciation: 'Très Satisfaisant', directorVisa: 'Vu', isAbsent: false },
  { name: 'Éducation du mouvement', qualitativeCode: 'S', appreciation: 'Satisfaisant', directorVisa: 'Vu', isAbsent: false },
  { name: 'Observation', qualitativeCode: 'TS', appreciation: 'Très Satisfaisant', directorVisa: 'Vu', isAbsent: false },
  { name: 'Pré-écriture', qualitativeCode: 'S', appreciation: 'Satisfaisant', directorVisa: 'Vu', isAbsent: false },
  { name: 'Expression plastique', qualitativeCode: 'PS', appreciation: 'Peu Satisfaisant', directorVisa: 'À travailler', isAbsent: false },
  { name: 'Langage', qualitativeCode: 'TS', appreciation: 'Très Satisfaisant', directorVisa: 'Vu', isAbsent: false },
  { name: 'Comptine', qualitativeCode: 'S', appreciation: 'Satisfaisant', directorVisa: 'Vu', isAbsent: false },
];

// Primaire — notes numériques CM/CP
const priSubjects = [
  { name: 'Français', score: 14.5, cm: 13, cp: 1.5, appreciation: 'Bien', isAbsent: false },
  { name: 'Lecture', score: 15, cm: 14, cp: 1, appreciation: 'Bien', isAbsent: false },
  { name: 'Mathématiques', score: 12.25, cm: 11, cp: 1.25, appreciation: 'Assez Bien', isAbsent: false },
  { name: 'Éveil scientifique', score: 11, cm: 10, cp: 1, appreciation: 'Passable', isAbsent: false },
  { name: 'Anglais', score: 16, cm: 15, cp: 1, appreciation: 'Très Bien', isAbsent: false },
  { name: 'EPS', score: 9.5, cm: 8.5, cp: 1, appreciation: 'Insuffisant', isAbsent: false },
];

const dataMaternelle = {
  ...base, isMaternelle: true, isSecondary: false, isSecondaryEval: false,
  evaluationTypeName: 'Évaluation sommative', evaluationTypeCode: 'EM1',
  subjects: matSubjects,
};
const dataPrimaire = {
  ...base, isMaternelle: false, isSecondary: false, isSecondaryEval: false,
  className: 'CE2 A', studentName: 'KORA Aline', studentMatricule: 'PRI-2025-0142',
  generalAverage: 13.04, classRank: 5, highestAverage: 16.25, lowestAverage: 7.5,
  evaluationTypeName: 'Évaluation sommative', evaluationTypeCode: 'EM2',
  appreciationGlobale: null,
  subjects: priSubjects,
};
const vpm = (em1, em2, ec) => {
  const moyEm = (em1 !== null && em2 !== null) ? (em1 + em2) / 2 : (em1 !== null ? em1 : em2);
  const moyenne = (moyEm !== null && ec !== null) ? (moyEm + ec) / 2 : (moyEm !== null ? moyEm : ec);
  return { em1, em2, moyEm, ec, moyenne };
};
const dataVpmMat = {
  ...base, isMaternelle: true, isVueParMatiere: true,
  periodName: '1er trimestre', generalAverage: 2.55, classRank: 3,
  subjects: [
    { name: 'Langage', score: 2.75, qualitativeCode: 'TS', appreciation: 'Très Satisfaisant', vueParMatiere: vpm(2.5, 3, 3) },
    { name: 'Observation', score: 2.25, qualitativeCode: 'S', appreciation: 'Satisfaisant', vueParMatiere: vpm(2, 2.5, 2.5) },
    { name: 'Éducation du mouvement', score: 1.75, qualitativeCode: 'S', appreciation: 'Satisfaisant', vueParMatiere: vpm(1.5, 2, 2) },
    { name: 'Expression plastique', score: 1.25, qualitativeCode: 'PS', appreciation: 'Peu Satisfaisant', vueParMatiere: vpm(1, 1.5, 1.5) },
  ],
};
const dataVpmPri = {
  ...base, isMaternelle: false, isVueParMatiere: true, className: 'CE2 A',
  studentName: 'KORA Aline', studentMatricule: 'PRI-2025-0142',
  generalAverage: 13.42, classRank: 4, classAverage: 11.9, appreciationGlobale: null,
  subjects: [
    { name: 'Français', score: 13.5, appreciation: 'Bien', vueParMatiere: vpm(12, 14, 14.5) },
    { name: 'Mathématiques', score: 12.75, appreciation: 'Assez Bien', vueParMatiere: vpm(11.5, 13, 13.75) },
    { name: 'Éveil scientifique', score: 14, appreciation: 'Bien', vueParMatiere: vpm(13, 14, 15) },
    { name: 'Anglais', score: 15.25, appreciation: 'Très Bien', vueParMatiere: vpm(14, 15, 16.75) },
  ],
};

// ── 4. Génère les HTML ─────────────────────────────────────────────────────
const htmlMat = svc['buildHtml'](dataMaternelle, 'data:image/png;base64,QR', 'BULL-T42-MAT');
const htmlPri = svc['buildHtml'](dataPrimaire, 'data:image/png;base64,QR', 'BULL-T42-PRI');
const htmlVpmMat = svc['buildHtmlVueParMatiere'](dataVpmMat, 'data:image/png;base64,QR', 'BULL-T42-VPMMAT');
const htmlVpmPri = svc['buildHtmlVueParMatiere'](dataVpmPri, 'data:image/png;base64,QR', 'BULL-T42-VPMpri'.toUpperCase());
fs.writeFileSync(path.join(OUT, 'task42-maternelle.html'), htmlMat);
fs.writeFileSync(path.join(OUT, 'task42-primaire.html'), htmlPri);
fs.writeFileSync(path.join(OUT, 'task42-vpm-maternelle.html'), htmlVpmMat);
fs.writeFileSync(path.join(OUT, 'task42-vpm-primaire.html'), htmlVpmPri);
console.log('HTML générés (4 variantes : maternelle, primaire, vue par matière ×2)');

// ═══════════════════════════════════════════════════════════════════════════
// A. TASK 42 — buildHtml (évaluation maternelle + primaire)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── A. T42 buildHtml : un seul conteneur, filets pleins, design secondaire ──');
for (const [name, html] of [['MATERNELLE', htmlMat], ['PRIMAIRE', htmlPri]]) {
  // A1 — UN SEUL CONTENEUR : la table notes n'a PLUS de bordure propre
  check(`${name} : CSS table.notes en border-collapse SANS bordure propre (plus de double cadre)`,
    /table\.notes \{ width:100%; border-collapse:collapse; \}/.test(html)
      && !/table\.notes \{[^}]*border:2px/.test(html)
      && !/table\.notes \{[^}]*border-spacing/.test(html));
  check(`${name} : le cadre 2px arrondi est porté par le WRAPPER div (unique conteneur)`,
    /<div style="border:2px solid #000;border-radius:8px;overflow:hidden;">\s*<table class="notes">/.test(html));
  check(`${name} : ANCIEN WRAPPER NAVY SUPPRIMÉ (border:2px solid #0A2A5E autour du tableau)`,
    !/border:2px solid #0A2A5E;border-radius:4px/.test(html));
  // A2 — CODE MORT SUPPRIMÉ (les « doublons de conteneurs »)
  check(`${name} : code mort leftColumn/rightColumn supprimé (col-left/col-right absents)`,
    !html.includes('col-left') && !html.includes('col-right'));
  // A3 — EN-TÊTE NAVY (T34 étendu à maternelle/primaire)
  check(`${name} : CSS th = fond navy + texte blanc (en-tête mis en valeur)`,
    /table\.notes th \{ background:#0A2A5E; color:#fff;/.test(html));
  check(`${name} : plus AUCUN fond blanc sur les th (inline ou CSS)`,
    !/table\.notes th \{ background:#fff/.test(html) && !/<tr style="background:#fff;color:#000;">/.test(html));
  check(`${name} : séparateurs internes blancs translucides (groupes vs sous-colonnes)`,
    /border-bottom:1px solid rgba\(255,255,255,0\.35\);[^>]*>(Résultats|Maîtrise minimale|Seuil de réussite)</.test(html));
  // A4 — COHÉRENCE DESIGN SECONDAIRE
  check(`${name} : titre en barre encadrée navy (même standard que le secondaire)`,
    /\.bulletin-title \{ text-align:center; border:2px solid #0A2A5E;[^}]*color:#0A2A5E; background:#f1f5f9; \}/.test(html));
  check(`${name} : infos élève sur wrapper .info-wrap en grille collapse (modèle secondaire)`,
    /<div class="info-wrap">\s*<table class="info-table">/.test(html));
  check(`${name} : infos élève 2 lignes (Année scolaire / Nom et prénoms / Classe / Effectif / Matricule / Rang)`,
    html.includes('Année scolaire :') && html.includes('Nom et prénoms :') && html.includes('Classe :')
      && html.includes('Effectif :') && html.includes('Matricule :') && html.includes('Rang :'));
  check(`${name} : structure .page (footer poussé en bas par flex, comme le secondaire)`,
    /<div class="page" style="page-break-after:always;">/.test(html) && /<div class="page">/.test(html));
  // A5 — ANTI-LIGNES-MANQUANTES
  check(`${name} : lignes du tableau insécables (break-inside:avoid)`,
    /table\.notes tr \{ break-inside:avoid; page-break-inside:avoid; \}/.test(html));
  check(`${name} : thead répété à la fragmentation (display:table-header-group)`,
    /table\.notes thead \{ display:table-header-group; \}/.test(html));
  check(`${name} : blocs de la page 2 insécables (blk-avoid sur analyse/signatures/QR)`,
    (html.match(/class="blk-avoid"/g) || []).length >= 4);
  check(`${name} : footer STATIQUE (plus de position:fixed qui chevauchait signatures/QR)`,
    /\.footer \{ margin-top:auto; padding-top:6px;/.test(html) && !/position:fixed;[^}]*bottom:5mm/.test(html));
  check(`${name} : infos élève insécables (info-wrap break-inside:avoid)`,
    /\.info-wrap \{ border:1px solid #000;[^}]*break-inside:avoid/.test(html));
  check(`${name} : footer +229 0141360803 (T30)`, html.includes('Tél: +229 0141360803'));
}

console.log('\n── A-bis. T42 libellés du carnet (maternelle vs primaire) ──');
check('MATERNELLE : en-tête « Domaine » (pas « Matière »)',
  /rowspan="2"[^>]*>Domaine<\/th>/.test(htmlMat) && !/rowspan="2"[^>]*>Matière<\/th>/.test(htmlMat));
check('MATERNELLE : libellés complets du carnet (Appréciation de l\'enseignant(e), Visa du Directeur (trice), Impression et visa des parents)',
  htmlMat.includes('Appréciation de l\'enseignant(e)') && htmlMat.includes('Visa du Directeur (trice)') && htmlMat.includes('Impression et visa des parents'));
check('PRIMAIRE : en-tête « Champs de formation » + CM/18 + CP/02 + Total/20',
  htmlPri.includes('Champs de formation') && htmlPri.includes('/18') && htmlPri.includes('/02') && htmlPri.includes('/20'));
check('PRIMAIRE : ligne TOTAL GENERAL en bandeau navy',
  /TOTAL GENERAL/.test(htmlPri) && /<tr style="background:#0A2A5E;color:#fff;font-weight:bold;">\s*<td colspan="2"[^>]*>TOTAL GENERAL/.test(htmlPri));
check('MATERNELLE : tri canonique par domaine (Éducation pour la santé en 1re ligne)',
  htmlMat.indexOf('Éducation pour la santé') < htmlMat.indexOf('Langage')
    && htmlMat.indexOf('Observation') < htmlMat.indexOf('Expression plastique'));

// ═══════════════════════════════════════════════════════════════════════════
// B. TASK 42 — buildHtmlVueParMatiere (trimestriel maternelle + primaire)
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── B. T42 buildHtmlVueParMatiere : mêmes standards ──');
for (const [name, html] of [['VPM-MATERNELLE', htmlVpmMat], ['VPM-PRIMAIRE', htmlVpmPri]]) {
  check(`${name} : div fantôme <div style=""> SUPPRIMÉ autour du tableau`,
    !/<div style="">/.test(html));
  check(`${name} : cadre 2px unique porté par le wrapper div`,
    /<div style="border:2px solid #000;border-radius:8px;overflow:hidden;">\s*<table class="notes">/.test(html));
  check(`${name} : CSS notes en collapse SANS bordure propre (filets continus)`,
    /table\.notes \{ width:100%; border-collapse:collapse; \}/.test(html)
      && !/table\.notes \{[^}]*border-spacing/.test(html));
  check(`${name} : en-tête navy + texte blanc`,
    /table\.notes th \{ background:#0A2A5E; color:#fff;/.test(html));
  check(`${name} : 7 colonnes (Matière|EM1|EM2|Moy. EM|EC|Moyenne gén.|Appréciation)`,
    ['Matière', 'EM1', 'EM2', 'Moy. EM', 'EC', 'Moyenne gén.', 'Appréciation']
      .every(h => new RegExp(`<th[^>]*>${h}</th>`).test(html)));
  check(`${name} : infos élève sur wrapper .info-wrap + grille collapse`,
    /<div class="info-wrap">\s*<table class="info-table">/.test(html));
  check(`${name} : titre en barre encadrée navy`,
    /\.bulletin-title \{ text-align:center; border:2px solid #0A2A5E;/.test(html));
  check(`${name} : blocs insécables (synthèse / signatures / QR)`,
    (html.match(/class="blk-avoid/g) || []).length >= 3);
  check(`${name} : lignes insécables + thead répété`,
    /table\.notes tr \{ break-inside:avoid; page-break-inside:avoid; \}/.test(html)
      && /table\.notes thead \{ display:table-header-group; \}/.test(html));
  check(`${name} : ligne Moyenne générale en bandeau navy (tfoot)`,
    /<tfoot>\s*<tr style="background:#0A2A5E;color:white;font-weight:bold;">/.test(html));
  check(`${name} : footer +229 0141360803 (T30)`, html.includes('Tél: +229 0141360803'));
  check(`${name} : commentaire orphelin T34 supprimé`, !html.includes('/groupe insécable conseil + QR (T34)'));
}
check('VPM-MATERNELLE : ligne « Appréciation générale » (pas Moyenne générale) + codes TS/S/PS',
  htmlVpmMat.includes('Appréciation générale') && htmlVpmMat.includes('>TS<') && htmlVpmMat.includes('>PS<'));
check('VPM-PRIMAIRE : ligne « Moyenne générale » + valeurs /20 numériques',
  htmlVpmPri.includes('Moyenne générale') && /13\.42\/20|15\.25/.test(htmlVpmPri));

// ═══════════════════════════════════════════════════════════════════════════
// C. TASK 42 — RENDU RÉEL Chromium (réglages production) + analyse pixels
// ═══════════════════════════════════════════════════════════════════════════
(async () => {
  console.log('\n── C. T42 Rendu réel Chromium (réglages production) ──');
  const puppeteer = require('/home/z/my-project/ah/apps/api-server/node_modules/puppeteer-core');
  const CHROME = '/home/z/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome';
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const variants = [
    { name: 'maternelle', html: htmlMat },
    { name: 'primaire', html: htmlPri },
    { name: 'vpm-primaire', html: htmlVpmPri },
  ];
  const rendered = [];
  for (const v of variants) {
    const page = await browser.newPage();
    await page.setContent(v.html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 150));
    const pdf = await page.pdf({
      format: 'A4', landscape: false, printBackground: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
      timeout: 60000, preferCSSPageSize: false,
    });
    await page.close();
    const pdfPath = path.join(OUT, `task42-${v.name}.pdf`);
    fs.writeFileSync(pdfPath, pdf);
    const prefix = path.join(OUT, `task42-${v.name}`);
    execFileSync('pdftoppm', ['-r', '150', pdfPath, prefix]);
    const pages = fs.readdirSync(OUT).filter(f => f.startsWith(`task42-${v.name}-`) && f.endsWith('.ppm'))
      .sort().map(f => path.join(OUT, f));
    rendered.push({ ...v, pages, pageCount: pages.length });
    console.log(`  📄 ${v.name} : ${pages.length} page(s) rendue(s)`);
  }
  await browser.close();

  function loadPPM(file) {
    const buf = fs.readFileSync(file);
    const headerLen = buf.indexOf('\n', buf.indexOf('\n', buf.indexOf('\n', 0) + 1) + 1) + 1;
    const m = buf.toString('latin1').match(/^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/);
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

  for (const v of rendered) {
    const ppm = loadPPM(v.pages[0]);
    // (a) bande navy de l'en-tête du tableau (≥ 12px de haut, pleine largeur)
    const rowNavyRatio = (y) => {
      let navy = 0, n = 0;
      for (let x = Math.round(ppm.w * 0.15); x < ppm.w * 0.85; x += 4) {
        const [r, g, b] = rgb(ppm, x, y);
        n++;
        if (r < 70 && g < 90 && b > 80 && b > r + 30) navy++;
      }
      return navy / n;
    };
    let bandStart = -1, bandEnd = -1;
    for (let y = 100; y < ppm.h - 50; y++) {
      if (rowNavyRatio(y) <= 0.6) continue;
      let e = y;
      while (e + 1 < ppm.h && rowNavyRatio(e + 1) > 0.4) e++;
      if (e - y + 1 >= 12) { bandStart = y; bandEnd = e; break; }
    }
    check(`${v.name} : bande NAVY de l'en-tête du tableau détectée en pixels`, bandStart >= 0,
      bandStart < 0 ? 'aucune bande navy pleine largeur trouvée' : `bande y=${bandStart}→${bandEnd}`);
    if (bandStart >= 0) {
      let light = 0, n = 0;
      for (let y = bandStart; y <= bandEnd; y++) {
        for (let x = Math.round(ppm.w * 0.15); x < ppm.w * 0.85; x += 3) { n++; if (lum(ppm, x, y) > 200) light++; }
      }
      check(`${v.name} : texte BLANC lisible dans l'en-tête navy`, light / n > 0.01,
        `ratio pixels clairs = ${((light / n) * 100).toFixed(1)}%`);
    }
    // (b) filets horizontaux longs par page + aucune page vide
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
    check(`${v.name} : filets horizontaux longs présents en page 1 (${linesPerPage[0]})`, linesPerPage[0] >= 6);
    check(`${v.name} : AUCUNE page « vide de filets »`, linesPerPage.every(c => c > 0),
      `par page : [${linesPerPage.join(', ')}]`);
    // (c) page 2 (maternelle/primaire évaluation) : contenu substantiel
    //     (signatures + analyse + QR — pas un fragment orphelin vide)
    if (v.pages.length > 1) {
      const ppm2 = loadPPM(v.pages[1]);
      let nonWhite = 0, n = 0;
      for (let y = 0; y < ppm2.h; y += 3) {
        for (let x = 0; x < ppm2.w; x += 3) { n++; if (lum(ppm2, x, y) < 245) nonWhite++; }
      }
      check(`${v.name} : page 2 avec contenu substantiel (signatures/QR)`, nonWhite / n > 0.005,
        `pixels non blancs = ${((nonWhite / n) * 100).toFixed(2)}%`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // D. TASK 43 — Page publique de consultation (structurel)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n── D. T43 Page publique de consultation ──');
  const pagePub = fs.readFileSync(path.join(ROOT, 'apps/web-app/src/app/(public)/federis/resultats/[token]/page.tsx'), 'utf8');
  const client = fs.readFileSync(path.join(ROOT, 'apps/web-app/src/components/public/FederisPublicResultsClient.tsx'), 'utf8');
  const svcPublic = fs.readFileSync(path.join(ROOT, 'apps/api-server/src/federis/federis-public-results.service.ts'), 'utf8');
  const svcDelib = fs.readFileSync(path.join(ROOT, 'apps/api-server/src/federis/federis-deliberation.service.ts'), 'utf8');

  // D1 — Header supprimé
  check('page publique : import du Header SUPPRIMÉ', !pagePub.includes("import { Header }"));
  check('page publique : <Header /> n\'est plus rendu', !/<Header/.test(pagePub));
  check('page publique : spacer du layout compensé (marge négative -mt-14 md:-mt-16)',
    pagePub.includes('-mt-14 md:-mt-16'));
  check('page publique : le composant client est toujours servi (token)', pagePub.includes('FederisPublicResultsClient'));

  // D2 — Fix [object Object]
  check('API public-results : session = board.exam.session (libellé officiel, plus l\'objet saisie)',
    svcPublic.includes('session: board.exam.session ?? null') && !/session: board\.session,/.test(svcPublic));
  check('API deliberation : board.exam expose désormais le libellé de session officiel',
    svcDelib.includes('session: ds.exam.session ?? null'));

  // D3 — Feux d'artifice / particules
  check('client : système de feux d\'artifice canvas (FireworksCanvas) défini',
    client.includes('function FireworksCanvas'));
  check('client : mode AMBIANCE dans le bandeau « Consultation des résultats »',
    /<FireworksCanvas mode="ambient"/.test(client));
  check('client : mode SALVES (bursts) pour la célébration du modal admis',
    client.includes('mode="bursts"'));
  check('client : pluie de confettis (ConfettiRain) sur le modal admis',
    client.includes('function ConfettiRain') && client.includes('<ConfettiRain />'));
  check('client : accessibilité — prefers-reduced-motion désactive TOUT (canvas + CSS)',
    client.includes("matchMedia?.('(prefers-reduced-motion: reduce)')") && client.includes('.fed-sad-drop'));

  // D4 — Modal de résultat centré
  check('client : ResultModal centré (fixed inset-0 + flex items-center justify-center)',
    client.includes('function ResultModal') && /className="fixed inset-0 z-\[80\] flex items-center justify-center/.test(client));
  check('client : modal accessible (role="dialog" + aria-modal)',
    client.includes('role="dialog"') && client.includes('aria-modal="true"'));
  check('client : fermeture Escape + verrouillage du scroll body',
    client.includes("e.key === 'Escape'") && client.includes("document.body.style.overflow = 'hidden'"));
  check('client : ADMIS → effets waouh (Félicitations + coche animée + pulsation)',
    client.includes('Félicitations !') && client.includes('AnimatedSuccessCheck') && client.includes('fed-celebrate-pulse'));
  check('client : AJOURNÉ → emoji triste animé (fed-sad-drop, aucune célébration)',
    client.includes('fed-sad-drop') && /😞/.test(client));
  check('client : infos clés structurées (nom, matricule, table, école de provenance, centre d\'examen)',
    client.includes('Nom et prénoms') && client.includes('Matricule') && client.includes('N° de table')
      && client.includes('École de provenance') && client.includes("Centre d’examen"));
  check('client : ancienne fiche inline CandidateSheet remplacée (plus référencée)',
    !client.includes('CandidateSheet'));
  check('client : rendu défensif du sous-titre examen (typeof string — anti [object Object])',
    client.includes("typeof info.exam.name === 'string'") && client.includes("typeof info.exam.session === 'string'"));
  check('client : résultat unique → modal ouvert automatiquement',
    client.includes('found.length === 1'));

  // ── Bilan ──
  console.log(`\n════════════════════════════════════════════════════════`);
  console.log(`  RÉSULTAT : ${pass} ✅ / ${fail} ❌  (sur ${pass + fail} contrôles)`);
  console.log(`════════════════════════════════════════════════════════`);
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('ERREUR RENDU :', e); process.exit(1); });
