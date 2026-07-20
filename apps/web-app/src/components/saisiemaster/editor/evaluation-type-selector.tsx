"use client";

/**
 * Sélecteur de type d'évaluation — 4 onglets (EF1, ES1, ES2, ES3).
 *
 * Affiché au-dessus du tableau de notes dans l'éditeur SaisieMaster.
 * Permet à l'enseignant de basculer entre les 4 types d'évaluations
 * pour la classe active.
 *
 * Chaque onglet affiche :
 *  - Le code court (EF1, ES1, ES2, ES3)
 *  - Un indicateur visuel si des notes ont été saisies pour ce type
 */

import { cn } from "@/lib/saisiemaster/utils";
import { useSaisieMasterStore } from "@/lib/saisiemaster/store";
import { EVALUATION_TYPES } from "@/lib/saisiemaster/constants";
import { hasEvaluationNotes } from "@/lib/saisiemaster/evaluation-utils";

export function EvaluationTypeSelector() {
  const { classes, activeClassIndex, activeEvalType, setActiveEvalType } =
    useSaisieMasterStore();
  const classData = classes[activeClassIndex];

  if (!classData) return null;

  return (
    <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
      <div className="h-1 w-full saisiemaster-tricolor" aria-hidden />
      <div className="flex overflow-x-auto">
        {EVALUATION_TYPES.map((evalType) => {
          const isActive = activeEvalType === evalType.code;
          const hasNotes = hasEvaluationNotes(classData, evalType.code);
          return (
            <button
              key={evalType.code}
              onClick={() => setActiveEvalType(evalType.code)}
              className={cn(
                "flex-1 min-w-[140px] flex flex-col items-center gap-1 px-4 py-3 text-sm font-bold transition-all whitespace-nowrap border-b-2",
                isActive
                  ? "text-[#0D6EFD] border-[#0D6EFD] bg-[#0D6EFD]/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent",
              )}
              title={evalType.description}
              aria-pressed={isActive}
            >
              <span className="text-base">{evalType.short}</span>
              <span className="text-[10px] font-normal opacity-70 hidden sm:inline">
                {evalType.label}
              </span>
              {hasNotes && (
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 rounded-full",
                    isActive ? "bg-[#0D6EFD]" : "bg-emerald-500",
                  )}
                  aria-label="Notes saisies"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
