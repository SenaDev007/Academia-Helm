"use client";

import { useState } from "react";
import { EditorHeader } from "./editor-header";
import { StatsPanel } from "./stats-panel";
import { NotesTable } from "./notes-table";
import { ExportDialog } from "./export-dialog";
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
import { useSaisieMasterStore } from "@/lib/saisiemaster/store";

interface EditorPageProps {
  onHome: () => void;
}

export function EditorPage({ onHome }: EditorPageProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const clearAll = useSaisieMasterStore((s) => s.clearAll);

  const handleReset = () => {
    clearAll();
    setResetOpen(false);
    onHome();
  };

  return (
    <>
      <EditorHeader
        onExport={() => setExportOpen(true)}
        onReset={() => setResetOpen(true)}
        onHome={onHome}
      />

      <main className="flex-1 mx-auto max-w-[1600px] w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <StatsPanel />

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Saisie des notes
            </h2>
            <p className="text-xs text-muted-foreground">
              Astuce: <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Entrée</kbd>{" "}
              pour passer à la cellule suivante
            </p>
          </div>
          <NotesTable />
        </div>
      </main>

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
              className="bg-[#e31b23] hover:bg-[#e31b23]/90 text-white"
            >
              Réinitialiser
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
