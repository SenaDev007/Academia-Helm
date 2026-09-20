"use client";

/**
 * ============================================================================
 * TableDialog — Tableaux professionnels pour les fiches et le cahier journal
 * ============================================================================
 *
 * ⭐ Demande utilisateur : « Il faut qu'il puisse faire des tableaux
 *    professionnels : des tableaux de proportionnalité, toutes sortes de
 *    tableaux dans le domaine mathématique comme n'importe quel. »
 *
 * 4 onglets :
 *   1. TABLEAU SIMPLE       — lignes × colonnes configurables, en-têtes
 *   2. PROPORTIONNALITÉ     — 2 lignes reliées par un coefficient (× k),
 *      calcul automatique ou cases vides (exercice à compléter)
 *   3. TABLE DE PYTHAGORE   — table de multiplication (5/10/12), remplie ou vide
 *   4. CONVERSIONS          — ⭐ 2026-09-20 : COMPLET CE1 → CM2 via le module
 *      src/lib/conversion-tables.ts : longueurs (CE1 m→mm / complète km→mm),
 *      masses (kg→g, kg→mg, AVEC TONNE ET QUINTAL), capacités (L→mL, kL→mL
 *      + correspondances L↔dm³), aires (km²→mm² + ha/a/ca), volumes
 *      (m³→cm³, km³→mm³), durées (équivalences), monnaie (€/centimes),
 *      tableau récapitulatif des correspondances ENTRE grandeurs (masse ↔
 *      capacité : 1 L d'eau ≈ 1 kg…) + méthode de conversion.
 *
 * Insertion en TABLE HTML (styles inline) : identique à l'écran et dans les
 * exports PDF (sanitizeRichHtml conserve les tableaux).
 * ============================================================================
 */

import { useEffect, useMemo, useState } from "react";
import { X, Table2, Check, Plus, Trash2, Percent, Grid2x2, Repeat, Ruler } from "lucide-react";
import { toast } from "sonner";
import {
  CONV_GROUPS, convDefsByGroup, convDefById, buildConversionHtml,
  type ConvDef, type ConvGroup,
} from "@/lib/conversion-tables";

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ── Styles de cellules (inline → fidélité PDF) ── */
const TD = `border:1px solid #cbd5e1;padding:4px 8px;text-align:center;min-width:34px;`;
const TD_HEAD = `border:1px solid #93c5fd;background:#eff6ff;padding:4px 8px;text-align:center;font-weight:700;color:#1e40af;`;
const TD_FIRSTCOL = `border:1px solid #cbd5e1;background:#f8fafc;padding:4px 8px;text-align:center;font-weight:600;color:#334155;`;
const TABLE_STYLE =
  `border-collapse:collapse;margin:8px auto;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;max-width:100%;`;

export interface TableDialogProps {
  open: boolean;
  onClose: () => void;
  onInsertHtml: (html: string) => void;
}

type Tab = "simple" | "proportionnalite" | "pythagore" | "conversion";

export function TableDialog({ open, onClose, onInsertHtml }: TableDialogProps) {
  const [tab, setTab] = useState<Tab>("simple");

  /* ── état tableau simple ── */
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [headerRow, setHeaderRow] = useState(true);
  const [headerCol, setHeaderCol] = useState(false);
  const [cells, setCells] = useState<string[][]>([
    ["Nom", "Prénom", "Classe"],
    ["", "", ""],
    ["", "", ""],
  ]);

  /* ── état proportionnalité ── */
  const [propA, setPropA] = useState<string[]>(["2", "3", "5", "7"]);
  const [coef, setCoef] = useState(3);
  const [autoFill, setAutoFill] = useState(true);
  const [labelA, setLabelA] = useState("Masse de farine (kg)");
  const [labelB, setLabelB] = useState("Prix (Francs CFA)");

  /* ── état Pythagore ── */
  const [pythSize, setPythSize] = useState(10);
  const [pythFilled, setPythFilled] = useState(true);

  /* ── état conversions (⭐ 2026-09-20 : complet CE1 → CM2) ── */
  const [convGroup, setConvGroup] = useState<ConvGroup>("Longueurs");
  const [convDefId, setConvDefId] = useState<string>("longueurs");
  const [convRows, setConvRows] = useState(2);
  const [convExample, setConvExample] = useState(true);
  const [convNote, setConvNote] = useState(true);

  const convDefs = useMemo(() => convDefsByGroup(convGroup), [convGroup]);
  const convDef: ConvDef | undefined =
    useMemo(() => convDefById(convDefId) || convDefs[0], [convDefId, convDefs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* Synchronise la grille de cellules avec rows/cols */
  const syncCells = (r: number, c: number) => {
    setCells((old) => {
      const next: string[][] = [];
      for (let i = 0; i < r; i++) {
        const row: string[] = [];
        for (let j = 0; j < c; j++) row.push(old[i]?.[j] ?? "");
        next.push(row);
      }
      return next;
    });
  };

  const simpleHtml = useMemo(() => {
    const trs: string[] = [];
    for (let i = 0; i < rows; i++) {
      const tds: string[] = [];
      for (let j = 0; j < cols; j++) {
        const isHead = (headerRow && i === 0) || (headerCol && j === 0);
        const style = (headerRow && i === 0) ? TD_HEAD : (headerCol && j === 0) ? TD_FIRSTCOL : TD;
        tds.push(`<t${isHead ? "h" : "d"} style="${style}">${esc(cells[i]?.[j] || "")}</t${isHead ? "h" : "d"}>`);
      }
      trs.push(`<tr>${tds.join("")}</tr>`);
    }
    return `<table class="ah-table" contenteditable="false" data-table="1" style="${TABLE_STYLE}">${trs.join("")}</table><p>&nbsp;</p>`;
  }, [rows, cols, headerRow, headerCol, cells]);

  const propB = useMemo(
    () => propA.map((v) => (autoFill ? String(Math.round((Number(v) || 0) * coef * 100) / 100).replace(".", ",") : "")),
    [propA, coef, autoFill],
  );

  const propHtml = useMemo(() => {
    const n = propA.length;
    const rowA = `<tr><td style="${TD_FIRSTCOL}text-align:left;">${esc(labelA)}</td>` +
      propA.map((v) => `<td style="${TD}">${esc(v)}</td>`).join("") + `</tr>`;
    const coefRow = `<tr><td style="border:none;padding:0 2px;text-align:right;color:#dc2626;font-weight:700;font-size:11px;">× ${coef}</td>` +
      Array.from({ length: n }, () => `<td style="border:none;padding:0;text-align:center;color:#dc2626;font-weight:700;font-size:11px;">↓</td>`).join("") + `</tr>`;
    const rowB = `<tr><td style="${TD_FIRSTCOL}text-align:left;">${esc(labelB)}</td>` +
      propB.map((v) => `<td style="${TD}">${esc(v)}</td>`).join("") + `</tr>`;
    return `<table class="ah-table" contenteditable="false" data-table="prop" style="${TABLE_STYLE}">${rowA}${coefRow}${rowB}</table><p>&nbsp;</p>`;
  }, [propA, propB, coef, labelA, labelB]);

  const pythHtml = useMemo(() => {
    const n = pythSize;
    const head = `<tr><td style="${TD_HEAD}">×</td>` +
      Array.from({ length: n }, (_, j) => `<td style="${TD_HEAD}">${j + 1}</td>`).join("") + `</tr>`;
    const body: string[] = [];
    for (let i = 1; i <= n; i++) {
      body.push(
        `<tr><td style="${TD_HEAD}">${i}</td>` +
        Array.from({ length: n }, (_, j) => `<td style="${TD}">${pythFilled ? (i) * (j + 1) : ""}</td>`).join("") +
        `</tr>`,
      );
    }
    return `<table class="ah-table" contenteditable="false" data-table="pythagore" style="${TABLE_STYLE}${n > 8 ? "font-size:11px;" : ""}${n > 8 ? "min-width:480px;" : ""}">${head}${body.join("")}</table><p>&nbsp;</p>`;
  }, [pythSize, pythFilled]);

  const convHtml = useMemo(() => {
    if (!convDef) return "";
    return buildConversionHtml(convDef, {
      rows: convRows,
      showExample: convExample,
      showNote: convNote,
    });
  }, [convDef, convRows, convExample, convNote]);

  if (!open) return null;

  const insert = () => {
    const html = tab === "simple" ? simpleHtml
      : tab === "proportionnalite" ? propHtml
      : tab === "pythagore" ? pythHtml
      : convHtml;
    onInsertHtml(html);
    onClose();
  };

  const TABS: [Tab, string, typeof Table2][] = [
    ["simple", "Tableau simple", Grid2x2],
    ["proportionnalite", "Proportionnalité", Repeat],
    ["pythagore", "Table de Pythagore", Table2],
    ["conversion", "Conversions", Ruler],
  ];

  const previewHtml = tab === "simple" ? simpleHtml
    : tab === "proportionnalite" ? propHtml
    : tab === "pythagore" ? pythHtml
    : convHtml;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* En-tête */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-indigo-600" />
            <div>
              <div className="text-sm font-bold text-slate-800">Insérer un tableau</div>
              <div className="text-[11px] text-slate-500">Tableaux professionnels : simple, proportionnalité, Pythagore, conversions</div>
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
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                tab === id
                  ? "text-indigo-600 border-indigo-600 bg-indigo-50/50"
                  : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col lg:flex-row">
            {/* Édition */}
            <div className="lg:w-[330px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 p-3 space-y-3">
              {tab === "simple" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] font-bold text-slate-600">
                      Lignes
                      <input type="number" min={1} max={12} value={rows}
                        onChange={(e) => { const v = Math.max(1, Math.min(12, Number(e.target.value) || 1)); setRows(v); syncCells(v, cols); }}
                        className="w-full mt-0.5 px-2 py-1 text-xs border border-slate-200 rounded-md" />
                    </label>
                    <label className="text-[10px] font-bold text-slate-600">
                      Colonnes
                      <input type="number" min={1} max={8} value={cols}
                        onChange={(e) => { const v = Math.max(1, Math.min(8, Number(e.target.value) || 1)); setCols(v); syncCells(rows, v); }}
                        className="w-full mt-0.5 px-2 py-1 text-xs border border-slate-200 rounded-md" />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={headerRow} onChange={(e) => setHeaderRow(e.target.checked)} className="accent-indigo-600" />
                      1re ligne en en-tête
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={headerCol} onChange={(e) => setHeaderCol(e.target.checked)} className="accent-indigo-600" />
                      1re colonne en en-tête
                    </label>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-600 mb-1">Contenu des cellules</div>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg p-1">
                      <table className="border-collapse text-[11px]">
                        <tbody>
                          {Array.from({ length: rows }, (_, i) => (
                            <tr key={i}>
                              {Array.from({ length: cols }, (_, j) => (
                                <td key={j} className="p-0.5">
                                  <input
                                    value={cells[i]?.[j] ?? ""}
                                    onChange={(e) => setCells((cs) => cs.map((r, ii) => ii === i ? r.map((c, jj) => jj === j ? e.target.value : c) : r))}
                                    className="w-16 px-1 py-0.5 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-indigo-300 outline-none"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Les cellules vides restent vides (à compléter en classe).</p>
                  </div>
                </>
              )}

              {tab === "proportionnalite" && (
                <>
                  <div className="text-[11px] text-slate-500 leading-relaxed bg-indigo-50/60 border border-indigo-100 rounded-lg p-2">
                    Tableau classique à 2 grandeurs : la seconde ligne est obtenue en multipliant la
                    première par le coefficient de proportionnalité.
                  </div>
                  <label className="block text-[10px] font-bold text-slate-600">
                    Nom de la grandeur A (1re ligne)
                    <input value={labelA} onChange={(e) => setLabelA(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 rounded-md" />
                  </label>
                  <label className="block text-[10px] font-bold text-slate-600">
                    Nom de la grandeur B (2e ligne)
                    <input value={labelB} onChange={(e) => setLabelB(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 rounded-md" />
                  </label>
                  <label className="block text-[10px] font-bold text-slate-600">
                    Coefficient de proportionnalité (× k)
                    <input type="number" step="0.5" value={coef}
                      onChange={(e) => setCoef(Number(e.target.value) || 1)}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 rounded-md" />
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setPropA((a) => [...a, ""])}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border border-slate-200 text-slate-600 hover:bg-slate-50">
                      <Plus className="h-3 w-3" /> Colonne
                    </button>
                    <button onClick={() => setPropA((a) => a.slice(0, -1))}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border border-slate-200 text-slate-600 hover:bg-slate-50">
                      <Trash2 className="h-3 w-3" /> Retirer
                    </button>
                    <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border border-indigo-200 text-indigo-700 cursor-pointer">
                      <input type="checkbox" checked={autoFill} onChange={(e) => setAutoFill(e.target.checked)} className="accent-indigo-600" />
                      Calculer B automatiquement
                    </label>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-600 mb-1">Valeurs de la ligne A</div>
                    <div className="flex flex-wrap gap-1.5">
                      {propA.map((v, i) => (
                        <input key={i} value={v}
                          onChange={(e) => setPropA((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                          className="w-16 px-1.5 py-1 text-[11px] border border-slate-200 rounded" />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {tab === "pythagore" && (
                <>
                  <div className="text-[11px] text-slate-500 leading-relaxed bg-indigo-50/60 border border-indigo-100 rounded-lg p-2">
                    La table de Pythagore : table de multiplication carrée, remplie (aide-mémoire)
                    ou vide (exercice à compléter).
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] font-bold text-slate-600">
                      Taille
                      <select value={pythSize} onChange={(e) => setPythSize(Number(e.target.value))}
                        className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white">
                        <option value={5}>5 × 5</option>
                        <option value={10}>10 × 10</option>
                        <option value={12}>12 × 12</option>
                      </select>
                    </label>
                    <label className="flex items-end gap-2 pb-1 text-[11px] font-semibold text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={pythFilled} onChange={(e) => setPythFilled(e.target.checked)} className="accent-indigo-600 mb-1" />
                      Table remplie
                    </label>
                  </div>
                </>
              )}

              {tab === "conversion" && (
                <>
                  <div className="text-[11px] text-slate-500 leading-relaxed bg-indigo-50/60 border border-indigo-100 rounded-lg p-2">
                    Tableaux de conversion COMPLETS du CE1 au CM2 : longueurs, masses
                    (avec <b>tonne et quintal</b>), capacités, aires, volumes, durées, monnaie
                    — et le tableau des <b>correspondances</b> entre grandeurs (1 L = 1 dm³,
                    1 L d&apos;eau ≈ 1 kg…). L&apos;unité de base est mise en évidence.
                  </div>
                  <label className="block text-[10px] font-bold text-slate-600">
                    Grandeur
                    <select value={convGroup}
                      onChange={(e) => {
                        const g = e.target.value as ConvGroup;
                        setConvGroup(g);
                        const first = convDefsByGroup(g)[0];
                        if (first) setConvDefId(first.id);
                      }}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white">
                      {CONV_GROUPS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[10px] font-bold text-slate-600">
                    Type de tableau (niveau)
                    <select value={convDef?.id ?? ""}
                      onChange={(e) => setConvDefId(e.target.value)}
                      className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 rounded-md bg-white">
                      {convDefs.map((d) => (
                        <option key={d.id} value={d.id}>{d.variant}</option>
                      ))}
                    </select>
                  </label>
                  {convDef && (
                    <div className="text-[10.5px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-2">
                      <b className="text-slate-600">{convDef.level}</b> — {convDef.desc}
                    </div>
                  )}
                  {convDef?.columns && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[10px] font-bold text-slate-600">
                        Rangées vides
                        <input type="number" min={1} max={6} value={convRows}
                          onChange={(e) => setConvRows(Math.max(1, Math.min(6, Number(e.target.value) || 2)))}
                          className="w-full mt-0.5 px-2 py-1 text-xs border border-slate-200 rounded-md" />
                      </label>
                      <label className="flex items-end gap-2 pb-1 text-[11px] font-semibold text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={convExample} onChange={(e) => setConvExample(e.target.checked)} className="accent-indigo-600 mb-1" />
                        Exemple chiffré
                      </label>
                    </div>
                  )}
                  {convDef?.example && (
                    <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={convNote} onChange={(e) => setConvNote(e.target.checked)} className="accent-indigo-600" />
                      Équivalences + méthode sous le tableau
                    </label>
                  )}
                  {convDef && !convDef.example && convDef.note && (
                    <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={convNote} onChange={(e) => setConvNote(e.target.checked)} className="accent-indigo-600" />
                      Note / méthode sous le tableau
                    </label>
                  )}
                </>
              )}
            </div>

            {/* Aperçu */}
            <div className="flex-1 p-3 bg-slate-100 min-w-0 overflow-auto">
              <div className="bg-white rounded-xl border border-slate-200 shadow-inner p-3 overflow-auto">
                <div
                  className="[&_table]:mx-auto"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                Aperçu identique au tableau inséré (rendu identique à l&apos;écran et dans les PDF)
              </p>
            </div>
          </div>
        </div>

        {/* Pied */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Percent className="h-3 w-3" /> {tab === "proportionnalite" ? `coefficient × ${coef}` : tab === "pythagore" ? `${pythSize} × ${pythSize}` : tab === "conversion" ? (convDef ? `${convDef.variant}` : "") : `${rows} × ${cols}`}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-200">
              Annuler
            </button>
            <button
              onClick={insert}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700"
            >
              <Check className="h-4 w-4" /> Insérer le tableau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
