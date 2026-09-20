"use client";

/**
 * ============================================================================
 * GraphChartDialog — Graphiques, repères et diagrammes professionnels
 * ============================================================================
 *
 * ⭐ Demande utilisateur : « Il faut qu'il puisse faire des tracés vraiment
 *    professionnels : des tracés de graphiques, des repères, la
 *    proportionnalité, des diagrammes circulaires, des histogrammes, tous les
 *    types de diagrammes possibles. »
 *
 * 5 onglets :
 *   1. REPÈRE & POINTS  — repère orthogonal interactif : clic pour placer des
 *      points (aimantés à la grille), table de valeurs couplée, droite/ligne
 *      brisée, préréglage de proportionnalité (y = 2x, y = 3x…)
 *   2. BÂTONS           — diagramme en bâtons (effectifs) avec éditeur de données
 *   3. CIRCULAIRE       — diagramme circulaire (parts en % + légende)
 *   4. HISTOGRAMME      — histogramme (classes contiguës)
 *   5. COURBE           — courbe d'évolution (températures, croissances…)
 *
 * L'aperçu est construit avec les MÊMES fonctions que l'insertion → WYSIWYG
 * garanti. Insertion en SVG inline (écran + export PDF identiques).
 * ============================================================================
 */

import { useMemo, useState } from "react";
import {
  X, LineChart, BarChart3, PieChart, TrendingUp, Plus, Trash2, Check,
  MousePointerClick, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import {
  repereGeometry, buildRepereSvg, buildBarSvg, buildPieSvg, buildHistoSvg, buildLineSvg,
  type RepPoint, type RepereConfig, type DataRow,
} from "@/lib/chart-builders";

/** Échappe une valeur pour un attribut HTML. */
const esc = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ═══════════════ Composant ═══════════════ */

type Tab = "repere" | "batons" | "circulaire" | "histogramme" | "courbe";

export interface GraphChartDialogProps {
  open: boolean;
  onClose: () => void;
  onInsertHtml: (html: string) => void;
}

export function GraphChartDialog({ open, onClose, onInsertHtml }: GraphChartDialogProps) {
  const [tab, setTab] = useState<Tab>("repere");

  // ── état repère ──
  const [points, setPoints] = useState<RepPoint[]>([
    { x: 0, y: 0, label: "A" }, { x: 1, y: 2, label: "B" }, { x: 2, y: 4, label: "C" },
    { x: 3, y: 6, label: "D" }, { x: 4, y: 8, label: "E" },
  ]);
  const [xmax, setXmax] = useState(8);
  const [ymax, setYmax] = useState(10);
  const [connect, setConnect] = useState(false);
  const [showLine, setShowLine] = useState(true);
  const [repTitle, setRepTitle] = useState("y = 2x — situation de proportionnalité");

  // ── état données (bâtons / circulaire / histogramme / courbe) ──
  const [rows, setRows] = useState<DataRow[]>([
    { label: "Lundi", value: 22 }, { label: "Mardi", value: 24 }, { label: "Mercredi", value: 21 },
    { label: "Jeudi", value: 25 }, { label: "Vendredi", value: 28 },
  ]);
  const [title, setTitle] = useState("Titre du graphique");
  const [colors, setColors] = useState(true);

  const repereSvg = useMemo(
    () => buildRepereSvg({ points, xmax, ymax, connect, line: showLine, title: repTitle }),
    [points, xmax, ymax, connect, showLine, repTitle],
  );
  const dataSvg = useMemo(() => {
    if (tab === "batons") return buildBarSvg(rows, title, colors);
    if (tab === "circulaire") return buildPieSvg(rows, title);
    if (tab === "histogramme") return buildHistoSvg(rows, title);
    return buildLineSvg(rows, title);
  }, [tab, rows, title, colors]);

  if (!open) return null;

  const insert = () => {
    const svg = tab === "repere" ? repereSvg : dataSvg;
    if (tab === "repere" && points.length === 0) { toast.error("Placez d'abord des points dans le repère"); return; }
    const dataAttr = tab === "repere" ? "graph" : "chart";
    const html = `<span class="ah-fig" contenteditable="false" data-${dataAttr}="1" title="${esc(title || repTitle)}" style="display:block;max-width:100%;">${svg}</span>&nbsp;`;
    onInsertHtml(html);
    onClose();
  };

  /* clic dans le repère → point aimanté */
  const onRepClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const svg = (e.currentTarget.querySelector("svg") as SVGSVGElement | null);
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const geo = repereGeometry({ xmax, ymax, title: repTitle });
    const x = ((e.clientX - rect.left) / rect.width) * geo.W;
    const y = ((e.clientY - rect.top) / rect.height) * geo.H;
    const gxv = Math.round((x - geo.x0) / geo.unit);
    const gyv = Math.round((geo.y0 - y) / geo.unit);
    if (gxv < 0 || gxv > xmax || gyv < 0 || gyv > ymax) return;
    setPoints((ps) => {
      if (ps.some((p) => p.x === gxv && p.y === gyv)) return ps; // déjà un point ici
      const label = nextLabel(ps);
      return [...ps, { x: gxv, y: gyv, label }];
    });
  };

  const nextLabel = (ps: RepPoint[]) => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const l of letters) if (!ps.some((p) => p.label === l)) return l;
    return "P" + ps.length;
  };

  const presetProp = (k: number) => {
    const ps: RepPoint[] = [];
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let x = 0; x * k <= Math.max(ymax, 6) && x <= 6; x++) {
      ps.push({ x, y: x * k, label: letters[x] });
    }
    setPoints(ps);
    setShowLine(true);
    setConnect(false);
    setXmax(Math.max(8, 6));
    setYmax(Math.max(10, 6 * k));
    setRepTitle(`y = ${k}x — situation de proportionnalité`);
  };

  const TABS: [Tab, string, typeof LineChart][] = [
    ["repere", "Repère & points", MousePointerClick],
    ["batons", "Bâtons", BarChart3],
    ["circulaire", "Circulaire", PieChart],
    ["histogramme", "Histogramme", TrendingUp],
    ["courbe", "Courbe", LineChart],
  ];

  const preview = tab === "repere" ? repereSvg : dataSvg;
  const geo = repereGeometry({ xmax, ymax, title: repTitle });
  const vbW = tab === "repere" ? geo.W : 640;
  const vbH = tab === "repere" ? geo.H : tab === "circulaire" ? 400 : 420;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-teal-600" />
            <div>
              <div className="text-sm font-bold text-slate-800">Graphiques & diagrammes</div>
              <div className="text-[11px] text-slate-500">Repères, proportionnalité, bâtons, circulaires, histogrammes, courbes</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500" title="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-slate-200 bg-white overflow-x-auto">
          {TABS.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                if (id === "circulaire") {
                  setRows([
                    { label: "Sport", value: 12 }, { label: "Lecture", value: 7 },
                    { label: "Jeux", value: 15 }, { label: "Musique", value: 6 },
                  ]);
                  setTitle("Loisirs préférés de la classe");
                } else if (id === "histogramme") {
                  setRows([
                    { label: "[0 ; 10[", value: 3 }, { label: "[10 ; 20[", value: 7 },
                    { label: "[20 ; 30[", value: 12 }, { label: "[30 ; 40[", value: 5 },
                  ]);
                  setTitle("Notes du contrôle (effectifs)");
                } else if (id === "batons") {
                  setRows([
                    { label: "Chien", value: 12 }, { label: "Chat", value: 9 },
                    { label: "Oiseau", value: 5 }, { label: "Poisson", value: 3 },
                  ]);
                  setTitle("Animaux préférés de la classe");
                } else if (id === "courbe") {
                  setRows([
                    { label: "Lun", value: 22 }, { label: "Mar", value: 24 }, { label: "Mer", value: 21 },
                    { label: "Jeu", value: 25 }, { label: "Ven", value: 28 }, { label: "Sam", value: 26 },
                    { label: "Dim", value: 23 },
                  ]);
                  setTitle("Températures de la semaine (°C)");
                }
              }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                tab === id
                  ? "text-teal-600 border-teal-600 bg-teal-50/50"
                  : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Corps : panneau d'édition + aperçu */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col lg:flex-row">
            {/* Panneau d'édition */}
            <div className="lg:w-[340px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 p-3 space-y-3">
              {tab === "repere" ? (
                <>
                  <div className="text-[11px] text-slate-500 leading-relaxed bg-teal-50/60 border border-teal-100 rounded-lg p-2">
                    Cliquez dans le repère pour placer un point (aimanté à la grille).
                    Les coordonnées sont modifiables dans la table de valeurs.
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] font-bold text-slate-600">
                      Max axe x
                      <input type="number" min={4} max={30} value={xmax}
                        onChange={(e) => setXmax(Math.max(4, Math.min(30, Number(e.target.value) || 8)))}
                        className="w-full mt-0.5 px-2 py-1 text-xs border border-slate-200 rounded-md" />
                    </label>
                    <label className="text-[10px] font-bold text-slate-600">
                      Max axe y
                      <input type="number" min={4} max={30} value={ymax}
                        onChange={(e) => setYmax(Math.max(4, Math.min(30, Number(e.target.value) || 10)))}
                        className="w-full mt-0.5 px-2 py-1 text-xs border border-slate-200 rounded-md" />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setShowLine((v) => !v)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${showLine ? "bg-blue-100 border-blue-300 text-blue-700" : "border-slate-200 text-slate-500"}`}>
                      Droite (2 premiers points)
                    </button>
                    <button onClick={() => setConnect((v) => !v)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${connect ? "bg-blue-100 border-blue-300 text-blue-700" : "border-slate-200 text-slate-500"}`}>
                      Ligne brisée
                    </button>
                    <button onClick={() => setPoints([])}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold border border-slate-200 text-slate-500 hover:bg-slate-50">
                      Vider les points
                    </button>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-600 mb-1">Préréglages de proportionnalité</div>
                    <div className="flex flex-wrap gap-1.5">
                      {[2, 3, 5].map((k) => (
                        <button key={k} onClick={() => presetProp(k)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white border border-teal-200 text-teal-700 hover:bg-teal-50">
                          y = {k}x
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Table de valeurs */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[10px] font-bold text-slate-600">Table de valeurs</div>
                      <button
                        onClick={() => setPoints((ps) => [...ps, { x: 0, y: 0, label: nextLabel(ps) }])}
                        className="flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:underline">
                        <Plus className="h-3 w-3" /> Point
                      </button>
                    </div>
                    <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {points.map((p, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1">
                          <span className="text-[10px] font-bold text-red-600 w-4">{p.label}</span>
                          <span className="text-[10px] text-slate-400">x</span>
                          <input type="number" value={p.x}
                            onChange={(e) => updatePoint(i, "x", e.target.value)}
                            className="w-14 px-1.5 py-0.5 text-[11px] border border-slate-200 rounded" />
                          <span className="text-[10px] text-slate-400">y</span>
                          <input type="number" value={p.y}
                            onChange={(e) => updatePoint(i, "y", e.target.value)}
                            className="w-14 px-1.5 py-0.5 text-[11px] border border-slate-200 rounded" />
                          <button onClick={() => setPoints((ps) => ps.filter((_, j) => j !== i))}
                            className="ml-auto text-red-400 hover:text-red-600" title="Supprimer">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {points.length === 0 && (
                        <div className="px-2 py-3 text-center text-[10px] text-slate-400">Aucun point — cliquez dans le repère</div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <label className="block text-[10px] font-bold text-slate-600">
                    Titre
                    <input value={title} onChange={(e) => setTitle(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 rounded-md" />
                  </label>
                  {tab === "batons" && (
                    <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={colors} onChange={(e) => setColors(e.target.checked)} className="accent-teal-600" />
                      Couleurs variées par bâton
                    </label>
                  )}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[10px] font-bold text-slate-600">
                        {tab === "circulaire" ? "Parts" : tab === "histogramme" ? "Classes [a ; b[" : "Données"}
                      </div>
                      <button onClick={() => setRows((rs) => [...rs, { label: "", value: 0 }])}
                        className="flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:underline">
                        <Plus className="h-3 w-3" /> Ligne
                      </button>
                    </div>
                    <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {rows.map((r, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1">
                          <input value={r.label}
                            onChange={(e) => updateRow(i, "label", e.target.value)}
                            placeholder={tab === "histogramme" ? "[10 ; 20[" : "Libellé"}
                            className="flex-1 min-w-0 px-1.5 py-0.5 text-[11px] border border-slate-200 rounded" />
                          <input type="number" value={r.value}
                            onChange={(e) => updateRow(i, "value", e.target.value)}
                            className="w-16 px-1.5 py-0.5 text-[11px] border border-slate-200 rounded" />
                          <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                            className="text-red-400 hover:text-red-600 shrink-0" title="Supprimer">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      {tab === "circulaire"
                        ? "Les pourcentages sont calculés automatiquement."
                        : tab === "histogramme"
                          ? "Saisissez les classes comme libellés (ex : [10 ; 20[) et les effectifs en valeurs."
                          : "Libellé + valeur ; l'échelle de l'axe est calculée automatiquement."}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Aperçu */}
            <div className="flex-1 p-3 bg-slate-100 min-w-0">
              <div className="bg-white rounded-xl border border-slate-200 shadow-inner p-2 overflow-auto">
                {tab === "repere" ? (
                  <div
                    onClick={onRepClick}
                    dangerouslySetInnerHTML={{ __html: repereSvg }}
                    className="cursor-crosshair select-none [&_svg]:max-w-full [&_svg]:h-auto"
                    style={{ aspectRatio: `${vbW} / ${vbH}` }}
                  />
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: dataSvg }} className="[&_svg]:max-w-full [&_svg]:h-auto" />
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                {tab === "repere"
                  ? "Clic = placer un point — l'aperçu est identique à la figure insérée"
                  : "Aperçu identique à la figure insérée"}
              </p>
            </div>
          </div>
        </div>

        {/* Pied */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <span className="text-[11px] text-slate-500">
            {tab === "repere" ? `${points.length} point(s)` : `${rows.length} ligne(s) de données`}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-200">
              Annuler
            </button>
            <button
              onClick={insert}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700"
            >
              <Check className="h-4 w-4" /> Insérer le graphique
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  function updatePoint(i: number, field: "x" | "y", raw: string) {
    const v = Math.round(Number(raw) || 0);
    setPoints((ps) => ps.map((p, j) => (j === i ? { ...p, [field]: v } : p)));
    if (field === "x" && v > xmax) setXmax(Math.min(30, v + 2));
    if (field === "y" && v > ymax) setYmax(Math.min(30, v + 2));
  }
  function updateRow(i: number, field: "label" | "value", raw: string) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [field]: field === "value" ? Number(raw) || 0 : raw } : r)));
  }
}
