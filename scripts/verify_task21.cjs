#!/usr/bin/env node
/**
 * verify_task21.cjs — Vérification de la Task 21
 *
 * 1. FIX BUILD VERCEL : globals.css bloc non fermé (ligne 1571) → tous les
 *    blocs du fichier sont fermés (parseur dédié commentaires/chaînes).
 * 2. RUNTIME — Règle épreuve préparée : computeEpreuvePreparedMap extrait de
 *    federis-grades.service.ts + normalizeSubjectName de federis-subjects
 *    (extraction par équilibrage d'accolades — teste le VRAI code source) :
 *    correspondance par subjectId (lien catalogue), nom normalisé, code,
 *    marquage manuel « déjà préparée », combinaisons.
 * 3. RUNTIME — Comptes provisoires : generateTempPassword / slugifyName
 *    (extraction de federis-saisie.service.ts) — longueur, alphabet sans
 *    caractères ambigus, slug accents/espaces.
 * 4. Contrôles structurels backend : endpoints saisie (7), mark-prepared /
 *    unmark-prepared / live, module enregistré, rôle portail PATRONAT,
 *    normalisation SAISIE_NOTES, provisionnement automatique (assign +
 *    manuel), registre hydraté (saisieAccount), verrou bulkSaveGrades.
 * 5. Contrôles structurels web : route /federis/saisie + loading, nav,
 *    redirection login, matrice de permissions, onglet Suivi temps réel,
 *    colonnes verrouillées + bouton « Marquer comme déjà préparée »,
 *    sélecteurs centre/salle secrétariat, panneau identifiants, actions de
 *    compte (geler/réactiver/MDP/supprimer).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = '/home/z/my-project/ah';
const API = path.join(ROOT, 'apps/api-server/src');
const WEB = path.join(ROOT, 'apps/web-app/src');
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

/** Extrait une fonction exportée COMPLÈTE (async? function name(params) {…})
 *  par équilibrage : saute la liste de paramètres (parenthèses) puis capture
 *  le corps (accolades) — les types inline des paramètres contiennent des
 *  accolades. Retourne depuis le mot-clé async/function jusqu'à la dernière
 *  accolade fermante. */
function extractFunction(src, name) {
  const marker = `function ${name}`;
  const idx = src.indexOf(marker);
  if (idx === -1) throw new Error(`Fonction ${name} introuvable`);
  // Début : inclure le modificateur async éventuel (« async function »)
  let fnStart = idx;
  if (fnStart >= 6 && src.slice(fnStart - 6, fnStart) === 'async ') fnStart -= 6;
  // 1. Sauter les paramètres : première '(' → ')' équilibrée
  let i = src.indexOf('(', idx);
  if (i === -1) throw new Error(`Paramètres introuvables pour ${name}`);
  let pDepth = 0;
  let paramEnd = -1;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(') pDepth++;
    if (c === ')') {
      pDepth--;
      if (pDepth === 0) { paramEnd = i; break; }
    }
  }
  if (paramEnd === -1) throw new Error(`Paramètres non fermés pour ${name}`);
  // 2. Corps : première '{' après ')' → '}' équilibrée (chaînes ignorées)
  const start = src.indexOf('{', paramEnd);
  let depth = 0;
  let j = start;
  let inStr = null;
  while (j < src.length) {
    const c = src[j];
    if (inStr) {
      if (c === '\\') { j += 2; continue; }
      if (c === inStr) inStr = null;
      j++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; j++; continue; }
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(fnStart, j + 1);
    }
    j++;
  }
  throw new Error(`Bloc non fermé pour ${name}`);
}

// ══════════════════════════════════════════════════════════════════════
console.log('\n── 1. FIX BUILD VERCEL — globals.css ──');
{
  const css = read(path.join(WEB, 'app/globals.css'));
  // Parseur : commentaires + chaînes ignorés, accolades équilibrées
  let depth = 0, inComment = false, inString = null, ok = true, line = 1;
  for (let i = 0; i < css.length; i++) {
    const c = css[i], n = css[i + 1];
    if (c === '\n') { line++; continue; }
    if (!inString && !inComment && c === '/' && n === '*') { inComment = true; i++; continue; }
    if (inComment) { if (c === '*' && n === '/') { inComment = false; i++; } continue; }
    if (!inString && (c === '"' || c === "'")) { inString = c; continue; }
    if (inString) { if (c === '\\') i++; else if (c === inString) inString = null; continue; }
    if (c === '{') depth++;
    if (c === '}') depth--;
    if (depth < 0) { ok = false; break; }
  }
  check('globals.css : tous les blocs fermés (build Vercel)', ok && depth === 0 && !inComment && !inString);
}

// ══════════════════════════════════════════════════════════════════════
console.log('\n── 2. RUNTIME — Règle épreuve préparée ──');
{
  const subjectsSrc = read(path.join(API, 'federis/federis-subjects.service.ts'));
  const gradesSrc = read(path.join(API, 'federis/federis-grades.service.ts'));
  const normSrc = extractFunction(subjectsSrc, 'normalizeSubjectName');
  const out = ts.transpileModule(
    `const { randomInt } = require('crypto');\n${normSrc}\n${extractFunction(gradesSrc, 'computeEpreuvePreparedMap')}\nmodule.exports = { normalizeSubjectName, computeEpreuvePreparedMap };`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  );
  const tmp = '/tmp/task21_prepared_map.cjs';
  fs.writeFileSync(tmp, out.outputText);
  delete require.cache[require.resolve(tmp)];
  const { computeEpreuvePreparedMap } = require(tmp);

  const subjects = [
    { id: 's1', code: 'FR', name: 'Français', metadata: { sourceSubjectId: 'cat-fr' } },
    { id: 's2', code: 'MATH', name: 'Mathématiques', metadata: {} },
    { id: 's3', code: 'RED', name: 'Rédaction', metadata: {} },
    { id: 's4', code: 'HIST', name: 'Histoire-Géographie', metadata: { epreuvePreparedAt: '2026-10-01T10:00:00Z' } },
    { id: 's5', code: 'ANG', name: 'Anglais', metadata: {} },
  ];
  const prisma = {
    federisExamPaper: {
      findMany: async () => [
        { subjectId: 'cat-fr', subject: null },           // lien catalogue exact
        { subjectId: null, subject: 'mathematiques' },    // nom normalisé (accents)
        { subjectId: null, subject: 'RED' },              // nom = code de la matière
        { subjectId: 'cat-x', subject: 'Autre' },
      ],
    },
  };
  computeEpreuvePreparedMap(prisma, 'T1', 'Y1', 'CEP', subjects).then((m) => {
    check('Lien catalogue (sourceSubjectId → paper.subjectId) → préparée [paper]', m.get('s1')?.prepared === true && m.get('s1')?.source === 'paper');
    check('Nom normalisé (Mathématiques ≈ mathematiques) → préparée [paper]', m.get('s2')?.prepared === true && m.get('s2')?.source === 'paper');
    check('Nom de l’épreuve = code matière (RED) → préparée [paper]', m.get('s3')?.prepared === true && m.get('s3')?.source === 'paper');
    check('Marquage manuel « déjà préparée » → préparée [manual]', m.get('s4')?.prepared === true && m.get('s4')?.source === 'manual');
    check('Aucune épreuve, aucun marquage → NON préparée', m.get('s5')?.prepared === false && m.get('s5')?.source === null);

    // ── 3. Comptes provisoires (génération) ──
    console.log('\n── 3. RUNTIME — Comptes provisoires ──');
    const saisieSrc = read(path.join(API, 'federis/federis-saisie.service.ts'));
    const out2 = ts.transpileModule(
      `const { randomInt } = require('crypto');\n${extractFunction(saisieSrc, 'generateTempPassword')}\n${extractFunction(saisieSrc, 'slugifyName')}\nmodule.exports = { generateTempPassword, slugifyName };`,
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
    );
    const tmp2 = '/tmp/task21_pwd.cjs';
    fs.writeFileSync(tmp2, out2.outputText);
    delete require.cache[require.resolve(tmp2)];
    const { generateTempPassword, slugifyName } = require(tmp2);

    const AMBIGUOUS = /[O0Il1|]/;
    let pwdOk = true;
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword();
      if (p.length !== 10 || AMBIGUOUS.test(p)) { pwdOk = false; break; }
    }
    check('generateTempPassword : 10 caractères, sans caractères ambigus (200 tirages)', pwdOk);
    check('slugifyName : « Jean-Pierre Éric » → jean.pierre.eric', slugifyName('Jean-Pierre Éric') === 'jean.pierre.eric');
    check('slugifyName : null → chaîne vide', slugifyName(null) === '');
    check('slugifyName : tronque à 24 caractères', slugifyName('a'.repeat(40)).length <= 24);

    runStructural();
  }).catch((e) => {
    console.log('  ❌ ERREUR RUNTIME computeEpreuvePreparedMap :', e.message);
    fail++;
    runStructural();
  });
}

// ══════════════════════════════════════════════════════════════════════
function runStructural() {
  console.log('\n── 4. BACKEND — structure ──');
  const saisieSvc = read(path.join(API, 'federis/federis-saisie.service.ts'));
  const saisieCtl = read(path.join(API, 'federis/federis-saisie.controller.ts'));
  const gradesSvc = read(path.join(API, 'federis/federis-grades.service.ts'));
  const gradesCtl = read(path.join(API, 'federis/federis-grades.controller.ts'));
  const supSvc = read(path.join(API, 'federis/federis-supervisors.service.ts'));
  const moduleSrc = read(path.join(API, 'federis/federis.module.ts'));
  const authSrc = read(path.join(API, 'auth/auth.service.ts'));
  const rolesSrc = read(path.join(API, 'federis/federis-roles.ts'));

  // Service saisie
  check('Service saisie : rôle PATRONAT_SAISIE_NOTES', saisieSvc.includes("SAISIE_USER_ROLE = 'PATRONAT_SAISIE_NOTES'"));
  check('Service saisie : provisionAccountForSupervisor (idempotent : exists/reactivated/created)', saisieSvc.includes('provisionAccountForSupervisor') && saisieSvc.includes("'reactivated'") && saisieSvc.includes("'exists'"));
  check('Service saisie : identifiant JAMAIS l’email réel (domaine dédié @saisie-examen.bj)', saisieSvc.includes('SAISIE_LOGIN_DOMAIN') && saisieSvc.includes('@saisie-examen.bj'));
  check('Service saisie : bcrypt 10 rounds (pattern federis-users)', saisieSvc.includes('bcrypt.hash(tempPassword, 10)'));
  check('Service saisie : myAssignments (périmètre centre + salle)', saisieSvc.includes('myAssignments') && saisieSvc.includes('roomId ? { roomId } : {}'));
  check('Service saisie : garde épreuve préparée dans la saisie secrétaire', saisieSvc.includes('computeEpreuvePreparedMap') && saisieSvc.includes('notes bloquées'));
  check('Service saisie : verrou soumission (cellules SUBMITTED non modifiables)', saisieSvc.includes('submittedCells'));
  check('Service saisie : submit scoped (DRAFT → SUBMITTED du périmètre)', saisieSvc.includes("data: { status: 'SUBMITTED' }"));
  check('Service saisie : getLive (suivi temps réel + activité récente)', saisieSvc.includes('getLive') && saisieSvc.includes('recentActivity'));
  check('Service saisie : gestion compte freeze/reactivate/reset-password/delete', saisieSvc.includes("'freeze'") && saisieSvc.includes("'reactivate'") && saisieSvc.includes("'reset-password'") && saisieSvc.includes("'delete'"));

  // Contrôleur saisie
  check('Contrôleur saisie : GET /federis/saisie/me', saisieCtl.includes("@Get('saisie/me')"));
  check('Contrôleur saisie : POST bulk + submit de l’affectation', saisieCtl.includes('saisie/assignments/:supervisorId/grades/bulk') && saisieCtl.includes('saisie/assignments/:supervisorId/submit'));
  check('Contrôleur saisie : provision + freeze + reactivate + reset + delete', saisieCtl.includes('provision-account') && saisieCtl.includes('account/freeze') && saisieCtl.includes('account/reactivate') && saisieCtl.includes('account/reset-password') && saisieCtl.includes("@Delete('supervisors/:id/account')"));

  // Grades
  check('Grades : computeEpreuvePreparedMap exporté + GradeSubjectLite.epreuvePrepared', gradesSvc.includes('export async function computeEpreuvePreparedMap') && gradesSvc.includes('epreuvePrepared: boolean'));
  check('Grades : buildGradesDataset expose epreuvePrepared/preparedSource par matière', gradesSvc.includes('preparedMap.get(s.id)?.prepared') && gradesSvc.includes('preparedSource'));
  check('Grades : bulkSaveGrades REFUSE les matières non préparées', gradesSvc.includes('notes bloquées') && gradesSvc.includes('unprepared'));
  check('Grades : markSubjectPrepared + unmarkSubjectPrepared (metadata)', gradesSvc.includes('markSubjectPrepared') && gradesSvc.includes('unmarkSubjectPrepared') && gradesSvc.includes('epreuvePreparedAt'));
  check('Contrôleur grades : mark-prepared + unmark-prepared + live', gradesCtl.includes('mark-prepared') && gradesCtl.includes('unmark-prepared') && gradesCtl.includes("@Get('exams/:examId/grades/live')"));

  // Supervisors
  check('Supervisors : provisionnement AUTO après répartition (post=SECRETARIAT)', supSvc.includes('provisionAccountsForSupervisors(tenantId, secretariatIds, userId)'));
  check('Supervisors : provisionnement manuel (createSupervisor → provisionedAccount)', supSvc.includes('provisionedAccount'));
  check('Supervisors : registre hydraté saisieAccount', supSvc.includes('hydrateAccounts') && supSvc.includes('saisieAccount: accounts.get(s.id)'));
  check('Supervisors : notification secrétariat avec centre/salle', supSvc.includes("post === 'SECRETARIAT'"));

  // Module + auth + rôles
  check('Module : FederisSaisieService (provider) + FederisSaisieController', moduleSrc.includes('FederisSaisieService') && moduleSrc.includes('FederisSaisieController'));
  check('Auth : PATRONAT_SAISIE_NOTES autorisé sur le portail PATRONAT', authSrc.includes("'PATRONAT_SAISIE_NOTES',"));
  check('Rôles : fonction SAISIE_NOTES + normalisation + libellé', rolesSrc.includes("'SAISIE_NOTES'") && rolesSrc.includes("case 'PATRONAT_SAISIE_NOTES'") && rolesSrc.includes('Secrétaire de saisie'));

  // ════════════════════════════════════════════════════════════════════
  console.log('\n── 5. WEB — structure ──');
  const perms = read(path.join(WEB, 'lib/patronat/permissions.ts'));
  const layout = read(path.join(WEB, 'components/federis/FederisLayout.tsx'));
  const loginPage = read(path.join(WEB, 'app/(patronat)/federis/login/page.tsx'));
  const saisiePage = read(path.join(WEB, 'components/federis/FederisSaisiePage.tsx'));
  const sheetTab = read(path.join(WEB, 'components/federis/FederisGradeSheetTab.tsx'));
  const gradesPage = read(path.join(WEB, 'components/federis/FederisGradesPage.tsx'));
  const liveTab = read(path.join(WEB, 'components/federis/FederisGradeLiveTab.tsx'));
  const supTab = read(path.join(WEB, 'components/federis/FederisSupervisorsTab.tsx'));
  const saisieRoute = read(path.join(WEB, 'app/(patronat)/federis/saisie/page.tsx'));
  const saisieLoading = read(path.join(WEB, 'app/(patronat)/federis/saisie/loading.tsx'));

  check('Permissions : PATRONAT_SAISIE_NOTES + SAISIE_NOTES + /saisie réservé', perms.includes("'PATRONAT_SAISIE_NOTES'") && perms.includes("'SAISIE_NOTES'") && perms.includes("'/saisie': ['SAISIE_NOTES']"));
  check('Layout : entrée de nav « Saisie des notes » (filtrée par fonction)', layout.includes("subPath: '/saisie'"));
  check('Login : redirection automatique /saisie pour les secrétaires', loginPage.includes("PATRONAT_SAISIE_NOTES") && loginPage.includes("'/saisie'"));
  check('Route /federis/saisie : page + loading (squelette chrome)', saisieRoute.includes('FederisSaisiePage') && saisieLoading.includes('FederisLoadingShell'));

  check('Page saisie : carte examen CEP/BEPC/BAC/CAP + session + périmètre centre/salle', saisiePage.includes('EXAM_TYPE_LABELS') && saisiePage.includes('scopeLabel') && saisiePage.includes('academicYearLabel') && saisiePage.includes('Session'));
  check('Page saisie : grille candidats × matières + ABS + pagination', saisiePage.includes('handleScore') && saisiePage.includes('ABS') && saisiePage.includes('PAGE_SIZE'));
  check('Page saisie : matières verrouillées (règle épreuve préparée)', saisiePage.includes('epreuvePrepared') && saisiePage.includes('🔒'));
  check('Page saisie : enregistrer + soumettre (verrou après soumission)', saisiePage.includes('Enregistrer') && saisiePage.includes('submit') && saisiePage.includes('Soumis'));

  check('Grille patronat : colonnes verrouillées + bandeau matières non préparées', sheetTab.includes('subjectLocked') && sheetTab.includes('Règle « épreuve préparée »'));
  check('Grille patronat : bouton « Marquer comme déjà préparée » + retrait', sheetTab.includes('Marquer comme déjà préparée') && sheetTab.includes('unmark-prepared'));
  check('Notes et moyennes : onglet « Suivi temps réel » branché', gradesPage.includes("'live'") && gradesPage.includes('Suivi temps réel') && gradesPage.includes('FederisGradeLiveTab'));
  check('Suivi live : polling 10 s + progression + statut + activité récente', liveTab.includes('POLL_INTERVAL_MS = 10000') && liveTab.includes('cellsEntered') && liveTab.includes('recentActivity'));
  check('Suivi live : actions compte (provisionner/geler/réactiver/MDP/supprimer)', liveTab.includes("'provision'") && liveTab.includes("'freeze'") && liveTab.includes("'reactivate'") && liveTab.includes("'reset-password'") && liveTab.includes("'delete'"));

  check('Supervisors : centre OBLIGATOIRE pour le secrétariat (répartition + manuel)', supTab.includes("(assignPost === 'SURVEILLANCE' || assignPost === 'SECRETARIAT') && !assignCenterId") && supTab.includes("manualForm.post === 'SECRETARIAT'") && supTab.includes('!manualForm.centerId'));
  check('Supervisors : sélecteurs centre/salle pour le secrétariat', supTab.includes("assignPost === 'SURVEILLANCE' || assignPost === 'SECRETARIAT'") && supTab.includes('Toutes les salles du centre'));
  check('Supervisors : panneau identifiants copiables (affichés une fois)', supTab.includes('provisionedAccounts') && supTab.includes('Copier les identifiants'));
  check('Supervisors : registre — colonne Compte saisie + actions', supTab.includes('Compte saisie') && supTab.includes('Provisionner') && supTab.includes('Geler') && supTab.includes('MDP'));
  check('Supervisors : formulaire manuel avec sélecteur de poste', supTab.includes('manualForm.post') && supTab.includes('POST_OPTIONS.map((o)'));
  check('Supervisors : ligne enseignant — centre/salle visible pour le secrétariat', supTab.includes("teacher.assigned.post !== 'CORRECTION' && teacher.assigned.center"));

  // ════════════════════════════════════════════════════════════════════
  console.log(`\n═══ RÉSULTAT : ${pass}/${pass + fail} ═══`);
  if (fail > 0) {
    console.log('❌ ÉCHECS — voir ci-dessus');
    process.exit(1);
  }
  console.log('✅ TOUT PASSE');
}
