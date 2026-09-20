"use client";

/**
 * ============================================================================
 * CAHIER JOURNAL MATERNELLE — Grille officielle (reproduction EXACTE du modèle)
 * ============================================================================
 *
 * ⭐ Source : modèle papier « cahier journal maternelle » de l'école.
 *
 * PAGE 1 (RECTO) :
 *   DATE (5 jours LUNDI→VENDREDI) │ DOMAINE I (Education pour la santé) │
 *   DOMAINE II (Expression corporelle) │ DOMAINE [III] : Pré lecture,
 *   Pré écriture, Pré mathématiques, Observations
 *
 * PAGE 2 (VERSO) :
 *   III [fin du domaine III] : Education sensorielle, Travaux manuels │
 *   DOMAINE IV : Expression émotionnelle, Expression plastique │
 *   DOMAINE V : Communication orale, Conte, Poésie chant comptine, Activités libres
 *
 * ⭐ Le tableau est FIXE : il s'affiche EXACTEMENT comme le modèle, même si
 *    une matière n'est pas paramétrée dans le module Pédagogie → Matières
 *    et programmes. AUCUNE colonne « autre matière » n'est ajoutée.
 *
 * ⭐ Les matières paramétrées sont récupérées de façon DYNAMIQUE et liées
 *    aux colonnes correspondantes (badge vert sous le sous-titre) — elles
 *    servent à rattacher les fiches pédagogiques aux vraies matières.
 * ============================================================================
 */

import { Fragment } from "react";
import { ClipboardList } from "lucide-react";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import {
  MATERNELLE_RECTO_COLUMNS,
  MATERNELLE_VERSO_COLUMNS,
  type MaternellePageColumn,
  type DynamicSubject,
} from "@/lib/pedagogy/maternelle-domaines";

// ─────────────────────────────────────────────────────────────────────────────
// Jours de la semaine (identique au modèle : LUNDI → VENDREDI)
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = [
  { id: 1, key: "lundi", label: "LUNDI" },
  { id: 2, key: "mardi", label: "MARDI" },
  { id: 3, key: "mercredi", label: "MERCREDI" },
  { id: 4, key: "jeudi", label: "JEUDI" },
  { id: 5, key: "vendredi", label: "VENDREDI" },
] as const;

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatDateFR(date: Date): string {
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface CahierJournalMaternelleGridProps {
  /** Date du lundi de la semaine (affichée sous chaque jour) */
  weekStart: Date;
  /** Entries du cahier journal : { lundi: { "Pré lecture": "<html>", ... }, ... } */
  entries: Record<string, Record<string, string>>;
  /** Mise à jour d'une case (jour × clé d'entrée) */
  updateEntry: (dayKey: string, subjectKey: string, value: string) => void;
  /** Lecture d'une case (jour × clé d'entrée) */
  getEntry: (dayKey: string, subjectKey: string) => string;
  /** Lecture seule (SUBMITTED / VALIDATED) */
  isReadOnly: boolean;
  /** Liaison dynamique : libellé de colonne → matières paramétrées (multi — fusion) */
  subjectBinding?: Map<string, DynamicSubject[]>;
  /** Résolveur de clés d'entrée par colonne (matière liée → nom de matière,
   *  sinon libellé de la colonne ; « Observations » → obs_dom). La 1ère clé
   *  est la clé d'écriture, les suivantes des replis de lecture. */
  entryKeyResolver?: (columnLabel: string) => string[];
  /** Zone OBSERVATIONS (pied de page gauche — libellé vertical comme le modèle) */
  observationsLeft: string;
  onObservationsLeftChange: (value: string) => void;
  /** Zone non titrée (pied de page droite — lignes d'écriture du modèle) */
  observationsRight: string;
  onObservationsRightChange: (value: string) => void;
  /** Observation du directeur par jour (affichée en rouge sous la ligne du jour) */
  getDirectorObservation?: (dayKey: string) => string;
  /** ⭐ FEATURE « Fiche à préparer » (2026-09-18) : la cellule (jour × matière)
   *  est-elle marquée comme nécessitant une fiche pédagogique ? */
  isFicheAPreparer?: (dayKey: string, subjectKey: string) => boolean;
  /** ⭐ Toggle du flag « fiche à préparer » (jour × matière) */
  onToggleFicheAPreparer?: (dayKey: string, subjectKey: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de lecture / écriture avec repli de clés
// ─────────────────────────────────────────────────────────────────────────────

/** Retire le HTML pour tester si un contenu est réellement vide */
function stripHtml(html: string | undefined | null): string {
  return (html || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
}

// ── ⭐ Toggle « Fiche à préparer » (identique visuellement à celui du primaire) ──
function MaternelleFicheToggle({
  active,
  onToggle,
  disabled,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={disabled}
      title={
        active
          ? "Fiche pédagogique à préparer pour cette activité (cliquer pour retirer)"
          : "Marquer cette activité comme fiche pédagogique à préparer"
      }
      className={cn(
        "absolute top-1 right-1 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all",
        active
          ? "bg-amber-100 border-amber-400 text-amber-800 shadow-sm"
          : "bg-white/80 border-slate-200 text-slate-400 hover:text-amber-700 hover:border-amber-300",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <ClipboardList className="h-3 w-3" />
      {active ? "Fiche à préparer" : "Fiche"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant : en-tête de page (2 lignes, fusions conformes au modèle)
// ─────────────────────────────────────────────────────────────────────────────

function PageHeader({ columns }: { columns: MaternellePageColumn[] }) {
  return (
    <thead>
      {/* Ligne 1 : titres des domaines (DATE fusionné sur 2 lignes sur la page 1) */}
      <tr className="bg-slate-100">
        <th
          rowSpan={2}
          className="border border-slate-400 px-2 py-2 text-xs font-bold text-slate-800 uppercase w-20 sticky left-0 bg-slate-100 z-10"
          style={{ letterSpacing: "0.05em" }}
        >
          DATE
        </th>
        {columns.map((col, i) =>
          col.kind === "single" ? (
            <th
              key={`h1-${i}`}
              className="border border-slate-400 px-2 py-2 text-xs font-bold text-slate-800 uppercase tracking-wide"
              style={{ minWidth: "150px" }}
            >
              {col.headerTitle}
            </th>
          ) : (
            <th
              key={`h1-${i}`}
              colSpan={col.subColumns?.length || 1}
              className="border border-slate-400 px-2 py-2 text-xs font-bold text-slate-800 uppercase tracking-wide"
            >
              {col.headerTitle}
            </th>
          ),
        )}
      </tr>
      {/* Ligne 2 : sous-titres (matières du domaine) */}
      <tr className="bg-slate-50">
        {columns.map((col, i) =>
          col.kind === "single" ? (
            <th key={`h2-${i}`} className="border border-slate-400 px-2 py-2 text-[10px] font-semibold text-slate-600">
              {col.subColumn?.label}
            </th>
          ) : (
            (col.subColumns || []).map((sc, j) => (
              <th key={`h2-${i}-${j}`} className="border border-slate-400 px-2 py-2 text-[10px] font-semibold text-slate-600 leading-tight">
                {sc.label}
              </th>
            ))
          ),
        )}
      </tr>
    </thead>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant : une page du tableau (recto ou verso)
// ─────────────────────────────────────────────────────────────────────────────

function JournalPage({
  columns,
  entries,
  updateEntry,
  getEntry,
  isReadOnly,
  subjectBinding,
  entryKeyResolver,
  weekStart,
  getDirectorObservation,
  isFicheAPreparer,
  onToggleFicheAPreparer,
}: {
  columns: MaternellePageColumn[];
  entries: Record<string, Record<string, string>>;
  updateEntry: (dayKey: string, subjectKey: string, value: string) => void;
  getEntry: (dayKey: string, subjectKey: string) => string;
  isReadOnly: boolean;
  subjectBinding?: Map<string, DynamicSubject[]>;
  entryKeyResolver?: (columnLabel: string) => string[];
  weekStart: Date;
  getDirectorObservation?: (dayKey: string) => string;
  isFicheAPreparer?: (dayKey: string, subjectKey: string) => boolean;
  onToggleFicheAPreparer?: (dayKey: string, subjectKey: string) => void;
}) {
  // Aplatit les colonnes de la page en cellules (libellé de sous-colonne)
  const flatColumns: string[] = columns.flatMap(col =>
    col.kind === "single" ? [col.subColumn!.label] : (col.subColumns || []).map(sc => sc.label),
  );

  // Clés d'entrée d'une colonne : [clé d'écriture, ...replis de lecture]
  const keysFor = (colLabel: string): string[] =>
    entryKeyResolver ? entryKeyResolver(colLabel) : [colLabel];

  // Lecture avec repli : première clé dont le contenu n'est pas vide
  const readEntry = (dayKey: string, colLabel: string): string => {
    for (const k of keysFor(colLabel)) {
      const v = getEntry(dayKey, k);
      if (v && stripHtml(v)) return v;
    }
    // Toutes vides → rendre la valeur de la clé d'écriture (contient éventuellement
    // du HTML « vide » type <p></p> que l'éditeur restituera tel quel)
    return getEntry(dayKey, keysFor(colLabel)[0]) || "";
  };

  return (
    <div className="overflow-x-auto border border-slate-400 rounded-lg">
      <table className="w-full border-collapse min-w-[1100px] table-fixed">
        <PageHeader columns={columns} />
        <tbody>
          {DAYS.map(day => {
            const dayDate = new Date(weekStart.getTime() + (day.id - 1) * 86400000);
            const dirObs = getDirectorObservation?.(day.key) || "";
            return (
              <Fragment key={day.key}>
                <tr className="hover:bg-slate-50/60">
                  <td className="border border-slate-400 px-2 py-2 text-xs font-bold text-slate-800 uppercase bg-slate-50 sticky left-0 z-10 align-top">
                    <div>{day.label}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-normal">
                      {formatDateFR(dayDate)}
                    </div>
                  </td>
                  {flatColumns.map(colLabel => {
                    const bound = subjectBinding?.get(colLabel);
                    const writeKey = keysFor(colLabel)[0];
                    const ficheFlagActive = !!(isFicheAPreparer && onToggleFicheAPreparer && isFicheAPreparer(day.key, writeKey));
                    return (
                      <td key={colLabel} className="border border-slate-400 p-0 align-top relative">
                        {/* ⭐ FEATURE : marquer l'activité comme fiche à préparer */}
                        {isFicheAPreparer && onToggleFicheAPreparer && (
                          <MaternelleFicheToggle
                            active={ficheFlagActive}
                            onToggle={() => onToggleFicheAPreparer(day.key, writeKey)}
                            disabled={isReadOnly}
                          />
                        )}
                        <RichTextEditor
                          value={readEntry(day.key, colLabel)}
                          onChange={html => updateEntry(day.key, writeKey, html)}
                          disabled={isReadOnly}
                          enableMedia={!isReadOnly}
                          placeholder="—"
                          minHeight="110px"
                        />
                        {/* ⭐ Badge de liaison dynamique avec les matières paramétrées */}
                        {bound && bound.length > 0 && (
                          <div className="px-1.5 py-0.5 bg-emerald-50 border-t border-emerald-100 text-[9px] text-emerald-700 font-medium truncate" title={`Matière(s) paramétrée(s) liée(s) : ${bound.map(s => s.subjectName).join(', ')}`}>
                            ↳ {bound[0].subjectName}{bound.length > 1 ? ` (+${bound.length - 1})` : ''}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                {/* Observation du directeur pour ce jour (affichée en rouge) */}
                {dirObs && (
                  <tr className="bg-red-50">
                    <td className="border border-slate-400 border-l-red-300 px-2 py-1 text-[9px] font-bold text-red-600 uppercase bg-red-50 sticky left-0 z-10">
                      Dir.
                    </td>
                    <td colSpan={flatColumns.length} className="border border-slate-400 px-2 py-1 text-xs text-red-800 font-semibold whitespace-pre-wrap">
                      {dirObs}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal : grille complète (2 pages + pieds de page du modèle)
// ─────────────────────────────────────────────────────────────────────────────

export function CahierJournalMaternelleGrid({
  weekStart,
  entries,
  updateEntry,
  getEntry,
  isReadOnly,
  subjectBinding,
  entryKeyResolver,
  observationsLeft,
  onObservationsLeftChange,
  observationsRight,
  onObservationsRightChange,
  getDirectorObservation,
  isFicheAPreparer,
  onToggleFicheAPreparer,
}: CahierJournalMaternelleGridProps) {
  return (
    <div className="space-y-6 mb-8">
      {/* ═══ PAGE 1 — RECTO ═══ */}
      <div>
        <div className="mb-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Page 1 — Recto
        </div>
        <JournalPage
          columns={MATERNELLE_RECTO_COLUMNS}
          entries={entries}
          updateEntry={updateEntry}
          getEntry={getEntry}
          isReadOnly={isReadOnly}
          subjectBinding={subjectBinding}
          entryKeyResolver={entryKeyResolver}
          weekStart={weekStart}
          getDirectorObservation={getDirectorObservation}
          isFicheAPreparer={isFicheAPreparer}
          onToggleFicheAPreparer={onToggleFicheAPreparer}
        />
        {/* Pied de page gauche : zone OBSERVATIONS (libellé vertical comme le modèle) */}
        <div className="mt-2 flex overflow-hidden border border-slate-300 rounded-lg min-h-[110px]">
          <div className="flex items-center justify-center w-10 bg-slate-100 border-r border-slate-300">
            <span
              className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Observations
            </span>
          </div>
          <textarea
            value={observationsLeft}
            onChange={e => onObservationsLeftChange(e.target.value)}
            disabled={isReadOnly}
            rows={4}
            placeholder="Observations de la semaine…"
            className="flex-1 px-3 py-2 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:bg-slate-50 resize-y min-w-0"
          />
        </div>
      </div>

      {/* ═══ PAGE 2 — VERSO ═══ */}
      <div>
        <div className="mb-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          Page 2 — Verso
        </div>
        <JournalPage
          columns={MATERNELLE_VERSO_COLUMNS}
          entries={entries}
          updateEntry={updateEntry}
          getEntry={getEntry}
          isReadOnly={isReadOnly}
          subjectBinding={subjectBinding}
          entryKeyResolver={entryKeyResolver}
          weekStart={weekStart}
          getDirectorObservation={getDirectorObservation}
          isFicheAPreparer={isFicheAPreparer}
          onToggleFicheAPreparer={onToggleFicheAPreparer}
        />
        {/* ⭐ Pied de page droite : zone OBSERVATIONS (libellé vertical, comme la
            page recto — précise la nature de la zone et la sépare clairement de
            la section « Travaux & Suivi de la semaine » qui suit) */}
        <div className="mt-2 flex overflow-hidden border border-slate-300 rounded-lg min-h-[110px]">
          <div className="flex items-center justify-center w-10 bg-slate-100 border-r border-slate-300">
            <span
              className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Observations
            </span>
          </div>
          <textarea
            value={observationsRight}
            onChange={e => onObservationsRightChange(e.target.value)}
            disabled={isReadOnly}
            rows={4}
            placeholder="Observations…"
            className="flex-1 px-3 py-2 text-xs border-0 focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:bg-slate-50 resize-y min-w-0"
          />
        </div>
      </div>
    </div>
  );
}
