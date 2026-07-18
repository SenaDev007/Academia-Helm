/**
 * SaisieMaster — Types métier
 * Modélise les données extraites du template EducMaster et utilisées
 * dans tout le parcours utilisateur.
 */

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
  /** Notes indexées par [studentId][subjectId]. */
  notes: Record<string, Record<string, Note>>;
  /** Nom du fichier d'origine. */
  sourceFileName: string;
  /** Date d'import. */
  importedAt: string;
}

/** États de l'application (vues principales). */
export type AppView = "landing" | "editor";

/** Validation d'une cellule de note. */
export interface CellValidation {
  status: "ok" | "warning" | "error" | "empty";
  message?: string;
}

/** Statistiques de saisie. */
export interface SaisieStats {
  totalCells: number;
  filledCells: number;
  completionRate: number; // 0-100
  moyenneClasse: number | null;
  etudiantsComplets: number;
}
