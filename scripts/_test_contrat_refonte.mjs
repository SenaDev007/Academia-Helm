/**
 * ============================================================================
 * TESTS — Refonte CDC « étape Contrat » (logique pure, exécutable bun/node)
 * ============================================================================
 * Couvre les critères d'acceptation §12 du CDC :
 *   1. Structure 2 niveaux : statut → types filtrés (CDI/CDD | PRESTATION)
 *   2. Chaîne CDD : compteur de renouvellements + durée cumulée + seuil
 *   3. Test d'aide à la qualification : suggestion, non bloquant
 *   4. Indemnité de fin de contrat CDD : 6 % paramétrable, ajustable
 *   5. Filigrane : acronyme de l'école (jamais « Academia Helm »)
 *   6. Templates : clauses V2 (renouvellement, indemnité), convention de stage,
 *      contrôle de cohérence statut ↔ template (génération refusée si incohérente)
 *   7. Migration §10 : marquage VACATAIRE (badge, non bloquant)
 * ============================================================================
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { transpileModule } = require('/home/z/my-project/node_modules/typescript');

const fs = require('fs');
const path = require('path');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE = path.resolve(__dirname, '../apps/api-server/src/hr/services');

// ── Transpile les modules purs à la volée (aucune dépendance Nest) ──
function loadModule(rel) {
  const src = fs.readFileSync(path.join(BASE, rel), 'utf8');
  const js = transpileModule(src, {
    compilerOptions: { module: 1 /* CommonJS */, target: 4, esModuleInterop: true },
  }).outputText;
  const m = { exports: {} };
  const fn = new Function('module', 'exports', 'require', js);
  fn(m, m.exports, (name) => {
    if (name === 'handlebars') return require('/home/z/my-project/node_modules/handlebars');
    throw new Error(`dépendance inattendue: ${name}`);
  });
  return m.exports;
}

const rules = loadModule('contract-rules.ts');
const templates = loadModule('employment-contract-templates.ts');
const convention = loadModule('internship-convention-template.ts');

let pass = 0, fail = 0;
function test(name, cond) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}
function section(t) { console.log(`\n━━━ ${t} ━━━`); }

// ═══ 1. Correspondance statut → types de contrat (§4.1/§4.2) ═══
section('§4.2 — structure 2 niveaux : statut → types filtrés');
test('salarié déclaré → CDI/CDD uniquement', JSON.stringify(rules.TYPES_CONTRAT_PAR_STATUT.SALARIE_DECLARE) === JSON.stringify(['CDI', 'CDD']));
test('salarié non déclaré → CDI/CDD uniquement', JSON.stringify(rules.TYPES_CONTRAT_PAR_STATUT.SALARIE_NON_DECLARE) === JSON.stringify(['CDI', 'CDD']));
test('prestataire → PRESTATION unique (pas de CDI/CDD)', JSON.stringify(rules.TYPES_CONTRAT_PAR_STATUT.PRESTATAIRE_SERVICE) === JSON.stringify(['PRESTATION']));
test('CDD valide pour salarié', rules.isValidTypeForStatut('SALARIE_DECLARE', 'CDD'));
test('CDI valide pour salarié', rules.isValidTypeForStatut('SALARIE_NON_DECLARE', 'CDI'));
test('VACATAIRE REFUSÉ pour salarié (n’est plus un type)', !rules.isValidTypeForStatut('SALARIE_DECLARE', 'VACATAIRE'));
test('STAGE REFUSÉ pour salarié (flux séparé)', !rules.isValidTypeForStatut('SALARIE_DECLARE', 'STAGE'));
test('PRESTATION REFUSÉ pour salarié', !rules.isValidTypeForStatut('SALARIE_DECLARE', 'PRESTATION'));
test('CDI REFUSÉ pour prestataire (nature juridique différente)', !rules.isValidTypeForStatut('PRESTATAIRE_SERVICE', 'CDI'));
test('CDD REFUSÉ pour prestataire', !rules.isValidTypeForStatut('PRESTATAIRE_SERVICE', 'CDD'));
test('PRESTATION accepté pour prestataire', rules.isValidTypeForStatut('PRESTATAIRE_SERVICE', 'PRESTATION'));
test('statut null (legacy) → pas de garde (chemin hérité intact)', rules.isValidTypeForStatut(null, 'VACATAIRE') === true);
test('typesDisponiblesPourStatut alimente les sélecteurs filtrés', rules.typesDisponiblesPourStatut('SALARIE_DECLARE').length === 2);

// ═══ 2. Chaîne CDD : renouvellements + durée cumulée (§4.3/§8.2) ═══
section('§4.3 — chaîne CDD : compteur + durée cumulée');
const d = (iso) => new Date(iso);
// Contrat initial 12 mois + renouvellement contigu 12 mois
const chain = rules.computeCddChains([
  { id: 'c1', contractType: 'CDD', status: 'ACTIVE', startDate: d('2025-09-01'), endDate: d('2026-08-31') },
  { id: 'c2', contractType: 'CDD', status: 'ACTIVE', startDate: d('2026-09-01'), endDate: d('2027-08-31') },
]);
test('renouvellement contigu détecté (1 seule chaîne)', chain.length === 1);
test('renouvellements = 1 (2 contrats - 1)', chain[0].renouvellements === 1);
test('durée cumulée = 24 mois (12 + 12)', Math.abs(chain[0].dureeCumuleeMois - 24) <= 0.5);
// Contrats NON contigus → 2 chaînes distinctes
const chains2 = rules.computeCddChains([
  { id: 'a', contractType: 'CDD', status: 'EXPIRED', startDate: d('2023-01-01'), endDate: d('2023-12-31') },
  { id: 'b', contractType: 'CDD', status: 'ACTIVE', startDate: d('2026-01-01'), endDate: d('2026-12-31') },
]);
test('contrats non contigus → 2 chaînes séparées', chains2.length === 2);
// Chaîne explicite cddChainId
const chains3 = rules.computeCddChains([
  { id: 'x1', contractType: 'CDD', status: 'ACTIVE', cddChainId: 'root', startDate: d('2026-01-01'), endDate: d('2026-06-30') },
  { id: 'x2', contractType: 'CDD', status: 'PENDING', cddChainId: 'root', startDate: d('2027-01-01'), endDate: d('2027-06-30') },
]);
test('chaîne explicite cddChainId regroupe même hors contiguïté', chains3.length === 1 && chains3[0].contracts === 2);
// CDI ignoré dans les chaînes
const chains4 = rules.computeCddChains([
  { id: 'cdi', contractType: 'CDI', status: 'ACTIVE', startDate: d('2025-01-01'), endDate: null },
  { id: 'cdd', contractType: 'CDD', status: 'ACTIVE', startDate: d('2025-02-01'), endDate: d('2025-12-31') },
]);
test('les CDI sont ignorés dans les chaînes CDD', chains4.length === 1 && chains4[0].contracts === 1);
// Supprimés ignorés
const chains5 = rules.computeCddChains([
  { id: 'del', contractType: 'CDD', status: 'DELETED', startDate: d('2025-01-01'), endDate: d('2025-12-31') },
]);
test('les contrats DELETED sont ignorés', chains5.length === 0);
// activeCddChain : chaîne en cours
const active = rules.activeCddChain([
  { id: 'c1', contractType: 'CDD', status: 'ACTIVE', startDate: d('2026-01-01'), endDate: d(new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-15') },
]);
test('activeCddChain renvoie la chaîne en cours', !!active);
const noActive = rules.activeCddChain([
  { id: 'old', contractType: 'CDD', status: 'EXPIRED', startDate: d('2020-01-01'), endDate: d('2020-12-31') },
]);
test('chaîne ancienne ≠ active', noActive === null);

// ═══ 3. Alertes de conformité (§8) ═══
section('§8 — alertes de conformité (non bloquantes, jamais masquées)');
const alerte1 = rules.alerteCddExpireSansCloture(
  { id: 'c1', staffId: 's1', staffName: 'Awa K.', endDate: new Date(Date.now() - 40 * 86400000) },
);
test('§8.1 CDD échu sans clôture → alerte critique', alerte1?.severity === 'critique' && alerte1?.kind === 'CDD_EXPIRE_SANS_CLOTURE');
test('§8.1 message mentionne la transformation CDI de plein droit', alerte1?.message.includes('CDI de plein droit'));
const alerte1b = rules.alerteCddExpireSansCloture(
  { id: 'c2', staffId: 's1', endDate: new Date(Date.now() + 40 * 86400000) },
);
test('§8.1 CDD non échu → pas d’alerte', alerte1b === null);
const alerte2 = rules.alerteDureeCumulee({ chainId: 'x', contracts: 3, renouvellements: 2, dureeCumuleeMois: 27, finDeChaine: d('2027-01-01') }, 24, 's2', 'Idriss T.');
test('§8.2 durée cumulée 27 > seuil 24 → alerte critique', alerte2?.severity === 'critique' && alerte2?.kind === 'CDD_DUREE_CUMULEE_DEPASSEE');
const alerte2b = rules.alerteDureeCumulee({ chainId: 'x', contracts: 2, renouvellements: 1, dureeCumuleeMois: 18, finDeChaine: d('2027-01-01') }, 24, 's2', 'Idriss T.');
test('§8.2 durée cumulée 18 < seuil → pas d’alerte', alerte2b === null);
const alerte3 = rules.alerteDossierARequalifier('s3', 'Fatou B.');
test('§10 dossier Vacataire → alerte avertissement avec action REQUALIFIER', alerte3?.action === 'REQUALIFIER' && alerte3?.severity === 'avertissement');

// ═══ 4. Test d'aide à la qualification (§5) ═══
section('§5 — test d’aide à la qualification (suggestion, non bloquant)');
const qs = rules.DEFAULT_TEST_QUESTIONS;
test('3 questions par défaut (2-3 questions binaires)', qs.length === 3);
test('chaque question a exactement 2 options binaires', qs.every((q) => q.options.length === 2));
// Profil subordonné : horaires Oui(0), instructions 0, refus Non(0)
const r1 = rules.evaluateQualificationTest(qs, { horaires: 0, instructions: 0, refus: 0 });
test('profil subordonné → suggestion SALARIE', r1.suggestion === 'SALARIE');
// Profil autonome : toutes options 1
const r2 = rules.evaluateQualificationTest(qs, { horaires: 1, instructions: 1, refus: 1 });
test('profil autonome → suggestion PRESTATAIRE', r2.suggestion === 'PRESTATAIRE');
// Réponses mixtes → égalité stricte → INCONNU (jamais de blocage)
const r3 = rules.evaluateQualificationTest(qs, { horaires: 0, instructions: 1 });
test('réponses à égalité → INCONNU (décision au gestionnaire)', r3.suggestion === 'INCONNU');
const r4 = rules.evaluateQualificationTest(qs, {});
test('aucune réponse → INCONNU', r4.suggestion === 'INCONNU');
test('l’explication salarié mentionne le risque de requalification', r1.explanation.includes('requalification'));
// Questions reconfigurables (texte non codé en dur — §9)
const customQs = [{ id: 'q', question: 'Custom ?', options: ['Oui', 'Non'], firstOptionMeaning: 'autonomie' }];
const r5 = rules.evaluateQualificationTest(customQs, { q: 0 });
test('questions personnalisées acceptées (autonomie → PRESTATAIRE)', r5.suggestion === 'PRESTATAIRE');

// ═══ 5. Indemnité de fin de contrat CDD (§3.1/§8.4) ═══
section('§8.4 — indemnité de fin de contrat CDD (taux paramétrable)');
const ind1 = rules.computeIndemniteFinContrat(2400000, 6);
test('6 % de 2 400 000 = 144 000', ind1.montantCalcule === 144000 && ind1.montantFinal === 144000);
test('sans ajustement → ajuste = false', ind1.ajuste === false);
const ind2 = rules.computeIndemniteFinContrat(2400000, 6, 150000);
test('ajustement manuel 150 000 → montantFinal 150 000 (§8.4 ajustable)', ind2.montantFinal === 150000 && ind2.ajuste === true);
const ind3 = rules.computeIndemniteFinContrat(1000000, 4);
test('taux paramétrable 4 % → 40 000 (loi modifiable sans code)', ind3.montantCalcule === 40000);
const ind4 = rules.computeIndemniteFinContrat(0, 6);
test('base nulle → indemnité 0', ind4.montantCalcule === 0);

// ═══ 6. Filigrane acronyme école (§7 NB) ═══
section('§7 NB — filigrane = acronyme de l’école (jamais « Academia Helm »)');
test('abréviation CSPEB → CSPEB', rules.deriveWatermarkText('CSPEB', 'Complexe Scolaire…') === 'CSPEB');
test('abréviation prioritaire sur le nom', rules.deriveWatermarkText('EC', 'École Chrétienne') === 'EC');
test('sigle dérivé du nom (mots vides ignorés : Groupe Scolaire La Grâce → GSG)', rules.deriveWatermarkText(null, 'Groupe Scolaire La Grâce') === 'GSG');
test('nom court → nom majuscule', rules.deriveWatermarkText(null, 'Bedec') === 'BEDEC');
test('rien → repli neutre ÉCOLE', rules.deriveWatermarkText(null, '') === 'ÉCOLE');
test('abréviation trop longue tronquée (24 max)', rules.deriveWatermarkText('A'.repeat(40), 'X').length === 24);
test('taille de police adaptée aux longs filigranes', rules.watermarkFontSize('CSPEB') === 68 && rules.watermarkFontSize('GROUPE SCOLAIRE') === 42);
test('le filigrane ne produit JAMAIS « Academia Helm »', rules.deriveWatermarkText('', '') !== 'ACADEMIA HELM');

// ═══ 7. Templates V2 + convention de stage (§7) ═══
section('§7 — templates : V2 (clauses CDD) + convention de stage distincte');
const T2 = templates.CONTRAT_TRAVAIL_TEMPLATE;
const T1 = templates.CONTRAT_TRAVAIL_TEMPLATE_V1;
test('V2 ≠ V1 (enrichissement détectable)', T2 !== T1);
test('V2 contient la clause de renouvellement/durée cumulée', T2.includes('cdd_renouvellements') && T2.includes('cdd_duree_cumulee'));
test('V2 contient le seuil légal paramétrable', T2.includes('cdd_duree_max'));
test('V2 contient l’indemnité de fin de contrat (taux injecté)', T2.includes('indemnite_fin_contrat_pct'));
test('V1 conservé pour la détection de mise à niveau (jamais écrasé si personnalisé)', T1.includes('cdd_motif') && !T1.includes('indemnite_fin_contrat_pct'));
test('V2 corrige « sans indemnité » (art. 9 V1) → indemnité légale', !/sans indemnit/.test(T2) && T1.includes('sans indemnité'));
test('template prestation intact (blocs autonomie/AIB)', templates.CONTRAT_PRESTATION_TEMPLATE.includes('exclusif de tout lien de subordination'));
test('variables documentées : nouvelles entrées présentes', !!templates.CONTRAT_TRAVAIL_VARIABLES.cdd_duree_cumulee && !!templates.CONTRAT_TRAVAIL_VARIABLES.indemnite_fin_contrat_pct);

// Rendu template V2 — cas salarié CDD renouvelé
const varsCddRenouvele = {
  type_contrat_libelle: 'à Durée Déterminée (CDD)',
  if_cdd: true, if_cdi: false,
  cdd_duree: '12 mois', cdd_motif: 'Remplacement d’un salarié absent',
  if_cdd_renouvele: true, cdd_renouvellements: '1', cdd_date_initial: '1er septembre 2025',
  cdd_duree_cumulee: '24 mois', cdd_duree_max: '24 mois (renouvellement compris)',
  indemnite_fin_contrat_pct: 6,
  date_debut: '1er septembre 2026', date_fin: '31 août 2027',
};
const rendered = templates.renderStatutTemplate(T2, varsCddRenouvele);
test('rendu V2 : bloc renouvellement affiché (n° 1, cumul 24 mois)', rendered.includes('renouvellement n° 1') && rendered.includes('24 mois'));
test('rendu V2 : indemnité 6 % dans l’article 9', rendered.includes('6 % de la'));
test('rendu V2 : motif du CDD rendu', rendered.includes('Remplacement d’un salarié absent'));
test('rendu V2 : aucune moustache résiduelle', !/\{\{[a-zA-Z_]/.test(rendered));
// Rendu CDI initial (pas de bloc renouvellement)
const renderedCdi = templates.renderStatutTemplate(T2, {
  type_contrat_libelle: 'à Durée Indéterminée (CDI)', if_cdd: false, if_cdi: true,
  cdd_duree: '—', cdd_motif: '—', if_cdd_renouvele: false,
  date_debut: '1er septembre 2026', date_fin: '',
});
test('rendu CDI : pas de bloc renouvellement', !renderedCdi.includes('renouvellement n°'));
test('rendu CDI : aucune moustache résiduelle', !/\{\{[a-zA-Z_]/.test(renderedCdi));
// Rendu CDD initial (if_cdd_renouvele false → bloc masqué)
const renderedCdd1 = templates.renderStatutTemplate(T2, { ...varsCddRenouvele, if_cdd_renouvele: false, cdd_renouvellements: '0' });
test('rendu CDD initial : bloc renouvellement masqué', !renderedCdd1.includes('renouvellement n°'));

// Convention de stage — template distinct (Décret n°2018-196)
const CV = convention.CONVENTION_STAGE_TEMPLATE;
test('convention : template distinct des contrats (jamais « contrat de travail »)', !/CONTRAT DE TRAVAIL/.test(CV) && CV.includes('CONVENTION DE STAGE'));
test('convention : assurance accident du travail + police', CV.includes('assurance_police') && CV.toLowerCase().includes('accidents du travail'));
test('convention : décret 2018-196 référencé', CV.includes('2018-196'));
test('convention : gratification conditionnelle (bloc if/unless)', CV.includes('{{#if_gratification}}') && CV.includes('{{#unless_gratification}}'));
test('convention : tuteur + établissement d’origine', CV.includes('{{#if_tuteur}}') && CV.includes('{{#if_etablissement_origine}}'));
test('convention : « pas un contrat de travail » (anti-confusion juridique)', CV.includes('ne constitue en aucun cas'));
const renderedCv = templates.renderStatutTemplate(CV, {
  etablissement_accueil: 'Groupe Scolaire Test', etablissement_adresse: 'Cotonou',
  representant_nom: 'M. Directeur', representant_qualite: 'Directeur',
  stagiaire_civilite: 'Le/La stagiaire', stagiaire_nom: 'Dossa', stagiaire_prenoms: 'Alice',
  stagiaire_date_naissance: '1er janvier 2004', stagiaire_nationalite: 'béninoise',
  stagiaire_type_piece: 'CNI', stagiaire_numero_piece: '12345', stagiaire_adresse: 'Cotonou',
  stagiaire_telephone: '22990000000', stagiaire_email: 'a@b.c',
  if_etablissement_origine: true, etablissement_origine: 'UAC',
  type_stage: 'Stage de fin d’études', stage_duree: '3 mois',
  date_debut: '1er octobre 2026', date_fin: '31 décembre 2026',
  mission: 'Assistance pédagogique',
  if_gratification: true, gratification_montant: '50 000', periodicite_gratification: 'mensuellement',
  assurance_compagnie: 'NSIA', assurance_police: 'POL-12345',
  if_tuteur: true, tuteur_nom: 'Mme Sow',
  nombre_exemplaires: 'trois (3)', lieu_signature: 'Cotonou', date_signature: '1er octobre 2026',
});
test('rendu convention : gratification 50 000 FCFA', renderedCv.includes('50 000 FCFA'));
test('rendu convention : police POL-12345', renderedCv.includes('POL-12345'));
test('rendu convention : aucune moustache résiduelle', !/\{\{[a-zA-Z_]/.test(renderedCv));
const renderedCvSans = templates.renderStatutTemplate(CV, {
  etablissement_accueil: 'X', etablissement_adresse: 'Y', representant_nom: 'Z', representant_qualite: 'Q',
  stagiaire_civilite: 'S', stagiaire_nom: 'N', stagiaire_prenoms: 'P',
  stagiaire_date_naissance: '', stagiaire_nationalite: 'béninoise', stagiaire_type_piece: '', stagiaire_numero_piece: '',
  stagiaire_adresse: '', stagiaire_telephone: '', stagiaire_email: '',
  if_etablissement_origine: false, etablissement_origine: '—',
  type_stage: 'observation', stage_duree: '1 mois', date_debut: 'a', date_fin: 'b', mission: 'm',
  if_gratification: false, gratification_montant: '0', periodicite_gratification: '—',
  assurance_compagnie: 'A', assurance_police: 'P',
  if_tuteur: false, tuteur_nom: '',
  nombre_exemplaires: 'trois (3)', lieu_signature: 'L', date_signature: 'D',
});
test('rendu convention sans gratification → bloc Décret 2018-196', renderedCvSans.includes('aucune gratification') && renderedCvSans.includes('2018-196'));

// ═══ 8. Valeurs par défaut paramétrables (§9) ═══
section('§9 — valeurs par défaut (modifiables par école, jamais figées)');
test('4 motifs de CDD par défaut', rules.DEFAULT_CDD_MOTIFS.length === 4);
test('motifs par défaut incluent remplacement + surcroît + tâche déterminée', rules.DEFAULT_CDD_MOTIFS.some((m) => m.includes('Remplacement')) && rules.DEFAULT_CDD_MOTIFS.some((m) => m.includes('Surcroît')));
test('seuil durée cumulée par défaut = 24 mois (2 ans, art. 34)', rules.DEFAULT_CDD_DUREE_MAX_MOIS === 24);
test('renouvellements max par défaut = 1 (renouvelable une fois)', rules.DEFAULT_CDD_RENOUVELLEMENTS_MAX === 1);
test('indemnité par défaut = 6 % (art. 49-3)', rules.DEFAULT_INDEMNITE_FIN_CONTRAT_PCT === 6);
test('3 types de stage par défaut (flux séparé)', convention.DEFAULT_STAGE_TYPES.length === 3);
test('statuts de stage : DRAFT → ACTIVE → ENDED/CANCELLED', JSON.stringify(convention.STAGE_STATUTS.slice(0, 2)) === JSON.stringify(['DRAFT', 'ACTIVE']));

// ═══ 9. Cohérence statut ↔ gabarit (§7 — génération refusée si incohérente) ═══
section('§7 — contrôle de cohérence statut ↔ template (acceptance §12)');
// Simule le garde du générateur (contract-pdf.service : isValidTypeForStatut avant rendu)
function guard(statut, type) { return rules.isValidTypeForStatut(statut, type); }
test('prestataire + contrat de travail → REFUS (garde isValidTypeForStatut)', !guard('PRESTATAIRE_SERVICE', 'CDD'));
test('salarié + prestation → REFUS', !guard('SALARIE_DECLARE', 'PRESTATION'));
test('statutToTemplateType : prestataire → CONTRAT_PRESTATION', templates.statutToTemplateType('PRESTATAIRE_SERVICE') === 'CONTRAT_PRESTATION');
test('statutToTemplateType : salarié → CONTRAT_TRAVAIL', templates.statutToTemplateType('SALARIE_DECLARE') === 'CONTRAT_TRAVAIL');
test('dérivation document de paie : prestataire → ETAT_DE_PAIEMENT', templates.deriveDocumentPaieType('PRESTATAIRE_SERVICE') === 'ETAT_DE_PAIEMENT');
test('dérivation document de paie : salarié → FICHE_DE_PAIE', templates.deriveDocumentPaieType('SALARIE_NON_DECLARE') === 'FICHE_DE_PAIE');

// ═══ 10. Migration §10 — marquage VACATAIRE (badge, non bloquant) ═══
section('§10 — migration des dossiers « Vacataire » (badge, accès non bloqué)');
const msql = fs.readFileSync(
  path.resolve(__dirname, '../apps/api-server/prisma/migrations/20260906180000_hr_contrat_refonte/migration.sql'),
  'utf8',
);
test('migration : marque needsRequalification sur les contrats VACATAIRE', msql.includes(`"contractType" = 'VACATAIRE'`) && msql.includes('"needsRequalification" = true'));
test('migration : ne supprime NI ne réécrit les dossiers (UPDATE ciblé)', !msql.toLowerCase().includes('delete from') && !msql.toLowerCase().includes('drop'));
test('migration : conserve la traçabilité (requalifieDepuis)', msql.includes('"requalifieDepuis"'));
test('migration : idempotente (IF NOT EXISTS partout + WHERE NOT déjà marqué)', (msql.match(/IF NOT EXISTS/g) || []).length >= 8 && msql.includes('"needsRequalification" = false'));
const bootstrap = fs.readFileSync(path.resolve(__dirname, '../apps/api-server/src/main.ts'), 'utf8');
test('bootstrap : même UPDATE VACATAIRE rejoué à chaque boot', bootstrap.includes(`'VACATAIRE'`) && bootstrap.includes('needsRequalification'));

// ═══ 11. Tests structurels — fichiers modifiés ═══
section('Structures — services et garde-fous backend');
const contractsService = fs.readFileSync(path.resolve(__dirname, '../apps/api-server/src/hr/contracts-prisma.service.ts'), 'utf8');
test('createContract : garde statut ↔ type (refus explicite VACATAIRE/STAGE)', contractsService.includes('n’est plus un type de contrat accepté'));
test('createContract : CDD exige date de fin + motif', contractsService.includes('Un CDD exige une date de fin obligatoire') && contractsService.includes('Le motif du CDD est obligatoire'));
test('createContract : CDI sans date de fin (null)', contractsService.includes('// CDI : pas de date de fin'));
test('createContract : chaîne CDD détectée (compteur + chainId)', contractsService.includes('cddChainId') && contractsService.includes('cddRenouvellements'));
test('renewCdd : même chaîne + compteur incrémenté + alerte seuil', contractsService.includes('async renewCdd') && contractsService.includes('depasseSeuil'));
test('closeCdd : indemnité calculée depuis la paie + ajustable', contractsService.includes('async closeCdd') && contractsService.includes('montantAjuste'));
test('requalifyContract : justification tracée + badge levé', contractsService.includes('async requalifyContract') && contractsService.includes('needsRequalification: false'));
test('requalifyContract : procédure tracée staff_statut_changes si statut change', contractsService.includes('staffStatutChange.create'));
const pdfService = fs.readFileSync(path.resolve(__dirname, '../apps/api-server/src/hr/services/contract-pdf.service.ts'), 'utf8');
test('générateur : contrôle de cohérence AVANT rendu', pdfService.includes('Incohérence statut/template'));
test('générateur : filigrane acronyme école (deriveWatermarkText)', pdfService.includes('deriveWatermarkText'));
test('générateur : plus aucun filigrane codé en dur ACADEMIA HELM', !pdfService.includes(`watermark">ACADEMIA HELM<`) && !pdfService.includes(`watermark_text || 'ACADEMIA HELM'`));
test('générateur : mise à niveau V1 → V2 des gabarits non personnalisés', pdfService.includes('CONTRAT_TRAVAIL_TEMPLATE_V1.trim()'));
test('générateur : convention de stage via le MÊME moteur (shell commun + hash)', pdfService.includes('async generateInternshipConvention') && pdfService.includes('CONVENTION_STAGE_V1'));
const schema = fs.readFileSync(path.resolve(__dirname, '../apps/api-server/prisma/schema.prisma'), 'utf8');
test('schéma : hr_contract_settings (paramétrage par école, §9)', schema.includes('model HrContractSettings'));
test('schéma : hr_internships (flux stage séparé, §6)', schema.includes('model HrInternship'));
test('schéma : champs CDD + justification + requalification sur Contract', schema.includes('cddMotif') && schema.includes('justificationStatut') && schema.includes('needsRequalification'));
const controller = fs.readFileSync(path.resolve(__dirname, '../apps/api-server/src/hr/contracts-prisma.controller.ts'), 'utf8');
test('API : routes settings / alerts / cdd-chain / renew / close-cdd / requalify exposées',
  ['settings', 'alerts', 'cdd-chain', 'renew', 'close-cdd', 'requalify'].every((r) => controller.includes(`'${r}'`) || controller.includes(`/${r}`) || controller.includes(`:${r}`)));
const internshipsController = fs.readFileSync(path.resolve(__dirname, '../apps/api-server/src/hr/internships.controller.ts'), 'utf8');
test('API : contrôleur internships (list/create/status/convention/download)',
  ['hr/internships', 'convention', 'status', 'download'].every((r) => internshipsController.includes(r)));
const recruitment = fs.readFileSync(path.resolve(__dirname, '../apps/api-server/src/hr/recruitment.service.ts'), 'utf8');
test('flux externe : coercition défensive des types (Stage/Vacataire → CDI pour salarié)', recruitment.includes('coerceSalarieContractType'));

// ═══ 12. Front — structures clés ═══
section('Front — étape 4 refondue + flux stagiaires + paramétrage');
const stepContract = fs.readFileSync(path.resolve(__dirname, '../apps/web-app/src/app/app/hr/_components/onboarding/steps/StepContract.tsx'), 'utf8');
test('StepContract : sélecteur CDI/CDD uniquement (VACATAIRE/STAGE retirés)', !stepContract.includes('value="VACATAIRE"') && !stepContract.includes('value="STAGE"') && stepContract.includes('value="CDD"') && stepContract.includes('value="CDI"'));
test('StepContract : motif CDD avec suggestions datalist (paramétrable)', stepContract.includes('cdd-motifs-suggestions') && stepContract.includes('cddMotif'));
test('StepContract : période d’essai CDI (mois, suggérée modifiable)', stepContract.includes('periodeEssaiMois') && stepContract.includes('Suggéré'));
test('StepContract : justification du statut (§4.4)', stepContract.includes('justificationStatut'));
test('StepContract : durée cumulée affichée + alerte seuil (§8.2)', stepContract.includes('cumulProjete') && stepContract.includes('depasseSeuil'));
test('StepContract : rappel subordination prestataire (§4.3, non bloquant)', stepContract.includes('Rappel de cohérence'));
test('StepContract : bandeau non-déclaré (§8.3)', stepContract.includes('SALARIE_NON_DECLARE') && stepContract.includes('Non-déclaration CNSS'));
const stepEmployment = fs.readFileSync(path.resolve(__dirname, '../apps/web-app/src/app/app/hr/_components/onboarding/steps/StepEmployment.tsx'), 'utf8');
test('StepEmployment : test d’aide à la qualification (§5, non bloquant)', stepEmployment.includes('qualificationTest') && stepEmployment.includes('suggestion') && stepEmployment.includes('ne verrouille'));
const wizard = fs.readFileSync(path.resolve(__dirname, '../apps/web-app/src/app/app/hr/_components/onboarding/OnboardingWizard.tsx'), 'utf8');
test('Wizard : CDD exige motif + date de fin ; CDI sans fin', wizard.includes('state.contract.cddMotif.trim().length >= 3'));
test('Wizard : payload cddMotif / justificationStatut / periodeEssaiMois', wizard.includes('contractBody.cddMotif') && wizard.includes('contractBody.justificationStatut') && wizard.includes('contractBody.periodeEssaiMois'));
test('Wizard : chaîne CDD chargée à l’étape 4', wizard.includes('cdd-chain'));
const ws = fs.readFileSync(path.resolve(__dirname, '../apps/web-app/src/app/app/hr/_components/workspaces/ContractsWorkspace.tsx'), 'utf8');
test('ContractsWorkspace : modale statut + type filtré + motif CDD', ws.includes('statutContractuel') && ws.includes('cddMotif'));
test('ContractsWorkspace : panneau d’alertes §8 + actions', ws.includes('contracts/alerts') && ws.includes('REQUALIFIER') && ws.includes('CLOTURER'));
test('ContractsWorkspace : modale requalification avec test embarqué (§10)', ws.includes('requalifyModal') && ws.includes('aide à la décision'));
test('ContractsWorkspace : renouvellement + clôture avec indemnité', ws.includes('renewModal') && ws.includes('closeModal') && ws.includes('indemniteFinContratPct'));
test('ContractsWorkspace : badge « À requalifier » sur les contrats', ws.includes('needsRequalification'));
const internshipsWs = fs.readFileSync(path.resolve(__dirname, '../apps/web-app/src/app/app/hr/_components/workspaces/InternshipsWorkspace.tsx'), 'utf8');
test('Stagiaires : champs CDC §6 (type, durée, gratification, origine, tuteur, assurance+police)',
  ['typeStage', 'gratificationAmount', 'etablissementOrigine', 'tuteurNom', 'assuranceSouscrite', 'assurancePoliceRef'].every((f) => internshipsWs.includes(f)));
test('Stagiaires : assurance OBLIGATOIRE avant validation (case + police)', internshipsWs.includes('assuranceValide') && internshipsWs.includes('référence de police'));
test('Stagiaires : convention générée + téléchargement (même moteur)', internshipsWs.includes('convention') && internshipsWs.includes('download'));
test('Stagiaires : pas de fiche de paie (flux distinct)', !internshipsWs.includes('payroll') || !internshipsWs.includes('bulletin'));
const settingsWs = fs.readFileSync(path.resolve(__dirname, '../apps/web-app/src/app/app/hr/_components/workspaces/SettingsWorkspace.tsx'), 'utf8');
test('Paramétrage : onglet « Embauche & Contrats » (motifs, types stage, seuils, test — §9)',
  ['cddMotifs', 'stageTypes', 'cddDureeMaxMois', 'indemniteFinContratPct', 'testQualificationEnabled'].every((f) => settingsWs.includes(f)));
const tabs = fs.readFileSync(path.resolve(__dirname, '../apps/web-app/src/app/app/hr/hr-tabs.ts'), 'utf8');
test('Navigation : onglet « Stagiaires » ajouté', tabs.includes("id: 'internships'"));
const recruitWs = fs.readFileSync(path.resolve(__dirname, '../apps/web-app/src/app/app/hr/_components/workspaces/RecruitmentWorkspace.tsx'), 'utf8');
test('Offre externe : option Stage retirée (CDI/CDD pour salarié)', !recruitWs.includes('value="Stage"'));
const staffDetail = fs.readFileSync(path.resolve(__dirname, '../apps/web-app/src/app/app/hr/staff/[id]/page.tsx'), 'utf8');
test('Fiche personnel : bandeau non-déclaré permanent (§8.3) + badge requalifier (§10)', staffDetail.includes('SALARIE_NON_DECLARE') && staffDetail.includes('needsRequalification'));
const payrollPage = fs.readFileSync(path.resolve(__dirname, '../apps/web-app/src/app/app/hr/payroll/[id]/page.tsx'), 'utf8');
test('Page paie : bandeau non-déclaré (§8.3 — chaque étape ultérieure)', payrollPage.includes('SALARIE_NON_DECLARE') && payrollPage.includes('jamais masqué'));
const staffWs = fs.readFileSync(path.resolve(__dirname, '../apps/web-app/src/app/app/hr/_components/workspaces/StaffWorkspace.tsx'), 'utf8');
test('Liste personnel : badges « À requalifier » + « Non déclaré CNSS »', staffWs.includes('À requalifier') && staffWs.includes('Non déclaré CNSS'));

// ═══ Résumé ═══
console.log(`\n════════════════════════════════════════════`);
console.log(`  RÉSULTAT : ${pass} réussis, ${fail} échoués (${pass + fail} tests)`);
console.log(`════════════════════════════════════════════`);
process.exit(fail ? 1 : 0);
