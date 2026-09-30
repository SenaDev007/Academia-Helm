#!/usr/bin/env node
/**
 * ============================================================================
 * verify_task25.cjs — Task 25 : règle ENTRÉE EN 6ÈME (moyenne des matières
 *                      étoilées ≥ 10) · userRole des boutons de délibération ·
 *                      modale de confirmation professionnelle · déplacement du
 *                      sous-onglet Relevé de notes vers le module Délibération
 * ============================================================================
 *
 * QUATRE DEMANDES UTILISATEUR :
 *
 *   A. ENTRÉE EN 6ÈME (CEP) : la décision n'est PLUS « admis CEP + CP > 0 sur
 *      une matière étoilée » — elle est déterminée par la MOYENNE des matières
 *      marquées d'un astérisque (*) : moyenne ≥ 10/20 → admis(e) en 6ème.
 *      Repli : moyenne générale si aucune matière étoilée n'est définie.
 *      (Exemple réel : KORA — Expression Écrite 15*, Lecture 13*, Math 9* →
 *      moyenne 12,33 → ADMIS, alors que l'ancienne règle le refusait.)
 *
 *   B. BOUTON « LANCER LA DÉLIBÉRATION » INVISIBLE : la page
 *      app/(patronat)/federis/deliberations/page.tsx n'instanciait PAS le
 *      composant avec userRole → canDeliberate/canPublish toujours faux →
 *      boutons Lancer / Clôturer / Publier / Envoyer masqués. Fix : userRole.
 *
 *   C. MODALE DE CONFIRMATION PROFESSIONNELLE : « Envoyer aux écoles »
 *      (Relevé de notes) + « Envoyer les relevés » et « Publier les
 *      résultats » (Délibération) — plus aucun window.confirm générique.
 *      Nouveau composant réutilisable federis-confirm-modal.tsx (icône en
 *      pastille, données clés, note, avertissement, état de chargement,
 *      Échap + aria-modal).
 *
 *   D. DÉPLACEMENT DU SOUS-ONGLET RELEVÉ DE NOTES : du module Notes et
 *      Moyennes VERS le module Délibération (sous-onglets « Délibération » |
 *      « Relevé de notes » de CHAQUE type d'examen CEP | BEPC | BAC | CAP) +
 *      bannière proactive + bouton « Ouvrir la délibération » quand le jury
 *      n'a pas encore délibéré.
 *
 * VÉRIFICATIONS :
 *   1. Structurels backend (règle, constante, interface, repli).
 *   2. ⭐ RUNTIME du VRAI code de computeCepAdmission (extraction + SWC +
 *      harnais vm) — 10 scénarios dont le cas réel KORA du Borgou.
 *   3. Structurels PDF + aperçu front (texte de la règle, tooltip moyenne).
 *   4. userRole transmis + modale professionnelle (structurels + SWC).
 *   5. Déplacement du sous-onglet (retrait Notes et Moyennes, intégration
 *      Délibération, sidebar, bannière, CTA).
 *   6. SWC : syntaxe des 8 fichiers modifiés/créés (config build Railway).
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = '/home/z/my-project/ah';
const swc = require('/home/z/node_modules/@swc/core');

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`); }
}

/** Transpile via @swc/core (config .swcrc du build Railway/Vercel). */
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

/** Extrait une déclaration de fonction exportée d'un fichier TS : équilibre
 *  d'abord les PARENTHÈSES de la signature (types objet inline `Array<{…}>`),
 *  puis les accolades du corps, et renvoie le texte complet. */
function extractExport(src, headerRe) {
  const m = src.match(headerRe);
  if (!m) return null;
  const start = m.index;
  const parOpen = src.indexOf('(', start);
  if (parOpen < 0) return null;
  let depth = 0;
  let i = parOpen;
  for (; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) break;
    }
  }
  const bodyOpen = src.indexOf('{', i);
  if (bodyOpen < 0) return null;
  depth = 0;
  for (let j = bodyOpen; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  return null;
}

(async () => {
console.log('════════════════════════════════════════════════════════════════');
console.log(' TASK 25 — RÈGLE 6ÈME (MOYENNE ÉTOILÉES) · userRole · MODALE · DÉPLACEMENT RELEVÉS');
console.log('════════════════════════════════════════════════════════════════');

// ─── A1. Backend — règle computeCepAdmission (federis-grades.service.ts) ───
console.log('\n── A1. Backend — règle entrée en 6ème (federis-grades.service.ts) ──');
const gradesPath = path.join(ROOT, 'apps/api-server/src/federis/federis-grades.service.ts');
const gradesSrc = fs.readFileSync(gradesPath, 'utf8');

check('constante CEP_SIXIEME_THRESHOLD = 10 exportée',
  /export const CEP_SIXIEME_THRESHOLD = 10;/.test(gradesSrc));
check('interface CepAdmission : moyenneEtoiles (number | null) + matieresEtoiles',
  /interface CepAdmission \{[^}]*moyenneEtoiles: number \| null;[^}]*matieresEtoiles: number;[^}]*\}/s.test(gradesSrc));
check('plus de variable cpEtoile (ancienne règle CP > 0 détruite)',
  !/cpEtoile/.test(gradesSrc));
check('plus de condition « admisCep && cpEtoile »',
  !/admisSixieme: admisCep &&/.test(gradesSrc));
check('admisSixieme = moyenneEtoiles ≥ CEP_SIXIEME_THRESHOLD',
  /admisSixieme: moyenneEtoiles !== null && moyenneEtoiles >= CEP_SIXIEME_THRESHOLD/.test(gradesSrc));
check('moyenne des étoilées = sommeEtoiles / matieresEtoiles (round2)',
  /round2\(sommeEtoiles \/ matieresEtoiles\)/.test(gradesSrc));
check('repli moyenne générale si aucune matière étoilée',
  /matieresNotees > 0\s*\?\s*round2\(sommeToutes \/ matieresNotees\)/.test(gradesSrc));
check('les matières ABSENTES / sans note sont exclues de la moyenne',
  /if \(l\.isAbsent \|\| l\.score === null\) continue;/.test(gradesSrc));
check('admisCep (2/3 matières au-dessus de la minimale) inchangé',
  /const admisCep = matieresReussies >= matieresRequises;/.test(gradesSrc));
check('doc-comment : règle utilisateur 2026-10-01 documentée',
  /MOYENNE des\s*\*\s*matières marquées d'un astérisque/.test(gradesSrc));

// ─── A2. ⭐ RUNTIME — computeCepAdmission sur le VRAI code transpilé ────────
console.log('\n── A2. ⭐ Runtime — computeCepAdmission (vrai code, SWC + vm) ──');
try {
  // Extrait les helpers purs nécessaires depuis le service réel.
  // ⚠ normalizeSubjectName vit dans federis-subjects.service.ts → mock fidèle
  // (trim + minuscules + NFD sans accents + séparateurs neutralisés).
  // ⚠ L'extracteur équilibre les PARENTHÈSES de la signature : les types
  // objet inline des paramètres (`Array<{…}>`) ne le trompent pas ; les types
  // de retour NOMMÉS (`: CepAdmission {`) conduisent bien au corps.
  const fnCompute = extractExport(gradesSrc, /export function computeCepAdmission\(/);
  const fnIsEtoile = extractExport(gradesSrc, /export function isCepPerfectionnementSubject\(/);
  const round2m = gradesSrc.match(/function round2\([^)]*\)[^{]*\{[^}]*\}/);
  const thrMatch = gradesSrc.match(/export const CEP_SIXIEME_THRESHOLD = (\d+);/);
  check('extraction : computeCepAdmission (corps complet, se termine par « } »)',
    !!fnCompute && /\}$/.test(fnCompute.trim()) && /admisSixieme: moyenneEtoiles/.test(fnCompute));
  check('extraction : isCepPerfectionnementSubject + round2 + seuil 6ème',
    !!fnIsEtoile && !!round2m && !!thrMatch);

  // ⚠ String.raw : préserve les backslashes (\u0300, \s, \\) — une template
  //    literal classique transformerait /\s+/g en /s+/g et casserait la
  //    normalisation (le mock doit être EXACTEMENT le code réel).
  const normalizeMock = String.raw`
    function normalizeSubjectName(raw) {
      return String(raw ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[-/\+&]| et /g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
  `;
  const prefix = `${normalizeMock}\nconst CEP_SIXIEME_THRESHOLD = ${thrMatch ? thrMatch[1] : 10};\n${round2m ? round2m[0] : 'function round2(n){return Math.round(n*100)/100;}'}\n`;
  const decls = [fnIsEtoile, fnCompute]
    .filter(Boolean)
    .map((f) => f.replace(/^export /gm, ''))
    .join('\n');
  const wrapper = `${decls}\nmodule.exports = { computeCepAdmission, isCepPerfectionnementSubject, CEP_SIXIEME_THRESHOLD: 10 };`;
  const compiled = swcCompile(prefix + wrapper, false);
  const sandbox = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(compiled.code, sandbox, { filename: 'cep-runtime.js' });
  const { computeCepAdmission, isCepPerfectionnementSubject } = sandbox.module.exports;
  check('transpilation + exécution vm OK (aucune exception)', typeof computeCepAdmission === 'function');

  /** Ligne de relevé CEP. */
  const L = (score, perfectionnement, passingScore = 10, isAbsent = false, cp = null) => ({
    score, isAbsent, passingScore, cp, perfectionnement,
  });

  // 1 — CAS RÉEL KORA (Borgou, CEP-27) : l'ancienne règle le REFUSAIT
  //     (tous les CP = 0) ; la nouvelle l'ADMET (moyenne étoilées 12,33 ≥ 10).
  const kora = computeCepAdmission([
    L(12, false),                       // Dictée (non étoilée)
    L(15, true, 10, false, 0),          // Expression Écrite *
    L(13, true, 10, false, 0),          // Lecture *
    L(9, true, 10, false, 0),           // Mathématiques *
  ], 9);
  check('KORA : moyenne étoilées = (15+13+9)/3 = 12,33', kora.moyenneEtoiles === 12.33,
    `reçu ${kora.moyenneEtoiles}`);
  check('KORA : ADMIS à l\'entrée en 6ème (l\'ancienne règle le refusait)', kora.admisSixieme === true);
  check('KORA : matieresEtoiles = 3', kora.matieresEtoiles === 3);

  // 2 — Moyenne étoilées EXACTEMENT 10 → admis (« si la moyenne fait 10 »).
  const exact10 = computeCepAdmission([
    L(14, false), L(10, true), L(10, true), L(10, true),
  ], 9);
  check('moyenne étoilées = 10,00 → ADMIS', exact10.admisSixieme === true && exact10.moyenneEtoiles === 10);

  // 3 — Moyenne étoilées 9,99 → ajourné.
  const under = computeCepAdmission([
    L(14, false), L(10, true), L(10, true), L(9.97, true),
  ], 9);
  check('moyenne étoilées 9,99 → AJOURNÉ', under.admisSixieme === false);

  // 4 — Étoilées faibles mais CEP obtenu : 6e REFUSÉE (règle indépendante).
  const lowStars = computeCepAdmission([
    L(18, false), L(18, false), L(18, false), L(18, false), L(18, false), L(18, false),
    L(6, true), L(7, true), L(8, true),
  ], 9);
  check('6/9 matières ≥ minimale → admis CEP conservé', lowStars.admisCep === true);
  check('étoilées à 7,00 → entrée en 6ème REFUSÉE malgré l\'admission CEP',
    lowStars.admisSixieme === false && lowStars.moyenneEtoiles === 7);

  // 5 — Étoilées fortes mais CEP refusé : la 6e reste accessible (règle
  //     utilisateur : la moyenne des étoilées détermine SEULE la 6e).
  const starsOnly = computeCepAdmission([
    L(0, false), L(0, false), L(0, false), L(0, false), L(0, false), L(0, false),
    L(14, true), L(15, true), L(16, true),
  ], 9);
  check('admis CEP = false (0/6 non étoilées)', starsOnly.admisCep === false);
  check('étoilées à 15,00 → entrée en 6ème ACCORDÉE (règle indépendante)',
    starsOnly.admisSixieme === true && starsOnly.moyenneEtoiles === 15);

  // 6 — Matière étoilée ABSENTE → exclue de la moyenne (pas comptée à 0).
  const absentStar = computeCepAdmission([
    L(12, false), L(12, true), L(null, true, 10, true),
  ], 9);
  check('étoilée absente exclue : moyenne = 12 (2 matières, pas 8)', absentStar.moyenneEtoiles === 12);

  // 7 — Aucune matière étoilée définie → repli sur la moyenne générale.
  const noStars = computeCepAdmission([L(12), L(14), L(16)], 3);
  check('repli : aucune étoilée → moyenne générale 14,00', noStars.moyenneEtoiles === 14 && noStars.matieresEtoiles === 0);
  check('repli : moyenne générale ≥ 10 → admis', noStars.admisSixieme === true);

  // 8 — Aucune note du tout → moyenneEtoiles = null → ajourné.
  const empty = computeCepAdmission([L(null, true, 10, true), L(null, false, 10, true)], 9);
  check('aucune note → moyenneEtoiles null, ajourné', empty.moyenneEtoiles === null && empty.admisSixieme === false);

  // 9 — Les non-étoilées ne comptent PAS dans la moyenne des étoilées.
  const mixed = computeCepAdmission([L(0, false), L(0, false), L(12, true), L(14, true)], 9);
  check('non-étoilées à 0 ignorées : moyenne étoilées = 13', mixed.moyenneEtoiles === 13);

  // 10 — isCepPerfectionnementSubject toujours opérationnel (étoiles).
  check('isCepPerfectionnementSubject : Expression Écrite / Lecture / Calcul',
    isCepPerfectionnementSubject('EXE', 'Expression Écrite') === true &&
    isCepPerfectionnementSubject('LEC', 'Compréhension et Lecture') === true &&
    isCepPerfectionnementSubject('MAT', 'Mathématiques') === true &&
    isCepPerfectionnementSubject('DIC', 'Dictée') === false);
} catch (e) {
  check('runtime computeCepAdmission s\'exécute sans exception', false, e.message);
}

// ─── A3. Textes de la règle — PDF backend + aperçu front ───────────────────
console.log('\n── A3. Textes de la règle (PDF + aperçu front) ──');
const pdfPath = path.join(ROOT, 'apps/api-server/src/federis/federis-pdf.service.ts');
const pdfSrc = fs.readFileSync(pdfPath, 'utf8');
check('PDF : règle 2 = « moyenne au moins égale à dix (10) sur 20 dans les trois (03) matières marquées d\'un astérisque »',
  /moyenne au moins \\u00e9gale \\u00e0 dix \(10\) sur 20 dans les trois \(03\) mati\\u00e8res marqu\\u00e9es d\\u2019un ast\\u00e9risque \(\*\)/.test(pdfSrc));
check('PDF : ancienne règle « perfectionnement différent de zéro » supprimée',
  !/perfectionnement diff\\u00e9rente de z\\u00e9ro/.test(pdfSrc));
check('PDF : règle 1 (admission CEP 6/9) conservée',
  /note minimale exig\\u00e9e dans au moins \$\{/.test(pdfSrc) && /mati\\u00e8res\.<\/p>/.test(pdfSrc));
check('PDF : règle 3 (perfectionnement si minimale exigée) conservée',
  /La note de perfectionnement n\\u2019est attribu\\u00e9e/.test(pdfSrc));

const relPath = path.join(ROOT, 'apps/web-app/src/components/federis/FederisGradeRelevesTab.tsx');
const relSrc = fs.readFileSync(relPath, 'utf8');
check('Aperçu : règle 2 = moyenne ≥ 10 dans les matières étoilées',
  /moyenne au moins égale à dix \(10\) sur 20 dans les trois \(03\) matières marquées d'un astérisque \(\*\)/.test(relSrc));
check('Aperçu : ancienne règle CP ≠ 0 supprimée',
  !/note de perfectionnement différente de zéro/.test(relSrc));
check('Aperçu : interface cepAdmission expose moyenneEtoiles + matieresEtoiles',
  /moyenneEtoiles: number \| null;/.test(relSrc) && /matieresEtoiles: number;/.test(relSrc));
check('Aperçu : tooltip « Moyenne des matières * : …/20 » sur la décision 6ème',
  /Moyenne des matières \* : /.test(relSrc) && /admission ≥ 10\/20/.test(relSrc));

// ─── B. userRole transmis à la page Délibération ────────────────────────────
console.log('\n── B. userRole — boutons de délibération visibles ──');
const pagePath = path.join(ROOT, 'apps/web-app/src/app/(patronat)/federis/deliberations/page.tsx');
const pageSrc = fs.readFileSync(pagePath, 'utf8');
check('page.tsx : <FederisDeliberationsPage userRole={user.role} />', /<FederisDeliberationsPage userRole=\{user\.role\} \/>/.test(pageSrc));
check('page.tsx : correction documentée (FIX BOUTONS 2026-10-01)', /FIX BOUTONS \(2026-10-01\)/.test(pageSrc));

const delPath = path.join(ROOT, 'apps/web-app/src/components/federis/FederisDeliberationsPage.tsx');
const delSrc = fs.readFileSync(delPath, 'utf8');
check('composant : canDeliberate = canWrite(userRole, candidates) intact',
  /const canDeliberate = canWrite\(userRole, 'candidates'\);/.test(delSrc));
check('composant : canPublish = COORDONNATEUR intact',
  /const canPublish = fn === 'COORDONNATEUR';/.test(delSrc));
check('composant : bouton « Lancer la délibération » présent',
  /Lancer la délibération/.test(delSrc) && /PlayCircle/.test(delSrc));

// ─── C. Modale de confirmation professionnelle ─────────────────────────────
console.log('\n── C. Modale professionnelle (federis-confirm-modal) ──');
const modPath = path.join(ROOT, 'apps/web-app/src/components/federis/federis-confirm-modal.tsx');
check('composant federis-confirm-modal.tsx créé', fs.existsSync(modPath));
const modSrc = fs.existsSync(modPath) ? fs.readFileSync(modPath, 'utf8') : '';
check('modale : role="dialog" + aria-modal + aria-label', /role="dialog"/.test(modSrc) && /aria-modal="true"/.test(modSrc) && /aria-label=\{title\}/.test(modSrc));
check('modale : fermeture par Échap (keydown Escape)', /'Escape'/.test(modSrc) || /"Escape"/.test(modSrc));
check('modale : 4 tons (navy | gold | emerald | red) + bandeau dégradé', /tone\?: 'navy' \| 'gold' \| 'emerald' \| 'red'/.test(modSrc) && /bg-gradient-to-r/.test(modSrc));
check('modale : données clés libellé/valeur + note bleue + avertissement ambre',
  /details\?: FedConfirmDetail\[\]/.test(modSrc) && /note\?: React\.ReactNode/.test(modSrc) && /warning\?: React\.ReactNode/.test(modSrc));
check('modale : état de chargement (Loader2 + disabled)', /loading \&\& <Loader2/.test(modSrc));
check('modale : arrière-plan clic = annulation (hors traitement)', /onClick=\{\(\) => !loading && onCancel\(\)\}/.test(modSrc));

// RelevesTab — plus de window.confirm APPELÉ (les commentaires ne comptent pas)
const relCallsConfirm = (relSrc.match(/!window\.confirm\(|window\.confirm\(/g) || []).length;
const relCommentConfirm = (relSrc.match(/window\.confirm/g) || []).length;
check('Relevés : zéro APPEL window.confirm (seuls des commentaires subsistent)',
  relCallsConfirm === 0 && relCommentConfirm >= 0 && !/^[^*\n]*window\.confirm\(/m.test(relSrc.split('/*').map((s) => s.replace(/\*[^*]*?\*/g, '')).join('')));
check('Relevés : FederisConfirmModal importée + rendue (tone gold, icône Send)',
  /import FederisConfirmModal from '@\/components\/federis\/federis-confirm-modal';/.test(relSrc) &&
  /<FederisConfirmModal/.test(relSrc) && /tone="gold"/.test(relSrc) && /icon=\{Send\}/.test(relSrc));
check('Relevés : modale « Envoyer les relevés de notes aux écoles ? »',
  /title="Envoyer les relevés de notes aux écoles \?"/.test(relSrc));
check('Relevés : détails examen / candidats / écoles destinataires',
  /Candidats concernés/.test(relSrc) && /Écoles destinataires/.test(relSrc) && /new Set\(releves\.map/.test(relSrc));
check('Relevés : bouton « Envoyer aux écoles » ouvre la modale (pas l\'envoi direct)',
  /setConfirmDispatch\(true\)/.test(relSrc));

const delCallsConfirm = (delSrc.match(/window\.confirm\(/g) || []).length;
check('Délibération : zéro window.confirm', delCallsConfirm === 0);
check('Délibération : 2 modales (dispatch gold + publish emerald)',
  (delSrc.match(/<FederisConfirmModal/g) || []).length === 2 &&
  /title="Envoyer les relevés de notes aux écoles \?"/.test(delSrc) &&
  /title="Publier officiellement les résultats \?"/.test(delSrc));
check('Délibération : modale publication — avertissement IRRÉVERSIBLE',
  /officielle et irréversible/.test(delSrc));
check('Délibération : modale publication — détails admis/ajournés/taux',
  /label: 'Admis\(e\)s'/.test(delSrc) && /label: 'Ajourné\(e\)s'/.test(delSrc) && /Taux de réussite/.test(delSrc));
check('Délibération : boutons Publier / Envoyer ouvrent les modales',
  /onClick=\{\(\) => setConfirmPublish\(true\)\}/.test(delSrc) && /onClick=\{\(\) => setConfirmDispatch\(true\)\}/.test(delSrc));
check('Délibération : échec dispatch/publication referme la modale (erreur visible derrière)',
  /setConfirmDispatch\(false\);/.test(delSrc) && /setConfirmPublish\(false\);/.test(delSrc));

// ─── D. Déplacement du sous-onglet Relevé de notes ─────────────────────────
console.log('\n── D. Déplacement Relevé de notes → module Délibération ──');
const gradesPagePath = path.join(ROOT, 'apps/web-app/src/components/federis/FederisGradesPage.tsx');
const gpSrc = fs.readFileSync(gradesPagePath, 'utf8');
check('Notes et Moyennes : sous-onglet « releves » RETIRÉ du type SubTab',
  !/'releves'/.test(gpSrc));
check('Notes et Moyennes : SUB_TABS = Saisie | Registre | Suivi temps réel',
  /key: 'saisie', label: 'Saisie des notes'/.test(gpSrc) &&
  /key: 'registre', label: 'Registre des notes'/.test(gpSrc) &&
  /key: 'live', label: 'Suivi temps réel'/.test(gpSrc) &&
  !/key: 'releves'/.test(gpSrc));
check('Notes et Moyennes : import + rendu FederisGradeRelevesTab SUPPRIMÉS',
  !/import FederisGradeRelevesTab/.test(gpSrc) && !/subTab === 'releves'/.test(gpSrc));
check('Notes et Moyennes : description oriente vers le module Délibération',
  /relevés de notes<\/strong> sont générés dans le module/.test(gpSrc));

check('Délibération : MODULE_TABS = Délibération | Relevé de notes',
  /type ModuleTab = 'deliberation' \| 'releves';/.test(delSrc) &&
  /key: 'deliberation', label: 'Délibération'/.test(delSrc) &&
  /key: 'releves', label: 'Relevé de notes'/.test(delSrc));
check('Délibération : import FederisGradeRelevesTab',
  /import FederisGradeRelevesTab from '@\/components\/federis\/FederisGradeRelevesTab';/.test(delSrc));
check('Délibération : sous-onglet relevés rendu avec onNeedDeliberation + deliberationReady',
  /<FederisGradeRelevesTab/.test(delSrc) && /onNeedDeliberation=\{\(\) => setModuleTab\('deliberation'\)\}/.test(delSrc) &&
  /deliberationReady=\{board \? !!board\.deliberation : undefined\}/.test(delSrc));
check('Délibération : reset du sous-onglet au changement de campagne',
  /setModuleTab\('deliberation'\);/.test(delSrc));
const guards = (delSrc.match(/moduleTab === 'deliberation' &&/g) || []).length;
check(`Délibération : contenu propre au sous-onglet gardé par moduleTab (≥ 6 blocs : ${guards})`,
  guards >= 6);
check('Délibération : bandeau actions + tableaux + cas limites + modale lancement réservés au sous-onglet Délibération',
  /moduleTab === 'deliberation' && board && \(/.test(delSrc) &&
  /moduleTab === 'deliberation' && d && casesOpen/.test(delSrc) &&
  /moduleTab === 'deliberation' && runOpen/.test(delSrc));

// RelevesTab — bannière proactive + CTA erreur
check('Relevés : bannière proactive « délibération pas encore lancée »',
  /La délibération du jury n&apos;a pas encore été lancée pour cet examen/.test(relSrc) &&
  /deliberationReady === false/.test(relSrc));
check('Relevés : bouton « Ouvrir la délibération » (bannière + erreur d\'envoi)',
  (relSrc.match(/Ouvrir la délibération/g) || []).length === 2);
check('Relevés : props optionnelles onNeedDeliberation + deliberationReady',
  /onNeedDeliberation\?: \(\) => void;/.test(relSrc) && /deliberationReady\?: boolean;/.test(relSrc));

// Sidebar
const layoutPath = path.join(ROOT, 'apps/web-app/src/components/federis/FederisLayout.tsx');
const laySrc = fs.readFileSync(layoutPath, 'utf8');
check('Sidebar : « Délibération & relevés » (découverte du nouvel emplacement)',
  /name: 'Délibération & relevés', subPath: '\/deliberations'/.test(laySrc));

// ─── E. SWC — syntaxe des fichiers modifiés/créés ──────────────────────────
console.log('\n── E. SWC — syntaxe des 8 fichiers (config build) ──');
const files = [
  ['apps/api-server/src/federis/federis-grades.service.ts', false],
  ['apps/api-server/src/federis/federis-pdf.service.ts', false],
  ['apps/web-app/src/components/federis/FederisGradeRelevesTab.tsx', true],
  ['apps/web-app/src/components/federis/FederisGradesPage.tsx', true],
  ['apps/web-app/src/components/federis/FederisDeliberationsPage.tsx', true],
  ['apps/web-app/src/components/federis/federis-confirm-modal.tsx', true],
  ['apps/web-app/src/components/federis/FederisLayout.tsx', true],
  ['apps/web-app/src/app/(patronat)/federis/deliberations/page.tsx', true],
];
for (const [rel, isTsx] of files) {
  try {
    swcCompile(fs.readFileSync(path.join(ROOT, rel), 'utf8'), isTsx);
    check(`SWC OK : ${rel.split('/').pop()}`, true);
  } catch (e) {
    check(`SWC OK : ${rel.split('/').pop()}`, false, e.message.slice(0, 120));
  }
}

// ─── Récapitulatif ──────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════════════════════');
console.log(` RÉSULTAT : ${pass} ✅ / ${fail} ❌ (sur ${pass + fail})`);
console.log('════════════════════════════════════════════════════════════════');
process.exit(fail === 0 ? 0 : 1);
})();
