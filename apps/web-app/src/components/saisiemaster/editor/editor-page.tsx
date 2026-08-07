"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorHeader } from "./editor-header";
import { EditorSidebar, type EditorNavId } from "./editor-sidebar";
import { StatsPanel } from "./stats-panel";
import { NotesTable } from "./notes-table";
import { NotesTableEleve } from "./notes-table-eleve";
import { EvaluationTypeSelector } from "./evaluation-type-selector";
import { ExportDialog } from "./export-dialog";
import { ClassesView } from "./classes-view";
import { FilesView } from "./files-view";
import { HistoryView } from "./history-view";
import { SettingsView } from "./settings-view";
import { FeedbackModal } from "./feedback-modal";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Save,
  Download,
  CheckCircle2,
  RotateCcw,
  Info,
  Columns3,
  UserSquare2,
} from "lucide-react";
import { useSaisieMasterStore, selectIsAuthenticated } from "@/lib/saisiemaster/store";
import { useIsMobile } from "@/hooks/saisiemaster/use-mobile";
import { getMyTestimonials } from "@/lib/saisiemaster/api";
import { cn } from "@/lib/saisiemaster/utils";
import { toast } from "sonner";

interface EditorPageProps {
  onHome: () => void;
}

/**
 * ⭐ Auto-sauvegarde toutes les 10 secondes pendant la saisie.
 */
const AUTOSAVE_INTERVAL_MS = 10_000;

/**
 * ⭐ Auto-feedback : après qu'un utilisateur a saisi un certain nombre de
 * notes, on lui propose automatiquement de laisser un avis.
 *
 * Logique :
 *  1. On compte le nombre total de notes saisies (toutes classes confondues).
 *  2. Si ce nombre dépasse FEEDBACK_THRESHOLD (5 notes) ET que l'utilisateur
 *     n'a pas encore donné d'avis ET qu'on ne lui a pas déjà proposé ce
 *     session, on affiche le modal après un court délai (3s).
 *  3. On utilise localStorage pour ne pas re-proposer à chaque session :
 *     - 'saisiemaster:feedbackDismissed' = 'true' si l'utilisateur a fermé
 *       le modal sans donner d'avis (on ne re-proposera que 7 jours plus tard)
 */
const FEEDBACK_THRESHOLD = 5; // 5 notes saisies = usage significatif
const FEEDBACK_DELAY_MS = 3000; // 3s après le seuil atteint
const FEEDBACK_REPROPOSE_DAYS = 7; // re-proposer après 7 jours si dismiss

/**
 * Page éditeur SaisieMaster — version redesign "screenshot".
 *
 * Layout :
 *  ┌───────────────────────────────────────────────────────────────┐
 *  │  Header (logo + titre + infos user)                          │
 *  ├──────────┬────────────────────────────────────────────────────┤
 *  │          │  Vue active (notes / classes / files / history /   │
 *  │ Sidebar  │  settings) — voir `editorView` dans le store.      │
 *  │  (nav)   │                                                    │
 *  │          │                                                    │
 *  ├──────────┴────────────────────────────────────────────────────┤
 *  │  Action bar : Save + Export + zone message succès            │
 *  └───────────────────────────────────────────────────────────────┘
 *
 * Notes view : un toggle en haut permet de basculer entre
 *   - "Par matière" (défaut) : élèves en lignes, matières en colonnes
 *   - "Par élève" : on choisit un élève, ses matières deviennent les lignes
 */
export function EditorPage({ onHome }: EditorPageProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const isMobile = useIsMobile();
  // ⭐ Sur mobile, on force le mode "Par élève" qui est beaucoup plus
  // confortable pour la saisie tactile (une carte par matière avec deux
  // larges inputs au lieu d'un grand tableau à scroll horizontal).
  const [saisieMode, setSaisieMode] = useState<"matiere" | "eleve">("matiere");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  // Sync mode with viewport: when entering mobile, switch to "eleve";
  // when returning to desktop, keep the user's last choice.
  useEffect(() => {
    if (isMobile) {
      setSaisieMode("eleve");
    }
  }, [isMobile]);

  const clearAll = useSaisieMasterStore((s) => s.clearAll);
  const isExporting = useSaisieMasterStore((s) => s.isExporting);
  const editorView = useSaisieMasterStore((s) => s.editorView);
  const setEditorView = useSaisieMasterStore((s) => s.setEditorView);
  const classes = useSaisieMasterStore((s) => s.classes);
  const activeClassIndex = useSaisieMasterStore((s) => s.activeClassIndex);

  // ⭐ Auto-sauvegarde toutes les 10 secondes pendant la saisie.
  // On surveille les changements de `classes` et `activeClassIndex` pour
  // détecter qu'une modification a eu lieu. Le timestamp est mis à jour à
  // chaque render où classes change, et l'intervalle périodique vérifie
  // s'il y a eu des modifs depuis la dernière sauvegarde.
  const lastChangeRef = useRef<number>(0);
  const lastSaveRef = useRef<number>(Date.now());
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Marquer une modification à chaque fois que `classes` change
  useEffect(() => {
    if (classes.length === 0) return;
    lastChangeRef.current = Date.now();
  }, [classes, activeClassIndex]);

  // Intervalle d'auto-sauvegarde toutes les 10s
  useEffect(() => {
    if (classes.length === 0) return;

    const interval = setInterval(async () => {
      // Ne rien faire si aucune modification depuis la dernière sauvegarde
      if (lastChangeRef.current <= lastSaveRef.current) return;

      setAutoSaveStatus("saving");
      try {
        const state = useSaisieMasterStore.getState();
        const { classes: cls, activeClassIndex: idx, token, prospect } = state;
        if (typeof window !== "undefined" && cls.length > 0) {
          // ⭐ 1. Sauvegarder en localStorage (fallback hors-ligne)
          window.localStorage.setItem(
            "saisiemaster:autosave",
            JSON.stringify({
              classes: cls,
              activeClassIndex: idx,
              savedAt: new Date().toISOString(),
            }),
          );
        }

        // ⭐ 2. Sauvegarder AUSSI dans la base de données Neon via le backend
        if (token && prospect) {
          for (const clsItem of cls) {
            try {
              await fetch("/api/saisiemaster/sessions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  className: clsItem.className || clsItem.sheetName || "Classe",
                  academicYear: clsItem.academicYear || "2025-2026",
                  studentCount: clsItem.students?.length || 0,
                  subjectCount: clsItem.subjects?.length || 0,
                  gradesData: {
                    students: clsItem.students,
                    subjects: clsItem.subjects,
                    evaluations: clsItem.evaluations,
                    notes: clsItem.notes,
                    customEvaluationTypes: clsItem.customEvaluationTypes,
                    sourceFileName: clsItem.sourceFileName,
                    importedAt: clsItem.importedAt,
                  },
                }),
              });
            } catch (backendErr) {
              console.warn("[saisiemaster] Backend save failed (non-blocking):", backendErr);
            }
          }
        }

        lastSaveRef.current = Date.now();
        setAutoSaveStatus("saved");
        // Retour à idle après 2s
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } catch (e) {
        console.warn("[saisiemaster] auto-save failed:", e);
        setAutoSaveStatus("idle");
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [classes.length]); // se ré-initialise seulement si on passe de 0 à >0 classes

  // Sauvegarde avant fermeture de l'onglet (best-effort)
  useEffect(() => {
    if (classes.length === 0) return;
    const handler = () => {
      try {
        const state = useSaisieMasterStore.getState();
        if (state.classes.length > 0 && typeof window !== "undefined") {
          window.localStorage.setItem(
            "saisiemaster:autosave",
            JSON.stringify({
              classes: state.classes,
              activeClassIndex: state.activeClassIndex,
              savedAt: new Date().toISOString(),
            }),
          );
        }
      } catch {
        // best-effort
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [classes.length]);

  // ⭐ Auto-feedback : compte le nombre total de notes saisies et propose
  // automatiquement le modal d'avis après un usage significatif.
  const isAuthenticated = useSaisieMasterStore(selectIsAuthenticated);
  const [autoFeedbackOpen, setAutoFeedbackOpen] = useState(false);
  const feedbackCheckDoneRef = useRef(false);

  const totalNotesEntered = useMemo(() => {
    // Compte le nombre total de notes saisies (tous types d'évaluations confondus).
    // Utilisé pour le seuil de feedback automatique.
    let count = 0;
    for (const cls of classes) {
      // Nouveau format : evaluations[evalType][studentId][subjectId]
      if (cls.evaluations) {
        for (const evalType of ["EF1", "ES1", "ES2", "ES3"] as const) {
          const evalNotes = cls.evaluations[evalType] || {};
          for (const studentId of Object.keys(evalNotes)) {
            const studentNotes = evalNotes[studentId];
            for (const subjectId of Object.keys(studentNotes)) {
              const note = studentNotes[subjectId];
              if (note?.obtenue !== null && note?.obtenue !== undefined) count++;
              if (note?.perfectionnement !== null && note?.perfectionnement !== undefined) count++;
            }
          }
        }
      } else if (cls.notes) {
        // Rétro-compat : ancien format (un seul type d'évaluation)
        for (const studentId of Object.keys(cls.notes)) {
          const studentNotes = cls.notes[studentId];
          for (const subjectId of Object.keys(studentNotes)) {
            const note = studentNotes[subjectId];
            if (note?.obtenue !== null && note?.obtenue !== undefined) count++;
            if (note?.perfectionnement !== null && note?.perfectionnement !== undefined) count++;
          }
        }
      }
    }
    return count;
  }, [classes]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (feedbackCheckDoneRef.current) return;
    if (totalNotesEntered < FEEDBACK_THRESHOLD) return;

    // Vérifier si l'utilisateur a déjà donné un avis
    (async () => {
      try {
        const mine = await getMyTestimonials();
        if (mine.length > 0) {
          // Avis déjà donné → ne jamais re-proposer
          feedbackCheckDoneRef.current = true;
          return;
        }

        // Vérifier le dismiss récent (within 7 jours)
        try {
          const dismissedAt = window.localStorage.getItem("saisiemaster:feedbackDismissedAt");
          if (dismissedAt) {
            const dismissed = parseInt(dismissedAt, 10);
            const daysSince = (Date.now() - dismissed) / (1000 * 60 * 60 * 24);
            if (daysSince < FEEDBACK_REPROPOSE_DAYS) {
              feedbackCheckDoneRef.current = true;
              return;
            }
          }
        } catch {
          /* localStorage indisponible */
        }

        // Attendre un court délai puis afficher le modal
        const timer = setTimeout(() => {
          setAutoFeedbackOpen(true);
          feedbackCheckDoneRef.current = true;
        }, FEEDBACK_DELAY_MS);

        return () => clearTimeout(timer);
      } catch (e) {
        console.warn("[saisiemaster] auto-feedback check failed:", e);
      }
    })();
  }, [isAuthenticated, totalNotesEntered]);

  // Quand l'utilisateur ferme le modal sans donner d'avis, on enregistre
  // le timestamp pour ne pas re-proposer trop vite.
  const handleAutoFeedbackClose = (open: boolean) => {
    setAutoFeedbackOpen(open);
    if (!open) {
      try {
        window.localStorage.setItem(
          "saisiemaster:feedbackDismissedAt",
          String(Date.now()),
        );
      } catch {
        /* ignore */
      }
    }
  };

  const handleReset = () => {
    clearAll();
    setResetOpen(false);
    onHome();
  };

  // Le "Save" manuel déclenche une persistance explicite vers localStorage + backend
  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      const state = useSaisieMasterStore.getState();
      const { classes, activeClassIndex, token, prospect } = state;
      if (typeof window !== "undefined" && classes.length > 0) {
        // 1. localStorage
        window.localStorage.setItem(
          "saisiemaster:autosave",
          JSON.stringify({
            classes,
            activeClassIndex,
            savedAt: new Date().toISOString(),
          }),
        );

        // 2. Backend Neon DB
        if (token && prospect) {
          for (const clsItem of classes) {
            try {
              await fetch("/api/saisiemaster/sessions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  className: clsItem.className || clsItem.sheetName || "Classe",
                  academicYear: clsItem.academicYear || "2025-2026",
                  studentCount: clsItem.students?.length || 0,
                  subjectCount: clsItem.subjects?.length || 0,
                  gradesData: {
                    students: clsItem.students,
                    subjects: clsItem.subjects,
                    evaluations: clsItem.evaluations,
                    notes: clsItem.notes,
                    customEvaluationTypes: clsItem.customEvaluationTypes,
                    sourceFileName: clsItem.sourceFileName,
                    importedAt: clsItem.importedAt,
                  },
                }),
              });
            } catch (backendErr) {
              console.warn("[saisiemaster] Manual save backend failed:", backendErr);
            }
          }
        }
      }
      // Simule un mini-délai pour le feedback visuel.
      setTimeout(() => {
        setSaveStatus("saved");
        toast.success("Modifications enregistrées avec succès", {
          description: `Classe active : ${classes[activeClassIndex]?.className ?? "—"}`,
        });
        // Retour à l'état idle après 3 s.
        setTimeout(() => setSaveStatus("idle"), 3000);
      }, 350);
    } catch (e) {
      console.warn("[saisiemaster] save failed:", e);
      toast.error("Échec de l'enregistrement");
      setSaveStatus("idle");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <EditorHeader onHome={onHome} />

      <div className="flex flex-1 min-h-0">
        <EditorSidebar
          active={editorView}
          onSelect={(id) => setEditorView(id)}
        />

        {/* Zone principale (scrollable) */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {editorView === "notes" ? (
              <>
                {/* Stats panel — desktop en haut, mobile sous la table */}
                <div className="order-2 lg:order-1">
                  <StatsPanel />
                </div>

                <div className="order-1 lg:order-2 space-y-2">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <h2 className="text-lg font-semibold text-foreground">
                      Saisie des notes
                    </h2>
                    <p className="text-xs text-muted-foreground hidden sm:block">
                      Astuce :{" "}
                      <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">
                        Entrée
                      </kbd>{" "}
                      pour passer à la cellule suivante
                    </p>
                  </div>

                  {/* Sélecteur de type d'évaluation (4 onglets : EF1, ES1, ES2, ES3) */}
                  <EvaluationTypeSelector />

                  {/* Toggle "Par matière" / "Par élève" — caché sur mobile */}
                  {!isMobile && (
                    <SaisieModeToggle
                      mode={saisieMode}
                      onChange={setSaisieMode}
                    />
                  )}

                  {saisieMode === "matiere" ? (
                    <NotesTable />
                  ) : (
                    <NotesTableEleve
                      studentId={selectedStudentId}
                      onStudentChange={setSelectedStudentId}
                    />
                  )}
                </div>
              </>
            ) : editorView === "classes" ? (
              <ClassesView />
            ) : editorView === "files" ? (
              <FilesView />
            ) : editorView === "history" ? (
              <HistoryView />
            ) : editorView === "settings" ? (
              <SettingsView />
            ) : null}
          </div>

          {/* Barre d'action basse (sticky) — visible uniquement sur la vue "notes" */}
          {editorView === "notes" && classes.length > 0 && (
            <ActionBar
              onSave={handleSave}
              saveStatus={saveStatus}
              autoSaveStatus={autoSaveStatus}
              onExport={() => setExportOpen(true)}
              onReset={() => setResetOpen(true)}
              isExporting={isExporting}
            />
          )}
        </main>
      </div>

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réinitialiser la saisie ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action effacera toutes les notes saisies et les données
              importées. Vous devrez réimporter un template EducMaster pour
              recommencer. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-[#DC3545] hover:bg-[#DC3545]/90 text-white"
            >
              Réinitialiser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ⭐ Modal d'avis automatique — s'ouvre après un usage significatif */}
      <FeedbackModal open={autoFeedbackOpen} onOpenChange={handleAutoFeedbackClose} />
    </div>
  );
}

// ============================================================================
// Toggle "Par matière" / "Par élève"
// ============================================================================

function SaisieModeToggle({
  mode,
  onChange,
}: {
  mode: "matiere" | "eleve";
  onChange: (mode: "matiere" | "eleve") => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Mode de saisie"
      className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/60 border border-border/60 w-full sm:w-auto"
    >
      <ToggleButton
        active={mode === "matiere"}
        onClick={() => onChange("matiere")}
        icon={Columns3}
        label="Par matière"
      />
      <ToggleButton
        active={mode === "eleve"}
        onClick={() => onChange("eleve")}
        icon={UserSquare2}
        label="Par élève"
      />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Columns3;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors",
        active
          ? "bg-white dark:bg-zinc-950 text-[#0D6EFD] shadow-sm border border-[#0D6EFD]/30"
          : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ============================================================================
// Barre d'action inférieure
// ============================================================================

interface ActionBarProps {
  onSave: () => void;
  saveStatus: "idle" | "saving" | "saved";
  autoSaveStatus: "idle" | "saving" | "saved";
  onExport: () => void;
  onReset: () => void;
  isExporting: boolean;
}

function ActionBar({
  onSave,
  saveStatus,
  autoSaveStatus,
  onExport,
  onReset,
  isExporting,
}: ActionBarProps) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-border/60 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md">
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Zone message (succès / info / auto-save) */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {saveStatus === "saved" ? (
            <span className="inline-flex items-center gap-2 text-sm text-[#198754] font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span className="truncate">
                Modifications enregistrées avec succès
              </span>
            </span>
          ) : saveStatus === "saving" ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
              <span>Enregistrement…</span>
            </span>
          ) : autoSaveStatus === "saving" ? (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-[#0D6EFD]/30 border-t-[#0D6EFD] animate-spin" />
              <span>Auto-save en cours…</span>
            </span>
          ) : autoSaveStatus === "saved" ? (
            <span className="inline-flex items-center gap-2 text-xs text-[#198754]/80 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="truncate">Sauvegarde automatique effectuée</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                Auto-save actif (toutes les 10s) — vos saisies sont sauvegardées automatiquement.
              </span>
              <span className="sm:hidden">Auto-save 10s</span>
            </span>
          )}
        </div>

        {/* Boutons d'action */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-muted-foreground hover:text-[#DC3545]"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Réinitialiser</span>
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={saveStatus === "saving"}
            className="bg-[#198754] hover:bg-[#198754]/90 text-white shadow-sm"
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">
              {saveStatus === "saving" ? "Enregistrement…" : "Enregistrer"}
            </span>
          </Button>
          <Button
            size="sm"
            onClick={onExport}
            disabled={isExporting}
            className="bg-[#0D6EFD] hover:bg-[#0D6EFD]/90 text-white shadow-sm"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">
              {isExporting ? "Export…" : "Exporter Excel"}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
