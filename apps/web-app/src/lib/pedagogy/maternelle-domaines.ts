/**
 * ============================================================================
 * MATERNELLE — Domaines officiels & structure du cahier journal
 * ============================================================================
 *
 * ⭐ Source de vérité : le modèle papier « cahier journal maternelle » fourni
 *    par l'école (upload/cahier journal maternelle.pdf).
 *
 * Structure EXACTE du tableau (reproduction fidèle, 2 pages) :
 *
 *   PAGE 1 (RECTO) :
 *   ┌────────┬──────────────────┬───────────────────┬────────────────────────────────────────────────┐
 *   │        │ DOMAINE I        │ DOMAINE II        │ DOMAINE (suite → III en page 2)                │
 *   │ DATE   │ Education pour   │ Expression        │ Pré lecture │ Pré écriture │ Pré      │ Observa- │
 *   │        │ la santé         │ corporelle        │             │              │ mathéma- │ tions    │
 *   │        │                  │                   │             │              │ tiques   │          │
 *   └────────┴──────────────────┴───────────────────┴────────────────────────────────────────────────┘
 *
 *   PAGE 2 (VERSO) :
 *   ┌──────────────────────────┬──────────────────────────────┬──────────────────────────────────────────────────────────────┐
 *   │ III (fin du domaine III) │ DOMAINE IV                   │ DOMAINE V                                                    │
 *   │ Education   │ Travaux    │ Expression     │ Expression   │ Communication │ Conte │ Poésie chant │ Activités        │
 *   │ sensorielle │ manuels    │ émotionnelle   │ plastique    │ orale         │       │ comptine     │ libres           │
 *   └──────────────────────────┴──────────────────────────────┴──────────────────────────────────────────────────────────────┘
 *
 * ⭐ Le DOMAINE III couvre donc 6 sous-colonnes (confirmation utilisateur) :
 *      pré-lecture, pré-écriture, pré-mathématiques, observation,
 *      éducation sensorielle et travaux manuels.
 *
 * ⭐ RÈGLE D'AFFICHAGE (exigence utilisateur explicite) :
 *    Le tableau est reproduit EXACTEMENT tel quel — colonnes fixes, titres
 *    et sous-titres du modèle — MÊME SI une matière n'est pas paramétrée
 *    dans le module Pédagogie → Matières et programmes.
 *    Les matières paramétrées sont récupérées de façon DYNAMIQUE et
 *    « liées » aux colonnes correspondantes (pour rattacher les fiches
 *    pédagogiques aux vraies matières), mais elles ne créent JAMAIS de
 *    colonne supplémentaire (pas de colonne « autre matière »).
 *
 * ⭐ SÉLECTION AUTOMATIQUE DU TYPE DE FICHE (exigence utilisateur) :
 *    La fiche pédagogique est en lien avec le cahier journal : quand
 *    l'enseignant(e) prépare la fiche d'une matière, le système vérifie
 *    dans quel domaine se trouve cette matière et attribue
 *    AUTOMATIQUEMENT :
 *      - domaine 2  → format « fiche pédagogique domaine 2 »
 *      - domaines 1, 3, 4, 5 → format « fiche pédagogique domaine »
 *        avec le numéro du domaine pré-rempli.
 * ============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation (même algorithme que SubjectsPrismaService.normalizeSubjectName)
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeMaternelleName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprime les accents
    .replace(/\s*[-/\\+&]\s*/g, ' ') // séparateurs → espace
    .replace(/\s+(?:et|and)\s+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Structure officielle du cahier journal maternelle (MODÈLE EXACT)
// ─────────────────────────────────────────────────────────────────────────────

export interface MaternelleSubColumn {
  /** Libellé EXACT imprimé dans le modèle (clé des entries du cahier journal) */
  label: string;
  /** Variantes orthographiques acceptées pour la liaison dynamique des matières */
  aliases?: string[];
}

export interface MaternelleDomaine {
  /** Numéro du domaine (1..5) */
  number: number;
  /** Chiffre romain tel qu'imprimé (I..V) */
  roman: string;
  /** Titre complet pour l'affichage résolu (ex: « DOMAINE III ») */
  headerLabel: string;
  /** Sous-colonnes du domaine, DANS L'ORDRE EXACT du modèle */
  subColumns: MaternelleSubColumn[];
}

export const MATERNELLE_DOMAINES: MaternelleDomaine[] = [
  {
    number: 1,
    roman: 'I',
    headerLabel: 'DOMAINE I',
    subColumns: [
      { label: 'Education pour la santé', aliases: ['education', 'education sante', 'sante', 'hygiene', 'reflexes de sante', 'soin de sante'] },
    ],
  },
  {
    number: 2,
    roman: 'II',
    headerLabel: 'DOMAINE II',
    subColumns: [
      { label: 'Expression corporelle', aliases: ['motricite', 'psychomotricite', 'education psychomotrice', 'expression et motricite corporelle'] },
    ],
  },
  {
    number: 3,
    roman: 'III',
    headerLabel: 'DOMAINE III',
    subColumns: [
      { label: 'Pré lecture', aliases: ['prelecture', 'lecture', 'preparation a la lecture'] },
      { label: 'Pré écriture', aliases: ['preecriture', 'ecriture', 'graphisme', 'preparation a l ecriture'] },
      { label: 'Pré mathématiques', aliases: ['premathematiques', 'mathematiques', 'maths', 'math', 'calcul', 'pre mathematique'] },
      { label: 'Observations', aliases: ['observation', 'eveil scientifique', 'eveil', 'decouverte du monde', 'observation du milieu'] },
      { label: 'Education sensorielle', aliases: ['education sensoriele', 'activites sensorielles'] },
      { label: 'Travaux manuels', aliases: ['travaux manuel', 'travail manuel'] },
    ],
  },
  {
    number: 4,
    roman: 'IV',
    headerLabel: 'DOMAINE IV',
    subColumns: [
      { label: 'Expression émotionnelle', aliases: ['education emotionnelle', 'sante emotionnelle', 'expression des emotions'] },
      { label: 'Expression plastique', aliases: ['arts plastiques', 'art plastique', 'dessin', 'activites plastiques'] },
    ],
  },
  {
    number: 5,
    roman: 'V',
    headerLabel: 'DOMAINE V',
    subColumns: [
      { label: 'Communication orale', aliases: ['langage', 'langage et communication', 'communication', 'oral'] },
      { label: 'Conte', aliases: ['contes', 'lecture de conte'] },
      { label: 'Poésie chant comptine', aliases: ['poesie', 'chant', 'comptine', 'poesie et chant', 'chant et poesie', 'poesie chant', 'chant comptine'] },
      { label: 'Activités libres', aliases: ['activite libre', 'jeu libre', 'jeux libres', 'activites libre'] },
    ],
  },
];

/** Libellés de toutes les colonnes du cahier journal maternelle, dans l'ordre exact */
export const MATERNELLE_COLUMN_LABELS: string[] = MATERNELLE_DOMAINES.flatMap(d =>
  d.subColumns.map(sc => sc.label),
);

/**
 * Structure de rendu par page — reproduction exacte du modèle papier.
 *
 * Page 1 (recto) : DATE + DOMAINE I + DOMAINE II + « DOMAINE » (les 4 premières
 *   sous-colonnes du domaine III ; le titre imprimé est « DOMAINE » sans numéro,
 *   le « III » étant imprimé au début de la page 2 — fidèle au modèle).
 * Page 2 (verso) : « III » (fin du domaine III) + DOMAINE IV + DOMAINE V.
 */
export interface MaternellePageColumn {
  /** Type de colonne */
  kind: 'single' | 'group';
  /** Titre imprimé dans la ligne 1 de l'en-tête (EXACT du modèle) */
  headerTitle: string;
  /** Colonne unique (domaine à une seule sous-colonne) */
  subColumn?: MaternelleSubColumn;
  /** Domaine correspondant (pour résoudre le numéro) */
  domaine?: MaternelleDomaine;
  /** Sous-colonnes groupées sous le titre */
  subColumns?: MaternelleSubColumn[];
}

export const MATERNELLE_RECTO_COLUMNS: MaternellePageColumn[] = [
  {
    kind: 'single',
    headerTitle: 'DOMAINE I',
    domaine: MATERNELLE_DOMAINES[0],
    subColumn: MATERNELLE_DOMAINES[0].subColumns[0],
  },
  {
    kind: 'single',
    headerTitle: 'DOMAINE II',
    domaine: MATERNELLE_DOMAINES[1],
    subColumn: MATERNELLE_DOMAINES[1].subColumns[0],
  },
  {
    kind: 'group',
    headerTitle: 'DOMAINE', // ⭐ fidèle au modèle : sans numéro (le « III » ouvre la page 2)
    domaine: MATERNELLE_DOMAINES[2],
    subColumns: MATERNELLE_DOMAINES[2].subColumns.slice(0, 4),
  },
];

export const MATERNELLE_VERSO_COLUMNS: MaternellePageColumn[] = [
  {
    kind: 'group',
    headerTitle: 'III', // ⭐ fidèle au modèle : fin du domaine III
    domaine: MATERNELLE_DOMAINES[2],
    subColumns: MATERNELLE_DOMAINES[2].subColumns.slice(4),
  },
  {
    kind: 'group',
    headerTitle: 'DOMAINE IV',
    domaine: MATERNELLE_DOMAINES[3],
    subColumns: MATERNELLE_DOMAINES[3].subColumns,
  },
  {
    kind: 'group',
    headerTitle: 'DOMAINE V',
    domaine: MATERNELLE_DOMAINES[4],
    subColumns: MATERNELLE_DOMAINES[4].subColumns,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Résolution matière → domaine (pour la sélection AUTOMATIQUE du type de fiche)
// ─────────────────────────────────────────────────────────────────────────────

export interface DomaineMatch {
  /** Numéro du domaine (1..5) */
  domaineNumber: number;
  /** Chiffre romain (I..V) */
  domaineRoman: string;
  /** Libellé de la sous-colonne officielle correspondante */
  columnLabel: string;
}

/**
 * Vérifie dans quel domaine se trouve une matière (nom configuré dans le module
 * Pédagogie → Matières et programmes, ou libellé de colonne du cahier journal).
 *
 * Ordre de résolution :
 *   1. correspondance EXACTE (nom normalisé = libellé/alias de sous-colonne)
 *   2. correspondance par inclusion (le nom normalisé contient, ou est contenu
 *      dans, un libellé/alias) — en privilégiant les correspondances les plus
 *      longues pour éviter les faux positifs (« education » vs
 *      « education sensorielle »)
 *
 * @returns le domaine + la sous-colonne, ou null si aucune correspondance.
 */
export function resolveDomaineForMatiere(matiereName: string | null | undefined): DomaineMatch | null {
  const n = normalizeMaternelleName(matiereName);
  if (!n) return null;

  // 1) Correspondance exacte (libellé ou alias)
  for (const domaine of MATERNELLE_DOMAINES) {
    for (const sc of domaine.subColumns) {
      const candidates = [sc.label, ...(sc.aliases || [])].map(normalizeMaternelleName);
      if (candidates.includes(n)) {
        return { domaineNumber: domaine.number, domaineRoman: domaine.roman, columnLabel: sc.label };
      }
    }
  }

  // 2) Correspondance par inclusion — on privilégie la correspondance la plus
  //    longue (ex: « education sensorielle » avant « education »).
  let best: { sc: MaternelleSubColumn; domaine: MaternelleDomaine; len: number } | null = null;
  for (const domaine of MATERNELLE_DOMAINES) {
    for (const sc of domaine.subColumns) {
      const candidates = [sc.label, ...(sc.aliases || [])].map(normalizeMaternelleName).filter(Boolean);
      for (const c of candidates) {
        const matched = n === c || n.includes(c) || c.includes(n);
        if (matched && (!best || c.length > best.len)) {
          best = { sc, domaine, len: c.length };
        }
      }
    }
  }
  if (best) {
    return {
      domaineNumber: best.domaine.number,
      domaineRoman: best.domaine.roman,
      columnLabel: best.sc.label,
    };
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types de fiche pédagogique maternelle (2 formats, 5 types auto-attribués)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Types de fiche stockés en base (sheetType de primary_pedagogical_fiches).
 *
 * ⭐ Règle utilisateur : la fiche et son type sont choisis AUTOMATIQUEMENT
 *    selon la matière :
 *      - matière du domaine 2       → format « fiche pédagogique domaine 2 »
 *      - matière des domaines 1/3/4/5 → format « fiche pédagogique domaine »
 *        avec le numéro du domaine attribué automatiquement.
 */
export type MaternelleFicheFormat = 'DOMAINE' | 'DOMAINE_2';

export const MATERNELLE_SHEET_TYPES = ['DOMAINE_1', 'DOMAINE_2', 'DOMAINE_3', 'DOMAINE_4', 'DOMAINE_5'] as const;
export type MaternelleSheetType = (typeof MATERNELLE_SHEET_TYPES)[number];

export function isMaternelleSheetType(sheetType: string | null | undefined): boolean {
  return !!sheetType && (MATERNELLE_SHEET_TYPES as readonly string[]).includes(sheetType);
}

/** Résout le type de fiche + le format d'affichage pour un numéro de domaine */
export function resolveFicheTypeForDomaine(domaineNumber: number): {
  sheetType: MaternelleSheetType;
  format: MaternelleFicheFormat;
  label: string;
} {
  const n = Math.min(Math.max(Math.round(domaineNumber), 1), 5);
  const sheetType = `DOMAINE_${n}` as MaternelleSheetType;
  return {
    sheetType,
    format: n === 2 ? 'DOMAINE_2' : 'DOMAINE',
    label: `Fiche pédagogique domaine ${n}`,
  };
}

/** Résout le type de fiche directement depuis le nom d'une matière */
export function resolveFicheTypeForMatiere(matiereName: string | null | undefined): {
  sheetType: MaternelleSheetType;
  format: MaternelleFicheFormat;
  label: string;
  domaineNumber: number | null;
  columnLabel: string | null;
} | null {
  const match = resolveDomaineForMatiere(matiereName);
  if (!match) return null;
  const resolved = resolveFicheTypeForDomaine(match.domaineNumber);
  return { ...resolved, domaineNumber: match.domaineNumber, columnLabel: match.columnLabel };
}

/** Libellés d'affichage des types de fiche maternelle */
export const MATERNELLE_SHEET_TYPE_LABELS: Record<string, { label: string; short: string }> = {
  DOMAINE_1: { label: 'Fiche pédagogique domaine 1', short: 'Domaine 1' },
  DOMAINE_2: { label: 'Fiche pédagogique domaine 2', short: 'Domaine 2' },
  DOMAINE_3: { label: 'Fiche pédagogique domaine 3', short: 'Domaine 3' },
  DOMAINE_4: { label: 'Fiche pédagogique domaine 4', short: 'Domaine 4' },
  DOMAINE_5: { label: 'Fiche pédagogique domaine 5', short: 'Domaine 5' },
};

/**
 * Les 2 CATÉGORIES de fiches présentées aux enseignants maternelle
 * (les numéros 1/3/4/5 étant attribués automatiquement selon la matière).
 */
export const MATERNELLE_FICHE_CATEGORIES = [
  {
    format: 'DOMAINE' as MaternelleFicheFormat,
    label: 'Fiche pédagogique domaine',
    description: 'Domaines 1, 3, 4 et 5 — le numéro du domaine est attribué automatiquement selon la matière.',
  },
  {
    format: 'DOMAINE_2' as MaternelleFicheFormat,
    label: 'Fiche pédagogique domaine 2',
    description: 'Domaine 2 (expression corporelle) — format spécifique avec tableau Plan / Durée / Description / Formation Evolution / Dosage.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Liaison dynamique matières paramétrées ↔ colonnes fixes du cahier journal
// ─────────────────────────────────────────────────────────────────────────────

export interface DynamicSubject {
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  [key: string]: any;
}

/**
 * Clé d'entrée du cahier journal pour la colonne « Observations » du DOMAINE III
 * (clé réservée du backend — exclue des matières planifiées, utilisée aussi par
 * la grille dynamique historique pour l'affichage de l'observation directeur).
 */
export const MATERNELLE_OBS_KEY = 'obs_dom';

/**
 * Lie les matières paramétrées (module Pédagogie → Matières et programmes)
 * aux colonnes fixes du cahier journal maternelle.
 *
 * ⭐ PLUSIEURS matières peuvent être liées à une même colonne (matières
 *    « fusionnées » pour l'évaluation — ex: « Éducation pour la santé et
 *    l'environnement » + « Éducation à des réflexions de santé » → colonne
 *    « Education pour la santé » du DOMAINE I). La première liée est la
 *    matière principale (clé d'entrée d'écriture), les suivantes servent de
 *    repli de lecture (données historiques).
 *
 * ⭐ Une matière qui ne correspond à AUCUNE colonne du modèle est simplement
 *    ignorée à l'affichage : elle ne crée PAS de colonne supplémentaire
 *    (exigence utilisateur : jamais de colonne « autre matière »).
 *
 * @returns Map<libellé de colonne du modèle, matières liées (principale en premier)>
 */
export function bindDynamicSubjectsToColumns(subjects: DynamicSubject[]): Map<string, DynamicSubject[]> {
  const binding = new Map<string, DynamicSubject[]>();
  for (const s of subjects) {
    const match = resolveDomaineForMatiere(s.subjectName);
    if (!match) continue; // matière hors domaines du modèle → ignorée (aucune colonne créée)
    const list = binding.get(match.columnLabel) || [];
    list.push(s);
    binding.set(match.columnLabel, list);
  }
  return binding;
}

/**
 * Construit le résolveur de clés d'entrée du cahier journal maternelle :
 *   - colonne liée → noms des matières liées (la 1ère = clé d'écriture),
 *     puis le libellé de la colonne en repli de lecture ;
 *   - colonne non liée → libellé de la colonne du modèle ;
 *   - colonne « Observations » → clé réservée obs_dom.
 *
 * ⭐ Écrire sous le nom de la matière liée garde la compatibilité avec le
 *    backend déployé (matières planifiées, rapprochement des fiches par
 *    subjectId, migration des anciennes clés) ; lire avec repli permet de
 *    restituer les saisies effectuées sous le libellé de la colonne.
 */
export function buildMaternelleEntryKeyResolver(
  binding: Map<string, DynamicSubject[]>,
): (columnLabel: string) => string[] {
  return (columnLabel: string): string[] => {
    if (columnLabel === 'Observations') return [MATERNELLE_OBS_KEY];
    const bound = binding.get(columnLabel);
    if (bound && bound.length > 0) {
      return [...bound.map(s => s.subjectName), columnLabel];
    }
    return [columnLabel];
  };
}

/**
 * Lie une matière à UNE colonne précise (utilisé quand on prépare une fiche
 * depuis une matière paramétrée : retrouve la colonne du cahier journal).
 */
export function findColumnForSubject(subject: DynamicSubject): string | null {
  const n = normalizeMaternelleName(subject?.subjectName);
  if (!n) return null;
  for (const domaine of MATERNELLE_DOMAINES) {
    for (const sc of domaine.subColumns) {
      const candidates = [sc.label, ...(sc.aliases || [])].map(normalizeMaternelleName);
      if (candidates.includes(n)) return sc.label;
    }
  }
  return null;
}