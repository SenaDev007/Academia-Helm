"use client";

/**
 * SaisieMaster — Sessions list ("Mes saisies")
 *
 * Shows the prospect's saved sessions (backend) and lets them:
 *   - Resume a session (load it into the editor)
 *   - Delete a session
 *
 * Displayed as a dropdown / collapsible panel in the editor header.
 */

import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  History,
  Trash2,
  FileSpreadsheet,
  Loader2,
  Clock,
  Users,
} from "lucide-react";
import {
  getSessions,
  deleteSession,
  sessionToClassData,
  type ProspectSession,
} from "@/lib/saisiemaster/api";
import type { ClassData } from "@/lib/saisiemaster/types";
import { toast } from "sonner";

interface SessionsListProps {
  /** Called when the user picks a session to resume. */
  onResume: (classes: ClassData[]) => void;
}

export function SessionsList({ onResume }: SessionsListProps) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<ProspectSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function refresh() {
    setLoading(true);
    try {
      const list = await getSessions();
      setSessions(list);
    } catch (e) {
      console.warn("[saisiemaster] getSessions failed:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(sessionId: string) {
    setDeletingId(sessionId);
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success("Saisie supprimée");
    } catch (e) {
      toast.error("Échec de la suppression");
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  }

  function handleResume(session: ProspectSession) {
    const cls = sessionToClassData(session);
    if (!cls) {
      toast.error("Cette saisie est corrompue et ne peut pas être restaurée");
      return;
    }
    onResume([cls]);
    setOpen(false);
    toast.success(`Saisie « ${session.className} » chargée`);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-[#008751]/30 text-[#008751] hover:bg-[#008751]/5"
        >
          <History className="h-4 w-4" />
          <span className="hidden sm:inline">Mes saisies</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-h-96 overflow-y-auto"
      >
        <DropdownMenuLabel className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-[#008751]" />
          Mes saisies sauvegardées
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="py-6 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Chargement…
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-6 px-3 text-center text-sm text-muted-foreground">
            Aucune saisie sauvegardée pour l&apos;instant.
            <br />
            Vos saisies seront automatiquement enregistrées lorsque vous
            saisirez des notes.
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="group flex items-start gap-2 px-2 py-2 hover:bg-muted/50 rounded-sm"
            >
              <button
                type="button"
                onClick={() => handleResume(session)}
                className="flex-1 text-left min-w-0"
                aria-label={`Reprendre la saisie ${session.className}`}
              >
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground truncate">
                  <span className="truncate">{session.className}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                  {session.schoolYear && (
                    <span className="inline-flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {session.schoolYear}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-0.5">
                    <Users className="h-3 w-3" />
                    {session.studentCount} él.
                  </span>
                  <span>·</span>
                  <span>{session.subjectCount} matières</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Modifiée le{" "}
                  {new Date(session.updatedAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(session.id)}
                disabled={deletingId === session.id}
                aria-label={`Supprimer la saisie ${session.className}`}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-[#e31b23] hover:bg-[#e31b23]/5 disabled:opacity-50"
              >
                {deletingId === session.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
