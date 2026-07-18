"use client";

import { useState } from "react";
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
import { cn } from "@/lib/saisiemaster/utils";
import { toast } from "sonner";

interface EditorPageProps {
  onHome: () => void;
}

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
  const [saisieMode, setSaisieMode] = useState<"matiere" | "eleve">("matiere");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  const clearAll = useSaisieMasterStore((s) => s.clearAll);
  const isExporting = useSaisieMasterStore((s) => s.isExporting);
  const editorView = useSaisieMasterStore((s) => s.editorView);
  const setEditorView = useSaisieMasterStore((s) => s.setEditorView);
  const classes = useSaisieMasterStore((s) => s.classes);

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

                  {/* Toggle "Par matière" / "Par élève" */}
                  <SaisieModeToggle
                    mode={saisieMode}
                    onChange={setSaisieMode}
                  />

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
  onExport: () => void;
  onReset: () => void;
  isExporting: boolean;
}

function ActionBar({
  onSave,
  saveStatus,
  onExport,
  onReset,
  isExporting,
}: ActionBarProps) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-border/60 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md">
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Zone message (succès / info) */}
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
          ) : (
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                Auto-save actif — vos saisies sont sauvegardées automatiquement.
              </span>
              <span className="sm:hidden">Auto-save actif</span>
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
