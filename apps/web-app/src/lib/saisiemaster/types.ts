/**
 * SaisieMaster — Types métier
 * Modélise les données extraites du template EducMaster et utilisées
 * dans tout le parcours utilisateur.
 */

/**
 * Type d'évaluation pour SaisieMaster.
 *
 * 4 types d'évaluations prédéfinis par défaut :
 *   - EF1 : Évaluation Formative 1
 *   - ES1 : Évaluation Sommative 1
 *   - ES2 : Évaluation Sommative 2
 *   - ES3 : Évaluation Sommative 3
 *
 * L'utilisateur peut aussi créer des types d'évaluation personnalisés
 * (ex: "Devoir Mensuel", "Interrogation surprise", etc.).
 * Le type est donc un string libre, avec les 4 codes prédéfinis comme valeurs par défaut.
 */
export type EvaluationType = string;

/** Type d'évaluation personnalisé créé par l'utilisateur. */
export interface CustomEvaluationType {
  /** Code court unique (ex: "DM1", "INT1"). */
  code: string;
  /** Libellé complet (ex: "Devoir Mensuel 1"). */
  label: string;
  /** Description optionnelle. */
  description?: string;
}

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
   * 4 types d'évaluations prédéfinis : EF1, ES1, ES2, ES3.
   * + types personnalisés créés par l'utilisateur (stockés dans customEvaluationTypes).
   */
  evaluations: Record<EvaluationType, EvaluationNotes>;
  /**
   * Types d'évaluations personnalisés créés par l'utilisateur pour cette classe.
   * Les 4 types prédéfinis (EF1, ES1, ES2, ES3) ne sont PAS inclus ici.
   */
  customEvaluationTypes: CustomEvaluationType[];
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
