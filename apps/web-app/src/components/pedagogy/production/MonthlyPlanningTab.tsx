"use client";

/**
 * ============================================================================
 * PLANIFICATION MENSUELLE — Sous-onglet Espace Pédagogique
 * ============================================================================
 *
 * Permet à chaque enseignant de planifier son mois pour sa classe, en se
 * basant sur la planification annuelle officielle (annual_plans) comme source.
 *
 * ⭐ Structure conforme aux documents officiels fournis :
 *   - PAS DE PLANIFICATION MENSUELLE POUR LA MATERNELLE
 *     (l'utilisateur n'a pas encore de document maternelle)
 *   - CI et CP : DEUX FICHES différentes
 *     • Fiche "Période d'immersion" (T1 : Septembre, Octobre, Novembre, Décembre)
 *       → focus sur l'accueil, l'exploration, l'initiation aux apprentissages
 *     • Fiche "Période systématique" (T2 + T3 : Janvier → Juin)
 *       → focus sur les leçons structurées (leçon 1, 2, 3, ...)
 *   - CE1, CE2, CM1, CM2 : UNE FICHE STANDARD (5 semaines × matières)
 *
 * Workflow :
 *   1. L'enseignant sélectionne une classe (parmi ses classes assignées) + un mois
 *   2. Le système propose automatiquement le contenu issu de la planification
 *      annuelle (annual_plans) pour ce mois
 *   3. L'enseignant édite chaque cellule et sauvegarde
 *
 * Terminologie SA/Séquence/U/D (officielle Bénin) :
 *   - SA  = Situation d'Apprentissage (ex: SA1, SA2, SA3)
 *   - Séq = Séquence pédagogique (séq 1, séq 2, ...) = séance de classe
 *   - U   = Unité (ex: U1, U2)
 *   - D   = Dossier (ex: D1, D2)
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2, RefreshCw, Calendar, Save, Sparkles, Pencil, Check, X,
  BookOpen, AlertCircle, Info,
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

interface AvailableClass {
  value: string;   // ex: "CI", "CP", "CE1", ...
  label: string;   // ex: "CI", "CP", "CE1"
}

interface MonthlyPlanningTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
  /** Liste des classes disponibles pour le sélecteur.
   *  - Pour un enseignant : uniquement SES classes assignées (1 ou plusieurs)
   *  - Pour la direction/promoteur : toutes les classes (CI à CM2) — pas de maternelle */
  availableClasses?: AvailableClass[];
  /** Si true, l'utilisateur est direction/promoteur (peut voir toutes les classes) */
  isDirector?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Constantes — Domaines par niveau (doivent matcher annual_plans seed)
// ─────────────────────────────────────────────────────────────────────────

const PRIMAIRE_DOMAINS = [
  "Français", "Mathématiques", "EST", "EPS",
  "Morale", "Civisme", "Histoire", "Géographie",
  "Chant", "Poésie", "Conte", "Dessin", "Couture",
];

// ⭐ Toutes les classes PRIMAIRES + Maternelle (la maternelle affiche un message "pas encore disponible")
const ALL_CLASSES: AvailableClass[] = [
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

// ⭐ Nombre de semaines par mois (varie selon le mois)
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

const WEEK_LABELS = ["Semaine 1", "Semaine 2", "Semaine 3", "Semaine 4", "Semaine 5"];

// ─────────────────────────────────────────────────────────────────────────
// Helper — pedagogyFetch avec credentials
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
// Helpers de classification
// ─────────────────────────────────────────────────────────────────────────

/** CI ou CP → a 2 fiches (immersion T1 + systematic T2/T3) */
function isImmersionClass(classLevel: string): boolean {
  return classLevel === "CI" || classLevel === "CP";
}

/** Mois de T1 (Septembre-Décembre) → période d'immersion pour CI/CP */
function isImmersionPeriod(month: string): boolean {
  return ["Septembre", "Octobre", "Novembre", "Décembre"].includes(month);
}

// ─────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────

export function MonthlyPlanningTab({
  tenantId, academicYearId, teacherId,
  availableClasses, isDirector = false,
}: MonthlyPlanningTabProps) {
  const { currentLevel } = useSchoolLevel();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoProposing, setAutoProposing] = useState(false);
  const [cells, setCells] = useState<MonthlyPlanCell[]>([]);
  const [hasExistingCustom, setHasExistingCustom] = useState(false);
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // ⭐ Classes disponibles : si l'utilisateur est direction, on prend toutes les classes.
  //    Sinon (enseignant), on prend la liste fournie par le parent (ses classes assignées).
  const classesToShow = availableClasses && availableClasses.length > 0
    ? availableClasses
    : ALL_CLASSES;

  // ⭐ Sélection : classe (1ère de la liste) + mois (par défaut septembre)
  const [selectedClass, setSelectedClass] = useState<string>(classesToShow[0]?.value || "CI");
  const [selectedMonth, setSelectedMonth] = useState<string>("Septembre");

  const numWeeks = MONTH_NUM_WEEKS[selectedMonth] || 4;
  const trimester = MONTHS.find(m => m.value === selectedMonth)?.trimester || 1;

  // ⭐ Détection du type de fiche (immersion vs systématique pour CI/CP)
  //    + Maternelle : pas encore de planification mensuelle disponible
  const isMaternelle = selectedClass === "MATERNELLE_GRANDS";
  const showImmersionSheet = isImmersionClass(selectedClass) && isImmersionPeriod(selectedMonth);
  const showSystematicSheet = isImmersionClass(selectedClass) && !isImmersionPeriod(selectedMonth);
  const sheetLabel = isMaternelle
    ? "Maternelle — Bientôt disponible"
    : showImmersionSheet
      ? "Fiche : Période d'immersion"
      : showSystematicSheet
        ? "Fiche : Période systématique"
        : "Fiche standard";

  // ┭ Refs pour briser la dépendance circulaire loadPlan ↔ autoPropose
  const autoProposeRef = useRef<() => Promise<void>>(async () => {});
  const saveRef = useRef<() => Promise<void>>(async () => {});

  // ───────────────────────────────────────────────────────────────────
  // Auto-proposition depuis annual_plans
  // ───────────────────────────────────────────────────────────────────
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
        toast.success(`Proposition automatique : ${result.count} cellules importées`);
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

  // ⭐ Mettre à jour le ref à chaque rendu
  autoProposeRef.current = autoPropose;

  // ───────────────────────────────────────────────────────────────────
  // Charger la planif existante OU auto-proposer si vide
  // ───────────────────────────────────────────────────────────────────
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
        // ⭐ Utiliser le ref pour éviter la dépendance circulaire
        await autoProposeRef.current();
      } else {
        setCells(data.cells);
        setHasExistingCustom(data.hasExistingCustom);
      }
    } catch (e: any) {
      // ⭐ NE PAS afficher l'erreur si c'est juste "table doesn't exist" (migration pas encore appliquée)
      //    → on essaie quand même l'auto-proposition en arrière-plan
      const msg = e?.message || "";
      if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("Failed to fetch monthly plans")) {
        console.warn("Table monthly_plans non disponible — essai auto-proposition:", msg);
        try {
          await autoProposeRef.current();
        } catch (e2) {
          console.error("Auto-propose fallback failed:", e2);
        }
      } else {
        console.error("Failed to load monthly plan:", e);
        toast.error("Erreur lors du chargement de la planification mensuelle: " + msg);
      }
    } finally {
      setLoading(false);
    }
  }, [academicYearId, selectedClass, selectedMonth, teacherId]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // ───────────────────────────────────────────────────────────────────
  // Sauvegarder la planification complète
  // ───────────────────────────────────────────────────────────────────
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
      await loadPlan();
    } catch (e: any) {
      toast.error("Échec de la sauvegarde: " + e.message);
    } finally {
      setSaving(false);
    }
  }, [academicYearId, selectedClass, selectedMonth, teacherId, currentLevel, cells, loadPlan]);

  saveRef.current = handleSave;

  // ───────────────────────────────────────────────────────────────────
  // Helpers d'édition
  // ───────────────────────────────────────────────────────────────────
  const findCell = (weekNumber: number, domain: string, subDomain?: string): MonthlyPlanCell | undefined => {
    return cells.find(c =>
      c.weekNumber === weekNumber &&
      c.domain === domain &&
      (c.subDomain || "") === (subDomain || "")
    );
  };

  const updateCellLocal = (weekNumber: number, domain: string, subDomain: string | undefined, content: string) => {
    setCells(prev => {
      const idx = prev.findIndex(c =>
        c.weekNumber === weekNumber &&
        c.domain === domain &&
        (c.subDomain || "") === (subDomain || "")
      );
      if (idx === -1) {
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

  const saveCellInline = async (cell: MonthlyPlanCell) => {
    if (!cell.id) {
      await saveRef.current();
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
      updateCellLocal(cell.weekNumber, cell.domain, cell.subDomain, editContent);
    } catch (e: any) {
      toast.error("Échec de la mise à jour: " + e.message);
    }
  };

  // ───────────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────────

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
              {classesToShow.find(c => c.value === selectedClass)?.label} — {selectedMonth} — {sheetLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* ⭐ Sélecteur de classe — NE LISTE QUE les classes disponibles */}
          {classesToShow.length > 1 ? (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium"
            >
              {classesToShow.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          ) : (
            // Si une seule classe, afficher en lecture seule (badge)
            <span className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-bold text-slate-700">
              {classesToShow[0]?.label}
            </span>
          )}
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

      {/* ⭐ Bannière informative — type de fiche */}
      <div className={cn(
        "rounded-lg p-3 text-xs flex items-start gap-2",
        isMaternelle
          ? "bg-slate-100 border border-slate-300 text-slate-700"
          : showImmersionSheet
            ? "bg-blue-50 border border-blue-200 text-blue-700"
            : showSystematicSheet
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-amber-50 border border-amber-200 text-amber-700"
      )}>
        {isMaternelle ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> :
         showImmersionSheet ? <Info className="w-4 h-4 mt-0.5 flex-shrink-0" /> :
         showSystematicSheet ? <BookOpen className="w-4 h-4 mt-0.5 flex-shrink-0" /> :
         <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0" />}
        <div>
          <strong>{sheetLabel}</strong>
          {isMaternelle && (
            <span className="ml-2">
              — La planification mensuelle pour la <strong>Maternelle</strong> n'est pas encore
              disponible. Le document officiel est en cours d'élaboration et sera ajouté
              dans une prochaine version. En attendant, vous pouvez consulter la
              <strong> planification annuelle</strong> de la maternelle (qui elle est disponible)
              dans le module « Planification annuelle ».
            </span>
          )}
          {showImmersionSheet && (
            <span className="ml-2">
              — Cette fiche couvre la <strong>période d'immersion</strong> du 1er trimestre
              (Septembre → Décembre). L'enseignant y planifie l'accueil, l'exploration
              et l'initiation aux apprentissages fondamentaux.
            </span>
          )}
          {showSystematicSheet && (
            <span className="ml-2">
              — Cette fiche couvre la <strong>période systématique</strong> du 2e et 3e trimestre
              (Janvier → Juin). L'enseignant y planifie les leçons structurées (Leçon 1, 2, ...).
            </span>
          )}
          {!isMaternelle && !showImmersionSheet && !showSystematicSheet && (
            <span className="ml-2">
              — Fiche standard pour les classes de CE1 à CM2. 5 semaines × matières.
            </span>
          )}
          {!isMaternelle && (
            <div className="mt-1 opacity-80">
              <strong>Terminologie :</strong>
              <span className="ml-1"><strong>SA</strong> = Situation d'Apprentissage</span>
              <span className="ml-2"><strong>Séq</strong> = Séquence (séance)</span>
              <span className="ml-2"><strong>U</strong> = Unité</span>
              <span className="ml-2"><strong>D</strong> = Dossier</span>
            </div>
          )}
        </div>
      </div>

      {/* ⭐ Si Maternelle — afficher un message "pas encore disponible" à la place du tableau */}
      {isMaternelle ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
            <Calendar className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-2">
            Planification mensuelle — Maternelle
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto mb-4">
            Cette fonctionnalité n'est pas encore disponible pour la Maternelle.
            Le document officiel de planification mensuelle pour la Maternelle est
            en cours d'élaboration par les équipes pédagogiques.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-md mx-auto">
            <p className="text-xs text-blue-700">
              <strong>En attendant,</strong> la <strong>planification annuelle</strong> de la
              Maternelle est disponible dans le module « Planification annuelle ».
              Elle contient les 10 mois (Septembre → Juin) avec les 5 domaines (I-V)
              et leurs sous-domaines.
            </p>
          </div>
        </div>
      ) : (
        /* ⭐ TABLEAU — 5 semaines (lignes) × matières (colonnes) */
        /* Structure commune pour immersion, systématique et standard */
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
