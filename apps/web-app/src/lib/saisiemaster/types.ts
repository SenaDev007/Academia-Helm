/**
 * SaisieMaster — Types métier
 * Modélise les données extraites du template EducMaster et utilisées
 * dans tout le parcours utilisateur.
 */

/**
 * Type d'évaluation normalisé pour SaisieMaster.
 *
 * 4 types d'évaluations par année scolaire et par matière :
 *   - EF1 : Évaluation Formative 1
 *   - ES1 : Évaluation Sommative 1
 *   - ES2 : Évaluation Sommative 2
 *   - ES3 : Évaluation Sommative 3
 *
 * Pour chaque classe × matière, l'enseignant peut saisir 4 jeux de notes
 * indépendants (un par type d'évaluation).
 */
export type EvaluationType = "EF1" | "ES1" | "ES2" | "ES3";

/** Matière scolaire (ex: Dictée, Math, EPS...). */
export interface Subject {
  /** Identifiant unique (slug du nom). */
  id: string;
  /** Nom affiché (ex: "Dictée", "Compréhension de l'écrit"). */
  name: string;
  /** Indice de colonne de départ dans le fichier Excel (0-indexé). */
  startCol: number;
  /** Indice de colonne de fin (exclu) — startCol + 2 si perfection, +1 sinon. */
  endCol: number;
  /** Si true : Note obtenue /18 + Note perfectionnement /02. Si false : Note obtenue /20. */
  hasPerfectionnement: boolean;
}

/** Élève extrait du template. */
export interface Student {
  /** Identifiant unique généré côté app. */
  id: string;
  /** Matricule EducMaster (texte, peut commencer par une apostrophe). */
  matricule: string;
  /** Nom de famille. */
  nom: string;
  /** Prénom(s). */
  prenoms: string;
  /** Ligne d'origine dans la feuille Excel (1-indexé). */
  rowIndex: number;
}

/** Note saisie pour une matière donnée. */
export interface Note {
  /** Note obtenue (sur 18 ou 20 selon la matière). */
  obtenue: number | null;
  /** Note de perfectionnement (sur 2). Présent seulement si hasPerfectionnement. */
  perfectionnement: number | null;
}

/**
 * Notes indexées par [studentId][subjectId].
 * Une instance de ce type correspond à UN SEUL type d'évaluation (EF1, ES1, ES2 ou ES3).
 */
export type EvaluationNotes = Record<string, Record<string, Note>>;

/** Données complètes d'une feuille de classe. */
export interface ClassData {
  /** Nom de la feuille Excel (ex: "Notes - CI"). */
  sheetName: string;
  /** Classe extraite du nom de feuille (ex: "CI"). */
  className: string;
  /** École (extraite du nom de fichier si possible). */
  schoolName: string;
  /** Année scolaire (extraite du nom de fichier si possible). */
  academicYear: string;
  /** Liste des élèves. */
  students: Student[];
  /** Liste des matières. */
  subjects: Subject[];
  /**
   * Notes indexées par [evaluationType][studentId][subjectId].
   *
   * 4 types d'évaluations normalisés : EF1, ES1, ES2, ES3.
   * Chaque type contient ses propres notes indépendantes pour la même
   * liste d'élèves et de matières.
   *
   * Rétro-compatibilité : si `evaluations` est absent, on retombe sur
   * l'ancien champ `notes` (équivalent à un seul type d'évaluation).
   */
  evaluations: Record<EvaluationType, EvaluationNotes>;
  /** @deprecated Utiliser `evaluations`. Conservé pour rétro-compatibilité. */
  notes?: EvaluationNotes;
  /** Nom du fichier d'origine. */
  sourceFileName: string;
  /** Date d'import. */
  importedAt: string;
}

/** États de l'application (vues principales). */
export type AppView = "landing" | "editor" | "auth";

/** Validation d'une cellule de note. */
export interface CellValidation {
  status: "ok" | "warning" | "error" | "empty";
  message?: string;
}

/** Statistiques de saisie (pour un type d'évaluation donné). */
export interface SaisieStats {
  totalCells: number;
  filledCells: number;
  completionRate: number; // 0-100
  moyenneClasse: number | null;
  etudiantsComplets: number;
}
