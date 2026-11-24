/**
 * TEST — Rendu genre (1er/1ère) + élision (d'évaluation) dans les PDF bulletins.
 * Charge le VRAI BulletinPdfService et appelle les 4 gabarits FR avec une
 * fille classée 1ère (studentGender: 'FEMALE', classRank: 1).
 *
 * Usage : cd apps/api-server && npx ts-node --transpile-only scripts/test-bulletin-gender.ts
 */
import { BulletinPdfService } from '../src/modules/exams/services/bulletin-pdf.service';

const svc: any = new BulletinPdfService({} as any, {} as any);

const base: any = {
  schoolName: 'MON AVENIR PLUS',
  academicYearName: '2026-2027',
  periodName: 'Trimestre 1',
  evaluationTypeName: 'Évaluation mensuelle 1 – mois d\'octobre 2026',
  evaluationTypeCode: 'EM1',
  className: 'CM1 A',
  studentName: 'AKPLO Annie',
  studentMatricule: 'E-26-0001',
  studentGender: 'FEMALE',
  isMaternelle: false,
  classRank: 1,
  classAverage: 12.5,
  generalAverage: 15.25,
  totalStudents: 30,
  subjects: [
    { name: 'Français', score: 15, isAbsent: false, appreciation: 'Bien', subjectPosition: 1 },
    { name: 'Mathématiques', score: 16, isAbsent: false, appreciation: 'Très Bien', subjectPosition: 2 },
  ],
};

const cases: Array<[string, () => string]> = [
  ['buildHtml (primaire bulletin d\'évaluation)', () => svc.buildHtml({ ...base }, 'data:image/png;base64,x', 'BULL-T1')],
  ['buildHtmlSecondaire (secondaire trimestriel)', () => svc.buildHtmlSecondaire({ ...base, isSecondary: true, secRecap: { period1Average: 14, period2Average: 15, annualAverage: 14.5, annualRank: 1 } }, 'x', 'BULL-T2')],
  ['buildHtmlSecondaireEval (secondaire évaluation)', () => svc.buildHtmlSecondaireEval({ ...base, isSecondaryEval: true }, 'x', 'BULL-T3')],
  ['buildHtmlVueParMatiere (trimestriel/annuel)', () => svc.buildHtmlVueParMatiere({ ...base, isVueParMatiere: true, subjects: base.subjects.map(s => ({ ...s, vueParMatiere: { em1: 14, em2: 15, moyEm: 14.5, ec: 16, moyenne: 15.25 } })) }, 'x', 'BULL-T4')],
];

let failures = 0;
for (const [label, fn] of cases) {
  const html = fn();
  const has1ere = /1ère/.test(html);
  const has1er = /1er(?!e)/.test(html);
  const elisionOk = !/Bulletin de [ÉE]/.test(html);
  console.log(`\n=== ${label}`);
  console.log(`  contient "1ère"          : ${has1ere ? 'OUI ✓' : 'NON ✗'}`);
  console.log(`  contient "1er" (masculin): ${has1er ? 'OUI (résidu ?)' : 'NON ✓'}`);
  console.log(`  élision "Bulletin de É"  : ${elisionOk ? 'absente ✓' : 'PRÉSENTE ✗'}`);
  // extraits
  const titleMatch = html.match(/class="bulletin-title"[^>]*>([^<]*)/);
  if (titleMatch) console.log(`  titre: ${titleMatch[1].trim()}`);
  const rangLines = html.match(/Rang[^<]*<[^>]*>[^<]*1[èe]r?e?/g) || [];
  rangLines.slice(0, 3).forEach(l => console.log(`  ligne rang: ${l.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}`));
  if (!has1ere || !elisionOk) failures++;
}
console.log(`\n${failures === 0 ? '✅ TOUS OK' : `❌ ${failures} gabarit(s) en échec`}`);
process.exit(failures === 0 ? 0 : 1);
