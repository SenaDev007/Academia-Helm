"use client";

/**
 * ============================================================================
 * PLANIFICATION MENSUELLE — Sous-onglet Espace Pédagogique
 * ============================================================================
 *
 * ⭐ STRUCTURE EXACTEMENT CONFORME AUX DOCUMENTS OFFICIELS MINISTÉRIELS :
 *
 * 1. CE1-CM2 : 1 fiche standard (5 semaines × champs de formation)
 *    Champs de formation (colonne gauche avec rowspan) :
 *      • FRANÇAIS (lu verticalement) — sous-rows : Vocab théma, Comm Orale,
 *        Lecture, Expression Écrite, Dictée, Vocab, Grammaire, Orthographe,
 *        Écriture, Conjugaison
 *      • MATH (Mathématiques) — sous-rows : Arithmétique, Mesure, Géométrie
 *      • EST — 1 row
 *      • ÉA (Éducation Artistique) — sous-rows : Chant, Atelier, Dessin,
 *        Contes, Poésie
 *      • ÉS (Éducation Sociale) — sous-rows : Morale, Civisme, Compétence 2
 *        (Histoire), Compétence 3 (Géographie)
 *      • EPS — 1 row
 *      • Petit Projet — 1 row
 *    Footer : Vu le Direct + L Titulaire (signatures)
 *
 * 2. CI-CP IMMERSION (T1 : Septembre → Décembre) :
 *    Header : "PERIODE D'IMMERSION : PLANIFICATION DU MOIS DE ... 20.."
 *    Champs de formation :
 *      • FRANÇAIS — par semaine : Thème, Communication orale (Acquisition
 *        et utilisation des mots), Initiation à la lecture, Graphisme,
 *        Lecture récréative
 *      • Mathématique — par semaine : SAN° + 5× Fiche N°
 *      • Initiation à l'EST — 1 row par semaine
 *      • ÉA — sous-rows : Chant, Comptine, Dessin
 *      • EPS — 1 row
 *      • Petit Projet — 1 row
 *
 * 3. CI-CP SYSTÉMATIQUE (T2+T3 : Janvier → Juin) :
 *    Header : "PLANIFICATION DU MOIS DE ... 20.."
 *    Champs de formation :
 *      • FRANÇAIS — par semaine :
 *        - Communication orale : Thème/Sous-thème
 *        - Lecture-écriture : 2× { LECTURE-ECRITURE : Leçon, Titre : Etude
 *          de, STRUCTURE DE LANGUE, écriture Leçon, Titre }
 *      • Mathématique — par semaine : SAN° + 5× Fiche N°
 *      • EST — 1 row
 *      • ÉS — sous-rows : Morale, Civisme, Compétence
 *      • ÉA — sous-rows : Chant, Poésie, Dessin, Conte
 *      • EPS — 1 row
 *      • Petit Projet — 1 row
 *
 * 4. MATERNELLE : pas encore de fiche disponible (message clair affiché)
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
  domain: string;          // ex: "FRANÇAIS", "MATH", "EST", "EA", "ES", "EPS", "PETIT_PROJET"
  subDomain?: string;      // ex: "Lecture", "Arithmétique", "Chant"
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
  value: string;
  label: string;
}

interface MonthlyPlanningTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
  availableClasses?: AvailableClass[];
  isDirector?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Structure EXACTE des champs de formation par type de fiche
// ⭐ Conforme aux documents officiels (PDFs fournis par l'utilisateur)
// ─────────────────────────────────────────────────────────────────────────

// Tous les champs ont TOUJOURS 5 semaines (Première à Cinquième Semaine)
const WEEK_LABELS = ["Première Semaine", "Deuxième Semaine", "Troisième Semaine", "Quatrième Semaine", "Cinquième Semaine"];

// ⭐ FICHE STANDARD (CE1-CM2)
const FICHE_STANDARD = [
  {
    code: "FRANÇAIS",
    label: "FRANÇAIS",
    color: "bg-blue-600",
    subRows: [
      "Vocab théma", "Comm Orale", "Lecture", "Expression Écrite", "Dictée",
      "Vocab", "Grammaire", "Orthographe", "Écriture", "Conjugaison",
    ],
  },
  {
    code: "MATH",
    label: "MATH",
    color: "bg-emerald-600",
    subRows: ["Arithmétique", "Mesure", "Géométrie"],
  },
  {
    code: "EST",
    label: "EST",
    color: "bg-amber-600",
    subRows: [],  // single row
  },
  {
    code: "EA",
    label: "ÉA",
    color: "bg-purple-600",
    subRows: ["Chant", "Atelier", "Dessin", "Contes", "Poésie"],
  },
  {
    code: "ES",
    label: "ÉS",
    color: "bg-indigo-600",
    subRows: ["Morale", "Civisme", "Compétence 2 (Histoire)", "Compétence 3 (Géographie)"],
  },
  {
    code: "EPS",
    label: "EPS",
    color: "bg-rose-600",
    subRows: [],  // single row
  },
  {
    code: "PETIT_PROJET",
    label: "Petit Projet",
    color: "bg-slate-600",
    subRows: [],  // single row
  },
];

// ⭐ FICHE IMMERSION (CI/CP — T1 : Septembre → Décembre)
const FICHE_IMMERSION = [
  {
    code: "FRANÇAIS",
    label: "FRANÇAIS",
    color: "bg-blue-600",
    // Pour l'immersion, le FRANÇAIS n'est pas subdivisé en "matières"
    // mais en sections structurelles à REMPLIR par semaine :
    // Thème, Communication orale, Initiation à la lecture, Graphisme, Lecture récréative
    subRows: [
      "Thème",
      "Communication orale (Acquisition et utilisation des mots)",
      "Initiation à la lecture",
      "Graphisme",
      "Lecture récréative",
    ],
  },
  {
    code: "MATHEMATIQUE",
    label: "Mathématique",
    color: "bg-emerald-600",
    // Pour les maths : 5 fiches par semaine (Fiche N°1, N°2, N°3, N°4, N°5)
    subRows: [
      "SAN°",
      "Fiche N°1", "Fiche N°2", "Fiche N°3", "Fiche N°4", "Fiche N°5",
    ],
  },
  {
    code: "INITIATION_EST",
    label: "Initiation à l'EST",
    color: "bg-amber-600",
    subRows: [],
  },
  {
    code: "EA",
    label: "ÉA",
    color: "bg-purple-600",
    subRows: ["Chant", "Comptine", "Dessin"],
  },
  {
    code: "EPS",
    label: "EPS",
    color: "bg-rose-600",
    subRows: [],
  },
  {
    code: "PETIT_PROJET",
    label: "Petit Projet",
    color: "bg-slate-600",
    subRows: [],
  },
];

// ⭐ FICHE SYSTÉMATIQUE (CI/CP — T2+T3 : Janvier → Juin)
const FICHE_SYSTEMATIQUE = [
  {
    code: "FRANÇAIS",
    label: "FRANÇAIS",
    color: "bg-blue-600",
    // Structure plus complexe : Comm orale + 2 blocs Lecture-écriture
    subRows: [
      "Communication orale (Thème/Sous-thème)",
      "Lecture-écriture 1 (Leçon + Titre + Structure de langue)",
      "Lecture-écriture 2 (Leçon + Titre + Etude)",
    ],
  },
  {
    code: "MATHEMATIQUE",
    label: "Mathématique",
    color: "bg-emerald-600",
    subRows: [
      "SAN°",
      "Fiche N°1", "Fiche N°2", "Fiche N°3", "Fiche N°4", "Fiche N°5",
    ],
  },
  {
    code: "EST",
    label: "EST",
    color: "bg-amber-600",
    subRows: [],
  },
  {
    code: "ES",
    label: "ÉS",
    color: "bg-indigo-600",
    subRows: ["Morale", "Civisme", "Compétence"],
  },
  {
    code: "EA",
    label: "ÉA",
    color: "bg-purple-600",
    subRows: ["Chant", "Poésie", "Dessin", "Conte"],
  },
  {
    code: "EPS",
    label: "EPS",
    color: "bg-rose-600",
    subRows: [],
  },
  {
    code: "PETIT_PROJET",
    label: "Petit Projet",
    color: "bg-slate-600",
    subRows: [],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Classes disponibles (Maternelle incluse pour afficher "pas encore dispo")
// ─────────────────────────────────────────────────────────────────────────

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

const TRIMESTER_COLORS: Record<number, string> = {
  1: "bg-blue-500", 2: "bg-emerald-500", 3: "bg-amber-500",
};
const TRIMESTER_LABELS: Record<number, string> = {
  1: "1er Trim.", 2: "2e Trim.", 3: "3e Trim.",
};

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function isImmersionClass(classLevel: string): boolean {
  return classLevel === "CI" || classLevel === "CP";
}
function isImmersionPeriod(month: string): boolean {
  return ["Septembre", "Octobre", "Novembre", "Décembre"].includes(month);
}

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

  const classesToShow = availableClasses && availableClasses.length > 0
    ? availableClasses
    : ALL_CLASSES;

  const [selectedClass, setSelectedClass] = useState<string>(classesToShow[0]?.value || "CI");
  const [selectedMonth, setSelectedMonth] = useState<string>("Septembre");

  const trimester = MONTHS.find(m => m.value === selectedMonth)?.trimester || 1;
  const isMaternelle = selectedClass === "MATERNELLE_GRANDS";
  const showImmersionSheet = isImmersionClass(selectedClass) && isImmersionPeriod(selectedMonth);
  const showSystematicSheet = isImmersionClass(selectedClass) && !isImmersionPeriod(selectedMonth);

  // ⭐ Sélection de la structure de fiche
  const ficheStructure = isMaternelle
    ? null
    : showImmersionSheet
      ? FICHE_IMMERSION
      : showSystematicSheet
        ? FICHE_SYSTEMATIQUE
        : FICHE_STANDARD;

  const sheetLabel = isMaternelle
    ? "Maternelle — Bientôt disponible"
    : showImmersionSheet
      ? "Période d'immersion (T1 — Septembre → Décembre)"
      : showSystematicSheet
        ? "Période systématique (T2+T3 — Janvier → Juin)"
        : "Fiche standard (CE1 → CM2)";

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
        await autoProposeRef.current();
      } else {
        setCells(data.cells);
        setHasExistingCustom(data.hasExistingCustom);
      }
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("Failed to fetch monthly plans")) {
        console.warn("Table monthly_plans non disponible — essai auto-proposition:", msg);
        try { await autoProposeRef.current(); } catch (e2) { console.error("Auto-propose fallback failed:", e2); }
      } else {
        console.error("Failed to load monthly plan:", e);
        toast.error("Erreur lors du chargement: " + msg);
      }
    } finally {
      setLoading(false);
    }
  }, [academicYearId, selectedClass, selectedMonth, teacherId]);

  useEffect(() => { loadPlan(); }, [loadPlan]);

  // ───────────────────────────────────────────────────────────────────
  // Sauvegarder
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
      toast.success(`Planification sauvegardée : ${result.saved} cellules`);
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
      next[idx] = { ...next[idx], content, isCustom: true, isAutoProposed: false };
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
      toast.error("Échec: " + e.message);
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
          {!isMaternelle && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Bannière informative */}
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
            <span className="ml-2">— La planification mensuelle pour la Maternelle n'est pas encore disponible.</span>
          )}
          {showImmersionSheet && (
            <span className="ml-2">— Fiche d'immersion CI/CP pour le 1er trimestre (accueil, exploration, initiation).</span>
          )}
          {showSystematicSheet && (
            <span className="ml-2">— Fiche systématique CI/CP pour les 2e et 3e trimestres (leçons structurées).</span>
          )}
          {!isMaternelle && !showImmersionSheet && !showSystematicSheet && (
            <span className="ml-2">— Fiche standard CE1-CM2.</span>
          )}
        </div>
      </div>

      {/* ⭐ MATERNELLE — carte "pas encore disponible" */}
      {isMaternelle ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
            <Calendar className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-2">Planification mensuelle — Maternelle</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Cette fonctionnalité n'est pas encore disponible pour la Maternelle.
            Le document officiel est en cours d'élaboration.
          </p>
        </div>
      ) : ficheStructure && (
        /* ⭐ TABLEAU — Structure officielle conforme au PDF */
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
          <table className="text-xs border-collapse w-full table-fixed">
            <colgroup>
              <col style={{ width: "8%" }} />   {/* Champ de Formation */}
              <col style={{ width: "14%" }} />  {/* Sous-row (matière) */}
              {WEEK_LABELS.map((_, i) => (
                <col key={i} style={{ width: `${78 / 5}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="p-2 border border-slate-400 text-center" rowSpan={2}>Champ de Formation</th>
                <th className="p-2 border border-slate-400 text-center" rowSpan={2}>Matière</th>
                {WEEK_LABELS.map(wk => (
                  <th key={wk} className="p-2 border border-slate-400 text-center">{wk}</th>
                ))}
              </tr>
              <tr className="bg-slate-600 text-white text-[9px]">
                {WEEK_LABELS.map(wk => (
                  <th key={wk} className="p-1 border border-slate-400 text-center font-medium">
                    Du ……/……/20… au ……/……/20…
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ficheStructure.map(champ => {
                // ⭐ Si le champ n'a pas de sous-rows, on affiche 1 seule ligne
                //    Si le champ a des sous-rows, on affiche N lignes (1 par sous-row)
                //    Dans les deux cas, le champ lui-même est en rowspan
                const rows = champ.subRows.length > 0 ? champ.subRows : [null];
                return rows.map((subRow, subIdx) => {
                  // Pour chaque semaine (1 à 5), on cherche la cellule
                  const weekNum = 1; // On utilise 1 à 5 mais c'est juste un index de colonne
                  return (
                    <tr key={`${champ.code}-${subIdx}`} className="hover:bg-purple-50/30">
                      {subIdx === 0 && (
                        <td
                          rowSpan={rows.length}
                          className={cn(
                            "p-2 border border-slate-300 font-bold text-white text-center align-middle",
                            champ.color
                          )}
                          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                        >
                          <div className="font-bold text-sm whitespace-nowrap">
                            {champ.label}
                          </div>
                        </td>
                      )}
                      <td className="p-1 border border-slate-200 font-semibold text-slate-700 bg-slate-50 text-[10px] align-top">
                        {subRow || <span className="text-slate-400 italic">{champ.label}</span>}
                      </td>
                      {WEEK_LABELS.map((wk, weekIdx) => {
                        const cellKey = `${selectedClass}|${selectedMonth}|${champ.code}|${subRow || ''}|${weekIdx + 1}`;
                        const cell = findCell(weekIdx + 1, champ.code, subRow || undefined);
                        const isEditing = editingCellKey === cellKey;
                        return (
                          <td key={wk} className="p-1 border border-slate-200 align-top">
                            {cell && isEditing ? (
                              <div className="space-y-1">
                                <textarea
                                  value={editContent}
                                  onChange={e => setEditContent(e.target.value)}
                                  className="w-full px-1 py-0.5 border border-purple-300 rounded text-[9px] bg-white"
                                  rows={4}
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
                                  "text-[9px] leading-tight cursor-pointer p-1 rounded min-h-[60px]",
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
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingCellKey(cellKey);
                                  setEditContent("");
                                }}
                                className="text-[9px] text-slate-400 hover:text-purple-600 w-full text-left p-1 min-h-[60px]"
                                title="Cliquer pour ajouter du contenu"
                              >
                                …
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                });
              })}
              {/* Ligne signatures (Direct + Titulaire) */}
              <tr className="bg-slate-100">
                <td colSpan={2} className="p-2 border border-slate-300 text-right font-bold text-slate-700 text-[10px]">
                  Vu le
                </td>
                {WEEK_LABELS.map((_, i) => (
                  <td key={i} className="p-2 border border-slate-300 text-center text-[10px] text-slate-600">
                    {i === 0 && "Directeur"}
                    {i === 2 && "Titulaire"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Légende */}
      {!isMaternelle && (
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
      )}
    </div>
  );
}
