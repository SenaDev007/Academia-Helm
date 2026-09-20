"use client";

/**
 * ============================================================================
 * DiagramEditorDialog — Éditeur de figures et diagrammes géométriques
 * ============================================================================
 *
 * ⭐ Demande utilisateur : « faire des diagrammes, des cercles… des
 *    illustrations de figures, de toutes sortes de figures géométriques »
 *
 * Éditeur SVG léger embarqué (aucune dépendance externe) :
 *   OUTILS   : sélection, cercle, rectangle, triangle, segment, flèche,
 *              angle (avec mesure automatique en degrés), texte, main levée
 *   ACTIONS  : déplacer (glisser), supprimer (touche Suppr / bouton),
 *              changer la couleur et l'épaisseur de la figure sélectionnée
 *   PRÉRÉGLAGES : cercle (O, r), triangle ABC, segment [AB], angle droit,
 *              rectangle L×l, carré — les figures classiques du primaire
 *              en un clic
 *   INSERTION : la figure est sérialisée en SVG inline et insérée à la
 *              position du curseur de l'éditeur (rendu écran + PDF identique)
 * ============================================================================
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X, MousePointer2, Circle, Square, Triangle, Minus, ArrowRight,
  DraftingCompass, Type, Pencil, Trash2, Palette, Check, Wand2, Hexagon, Spline,
} from "lucide-react";
import { toast } from "sonner";

const W = 760, H = 440, GRID = 20;

type Pt = { x: number; y: number };

type Shape =
  | { id: number; type: "circle"; cx: number; cy: number; r: number; stroke: string; sw: number; label?: string }
  | { id: number; type: "rect"; x: number; y: number; w: number; h: number; stroke: string; sw: number; label?: string }
  | { id: number; type: "triangle"; p1: Pt; p2: Pt; p3: Pt; stroke: string; sw: number; labels?: [string, string, string] }
  | { id: number; type: "polygon"; cx: number; cy: number; r: number; sides: number; rot: number; stroke: string; sw: number; dashed?: boolean }
  | { id: number; type: "arc"; cx: number; cy: number; r: number; a1: number; a2: number; stroke: string; sw: number }
  | { id: number; type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; dashed?: boolean }
  | { id: number; type: "arrow"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number }
  | { id: number; type: "angle"; v: Pt; b: Pt; stroke: string; sw: number; showDeg: boolean }
  | { id: number; type: "text"; x: number; y: number; label: string; size: number; color: string }
  | { id: number; type: "free"; pts: Pt[]; stroke: string; sw: number };

type Tool = "select" | "circle" | "rect" | "triangle" | "polygon" | "arc" | "line" | "arrow" | "angle" | "text" | "free";

const COLORS = ["#1d4ed8", "#dc2626", "#16a34a", "#7c3aed", "#0f172a"];
let nextId = 1;

/* ── Géométrie ── */
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
function angleDeg(v: Pt, b: Pt, a2: Pt): number {
  const d1 = Math.atan2(b.y - v.y, b.x - v.x);
  const d2 = Math.atan2(a2.y - v.y, a2.x - v.x);
  let d = Math.abs(d1 - d2) * 180 / Math.PI;
  if (d > 180) d = 360 - d;
  return Math.round(d);
}

export interface DiagramEditorDialogProps {
  open: boolean;
  onClose: () => void;
  onInsertHtml: (html: string) => void;
}

export function DiagramEditorDialog({ open, onClose, onInsertHtml }: DiagramEditorDialogProps) {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [tool, setTool] = useState<Tool>("circle");
  const [color, setColor] = useState(COLORS[0]);
  const [sw, setSw] = useState(2.5);
  const [polySides, setPolySides] = useState(6);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [freePts, setFreePts] = useState<Pt[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawStart = useRef<Pt | null>(null);
  const dragInfo = useRef<{ id: number; startPt: Pt; orig: Shape } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSelectedId(null); }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId !== null) {
        setShapes((s) => s.filter((x) => x.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selectedId]);

  const toCanvasPt = useCallback((e: React.PointerEvent | React.MouseEvent): Pt => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }, []);

  /* ── Création de figures ── */
  const onPointerDownCanvas = (e: React.PointerEvent) => {
    if (tool === "select") { setSelectedId(null); return; }
    const p = toCanvasPt(e);
    drawStart.current = p;
    if (tool === "free") setFreePts([p]);
    if (tool === "text") {
      const label = window.prompt("Texte à afficher (ex : A, B, rayon, 5 cm) :", "A");
      if (label && label.trim()) {
        setShapes((s) => [...s, { id: nextId++, type: "text", x: p.x, y: p.y, label: label.trim(), size: 16, color }]);
      }
      drawStart.current = null;
      return;
    }
  };

  const onPointerMoveCanvas = (e: React.PointerEvent) => {
    const p = toCanvasPt(e);
    // Déplacement d'une forme sélectionnée
    if (dragInfo.current) {
      const { id, startPt, orig } = dragInfo.current;
      const dx = p.x - startPt.x, dy = p.y - startPt.y;
      setShapes((s) => s.map((sh) => (sh.id === id ? translate(orig, dx, dy) : sh)));
      return;
    }
    // Aperçu de dessin
    const st = drawStart.current;
    if (!st) return;
    if (tool === "free") { setFreePts((pts) => [...pts, p]); return; }
    setDraft(buildShape(tool, st, p, color, sw, polySides));
  };

  const onPointerUpCanvas = () => {
    if (dragInfo.current) { dragInfo.current = null; return; }
    if (tool === "free" && freePts.length > 1) {
      setShapes((s) => [...s, { id: nextId++, type: "free", pts: freePts, stroke: color, sw }]);
      setFreePts([]);
      drawStart.current = null;
      return;
    }
    if (draft) {
      const d = draft;
      // ignore les micro-formes (clic accidentel)
      const big = sizeOf(d) > 12;
      if (big) setShapes((s) => [...s, d]);
      setDraft(null);
    }
    drawStart.current = null;
  };

  /* ── Déplacement des formes ── */
  const onPointerDownShape = (e: React.PointerEvent, sh: Shape) => {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelectedId(sh.id);
    dragInfo.current = { id: sh.id, startPt: toCanvasPt(e), orig: sh };
  };

  /* ── Sérialisation → SVG inline ── */
  const shapesToSvgString = (): string => {
    const body = shapes.map(shapeToSvg).join("\n");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="max-width:100%;height:auto;background:#ffffff;" role="img">
<rect width="${W}" height="${H}" fill="#ffffff"/>
${body}
</svg>`;
  };

  const insert = () => {
    if (shapes.length === 0) { toast.error("Dessinez d'abord une figure"); return; }
    const html = `<span class="ah-fig" contenteditable="false" data-diagram="1" title="Figure géométrique" style="display:block;max-width:100%;">${shapesToSvgString()}</span>&nbsp;`;
    onInsertHtml(html);
    onClose();
  };

  const applyPreset = (name: string) => {
    const cx = W / 2, cy = H / 2;
    const c = color;
    if (name === "cercle") {
      setShapes((s) => [
        ...s,
        { id: nextId++, type: "circle", cx: cx - 60, cy, r: 90, stroke: c, sw },
        { id: nextId++, type: "circle", cx: cx - 60, cy, r: 3, stroke: c, sw: 1 },
        { id: nextId++, type: "line", x1: cx - 60, y1: cy, x2: cx - 60 + 64, y2: cy - 64, stroke: "#dc2626", sw: 1.8 },
        { id: nextId++, type: "text", x: cx - 78, y: cy + 20, label: "O", size: 15, color: c },
        { id: nextId++, type: "text", x: cx - 40, y: cy - 42, label: "r", size: 14, color: "#dc2626" },
      ]);
    } else if (name === "triangle") {
      const p1 = { x: cx - 110, y: cy + 60 }, p2 = { x: cx - 10, y: cy - 80 }, p3 = { x: cx + 90, y: cy + 60 };
      setShapes((s) => [
        ...s,
        { id: nextId++, type: "triangle", p1, p2, p3, stroke: c, sw, labels: ["A", "B", "C"] },
      ]);
    } else if (name === "segment") {
      setShapes((s) => [
        ...s,
        { id: nextId++, type: "line", x1: cx - 120, y1: cy, x2: cx + 120, y2: cy, stroke: c, sw },
        { id: nextId++, type: "text", x: cx - 130, y: cy - 10, label: "A", size: 15, color: c },
        { id: nextId++, type: "text", x: cx + 122, y: cy - 10, label: "B", size: 15, color: c },
        { id: nextId++, type: "text", x: cx - 12, y: cy - 14, label: "c", size: 13, color: "#dc2626" },
      ]);
    } else if (name === "angledroit") {
      const v = { x: cx - 80, y: cy + 40 };
      setShapes((s) => [
        ...s,
        { id: nextId++, type: "line", x1: v.x, y1: v.y, x2: v.x + 160, y2: v.y, stroke: c, sw },
        { id: nextId++, type: "line", x1: v.x, y1: v.y, x2: v.x, y2: v.y - 120, stroke: c, sw },
        { id: nextId++, type: "rect", x: v.x, y: v.y - 22, w: 22, h: 22, stroke: c, sw: 2 },
        { id: nextId++, type: "text", x: v.x + 30, y: v.y - 30, label: "90°", size: 14, color: "#dc2626" },
      ]);
    } else if (name === "rectangle") {
      setShapes((s) => [
        ...s,
        { id: nextId++, type: "rect", x: cx - 120, y: cy - 70, w: 240, h: 140, stroke: c, sw, label: "" },
        { id: nextId++, type: "text", x: cx - 10, y: cy - 82, label: "L", size: 14, color: "#dc2626" },
        { id: nextId++, type: "text", x: cx - 136, y: cy + 4, label: "l", size: 14, color: "#dc2626" },
      ]);
    } else if (name === "carre") {
      setShapes((s) => [
        ...s,
        { id: nextId++, type: "rect", x: cx - 80, y: cy - 80, w: 160, h: 160, stroke: c, sw, label: "" },
        { id: nextId++, type: "text", x: cx - 10, y: cy - 92, label: "c", size: 14, color: "#dc2626" },
      ]);
    } else if (name === "pentagone") {
      setShapes((s) => [...s, { id: nextId++, type: "polygon", cx: cx - 40, cy, r: 85, sides: 5, rot: -90, stroke: c, sw }]);
    } else if (name === "hexagone") {
      setShapes((s) => [...s, { id: nextId++, type: "polygon", cx: cx - 40, cy, r: 80, sides: 6, rot: 0, stroke: c, sw }]);
    } else if (name === "octogone") {
      setShapes((s) => [...s, { id: nextId++, type: "polygon", cx: cx - 40, cy, r: 80, sides: 8, rot: 22.5, stroke: c, sw }]);
    } else if (name === "losange") {
      setShapes((s) => [
        ...s,
        { id: nextId++, type: "polygon", cx: cx - 40, cy, r: 90, sides: 4, rot: -90, stroke: c, sw },
        { id: nextId++, type: "line", x1: cx - 130, y1: cy, x2: cx + 50, y2: cy, stroke: "#94a3b8", sw: 1.5, dashed: true },
        { id: nextId++, type: "line", x1: cx - 40, y1: cy - 90, x2: cx - 40, y2: cy + 90, stroke: "#94a3b8", sw: 1.5, dashed: true },
      ]);
    } else if (name === "paralleles") {
      setShapes((s) => [
        ...s,
        { id: nextId++, type: "line", x1: cx - 140, y1: cy - 45, x2: cx + 60, y2: cy - 45, stroke: c, sw },
        { id: nextId++, type: "line", x1: cx - 140, y1: cy + 45, x2: cx + 60, y2: cy + 45, stroke: c, sw },
      ]);
    } else if (name === "perpendiculaires") {
      setShapes((s) => [
        ...s,
        { id: nextId++, type: "line", x1: cx - 140, y1: cy + 40, x2: cx + 60, y2: cy + 40, stroke: c, sw },
        { id: nextId++, type: "line", x1: cx - 40, y1: cy - 110, x2: cx - 40, y2: cy + 110, stroke: c, sw },
        { id: nextId++, type: "rect", x: cx - 40, y: cy + 18, w: 22, h: 22, stroke: c, sw: 1.6 },
      ]);
    } else if (name === "graduee") {
      const items: Shape[] = [
        { id: nextId++, type: "line", x1: cx - 220, y1: cy, x2: cx + 220, y2: cy, stroke: c, sw: 2 },
      ];
      for (let i = 0; i <= 10; i++) {
        const x = cx - 200 + i * 40;
        items.push({ id: nextId++, type: "line", x1: x, y1: cy - 10, x2: x, y2: cy + 10, stroke: c, sw: 2 });
        items.push({ id: nextId++, type: "text", x: x - 5, y: cy + 28, label: String(i), size: 13, color: "#0f172a" });
      }
      setShapes((s) => [...s, ...items]);
    }
  };

  if (!open) return null;

  const all = draft || freePts.length ? [...shapes, ...(draft ? [draft] : []), ...(freePts.length > 1 ? [{ id: -1, type: "free" as const, pts: freePts, stroke: color, sw }] : [])] : shapes;

  const TOOLS: [Tool, string, typeof Circle][] = [
    ["select", "Sélectionner / déplacer", MousePointer2],
    ["circle", "Cercle", Circle],
    ["rect", "Rectangle / carré", Square],
    ["triangle", "Triangle", Triangle],
    ["polygon", "Polygone régulier (n côtés)", Hexagon],
    ["arc", "Arc de cercle", Spline],
    ["line", "Segment / droite", Minus],
    ["arrow", "Flèche", ArrowRight],
    ["angle", "Angle (avec mesure)", DraftingCompass],
    ["text", "Texte / étiquette", Type],
    ["free", "Main levée", Pencil],
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <DraftingCompass className="h-5 w-5 text-purple-600" />
            <div>
              <div className="text-sm font-bold text-slate-800">Éditeur de figures géométriques</div>
              <div className="text-[11px] text-slate-500">Dessinez la figure, puis cliquez sur « Insérer la figure »</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500" title="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Barre d'outils */}
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-slate-200 bg-white">
          {TOOLS.map(([t, title, Icon]) => (
            <button
              key={t}
              title={title}
              onClick={() => { setTool(t); setSelectedId(null); }}
              className={`p-2 rounded-lg border transition-colors ${
                tool === t ? "bg-purple-100 border-purple-400 text-purple-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <div className="w-px h-6 bg-slate-200 mx-1" />
          {/* Couleurs */}
          <Palette className="h-3.5 w-3.5 text-slate-400 mr-0.5" />
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                if (selectedId !== null) setShapes((s) => s.map((sh) => (sh.id === selectedId ? ({ ...sh, stroke: c } as Shape) : sh)));
              }}
              className={`h-5 w-5 rounded-full border-2 ${color === c ? "border-slate-800" : "border-white"} shadow-sm`}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          <div className="w-px h-6 bg-slate-200 mx-1" />
          {/* Épaisseur */}
          {[1.5, 2.5, 4].map((wv) => (
            <button
              key={wv}
              onClick={() => { setSw(wv); if (selectedId !== null) setShapes((s) => s.map((sh) => (sh.id === selectedId ? ({ ...sh, sw: wv } as Shape) : sh))); }}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${sw === wv ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              {wv}
            </button>
          ))}
          {/* Nombre de côtés du polygone */}
          {tool === "polygon" && (
            <div className="flex items-center gap-1 ml-1">
              <span className="text-[10px] font-bold text-slate-500">côtés</span>
              {[3, 4, 5, 6, 8, 10, 12].map((n) => (
                <button
                  key={n}
                  onClick={() => setPolySides(n)}
                  className={`px-1.5 py-1 rounded-lg text-[10px] font-bold border ${
                    polySides === n ? "bg-purple-600 text-white border-purple-600" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <button
            onClick={() => { setShapes((s) => s.filter((x) => x.id !== selectedId)); setSelectedId(null); }}
            disabled={selectedId === null}
            className="p-2 rounded-lg border border-slate-200 text-red-500 hover:bg-red-50 disabled:opacity-30"
            title="Supprimer la forme sélectionnée (ou touche Suppr)"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setShapes([]); setSelectedId(null); }}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-100 border border-slate-200"
            title="Effacer tout"
          >
            Tout effacer
          </button>
        </div>

        {/* Préréglages */}
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-b border-slate-100 bg-purple-50/40">
          <span className="text-[10px] font-bold text-purple-700 flex items-center gap-1 mr-1">
            <Wand2 className="h-3 w-3" /> Figures rapides :
          </span>
          {[
            ["cercle", "Cercle (O, r)"],
            ["triangle", "Triangle ABC"],
            ["segment", "Segment [AB]"],
            ["angledroit", "Angle droit"],
            ["rectangle", "Rectangle L × l"],
            ["carre", "Carré c"],
            ["pentagone", "Pentagone"],
            ["hexagone", "Hexagone"],
            ["octogone", "Octogone"],
            ["losange", "Losange + diagonales"],
            ["paralleles", "Parallèles"],
            ["perpendiculaires", "Perpendiculaires"],
            ["graduee", "Droite graduée"],
          ].map(([k, label]) => (
            <button key={k} onClick={() => applyPreset(k)} className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-white border border-purple-200 text-purple-700 hover:bg-purple-100">
              {label}
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-slate-100 p-3">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full bg-white rounded-xl border border-slate-200 shadow-inner touch-none select-none"
            style={{ cursor: tool === "select" ? "default" : "crosshair" }}
            onPointerDown={onPointerDownCanvas}
            onPointerMove={onPointerMoveCanvas}
            onPointerUp={onPointerUpCanvas}
            onPointerLeave={onPointerUpCanvas}
          >
            <defs>
              <pattern id="dia-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#e2e8f0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#dia-grid)" />
            {all.map((sh) => renderShape(sh, sh.id === selectedId, (e) => onPointerDownShape(e, sh)))}
          </svg>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            {tool === "select"
              ? "Cliquez sur une forme pour la sélectionner, puis faites-la glisser pour la déplacer — Suppr pour supprimer"
              : "Maintenez le bouton enfoncé sur la feuille pour tracer la figure"}
          </p>
        </div>

        {/* Pied */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <span className="text-[11px] text-slate-500">{shapes.length} forme(s)</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-200">
              Annuler
            </button>
            <button
              onClick={insert}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700"
            >
              <Check className="h-4 w-4" /> Insérer la figure
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ Helpers formes ═══════════════════ */

/** Sommets d'un polygone régulier (angles en degrés, convention math). */
function polygonPts(cx: number, cy: number, r: number, sides: number, rot: number): Pt[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = ((rot + (360 / sides) * i) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  });
}

function arcD(cx: number, cy: number, r: number, a1: number, a2: number): string {
  const p = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  };
  const p1 = p(a1), p2 = p(a2);
  const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
  return `M ${r2(p1.x)} ${r2(p1.y)} A ${r2(r)} ${r2(r)} 0 ${large} 0 ${r2(p2.x)} ${r2(p2.y)}`;
}

function buildShape(tool: Tool, st: Pt, p: Pt, color: string, sw: number, polySides: number): Shape | null {
  const base = { id: -1, stroke: color, sw };
  switch (tool) {
    case "circle": {
      const r = dist(st, p);
      return { ...base, type: "circle", cx: st.x, cy: st.y, r };
    }
    case "rect": {
      const x = Math.min(st.x, p.x), y = Math.min(st.y, p.y);
      return { ...base, type: "rect", x, y, w: Math.abs(p.x - st.x), h: Math.abs(p.y - st.y) };
    }
    case "triangle": {
      const x = Math.min(st.x, p.x), y = Math.min(st.y, p.y);
      const w = Math.abs(p.x - st.x), h = Math.abs(p.y - st.y);
      return { ...base, type: "triangle", p1: { x, y: y + h }, p2: { x: x + w / 2, y }, p3: { x: x + w, y: y + h } };
    }
    case "line":
      return { ...base, type: "line", x1: st.x, y1: st.y, x2: p.x, y2: p.y };
    case "arrow":
      return { ...base, type: "arrow", x1: st.x, y1: st.y, x2: p.x, y2: p.y };
    case "polygon": {
      // centre = point de départ, rayon = distance, rotation vers le curseur
      const r = dist(st, p);
      const rot = (Math.atan2(-(p.y - st.y), p.x - st.x) * 180) / Math.PI;
      return { ...base, type: "polygon", cx: st.x, cy: st.y, r, sides: polySides, rot };
    }
    case "arc": {
      // centre = point de départ ; l'arc va de l'angle horizontal vers le curseur
      const r = dist(st, p);
      const a = (Math.atan2(-(p.y - st.y), p.x - st.x) * 180) / Math.PI;
      const a1 = Math.min(0, a);
      const a2 = Math.max(0, a);
      return { ...base, type: "arc", cx: st.x, cy: st.y, r, a1, a2 };
    }
    case "angle": {
      // Sommet = point de départ ; 1er bras horizontal, 2e bras vers le curseur
      return { ...base, type: "angle", v: st, b: { x: st.x + Math.max(60, Math.abs(p.x - st.x)), y: st.y }, showDeg: true };
    }
    default:
      return null;
  }
}

function sizeOf(s: Shape): number {
  switch (s.type) {
    case "circle": return s.r * 2;
    case "rect": return Math.max(s.w, s.h);
    case "triangle": return Math.max(dist(s.p1, s.p2), dist(s.p2, s.p3));
    case "polygon": return s.r * 2;
    case "arc": return s.r;
    case "line": case "arrow": return Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    case "angle": return dist(s.v, s.b);
    case "text": return 999;
    case "free": return 999;
  }
}

function translate(s: Shape, dx: number, dy: number): Shape {
  switch (s.type) {
    case "circle": return { ...s, cx: s.cx + dx, cy: s.cy + dy };
    case "rect": return { ...s, x: s.x + dx, y: s.y + dy };
    case "triangle": return { ...s, p1: mv(s.p1, dx, dy), p2: mv(s.p2, dx, dy), p3: mv(s.p3, dx, dy) };
    case "polygon": return { ...s, cx: s.cx + dx, cy: s.cy + dy };
    case "arc": return { ...s, cx: s.cx + dx, cy: s.cy + dy };
    case "line": case "arrow": return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy };
    case "angle": return { ...s, v: mv(s.v, dx, dy), b: mv(s.b, dx, dy) };
    case "text": return { ...s, x: s.x + dx, y: s.y + dy };
    case "free": return { ...s, pts: s.pts.map((p) => mv(p, dx, dy)) };
  }
}
const mv = (p: Pt, dx: number, dy: number): Pt => ({ x: p.x + dx, y: p.y + dy });

/** Rendu React d'une forme (+ halo de sélection + gestion du drag). */
function renderShape(s: Shape, selected: boolean, onDown: (e: React.PointerEvent) => void): React.ReactNode {
  const hit = {
    onPointerDown: onDown,
    style: { cursor: "move" } as React.CSSProperties,
  };
  const sel = selected ? "#0ea5e9" : undefined;
  const key = s.id;

  switch (s.type) {
    case "circle":
      return (
        <g key={key} {...hit}>
          {selected && <circle cx={s.cx} cy={s.cy} r={s.r + 6} fill="none" stroke={sel} strokeWidth="1" strokeDasharray="4 3" />}
          <circle cx={s.cx} cy={s.cy} r={s.r} fill="none" stroke={s.stroke} strokeWidth={s.sw} />
          {s.label && <text x={s.cx} y={s.cy + 4} textAnchor="middle" fontSize="14" fill={s.stroke} fontFamily="Arial">{s.label}</text>}
        </g>
      );
    case "rect":
      return (
        <g key={key} {...hit}>
          {selected && <rect x={s.x - 6} y={s.y - 6} width={s.w + 12} height={s.h + 12} fill="none" stroke={sel} strokeWidth="1" strokeDasharray="4 3" />}
          <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="none" stroke={s.stroke} strokeWidth={s.sw} />
        </g>
      );
    case "triangle": {
      const pts = `${s.p1.x},${s.p1.y} ${s.p2.x},${s.p2.y} ${s.p3.x},${s.p3.y}`;
      return (
        <g key={key} {...hit}>
          {selected && <polygon points={pts} fill="none" stroke={sel} strokeWidth="1" strokeDasharray="4 3" transform="translate(0,0)" />}
          <polygon points={pts} fill="none" stroke={s.stroke} strokeWidth={s.sw} />
          {s.labels?.map((l, i) => {
            const p = [s.p1, s.p2, s.p3][i];
            const off = [
              { x: -14, y: 16 },
              { x: 0, y: -10 },
              { x: 10, y: 16 },
            ][i];
            return <text key={i} x={p.x + off.x} y={p.y + off.y} fontSize="15" fill={s.stroke} fontFamily="Arial" fontWeight="bold">{l}</text>;
          })}
        </g>
      );
    }
    case "polygon": {
      const pts = polygonPts(s.cx, s.cy, s.r, s.sides, s.rot).map((p) => `${r2(p.x)},${r2(p.y)}`).join(" ");
      return (
        <g key={key} {...hit}>
          {selected && <circle cx={s.cx} cy={s.cy} r={s.r + 6} fill="none" stroke={sel} strokeWidth="1" strokeDasharray="4 3" />}
          <polygon points={pts} fill="none" stroke={s.stroke} strokeWidth={s.sw} />
        </g>
      );
    }
    case "arc": {
      const d = arcD(s.cx, s.cy, s.r, s.a1, s.a2);
      return (
        <g key={key} {...hit}>
          {selected && <circle cx={s.cx} cy={s.cy} r={s.r + 6} fill="none" stroke={sel} strokeWidth="1" strokeDasharray="4 3" />}
          <path d={d} fill="none" stroke={s.stroke} strokeWidth={s.sw} strokeLinecap="round" />
          <circle cx={s.cx} cy={s.cy} r="2.5" fill={s.stroke} />
        </g>
      );
    }
    case "line":
      return (
        <g key={key} {...hit}>
          {selected && <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={sel} strokeWidth={s.sw + 8} opacity="0.25" />}
          <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.sw} strokeDasharray={s.dashed ? "6 4" : undefined} />
        </g>
      );
    case "arrow": {
      const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const hx = s.x2 - 12 * Math.cos(ang), hy = s.y2 - 12 * Math.sin(ang);
      const wing = (d: number) => `${hx + 8 * Math.cos(ang + d)},${hy + 8 * Math.sin(ang + d)}`;
      return (
        <g key={key} {...hit}>
          {selected && <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={sel} strokeWidth={s.sw + 8} opacity="0.25" />}
          <line x1={s.x1} y1={s.y1} x2={hx} y2={hy} stroke={s.stroke} strokeWidth={s.sw} />
          <polygon points={`${s.x2},${s.y2} ${wing(2.5)} ${wing(-2.5)}`} fill={s.stroke} />
        </g>
      );
    }
    case "angle": {
      // 2e bras : conservé dans le champ b uniquement pour le drag ; pour
      // l'aperçu on stocke la direction dans b : bras 2 = miroir simple.
      // (l'angle réel à deux bras est créé par deux segments + arc)
      return (
        <g key={key} {...hit}>
          <AngleView v={s.v} b={s.b} stroke={s.stroke} sw={s.sw} showDeg={s.showDeg} selected={selected} />
        </g>
      );
    }
    case "text":
      return (
        <text
          key={key}
          x={s.x}
          y={s.y}
          fontSize={s.size}
          fill={s.color}
          fontFamily="Arial"
          fontWeight="600"
          style={{ cursor: "move" }}
          onPointerDown={onDown}
        >
          {s.label}
        </text>
      );
    case "free": {
      const pts = s.pts.map((p) => `${p.x},${p.y}`).join(" ");
      return (
        <polyline key={key} points={pts} fill="none" stroke={s.stroke} strokeWidth={s.sw} strokeLinecap="round" strokeLinejoin="round" style={{ cursor: "move" }} onPointerDown={onDown} />
      );
    }
    default:
      return null;
  }
}

/** Vue d'un angle : sommet + bras horizontal + arc + degrés (le 2e bras est vertical par défaut). */
function AngleView({ v, b, stroke, sw, showDeg, selected }: { v: Pt; b: Pt; stroke: string; sw: number; showDeg: boolean; selected: boolean }) {
  const a2 = { x: v.x, y: v.y - (b.x - v.x) };
  const deg = angleDeg(v, b, a2);
  const r = Math.min(30, dist(v, b) * 0.35);
  const start = 0;
  const end = -deg;
  const largeArc = 0;
  const arcEnd = { x: v.x + r * Math.cos((end * Math.PI) / 180), y: v.y + r * Math.sin((end * Math.PI) / 180) };
  return (
    <>
      {selected && <circle cx={v.x} cy={v.y} r={r + 12} fill="none" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="4 3" />}
      <line x1={v.x} y1={v.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={sw} />
      <line x1={v.x} y1={v.y} x2={a2.x} y2={a2.y} stroke={stroke} strokeWidth={sw} />
      <path d={`M ${v.x + r} ${v.y} A ${r} ${r} 0 ${largeArc} 0 ${arcEnd.x} ${arcEnd.y}`} fill="none" stroke="#dc2626" strokeWidth="2" />
      {showDeg && (
        <text x={v.x + r + 14} y={v.y - r - 2} fontSize="13" fill="#dc2626" fontFamily="Arial" fontWeight="bold">
          {deg}°
        </text>
      )}
      <circle cx={v.x} cy={v.y} r="3" fill={stroke} />
    </>
  );
}

/** Sérialisation d'une forme en markup SVG (pour l'insertion dans l'éditeur). */
function shapeToSvg(s: Shape): string {
  switch (s.type) {
    case "circle":
      return `<circle cx="${r2(s.cx)}" cy="${r2(s.cy)}" r="${r2(s.r)}" fill="none" stroke="${s.stroke}" stroke-width="${s.sw}"/>` +
        (s.label ? `<text x="${r2(s.cx)}" y="${r2(s.cy + 4)}" text-anchor="middle" font-size="14" fill="${s.stroke}" font-family="Arial">${esc(s.label)}</text>` : "");
    case "rect":
      return `<rect x="${r2(s.x)}" y="${r2(s.y)}" width="${r2(s.w)}" height="${r2(s.h)}" fill="none" stroke="${s.stroke}" stroke-width="${s.sw}"/>`;
    case "triangle": {
      const pts = `${r2(s.p1.x)},${r2(s.p1.y)} ${r2(s.p2.x)},${r2(s.p2.y)} ${r2(s.p3.x)},${r2(s.p3.y)}`;
      const labels = s.labels
        ? s.labels.map((l, i) => {
          const p = [s.p1, s.p2, s.p3][i];
          const off = [{ x: -14, y: 16 }, { x: 0, y: -10 }, { x: 10, y: 16 }][i];
          return `<text x="${r2(p.x + off.x)}" y="${r2(p.y + off.y)}" font-size="15" font-weight="bold" fill="${s.stroke}" font-family="Arial">${esc(l)}</text>`;
        }).join("")
        : "";
      return `<polygon points="${pts}" fill="none" stroke="${s.stroke}" stroke-width="${s.sw}"/>${labels}`;
    }
    case "line":
      return `<line x1="${r2(s.x1)}" y1="${r2(s.y1)}" x2="${r2(s.x2)}" y2="${r2(s.y2)}" stroke="${s.stroke}" stroke-width="${s.sw}"${s.dashed ? ' stroke-dasharray="6 4"' : ""}/>`;
    case "arrow": {
      const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const hx = s.x2 - 12 * Math.cos(ang), hy = s.y2 - 12 * Math.sin(ang);
      const w1 = `${r2(hx + 8 * Math.cos(ang + 2.5))},${r2(hy + 8 * Math.sin(ang + 2.5))}`;
      const w2 = `${r2(hx + 8 * Math.cos(ang - 2.5))},${r2(hy + 8 * Math.sin(ang - 2.5))}`;
      return `<line x1="${r2(s.x1)}" y1="${r2(s.y1)}" x2="${r2(hx)}" y2="${r2(hy)}" stroke="${s.stroke}" stroke-width="${s.sw}"/>` +
        `<polygon points="${r2(s.x2)},${r2(s.y2)} ${w1} ${w2}" fill="${s.stroke}"/>`;
    }
    case "angle": {
      const a2 = { x: s.v.x, y: s.v.y - (s.b.x - s.v.x) };
      const deg = angleDeg(s.v, s.b, a2);
      const rr = Math.min(30, dist(s.v, s.b) * 0.35);
      const arcEnd = { x: s.v.x + rr * Math.cos((-deg * Math.PI) / 180), y: s.v.y + rr * Math.sin((-deg * Math.PI) / 180) };
      return `<line x1="${r2(s.v.x)}" y1="${r2(s.v.y)}" x2="${r2(s.b.x)}" y2="${r2(s.b.y)}" stroke="${s.stroke}" stroke-width="${s.sw}"/>` +
        `<line x1="${r2(s.v.x)}" y1="${r2(s.v.y)}" x2="${r2(a2.x)}" y2="${r2(a2.y)}" stroke="${s.stroke}" stroke-width="${s.sw}"/>` +
        `<path d="M ${r2(s.v.x + rr)} ${r2(s.v.y)} A ${r2(rr)} ${r2(rr)} 0 0 0 ${r2(arcEnd.x)} ${r2(arcEnd.y)}" fill="none" stroke="#dc2626" stroke-width="2"/>` +
        (s.showDeg ? `<text x="${r2(s.v.x + rr + 14)}" y="${r2(s.v.y - rr - 2)}" font-size="13" font-weight="bold" fill="#dc2626" font-family="Arial">${deg}°</text>` : "") +
        `<circle cx="${r2(s.v.x)}" cy="${r2(s.v.y)}" r="3" fill="${s.stroke}"/>`;
    }
    case "polygon": {
      const pts = polygonPts(s.cx, s.cy, s.r, s.sides, s.rot).map((p) => `${r2(p.x)},${r2(p.y)}`).join(" ");
      return `<polygon points="${pts}" fill="none" stroke="${s.stroke}" stroke-width="${s.sw}"/>`;
    }
    case "arc": {
      return `<path d="${arcD(s.cx, s.cy, s.r, s.a1, s.a2)}" fill="none" stroke="${s.stroke}" stroke-width="${s.sw}" stroke-linecap="round"/>` +
        `<circle cx="${r2(s.cx)}" cy="${r2(s.cy)}" r="2.5" fill="${s.stroke}"/>`;
    }
    case "text":
      return `<text x="${r2(s.x)}" y="${r2(s.y)}" font-size="${s.size}" fill="${s.color}" font-family="Arial" font-weight="600">${esc(s.label)}</text>`;
    case "free": {
      const pts = s.pts.map((p) => `${r2(p.x)},${r2(p.y)}`).join(" ");
      return `<polyline points="${pts}" fill="none" stroke="${s.stroke}" stroke-width="${s.sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    default:
      return "";
  }
}

const r2 = (n: number) => Math.round(n * 10) / 10;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
