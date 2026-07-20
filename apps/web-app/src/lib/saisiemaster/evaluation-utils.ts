/**
 * SaisieMaster — Helpers pour gérer les 4 types d'évaluations.
 *
 * Fonctions utilitaires pour :
 *  - Initialiser un objet `evaluations` avec les 4 types (EF1, ES1, ES2, ES3)
 *  - Migrer les anciennes données (champ `notes` → `evaluations.EF1`)
 *  - Récupérer les notes d'un type d'évaluation donné
 */

import { EVALUATION_TYPES, DEFAULT_EVALUATION_TYPE } from "./constants";
import type { ClassData, CustomEvaluationType, EvaluationNotes, EvaluationType, Note } from "./types";

/** Tous les codes de types d'évaluations prédéfinis (EF1, ES1, ES2, ES3). */
export const EVALUATION_CODES: EvaluationType[] = EVALUATION_TYPES.map(
  (t) => t.code,
);

/**
 * Crée un objet `evaluations` vide avec les 4 types d'évaluations prédéfinis.
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
 * vers le nouveau format avec les 4 types d'évaluations + customEvaluationTypes.
 *
 * - Si `evaluations` existe déjà : complète les types manquants avec un objet vide.
 * - Si seulement `notes` existe (ancien format) : les notes sont migrées vers `EF1`.
 * - Si ni l'un ni l'autre : initialise les 4 types vides.
 * - Initialise `customEvaluationTypes` s'il n'existe pas.
 */
export function migrateClassDataEvaluations(classData: ClassData): ClassData {
  let evaluations: Record<string, EvaluationNotes>;

  if (classData.evaluations) {
    // S'assurer que les 4 types prédéfinis existent
    evaluations = { ...classData.evaluations };
    for (const code of EVALUATION_CODES) {
      if (!evaluations[code]) {
        evaluations[code] = {};
      }
    }
    // Préserver les types personnalisés
    if (classData.customEvaluationTypes) {
      for (const custom of classData.customEvaluationTypes) {
        if (!evaluations[custom.code]) {
          evaluations[custom.code] = {};
        }
      }
    }
  } else {
    // Ancien format : migrer `notes` vers EF1
    const oldNotes = classData.notes || {};
    evaluations = {
      ...createEmptyEvaluations(),
      EF1: oldNotes,
    };
  }

  return {
    ...classData,
    evaluations,
    customEvaluationTypes: classData.customEvaluationTypes || [],
    notes: classData.notes, // garder pour rétro-compat
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
 * Ajoute un type d'évaluation personnalisé à une classe.
 * Initialise aussi son entrée dans `evaluations` (vide).
 * Retourne un nouveau ClassData.
 */
export function addCustomEvaluationType(
  classData: ClassData,
  custom: CustomEvaluationType,
): ClassData {
  // Vérifier l'unicité du code
  const existing = getAllEvaluationTypes(classData);
  if (existing.some((t) => t.code === custom.code)) {
    return classData; // déjà existe
  }

  const customTypes = [...(classData.customEvaluationTypes || []), custom];
  const evaluations = classData.evaluations || createEmptyEvaluations();

  return {
    ...classData,
    customEvaluationTypes: customTypes,
    evaluations: {
      ...evaluations,
      [custom.code]: {},
    },
  };
}

/**
 * Supprime un type d'évaluation personnalisé d'une classe.
 * Supprime aussi ses notes de `evaluations`.
 * Les types prédéfinis (EF1, ES1, ES2, ES3) ne peuvent PAS être supprimés.
 */
export function removeCustomEvaluationType(
  classData: ClassData,
  code: string,
): ClassData {
  // Ne pas supprimer les types prédéfinis
  if (EVALUATION_CODES.includes(code)) return classData;

  const customTypes = (classData.customEvaluationTypes || []).filter(
    (t) => t.code !== code,
  );
  const evaluations = { ...(classData.evaluations || {}) };
  delete evaluations[code];

  return {
    ...classData,
    customEvaluationTypes: customTypes,
    evaluations,
  };
}

/**
 * Récupère TOUS les types d'évaluations d'une classe :
 * les 4 prédéfinis + les personnalisés.
 */
export function getAllEvaluationTypes(classData: ClassData): CustomEvaluationType[] {
  const defaultTypes = EVALUATION_TYPES.map((t) => ({
    code: t.code,
    label: t.label,
    description: t.description,
  }));
  const customTypes = classData.customEvaluationTypes || [];
  return [...defaultTypes, ...customTypes];
}

/**
 * Vérifie si un type d'évaluation est prédéfini (EF1, ES1, ES2, ES3).
 */
export function isDefaultEvaluationType(code: string): boolean {
  return EVALUATION_CODES.includes(code);
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
  const allTypes = getAllEvaluationTypes(classData);
  return allTypes.reduce(
    (sum, t) => sum + countFilledNotes(classData, t.code),
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
 * Cherche d'abord dans les prédéfinis, puis dans les personnalisés.
 */
export function getEvaluationLabel(
  classData: ClassData,
  evalType: EvaluationType,
): string {
  // Prédéfinis
  const found = EVALUATION_TYPES.find((t) => t.code === evalType);
  if (found) return found.label;
  // Personnalisés
  const custom = (classData.customEvaluationTypes || []).find(
    (t) => t.code === evalType,
  );
  return custom?.label || evalType;
}

/** Le type d'évaluation par défaut. */
export const DEFAULT_EVAL = DEFAULT_EVALUATION_TYPE;
