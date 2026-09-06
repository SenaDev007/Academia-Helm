/**
 * ============================================================================
 * INTERNSHIP CONVENTION TEMPLATE — Convention de stage (Décret n°2018-196)
 * ============================================================================
 *
 * Gabarit DISTINCT du contrat de travail et du contrat de prestation :
 * le stage professionnel relève du Décret n°2018-196 du 23 mai 2018 (texte
 * distinct du Code du travail). Un stagiaire n'est pas un salarié :
 *   - pas de contrat de travail, pas de bulletin de paie salarié ;
 *   - une GRATIFICATION (si applicable selon la durée) ;
 *   - une assurance accident du travail à la charge de l'établissement
 *     d'accueil (référence de police obligatoire avant validation).
 *
 * Syntaxe : variables {{variable}} + blocs maison {{#if_x}}/{{#unless_x}}
 * (convertis en Handlebars par renderStatutTemplate — même moteur de rendu
 * que les contrats : « même moteur de génération de documents » exigé par
 * le CDC, avec un template juridique distinct).
 *
 * ⚠️ Validation juridique par un professionnel du droit reste requise.
 * ============================================================================
 */

export const CONVENTION_STAGE_TEMPLATE = `CONVENTION DE STAGE PROFESSIONNEL

Entre les soussignés :

{{etablissement_accueil}}, dont le siège est situé à {{etablissement_adresse}},
représentée par {{representant_nom}}, agissant en qualité de {{representant_qualite}},
ci-après désignée « l'Établissement d'accueil »,

D'une part,

Et

{{stagiaire_civilite}} {{stagiaire_nom}} {{stagiaire_prenoms}},
né(e) le {{stagiaire_date_naissance}}, de nationalité {{stagiaire_nationalite}},
titulaire de la pièce d'identité {{stagiaire_type_piece}} n° {{stagiaire_numero_piece}},
demeurant à {{stagiaire_adresse}}, joignable au {{stagiaire_telephone}} ({{stagiaire_email}}),
{{#if_etablissement_origine}}
stagiaire de {{etablissement_origine}},
{{/if_etablissement_origine}}
ci-après désigné(e) « le Stagiaire »,

D'autre part,

{{#if_tuteur}}
Encadré(e) par {{tuteur_nom}}, tuteur/référent au sein de l'Établissement d'accueil.

{{/if_tuteur}}
Il a été convenu ce qui suit :

ARTICLE 1 — OBJET DE LA CONVENTION
La présente convention régit un stage de type « {{type_stage}} », d'une durée de
{{stage_duree}}, du {{date_debut}} au {{date_fin}}, au sein de l'Établissement
d'accueil, pour le poste ou la mission suivante : {{mission}}.
Le présent stage a pour objet de permettre au Stagiaire de compléter sa formation
par une expérience pratique en milieu professionnel. Il ne constitue en aucun cas
un contrat de travail et ne crée aucun lien de subordination salarié entre les
parties au sens du Code du travail.

ARTICLE 2 — STATUT DU STAGIAIRE
Le Stagiaire demeure rattaché à son établissement d'origine{{#if_etablissement_origine}} ({{etablissement_origine}}){{/if_etablissement_origine}}.
Il s'engage à se conformer au règlement intérieur de l'Établissement d'accueil
ainsi qu'aux consignes générales d'organisation qui lui seront communiquées, dans
le respect de sa formation et des objectifs pédagogiques du stage.

ARTICLE 3 — GRATIFICATION
{{#if_gratification}}
Le Stagiaire percevra une gratification de stage de {{gratification_montant}} FCFA,
{{periodicite_gratification}}, en contrepartie du présent stage. Cette gratification
n'a pas la nature juridique d'un salaire et n'ouvre droit à aucune cotisation
sociale au titre du présent stage.
{{/if_gratification}}
{{#unless_gratification}}
Compte tenu des modalités et de la durée du présent stage, aucune gratification
n'est versée au Stagiaire, conformément aux dispositions du Décret n°2018-196 du
23 mai 2018 portant stage professionnel en République du Bénin.
{{/unless_gratification}}

ARTICLE 4 — ASSURANCE ACCIDENT DU TRAVAIL
Conformément au Décret n°2018-196, l'Établissement d'accueil a souscrit une
assurance couvrant le Stagiaire contre les accidents du travail pouvant survenir
pendant la durée du stage, auprès de la compagnie {{assurance_compagnie}},
sous la police n° {{assurance_police}}.

ARTICLE 5 — ENCADREMENT ET ÉVALUATION
{{#if_tuteur}}
Le Stagiaire est placé sous la responsabilité pédagogique de {{tuteur_nom}}, qui
assure son encadrement, suit l'exécution du stage et établit, à l'issue, une
appréciation sur les activités réalisées et les compétences acquises.
{{/if_tuteur}}
{{#unless_tuteur}}
Le Stagiaire est placé sous la responsabilité pédagogique du référent désigné
par l'Établissement d'accueil, qui assure son encadrement et évalue le stage.
{{/unless_tuteur}}

ARTICLE 6 — OBLIGATIONS DES PARTIES
L'Établissement d'accueil s'engage à fournir au Stagiaire les moyens matériels
et l'encadrement nécessaires à la bonne exécution du stage. Le Stagiaire
s'engage à exécuter les activités confiées dans le cadre de son stage, à
respecter la confidentialité des informations auxquelles il accède et à
informer l'Établissement d'accueil de tout obstacle à la poursuite du stage.

ARTICLE 7 — DURÉE ET FIN DE LA CONVENTION
La présente convention prend fin à l'échéance du {{date_fin}}. Elle peut être
résiliée avant terme par accord mutuel, ou de manière unilatérale par l'une des
parties avec un préavis raisonnable, sous réserve de l'accord de l'établissement
d'origine lorsqu'il intervient dans le cadre d'un cursus.

ARTICLE 8 — LITIGES
Tout différend relatif à la présente convention sera soumis, préalablement à
toute action judiciaire, à une tentative de conciliation amiable entre les
parties, puis, à défaut, aux juridictions compétentes.

Fait à {{lieu_signature}}, en {{nombre_exemplaires}} exemplaires, le {{date_signature}}.

Pour l'Établissement d'accueil            Le Stagiaire
{{representant_nom}}                      {{stagiaire_nom}} {{stagiaire_prenoms}}
{{#if_tuteur}}

Le Tuteur / Référent
{{tuteur_nom}}
{{/if_tuteur}}`;

export const CONVENTION_STAGE_VARIABLES: Record<string, string> = {
  etablissement_accueil: 'Nom de l’établissement d’accueil (école)',
  etablissement_adresse: 'Adresse de l’établissement d’accueil',
  representant_nom: 'Représentant légal (directeur/promoteur)',
  representant_qualite: 'Qualité du représentant',
  stagiaire_civilite: 'Monsieur / Madame',
  stagiaire_nom: 'Nom du stagiaire',
  stagiaire_prenoms: 'Prénoms du stagiaire',
  stagiaire_date_naissance: 'Date de naissance (ou à compléter)',
  stagiaire_nationalite: 'Nationalité',
  stagiaire_type_piece: 'Type de pièce d’identité',
  stagiaire_numero_piece: 'N° pièce d’identité',
  stagiaire_adresse: 'Domicile',
  stagiaire_telephone: 'Téléphone',
  stagiaire_email: 'Email',
  etablissement_origine: 'Établissement d’origine (école/université/centre)',
  type_stage: 'Type de stage (paramétrable par école)',
  stage_duree: 'Durée du stage (libellé)',
  date_debut: 'Date de début',
  date_fin: 'Date de fin',
  mission: 'Poste / mission du stage',
  if_gratification: 'Bloc gratification (versée)',
  gratification_montant: 'Montant de la gratification',
  periodicite_gratification: 'Périodicité de la gratification',
  assurance_compagnie: 'Compagnie d’assurance (obligatoire avant validation)',
  assurance_police: 'N° de police d’assurance accident du travail',
  if_tuteur: 'Bloc tuteur (désigné)',
  tuteur_nom: 'Nom du tuteur/référent',
  if_etablissement_origine: 'Bloc établissement d’origine (renseigné)',
  nombre_exemplaires: 'Nombre d’exemplaires',
  lieu_signature: 'Lieu de signature',
  date_signature: 'Date de signature',
};

export const TEMPLATE_TYPE_CONVENTION_STAGE = 'CONVENTION_STAGE';

export const STAGE_STATUTS = ['DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED'] as const;

export const STAGE_STATUT_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  ACTIVE: 'En cours',
  ENDED: 'Terminé',
  CANCELLED: 'Annulé',
};

/** Types de stage par défaut — MODIFIABLES par école (hr_contract_settings.stageTypes). */
export const DEFAULT_STAGE_TYPES: string[] = [
  'Stage d’observation',
  'Stage d’application',
  'Stage de fin d’études',
];
