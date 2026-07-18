"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCcw, FileSpreadsheet, PlayCircle } from "lucide-react";
import { useSaisieMasterStore, restoreFromStorage } from "@/lib/saisiemaster/store";

interface ResumeBannerProps {
  onResume: () => void;
}

interface RestoredInfo {
  classes: { className: string; students: { id: string }[] }[];
  savedAt: string;
}

/** Lit localStorage une seule fois (lazy initializer — pas d'effet). */
function readRestored(): RestoredInfo | null {
  if (typeof window === "undefined") return null;
  const data = restoreFromStorage();
  if (!data || data.classes.length === 0) return null;
  return {
    classes: data.classes.map((c) => ({
      className: c.className,
      students: c.students,
    })),
    savedAt: data.savedAt,
  };
}

export function ResumeBanner({ onResume }: ResumeBannerProps) {
  const [restored, setRestored] = useState<RestoredInfo | null>(readRestored);
  const clearAll = useSaisieMasterStore((s) => s.clearAll);

  if (!restored) return null;

  const totalStudents = restored.classes.reduce(
    (acc, c) => acc + c.students.length,
    0,
  );
  const totalClasses = restored.classes.length;
  const savedDate = new Date(restored.savedAt);
  const timeAgo = formatTimeAgo(savedDate);

  const handleDiscard = () => {
    clearAll();
    setRestored(null);
  };

  return (
    <Card className="mb-6 border-[#008751]/30 bg-gradient-to-br from-[#008751]/5 to-[#fcd116]/10 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="grid place-items-center h-10 w-10 rounded-lg bg-[#008751]/15 shrink-0">
          <FileSpreadsheet className="h-5 w-5 text-[#008751]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Reprise de saisie disponible
          </p>
          <p className="text-xs text-muted-foreground">
            {totalClasses} classe{totalClasses > 1 ? "s" : ""} ·{" "}
            {totalStudents} élève{totalStudents > 1 ? "s" : ""} · sauvegardé {timeAgo}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDiscard}
            className="text-muted-foreground hover:text-[#e31b23]"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Effacer</span>
          </Button>
          <Button size="sm" onClick={onResume} className="bg-[#008751] hover:bg-[#008751]/90">
            <PlayCircle className="h-4 w-4" />
            Reprendre la saisie
          </Button>
        </div>
      </div>
    </Card>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHours < 24) return `il y a ${diffHours} h`;
  if (diffDays < 7) return `il y a ${diffDays} j`;
  return date.toLocaleDateString("fr-FR");
}
