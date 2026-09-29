// Test logique — « Gestion des surveillants » (2026-09-29 #4)
// Vérifie la COHÉRENCE de bout en bout sans exécuter le serveur (la RAM de la
// sandbox ne permet pas prisma generate — pattern scripts/test_*.mjs) :
//   1. Routes appelées par le frontend = routes déclarées dans les contrôleurs
//   2. Champs utilisés par le service = colonnes de la migration / schéma
//   3. Navigation Federis : « Épreuves et documents » dans EXAMENS après
//      Candidats, module renommé « Centres, salles & Surveillants »
//   4. Catalogue déplacé : plus d'onglet Catalogue dans FederisEpreuvesPage,
//      présent dans FederisQuestionBankPage, lien croisé ?edit=
//   5. Workflow complet : demande → soumission → répartition → notifications
//      (types/états utilisés par les deux applications)
import { readFileSync } from 'fs';

const base = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(base + p, 'utf8');

let pass = 0;
let fail = 0;
const check = (name, cond) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ÉCHEC : ${name}`);
  }
};

// ── Fichiers ────────────────────────────────────────────────────────────────
const svc = read('apps/api-server/src/federis/federis-supervisors.service.ts');
const ctrl = read('apps/api-server/src/federis/federis-supervisors.controller.ts');
const ctrlSchool = read('apps/api-server/src/federis/federis-school-supervisors.controller.ts');
const moduleTs = read('apps/api-server/src/federis/federis.module.ts');
const migration = read('apps/api-server/prisma/migrations/20260929160000_federis_supervisors/migration.sql');
const schema = read('apps/api-server/prisma/schema.prisma');
const layout = read('apps/web-app/src/components/federis/FederisLayout.tsx');
const epreuves = read('apps/web-app/src/components/federis/FederisEpreuvesPage.tsx');
const bank = read('apps/web-app/src/components/federis/FederisQuestionBankPage.tsx');
const centers = read('apps/web-app/src/components/federis/FederisCentersPage.tsx');
const supTab = read('apps/web-app/src/components/federis/FederisSupervisorsTab.tsx');
const schoolPatronats = read('apps/web-app/src/components/federis/SchoolPatronatsPage.tsx');
const schoolTab = read('apps/web-app/src/components/federis/SchoolSupervisorsTab.tsx');

// ── 1. Routes frontend ↔ contrôleurs backend ───────────────────────────────
console.log('\n1. Routes API (frontend ↔ backend)');

// Contrôleur patronat
const patronatRoutes = [
  [`GET`, `@Get('requests')`],
  [`POST`, `@Post('requests')`],
  [`PATCH`, `@Patch('requests/:id')`],
  [`GET`, `@Get('requests/:id/submissions')`],
  [`POST`, `@Post('requests/:id/assignments')`],
  [`GET`, `@Get()`],
  [`POST`, `@Post()`],
  [`PATCH`, `@Patch(':id')`],
  [`DELETE`, `@Delete(':id')`],
];
for (const [, decorator] of patronatRoutes) {
  check(`contrôleur patronat déclare ${decorator}`, ctrl.includes(decorator));
}
check(`contrôleur patronat préfixe federis/supervisors`, ctrl.includes(`@Controller('federis/supervisors')`));

// Appels frontend Federis (fragments littéraux des template literals)
const frontPatronatCalls = [
  `'/federis/supervisors/requests'`,
  '/federis/supervisors/requests/', // + requestId + '/submissions'
  '/federis/supervisors/requests/', // + selectedRequestId + '/assignments'
  `'/federis/supervisors'`,
];
for (const c of frontPatronatCalls) check(`FederisSupervisorsTab appelle ${c}`, supTab.includes(c));
check(`FederisSupervisorsTab appelle …/submissions`, supTab.includes('`/federis/supervisors/requests/${requestId}/submissions`'));
check(`FederisSupervisorsTab appelle …/assignments`, supTab.includes('`/federis/supervisors/requests/${selectedRequestId}/assignments`'));
check(`FederisSupervisorsTab PATCH statut demande`, supTab.includes('`/federis/supervisors/requests/${request.id}`'));
check(`FederisSupervisorsTab DELETE surveillant`, supTab.includes('`/federis/supervisors/${supervisor.id}`'));
check(`FederisSupervisorsTab POST création surveillant manuel`, supTab.includes(`'/federis/supervisors',`));
check(`FederisSupervisorsTab GET registre avec examId`, supTab.includes(`params: { examId },`));

// Contrôleur école + appels frontend Helm (fragments littéraux)
const schoolRoutes = [
  [`@Get()`, `'/federis/school/supervisors'`],
  [`@Get('teachers')`, `'/federis/school/supervisors/teachers'`],
  [`@Post('requests/:id/submit')`, 'requests/'],
  [`@Post('assignments/notify-all')`, `'/federis/school/supervisors/assignments/notify-all'`],
  [`@Post('assignments/:id/notify-teacher')`, 'assignments/'],
];
check(`contrôleur école préfixe federis/school/supervisors`, ctrlSchool.includes(`@Controller('federis/school/supervisors')`));
for (const [decorator, call] of schoolRoutes) {
  check(`contrôleur école déclare ${decorator}`, ctrlSchool.includes(decorator));
  check(`frontend école appelle ${call}`, schoolTab.includes(call));
}
check(`frontend école appelle …/submit`, schoolTab.includes('`/federis/school/supervisors/requests/${selectionTarget.id}/submit`'));
check(`frontend école appelle …/notify-teacher`, schoolTab.includes('`/federis/school/supervisors/assignments/${assignment.id}/notify-teacher`'));
check(`notify-all déclaré AVANT :id (routes statiques d'abord)`,
  ctrlSchool.indexOf(`@Post('assignments/notify-all')`) < ctrlSchool.indexOf(`@Post('assignments/:id/notify-teacher')`));

// Enregistrement dans le module Nest
console.log('\n2. Module Nest');
check(`FederisSupervisorsService enregistré (provider)`, moduleTs.includes(`FederisSupervisorsService,`));
check(`FederisSupervisorsController enregistré`, moduleTs.includes(`FederisSupervisorsController,`));
check(`FederisSchoolSupervisorsController enregistré`, moduleTs.includes(`FederisSchoolSupervisorsController,`));

// ── 2. Schéma / migration / service ────────────────────────────────────────
console.log('\n3. Schéma Prisma ↔ migration ↔ service');
const schemaBlocks = [
  [`model SupervisorRequest`, `supervisor_requests`],
  [`model SchoolSupervisorSubmission`, `school_supervisor_submissions`],
];
for (const [model, table] of schemaBlocks) {
  check(`schéma déclare ${model} (@@map ${table})`, schema.includes(model) && schema.includes(`@@map("${table}")`));
  check(`migration crée ${table}`, migration.includes(`CREATE TABLE IF NOT EXISTS "${table}"`));
}
check(`schéma : ExamSupervisor.source (MANUAL/SCHOOL_NOMINATION)`, /model ExamSupervisor[\s\S]*?source\s+String\s+@default\("MANUAL"\)/.test(schema));
check(`schéma : ExamSupervisor.schoolTenantId`, /model ExamSupervisor[\s\S]*?schoolTenantId\s+String\?/.test(schema));
check(`schéma : ExamSupervisor.teacherId`, /model ExamSupervisor[\s\S]*?teacherId\s+String\?/.test(schema));
check(`schéma : ExamSupervisor.teacherNotifiedAt`, /model ExamSupervisor[\s\S]*?teacherNotifiedAt\s+DateTime\?/.test(schema));
for (const col of ['"source"', '"schoolTenantId"', '"teacherId"', '"requestId"', '"submissionId"', '"teacherNotifiedAt"']) {
  check(`migration : exam_supervisors ADD COLUMN ${col}`, migration.includes(`ADD COLUMN IF NOT EXISTS ${col}`));
}
check(`schéma : unique tenantId+requestId (1 réponse/école/demande)`, /model SchoolSupervisorSubmission[\s\S]*?@@unique\(\[tenantId, requestId\]\)/.test(schema));
check(`service : upsert sur tenantId_requestId`, svc.includes(`tenantId_requestId: { tenantId, requestId }`));
check(`service : ensureSchema idempotent (miroir migration)`, svc.includes(`CREATE TABLE IF NOT EXISTS "supervisor_requests"`) && svc.includes(`ADD COLUMN IF NOT EXISTS "source"`));
check(`service : isolation territoriale (findFirst tenantId)`, svc.includes(`where: { id: requestId, tenantId }`));
check(`service : source SCHOOL_NOMINATION`, svc.includes(`source: 'SCHOOL_NOMINATION'`));
check(`service : résolution Teacher.email → User (pattern Helm)`, svc.includes(`where: { email: teacher.email, tenantId: supervisor.schoolTenantId }`));
check(`service : notifications in-app via NotificationService`, svc.includes(`this.notificationService`) && svc.includes(`.create({`));

// ── 3. Navigation Federis ──────────────────────────────────────────────────
console.log('\n4. Sidebar Federis');
const examensIdx = layout.indexOf("category: 'EXAMENS'");
const centresIdx = layout.indexOf(`'Centres, salles & Surveillants'`);
const candidatsIdx = layout.indexOf(`{ name: 'Candidats', subPath: '/candidates'`);
const epreuvesIdx = layout.indexOf(`{ name: 'Épreuves et documents', subPath: '/documents'`);
const ressourcesIdx = layout.indexOf("category: 'RESSOURCES'");
check(`bouton « Épreuves et documents » présent`, epreuvesIdx > -1);
check(`« Épreuves et documents » dans EXAMENS`, examensIdx > -1 && epreuvesIdx > examensIdx && epreuvesIdx < layout.indexOf("category: 'ANALYSE'"));
check(`« Épreuves et documents » juste APRÈS « Candidats »`, candidatsIdx > -1 && epreuvesIdx > candidatsIdx);
check(`« Épreuves et documents » n'est plus dans RESSOURCES`, !(ressourcesIdx > -1 && epreuvesIdx > ressourcesIdx && epreuvesIdx < layout.indexOf("category: 'ANALYSE'")));
check(`module renommé « Centres, salles & Surveillants »`, centresIdx > -1);
check(`ordre EXAMENS : Examens → Centres/Surveillants → Candidats → Épreuves → Délibérations`,
  layout.indexOf(`'Examens nationaux'`) < centresIdx && centresIdx < candidatsIdx && candidatsIdx < epreuvesIdx && epreuvesIdx < layout.indexOf(`'Délibérations'`));

// ── 4. Catalogue déplacé vers la Banque d'épreuves ─────────────────────────
console.log('\n5. Catalogue (Épreuves → Banque d\'épreuves)');
check(`FederisEpreuvesPage : plus d'onglet catalogue`, !epreuves.includes(`'catalogue'`));
check(`FederisEpreuvesPage : lecture du lien croisé ?edit=`, epreuves.includes(`window.location.search).get('edit')`));
check(`FederisQuestionBankPage : onglet catalogue`, bank.includes(`useState<'ressources' | 'catalogue'>`));
check(`FederisQuestionBankPage : charge le catalogue (API épreuves)`, bank.includes(`/federis/patronat/epreuves/catalogue`));
check(`FederisQuestionBankPage : lien croisé vers /documents?edit=`, bank.includes(`federisLink(\`/documents?edit=\${e.id}\`)`));
check(`FederisQuestionBankPage : PDF épreuve`, bank.includes('`/federis/patronat/epreuves/${epreuve.id}/pdf`'));
check(`FederisQuestionBankPage : charge la liste des épreuves`, bank.includes(`'/federis/patronat/epreuves'`));

// ── 5. Workflow / UI ───────────────────────────────────────────────────────
console.log('\n6. Workflow surveillants (UI)');
check(`FederisCentersPage : onglets Centres | Surveillants`, centers.includes(`'centres' | 'surveillants'`) && centers.includes(`Gestion des surveillants`));
check(`FederisCentersPage : monte FederisSupervisorsTab`, centers.includes(`<FederisSupervisorsTab`));
check(`FederisSupervisorsTab : création de demande aux écoles`, supTab.includes(`Demander aux écoles`));
check(`FederisSupervisorsTab : vue Par école`, supTab.includes(`Par école`));
check(`FederisSupervisorsTab : vue Récapitulatif global`, supTab.includes(`Récapitulatif global`));
check(`FederisSupervisorsTab : répartition centre + salle`, supTab.includes(`Centre d&apos;accueil`) && supTab.includes(`Salle de composition`));
check(`FederisSupervisorsTab : validation de la répartition`, supTab.includes(`Valider la répartition`));
check(`FederisSupervisorsTab : création manuelle (registre)`, supTab.includes(`Ajouter un surveillant`));
check(`SchoolPatronatsPage : onglets Rattachements | Surveillants`, schoolPatronats.includes(`'rattachements' | 'surveillants'`) && schoolPatronats.includes(`Gestion des surveillants`));
check(`SchoolPatronatsPage : lien ?tab=surveillants (notifications)`, schoolPatronats.includes(`'surveillants'`) && schoolPatronats.includes(`URLSearchParams`));
check(`SchoolSupervisorsTab : sélection enseignants depuis la base`, schoolTab.includes(`/federis/school/supervisors/teachers`) && schoolTab.includes(`Sélectionner mes enseignants`));
check(`SchoolSupervisorsTab : envoi de la liste au patronat`, schoolTab.includes(`Envoyer la liste`));
check(`SchoolSupervisorsTab : bouton Notifier l'enseignant`, schoolTab.includes('Notifier l\\u2019enseignant') || schoolTab.includes('Notifier l' + String.fromCharCode(0x2019) + 'enseignant'));
check(`SchoolSupervisorsTab : notification en lot (Notifier tous)`, schoolTab.includes(`notify-all`) && schoolTab.includes(`Notifier les`));

console.log(`\n═══ Résultat : ${pass} OK, ${fail} échec(s) ═══`);
process.exit(fail > 0 ? 1 : 0);
