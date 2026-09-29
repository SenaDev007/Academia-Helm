"use client";

/**
 * ============================================================================
 * FigureLibraryDialog — Catalogue complet de figures géométriques
 * ============================================================================
 *
 * ⭐ Demande utilisateur : « toutes les figures géométriques qu'on utilise
 *    depuis la maternelle jusqu'en classe de CM2… il faut que tout y figure :
 *    les catégories de triangles, les polygones, les lignes, les segments… »
 *
 * Navigateur du catalogue src/lib/geometry-figures.ts (≈110 figures en
 * 11 catégories) : recherche multi-termes insensible aux accents, filtre par
 * catégorie, vignettes rendues en SVG inline, insertion en SVG INLINE à la
 * position du curseur (rendu écran + export PDF identiques, hors-ligne OK).
 * ============================================================================
 */

import { useEffect, useMemo, useState } from "react";
import {
  Shapes, Search, X, Check, ChevronRight, Grid3x3,
} from "lucide-react";
import {
  GEOMETRY_FIGURE_CATEGORIES,
  GEOMETRY_FIGURE_COUNT,
  searchGeometryFigures,
  wrapGeometrySvg,
  type GeoFigureItem,
} from "@/lib/geometry-figures";
import { toast } from "sonner";

export interface FigureLibraryDialogProps {
  open: boolean;
  onClose: () => void;
  /** Insère le HTML fourni à la position du curseur de l'éditeur. */
  onInsertHtml: (html: string) => void;
}

export function FigureLibraryDialog({ open, onClose, onInsertHtml }: FigureLibraryDialogProps) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [insertedSlug, setInsertedSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const items = useMemo(() => {
    if (query.trim()) return searchGeometryFigures(query);
    const cats = activeCat === "all"
      ? GEOMETRY_FIGURE_CATEGORIES
      : GEOMETRY_FIGURE_CATEGORIES.filter((c) => c.id === activeCat);
    return cats.flatMap((c) => c.items.map((i) => ({ ...i, catLabel: c.label })));
  }, [query, activeCat]);

  if (!open) return null;

  const insertFigure = (item: GeoFigureItem) => {
    const html =
      `<span class="ah-fig" contenteditable="false" data-geo="${item.slug}" title="${escapeAttr(item.label)}" ` +
      `style="display:block;max-width:100%;">${wrapGeometrySvg(item)}</span>&nbsp;`;
    onInsertHtml(html);
    setInsertedSlug(item.slug);
    setTimeout(() => { setInsertedSlug(null); onClose(); }, 350);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Shapes className="h-5 w-5 text-purple-600" />
            <div>
              <div className="text-sm font-bold text-slate-800">Figures de géométrie</div>
              <div className="text-[11px] text-slate-500">
                Catalogue complet de la maternelle au CM2 — {GEOMETRY_FIGURE_COUNT} figures
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500" title="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Recherche + catégories */}
        <div className="px-4 py-3 border-b border-slate-200 bg-white space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher (ex : triangle isocèle, angle droit, patron cube, symétrie…)"
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-300 outline-none"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => { setActiveCat("all"); setQuery(""); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-colors ${
                activeCat === "all" && !query
                  ? "bg-purple-100 border-purple-300 text-purple-700"
                  : "border-slate-200 hover:bg-slate-50 text-slate-600"
              }`}
            >
              <Grid3x3 className="h-3 w-3" /> Toutes
            </button>
            {GEOMETRY_FIGURE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveCat(c.id); setQuery(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap border transition-colors ${
                  activeCat === c.id && !query
                    ? "bg-purple-100 border-purple-300 text-purple-700"
                    : "border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <span className={`px-1.5 py-0.5 rounded ${c.chip}`}>{c.items.length}</span>
                {c.label}
                <ChevronRight className="h-3 w-3 text-slate-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Grille des figures */}
        <div className="flex-1 overflow-y-auto p-4">
          {query.trim() && (
            <p className="text-[11px] text-slate-500 mb-2">
              {items.length} figure(s) pour « {query} »
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((f) => (
              <button
                key={f.slug}
                onClick={() => insertFigure(f)}
                className="group border border-slate-200 rounded-xl overflow-hidden hover:border-purple-400 hover:shadow-md transition-all bg-white text-left"
                title={`${f.label}${f.catLabel ? ` — ${f.catLabel}` : ""} (cliquer pour insérer)`}
              >
                <div
                  className="h-32 bg-slate-50 flex items-center justify-center p-2 overflow-hidden group-hover:bg-white transition-colors"
                  dangerouslySetInnerHTML={{
                    __html: `<svg viewBox="${f.vb || "0 0 240 170"}" style="max-width:100%;max-height:100%;height:auto;" xmlns="http://www.w3.org/2000/svg">${f.svg}</svg>`,
                  }}
                />
                <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                  <span className="text-[10.5px] font-semibold text-slate-700 leading-tight line-clamp-2">{f.label}</span>
                  {insertedSlug === f.slug ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <span className="text-[9px] text-purple-600 opacity-0 group-hover:opacity-100 font-bold shrink-0">Insérer</span>
                  )}
                </div>
              </button>
            ))}
            {items.length === 0 && (
              <div className="col-span-full py-10 text-center text-xs text-slate-400">
                Aucune figure ne correspond à « {query} » — essayez « triangle », « angle », « solide »…
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed mt-3">
            {GEOMETRY_FIGURE_COUNT} figures vectorielles avec codages pédagogiques (traits d&apos;égalité,
            carré d&apos;angle droit, chevrons de parallélisme) : formes de la maternelle, familles de
            triangles et quadrilatères, polygones réguliers, cercle, droites et angles, solides et
            patrons, symétrie, repères et proportionnalité, grandeurs et mesures.
          </p>
        </div>
      </div>
    </div>
  );
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
