/**
 * TEST — Page unique A4 pour TOUS les bulletins PDF.
 * Charge le VRAI BulletinPdfService, rend chaque gabarit avec Chromium local
 * (playwright chromium en executablePath), aux MÊMES options page.pdf que le
 * service (A4 portrait, marges 8/10mm, footerTemplate), puis compte les pages.
 *
 * Usage : cd apps/api-server && npx ts-node --transpile-only scripts/test-bulletin-a4-une-page.ts
 */
import * as puppeteer from 'puppeteer';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { BulletinPdfService } from '../src/modules/exams/services/bulletin-pdf.service';

const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome`;
const OUT = '/tmp/a4test';
fs.mkdirSync(OUT, { recursive: true });

const svc: any = new BulletinPdfService({} as any, {} as any);

const QR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// ── Payloads réalistes (pires cas : beaucoup de matières, textes longs) ──
const base: any = {
  schoolName: 'CSP MON AVENIR PLUS',
  schoolSlogan: 'Discipline - Travail - Réussite',
  schoolAddress: 'Bèyarou, Parakou, Borgou, BJ',
  schoolPhone: '+2290144000001',
  schoolEmail: 'contact@monavenirplus.bj',
  academicYearName: '2026-2027',
  periodName: 'Trimestre 1',
  evaluationTypeName: "Évaluation mensuelle 1 – mois d'octobre 2026",
  evaluationTypeCode: 'EM1',
  className: 'CM1 A',
  studentName: 'AKPLO Annie',
  studentMatricule: 'E-26-0001',
  studentGender: 'FEMALE',
  teacherName: 'M. KOUASSI Jean',
  isMaternelle: false,
  classRank: 1,
  classAverage: 12.5,
  generalAverage: 15.25,
  highestAverage: 16.5,
  lowestAverage: 8.0,
  totalStudents: 30,
  appreciationGlobale: 'Bien',
  assiduite: 'Bonne assiduité, aucune absence non justifiée sur la période.',
  discipline: 'Exemplaire',
  defautsMajeurs: 'Parfois distraite en fin de journée, quelques bavardages en Éducation Physique.',
  qualitesRemarquables: 'Élève brillante, sérieuse et travailleuse. Excellentes performances scolaires.',
  analyseRecommandations: null, // pire cas : lignes pointillées
  directorVisa: 'Visé le 24/11/2026',
};

const PRIM_SUBJECTS = ['Lecture', 'Français', 'Éducation Sociale', 'Mathématiques',
  'Éducation Scientifique et Technologique', 'Éducation Physique et Sportive', 'Dictée',
  'Éducation Artistique (EA) Plastique', 'Éducation Artistique (EA) Vivant', 'Expression Écrite']
  .map((n, i) => ({
    name: n, score: 10 + i, cm: 9, cp: 1, isAbsent: false,
    appreciation: i % 3 === 0 ? 'Très Bien' : i % 3 === 1 ? 'Bien' : 'Insuffisant',
  }));

const MAT_SUBJECTS = ['Lecture', 'Français', 'Mathématiques', 'Éducation Sociale',
  'Éducation Physique et Sportive', 'Éducation Artistique', 'Expression Écrite']
  .map((n, i) => ({
    name: n, score: null, qualitativeCode: i % 3 === 0 ? 'TS' : i % 3 === 1 ? 'S' : 'PS',
    isAbsent: false, appreciation: '—',
  }));

const SEC_SUBJECTS = ['Français', 'Mathématiques', 'Anglais', 'Sciences Physiques',
  'Sciences de la Vie et de la Terre', 'Histoire-Géographie', 'Éducation Civique et Morale',
  'Espagnol', 'Philosophie', 'Informatique', 'Éducation Physique et Sportive', 'Conduite']
  .map((n, i) => ({
    name: n, score: 10 + i, isAbsent: false, appreciation: 'Assez Bien',
    secInt1: 12, secInt2: 11, secMoyInter: 11.5, secDs1: 13, secDs2: 14,
    secMoyenne: 12.83, secCoef: 2 + (i % 3), secNoteCoef: (2 + (i % 3)) * 12.83,
    secRank: 1 + (i % 5), secHasSlot: true,
  }));

const EN_SUBJECTS = ['English Language', 'Mathematics', 'Integrated Science', 'Social Studies',
  'Religious and Moral Education', 'Creative Arts', 'Physical Education', 'Computing',
  'French', 'Career Technology']
  .map((n, i) => ({
    name: n, score: 60 + i * 3, isAbsent: false, appreciation: 'Good',
    firstCA: 15, secondCA: 14, exam: 45 + i, total: 74 + i,
    grade: 'B', remark: 'Good',
    highestInClass: 90, lowestInClass: 40, subjectPosition: 1 + (i % 4),
  }));

const cases: Array<{ label: string; payload: any }> = [
  {
    label: 'FR maternelle (bulletin d\'évaluation)',
    payload: { ...base, isMaternelle: true, subjects: MAT_SUBJECTS },
  },
  {
    label: 'FR primaire (bulletin d\'évaluation — 10 matières)',
    payload: { ...base, subjects: PRIM_SUBJECTS },
  },
  {
    label: 'FR secondaire TRIMESTRIEL (modèle CEG — 12 matières)',
    payload: {
      ...base, isSecondary: true, subjects: SEC_SUBJECTS,
      secTotalCoef: 33, secTotalNotesCoef: 420,
      secRecap: { period1Average: 13.2, period2Average: 13.9, annualAverage: 13.55, annualRank: 3 },
    },
  },
  {
    label: 'FR secondaire ÉVALUATION (12 matières)',
    payload: { ...base, isSecondaryEval: true, subjects: SEC_SUBJECTS.map(s => ({ ...s, subjectPosition: s.secRank })) },
  },
  {
    label: 'EN Report Book SECONDARY (10 subjects, conduct + grids)',
    payload: {
      ...base, scopeLang: 'EN', isSecondaryLevel: true, periodName: 'First Term',
      studentAge: 14, sessionYear: '2026-2027', termEndingDate: 'Friday, December 18, 2026',
      nextTermStartDate: 'Monday, January 5, 2027', numberOfSubjects: 10,
      conductScore: 17, conductReference: 18, sanctionCount: 0,
      enTeacherComment: 'Annie is a hardworking pupil.\nKeep it up next term.\nExcellent participation in class.',
      enDirectorComment: 'Promoted. Congratulations to Annie and her parents for these excellent results — keep up the good work.',
      enAffectiveAssessment: JSON.stringify({ 'Punctuality': 'A', 'Politeness': 'B', 'Att. School': 'A', 'Writ. Express.': 'C', 'Oral Express.': 'B', 'Health Info': 'A' }),
      enPsychomotorAssessment: JSON.stringify({ 'Handwriting': 'B', 'Games': 'A', 'Musical Skills': 'B', 'Handling of tool': 'C', 'Drawing & Painting': 'B' }),
      subjects: EN_SUBJECTS,
    },
  },
  {
    label: 'Vue par matière TRIMESTRIEL (12 matières)',
    payload: {
      ...base, isVueParMatiere: true, evaluationTypeName: 'Vue par matière',
      subjects: SEC_SUBJECTS.map(s => ({
        name: s.name, score: 12, isAbsent: false, appreciation: 'Bien',
        vueParMatiere: { em1: 12, em2: 13, moyEm: 12.5, ec: 14, moyenne: 13.25 },
      })),
    },
  },
  {
    label: 'Vue par matière ANNUEL (12 matières)',
    payload: {
      ...base, isVueParMatiere: true, evaluationTypeName: 'Moyenne annuelle', periodName: 'Moyenne annuelle',
      subjects: SEC_SUBJECTS.map(s => ({
        name: s.name, score: 13, isAbsent: false, appreciation: 'Bien',
        vueParMatiere: { em1: 12.5, em2: null, moyEm: null, ec: 14.2, moyenne: 13.35 },
      })),
    },
  },
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });
  let failures = 0;

  for (const { label, payload } of cases) {
    // Générer le HTML via le VRAI service (même branche que generateBulletin)
    const html: string = payload.isVueParMatiere
      ? svc.buildHtmlVueParMatiere(payload, QR, 'BULL-T')
      : (payload.scopeLang === 'EN'
        ? svc.buildHtmlAnglophone(payload, QR, 'BULL-T')
        : (payload.isSecondaryEval
          ? svc.buildHtmlSecondaireEval(payload, QR, 'BULL-T')
          : (payload.isSecondary
            ? svc.buildHtmlSecondaire(payload, QR, 'BULL-T')
            : svc.buildHtml(payload, QR, 'BULL-T'))));

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 150));
    // MÊMES options que le service (A4 portrait)
    const buf = await page.pdf({
      format: 'A4',
      landscape: false,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="width:100%;padding:0 8mm 2px;display:flex;justify-content:space-between;align-items:flex-end;"><span style="font-size:6.5px;color:#94a3b8;">test</span><span style="font-size:6.5px;color:#94a3b8;">Page <span class="pageNumber"></span>/<span class="totalPages"></span></span></div>',
      margin: { top: '8mm', bottom: '10mm', left: '8mm', right: '8mm' },
      timeout: 60000,
      preferCSSPageSize: false,
    });
    await page.close();

    const file = `${OUT}/${label.replace(/[^a-z0-9]+/gi, '_')}.pdf`;
    fs.writeFileSync(file, buf);
    const info = execSync(`pdfinfo "${file}"`).toString();
    const size = info.match(/Page size:\s+(.+)/)?.[1]?.trim();
    const pages = Number(info.match(/Pages:\s+(\d+)/)?.[1]);
    const ok = pages === 1 && /595/.test(size || '');
    console.log(`${ok ? '✓' : '✗'} ${label} — ${pages} page(s) — ${size}`);
    if (!ok) failures++;
  }

  await browser.close();
  console.log(`\n${failures === 0 ? '✅ TOUS LES GABARITS SUR UNE PAGE A4' : `❌ ${failures} gabarit(s) sur plus d'une page`}`);
  process.exit(failures === 0 ? 0 : 1);
})();
