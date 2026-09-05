/**
 * Test de logique RH Bénin — statut contractuel :
 *  1. renderStatutTemplate : blocs {{#if_x}}/{{#unless_x}} + variables (2 gabarits)
 *  2. PayrollEngineService : fiche de paie (CNSS+ITS) / état de paiement (AIB)
 * Exécuter : bun scripts/_test_hr_engine.mjs (depuis la racine du repo)
 */
import {
  renderStatutTemplate,
  CONTRAT_TRAVAIL_TEMPLATE,
  CONTRAT_PRESTATION_TEMPLATE,
  deriveDocumentPaieType,
  statutToTemplateType,
} from '../apps/api-server/src/hr/services/employment-contract-templates.ts';
import { PayrollEngineService } from '../apps/api-server/src/hr/services/payroll-engine.service.ts';

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`✓ ${label}`);
  else { failures++; console.log(`✗ ${label}${detail ? ' — ' + detail : ''}`); }
}

// ═══ 1. Dérivations ═══
check('dérivation FICHE_DE_PAIE (salarié déclaré)', deriveDocumentPaieType('SALARIE_DECLARE') === 'FICHE_DE_PAIE');
check('dérivation FICHE_DE_PAIE (salarié non déclaré)', deriveDocumentPaieType('SALARIE_NON_DECLARE') === 'FICHE_DE_PAIE');
check('dérivation ETAT_DE_PAIEMENT (prestataire)', deriveDocumentPaieType('PRESTATAIRE_SERVICE') === 'ETAT_DE_PAIEMENT');
check('dérivation null (sans statut)', deriveDocumentPaieType(null) === null);
check('template CONTRAT_TRAVAIL pour salarié', statutToTemplateType('SALARIE_DECLARE') === 'CONTRAT_TRAVAIL');
check('template CONTRAT_PRESTATION pour prestataire', statutToTemplateType('PRESTATAIRE_SERVICE') === 'CONTRAT_PRESTATION');

// ═══ 2. Rendu contrat_travail ═══
const varsTravail = {
  type_contrat_libelle: 'à Durée Déterminée (CDD)',
  employeur_raison_sociale: 'GROUPE SCOLAIRE ÉVEIL D\'AFRIQUE',
  employeur_forme_juridique: 'SARL',
  employeur_capital: '5 000 000 FCFA',
  employeur_rccm: 'RB/COT/01-B-12345',
  employeur_ifu: '1234567890',
  employeur_adresse: 'Cotonou, Bénin',
  employeur_representant_nom: 'Erhel DEGBE',
  employeur_representant_qualite: 'Directeur Général',
  salarie_civilite: 'Monsieur',
  salarie_nom: 'ADJOVI',
  salarie_prenoms: 'Paul',
  salarie_date_naissance: '5 janvier 1990',
  salarie_lieu_naissance: 'Porto-Novo',
  salarie_nationalite: 'béninoise',
  salarie_type_piece: 'CNI',
  salarie_numero_piece: '1234567890',
  salarie_adresse: 'Cotonou',
  poste_intitule: 'Professeur de Mathématiques',
  poste_categorie: 'Personnel enseignant',
  poste_echelon: '____',
  lieu_affectation: 'Cotonou',
  if_cdd: true,
  if_cdi: false,
  cdd_duree: '9 mois',
  cdd_motif: 'surcroît d\'activité',
  date_debut: '1er octobre 2026',
  date_fin: '30 juin 2027',
  periode_essai_duree: 'deux (2) mois',
  periode_essai_renouvelable: 'une (1) fois',
  duree_hebdomadaire: '40',
  repartition_horaires: 'du lundi au vendredi',
  salaire_brut: '200 000',
  periodicite_paiement: 'mensuellement',
  mode_paiement: 'virement bancaire',
  if_primes: false,
  liste_primes: '',
  if_cnss_declare: true,
  cnss_numero: 'CNSS-123456',
  jours_conges_par_mois: '1,5',
  duree_preavis: 'un (1) mois',
  nombre_exemplaires: 'deux (2)',
  lieu_signature: 'Cotonou',
  date_signature: '5 septembre 2026',
};

const renderedTravail = renderStatutTemplate(CONTRAT_TRAVAIL_TEMPLATE, varsTravail);
check('travail: variables substituées', renderedTravail.includes('GROUPE SCOLAIRE ÉVEIL D\'AFRIQUE') && renderedTravail.includes('ADJOVI'));
check('travail: bloc CDD rendu (if_cdd)', renderedTravail.includes('conclu à durée déterminée, pour une durée de 9 mois'));
check('travail: bloc CDI absent (if_cdi=false)', !renderedTravail.includes('durée indéterminée à compter du'));
check('travail: bloc CNSS rendu (déclaré)', renderedTravail.includes('affilié à la Caisse Nationale de Sécurité Sociale') && renderedTravail.includes('CNSS-123456'));
check('travail: clause régularisation absente (déclaré)', !renderedTravail.includes('régularisation\nprogressive'));
check('travail: pas de moustache résiduelle', !/\{\{[#/]?(if_|unless_)?[a-zA-Z_]+\}\}/.test(renderedTravail), renderedTravail.match(/\{\{[^}]+\}\}/)?.[0]);

// Variantes : salarié non déclaré + CDI
const renderedNonDeclare = renderStatutTemplate(CONTRAT_TRAVAIL_TEMPLATE, {
  ...varsTravail, if_cdd: false, if_cdi: true, if_cnss_declare: false,
});
check('travail: clause de régularisation rendue (non déclaré)', renderedNonDeclare.includes('régularisation\nprogressive'));
check('travail: bloc CNSS absent (non déclaré)', !renderedNonDeclare.includes('affilié à la Caisse Nationale'));
check('travail: bloc CDI rendu', renderedNonDeclare.includes('durée indéterminée à compter du'));

// ═══ 3. Rendu contrat_prestation ═══
const varsPrestation = {
  client_raison_sociale: 'GROUPE SCOLAIRE ÉVEIL D\'AFRIQUE',
  client_forme_juridique: 'SARL',
  client_ifu: '1234567890',
  client_adresse: 'Cotonou',
  client_representant_nom: 'Erhel DEGBE',
  client_representant_qualite: 'Directeur Général',
  prestataire_civilite: 'Madame',
  prestataire_nom: 'LOKOSSOU',
  prestataire_prenoms: 'Anne',
  if_prestataire_ifu: true,
  prestataire_ifu: 'IFU-987654',
  prestataire_adresse: 'Porto-Novo',
  prestataire_type_piece: 'CNI',
  prestataire_numero_piece: '987654321',
  description_prestation: 'Animation de séances de renforcement en mathématiques (classes de 3e)',
  calendrier_interventions: 'plages indicatives de 15h à 17h, mardis et jeudis',
  date_debut: '1er octobre 2026',
  date_fin: '30 juin 2027',
  if_renouvelable: false,
  if_forfait: true,
  if_horaire: false,
  montant_forfait: '600 000',
  taux_horaire: '5 000',
  periodicite_paiement: 'mensuellement',
  taux_aib: 3,
  if_confidentialite: true,
  if_propriete_contenus: true,
  delai_mise_en_demeure: 'quinze (15) jours',
  juridiction_competente: 'Cotonou',
  lieu_signature: 'Cotonou',
  nombre_exemplaires: 'deux (2)',
  date_signature: '5 septembre 2026',
};

const renderedPrestation = renderStatutTemplate(CONTRAT_PRESTATION_TEMPLATE, varsPrestation);
check('prestation: parties substituées', renderedPrestation.includes('LOKOSSOU') && renderedPrestation.includes('GROUPE SCOLAIRE'));
check('prestation: IFU rendu', renderedPrestation.includes('IFU-987654'));
check('prestation: forfait rendu (if_forfait)', renderedPrestation.includes('montant forfaitaire de 600 000 FCFA'));
check('prestation: bloc horaire absent', !renderedPrestation.includes('par heure de prestation'));
check('prestation: taux AIB rendu', renderedPrestation.includes('au taux de 3 %'));
check('prestation: pas de moustache résiduelle', !/\{\{[#/]?(if_|unless_)?[a-zA-Z_]+\}\}/.test(renderedPrestation));

// Variantes : sans IFU + horaire + renouvelable
const renderedSansIfu = renderStatutTemplate(CONTRAT_PRESTATION_TEMPLATE, {
  ...varsPrestation, if_prestataire_ifu: false, if_forfait: false, if_horaire: true, if_renouvelable: true, taux_aib: 5,
});
check('prestation: bloc IFU absent (sans IFU)', !renderedSansIfu.includes('IFU-987654'));
check('prestation: bloc horaire rendu', renderedSansIfu.includes('par heure de prestation'));
check('prestation: renouvelable rendu', renderedSansIfu.includes('renouvelable par accord exprès'));
check('prestation: sans reconduction absente', !renderedSansIfu.includes('sans reconduction tacite'));

// ═══ 4. Moteur de calcul ═══
const engine = new PayrollEngineService(null); // prisma inutile pour les calculs purs
const rates = {
  fiscalYear: 2026,
  cnssSalarial: 3.6,
  cnssPrestationsFamiliales: 9,
  cnssRisquesProMin: 1,
  cnssRisquesProMax: 4,
  cnssVieillesse: 16,
  cnssPatronalGlobal: 15.4,
  itsBrackets: [
    { min: 0, max: 60000, rate: 0 },
    { min: 60000, max: 150000, rate: 10 },
    { min: 150000, max: 250000, rate: 15 },
    { min: 250000, max: 500000, rate: 19 },
    { min: 500000, max: 1000000, rate: 25 },
    { min: 1000000, max: 3000000, rate: 30 },
    { min: 3000000, max: null, rate: 35 },
  ],
  aibAvecIfu: 3,
  aibSansIfu: 5,
  smig: 52000,
  cnssMensuelSeuil: 20,
  categoryRules: null,
};

// Fiche de paie — salarié déclaré 200 000 FCFA
const fiche = engine.computeFicheDePaie(200000, { cnssActif: true, rates });
check('fiche: CNSS salariale 3,6 % = 7 200', Math.abs(fiche.cnssSalarial - 7200) < 0.01, String(fiche.cnssSalarial));
check('fiche: brut imposable = 192 800', Math.abs(fiche.brutImposable - 192800) < 0.01);
// ITS progressif : 60000-150000 → 9000 ; 150000-192800 → 42800×15% = 6420 → total 15420
check('fiche: ITS progressif = 15 420', Math.abs(fiche.its - 15420) < 0.01, String(fiche.its));
check('fiche: net = 177 380', Math.abs(fiche.net - 177380) < 0.01, String(fiche.net));
check('fiche: patronal global 15,4 % = 30 800', Math.abs(fiche.chargesPatronales.total - 30800) < 0.01);

// Fiche de paie — salarié non déclaré (ITS seul, tranche 0 % → 60 000)
const ficheNd = engine.computeFicheDePaie(60000, { cnssActif: false, rates });
check('fiche ND: pas de CNSS', ficheNd.cnssSalarial === 0 && ficheNd.chargesPatronales === null);
check('fiche ND: ITS 0 (sous la 1re tranche)', ficheNd.its === 0);
check('fiche ND: net = brut', ficheNd.net === 60000);

// Fiche de paie — haut salaire (ITS multi-tranches)
const ficheHaut = engine.computeFicheDePaie(1000000, { cnssActif: true, rates });
// imposable = 964000 → 9000 + 15000 + 71400×0.19=13566... calcul : (150k-60k)=90k×10%=9000 ; (250k-150k)=100k×15%=15000 ; (500k-250k)=250k×19%=47500 ; (964000-500000)=464000×25%=116000 → total 187500
check('fiche haut: ITS = 187 500', Math.abs(ficheHaut.its - 187500) < 0.01, String(ficheHaut.its));

// État de paiement — prestataire AVEC IFU
const etatIfu = engine.computeEtatDePaiement(300000, { ifuPresent: true, rates });
check('état AIB: taux 3 % avec IFU', etatIfu.tauxAib === 3);
check('état AIB: retenue 9 000', Math.abs(etatIfu.aib - 9000) < 0.01);
check('état AIB: net 291 000', Math.abs(etatIfu.net - 291000) < 0.01);
check('état AIB: mention légale présente', etatIfu.mention.includes('ne constitue pas une fiche de paie'));

// État de paiement — prestataire SANS IFU
const etatSans = engine.computeEtatDePaiement(300000, { ifuPresent: false, rates });
check('état: taux 5 % sans IFU', etatSans.tauxAib === 5);
check('état: retenue 15 000, net 285 000', Math.abs(etatSans.aib - 15000) < 0.01 && Math.abs(etatSans.net - 285000) < 0.01);

// Barème ITS — contrôles de bord
check('ITS: montant négatif → 0', engine.computeIts(-5000, rates.itsBrackets) === 0);
check('ITS: 60 000 exactement → 0', engine.computeIts(60000, rates.itsBrackets) === 0);
check('ITS: 150 000 → 9 000', Math.abs(engine.computeIts(150000, rates.itsBrackets) - 9000) < 0.01);
check('ITS: barème vide → 0', engine.computeIts(500000, []) === 0);

// Dispatch par statut (via calculateForStatut sans prisma → null, on teste les branches pures)
check('dispatch local fiche/état cohérent', fiche.documentPaieType === 'FICHE_DE_PAIE' && etatIfu.documentPaieType === 'ETAT_DE_PAIEMENT');

console.log(failures ? `\n${failures} test(s) en échec` : '\nTOUS LES TESTS PASSENT');
process.exit(failures ? 1 : 0);
