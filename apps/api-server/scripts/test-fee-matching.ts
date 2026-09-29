/**
 * TEST — logique pure du fix « configuration des frais » (sept. 2026).
 *
 * Valide SANS base de données :
 *   1. selectApplicableStructures : le matching honore désormais
 *      academicClassId avec priorité Classe physique > Classe officielle >
 *      Niveau > Global (avant : academicClassId ignoré → un seul frais
 *      arbitraire appliqué à tout le niveau).
 *   2. buildAccountRecalcPlan : plans de recalcul corrects (recréation des
 *      breakdowns, resynchro des orphelins payés, totaux).
 *
 * Les données de test répliquent EXACTEMENT les 17 structures de
 * La Gaité 2026-2027 (relevées en production) et les effectifs par classe.
 *
 * Run : npx ts-node scripts/test-fee-matching.ts
 */
import { StudentAccountService } from '../src/finance/student-account.service';
import { selectApplicableStructures } from '../src/finance/student-account.service';

// ─── Données répliquées de La Gaité 2026-2027 (production) ──────────────────
const LEVEL_PRIMAIRE = 'lvl-primaire';
const LEVEL_SECONDAIRE = 'lvl-secondaire';
const LEVEL_MATERNELLE = 'lvl-maternelle';

const AC: Record<string, string> = {
  CI: 'ac-ci', CP: 'ac-cp', CE1: 'ac-ce1', CE2: 'ac-ce2',
  CM1: 'ac-cm1', CM2: 'ac-cm2', '6ème': 'ac-6e', '5ème': 'ac-5e',
  '4ème': 'ac-4e', '3ème': 'ac-3e', '2nde D': 'ac-2nded',
};

/** Les 17 structures réelles (nom, type, niveau, classe officielle, montant). */
const structures: any[] = [
  { id: 'fs-insc-p', name: "Frais d'inscription — Primaire", feeType: 'INSCRIPTION', levelId: LEVEL_PRIMAIRE, classId: null, academicClassId: null, totalAmount: 3000, isMandatory: true },
  { id: 'fs-insc-s', name: "Frais d'inscription — Secondaire", feeType: 'INSCRIPTION', levelId: LEVEL_SECONDAIRE, classId: null, academicClassId: null, totalAmount: 3500, isMandatory: true },
  { id: 'fs-insc-m', name: "Frais d'inscription — Maternelle", feeType: 'INSCRIPTION', levelId: LEVEL_MATERNELLE, classId: null, academicClassId: null, totalAmount: 3000, isMandatory: true },
  { id: 'fs-reinsc-s', name: 'Frais de réinscription — Secondaire', feeType: 'REINSCRIPTION', levelId: LEVEL_SECONDAIRE, classId: null, academicClassId: null, totalAmount: 3000, isMandatory: true },
  { id: 'fs-reinsc-m', name: 'Frais de réinscription — Maternelle', feeType: 'REINSCRIPTION', levelId: LEVEL_MATERNELLE, classId: null, academicClassId: null, totalAmount: 2000, isMandatory: true },
  { id: 'fs-reinsc-p', name: 'Frais de réinscription — Primaire', feeType: 'REINSCRIPTION', levelId: LEVEL_PRIMAIRE, classId: null, academicClassId: null, totalAmount: 2000, isMandatory: true },
  { id: 'fs-t-3e', name: 'Frais de scolarité — 3ème', feeType: 'TUITION', levelId: LEVEL_SECONDAIRE, classId: null, academicClassId: AC['3ème'], totalAmount: 95000, isMandatory: true },
  { id: 'fs-t-4e', name: 'Frais de scolarité — 4ème', feeType: 'TUITION', levelId: LEVEL_SECONDAIRE, classId: null, academicClassId: AC['4ème'], totalAmount: 80000, isMandatory: true },
  { id: 'fs-t-5e', name: 'Frais de scolarité', feeType: 'TUITION', levelId: LEVEL_SECONDAIRE, classId: null, academicClassId: AC['5ème'], totalAmount: 80000, isMandatory: true },
  { id: 'fs-t-6e', name: 'Frais de scolarité', feeType: 'TUITION', levelId: LEVEL_SECONDAIRE, classId: null, academicClassId: AC['6ème'], totalAmount: 80000, isMandatory: true },
  { id: 'fs-t-ce1', name: 'Frais de scolarité', feeType: 'TUITION', levelId: LEVEL_PRIMAIRE, classId: null, academicClassId: AC.CE1, totalAmount: 50000, isMandatory: true },
  { id: 'fs-t-ce2', name: 'Frais de scolarité', feeType: 'TUITION', levelId: LEVEL_PRIMAIRE, classId: null, academicClassId: AC.CE2, totalAmount: 50000, isMandatory: true },
  { id: 'fs-t-ci', name: 'Frais de scolarité', feeType: 'TUITION', levelId: LEVEL_PRIMAIRE, classId: null, academicClassId: AC.CI, totalAmount: 47000, isMandatory: true },
  { id: 'fs-t-cm1', name: 'Frais de scolarité', feeType: 'TUITION', levelId: LEVEL_PRIMAIRE, classId: null, academicClassId: AC.CM1, totalAmount: 50000, isMandatory: true },
  { id: 'fs-t-cm2', name: 'Frais de scolarité', feeType: 'TUITION', levelId: LEVEL_PRIMAIRE, classId: null, academicClassId: AC.CM2, totalAmount: 50000, isMandatory: true },
  { id: 'fs-t-cp', name: 'Frais de scolarité', feeType: 'TUITION', levelId: LEVEL_PRIMAIRE, classId: null, academicClassId: AC.CP, totalAmount: 47000, isMandatory: true },
  { id: 'fs-t-mat', name: 'Frais de scolarité — Maternelle', feeType: 'TUITION', levelId: LEVEL_MATERNELLE, classId: null, academicClassId: null, totalAmount: 45000, isMandatory: true },
];

let failures = 0;
function check(label: string, actual: any, expected: any) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${label}`);
  if (!ok) console.log(`   attendu: ${JSON.stringify(expected)}\n   obtenu : ${JSON.stringify(actual)}`);
}

// ─── 1) Matching par classe officielle ──────────────────────────────────────
console.log('─── selectApplicableStructures ───');

// Élève de 3ème (nouveau) : doit recevoir le frais 3ème (95 000) et PLUS le 4ème
const s3e = selectApplicableStructures(structures, {
  classId: null, academicClassId: AC['3ème'], levelId: LEVEL_SECONDAIRE,
});
check(
  'Élève 3ème → frais TUITION = « — 3ème » (95 000), pas le 4ème',
  s3e.filter((fs) => fs.feeType === 'TUITION').map((fs) => fs.id),
  ['fs-t-3e'],
);

// Élève de CI : frais TUITION = CI 47 000 (et PAS le CE1 50 000)
const sCI = selectApplicableStructures(structures, {
  classId: null, academicClassId: AC.CI, levelId: LEVEL_PRIMAIRE,
});
check('Élève CI → frais TUITION = CI (47 000)', sCI.filter((fs) => fs.feeType === 'TUITION').map((fs) => fs.id), ['fs-t-ci']);

// Élève de 2nde D : AUCUN frais TUITION (aucun frais configuré pour 2nde D)
const s2nde = selectApplicableStructures(structures, {
  classId: null, academicClassId: AC['2nde D'], levelId: LEVEL_SECONDAIRE,
});
check('Élève 2nde D → aucun frais TUITION', s2nde.filter((fs) => fs.feeType === 'TUITION').map((fs) => fs.id), []);

// Élève de CM2 (ancien, REPEAT) : INSCRIPTION exclu, REINSCRIPTION inclus
const sCM2 = selectApplicableStructures(structures, {
  classId: null, academicClassId: AC.CM2, levelId: LEVEL_PRIMAIRE,
});
check(
  'Élève CM2 → INSCRIPTION + REINSCRIPTION + TUITION CM2',
  sCM2.map((fs) => fs.feeType),
  ['INSCRIPTION', 'REINSCRIPTION', 'TUITION'],
);
check('Élève CM2 → TUITION = CM2 (50 000)', sCM2.filter((fs) => fs.feeType === 'TUITION').map((fs) => fs.id), ['fs-t-cm2']);

// ─── Priorité classe physique > classe officielle > niveau > global ─────────
const mixed: any[] = [
  ...structures,
  // Frais global de même type qu'un frais de niveau (test priorité) :
  { id: 'fs-global-t', name: 'Scolarité globale', feeType: 'TUITION', levelId: null, classId: null, academicClassId: null, totalAmount: 40000, isMandatory: true },
  // Frais niveau (écrase le global) :
  { id: 'fs-niveau-t', name: 'Scolarité niveau', feeType: 'TUITION', levelId: LEVEL_PRIMAIRE, classId: null, academicClassId: null, totalAmount: 42000, isMandatory: true },
  // Frais classe PHYSIQUE (écrase la classe officielle) :
  { id: 'fs-phys-t', name: 'Scolarité CE1-A', feeType: 'TUITION', levelId: LEVEL_PRIMAIRE, classId: 'classe-phys-ce1-a', academicClassId: null, totalAmount: 52000, isMandatory: true },
];
// Élève dans la classe physique CE1-A ET classe officielle CE1 :
const sPhys = selectApplicableStructures(mixed, {
  classId: 'classe-phys-ce1-a', academicClassId: AC.CE1, levelId: LEVEL_PRIMAIRE,
});
check('Priorité classe PHYSIQUE (52 000) > officielle > niveau > global', sPhys.filter((fs) => fs.feeType === 'TUITION').map((fs) => fs.id), ['fs-phys-t']);

// Élève de CE1-B (pas de classe physique) : frais officiel CE1 gagne sur niveau/global
const sOff = selectApplicableStructures(mixed, {
  classId: null, academicClassId: AC.CE1, levelId: LEVEL_PRIMAIRE,
});
check('Priorité classe OFFICIELLE (50 000) > niveau (42 000) > global (40 000)', sOff.filter((fs) => fs.feeType === 'TUITION').map((fs) => fs.id), ['fs-t-ce1']);

// Élève sans classe officielle (inscription non affectée) : niveau gagne
const sNoAc = selectApplicableStructures(mixed, {
  classId: null, academicClassId: null, levelId: LEVEL_PRIMAIRE,
});
check('Élève sans classe officielle → frais de NIVEAU (42 000)', sNoAc.filter((fs) => fs.feeType === 'TUITION').map((fs) => fs.id), ['fs-niveau-t']);

// Généraux : dédup par nom, plusieurs coexistent
const generals: any[] = [
  ...structures,
  { id: 'fs-g1', name: 'Tenue scolaire', feeType: 'GENERAL', levelId: null, classId: null, academicClassId: null, totalAmount: 10000, isMandatory: true },
  { id: 'fs-g2', name: 'Carte ID', feeType: 'GENERAL', levelId: null, classId: null, academicClassId: null, totalAmount: 2000, isMandatory: true },
  { id: 'fs-g3', name: 'Tenue scolaire', feeType: 'GENERAL', levelId: LEVEL_PRIMAIRE, classId: null, academicClassId: null, totalAmount: 9000, isMandatory: true },
];
const sGen = selectApplicableStructures(generals, {
  classId: null, academicClassId: AC.CE1, levelId: LEVEL_PRIMAIRE,
});
check('GENERAL : 2 noms distincts coexistent, même nom → niveau gagne', sGen.filter((fs) => fs.feeType === 'GENERAL').map((fs) => fs.id).sort(), ['fs-g2', 'fs-g3']);

// ─── 2) Plan de recalcul ─────────────────────────────────────────────────────
console.log('\n─── buildAccountRecalcPlan ───');
const svc = new StudentAccountService(null as any);

// Cas A : compte d'un élève de 3ème avec le MAUVAIS breakdown (4ème 80 000 —
// l'état actuel en production). Le plan doit : supprimer le breakdown non payé
// du 4ème, créer le breakdown 3ème à 95 000.
const accountA = { id: 'acc-3e' };
const breakdownsA = [
  { id: 'b1', studentAccountId: 'acc-3e', feeStructureId: 'fs-reinsc-s', initialAmount: 3000, adjustedAmount: 3000, paidAmount: 0, remainingAmount: 3000 },
  { id: 'b2', studentAccountId: 'acc-3e', feeStructureId: 'fs-t-4e', initialAmount: 80000, adjustedAmount: 80000, paidAmount: 0, remainingAmount: 80000 },
];
const planA = (svc as any).buildAccountRecalcPlan({
  account: accountA,
  breakdowns: breakdownsA,
  classId: null,
  academicClassId: AC['3ème'],
  levelId: LEVEL_SECONDAIRE,
  enrollmentType: 'REPEAT',
  structures,
  studentOverrides: [],
  regimeAdjustments: new Map(),
});
check('A: breakdown non payé du 4ème (orphelin) → supprimé, réinscription conservée', planA.deleteIds, ['b2']);
check(
  'A: breakdown 3ème (95 000) créé pour remplacer le 4ème (réinscription déjà présente → pas recréée)',
  planA.createBreakdowns.map((c: any) => ({ fs: c.feeStructureId, amt: c.initialAmount })),
  [{ fs: 'fs-t-3e', amt: 95000 }],
);
check('A: totaux = 3 000 + 95 000 = 98 000', { due: planA.totalDue, paid: planA.totalPaid, bal: planA.balance }, { due: 98000, paid: 0, bal: 98000 });

// Cas B : breakdown PAYÉ sur le mauvais frais → conservé mais resynchronisé
// (orphelin payé : montant du frais d'origine, remaining ajusté).
const breakdownsB = [
  { id: 'b3', studentAccountId: 'acc-ci', feeStructureId: 'fs-t-ce1', initialAmount: 50000, adjustedAmount: 50000, paidAmount: 20000, remainingAmount: 30000 },
];
const planB = (svc as any).buildAccountRecalcPlan({
  account: { id: 'acc-ci' },
  breakdowns: breakdownsB,
  classId: null,
  academicClassId: AC.CI,
  levelId: LEVEL_PRIMAIRE,
  enrollmentType: 'REPEAT',
  structures,
  studentOverrides: [],
  regimeAdjustments: new Map(),
});
// Le breakdown payé fs-t-ce1 n'est plus applicable pour un élève de CI →
// orphelin PAYÉ : conservé, resynchronisé au montant du frais (50 000 — déjà
// correct), et le breakdown CI (47 000) est créé.
check('B: orphelin payé conservé (pas supprimé)', planB.deleteIds, []);
check(
  'B: breakdown CI (47 000) créé',
  planB.createBreakdowns.map((c: any) => c.feeStructureId),
  ['fs-reinsc-p', 'fs-t-ci'],
);
check('B: totaux = 2 000 (réinsc) + 47 000 (CI) + 50 000 (orphelin payé) = 99 000, payé 20 000',
  { due: planB.totalDue, paid: planB.totalPaid, bal: planB.balance },
  { due: 99000, paid: 20000, bal: 79000 });

// Cas C : override élève sur le frais de niveau → montant personnalisé
const planC = (svc as any).buildAccountRecalcPlan({
  account: { id: 'acc-c' },
  breakdowns: [],
  classId: null,
  academicClassId: AC.CI,
  levelId: LEVEL_PRIMAIRE,
  enrollmentType: 'REPEAT',
  structures,
  studentOverrides: [{ feeStructureId: 'fs-t-ci', customAmount: 30000 }],
  regimeAdjustments: new Map(),
});
check('C: override appliqué (30 000 au lieu de 47 000)',
  planC.createBreakdowns.find((c: any) => c.feeStructureId === 'fs-t-ci')?.initialAmount, 30000);

// Cas D : montant déjà correct → AUCUNE écriture (idempotence)
const breakdownsD = [
  { id: 'b4', studentAccountId: 'acc-d', feeStructureId: 'fs-t-ci', initialAmount: 47000, adjustedAmount: 47000, paidAmount: 0, remainingAmount: 47000 },
  { id: 'b5', studentAccountId: 'acc-d', feeStructureId: 'fs-reinsc-p', initialAmount: 2000, adjustedAmount: 2000, paidAmount: 0, remainingAmount: 2000 },
];
const planD = (svc as any).buildAccountRecalcPlan({
  account: { id: 'acc-d' },
  breakdowns: breakdownsD,
  classId: null,
  academicClassId: AC.CI,
  levelId: LEVEL_PRIMAIRE,
  enrollmentType: 'REPEAT',
  structures,
  studentOverrides: [],
  regimeAdjustments: new Map(),
});
check('D: idempotence — aucun changement', { d: planD.deleteIds.length, u: planD.updateBreakdowns.length, c: planD.createBreakdowns.length }, { d: 0, u: 0, c: 0 });
check('D: totaux inchangés (49 000)', planD.totalDue, 49000);

console.log(`\n${failures === 0 ? '🎉 TOUS LES TESTS PASSENT' : `💥 ${failures} ÉCHEC(S)`}`);
process.exit(failures === 0 ? 0 : 1);
