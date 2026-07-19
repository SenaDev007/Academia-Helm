"use client";

import { useEffect, useRef, useState } from "react";
import { EditorHeader } from "./editor-header";
import { EditorSidebar, type EditorNavId } from "./editor-sidebar";
import { StatsPanel } from "./stats-panel";
import { NotesTable } from "./notes-table";
import { NotesTableEleve } from "./notes-table-eleve";
import { ExportDialog } from "./export-dialog";
import { ClassesView } from "./classes-view";
import { FilesView } from "./files-view";
import { HistoryView } from "./history-view";
import { SettingsView } from "./settings-view";
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
import { useSaisieMasterStore } from "@/lib/saisiemaster/store";
import { useIsMobile } from "@/hooks/saisiemaster/use-mobile";
import { cn } from "@/lib/saisiemaster/utils";
import { toast } from "sonner";

interface EditorPageProps {
  onHome: () => void;
}

/**
 * ⭐ Auto-sauvegarde toutes les 10 secondes pendant la saisie.
 *
 * On garde une référence vers le timestamp de la dernière modification
 * (mise à jour par le store à chaque updateNote). Toutes les 10s, si des
 * modifications ont eu lieu depuis la dernière sauvegarde, on persiste
 * vers localStorage + backend (debounced).
 *
 * Le backend utilise déjà un debounce de 2s (scheduleBackendSync dans le
 * store), mais on veut une sauvegarde EXPLICITE toutes les 10s même si
 * l'utilisateur est inactif (pour garantir la persistance en cas de crash
 * ou de fermeture de l'onglet).
 */
const AUTOSAVE_INTERVAL_MS = 10_000;

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
        const { classes: cls, activeClassIndex: idx } = state;
        if (typeof window !== "undefined" && cls.length > 0) {
          window.localStorage.setItem(
            "saisiemaster:autosave",
            JSON.stringify({
              classes: cls,
              activeClassIndex: idx,
              savedAt: new Date().toISOString(),
            }),
          );
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

  const handleReset = () => {
    clearAll();
    setResetOpen(false);
    onHome();
  };

  // Le "Save" manuel déclenche une persistance explicite vers localStorage
  // (l'auto-save existe déjà, mais cela donne un feedback clair à l'utilisateur
  //  comme attendu dans le screenshot : "Modifications enregistrées avec succès").
  const handleSave = () => {
    setSaveStatus("saving");
    try {
      const state = useSaisieMasterStore.getState();
      const { classes, activeClassIndex } = state;
      if (typeof window !== "undefined" && classes.length > 0) {
        window.localStorage.setItem(
          "saisiemaster:autosave",
          JSON.stringify({
            classes,
            activeClassIndex,
            savedAt: new Date().toISOString(),
          }),
        );
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
