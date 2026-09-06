/**
 * ============================================================================
 * CONTRACT RULES — Règles pures de la refonte de l'étape « Contrat » (CDC)
 * ============================================================================
 *
 * Logique 100 % pure (aucune dépendance Nest/Prisma) — testable via bun.
 * Principe directeur : SaaS multi-écoles, AUCUNE règle codée en dur pour un
 * cas d'usage spécifique. Chaque constante ci-dessous est une VALEUR PAR
 * DÉFAUT modifiable par école dans hr_contract_settings (paramétrage), ou
 * dérivée d'une donnée saisie — jamais un comportement figé.
 *
 * Points couverts par le CDC :
 *   - correspondance statut_contractuel → types de contrat disponibles
 *   - durée cumulée CDD (chaîne contrat initial + renouvellements)
 *   - test d'aide à la qualification (non bloquant, texte configurable)
 *   - indemnité de fin de contrat CDD (taux paramétrable, défaut 6 %)
 *   - filigrane des documents : acronyme de l'école (jamais « Academia Helm »)
 * ============================================================================
 */

// ─── 1. Correspondance statut contractuel → types de contrat ────────────────

/**
 * « Vacataire » n'est pas une catégorie du Code du travail béninois pour le
 * secteur privé : toute personne ainsi désignée est, en droit, soit un salarié
 * en CDD (subordination réelle), soit un prestataire de service (autonomie).
 * Le stage relève du Décret n°2018-196 (flux séparé, hors embauche salariée).
 */
export const TYPES_CONTRAT_PAR_STATUT: Record<string, readonly string[]> = {
  SALARIE_DECLARE: ['CDI', 'CDD'],
  SALARIE_NON_DECLARE: ['CDI', 'CDD'],
  PRESTATAIRE_SERVICE: ['PRESTATION'],
};

export const TYPE_PRESTATION_UNIQUE = 'PRESTATION';

export const TYPE_LABELS: Record<string, string> = {
  CDI: 'Contrat à Durée Indéterminée (CDI)',
  CDD: 'Contrat à Durée Déterminée (CDD)',
  PRESTATION: 'Contrat de prestation de service',
  VACATAIRE: 'Vacataire (obsolète — à requalifier)',
  STAGE: 'Stage (flux séparé)',
  CONSULTANT: 'Consultant (obsolète)',
};

/** Types hérités que le système n'accepte PLUS à la création (migration §10). */
export const TYPES_LEGACY_A_REQUALIFIER = ['VACATAIRE', 'CONSULTANT'] as const;

/** Un salarié ne peut recevoir qu'un contrat de travail (CDI/CDD). */
export function isValidTypeForStatut(statut: string | null | undefined, contractType: string | null | undefined): boolean {
  if (!statut) return true; // contrats hérités sans statut : chemin legacy intact
  const allowed = TYPES_CONTRAT_PAR_STATUT[statut];
  if (!allowed) return false;
  return !!contractType && allowed.includes(contractType);
}

/** Types encore valides pour un statut (alimente les sélecteurs filtrés). */
export function typesDisponiblesPourStatut(statut: string | null | undefined): readonly string[] {
  if (!statut) return [];
  return TYPES_CONTRAT_PAR_STATUT[statut] ?? [];
}

// ─── 2. Durée cumulée CDD (chaîne contrat initial + renouvellements) ────────

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

export function monthsBetween(start: Date | string, end: Date | string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!isFinite(s) || !isFinite(e) || e <= s) return 0;
  return (e - s) / (MS_PAR_JOUR * 30.4375);
}

export function daysBetween(start: Date | string, end: Date | string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (!isFinite(s) || !isFinite(e) || e < s) return 0;
  return (e - s) / MS_PAR_JOUR;
}

export interface CddLikeContract {
  id?: string;
  startDate: Date | string;
  endDate: Date | string | null;
  contractType: string;
  status?: string;
  cddChainId?: string | null;
  cddRenouvellements?: number;
}

export interface CddChainSummary {
  chainId: string | null;
  /** Nombre de contrats dans la chaîne (initial + renouvellements) */
  contracts: number;
  /** Renouvellements = contrats - 1 (si chaîne identifiée) */
  renouvellements: number;
  /** Durée cumulée en mois (somme des durées de chaque contrat de la chaîne) */
  dureeCumuleeMois: number;
  /** Date de fin du dernier contrat de la chaîne */
  finDeChaine: Date | null;
}

/**
 * Regroupe les CDD d'un même personnel en chaînes (contrat initial +
 * renouvellements). Un renouvellement est détecté quand un CDD démarre dans
 * les 60 jours suivant la fin d'un CDD précédent (continuité/contiguïté de
 * la relation de travail), ou partage explicitement le même cddChainId.
 * Les contrats supprimés/résiliés d'une autre chaîne restent comptés dès
 * lors qu'ils appartiennent à la même relation continue (l'esprit de la loi
 * est la durée TOTALE de la relation en CDD).
 */
export function computeCddChains(contracts: CddLikeContract[]): CddChainSummary[] {
  const cdds = contracts
    .filter((c) => c.contractType === 'CDD' && c.startDate && c.endDate && c.status !== 'DELETED')
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const chains: CddLikeContract[][] = [];
  let current: CddLikeContract[] = [];

  for (const c of cdds) {
    if (current.length === 0) {
      current = [c];
      continue;
    }
    // Chaîne explicite prioritaire
    const prev = current[current.length - 1];
    const sameExplicitChain = !!(c.cddChainId && prev.cddChainId && c.cddChainId === prev.cddChainId);
    // Continuité : démarre ≤ 60 jours après la fin du précédent
    const contigu = daysBetween(prev.endDate, c.startDate) <= 60;
    if (sameExplicitChain || contigu) {
      current.push(c);
    } else {
      chains.push(current);
      current = [c];
    }
  }
  if (current.length > 0) chains.push(current);

  return chains.map((chain) => {
    const dureeCumuleeMois = chain.reduce(
      (sum, c) => sum + monthsBetween(c.startDate, c.endDate as Date | string),
      0,
    );
    const last = chain[chain.length - 1];
    return {
      chainId: last.cddChainId || null,
      contracts: chain.length,
      renouvellements: Math.max(0, chain.length - 1),
      dureeCumuleeMois: Math.round(dureeCumuleeMois * 10) / 10,
      finDeChaine: last.endDate ? new Date(last.endDate) : null,
    };
  });
}

/** Chaîne active (celle qui se termine le plus récemment / en cours). */
export function activeCddChain(contracts: CddLikeContract[]): CddChainSummary | null {
  const chains = computeCddChains(contracts);
  if (chains.length === 0) return null;
  const now = Date.now();
  const ongoing = chains.filter((ch) => ch.finDeChaine && ch.finDeChaine.getTime() + 60 * MS_PAR_JOUR >= now);
  if (ongoing.length === 0) return null;
  return ongoing[ongoing.length - 1];
}

// ─── 3. Test d'aide à la qualification (§5 — non bloquant, configurable) ────

export interface QualificationQuestion {
  id: string;
  question: string;
  help?: string;
  /** Options binaires proposées (libellés configurables) */
  options: [string, string];
  /**
   * Sens de la 1re option : 'subordination' → répondre option 1 oriente vers
   * salarié ; 'autonomie' → oriente vers prestataire.
   */
  firstOptionMeaning: 'subordination' | 'autonomie';
}

export const DEFAULT_TEST_QUESTIONS: QualificationQuestion[] = [
  {
    id: 'horaires',
    question: 'Cette personne doit-elle respecter des horaires fixés par l’école ?',
    help: 'Un salarié se conforme aux horaires de l’établissement ; un prestataire organise librement son travail.',
    options: ['Oui', 'Non'],
    firstOptionMeaning: 'subordination',
  },
  {
    id: 'instructions',
    question: 'Cette personne reçoit-elle des instructions directes sur la façon d’exécuter son travail, ou définit-elle elle-même sa méthode ?',
    help: 'Le lien de subordination juridique se reconnaît aux directives reçues sur le comment du travail.',
    options: ['Reçoit des instructions (subordonnée)', 'Définit elle-même sa méthode (autonome)'],
    firstOptionMeaning: 'subordination',
  },
  {
    id: 'refus',
    question: 'Cette personne peut-elle refuser une mission ponctuelle sans conséquence contractuelle ?',
    help: 'Un salarié ne peut pas refuser une tâche légitime confiée dans le cadre de son poste.',
    options: ['Non', 'Oui'],
    firstOptionMeaning: 'subordination',
  },
];

export interface QualificationAnswers {
  [questionId: string]: 0 | 1; // index de l'option choisie
}

export interface QualificationResult {
  suggestion: 'SALARIE' | 'PRESTATAIRE' | 'INCONNU';
  scoreSubordination: number;
  scoreAutonomie: number;
  total: number;
  explanation: string;
}

/**
 * Le résultat SUGGÈRE un statut, il ne verrouille JAMAIS le choix final :
 * le gestionnaire RH de l'école reste décisionnaire (le système est un outil
 * d'aide, pas une autorité juridique).
 */
export function evaluateQualificationTest(
  questions: QualificationQuestion[],
  answers: QualificationAnswers,
): QualificationResult {
  let sub = 0;
  let auto = 0;
  let answered = 0;
  for (const q of questions) {
    const a = answers[q.id];
    if (a !== 0 && a !== 1) continue;
    answered++;
    const choseFirst = a === 0;
    const firstIsSubordination = q.firstOptionMeaning === 'subordination';
    if (choseFirst === firstIsSubordination) sub++;
    else auto++;
  }
  if (answered === 0) {
    return {
      suggestion: 'INCONNU',
      scoreSubordination: 0,
      scoreAutonomie: 0,
      total: 0,
      explanation: 'Aucune réponse au test — aucune suggestion disponible.',
    };
  }
  const suggestion: QualificationResult['suggestion'] =
    sub === auto ? 'INCONNU' : sub > auto ? 'SALARIE' : 'PRESTATAIRE';
  const explanation =
    suggestion === 'SALARIE'
      ? 'Les réponses indiquent un lien de subordination (horaires, instructions, obligation d’exécuter les missions). En droit béninois, ce profil relève d’un CONTRAT DE TRAVAIL (salarié). Un statut « prestataire » exposerait l’école à un risque de requalification.'
      : suggestion === 'PRESTATAIRE'
        ? 'Les réponses indiquent une autonomie d’exécution (libre organisation, pas d’horaires imposés, possibilité de refuser). Ce profil relève d’un CONTRAT DE PRESTATION DE SERVICES (pas de subordination, facturation/AIB).'
        : 'Les réponses sont équilibrées — la qualification dépend de l’appréciation du gestionnaire RH (prépondérance des instructions directes = subordination).';
  return {
    suggestion,
    scoreSubordination: sub,
    scoreAutonomie: auto,
    total: answered,
    explanation,
  };
}

// ─── 4. Indemnité de fin de contrat CDD (§3.1 / §8.4 — taux paramétrable) ───

/**
 * À l’expiration d’un CDD (arrivé à terme, non renouvelé, non transformé en
 * CDI), le salarié a droit à une indemnité égale à un pourcentage (défaut
 * légal 6 % — art. 49-3 Code du travail béninois, modifiable dans le
 * paramétrage si la loi évolue) de la rémunération totale brute versée
 * pendant la durée du contrat.
 */
export function computeIndemniteFinContrat(
  remunerationTotaleBrute: number,
  tauxPct: number,
  montantAjuste?: number | null,
): { base: number; tauxPct: number; montantCalcule: number; montantFinal: number; ajuste: boolean } {
  const base = Math.max(0, Number(remunerationTotaleBrute) || 0);
  const taux = Number(tauxPct) || 0;
  const montantCalcule = Math.round((base * taux) / 100);
  const ajuste = montantAjuste != null && Number(montantAjuste) !== montantCalcule;
  const montantFinal = montantAjuste != null ? Math.max(0, Number(montantAjuste) || 0) : montantCalcule;
  return { base, tauxPct: taux, montantCalcule, montantFinal, ajuste };
}

// ─── 5. Filigrane des documents : acronyme de l’école (§7 NB) ───────────────

/**
 * Le contrat doit porter en filigrane l’ACRONYME de l’école — jamais
 * « Academia Helm ». Priorité : SchoolSettings.abbreviation →
 * IdentityProfile.schoolAcronym → School.abbreviation → sigle dérivé du nom
 * de l’école (initiales des mots signifiants) → repli neutre.
 */
export function deriveWatermarkText(
  abbreviation?: string | null,
  schoolName?: string | null,
): string {
  const abbr = (abbreviation || '').trim();
  if (abbr) return abbr.toUpperCase().slice(0, 24);
  const name = (schoolName || '').trim();
  if (name) {
    // Sigle dérivé : initiales des mots (ignorés mots vides type « de/la/du »)
    const stop = new Set(['de', 'des', 'du', 'la', 'le', 'les', 'et', 'd', 'l', 'of', 'the', 'a', 'à', 'au', 'aux', 'en']);
    const initials = name
      .split(/[\s\-']+/)
      .filter((w) => w.length > 0 && !stop.has(w.toLowerCase()))
      .map((w) => w[0])
      .join('')
      .toUpperCase();
    if (initials.length >= 2) return initials.slice(0, 12);
    return name.toUpperCase().slice(0, 20);
  }
  return 'ÉCOLE';
}

/** Taille de police adaptée à la longueur du filigrane (anti-débordement). */
export function watermarkFontSize(text: string): number {
  const len = (text || '').length;
  if (len <= 8) return 68;
  if (len <= 12) return 54;
  if (len <= 18) return 42;
  return 32;
}

// ─── 6. Valeurs par défaut des paramètres par école (§9 — modifiables) ──────

export const DEFAULT_CDD_MOTIFS: string[] = [
  'Remplacement d’un salarié absent',
  'Surcroît d’activité temporaire',
  'Tâche déterminée non renouvelable',
  'Travaux saisonniers',
];

// (DEFAULT_STAGE_TYPES vit dans internship-convention-template.ts — flux stage)

/**
 * Seuil d’alerte durée cumulée CDD. La loi béninoise fixe 2 ans (renouvelable
 * une fois) : la valeur est PARAMÉTRABLE par école (et pour un futur pays
 * UEMOA) — jamais codée en dur dans la logique.
 */
export const DEFAULT_CDD_DUREE_MAX_MOIS = 24;

/** Nombre maximal de renouvellements d’une même chaîne (défaut loi : 1). */
export const DEFAULT_CDD_RENOUVELLEMENTS_MAX = 1;

/** Taux de l’indemnité de fin de contrat CDD (défaut loi : 6 %). */
export const DEFAULT_INDEMNITE_FIN_CONTRAT_PCT = 6;

// ─── 7. Alertes de conformité (§8) — construction des payloads ──────────────

export interface ConformiteAlerte {
  kind: 'CDD_EXPIRE_SANS_CLOTURE' | 'CDD_DUREE_CUMULEE_DEPASSEE' | 'DOSSIER_A_REQUALIFIER' | 'CDD_RENOUVELLEMENTS_DEPASSES';
  severity: 'critique' | 'avertissement' | 'info';
  staffId?: string;
  contractId?: string;
  title: string;
  message: string;
  action?: 'REQUALIFIER' | 'CLOTURER' | 'RENOUVELER' | 'TRANSFORMER_CDI';
}

/** Alerte §8.1 : CDD dont le terme est dépassé sans clôture ni renouvellement. */
export function alerteCddExpireSansCloture(contract: {
  id: string; staffId: string; staffName?: string; endDate: Date | string; statutContractuel?: string | null;
}, aujourdhui: Date = new Date()): ConformiteAlerte | null {
  const fin = new Date(contract.endDate).getTime();
  if (!isFinite(fin) || fin >= aujourdhui.getTime()) return null;
  const jours = Math.floor((aujourdhui.getTime() - fin) / MS_PAR_JOUR);
  return {
    kind: 'CDD_EXPIRE_SANS_CLOTURE',
    severity: jours > 30 ? 'critique' : 'avertissement',
    staffId: contract.staffId,
    contractId: contract.id,
    title: 'CDD arrivé à terme non clôturé',
    message:
      `Le CDD de ${contract.staffName || 'ce personnel'} est échu depuis ${jours} jour(s) sans clôture ni renouvellement enregistré. ` +
      'Si la relation de travail se poursuit au-delà du terme, le CDD devient un CDI de plein droit (art. 34 Code du travail) : ' +
      'clôturez, renouvelez ou transformez le contrat.',
    action: 'CLOTURER',
  };
}

/** Alerte §8.2 : durée cumulée CDD au-delà du seuil (paramétrable). */
export function alerteDureeCumulee(chain: CddChainSummary, seuilMois: number, staffId?: string, staffName?: string): ConformiteAlerte | null {
  if (chain.dureeCumuleeMois <= seuilMois) return null;
  return {
    kind: 'CDD_DUREE_CUMULEE_DEPASSEE',
    severity: 'critique',
    staffId,
    title: 'Durée cumulée CDD au-delà du seuil',
    message:
      `La durée cumulée des CDD de ${staffName || 'ce personnel'} atteint ${chain.dureeCumuleeMois} mois (seuil : ${seuilMois} mois). ` +
      'Au-delà, la relation est réputée à durée indéterminée : une transformation en CDI doit être envisagée.',
    action: 'TRANSFORMER_CDI',
  };
}

/** Alerte §10 : dossier hérité « Vacataire » à requalifier manuellement. */
export function alerteDossierARequalifier(staffId: string, staffName: string): ConformiteAlerte {
  return {
    kind: 'DOSSIER_A_REQUALIFIER',
    severity: 'avertissement',
    staffId,
    title: 'Dossier « Vacataire » à requalifier',
    message:
      `« Vacataire » n’est pas une catégorie du Code du travail béninois : le dossier de ${staffName} doit être requalifié ` +
      'en CDD (subordination) ou en contrat de prestation de services (autonomie), avec le test d’aide à la décision.',
    action: 'REQUALIFIER',
  };
}
