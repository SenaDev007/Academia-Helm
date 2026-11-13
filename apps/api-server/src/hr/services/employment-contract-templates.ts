/**
 * ============================================================================
 * EMPLOYMENT CONTRACT TEMPLATES — Statut contractuel (RH Bénin)
 * ============================================================================
 *
 * Deux gabarits DISTINCTS (jamais un template unique avec champs masqués) :
 *   - CONTRAT_TRAVAIL           : SALARIE_DECLARE + SALARIE_NON_DECLARE
 *     (un seul modèle légal de contrat de travail ; seule la donnée administrative
 *      annexe CNSS diffère → bloc conditionnel {{#if_cnss_declare}})
 *   - CONTRAT_PRESTATION        : PRESTATAIRE_SERVICE
 *     (contrat de prestation de services — absence de lien de subordination,
 *      retenue AIB à la source, pas de CNSS ni d'ITS)
 *
 * Syntaxe : variables {{variable}} + blocs conditionnels maison
 *   {{#if_x}} … {{/if_x}}      → rendu si x truthy
 *   {{#unless_x}} … {{/unless_x}} → rendu si x falsy
 * (convertis en blocs Handlebars standard par renderStatutTemplate)
 *
 * ⚠️ Les textes ci-dessous servent de SEED en base (contract_templates) — le
 * générateur lit toujours la version en base, jamais ces constantes (sauf
 * bootstrap-on-demand si la ligne n'existe pas encore).
 *
 * ⚠️ VALIDATION JURIDIQUE : ces modèles structurent le contrat selon le droit du
 * travail béninois mais ne remplacent pas la validation d'un avocat en droit
 * social. Les barèmes (essai, préavis) et le barème ITS/CNSS proviennent de
 * payroll_fiscal_rates (sourceNotes = points à confirmer).
 * ============================================================================
 */

import * as Handlebars from 'handlebars';

// ─── Statut contractuel : valeurs, labels, dérivation ────────────────────────

export const STATUT_CONTRACTUEL_VALUES = [
  'SALARIE_DECLARE',
  'SALARIE_NON_DECLARE',
  'PRESTATAIRE_SERVICE',
] as const;

export type StatutContractuel =
  | 'SALARIE_DECLARE'
  | 'SALARIE_NON_DECLARE'
  | 'PRESTATAIRE_SERVICE';

export const DOCUMENT_PAIE_VALUES = ['FICHE_DE_PAIE', 'ETAT_DE_PAIEMENT'] as const;
export type DocumentPaieType = 'FICHE_DE_PAIE' | 'ETAT_DE_PAIEMENT';

export const STATUT_CONTRACTUEL_LABELS: Record<string, string> = {
  SALARIE_DECLARE: 'Salarié déclaré (CNSS)',
  SALARIE_NON_DECLARE: 'Salarié non déclaré',
  PRESTATAIRE_SERVICE: 'Prestataire de services',
};

export const DOCUMENT_PAIE_LABELS: Record<string, string> = {
  FICHE_DE_PAIE: 'Fiche de paie',
  ETAT_DE_PAIEMENT: 'État de paiement',
};

export const PRESTATION_PAYMENT_LABELS: Record<string, string> = {
  FORFAIT: 'Forfait',
  HORAIRE: 'Taux horaire',
};

export function isValidStatutContractuel(v: unknown): v is StatutContractuel {
  return typeof v === 'string' && (STATUT_CONTRACTUEL_VALUES as readonly string[]).includes(v);
}

/**
 * Règle de dérivation stricte (validation backend, jamais seulement en UI) :
 *   SALARIE_DECLARE     → FICHE_DE_PAIE (CNSS active, IFU non requis)
 *   SALARIE_NON_DECLARE → FICHE_DE_PAIE (pas de CNSS)
 *   PRESTATAIRE_SERVICE → ETAT_DE_PAIEMENT (AIB, pas de CNSS ni d'ITS)
 */
export function deriveDocumentPaieType(statut: string | null | undefined): DocumentPaieType | null {
  if (!statut) return null;
  return statut === 'PRESTATAIRE_SERVICE' ? 'ETAT_DE_PAIEMENT' : 'FICHE_DE_PAIE';
}

/** Catégorie professionnelle dérivée du roleType (barèmes essai/préavis). */
export function categoryKeyFromRoleType(roleType: string | null | undefined): string {
  switch (roleType) {
    case 'DIRECTOR': return 'CADRE';
    case 'TEACHER': return 'ENSEIGNANT';
    case 'ADMIN': return 'AGENT_MAITRISE';
    default: return 'OUVRIER_EMPLOYE';
  }
}

export const CATEGORY_LABELS: Record<string, string> = {
  OUVRIER_EMPLOYE: 'Ouvriers et employés',
  AGENT_MAITRISE: 'Agents de maîtrise',
  CADRE: 'Cadres',
  ENSEIGNANT: 'Personnel enseignant',
};

// ─── Template CONTRAT DE TRAVAIL (salariés, avec ou sans CNSS) ───────────────

/**
 * V1 = gabarit d’origine (avant refonte CDC « étape Contrat »). Conservé
 * uniquement pour la DÉTECTION de mise à niveau : un template en base IDENTIQUE
 * à V1 (jamais personnalisé par l’école) est migré automatiquement vers V2
 * (clauses renouvellement/durée cumulée + indemnité de fin de contrat CDD).
 * Un template personnalisé n’est JAMAIS écrasé.
 */
export const CONTRAT_TRAVAIL_TEMPLATE_V1 = `CONTRAT DE TRAVAIL {{type_contrat_libelle}}

Entre les soussignés :

{{employeur_raison_sociale}}, {{employeur_forme_juridique}} au capital de {{employeur_capital}},
immatriculée au RCCM sous le numéro {{employeur_rccm}}, IFU {{employeur_ifu}},
dont le siège social est situé à {{employeur_adresse}},
représentée par {{employeur_representant_nom}}, agissant en qualité de {{employeur_representant_qualite}},
ci-après désignée « l'Employeur »,

D'une part,

Et

{{salarie_civilite}} {{salarie_nom}} {{salarie_prenoms}},
né(e) le {{salarie_date_naissance}} à {{salarie_lieu_naissance}},
de nationalité {{salarie_nationalite}},
titulaire de la pièce d'identité {{salarie_type_piece}} n° {{salarie_numero_piece}},
demeurant à {{salarie_adresse}},
ci-après désigné(e) « le Salarié »,

D'autre part,

Il a été convenu ce qui suit :

ARTICLE 1 — OBJET
Le présent contrat a pour objet l'engagement du Salarié par l'Employeur en qualité de
{{poste_intitule}}, catégorie professionnelle {{poste_categorie}}, échelon {{poste_echelon}}.
Le Salarié exercera ses fonctions au sein de {{lieu_affectation}}, sous l'autorité et la
direction de l'Employeur.

ARTICLE 2 — NATURE ET DURÉE DU CONTRAT
{{#if_cdd}}
Le présent contrat est conclu à durée déterminée, pour une durée de {{cdd_duree}},
prenant effet le {{date_debut}} et prenant fin le {{date_fin}}.
Motif du recours à la durée déterminée : {{cdd_motif}}.
{{/if_cdd}}
{{#if_cdi}}
Le présent contrat est conclu à durée indéterminée à compter du {{date_debut}}.
{{/if_cdi}}

ARTICLE 3 — PÉRIODE D'ESSAI
Le présent contrat comporte une période d'essai de {{periode_essai_duree}},
renouvelable {{periode_essai_renouvelable}}, conformément à la catégorie professionnelle
du Salarié. Pendant cette période, chacune des parties peut mettre fin au contrat sans
préavis ni indemnité.

ARTICLE 4 — DURÉE ET ORGANISATION DU TRAVAIL
Le Salarié est engagé pour une durée hebdomadaire de travail de {{duree_hebdomadaire}} heures,
réparties comme suit : {{repartition_horaires}}.

ARTICLE 5 — RÉMUNÉRATION
En contrepartie de ses fonctions, le Salarié percevra un salaire mensuel brut de
{{salaire_brut}} FCFA, payable {{periodicite_paiement}} par {{mode_paiement}}.
{{#if_primes}}
S'ajoutent à ce salaire les primes et avantages suivants : {{liste_primes}}.
{{/if_primes}}
Ce salaire ne peut être inférieur au Salaire Minimum Interprofessionnel Garanti (SMIG)
en vigueur en République du Bénin.

ARTICLE 6 — PROTECTION SOCIALE
{{#if_cnss_declare}}
Le Salarié est affilié à la Caisse Nationale de Sécurité Sociale (CNSS) sous le numéro
{{cnss_numero}}. Les cotisations sociales, part salariale et part patronale, sont
précomptées et reversées conformément à la réglementation en vigueur.
{{/if_cnss_declare}}
{{#unless_cnss_declare}}
Les modalités de couverture sociale du Salarié font l'objet d'une régularisation
progressive conformément aux dispositions légales applicables.
{{/unless_cnss_declare}}

ARTICLE 7 — CONGÉS PAYÉS
Le Salarié bénéficie d'un congé payé annuel calculé conformément aux dispositions du
Code du Travail en République du Bénin et de la convention collective applicable au
secteur de l'enseignement privé, à raison de {{jours_conges_par_mois}} jour(s) ouvrable(s)
par mois de service effectif.

ARTICLE 8 — OBLIGATIONS DES PARTIES
Le Salarié s'engage à exécuter personnellement les tâches qui lui sont confiées, à
respecter le règlement intérieur de l'Employeur et à observer la discipline de l'établissement. L'Employeur s'engage à fournir au Salarié les moyens nécessaires à
l'exécution de sa prestation et à lui verser la rémunération convenue aux échéances prévues.

ARTICLE 9 — RUPTURE DU CONTRAT
{{#if_cdi}}
Le présent contrat peut être rompu par l'une ou l'autre des parties moyennant un préavis
de {{duree_preavis}}, sauf faute grave ou lourde privative de préavis et d'indemnités.
{{/if_cdi}}
{{#if_cdd}}
Le présent contrat prend fin de plein droit à son terme, sans indemnité, sauf dispositions
contraires du Code du Travail en cas de rupture anticipée.
{{/if_cdd}}

ARTICLE 10 — LITIGES
Tout différend né de l'exécution ou de l'interprétation du présent contrat sera soumis,
préalablement à toute action judiciaire, à l'Inspection du Travail territorialement
compétente, puis, à défaut de conciliation, au Tribunal du Travail compétent.

ARTICLE 11 — DISPOSITIONS FINALES
Le présent contrat est établi en {{nombre_exemplaires}} exemplaires originaux, dont un
remis à chacune des parties.

Fait à {{lieu_signature}}, le {{date_signature}}.

Pour l'Employeur                          Le Salarié
{{employeur_representant_nom}}            {{salarie_nom}} {{salarie_prenoms}}`;

/**
 * V2 = gabarit CDC « étape Contrat » (clauses renouvellement/durée cumulée
 * + indemnité de fin de contrat CDD). Conservé UNIQUEMENT pour la DÉTECTION
 * de mise à niveau V2 → V3 (bloc indemnités) — jamais personnalisé par
 * l'école → migré automatiquement.
 */
export const CONTRAT_TRAVAIL_TEMPLATE_V2 = `CONTRAT DE TRAVAIL {{type_contrat_libelle}}

Entre les soussignés :

{{employeur_raison_sociale}}, {{employeur_forme_juridique}} au capital de {{employeur_capital}},
immatriculée au RCCM sous le numéro {{employeur_rccm}}, IFU {{employeur_ifu}},
dont le siège social est situé à {{employeur_adresse}},
représentée par {{employeur_representant_nom}}, agissant en qualité de {{employeur_representant_qualite}},
ci-après désignée « l'Employeur »,

D'une part,

Et

{{salarie_civilite}} {{salarie_nom}} {{salarie_prenoms}},
né(e) le {{salarie_date_naissance}} à {{salarie_lieu_naissance}},
de nationalité {{salarie_nationalite}},
titulaire de la pièce d'identité {{salarie_type_piece}} n° {{salarie_numero_piece}},
demeurant à {{salarie_adresse}},
ci-après désigné(e) « le Salarié »,

D'autre part,

Il a été convenu ce qui suit :

ARTICLE 1 — OBJET
Le présent contrat a pour objet l'engagement du Salarié par l'Employeur en qualité de
{{poste_intitule}}, catégorie professionnelle {{poste_categorie}}, échelon {{poste_echelon}}.
Le Salarié exercera ses fonctions au sein de {{lieu_affectation}}, sous l'autorité et la
direction de l'Employeur.

ARTICLE 2 — NATURE ET DURÉE DU CONTRAT
{{#if_cdd}}
Le présent contrat est conclu à durée déterminée, pour une durée de {{cdd_duree}},
prenant effet le {{date_debut}} et prenant fin le {{date_fin}}.
Motif du recours à la durée déterminée : {{cdd_motif}}.
{{#if_cdd_renouvele}}
Le présent contrat constitue le renouvellement n° {{cdd_renouvellements}} de la relation
contractuelle à durée déterminée initiée le {{cdd_date_initial}} ; la durée cumulée de
ladite relation s'établit à {{cdd_duree_cumulee}}.
{{/if_cdd_renouvele}}
Conformément au Code du travail, la durée totale de la relation à durée déterminée,
renouvellements inclus, ne peut excéder {{cdd_duree_max}} ; au-delà de ce terme, la
relation est réputée conclue à durée indéterminée de plein droit.
{{/if_cdd}}
{{#if_cdi}}
Le présent contrat est conclu à durée indéterminée à compter du {{date_debut}}.
{{/if_cdi}}

ARTICLE 3 — PÉRIODE D'ESSAI
Le présent contrat comporte une période d'essai de {{periode_essai_duree}},
renouvelable {{periode_essai_renouvelable}}, conformément à la catégorie professionnelle
du Salarié. Pendant cette période, chacune des parties peut mettre fin au contrat sans
préavis ni indemnité.

ARTICLE 4 — DURÉE ET ORGANISATION DU TRAVAIL
Le Salarié est engagé pour une durée hebdomadaire de travail de {{duree_hebdomadaire}} heures,
réparties comme suit : {{repartition_horaires}}.

ARTICLE 5 — RÉMUNÉRATION
En contrepartie de ses fonctions, le Salarié percevra un salaire mensuel brut de
{{salaire_brut}} FCFA, payable {{periodicite_paiement}} par {{mode_paiement}}.
{{#if_primes}}
S'ajoutent à ce salaire les primes et avantages suivants : {{liste_primes}}.
{{/if_primes}}
Ce salaire ne peut être inférieur au Salaire Minimum Interprofessionnel Garanti (SMIG)
en vigueur en République du Bénin.

ARTICLE 6 — PROTECTION SOCIALE
{{#if_cnss_declare}}
Le Salarié est affilié à la Caisse Nationale de Sécurité Sociale (CNSS) sous le numéro
{{cnss_numero}}. Les cotisations sociales, part salariale et part patronale, sont
précomptées et reversées conformément à la réglementation en vigueur.
{{/if_cnss_declare}}
{{#unless_cnss_declare}}
Les modalités de couverture sociale du Salarié font l'objet d'une régularisation
progressive conformément aux dispositions légales applicables.
{{/unless_cnss_declare}}

ARTICLE 7 — CONGÉS PAYÉS
Le Salarié bénéficie d'un congé payé annuel calculé conformément aux dispositions du
Code du Travail en République du Bénin et de la convention collective applicable au
secteur de l'enseignement privé, à raison de {{jours_conges_par_mois}} jour(s) ouvrable(s)
par mois de service effectif.

ARTICLE 8 — OBLIGATIONS DES PARTIES
Le Salarié s'engage à exécuter personnellement les tâches qui lui sont confiées, à
respecter le règlement intérieur de l'Employeur et à observer la discipline de
l'établissement. L'Employeur s'engage à fournir au Salarié les moyens nécessaires à
l'exécution de sa prestation et à lui verser la rémunération convenue aux échéances prévues.

ARTICLE 9 — RUPTURE DU CONTRAT
{{#if_cdi}}
Le présent contrat peut être rompu par l'une ou l'autre des parties moyennant un préavis
de {{duree_preavis}}, sauf faute grave ou lourde privative de préavis et d'indemnités.
{{/if_cdi}}
{{#if_cdd}}
Le présent contrat prend fin de plein droit à son terme. À l'expiration du présent
contrat, et sauf conclusion immédiate d'un contrat à durée indéterminée, le Salarié a
droit à une indemnité de fin de contrat égale à {{indemnite_fin_contrat_pct}} % de la
rémunération totale brute perçue pendant la durée du contrat, calculée et versée lors
de la clôture du contrat. En cas de rupture anticipée, les dispositions du Code du
Travail relatives à la rupture anticipée d'un contrat à durée déterminée s'appliquent.
{{/if_cdd}}

ARTICLE 10 — LITIGES
Tout différend né de l'exécution ou de l'interprétation du présent contrat sera soumis,
préalablement à toute action judiciaire, à l'Inspection du Travail territorialement
compétente, puis, à défaut de conciliation, au Tribunal du Travail compétent.

ARTICLE 11 — DISPOSITIONS FINALES
Le présent contrat est établi en {{nombre_exemplaires}} exemplaires originaux, dont un
remis à chacune des parties.

Fait à {{lieu_signature}}, le {{date_signature}}.

Pour l'Employeur                          Le Salarié
{{employeur_representant_nom}}            {{salarie_nom}} {{salarie_prenoms}}`;

/**
 * V3 = gabarit courant (13/11/2026). En plus de V2 :
 *   - Article 5 : bloc indemnités — les indemnités actives du personnel
 *     (onglet « Indemnités » / workflow d'embauche) sont reprises dans le
 *     contrat, ligne par ligne avec leur montant, et le total. Elles
 *     alimentent également les rubriques de la fiche de paie.
 */
export const CONTRAT_TRAVAIL_TEMPLATE = `CONTRAT DE TRAVAIL {{type_contrat_libelle}}

Entre les soussignés :

{{employeur_raison_sociale}}, {{employeur_forme_juridique}} au capital de {{employeur_capital}},
immatriculée au RCCM sous le numéro {{employeur_rccm}}, IFU {{employeur_ifu}},
dont le siège social est situé à {{employeur_adresse}},
représentée par {{employeur_representant_nom}}, agissant en qualité de {{employeur_representant_qualite}},
ci-après désignée « l'Employeur »,

D'une part,

Et

{{salarie_civilite}} {{salarie_nom}} {{salarie_prenoms}},
né(e) le {{salarie_date_naissance}} à {{salarie_lieu_naissance}},
de nationalité {{salarie_nationalite}},
titulaire de la pièce d'identité {{salarie_type_piece}} n° {{salarie_numero_piece}},
demeurant à {{salarie_adresse}},
ci-après désigné(e) « le Salarié »,

D'autre part,

Il a été convenu ce qui suit :

ARTICLE 1 — OBJET
Le présent contrat a pour objet l'engagement du Salarié par l'Employeur en qualité de
{{poste_intitule}}, catégorie professionnelle {{poste_categorie}}, échelon {{poste_echelon}}.
Le Salarié exercera ses fonctions au sein de {{lieu_affectation}}, sous l'autorité et la
direction de l'Employeur.

ARTICLE 2 — NATURE ET DURÉE DU CONTRAT
{{#if_cdd}}
Le présent contrat est conclu à durée déterminée, pour une durée de {{cdd_duree}},
prenant effet le {{date_debut}} et prenant fin le {{date_fin}}.
Motif du recours à la durée déterminée : {{cdd_motif}}.
{{#if_cdd_renouvele}}
Le présent contrat constitue le renouvellement n° {{cdd_renouvellements}} de la relation
contractuelle à durée déterminée initiée le {{cdd_date_initial}} ; la durée cumulée de
ladite relation s'établit à {{cdd_duree_cumulee}}.
{{/if_cdd_renouvele}}
Conformément au Code du travail, la durée totale de la relation à durée déterminée,
renouvellements inclus, ne peut excéder {{cdd_duree_max}} ; au-delà de ce terme, la
relation est réputée conclue à durée indéterminée de plein droit.
{{/if_cdd}}
{{#if_cdi}}
Le présent contrat est conclu à durée indéterminée à compter du {{date_debut}}.
{{/if_cdi}}

ARTICLE 3 — PÉRIODE D'ESSAI
Le présent contrat comporte une période d'essai de {{periode_essai_duree}},
renouvelable {{periode_essai_renouvelable}}, conformément à la catégorie professionnelle
du Salarié. Pendant cette période, chacune des parties peut mettre fin au contrat sans
préavis ni indemnité.

ARTICLE 4 — DURÉE ET ORGANISATION DU TRAVAIL
Le Salarié est engagé pour une durée hebdomadaire de travail de {{duree_hebdomadaire}} heures,
réparties comme suit : {{repartition_horaires}}.

ARTICLE 5 — RÉMUNÉRATION
En contrepartie de ses fonctions, le Salarié percevra un salaire mensuel brut de
{{salaire_brut}} FCFA, payable {{periodicite_paiement}} par {{mode_paiement}}.
{{#if_primes}}
S'ajoutent à ce salaire les primes et avantages suivants : {{liste_primes}}.
{{/if_primes}}
{{#if_indemnites}}
S'ajoutent également à ce salaire les indemnités suivantes, définies lors du recrutement
du Salarié et reprises chaque mois sur sa fiche de paie :
{{liste_indemnites}}
Soit un total d'indemnités de {{total_indemnites}} FCFA par mois. Le montant de chaque
indemnité demeure modifiable d'un commun accord des parties, sans affecter le présent
contrat dont les clauses demeurent en vigueur.
{{/if_indemnites}}
Ce salaire ne peut être inférieur au Salaire Minimum Interprofessionnel Garanti (SMIG)
en vigueur en République du Bénin.

ARTICLE 6 — PROTECTION SOCIALE
{{#if_cnss_declare}}
Le Salarié est affilié à la Caisse Nationale de Sécurité Sociale (CNSS) sous le numéro
{{cnss_numero}}. Les cotisations sociales, part salariale et part patronale, sont
précomptées et reversées conformément à la réglementation en vigueur.
{{/if_cnss_declare}}
{{#unless_cnss_declare}}
Les modalités de couverture sociale du Salarié font l'objet d'une régularisation
progressive conformément aux dispositions légales applicables.
{{/unless_cnss_declare}}

ARTICLE 7 — CONGÉS PAYÉS
Le Salarié bénéficie d'un congé payé annuel calculé conformément aux dispositions du
Code du Travail en République du Bénin et de la convention collective applicable au
secteur de l'enseignement privé, à raison de {{jours_conges_par_mois}} jour(s) ouvrable(s)
par mois de service effectif.

ARTICLE 8 — OBLIGATIONS DES PARTIES
Le Salarié s'engage à exécuter personnellement les tâches qui lui sont confiées, à
respecter le règlement intérieur de l'Employeur et à observer la discipline de
l'établissement. L'Employeur s'engage à fournir au Salarié les moyens nécessaires à
l'exécution de sa prestation et à lui verser la rémunération convenue aux échéances prévues.

ARTICLE 9 — RUPTURE DU CONTRAT
{{#if_cdi}}
Le présent contrat peut être rompu par l'une ou l'autre des parties moyennant un préavis
de {{duree_preavis}}, sauf faute grave ou lourde privative de préavis et d'indemnités.
{{/if_cdi}}
{{#if_cdd}}
Le présent contrat prend fin de plein droit à son terme. À l'expiration du présent
contrat, et sauf conclusion immédiate d'un contrat à durée indéterminée, le Salarié a
droit à une indemnité de fin de contrat égale à {{indemnite_fin_contrat_pct}} % de la
rémunération totale brute perçue pendant la durée du contrat, calculée et versée lors
de la clôture du contrat. En cas de rupture anticipée, les dispositions du Code du
Travail relatives à la rupture anticipée d'un contrat à durée déterminée s'appliquent.
{{/if_cdd}}

ARTICLE 10 — LITIGES
Tout différend né de l'exécution ou de l'interprétation du présent contrat sera soumis,
préalablement à toute action judiciaire, à l'Inspection du Travail territorialement
compétente, puis, à défaut de conciliation, au Tribunal du Travail compétent.

ARTICLE 11 — DISPOSITIONS FINALES
Le présent contrat est établi en {{nombre_exemplaires}} exemplaires originaux, dont un
remis à chacune des parties.

Fait à {{lieu_signature}}, le {{date_signature}}.

Pour l'Employeur                          Le Salarié
{{employeur_representant_nom}}            {{salarie_nom}} {{salarie_prenoms}}`;

// ─── Template CONTRAT DE PRESTATION DE SERVICES ─────────────────────────────

export const CONTRAT_PRESTATION_TEMPLATE = `CONTRAT DE PRESTATION DE SERVICES

Entre les soussignés :

{{client_raison_sociale}}, {{client_forme_juridique}}, IFU {{client_ifu}},
dont le siège est situé à {{client_adresse}},
représentée par {{client_representant_nom}}, {{client_representant_qualite}},
ci-après désignée « le Client »,

D'une part,

Et

{{prestataire_civilite}} {{prestataire_nom}} {{prestataire_prenoms}},
{{#if_prestataire_ifu}}
immatriculé(e) au fichier de la Direction Générale des Impôts sous le numéro IFU
{{prestataire_ifu}},
{{/if_prestataire_ifu}}
demeurant à {{prestataire_adresse}}, titulaire de la pièce d'identité
{{prestataire_type_piece}} n° {{prestataire_numero_piece}},
ci-après désigné(e) « le Prestataire »,

D'autre part,

Il a été convenu ce qui suit :

ARTICLE 1 — OBJET
Le Client confie au Prestataire, qui accepte, la réalisation de la prestation suivante :
{{description_prestation}}.
Le présent contrat est un contrat de prestation de services et ne constitue en aucun cas
un contrat de travail. Il est exclusif de tout lien de subordination entre les parties.

ARTICLE 2 — MODALITÉS D'EXÉCUTION
Le Prestataire exécute la prestation en toute indépendance, selon l'organisation, les
méthodes et le rythme de travail qui lui conviennent, sans être soumis à un contrôle
hiérarchique ni à des horaires imposés par le Client, sous la seule réserve du respect
du calendrier des interventions défini d'un commun accord : {{calendrier_interventions}}.
Le Prestataire demeure libre de recourir à des moyens propres pour exécuter sa mission
et peut, sauf clause d'exclusivité expresse, prêter ses services à d'autres clients.

ARTICLE 3 — DURÉE
Le présent contrat prend effet le {{date_debut}} et prend fin le {{date_fin}},
{{#if_renouvelable}}renouvelable par accord exprès des parties{{/if_renouvelable}}
{{#unless_renouvelable}}sans reconduction tacite{{/unless_renouvelable}}.

ARTICLE 4 — RÉMUNÉRATION
En contrepartie de la prestation, le Client versera au Prestataire :
{{#if_forfait}}
un montant forfaitaire de {{montant_forfait}} FCFA pour l'ensemble de la mission décrite
à l'Article 1.
{{/if_forfait}}
{{#if_horaire}}
un montant de {{taux_horaire}} FCFA par heure de prestation effectivement réalisée, sur
la base d'un relevé d'heures validé par les deux parties.
{{/if_horaire}}
Le paiement intervient {{periodicite_paiement}}, sur présentation d'une facture ou d'un
décompte d'heures par le Prestataire.

ARTICLE 5 — RÉGIME FISCAL
Conformément au Code Général des Impôts en République du Bénin, le Client procède, lors
de chaque paiement, à la retenue à la source de l'Acompte sur Impôt assis sur les
Bénéfices (AIB) au taux de {{taux_aib}} %, calculé sur le montant brut de la prestation.
Le Prestataire demeure seul responsable de ses obligations fiscales et sociales
propres, le présent contrat n'ouvrant droit à aucune affiliation à la Caisse Nationale
de Sécurité Sociale au titre de la présente relation contractuelle.

ARTICLE 6 — CONFIDENTIALITÉ ET PROPRIÉTÉ DES CONTENUS
{{#if_confidentialite}}
Le Prestataire s'engage à conserver confidentielles toutes les informations dont il
aurait connaissance dans le cadre de l'exécution du présent contrat.
{{/if_confidentialite}}
{{#if_propriete_contenus}}
Les contenus pédagogiques ou supports produits par le Prestataire dans le cadre strict
de la présente mission sont cédés au Client dès leur validation et leur paiement.
{{/if_propriete_contenus}}

ARTICLE 7 — RÉSILIATION
Chaque partie peut résilier le présent contrat en cas de manquement grave de l'autre
partie à ses obligations, après mise en demeure restée sans effet pendant
{{delai_mise_en_demeure}}.

ARTICLE 8 — LITIGES
Tout litige relatif au présent contrat relève de la compétence des juridictions civiles
et commerciales de {{juridiction_competente}}.

Fait à {{lieu_signature}}, en {{nombre_exemplaires}} exemplaires, le {{date_signature}}.

Pour le Client                            Le Prestataire
{{client_representant_nom}}               {{prestataire_nom}} {{prestataire_prenoms}}`;

// ─── Moteur de rendu (syntaxe maison → Handlebars) ──────────────────────────

/**
 * Convertit la syntaxe conditionnelle maison en blocs Handlebars standard :
 *   {{#if_x}} … {{/if_x}}          → {{#if x}} … {{/if}}
 *   {{#unless_x}} … {{/unless_x}}  → {{#unless x}} … {{/unless}}
 * puis compile et rend avec les variables fournies.
 */
export function renderStatutTemplate(source: string, vars: Record<string, any>): string {
  // Les blocs maison {{#if_x}} / {{#unless_x}} lisent la VARIABLE if_x (le
  // tableau de variables expose des booléens nommés if_x — ex. if_cdd, if_cnss_declare).
  const handlebarsSource = source
    .replace(/\{\{#if_([a-zA-Z0-9_]+)\}\}/g, '{{#if if_$1}}')
    .replace(/\{\{#unless_([a-zA-Z0-9_]+)\}\}/g, '{{#unless if_$1}}')
    .replace(/\{\{\/if_[a-zA-Z0-9_]+\}\}/g, '{{/if}}')
    .replace(/\{\{\/unless_[a-zA-Z0-9_]+\}\}/g, '{{/unless}}');
  // Pas d'échappement Handlebars ici : les valeurs passent brutes dans le texte
  // rendu, puis le shell HTML (contract-pdf.service) échappe l'ENSEMBLE du texte
  // avant insertion — un seul point d'échappement, pas de double-encodage.
  const compiled = Handlebars.compile(handlebarsSource, { noEscape: true });
  return compiled(vars);
}

// ─── Variables documentées (seedées dans contract_templates.variables) ──────

export const CONTRAT_TRAVAIL_VARIABLES: Record<string, string> = {
  type_contrat_libelle: 'Libellé CDI/CDD',
  employeur_raison_sociale: 'Raison sociale de l\u2019école (fiche R1 / identité)',
  employeur_forme_juridique: 'Forme juridique (fiche R1, sinon à compléter)',
  employeur_capital: 'Capital social (fiche R1, sinon à compléter)',
  employeur_rccm: 'N° RCCM (fiche R1, sinon à compléter)',
  employeur_ifu: 'IFU employeur (fiche R1 / tenant)',
  employeur_adresse: 'Adresse du siège',
  employeur_representant_nom: 'Représentant légal (directeur/promoteur)',
  employeur_representant_qualite: 'Qualité du représentant',
  salarie_civilite: 'Monsieur / Madame',
  salarie_nom: 'Nom',
  salarie_prenoms: 'Prénoms',
  salarie_date_naissance: 'Date de naissance',
  salarie_lieu_naissance: 'Lieu de naissance (à compléter si inconnu)',
  salarie_nationalite: 'Nationalité',
  salarie_type_piece: 'Type de pièce d\u2019identité',
  salarie_numero_piece: 'N° pièce d\u2019identité',
  salarie_adresse: 'Domicile',
  poste_intitule: 'Intitulé du poste',
  poste_categorie: 'Catégorie professionnelle (dérivée roleType)',
  poste_echelon: 'Échelon (non géré — à compléter)',
  lieu_affectation: 'Lieu d\u2019affectation',
  if_cdd: 'Bloc CDD (dérivé duration)',
  if_cdi: 'Bloc CDI (dérivé duration)',
  cdd_duree: 'Durée du CDD',
  cdd_motif: 'Motif du CDD (paramétrable par école — hr_contract_settings.cddMotifs)',
  if_cdd_renouvele: 'Bloc renouvellement (cddRenouvellements > 0)',
  cdd_renouvellements: 'N° de renouvellement dans la chaîne (compteur automatique)',
  cdd_date_initial: 'Date de début du contrat initial de la chaîne',
  cdd_duree_cumulee: 'Durée cumulée CDD (contrat initial + renouvellements — champ calculé)',
  cdd_duree_max: 'Seuil légal de durée totale (paramétrable par école, défaut 24 mois)',
  indemnite_fin_contrat_pct: 'Taux indemnité de fin de contrat CDD (paramétrable, défaut 6 %)',
  date_debut: 'Date d\u2019effet',
  date_fin: 'Date de fin (CDD)',
  periode_essai_duree: 'Période d\u2019essai (payroll_fiscal_rates.categoryRules)',
  periode_essai_renouvelable: 'Renouvellement de l\u2019essai',
  duree_hebdomadaire: 'Heures/semaine',
  repartition_horaires: 'Répartition des horaires',
  salaire_brut: 'Salaire brut mensuel (validation ≥ SMIG)',
  periodicite_paiement: 'Périodicité de paiement',
  mode_paiement: 'Mode de paiement',
  if_primes: 'Bloc primes',
  liste_primes: 'Liste des primes',
  if_indemnites: 'Bloc indemnités (onglet Indemnités / embauche)',
  liste_indemnites: 'Liste des indemnités actives (une ligne par indemnité, avec montant)',
  total_indemnites: 'Total mensuel des indemnités actives',
  if_cnss_declare: 'Bloc CNSS (SALARIE_DECLARE uniquement)',
  cnss_numero: 'N° CNSS',
  jours_conges_par_mois: 'Jours de congé par mois',
  duree_preavis: 'Préavis (payroll_fiscal_rates.categoryRules)',
  nombre_exemplaires: 'Nombre d\u2019exemplaires',
  lieu_signature: 'Lieu de signature',
  date_signature: 'Date de signature',
};

export const CONTRAT_PRESTATION_VARIABLES: Record<string, string> = {
  client_raison_sociale: 'Raison sociale de l\u2019école',
  client_forme_juridique: 'Forme juridique',
  client_ifu: 'IFU du client/école',
  client_adresse: 'Adresse du client',
  client_representant_nom: 'Représentant légal',
  client_representant_qualite: 'Qualité du représentant',
  prestataire_civilite: 'Monsieur / Madame',
  prestataire_nom: 'Nom',
  prestataire_prenoms: 'Prénoms',
  prestataire_adresse: 'Domicile',
  prestataire_type_piece: 'Type de pièce d\u2019identité',
  prestataire_numero_piece: 'N° pièce d\u2019identité',
  if_prestataire_ifu: 'Bloc IFU (renseigné)',
  prestataire_ifu: 'N° IFU (conditionne le taux AIB)',
  description_prestation: 'Description précise de la prestation',
  calendrier_interventions: 'Calendrier indicatif des interventions',
  date_debut: 'Date d\u2019effet',
  date_fin: 'Date de fin',
  if_renouvelable: 'Bloc renouvelable',
  if_forfait: 'Bloc forfait',
  if_horaire: 'Bloc horaire',
  montant_forfait: 'Montant forfaitaire',
  taux_horaire: 'Taux horaire',
  periodicite_paiement: 'Périodicité de paiement',
  taux_aib: 'Taux AIB (calculé : IFU → 3 %, sinon 5 % — payroll_fiscal_rates)',
  if_confidentialite: 'Bloc confidentialité',
  if_propriete_contenus: 'Bloc propriété des contenus',
  delai_mise_en_demeure: 'Délai de mise en demeure',
  juridiction_competente: 'Juridiction compétente',
  lieu_signature: 'Lieu de signature',
  nombre_exemplaires: 'Nombre d\u2019exemplaires',
  date_signature: 'Date de signature',
};

// ─── Clés de template en base (contract_templates.contractType) ─────────────

export const TEMPLATE_TYPE_CONTRAT_TRAVAIL = 'CONTRAT_TRAVAIL';
export const TEMPLATE_TYPE_CONTRAT_PRESTATION = 'CONTRAT_PRESTATION';

export function statutToTemplateType(statut: string): string {
  return statut === 'PRESTATAIRE_SERVICE'
    ? TEMPLATE_TYPE_CONTRAT_PRESTATION
    : TEMPLATE_TYPE_CONTRAT_TRAVAIL;
}
