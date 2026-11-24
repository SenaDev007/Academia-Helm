/**
 * TEST — Catégorisation des matières dans les bulletins PDF (exigence
 * promoteur 2026-11-24) : d'abord les MATIÈRES LITTÉRAIRES, ensuite les
 * MATIÈRES SCIENTIFIQUES, puis les autres — plus AUCUN mélange.
 *
 * Charge le VRAI BulletinPdfService et vérifie, pour chaque gabarit, que
 * l'ordre des matières dans le HTML généré respecte LETTRES → SCIENCES →
 * AUTRES (les matières étant passées en DÉSORDRE au payload, comme dans la
 * capture promoteur : Expression Écrite rejetée en fin de tableau).
 *
 * Usage : cd apps/api-server && npx ts-node --transpile-only scripts/test-bulletin-categories.ts
 */
import { BulletinPdfService } from '../src/modules/exams/services/bulletin-pdf.service';

const svc: any = new BulletinPdfService({} as any, {} as any);
const QR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

let failures = 0;
function check(label: string, ok: boolean, detail: string): void {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

/** Position de chaque nom de matière dans le HTML (première occurrence). */
function positions(html: string, names: string[]): number[] {
  return names.map(n => html.indexOf(`>${n}<`));
}

/** Vérifie la SÉPARATION STRICTE des catégories : toutes les positions du
 *  groupe i précèdent celles du groupe i+1 (littéraires → scientifiques → autres). */
function isOrdered(pos: number[], groups: number[][]): boolean {
  const maxOf = (g: number[]) => Math.max(...g.map(i => pos[i]));
  const minOf = (g: number[]) => Math.min(...g.map(i => pos[i]));
  for (const g of groups) {
    if (g.some(i => pos[i] === -1)) return false;
  }
  for (let i = 1; i < groups.length; i++) {
    if (minOf(groups[i]) < maxOf(groups[i - 1])) return false;
  }
  return true;
}

/** Vérifie l'ordre EXACT attendu d'une liste de noms dans le HTML. */
function exactOrder(html: string, expected: string[]): boolean {
  const pos = positions(html, expected);
  if (pos.some(p => p === -1)) return false;
  for (let i = 1; i < pos.length; i++) {
    if (pos[i] < pos[i - 1]) return false;
  }
  return true;
}

const base: any = {
  schoolName: "CSP MON AVENIR PLUS N'DALI",
  academicYearName: '2026-2027',
  periodName: 'Trimestre 1',
  evaluationTypeName: "Évaluation mensuelle 1 – mois d'octobre 2026",
  className: 'CP-A',
  studentName: 'BALOGOUN Eunice',
  studentMatricule: 'MAP-26-0001',
  studentGender: 'FEMALE',
  classRank: 1,
  classAverage: 12.5,
  generalAverage: 15.4,
  highestAverage: 17.31,
  lowestAverage: 8.0,
  totalStudents: 9,
  appreciationGlobale: 'Excellent',
};

// ── Matières RÉELLES du bulletin CP-A Mon Avenir Plus (capture promoteur),
//    passées dans le DÉSORDRE exact observé dans le PDF fautif ──────────────
const CP_A_SUBJECTS = [
  'Éducation Sociale', 'Anglais', 'Éducation Scientifique et Technologique',
  'Mathématiques', 'Éducation Artistique (EA) Plastique', 'Éducation Artistique (EA) Vivant',
  'Droit', 'Éducation Physique et Sportive', 'Expression Écrite', 'Lecture', 'Dictée',
];
const CP_A_GROUPS = [
  [0, 1, 6, 8, 9, 10],  // LETTRES : Éducation Sociale, Anglais, Droit, Expression Écrite, Lecture, Dictée
  [2, 3],                // SCIENCES : EST, Mathématiques
  [4, 5, 7],             // AUTRES : EA Plastique, EA Vivant, EPS
];

const SEC_SUBJECTS = [
  'Mathématiques', 'Français', 'Éducation Physique et Sportive', 'Anglais',
  'Physique Chimie et Technologie', 'Histoire-Géographie', 'SVT',
  'Philosophie', 'Espagnol', 'Informatique', 'Allemand', 'Communication Écrite',
];
const SEC_GROUPS = [
  [1, 3, 5, 7, 8, 10, 11], // LETTRES
  [0, 4, 6],               // SCIENCES
  [2, 9],                  // AUTRES
];

const EN_SUBJECTS = [
  'Mathematics', 'English Language', 'Physical and Health Education (PHE)',
  'Basic Science', 'Social Studies', 'Computer Science', 'Christian Religious Knowledge (CRK)',
  'Quantitative Reasoning', 'Verbal Reasoning', 'Cultural and Creative Arts (CCA)',
  'Handwriting', 'Agricultural Science', 'Drawing',
];
const EN_GROUPS = [
  [1, 4, 6, 8, 10], // LETTRES
  [0, 3, 7, 11],    // SCIENCES
  [2, 5, 9, 12],    // AUTRES
];

// ── 1. FR PRIMAIRE (buildHtml) : tri + bandeaux ────────────────────────────
{
  const html: string = svc.buildHtml(
    { ...base, subjects: CP_A_SUBJECTS.map((n, i) => ({ name: n, score: 10 + i, cm: 9, cp: 1, isAbsent: false, appreciation: 'Bien' })) },
    QR, 'BULL-CAT');
  const pos = positions(html, CP_A_SUBJECTS);
  check('FR primaire : ordre LETTRES → SCIENCES → AUTRES', isOrdered(pos, CP_A_GROUPS));
  check('FR primaire : ordre EXACT attendu (capture promoteur corrigée)', exactOrder(html, [
    'Matières littéraires', 'Lecture', 'Expression Écrite', 'Dictée', 'Anglais', 'Éducation Sociale', 'Droit',
    'Matières scientifiques', 'Mathématiques', 'Éducation Scientifique et Technologique',
    'Autres matières', 'Éducation Physique et Sportive', 'Éducation Artistique (EA) Plastique', 'Éducation Artistique (EA) Vivant',
  ]));
  check('FR primaire : bandeau « Matières littéraires »', html.includes('Matières littéraires'));
  check('FR primaire : bandeau « Matières scientifiques »', html.includes('Matières scientifiques'));
  check('FR primaire : bandeau « Autres matières »', html.includes('Autres matières'));
  // Le bug exact de la capture : Expression Écrite APRÈS EPS → interdit
  check('FR primaire : Expression Écrite AVANT Éducation Physique (bug capture corrigé)',
    pos[8] !== -1 && pos[7] !== -1 && pos[8] < pos[7]);
  // Rang féminin + élision (rappel des correctifs précédents, non-régression)
  check('FR primaire : Rang : 1ère (fille)', html.includes('1ère'));
  check("FR primaire : élision « Bulletin d'Évaluation »", /Bulletin d['’]Évaluation/i.test(html) && !/Bulletin de Évaluation/i.test(html));
}

// ── 2. FR MATERNELLE (buildHtml) : tri par domaines, PAS de bandeau ────────
{
  const MAT_SUBJ = ['Langage', 'Observation', 'Comptine', 'Pré-mathématique', 'Expression plastique', 'Éducation du mouvement'];
  const html: string = svc.buildHtml(
    { ...base, isMaternelle: true, subjects: MAT_SUBJ.map((n, i) => ({ name: n, score: null, qualitativeCode: i % 3 === 0 ? 'TS' : 'S', isAbsent: false, appreciation: '—' })) },
    QR, 'BULL-CAT');
  check('FR maternelle : PAS de bandeaux (tri par domaines d\'apprentissage)', !html.includes('Matières littéraires'));
}

// ── 3. FR SECONDAIRE TRIMESTRIEL (buildHtmlSecondaire, modèle CEG) ─────────
{
  const html: string = svc.buildHtmlSecondaire(
    { ...base, isSecondary: true, subjects: SEC_SUBJECTS.map((n, i) => ({ name: n, score: 10 + i, isAbsent: false, appreciation: 'Assez Bien', secInt1: 12, secInt2: 11, secMoyInter: 11.5, secDs1: 13, secDs2: 14, secMoyenne: 12.83, secCoef: 2, secNoteCoef: 25.66, secRank: 1 + (i % 5), secHasSlot: true })) },
    QR, 'BULL-CAT');
  const pos = positions(html, SEC_SUBJECTS);
  check('FR secondaire CEG : ordre LETTRES → SCIENCES → AUTRES', isOrdered(pos, SEC_GROUPS));
  check('FR secondaire CEG : lignes « Bilan Lettres »', html.includes('Bilan Lettres'));
  check('FR secondaire CEG : lignes « Bilan Sciences »', html.includes('Bilan Sciences'));
}

// ── 4. FR SECONDAIRE ÉVALUATION (buildHtmlSecondaireEval) ──────────────────
{
  const html: string = svc.buildHtmlSecondaireEval(
    { ...base, isSecondaryEval: true, subjects: SEC_SUBJECTS.map((n, i) => ({ name: n, score: 10 + i, isAbsent: false, appreciation: 'Assez Bien', subjectPosition: 1 + (i % 5), teacherName: 'M. TEST' })) },
    QR, 'BULL-CAT');
  const pos = positions(html, SEC_SUBJECTS);
  check('FR secondaire éval : ordre LETTRES → SCIENCES → AUTRES', isOrdered(pos, SEC_GROUPS));
  check('FR secondaire éval : bandeau « Matières littéraires »', html.includes('Matières littéraires'));
  check('FR secondaire éval : bandeau « Matières scientifiques »', html.includes('Matières scientifiques'));
}

// ── 5. EN ANGLOPHONE (buildHtmlAnglophone) : tri sans bandeau ──────────────
{
  const html: string = svc.buildHtmlAnglophone(
    { ...base, scopeLang: 'EN', isSecondaryLevel: true, periodName: 'First Term', sessionYear: '2026-2027', studentAge: 14, subjects: EN_SUBJECTS.map((n, i) => ({ name: n, score: 60 + i * 3, isAbsent: false, appreciation: 'Good', firstCA: 15, secondCA: 14, exam: 45 + i, total: 74 + i, grade: 'B', remark: 'Good', highestInClass: 90, lowestInClass: 40, subjectPosition: 1 + (i % 4) })) },
    QR, 'BULL-CAT');
  const pos = positions(html, EN_SUBJECTS);
  check('EN Report Book : ordre LETTRES → SCIENCES → AUTRES', isOrdered(pos, EN_GROUPS));
}

// ── 6. VUE PAR MATIÈRE (buildHtmlVueParMatiere) : tri + bandeaux ───────────
{
  const html: string = svc.buildHtmlVueParMatiere(
    { ...base, isVueParMatiere: true, evaluationTypeName: 'Vue par matière', subjects: CP_A_SUBJECTS.map(n => ({ name: n, score: 12, isAbsent: false, appreciation: 'Bien', vueParMatiere: { em1: 12, em2: 13, moyEm: 12.5, ec: 14, moyenne: 13.25 } })) },
    QR, 'BULL-CAT');
  const pos = positions(html, CP_A_SUBJECTS);
  check('Vue par matière : ordre LETTRES → SCIENCES → AUTRES', isOrdered(pos, CP_A_GROUPS));
  check('Vue par matière : bandeau « Matières littéraires »', html.includes('Matières littéraires'));
  check('Vue par matière : bandeau « Matières scientifiques »', html.includes('Matières scientifiques'));
  check('Vue par matière : bandeau « Autres matières »', html.includes('Autres matières'));
}

console.log(`\n${failures === 0 ? '✅ CATÉGORISATION CORRECTE PARTOUT (littéraires → scientifiques → autres)' : `❌ ${failures} échec(s)`}`);
process.exit(failures === 0 ? 0 : 1);
