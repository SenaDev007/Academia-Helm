"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/saisiemaster/utils";
import {
  useSaisieMasterStore,
  validateNote,
  computeSubjectTotal,
} from "@/lib/saisiemaster/store";
import { GRADING } from "@/lib/saisiemaster/constants";
import type { ClassData, Note } from "@/lib/saisiemaster/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Minus, Users } from "lucide-react";

/**
 * Couleur d'une note (règle identique au tableau principal) :
 *  - value >= 14  → vert   (#198754)
 *  - 10 <= value < 14 → orange (#FD7E14)
 *  - value < 10   → rouge   (#DC3545)
 *  - valeur vide  → neutre (transparent)
 */
function getNoteColor(value: number | null, isFocused: boolean) {
  if (isFocused) {
    return {
      background: "var(--accent)",
      borderColor: "#0D6EFD",
      color: "var(--foreground)",
    };
  }
  if (value === null || value === undefined) {
    return {
      background: "transparent",
      borderColor: "var(--border)",
      color: "var(--foreground)",
    };
  }
  if (value >= 14) {
    return {
      background: "rgba(25, 135, 84, 0.12)",
      borderColor: "rgba(25, 135, 84, 0.45)",
      color: "#198754",
    };
  }
  if (value >= 10) {
    return {
      background: "rgba(253, 126, 20, 0.14)",
      borderColor: "rgba(253, 126, 20, 0.45)",
      color: "#b35a00",
    };
  }
  return {
    background: "rgba(220, 53, 69, 0.10)",
    borderColor: "rgba(220, 53, 69, 0.45)",
    color: "#DC3545",
  };
}

interface NotesTableEleveProps {
  /** Élève actuellement sélectionné (id). */
  studentId: string;
  /** Callback quand l'utilisateur change d'élève. */
  onStudentChange: (id: string) => void;
}

/**
 * Vue "Saisir par élève" : l'élève sélectionné devient le sujet d'étude,
 * les matières sont les lignes. Chaque ligne = [Matière, Note obtenue,
 * Note perfectionnement (si applicable), Total].
 *
 * - L'utilisateur sélectionne l'élève via un menu déroulant en haut.
 * - Les champs de note fonctionnent à l'identique du tableau principal :
 *   validation, coloration, navigation clavier (Entrée → ligne suivante).
 * - La même action `updateNote` du store est utilisée → pas de duplication
 *   d'état, l'auto-save backend et localStorage restent identiques.
 */
export function NotesTableEleve({
  studentId,
  onStudentChange,
}: NotesTableEleveProps) {
  const { classes, activeClassIndex, updateNote } = useSaisieMasterStore();
  const classData: ClassData | undefined = classes[activeClassIndex];

  if (!classData) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Aucune classe active.
      </div>
    );
  }

  const student =
    classData.students.find((s) => s.id === studentId) ?? classData.students[0];

  if (!student) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Aucun élève dans cette classe.
      </div>
    );
  }

  // S'assurer que le parent sait quel élève est actuellement affiché
  // (au cas où l'élève sélectionné n'existerait pas).
  if (student.id !== studentId) {
    onStudentChange(student.id);
  }

  const studentNotes = classData.notes[student.id] || {};

  // Totaux & moyenne
  const totals = classData.subjects.map((subject) => {
    const note = studentNotes[subject.id] || {
      obtenue: null,
      perfectionnement: null,
    };
    return computeSubjectTotal(note, subject.hasPerfectionnement);
  });
  const filledTotals = totals.filter((t) => t !== null) as number[];
  const moyenne =
    filledTotals.length > 0
      ? filledTotals.reduce((a, b) => a + b, 0) / filledTotals.length
      : null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        <div className="h-1 w-full saisiemaster-tricolor" />

        {/* Sélecteur d'élève + résumé */}
        <div className="px-4 sm:px-5 py-4 border-b border-border bg-[#F8F9FA] dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid place-items-center h-9 w-9 rounded-full bg-[#0D6EFD]/10 text-[#0D6EFD] shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Élève sélectionné
              </p>
              <p className="text-sm font-semibold text-foreground truncate">
                {student.nom} {student.prenoms}
              </p>
            </div>
          </div>

          <div className="sm:ml-auto w-full sm:w-72">
            <Select value={student.id} onValueChange={onStudentChange}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Choisir un élève" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {classData.students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {s.matricule}
                    </span>
                    <span className="font-medium">{s.nom}</span>
                    <span className="text-muted-foreground ml-1">
                      {s.prenoms}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tableau des matières */}
        <div className="overflow-x-auto saisiemaster-scroll max-h-[55vh] lg:max-h-[60vh]">
          <table
            className="w-full border-collapse text-sm"
            role="grid"
            aria-label={`Notes par matière — ${student.nom} ${student.prenoms}`}
          >
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#0D6EFD] text-white">
                <th className="sticky left-0 z-30 bg-[#0D6EFD] text-white px-3 py-2.5 text-left font-semibold border-r border-white/20 min-w-[200px]">
                  Matière
                </th>
                <th className="px-3 py-2.5 text-center font-semibold border-r border-white/20 min-w-[110px]">
                  Note obtenue
                </th>
                <th className="px-3 py-2.5 text-center font-semibold border-r border-white/20 min-w-[110px]">
                  Note perfectionnement
                </th>
                <th className="px-3 py-2.5 text-center font-semibold bg-[#198754] border-l border-white/20 min-w-[90px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {classData.subjects.map((subject, idx) => {
                const note = studentNotes[subject.id] || {
                  obtenue: null,
                  perfectionnement: null,
                };
                const validation = validateNote(note, subject.hasPerfectionnement);
                const total = totals[idx];
                const isEven = idx % 2 === 0;
                const rowBg = isEven
                  ? "bg-white dark:bg-zinc-950"
                  : "bg-[#F8F9FA] dark:bg-zinc-900/60";
                const stickyBg = isEven
                  ? "bg-white dark:bg-zinc-950"
                  : "bg-[#F8F9FA] dark:bg-zinc-900/60";

                return (
                  <tr
                    key={subject.id}
                    className={cn(
                      rowBg,
                      "hover:bg-[#0D6EFD]/5 transition-colors border-b border-border/40",
                    )}
                  >
                    {/* Matière */}
                    <td
                      className={cn(
                        "sticky left-0 z-10 border-r border-border/60 px-3 py-2",
                        stickyBg,
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {subject.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {subject.hasPerfectionnement
                            ? `/18 + /2 = /20`
                            : `/20`}
                        </span>
                      </div>
                    </td>

                    {/* Note obtenue */}
                    <NoteCell
                      value={note.obtenue}
                      max={
                        subject.hasPerfectionnement
                          ? GRADING.obtainedMaxWithPerf
                          : GRADING.obtainedMaxWithoutPerf
                      }
                      validation={validation.obtenue}
                      onChange={(v) =>
                        updateNote(student.id, subject.id, "obtenue", v)
                      }
                    />

                    {/* Note perfectionnement (si applicable) */}
                    {subject.hasPerfectionnement ? (
                      <NoteCell
                        value={note.perfectionnement}
                        max={GRADING.perfectionMax}
                        validation={validation.perfectionnement}
                        onChange={(v) =>
                          updateNote(student.id, subject.id, "perfectionnement", v)
                        }
                      />
                    ) : (
                      <td className="border-r border-border/40 px-3 py-2 text-center text-muted-foreground/60">
                        <Minus className="h-4 w-4 mx-auto" />
                      </td>
                    )}

                    {/* Total */}
                    <td className="border-l border-border/60 px-2 py-2 text-center bg-[#198754]/5">
                      {total !== null ? (
                        <span
                          className={cn(
                            "inline-flex items-center justify-center min-w-[2.5rem] h-6 px-1.5 rounded-md text-xs font-bold",
                            total >= 10
                              ? "bg-[#198754]/15 text-[#198754]"
                              : "bg-[#DC3545]/15 text-[#DC3545]",
                          )}
                        >
                          {total.toFixed(2)}
                        </span>
                      ) : (
                        <Minus className="h-4 w-4 mx-auto text-muted-foreground/40" />
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Ligne Moyenne */}
              <tr className="bg-[#198754] text-white border-t-2 border-white/20">
                <td
                  className="sticky left-0 z-10 bg-[#198754] text-white px-3 py-2.5 font-semibold border-r border-white/20"
                  colSpan={3}
                >
                  <div className="flex items-center justify-between">
                    <span>Moyenne de l&apos;élève</span>
                    <span className="text-[10px] font-normal opacity-90">
                      ({filledTotals.length}/{classData.subjects.length} matières saisies)
                    </span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-center">
                  {moyenne !== null ? (
                    <span className="inline-flex items-center justify-center min-w-[2.75rem] h-7 px-2 rounded-md text-sm font-bold bg-white/20">
                      {moyenne.toFixed(2)}
                    </span>
                  ) : (
                    <Minus className="h-4 w-4 mx-auto opacity-70" />
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Légende des couleurs */}
        <div className="border-t border-border bg-[#F8F9FA] dark:bg-zinc-900 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground mr-1">Légende :</span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{
                background: "rgba(25, 135, 84, 0.35)",
                border: "1px solid rgba(25, 135, 84, 0.6)",
              }}
            />
            Bonne note (≥ 14)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{
                background: "rgba(253, 126, 20, 0.35)",
                border: "1px solid rgba(253, 126, 20, 0.6)",
              }}
            />
            Note moyenne (10 – 13)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{
                background: "rgba(220, 53, 69, 0.35)",
                border: "1px solid rgba(220, 53, 69, 0.6)",
              }}
            />
            Note faible (&lt; 10)
          </span>
          <span className="ml-auto hidden sm:inline">
            Barème :{" "}
            <strong className="text-foreground">
              Note obtenue /{GRADING.obtainedMaxWithPerf}
            </strong>{" "}
            +{" "}
            <strong className="text-foreground">
              Perfectionnement /{GRADING.perfectionMax}
            </strong>{" "}
            = /{GRADING.totalMax}
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// Cellule de note (extrait du tableau principal — comportement identique)
// ============================================================================

interface NoteCellProps {
  value: number | null;
  max: number;
  validation?: { status: "ok" | "warning" | "error" | "empty"; message?: string };
  onChange: (value: number | null) => void;
}

function NoteCell({ value, max, validation, onChange }: NoteCellProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.trim();
      if (raw === "") {
        onChange(null);
        return;
      }
      const num = Number(raw.replace(",", "."));
      if (!Number.isFinite(num)) {
        onChange(null);
        return;
      }
      const clamped = Math.max(0, Math.min(max, num));
      onChange(clamped);
    },
    [max, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const current = inputRef.current;
        if (!current) return;
        const all = Array.from(
          document.querySelectorAll<HTMLInputElement>(
            'input[data-note-input="true"]',
          ),
        );
        const idx = all.indexOf(current);
        const next = all[idx + 1];
        if (next) {
          next.focus();
          next.select();
        }
      }
    },
    [],
  );

  const status = validation?.status ?? "empty";

  const cellStyles = useMemo(
    () => getNoteColor(value, isFocused),
    [value, isFocused],
  );

  const icon = useMemo(() => {
    if (status === "error")
      return <AlertTriangle className="h-3 w-3 text-[#DC3545]" />;
    return null;
  }, [status]);

  return (
    <td className="border-r border-border/40 px-1 py-1 text-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              data-note-input="true"
              value={value ?? ""}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={(e) => {
                setIsFocused(true);
                e.target.select();
              }}
              onBlur={() => setIsFocused(false)}
              placeholder="—"
              className={cn(
                "w-full h-8 text-center text-sm font-medium rounded-md border transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/40",
              )}
              style={cellStyles}
              aria-label={`Note (max ${max})`}
            />
            {icon && (
              <span className="absolute top-0.5 right-0.5 pointer-events-none">
                {icon}
              </span>
            )}
          </div>
        </TooltipTrigger>
        {validation?.message && (
          <TooltipContent side="top" className="text-xs">
            {validation.message}
          </TooltipContent>
        )}
      </Tooltip>
    </td>
  );
}
