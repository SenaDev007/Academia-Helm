"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/saisiemaster/utils";
import { useSaisieMasterStore, validateNote, computeStudentAverage } from "@/lib/saisiemaster/store";
import { GRADING } from "@/lib/saisiemaster/constants";
import type { ClassData, Note } from "@/lib/saisiemaster/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Minus } from "lucide-react";

/**
 * Couleur d'une note en fonction de sa valeur (règle "screenshot") :
 *  - value >= 14  → vert   (#198754)  "bonne note"
 *  - 10 <= value < 14 → orange (#FD7E14)  "note moyenne"
 *  - value < 10   → rouge   (#DC3545)  "note faible"
 *  - valeur vide  → neutre (transparent)
 *
 * Cette règle s'applique à la valeur brute saisie (obtenue ou perfectionnement).
 * L'ancien système de validation (status ok/warning/error hors plage) reste
 * utilisé pour afficher l'icône d'alerte, mais la couleur de fond suit la règle
 * ci-dessus pour correspondre au screenshot.
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

/**
 * Tableau interactif de saisie des notes.
 *
 * Architecture :
 *  - En-tête à 2 lignes figé (sticky) : matières (row 1) + sous-colonnes (row 2)
 *  - Colonne Matricule/Nom/Prénoms figée horizontalement (sticky left)
 *  - Chaque cellule = input number avec validation à la volée
 *  - Coloration des cellules selon la valeur (vert/orange/rouge)
 *  - Lignes alternées (blanc / gris très clair) comme dans le screenshot
 *  - Navigation clavier : Tab (suivant), Shift+Tab (précédent), Entrée (ligne suivante)
 */
export function NotesTable() {
  const { classes, activeClassIndex, updateNote } = useSaisieMasterStore();
  const classData: ClassData | undefined = classes[activeClassIndex];
  const tableRef = useRef<HTMLTableElement>(null);

  if (!classData) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Aucune classe active.
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        {/* Bande tricolore */}
        <div className="h-1 w-full saisiemaster-tricolor" />

        <div className="overflow-auto saisiemaster-scroll max-h-[60vh] lg:max-h-[70vh]">
          <table
            ref={tableRef}
            className="w-full border-collapse text-sm"
            role="grid"
            aria-label={`Notes — Classe ${classData.className}`}
          >
            <NotesTableHeader classData={classData} />
            <NotesTableBody
              classData={classData}
              updateNote={updateNote}
            />
          </table>
        </div>

        {/* Légende des couleurs */}
        <div className="border-t border-border bg-[#F8F9FA] dark:bg-zinc-900 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground mr-1">Légende :</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(25, 135, 84, 0.35)", border: "1px solid rgba(25, 135, 84, 0.6)" }} />
            Bonne note (≥ 14)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(253, 126, 20, 0.35)", border: "1px solid rgba(253, 126, 20, 0.6)" }} />
            Note moyenne (10 – 13)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(220, 53, 69, 0.35)", border: "1px solid rgba(220, 53, 69, 0.6)" }} />
            Note faible (&lt; 10)
          </span>
          <span className="ml-auto hidden sm:inline">
            Barème : <strong className="text-foreground">Note obtenue /{GRADING.obtainedMaxWithPerf}</strong> +{" "}
            <strong className="text-foreground">Perfectionnement /{GRADING.perfectionMax}</strong> = /{GRADING.totalMax}
            <span className="mx-2 text-border">·</span>
            Sans perfectionnement : <strong className="text-foreground">Note obtenue /{GRADING.obtainedMaxWithoutPerf}</strong>
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// En-tête du tableau (sticky)
// ============================================================================

function NotesTableHeader({ classData }: { classData: ClassData }) {
  return (
    <thead className="sticky top-0 z-20">
      {/* Ligne 1 : Matières (cellules fusionnées horizontalement sur 2 colonnes si perf) */}
      <tr className="bg-[#0D6EFD] text-white">
        <th
          rowSpan={2}
          className="sticky left-0 z-30 bg-[#0D6EFD] text-white px-3 py-2.5 text-left font-semibold border-r border-white/20 min-w-[140px] max-w-[180px]"
        >
          Matricule
        </th>
        <th
          rowSpan={2}
          className="sticky left-[140px] z-30 bg-[#0D6EFD] text-white px-3 py-2.5 text-left font-semibold border-r border-white/20 min-w-[140px] max-w-[180px]"
        >
          Nom
        </th>
        <th
          rowSpan={2}
          className="sticky left-[280px] z-30 bg-[#0D6EFD] text-white px-3 py-2.5 text-left font-semibold border-r border-white/20 min-w-[140px] max-w-[200px] hidden md:table-cell"
        >
          Prénoms
        </th>
        {classData.subjects.map((subject) => (
          <th
            key={subject.id}
            colSpan={subject.hasPerfectionnement ? 2 : 1}
            className="px-2 py-2 text-center font-semibold border-r border-white/20 min-w-[120px]"
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs sm:text-sm">{subject.name}</span>
              <span className="text-[10px] font-normal opacity-80">
                {subject.hasPerfectionnement
                  ? `/18 + /2 = /20`
                  : `/20`}
              </span>
            </div>
          </th>
        ))}
        <th
          rowSpan={2}
          className="px-3 py-2.5 text-center font-semibold bg-[#198754] text-white border-l border-white/20 min-w-[80px] sticky right-0 z-30"
        >
          <span className="text-xs sm:text-sm">Moy.</span>
          <span className="block text-[10px] font-normal opacity-90">/20</span>
        </th>
      </tr>
      {/* Ligne 2 : Sous-en-têtes */}
      <tr className="bg-[#F8F9FA] dark:bg-zinc-800 text-foreground border-b border-border">
        {classData.subjects.flatMap((subject) =>
          subject.hasPerfectionnement
            ? [
                <th
                  key={`${subject.id}-obt`}
                  className="px-1.5 py-1.5 text-center text-[10px] sm:text-xs font-medium border-r border-border/60 min-w-[60px]"
                >
                  Obt.
                </th>,
                <th
                  key={`${subject.id}-perf`}
                  className="px-1.5 py-1.5 text-center text-[10px] sm:text-xs font-medium border-r border-border/60 min-w-[60px]"
                >
                  Perf.
                </th>,
              ]
            : [
                <th
                  key={`${subject.id}-obt`}
                  className="px-1.5 py-1.5 text-center text-[10px] sm:text-xs font-medium border-r border-border/60 min-w-[80px]"
                >
                  Obt. /20
                </th>,
              ],
        )}
      </tr>
    </thead>
  );
}

// ============================================================================
// Corps du tableau
// ============================================================================

interface NotesTableBodyProps {
  classData: ClassData;
  updateNote: (
    studentId: string,
    subjectId: string,
    field: keyof Note,
    value: number | null,
  ) => void;
}

function NotesTableBody({ classData, updateNote }: NotesTableBodyProps) {
  return (
    <tbody>
      {classData.students.map((student, idx) => {
        const studentNotes = classData.notes[student.id] || {};
        const avg = computeStudentAverage(
          studentNotes,
          classData.subjects.map((s) => ({
            id: s.id,
            hasPerfectionnement: s.hasPerfectionnement,
          })),
        );
        // Alternance de couleurs : lignes paires en blanc, lignes impaires en gris clair
        const isEven = idx % 2 === 0;
        const rowBg = isEven
          ? "bg-white dark:bg-zinc-950"
          : "bg-[#F8F9FA] dark:bg-zinc-900/60";
        const stickyRowBg = isEven
          ? "bg-white dark:bg-zinc-950"
          : "bg-[#F8F9FA] dark:bg-zinc-900/60";

        return (
          <tr
            key={student.id}
            className={cn(rowBg, "hover:bg-[#0D6EFD]/5 transition-colors border-b border-border/40")}
          >
            {/* Matricule */}
            <td
              className={cn(
                "sticky left-0 z-10 border-r border-border/60 px-3 py-2 text-xs font-mono text-muted-foreground",
                stickyRowBg,
              )}
            >
              <span className="block truncate" title={student.matricule}>
                {student.matricule}
              </span>
            </td>
            {/* Nom */}
            <td
              className={cn(
                "sticky left-[140px] z-10 border-r border-border/60 px-3 py-2 font-medium text-foreground",
                stickyRowBg,
              )}
            >
              <span className="block truncate" title={student.nom}>
                {student.nom}
              </span>
            </td>
            {/* Prénoms */}
            <td
              className={cn(
                "sticky left-[280px] z-10 border-r border-border/60 px-3 py-2 text-muted-foreground hidden md:table-cell",
                stickyRowBg,
              )}
            >
              <span className="block truncate" title={student.prenoms}>
                {student.prenoms}
              </span>
            </td>

            {/* Notes par matière */}
            {classData.subjects.flatMap((subject) => {
              const note = studentNotes[subject.id] || {
                obtenue: null,
                perfectionnement: null,
              };
              const validation = validateNote(note, subject.hasPerfectionnement);

              const obtainedCell = (
                <NoteCell
                  key={`${student.id}-${subject.id}-obt`}
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
              );

              const perfCell = subject.hasPerfectionnement ? (
                <NoteCell
                  key={`${student.id}-${subject.id}-perf`}
                  value={note.perfectionnement}
                  max={GRADING.perfectionMax}
                  validation={validation.perfectionnement}
                  onChange={(v) =>
                    updateNote(student.id, subject.id, "perfectionnement", v)
                  }
                />
              ) : null;

              return perfCell ? [obtainedCell, perfCell] : [obtainedCell];
            })}

            {/* Moyenne élève */}
            <td className="sticky right-0 z-10 border-l border-border/60 px-2 py-2 text-center bg-[#198754]/5">
              {avg !== null ? (
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[2.5rem] h-6 px-1.5 rounded-md text-xs font-bold",
                    avg >= 10
                      ? "bg-[#198754]/15 text-[#198754]"
                      : "bg-[#DC3545]/15 text-[#DC3545]",
                  )}
                >
                  {avg.toFixed(2)}
                </span>
              ) : (
                <Minus className="h-4 w-4 mx-auto text-muted-foreground/40" />
              )}
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}

// ============================================================================
// Cellule de note individuelle
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
      // Clamp automatique si dépassement
      const clamped = Math.max(0, Math.min(max, num));
      onChange(clamped);
    },
    [max, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Aller à la cellule suivante (même colonne, ligne suivante)
        const current = inputRef.current;
        if (!current) return;
        const all = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[data-note-input="true"]'),
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

  // L'icône d'alerte reste gouvernée par la validation hors-plage.
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
