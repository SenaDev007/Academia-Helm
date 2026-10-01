#!/usr/bin/env node
/**
 * ============================================================================
 * verify_task24.cjs — Relevés arrondis + suppression des NB + identifiant de
 *                     saisie = email de l'enseignant — Task 24
 * ============================================================================
 *
 * TROIS DEMANDES UTILISATEUR :
 *
 *   A. BORDER-RADIUS PROFESSIONNEL des tableaux des relevés de notes (module
 *      Notes et Moyennes) — plus de coins angles droits :
 *        · PDF backend (federis-pdf.service.ts, rendu Puppeteer/Chromium) :
 *          .civil (6px) · .cep-grid/.sec-grid (8px) · .decision (6px) via
 *          border-collapse: separate + border-spacing: 0 + cadre + radius +
 *          overflow: hidden ; filets internes 1px sur bordures droite/basse
 *          uniquement, dernier rang / dernière colonne sans filet.
 *        · Aperçus front (FederisGradeRelevesTab.tsx) : même motif en Tailwind
 *          (border-separate border-spacing-0 rounded-lg/md overflow-hidden).
 *
 *   B. SUPPRESSION DES NB des relevés (« nous n'aurons pas besoin de NB ») :
 *      les deux mentions « NB : … » (CEP : attestation 6 mois ; BEPC/BAC/CAP :
 *      rature/surcharge) disparaissent du PDF ET des aperçus, ainsi que la
 *      classe CSS .nb. Les règles d'admission CEP (bas de page) restent.
 *
 *   C. IDENTIFIANT DU COMPTE DE SAISIE (suivi temps réel secrétariat) :
 *      l'identifiant est désormais l'EMAIL RÉEL de l'enseignant
 *      (ExamSupervisor.email, repli Teacher.email via teacherId). Sans email
 *      → adresse SIMULÉE prenom.nom@academiafederis.com. Email déjà pris par
 *      le compte de saisie du MÊME enseignant (autre examen) → RÉUTILISATION
 *      du compte (un seul identifiant par enseignant) ; pris par un autre
 *      compte (Helm, patronat…) → repli simulé, puis suffixe numérique
 *      (prenom.nom2@…), puis repli déterministe prenom.nom.sec.{id}@….
 *
 * VÉRIFICATIONS :
 *   1. Structurels PDF backend (CSS arrondi, filets, sous-en-tête CEP
 *      rowSpan/colSpan, suppression NB + .nb, équilibre des accolades CSS).
 *   2. Structurels aperçus front (5 tableaux arrondis, CivilTable last,
 *      plus aucun NB, plus aucune cellule à bordure complète héritée).
 *   3. Structurels federis-saisie.service.ts (constante @academiafederis.com,
 *      4 helpers Task 24, appel + branche reuse, anciens patterns détruits,
 *      sorties anticipées exists/reactivated inchangées).
 *   4. ⭐ RUNTIME du VRAI code du service (extraction + transpilation SWC +
 *      harnais avec Prisma mocké) — 16 scénarios.
 *   5. SWC : syntaxe des 3 fichiers modifiés (config .swcrc du build Railway).
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = '/home/z/my-project/ah';
const swc = require('/home/z/my-project/ah/apps/api-server/node_modules/@swc/core');

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
}

/** Transpile via @swc/core avec la config .swcrc du api-server (erreur = throw). */
function swcCompile(code, isTsx) {
  return swc.transformSync(code, {
    jsc: {
      target: 'es2021',
      parser: { syntax: 'typescript', tsx: isTsx, decorators: true, dynamicImport: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
      keepClassNames: true,
    },
    module: { type: 'commonjs' },
    sourceMaps: false,
  });
}

(async () => {
console.log('════════════════════════════════════════════════════════════════');
console.log(' TASK 24 — RELEVÉS ARRONDIS · SUPPRESSION NB · LOGIN = EMAIL ENSEIGNANT');
console.log('════════════════════════════════════════════════════════════════');

// ─── 1. PDF backend — federis-pdf.service.ts ───────────────────────────────
console.log('\n── 1. PDF backend (federis-pdf.service.ts) ──');
const pdfPath = path.join(ROOT, 'apps/api-server/src/federis/federis-pdf.service.ts');
const pdfSrc = fs.readFileSync(pdfPath, 'utf8');

// Document HTML des relevés = du début de la méthode à la fin du fichier.
const docFnIdx = pdfSrc.indexOf('private buildReleveOfficialDocumentHtml(');
const docSrc = docFnIdx >= 0 ? pdfSrc.slice(docFnIdx) : '';
check('méthode buildReleveOfficialDocumentHtml trouvée', docFnIdx >= 0);

// B — suppression des NB (PDF + CSS .nb)
check('PDF : plus aucun « NB : » dans tout le service', !/NB :/.test(pdfSrc));
check('PDF : plus aucun <p class="nb">', !/class="nb"/.test(pdfSrc));
check('PDF : classe CSS .nb supprimée', !/\.nb \{/.test(docSrc));

// A — border-radius des 3 familles de tableaux
check('CSS .civil : separate + spacing 0 + cadre + radius 6px + overflow hidden',
  /\.civil \{[^}]*border-collapse: separate;[^}]*border-spacing: 0;[^}]*border: 1px solid #000;[^}]*border-radius: 6px;[^}]*overflow: hidden; \}/.test(docSrc));
check('CSS .civil : dernière colonne sans filet droit', /\.civil td:last-child \{ border-right: none; \}/.test(docSrc));
check('CSS .civil : dernier rang sans filet bas', /\.civil tr:last-child td \{ border-bottom: none; \}/.test(docSrc));
check('CSS .cep-grid/.sec-grid : separate + spacing 0 + cadre 2px + radius 8px + overflow hidden',
  /\.cep-grid, \.sec-grid \{[^}]*border-collapse: separate;[^}]*border-spacing: 0;[^}]*border: 2px solid #000;[^}]*border-radius: 8px;[^}]*overflow: hidden; \}/.test(docSrc));
check('CSS grilles : th/td en filets droite+basse (plus de border complet)',
  /\.cep-grid th, \.sec-grid th \{ border-right: 1px solid #000; border-bottom: 1px solid #000;/.test(docSrc)
  && /\.cep-grid td, \.sec-grid td \{ border-right: 1px solid #000; border-bottom: 1px solid #000;/.test(docSrc));
check('CSS grilles : dernière colonne / dernier rang sans filet',
  /\.cep-grid th:last-child, \.sec-grid th:last-child,/.test(docSrc)
  && /\.cep-grid td:last-child, \.sec-grid td:last-child \{ border-right: none; \}/.test(docSrc)
  && /\.cep-grid tr:last-child td, \.sec-grid tr:last-child td \{ border-bottom: none; \}/.test(docSrc));
check('CSS CEP : filet RÉTABLI sur la dernière cellule .sub (en-tête rowSpan/colSpan à 2 niveaux)',
  /\.cep-grid \.sub th:last-child \{ border-right: 1px solid #000; \}/.test(docSrc));
check('CSS .decision : separate + spacing 0 + cadre 1.5px + radius 6px + overflow hidden',
  /\.decision \{[^}]*border-collapse: separate;[^}]*border-spacing: 0;[^}]*border: 1\.5px solid #000;[^}]*border-radius: 6px;[^}]*overflow: hidden; \}/.test(docSrc));
check('CSS .decision : th en filet bas uniquement (colSpan 2)', /\.decision th \{ border-bottom: 1\.5px solid #000;/.test(docSrc));
check('CSS .decision : bords internes sans double ligne (last-child + last-row)',
  /\.decision td:last-child \{ border-right: none; \}/.test(docSrc)
  && /\.decision tr:last-child td \{ border-bottom: none; \}/.test(docSrc));
check('CSS .decision : vieille règle .single border:none détruite (le filet séparateur revient)',
  !/\.decision\.single td:first-child \{ border: none;/.test(docSrc));
check('CSS relevés : plus AUCUN border-collapse: collapse dans le document officiel',
  !/border-collapse: collapse/.test(docSrc));

// Équilibre des accolades du bloc <style> du document officiel
const styleMatch = docSrc.match(/<style>([\s\S]*?)<\/style>/);
if (check('bloc <style> du document officiel trouvé', !!styleMatch)) {
  const css = styleMatch[1];
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  check(`CSS document officiel équilibré (${open} accolades ouvrantes = ${close} fermantes)`, open === close && open > 20);
}

// ─── 2. Aperçus front — FederisGradeRelevesTab.tsx ──────────────────────────
console.log('\n── 2. Aperçus front (FederisGradeRelevesTab.tsx) ──');
const tabPath = path.join(ROOT, 'apps/web-app/src/components/federis/FederisGradeRelevesTab.tsx');
const tabSrc = fs.readFileSync(tabPath, 'utf8');

check('Front : plus aucun « NB : »', !/NB :/.test(tabSrc));
const roundedCount = (tabSrc.match(/border-separate border-spacing-0/g) || []).length;
check(`Front : 5 tableaux à coins arrondis border-separate + spacing 0 (trouvé ${roundedCount})`, roundedCount === 5);
const lgCount = (tabSrc.match(/rounded-lg overflow-hidden/g) || []).length;
const mdCount = (tabSrc.match(/rounded-md overflow-hidden/g) || []).length;
check(`Front : 2 grilles arrondies 8px (rounded-lg) — trouvé ${lgCount}`, lgCount === 2);
check(`Front : état civil + 2 décisions arrondis 6px (rounded-md) — trouvé ${mdCount}`, mdCount === 3);
check('Front : CivilRow accepte la prop last (dernier rang sans filet bas)',
  /function CivilRow\(\{ label, value, last \}/.test(tabSrc)
  && /'border-r', !last && 'border-b'/.test(tabSrc));
check('Front : CivilTable transmet last au dernier rang',
  /last=\{i === rows\.length - 1\}/.test(tabSrc));
check('Front : en-tête CEP — cellule « Note minimale exigée » garde son filet droit (rowSpan perf.)',
  /<th className="border-r border-b border-black px-2 py-1 text-\[9px\] font-bold uppercase">Note minimale exigée<\/th>/.test(tabSrc));
check('Front : dernier rang des grilles sans filet bas (rowB conditionnel)',
  /i < releve\.lines\.length - 1 \? 'border-b' : ''/.test(tabSrc)
  && /i < lines\.length - 1 \? 'border-b' : ''/.test(tabSrc));
check('Front : plus aucune cellule à bordure complète « border border-black » (grilles)',
  !/className="border border-black/.test(tabSrc));
check('Front : plus aucune cellule décision « border-2 border-black px-3 » (cadre déplacé sur la table)',
  !/className="border-2 border-black px-3/.test(tabSrc));
check('Front : règles d\'admission CEP conservées (bas de page, hors NB)',
  /Est déclaré\(e\) admis\(e\) au CEP/.test(tabSrc));

// ─── 3. Backend saisie — federis-saisie.service.ts ──────────────────────────
console.log('\n── 3. Identifiant compte de saisie (federis-saisie.service.ts) ──');
const saisiePath = path.join(ROOT, 'apps/api-server/src/federis/federis-saisie.service.ts');
const saisieSrc = fs.readFileSync(saisiePath, 'utf8');

check('constante SAISIE_FALLBACK_EMAIL_DOMAIN = @academiafederis.com',
  /const SAISIE_FALLBACK_EMAIL_DOMAIN = '@academiafederis\.com';/.test(saisieSrc));
check('ancien domaine @saisie-examen.bj totalement supprimé', !/saisie-examen\.bj/.test(saisieSrc));
check('helper isEmail (format minimal local@domaine.tld)', /function isEmail\(/.test(saisieSrc));
check('méthode resolveTeacherEmail (ExamSupervisor.email → repli Teacher.email)',
  /private async resolveTeacherEmail\(/.test(saisieSrc));
check('méthode resolveSaisieAccount (4 niveaux : réel → reuse → simulée → suffixe/sec)',
  /private async resolveSaisieAccount\(/.test(saisieSrc));
check('méthode isSameTeacherAsAccount (teacherId puis noms normalisés)',
  /private async isSameTeacherAsAccount\(/.test(saisieSrc));
check('méthode attachExistingSaisieAccount (rattachement + réactivation)',
  /private async attachExistingSaisieAccount\(/.test(saisieSrc));
check('provisionAccountForSupervisor appelle resolveSaisieAccount',
  /const resolved = await this\.resolveSaisieAccount\(tenantId, supervisor\);/.test(saisieSrc));
check('branche reuse → attachExistingSaisieAccount',
  /return this\.attachExistingSaisieAccount\(tenantId, supervisor, resolved\.user, createdBy\);/.test(saisieSrc));
check('création avec l\'identifiant résolu (email: login)', /email: login,/.test(saisieSrc));
check('ancien login préfixé .sec.{slice(0,6)} détruit', !/supervisor\.id\.slice\(0, 6\)/.test(saisieSrc));
check('sorties anticipées inchangées (exists / réactivation du même compte)',
  /md\.provisionalAccount\?\.userId/.test(saisieSrc)
  && /FEDERIS_SAISIE_ACCOUNT_REACTIVATED/.test(saisieSrc)
  && /FEDERIS_SAISIE_ACCOUNT_CREATED/.test(saisieSrc));
check('audit du rattachement (FEDERIS_SAISIE_ACCOUNT_ATTACHED)', /FEDERIS_SAISIE_ACCOUNT_ATTACHED/.test(saisieSrc));

// ─── 4. ⭐ RUNTIME — harnais sur le VRAI code du service ────────────────────
console.log('\n── 4. ⭐ RUNTIME — résolution de l\'identifiant (vrai code, Prisma mocké) ──');

function extract(fromMarker, toMarker) {
  const a = saisieSrc.indexOf(fromMarker);
  const b = saisieSrc.indexOf(toMarker, a);
  if (a < 0 || b < 0 || b <= a) throw new Error(`extraction impossible : ${fromMarker.slice(0, 40)}…`);
  return saisieSrc.slice(a, b);
}

let vmSandbox = null;
try {
  const constLine = saisieSrc.match(/const SAISIE_FALLBACK_EMAIL_DOMAIN = '@academiafederis\.com';/)[0];
  const helpers = extract("/** Génère un mot de passe temporaire", "@Injectable()");
  const methods = extract("  // ⭐ Task 24 — Résolution de l'identifiant", "  /** Hydrate les lignes du registre");

  const harnessTs = `
const { randomInt } = require('crypto');
const bcrypt = { hash: async (pw, rounds) => 'bcrypt(' + pw + ',' + rounds + ')' };
const SAISIE_USER_ROLE = 'PATRONAT_SAISIE_NOTES';
${constLine}
${helpers}
class SaisieHarness {
  constructor(prisma) {
    this.prisma = prisma;
    this.logger = { log: (m) => { globalThis.__LOGS.push(m); } };
  }
  async audit(tenantId, userId, action, resourceId, newData) {
    globalThis.__AUDITS.push({ tenantId, userId, action, resourceId, newData });
  }
${methods}
}
module.exports = { SaisieHarness, slugifyName, isEmail, generateTempPassword };
`;

  const compiled = swcCompile(harnessTs, false).code;
  vmSandbox = { module: { exports: {} }, require, console, __LOGS: [], __AUDITS: [] };
  vm.runInNewContext(compiled, vmSandbox);
  check('harnais compilé (SWC) et chargé — vrai code du service extrait',
    !!vmSandbox.module.exports && !!vmSandbox.module.exports.SaisieHarness);
} catch (e) {
  check('harnais compilé (SWC) et chargé', false, e.message);
}

if (vmSandbox && vmSandbox.module.exports && vmSandbox.module.exports.SaisieHarness) {
  const { SaisieHarness, isEmail, generateTempPassword } = vmSandbox.module.exports;

  /** Prisma mocké : users par email, teachers par id, affectations par compte. */
  function makePrama({ users = {}, teachers = {}, byAccount = {} } = {}) {
    const calls = { userUpdate: [], supervisorUpdate: [], teacherFind: [] };
    const usersById = {};
    for (const u of Object.values(users)) usersById[u.id] = u;
    return {
      calls,
      user: {
        findUnique: async ({ where }) =>
          where.email !== undefined ? (users[where.email] ?? null) : (usersById[where.id] ?? null),
        update: async (args) => {
          calls.userUpdate.push(args);
          return { ...usersById[args.where.id], ...args.data };
        },
      },
      teacher: {
        findUnique: async ({ where }) => {
          calls.teacherFind.push(where.id);
          return teachers[where.id] ?? null;
        },
      },
      examSupervisor: {
        findFirst: async ({ where }) => byAccount[where.userId] ?? null,
        update: async (args) => {
          calls.supervisorUpdate.push(args);
          return {};
        },
      },
    };
  }

  const sup = (over = {}) => ({
    id: 'SUP-123',
    firstName: 'Jean',
    lastName: 'Dupont',
    email: null,
    teacherId: null,
    createdBy: 'CREA-1',
    metadata: { foo: 'bar' },
    exam: { id: 'EX-1', name: 'CEP 2027', code: 'CEP-27' },
    center: { id: 'CT-1', name: 'Centre de Parakou' },
    ...over,
  });

  // S1 — email réel de l'affectation, libre → login = email réel
  {
    const p = makePrama();
    const h = new SaisieHarness(p);
    const r = await h.resolveSaisieAccount('TEN-P', sup({ email: 'jean.dupont@ecole.bj' }));
    check('S1 email réel libre → login = jean.dupont@ecole.bj',
      r.kind === 'login' && r.login === 'jean.dupont@ecole.bj');
  }

  // S2 — email absent de l'affectation → repli Teacher.email (normalisé)
  {
    const p = makePrama({ teachers: { 'T-1': { email: '  Jean.Dupont@Ecole.BJ ' } } });
    const h = new SaisieHarness(p);
    const r = await h.resolveSaisieAccount('TEN-P', sup({ teacherId: 'T-1' }));
    check('S2 repli Teacher.email normalisé en minuscules → jean.dupont@ecole.bj',
      r.kind === 'login' && r.login === 'jean.dupont@ecole.bj' && p.calls.teacherFind.includes('T-1'));
  }

  // S3 — aucun email → adresse simulée prenom.nom@academiafederis.com
  {
    const p = makePrama();
    const h = new SaisieHarness(p);
    const r = await h.resolveSaisieAccount('TEN-P', sup());
    check('S3 sans email → jean.dupont@academiafederis.com',
      r.kind === 'login' && r.login === 'jean.dupont@academiafederis.com');
  }

  // S4 — email réel déjà pris par un compte Helm (autre rôle) → simulée
  {
    const p = makePrama({
      users: { 'jean.dupont@ecole.bj': { id: 'U-HELM', role: 'TEACHER', tenantId: 'TEN-ECOLE', status: 'active' } },
    });
    const h = new SaisieHarness(p);
    const r = await h.resolveSaisieAccount('TEN-P', sup({ email: 'jean.dupont@ecole.bj' }));
    check('S4 email pris par un compte Helm → repli jean.dupont@academiafederis.com',
      r.kind === 'login' && r.login === 'jean.dupont@academiafederis.com');
  }

  // S5 — email = compte de saisie du MÊME enseignant (teacherId) → réutilisation
  {
    const p = makePrama({
      users: { 'jean.dupont@ecole.bj': { id: 'U-1', email: 'jean.dupont@ecole.bj', role: 'PATRONAT_SAISIE_NOTES', tenantId: 'TEN-P', status: 'active' } },
      byAccount: { 'U-1': { teacherId: 'T-1', firstName: 'Jean', lastName: 'Dupont' } },
    });
    const h = new SaisieHarness(p);
    const r = await h.resolveSaisieAccount('TEN-P', sup({ email: 'jean.dupont@ecole.bj', teacherId: 'T-1' }));
    check('S5 email du compte de saisie du MÊME enseignant → réutilisation (kind=reuse)',
      r.kind === 'reuse' && r.user.id === 'U-1' && r.user.email === 'jean.dupont@ecole.bj');
  }

  // S6 — compte de saisie d'un AUTRE enseignant (teacherId différent) → pas de réutilisation
  {
    const p = makePrama({
      users: { 'jean.dupont@ecole.bj': { id: 'U-2', role: 'PATRONAT_SAISIE_NOTES', tenantId: 'TEN-P', status: 'active' } },
      byAccount: { 'U-2': { teacherId: 'T-AUTRE', firstName: 'Jean', lastName: 'Dupont' } },
    });
    const h = new SaisieHarness(p);
    const r = await h.resolveSaisieAccount('TEN-P', sup({ email: 'jean.dupont@ecole.bj', teacherId: 'T-1' }));
    check('S6 homonyme (teacherId différent) → PAS de réutilisation → simulée',
      r.kind === 'login' && r.login === 'jean.dupont@academiafederis.com');
  }

  // S7 — compte de saisie d'un autre TENANT → pas de réutilisation
  {
    const p = makePrama({
      users: { 'jean.dupont@ecole.bj': { id: 'U-3', role: 'PATRONAT_SAISIE_NOTES', tenantId: 'TEN-AUTRE', status: 'active' } },
      byAccount: { 'U-3': { teacherId: 'T-1', firstName: 'Jean', lastName: 'Dupont' } },
    });
    const h = new SaisieHarness(p);
    const r = await h.resolveSaisieAccount('TEN-P', sup({ email: 'jean.dupont@ecole.bj', teacherId: 'T-1' }));
    check('S7 compte de saisie d\'un autre tenant → PAS de réutilisation → simulée',
      r.kind === 'login' && r.login === 'jean.dupont@academiafederis.com');
  }

  // S8 — simulée prise aussi → suffixe numérique
  {
    const p = makePrama({
      users: {
        'jean.dupont@ecole.bj': { id: 'U-H', role: 'TEACHER', tenantId: 'TEN-E', status: 'active' },
        'jean.dupont@academiafederis.com': { id: 'U-S', role: 'TEACHER', tenantId: 'TEN-E', status: 'active' },
      },
    });
    const h = new SaisieHarness(p);
    const r = await h.resolveSaisieAccount('TEN-P', sup({ email: 'jean.dupont@ecole.bj' }));
    check('S8 réel ET simulée pris → suffixe jean.dupont2@academiafederis.com',
      r.kind === 'login' && r.login === 'jean.dupont2@academiafederis.com');
  }

  // S9 — tous les suffixes pris → repli déterministe prenom.nom.sec.{id}
  {
    const users = { 'jean.dupont@academiafederis.com': { id: 'U-X', role: 'TEACHER', tenantId: 'TEN-E', status: 'active' } };
    for (let n = 2; n <= 25; n++) users[`jean.dupont${n}@academiafederis.com`] = { id: `U-${n}`, role: 'TEACHER', tenantId: 'TEN-E', status: 'active' };
    const p = makePrama({ users });
    const h = new SaisieHarness(p);
    const r = await h.resolveSaisieAccount('TEN-P', sup());
    check('S9 tous les suffixes pris → jean.dupont.sec.SUP-123@academiafederis.com',
      r.kind === 'login' && r.login === 'jean.dupont.sec.SUP-123@academiafederis.com');
  }

  // S10 — noms vides → enseignant@academiafederis.com
  {
    const p = makePrama();
    const h = new SaisieHarness(p);
    const r = await h.resolveSaisieAccount('TEN-P', sup({ firstName: '', lastName: '   ' }));
    check('S10 noms vides → enseignant@academiafederis.com',
      r.kind === 'login' && r.login === 'enseignant@academiafederis.com');
  }

  // S11 — accents et tirets → slug normalisé (Jean-Pierre Éric Dupont)
  {
    const p = makePrama();
    const h = new SaisieHarness(p);
    const r = await h.resolveSaisieAccount('TEN-P', sup({ firstName: 'Jean-Pierre Éric', lastName: 'Dupont' }));
    check('S11 accents/tirets → jean.pierre.eric.dupont@academiafederis.com',
      r.kind === 'login' && r.login === 'jean.pierre.eric.dupont@academiafederis.com');
  }

  // S12 — email invalide sur l'affectation → ignoré, repli Teacher
  {
    const p = makePrama({ teachers: { 'T-9': { email: 'prof@school.bj' } } });
    const h = new SaisieHarness(p);
    const r = await h.resolveSaisieAccount('TEN-P', sup({ email: 'pas-un-email', teacherId: 'T-9' }));
    check('S12 email invalide ignoré → repli Teacher prof@school.bj',
      r.kind === 'login' && r.login === 'prof@school.bj');
  }

  // S13 — attachExistingSaisieAccount : compte ACTIF du même enseignant
  {
    vmSandbox.__AUDITS = []; vmSandbox.__LOGS = [];
    const p = makePrama();
    const h = new SaisieHarness(p);
    const res = await h.attachExistingSaisieAccount(
      'TEN-P',
      sup({ email: 'jean.dupont@ecole.bj' }),
      { id: 'U-77', email: 'jean.dupont@ecole.bj', status: 'active' },
      'CREA-2',
    );
    const upd = p.calls.supervisorUpdate[0];
    check('S13 rattachement compte actif → status exists, sans MDP',
      res.status === 'exists' && res.tempPassword === null && res.login === 'jean.dupont@ecole.bj' && res.userId === 'U-77');
    check('S13 affectation mise à jour (userId + metadata.provisionalAccount.login, clés existantes conservées)',
      upd && upd.where.id === 'SUP-123' && upd.data.userId === 'U-77'
      && upd.data.metadata.foo === 'bar'
      && upd.data.metadata.provisionalAccount.login === 'jean.dupont@ecole.bj'
      && upd.data.metadata.provisionalAccount.createdBy === 'CREA-2');
    check('S13 audit FEDERIS_SAISIE_ACCOUNT_ATTACHED + contexte examen/centre',
      vmSandbox.__AUDITS[0]?.action === 'FEDERIS_SAISIE_ACCOUNT_ATTACHED'
      && res.examName === 'CEP 2027' && res.centerName === 'Centre de Parakou');
    check('S13 compte actif JAMAIS modifié (pas d\'update user)', p.calls.userUpdate.length === 0);
  }

  // S14 — attachExistingSaisieAccount : compte GELÉ → réactivation + MDP
  {
    vmSandbox.__AUDITS = [];
    const p = makePrama();
    const h = new SaisieHarness(p);
    const res = await h.attachExistingSaisieAccount(
      'TEN-P',
      sup(),
      { id: 'U-88', email: 'jean.dupont@academiafederis.com', status: 'suspended' },
    );
    const uUpd = p.calls.userUpdate[0];
    check('S14 rattachement compte gelé → status reactivated + MDP temporaire 10 car. retourné une fois',
      res.status === 'reactivated' && typeof res.tempPassword === 'string' && res.tempPassword.length === 10);
    check('S14 user réactivé (status active + nouveau hash)', uUpd && uUpd.where.id === 'U-88' && uUpd.data.status === 'active' && /^bcrypt\(/.test(uUpd.data.passwordHash));
    check('S14 audit FEDERIS_SAISIE_ACCOUNT_REACTIVATED', vmSandbox.__AUDITS[0]?.action === 'FEDERIS_SAISIE_ACCOUNT_REACTIVATED');
  }

  // S15 — isSameTeacherAsAccount : noms normalisés (création manuelle)
  {
    const p = makePrama({
      byAccount: { 'U-5': { teacherId: null, firstName: '  Jean ', lastName: 'DUPONT' } },
    });
    const h = new SaisieHarness(p);
    const same = await h.isSameTeacherAsAccount(sup({ teacherId: null }), 'U-5');
    const other = await h.isSameTeacherAsAccount(sup({ teacherId: null, lastName: 'Martin' }), 'U-5');
    check('S15 homonymie par noms normalisés (manuelle) : oui pour Jean Dupont, non pour Jean Martin', same === true && other === false);
  }

  // S16 — primitives : isEmail + generateTempPassword
  {
    check('S16 isEmail : valide/invalide',
      isEmail('jean.dupont@ecole.bj') === true && isEmail('a@b') === false
      && isEmail('pas-un-email') === false && isEmail(null) === false && isEmail('') === false);
    const pw = generateTempPassword(12);
    const okChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]{12}$/.test(pw);
    check('S16 MDP temporaire : 12 car. sans ambigus (pas de I,l,O,0,1)', okChars);
  }
}

// ─── 5. SWC — syntaxe des 3 fichiers modifiés ───────────────────────────────
console.log('\n── 5. SWC — syntaxe des fichiers modifiés (config .swcrc Railway) ──');
for (const [label, file] of [
  ['federis-pdf.service.ts', pdfPath],
  ['federis-saisie.service.ts', saisiePath],
  ['FederisGradeRelevesTab.tsx', tabPath],
]) {
  try {
    swcCompile(fs.readFileSync(file, 'utf8'), file.endsWith('.tsx'));
    check(`transpile SWC OK — ${label}`, true);
  } catch (e) {
    check(`transpile SWC OK — ${label}`, false, e.message);
  }
}

// ─── Résumé ─────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════════════════════');
console.log(` RÉSULTAT : ${pass} ✅ / ${fail} ❌`);
if (fail > 0) {
  console.log(' ÉCHEC — corriger avant commit.');
  process.exit(1);
}
console.log(' TASK 24 VALIDÉE — prêt à committer.');
process.exit(0);
})().catch((e) => {
  console.error('ERREUR INATTENDUE :', e);
  process.exit(1);
});
