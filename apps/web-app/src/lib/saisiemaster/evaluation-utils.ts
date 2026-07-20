/**
 * SaisieMaster — Helpers pour gérer les 4 types d'évaluations.
 *
 * Fonctions utilitaires pour :
 *  - Initialiser un objet `evaluations` avec les 4 types (EF1, ES1, ES2, ES3)
 *  - Migrer les anciennes données (champ `notes` → `evaluations.EF1`)
 *  - Récupérer les notes d'un type d'évaluation donné
 */

import { EVALUATION_TYPES, DEFAULT_EVALUATION_TYPE } from "./constants";
import type { ClassData, EvaluationNotes, EvaluationType, Note } from "./types";

/** Tous les codes de types d'évaluations valides. */
export const EVALUATION_CODES: EvaluationType[] = EVALUATION_TYPES.map(
  (t) => t.code,
);

/**
 * Crée un objet `evaluations` vide avec les 4 types d'évaluations.
 * Chaque type commence avec un objet vide (pas de notes saisies).
 */
export function createEmptyEvaluations(): Record<EvaluationType, EvaluationNotes> {
  return {
    EF1: {},
    ES1: {},
    ES2: {},
    ES3: {},
  };
}

/**
 * Migrer un ClassData potentiellement ancien (sans champ `evaluations`)
 * vers le nouveau format avec les 4 types d'évaluations.
 *
 * - Si `evaluations` existe déjà : complète les types manquants avec un objet vide.
 * - Si seulement `notes` existe (ancien format) : les notes sont migrées vers `EF1`.
 * - Si ni l'un ni l'autre : initialise les 4 types vides.
 */
export function migrateClassDataEvaluations(classData: ClassData): ClassData {
  if (classData.evaluations) {
    // S'assurer que les 4 types existent
    const evaluations = { ...classData.evaluations };
    for (const code of EVALUATION_CODES) {
      if (!evaluations[code]) {
        evaluations[code] = {};
      }
    }
    return { ...classData, evaluations };
  }

  // Ancien format : migrer `notes` vers EF1
  const oldNotes = classData.notes || {};
  return {
    ...classData,
    evaluations: {
      ...createEmptyEvaluations(),
      EF1: oldNotes,
    },
    notes: oldNotes, // garder pour rétro-compat
  };
}

/**
 * Récupère les notes d'un type d'évaluation spécifique.
 * Retourne un objet vide si le type n'existe pas.
 */
export function getEvaluationNotes(
  classData: ClassData,
  evalType: EvaluationType,
): EvaluationNotes {
  const evaluations = classData.evaluations || createEmptyEvaluations();
  return evaluations[evalType] || {};
}

/**
 * Met à jour les notes d'un type d'évaluation spécifique.
 * Retourne un nouveau ClassData (immutable).
 */
export function setEvaluationNotes(
  classData: ClassData,
  evalType: EvaluationType,
  notes: EvaluationNotes,
): ClassData {
  const evaluations = classData.evaluations || createEmptyEvaluations();
  return {
    ...classData,
    evaluations: {
      ...evaluations,
      [evalType]: notes,
    },
  };
}

/**
 * Compte le nombre total de notes saisies pour un type d'évaluation donné.
 */
export function countFilledNotes(
  classData: ClassData,
  evalType: EvaluationType,
): number {
  const notes = getEvaluationNotes(classData, evalType);
  let count = 0;
  for (const studentId of Object.keys(notes)) {
    const studentNotes = notes[studentId];
    for (const subjectId of Object.keys(studentNotes)) {
      const note: Note = studentNotes[subjectId];
      if (note?.obtenue !== null && note?.obtenue !== undefined) count++;
      if (note?.perfectionnement !== null && note?.perfectionnement !== undefined) count++;
    }
  }
  return count;
}

/**
 * Compte le nombre total de notes saisies (tous types d'évaluations confondus).
 * Utilisé pour le seuil de feedback automatique.
 */
export function countAllFilledNotes(classData: ClassData): number {
  return EVALUATION_CODES.reduce(
    (sum, code) => sum + countFilledNotes(classData, code),
    0,
  );
}

/**
 * Vérifie si un type d'évaluation a des notes saisies.
 */
export function hasEvaluationNotes(
  classData: ClassData,
  evalType: EvaluationType,
): boolean {
  return countFilledNotes(classData, evalType) > 0;
}

/**
 * Libellé humain d'un type d'évaluation.
 */
export function getEvaluationLabel(evalType: EvaluationType): string {
  const found = EVALUATION_TYPES.find((t) => t.code === evalType);
  return found?.label || evalType;
}

/**
 * Le type d'évaluation par défaut.
 */
export const DEFAULT_EVAL = DEFAULT_EVALUATION_TYPE;
