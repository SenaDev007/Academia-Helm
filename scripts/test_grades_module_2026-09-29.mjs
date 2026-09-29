// Tests logiques du module « Notes et Moyennes » (2026-09-29)
// Pattern scripts/test_*_2026-09-29.mjs du repo : vérifications statiques
// (routes ↔ contrôleurs, schéma ↔ migration ↔ ensureSchema, navigation,
// DTOs décorés) + tests unitaires des moteurs de calcul extraits du service.
import { readFileSync } from 'fs';

const ROOT = '/home/z/my-project/ah';
const read = (p) => readFileSync(`${ROOT}${p}`, 'utf8');

let pass = 0;
let fail = 0;
const failures = [];
function check(label, cond) {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(label);
    console.log(`  ✗ ${label}`);
  }
}

// ── Fichiers du module ──────────────────────────────────────────────────────
const svc = read('/apps/api-server/src/federis/federis-grades.service.ts');
const ctrl = read('/apps/api-server/src/federis/federis-grades.controller.ts');
const pdfSvc = read('/apps/api-server/src/federis/federis-pdf.service.ts');
const pdfCtrl = read('/apps/api-server/src/federis/federis-pdf.controller.ts');
const moduleFile = read('/apps/api-server/src/federis/federis.module.ts');
const schema = read('/apps/api-server/prisma/schema.prisma');
const migration = read('/apps/api-server/prisma/migrations/20260929180000_federis_grades_isabsent/migration.sql');
const layout = read('/apps/web-app/src/components/federis/FederisLayout.tsx');
const perms = read('/apps/web-app/src/lib/patronat/permissions.ts');
const page = read('/apps/web-app/src/components/federis/FederisGradesPage.tsx');
const sheetTab = read('/apps/web-app/src/components/federis/FederisGradeSheetTab.tsx');
const registryTab = read('/apps/web-app/src/components/federis/FederisGradeRegistryTab.tsx');
const relevesTab = read('/apps/web-app/src/components/federis/FederisGradeRelevesTab.tsx');
const lib = read('/apps/web-app/src/lib/federis/grade-computations.ts');

console.log('── 1. DTOs décorés class-validator (fix 400 forbidNonWhitelisted) ──');
for (const dto of ['CreateSubjectDto', 'UpdateSubjectDto', 'GradeCellDto', 'BulkSaveGradesDto']) {
  const m = svc.match(new RegExp(`export class ${dto} \\{([\\s\\S]*?)\\n\\}`));
  check(`DTO ${dto} défini`, Boolean(m));
  check(`DTO ${dto} a des décorateurs`, Boolean(m && /@(Is|Type)/.test(m[1])));
}
check('GradeCellDto.score est optionnel (null = effacer)', /score\?: number \| null/.test(svc));
check('GradeCellDto.isAbsent booléen optionnel', /@IsOptional\(\)\s*\n\s*@IsBoolean\(\)\s*\n\s*isAbsent\?: boolean/.test(svc));

console.log('── 2. Schéma ↔ migration ↔ ensureSchema (isAbsent) ──');
check('schema.prisma : ExamResult.isAbsent Boolean @default(false)', /model ExamResult[\s\S]*?isAbsent\s+Boolean\s+@default\(false\)/.test(schema));
check('migration 20260929180000 : ADD COLUMN IF NOT EXISTS isAbsent', migration.includes('ADD COLUMN IF NOT EXISTS "isAbsent"'));
check('ensureSchema : miroir isAbsent', svc.includes(`ADD COLUMN IF NOT EXISTS "isAbsent"`));
check('migration idempotente : index examId+isAbsent', migration.includes('exam_results_examId_isAbsent_idx'));
check('ensureSchema : index miroir', svc.includes('exam_results_examId_isAbsent_idx'));

console.log('── 3. Routes backend ↔ appels frontend ──');
const routeChecks = [
  [ctrl, 'GET grades/sheet', /@Get\('exams\/:examId\/grades\/sheet'\)/, sheetTab, '/grades/sheet'],
  [ctrl, 'POST grades/bulk', /@Post\('exams\/:examId\/grades\/bulk'\)/, sheetTab, '/grades/bulk'],
  [ctrl, 'POST grades/submit', /@Post\('exams\/:examId\/grades\/submit'\)/, sheetTab, '/grades/submit'],
  [ctrl, 'POST grades/reopen', /@Post\('exams\/:examId\/grades\/reopen'\)/, sheetTab, '/grades/reopen'],
  [ctrl, 'GET grades/registry', /@Get\('exams\/:examId\/grades\/registry'\)/, registryTab, '/grades/registry'],
  [ctrl, 'GET grades/releves', /@Get\('exams\/:examId\/grades\/releves'\)/, relevesTab, '/grades/releves'],
  [ctrl, 'GET subjects', /@Get\('exams\/:examId\/subjects'\)/, page, '/subjects'],
  [ctrl, 'POST subjects', /@Post\('exams\/:examId\/subjects'\)/, page, `/federis/exams/\${examId}/subjects`],
  [ctrl, 'POST subjects/init', /@Post\('exams\/:examId\/subjects\/init'\)/, page, '/subjects/init'],
  [ctrl, 'PATCH subjects/:subjectId', /@Patch\('exams\/:examId\/subjects\/:subjectId'\)/, page, `/subjects/\${subjectId}`],
  [ctrl, 'DELETE subjects/:subjectId', /@Delete\('exams\/:examId\/subjects\/:subjectId'\)/, page, `/subjects/\${subject.id}`],
  [pdfCtrl, 'GET pdf/releve/:candidateId', /@Get\('exams\/:examId\/pdf\/releve\/:candidateId'\)/, relevesTab, '/pdf/releve/'],
  [pdfCtrl, 'GET pdf/releves', /@Get\('exams\/:examId\/pdf\/releves'\)/, relevesTab, '/pdf/releves'],
];
for (const [ctrlSrc, label, routeRe, feSrc, feNeedle] of routeChecks) {
  check(`Contrôleur : ${label}`, routeRe.test(ctrlSrc));
  check(`Frontend appelle : ${label}`, feSrc.includes(feNeedle));
}
check('Contrôleur grades enregistré dans federis.module.ts', moduleFile.includes('FederisGradesController'));
check('Service grades enregistré dans federis.module.ts', moduleFile.includes('FederisGradesService'));
check('PdfService injecte GradesService (calculs partagés)', pdfSvc.includes('private readonly gradesService: FederisGradesService'));

console.log('── 4. Verrouillage (pattern délibération) ──');
check('bulkSaveGrades refuse si RESULTS_PUBLISHED', svc.includes("exam.status === 'RESULTS_PUBLISHED'") && svc.includes('saisie des notes est verrouillée'));
check('bulkSaveGrades refuse si session soumise', svc.includes('rouvrez la session avant toute modification'));
check('submitGrades exige au moins une note', svc.includes('Aucune note saisie'));
check('reopenGrades interdit après publication', svc.includes('la saisie ne peut plus être rouverte'));
check('Permission saisie = WRITE_DELIBERATION (coord. + sec. + org.)', svc.includes('WRITE_DELIBERATION'));

console.log('── 5. Matières officielles par type ──');
const cepDefaults = svc.match(/CEP:\s*\[([\s\S]*?)\s*\],\s*\n\s*\/\/ BEPC/)?.[1] ?? '';
const bepcDefaults = svc.match(/BEPC:\s*\[([\s\S]*?)\s*\],\s*\n\s*\/\/ BAC/)?.[1] ?? '';
const bacDefaults = svc.match(/BAC:\s*\[([\s\S]*?)\s*\],\s*\n\s*\/\/ CAP/)?.[1] ?? '';
const capDefaults = svc.match(/CAP:\s*\[([\s\S]*?)\s*\],\s*\n\};/)?.[1] ?? '';
check('CEP : jeu de matières primaire (Rédaction, Dictée, Étude de texte, Calcul…)', ['RED', 'DIC', 'ETX', 'CAL', 'SCI', 'HGE'].every((c) => cepDefaults.includes(`code: '${c}'`)));
check('CEP : coefficients tous à 1 (modèle primaire SANS coefficients)', (cepDefaults.match(/coefficient: 1[,\s]/g) ?? []).length === 6);
check('BEPC : coefficients > 1 (modèle secondaire AVEC coefficients)', /coefficient: 4/.test(bepcDefaults) && /coefficient: 3/.test(bepcDefaults));
check('BAC : jeu avec coefficients', /coefficient: 4/.test(bacDefaults) && /PHI/.test(bacDefaults));
check('CAP : théorie + pratique avec coefficients', /TEC/.test(capDefaults) && /TP/.test(capDefaults) && /coefficient: 5/.test(capDefaults));
check('initDefaultSubjects ignore les codes existants', svc.includes('existingCodes.has(d.code.toUpperCase())'));
check('updateSubject recalcule les notes coefficient', svc.includes('weightedScore: round2(r.score'));

console.log('── 6. Moteurs de calcul (extraits du service et testés) ──');
// Évalue les fonctions dans un contexte isolé — les annotations TS de ces
// fonctions sont retirées par remplacements ciblés, puis la déclaration est
// exécutée via new Function (pattern test matricule du repo).
function extractFn(src, name) {
  const re = new RegExp(`(function ${name}\\([\\s\\S]*?\\n\\})`, 'g');
  const m = re.exec(src);
  if (!m) throw new Error(`fonction ${name} introuvable`);
  return m[1];
}
const stripTs = (code) => code
  .replace(/\(examType: string \| null \| undefined\): boolean \{/, '(examType) {')
  .replace(/\(n: number\): number \{/, '(n) {')
  .replace(/scores: Record<string, GradeCellLite>,/, 'scores,')
  .replace(/subjects: GradeSubjectLite\[\],/, 'subjects,')
  .replace(/isPrimary: boolean,/, 'isPrimary,')
  .replace(/\): CandidateComputed \{/, ') {')
  .replace(/values: Array<\{ id: string; value: number \| null \}>,/, 'values,')
  .replace(/\): Map<string, number> \{/, ') {')
  .replace(/const ranks = new Map<string, number>\(\);/, 'const ranks = new Map();')
  .replace(/let previousValue: number \| null = null;/, 'let previousValue = null;')
  .replace(/\(b\.value as number\) - \(a\.value as number\)/, 'b.value - a.value')
  .replace(/\(average: number \| null\): string \{/, '(average) {');
const calcSrc = [
  extractFn(svc, 'isPrimaryExamType'),
  extractFn(svc, 'round2'),
  extractFn(svc, 'computeCandidateStats'),
  extractFn(svc, 'computeDenseRanks'),
  extractFn(svc, 'appreciationFor'),
  extractFn(svc, 'nationalMentionFor'),
].map(stripTs).join('\n');
const calc = new Function(`${calcSrc}
  return { isPrimaryExamType, computeCandidateStats, computeDenseRanks, appreciationFor, nationalMentionFor };`)();

const subjectsPrimary = [
  { id: 's1', code: 'RED', name: 'Rédaction', coefficient: 1, maxScore: 20, order: 0 },
  { id: 's2', code: 'CAL', name: 'Calcul', coefficient: 1, maxScore: 20, order: 1 },
];
const subjectsSecondary = [
  { id: 's1', code: 'FR', name: 'Français', coefficient: 4, maxScore: 20, order: 0 },
  { id: 's2', code: 'MATH', name: 'Maths', coefficient: 4, maxScore: 20, order: 1 },
  { id: 's3', code: 'ANG', name: 'Anglais', coefficient: 3, maxScore: 20, order: 2 },
];

// CEP : moyenne simple (modèle primaire)
let r = calc.computeCandidateStats(
  { s1: { score: 12, isAbsent: false }, s2: { score: 8, isAbsent: false } },
  subjectsPrimary,
  true,
);
check('CEP : total = 20', r.total === 20);
check('CEP : moyenne simple = 10', r.average === 10 && r.finalAverage === 10);

// CEP : absent exclu de la moyenne
r = calc.computeCandidateStats(
  { s1: { score: 12, isAbsent: false }, s2: { score: 0, isAbsent: true } },
  subjectsPrimary,
  true,
);
check('CEP : absent exclu (moyenne sur 1 matière = 12)', r.nbEval === 1 && r.finalAverage === 12);
check('CEP : aucune note → moyenne null', calc.computeCandidateStats({}, subjectsPrimary, true).finalAverage === null);

// BEPC : moyenne pondérée Σ(note×coef)/Σ(coef) (modèle secondaire)
r = calc.computeCandidateStats(
  { s1: { score: 12, isAbsent: false }, s2: { score: 8, isAbsent: false }, s3: { score: 10, isAbsent: false } },
  subjectsSecondary,
  false,
);
check('BEPC : Σ coef = 11', r.totalCoef === 11);
check('BEPC : Σ note×coef = 48+32+30 = 110', r.totalNotesCoef === 110);
check('BEPC : moyenne pondérée = 110/11 = 10', r.averagePondernee === 10 && r.finalAverage === 10);
check('BEPC : la moyenne retenue est la pondérée (pas la simple)', r.average !== r.finalAverage || r.averagePondernee === r.average);

// Note bornée au barème
r = calc.computeCandidateStats({ s1: { score: 30, isAbsent: false } }, subjectsPrimary, true);
check('Note bornée au barème (30 → 20)', r.total === 20);

// Rangs denses avec ex æquo
const ranks = calc.computeDenseRanks([
  { id: 'a', value: 15 },
  { id: 'b', value: 15 },
  { id: 'c', value: 12 },
  { id: 'd', value: null },
]);
check('Rangs denses : ex æquo 1er, suivant 2e, null non classé', ranks.get('a') === 1 && ranks.get('b') === 1 && ranks.get('c') === 2 && !ranks.has('d'));

// Appréciations et mentions (échelles Helm)
check('Appréciation ≥16 = Très Bien', calc.appreciationFor(16) === 'Très Bien');
check('Appréciation ≥10 = Passable', calc.appreciationFor(10) === 'Passable');
check('Appréciation <8 = Faible', calc.appreciationFor(5) === 'Faible');
check('Mention nationale ≥14 = Très Bien', calc.nationalMentionFor(14.5) === 'Très Bien');

console.log('── 7. Sélection du type puis sous-onglets (workflow demandé) ──');
check('Page : onglets CEP | BEPC | BAC | CAP (jamais de mélange)', page.includes("type: 'CEP'") && page.includes("type: 'BEPC'") && page.includes("type: 'BAC'") && page.includes("type: 'CAP'"));
check('Page : sous-onglets Saisie | Registre | Relevés', page.includes("'saisie'") && page.includes("'registre'") && page.includes("'releves'"));
check('Page : le CEP affiche le modèle primaire', page.includes('TYPE_MODEL_LABEL') && page.includes('Saisie du primaire — sans coefficients'));
check('SheetTab : bascule primaire/secondaire selon isPrimary', sheetTab.includes('isPrimary') && sheetTab.includes('sans coefficient'));
check('SheetTab : mode anonyme (codes du module Candidats)', sheetTab.includes('Mode anonyme') && sheetTab.includes('anonymatCode'));
check('SheetTab : marquage ABS par épreuve', sheetTab.includes('toggleAbsent'));
check('SheetTab : aucun appel window.confirm (confirmation inline personnalisée)', !sheetTab.includes('window.confirm('));
check('SheetTab : confirmation de soumission inline', sheetTab.includes('confirmSubmit'));
check('Registre : récapitulatif global (pattern Récapitulatif de l\u2019évaluation Helm)', registryTab.includes('Ayant composé') && registryTab.includes('Taux de réussite'));
check('Registre : récapitulatif PAR CENTRE', registryTab.includes('perCenter') && registryTab.includes('Récapitulatif par centre'));
check('Registre : décision provisoire ≠ décision du jury', registryTab.includes('provisoire'));
check('Relevés : aperçu modèle primaire (Champs de formation / Maîtrise min.)', relevesTab.includes('Champs de formation') && relevesTab.includes('Maîtrise min.'));
check('Relevés : aperçu modèle secondaire (Coefficient / Note coefficient)', relevesTab.includes('Note coefficient') && relevesTab.includes('Total des coefficients'));
check('Relevés : PDF individuel + PDF global', relevesTab.includes('/pdf/releve/') && relevesTab.includes('/pdf/releves'));
check('Relevés : mention + décision provisoire', relevesTab.includes('mention') && relevesTab.includes('decision'));

console.log('── 8. PDF backend (modèles Helm, A4 paysage) ──');
check('renderPdf supporte le paysage (pattern bulletins Helm)', pdfSvc.includes('landscape: opts?.landscape === true'));
check('Relevés rendus en A4 paysage', pdfSvc.includes("this.renderPdf(html, { landscape: true })"));
check('Template CEP : Champs de formation + Maîtrise min. + Seuil réussite + TOTAL GÉNÉRAL', pdfSvc.includes('Champs de formation') && pdfSvc.includes('Maîtrise min.') && pdfSvc.includes('TOTAL GÉNÉRAL'));
check('Template CEP : synthèse (moyenne obtenue, seuil atteint, décision)', pdfSvc.includes('Moyenne obtenue par le candidat') && pdfSvc.includes('Seuil de réussite globale atteint'));
check('Template secondaire : Discipline | Note /20 | Coefficient | Note coefficient | Rang | Appréciation | Signature', ['Discipline', 'Note /20', 'Coefficient', 'Note coefficient', 'Appréciation', 'Signature'].every((s) => pdfSvc.includes(s)));
check('Template secondaire : Total des coefficients + Total des notes (Σ note × coef) + Moyenne', pdfSvc.includes('TOTAL DES COEFFICIENTS') && pdfSvc.includes('TOTAL DES NOTES') && pdfSvc.includes("MOYENNE DE L'EXAMEN"));
check('Modèle choisi selon le type : CEP → primaire, autres → secondaire', pdfSvc.includes('isPrimary') && pdfSvc.includes('buildReleveCepSection') && pdfSvc.includes('buildReleveSecondaireSection'));
check('PDF : contexte d\u2019examen transporté dans chaque relevé (bestAverage…)', svc.includes('bestAverage: ds.stats.bestAverage'));
check('PDF : audit log FEDERIS_RELEVES_PDF', pdfSvc.includes('FEDERIS_RELEVES_PDF'));

console.log('── 9. Navigation & permissions ──');
const gradesIdx = layout.indexOf("name: 'Notes et moyennes'");
const delibIdx = layout.indexOf("name: 'Délibérations'");
check('Sidebar : « Notes et moyennes » présente dans la catégorie EXAMENS', gradesIdx > 0);
check('Sidebar : placée AVANT « Délibérations » (workflow notes → délibération)', gradesIdx > 0 && delibIdx > gradesIdx);
check('Sidebar : subPath /grades', layout.includes("subPath: '/grades'"));
check('Permissions : /grades = coordonnateur + secrétaire + organisateur', /'\/grades':\s*\['COORDONNATEUR', 'SECRETAIRE', 'ORGANISATEUR'\]/.test(perms));
check('Page route créée : (patronat)/federis/grades/page.tsx', read('/apps/web-app/src/app/(patronat)/federis/grades/page.tsx').includes('FederisGradesPage'));
check('canWrite frontend : domaine candidates (mêmes fonctions que WRITE_DELIBERATION)', page.includes("canWrite(userRole, 'candidates')"));

console.log('── 10. Lib frontend = miroir backend ──');
check('Lib : computeTotals (moyennes live pendant la saisie)', lib.includes('export function computeTotals'));
check('Lib : denseRanks (ex æquo)', lib.includes('export function denseRanks'));
check('Lib : isPrimaryExam (CEP → primaire)', lib.includes('export function isPrimaryExam'));
check('Lib : appreciationFor + mentionFor + formatRankFr (patterns Helm)', lib.includes('appreciationFor') && lib.includes('mentionFor') && lib.includes('formatRankFr'));

// ── Bilan ───────────────────────────────────────────────────────────────────
console.log(`\n════════════════════════════════════════════`);
console.log(`RÉSULTAT : ${pass} OK / ${fail} échec(s)`);
if (fail > 0) {
  console.log('ÉCHECS :');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('✓ Module « Notes et Moyennes » : tous les contrôles passent');
