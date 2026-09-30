#!/usr/bin/env node
/**
 * verify_task22.cjs — Vérification de la Task 22
 *
 * 1. MODÈLE CEP (CM/18 + CP/2 = note/20) — tests RUNTIME sur le VRAI code :
 *    splitCepScore, cepCpGate, isCepPerfectionnementSubject, computeCepAdmission,
 *    computeReleveBilan (validé sur les données du relevé BEPC officiel joint),
 *    isFrenchGroupSubject, isOralSubject, isEpsSubject, examSessionLabel,
 *    officialExamTitle (backend) + splitCepScore/withCepDetail/cepNote (front).
 * 2. Contrôles structurels BACKEND : DTO cm/cp (grille + saisie), scission
 *    automatique, porte du CP, fusion metadata, payload relevés officiel
 *    (cepAdmission, bilan, patronat, session, état civil), PDF officiel
 *    (sections CEP/secondaire, décision du jury, signature coordonnateur,
 *    A4 portrait).
 * 3. Contrôles structurels WEB : grille CEP 3 sous-colonnes (patronat +
 *    secrétaire), aperçus relevés officiels, interfaces enrichies.
 * 4. Équilibre des blocs CSS (globals.css — build Vercel).
 */
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project/ah';
const ts = require('/home/z/my-project/scripts/tscheck/node_modules/typescript');

let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}`);
  }
}
function read(p) {
  return fs.readFileSync(p, 'utf8');
}

/** Transpile un fichier TS/TSX (diagnostiques syntaxe). */
function transpileOk(rel) {
  const file = path.join(ROOT, rel);
  const src = read(file);
  const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2021, true, kind);
  const errs = (sf.parseDiagnostics || []).filter((d) => d.category === 0);
  if (errs.length > 0) {
    for (const d of errs.slice(0, 3)) {
      const pos = sf.getLineAndCharacterOfPosition(d.start);
      console.log(`      L${pos.line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ').slice(0, 100)}`);
    }
    return false;
  }
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
      jsx: ts.JsxEmit.React,
    },
    reportDiagnostics: true,
    fileName: file,
  });
  const tErrs = (out.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (tErrs.length > 0) {
    for (const d of tErrs.slice(0, 3)) {
      console.log(`      ${ts.flattenDiagnosticMessageText(d.messageText, ' ').slice(0, 100)}`);
    }
    return false;
  }
  return true;
}

/** Extrait une fonction exportée COMPLÈTE du source TS via l'AST TypeScript
 *  (robuste aux types de retour objets, génériques et surcharges). */
function extractFunction(src, name) {
  const sf = ts.createSourceFile('extract.ts', src, ts.ScriptTarget.ES2021, true);
  let text = null;
  const visit = (node) => {
    if (text) return;
    if (
      (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) &&
      node.name &&
      node.name.text === name &&
      node.body
    ) {
      text = node.getText(sf);
      return;
    }
    node.forEachChild(visit);
  };
  visit(sf);
  if (!text) throw new Error(`Fonction ${name} introuvable`);
  return text.replace(/^export\s+/, '');
}

/** Transpile un extrait TS en JS (types retirés) pour évaluation runtime. */
function transpileSnippet(snippet) {
  const out = ts.transpileModule(snippet, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
      isolatedModules: true,
    },
    fileName: 'snippet.ts',
  });
  return out.outputText;
}

/** Évalue les fonctions backend pures avec normalizeSubjectName stubbé. */
function evalBackendHelpers() {
  const src = read(path.join(ROOT, 'apps/api-server/src/federis/federis-grades.service.ts'));
  const names = [
    'splitCepScore', 'cepCpGate', 'isCepPerfectionnementSubject', 'computeCepAdmission',
    'isFrenchGroupSubject', 'isOralSubject', 'isEpsSubject', 'computeReleveBilan',
    'examSessionLabel', 'officialExamTitle',
  ];
  let code = `
    function normalizeSubjectName(raw) {
      return String(raw ?? '').trim().toLowerCase().normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '').replace(/[-\\/\\\\+&]| et /g, ' ')
        .replace(/\\s+/g, ' ').trim();
    }
    function round2(n) { return Math.round(n * 100) / 100; }
    const CEP_CM_MAX = 18; const CEP_CP_MAX = 2; const CEP_SIXIEME_THRESHOLD = 10;
  `;
  for (const n of names) code += '\n' + extractFunction(src, n) + '\n';
  const js = transpileSnippet(code);
  const fn = new Function(js + '; return {' + names.map((n) => n).join(',') + '};');
  return fn();
}

/** Évalue les helpers front (grade-computations.ts). */
function evalFrontHelpers() {
  const src = read(path.join(ROOT, 'apps/web-app/src/lib/federis/grade-computations.ts'));
  const names = ['splitCepScore', 'withCepDetail', 'cepNote'];
  let code = `
    function round2(n) { return Math.round(n * 100) / 100; }
    const CEP_CM_MAX = 18; const CEP_CP_MAX = 2;
  `;
  for (const n of names) code += '\n' + extractFunction(src, n) + '\n';
  const js = transpileSnippet(code);
  const fn = new Function(js + '; return {' + names.map((n) => n).join(',') + '};');
  return fn();
}

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n══ 1. TRANSPILE des fichiers modifiés ══');
const files = [
  'apps/api-server/src/federis/federis-grades.service.ts',
  'apps/api-server/src/federis/federis-saisie.service.ts',
  'apps/api-server/src/federis/federis-pdf.service.ts',
  'apps/web-app/src/lib/federis/grade-computations.ts',
  'apps/web-app/src/components/federis/FederisGradeSheetTab.tsx',
  'apps/web-app/src/components/federis/FederisSaisiePage.tsx',
  'apps/web-app/src/components/federis/FederisGradeRelevesTab.tsx',
];
for (const f of files) check(`transpile ${path.basename(f)}`, transpileOk(f));

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n══ 2. RUNTIME — Modèle CEP : scission CM/18 + CP/2 ══');
const B = evalBackendHelpers();

// splitCepScore : reprise des notes héritées
check('splitCepScore(12) → CM 12 + CP 0', B.splitCepScore(12).cm === 12 && B.splitCepScore(12).cp === 0);
check('splitCepScore(19.5) → CM 18 + CP 1.5', B.splitCepScore(19.5).cm === 18 && B.splitCepScore(19.5).cp === 1.5);
check('splitCepScore(20) → CM 18 + CP 2', B.splitCepScore(20).cm === 18 && B.splitCepScore(20).cp === 2);
check('splitCepScore(0) → CM 0 + CP 0', B.splitCepScore(0).cm === 0 && B.splitCepScore(0).cp === 0);
check('splitCepScore(17.75) → CM 17.75 + CP 0 (cas officiel EST)', B.splitCepScore(17.75).cm === 17.75 && B.splitCepScore(17.75).cp === 0);

// Porte du CP : seulement si la minimale exigée est atteinte
check('cepCpGate(cm=9.5, min=10) → CP forcé 0', B.cepCpGate(9.5, 10) === 0);
check('cepCpGate(cm=10, min=10) → CP autorisé (null)', B.cepCpGate(10, 10) === null);
check('cepCpGate(cm=15, min=12) → CP autorisé', B.cepCpGate(15, 12) === null);
check('cepCpGate(cm=11, min=12) → CP forcé 0 (Educ. Artistique orale)', B.cepCpGate(11, 12) === 0);

// Matières étoilées (perfectionnement → entrée en 6ème)
check('Étoilée : Expression Écrite', B.isCepPerfectionnementSubject('EE-01', 'Expression Écrite') === true);
check('Étoilée : Compréhension de l\'Écrit (Lecture)', B.isCepPerfectionnementSubject('LECT-02', "Compréhension de l'Écrit (Lecture)") === true);
check('Étoilée : Mathématiques', B.isCepPerfectionnementSubject('MATH-04', 'Mathématiques') === true);
check('Étoilée : Calcul', B.isCepPerfectionnementSubject('CAL', 'Calcul (Mathématiques)') === true);
check('Non étoilée : Dictée', B.isCepPerfectionnementSubject('DICT-03', 'Dictée') === false);
check('Non étoilée : EPS', B.isCepPerfectionnementSubject('EPS-09', 'Éducation Physique et Sportive') === false);
check('Non étoilée : EST', B.isCepPerfectionnementSubject('EST-05', 'Éducation Scientifique et Technologique') === false);
check('Non étoilée : Éducation Sociale', B.isCepPerfectionnementSubject('ES-06', 'Éducation Sociale') === false);
check('Non étoilée : EA Vivant', B.isCepPerfectionnementSubject('EAV-07', 'Éducation Artistique (EA) Vivant') === false);
check('Non étoilée : EA Plastique', B.isCepPerfectionnementSubject('EAP-08', 'Éducation Artistique (EA) Plastique') === false);

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n══ 3. RUNTIME — Décision du jury CEP (règles officielles) ══');
const mkLines = (scores) =>
  scores.map(([s, min, cp, perf]) => ({
    score: s, isAbsent: false, passingScore: min, cp: cp ?? 0, perfectionnement: !!perf,
  }));

// Cas officiel : 9 matières, minimales exigées atteintes dans 8/9 → admis CEP
const linesOfficiel = mkLines([
  [12.5, 10, 0, true], [16, 10, 1.25, true], [0, 10, 0, false], [10, 10, 1, true],
  [17.75, 10, 1, false], [15, 10, 1, false], [15, 12, 1, false], [14, 10, 1, false], [18, 10, 0, false],
]);
const adm1 = B.computeCepAdmission(linesOfficiel, 9);
check('Cas officiel : admis au CEP (8 matières ≥ min)', adm1.admisCep === true);
// ⭐ Task 25 (2026-10-01) : la 6ème est décidée par la MOYENNE des matières
//    étoilées (≥ 10/20) — plus de condition de perfectionnement (CP > 0).
check('Cas officiel : admis en 6ème (moyenne étoilées 12,83 ≥ 10 — règle Task 25)',
  adm1.admisSixieme === true && adm1.moyenneEtoiles === 12.83 && adm1.matieresEtoiles === 3);
check('Cas officiel : 6 matières requises sur 9', adm1.matieresRequises === 6);
check('Cas officiel : 8 matières réussies', adm1.matieresReussies === 8);

// 5/9 réussies → ajourné ; échec 6ème
const adm2 = B.computeCepAdmission(
  mkLines([[12, 10, 1, true], [11, 10, 0, false], [9, 10, 0, true], [8, 10, 0, false],
           [14, 10, 0, false], [7, 10, 0, false], [13, 12, 0, false], [6, 10, 0, false], [10, 10, 0, false]]),
  9,
);
check('5/9 réussies → ajourné au CEP', adm2.admisCep === false);
check('Ajourné CEP mais moyenne étoilées 10,50 → admis 6ème (règle indépendante Task 25)',
  adm2.admisSixieme === true && adm2.moyenneEtoiles === 10.5);

// Admis CEP mais CP = 0 partout → admis CEP, ajourné 6ème
const adm3 = B.computeCepAdmission(
  mkLines([[14, 10, 0, true], [15, 10, 0, true], [12, 10, 0, true], [11, 10, 0, false],
           [13, 10, 0, false], [12, 10, 0, false], [14, 12, 0, false], [13, 10, 0, false], [15, 10, 0, false]]),
  9,
);
check('9/9 réussies sans CP → admis CEP', adm3.admisCep === true);
check('CP = 0 partout mais moyenne étoilées 13,67 → admis 6ème (règle Task 25)',
  adm3.admisSixieme === true && adm3.moyenneEtoiles === 13.67);

// Absents exclus du décompte
const adm4 = B.computeCepAdmission(
  [{ score: 15, isAbsent: true, passingScore: 10, cp: 0, perfectionnement: true },
   ...mkLines([[12, 10, 0, true], [11, 10, 0, false], [14, 10, 0, false], [13, 10, 0, false],
               [12, 10, 0, false], [14, 12, 0, false], [13, 10, 0, false], [15, 10, 0, false]])],
  9,
);
check('Absent exclu → 8/9 réussies → admis CEP', adm4.admisCep === true && adm4.matieresNotees === 8);

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n══ 4. RUNTIME — BILAN du relevé BEPC/BAC/CAP (données du PDF officiel) ══');
const lignesOfficiellesBepec = [
  { name: 'Communication Ecrite', coefficient: 2, score: 11.0, isAbsent: false },
  { name: 'Lecture', coefficient: 2, score: 14.0, isAbsent: false },
  { name: 'Mathématiques', coefficient: 3, score: 5.0, isAbsent: false },
  { name: 'Physique Chimie et Technologie', coefficient: 2, score: 11.0, isAbsent: false },
  { name: 'Espagnol', coefficient: 2, score: 14.0, isAbsent: false },
  { name: 'Sciences de la Vie et de la Terre', coefficient: 2, score: 7.0, isAbsent: false },
  { name: 'Histoire et Géographie', coefficient: 2, score: 10.0, isAbsent: false },
  { name: 'Anglais', coefficient: 2, score: 14.0, isAbsent: false },
  { name: 'Oral d\'Anglais', coefficient: 2, score: 19.0, isAbsent: false },
  { name: 'Education Physique et Sportive', coefficient: 1, score: 17.0, isAbsent: false },
];
const bilan = B.computeReleveBilan(lignesOfficiellesBepec);
check('Total Français = 50.00 (Communication Écrite 22 + Lecture 28)', bilan.totalFrancais === 50);
check('Total Écrit = 177.00 (hors Oral d\'Anglais et EPS)', bilan.totalEcrit === 177);
check('Total Final = 232.00', bilan.totalFinal === 232);
check('Moyenne = 11.60 (232 / 20 coef)', bilan.moyenne === 11.6);
check('hasFrancais = true', bilan.hasFrancais === true);

// Cas Borgou : 8 matières BEPC sans oral → Écrit = Final
const lignesBorgouBepec = [
  { name: 'Communication Écrite', coefficient: 2, score: 12, isAbsent: false },
  { name: 'Lecture', coefficient: 2, score: 13, isAbsent: false },
  { name: 'Mathématiques', coefficient: 3, score: 9, isAbsent: false },
  { name: 'Physique Chimie et Technologie', coefficient: 2, score: 11, isAbsent: false },
  { name: 'Science de la Vie et de la Terre', coefficient: 3, score: 8, isAbsent: false },
  { name: 'Histoire-Géographie', coefficient: 2, score: 14, isAbsent: false },
  { name: 'Anglais', coefficient: 2, score: 15, isAbsent: false },
  { name: 'Éducation Physique et Sportive', coefficient: 1, score: 16, isAbsent: false },
];
const bilanBorgou = B.computeReleveBilan(lignesBorgouBepec);
check('Borgou BEPC : Total Français = 50 (24 + 26)', bilanBorgou.totalFrancais === 50);
check('Borgou BEPC : Total Écrit = 181 (Final 197 − EPS 16)', bilanBorgou.totalEcrit === 181 && bilanBorgou.totalFinal === 197);
check('Borgou BEPC : Moyenne pondérée correcte', bilanBorgou.moyenne === Math.round((bilanBorgou.totalFinal / 17) * 100) / 100);

// Groupes
check('Groupe Français : Communication Écrite', B.isFrenchGroupSubject('Communication Écrite') === true);
check('Groupe Français : Lecture', B.isFrenchGroupSubject('Lecture') === true);
check('Groupe Français : Français', B.isFrenchGroupSubject('Français') === true);
check('Hors groupe : Mathématiques', B.isFrenchGroupSubject('Mathématiques') === false);
check('Hors groupe : EPS', B.isFrenchGroupSubject('Éducation Physique et Sportive') === false);
check('Oral : Oral d\'Anglais', B.isOralSubject("Oral d'Anglais") === true);
check('Non oral : Anglais', B.isOralSubject('Anglais') === false);
check('EPS détectée (Éducation Physique et Sportive)', B.isEpsSubject('Éducation Physique et Sportive') === true);
check('EPS détectée (E.P.S.)', B.isEpsSubject('E.P.S.') === true);
check('Non EPS : Physique Chimie', B.isEpsSubject('Physique Chimie et Technologie') === false);

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n══ 5. RUNTIME — Session + intitulés officiels + helpers front ══');
check('examSessionLabel(mai 2027) → « Session de mai 2027 »',
  B.examSessionLabel({ startDate: new Date('2027-05-12T00:00:00Z') }) === 'Session de mai 2027');
check('examSessionLabel(null) + année → « Session 2026-2027 »',
  B.examSessionLabel({ startDate: null }, '2026-2027') === 'Session 2026-2027');
check('officialExamTitle(CEP) → CERTIFICAT D\'ÉTUDES PRIMAIRES (C.E.P.)',
  B.officialExamTitle('CEP').main === "CERTIFICAT D'ÉTUDES PRIMAIRES" && B.officialExamTitle('CEP').sub === '(C.E.P.)');
check('officialExamTitle(BEPC) → Brevet d\'Études du Premier Cycle (B.E.P.C)',
  B.officialExamTitle('BEPC').main === "Brevet d'Études du Premier Cycle" && B.officialExamTitle('BEPC').sub === '(B.E.P.C)');
check('officialExamTitle(BAC, D) → Baccalauréat Série D',
  B.officialExamTitle('BAC', 'D').sub === 'Série D');
check('officialExamTitle(CAP) → Certificat d\'Aptitude Professionnelle (C.A.P)',
  B.officialExamTitle('CAP').main === "Certificat d'Aptitude Professionnelle");

const F = evalFrontHelpers();
check('Front splitCepScore(19.5) → 18 + 1.5', F.splitCepScore(19.5).cm === 18 && F.splitCepScore(19.5).cp === 1.5);
check('Front withCepDetail : note héritée 15 → CM 15 + CP 0',
  F.withCepDetail({ score: 15, isAbsent: false }).cm === 15 && F.withCepDetail({ score: 15, isAbsent: false }).cp === 0);
check('Front withCepDetail : cm conservé s\'il existe',
  F.withCepDetail({ score: 11, isAbsent: false, cm: 10, cp: 1 }).cm === 10);
check('Front withCepDetail : absent → inchangé',
  F.withCepDetail({ score: 0, isAbsent: true }).cm === undefined || F.withCepDetail({ score: 0, isAbsent: true }).cm === null);
check('Front cepNote : CM 10 + CP 1 → 11', F.cepNote({ score: 11, isAbsent: false, cm: 10, cp: 1 }) === 11);
check('Front cepNote : sans détail → score brut', F.cepNote({ score: 14, isAbsent: false }) === 14);
check('Front cepNote : absent → score', F.cepNote({ score: 0, isAbsent: true }) === 0);

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n══ 6. BACKEND — Contrôles structurels (modèle CEP + relevés) ══');
const gradesSrc = read(path.join(ROOT, 'apps/api-server/src/federis/federis-grades.service.ts'));
const saisieSrc = read(path.join(ROOT, 'apps/api-server/src/federis/federis-saisie.service.ts'));
const pdfSrc = read(path.join(ROOT, 'apps/api-server/src/federis/federis-pdf.service.ts'));

// DTO + sauvegarde
check('GradeCellDto : champs cm (0..18) et cp (0..2)', /cm\?: number \| null/.test(gradesSrc) && /cp\?: number \| null/.test(gradesSrc));
check('SaisieGradeCellDto : champs cm et cp', /cm\?: number \| null/.test(saisieSrc) && /cp\?: number \| null/.test(saisieSrc));
check('bulkSaveGrades : CP forcé à 0 sous la minimale exigée', /if \(cm < minRequise\) cp = 0;/.test(gradesSrc));
check('bulkSaveGrades : note = CM + CP', /round2\(cm \+ cp\)/.test(gradesSrc));
check('bulkSaveGrades : scission automatique si seul score transmis', /splitCepScore\(isAbsent \? 0 : Number\(cell\.score\)/.test(gradesSrc));
check('bulkSaveGrades : metadata {cm, cp} persistée', /metadata: \{ cm: cepDetail\.cm, cp: cepDetail\.cp \}/.test(gradesSrc));
check('bulkSaveGrades : fusion metadata (décisions jury conservées)', /prevMeta.*cm, cp/.test(gradesSrc) || /\.\.\.prevMeta, cm, cp/.test(gradesSrc));
check('Saisie saveGrades : même logique CM/CP', /if \(cm < minRequise\) cp = 0;/.test(saisieSrc) && /splitCepScore/.test(saisieSrc));

// Dataset + payload
check('buildGradesDataset : metadata lue (raw SQL + repli Prisma)', gradesSrc.includes('"isAbsent", "status", "metadata"') && /metadata: true \}/.test(gradesSrc));
check('buildGradesDataset : passingScore + perfectionnement par matière', /passingScore: s\.passingScore \?\? null/.test(gradesSrc) && /perfectionnement: isCepPerfectionnementSubject/.test(gradesSrc));
check('buildGradesDataset : scission des notes héritées au chargement', /splitCepScore\(r\.score\)/.test(gradesSrc));
check('Dataset : exam.startDate + session transportés', /startDate: exam\.startDate/.test(gradesSrc) && /session: examSessionLabel/.test(gradesSrc));
check('Relevés : cepAdmission (jury CEP) dans le payload', /cepAdmission/.test(gradesSrc) && /computeCepAdmission\(/.test(gradesSrc));
check('Relevés : bilan (Total Français/Écrit/Final/Moyenne) dans le payload', /computeReleveBilan\(/.test(gradesSrc) && /bilan,/.test(gradesSrc));
check('Relevés : état civil complet (naissance, n° inscription, nature)', /dateOfBirth/.test(gradesSrc) && /placeOfBirth/.test(gradesSrc) && /registrationNumber/.test(gradesSrc) && /candidatureNature/.test(gradesSrc));
check('Relevés : officialTitle + session par relevé', /officialTitle: officialExamTitle/.test(gradesSrc) && /session: ds\.exam\.session/.test(gradesSrc));
check('Relevés : en-tête patronat (coordonnateur signataire)', /loadPatronatHeaderInfo/.test(gradesSrc) && /coordinatorName/.test(gradesSrc));
check('Relevés école : même payload officiel', /header = await this\.loadPatronatHeaderInfo\(exam\.tenantId\)/.test(gradesSrc));

// PDF officiel
check('PDF : section CEP officielle (MATIÈRE + CEP + perfectionnement)', /NOTE DE PERFECTION-/.test(pdfSrc) && /NOTE MINIMALE EXIGEE/.test(pdfSrc));
check('PDF : décision du jury CEP (2 lignes)', /CERTIFICAT D\\u2019ETUDES PRIMAIRES<\/td>/.test(pdfSrc) && /ENTREE EN SIXIEME/.test(pdfSrc));
check('PDF : bilan empilé (Total Français / Écrit / Final / Moyenne)', /Total Fran\\u00e7ais/.test(pdfSrc) && /Total \\u00c9crit/.test(pdfSrc) && /Total Final/.test(pdfSrc) && /Moyenne/.test(pdfSrc));
check('PDF : en-tête patronat à la place du bloc ministériel', /releveOrgBlock/.test(pdfSrc) && /COORDINATION DES EXAMENS ET CONCOURS/.test(pdfSrc));
check('PDF : signature « LE COORDONNATEUR DU PATRONAT »', /LE COORDONNATEUR DU PATRONAT/.test(pdfSrc));
check('PDF : notes au format officiel (00.00 / 01.25)', /fmtReleveNote/.test(pdfSrc));
check('PDF : relevé A4 PORTRAIT (landscape: false)', /renderPdf\(html, \{ landscape: false \}\)/.test(pdfSrc));
check('PDF : règle d\'admission CEP en bas de page', /Est d\\u00e9clar\\u00e9\(e\) admis\(e\) au CEP/.test(pdfSrc));
check('PDF : NB attestation provisoire (6 mois)', /valable pour six \(06\) mois/.test(pdfSrc));
check('PDF : NB BEPC (rature / surcharge)', /Toute rature ou surcharge/.test(pdfSrc));

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n══ 7. WEB — Contrôles structurels (grilles + aperçus) ══');
const sheetSrc = read(path.join(ROOT, 'apps/web-app/src/components/federis/FederisGradeSheetTab.tsx'));
const saisiePageSrc = read(path.join(ROOT, 'apps/web-app/src/components/federis/FederisGradeRelevesTab.tsx'.replace('FederisGradeRelevesTab', 'FederisSaisiePage')));
const relevesSrc = read(path.join(ROOT, 'apps/web-app/src/components/federis/FederisGradeRelevesTab.tsx'));

check('Grille patronat : 3 sous-colonnes CM/CP/Note (en-tête)', /CM<br \/>\/18/.test(sheetSrc) && /CP<br \/>\/2/.test(sheetSrc) && /Note<br \/>\/20/.test(sheetSrc));
check('Grille patronat : handleCm + handleCp avec porte du CP', /const handleCm/.test(sheetSrc) && /const handleCp/.test(sheetSrc) && /cm < minRequise/.test(sheetSrc));
check('Grille patronat : colSpan 3 par matière (CEP)', /colSpan=\{isPrimary \? 3 : 1\}/.test(sheetSrc));
check('Grille patronat : note /20 = CM + CP affichée', /cepNote\(cell\)/.test(sheetSrc));
check('Grille patronat : save transmet cm + cp', /cm: cell\.cm/.test(sheetSrc) && /cp: cell\.cp \?\? 0/.test(sheetSrc));
check('Grille patronat : scission au chargement (withCepDetail)', /withCepDetail/.test(sheetSrc));
check('Grille patronat : étoile sur les matières perfectionnement', /s\.perfectionnement \? ' \*' : ''/.test(sheetSrc));
check('Page secrétaire : 3 sous-colonnes CM/CP/Note', /CM \/18/.test(saisiePageSrc) && /CP \/2/.test(saisiePageSrc) && /Note \/20/.test(saisiePageSrc));
check('Page secrétaire : handleCm + handleCp + porte du CP', /const handleCm/.test(saisiePageSrc) && /const handleCp/.test(saisiePageSrc) && /cm < minRequise/.test(saisiePageSrc));
check('Page secrétaire : save transmet cm + cp', /cm: cell\.cm/.test(saisiePageSrc));
check('Aperçu CEP : tableau officiel (NOTE OBTENUE / MINIMALE EXIGÉE / PERFECTIONNEMENT)', /Note obtenue/i.test(relevesSrc) && /Note minimale exigée/i.test(relevesSrc) && /Note de perfection-/.test(relevesSrc));
check('Aperçu CEP : décision du jury (CEP + entrée en 6ème)', /CERTIFICAT D'ÉTUDES PRIMAIRES/.test(relevesSrc) && /ENTRÉE EN SIXIÈME/.test(relevesSrc));
check('Aperçu CEP : règles d\'admission officielles', /au moins \{adm\?\.matieresRequises/.test(relevesSrc));
check('Aperçu BEPC/BAC/CAP : colonnes COEF. / NOTE/20 / NOTE COEF. / BILAN', /Coef\./.test(relevesSrc) && /Note\/20/.test(relevesSrc) && /Note coef\./.test(relevesSrc) && /Bilan/.test(relevesSrc));
check('Aperçu : bloc patronat + signature coordonnateur', /OrgBlock/.test(relevesSrc) && /Le Coordonnateur du Patronat/.test(relevesSrc));
check('Aperçu : état civil officiel (naissance, n° inscription, nature)', /DATE ET LIEU DE NAISSANCE/.test(relevesSrc) && /NUMÉRO D'INSCRIPTION/.test(relevesSrc) && /NATURE DE LA CANDIDATURE/.test(relevesSrc));
check('Aperçu : notes au format officiel (zéro de tête)', /fmtOfficial/.test(relevesSrc));
check('Interfaces : patronat + cepAdmission + bilan dans RelevesData', /patronat: \{/.test(relevesSrc) && /cepAdmission: \{/.test(relevesSrc) && /bilan: \{/.test(relevesSrc));

// ═══════════════════════════════════════════════════════════════════════════
console.log('\n══ 8. CSS globals.css — équilibre des blocs (build Vercel) ══');
const css = read(path.join(ROOT, 'apps/web-app/src/app/globals.css'));
(function checkCss() {
  let depth = 0;
  let inBlockComment = false;
  let inString = null;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    const next = css[i + 1];
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++; }
      continue;
    }
    if (!inString && ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (inString) {
      if (ch === '\\') { i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inString = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth < 0) break;
  }
  check(`globals.css : tous les blocs fermés (profondeur finale ${depth})`, depth === 0 && !inBlockComment && !inString);
})();

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n══════════════════ RÉSULTAT : ${pass}/${pass + fail} ═══════════════════`);
if (fail > 0) process.exit(1);
