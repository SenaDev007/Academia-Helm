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
  Note,
  SaisieStats,
} from "./types";
import { GRADING, STORAGE_KEY } from "./constants";
import {
  type Prospect,
  type ActivityType,
  classDataToSessionPayload,
  saveSession,
  trackActivity,
  getToken,
  getStoredProspect,
  setAuth as persistAuth,
  clearAuth as clearPersistedAuth,
} from "./api";

interface SaisieMasterState {
  /** Vue active. */
  view: AppView;
  /** Classes chargées depuis le fichier importé. */
  classes: ClassData[];
  /** Index de la classe active (pour multi-classes). */
  activeClassIndex: number;
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
  loadClasses: (classes: ClassData[]) => void;
  setActiveClass: (index: number) => void;
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

function scheduleBackendSync(classes: ClassData[], activeClassIndex: number) {
  // Only sync if authenticated
  if (!getToken()) return;
  const activeClass = classes[activeClassIndex];
  if (!activeClass) return;

  if (backendSyncTimer) {
    clearTimeout(backendSyncTimer);
  }
  backendSyncTimer = setTimeout(() => {
    const payload = classDataToSessionPayload(activeClass);
    saveSession(payload).catch((e) => {
      // Best-effort — don't block the user.
      console.warn("[saisiemaster] backend sync failed:", e);
    });
    backendSyncTimer = null;
  }, BACKEND_SYNC_DEBOUNCE_MS);
}

export const useSaisieMasterStore = create<SaisieMasterState>((set, get) => ({
  view: "landing",
  classes: [],
  activeClassIndex: 0,
  importError: null,
  isExporting: false,
  prospect: null,
  token: null,

  setView: (view) => set({ view }),

  loadClasses: (classes) => {
    set({
      classes,
      activeClassIndex: 0,
      importError: null,
      view: classes.length > 0 ? "editor" : "landing",
    });
    // Track classes creation + trigger backend sync for the first class.
    if (classes.length > 0 && getToken()) {
      void trackActivity("grade_entered");
      scheduleBackendSync(classes, 0);
    }
  },

  setActiveClass: (index) => {
    set({ activeClassIndex: index });
    // Sync the newly-active class to the backend (debounced).
    scheduleBackendSync(get().classes, index);
  },

  setImportError: (error) => set({ importError: error }),

  updateNote: (studentId, subjectId, field, value) => {
    const state = get();
    const { classes, activeClassIndex } = state;
    if (classes.length === 0) return;
    const classData = classes[activeClassIndex];
    if (!classData) return;

    const newClasses = [...classes];
    const newClassData: ClassData = {
      ...classData,
      notes: {
        ...classData.notes,
        [studentId]: {
          ...classData.notes[studentId],
          [subjectId]: {
            ...(classData.notes[studentId]?.[subjectId] || {
              obtenue: null,
              perfectionnement: null,
            }),
            [field]: value,
          },
        },
      },
    };
    newClasses[activeClassIndex] = newClassData;

    set({ classes: newClasses });

    // Auto-save en localStorage
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            classes: newClasses,
            activeClassIndex,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch (e) {
        console.warn("Auto-save échoué:", e);
      }
    }

    // Sync vers le backend (debounced) — si authentifié.
    scheduleBackendSync(newClasses, activeClassIndex);
  },

  clearAll: () => {
    set({
      view: "landing",
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
    set({ prospect, token });
    persistAuth(prospect, token);
    // Track login for lead scoring (best-effort, non-blocking).
    void trackActivity("login" as ActivityType);
  },

  logout: () => {
    set({ prospect: null, token: null, view: "landing" });
    clearPersistedAuth();
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

/** Calcule les statistiques de saisie d'une classe. */
export function computeSaisieStats(data: ClassData): SaisieStats {
  let totalCells = 0;
  let filledCells = 0;
  const studentAverages: number[] = [];
  let etudiantsComplets = 0;

  for (const student of data.students) {
    const studentNotes = data.notes[student.id] || {};
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
    return parsed;
  } catch {
    return null;
  }
}
