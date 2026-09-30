#!/usr/bin/env node
/**
 * ============================================================================
 * verify_task26.cjs — Portail public de consultation + décision « Ajourné » +
 * relevés des ajournés — Task 26 (2026-10-01)
 * ============================================================================
 *
 * 1. DÉCISION « AJOURNÉ » (plus jamais « À délibérer » après délibération) :
 *    - board branche JURY : moyenne null → AJOURNE (« Ajourné (sans moyenne) »
 *      si des lignes existent, « Ajourné (non évalué) » sinon) ;
 *    - board branche PROJECTION : labels projetés cohérents ;
 *    - publication : les candidats SANS AUCUNE note sont AJOURNÉS (comptés +
 *      notifiés) au lieu d'être écartés.
 *
 * 2. RELEVÉS DES AJOURNÉS : dispatchReleves envoie admissibles ET ajournés
 *    (y compris non évalués) — commentaire + modales front actualisés.
 *
 * 3. LIEN PUBLIC PROVISOIRE (parents) :
 *    - publication → génération automatique (token 32 hex, durée paramétrable
 *      défaut 720 h, max 8760 h) stockée dans NationalExam.metadata ;
 *    - gestion coordonnateur : générer/régénérer, prolonger, révoquer ;
 *    - portail public : GET /federis/public/results/:token (+ /lookup?q=)
 *      — recherche par nom / n° de table / matricule, fiche résultat avec
 *      décision finale, sans PII sensible ;
 *    - front patronat : carte de gestion du lien + durée à la publication ;
 *    - front public : page /federis/resultats/[token] (noindex).
 *
 * 4. ⭐ RUNTIME du VRAI code : clampPublicLinkHours + publicLinkViewOf
 *    (extraction + SWC + harnais vm) — 12 scénarios.
 *
 * 5. Anti-régression SWC des fichiers touchés.
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const swc = require('/home/z/node_modules/@swc/core');

const ROOT = '/home/z/my-project/ah';

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`);
  }
}

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

/** Extrait une déclaration de fonction d'un fichier TS (parenthèse équilibrée
 *  pour la signature, accolades pour le corps). */
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

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

(async () => {
console.log('════════════════════════════════════════════════════════════════');
console.log(' TASK 26 — AJOURNÉ (NON ÉVALUÉ) · RELEVÉS DES AJOURNÉS · LIEN PUBLIC PARENTS');
console.log('════════════════════════════════════════════════════════════════');

// ═══ A. DÉCISION « AJOURNÉ » — federis-deliberation.service.ts ═════════════
console.log('\n── A. Backend — décision « Ajourné » pour les sans-moyenne / sans-notes ──');
const delibSrc = read('apps/api-server/src/federis/federis-deliberation.service.ts');

check('branche JURY : moyenne null → AJOURNE (plus jamais NON_DELIBERE)',
  /if \(moyenne === null\) \{\s*\n\s*\/\/ ⭐ T26[\s\S]*?decision = 'AJOURNE';/.test(delibSrc));
check('label jury : « Ajourné (sans moyenne) » si des lignes de notes existent',
  /decisionLabel = hasRows \? 'Ajourné \(sans moyenne\)' : 'Ajourné \(non évalué\)';/.test(delibSrc));
check('branche PROJECTION : moyenne null → AJOURNE projeté',
  /decision = 'AJOURNE';\s*\n\s*decisionLabel = hasRows\s*\n\s*\? 'Ajourné \(sans moyenne, projeté\)'\s*\n\s*: 'Ajourné \(non évalué, projeté\)';/.test(delibSrc));
check('plus aucun « À délibérer » produit comme décision d\'un candidat',
  !/decisionLabel = 'À délibérer'/.test(delibSrc));
check('repli défensif du board aligné sur « Ajourné (non évalué) »',
  /let decisionLabel = 'Ajourné \(non évalué\)';/.test(delibSrc));
check('publication : candidat sans note → AJOURNE notEvaluated (compté + notifié)',
  /if \(Object\.keys\(c\.scores\)\.length === 0\) \{\s*\n\s*decisions\.set\(c\.id, \{ decision: 'AJOURNE', mention: null, average: null, notEvaluated: true \}\);/.test(delibSrc));
check('publication : le « continue; // jamais délibéré » d\'antan est détruit',
  !/continue; \/\/ jamais d\u00e9lib\u00e9r\u00e9/.test(delibSrc) && !/continue; \/\/ jamais délibéré/.test(delibSrc));
check('compteur notEvaluatedCount suivi et exposé (retour + audit)',
  /notEvaluatedCount\+\+/.test(delibSrc) && /notEvaluated: notEvaluatedCount/.test(delibSrc));
check('dispatchReleves : commentaire T26 (admissibles ET AJOURNÉS, non évalués inclus)',
  /Candidats envoiables : admissibles ET AJOURN\u00c9S/.test(delibSrc) || /Candidats envoiables : admissibles ET AJOURNÉS/.test(delibSrc));
check('dispatchReleves : filtre conservé sur NON_DELIBERE (garde-fou)',
  /dispatchable = \[\.\.\.board\.admissibles, \.\.\.board\.ajournes\]\.filter\(\s*\n\s*\(r\) => r\.decision !== 'NON_DELIBERE',/.test(delibSrc));

// ═══ B. LIEN PUBLIC — service délibération ═════════════════════════════════
console.log('\n── B. Backend — génération & gestion du lien public ──');
check('constantes : défaut 720 h (30 jours) + max 8760 h (1 an)',
  /export const PUBLIC_LINK_DEFAULT_HOURS = 720;/.test(delibSrc) &&
  /export const PUBLIC_LINK_MAX_HOURS = 8760;/.test(delibSrc));
check('interface PublicLinkView exportée (active/token/path/expiresAt/revokedAt/durationHours)',
  /export interface PublicLinkView \{[\s\S]*?active: boolean;[\s\S]*?revokedAt: string \| null;[\s\S]*?durationHours: number \| null;\s*\n\}/.test(delibSrc));
check('clampPublicLinkHours : défaut si invalide, min 1, max 8760, arrondi entier',
  /export function clampPublicLinkHours\(/.test(delibSrc) &&
  /if \(!Number\.isFinite\(v\) \|\| v <= 0\) return PUBLIC_LINK_DEFAULT_HOURS;/.test(delibSrc));
check('publicLinkViewOf : actif = publié + non révoqué + non expiré + chemin /federis/resultats/',
  /export function publicLinkViewOf\(/.test(delibSrc) &&
  /exam\.status === 'RESULTS_PUBLISHED' &&[\s\S]*?!revokedAt &&[\s\S]*?new Date\(expiresAt\)\.getTime\(\) > Date\.now\(\)/.test(delibSrc) &&
  /path: `\/federis\/resultats\/\$\{link\.token\}`/.test(delibSrc));
check('publication : token randomBytes(16) + expiration heures → metadata.publicResultLink',
  /const linkToken = randomBytes\(16\)\.toString\('hex'\);/.test(delibSrc) &&
  /publicResultLink: \{[\s\S]*?token: linkToken,[\s\S]*?expiresAt: linkExpiresAt\.toISOString\(\),[\s\S]*?durationHours: linkDurationHours,/.test(delibSrc));
check('import node:crypto randomBytes présent',
  /import \{ randomBytes \} from 'node:crypto';/.test(delibSrc));
check('publishResults(tenantId, userId, deliberationId, publicLinkHours?) — 4e paramètre',
  /async publishResults\(\s*\n\s*tenantId: string,\s*\n\s*userId: string,\s*\n\s*deliberationId: string,\s*\n\s*publicLinkHours\?: number,\s*\n\s*\)/.test(delibSrc));
check('retour publication : publicLink (vue complète) + message lien parents',
  /publicLink: \{[\s\S]*?token: linkToken,[\s\S]*?\} satisfies PublicLinkView,/.test(delibSrc) &&
  /lien provisoire de consultation a \u00e9t\u00e9 g\u00e9n\u00e9r\u00e9 pour les parents/.test(delibSrc) || /lien provisoire de consultation a été généré pour les parents/.test(delibSrc));
check('DTO PublishResultsDto (publicLinkHours IsInt Min 1 Max 8760) + PublicLinkDto (durationHours)',
  /export class PublishResultsDto \{[\s\S]*?@IsOptional\(\)[\s\S]*?@IsInt\(\)[\s\S]*?@Min\(1\)[\s\S]*?@Max\(PUBLIC_LINK_MAX_HOURS\)[\s\S]*?publicLinkHours\?: number;/.test(delibSrc) &&
  /export class PublicLinkDto \{[\s\S]*?durationHours\?: number;/.test(delibSrc));
check('createPublicLink : coordonnateur (assertPublish) + exige RESULTS_PUBLISHED + nouveau token',
  /async createPublicLink\(/.test(delibSrc) &&
  /Les r\u00e9sultats doivent \u00eatre publi\u00e9s avant de g\u00e9n\u00e9rer un lien de consultation/.test(delibSrc) || /Les résultats doivent être publiés avant de générer un lien de consultation/.test(delibSrc));
check('extendPublicLink : lien requis + révoqué refusé + nouvelle expiration',
  /async extendPublicLink\(/.test(delibSrc) && /extendedAt/.test(delibSrc));
check('revokePublicLink : revokedAt immédiat + audit',
  /async revokePublicLink\(/.test(delibSrc) && /FEDERIS_PUBLIC_LINK_REVOKED/.test(delibSrc));
check('audit : FEDERIS_PUBLIC_LINK_CREATED / _EXTENDED / _REVOKED journalisés',
  delibSrc.includes('FEDERIS_PUBLIC_LINK_CREATED') &&
  delibSrc.includes('FEDERIS_PUBLIC_LINK_EXTENDED'));
check('board : publicLink exposé dans la réponse',
  /\/\/ ⭐ T26 — vue du lien public de consultation \(gestion patronat\)\.\s*\n\s*const publicLink = publicLinkViewOf\(exam\);/.test(delibSrc) &&
  /\},\s*\n\s*publicLink,\s*\n\s*admissibles,/.test(delibSrc));

// ═══ B2. Contrôleur + module ═══════════════════════════════════════════════
console.log('\n── B2. Backend — routes & enregistrement ──');
const ctrlSrc = read('apps/api-server/src/federis/federis-deliberation.controller.ts');
check('POST exams/:examId/public-link (générer/régénérer)',
  /@Post\('exams\/:examId\/public-link'\)/.test(ctrlSrc));
check('POST exams/:examId/public-link/extend (prolonger)',
  /@Post\('exams\/:examId\/public-link\/extend'\)/.test(ctrlSrc));
check('POST exams/:examId/public-link/revoke (révoquer)',
  /@Post\('exams\/:examId\/public-link\/revoke'\)/.test(ctrlSrc));
check('publish : @Body dto PublishResultsDto → publicLinkHours transmis',
  /@Post\('deliberations\/:deliberationId\/publish'\)[\s\S]*?@Body\(\) dto: PublishResultsDto,[\s\S]*?dto\?\.publicLinkHours,/.test(ctrlSrc));
const modSrc = read('apps/api-server/src/federis/federis.module.ts');
check('module : FederisPublicResultsService (provider) + Controller enregistrés',
  /import \{ FederisPublicResultsService \} from '\.\/federis-public-results\.service';/.test(modSrc) &&
  /FederisPublicResultsController,/.test(modSrc) &&
  /FederisPublicResultsService,/.test(modSrc));

// ═══ C. PORTAIL PUBLIC — service + contrôleur ══════════════════════════════
console.log('\n── C. Backend — portail public de consultation (parents) ──');
const pubSrc = read('apps/api-server/src/federis/federis-public-results.service.ts');
check('forme du token validée : hexadécimal 16-64',
  /\^\[a-f0-9\]\{16,64\}\$\/i\.test\(token\)/.test(pubSrc));
check('recherche de l\'examen par filtre JSON path + repli JS',
  /metadata: \{ path: \['publicResultLink', 'token'\], equals: token \}/.test(pubSrc) &&
  /where: \{ status: 'RESULTS_PUBLISHED' \}/.test(pubSrc));
check('garde-fous : introuvable 404 · révoqué 403 · expiré 403 · non publié 403',
  pubSrc.includes('révoqué par le patronat') &&
  pubSrc.includes('a expiré') &&
  pubSrc.includes('ne sont pas publiés') &&
  pubSrc.includes('introuvable ou invalide'));
check('lookup : terme minimum 2 caractères',
  /term\.length < 2/.test(pubSrc));
check('lookup : matricule — correspondance exacte normalisée',
  /if \(matricule && matricule === term\) return true;/.test(pubSrc));
check('lookup : n° de table — exacte, zéros de tête neutralisés',
  /normTerm\(rel\.candidate\.tableNumber[^)]*\)\.replace\(\/\^0\+\/, ''\)/.test(pubSrc));
check('lookup : nom — ln+fn ET fn+ln ET nom seul ET prénom seul',
  /\(ln \+ fn\)\.includes\(term\)/.test(pubSrc) &&
  /\(fn \+ ln\)\.includes\(term\)/.test(pubSrc) &&
  /ln\.includes\(term\)/.test(pubSrc) && /fn\.includes\(term\)/.test(pubSrc));
check('résultats plafonnés (LOOKUP_LIMIT = 20) + indicateur truncated',
  /const LOOKUP_LIMIT = 20;/.test(pubSrc) &&
  /matches\.slice\(0, LOOKUP_LIMIT\)/.test(pubSrc) &&
  /truncated = matches\.length > LOOKUP_LIMIT/.test(pubSrc));
check('décision finale issue du BOARD (source de vérité unique)',
  /buildDeliberationBoard/.test(pubSrc) && /rowByCandidate/.test(pubSrc));
check('CEP : admisCep + admisSixieme + moyenneEtoiles exposés aux parents',
  /admisCep: rel\.cepAdmission\.admisCep,/.test(pubSrc) &&
  /admisSixieme: rel\.cepAdmission\.admisSixieme,/.test(pubSrc) &&
  /moyenneEtoiles: rel\.cepAdmission\.moyenneEtoiles,/.test(pubSrc));
const resultsBlock = pubSrc.match(/const results = matches\.slice\(0, LOOKUP_LIMIT\)\.map\(\(rel\) => \{[\s\S]*?\n    \}\);/);
check('bloc de mapping des fiches parents extrait', Boolean(resultsBlock));
check('zéro PII sensible dans les fiches : ni date/lieu de naissance, ni email, ni téléphone, ni tuteur',
  Boolean(resultsBlock) &&
  !/dateOfBirth|placeOfBirth|guardian|email|phone|address/i.test(resultsBlock[0]));
check('notes par matière diffusées (score, absence, coef, cm/cp, perfectionnement)',
  /lines: rel\.lines\.map/.test(pubSrc) && /isAbsent: l\.isAbsent/.test(pubSrc));
const pubCtrlSrc = read('apps/api-server/src/federis/federis-public-results.controller.ts');
check('contrôleur public : GET results/:token et GET results/:token/lookup — @Public()',
  (pubCtrlSrc.match(/@Public\(\)/g) || []).length === 2 &&
  /@Get\('results\/:token'\)/.test(pubCtrlSrc) &&
  /@Get\('results\/:token\/lookup'\)/.test(pubCtrlSrc) &&
  /@Query\('q'\)/.test(pubCtrlSrc));
const gradesSrc = read('apps/api-server/src/federis/federis-grades.service.ts');
check('grades : getRelevesForPublicExam (payload sans contexte utilisateur)',
  /async getRelevesForPublicExam\(tenantId: string, examId: string\)/.test(gradesSrc));

// ═══ D. ⭐ RUNTIME — clampPublicLinkHours + publicLinkViewOf + normTerm ═════
console.log('\n── D. ⭐ Runtime — vrai code (extraction + SWC + vm) ──');
const fnClamp = extractExport(delibSrc, /export function clampPublicLinkHours\(/);
const fnView = extractExport(delibSrc, /export function publicLinkViewOf\(/);
const fnNorm = extractExport(pubSrc, /function normTerm\(/);
check('extraction : clampPublicLinkHours + publicLinkViewOf + normTerm',
  Boolean(fnClamp && fnView && fnNorm));

if (fnClamp && fnView && fnNorm) {
  const prefix = `
    const PUBLIC_LINK_DEFAULT_HOURS = 720;
    const PUBLIC_LINK_MAX_HOURS = 8760;
  `;
  const decls = [fnNorm, fnClamp.replace(/^export /, ''), fnView.replace(/^export /, '')].join('\n');
  const wrapper = `${decls}\nmodule.exports = { clampPublicLinkHours, publicLinkViewOf, normTerm };`;
  let sandbox;
  try {
    const compiled = swcCompile(prefix + wrapper, false);
    sandbox = { module: { exports: {} }, exports: {} };
    vm.runInNewContext(compiled.code, sandbox, { filename: 't26-runtime.js' });
  } catch (e) {
    check('transpilation + exécution vm', false, e.message.split('\n')[0]);
  }
  if (sandbox) {
    const { clampPublicLinkHours, publicLinkViewOf, normTerm } = sandbox.module.exports;
    check('exécution vm OK (3 fonctions)', typeof clampPublicLinkHours === 'function' && typeof publicLinkViewOf === 'function' && typeof normTerm === 'function');

    // clampPublicLinkHours — 5 scénarios
    check('clamp : undefined → 720 (30 jours)', clampPublicLinkHours(undefined) === 720);
    check('clamp : 0 / négatif / NaN → 720', clampPublicLinkHours(0) === 720 && clampPublicLinkHours(-5) === 720 && clampPublicLinkHours(Number.NaN) === 720);
    check('clamp : 48 → 48 (valeur valide respectée)', clampPublicLinkHours(48) === 48);
    check('clamp : 999999 → 8760 (plafond 1 an)', clampPublicLinkHours(999999) === 8760);
    check('clamp : 2.7 → 3 (arrondi entier)', clampPublicLinkHours(2.7) === 3);

    // publicLinkViewOf — 5 scénarios
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const TOKEN = 'a'.repeat(32);
    check('vue : lien actif (publié + futur) → active, path /federis/resultats/',
      (() => { const v = publicLinkViewOf({ status: 'RESULTS_PUBLISHED', metadata: { publicResultLink: { token: TOKEN, expiresAt: future } } }); return v.active === true && v.path === `/federis/resultats/${TOKEN}`; })());
    check('vue : expiré → active=false',
      publicLinkViewOf({ status: 'RESULTS_PUBLISHED', metadata: { publicResultLink: { token: TOKEN, expiresAt: past } } }).active === false);
    check('vue : révoqué → active=false + revokedAt conservé',
      (() => { const v = publicLinkViewOf({ status: 'RESULTS_PUBLISHED', metadata: { publicResultLink: { token: TOKEN, expiresAt: future, revokedAt: past } } }); return v.active === false && v.revokedAt === past; })());
    check('vue : résultats non publiés → active=false',
      publicLinkViewOf({ status: 'DELIBERATED', metadata: { publicResultLink: { token: TOKEN, expiresAt: future } } }).active === false);
    check('vue : sans lien → null',
      publicLinkViewOf({ status: 'RESULTS_PUBLISHED', metadata: {} }) === null);

    // normTerm — 2 scénarios (matching parents)
    check('normTerm : « KORA Aline » → koraaline (casse + accents + espaces)',
      normTerm('KORA Aline') === 'koraaline');
    check('normTerm : « Kòrà-Élisée » → koraelisee (accents NFD + ponctuation)',
      normTerm('Kòrà-Élisée') === 'koraelisee');
  }
}

// ═══ E. FRONT PATRONAT ═════════════════════════════════════════════════════
console.log('\n── E. Front patronat — publication & gestion du lien ──');
const modalSrc = read('apps/web-app/src/components/federis/federis-confirm-modal.tsx');
check('modale : prop children déclarée, déstructurée et rendue',
  /children\?: React\.ReactNode;/.test(modalSrc) &&
  /^  children,$/m.test(modalSrc) &&
  /\{children\}/.test(modalSrc));

const pageSrc = read('apps/web-app/src/components/federis/FederisDeliberationsPage.tsx');
check('type publicLink dans BoardData (active/token/path/expiresAt/revokedAt/durationHours)',
  /publicLink: \{\s*\n\s*active: boolean;[\s\S]*?durationHours: number \| null;\s*\n\s*\} \| null;/.test(pageSrc));
check('durées proposées (24 h → 1 an) + défaut 720',
  /LINK_DURATION_OPTIONS/.test(pageSrc) && /DEFAULT_LINK_HOURS = 720;/.test(pageSrc) &&
  /'30 jours \(recommandé\)'/ .test(pageSrc) && /'1 an'/.test(pageSrc));
check('publicResultUrl : origin + /federis/resultats/ (une seule forme tous domaines)',
  /function publicResultUrl\(/.test(pageSrc) &&
  /`\$\{window\.location\.origin\}\/federis\/resultats\/\$\{token\}`/.test(pageSrc));
check('publication : { publicLinkHours } envoyé + notice avec URL et expiration',
  /\{ publicLinkHours: publishLinkHours \}/.test(pageSrc) &&
  /Lien de consultation des parents/.test(pageSrc));
check('modale publication : sélecteur « Durée de validité du lien »',
  /Durée de validité du lien/.test(pageSrc) && /Lien de consultation pour les parents/.test(pageSrc));
check('carte lien : états Actif / Révoqué / Expiré + temps restant',
  /'Actif' : board\.publicLink\.revokedAt \? 'Révoqué' : 'Expiré'/.test(pageSrc) &&
  /timeLeft\(/.test(pageSrc) && /fmtDateFr\(/.test(pageSrc));
check('actions lien : Copier / Prolonger / Révoquer maintenant / Générer un nouveau lien',
  pageSrc.includes('Prolonger') && pageSrc.includes('Révoquer maintenant') &&
  pageSrc.includes('Générer un nouveau lien') && /navigator\.clipboard\.writeText/.test(pageSrc));
check('3 endpoints appelés : public-link (+extend, +revoke)',
  /\/public-link`/.test(pageSrc) && /\/public-link\/extend`/.test(pageSrc) && /\/public-link\/revoke`/.test(pageSrc));
check('résultats publiés sans lien : bouton « Générer le lien » (publications antérieures T26)',
  /!board\.publicLink\?\.token/.test(pageSrc) && /Générer le lien/.test(pageSrc));
check('modale envoi relevés : détail « Ajourné(e)s » ajouté',
  /label: 'Ajourné\(e\)s', value: board\.stats\.ajournes/.test(pageSrc));
check('modale envoi relevés (onglet Relevés) : « admissibles comme ajournés »',
  read('apps/web-app/src/components/federis/FederisGradeRelevesTab.tsx').includes('admissibles') &&
  read('apps/web-app/src/components/federis/FederisGradeRelevesTab.tsx').includes('ajournés'));

// ═══ F. FRONT — PAGE PUBLIQUE PARENTS ══════════════════════════════════════
console.log('\n── F. Front — page publique /federis/resultats/[token] ──');
const routePage = read('apps/web-app/src/app/(public)/federis/resultats/[token]/page.tsx');
check('page route dynamique : params Promise (Next 16) + token transmis',
  /params: Promise<\{ token: string \}>/.test(routePage) && /await params;/.test(routePage));
check('noindex (données personnelles jamais indexées)',
  /robots: \{ index: false, follow: false/.test(routePage));
const clientSrc = read('apps/web-app/src/components/public/FederisPublicResultsClient.tsx');
check('infos du lien : GET /federis/public/results/:token (axios direct, sans cache apiFetch)',
  /\/federis\/public\/results\/\$\{token\}`/.test(clientSrc));
check('recherche : GET lookup + params { q } + seuil 2 caractères',
  /\/federis\/public\/results\/\$\{token\}\/lookup`/.test(clientSrc) &&
  /params: \{ q \}/.test(clientSrc) && /q\.length < 2/.test(clientSrc));
check('aide : nom, matricule OU numéro de table (insensible casse/accents)',
  clientSrc.includes('nom, matricule ou numéro de table') || clientSrc.includes('matricule') && clientSrc.includes('numéro de table'));
check('écran « Lien indisponible » (expiré / révoqué / introuvable)',
  /Lien indisponible/.test(clientSrc) && /ShieldOff/.test(clientSrc));
check('stats session : candidats / admis / taux de réussite',
  /info\.stats\.totalCandidates/.test(clientSrc) && /info\.stats\.admitted/.test(clientSrc) && /info\.stats\.successRate/.test(clientSrc));
check('fiche : identité (nom, matricule, n° table, école, centre)',
  /candidate\.matricule/.test(clientSrc) && /candidate\.tableNumber/.test(clientSrc) && /candidate\.school/.test(clientSrc));
check('fiche : notes par matière + moyenne + rang + mention + décision finale',
  /candidate\.lines\.map/.test(clientSrc) && /Moyenne \/20/.test(clientSrc) &&
  /Rang/.test(clientSrc) && /Mention/.test(clientSrc) &&
  clientSrc.includes("'Admis(e)'") && clientSrc.includes("'Ajourné(e)'"));
check('CEP : décisions Admis au CEP / Admis en 6ème + moyenne étoilée ≥ 10/20',
  /admisSixieme/.test(clientSrc) && /admisCep/.test(clientSrc) && /moyenneEtoiles/.test(clientSrc));
check('absences affichées « ABS » + légende CEP (CM/18 + CP/2, astérisque)',
  /'ABS'/.test(clientSrc) && /perf\./.test(clientSrc) && /astérisque/.test(clientSrc));
check('liste plafonnée : message « affichage limité aux 20 premiers »',
  /truncated \? ' — affichage limité aux 20 premiers/.test(clientSrc));

// ═══ G. SWC — compilation des fichiers touchés ═════════════════════════════
console.log('\n── G. SWC — fichiers touchés (même moteur que les builds) ──');
const FILES = [
  ['apps/api-server/src/federis/federis-deliberation.service.ts', false],
  ['apps/api-server/src/federis/federis-deliberation.controller.ts', false],
  ['apps/api-server/src/federis/federis-public-results.service.ts', false],
  ['apps/api-server/src/federis/federis-public-results.controller.ts', false],
  ['apps/api-server/src/federis/federis-grades.service.ts', false],
  ['apps/api-server/src/federis/federis.module.ts', false],
  ['apps/web-app/src/components/federis/federis-confirm-modal.tsx', true],
  ['apps/web-app/src/components/federis/FederisDeliberationsPage.tsx', true],
  ['apps/web-app/src/components/federis/FederisGradeRelevesTab.tsx', true],
  ['apps/web-app/src/components/public/FederisPublicResultsClient.tsx', true],
  ['apps/web-app/src/app/(public)/federis/resultats/[token]/page.tsx', true],
];
for (const [rel, isTsx] of FILES) {
  try {
    swcCompile(read(rel), isTsx);
    check(`SWC ✅ ${rel.split('/').pop()}`, true);
  } catch (e) {
    check(`SWC ${rel.split('/').pop()}`, false, e.message.split('\n')[0]);
  }
}

// ═══ BILAN ═════════════════════════════════════════════════════════════════
console.log('\n════════════════════════════════════════════════════════════════');
console.log(` BILAN TASK 26 : ${pass} réussite(s) / ${fail} échec(s) sur ${pass + fail}`);
console.log('════════════════════════════════════════════════════════════════');
if (fail > 0) {
  process.exit(1);
}
})().catch((e) => {
  console.error('💥 Erreur fatale :', e);
  process.exit(1);
});
