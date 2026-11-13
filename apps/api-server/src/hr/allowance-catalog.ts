/**
 * ============================================================================
 * ALLOWANCE TYPE CATALOG — Catalogue des types d'indemnité RH
 * ============================================================================
 *
 * Catalogue de référence (domaine éducatif béninois) auto-provisionné pour
 * chaque tenant : la liste complète est disponible dans le sélecteur
 * « Type d'indemnité » du modal Assigner une indemnité et dans l'étape
 * Contrat du processus d'embauche — plus besoin de créer les types à la main.
 *
 * ⭐ Aucun montant par défaut : c'est l'établissement qui fixe le montant au
 *    moment de l'assignation (à un collaborateur ou lors d'un recrutement),
 *    et il reste modifiable à tout moment.
 *
 * ⭐ Les 4 derniers types (13/11/2026) correspondent aux rubriques de la
 *    fiche de paie (TaxPayslip) : moins perçus/arriérés, gratifications et
 *    étrennes, indemnités (rubrique générique) et primes de salissure —
 *    ils alimentent directement ces colonnes lors de la génération de paie.
 * ============================================================================
 */

export interface AllowanceCatalogEntry {
  name: string;
  code: string;
  description: string;
}

export const ALLOWANCE_TYPE_CATALOG: AllowanceCatalogEntry[] = [
  { name: 'Indemnité de Logement', code: 'LOGEMENT', description: 'Indemnité versée pour le logement du personnel' },
  { name: 'Indemnité de Transport', code: 'TRANSPORT', description: 'Indemnité de transport aller-retour domicile-travail' },
  { name: 'Prime de Responsabilité', code: 'RESPONSABILITE', description: 'Prime liée aux fonctions de responsabilité' },
  { name: "Indemnité d'Enseignement", code: 'ENSEIGNEMENT', description: "Indemnité pour heures d'enseignement supplémentaires" },
  { name: "Prime de Sujet d'Examen", code: 'SUJET_EXAMEN', description: 'Rémunération pour la composition de sujets d\u2019examens' },
  { name: 'Indemnité de Surveillance', code: 'SURVEILLANCE', description: 'Indemnité pour la surveillance des examens' },
  { name: 'Indemnité de Correction', code: 'CORRECTION', description: 'Rémunération pour la correction de copies d\u2019examens' },
  { name: 'Prime de Direction', code: 'DIRECTION', description: 'Prime allouée aux directeurs/coordonnateurs' },
  { name: 'Indemnité de Coordination', code: 'COORDINATION', description: 'Indemnité pour coordination pédagogique' },
  { name: 'Prime de Motivation', code: 'MOTIVATION', description: 'Prime de motivation et d\u2019encouragement' },
  { name: 'Indemnité de Fonction', code: 'FONCTION', description: 'Indemnité liée à la fonction occupée' },
  { name: "Prime d'Ancienneté", code: 'ANCIENNETE', description: 'Prime basée sur l\u2019ancienneté dans l\u2019établissement' },
  { name: 'Indemnité de Repas', code: 'REPAS', description: 'Indemnité pour les repas du personnel' },
  { name: 'Indemnité de Communication', code: 'COMMUNICATION', description: 'Indemnité téléphone/internet professionnel' },
  { name: 'Prime de Performance', code: 'PERFORMANCE', description: 'Prime basée sur l\u2019évaluation des performances' },
  { name: 'Indemnité de Risque / Travail Pénible', code: 'RISQUE', description: 'Indemnité pour conditions de travail difficiles' },
  { name: 'Prime de Fin d\u2019Année', code: 'FIN_ANNEE', description: 'Prime de fin d\u2019année (13ème mois)' },
  { name: 'Indemnité de Congé Annuel', code: 'CONGE_ANNUEL', description: 'Indemnité compensatrice de congé annuel' },
  // ⭐ 13/11/2026 — 4 types alignés sur les rubriques de la fiche de paie
  { name: 'Moins Perçu / Arriérés', code: 'MOINS_PERCU_ARRIERS', description: 'Régularisation des sommes perçues en moins et arriérés de rémunération (rubrique fiche de paie)' },
  { name: 'Gratifications et Étrennes', code: 'GRATIFICATIONS_ETRENNES', description: 'Gratifications, dons et étrennes versés au personnel (rubrique fiche de paie)' },
  { name: 'Indemnités', code: 'INDEMNITES', description: 'Rubrique générique des indemnités du personnel — montant libre (rubrique fiche de paie)' },
  { name: 'Primes de Salissure', code: 'PRIMES_SALISSURE', description: 'Prime de salissure pour le personnel d\u2019entretien et de surface (rubrique fiche de paie)' },
];

/**
 * Codes du catalogue qui correspondent à une rubrique DÉDIÉE de la fiche de
 * paie (TaxPayslip). Tous les autres types alimentent la rubrique générique
 * « indemnites » lors de la génération de la paie.
 */
export const PAYSLIP_DEDICATED_CODES: Record<string, string> = {
  MOINS_PERCU_ARRIERS: 'moinsPercesArriere',
  GRATIFICATIONS_ETRENNES: 'gratificationsEtrennes',
  PRIMES_SALISSURE: 'primeSalissures',
};
