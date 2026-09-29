"use client";

/**
 * ============================================================================
 * ShapesDialog — FORMES WORD pour les champs de saisie enrichis
 * ============================================================================
 *
 * ⭐ V14 (2026-09-22 — retour utilisateur : « enrichir encore nos champs de
 *    saisie avec des shapes comme dans Word ») :
 *
 * Catalogue de formes professionnelles façon Microsoft Word ▸ Insérer ▸ Formes :
 *   - BASES        : rectangle, rectangle arrondi, ellipse, cercle, triangles,
 *                    losange, parallélogramme, trapèze, polygones réguliers, croix
 *   - FLÈCHES      : droite, gauche, haut, bas, double, chevron
 *   - ÉTOILES      : 5 branches, 6 branches, éclat 12 branches, sceau 8
 *   - LÉGENDES     : bulle rectangle, bulle ellipse, nuée (pensée), bandeau
 *   - SYMBOLES     : cœur, éclair, soleil, lune, nuage, sourire, écusson
 *   - BLOCS 3D     : cube, cylindre
 *
 * Personnalisation AVANT insertion (comme Word) :
 *   - couleur de REMPLISSAGE (palette Office + « sans remplissage »)
 *   - couleur et ÉPAISSEUR du CONTOUR (aucun / fin / moyen / épais)
 *   - taille d'insertion (petite / moyenne / grande)
 *
 * Insertion en SVG INLINE dans un span.ah-fig → la forme hérite de TOUS les
 * outils V13/V14 du RichTextEditor : redimensionnement (poignées + ±),
 * déplacement, habillage du texte, retrait. Rendu identique écran / PDF.
 * ============================================================================
 */

import { useEffect, useMemo, useState } from "react";
import { X, Check } from "lucide-react";

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── Palette de couleurs (teintes Office) ── */
const COLORS = [
  "#1e40af", "#2563eb", "#0891b2", "#0f766e", "#15803d", "#65a30d",
  "#b45309", "#dc2626", "#db2777", "#9333ea", "#475569", "#111827",
  "#f59e0b", "#10b981", "#ffffff",
];

/** Points d'un polygone régulier (étoile à n branches, inner/outer alternés). */
function starPoints(cx: number, cy: number, n: number, outer: number, inner: number, rot = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((rot + (180 / n) * i) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

/** Points d'un polygone régulier plein (n côtés). */
function polyPoints(cx: number, cy: number, n: number, r: number, rot = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((rot + (360 / n) * i) * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

type ShapeDef = {
  id: string;
  label: string;
  vb: [number, number];
  /** Corps SVG (remplissage = ${FILL}, contour = ${STROKE}, épaisseur = ${SW}). */
  body: string;
};

const SHAPES: ShapeDef[] = [
  /* ── BASES ── */
  { id: "rect", label: "Rectangle", vb: [120, 80], body: '<rect x="5" y="5" width="110" height="70" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "rect-arrondi", label: "Rectangle arrondi", vb: [120, 80], body: '<rect x="5" y="5" width="110" height="70" rx="16" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}"/>' },
  { id: "ellipse", label: "Ellipse", vb: [120, 80], body: '<ellipse cx="60" cy="40" rx="55" ry="35" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}"/>' },
  { id: "cercle", label: "Cercle", vb: [90, 90], body: '<circle cx="45" cy="45" r="40" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}"/>' },
  { id: "triangle", label: "Triangle", vb: [120, 90], body: '<polygon points="60,7 113,83 7,83" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "triangle-rectangle", label: "Triangle rectangle", vb: [120, 90], body: '<polygon points="9,81 9,9 111,81" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "losange", label: "Losange", vb: [120, 90], body: '<polygon points="60,5 115,45 60,85 5,45" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "parallelogramme", label: "Parallélogramme", vb: [120, 80], body: '<polygon points="32,7 115,7 88,73 5,73" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "trapeze", label: "Trapèze", vb: [120, 80], body: '<polygon points="36,7 84,7 114,73 6,73" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "pentagone", label: "Pentagone", vb: [90, 90], body: '<polygon points="' + polyPoints(45, 47, 5, 40) + '" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "hexagone", label: "Hexagone", vb: [90, 90], body: '<polygon points="' + polyPoints(45, 45, 41) + '" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "octogone", label: "Octogone", vb: [90, 90], body: '<polygon points="' + polyPoints(45, 45, 41, 41, -112.5) + '" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "croix", label: "Croix", vb: [120, 90], body: '<polygon points="46,5 74,5 74,31 115,31 115,59 74,59 74,85 46,85 46,59 5,59 5,31 46,31" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  /* ── FLÈCHES ── */
  { id: "fleche-droite", label: "Flèche droite", vb: [120, 90], body: '<polygon points="5,28 70,28 70,6 115,45 70,84 70,62 5,62" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "fleche-gauche", label: "Flèche gauche", vb: [120, 90], body: '<polygon points="115,28 50,28 50,6 5,45 50,84 50,62 115,62" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "fleche-haut", label: "Flèche haut", vb: [90, 120], body: '<polygon points="28,115 28,50 6,50 45,5 84,50 62,50 62,115" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "fleche-bas", label: "Flèche bas", vb: [90, 120], body: '<polygon points="28,5 28,70 6,70 45,115 84,70 62,70 62,5" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "fleche-double", label: "Double flèche", vb: [130, 90], body: '<polygon points="6,45 42,8 42,28 88,28 88,8 124,45 88,82 88,62 42,62 42,82" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "chevron", label: "Chevron", vb: [90, 90], body: '<polygon points="20,6 74,45 20,84 46,45" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  /* ── ÉTOILES ── */
  { id: "etoile5", label: "Étoile 5 branches", vb: [100, 100], body: '<polygon points="' + starPoints(50, 52, 5, 46, 18) + '" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "etoile6", label: "Étoile 6 branches", vb: [100, 100], body: '<polygon points="' + starPoints(50, 50, 6, 46, 21) + '" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "eclat12", label: "Éclat (12 branches)", vb: [100, 100], body: '<polygon points="' + starPoints(50, 50, 12, 47, 32) + '" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "sceau8", label: "Sceau (8 branches)", vb: [100, 100], body: '<polygon points="' + starPoints(50, 50, 8, 47, 27) + '" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  /* ── LÉGENDES ── */
  { id: "legende-rect", label: "Légende rectangle", vb: [120, 95], body: '<path d="M6,6 h108 v58 h-62 l-16,22 -2,-22 h-28 z" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "legende-ellipse", label: "Légende ellipse", vb: [120, 95], body: '<path d="M60,5 c31,0 56,15 56,33 0,18 -25,33 -56,33 -7,0 -14,-1 -20,-3 l-14,20 -2,-19 c-12,-6 -20,-17 -20,-31 0,-18 25,-33 56,-33 z" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "legende-nuee", label: "Bulle de pensée", vb: [120, 95], body: '<path d="M32,70 c-12,2 -22,-6 -22,-16 0,-9 7,-17 16,-18 -1,-3 -1,-5 -1,-8 0,-14 14,-25 33,-25 16,0 30,9 33,21 3,-1 6,-1 8,-1 13,0 23,9 23,20 0,10 -8,19 -19,21 1,2 1,3 1,5 0,9 -10,16 -22,16 -5,0 -9,-1 -13,-3 -5,3 -11,4 -17,4 -7,0 -14,-2 -20,-5 z M38,80 a5,5 0 1,0 0.1,0 z M26,91 a4,4 0 1,0 0.1,0 z" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "bandeau", label: "Bandeau", vb: [130, 80], body: '<polygon points="0,16 22,16 22,5 128,5 128,75 22,75 22,64 0,64 11,40" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  /* ── SYMBOLES ── */
  { id: "coeur", label: "Cœur", vb: [120, 90], body: '<path d="M60,82 C24,56 8,34 21,18 32,6 50,11 60,26 70,11 88,6 99,18 112,34 96,56 60,82 z" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "eclair", label: "Éclair", vb: [100, 100], body: '<polygon points="62,4 18,54 45,54 36,96 84,40 54,40 70,4" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "soleil", label: "Soleil", vb: [100, 100], body: '<g stroke="${STROKE}" stroke-width="${SW}" stroke-linecap="round"><line x1="50" y1="4" x2="50" y2="16"/><line x1="50" y1="84" x2="50" y2="96"/><line x1="4" y1="50" x2="16" y2="50"/><line x1="84" y1="50" x2="96" y2="50"/><line x1="17" y1="17" x2="26" y2="26"/><line x1="74" y1="74" x2="83" y2="83"/><line x1="83" y1="17" x2="74" y2="26"/><line x1="26" y1="74" x2="17" y2="83"/></g><circle cx="50" cy="50" r="24" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}"/>' },
  { id: "lune", label: "Lune", vb: [100, 100], body: '<path d="M62,6 a42,44 0 1,0 0,88 36,38 0 1,1 0,-88 z" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "nuage", label: "Nuage", vb: [120, 90], body: '<path d="M30,72 a18,18 0 0,1 -3,-36 a23,23 0 0,1 42,-8 a19,19 0 0,1 25,27 a15,15 0 0,1 -9,17 z" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "sourire", label: "Sourire", vb: [100, 100], body: '<circle cx="50" cy="50" r="44" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}"/><circle cx="35" cy="41" r="5" fill="${STROKE}" stroke="none"/><circle cx="65" cy="41" r="5" fill="${STROKE}" stroke="none"/><path d="M32,60 a22,20 0 0,0 36,0" fill="none" stroke="${STROKE}" stroke-width="${SW}" stroke-linecap="round"/>' },
  { id: "ecusson", label: "Écusson", vb: [100, 110], body: '<path d="M50,4 94,17 v36 c0,26 -20,39 -44,49 C26,92 6,79 6,53 V17 z" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  /* ── BLOCS 3D ── */
  { id: "cube", label: "Cube", vb: [110, 100], body: '<polygon points="8,32 55,8 102,32 102,76 55,98 8,76" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/><path d="M8,32 55,56 102,32 M55,56 v42" fill="none" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/>' },
  { id: "cylindre", label: "Cylindre", vb: [100, 110], body: '<path d="M10,20 a40,13 0 1,0 80,0 v70 a40,13 0 1,1 -80,0 z" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}" stroke-linejoin="round"/><ellipse cx="50" cy="20" rx="40" ry="13" fill="${FILL}" stroke="${STROKE}" stroke-width="${SW}"/>' },
];

const GROUPS: { id: string; label: string }[] = [
  { id: "bases", label: "Bases" },
  { id: "fleches", label: "Flèches" },
  { id: "etoiles", label: "Étoiles" },
  { id: "legendes", label: "Légendes" },
  { id: "symboles", label: "Symboles" },
  { id: "3d", label: "Blocs 3D" },
];

const SHAPE_GROUP: Record<string, string> = {
  rect: "bases", "rect-arrondi": "bases", ellipse: "bases", cercle: "bases", triangle: "bases",
  "triangle-rectangle": "bases", losange: "bases", parallelogramme: "bases", trapeze: "bases",
  pentagone: "bases", hexagone: "bases", octogone: "bases", croix: "bases",
  "fleche-droite": "fleches", "fleche-gauche": "fleches", "fleche-haut": "fleches",
  "fleche-bas": "fleches", "fleche-double": "fleches", chevron: "fleches",
  etoile5: "etoiles", etoile6: "etoiles", eclat12: "etoiles", sceau8: "etoiles",
  "legende-rect": "legendes", "legende-ellipse": "legendes", "legende-nuee": "legendes", bandeau: "legendes",
  coeur: "symboles", eclair: "symboles", soleil: "symboles", lune: "symboles",
  nuage: "symboles", sourire: "symboles", ecusson: "symboles",
  cube: "3d", cylindre: "3d",
};

/** Construit le SVG d'une forme avec les couleurs/contour choisis. */
function shapeSvg(def: ShapeDef, fill: string, stroke: string, sw: number): string {
  const FILL = fill === "none" ? "none" : fill;
  const STROKE = stroke === "none" ? (fill === "none" ? "#64748b" : fill) : stroke;
  const SW = stroke === "none" ? 0 : sw;
  const body = def.body.replace(/\$\{FILL\}/g, FILL).replace(/\$\{STROKE\}/g, STROKE).replace(/\$\{SW\}/g, String(SW));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${def.vb[0]} ${def.vb[1]}" ` +
    `style="width:100%;height:auto;display:block;" preserveAspectRatio="xMidYMid meet">${body}</svg>`
  );
}

export interface ShapesDialogProps {
  open: boolean;
  onClose: () => void;
  onInsertHtml: (html: string) => void;
}

export function ShapesDialog({ open, onClose, onInsertHtml }: ShapesDialogProps) {
  const [fill, setFill] = useState("#2563eb");
  const [stroke, setStroke] = useState("#1e3a8a");
  const [borderW, setBorderW] = useState(2);
  const [size, setSize] = useState(160);
  const [activeGroup, setActiveGroup] = useState<string>("all");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const shapes = useMemo(
    () => (activeGroup === "all" ? SHAPES : SHAPES.filter((s) => SHAPE_GROUP[s.id] === activeGroup)),
    [activeGroup],
  );

  if (!open) return null;

  const insert = (def: ShapeDef) => {
    const svg = shapeSvg(def, fill, stroke, borderW);
    const html =
      `<span class="ah-fig" data-shape="${def.id}" title="${esc(def.label)}" ` +
      `style="display:inline-block;max-width:100%;width:${size}px;">${svg}</span>&nbsp;`;
    onInsertHtml(html);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-5 h-5 rounded"
              style={{
                background: fill === "none" ? "transparent" : fill,
                border: `2px ${stroke === "none" ? "dashed #94a3b8" : "solid " + stroke}`,
              }}
            />
            <div>
              <div className="text-sm font-bold text-slate-800">Insérer une forme</div>
              <div className="text-[11px] text-slate-500">
                Formes comme dans Word — couleur, contour et taille au choix, redimensionnables après insertion
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500" title="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Personnalisation */}
        <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Remplissage</span>
            <div className="flex flex-wrap gap-1">
              {COLORS.map((c) => (
                <button
                  key={`f-${c}`}
                  type="button"
                  onClick={() => setFill(c)}
                  title={c}
                  className={`w-5 h-5 rounded border transition-transform ${fill === c ? "ring-2 ring-offset-1 ring-blue-500 scale-110" : "border-slate-300 hover:scale-105"}`}
                  style={{ background: c }}
                />
              ))}
              <button
                type="button"
                onClick={() => setFill("none")}
                title="Sans remplissage (forme vide)"
                className={`w-5 h-5 rounded border flex items-center justify-center text-[9px] font-bold ${fill === "none" ? "ring-2 ring-offset-1 ring-blue-500" : "border-slate-300 hover:scale-105"}`}
                style={{ background: "repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%) 50% / 8px 8px" }}
              >
                ∅
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Contour</span>
            <div className="flex flex-wrap gap-1">
              {COLORS.slice(0, 10).map((c) => (
                <button
                  key={`s-${c}`}
                  type="button"
                  onClick={() => setStroke(c)}
                  title={c}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${stroke === c ? "ring-2 ring-offset-1 ring-blue-500 scale-110" : "border-slate-300 hover:scale-105"}`}
                  style={{ background: c, borderColor: c }}
                />
              ))}
              <button
                type="button"
                onClick={() => setStroke("none")}
                title="Sans contour"
                className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold text-slate-500 ${stroke === "none" ? "ring-2 ring-offset-1 ring-blue-500" : "border-slate-300 hover:scale-105"}`}
                style={{ background: "repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%) 50% / 8px 8px" }}
              >
                ∅
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Épaisseur</span>
            <select
              value={borderW}
              onChange={(e) => setBorderW(Number(e.target.value))}
              className="px-1.5 py-1 text-[11px] border border-slate-200 rounded-md bg-white"
            >
              <option value={0}>Aucun</option>
              <option value={1}>Fin (1)</option>
              <option value={2}>Moyen (2)</option>
              <option value={3}>Épais (3)</option>
              <option value={5}>Très épais (5)</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Taille</span>
            <div className="flex gap-1">
              {[
                { v: 100, l: "Petite" },
                { v: 160, l: "Moyenne" },
                { v: 240, l: "Grande" },
              ].map((s) => (
                <button
                  key={s.v}
                  type="button"
                  onClick={() => setSize(s.v)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                    size === s.v
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Groupes */}
        <div className="flex border-b border-slate-200 bg-white overflow-x-auto">
          <button
            onClick={() => setActiveGroup("all")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeGroup === "all"
                ? "text-rose-600 border-rose-600 bg-rose-50/50"
                : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
            }`}
          >
            Toutes ({SHAPES.length})
          </button>
          {GROUPS.map((g) => {
            const count = SHAPES.filter((s) => SHAPE_GROUP[s.id] === g.id).length;
            return (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                  activeGroup === g.id
                    ? "text-rose-600 border-rose-600 bg-rose-50/50"
                    : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {g.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Grille des formes */}
        <div className="flex-1 overflow-y-auto p-3 bg-slate-100">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {shapes.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => insert(s)}
                title={`Insérer : ${s.label}`}
                className="group flex flex-col items-center justify-center gap-1 bg-white rounded-xl border border-slate-200 hover:border-rose-300 hover:shadow-md transition-all p-2 aspect-[4/3]"
              >
                <span
                  className="flex items-center justify-center max-h-[72%] max-w-[85%]"
                  style={{ width: "70%" }}
                  dangerouslySetInnerHTML={{ __html: shapeSvg(s, fill, stroke, borderW) }}
                />
                <span className="text-[9.5px] font-semibold text-slate-500 group-hover:text-slate-700 text-center leading-tight">
                  {s.label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            Cliquez sur une forme pour l&apos;insérer à la position du curseur — elle est ensuite
            redimensionnable, déplaçable et habillable comme dans Word.
          </p>
        </div>

        {/* Pied */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <span className="text-[11px] text-slate-500">
            {shapes.length} forme{shapes.length > 1 ? "s" : ""} — remplissage {fill === "none" ? "transparent" : fill}
            {stroke !== "none" ? `, contour ${borderW === 0 ? "aucun" : borderW}` : ", sans contour"}
          </span>
          <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-200">
            <Check className="h-4 w-4" /> Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
