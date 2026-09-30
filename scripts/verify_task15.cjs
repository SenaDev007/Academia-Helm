#!/usr/bin/env node
/**
 * verify_task15.cjs — Vérification de la Task 15 (répertoire officiel des
 * établissements du Bénin + retours Helm).
 *
 * 1. Tests RUNTIME du parser de note circulaire (transpilation à la volée
 *    via typescript du sandbox, exécution des cas gabarit/libre/vide).
 * 2. Tests RUNTIME du dataset (1 406 entrées, refs uniques, 12 départements).
 * 3. Contrôles structurels (endpoints, libellés, suppression Orion, seed).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = '/home/z/my-project/ah';
const WEB = path.join(ROOT, 'apps/web-app/src');
const API = path.join(ROOT, 'apps/api-server/src');
const TS = '/home/z/my-project/scripts/tscheck/node_modules/typescript';
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

// ══════════════════════════════════════════════════════════════════════
// 1. TRANSPILATION + EXÉCUTION du parser circulaire et du dataset
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 1. Parser de note circulaire (runtime) ──');
const ts = require(TS);

function transpile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const tmp = `/tmp/task15_${path.basename(file, '.ts')}.cjs`;
  fs.writeFileSync(tmp, out.outputText);
  return tmp;
}

const parserPath = transpile(path.join(WEB, 'lib/federis/circular-note-parser.ts'));
const {
  parseCircularNote,
  circularNoteExcerpt,
} = require(parserPath);

// ── Cas 1 : note générée par le gabarit officiel ──
const templateMsg = [
  'NOTE CIRCULAIRE',
  'Objet : Désignation d\u2019enseignants pour l\u2019organisation de Examen blanc — CEP 2027 — surveillance, correction et secrétariat',
  '',
  'À Mesdames et Messieurs les Chefs d\u2019établissement,',
  '',
  'Dans le cadre de l\u2019organisation de l\u2019examen « Examen blanc — CEP 2027 », le Patronat sollicite le concours de votre établissement.',
  '— la SURVEILLANCE des épreuves dans les différents centres et salles de composition ;',
  '— la CORRECTION des épreuves (copies et copies de rattrapage) ;',
  '— le SECRÉTARIAT de l\u2019examen, notamment la SAISIE DES NOTES.',
  '',
  'EFFECTIF ATTENDU PAR ÉCOLE',
  'Chaque école est priée de proposer deux (02) à quatre (04) enseignants disponibles.',
  '1. Disponibilité attestée pour l\u2019ensemble de la période des épreuves ;',
  '2. Expérience avérée de la surveillance des examens primaires (CEP) ;',
  '',
  'MODALITÉS DE RÉPONSE',
  'La liste des enseignants proposés devra être transmise via votre espace Academia Helm — module « Patronats & Examens », onglet « Gestion des surveillants / Correction ».',
  '',
  'Le Patronat vous remercie de votre collaboration habituelle et compte sur votre prompte réponse.',
  '',
  'Pour le Patronat du département,',
  'Le Coordinateur',
  'AKOUTA Jean',
].join('\n');

const p1 = parseCircularNote(templateMsg);
check('objet extrait', p1.object?.startsWith('Désignation d\u2019enseignants') === true);
check('appel extrait', p1.salutation === 'À Mesdames et Messieurs les Chefs d\u2019établissement,');
check('signature détachée (formule)', /Pour le Patronat/i.test(p1.signature?.forLabel ?? ''));
check('signature détachée (rôle)', /Coordinateur/i.test(p1.signature?.role ?? ''));
check('signature détachée (nom)', p1.signature?.name === 'AKOUTA Jean');
const sectionTitles = p1.sections.map((s) => s.title).filter(Boolean);
check(
  'sections titrées détectées',
  sectionTitles.includes('EFFECTIF ATTENDU PAR ÉCOLE') &&
    sectionTitles.includes('MODALITÉS DE RÉPONSE'),
);
const allBlocks = p1.sections.flatMap((s) => s.blocks);
check(
  '3 puces « — » détectées',
  allBlocks.filter((b) => b.type === 'bullet').length === 3,
);
check(
  '2 items numérotés détectés',
  allBlocks.filter((b) => b.type === 'numbered').length === 2,
);
check(
  'clôture (remerciements) isolée',
  /remercie/i.test(p1.closing ?? '') === true,
);
check(
  'la clôture ne reste pas dans le corps',
  p1.sections.flatMap((s) => s.blocks).some((b) => b.text === p1.closing) === false,
);
check(
  'la signature ne reste pas dans le corps',
  p1.sections
    .flatMap((s) => s.blocks)
    .some((b) => /Pour le Patronat/i.test(b.text)) === false,
);

// ── Cas 2 : note libre (sans gabarit) → lettre simple ──
const freeMsg = 'Bonjour,\n\nNous cherchons des volontaires pour la surveillance.\n\nCordialement,\n\nLa direction du patronat';
const p2 = parseCircularNote(freeMsg);
check('note libre : pas de crash, objet null', p2.object === null);
check('note libre : 4 paragraphes préservés', p2.sections[0].blocks.length === 4);
check('note libre : signature null (pas de formule « Pour le Patronat »)', p2.signature === null);

// ── Cas 3 : note vide ──
const p3 = parseCircularNote(null);
check('note vide : 0 ligne, sections vides', p3.rawLineCount === 0 && p3.sections.length === 0);

// ── Extrait ──
const ex = circularNoteExcerpt('a'.repeat(300), 160);
check('extrait coupé avec ellipse', ex.endsWith('…') && ex.length <= 162);

// ══════════════════════════════════════════════════════════════════════
// 2. DATASET — 1 406 établissements, 12 départements, refs uniques
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 2. Dataset du répertoire officiel ──');
const dataPath = transpile(
  path.join(API, 'federis/data/benin-secondary-private-schools.data.ts'),
);
const { BENIN_SECONDARY_PRIVATE_SCHOOLS } = require(dataPath);
check('1 406 établissements', BENIN_SECONDARY_PRIVATE_SCHOOLS.length === 1406);
const refs = new Set(BENIN_SECONDARY_PRIVATE_SCHOOLS.map((s) => s.ref));
check('références uniques', refs.size === 1406);
const depts = new Set(BENIN_SECONDARY_PRIVATE_SCHOOLS.map((s) => s.department));
check('12 départements', depts.size === 12);
check(
  'départements canoniques uniquement',
  [...depts].every((d) =>
    ['Alibori', 'Atacora', 'Atlantique', 'Borgou', 'Collines', 'Couffo', 'Donga', 'Littoral', 'Mono', 'Ouémé', 'Plateau', 'Zou'].includes(d),
  ),
);
check(
  'chaque entrée a nom + département (commune ≥ 1405/1406 — 1 donnée source manquante)',
  BENIN_SECONDARY_PRIVATE_SCHOOLS.every((s) => s.name && s.department) &&
    BENIN_SECONDARY_PRIVATE_SCHOOLS.filter((s) => s.commune).length >= 1405,
);

// ══════════════════════════════════════════════════════════════════════
// 3. CONTRÔLES STRUCTURELS
// ══════════════════════════════════════════════════════════════════════
console.log('\n── 3. Contrôles structurels ──');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Backend — répertoire officiel
const svc = read('apps/api-server/src/federis/federis-school-directory.service.ts');
check('service répertoire : ensureSchemaAndSeed idempotent', svc.includes('CREATE TABLE IF NOT EXISTS "school_directory_entries"') && svc.includes('skipDuplicates: true'));
check('service répertoire : seed depuis le dataset', svc.includes('BENIN_SECONDARY_PRIVATE_SCHOOLS'));
check('service répertoire : filtrage par département du patronat', svc.includes('departmentsOfPatronat') && svc.includes('departmentKeys'));
check('service répertoire : invitation automatique (email + repli manuel)', svc.includes('sendInvitation') && svc.includes("channel: 'EMAIL'") && svc.includes("channel: 'MANUAL'"));
check('service répertoire : URL onboarding Helm', svc.includes('/onboarding?school='));
check('service répertoire : doublon externalRef + nom', svc.includes('directoryExternalRef'));

const ctrl = read('apps/api-server/src/federis/federis-patronat.controller.ts');
check('endpoint GET directory/search', ctrl.includes("@Get('patronat/schools/directory/search')"));
check('endpoint POST provisional', ctrl.includes("@Post('patronat/schools/provisional')"));

const mod = read('apps/api-server/src/federis/federis.module.ts');
check('service enregistré dans le module', mod.includes('FederisSchoolDirectoryService'));

const schema = read('apps/api-server/prisma/schema.prisma');
check('modèle SchoolDirectoryEntry présent', schema.includes('model SchoolDirectoryEntry {'));
check('migration répertoire présente', fs.existsSync('apps/api-server/prisma/migrations/20260930130000_federis_school_directory/migration.sql'));

const migration = read('apps/api-server/prisma/migrations/20260930130000_federis_school_directory/migration.sql');
check('migration 100 % idempotente (IF NOT EXISTS)', !migration.includes('CREATE TABLE "school_directory_entries";') && migration.includes('IF NOT EXISTS'));

// Backend — notifications renommées + mySubmission enrichi + fix SUPERVISOR_POSTS
const sup = read('apps/api-server/src/federis/federis-supervisors.service.ts');
check('notifications : « Gestion des surveillants / Correction » (3 occurrences)', (sup.match(/Gestion des surveillants \/ Correction/g) ?? []).length === 3);
check('mySubmission enrichi : liste nominative des enseignants', sup.includes('teachers: teachers.map((t) => ({'));
check('fix SUPERVISOR_POSTS : déclarées AVANT les DTO', sup.indexOf('export const SUPERVISOR_POSTS') < sup.indexOf('export class CreateSupervisorRequestDto'));

const patronatSvc = read('apps/api-server/src/federis/federis-patronat.service.ts');
check('getSchools : source/département/invitation exposés', patronatSvc.includes("source: (s.metadata as any)?.source") && patronatSvc.includes('invitedAt'));

// Front — Helm
const topbar = read('apps/web-app/src/components/pilotage/PilotageTopBar.tsx');
check('navbar : alerte Orion supprimée (badge + polling)', !topbar.includes('orionAlertsCount') && !topbar.includes("/api/orion/alerts"));
check('navbar : icône Bell retirée des imports', !topbar.includes("Bell,"));

const schoolPatronats = read('apps/web-app/src/components/federis/SchoolPatronatsPage.tsx');
check('Helm : onglet « Gestion des surveillants / Correction »', schoolPatronats.includes('Gestion des surveillants / Correction'));

const tab = read('apps/web-app/src/components/federis/SchoolSupervisorsTab.tsx');
check('Helm : titre « Gestion des surveillants / Correction »', tab.includes('Gestion des surveillants / Correction'));
check('Helm : 3 sous-onglets (demandes / envoyés / affectations)', tab.includes("'demandes'") && tab.includes("'envoyes'") && tab.includes("'affectations'"));
check('Helm : lettre professionnelle (modale + parser)', tab.includes('CircularNoteLetterModal') && tab.includes('parseCircularNote'));
check("Helm : statut « En attente d'affectation »", tab.includes("En attente d&apos;affectation par le patronat"));
check('Helm : rapprochement enseignant ↔ affectation', tab.includes('assignmentsByRequestAndName'));

// Front — Federis
const template = read('apps/web-app/src/lib/federis/surveillance-request-template.ts');
check('note circulaire : onglet cité = « Gestion des surveillants / Correction »', template.includes('« Gestion des surveillants / Correction »'));

const picker = read('apps/web-app/src/components/federis/SchoolDirectoryPicker.tsx');
check('picker : recherche debounced + dropdown', picker.includes('directory/search') && picker.includes('setTimeout'));

const schoolsPage = read('apps/web-app/src/components/federis/FederisSchoolsPage.tsx');
check('écoles rattachées : picker répertoire intégré', schoolsPage.includes('SchoolDirectoryPicker'));
check('écoles rattachées : création provisoire POST /provisional', schoolsPage.includes("'/federis/patronat/schools/provisional'"));
check('écoles rattachées : bloc invitation transmissible (copier)', schoolsPage.includes('Copier le message'));
check('écoles rattachées : badge PROVISIONAL', schoolsPage.includes("PROVISIONAL: {"));

const centersPage = read('apps/web-app/src/components/federis/FederisCentersPage.tsx');
check('centres : picker répertoire + pré-remplissage', centersPage.includes('SchoolDirectoryPicker') && centersPage.includes('pickDirectoryCenter'));
check('centres : multi-centres expliqué', centersPage.includes('PLUSIEURS centres'));
check('centres : onglet « Gestion des surveillants / Correction »', centersPage.includes('Gestion des surveillants / Correction'));

// ══════════════════════════════════════════════════════════════════════
console.log(`\n═══ RÉSULTAT : ${pass} OK / ${fail} ÉCHEC(S) ═══`);
process.exit(fail > 0 ? 1 : 0);
