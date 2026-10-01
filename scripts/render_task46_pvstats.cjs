#!/usr/bin/env node
/**
 * ============================================================================
 * render_task46_pvstats.cjs — RUNTIME du service PV/Stats PDF Federis (T46)
 * ============================================================================
 *
 * OBJECTIF : exécuter le VRAI code de FederisPvStatsPdfService (transpilation
 * SWC + harnais vm — pattern des Tasks 25/33) pour valider le rendu HTML des
 * documents officiels :
 *
 *   1. buildProcVerbalHtml — en-tête République du Bénin + patronat, tableau
 *      principal (matières abrégées via les règles ABBR du Helm, notes, Total,
 *      Coef, Moyenne, Rang), ABSENTS « ABS », Trois premiers / Trois derniers,
 *      tri mérite vs alphabétique ;
 *   2. buildStatsHtml — les 3 sous-onglets : taux de réussite (G/F/T ×4 +
 *      graphique en barres), intervalle (8 colonnes), meilleures notes (Top N
 *      + École + appréciation).
 *
 * Les HTML produits sont sauvegardés dans download/task46-*.html pour
 * inspection manuelle éventuelle.
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = '/home/z/my-project/ah';
const swc = require(path.join(ROOT, 'apps/api-server/node_modules/@swc/core'));

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

// ── 1. Transpilation du service (SWC, config du build Railway) ─────────────
const src = fs.readFileSync(path.join(ROOT, 'apps/api-server/src/federis/federis-pv-stats-pdf.service.ts'), 'utf8');
const { code } = swc.transformSync(src, {
  jsc: {
    target: 'es2021',
    parser: { syntax: 'typescript', tsx: false, decorators: true, dynamicImport: true },
    transform: { legacyDecorator: true, decoratorMetadata: true },
    keepClassNames: true,
  },
  module: { type: 'commonjs' },
  sourceMaps: false,
});

// ── 2. Stubs des dépendances (le service n'est pas instancié par Nest ici ;
//       examSessionLabel/officialExamTitle = miroirs fidèles du source — leur
//       comportement attendu est ASSERTÉ dans le HTML produit) ──────────────
const MONTHS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const mocks = {
  '@nestjs/common': {
    __esModule: true,
    Injectable: () => (cls) => cls,
    InternalServerErrorException: class InternalServerErrorException extends Error {},
    NotFoundException: class NotFoundException extends Error {},
    Logger: class Logger { constructor() {} error() {} log() {} },
  },
  '../database/prisma.service': { __esModule: true, PrismaService: class {} },
  '../common/services/puppeteer-pool.service': { __esModule: true, PuppeteerPoolService: class {} },
  './federis-patronat.service': { __esModule: true, FederisPatronatService: class {} },
  './federis-grades.service': {
    __esModule: true,
    examSessionLabel: (exam, academicYearLabel) => {
      if (exam?.startDate) {
        const d = new Date(exam.startDate);
        return `Session de ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
      }
      return academicYearLabel ? `Session ${academicYearLabel}` : '';
    },
    officialExamTitle: (examType) => {
      switch ((examType ?? '').toUpperCase()) {
        case 'CEP': return { main: "CERTIFICAT D'ÉTUDES PRIMAIRES", sub: '(C.E.P.)' };
        case 'BEPC': return { main: "BREVET D'ÉTUDES DU PREMIER CYCLE", sub: '(B.E.P.C.)' };
        case 'BAC': return { main: 'BACCALAURÉAT', sub: '' };
        default: return { main: String(examType ?? 'EXAMEN NATIONAL'), sub: '' };
      }
    },
  },
};

const moduleObj = { exports: {} };
const sandbox = {
  console,
  Buffer,
  setTimeout,
  module: moduleObj,
  exports: moduleObj.exports,
  require: (id) => {
    if (mocks[id]) return mocks[id];
    throw new Error(`require inattendu : ${id}`);
  },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'federis-pv-stats-pdf.service.ts' });
const FederisPvStatsPdfService =
  moduleObj.exports.FederisPvStatsPdfService || sandbox.exports.FederisPvStatsPdfService;
if (typeof FederisPvStatsPdfService !== 'function') throw new Error('Service non exporté');

const svc = new FederisPvStatsPdfService(undefined, undefined, undefined);

// ── 3. Contexte officiel réaliste (patronat organisateur + examen CEP) ─────
const ctx = {
  patronatTenantId: 'tenant-1',
  patronat: {
    name: 'Union des Patronats Test',
    legalName: 'UNION NATIONALE DES PATRONATS TEST',
    abbreviation: 'UNP',
    territoryName: 'Atlantique',
    countryName: 'Bénin',
    address: 'Cotonou',
    phone: '+229 01 00 00 00 00',
    email: 'contact@unp.test',
    logo: 'data:image/png;base64,LOGOTEST',
  },
  exam: {
    id: 'exam-1',
    code: 'CEP-2026',
    name: "Certificat d'Études Primaires",
    examType: 'CEP',
    session: 'Session de mai 2026',
    academicYearLabel: '2025-2026',
  },
};

const subjects = [
  { id: 's1', name: 'Mathématiques', code: 'MATH-CEP', coefficient: 4 },
  { id: 's2', name: 'Français', code: 'FR-CEP', coefficient: 4 },
  { id: 's3', name: 'Sciences de la vie et de la terre', code: 'SVT-CEP', coefficient: 2 },
];
const students = [
  { id: 'c1', matricule: 'MAT-001', name: 'ADJOVI Grace', gender: 'F', subjectScores: { s1: 16, s2: 15.5, s3: 14 }, absents: [], total: 158, totalCoef: 10, moyenne: 15.8, rang: 1 },
  { id: 'c2', matricule: 'MAT-002', name: 'BADA Sylvain', gender: 'M', subjectScores: { s1: 12, s2: 11, s3: 10 }, absents: [], total: 118, totalCoef: 10, moyenne: 11.8, rang: 2 },
  { id: 'c3', matricule: 'MAT-003', name: 'CODJO Aline', gender: 'F', subjectScores: { s1: 9, s2: null, s3: 8 }, absents: ['s2'], total: 52, totalCoef: 6, moyenne: 8.67, rang: 3 },
  { id: 'c4', matricule: 'MAT-004', name: 'DOKO Eric', gender: 'M', subjectScores: { s1: 6, s2: 7, s3: 5 }, absents: [], total: 63, totalCoef: 10, moyenne: 6.3, rang: 4 },
];
const top3 = [students[0], students[1], students[2]];
const bottom3 = [...students].reverse().slice(0, 3);

console.log('════════════════════════════════════════════════════════════════');
console.log(' RUNTIME — FederisPvStatsPdfService (VRAI code des builders HTML)');
console.log('════════════════════════════════════════════════════════════════');

// ═══════════════════════════════════════════════════════════════════════════
// A. PROCÈS-VERBAL
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── A. buildProcVerbalHtml (ordre de mérite) ──');
const pvHtml = svc.buildProcVerbalHtml(ctx, { sortMode: 'merite', subjects, students, top3, bottom3 });
fs.writeFileSync(path.join(ROOT, 'download', 'task46-pv.html'), pvHtml);

check('en-tête officiel : République du Bénin', pvHtml.includes('République du Bénin'));
check('en-tête : drapeau du Bénin (SVG base64)', /data:image\/svg\+xml;base64/.test(pvHtml));
check('en-tête : organisateur = PATRONAT (legalName en majuscules)', pvHtml.includes('UNION NATIONALE DES PATRONATS TEST'));
check('en-tête : intitulé officiel de l\'examen (échappé : CERTIFICAT D&#39;ÉTUDES PRIMAIRES)', pvHtml.includes('CERTIFICAT D&#39;ÉTUDES PRIMAIRES'));
check('en-tête : logo du patronat', pvHtml.includes('data:image/png;base64,LOGOTEST'));
check('en-tête : infos territoire · adresse · tél · email', pvHtml.includes('Atlantique — Bénin') && pvHtml.includes('Tél : +229 01 00 00 00 00'));
check('titre : PROCÈS-VERBAL D\'EXAMEN (bandeau navy)', pvHtml.includes('PROCÈS-VERBAL D\'EXAMEN'));
check('meta : examen + code + session officielle + année + candidats', pvHtml.includes('CEP-2026') && pvHtml.includes('Session de mai 2026') && pvHtml.includes('2025-2026') && pvHtml.includes('Candidats :</strong> 4'));
check('matières abrégées par les règles ABBR du Helm (MATH · FR · SVT)', pvHtml.includes('MATH') && />FR</.test(pvHtml) && pvHtml.includes('SVT'));
check('coefficients en sous-titre des matières (Coef 4 / Coef 2)', pvHtml.includes('Coef 4') && pvHtml.includes('Coef 2'));
check('notes au format 2 décimales (16.00, 15.50)', pvHtml.includes('16.00') && pvHtml.includes('15.50'));
check('ABSENT marqué « ABS » (CODJO absente en Français)', /<td class="score-absent">ABS<\/td>/.test(pvHtml));
check('colonnes Total / Coef / Moyenne / Rang présentes (rowspan=2)', /rowspan="2" style="text-align:center;">Total/.test(pvHtml) && /rowspan="2" style="text-align:center;">Coef/.test(pvHtml) && /rowspan="2" style="text-align:center;">Moyenne/.test(pvHtml) && /rowspan="2" style="text-align:center;">Rang/.test(pvHtml));
check('moyenne ≥ 10 en vert (score-pass), < 10 en rouge (score-fail)', /class="score-pass" style="font-weight:bold;">15.80/.test(pvHtml) && /class="score-fail" style="font-weight:bold;">6.30/.test(pvHtml));
check('ordre de MÉRITE : ADJOVI (rang 1) avant BADA (rang 2)', pvHtml.indexOf('ADJOVI Grace') < pvHtml.indexOf('BADA Sylvain'));
check('mini-tableaux Trois premiers / Trois derniers', pvHtml.includes('Trois premiers') && pvHtml.includes('Trois derniers'));
check('mini-tableau « Trois derniers » : DOKO Eric présent', /Trois derniers[\s\S]*DOKO Eric/.test(pvHtml));
check('footer : Document officiel généré par Academia Frederis + patronat', pvHtml.includes('Document officiel généré par Academia Frederis — Union des Patronats Test'));
check('HTML complet et bien formé (doctype + </html>)', /^<!DOCTYPE html>/m.test(pvHtml) && pvHtml.trim().endsWith('</html>'));

// Tri alphabétique
console.log('\n── A2. buildProcVerbalHtml (ordre alphabétique) ──');
const pvAlpha = svc.buildProcVerbalHtml(ctx, { sortMode: 'alphabetique', subjects, students, top3, bottom3 });
check('ordre ALPHABÉTIQUE : ADJOVI → BADA → CODJO → DOKO', pvAlpha.indexOf('ADJOVI Grace') < pvAlpha.indexOf('BADA Sylvain') && pvAlpha.indexOf('BADA Sylvain') < pvAlpha.indexOf('CODJO Aline') && pvAlpha.indexOf('CODJO Aline') < pvAlpha.indexOf('DOKO Eric'));

// ═══════════════════════════════════════════════════════════════════════════
// B. STATISTIQUES — taux de réussite
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── B. buildStatsHtml (taux de réussite, notes) ──');
const successRateRows = [
  { subjectName: 'Mathématiques', present: { boys: 2, girls: 1, total: 3 }, admitted: { boys: 1, girls: 1, total: 2 }, passRate: { boys: 50, girls: 100, total: 66.7 }, failRate: { boys: 50, girls: 0, total: 33.3 } },
  { subjectName: 'Français', present: { boys: 1, girls: 1, total: 2 }, admitted: { boys: 0, girls: 1, total: 1 }, passRate: { boys: 0, girls: 100, total: 50 }, failRate: { boys: 100, girls: 0, total: 50 } },
];
const statsPayload = (subTab, extra = {}) => ({
  mainTab: 'notes',
  subTab,
  subjects,
  successRateRows,
  intervalRows: [
    { subjectName: 'Mathématiques', effectif: 3, intervals: [{ label: '0 — 3', count: 0 }, { label: '3 — 7', count: 1 }, { label: '7 — 9', count: 0 }, { label: '9 — 10', count: 0 }, { label: '10 — 12', count: 0 }, { label: '12 — 14', count: 1 }, { label: '14 — 16', count: 0 }, { label: '16 — 20', count: 1 }] },
  ],
  bestRows: [
    { matricule: 'MAT-001', name: 'ADJOVI Grace', school: 'EP Sainte-Rita', score: 16, appreciation: 'Très Bien' },
    { matricule: 'MAT-002', name: 'BADA Sylvain', school: 'EP Les Palmiers', score: 12, appreciation: 'Assez Bien' },
  ],
  topN: 3,
  ...extra,
});

const statsTR = svc.buildStatsHtml(ctx, statsPayload('taux-reussite'));
fs.writeFileSync(path.join(ROOT, 'download', 'task46-stats-taux-reussite.html'), statsTR);

check('titre : STATISTIQUES DES NOTES (bandeau navy)', statsTR.includes('STATISTIQUES DES NOTES'));
check('tableau : groupes Effectif présents · Total admis · % Réussite · % Échec', statsTR.includes('Effectif présents') && statsTR.includes('Total admis') && statsTR.includes('% Réussite') && statsTR.includes('% Échec'));
check('sous-colonnes G/F/T ×4 (12 colonnes)', (statsTR.match(/<th style="text-align:center;">G<\/th>/g) || []).length === 4 && (statsTR.match(/<th style="text-align:center;">T<\/th>/g) || []).length === 4);
check('valeurs des lignes (66.7% réussite Maths, 50.0% échec garçons)', statsTR.includes('66.7%') && statsTR.includes('50.0%'));
check('graphique en barres des admis par matière (bar-chart)', statsTR.includes('bar-chart') && statsTR.includes('Nombre d\'admis par matière'));
check('barres proportionnelles (2/2 = 100%, 1/2 = 50%)', /height:100%;/.test(statsTR) && /height:50%;/.test(statsTR));
check('section « Taux de réussite »', statsTR.includes('>Taux de réussite</div>'));

// ═══════════════════════════════════════════════════════════════════════════
// C. STATISTIQUES — intervalle + meilleures
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── C. buildStatsHtml (intervalle + meilleures) ──');
const statsINT = svc.buildStatsHtml(ctx, statsPayload('intervalle'));
fs.writeFileSync(path.join(ROOT, 'download', 'task46-stats-intervalle.html'), statsINT);
check('intervalle : les 8 intervalles du Helm en colonnes', ['0 — 3', '3 — 7', '7 — 9', '9 — 10', '10 — 12', '12 — 14', '14 — 16', '16 — 20'].every((l) => statsINT.includes(`>${l}<`)));
check('intervalle : effectif + dénombrements (3 présents, 1 dans 3-7, 1 dans 16-20)', statsINT.includes('>3</td>') && /3 — 7<\/th>/.test(statsINT));

const statsBEST = svc.buildStatsHtml(ctx, statsPayload('meilleurs'));
fs.writeFileSync(path.join(ROOT, 'download', 'task46-stats-meilleures.html'), statsBEST);
check('meilleures : section « Top 3 meilleures notes »', statsBEST.includes('Top 3 meilleures notes'));
check('meilleures : colonne École (école de provenance)', /<th>École<\/th>/.test(statsBEST) && statsBEST.includes('EP Sainte-Rita'));
check('meilleures : note + appréciation (16.00 · Très Bien)', statsBEST.includes('16.00') && statsBEST.includes('Très Bien'));

// Moyennes (mainTab moyennes)
const statsMOY = svc.buildStatsHtml(ctx, statsPayload('taux-reussite', { mainTab: 'moyennes' }));
check('moyennes : titre STATISTIQUES DES MOYENNES', statsMOY.includes('STATISTIQUES DES MOYENNES'));

// ── Bilan ──
console.log(`\n════════════════════════════════════════════════════════`);
console.log(`  RÉSULTAT : ${pass} ✅ / ${fail} ❌  (sur ${pass + fail} contrôles)`);
console.log(`  HTML sauvegardés : download/task46-pv.html, task46-stats-*.html`);
console.log(`════════════════════════════════════════════════════════`);
if (fail > 0) process.exit(1);
