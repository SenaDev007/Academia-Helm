/**
 * SaisieMaster — Store global (Zustand)
 *
 * Gère l'état de l'application: vue courante, classe active, données chargées,
 * ET l'authentification frictionless (prospect + token SaisieMaster).
 *
 * Persiste automatiquement les saisies en localStorage pour reprise après crash,
 * ET synchronise les saisies vers le backend (debounced) pour le captage de leads.
 */

import { create } from "zustand";
import type {
  AppView,
  CellValidation,
  ClassData,
  EvaluationType,
  Note,
  SaisieStats,
} from "./types";
import { GRADING, STORAGE_KEY, DEFAULT_EVALUATION_TYPE } from "./constants";
import {
  migrateClassDataEvaluations,
  getEvaluationNotes,
  setEvaluationNotes,
  addCustomEvaluationType as addCustomEvalType,
  removeCustomEvaluationType as removeCustomEvalType,
} from "./evaluation-utils";
import type { CustomEvaluationType } from "./types";
import {
  type Prospect,
  type ActivityType,
  classDataToSessionPayload,
  saveSession,
  deleteSession,
  getSessions,
  trackActivity,
  getToken,
  getStoredProspect,
  setAuth as persistAuth,
  clearAuth as clearPersistedAuth,
  STORAGE_KEYS,
} from "./api";

/** Editor-internal navigation (separate from `AppView`). */
export type EditorView =
  | "notes"
  | "classes"
  | "files"
  | "history"
  | "settings";

interface SaisieMasterState {
  /** Vue active. */
  view: AppView;
  /** Mode initial de l'écran d'auth ("signup" ou "login").
   *  Permet au navbar d'ouvrir directement le login quand l'utilisateur
   *  clique sur "Se connecter". */
  authInitialMode: "signup" | "login";
  /** Editor-internal navigation (which sidebar item is active). */
  editorView: EditorView;
  /** Classes chargées depuis le fichier importé. */
  classes: ClassData[];
  /** Index de la classe active (pour multi-classes). */
  activeClassIndex: number;
  /**
   * Type d'évaluation actif (EF1, ES1, ES2, ES3).
   * Détermine quel jeu de notes est affiché/édité dans le tableau.
   */
  activeEvalType: EvaluationType;
  /** Erreur d'import courante. */
  importError: string | null;
  /** Indique si l'export est en cours. */
  isExporting: boolean;

  // --- Auth (frictionless, SaisieMaster-only, separate from Academia Helm) ---
  /** Prospect courant (null = non authentifié). */
  prospect: Prospect | null;
  /** Token JWT SaisieMaster (null = non authentifié). */
  token: string | null;

  // Actions
  setView: (view: AppView) => void;
  /** Passe à la vue auth avec un mode initial spécifique (signup/login). */
  setAuthView: (mode: "signup" | "login") => void;
  setEditorView: (view: EditorView) => void;
  loadClasses: (classes: ClassData[]) => void;
  addClasses: (newClasses: ClassData[]) => void;
  setActiveClass: (index: number) => void;
  /** Change le type d'évaluation actif (EF1, ES1, ES2, ES3, ou personnalisé). */
  setActiveEvalType: (evalType: EvaluationType) => void;
  /** Ajoute un type d'évaluation personnalisé à la classe active. */
  addCustomEvaluationType: (custom: CustomEvaluationType) => void;
  /** Supprime un type d'évaluation personnalisé de la classe active. */
  removeCustomEvaluationType: (code: string) => void;
  /** Remove a class locally + its backend session (best-effort). */
  deleteClass: (index: number) => Promise<void>;
  /** Replace a class in the store with a new ClassData (used to load a session). */
  replaceClasses: (classes: ClassData[]) => void;
  /** Update the prospect info in the store + localStorage. */
  updateProspect: (prospect: Prospect) => void;
  setImportError: (error: string | null) => void;
  updateNote: (
    studentId: string,
    subjectId: string,
    field: keyof Note,
    value: number | null,
  ) => void;
  clearAll: () => void;
  setExporting: (exporting: boolean) => void;

  // Auth actions
  setAuth: (prospect: Prospect, token: string) => void;
  logout: () => void;
  /** Hydrate auth state from localStorage (call once on mount). */
  hydrateAuth: () => void;
}

/**
 * isAuthenticated is exposed as a selector helper (Zustand doesn't have
 * built-in computed values). Use:
 *   const isAuth = useSaisieMasterStore((s) => s.prospect !== null && s.token !== null);
 */
export function selectIsAuthenticated(s: SaisieMasterState): boolean {
  return s.prospect !== null && s.token !== null;
}

// ---------------------------------------------------------------------------
// Debounced backend sync (module-level so the timer survives re-renders)
// ---------------------------------------------------------------------------

let backendSyncTimer: ReturnType<typeof setTimeout> | null = null;
const BACKEND_SYNC_DEBOUNCE_MS = 2000;

function persistClassesToStorage(classes: ClassData[], activeClassIndex: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        classes,
        activeClassIndex,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch (e) {
    console.warn("Auto-save échoué:", e);
  }
}

function scheduleBackendSync(classes: ClassData[], activeClassIndex: number) {
  // Only sync if authenticated (token alone — prospect is just metadata)
  if (!getToken()) return;
  if (!classes || classes.length === 0) return;

  if (backendSyncTimer) {
    clearTimeout(backendSyncTimer);
  }
  backendSyncTimer = setTimeout(() => {
    // ⭐ FIX: synchronise TOUTES les classes (pas seulement l'active)
    //    Sinon, quand l'utilisateur change de classe active, les notes de
    //    l'ancienne ne sont jamais synchronisées vers le backend — ce qui
    //    cause le bug "je travaille sur mobile, je retourne sur PC, je ne
    //    vois pas mes données".
    void Promise.all(
      classes.map((cls) =>
        saveSession(classDataToSessionPayload(cls)).catch((e) => {
          // Best-effort — don't block the user.
          console.warn("[saisiemaster] backend sync failed for class:", cls.className, e);
        }),
      ),
    );
    backendSyncTimer = null;
  }, BACKEND_SYNC_DEBOUNCE_MS);
}

export const useSaisieMasterStore = create<SaisieMasterState>((set, get) => ({
  view: "landing",
  authInitialMode: "signup",
  editorView: "notes",
  classes: [],
  activeClassIndex: 0,
  activeEvalType: DEFAULT_EVALUATION_TYPE,
  importError: null,
  isExporting: false,
  prospect: null,
  token: null,

  setView: (view) => set({ view }),

  setAuthView: (mode) =>
    set({ view: "auth", authInitialMode: mode }),

  setEditorView: (editorView) => set({ editorView }),

  loadClasses: (classes) => {
    // Migration : s'assurer que chaque classe a le champ `evaluations` avec les 4 types
    const migratedClasses = classes.map(migrateClassDataEvaluations);
    set({
      classes: migratedClasses,
      activeClassIndex: 0,
      activeEvalType: DEFAULT_EVALUATION_TYPE,
      importError: null,
      editorView: "notes",
      view: migratedClasses.length > 0 ? "editor" : "landing",
    });
    persistClassesToStorage(migratedClasses, 0);
    // Track classes creation + trigger backend sync for the first class.
    if (migratedClasses.length > 0 && getToken()) {
      void trackActivity("grade_entered");
      scheduleBackendSync(migratedClasses, 0);
    }
  },

  addClasses: (newClasses) => {
    // ⭐ AJOUTE les nouvelles classes aux existantes (ne remplace pas).
    // Utilisé lors d'un nouvel import quand l'utilisateur a déjà des classes.
    const migratedNew = newClasses.map(migrateClassDataEvaluations);
    const existing = get().classes;
    const allClasses = [...existing, ...migratedNew];
    const newIndex = existing.length; // Sélectionne la première nouvelle classe
    set({
      classes: allClasses,
      activeClassIndex: newIndex,
      activeEvalType: DEFAULT_EVALUATION_TYPE,
      importError: null,
      editorView: "notes",
      view: "editor",
    });
    persistClassesToStorage(allClasses, newIndex);
    // Sync vers le backend pour les nouvelles classes
    if (migratedNew.length > 0 && getToken()) {
      void trackActivity("grade_entered");
      for (const cls of migratedNew) {
        scheduleBackendSync(allClasses, allClasses.indexOf(cls));
      }
    }
  },

  replaceClasses: (classes) => {
    const migratedClasses = classes.map(migrateClassDataEvaluations);
    set({
      classes: migratedClasses,
      activeClassIndex: 0,
      activeEvalType: DEFAULT_EVALUATION_TYPE,
      editorView: "notes",
      view: migratedClasses.length > 0 ? "editor" : "landing",
    });
    persistClassesToStorage(migratedClasses, 0);
  },

  setActiveClass: (index) => {
    set({ activeClassIndex: index });
    // Sync the newly-active class to the backend (debounced).
    scheduleBackendSync(get().classes, index);
  },

  setActiveEvalType: (evalType) => {
    set({ activeEvalType: evalType });
  },

  addCustomEvaluationType: (custom) => {
    const state = get();
    const { classes, activeClassIndex } = state;
    if (!classes[activeClassIndex]) return;
    const newClassData = addCustomEvalType(classes[activeClassIndex], custom);
    const newClasses = [...classes];
    newClasses[activeClassIndex] = newClassData;
    set({ classes: newClasses, activeEvalType: custom.code });
    persistClassesToStorage(newClasses, activeClassIndex);
    scheduleBackendSync(newClasses, activeClassIndex);
  },

  removeCustomEvaluationType: (code) => {
    const state = get();
    const { classes, activeClassIndex, activeEvalType } = state;
    if (!classes[activeClassIndex]) return;
    const newClassData = removeCustomEvalType(classes[activeClassIndex], code);
    const newClasses = [...classes];
    newClasses[activeClassIndex] = newClassData;
    // Si on supprime le type actif, revenir à EF1
    const newActiveEval = activeEvalType === code ? "EF1" : activeEvalType;
    set({ classes: newClasses, activeEvalType: newActiveEval });
    persistClassesToStorage(newClasses, activeClassIndex);
    scheduleBackendSync(newClasses, activeClassIndex);
  },

  deleteClass: async (index) => {
    const state = get();
    const { classes, activeClassIndex } = state;
    if (index < 0 || index >= classes.length) return;

    const removed = classes[index];
    // Best-effort backend deletion: look up the matching session by className
    // + academicYear (the same idempotency key used at save time).
    if (getToken()) {
      try {
        const sessions = await getSessions();
        const match = sessions.find(
          (s) =>
            s.className === (removed.className || removed.sheetName) &&
            (s.academicYear ?? null) === (removed.academicYear ?? null),
        );
        if (match) {
          await deleteSession(match.id);
        }
      } catch (e) {
        console.warn("[saisiemaster] deleteClass backend sync failed:", e);
      }
    }

    const newClasses = classes.filter((_, i) => i !== index);
    let newIndex = activeClassIndex;
    if (index < activeClassIndex) newIndex = activeClassIndex - 1;
    if (newIndex >= newClasses.length) newIndex = Math.max(0, newClasses.length - 1);

    set({
      classes: newClasses,
      activeClassIndex: newIndex,
      editorView: newClasses.length === 0 ? "classes" : state.editorView,
      view: newClasses.length === 0 ? "landing" : state.view,
    });
    persistClassesToStorage(newClasses, newIndex);
  },

  updateProspect: (prospect) => {
    set({ prospect });
    persistAuth(prospect, get().token ?? "");
  },

  setImportError: (error) => set({ importError: error }),

  updateNote: (studentId, subjectId, field, value) => {
    const state = get();
    const { classes, activeClassIndex, activeEvalType } = state;
    if (classes.length === 0) return;
    const classData = classes[activeClassIndex];
    if (!classData) return;

    // Récupère les notes du type d'évaluation actif (EF1/ES1/ES2/ES3)
    const currentNotes = getEvaluationNotes(classData, activeEvalType);
    const updatedNotes: typeof currentNotes = {
      ...currentNotes,
      [studentId]: {
        ...(currentNotes[studentId] || {}),
        [subjectId]: {
          ...(currentNotes[studentId]?.[subjectId] || {
            obtenue: null,
            perfectionnement: null,
          }),
          [field]: value,
        },
      },
    };

    // Met à jour le type d'évaluation actif dans le ClassData
    const newClassData = setEvaluationNotes(classData, activeEvalType, updatedNotes);

    const newClasses = [...classes];
    newClasses[activeClassIndex] = newClassData;

    set({ classes: newClasses });

    // Auto-save en localStorage
    persistClassesToStorage(newClasses, activeClassIndex);

    // Sync vers le backend (debounced) — si authentifié.
    scheduleBackendSync(newClasses, activeClassIndex);
  },

  clearAll: () => {
    set({
      view: "landing",
      editorView: "notes",
      classes: [],
      activeClassIndex: 0,
      importError: null,
    });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    // Cancel any pending backend sync.
    if (backendSyncTimer) {
      clearTimeout(backendSyncTimer);
      backendSyncTimer = null;
    }
  },

  setExporting: (exporting) => set({ isExporting: exporting }),

  // --- Auth ---

  setAuth: (prospect, token) => {
    // ⭐ CRITICAL: Clear any previous user's data from localStorage before
    // setting the new auth. Without this, a new user would see the previous
    // user's grades data (stored in saisiemaster:autosave localStorage key).
    if (typeof window !== "undefined") {
      // Only clear if the prospect ID is different from what's stored
      const oldProspectRaw = window.localStorage.getItem(STORAGE_KEYS.prospect);
      if (oldProspectRaw) {
        try {
          const oldProspect = JSON.parse(oldProspectRaw);
          if (oldProspect.id !== prospect.id) {
            // Different user — clear old autosave data
            window.localStorage.removeItem(STORAGE_KEY);
          }
        } catch {
          // Corrupt prospect data — clear everything
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      // Also clear the in-memory classes to avoid showing stale data
      set({ classes: [], activeClassIndex: 0 });
    }
    set({ prospect, token });
    persistAuth(prospect, token);
    // Track login for lead scoring (best-effort, non-blocking).
    void trackActivity("login" as ActivityType);
  },

  logout: () => {
    set({
      prospect: null,
      token: null,
      view: "landing",
      editorView: "notes",
      classes: [],
      activeClassIndex: 0,
    });
    clearPersistedAuth();
    // ⭐ CRITICAL: Also clear the autosave data (grades) from localStorage.
    // Without this, the next user who logs in on the same browser would see
    // the previous user's grades.
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    if (backendSyncTimer) {
      clearTimeout(backendSyncTimer);
      backendSyncTimer = null;
    }
  },

  hydrateAuth: () => {
    // Only hydrate if not already authenticated.
    if (get().prospect && get().token) return;
    const token = getToken();
    const prospect = getStoredProspect();
    if (token && prospect) {
      set({ token, prospect });
    }
  },
}));

// ============================================================================
// Helpers de validation & calcul
// ============================================================================

/**
 * Valide une note saisie selon le barème EducMaster.
 * - Note obtenue: 0-18 si matière avec perfectionnement, 0-20 sinon.
 * - Note perfectionnement: 0-2.
 */
export function validateNote(
  note: Note,
  hasPerfectionnement: boolean,
): {
  obtenue?: CellValidation;
  perfectionnement?: CellValidation;
} {
  const result: {
    obtenue?: CellValidation;
    perfectionnement?: CellValidation;
  } = {};

  // Note obtenue
  if (note.obtenue === null || note.obtenue === undefined) {
    result.obtenue = { status: "empty" };
  } else {
    const max = hasPerfectionnement
      ? GRADING.obtainedMaxWithPerf
      : GRADING.obtainedMaxWithoutPerf;
    if (note.obtenue < 0 || note.obtenue > max) {
      result.obtenue = {
        status: "error",
        message: `Note hors plage (0-${max})`,
      };
    } else if (note.obtenue < max / 2) {
      result.obtenue = {
        status: "warning",
        message: "Note faible (< 50%)",
      };
    } else {
      result.obtenue = { status: "ok" };
    }
  }

  // Note perfectionnement
  if (hasPerfectionnement) {
    if (note.perfectionnement === null || note.perfectionnement === undefined) {
      result.perfectionnement = { status: "empty" };
    } else if (
      note.perfectionnement < 0 ||
      note.perfectionnement > GRADING.perfectionMax
    ) {
      result.perfectionnement = {
        status: "error",
        message: `Note hors plage (0-${GRADING.perfectionMax})`,
      };
    } else {
      result.perfectionnement = { status: "ok" };
    }
  }

  return result;
}

/** Calcule le total d'une matière pour un élève donné. */
export function computeSubjectTotal(note: Note, hasPerfectionnement: boolean): number | null {
  const obtenue = note.obtenue;
  const perf = note.perfectionnement;

  if (obtenue === null || obtenue === undefined) return null;
  if (hasPerfectionnement) {
    if (perf === null || perf === undefined) return obtenue;
    return obtenue + perf;
  }
  return obtenue;
}

/** Calcule la moyenne d'un élève (sur 20). */
export function computeStudentAverage(
  notes: Record<string, Note>,
  subjects: { id: string; hasPerfectionnement: boolean }[],
): number | null {
  const totals: number[] = [];
  for (const subject of subjects) {
    const note = notes[subject.id];
    if (!note) continue;
    const total = computeSubjectTotal(note, subject.hasPerfectionnement);
    if (total !== null) totals.push(total);
  }
  if (totals.length === 0) return null;
  return totals.reduce((a, b) => a + b, 0) / totals.length;
}

/** Calcule les statistiques de saisie d'une classe pour un type d'évaluation donné. */
export function computeSaisieStats(
  data: ClassData,
  evalType?: import("./types").EvaluationType,
): SaisieStats {
  let totalCells = 0;
  let filledCells = 0;
  const studentAverages: number[] = [];
  let etudiantsComplets = 0;

  // Si evalType est fourni, on calcule pour ce type précis.
  // Sinon, on retombe sur l'ancien comportement (champ `notes` ou `evaluations.EF1`).
  const notesForEval = evalType
    ? getEvaluationNotes(data, evalType)
    : (data.notes || getEvaluationNotes(data, "EF1"));

  for (const student of data.students) {
    const studentNotes = notesForEval[student.id] || {};
    let studentComplete = true;

    for (const subject of data.subjects) {
      // Compte la note obtenue
      totalCells += 1;
      const note = studentNotes[subject.id];
      if (note && note.obtenue !== null && note.obtenue !== undefined) {
        filledCells += 1;
      } else {
        studentComplete = false;
      }

      // Compte la note de perfectionnement si applicable
      if (subject.hasPerfectionnement) {
        totalCells += 1;
        if (note && note.perfectionnement !== null && note.perfectionnement !== undefined) {
          filledCells += 1;
        } else {
          studentComplete = false;
        }
      }
    }

    const avg = computeStudentAverage(
      studentNotes,
      data.subjects.map((s) => ({ id: s.id, hasPerfectionnement: s.hasPerfectionnement })),
    );
    if (avg !== null) studentAverages.push(avg);
    if (studentComplete) etudiantsComplets += 1;
  }

  const moyenneClasse =
    studentAverages.length > 0
      ? studentAverages.reduce((a, b) => a + b, 0) / studentAverages.length
      : null;

  return {
    totalCells,
    filledCells,
    completionRate: totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0,
    moyenneClasse: moyenneClasse !== null ? Math.round(moyenneClasse * 100) / 100 : null,
    etudiantsComplets,
  };
}

/** Tente de restaurer la session précédente depuis localStorage. */
export function restoreFromStorage(): {
  classes: ClassData[];
  activeClassIndex: number;
  savedAt: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.classes || !Array.isArray(parsed.classes)) return null;
    // Migration : s'assurer que les classes ont le champ `evaluations`
    parsed.classes = parsed.classes.map(migrateClassDataEvaluations);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * ⭐ Restore from backend (Neon DB) — fetches all sessions for the
 * authenticated prospect and converts them to ClassData[].
 * Falls back to localStorage if backend fails or returns no sessions.
 */
export async function restoreFromBackend(): Promise<{
  classes: ClassData[];
  activeClassIndex: number;
  savedAt: string;
} | null> {
  try {
    // Dynamic import to avoid circular dependency
    const { getSessions } = await import("./api");
    const sessions = await getSessions();
    if (!sessions || sessions.length === 0) return null;

    // Convert each session back to ClassData
    const classes: ClassData[] = sessions.map((session: any) => {
      const gd = session.gradesData || {};
      return {
        sheetName: gd.sheetName || session.className,
        className: gd.className || session.className,
        schoolName: gd.schoolName || "",
        academicYear: gd.academicYear || session.academicYear || "2025-2026",
        students: gd.students || [],
        subjects: gd.subjects || [],
        evaluations: gd.evaluations || { EF1: {}, ES1: {}, ES2: {}, ES3: {} },
        customEvaluationTypes: gd.customEvaluationTypes || [],
        notes: gd.notes || {},
        sourceFileName: gd.sourceFileName || null,
        importedAt: gd.importedAt || session.createdAt,
      };
    });

    // Apply migration
    const migratedClasses = classes.map(migrateClassDataEvaluations);

    return {
      classes: migratedClasses,
      activeClassIndex: 0,
      savedAt: sessions[0]?.updatedAt || new Date().toISOString(),
    };
  } catch (e) {
    console.warn("[saisiemaster] restoreFromBackend failed:", e);
    return null;
  }
}
