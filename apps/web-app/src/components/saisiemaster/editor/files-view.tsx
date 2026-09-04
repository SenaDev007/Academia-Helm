"use client";

import { useCallback, useEffect, useState } from "react";
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
  Files,
  RefreshCw,
  Trash2,
  FolderOpen,
  Loader2,
  Users,
  BookOpen,
  CalendarClock,
  CalendarDays,
  FileSpreadsheet,
} from "lucide-react";
import {
  getSessions,
  deleteSession,
  sessionToClassData,
  type ProspectSession,
} from "@/lib/saisiemaster/api";
import { useSaisieMasterStore } from "@/lib/saisiemaster/store";
import { toast } from "sonner";

/**
 * Vue "Mes fichiers" :
 *  - Liste des sessions sauvegardées sur le backend.
 *  - Chaque ligne : classe, année, élèves, matières, créée le, modifiée le.
 *  - Boutons : "Ouvrir" (charge la session dans l'éditeur) et "Supprimer".
 *  - Bouton "Actualiser" pour rafraîchir la liste.
 */
export function FilesView() {
  const [sessions, setSessions] = useState<ProspectSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const replaceClasses = useSaisieMasterStore((s) => s.replaceClasses);
  const setEditorView = useSaisieMasterStore((s) => s.setEditorView);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await getSessions();
      setSessions(list);
    } catch (e) {
      console.warn("[saisiemaster] getSessions failed:", e);
      setError(
        e instanceof Error
          ? e.message
          : "Impossible de charger les fichiers. Vérifiez votre connexion.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleOpen = (session: ProspectSession) => {
    const cls = sessionToClassData(session);
    if (!cls) {
      toast.error("Cette saisie est corrompue et ne peut pas être restaurée");
      return;
    }
    replaceClasses([cls]);
    setEditorView("notes");
    toast.success(`Saisie « ${session.className} » chargée`);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteSession(deleteId);
      setSessions((prev) => prev.filter((s) => s.id !== deleteId));
      toast.success("Fichier supprimé");
    } catch (e) {
      console.error(e);
      toast.error("Échec de la suppression");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-foreground flex items-center gap-2">
            <Files className="h-5 w-5 text-[#0D6EFD]" />
            Mes fichiers
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading
              ? "Chargement…"
              : error
                ? "Erreur de chargement"
                : `${sessions.length} fichier(s) sauvegardé(s) sur votre compte.`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
          className="shrink-0"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Actualiser
        </Button>
      </div>

      {/* Error */}
      {error && !loading && (
        <Card className="p-4 border-[#DC3545]/30 bg-[#DC3545]/5">
          <p className="text-sm text-[#DC3545] font-medium mb-1">
            Impossible de charger vos fichiers
          </p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && sessions.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <div className="mx-auto grid place-items-center h-14 w-14 rounded-full bg-muted mb-4">
            <Files className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground mb-1">
            Aucun fichier sauvegardé
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Vos saisies sont automatiquement sauvegardées sur votre compte
            SaisieMaster lorsque vous entrez des notes. Revenez ici pour les
            rouvrir plus tard, sur n&apos;importe quel appareil.
          </p>
        </Card>
      ) : null}

      {/* Sessions list */}
      {!error && sessions.length > 0 ? (
        <Card className="border-border/60 shadow-sm bg-white dark:bg-zinc-950 overflow-hidden">
          <div className="h-1 w-full saisiemaster-tricolor" />
          <div className="overflow-x-auto saisiemaster-scroll">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#F8F9FA] dark:bg-zinc-900 text-foreground">
                <tr className="border-b border-border">
                  <th className="text-left px-3 sm:px-4 py-3 font-semibold min-w-[180px]">
                    Classe
                  </th>
                  <th className="text-left px-3 py-3 font-semibold min-w-[110px] hidden sm:table-cell">
                    Année
                  </th>
                  <th className="text-center px-3 py-3 font-semibold min-w-[70px]">
                    Élèves
                  </th>
                  <th className="text-center px-3 py-3 font-semibold min-w-[70px] hidden md:table-cell">
                    Matières
                  </th>
                  <th className="text-left px-3 py-3 font-semibold min-w-[120px] hidden lg:table-cell">
                    Créée le
                  </th>
                  <th className="text-left px-3 py-3 font-semibold min-w-[120px]">
                    Modifiée le
                  </th>
                  <th className="text-right px-3 sm:px-4 py-3 font-semibold min-w-[140px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <FileRow
                    key={s.id}
                    session={s}
                    onOpen={() => handleOpen(s)}
                    onDelete={() => setDeleteId(s.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* Confirm delete */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce fichier ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette saisie sera définitivement supprimée de votre compte
              SaisieMaster. Cette action est irréversible.
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
                "Supprimer"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Ligne de session
// ============================================================================

function FileRow({
  session,
  onOpen,
  onDelete,
}: {
  session: ProspectSession;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <tr className="border-b border-border/40 hover:bg-[#0D6EFD]/5 transition-colors">
      <td className="px-3 sm:px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileSpreadsheet className="h-4 w-4 text-[#008751] shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">
              {session.className}
            </p>
            <p className="text-[11px] text-muted-foreground sm:hidden">
              {session.academicYear ?? session.schoolYear ?? "—"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 hidden sm:table-cell">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          {session.academicYear ?? session.schoolYear ?? "—"}
        </span>
      </td>
      <td className="px-3 py-3 text-center">
        <span className="inline-flex items-center gap-1 text-xs">
          <Users className="h-3 w-3 text-[#0D6EFD]" />
          {session.studentCount}
        </span>
      </td>
      <td className="px-3 py-3 text-center hidden md:table-cell">
        <span className="inline-flex items-center gap-1 text-xs">
          <BookOpen className="h-3 w-3 text-[#0D6EFD]" />
          {session.subjectCount}
        </span>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground hidden lg:table-cell">
        {formatDate(session.createdAt)}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="h-3 w-3" />
          {formatDate(session.updatedAt)}
        </span>
      </td>
      <td className="px-3 sm:px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={onOpen}
            className="border-[#0D6EFD]/30 text-[#0D6EFD] hover:bg-[#0D6EFD]/5"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ouvrir</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="text-[#DC3545] hover:bg-[#DC3545]/5 hover:text-[#DC3545]"
            aria-label="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
