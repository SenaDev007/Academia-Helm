/**
 * SaisieMaster — Constantes & thème (couleurs Bénin + EducMaster)
 */

export const BRAND = {
  name: "SaisieMaster",
  tagline: "Saisie fluide des notes — conforme EducMaster",
  description:
    "Plateforme de saisie intelligente des notes scolaires. Importez votre template EducMaster, remplissez les notes en toute fluidité, exportez au format officiel.",
  version: "1.0.0",
} as const;

/**
 * Couleurs nationales du Bénin + tons EducMaster.
 * Ces tokens sont volontairement en hex pour faciliter l'usage inline
 * (les variables CSS Tailwind sont définies dans globals.css).
 */
export const COLORS = {
  beninGreen: "#008751",
  beninYellow: "#FCD116",
  beninRed: "#E31B23",
  stateBlue: "#0B3B6B",
  cream: "#FAFAF7",
  ink: "#0A0A0A",
  // Tons secondaires
  greenSoft: "#E6F4EE",
  yellowSoft: "#FEF6D6",
  redSoft: "#FCE4E6",
  blueSoft: "#E2ECF6",
} as const;

/** Barème des notes. */
export const GRADING = {
  /** Note obtenue max pour une matière AVEC perfectionnement. */
  obtainedMaxWithPerf: 18,
  /** Note de perfectionnement max. */
  perfectionMax: 2,
  /** Note obtenue max pour une matière SANS perfectionnement. */
  obtainedMaxWithoutPerf: 20,
  /** Total d'une matière (toujours /20). */
  totalMax: 20,
} as const;

/** Clé de stockage localStorage pour l'auto-save. */
export const STORAGE_KEY = "saisiemaster:autosave";

/** Préfixe de nom de fichier exporté. */
export const EXPORT_PREFIX = "saisiemaster";

/**
 * 4 types d'évaluations normalisés par année scolaire et par matière.
 *
 * Chaque type d'évaluation a son propre jeu de notes indépendant
 * pour la même liste d'élèves et de matières.
 */
export const EVALUATION_TYPES = [
  {
    code: "EF1" as const,
    label: "Évaluation Formative 1",
    short: "EF1",
    description: "Évaluation formative du début d'année",
  },
  {
    code: "ES1" as const,
    label: "Évaluation Sommative 1",
    short: "ES1",
    description: "Première évaluation sommative (fin 1er trimestre)",
  },
  {
    code: "ES2" as const,
    label: "Évaluation Sommative 2",
    short: "ES2",
    description: "Deuxième évaluation sommative (fin 2e trimestre)",
  },
  {
    code: "ES3" as const,
    label: "Évaluation Sommative 3",
    short: "ES3",
    description: "Troisième évaluation sommative (fin 3e trimestre)",
  },
] as const;

/** Type d'évaluation par défaut (premier onglet affiché). */
export const DEFAULT_EVALUATION_TYPE = "EF1" as const;

/** Règles de détection des classes dans les noms de feuille. */
export const CLASS_NAME_REGEX = /^Notes\s*-\s*(.+)$/i;

/** Extraction école + année depuis le nom de fichier EducMaster. */
export const FILENAME_PATTERNS = {
  // ex: 20260718173831_model-importation-note_2025-2026-la-perseverance-ci.xlsx
  schoolYear: /(\d{4}-\d{4})/,
  schoolName: /(\d{4}-\d{4})-([a-z0-9\-]+?)(?:-[a-z]{2,4})?\.xlsx$/i,
} as const;
