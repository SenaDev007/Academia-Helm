"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
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
  Users,
  BookOpen,
  CalendarClock,
  Trash2,
  ArrowRight,
  Plus,
  FolderTree,
  Loader2,
} from "lucide-react";
import { useSaisieMasterStore, computeSaisieStats } from "@/lib/saisiemaster/store";
import { UploadZone } from "@/components/saisiemaster/landing/upload-zone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

/**
 * Vue "Mes classes" :
 *  - Grille de cartes, une par classe importée (depuis le store).
 *  - Chaque carte : nom, nb élèves, nb matières, dern. modification.
 *  - Bouton "Ouvrir" → bascule sur "Saisie des notes" avec cette classe active.
 *  - Bouton "Supprimer" (avec confirmation) → deleteClass(index).
 *  - Bouton "Nouveau import" → ouvre un dialog avec UploadZone.
 */
export function ClassesView() {
  const classes = useSaisieMasterStore((s) => s.classes);
  const setActiveClass = useSaisieMasterStore((s) => s.setActiveClass);
  const deleteClass = useSaisieMasterStore((s) => s.deleteClass);
  const setEditorView = useSaisieMasterStore((s) => s.setEditorView);

  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleOpen = (index: number) => {
    setActiveClass(index);
    setEditorView("notes");
    toast.success("Classe chargée dans l'éditeur");
  };

  const handleConfirmDelete = async () => {
    if (deleteIndex === null) return;
    setDeleting(true);
    try {
      await deleteClass(deleteIndex);
      toast.success("Classe supprimée");
    } catch (e) {
      console.error(e);
      toast.error("Échec de la suppression");
    } finally {
      setDeleting(false);
      setDeleteIndex(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-[#0D6EFD]" />
            Mes classes
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {classes.length === 0
              ? "Aucune classe importée pour l'instant."
              : `${classes.length} classe(s) importée(s) au total.`}
          </p>
        </div>
        <Button
          onClick={() => setUploadOpen(true)}
          className="bg-[#008751] hover:bg-[#008751]/90 text-white shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nouvel import
        </Button>
      </div>

      {/* Empty state */}
      {classes.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-muted mb-4">
            <FolderTree className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground mb-1">
            Aucune classe à afficher
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
            Importez un template EducMaster (.xlsx) pour créer votre première
            classe. Vous pourrez ensuite saisir les notes par élève ou par
            matière.
          </p>
          <Button
            onClick={() => setUploadOpen(true)}
            className="bg-[#008751] hover:bg-[#008751]/90 text-white"
          >
            <Plus className="h-4 w-4" />
            Importer un fichier
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((cls, idx) => (
            <ClassCard
              key={`${cls.sheetName}-${idx}`}
              name={cls.className}
              sheetName={cls.sheetName}
              studentCount={cls.students.length}
              subjectCount={cls.subjects.length}
              academicYear={cls.academicYear}
              schoolName={cls.schoolName}
              importedAt={cls.importedAt}
              stats={computeSaisieStats(cls)}
              onOpen={() => handleOpen(idx)}
              onDelete={() => setDeleteIndex(idx)}
            />
          ))}
        </div>
      )}

      {/* Dialog: Nouveau import */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importer un nouveau template EducMaster</DialogTitle>
            <DialogDescription>
              Sélectionnez un fichier .xlsx téléchargé depuis EducMaster pour
              créer une nouvelle classe. Les classes existantes ne seront pas
              affectées.
            </DialogDescription>
          </DialogHeader>
          <UploadZone
            compact
            onProcessed={() => setUploadOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog
        open={deleteIndex !== null}
        onOpenChange={(o) => !o && setDeleteIndex(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette classe ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteIndex !== null && classes[deleteIndex] ? (
                <>
                  La classe{" "}
                  <strong className="text-foreground">
                    {classes[deleteIndex].className}
                  </strong>{" "}
                  sera supprimée de cet appareil ET de votre compte
                  SaisieMaster (sauvegarde serveur). Cette action est
                  irréversible.
                </>
              ) : (
                "Cette action est irréversible."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-[#DC3545] hover:bg-[#DC3545]/90 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Suppression…
                </>
              ) : (
                "Supprimer définitivement"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Carte individuelle de classe
// ============================================================================

interface ClassCardProps {
  name: string;
  sheetName: string;
  studentCount: number;
  subjectCount: number;
  academicYear: string;
  schoolName: string;
  importedAt: string;
  stats: ReturnType<typeof computeSaisieStats>;
  onOpen: () => void;
  onDelete: () => void;
}

function ClassCard({
  name,
  sheetName,
  studentCount,
  subjectCount,
  academicYear,
  schoolName,
  importedAt,
  stats,
  onOpen,
  onDelete,
}: ClassCardProps) {
  const lastModified = useMemo(() => {
    try {
      return new Date(importedAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  }, [importedAt]);

  const completionColor =
    stats.completionRate === 100
      ? "#198754"
      : stats.completionRate >= 50
        ? "#FD7E14"
        : "#DC3545";

  return (
    <Card className="p-4 sm:p-5 border-border/60 shadow-sm bg-white dark:bg-zinc-950 hover:shadow-md transition-shadow flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-[#0D6EFD]/10 text-[#0D6EFD] text-xs font-bold shrink-0">
              {name.slice(0, 2).toUpperCase()}
            </span>
            <h3 className="font-semibold text-foreground text-base sm:text-lg truncate">
              {name}
            </h3>
          </div>
          <p className="text-[11px] text-muted-foreground truncate pl-10">
            {schoolName ? `${schoolName} · ` : ""}
            {sheetName}
          </p>
        </div>
      </div>

      {/* Stats inline */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md bg-[#F8F9FA] dark:bg-zinc-900/60 p-2 text-center">
          <Users className="h-3.5 w-3.5 text-[#0D6EFD] mx-auto mb-0.5" />
          <p className="text-sm font-bold text-foreground leading-tight">
            {studentCount}
          </p>
          <p className="text-[10px] text-muted-foreground">élèves</p>
        </div>
        <div className="rounded-md bg-[#F8F9FA] dark:bg-zinc-900/60 p-2 text-center">
          <BookOpen className="h-3.5 w-3.5 text-[#0D6EFD] mx-auto mb-0.5" />
          <p className="text-sm font-bold text-foreground leading-tight">
            {subjectCount}
          </p>
          <p className="text-[10px] text-muted-foreground">matières</p>
        </div>
        <div className="rounded-md bg-[#F8F9FA] dark:bg-zinc-900/60 p-2 text-center">
          <CalendarClock
            className="h-3.5 w-3.5 mx-auto mb-0.5"
            style={{ color: completionColor }}
          />
          <p
            className="text-sm font-bold leading-tight"
            style={{ color: completionColor }}
          >
            {stats.completionRate}%
          </p>
          <p className="text-[10px] text-muted-foreground">saisie</p>
        </div>
      </div>

      {/* Meta: année scolaire + dernière modif */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {academicYear && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {academicYear}
          </span>
        )}
        <span>·</span>
        <span>Modifiée le {lastModified}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/40">
        <Button
          size="sm"
          onClick={onOpen}
          className="bg-[#0D6EFD] hover:bg-[#0D6EFD]/90 text-white flex-1"
        >
          Ouvrir
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onDelete}
          className="text-[#DC3545] hover:bg-[#DC3545]/5 hover:text-[#DC3545] border-[#DC3545]/30"
          aria-label="Supprimer la classe"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
