// Tests logiques du module « Matières » (2026-09-29)
// Pattern scripts/test_*_2026-09-29.mjs : vérifications statiques + tests
// unitaires des helpers purs extraits du service (pattern new Function).
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

// ── Fichiers ────────────────────────────────────────────────────────────────
const svc = read('/apps/api-server/src/federis/federis-subjects.service.ts');
const ctrl = read('/apps/api-server/src/federis/federis-subjects.controller.ts');
const examsSvc = read('/apps/api-server/src/federis/federis-exams.service.ts');
const gradesSvc = read('/apps/api-server/src/federis/federis-grades.service.ts');
const epreuveSvc = read('/apps/api-server/src/federis/federis-epreuve.service.ts');
const moduleFile = read('/apps/api-server/src/federis/federis.module.ts');
const schema = read('/apps/api-server/prisma/schema.prisma');
const migration = read('/apps/api-server/prisma/migrations/20260929190000_federis_subjects/migration.sql');
const page = read('/apps/web-app/src/components/federis/FederisSubjectsPage.tsx');
const epreuvesPage = read('/apps/web-app/src/components/federis/FederisEpreuvesPage.tsx');
const gradesPage = read('/apps/web-app/src/components/federis/FederisGradesPage.tsx');
const layout = read('/apps/web-app/src/components/federis/FederisLayout.tsx');
const perms = read('/apps/web-app/src/lib/patronat/permissions.ts');

console.log('── 1. DTOs décorés class-validator (fix 400 forbidNonWhitelisted) ──');
for (const dto of ['CreateSubjectDto', 'UpdateSubjectDto', 'SubjectRowDto', 'BulkCreateSubjectsDto', 'InitSubjectsDto']) {
  const m = svc.match(new RegExp(`export class ${dto} \\{([\\s\\S]*?)\\n\\}`));
  check(`DTO ${dto} défini`, Boolean(m));
  check(`DTO ${dto} a des décorateurs`, Boolean(m && /@(Is|Type)/.test(m[1])));
}
check('CreateSubjectDto.examType @IsIn CEP/BEPC/BAC/CAP', /@IsIn\(\['CEP', 'BEPC', 'BAC', 'CAP'\]\)\s*\n\s*examType!: string/.test(svc));

console.log('── 2. Schéma ↔ migration ↔ ensureSchema (federis_subjects + subjectId) ──');
check('schema.prisma : model FederisSubject', /model FederisSubject \{/.test(schema));
check('schema : unique [tenantId, academicYearId, examType, series, code]', /@@unique\(\[tenantId, academicYearId, examType, series, code\]\)/.test(schema));
check('schema : série par défaut "" (tronc commun)', /series\s+String\s+@default\(""\)/.test(schema));
check('schema : FederisExamPaper.subjectId', /model FederisExamPaper[\s\S]*?subjectId\s+String\?/.test(schema));
check('schema : relation subjectRef SetNull (épreuve ↔ matière)', /subjectRef\s+FederisSubject\? @relation\("FederisExamPaperSubject", fields: \[subjectId\], references: \[id\], onDelete: SetNull\)/.test(schema));
check('migration : CREATE TABLE IF NOT EXISTS federis_subjects', migration.includes('CREATE TABLE IF NOT EXISTS "federis_subjects"'));
check('migration : colonne subjectId sur federis_exam_papers', migration.includes('ADD COLUMN IF NOT EXISTS "subjectId"'));
check('migration : FK douce SetNull vers federis_subjects', migration.includes('ON DELETE SET NULL'));
check('ensureSchema : miroir CREATE TABLE + subjectId', svc.includes('CREATE TABLE IF NOT EXISTS "federis_subjects"') && svc.includes('ADD COLUMN IF NOT EXISTS "subjectId"'));
check('ensureSchema épreuves : colonne subjectId aussi (appels avant le service matières)', epreuveSvc.includes('ADD COLUMN IF NOT EXISTS "subjectId"'));

console.log('── 3. Routes backend ↔ appels frontend ──');
const routeChecks = [
  ['GET /federis/subjects', /@Get\('subjects'\)/, page, '/federis/subjects'],
  ['GET /federis/subjects/readiness', /@Get\('subjects\/readiness'\)/, epreuvesPage, '/federis/subjects/readiness'],
  ['POST /federis/subjects', /@Post\('subjects'\)/, page, `/federis/subjects'`],
  ['POST /federis/subjects/bulk', /@Post\('subjects\/bulk'\)/, page, '/federis/subjects/bulk'],
  ['POST /federis/subjects/init', /@Post\('subjects\/init'\)/, page, '/federis/subjects/init'],
  ['PATCH /federis/subjects/:id', /@Patch\('subjects\/:id'\)/, page, `/federis/subjects/\${`],
  ['DELETE /federis/subjects/:id', /@Delete\('subjects\/:id'\)/, page, `/federis/subjects/\${`],
  ['POST sync catalogue→examen', /@Post\('exams\/:examId\/subjects\/sync'\)/, page, '/subjects/sync'],
];
for (const [label, routeRe, feSrc, feNeedle] of routeChecks) {
  check(`Contrôleur : ${label}`, routeRe.test(ctrl));
  check(`Frontend appelle : ${label}`, feSrc.includes(feNeedle));
}
check('Service + contrôleur enregistrés dans federis.module.ts', moduleFile.includes('FederisSubjectsController') && moduleFile.includes('FederisSubjectsService'));

console.log('── 4. Jeux officiels par type ET PAR SÉRIE (BAC) ──');
const officialBac = svc.match(/BAC:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*\/\/ CAP/)?.[1] ?? '';
check('BAC : série A1 présente', /A1:\s*\[/.test(officialBac));
check('BAC : série A2 présente', /A2:\s*\[/.test(officialBac));
check('BAC : série C présente (Maths coef 6, PC coef 6)', /C:\s*\[[\s\S]*?coefficient: 6[\s\S]*?coefficient: 6/.test(officialBac));
check('BAC : série D présente', /D:\s*\[/.test(officialBac));
check('CEP : 6 matières du primaire sans coefficients', (svc.match(/CEP:\s*\{[\s\S]*?'\':\s*\[([\s\S]*?)\],\s*\n\s*\},\s*\n\s*\/\/ BEPC/)?.[1].match(/code: '/g) ?? []).length === 6);
check('CEP : coefficients tous à 1', (() => {
  const cep = svc.match(/CEP:\s*\{[\s\S]*?'\':\s*\[([\s\S]*?)\],\s*\n\s*\},\s*\n\s*\/\/ BEPC/)?.[1] ?? '';
  return (cep.match(/coefficient: 1[,\s]/g) ?? []).length === 6;
})());
check('BEPC : coefficients pondérateurs (4, 3, 2)', /BEPC:[\s\S]*?coefficient: 4[\s\S]*?coefficient: 3[\s\S]*?coefficient: 2/.test(svc));
check('CAP : TP coef 5 + Technologie coef 4', /CAP:[\s\S]*?coefficient: 4[\s\S]*?coefficient: 5/.test(svc));
check('BAC_SERIES suggérées (A1, A2, C, D)', /BAC_SERIES: string\[\] = \['A1', 'A2', 'C', 'D'\]/.test(svc));

console.log('── 5. Helpers purs (extraits et testés) ──');
function extractFn(src, name) {
  const re = new RegExp(`(function ${name}\\([\\s\\S]*?\\n\\})`, 'g');
  const m = re.exec(src);
  if (!m) throw new Error(`fonction ${name} introuvable`);
  return m[1];
}
const stripTs = (code) => code
  .replace(/\(raw: string \| null \| undefined\): string \{/, '(raw) {')
  .replace(/\.slice\(0, 20\)/, '.slice(0, 20)')
  .replace(/\(type: string\): string \{/, '(type) {');
const helpersSrc = [extractFn(svc, 'normalizeSubjectName'), extractFn(svc, 'normalizeSeries'), extractFn(svc, 'examTypeLabel')].map(stripTs).join('\n');
const helpers = new Function(`${helpersSrc}\nreturn { normalizeSubjectName, normalizeSeries, examTypeLabel };`)();

check('normalizeSubjectName : trim + minuscules + sans accents + « et » neutralisé', helpers.normalizeSubjectName('  Sciences de la Vie et de la Terre ') === 'sciences de la vie de la terre');
check('normalizeSubjectName : accents supprimés', helpers.normalizeSubjectName('Éducation Sociale et Civique') === 'education sociale civique');
check('normalizeSubjectName : séparateurs - / & normalisés', helpers.normalizeSubjectName('Histoire-Géo & Éducation') === 'histoire geo education');
check('normalizeSubjectName : « et » neutralisé (rapprochement souple)', helpers.normalizeSubjectName('Mathématiques et Sciences') === 'mathematiques sciences');
check('normalizeSeries : a1 → A1 (trim, majuscules, sans accents)', helpers.normalizeSeries(' a1 ') === 'A1');
check('examTypeLabel : BAC → Baccalauréat', helpers.examTypeLabel('BAC') === 'Baccalauréat');

console.log('── 6. Lancement d\u2019examen → attachement automatique du catalogue ──');
check('updateExam : synchro au passage à REGISTRATION_OPEN / IN_PROGRESS', examsSvc.includes("dto.status === 'REGISTRATION_OPEN'") && examsSvc.includes("syncCatalogToExam"));
check('updateExam : synchro non bloquante (try/catch)', /try \{\s*\n\s*subjectsSync = await this\.subjectsService\.syncCatalogToExam/.test(examsSvc));
check('updateExam : réponse enrichie subjectsSync', examsSvc.includes('return { success: true, exam: updated, subjectsSync }'));
check('UpdateExamDto : @IsIn corrigé (REGISTRATION_CLOSED + IN_PROGRESS, plus ONGOING)', /@IsIn\(\['DRAFT', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED'\]\)/.test(examsSvc) && !examsSvc.includes("'ONGOING'"));
check('syncCatalogToExam : uniquement les codes manquants (jamais d\u2019écrasement)', svc.includes('existingCodes.has(c.code.toUpperCase())'));
check('syncCatalogToExam : sourceSubjectId tracé en metadata (signal épreuves)', svc.includes('sourceSubjectId: c.id'));
check('syncCatalogToExam : toutes les séries BAC attachées (chaque candidat dans SA série)', svc.includes('orderBy: [{ series: \'asc\' }, { order: \'asc\' }'));
check('syncCatalogToExam : catalogue vide → message explicite non bloquant', svc.includes('emptyCatalog: true'));

console.log('── 7. Module Notes et Moyennes alimenté par le catalogue ──');
check('initDefaultSubjects : catalogue D\u2019ABORD (federisSubject.count)', gradesSvc.includes('federisSubject') && gradesSvc.includes('.count({'));
check('initDefaultSubjects : repli jeu intégré si catalogue vide', gradesSvc.includes('Repli : jeu officiel intégré'));
check('initDefaultSubjects : fromCatalog dans la réponse', gradesSvc.includes('fromCatalog: true'));
check('Page notes : bouton « Initialiser depuis le catalogue »', gradesPage.includes('Initialiser depuis le catalogue'));

console.log('── 8. Signal épreuves (orange → vert) ──');
check('LAUNCHED_EXAM_STATUSES = REGISTRATION_OPEN + REGISTRATION_CLOSED + IN_PROGRESS', /LAUNCHED_EXAM_STATUSES = \['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'IN_PROGRESS'\]/.test(svc));
check('readiness : match par subjectId (lien exact)', svc.includes('papersBySubjectId.has(sourceId)'));
check('readiness : repli nom normalisé (épreuves antérieures)', svc.includes('papersByNormName.has(normalizeSubjectName(s.name))'));
check('readiness : matières du catalogue non rattachées détectées', svc.includes('catalogUnattached'));
check('readiness : allReady + totalMissing + par examen', svc.includes('allReady:') && svc.includes('totalMissing') && svc.includes('missingCount'));
check('Page épreuves : bandeau readiness orange/vert', epreuvesPage.includes('épreuve(s) à préparer') && epreuvesPage.includes('tout est au vert'));
check('Page épreuves : bouton « Préparer une épreuve »', epreuvesPage.includes('Préparer une épreuve'));
check('Page épreuves : rechargement du signal après création', epreuvesPage.includes('void loadSubjectsContext();'));
check('Page épreuves : champ Matière = select du catalogue (subjectId)', epreuvesPage.includes('subjectsCatalog.filter') && epreuvesPage.includes('subjectId: v'));
check('Page épreuves : ancienne valeur conservée si hors catalogue', epreuvesPage.includes('(hors catalogue)'));
check('CreateEpreuveDto + UpdateEpreuveDto : subjectId décoré', epreuveSvc.includes('@MaxLength(60)\n  subjectId?: string | null;'));
check('createEpreuve + updateEpreuve + serialize : subjectId persisté', epreuveSvc.includes('subjectId: dto.subjectId?.trim() || null') && epreuveSvc.includes('data.subjectId = dto.subjectId?.trim() || null') && epreuveSvc.includes('subjectId: paper.subjectId ?? null'));

console.log('── 9. Page Matières (interface Helm copiée, contextualisée) ──');
check('Page : onglets CEP | BEPC | BAC | CAP', page.includes("type: 'CEP'") && page.includes("type: 'BAC'"));
check('Page : chips de séries pour BAC/CAP', page.includes('Série / filière') && page.includes('seriesChips'));
check('Page : panneau de suggestions du jeu officiel (checkbox multiples → lot)', page.includes('Jeu officiel') && page.includes('Ajouter la sélection'));
check('Page : sélection multiple + barre de suppression en lot (pattern Helm)', page.includes('Supprimer la sélection') && page.includes('selected.size'));
check('Page : formulaire création/édition (code, série, intitulé, coefficient, barème, durée)', page.includes('Nouvelle matière') && page.includes('Coefficient') && page.includes('Barème'));
check('Page : confirmation de suppression personnalisée (pas de window.confirm)', !page.includes('window.confirm(') && page.includes('Confirmer la suppression'));
check('Page : dédoublonnage signalé (pattern Helm)', page.includes('duplicated'));
check('Page : statut par matière (Épreuve prête / À préparer / Hors campagne)', page.includes('Épreuve prête') && page.includes('À préparer') && page.includes('Hors campagne'));
check('Page : bandeau readiness + bouton Synchroniser par examen lancé', page.includes('readiness') && page.includes('Synchroniser'));

console.log('── 10. Navigation & permissions ──');
const matieresIdx = layout.indexOf("name: 'Matières'");
const examsIdx = layout.indexOf("name: 'Examens nationaux'");
check('Sidebar : « Matières » en PREMIÈRE position de la catégorie EXAMENS', matieresIdx > 0 && matieresIdx < examsIdx);
check('Sidebar : subPath /subjects + icône bookOpen', layout.includes("subPath: '/subjects'") && layout.includes("icon: 'bookOpen'"));
check('Permissions : /subjects = coordonnateur + secrétaire + organisateur', /'\/subjects':\s*\['COORDONNATEUR', 'SECRETAIRE', 'ORGANISATEUR'\]/.test(perms));
check('Page route créée : (patronat)/federis/subjects/page.tsx', read('/apps/web-app/src/app/(patronat)/federis/subjects/page.tsx').includes('FederisSubjectsPage'));
check('Écriture = WRITE_EXAM_ORG (mêmes droits que les épreuves)', svc.includes('WRITE_EXAM_ORG'));

// ── Bilan ───────────────────────────────────────────────────────────────────
console.log(`\n════════════════════════════════════════════`);
console.log(`RÉSULTAT : ${pass} OK / ${fail} échec(s)`);
if (fail > 0) {
  console.log('ÉCHECS :');
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log('✓ Module « Matières » : tous les contrôles passent');
