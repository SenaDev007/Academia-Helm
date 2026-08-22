"use client";

/**
 * ============================================================================
 * PLANIFICATION MENSUELLE — Sous-onglet Espace Pédagogique
 * ============================================================================
 *
 * Permet à chaque enseignant de planifier son mois pour sa classe, en se
 * basant sur la planification annuelle officielle (annual_plans) comme source.
 *
 * Workflow :
 *   1. L'enseignant sélectionne une classe + un mois
 *   2. Le système propose automatiquement le contenu issu de la planification
 *      annuelle (annual_plans) pour ce mois (auto-proposition).
 *   3. L'enseignant édite chaque cellule (semaine × domaine) et sauvegarde.
 *   4. Les cellules éditées sont marquées isCustom=true et ne seront pas
 *      écrasées par une future auto-proposition.
 *
 * Terminologie SA/Séquence/U/D (officielle Bénin) :
 *   - SA  = Situation d'Apprentissage (ex: SA1, SA2, SA3)
 *   - Séq = Séquence pédagogique (séq 1, séq 2, ...) = séance de classe
 *   - U   = Unité (ex: U1, U2)
 *   - D   = Dossier (ex: D1, D2)
 *
 * Modes selon le niveau :
 *   - MATERNELLE : 5 domaines × sous-domaines × semaines
 *   - CI/CP : période d'immersion (T1) + période systématique (T2+T3)
 *   - CE1-CM2 : feuille standard (5 semaines × domaines)
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2, RefreshCw, Calendar, Save, Sparkles, Pencil, Check, X,
  BookOpen, ChevronLeft, ChevronRight, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useSchoolLevel } from "@/hooks/useSchoolLevel";

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface MonthlyPlanCell {
  id?: string;
  weekNumber: number;
  domain: string;
  subDomain?: string;
  activityType?: "SA" | "SEQUENCE" | "U" | "D" | null;
  activityNumber?: number | null;
  sequenceNumber?: number | null;
  content: string;
  isAutoProposed: boolean;
  isCustom: boolean;
  annualPlanId?: string | null;
}

interface MonthlyPlanResponse {
  cells: MonthlyPlanCell[];
  isAutoProposed: boolean;
  hasExistingCustom: boolean;
}

interface MonthlyPlanningTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Constantes — Domaines par niveau (doivent matcher annual_plans seed)
// ─────────────────────────────────────────────────────────────────────────

const PRIMAIRE_DOMAINS = [
  "Français", "Mathématiques", "EST", "EPS",
  "Morale", "Civisme", "Histoire", "Géographie",
  "Chant", "Poésie", "Conte", "Dessin", "Couture",
];

const MATERNELLE_DOMAINS = [
  { domain: "Education pour la santé", subDomains: ["Passage aux toilettes", "Lavage des mains", "Goûters"] },
  { domain: "Expression corporelle", subDomains: ["Expression corporelle"] },
  { domain: "Pré-lecture / Pré-écriture / Pré-mathématique", subDomains: ["Pré-lecture", "Pré-écriture", "Pré-mathématique", "Observation", "Education sensorielle", "Travaux manuels"] },
  { domain: "Expression plastique / Expression émotionnelle", subDomains: ["Expression plastique", "Expression émotionnelle"] },
  { domain: "Poésie / Chant / Contes / Comptine / Communication orale", subDomains: ["Poésie", "Chant", "Contes", "Comptine", "Communication orale"] },
];

const CLASS_LEVELS = [
  { value: "MATERNELLE_GRANDS", label: "Maternelle" },
  { value: "CI", label: "CI" },
  { value: "CP", label: "CP" },
  { value: "CE1", label: "CE1" },
  { value: "CE2", label: "CE2" },
  { value: "CM1", label: "CM1" },
  { value: "CM2", label: "CM2" },
];

const MONTHS = [
  { value: "Septembre", trimester: 1 },
  { value: "Octobre", trimester: 1 },
  { value: "Novembre", trimester: 1 },
  { value: "Décembre", trimester: 1 },
  { value: "Janvier", trimester: 2 },
  { value: "Février", trimester: 2 },
  { value: "Mars", trimester: 2 },
  { value: "Avril", trimester: 3 },
  { value: "Mai", trimester: 3 },
  { value: "Juin", trimester: 3 },
];

// Nombre de semaines par mois (varie selon le mois)
const MONTH_NUM_WEEKS: Record<string, number> = {
  "Septembre": 2, "Octobre": 5, "Novembre": 4, "Décembre": 1,
  "Janvier": 4, "Février": 4, "Mars": 4, "Avril": 4, "Mai": 4, "Juin": 4,
};

const TRIMESTER_COLORS: Record<number, string> = {
  1: "bg-blue-500", 2: "bg-emerald-500", 3: "bg-amber-500",
};
const TRIMESTER_LABELS: Record<number, string> = {
  1: "1er Trim.", 2: "2e Trim.", 3: "3e Trim.",
};

// Libellés des semaines (par défaut)
const WEEK_LABELS = ["Semaine 1", "Semaine 2", "Semaine 3", "Semaine 4", "Semaine 5"];

// ─────────────────────────────────────────────────────────────────────────
// Helper — pédfetch avec credentials
// ─────────────────────────────────────────────────────────────────────────

async function pedagogyFetch<T>(url: string, options?: { method?: string; body?: any }): Promise<T> {
  const res = await fetch(url, {
    method: options?.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error || `Erreur ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────

export function MonthlyPlanningTab({ tenantId, academicYearId, teacherId }: MonthlyPlanningTabProps) {
  const { currentLevel } = useSchoolLevel();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoProposing, setAutoProposing] = useState(false);
  const [cells, setCells] = useState<MonthlyPlanCell[]>([]);
  const [hasExistingCustom, setHasExistingCustom] = useState(false);
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // Sélection : classe + mois (par défaut septembre + mois actuel si septembre)
  const [selectedClass, setSelectedClass] = useState<string>("MATERNELLE_GRANDS");
  const [selectedMonth, setSelectedMonth] = useState<string>("Septembre");

  const isMaternelle = selectedClass === "MATERNELLE_GRANDS";
  const numWeeks = MONTH_NUM_WEEKS[selectedMonth] || 4;
  const trimester = MONTHS.find(m => m.value === selectedMonth)?.trimester || 1;

  // Charger la planif existante OU auto-proposer si vide
  const loadPlan = useCallback(async () => {
    if (!academicYearId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await pedagogyFetch<MonthlyPlanResponse>(
        `/api/pedagogy/monthly-plans?academicYearId=${academicYearId}&classLevel=${selectedClass}&month=${selectedMonth}&teacherId=${teacherId}`
      );
      if (data.cells.length === 0) {
        // Pas encore de planif → lancer l'auto-proposition
        await autoPropose();
      } else {
        setCells(data.cells);
        setHasExistingCustom(data.hasExistingCustom);
      }
    } catch (e: any) {
      console.error("Failed to load monthly plan:", e);
      toast.error("Erreur lors du chargement de la planification");
    } finally {
      setLoading(false);
    }
  }, [academicYearId, selectedClass, selectedMonth, teacherId]);

  // Auto-proposition depuis annual_plans
  const autoPropose = useCallback(async () => {
    if (!academicYearId) return;
    setAutoProposing(true);
    try {
      const result = await pedagogyFetch<{ cells: MonthlyPlanCell[]; count: number }>(
        "/api/pedagogy/monthly-plans/auto-propose",
        { method: "POST", body: { academicYearId, classLevel: selectedClass, month: selectedMonth } }
      );
      if (result.cells.length === 0) {
        toast.info("Aucune planification annuelle disponible pour ce mois. Initialisez d'abord la planification annuelle.");
      } else {
        toast.success(`Proposition automatique : ${result.count} cellules importées depuis la planification annuelle`);
      }
      setCells(result.cells);
      setHasExistingCustom(false);
    } catch (e: any) {
      console.error("Auto-propose failed:", e);
      toast.error("Échec de l'auto-proposition: " + e.message);
    } finally {
      setAutoProposing(false);
    }
  }, [academicYearId, selectedClass, selectedMonth]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // Sauvegarder la planification complète
  const handleSave = useCallback(async () => {
    if (!academicYearId) return;
    setSaving(true);
    try {
      const result = await pedagogyFetch<{ saved: number; updated: number; skipped: number }>(
        "/api/pedagogy/monthly-plans/save",
        {
          method: "POST",
          body: {
            academicYearId,
            classLevel: selectedClass,
            month: selectedMonth,
            teacherId,
            schoolLevelId: currentLevel?.schoolLevelId || currentLevel?.id,
            cells,
          },
        }
      );
      toast.success(`Planification sauvegardée : ${result.saved} cellules (${result.skipped} personnalisations conservées)`);
      setHasExistingCustom(false);
      // Recharger pour récupérer les IDs
      await loadPlan();
    } catch (e: any) {
      toast.error("Échec de la sauvegarde: " + e.message);
    } finally {
      setSaving(false);
    }
  }, [academicYearId, selectedClass, selectedMonth, teacherId, currentLevel, cells, loadPlan]);

  // Édition d'une cellule — recherche par (weekNumber, domain, subDomain)
  const findCell = (weekNumber: number, domain: string, subDomain?: string): MonthlyPlanCell | undefined => {
    return cells.find(c =>
      c.weekNumber === weekNumber &&
      c.domain === domain &&
      (c.subDomain || "") === (subDomain || "")
    );
  };

  // Update cellule en local (avant sauvegarde)
  const updateCellLocal = (weekNumber: number, domain: string, subDomain: string | undefined, content: string) => {
    setCells(prev => {
      const idx = prev.findIndex(c =>
        c.weekNumber === weekNumber &&
        c.domain === domain &&
        (c.subDomain || "") === (subDomain || "")
      );
      if (idx === -1) {
        // Créer une nouvelle cellule
        return [...prev, {
          weekNumber, domain, subDomain,
          content,
          activityType: null, activityNumber: null, sequenceNumber: null,
          isAutoProposed: false, isCustom: true,
        }];
      }
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        content,
        isCustom: true,
        isAutoProposed: false,
      };
      return next;
    });
  };

  // Sauvegarde individuelle d'une cellule (PUT /:id) — seulement si la cellule a un ID
  const saveCellInline = async (cell: MonthlyPlanCell) => {
    if (!cell.id) {
      // Pas d'ID → sauvegarde globale (POST /save)
      await handleSave();
      setEditingCellKey(null);
      return;
    }
    try {
      await pedagogyFetch(`/api/pedagogy/monthly-plans/${cell.id}`, {
        method: "PUT",
        body: { content: editContent },
      });
      toast.success("Cellule mise à jour");
      setEditingCellKey(null);
      // Marquer comme custom localement
      updateCellLocal(cell.weekNumber, cell.domain, cell.subDomain, editContent);
    } catch (e: any) {
      toast.error("Échec de la mise à jour: " + e.message);
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-slate-500">Chargement de la planification mensuelle…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + selectors */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Calendar className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Planification mensuelle</h2>
            <p className="text-xs text-slate-500">
              {CLASS_LEVELS.find(c => c.value === selectedClass)?.label} — {selectedMonth}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium"
          >
            {CLASS_LEVELS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium"
          >
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.value}</option>
            ))}
          </select>
          <button
            onClick={autoPropose}
            disabled={autoProposing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
            title="Régénère la proposition depuis la planification annuelle"
          >
            {autoProposing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Proposer
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sauvegarder
          </button>
          <button
            onClick={loadPlan}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100"
            title="Rafraîchir"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Info banner — Terminologie */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-700 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <strong>Terminologie officielle (Bénin) :</strong>
          <span className="ml-2"><strong>SA</strong> = Situation d'Apprentissage (SA1, SA2)</span>
          <span className="ml-3"><strong>Séquence</strong> = séance de classe (séq 1, séq 2)</span>
          <span className="ml-3"><strong>U</strong> = Unité (U1, U2)</span>
          <span className="ml-3"><strong>D</strong> = Dossier (D1, D2)</span>
          <div className="mt-1 text-purple-600">
            ℹ️ Le contenu est auto-proposé depuis la planification annuelle officielle. Cliquez sur une cellule pour la personnaliser.
            {hasExistingCustom && (
              <span className="ml-2 text-amber-600 font-semibold">
                ⚠️ Certaines cellules ont été personnalisées et ne seront pas écrasées par l'auto-proposition.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* TABLEAU MATERNELLE — 5 domaines × sous-domaines × semaines */}
      {isMaternelle ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
          <table className="text-xs border-collapse w-full table-fixed">
            <colgroup>
              <col style={{ width: "18%" }} />
              <col style={{ width: "14%" }} />
              {Array.from({ length: numWeeks }).map((_, i) => (
                <col key={i} style={{ width: `${68 / Math.max(numWeeks, 1)}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr className={cn("text-white", TRIMESTER_COLORS[trimester])}>
                <th className="p-2 border border-purple-300 text-left">Domaines</th>
                <th className="p-2 border border-purple-300 text-left">Sous-domaine</th>
                {Array.from({ length: numWeeks }).map((_, i) => (
                  <th key={i} className="p-2 border border-purple-300 text-center">
                    {WEEK_LABELS[i]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATERNELLE_DOMAINS.map(dom => (
                <React.Fragment key={dom.domain}>
                  <tr className="bg-slate-100">
                    <td colSpan={2 + numWeeks} className="p-2 font-bold text-slate-700 border border-slate-300">
                      {dom.domain}
                    </td>
                  </tr>
                  {dom.subDomains.map(sub => {
                    const cellKey = `${selectedClass}|${selectedMonth}|${dom.domain}|${sub}`;
                    return (
                      <tr key={`${dom.domain}-${sub}`} className="hover:bg-purple-50/30">
                        <td className="p-1 border border-slate-200 bg-slate-50">&nbsp;</td>
                        <td className="p-1 border border-slate-200 font-semibold text-slate-600 bg-white">
                          {sub}
                        </td>
                        {Array.from({ length: numWeeks }).map((_, weekIdx) => {
                          const weekNum = weekIdx + 1;
                          const cell = findCell(weekNum, dom.domain, sub);
                          const isEditing = editingCellKey === `${cellKey}|${weekNum}`;
                          return (
                            <td key={weekNum} className="p-1 border border-slate-200 align-top">
                              {cell && isEditing ? (
                                <div className="space-y-1">
                                  <textarea
                                    value={editContent}
                                    onChange={e => setEditContent(e.target.value)}
                                    className="w-full px-1 py-0.5 border border-purple-300 rounded text-[9px] bg-white"
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="flex gap-0.5">
                                    <button
                                      onClick={() => saveCellInline(cell)}
                                      className="p-0.5 bg-emerald-600 text-white rounded"
                                    >
                                      <Check className="w-2.5 h-2.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingCellKey(null)}
                                      className="p-0.5 bg-slate-200 rounded"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>
                              ) : cell ? (
                                <div
                                  className={cn(
                                    "text-[9px] leading-tight cursor-pointer p-1 rounded",
                                    cell.isCustom
                                      ? "bg-amber-50 text-amber-900 border border-amber-200"
                                      : cell.isAutoProposed
                                        ? "bg-purple-50 text-purple-900 border border-purple-100"
                                        : "text-slate-700"
                                  )}
                                  onClick={() => {
                                    setEditingCellKey(`${cellKey}|${weekNum}`);
                                    setEditContent(cell.content);
                                  }}
                                  title={
                                    cell.isCustom
                                      ? "Modifié par l'enseignant"
                                      : cell.isAutoProposed
                                        ? "Auto-proposé depuis la planification annuelle"
                                        : "Contenu"
                                  }
                                >
                                  {cell.content}
                                  {cell.activityType && (
                                    <span className="block text-[7px] text-purple-600 font-bold mt-0.5">
                                      {cell.activityType}{cell.activityNumber || ""}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingCellKey(`${cellKey}|${weekNum}`);
                                    setEditContent("");
                                  }}
                                  className="text-[9px] text-slate-400 hover:text-purple-600 w-full text-left p-1"
                                  title="Cliquer pour ajouter du contenu"
                                >
                                  + ajouter
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // TABLEAU PRIMAIRE — 5 semaines (lignes) × matières (colonnes)
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
          <table className="text-xs border-collapse w-full table-fixed">
            <colgroup>
              <col style={{ width: "10%" }} />
              {PRIMAIRE_DOMAINS.map((_, i) => (
                <col key={i} style={{ width: `${90 / PRIMAIRE_DOMAINS.length}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr className={cn("text-white", TRIMESTER_COLORS[trimester])}>
                <th className="p-2 border border-purple-300 text-left">Semaine</th>
                {PRIMAIRE_DOMAINS.map(d => (
                  <th key={d} className="p-2 border border-purple-300 text-center text-[10px]">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: numWeeks }).map((_, weekIdx) => {
                const weekNum = weekIdx + 1;
                return (
                  <tr key={weekNum} className="hover:bg-purple-50/30">
                    <td className="p-2 border border-slate-200 font-bold text-slate-700 bg-slate-50">
                      {WEEK_LABELS[weekIdx]}
                    </td>
                    {PRIMAIRE_DOMAINS.map(domain => {
                      const cell = findCell(weekNum, domain);
                      const cellKey = `${selectedClass}|${selectedMonth}|${domain}||${weekNum}`;
                      const isEditing = editingCellKey === cellKey;
                      return (
                        <td key={domain} className="p-1 border border-slate-200 align-top">
                          {cell && isEditing ? (
                            <div className="space-y-1">
                              <textarea
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                className="w-full px-1 py-0.5 border border-purple-300 rounded text-[9px] bg-white"
                                rows={3}
                                autoFocus
                              />
                              <div className="flex gap-0.5">
                                <button
                                  onClick={() => saveCellInline(cell)}
                                  className="p-0.5 bg-emerald-600 text-white rounded"
                                >
                                  <Check className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  onClick={() => setEditingCellKey(null)}
                                  className="p-0.5 bg-slate-200 rounded"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          ) : cell ? (
                            <div
                              className={cn(
                                "text-[9px] leading-tight cursor-pointer p-1 rounded",
                                cell.isCustom
                                  ? "bg-amber-50 text-amber-900 border border-amber-200"
                                  : cell.isAutoProposed
                                    ? "bg-purple-50 text-purple-900 border border-purple-100"
                                    : "text-slate-700"
                              )}
                              onClick={() => {
                                setEditingCellKey(cellKey);
                                setEditContent(cell.content);
                              }}
                              title={
                                cell.isCustom
                                  ? "Modifié par l'enseignant"
                                  : cell.isAutoProposed
                                    ? "Auto-proposé depuis la planification annuelle"
                                    : "Contenu"
                              }
                            >
                              {cell.content}
                              {cell.activityType && (
                                <span className="block text-[7px] text-purple-600 font-bold mt-0.5">
                                  {cell.activityType}{cell.activityNumber || ""}
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingCellKey(cellKey);
                                setEditContent("");
                              }}
                              className="text-[9px] text-slate-400 hover:text-purple-600 w-full text-left p-1"
                              title="Cliquer pour ajouter du contenu"
                            >
                              + ajouter
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Légende */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs flex flex-wrap items-center gap-4">
        <span className="font-bold text-slate-700">Légende :</span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 bg-purple-50 border border-purple-100 rounded"></span>
          <span className="text-slate-600">Auto-proposé (depuis planif annuelle)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 bg-amber-50 border border-amber-200 rounded"></span>
          <span className="text-slate-600">Personnalisé par l'enseignant</span>
        </span>
      </div>
    </div>
  );
}
