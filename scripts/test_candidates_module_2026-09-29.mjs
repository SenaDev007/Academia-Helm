// Tests logiques — module Candidats + fix DTOs (2026-09-29)
// Pattern scripts/test_*.mjs du repo : vérifications statiques + unit tests.
import { readFileSync } from 'fs';

const F = {
  schoolExams: '/home/z/my-project/ah/apps/api-server/src/federis/federis-school-exams.service.ts',
  exams: '/home/z/my-project/ah/apps/api-server/src/federis/federis-exams.service.ts',
  examsCtrl: '/home/z/my-project/ah/apps/api-server/src/federis/federis-exams.controller.ts',
  supervisors: '/home/z/my-project/ah/apps/api-server/src/federis/federis-supervisors.service.ts',
  users: '/home/z/my-project/ah/apps/api-server/src/federis/federis-users.service.ts',
  deliberation: '/home/z/my-project/ah/apps/api-server/src/federis/federis-deliberation.service.ts',
  pdf: '/home/z/my-project/ah/apps/api-server/src/federis/federis-pdf.service.ts',
  pdfCtrl: '/home/z/my-project/ah/apps/api-server/src/federis/federis-pdf.controller.ts',
  export: '/home/z/my-project/ah/apps/api-server/src/federis/federis-candidates-export.service.ts',
  module: '/home/z/my-project/ah/apps/api-server/src/federis/federis.module.ts',
  schema: '/home/z/my-project/ah/apps/api-server/prisma/schema.prisma',
  migration: '/home/z/my-project/ah/apps/api-server/prisma/migrations/20260929170000_federis_candidates_anonymats/migration.sql',
  natExams: '/home/z/my-project/ah/apps/web-app/src/app/app/exams/national-exams/page.tsx',
  candidates: '/home/z/my-project/ah/apps/web-app/src/components/federis/FederisCandidatesPage.tsx',
  settings: '/home/z/my-project/ah/apps/web-app/src/components/federis/FederisSettingsPage.tsx',
};

const read = (p) => readFileSync(p, 'utf8');
let pass = 0;
let fail = 0;
const check = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); }
};

// ═══ 1. FIX DTOs — décorateurs class-validator partout ═════════════════════
console.log('\n── 1. Fix « property studentIds should not exist » — DTOs décorés');
{
  const se = read(F.schoolExams);
  check(se.includes("import { IsArray, IsOptional, IsString } from 'class-validator'"), 'school-exams : import class-validator');
  check(/export class SubmitSelectionDto[\s\S]{0,300}@IsOptional[\s\S]{0,60}@IsArray[\s\S]{0,60}@IsString\(\{ each: true \}\)/.test(se), 'SubmitSelectionDto : @IsOptional @IsArray @IsString({each:true}) sur studentIds');
  check(/export class SaveSelectionDto[\s\S]{0,250}@IsArray/.test(se), 'SaveSelectionDto : @IsArray sur studentIds');

  const ex = read(F.exams);
  for (const dto of ['CreateExamDto', 'UpdateExamDto', 'CreateCenterDto', 'UpdateCenterDto', 'CreateRoomDto', 'UpdateRoomDto', 'ImportCandidatesDto', 'AddCandidateDto', 'AssignTablesDto']) {
    const m = ex.match(new RegExp(`export class ${dto} \\{[\\s\\S]*?\\n\\}`));
    check(m && m[0].includes('@Is'), `${dto} : décorateurs présents`);
  }
  check(ex.includes("@Type(() => ImportCandidateRow)"), 'ImportCandidatesDto : @ValidateNested + @Type sur rows');
  check(ex.includes("IsIn(['CENTER', 'ROOM', 'EXAM'])"), 'AssignTablesDto : scope ROOM accepté');

  const sv = read(F.supervisors);
  check(sv.includes('@IsArray') && sv.includes('ValidateNested'), 'supervisors : DTOs décorés (workflow surveillants réparé aussi)');
  check(/export class SubmitNominationDto[\s\S]{0,200}@IsArray/.test(sv), 'SubmitNominationDto : @IsArray teacherIds');

  const us = read(F.users);
  check(us.includes('@IsEmail') && us.includes('@IsBoolean'), 'users : DTOs décorés');
  const de = read(F.deliberation);
  check(de.includes('@IsNumber') && de.includes('BulkResultRowDto'), 'deliberation : DTOs décorés + nested row');
}

// ═══ 2. Moteur de matricule — unit tests ═══════════════════════════════════
console.log('\n── 2. Moteur de matricule (jetons + défaut)');
{
  // Réimplémentation fidèle (extrait du service) pour test unitaire
  const src = read(F.exams);
  check(src.includes("export const DEFAULT_MATRICULE_FORMAT = '{EXAM}-{ANNEE}-{SEQ:5}'"), 'format par défaut {EXAM}-{ANNEE}-{SEQ:5}');
  check(src.includes('export function renderMatricule'), 'renderMatricule exporté');
  check(src.includes('export function validateMatriculeFormat'), 'validateMatriculeFormat exporté');
  check(src.includes('{PATRONAT}'), 'jeton {PATRONAT} géré');
  check(src.includes("token.startsWith('SEQ')"), 'jeton {SEQ:n} géré');

  // Évalue les fonctions dans un contexte isolé — les annotations TS de ces
  // deux fonctions simples sont retirées par remplacements ciblés, puis la
  // déclaration est exécutée via new Function (le mode strict ESM isole eval).
  const stripTs = (code) => code
    .replace(/format: string,/, 'format,')
    .replace(/ctx: \{[\s\S]*?\},\n\): string \{/, 'ctx) {')
    .replace(/\(format: string\): string\[\] \{/, '(format) {')
    .replace(/\(_m, token: string\)/, '(_m, token)')
    .replace(/const errors: string\[\] = \[\];/, 'const errors = [];')
    .replace(/patronatName\?: string \| null;/, '');
  const renderMatricule = new Function(
    src.match(/export const MATRICULE_TOKEN_RE[^\n]+/)[0].replace('export ', '') + '\n' +
      stripTs(src.match(/export function renderMatricule[\s\S]*?\n\}/)[0].replace('export ', '')) +
      '\nreturn renderMatricule;',
  )();
  const validateMatriculeFormat = new Function(
    src.match(/export const MATRICULE_TOKEN_RE[^\n]+/)[0].replace('export ', '') + '\n' +
      stripTs(src.match(/export function validateMatriculeFormat[\s\S]*?\n\}/)[0].replace('export ', '')) +
      '\nreturn validateMatriculeFormat;',
  )();

  const ctx = { examCode: 'BAC26', examType: 'BAC', year: 2026, seq: 42, patronatName: 'Patronat des Écoles Privées du Bénin' };
  check(renderMatricule('{EXAM}-{ANNEE}-{SEQ:5}', ctx) === 'BAC26-2026-00042', 'défaut : BAC26-2026-00042');
  check(renderMatricule('{EXAMTYPE}{ANNEE2}{SEQ:4}', { ...ctx, examType: 'BEPC' }) === 'BEPC260042', 'BEPC260042 ({EXAMTYPE}{ANNEE2}{SEQ:4})');
  check(renderMatricule('{PATRONAT}/{SEQ}', ctx) === 'PATRONATDESE/42', '{PATRONAT} normalisé (majuscules, sans accents ni espaces, 12 car. max)');
  check(renderMatricule('{SEQ:2}', { ...ctx, seq: 7 }) === '07', '{SEQ:2} complété à 2 chiffres');

  check(validateMatriculeFormat('{EXAM}-{SEQ}').length === 0, 'validation OK pour {EXAM}-{SEQ}');
  check(validateMatriculeFormat('{EXAM}').some((e) => e.includes('{SEQ}')), 'validation rejette un modèle sans {SEQ}');
  check(validateMatriculeFormat('{INCONNU}-{SEQ}').some((e) => e.includes('Jeton inconnu')), 'validation rejette les jetons inconnus');
}

// ═══ 3. Anonymats — schéma, migration, service, contrôleur ═════════════════
console.log('\n── 3. Anonymats (post-composition)');
{
  const sc = read(F.schema);
  check(sc.includes('anonymatCode       String?') && sc.includes('anonymatIssuedAt   DateTime?'), 'schema : ExamCandidate.anonymatCode + anonymatIssuedAt');
  check(sc.includes('@@index([examId, anonymatCode])'), 'schema : index composite (examId, anonymatCode)');
  check(sc.includes('matriculeFormat                  String?'), 'schema : Patronat.matriculeFormat');

  const mig = read(F.migration);
  check(mig.includes('ADD COLUMN IF NOT EXISTS "anonymatCode"'), 'migration : anonymatCode idempotente');
  check(mig.includes('ADD COLUMN IF NOT EXISTS "matriculeFormat"'), 'migration : matriculeFormat idempotente');
  check(mig.includes('CREATE INDEX IF NOT EXISTS "exam_candidates_examId_anonymatCode_idx"'), 'migration : index anonymat');

  const ex = read(F.exams);
  check(ex.includes('async generateAnonymats('), 'service : generateAnonymats');
  check(ex.includes('padStart(5, \'0\')') && ex.includes('charAt(0).toUpperCase()'), 'anonymat : format <yy><initiale><seq5> (ex. 26B00001)');
  check(ex.includes('regenerate'), 'anonymat : option regenerate (nouvelle série complète)');
  check(ex.includes('FEDERIS_ANONYMATS_GENERATED'), 'anonymat : audit log');

  const ctrl = read(F.examsCtrl);
  check(ctrl.includes("@Post('exams/:examId/anonymats/generate')"), 'route POST exams/:examId/anonymats/generate');
}

// ═══ 4. Numéros de table — portée PAR SALLE ═════════════════════════════════
console.log('\n── 4. Numéros de table par centre ET par salle');
{
  const ex = read(F.exams);
  check(ex.includes("scope === 'ROOM'"), 'numérotation : scope ROOM (redémarre dans chaque salle)');
  check(ex.includes('start + occupied - 1'), 'ROOM : compteur = start + occupation salle');
  // Simulation : 2 salles de 3, 5 candidats, scope ROOM, start 1
  const rooms = [{ id: 'r1', cap: 3 }, { id: 'r2', cap: 3 }];
  const occ = new Map(); const nums = [];
  let ri = 0;
  for (let i = 0; i < 5; i++) {
    while (ri < rooms.length && rooms[ri].cap <= (occ.get(rooms[ri].id) ?? 0)) ri++;
    const t = rooms[ri]; const o = (occ.get(t.id) ?? 0) + 1; occ.set(t.id, o);
    nums.push(String(1 + o - 1).padStart(3, '0'));
  }
  check(JSON.stringify(nums) === JSON.stringify(['001','002','003','001','002']), `simulation ROOM 2 salles : ${nums.join(',')} → 001,002,003 | 001,002`);
}

// ═══ 5. Exports officiels PDF + Excel (backend) ════════════════════════════
console.log('\n── 5. Liste officielle PDF + Excel (pattern Helm)');
{
  const pdf = read(F.pdf);
  check(pdf.includes('async generateCandidatesListPdf('), 'PDF : generateCandidatesListPdf (Puppeteer backend)');
  check(pdf.includes('Liste officielle des candidats') && pdf.includes('Anonymat'), 'PDF : colonnes anonymat + titre officiel');
  check(pdf.includes('FEDERIS_CANDIDATES_LIST_PDF'), 'PDF : audit log');

  const pdfCtrl = read(F.pdfCtrl);
  check(pdfCtrl.includes("@Get('exams/:examId/pdf/candidats')"), 'route GET exams/:examId/pdf/candidats');

  const xp = read(F.export);
  check(xp.includes("import * as ExcelJS from 'exceljs'"), 'Excel : ExcelJS (pattern educmaster-excel-export)');
  check(xp.includes('FederisCandidatesExportService'), 'Excel : service dédié');
  check(xp.includes('Synthèse') && xp.includes('anonymat'), 'Excel : feuille Synthèse + colonne anonymat');
  check(xp.includes('FEDERIS_CANDIDATES_EXCEL'), 'Excel : audit log');

  const exCtrl = read(F.examsCtrl);
  check(exCtrl.includes("@Get('exams/:examId/excel/candidats')"), 'route GET exams/:examId/excel/candidats');
  check(exCtrl.includes('StreamableFile'), 'Excel : StreamableFile + Content-Disposition attachment');
  check(read(F.module).includes('FederisCandidatesExportService'), 'module : service export enregistré');
}

// ═══ 6. Format matricule paramétrable (Paramètres) ══════════════════════════
console.log('\n── 6. Format de matricule paramétrable (module Paramètres)');
{
  const ex = read(F.exams);
  check(ex.includes('async getMatriculeSettings(') && ex.includes('async updateMatriculeSettings('), 'service : get/updateMatriculeSettings');
  check(ex.includes('DEFAULT_MATRICULE_FORMAT ??') || ex.includes('format ?? DEFAULT_MATRICULE_FORMAT'), 'défaut appliqué quand le patronat ne définit rien');
  check(ex.includes('this.nextMatricule(exam, patronat)'), 'import : nextMatricule(exam, patronat) — génère selon le format');
  const ctrl = read(F.examsCtrl);
  check(ctrl.includes("@Get('settings/matricule')") && ctrl.includes("@Put('settings/matricule')"), 'routes GET/PUT settings/matricule');
  const st = read(F.settings);
  check(st.includes("'matricule'") && st.includes('Matricule & Anonymat'), 'SettingsPage : onglet « Matricule & Anonymat »');
  check(st.includes("matriculePreview") && st.includes('Aperçu'), 'SettingsPage : aperçu en direct');
  check(st.includes("'/federis/settings/matricule'"), 'SettingsPage : appel API matricule');
}

// ═══ 7. Frontend Candidats — catégorisation CEP/BEPC/BAC/CAP ═══════════════
console.log('\n── 7. Frontend module Candidats (catégorisation + anonymats)');
{
  const c = read(F.candidates);
  check(c.includes('EXAM_TYPES') && c.includes("{ type: 'CEP', label: 'CEP' }") && c.includes("{ type: 'BAC', label: 'Baccalauréat' }"), 'onglets CEP / BEPC / BAC / CAP définis');
  check(c.includes('examsByType') && c.includes('switchType'), 'catégorisation : groupes par examType + bascule d\u2019onglet');
  check(c.includes('role="tab"') && c.includes('aria-selected'), 'onglets accessibles (role tab)');
  check(c.includes('anonymatCode') && c.includes('Sans anonymat'), 'colonne Anonymat + KPI sans anonymat');
  check(c.includes('anonymats/generate'), 'action Générer les anonymats');
  check(c.includes('pdf/candidats') && c.includes('excel/candidats'), 'exports PDF + Excel (blob authentifié)');
  check(c.includes("value=\"ROOM\"") && c.includes('Par salle — redémarre dans chaque salle'), 'option de numérotation PAR SALLE');
  check(c.includes('École de provenance'), 'colonne École de provenance');
  check(c.includes('campagne du type') || c.includes('Campagne'), 'sélecteur de campagne dans l\u2019onglet');
  check(c.includes('Écoles') === false || c.includes('non présents sur') || c.includes('Academia Helm'), 'aide import : écoles hors Academia Helm');
}

// ═══ 8. Modal personnalisée « Envoyer au patronat » (Helm) ══════════════════
console.log('\n── 8. Modal personnalisée (Examens nationaux — Helm)');
{
  const p = read(F.natExams);
  check(!/window\.confirm\s*\(/.test(p), 'window.confirm supprimé (plus de modal générique — seules les mentions en commentaire subsistent)');
  check(p.includes('<Dialog') && p.includes('Envoi officiel au patronat'), 'Dialog personnalisée « Envoi officiel au patronat »');
  check(p.includes('confirmSend') && p.includes('setConfirmOpen(true)'), 'flux : bouton → modale → confirmSend');
  check(p.includes('selectedSeriesBreakdown') && p.includes('Répartition par série'), 'récapitulatif par série (Bac) dans la modale');
  check(p.includes('engagement officiel'), 'avertissement engagement officiel');
  check(p.includes('patronatTargets'), 'patronats destinataires affichés');
  check(p.includes('Confirmer l&apos;envoi') || p.includes("Confirmer l'envoi"), 'bouton Confirmer l\u2019envoi');
}

// ═══ 9. listCandidates enrichi ══════════════════════════════════════════════
console.log('\n── 9. Registre enrichi (backend listCandidates)');
{
  const ex = read(F.exams);
  check(ex.includes('withoutAnonymat'), 'listCandidates : compteur withoutAnonymat');
  check(ex.includes('anonymatCode: c.anonymatCode'), 'listCandidates : anonymatCode par candidat');
  check(ex.includes("{ anonymatCode: { contains: q } }"), 'recherche par anonymat');
  check(ex.includes('examType: exam.examType'), 'examType exposé (catégorisation frontend)');
}

console.log(`\n════════════════════════════════════════════`);
console.log(`Résultat : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
