"use client";

/**
 * ============================================================================
 * CONTRÔLE PÉDAGOGIQUE DIRECTION — Validation des soumissions enseignant
 * ============================================================================
 *
 * Vue consolidée pour le directeur / la directrice.
 *
 * Onglets :
 *   1. Tableau de bord — KPIs synthétiques de toutes les soumissions en attente
 *   2. Cahiers Journal — Grilles hebdomadaires soumises (valider/rejeter)
 *   3. Fiches Pédagogiques — Fiches primaires soumises (valider/rejeter)
 *   4. Registres d'Appel — Registres mensuels soumis (valider/rejeter)
 *   5. Évaluations Mensuelles — Évaluations certificatives soumises (valider/rejeter)
 *
 * Backend:
 *   PedagogicalSpaceService:
 *     - getDirectorPedagogyDashboard
 *     - getPendingCahierJournals, validateCahierJournal
 *     - getPendingPedagogicalFiches, validatePedagogicalFiche
 *     - getPendingAttendanceRegisters, validateAttendanceRegister
 *     - getPendingMonthlyEvaluations, validateMonthlyEvaluation
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, CheckCircle2, XCircle, Send, Clock,
  FileText, BookOpen, ClipboardList, FileSpreadsheet, AlertTriangle, AlertCircle,
  ChevronRight, ChevronDown, X, Eye, Sigma, FlaskConical, Users, Palette, Calendar,
  Download, Save, Activity, School, ChevronsDownUp, ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDirectorPedagogyDashboard,
  usePendingCahierJournals, usePendingFiches, usePendingRegisters,
  usePendingEvaluations,
  useCahierJournalDetail, useFicheDetail, useRegisterDetail,
  useEvaluationDetail,
} from "@/lib/query/pedagogy-hooks";
import { pedagogySpaceService } from "@/services/pedagogy-space.service";
import apiClient from "@/lib/api/client";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";

interface DirectorPedagogyControlProps {
  tenantId: string;
  academicYearId: string;
  userId: string;
}

const TABS = [
  { id: "dashboard", label: "Tableau de bord", icon: AlertTriangle },
  { id: "cahier-journal", label: "Cahiers Journal & Fiches", icon: FileSpreadsheet },
  { id: "registres", label: "Registres d'Appel", icon: ClipboardList },
  { id: "evaluations", label: "Évaluations Mensuelles", icon: BookOpen },
] as const;

type TabId = typeof TABS[number]["id"];

const SHEET_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  MATH: { label: "Mathématiques", icon: Sigma, color: "bg-blue-100 text-blue-700" },
  FRANCAIS: { label: "Français", icon: BookOpen, color: "bg-emerald-100 text-emerald-700" },
  EST: { label: "Éduc. Scientifique & Tech.", icon: FlaskConical, color: "bg-purple-100 text-purple-700" },
  ES: { label: "Éducation Sociale", icon: Users, color: "bg-amber-100 text-amber-700" },
  EA: { label: "Éducation Artistique", icon: Palette, color: "bg-pink-100 text-pink-700" },
  EPS: { label: "Éducation Physique et Sportive", icon: Activity, color: "bg-cyan-100 text-cyan-700" },
};

const MONTH_NAMES = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                     "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatDateFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatDateTimeFR(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function DirectorPedagogyControl({ tenantId, academicYearId, userId }: DirectorPedagogyControlProps) {
  const [tab, setTab] = useState<TabId>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-100">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 px-5 py-3.5 text-sm font-bold transition-all whitespace-nowrap",
                  tab === t.id
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-b-2 border-transparent"
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
        {tab === "dashboard" && (
          <DashboardTab tenantId={tenantId} academicYearId={academicYearId} refreshKey={refreshKey} onNavigate={setTab} />
        )}
        {tab === "cahier-journal" && (
          <PendingCahierJournalsTab tenantId={tenantId} academicYearId={academicYearId} userId={userId} refreshKey={refreshKey} onRefresh={refresh} />
        )}
        {tab === "registres" && (
          <PendingRegistersTab tenantId={tenantId} academicYearId={academicYearId} userId={userId} refreshKey={refreshKey} onRefresh={refresh} />
        )}
        {tab === "evaluations" && (
          <PendingEvaluationsTab tenantId={tenantId} academicYearId={academicYearId} userId={userId} refreshKey={refreshKey} onRefresh={refresh} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Tableau de bord
// ============================================================================

function DashboardTab({ tenantId, academicYearId, refreshKey, onNavigate }: {
  tenantId: string; academicYearId: string; refreshKey: number; onNavigate: (t: TabId) => void;
}) {
  // ⭐ Hook React Query partagé — cache 2 min, dégradation gracieuse
  const { data: dashboard, isLoading: loading, refetch } = useDirectorPedagogyDashboard(academicYearId);

  // Recharger quand refreshKey change (déclenché par le parent après une validation)
  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;
  }

  if (!dashboard) {
    return <div className="text-center py-8 text-slate-500">Impossible de charger le tableau de bord.</div>;
  }

  const cards = [
    { label: "Cahiers Journal", count: dashboard.pendingCahierJournals, icon: FileSpreadsheet, color: "bg-blue-50 text-blue-700 border-blue-200", tab: "cahier-journal" as TabId },
    { label: "Fiches Pédagogiques", count: dashboard.pendingFiches, icon: FileText, color: "bg-emerald-50 text-emerald-700 border-emerald-200", tab: "fiches" as TabId },
    { label: "Registres d'Appel", count: dashboard.pendingAttendanceRegisters, icon: ClipboardList, color: "bg-amber-50 text-amber-700 border-amber-200", tab: "registres" as TabId },
    { label: "Évaluations Mensuelles", count: dashboard.pendingMonthlyEvaluations, icon: BookOpen, color: "bg-purple-50 text-purple-700 border-purple-200", tab: "evaluations" as TabId },
    { label: "Semainiers (anciens)", count: dashboard.pendingWeeklyLogs, icon: Clock, color: "bg-slate-50 text-slate-700 border-slate-200", tab: null },
    { label: "Rapports fin de semaine", count: dashboard.pendingWeeklySummaries, icon: Send, color: "bg-slate-50 text-slate-700 border-slate-200", tab: null },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Tableau de bord — Validation pédagogique</h2>
        <p className="text-sm text-slate-500 mt-1">
          {dashboard.totalPending} soumission(s) en attente de validation
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              onClick={() => card.tab && onNavigate(card.tab)}
              disabled={!card.tab}
              className={cn(
                "flex items-center gap-4 p-5 rounded-xl border-2 text-left transition-all",
                card.color,
                card.tab ? "hover:shadow-md cursor-pointer" : "cursor-default opacity-70"
              )}
            >
              <div className="flex-shrink-0">
                <Icon className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <div className="text-3xl font-bold">{card.count}</div>
                <div className="text-xs font-semibold uppercase tracking-wide mt-1">{card.label}</div>
              </div>
              {card.tab && <ChevronRight className="h-5 w-5 opacity-50" />}
            </button>
          );
        })}
      </div>

      {/* Détail par type de fiche */}
      {dashboard.pendingFichesByType && Object.keys(dashboard.pendingFichesByType).length > 0 && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <h3 className="text-sm font-bold text-slate-700 uppercase mb-3">Fiches par type</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(dashboard.pendingFichesByType).map(([type, count]: [string, any]) => {
              const config = SHEET_TYPE_LABELS[type] || { label: type, icon: FileText, color: "bg-slate-100 text-slate-700" };
              const Icon = config.icon;
              return (
                <div key={type} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold", config.color)}>
                  <Icon className="h-3 w-3" />
                  {config.label}: <strong>{count}</strong>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Modale de validation/rejet commune
// ============================================================================

function ValidationModal({ open, onClose, onValidate, title }: {
  open: boolean;
  onClose: () => void;
  onValidate: (action: "VALIDATED" | "REJECTED", reason?: string) => Promise<void>;
  title: string;
}) {
  const [action, setAction] = useState<"VALIDATED" | "REJECTED">("VALIDATED");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleValidate = async () => {
    setLoading(true);
    try {
      await onValidate(action, action === "REJECTED" ? reason : undefined);
      setReason("");
      setAction("VALIDATED");
      onClose();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setAction("VALIDATED")}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold border-2 transition-all",
                action === "VALIDATED"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              )}
            >
              <CheckCircle2 className="h-5 w-5" />
              Valider
            </button>
            <button
              onClick={() => setAction("REJECTED")}
              className={cn(
                "flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold border-2 transition-all",
                action === "REJECTED"
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-white text-red-700 border-red-200 hover:bg-red-50"
              )}
            >
              <XCircle className="h-5 w-5" />
              Rejeter
            </button>
          </div>

          {action === "REJECTED" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Motif du rejet
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Expliquez la raison du rejet..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium">
              Annuler
            </button>
            <button
              onClick={handleValidate}
              disabled={loading || (action === "REJECTED" && !reason.trim())}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50",
                action === "VALIDATED" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
              )}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirmer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ⭐ Indicateur de statut des fiches pédagogiques pour un cahier journal
//    Affiché sous chaque cahier journal en attente — montre si toutes les
//    matières planifiées ont leur fiche pédagogique préparée.
// ============================================================================

function FichesStatusIndicator({ journalId }: { journalId: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get(`/pedagogy-space/cahier-journal/${journalId}/fiches`);
        if (cancelled) return;
        setData(res.data?.stats);
      } catch {
        if (cancelled) return;
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [journalId]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Vérification des fiches…</span>
      </div>
    );
  }

  if (!data) return null;

  if (data.totalMatieresPlanifiees === 0) {
    return (
      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500">
        <FileText className="h-3 w-3" />
        <span>Aucune matière planifiée dans ce cahier journal</span>
      </div>
    );
  }

  if (data.toutesFichesPreparees) {
    return (
      <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        <span>
          {data.totalFichesPreparees} / {data.totalMatieresPlanifiees} fiches préparées
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700">
      <AlertCircle className="h-3 w-3" />
      <span>
        ⚠ {data.totalFichesManquantes} fiche(s) manquante(s) · {data.totalFichesPreparees} / {data.totalMatieresPlanifiees} préparées
      </span>
    </div>
  );
}

// ============================================================================
// Pending Cahier Journals
// ============================================================================

function PendingCahierJournalsTab({ tenantId, academicYearId, userId, refreshKey, onRefresh }: {
  tenantId: string; academicYearId: string; userId: string; refreshKey: number; onRefresh: () => void;
}) {
  // ⭐ Hook React Query partagé — cache 2 min, dégradation gracieuse
  const queryClient = useQueryClient();
  // ⭐ 3 sous-onglets : en attente (SUBMITTED) / validés (VALIDATED) / rejetés (REJECTED)
  const [statusTab, setStatusTab] = useState<'SUBMITTED' | 'VALIDATED' | 'REJECTED'>('SUBMITTED');
  const { data: items = [], isLoading: loading, refetch } = usePendingCahierJournals(academicYearId, statusTab);
  const [selected, setSelected] = useState<any>(null);
  const [modalItem, setModalItem] = useState<any>(null);
  // ⭐ États repliables (chevrons) pour la hiérarchie : schoolLevel → trimester → class
  const [collapsedSchoolLevels, setCollapsedSchoolLevels] = useState<Set<string>>(new Set());
  const [collapsedTrimesters, setCollapsedTrimesters] = useState<Set<string>>(new Set());
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set());

  // Recharger quand refreshKey change
  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

  // ⭐ Réinitialiser la sélection quand on change de sous-onglet
  useEffect(() => {
    setSelected(null);
    setModalItem(null);
  }, [statusTab]);

  const handleValidate = async (action: "VALIDATED" | "REJECTED", reason?: string) => {
    if (!modalItem) return;
    await pedagogySpaceService.validateCahierJournal(modalItem.id, {
      action,
      validatedBy: userId,
      rejectionReason: reason,
    });
    toast.success(action === "VALIDATED" ? "✅ Cahier journal validé" : "Cahier journal rejeté");
    onRefresh();
    // Invalider le cache pour forcer le re-fetch (tous les sous-onglets + dashboard)
    queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "pending-cahier-journals"] });
    queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "dashboard"] });
  };

  const handleView = async (item: any) => {
    try {
      // ⭐ Utiliser le service partagé (cache React Query via useCahierJournalDetail)
      const data = await pedagogySpaceService.getCahierJournalDetail(item.id);
      setSelected(data);
    } catch { toast.error("Erreur lors du chargement"); }
  };

  // ⭐ Toggle collapse/expand d'un niveau hiérarchique
  const toggleCollapse = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ⭐ Si un cahier journal est sélectionné, afficher la vue détaillée in-page
  if (selected) {
    return (
      <CahierJournalDirectorDetail
        journal={selected}
        userId={userId}
        onBack={() => setSelected(null)}
        onValidated={() => {
          setSelected(null);
          onRefresh();
          refetch();
        }}
      />
    );
  }

  // ⭐ Hiérarchisation : schoolLevel → trimester → class → items
  const getTrimester = (dateStr: string): string => {
    if (!dateStr) return 'Trimestre inconnu';
    const d = new Date(dateStr);
    const m = d.getMonth() + 1;
    if (m >= 9) return 'Trimestre 1';
    if (m >= 1 && m <= 3) return 'Trimestre 2';
    if (m >= 4 && m <= 6) return 'Trimestre 3';
    return 'Vacances (été)';
  };

  // Construire la structure hiérarchique à 3 niveaux
  // schoolLevels: { Maternelle: { Trimestre 1: { CP1: [item, ...], ... }, ... }, ... }
  const hierarchy: Record<string, Record<string, Record<string, any[]>>> = {};
  for (const item of items) {
    const schoolLevel = item.schoolLevelName || 'Autres';
    const trimester = getTrimester(item.weekStartDate);
    const className = item.classNameResolved || item.className || 'Sans classe';
    if (!hierarchy[schoolLevel]) hierarchy[schoolLevel] = {};
    if (!hierarchy[schoolLevel][trimester]) hierarchy[schoolLevel][trimester] = {};
    if (!hierarchy[schoolLevel][trimester][className]) hierarchy[schoolLevel][trimester][className] = [];
    hierarchy[schoolLevel][trimester][className].push(item);
  }

  // Ordonner les niveaux scolaires
  const levelOrder = ['Maternelle', 'Primaire', 'Secondaire', 'Collège', 'Lycée', 'Autres'];
  const sortedLevels = Object.keys(hierarchy).sort((a, b) => {
    const ia = levelOrder.indexOf(a); const ib = levelOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // Couleurs par niveau scolaire
  const levelColors: Record<string, string> = {
    Maternelle: 'text-pink-700 bg-pink-50 border-pink-200',
    Primaire: 'text-blue-700 bg-blue-50 border-blue-200',
    Secondaire: 'text-purple-700 bg-purple-50 border-purple-200',
    Collège: 'text-amber-700 bg-amber-50 border-amber-200',
    Lycée: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    Autres: 'text-slate-700 bg-slate-50 border-slate-200',
  };

  // Statuts pour les sous-onglets
  const tabConfig = {
    SUBMITTED: { label: 'En attente', icon: Clock, color: 'text-blue-700 bg-blue-50' },
    VALIDATED: { label: 'Validés', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
    REJECTED: { label: 'Rejetés', icon: XCircle, color: 'text-red-700 bg-red-50' },
  };

  // ⭐ Helpers Tout déplier / Tout replier (pour gérer les grandes listes)
  //    Rassemble toutes les clés des 3 niveaux hiérarchiques (schoolLevel, trimester, class)
  //    à partir de la hiérarchie calculée plus haut.
  const allSchoolLevelKeysCJ = sortedLevels;
  const allTrimesterKeysCJ: string[] = [];
  const allClassKeysCJ: string[] = [];
  for (const sl of sortedLevels) {
    for (const tr of Object.keys(hierarchy[sl])) {
      allTrimesterKeysCJ.push(`${sl}::${tr}`);
      for (const cn of Object.keys(hierarchy[sl][tr])) {
        allClassKeysCJ.push(`${sl}::${tr}::${cn}`);
      }
    }
  }
  const handleExpandAllCJ = () => {
    setCollapsedSchoolLevels(new Set());
    setCollapsedTrimesters(new Set());
    setCollapsedClasses(new Set());
  };
  const handleCollapseAllCJ = () => {
    setCollapsedSchoolLevels(new Set(allSchoolLevelKeysCJ));
    setCollapsedTrimesters(new Set(allTrimesterKeysCJ));
    setCollapsedClasses(new Set(allClassKeysCJ));
  };

  return (
    <div className="space-y-4">
      {/* ⭐ Sous-onglets statut : En attente / Validés / Rejetés */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {(Object.keys(tabConfig) as Array<keyof typeof tabConfig>).map(s => {
          const cfg = tabConfig[s];
          const Icon = cfg.icon;
          return (
            <button
              key={s}
              onClick={() => setStatusTab(s)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-all',
                statusTab === s
                  ? `${cfg.color} border-current`
                  : 'text-slate-500 hover:text-slate-700 border-transparent'
              )}
            >
              <Icon className="h-4 w-4" />
              {cfg.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">{items.length} élément(s)</span>
          {/* ⭐ Boutons Tout déplier / Tout replier */}
          <button
            onClick={handleExpandAllCJ}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200"
            title="Tout déplier (afficher toutes les classes)"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" /> Tout déplier
          </button>
          <button
            onClick={handleCollapseAllCJ}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200"
            title="Tout replier (masquer toutes les classes)"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" /> Tout replier
          </button>
          <button onClick={() => refetch()} className="p-2 hover:bg-slate-100 rounded-lg" title="Recharger">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          Cahiers Journal — {tabConfig[statusTab].label}
        </h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <FileSpreadsheet className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="font-medium text-slate-700">
            Aucun cahier journal {statusTab === 'SUBMITTED' ? 'en attente' : statusTab === 'VALIDATED' ? 'validé' : 'rejeté'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {statusTab === 'SUBMITTED'
              ? "Les nouvelles soumissions apparaîtront ici."
              : statusTab === 'VALIDATED'
                ? "Les cahiers journaux validés apparaîtront ici (historique)."
                : "Les cahiers journaux rejetés apparaîtront ici (à corriger par les enseignants)."}
          </p>
        </div>
      ) : (
        // ⭐ Hiérarchie collapsible : schoolLevel → trimester → class → items
        <div className="space-y-3">
          {sortedLevels.map(schoolLevel => {
            const trimesters = hierarchy[schoolLevel];
            const trimesterNames = Object.keys(trimesters);
            const totalItems = trimesterNames.reduce(
              (s, t) => s + Object.values(trimesters[t]).reduce((cs, items) => cs + items.length, 0), 0
            );
            const isLevelCollapsed = collapsedSchoolLevels.has(schoolLevel);
            const levelColorClass = levelColors[schoolLevel] || levelColors.Autres;
            return (
              <div key={schoolLevel} className={cn('border rounded-lg overflow-hidden', levelColorClass.split(' ').slice(-1)[0])}>
                {/* En-tête niveau scolaire */}
                <button
                  onClick={() => toggleCollapse(setCollapsedSchoolLevels, schoolLevel)}
                  className={cn('w-full flex items-center gap-2 px-4 py-2.5 font-bold text-sm transition-colors', levelColorClass)}
                >
                  {isLevelCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <School className="h-5 w-5" />
                  <span>{schoolLevel}</span>
                  <span className="ml-1 text-xs font-normal opacity-75">
                    ({trimesterNames.length} trimestre{trimesterNames.length > 1 ? 's' : ''} · {totalItems} cahier{totalItems > 1 ? 's' : ''})
                  </span>
                </button>
                {/* Contenu niveau scolaire (si déplié) */}
                {!isLevelCollapsed && (
                  <div className="bg-white border-t border-slate-200 p-3 space-y-2">
                    {trimesterNames.map(trimester => {
                      const classes = trimesters[trimester];
                      const classNames = Object.keys(classes).sort();
                      const trimesterItems = classNames.reduce((s, cn) => s + classes[cn].length, 0);
                      const trimesterKey = `${schoolLevel}::${trimester}`;
                      const isTrimesterCollapsed = collapsedTrimesters.has(trimesterKey);
                      return (
                        <div key={trimester} className="border border-indigo-100 rounded-lg overflow-hidden">
                          {/* En-tête trimestre */}
                          <button
                            onClick={() => toggleCollapse(setCollapsedTrimesters, trimesterKey)}
                            className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                          >
                            {isTrimesterCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-indigo-600" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />}
                            <Calendar className="h-4 w-4 text-indigo-600" />
                            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{trimester}</span>
                            <span className="ml-auto text-xs text-indigo-500">{trimesterItems} cahier(s) · {classNames.length} classe(s)</span>
                          </button>
                          {/* Contenu trimestre (si déplié) */}
                          {!isTrimesterCollapsed && (
                            <div className="p-2 space-y-2 bg-white">
                              {classNames.map(className => {
                                const classItems = classes[className];
                                const classKey = `${schoolLevel}::${trimester}::${className}`;
                                const isClassCollapsed = collapsedClasses.has(classKey);
                                return (
                                  <div key={className} className="border border-slate-200 rounded-lg overflow-hidden">
                                    {/* En-tête classe */}
                                    <button
                                      onClick={() => toggleCollapse(setCollapsedClasses, classKey)}
                                      className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
                                    >
                                      {isClassCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-slate-600" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-600" />}
                                      <FileSpreadsheet className="h-4 w-4 text-slate-600" />
                                      <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">{className}</span>
                                      <span className="ml-auto text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full">
                                        {classItems.length}
                                      </span>
                                    </button>
                                    {/* Contenu classe (si déplié) — liste des cahiers journaux */}
                                    {!isClassCollapsed && (
                                      <div className="p-2 space-y-2 bg-white">
                                        {classItems.map(item => (
                                          <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300">
                                            <div className="flex-1 min-w-0">
                                              <p className="font-medium text-slate-900 text-sm">
                                                Semaine du {formatDateFR(item.weekStartDate)} au {formatDateFR(item.weekEndDate)}
                                              </p>
                                              <p className="text-xs text-slate-500 mt-0.5">
                                                Enseignant : {item.teacherFirstName} {item.teacherLastName}
                                              </p>
                                              <p className="text-xs text-slate-400 mt-0.5">
                                                {item.submittedAt ? `Soumis le ${formatDateTimeFR(item.submittedAt)}` : ''}
                                                {item.validatedAt ? ` · Validé le ${formatDateTimeFR(item.validatedAt)}` : ''}
                                                {item.status === 'REJECTED' && item.rejectionReason ? ` · Motif : ${item.rejectionReason.substring(0, 80)}${item.rejectionReason.length > 80 ? '…' : ''}` : ''}
                                              </p>
                                              {/* ⭐ Indicateur fiches pédagogiques manquantes (seulement si SUBMITTED) */}
                                              {item.status === 'SUBMITTED' && <FichesStatusIndicator journalId={item.id} />}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                              <button onClick={() => handleView(item)}
                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                                                <Eye className="h-3 w-3" /> Voir
                                              </button>
                                              {item.status === 'SUBMITTED' && (
                                                <button onClick={() => setModalItem(item)}
                                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                                                  <CheckCircle2 className="h-3 w-3" /> Traiter
                                                </button>
                                              )}
                                              {item.status !== 'SUBMITTED' && (
                                                <span className={cn(
                                                  'px-2 py-1 text-[10px] font-bold uppercase rounded',
                                                  item.status === 'VALIDATED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                )}>
                                                  {item.status === 'VALIDATED' ? '✓ Validé' : '✗ Rejeté'}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ⭐ L'ancien modal a été remplacé par la vue in-page CahierJournalDirectorDetail
          (rendue au début du composant quand `selected` est défini) */}

      <ValidationModal
        open={!!modalItem}
        onClose={() => setModalItem(null)}
        onValidate={handleValidate}
        title={`Cahier journal — ${modalItem?.classNameResolved || ""}`}
      />
    </div>
  );
}

// ============================================================================
// Pending Fiches Pédagogiques
// ============================================================================

function PendingFichesTab({ tenantId, academicYearId, userId, refreshKey, onRefresh }: {
  tenantId: string; academicYearId: string; userId: string; refreshKey: number; onRefresh: () => void;
}) {
  // ⭐ Hook React Query partagé — cache 2 min, dégradation gracieuse
  const queryClient = useQueryClient();
  // ⭐ 3 sous-onglets : en attente (SUBMITTED) / validés (VALIDATED) / rejetés (REJECTED)
  const [statusTab, setStatusTab] = useState<'SUBMITTED' | 'VALIDATED' | 'REJECTED'>('SUBMITTED');
  const { data: items = [], isLoading: loading, refetch } = usePendingFiches(academicYearId, statusTab);
  const [selected, setSelected] = useState<any>(null);
  const [modalItem, setModalItem] = useState<any>(null);
  // ⭐ États repliables (chevrons) pour la hiérarchie : schoolLevel → trimester → class
  const [collapsedSchoolLevels, setCollapsedSchoolLevels] = useState<Set<string>>(new Set());
  const [collapsedTrimesters, setCollapsedTrimesters] = useState<Set<string>>(new Set());
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

  // ⭐ Réinitialiser la sélection quand on change de sous-onglet
  useEffect(() => {
    setSelected(null);
    setModalItem(null);
  }, [statusTab]);

  const handleValidate = async (action: "VALIDATED" | "REJECTED", reason?: string) => {
    if (!modalItem) return;
    await pedagogySpaceService.validatePedagogicalFiche(modalItem.id, {
      action,
      validatedBy: userId,
      rejectionReason: reason,
    });
    toast.success(action === "VALIDATED" ? "✅ Fiche validée" : "Fiche rejetée");
    onRefresh();
    queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "pending-fiches"] });
    queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "dashboard"] });
  };

  const handleView = async (item: any) => {
    try {
      const data = await pedagogySpaceService.getPedagogicalFicheDetail(item.id);
      setSelected(data);
    } catch { toast.error("Erreur"); }
  };

  // ⭐ Toggle collapse/expand d'un niveau hiérarchique
  const toggleCollapse = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ⭐ Si une fiche est sélectionnée, afficher la vue détaillée in-page
  if (selected) {
    return (
      <PedagogicalFicheDirectorDetail
        fiche={selected}
        userId={userId}
        onBack={() => setSelected(null)}
        onValidated={() => {
          setSelected(null);
          onRefresh();
          refetch();
          queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "pending-fiches"] });
          queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "dashboard"] });
        }}
      />
    );
  }

  // ⭐ Hiérarchisation : schoolLevel → trimester → class → items
  const getTrimester = (dateStr: string): string => {
    if (!dateStr) return 'Trimestre inconnu';
    const d = new Date(dateStr);
    const m = d.getMonth() + 1;
    if (m >= 9) return 'Trimestre 1';
    if (m >= 1 && m <= 3) return 'Trimestre 2';
    if (m >= 4 && m <= 6) return 'Trimestre 3';
    return 'Vacances (été)';
  };

  // Construire la structure hiérarchique à 3 niveaux
  const hierarchy: Record<string, Record<string, Record<string, any[]>>> = {};
  for (const item of items) {
    const schoolLevel = item.schoolLevelName || 'Autres';
    const dateField = item.lessonDate || item.adminDate;
    const trimester = getTrimester(dateField);
    const className = item.classNameResolved || item.className || 'Sans classe';
    if (!hierarchy[schoolLevel]) hierarchy[schoolLevel] = {};
    if (!hierarchy[schoolLevel][trimester]) hierarchy[schoolLevel][trimester] = {};
    if (!hierarchy[schoolLevel][trimester][className]) hierarchy[schoolLevel][trimester][className] = [];
    hierarchy[schoolLevel][trimester][className].push(item);
  }

  // Ordonner les niveaux scolaires
  const levelOrder = ['Maternelle', 'Primaire', 'Secondaire', 'Collège', 'Lycée', 'Autres'];
  const sortedLevels = Object.keys(hierarchy).sort((a, b) => {
    const ia = levelOrder.indexOf(a); const ib = levelOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // Couleurs par niveau scolaire
  const levelColors: Record<string, string> = {
    Maternelle: 'text-pink-700 bg-pink-50 border-pink-200',
    Primaire: 'text-blue-700 bg-blue-50 border-blue-200',
    Secondaire: 'text-purple-700 bg-purple-50 border-purple-200',
    Collège: 'text-amber-700 bg-amber-50 border-amber-200',
    Lycée: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    Autres: 'text-slate-700 bg-slate-50 border-slate-200',
  };

  const monthNames = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const dayNames = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  // Statuts pour les sous-onglets
  const tabConfig = {
    SUBMITTED: { label: 'En attente', icon: Clock, color: 'text-blue-700 bg-blue-50' },
    VALIDATED: { label: 'Validées', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
    REJECTED: { label: 'Rejetées', icon: XCircle, color: 'text-red-700 bg-red-50' },
  };

  // ⭐ Helpers Tout déplier / Tout replier (pour gérer les grandes listes)
  const allSchoolLevelKeysPF = sortedLevels;
  const allTrimesterKeysPF: string[] = [];
  const allClassKeysPF: string[] = [];
  for (const sl of sortedLevels) {
    for (const tr of Object.keys(hierarchy[sl])) {
      allTrimesterKeysPF.push(`${sl}::${tr}`);
      for (const cn of Object.keys(hierarchy[sl][tr])) {
        allClassKeysPF.push(`${sl}::${tr}::${cn}`);
      }
    }
  }
  const handleExpandAllPF = () => {
    setCollapsedSchoolLevels(new Set());
    setCollapsedTrimesters(new Set());
    setCollapsedClasses(new Set());
  };
  const handleCollapseAllPF = () => {
    setCollapsedSchoolLevels(new Set(allSchoolLevelKeysPF));
    setCollapsedTrimesters(new Set(allTrimesterKeysPF));
    setCollapsedClasses(new Set(allClassKeysPF));
  };

  return (
    <div className="space-y-4">
      {/* ⭐ Sous-onglets statut : En attente / Validées / Rejetées */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {(Object.keys(tabConfig) as Array<keyof typeof tabConfig>).map(s => {
          const cfg = tabConfig[s];
          const Icon = cfg.icon;
          return (
            <button
              key={s}
              onClick={() => setStatusTab(s)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-all',
                statusTab === s
                  ? `${cfg.color} border-current`
                  : 'text-slate-500 hover:text-slate-700 border-transparent'
              )}
            >
              <Icon className="h-4 w-4" />
              {cfg.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">{items.length} élément(s)</span>
          {/* ⭐ Boutons Tout déplier / Tout replier */}
          <button
            onClick={handleExpandAllPF}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200"
            title="Tout déplier (afficher toutes les classes)"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" /> Tout déplier
          </button>
          <button
            onClick={handleCollapseAllPF}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200"
            title="Tout replier (masquer toutes les classes)"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" /> Tout replier
          </button>
          <button onClick={() => refetch()} className="p-2 hover:bg-slate-100 rounded-lg" title="Recharger">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          Fiches Pédagogiques — {tabConfig[statusTab].label}
        </h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="font-medium text-slate-700">
            Aucune fiche {statusTab === 'SUBMITTED' ? 'en attente' : statusTab === 'VALIDATED' ? 'validée' : 'rejetée'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {statusTab === 'SUBMITTED'
              ? "Les nouvelles soumissions apparaîtront ici."
              : statusTab === 'VALIDATED'
                ? "Les fiches validées apparaîtront ici (historique)."
                : "Les fiches rejetées apparaîtront ici (à corriger par les enseignants)."}
          </p>
        </div>
      ) : (
        // ⭐ Hiérarchie collapsible : schoolLevel → trimester → class → items
        <div className="space-y-3">
          {sortedLevels.map(schoolLevel => {
            const trimesters = hierarchy[schoolLevel];
            const trimesterNames = Object.keys(trimesters);
            const totalItems = trimesterNames.reduce(
              (s, t) => s + Object.values(trimesters[t]).reduce((cs, items) => cs + items.length, 0), 0
            );
            const isLevelCollapsed = collapsedSchoolLevels.has(schoolLevel);
            const levelColorClass = levelColors[schoolLevel] || levelColors.Autres;
            return (
              <div key={schoolLevel} className={cn('border rounded-lg overflow-hidden', levelColorClass.split(' ').slice(-1)[0])}>
                <button
                  onClick={() => toggleCollapse(setCollapsedSchoolLevels, schoolLevel)}
                  className={cn('w-full flex items-center gap-2 px-4 py-2.5 font-bold text-sm transition-colors', levelColorClass)}
                >
                  {isLevelCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <School className="h-5 w-5" />
                  <span>{schoolLevel}</span>
                  <span className="ml-1 text-xs font-normal opacity-75">
                    ({trimesterNames.length} trimestre{trimesterNames.length > 1 ? 's' : ''} · {totalItems} fiche{totalItems > 1 ? 's' : ''})
                  </span>
                </button>
                {!isLevelCollapsed && (
                  <div className="bg-white border-t border-slate-200 p-3 space-y-2">
                    {trimesterNames.map(trimester => {
                      const classes = trimesters[trimester];
                      const classNames = Object.keys(classes).sort();
                      const trimesterItems = classNames.reduce((s, cn) => s + classes[cn].length, 0);
                      const trimesterKey = `${schoolLevel}::${trimester}`;
                      const isTrimesterCollapsed = collapsedTrimesters.has(trimesterKey);
                      return (
                        <div key={trimester} className="border border-indigo-100 rounded-lg overflow-hidden">
                          <button
                            onClick={() => toggleCollapse(setCollapsedTrimesters, trimesterKey)}
                            className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                          >
                            {isTrimesterCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-indigo-600" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />}
                            <Calendar className="h-4 w-4 text-indigo-600" />
                            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{trimester}</span>
                            <span className="ml-auto text-xs text-indigo-500">{trimesterItems} fiche(s) · {classNames.length} classe(s)</span>
                          </button>
                          {!isTrimesterCollapsed && (
                            <div className="p-2 space-y-2 bg-white">
                              {classNames.map(className => {
                                const classItems = classes[className];
                                const classKey = `${schoolLevel}::${trimester}::${className}`;
                                const isClassCollapsed = collapsedClasses.has(classKey);
                                return (
                                  <div key={className} className="border border-slate-200 rounded-lg overflow-hidden">
                                    <button
                                      onClick={() => toggleCollapse(setCollapsedClasses, classKey)}
                                      className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
                                    >
                                      {isClassCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-slate-600" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-600" />}
                                      <FileText className="h-4 w-4 text-slate-600" />
                                      <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">{className}</span>
                                      <span className="ml-auto text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full">
                                        {classItems.length}
                                      </span>
                                    </button>
                                    {!isClassCollapsed && (
                                      <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-3 bg-white">
                                        {classItems.map(item => {
                                          const sheetConfig = SHEET_TYPE_LABELS[item.sheetType] || { label: item.sheetType, icon: FileText, color: "bg-slate-100 text-slate-700" };
                                          const Icon = sheetConfig.icon || FileText;
                                          const dateField = item.lessonDate || item.adminDate;
                                          const dayLabel = dateField ? dayNames[new Date(dateField).getDay()] : '—';
                                          return (
                                            <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-white">
                                              <div className="flex items-start justify-between mb-2">
                                                <div className={cn("flex items-center gap-2 px-2 py-1 rounded text-xs font-bold", sheetConfig.color)}>
                                                  <Icon className="h-3 w-3" /> {sheetConfig.label}
                                                </div>
                                                <span className="text-xs text-slate-400">{dayLabel}{dateField ? ` ${formatDateFR(dateField)}` : ''}</span>
                                              </div>
                                              <p className="text-sm text-slate-600 line-clamp-2">
                                                {item.competence ? item.competence.replace(/<[^>]*>/g, '').substring(0, 80) + "..." : (item.titre || "—")}
                                              </p>
                                              <p className="text-xs text-slate-500 mt-1">
                                                {item.teacherFirstName} {item.teacherLastName}
                                              </p>
                                              {item.submittedAt && (
                                                <p className="text-[10px] text-slate-400 mt-1">Soumis le {formatDateTimeFR(item.submittedAt)}</p>
                                              )}
                                              {item.validatedAt && (
                                                <p className="text-[10px] text-emerald-600 mt-1">Validé le {formatDateTimeFR(item.validatedAt)}</p>
                                              )}
                                              {item.status === 'REJECTED' && item.rejectionReason && (
                                                <p className="text-[10px] text-red-600 mt-1">Motif : {item.rejectionReason.substring(0, 80)}{item.rejectionReason.length > 80 ? '…' : ''}</p>
                                              )}
                                              <div className="flex items-center gap-2 mt-3">
                                                <button onClick={() => handleView(item)}
                                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                                                  <Eye className="h-3 w-3" /> Voir
                                                </button>
                                                {item.status === 'SUBMITTED' && (
                                                  <button onClick={() => setModalItem(item)}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                                                    <CheckCircle2 className="h-3 w-3" /> Traiter
                                                  </button>
                                                )}
                                                {item.status !== 'SUBMITTED' && (
                                                  <span className={cn(
                                                    'px-2 py-1 text-[10px] font-bold uppercase rounded',
                                                    item.status === 'VALIDATED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                  )}>
                                                    {item.status === 'VALIDATED' ? '✓ Validée' : '✗ Rejetée'}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ValidationModal
        open={!!modalItem}
        onClose={() => setModalItem(null)}
        onValidate={handleValidate}
        title={`Fiche ${modalItem ? SHEET_TYPE_LABELS[modalItem.sheetType]?.label : ""}`}
      />
    </div>
  );
}

// ============================================================================
// Pending Registres d'Appel
// ============================================================================

function PendingRegistersTab({ tenantId, academicYearId, userId, refreshKey, onRefresh }: {
  tenantId: string; academicYearId: string; userId: string; refreshKey: number; onRefresh: () => void;
}) {
  // ⭐ Hook React Query partagé — cache 2 min, dégradation gracieuse
  const queryClient = useQueryClient();
  // ⭐ 3 sous-onglets : en attente (SUBMITTED) / validés (VALIDATED) / rejetés (REJECTED)
  const [statusTab, setStatusTab] = useState<'SUBMITTED' | 'VALIDATED' | 'REJECTED'>('SUBMITTED');
  const { data: items = [], isLoading: loading, refetch } = usePendingRegisters(academicYearId, statusTab);
  const [selected, setSelected] = useState<any>(null);
  const [modalItem, setModalItem] = useState<any>(null);
  // ⭐ États repliables (chevrons) pour la hiérarchie : schoolLevel → trimester → class
  const [collapsedSchoolLevels, setCollapsedSchoolLevels] = useState<Set<string>>(new Set());
  const [collapsedTrimesters, setCollapsedTrimesters] = useState<Set<string>>(new Set());
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

  // ⭐ Réinitialiser la sélection quand on change de sous-onglet
  useEffect(() => {
    setSelected(null);
    setModalItem(null);
  }, [statusTab]);

  const handleValidate = async (action: "VALIDATED" | "REJECTED", reason?: string) => {
    if (!modalItem) return;
    await pedagogySpaceService.validateAttendanceRegister(modalItem.id, {
      action,
      validatedBy: userId,
      rejectionReason: reason,
    });
    toast.success(action === "VALIDATED" ? "✅ Registre validé" : "Registre rejeté");
    onRefresh();
    queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "pending-registers"] });
    queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "dashboard"] });
  };

  const handleView = async (item: any) => {
    try {
      const data = await pedagogySpaceService.getAttendanceRegisterDetail(item.id);
      setSelected(data);
    } catch { toast.error("Erreur"); }
  };

  // ⭐ Toggle collapse/expand d'un niveau hiérarchique
  const toggleCollapse = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ⭐ Si un registre est sélectionné, afficher la vue détaillée in-page
  if (selected) {
    return (
      <AttendanceRegisterDirectorDetail
        register={selected}
        userId={userId}
        onBack={() => setSelected(null)}
        onValidated={() => {
          setSelected(null);
          onRefresh();
          refetch();
          queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "pending-registers"] });
          queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "dashboard"] });
        }}
      />
    );
  }

  // ⭐ Hiérarchisation : schoolLevel → trimester → class → items
  const getTrimester = (month: number): string => {
    if (month >= 9) return 'Trimestre 1';
    if (month >= 1 && month <= 3) return 'Trimestre 2';
    if (month >= 4 && month <= 6) return 'Trimestre 3';
    return 'Vacances (été)';
  };

  // Construire la structure hiérarchique à 3 niveaux
  const hierarchy: Record<string, Record<string, Record<string, any[]>>> = {};
  for (const item of items) {
    const schoolLevel = item.schoolLevelName || 'Autres';
    const trimester = getTrimester(item.month || 1);
    const className = item.classNameResolved || item.className || 'Sans classe';
    if (!hierarchy[schoolLevel]) hierarchy[schoolLevel] = {};
    if (!hierarchy[schoolLevel][trimester]) hierarchy[schoolLevel][trimester] = {};
    if (!hierarchy[schoolLevel][trimester][className]) hierarchy[schoolLevel][trimester][className] = [];
    hierarchy[schoolLevel][trimester][className].push(item);
  }

  // Ordonner les niveaux scolaires
  const levelOrder = ['Maternelle', 'Primaire', 'Secondaire', 'Collège', 'Lycée', 'Autres'];
  const sortedLevels = Object.keys(hierarchy).sort((a, b) => {
    const ia = levelOrder.indexOf(a); const ib = levelOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // Couleurs par niveau scolaire
  const levelColors: Record<string, string> = {
    Maternelle: 'text-pink-700 bg-pink-50 border-pink-200',
    Primaire: 'text-blue-700 bg-blue-50 border-blue-200',
    Secondaire: 'text-purple-700 bg-purple-50 border-purple-200',
    Collège: 'text-amber-700 bg-amber-50 border-amber-200',
    Lycée: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    Autres: 'text-slate-700 bg-slate-50 border-slate-200',
  };

  // ⭐ Helpers Tout déplier / Tout replier
  //    Rassemble toutes les clés des 3 niveaux hiérarchiques
  const allSchoolLevelKeys = sortedLevels;
  const allTrimesterKeys: string[] = [];
  const allClassKeys: string[] = [];
  for (const sl of sortedLevels) {
    for (const tr of Object.keys(hierarchy[sl])) {
      allTrimesterKeys.push(`${sl}::${tr}`);
      for (const cn of Object.keys(hierarchy[sl][tr])) {
        allClassKeys.push(`${sl}::${tr}::${cn}`);
      }
    }
  }
  const handleExpandAll = () => {
    setCollapsedSchoolLevels(new Set());
    setCollapsedTrimesters(new Set());
    setCollapsedClasses(new Set());
  };
  const handleCollapseAll = () => {
    setCollapsedSchoolLevels(new Set(allSchoolLevelKeys));
    setCollapsedTrimesters(new Set(allTrimesterKeys));
    setCollapsedClasses(new Set(allClassKeys));
  };

  // Statuts pour les sous-onglets
  const tabConfig = {
    SUBMITTED: { label: 'En attente', icon: Clock, color: 'text-blue-700 bg-blue-50' },
    VALIDATED: { label: 'Validés', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
    REJECTED: { label: 'Rejetés', icon: XCircle, color: 'text-red-700 bg-red-50' },
  };

  return (
    <div className="space-y-4">
      {/* ⭐ Sous-onglets statut : En attente / Validés / Rejetés */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {(Object.keys(tabConfig) as Array<keyof typeof tabConfig>).map(s => {
          const cfg = tabConfig[s];
          const Icon = cfg.icon;
          return (
            <button
              key={s}
              onClick={() => setStatusTab(s)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-all',
                statusTab === s
                  ? `${cfg.color} border-current`
                  : 'text-slate-500 hover:text-slate-700 border-transparent'
              )}
            >
              <Icon className="h-4 w-4" />
              {cfg.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">{items.length} élément(s)</span>
          {/* ⭐ Boutons Tout déplier / Tout replier */}
          <button
            onClick={handleExpandAll}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200"
            title="Tout déplier (afficher toutes les classes)"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" /> Tout déplier
          </button>
          <button
            onClick={handleCollapseAll}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200"
            title="Tout replier (masquer toutes les classes)"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" /> Tout replier
          </button>
          <button onClick={() => refetch()} className="p-2 hover:bg-slate-100 rounded-lg" title="Recharger">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          Registres d'Appel — {tabConfig[statusTab].label}
        </h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="font-medium text-slate-700">
            Aucun registre {statusTab === 'SUBMITTED' ? 'en attente' : statusTab === 'VALIDATED' ? 'validé' : 'rejeté'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {statusTab === 'SUBMITTED'
              ? "Les nouvelles soumissions apparaîtront ici."
              : statusTab === 'VALIDATED'
                ? "Les registres validés apparaîtront ici (historique)."
                : "Les registres rejetés apparaîtront ici (à corriger par les enseignants)."}
          </p>
        </div>
      ) : (
        // ⭐ Hiérarchie collapsible : schoolLevel → trimester → class → items
        <div className="space-y-3">
          {sortedLevels.map(schoolLevel => {
            const trimesters = hierarchy[schoolLevel];
            const trimesterNames = Object.keys(trimesters);
            const totalItems = trimesterNames.reduce(
              (s, t) => s + Object.values(trimesters[t]).reduce((cs, items) => cs + items.length, 0), 0
            );
            const isLevelCollapsed = collapsedSchoolLevels.has(schoolLevel);
            const levelColorClass = levelColors[schoolLevel] || levelColors.Autres;
            return (
              <div key={schoolLevel} className={cn('border rounded-lg overflow-hidden', levelColorClass.split(' ').slice(-1)[0])}>
                <button
                  onClick={() => toggleCollapse(setCollapsedSchoolLevels, schoolLevel)}
                  className={cn('w-full flex items-center gap-2 px-4 py-2.5 font-bold text-sm transition-colors', levelColorClass)}
                >
                  {isLevelCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <School className="h-5 w-5" />
                  <span>{schoolLevel}</span>
                  <span className="ml-1 text-xs font-normal opacity-75">
                    ({trimesterNames.length} trimestre{trimesterNames.length > 1 ? 's' : ''} · {totalItems} registre{totalItems > 1 ? 's' : ''})
                  </span>
                </button>
                {!isLevelCollapsed && (
                  <div className="bg-white border-t border-slate-200 p-3 space-y-2">
                    {trimesterNames.map(trimester => {
                      const classes = trimesters[trimester];
                      const classNames = Object.keys(classes).sort();
                      const trimesterItems = classNames.reduce((s, cn) => s + classes[cn].length, 0);
                      const trimesterKey = `${schoolLevel}::${trimester}`;
                      const isTrimesterCollapsed = collapsedTrimesters.has(trimesterKey);
                      return (
                        <div key={trimester} className="border border-indigo-100 rounded-lg overflow-hidden">
                          <button
                            onClick={() => toggleCollapse(setCollapsedTrimesters, trimesterKey)}
                            className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                          >
                            {isTrimesterCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-indigo-600" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />}
                            <Calendar className="h-4 w-4 text-indigo-600" />
                            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{trimester}</span>
                            <span className="ml-auto text-xs text-indigo-500">{trimesterItems} registre(s) · {classNames.length} classe(s)</span>
                          </button>
                          {!isTrimesterCollapsed && (
                            <div className="p-2 space-y-2 bg-white">
                              {classNames.map(className => {
                                const classItems = classes[className];
                                const classKey = `${schoolLevel}::${trimester}::${className}`;
                                const isClassCollapsed = collapsedClasses.has(classKey);
                                return (
                                  <div key={className} className="border border-slate-200 rounded-lg overflow-hidden">
                                    <button
                                      onClick={() => toggleCollapse(setCollapsedClasses, classKey)}
                                      className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
                                    >
                                      {isClassCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-slate-600" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-600" />}
                                      <ClipboardList className="h-4 w-4 text-slate-600" />
                                      <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">{className}</span>
                                      <span className="ml-auto text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full">
                                        {classItems.length}
                                      </span>
                                    </button>
                                    {!isClassCollapsed && (
                                      <div className="p-2 space-y-2 bg-white">
                                        {classItems.map(item => (
                                          <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300">
                                            <div className="flex-1 min-w-0">
                                              <p className="font-medium text-slate-900 text-sm">
                                                Registre de {MONTH_NAMES[item.month] || item.month} {item.year}
                                              </p>
                                              <p className="text-xs text-slate-500 mt-0.5">
                                                {item.teacherFirstName} {item.teacherLastName}
                                              </p>
                                              <div className="flex items-center gap-3 mt-1 text-xs">
                                                <span className="text-emerald-600 font-semibold">Présences: {item.pourcentagePresences ?? "—"}%</span>
                                                <span className="text-red-600 font-semibold">Absences: {item.pourcentageAbsences ?? "—"}%</span>
                                                <span className="text-slate-500">Demi-j: {item.demiJourneeMois ?? "—"}</span>
                                              </div>
                                              <p className="text-[10px] text-slate-400 mt-0.5">
                                                {item.submittedAt ? `Soumis le ${formatDateTimeFR(item.submittedAt)}` : ''}
                                                {item.validatedAt ? ` · Validé le ${formatDateTimeFR(item.validatedAt)}` : ''}
                                                {item.status === 'REJECTED' && item.rejectionReason ? ` · Motif : ${item.rejectionReason.substring(0, 80)}${item.rejectionReason.length > 80 ? '…' : ''}` : ''}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                              <button onClick={() => handleView(item)}
                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                                                <Eye className="h-3 w-3" /> Voir
                                              </button>
                                              {item.status === 'SUBMITTED' && (
                                                <button onClick={() => setModalItem(item)}
                                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                                                  <CheckCircle2 className="h-3 w-3" /> Traiter
                                                </button>
                                              )}
                                              {item.status !== 'SUBMITTED' && (
                                                <span className={cn(
                                                  'px-2 py-1 text-[10px] font-bold uppercase rounded',
                                                  item.status === 'VALIDATED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                )}>
                                                  {item.status === 'VALIDATED' ? '✓ Validé' : '✗ Rejeté'}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ValidationModal
        open={!!modalItem}
        onClose={() => setModalItem(null)}
        onValidate={handleValidate}
        title={`Registre ${modalItem ? MONTH_NAMES[modalItem.month] + " " + modalItem.year : ""}`}
      />
    </div>
  );
}

// ============================================================================
// Pending Evaluations Mensuelles
// ============================================================================

function PendingEvaluationsTab({ tenantId, academicYearId, userId, refreshKey, onRefresh }: {
  tenantId: string; academicYearId: string; userId: string; refreshKey: number; onRefresh: () => void;
}) {
  // ⭐ Hook React Query partagé — cache 2 min, dégradation gracieuse
  const queryClient = useQueryClient();
  // ⭐ 3 sous-onglets : en attente (SUBMITTED) / validés (VALIDATED) / rejetés (REJECTED)
  const [statusTab, setStatusTab] = useState<'SUBMITTED' | 'VALIDATED' | 'REJECTED'>('SUBMITTED');
  const { data: items = [], isLoading: loading, refetch } = usePendingEvaluations(academicYearId, statusTab);
  const [selected, setSelected] = useState<any>(null);
  const [modalItem, setModalItem] = useState<any>(null);
  // ⭐ États repliables (chevrons) pour la hiérarchie : schoolLevel → trimester → class
  const [collapsedSchoolLevels, setCollapsedSchoolLevels] = useState<Set<string>>(new Set());
  const [collapsedTrimesters, setCollapsedTrimesters] = useState<Set<string>>(new Set());
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

  // ⭐ Réinitialiser la sélection quand on change de sous-onglet
  useEffect(() => {
    setSelected(null);
    setModalItem(null);
  }, [statusTab]);

  const handleValidate = async (action: "VALIDATED" | "REJECTED", reason?: string) => {
    if (!modalItem) return;
    await pedagogySpaceService.validateMonthlyEvaluation(modalItem.id, {
      action,
      validatedBy: userId,
      rejectionReason: reason,
    });
    toast.success(action === "VALIDATED" ? "✅ Évaluation validée" : "Évaluation rejetée");
    onRefresh();
    queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "pending-evaluations"] });
    queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "dashboard"] });
  };

  const handleView = async (item: any) => {
    try {
      const data = await pedagogySpaceService.getMonthlyEvaluationDetail(item.id);
      setSelected(data);
    } catch { toast.error("Erreur"); }
  };

  // ⭐ Si une évaluation est sélectionnée, afficher la vue détaillée in-page
  if (selected) {
    return (
      <MonthlyEvaluationDirectorDetail
        evaluation={selected}
        userId={userId}
        onBack={() => setSelected(null)}
        onValidated={() => {
          setSelected(null);
          onRefresh();
          refetch();
          queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "pending-evaluations"] });
          queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "dashboard"] });
        }}
      />
    );
  }

  // ⭐ Toggle collapse/expand d'un niveau hiérarchique
  const toggleCollapse = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ⭐ Hiérarchisation : schoolLevel → trimester → class → items
  const getTrimester = (month: number): string => {
    if (month >= 9) return 'Trimestre 1';
    if (month >= 1 && month <= 3) return 'Trimestre 2';
    if (month >= 4 && month <= 6) return 'Trimestre 3';
    return 'Vacances (été)';
  };

  // Construire la structure hiérarchique à 3 niveaux
  const hierarchy: Record<string, Record<string, Record<string, any[]>>> = {};
  for (const item of items) {
    const schoolLevel = item.schoolLevelName || 'Autres';
    const m = item.registerMonth || item.month || 1;
    const trimester = getTrimester(m);
    const className = item.classNameResolved || item.className || 'Sans classe';
    if (!hierarchy[schoolLevel]) hierarchy[schoolLevel] = {};
    if (!hierarchy[schoolLevel][trimester]) hierarchy[schoolLevel][trimester] = {};
    if (!hierarchy[schoolLevel][trimester][className]) hierarchy[schoolLevel][trimester][className] = [];
    hierarchy[schoolLevel][trimester][className].push(item);
  }

  // Ordonner les niveaux scolaires
  const levelOrder = ['Maternelle', 'Primaire', 'Secondaire', 'Collège', 'Lycée', 'Autres'];
  const sortedLevels = Object.keys(hierarchy).sort((a, b) => {
    const ia = levelOrder.indexOf(a); const ib = levelOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // Couleurs par niveau scolaire
  const levelColors: Record<string, string> = {
    Maternelle: 'text-pink-700 bg-pink-50 border-pink-200',
    Primaire: 'text-blue-700 bg-blue-50 border-blue-200',
    Secondaire: 'text-purple-700 bg-purple-50 border-purple-200',
    Collège: 'text-amber-700 bg-amber-50 border-amber-200',
    Lycée: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    Autres: 'text-slate-700 bg-slate-50 border-slate-200',
  };

  // ⭐ Helpers Tout déplier / Tout replier
  const allSchoolLevelKeys = sortedLevels;
  const allTrimesterKeys: string[] = [];
  const allClassKeys: string[] = [];
  for (const sl of sortedLevels) {
    for (const tr of Object.keys(hierarchy[sl])) {
      allTrimesterKeys.push(`${sl}::${tr}`);
      for (const cn of Object.keys(hierarchy[sl][tr])) {
        allClassKeys.push(`${sl}::${tr}::${cn}`);
      }
    }
  }
  const handleExpandAll = () => {
    setCollapsedSchoolLevels(new Set());
    setCollapsedTrimesters(new Set());
    setCollapsedClasses(new Set());
  };
  const handleCollapseAll = () => {
    setCollapsedSchoolLevels(new Set(allSchoolLevelKeys));
    setCollapsedTrimesters(new Set(allTrimesterKeys));
    setCollapsedClasses(new Set(allClassKeys));
  };

  // Statuts pour les sous-onglets
  const tabConfig = {
    SUBMITTED: { label: 'En attente', icon: Clock, color: 'text-blue-700 bg-blue-50' },
    VALIDATED: { label: 'Validées', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
    REJECTED: { label: 'Rejetées', icon: XCircle, color: 'text-red-700 bg-red-50' },
  };

  return (
    <div className="space-y-4">
      {/* ⭐ Sous-onglets statut : En attente / Validées / Rejetées */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {(Object.keys(tabConfig) as Array<keyof typeof tabConfig>).map(s => {
          const cfg = tabConfig[s];
          const Icon = cfg.icon;
          return (
            <button
              key={s}
              onClick={() => setStatusTab(s)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-all',
                statusTab === s
                  ? `${cfg.color} border-current`
                  : 'text-slate-500 hover:text-slate-700 border-transparent'
              )}
            >
              <Icon className="h-4 w-4" />
              {cfg.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">{items.length} élément(s)</span>
          {/* ⭐ Boutons Tout déplier / Tout replier */}
          <button
            onClick={handleExpandAll}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200"
            title="Tout déplier (afficher toutes les classes)"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" /> Tout déplier
          </button>
          <button
            onClick={handleCollapseAll}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200"
            title="Tout replier (masquer toutes les classes)"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" /> Tout replier
          </button>
          <button onClick={() => refetch()} className="p-2 hover:bg-slate-100 rounded-lg" title="Recharger">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          Évaluations Mensuelles — {tabConfig[statusTab].label}
        </h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="font-medium text-slate-700">
            Aucune évaluation {statusTab === 'SUBMITTED' ? 'en attente' : statusTab === 'VALIDATED' ? 'validée' : 'rejetée'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {statusTab === 'SUBMITTED'
              ? "Les nouvelles soumissions apparaîtront ici."
              : statusTab === 'VALIDATED'
                ? "Les évaluations validées apparaîtront ici (historique)."
                : "Les évaluations rejetées apparaîtront ici (à corriger par les enseignants)."}
          </p>
        </div>
      ) : (
        // ⭐ Hiérarchie collapsible : schoolLevel → trimester → class → items
        <div className="space-y-3">
          {sortedLevels.map(schoolLevel => {
            const trimesters = hierarchy[schoolLevel];
            const trimesterNames = Object.keys(trimesters);
            const totalItems = trimesterNames.reduce(
              (s, t) => s + Object.values(trimesters[t]).reduce((cs, items) => cs + items.length, 0), 0
            );
            const isLevelCollapsed = collapsedSchoolLevels.has(schoolLevel);
            const levelColorClass = levelColors[schoolLevel] || levelColors.Autres;
            return (
              <div key={schoolLevel} className={cn('border rounded-lg overflow-hidden', levelColorClass.split(' ').slice(-1)[0])}>
                <button
                  onClick={() => toggleCollapse(setCollapsedSchoolLevels, schoolLevel)}
                  className={cn('w-full flex items-center gap-2 px-4 py-2.5 font-bold text-sm transition-colors', levelColorClass)}
                >
                  {isLevelCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <School className="h-5 w-5" />
                  <span>{schoolLevel}</span>
                  <span className="ml-1 text-xs font-normal opacity-75">
                    ({trimesterNames.length} trimestre{trimesterNames.length > 1 ? 's' : ''} · {totalItems} évaluation{totalItems > 1 ? 's' : ''})
                  </span>
                </button>
                {!isLevelCollapsed && (
                  <div className="bg-white border-t border-slate-200 p-3 space-y-2">
                    {trimesterNames.map(trimester => {
                      const classes = trimesters[trimester];
                      const classNames = Object.keys(classes).sort();
                      const trimesterItems = classNames.reduce((s, cn) => s + classes[cn].length, 0);
                      const trimesterKey = `${schoolLevel}::${trimester}`;
                      const isTrimesterCollapsed = collapsedTrimesters.has(trimesterKey);
                      return (
                        <div key={trimester} className="border border-indigo-100 rounded-lg overflow-hidden">
                          <button
                            onClick={() => toggleCollapse(setCollapsedTrimesters, trimesterKey)}
                            className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                          >
                            {isTrimesterCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-indigo-600" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />}
                            <Calendar className="h-4 w-4 text-indigo-600" />
                            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{trimester}</span>
                            <span className="ml-auto text-xs text-indigo-500">{trimesterItems} évaluation(s) · {classNames.length} classe(s)</span>
                          </button>
                          {!isTrimesterCollapsed && (
                            <div className="p-2 space-y-2 bg-white">
                              {classNames.map(className => {
                                const classItems = classes[className];
                                const classKey = `${schoolLevel}::${trimester}::${className}`;
                                const isClassCollapsed = collapsedClasses.has(classKey);
                                return (
                                  <div key={className} className="border border-slate-200 rounded-lg overflow-hidden">
                                    <button
                                      onClick={() => toggleCollapse(setCollapsedClasses, classKey)}
                                      className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
                                    >
                                      {isClassCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-slate-600" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-600" />}
                                      <BookOpen className="h-4 w-4 text-slate-600" />
                                      <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">{className}</span>
                                      <span className="ml-auto text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full">
                                        {classItems.length}
                                      </span>
                                    </button>
                                    {!isClassCollapsed && (
                                      <div className="p-2 space-y-2 bg-white">
                                        {classItems.map(item => (
                                          <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300">
                                            <div className="flex-1 min-w-0">
                                              <p className="font-medium text-slate-900 text-sm">
                                                Évaluation N°{item.evaluationNumber || "—"} — {MONTH_NAMES[item.registerMonth || item.month] || "—"} {item.registerYear || item.year}
                                              </p>
                                              <p className="text-xs text-slate-500 mt-0.5">
                                                {item.teacherFirstName} {item.teacherLastName}
                                              </p>
                                              <div className="flex items-center gap-3 mt-1 text-xs">
                                                <span className="text-blue-600 font-semibold">% réussite total: {item.pourcentageReussiteTotal?.toFixed?.(1) ?? item.pourcentageReussiteTotal ?? "—"}%</span>
                                                <span className="text-emerald-600">Atteint: {item.ayantAtteintSeuilTotal ?? "—"}/{item.ayantComposeTotal ?? "—"}</span>
                                                <span className="text-slate-500">Seuil: {item.seuilReussite ?? 10}/20</span>
                                              </div>
                                              <p className="text-[10px] text-slate-400 mt-0.5">
                                                {item.submittedAt ? `Soumis le ${formatDateTimeFR(item.submittedAt)}` : ''}
                                                {item.validatedAt ? ` · Validé le ${formatDateTimeFR(item.validatedAt)}` : ''}
                                                {item.status === 'REJECTED' && item.rejectionReason ? ` · Motif : ${item.rejectionReason.substring(0, 80)}${item.rejectionReason.length > 80 ? '…' : ''}` : ''}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                              <button onClick={() => handleView(item)}
                                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                                                <Eye className="h-3 w-3" /> Voir
                                              </button>
                                              {item.status === 'SUBMITTED' && (
                                                <button onClick={() => setModalItem(item)}
                                                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                                                  <CheckCircle2 className="h-3 w-3" /> Traiter
                                                </button>
                                              )}
                                              {item.status !== 'SUBMITTED' && (
                                                <span className={cn(
                                                  'px-2 py-1 text-[10px] font-bold uppercase rounded',
                                                  item.status === 'VALIDATED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                )}>
                                                  {item.status === 'VALIDATED' ? '✓ Validée' : '✗ Rejetée'}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ValidationModal
        open={!!modalItem}
        onClose={() => setModalItem(null)}
        onValidate={handleValidate}
        title={`Évaluation — ${modalItem ? MONTH_NAMES[modalItem.registerMonth || modalItem.month] : ""}`}
      />
    </div>
  );
}

// ============================================================================
// ⭐ CahierJournalDirectorDetail — Vue détaillée in-page (pas un modal)
//    Identique à l'interface enseignant, mais avec :
//    - Observations directeur par jour (en rouge)
//    - Observation générale de la semaine (éditeur riche)
//    - Signature directeur obligatoire
//    - Bouton Valider / Rejeter
// ============================================================================

const CJ_DAYS = [
  { id: 1, key: "lundi", label: "LUNDI" },
  { id: 2, key: "mardi", label: "MARDI" },
  { id: 3, key: "mercredi", label: "MERCREDI" },
  { id: 4, key: "jeudi", label: "JEUDI" },
  { id: 5, key: "vendredi", label: "VENDREDI" },
] as const;

function CahierJournalDirectorDetail({
  journal,
  userId,
  onBack,
  onValidated,
}: {
  journal: any;
  userId: string;
  onBack: () => void;
  onValidated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [sendingToTeacher, setSendingToTeacher] = useState(false);
  const [hasBeenSent, setHasBeenSent] = useState(false); // ⭐ Track si notification déjà envoyée
  const [directorSignature, setDirectorSignature] = useState<string | null>(journal.directorSignature || null);
  const [directorGeneralObservation, setDirectorGeneralObservation] = useState<string>(journal.observations || "");
  const [directorObservations, setDirectorObservations] = useState<Record<string, string>>({});
  const [dynamicSubjects, setDynamicSubjects] = useState<any[]>([]);
  // ⭐ Modale de confirmation professionnelle personnalisée (remplace window.confirm)
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; action: 'VALIDATED' | 'REJECTED' | null }>({ open: false, action: null });
  // ⭐ Fiches pédagogiques rattachées au cahier journal (vue hiérarchique par jour)
  const [fichesData, setFichesData] = useState<any>(null);
  const [fichesLoading, setFichesLoading] = useState(false);
  const [exportingFiche, setExportingFiche] = useState<string | null>(null);
  // ⭐ Fiche sélectionnée pour affichage détaillé (vue PedagogicalFicheDirectorDetail)
  //    Pattern identique à PendingFichesTab : handleView() charge la fiche détaillée
  //    puis le composant bascule vers PedagogicalFicheDirectorDetail.
  const [selectedFiche, setSelectedFiche] = useState<any>(null);
  const [loadingFicheId, setLoadingFicheId] = useState<string | null>(null);

  // ⭐ Charger les fiches pédagogiques rattachées à ce cahier journal
  //    ⚠️ Utiliser fetch() (BFF proxy) au lieu de apiClient.get() (direct backend)
  //    car le BFF proxy gère l'auth via cookies (getProxyAuthHeaders), tandis que
  //    apiClient.get() utilise le token localStorage qui peut être stale.
  useEffect(() => {
    if (!journal.id) return;
    let cancelled = false;
    (async () => {
      setFichesLoading(true);
      try {
        const res = await fetch(`/api/pedagogy-space/cahier-journal/${journal.id}/fiches`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setFichesData(data);
      } catch {
        if (!cancelled) setFichesData(null);
      } finally {
        if (!cancelled) setFichesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [journal.id]);

  // ⭐ Voir une fiche pédagogique en détail (pattern identique à PendingFichesTab)
  //    Charge la fiche complète via pedagogySpaceService.getPedagogicalFicheDetail
  //    puis bascule l'affichage vers PedagogicalFicheDirectorDetail.
  //    Le directeur peut alors voir tous les champs + valider/rejeter.
  const handleViewFiche = async (ficheId: string) => {
    setLoadingFicheId(ficheId);
    try {
      const data = await pedagogySpaceService.getPedagogicalFicheDetail(ficheId);
      setSelectedFiche(data);
    } catch (e: any) {
      toast.error("Erreur", { description: e.message || "Impossible de charger la fiche." });
    } finally {
      setLoadingFicheId(null);
    }
  };

  // ⭐ Export PDF d'une fiche individuelle
  const handleExportFiche = async (ficheId: string) => {
    setExportingFiche(ficheId);
    try {
      const res = await fetch(`/api/pedagogy-space/fiches/${ficheId}/export-pdf`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erreur export');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fiche_pedagogique_${ficheId.substring(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error('Erreur export PDF', { description: e.message });
    } finally {
      setExportingFiche(null);
    }
  };

  // ⭐ Export PDF de TOUTES les fiches du cahier journal
  const handleExportAllFiches = async () => {
    setExportingFiche('ALL');
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-journal/${journal.id}/fiches/export-pdf`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erreur export');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fiches_cahier_journal_${(journal.classNameResolved || 'classe').replace(/\s+/g, '_')}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error('Erreur export PDF', { description: e.message });
    } finally {
      setExportingFiche(null);
    }
  };

  // ⭐ Parser les entries
  let entries: Record<string, Record<string, string>> = {};
  if (journal.entries) {
    if (typeof journal.entries === "string") {
      try { entries = JSON.parse(journal.entries); } catch { entries = {}; }
    } else {
      entries = journal.entries;
    }
  }

  // ⭐ Charger les matières dynamiques depuis l'API (comme CahierJournalTab)
  //    ⚠️ Ne PAS passer teacherId — le directeur doit voir TOUTES les matières
  //    de la classe (pas seulement celles de l'enseignant connecté).
  //    Si on passe teacherId, l'API filtre par piste linguistique et enseignant,
  //    ce qui masque les matières non assignées à cet enseignant spécifique.
  useEffect(() => {
    if (!journal.classId || !journal.academicYearId) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy-space/subjects/available?academicYearId=${journal.academicYearId}&classId=${journal.classId}`,
          { credentials: "include" }
        );
        const data = await res.json();
        setDynamicSubjects(Array.isArray(data) ? data : []);
      } catch {
        setDynamicSubjects([]);
      }
    })();
  }, [journal.id, journal.classId, journal.academicYearId]);

  // ⭐ Initialiser les observations du directeur depuis les entries existantes
  useEffect(() => {
    const obs: Record<string, string> = {};
    for (const day of CJ_DAYS) {
      const dayEntry = entries[day.key];
      if (dayEntry?.directorObservation) {
        obs[day.key] = dayEntry.directorObservation;
      }
    }
    setDirectorObservations(obs);
  }, [journal.id]);

  // ⭐ REGROUPEMENT DES MATIÈRES (identique à CahierJournalTab)
  const SUBJECT_GROUPS: { groupName: string; subjects: string[] }[] = [
    {
      groupName: "Français",
      subjects: [
        "Dictée", "Grammaire", "Exercices structuraux", "Conjugaison",
        "Communication orale", "Orthographe", "Lecture", "Vocabulaire",
        "Expression écrite", "Graphisme", "Écriture", "Combinatoire",
        "Dictee", "Exercices Structuraux", "Communication Orale",
        "Expression Ecrite",
      ],
    },
    {
      groupName: "Éducation sociale",
      subjects: [
        "Morale", "Civisme", "Histoire", "Géographie", "Geographie",
        "Education sociale", "Éducation sociale",
      ],
    },
    {
      groupName: "Éducation artistique",
      subjects: [
        "Chant", "Poésie", "Dessin", "Compte", "Couture", "Atelier",
        "Art dramatique", "Éducation artistique plastique",
        "Éducation artistique vivante", "Education artistique plastique",
        "Education artistique vivante", "Poesie",
      ],
    },
  ];

  type TableColumn =
    | { type: "group"; groupName: string; subjects: any[] }
    | { type: "single"; subject: any };

  // ⭐ Transformer la liste plate de matières en colonnes (groupées ou individuelles)
  const groupedColumns: TableColumn[] = (() => {
    const used = new Set<string>();
    const result: TableColumn[] = [];

    for (const group of SUBJECT_GROUPS) {
      const matchingSubjects = dynamicSubjects.filter((s: any) => {
        const name = (s.subjectName || "").trim().toLowerCase();
        return group.subjects.some(g => g.trim().toLowerCase() === name);
      });
      if (matchingSubjects.length > 0) {
        result.push({ type: "group", groupName: group.groupName, subjects: matchingSubjects });
        matchingSubjects.forEach((s: any) => used.add(s.subjectId));
      }
    }

    for (const s of dynamicSubjects) {
      if (!used.has(s.subjectId)) {
        result.push({ type: "single", subject: s });
      }
    }

    return result;
  })();

  // ⭐ Si pas de matières dynamiques, utiliser les colonnes depuis entries
  const fallbackColumns: string[] = (() => {
    const cols = new Set<string>();
    for (const day of CJ_DAYS) {
      const dayEntries = entries[day.key] || {};
      for (const key of Object.keys(dayEntries)) {
        if (key !== "observations" && key !== "directorObservation") cols.add(key);
      }
    }
    return Array.from(cols);
  })();

  // ⭐ Utiliser les colonnes dynamiques si disponibles, sinon fallback
  const hasDynamicSubjects = dynamicSubjects.length > 0;
  const columnsToUse = hasDynamicSubjects ? groupedColumns : fallbackColumns.map(c => ({ type: "single" as const, subject: { subjectName: c } }));

  // ⭐ Répartir en 2 pages (recto = première moitié, verso = seconde moitié)
  const halfIdx = Math.ceil(columnsToUse.length / 2);
  const rectoCols = columnsToUse.slice(0, halfIdx);
  const versoCols = columnsToUse.slice(halfIdx);

  const getColumnKey = (col: any): string => {
    if (col.type === "group") return col.groupName;
    return col.subject.subjectName;
  };

  const getColumnSubLabels = (col: any): string[] => {
    if (col.type === "group") {
      return col.subjects.map((s: any) => s.subjectName);
    }
    return [];
  };

  const getEntry = (dayKey: string, colKey: string): string => {
    return entries[dayKey]?.[colKey] || "";
  };

  const formatDate = (d: string | Date) => new Date(d).toLocaleDateString('fr-FR');

  // ⭐ Sauvegarder les observations SANS valider/rejeter
  //    Le directeur peut enregistrer ses observations et sa signature
  //    pour revenir plus tard valider.
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-journal/${journal.id}/director-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          directorObservations,
          directorGeneralObservation,
          directorSignature,
          // Pas d'action → sauvegarde simple sans changer le statut
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      toast.success('✅ Observations enregistrées', {
        description: 'Vos observations et signature sont sauvegardées. Vous pouvez valider plus tard.',
      });
    } catch (err: any) {
      toast.error('Erreur lors de la sauvegarde', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async (action: 'VALIDATED' | 'REJECTED') => {
    if (action === 'VALIDATED' && !directorSignature) {
      toast.error("Signature obligatoire", {
        description: "Vous devez signer avant de valider le cahier journal.",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-journal/${journal.id}/director-update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          directorObservations,
          directorGeneralObservation,
          directorSignature,
          action,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      toast.success(action === 'VALIDATED' ? '✅ Cahier journal validé' : 'Cahier journal rejeté', {
        description: action === 'VALIDATED'
          ? "L'enseignant a été notifié et recevra la version validée avec votre signature. Utilisez le bouton 'Envoyer à l'enseignant' pour renvoyer la notification si besoin."
          : "L'enseignant a été notifié du rejet.",
      });
      setHasBeenSent(true);
      onValidated();
    } catch (err: any) {
      toast.error('Erreur lors de la validation', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ⭐ openConfirmModal — ouvre la modale de confirmation professionnelle personnalisée
  //    Remplace le window.confirm() générique par une modale branded
  const openConfirmModal = (action: 'VALIDATED' | 'REJECTED') => {
    if (action === 'VALIDATED' && !directorSignature) {
      toast.error("Signature obligatoire", {
        description: "Vous devez signer avant de valider le cahier journal.",
      });
      return;
    }
    setConfirmModal({ open: true, action });
  };

  // ⭐ handleConfirmValidation — appelée quand l'utilisateur confirme dans la modale personnalisée
  const handleConfirmValidation = () => {
    const action = confirmModal.action;
    if (!action) return;
    setConfirmModal({ open: false, action: null });
    handleValidate(action);
  };

  // ⭐ handleSendToTeacher — envoie manuel de notification à l'enseignant
  //    Appelle POST /cahier-journal/:id/send-to-teacher
  //    Permet de re-notifier (rappel) sans changer le statut
  const handleSendToTeacher = async () => {
    setSendingToTeacher(true);
    try {
      const res = await fetch(`/api/pedagogy-space/cahier-journal/${journal.id}/send-to-teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      toast.success('📧 Notification envoyée à l'enseignant', {
        description: `L'enseignant recevra ${journal.status === 'VALIDATED' ? 'la version validée' : 'le rejet'} avec vos observations par email, WhatsApp et SMS.`,
      });
      setHasBeenSent(true);
    } catch (err: any) {
      toast.error('Erreur lors de l'envoi', { description: err.message });
    } finally {
      setSendingToTeacher(false);
    }
  };

  const renderPage = (pageCols: any[], pageTitle: string) => (
    <div className="mb-6">
      <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">{pageTitle}</div>
      <div className="overflow-x-auto border border-slate-300 rounded-lg">
        <table className="w-full border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase w-16 sticky left-0 bg-slate-100 z-10">
                JOURS
              </th>
              {pageCols.map((col, idx) => {
                const key = getColumnKey(col);
                const subLabels = getColumnSubLabels(col);
                return (
                  <th key={idx} className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase align-top" style={{ minWidth: "180px" }}>
                    <div className="font-bold">{key}</div>
                    {subLabels.length > 0 && (
                      <div className="mt-1 pt-1 border-t border-slate-300 text-[9px] font-normal text-slate-500 normal-case">
                        {subLabels.map((label, i) => (
                          <span key={i}>
                            {i > 0 && <span className="text-slate-300"> · </span>}
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </th>
                );
              })}
              <th className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase align-top bg-amber-50" style={{ minWidth: "160px" }}>
                OBS. DIRECTEUR <span className="text-red-600">(rouge)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {CJ_DAYS.map((day) => {
              const weekStart = new Date(journal.weekStartDate);
              const dayDate = new Date(weekStart.getTime() + (day.id - 1) * 86400000);
              return (
                <tr key={day.key} className="hover:bg-slate-50">
                  <td className="border border-slate-300 px-2 py-2 text-xs font-bold text-slate-700 uppercase bg-slate-50 sticky left-0 z-10">
                    {day.label}
                    <div className="text-[10px] text-slate-400 mt-1 font-normal">
                      {dayDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    </div>
                  </td>
                  {pageCols.map((col, idx) => {
                    const key = getColumnKey(col);
                    const content = getEntry(day.key, key);
                    return (
                      <td key={idx} className="border border-slate-300 px-2 py-1 text-xs text-slate-700 align-top" style={{ minHeight: "60px" }}>
                        {content ? (
                          <div dangerouslySetInnerHTML={{ __html: content }} />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  {/* ⭐ Colonne observation directeur (éditable, texte rouge) */}
                  <td className="border border-slate-300 p-0 bg-red-50/30">
                    <textarea
                      value={directorObservations[day.key] || ''}
                      onChange={(e) => setDirectorObservations(prev => ({ ...prev, [day.key]: e.target.value }))}
                      disabled={saving}
                      placeholder="Observation du directeur..."
                      className="w-full h-full px-2 py-1 text-xs text-red-700 font-semibold border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
                      style={{ minHeight: "60px" }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const isAlreadyValidated = journal.status === 'VALIDATED';
  const isAlreadyRejected = journal.status === 'REJECTED';

  // ⭐ Si une fiche est sélectionnée (bouton "Voir"), afficher la vue détaillée
  //    in-page PedagogicalFicheDirectorDetail — pattern identique à PendingFichesTab.
  //    Le directeur peut voir tous les champs de la fiche + valider/rejeter,
  //    puis revenir au cahier journal via le bouton "Retour au cahier journal".
  if (selectedFiche) {
    return (
      <PedagogicalFicheDirectorDetail
        fiche={selectedFiche}
        userId={userId}
        onBack={() => setSelectedFiche(null)}
        onValidated={() => {
          setSelectedFiche(null);
          // ⭐ Recharger les fiches du cahier journal pour refléter le nouveau statut
          if (journal.id) {
            (async () => {
              try {
                const res = await fetch(`/api/pedagogy-space/cahier-journal/${journal.id}/fiches`, {
                  credentials: 'include',
                  cache: 'no-store',
                });
                if (res.ok) setFichesData(await res.json());
              } catch { /* silent */ }
            })();
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ⭐ Modale de confirmation personnalisée (remplace window.confirm) */}
      {confirmModal.open && confirmModal.action && (() => {
        const isValidate = confirmModal.action === 'VALIDATED';
        const modalConfig = {
          title: isValidate ? 'Valider le cahier journal' : 'Rejeter le cahier journal',
          icon: isValidate
            ? <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            : <XCircle className="h-10 w-10 text-red-500" />,
          message: isValidate
            ? "Vous êtes sur le point de valider ce cahier journal."
            : "Vous êtes sur le point de rejeter ce cahier journal.",
          details: isValidate
            ? [
                "L'enseignant sera notifié immédiatement (email + WhatsApp + SMS)",
                "La version validée avec votre signature et vos observations sera envoyée",
                "L'enseignant verra le cahier journal comme « Validé » dans son espace pédagogique",
                "Vous pourrez re-notifier l'enseignant via le bouton « Envoyer à l'enseignant »",
              ]
            : [
                "L'enseignant sera notifié immédiatement (email + WhatsApp + SMS)",
                "L'enseignant verra le cahier journal comme « Rejeté » dans son espace pédagogique",
                "L'enseignant devra corriger le cahier journal et le resoumettre",
                "Vos observations seront visibles par l'enseignant pour lui indiquer les corrections à apporter",
              ],
          confirmLabel: isValidate ? '✓ Valider le cahier journal' : '✗ Rejeter le cahier journal',
          confirmClass: isValidate ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700',
        };
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* En-tête coloré */}
              <div className={cn('px-6 py-4 border-b', isValidate ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200')}>
                <div className="flex items-center gap-3">
                  {modalConfig.icon}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{modalConfig.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Action de validation direction</p>
                  </div>
                </div>
              </div>
              {/* Corps */}
              <div className="p-6 space-y-3">
                <p className="text-sm text-slate-700 font-medium">{modalConfig.message}</p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Conséquences :</p>
                  {modalConfig.details.map((d, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                      <ChevronRight className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                      <span>{d}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                  <strong>ℹ️ Cahier journal :</strong> {journal.classNameResolved || journal.className || '—'} · Semaine du {formatDate(journal.weekStartDate)} au {formatDate(journal.weekEndDate)}
                </div>
              </div>
              {/* Actions */}
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
                <button
                  onClick={() => setConfirmModal({ open: false, action: null })}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmValidation}
                  disabled={saving}
                  className={cn('flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-50', modalConfig.confirmClass)}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {modalConfig.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ⭐ Action bar */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Retour à la liste
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {isAlreadyValidated && (
            <span className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">
              ✓ Validé
            </span>
          )}
          {isAlreadyRejected && (
            <span className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-bold">
              ✗ Rejeté
            </span>
          )}
          {!isAlreadyValidated && !isAlreadyRejected && (
            <>
              {/* ⭐ Bouton Enregistrer (sans valider) — pour sauvegarder observations + signature */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                title="Enregistrer les observations sans valider"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
              <button
                onClick={() => openConfirmModal('REJECTED')}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Rejeter
              </button>
              <button
                onClick={() => openConfirmModal('VALIDATED')}
                disabled={saving || !directorSignature}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                title={!directorSignature ? "Signature obligatoire" : "Valider le cahier journal"}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {directorSignature ? 'Valider' : 'Signature requise'}
              </button>
            </>
          )}
          {/* ⭐ Bouton "Envoyer à l'enseignant" — visible après validation/rejet */}
          {(isAlreadyValidated || isAlreadyRejected) && (
            <button
              onClick={handleSendToTeacher}
              disabled={sendingToTeacher}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              title="Envoyer/Renvoyer la notification (email + WhatsApp + SMS) à l'enseignant avec votre décision et vos observations"
            >
              {sendingToTeacher ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {hasBeenSent ? 'Renvoyer à l\'enseignant' : 'Envoyer à l\'enseignant'}
            </button>
          )}
        </div>
      </div>

      {/* ⭐ En-tête du cahier journal (identique à l'enseignant) */}
      <div className="bg-white border-2 border-slate-800 rounded-xl p-4 text-center">
        <h2 className="text-lg font-bold text-slate-900">
          CAHIER JOURNAL — {journal.classNameResolved || journal.className || '—'}
        </h2>
        <div className="text-sm text-slate-600 mt-1">
          Semaine du <strong>{formatDate(journal.weekStartDate)}</strong> au <strong>{formatDate(journal.weekEndDate)}</strong>
        </div>
        <div className="text-xs text-slate-500 mt-1">
          Enseignant : {journal.teacherFirstName} {journal.teacherLastName}
          {" · "}Statut : <strong>{journal.status}</strong>
        </div>
      </div>

      {/* ⭐ Pages 1 + 2 (Recto + Verso) */}
      {columnsToUse.length === 0 ? (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center text-sm text-slate-500">
          Aucune matière configurée pour cette classe.
        </div>
      ) : (
        <>
          {rectoCols.length > 0 && renderPage(rectoCols, "Page 1 — Recto")}
          {versoCols.length > 0 && renderPage(versoCols, "Page 2 — Verso")}
        </>
      )}

      {/* ⭐ Observation générale de la semaine (éditeur riche) */}
      <div className="bg-white border-2 border-slate-300 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase">Observation générale de la semaine</h3>
        <RichTextEditor
          value={directorGeneralObservation}
          onChange={(html) => setDirectorGeneralObservation(html)}
          disabled={saving || isAlreadyValidated}
          placeholder="Saisissez vos observations générales pour cette semaine..."
          minHeight="120px"
        />
      </div>

      {/* ⭐ Signatures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t-2 border-slate-300">
        <div className="space-y-2">
          <div className="text-sm font-bold text-slate-800">Le Titulaire de la classe</div>
          <div className="text-xs text-slate-500">{journal.teacherFirstName} {journal.teacherLastName} — Signature</div>
          {journal.teacherSignature ? (
            <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
              <img src={journal.teacherSignature} alt="Signature Titulaire" className="max-h-24 mx-auto" />
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl p-4 text-center text-xs text-slate-400 italic">
              Non signé par l'enseignant
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-800">Le Directeur / La Directrice</div>
              <div className="text-xs text-slate-500">Signature et cachet {isAlreadyValidated ? '' : '(obligatoire)'}</div>
            </div>
            {directorSignature && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                <CheckCircle2 className="h-3 w-3" /> Signé
              </span>
            )}
          </div>
          {directorSignature ? (
            <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2 relative">
              <img src={directorSignature} alt="Signature Directeur" className="max-h-24 mx-auto" />
              {!isAlreadyValidated && (
                <button
                  type="button"
                  onClick={() => setDirectorSignature(null)}
                  className="absolute top-1 right-1 text-xs text-red-500 hover:underline"
                >
                  Effacer
                </button>
              )}
            </div>
          ) : (
            <SignatureCanvas
              width={400}
              height={120}
              disabled={saving || isAlreadyValidated}
              placeholder="Signature du Directeur (obligatoire pour valider)"
              onSignatureChange={(data) => setDirectorSignature(data)}
            />
          )}
        </div>
      </div>

      {/* ⭐ FICHES PÉDAGOGIQUES RATTACHÉES — Vue hiérarchique par jour
          Pattern identique à FichesLieesJournal côté enseignant (CahierJournalFichesContainer) :
          - Bandeau récapitulatif (X/Y matières ont leur fiche · Z fiche(s) au total)
          - Regroupement par jour (lundi → vendredi)
          - Chaque fiche a un badge couleur (SHEET_TYPE_LABELS) + statut + boutons "Voir" + "PDF"
          - Bouton "Voir" → handleViewFiche → PedagogicalFicheDirectorDetail (vue détaillée + validation) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              Fiches Pédagogiques Jointes
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {fichesData?.stats
                ? `${fichesData.stats.totalFiches || 0} fiche(s) au total · ${fichesData.stats.totalFichesPreparees || 0}/${fichesData.stats.totalMatieresPlanifiees || 0} matières ont leur fiche`
                : 'Chargement…'}
            </p>
          </div>
          {fichesData?.fiches && fichesData.fiches.length > 0 && (
            <button
              onClick={handleExportAllFiches}
              disabled={exportingFiche === 'ALL'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {exportingFiche === 'ALL' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              Tout exporter en PDF
            </button>
          )}
        </div>

        {fichesLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : !fichesData?.fiches || fichesData.fiches.length === 0 ? (
          <div className="text-center py-6 text-sm text-slate-400">
            <FileText className="h-8 w-8 text-slate-200 mx-auto mb-2" />
            Aucune fiche pédagogique jointe à ce cahier journal.
          </div>
        ) : (
          /* ⭐ Affichage hiérarchique : par jour → par matière */
          <div className="space-y-3">
            {['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'].map(day => {
              const dayFiches = fichesData.parJour?.[day] || [];
              if (dayFiches.length === 0) return null;
              const dayLabels: Record<string, string> = {
                lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi', vendredi: 'Vendredi',
              };
              return (
                <div key={day} className="border border-slate-200 rounded-lg p-3 bg-emerald-50/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                    <h4 className="text-xs font-bold uppercase text-slate-700">{dayLabels[day]}</h4>
                    <span className="text-[10px] text-slate-400">{dayFiches.length} fiche(s)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {dayFiches.map((fiche: any) => {
                      // ⭐ Utiliser SHEET_TYPE_LABELS pour afficher le libellé complet
                      //    (ex: "Mathématiques" au lieu de "MATH")
                      const sheetInfo = SHEET_TYPE_LABELS[fiche.sheetType] || { label: fiche.sheetType, color: 'bg-slate-100 text-slate-700' };
                      const SheetIcon = sheetInfo.icon || FileText;
                      const ficheDate = fiche.lessonDate ? new Date(fiche.lessonDate) : null;
                      return (
                        <div key={fiche.id} className="flex items-center justify-between border border-emerald-200 rounded-lg p-2 bg-white">
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <SheetIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", sheetInfo.color)}>
                                  {sheetInfo.label}
                                </span>
                                <span className="text-[9px] text-slate-400">
                                  {fiche.status === 'SUBMITTED' ? '✓ Soumise' : fiche.status === 'VALIDATED' ? '✓ Validée' : 'Brouillon'}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-slate-700 truncate">
                                {fiche.titre || fiche.cours || 'Sans titre'}
                              </p>
                              {ficheDate && (
                                <p className="text-[9px] text-slate-400">
                                  {ficheDate.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            {/* ⭐ Bouton "Voir" — pattern identique à PendingFichesTab
                                Ouvre PedagogicalFicheDirectorDetail (vue détaillée + validation/rejet) */}
                            <button
                              onClick={() => handleViewFiche(fiche.id)}
                              disabled={loadingFicheId === fiche.id}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                              title="Voir la fiche en détail"
                            >
                              {loadingFicheId === fiche.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Eye className="h-2.5 w-2.5" />}
                              Voir
                            </button>
                            <button
                              onClick={() => handleExportFiche(fiche.id)}
                              disabled={exportingFiche === fiche.id}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                              title="Télécharger la fiche en PDF"
                            >
                              {exportingFiche === fiche.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Download className="h-2.5 w-2.5" />}
                              PDF
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ⭐ AttendanceRegisterDirectorDetail — Vue in-page du registre d'appel + évaluation
// ============================================================================

function AttendanceRegisterDirectorDetail({ register, userId, onBack, onValidated }: { register: any; userId: string; onBack: () => void; onValidated: () => void; }) {
  const [saving, setSaving] = useState(false);
  const [directorSignature, setDirectorSignature] = useState<string | null>(register.directorSignature || null);

  // Parser studentsData
  let students: any[] = [];
  if (register.studentsData) {
    if (typeof register.studentsData === "string") {
      try { const p = JSON.parse(register.studentsData); students = Array.isArray(p) ? p : (p?.data || []); } catch { students = []; }
    } else if (Array.isArray(register.studentsData)) { students = register.studentsData; }
    else if (typeof register.studentsData === "object") {
      const d = register.studentsData;
      students = Array.isArray(d) ? d : (d?.data || d?.students || []);
    }
  }

  // Parser holidays
  let holidays: string[] = [];
  if (register.holidays) {
    try { const h = typeof register.holidays === "string" ? JSON.parse(register.holidays) : register.holidays; holidays = Array.isArray(h) ? h : []; } catch { holidays = []; }
  }

  const isAlreadyValidated = register.status === "VALIDATED";
  const isAlreadyRejected = register.status === "REJECTED";
  const selectedMonth = register.month || 1;
  const selectedYear = register.year || new Date().getFullYear();

  const WEEKS = [1, 2, 3, 4, 5];
  const DAYS = [{ num: 1, label: "L" }, { num: 2, label: "M" }, { num: 3, label: "M" }, { num: 4, label: "J" }, { num: 5, label: "V" }];
  const MONTH_NAMES = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

  function getCellDate(week: number, dayNum: number) {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    let currentWeek = 1; let lastDow = -1;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(selectedYear, selectedMonth - 1, day);
      const dow = d.getDay();
      if (dow < 1 || dow > 5) continue;
      if (lastDow === 5 && dow === 1) currentWeek++;
      if (currentWeek > 5) continue;
      if (currentWeek === week && dow === dayNum) {
        return { date: d, inMonth: true, dateStr: `${selectedYear}-${String(selectedMonth).padStart(2,"0")}-${String(day).padStart(2,"0")}` };
      }
      lastDow = dow;
    }
    return { date: null, inMonth: false, dateStr: "" };
  }

  function getWeekDateRange(week: number) {
    const days: number[] = [];
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    let currentWeek = 1; let lastDow = -1;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(selectedYear, selectedMonth - 1, day);
      const dow = d.getDay();
      if (dow < 1 || dow > 5) continue;
      if (lastDow === 5 && dow === 1) currentWeek++;
      if (currentWeek > 5) continue;
      if (currentWeek === week) days.push(day);
      lastDow = dow;
    }
    if (days.length === 0) return "";
    return `${days[0]}/${String(selectedMonth).padStart(2,"0")} → ${days[days.length-1]}/${String(selectedMonth).padStart(2,"0")}`;
  }

  function getAbsence(student: any, week: number, day: number): string {
    const a = (student.absences || []).find((x: any) => x.week === week && x.day === day);
    return a?.marked || "";
  }

  function calculateDemiJourneesMois(): number {
    const DEMI: Record<number, number> = { 1: 2, 2: 2, 3: 1, 4: 2, 5: 2 };
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    let total = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(selectedYear, selectedMonth - 1, day);
      const dow = d.getDay();
      if (dow < 1 || dow > 5) continue;
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      if (holidays.includes(dateStr)) continue;
      total += DEMI[dow] || 0;
    }
    return total;
  }

  const demiJourneeMois = calculateDemiJourneesMois();
  const boysCount = students.filter((s: any) => (s.sexe || "").toUpperCase() === "M").length;
  const girlsCount = students.filter((s: any) => (s.sexe || "").toUpperCase() === "F").length;

  const handleValidate = async (action: "VALIDATED" | "REJECTED") => {
    if (action === "VALIDATED" && !directorSignature) { toast.error("Signature obligatoire"); return; }
    if (!window.confirm(action === "VALIDATED" ? "Valider ce registre + évaluation ?" : "Rejeter ?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pedagogy-space/director/attendance-registers/${register.id}/director-update`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ directorSignature, action, validatedBy: userId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(action === "VALIDATED" ? "Registre + évaluation validés" : "Rejetés");
      onValidated();
    } catch (err: any) { toast.error("Erreur", { description: err.message }); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-3">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg">
          <ChevronRight className="w-4 h-4 rotate-180" /> Retour à la liste
        </button>
        <div className="flex items-center gap-2">
          {isAlreadyValidated && <span className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">Validé</span>}
          {isAlreadyRejected && <span className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-bold">Rejeté</span>}
          {!isAlreadyValidated && !isAlreadyRejected && (<>
            <button onClick={() => handleValidate("REJECTED")} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Rejeter</button>
            <button onClick={() => handleValidate("VALIDATED")} disabled={saving || !directorSignature} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {directorSignature ? "Valider" : "Signature requise"}</button>
          </>)}
        </div>
      </div>

      {/* En-tête registre */}
      <div className="bg-white border-2 border-slate-800 rounded-xl p-4 text-center">
        <h2 className="text-lg font-bold text-slate-900">REGISTRE D'APPEL{register.schoolLevelCode === "MATERNELLE" ? " MATERNELLE" : ""}</h2>
        <div className="text-sm text-slate-600 mt-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>Mois de <strong>{MONTH_NAMES[selectedMonth]}</strong> {selectedYear}</span>
            <span className="text-slate-300">|</span>
            <span>Nombre de demi-journées : <strong className="text-blue-600">{demiJourneeMois}</strong></span>
          </div>
          <div className="text-slate-700">Classe : <strong>{register.classNameResolved || "—"}</strong> — Effectif : {students.length} élèves ({boysCount} G, {girlsCount} F)</div>
        </div>
      </div>

      {/* Tableau complet 25 colonnes (identique à l'enseignant) */}
      <div className="bg-white border-2 border-slate-800 rounded-xl p-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs" style={{ minWidth: "1600px" }}>
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "180px" }}>Nom et prénom</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Sexe</th>
                <th colSpan={25} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center">Indication des absences pour chaque jour de classe (5 semaines × 5 jours)</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "120px" }}>Motif des absences</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "80px" }}>T. Poss.</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "80px" }}>T. Abs.</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "80px" }}>T. Eff.</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "100px" }}>Observation</th>
              </tr>
              <tr className="bg-slate-50">
                {WEEKS.map(w => {
                  const range = getWeekDateRange(w);
                  return <th key={w} colSpan={5} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[11px] uppercase" style={{ minWidth: "225px" }}>S{w} {range && <span className="font-normal text-slate-400 normal-case text-[9px] block">{range}</span>}</th>;
                })}
              </tr>
              <tr className="bg-slate-50">
                {WEEKS.map(w => DAYS.map(d => {
                  const cell = getCellDate(w, d.num);
                  return <th key={`${w}-${d.num}`} className={cn("border border-slate-300 px-1 py-1 font-bold text-[10px] uppercase", cell.inMonth ? "text-slate-500" : "text-slate-300 bg-slate-100")} style={{ minWidth: "45px", width: "45px" }}>{d.label}{cell.inMonth && cell.date && <div className="text-[8px] font-normal text-slate-400">{cell.date.getDate()}</div>}</th>;
                }))}
              </tr>
            </thead>
            <tbody>
              {[...students].sort((a, b) => {
                const aN = `${a.nom || ""} ${a.prenom || ""}`; const bN = `${b.nom || ""} ${b.prenom || ""}`;
                return aN.localeCompare(bN, "fr");
              }).map((student, idx) => (
                <tr key={student.studentId || idx} className={cn("hover:bg-slate-50", idx % 2 === 1 && "bg-slate-50/50")}>
                  <td className="border border-slate-300 px-2 py-1 text-center font-semibold">{idx + 1}</td>
                  <td className="border border-slate-300 px-2 py-1 font-medium">{student.nom} {student.prenom}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{student.sexe}</td>
                  {WEEKS.map(w => DAYS.map(d => {
                    const marked = getAbsence(student, w, d.num);
                    const cell = getCellDate(w, d.num);
                    if (!cell.inMonth) return <td key={`${w}-${d.num}`} className="border border-slate-300 p-0 bg-slate-100" style={{ minWidth: "45px", width: "45px" }}><div className="w-full h-9 flex items-center justify-center text-slate-300 text-xs">—</div></td>;
                    const isHoliday = holidays.includes(cell.dateStr);
                    if (isHoliday) return <td key={`${w}-${d.num}`} className="border border-slate-300 p-0 bg-red-50" style={{ minWidth: "45px", width: "45px" }}><div className="w-full h-9 flex items-center justify-center text-base" title="Jour férié">🎉</div></td>;
                    return <td key={`${w}-${d.num}`} className="border border-slate-300 p-0" style={{ minWidth: "45px", width: "45px" }}><div className={cn("w-full h-9 flex items-center justify-center text-base font-bold", marked === "-" && "bg-amber-100 text-amber-700", marked === "|" && "bg-amber-100 text-amber-700", marked === "+" && "bg-red-100 text-red-700", !marked && "bg-transparent text-slate-300")}>{marked === "-" ? "−" : marked === "|" ? "│" : marked === "+" ? "+" : "·"}</div></td>;
                  }))}
                  <td className="border border-slate-300 px-2 py-1 text-[10px]">{student.motif || "—"}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center font-semibold bg-slate-50">{student.totalPresencesPossibles || 0}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center font-bold text-red-600">{student.totalAbsences || 0}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center font-bold text-emerald-600">{student.totalPresenceEffectif || 0}</td>
                  <td className="border border-slate-300 px-2 py-1 text-[10px] text-slate-500">{student.observation || "—"}</td>
                </tr>
              ))}
              {students.length === 0 && <tr><td colSpan={33} className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm">Aucun élève dans ce registre.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Légende */}
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="font-bold text-slate-600 uppercase">Légende :</span>
          <div className="flex items-center gap-1.5"><span className="w-5 h-5 bg-amber-100 text-amber-700 flex items-center justify-center font-bold rounded">−</span><span>Absent matin</span></div>
          <div className="flex items-center gap-1.5"><span className="w-5 h-5 bg-amber-100 text-amber-700 flex items-center justify-center font-bold rounded">│</span><span>Absent après-midi</span></div>
          <div className="flex items-center gap-1.5"><span className="w-5 h-5 bg-red-100 text-red-700 flex items-center justify-center font-bold rounded">+</span><span>Absent toute la journée</span></div>
          <div className="flex items-center gap-1.5"><span className="w-5 h-5 bg-slate-100 flex items-center justify-center rounded">—</span><span>Hors mois</span></div>
          <div className="flex items-center gap-1.5"><span className="w-5 h-5 bg-red-50 flex items-center justify-center rounded">🎉</span><span>Jour férié</span></div>
        </div>
      </div>

      {/* Récapitulatif */}
      <div className="bg-white border-2 border-slate-300 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase">Récapitulatif du mois — {MONTH_NAMES[selectedMonth]} {selectedYear}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="bg-slate-50 p-3 rounded-lg"><div className="text-xs text-slate-500">Demi-journées du mois</div><div className="text-lg font-bold text-slate-700">{demiJourneeMois}</div></div>
          <div className="bg-slate-50 p-3 rounded-lg"><div className="text-xs text-slate-500">Présences possibles</div><div className="text-lg font-bold text-slate-700">{register.presencePossibleMois ?? "—"}</div></div>
          <div className="bg-red-50 p-3 rounded-lg"><div className="text-xs text-red-500">Total absences</div><div className="text-lg font-bold text-red-700">{register.totalAbsencesMois ?? "—"}</div></div>
          <div className="bg-emerald-50 p-3 rounded-lg"><div className="text-xs text-emerald-500">Présences effectives</div><div className="text-lg font-bold text-emerald-700">{register.totalPresencesEffectivesMois ?? "—"}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-blue-50 p-3 rounded-lg"><div className="text-xs text-blue-500">% Présences</div><div className="text-lg font-bold text-blue-700">{register.pourcentagePresences ?? "—"}%</div></div>
          <div className="bg-amber-50 p-3 rounded-lg"><div className="text-xs text-amber-500">% Absences</div><div className="text-lg font-bold text-amber-700">{register.pourcentageAbsences ?? "—"}%</div></div>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t-2 border-slate-300">
        <div className="space-y-2"><div className="text-sm font-bold text-slate-800">Le Titulaire de la classe</div><div className="text-xs text-slate-500">Signature</div>{register.teacherSignature ? <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2"><img src={register.teacherSignature} alt="Sig" className="max-h-24 mx-auto" /></div> : <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400 italic">Non signé</div>}</div>
        <div className="space-y-2"><div className="flex items-center justify-between"><div><div className="text-sm font-bold text-slate-800">Le Directeur / La Directrice</div><div className="text-xs text-slate-500">{isAlreadyValidated ? "" : "(obligatoire)"}</div></div>{directorSignature && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Signé</span>}</div>{directorSignature ? <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2 relative"><img src={directorSignature} alt="Sig" className="max-h-24 mx-auto" />{!isAlreadyValidated && <button type="button" onClick={() => setDirectorSignature(null)} className="absolute top-1 right-1 text-xs text-red-500">Effacer</button>}</div> : <SignatureCanvas width={400} height={120} disabled={saving || isAlreadyValidated} placeholder="Signature (obligatoire)" onSignatureChange={(data) => setDirectorSignature(data)} />}</div>
      </div>

      {/* Phrase d'arrêté */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 italic">
        Arrêté ce registre d'appel ce jour {new Date().toLocaleDateString('fr-FR')} —
        Effectif du jour : {boysCount} garçons, {girlsCount} filles.
      </div>

      {/* Note : modification possible si pas encore signé par le directeur */}
      {!isAlreadyValidated && !directorSignature && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
          ℹ️ Tant que le directeur n'a pas apposé sa signature, l'enseignant peut encore modifier le registre et le resoumettre.
          Une fois la signature du directeur apposée et la validation effectuée, le registre est verrouillé.
        </div>
      )}
      {isAlreadyValidated && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700">
          ✓ Ce registre a été validé par le directeur. La signature a été apposée. L'enseignant ne peut plus le modifier.
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PedagogicalFicheDirectorDetail
// ============================================================================

const SHEET_TYPE_HEADERS: Record<string, { label: string; bg: string }> = {
  MATH: { label: "MATHÉMATIQUE", bg: "bg-blue-50 border-blue-300" },
  FRANCAIS: { label: "FRANÇAIS", bg: "bg-emerald-50 border-emerald-300" },
  EST: { label: "ÉDUCATION SCIENTIFIQUE ET TECHNOLOGIQUE", bg: "bg-purple-50 border-purple-300" },
  ES: { label: "ÉDUCATION SOCIALE", bg: "bg-amber-50 border-amber-300" },
  EA: { label: "ÉDUCATION ARTISTIQUE", bg: "bg-pink-50 border-pink-300" },
  EPS: { label: "ÉDUCATION PHYSIQUE ET SPORTIVE", bg: "bg-cyan-50 border-cyan-300" },
};

function PedagogicalFicheDirectorDetail({ fiche, userId, onBack, onValidated }: { fiche: any; userId: string; onBack: () => void; onValidated: () => void; }) {
  const [saving, setSaving] = useState(false);
  const [sendingToTeacher, setSendingToTeacher] = useState(false);
  const [hasBeenSent, setHasBeenSent] = useState(false); // ⭐ Track si notification déjà envoyée
  const [directorSignature, setDirectorSignature] = useState<string | null>(fiche.directorSignature || null);
  const [directorGeneralObservation, setDirectorGeneralObservation] = useState<string>(fiche.directorObservation || "");
  const [sectionObservations, setSectionObservations] = useState<Record<string, string>>({});
  // ⭐ Modale de confirmation professionnelle personnalisée (remplace window.confirm)
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; action: "VALIDATED" | "REJECTED" | null }>({ open: false, action: null });

  useEffect(() => {
    let existing = fiche.directorSectionObservations;
    if (typeof existing === "string") { try { existing = JSON.parse(existing); } catch { existing = {}; } }
    setSectionObservations(existing || {});
  }, [fiche.id]);

  const isAlreadyValidated = fiche.status === "VALIDATED";
  const isAlreadyRejected = fiche.status === "REJECTED";
  const sheetConfig = SHEET_TYPE_HEADERS[fiche.sheetType] || { label: fiche.sheetType, bg: "bg-slate-50 border-slate-300" };
  let deroulement: any[] = [];
  if (fiche.deroulement) { if (typeof fiche.deroulement === "string") { try { deroulement = JSON.parse(fiche.deroulement); } catch { deroulement = []; } } else if (Array.isArray(fiche.deroulement)) { deroulement = fiche.deroulement; } }

  // ⭐ handleSave — sauvegarde simple sans changement de statut ni notification
  //    Pattern identique à CahierJournalDirectorDetail.handleSave
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/pedagogy-space/director/fiches/" + fiche.id + "/director-update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          directorSectionObservations: sectionObservations,
          directorObservation: directorGeneralObservation,
          directorSignature,
          // Pas d'action → sauvegarde simple sans changer le statut
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      toast.success("✅ Observations enregistrées", {
        description: "Vos observations et signature sont sauvegardées. Vous pouvez valider plus tard.",
      });
    } catch (err: any) {
      toast.error("Erreur lors de la sauvegarde", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ⭐ handleValidate — validation/rejet AVEC notification automatique côté backend
  //    Ouvre d'abord la modale de confirmation professionnelle personnalisée.
  //    Si confirmée, envoie la requête PUT avec action='VALIDATED'/'REJECTED'.
  const openConfirmModal = (action: "VALIDATED" | "REJECTED") => {
    if (action === "VALIDATED" && !directorSignature) {
      toast.error("Signature obligatoire", { description: "Vous devez signer avant de valider la fiche." });
      return;
    }
    setConfirmModal({ open: true, action });
  };

  const handleValidate = async () => {
    const action = confirmModal.action;
    if (!action) return;
    setConfirmModal({ open: false, action: null });
    setSaving(true);
    try {
      const res = await fetch("/api/pedagogy-space/director/fiches/" + fiche.id + "/director-update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          directorSectionObservations: sectionObservations,
          directorObservation: directorGeneralObservation,
          directorSignature,
          action,
          validatedBy: userId,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      toast.success(action === "VALIDATED" ? "✅ Fiche validée" : "Fiche rejetée", {
        description: action === "VALIDATED"
          ? "L'enseignant recevra une notification (email + WhatsApp + SMS) avec votre décision et votre signature. Utilisez le bouton 'Envoyer à l'enseignant' pour renvoyer la notification si besoin."
          : "L'enseignant a été notifié du rejet.",
      });
      // ⭐ Marquer comme envoyé (notification auto déclenchée par le backend)
      setHasBeenSent(true);
      onValidated();
    } catch (err: any) {
      toast.error("Erreur", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ⭐ handleSendToTeacher — envoie manuel de notification à l'enseignant
  //    Appelle POST /director/fiches/:id/send-to-teacher
  //    Permet de re-notifier (rappel) sans changer le statut
  const handleSendToTeacher = async () => {
    setSendingToTeacher(true);
    try {
      const res = await fetch("/api/pedagogy-space/director/fiches/" + fiche.id + "/send-to-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
      }
      toast.success("📧 Notification envoyée à l'enseignant", {
        description: `L'enseignant recevra ${fiche.status === "VALIDATED" ? "la version validée" : "le rejet"} avec vos observations par email, WhatsApp et SMS.`,
      });
      setHasBeenSent(true);
    } catch (err: any) {
      toast.error("Erreur lors de l'envoi", { description: err.message });
    } finally {
      setSendingToTeacher(false);
    }
  };

  const renderField = (label: string, value: string | null | undefined) => (
    <div className="mb-3"><label className="block text-xs font-bold text-slate-600 uppercase mb-1">{label}</label><div className="text-sm text-slate-800 min-h-[40px] p-2 bg-slate-50 rounded border border-slate-200">{value ? <div dangerouslySetInnerHTML={{ __html: value }} /> : <span className="text-slate-300">—</span>}</div></div>
  );
  const renderObs = (key: string, label: string) => (
    <div className="mb-3 bg-red-50/30 p-2 rounded border border-red-200"><label className="block text-xs font-bold text-red-700 uppercase mb-1">{label} (rouge)</label><textarea value={sectionObservations[key] || ""} onChange={(e) => setSectionObservations(prev => ({ ...prev, [key]: e.target.value }))} disabled={saving || isAlreadyValidated} placeholder="Observation..." className="w-full px-2 py-1 text-xs text-red-700 font-semibold border border-red-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-red-400 resize-none" style={{ minHeight: "50px" }} /></div>
  );
  const fmt = (d: string | Date) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";

  // ⭐ Modale de confirmation professionnelle personnalisée
  const confirmModalConfig = confirmModal.action === "VALIDATED"
    ? {
        title: "Valider la fiche pédagogique",
        icon: <CheckCircle2 className="h-10 w-10 text-emerald-500" />,
        color: "emerald",
        message: "Vous êtes sur le point de valider cette fiche pédagogique.",
        details: [
          "L'enseignant sera notifié immédiatement (email + WhatsApp + SMS)",
          "La version validée avec votre signature et vos observations sera envoyée",
          "L'enseignant verra la fiche comme « Validée » dans son espace pédagogique",
          "Vous pourrez re-notifier l'enseignant via le bouton « Envoyer à l'enseignant »",
        ],
        confirmLabel: "✓ Valider la fiche",
        confirmClass: "bg-emerald-600 hover:bg-emerald-700",
      }
    : {
        title: "Rejeter la fiche pédagogique",
        icon: <XCircle className="h-10 w-10 text-red-500" />,
        color: "red",
        message: "Vous êtes sur le point de rejeter cette fiche pédagogique.",
        details: [
          "L'enseignant sera notifié immédiatement (email + WhatsApp + SMS)",
          "L'enseignant verra la fiche comme « Rejetée » dans son espace pédagogique",
          "L'enseignant devra corriger la fiche et la resoumettre",
          "Vos observations seront visibles par l'enseignant pour lui indiquer les corrections à apporter",
        ],
        confirmLabel: "✗ Rejeter la fiche",
        confirmClass: "bg-red-600 hover:bg-red-700",
      };

  return (
    <div className="space-y-4">
      {/* ⭐ Modale de confirmation personnalisée */}
      {confirmModal.open && confirmModal.action && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* En-tête coloré */}
            <div className={cn("px-6 py-4 border-b", confirmModal.color === "emerald" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200")}>
              <div className="flex items-center gap-3">
                {confirmModalConfig.icon}
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{confirmModalConfig.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Action de validation direction</p>
                </div>
              </div>
            </div>
            {/* Corps */}
            <div className="p-6 space-y-3">
              <p className="text-sm text-slate-700 font-medium">{confirmModalConfig.message}</p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Conséquences :</p>
                {confirmModalConfig.details.map((d, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                    <ChevronRight className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                    <span>{d}</span>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>ℹ️ Fiche :</strong> {fiche.classNameResolved || "—"} · {SHEET_TYPE_LABELS[fiche.sheetType]?.label || fiche.sheetType} · {fmt(fiche.lessonDate)}
              </div>
            </div>
            {/* Actions */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={() => setConfirmModal({ open: false, action: null })}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleValidate}
                disabled={saving}
                className={cn("flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-50", confirmModalConfig.confirmClass)}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {confirmModalConfig.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-3">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-4 h-4 rotate-180" /> Retour</button>
        <div className="flex items-center gap-2 flex-wrap">
          {isAlreadyValidated && <span className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">✓ Validé</span>}
          {isAlreadyRejected && <span className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-bold">✗ Rejeté</span>}
          {!isAlreadyValidated && !isAlreadyRejected && (
            <>
              {/* ⭐ Bouton Enregistrer (sauvegarde simple sans action) */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                title="Enregistrer les observations sans valider"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </button>
              <button
                onClick={() => openConfirmModal("REJECTED")}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Rejeter
              </button>
              <button
                onClick={() => openConfirmModal("VALIDATED")}
                disabled={saving || !directorSignature}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                title={!directorSignature ? "Signature obligatoire" : "Valider la fiche"}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {directorSignature ? "Valider" : "Signature requise"}
              </button>
            </>
          )}
          {/* ⭐ Bouton "Envoyer à l'enseignant" — visible après validation/rejet */}
          {(isAlreadyValidated || isAlreadyRejected) && (
            <button
              onClick={handleSendToTeacher}
              disabled={sendingToTeacher}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              title="Envoyer/Renvoyer la notification (email + WhatsApp + SMS) à l'enseignant avec votre décision et vos observations"
            >
              {sendingToTeacher ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {hasBeenSent ? "Renvoyer à l'enseignant" : "Envoyer à l'enseignant"}
            </button>
          )}
        </div>
      </div>
      <div className={cn("bg-white border-2 rounded-xl p-4 text-center", sheetConfig.bg)}><h2 className="text-lg font-bold text-slate-900">FICHE DE {sheetConfig.label}</h2><div className="text-sm text-slate-600 mt-1">Classe : <strong>{fiche.classNameResolved || "—"}</strong> · Enseignant : {fiche.teacherFirstName} {fiche.teacherLastName}</div><div className="text-xs text-slate-500 mt-1">Date : <strong>{fmt(fiche.lessonDate)}</strong>{fiche.adminWeek ? " · S" + fiche.adminWeek : ""}{fiche.trimester ? " · T" + fiche.trimester : ""} · Statut : <strong>{fiche.status}</strong></div></div>
      <div className="bg-white border-2 border-slate-300 rounded-xl p-4 space-y-3"><h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-2">I- Éléments de planification</h3>{renderField("Compétences disciplinaires", fiche.competence)}{renderField("Compétences transversales", fiche.habilete)}{renderField("Compétences transdisciplinaires", fiche.prealable)}{renderField("Connaissances et techniques", fiche.contenu)}{renderField("Stratégie objet d'apprentissage", fiche.methodes)}{renderField("Stratégie d'enseignement", fiche.moyensDidactiques)}{renderField("Matériel", fiche.evaluation)}{renderObs("phase_preparatoire", "Observation — Phase préparatoire")}</div>
      <div className="bg-white border-2 border-slate-300 rounded-xl p-4 space-y-3"><h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-2">II- Déroulement</h3>{deroulement.length > 0 ? (<div className="overflow-x-auto"><table className="w-full border-collapse text-xs"><thead><tr className="bg-slate-100"><th className="border border-slate-300 px-2 py-1 text-left w-12">N°</th><th className="border border-slate-300 px-2 py-1 text-left">Consignes</th><th className="border border-slate-300 px-2 py-1 text-left">Résultats</th></tr></thead><tbody>{deroulement.map((step: any, idx: number) => (<tr key={idx}><td className="border border-slate-300 px-2 py-1 text-center font-bold">{idx + 1}</td><td className="border border-slate-300 px-2 py-1">{step.consignes || step.activiteEnseignant ? <div dangerouslySetInnerHTML={{ __html: step.consignes || step.activiteEnseignant }} /> : <span className="text-slate-300">—</span>}</td><td className="border border-slate-300 px-2 py-1">{step.resultats || step.activiteEleves ? <div dangerouslySetInnerHTML={{ __html: step.resultats || step.activiteEleves }} /> : <span className="text-slate-300">—</span>}</td></tr>))}</tbody></table></div>) : <p className="text-sm text-slate-400 italic">Aucune étape.</p>}{renderObs("deroulement", "Observation — Déroulement")}</div>
      <div className="bg-white border-2 border-slate-300 rounded-xl p-4 space-y-3"><h3 className="text-sm font-bold text-slate-900 uppercase border-b border-slate-200 pb-2">III- Retour et projection</h3>{renderField("Objectivation", (fiche as any).objectivation)}{renderField("Évaluation", (fiche as any).evalRetour || fiche.evaluation)}{renderField("Projection", (fiche as any).projection)}{renderField("Référence", fiche.reference)}{renderObs("retour_projection", "Observation — Retour et projection")}</div>
      <div className="bg-white border-2 border-red-300 rounded-xl p-4 space-y-3"><h3 className="text-sm font-bold text-red-700 uppercase">Observation générale du directeur</h3><RichTextEditor value={directorGeneralObservation} onChange={(html) => setDirectorGeneralObservation(html)} disabled={saving || isAlreadyValidated} placeholder="Observations générales..." minHeight="100px" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t-2 border-slate-300">
        <div className="space-y-2"><div className="text-sm font-bold text-slate-800">Le Maître / La Maîtresse</div>{fiche.teacherSignature ? <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2"><img src={fiche.teacherSignature} alt="Sig" className="max-h-24 mx-auto" /></div> : <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400 italic">Non signé</div>}</div>
        <div className="space-y-2"><div className="flex items-center justify-between"><div><div className="text-sm font-bold text-slate-800">Le Directeur</div><div className="text-xs text-slate-500">{isAlreadyValidated ? "" : "(obligatoire)"}</div></div>{directorSignature && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Signé</span>}</div>{directorSignature ? <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2 relative"><img src={directorSignature} alt="Sig" className="max-h-24 mx-auto" />{!isAlreadyValidated && <button type="button" onClick={() => setDirectorSignature(null)} className="absolute top-1 right-1 text-xs text-red-500">Effacer</button>}</div> : <SignatureCanvas width={400} height={120} disabled={saving || isAlreadyValidated} placeholder="Signature (obligatoire)" onSignatureChange={(data) => setDirectorSignature(data)} />}</div>
      </div>

    </div>
  );
}

// ============================================================================
// MonthlyEvaluationDirectorDetail — Vue in-page évaluation mensuelle
// ============================================================================

function MonthlyEvaluationDirectorDetail({ evaluation, userId, onBack, onValidated }: { evaluation: any; userId: string; onBack: () => void; onValidated: () => void; }) {
  const [saving, setSaving] = useState(false);
  const [directorSignature, setDirectorSignature] = useState<string | null>(evaluation.directorSignature || null);

  // Parser subjectsConfig et studentScores
  let subjects: any[] = [];
  if (evaluation.subjectsConfig) {
    if (typeof evaluation.subjectsConfig === "string") { try { subjects = JSON.parse(evaluation.subjectsConfig); } catch { subjects = []; } }
    else if (Array.isArray(evaluation.subjectsConfig)) { subjects = evaluation.subjectsConfig; }
  }
  let scores: any[] = [];
  if (evaluation.studentScores) {
    if (typeof evaluation.studentScores === "string") { try { scores = JSON.parse(evaluation.studentScores); } catch { scores = []; } }
    else if (Array.isArray(evaluation.studentScores)) { scores = evaluation.studentScores; }
  }

  const isAlreadyValidated = evaluation.status === "VALIDATED";
  const isAlreadyRejected = evaluation.status === "REJECTED";
  const isMaternelle = (evaluation.schoolLevelCode || "").toUpperCase() === "MATERNELLE";
  const monthLabel = MONTH_NAMES[evaluation.registerMonth || evaluation.month || 1] || "—";
  const year = evaluation.registerYear || evaluation.year || "—";

  const handleValidate = async (action: "VALIDATED" | "REJECTED") => {
    if (action === "VALIDATED" && !directorSignature) { toast.error("Signature obligatoire"); return; }
    if (!window.confirm(action === "VALIDATED" ? "Valider cette évaluation ?" : "Rejeter cette évaluation ?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pedagogy-space/director/attendance-registers/" + evaluation.attendanceRegisterId + "/director-update", {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ directorSignature, action, validatedBy: userId }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      toast.success(action === "VALIDATED" ? "Évaluation validée" : "Évaluation rejetée");
      onValidated();
    } catch (err: any) { toast.error("Erreur", { description: err.message }); } finally { setSaving(false); }
  };

  const formatDate = (d: string | Date) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-3">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg">
          <ChevronRight className="w-4 h-4 rotate-180" /> Retour à la liste
        </button>
        <div className="flex items-center gap-2">
          {isAlreadyValidated && <span className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">Validé</span>}
          {isAlreadyRejected && <span className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-bold">Rejeté</span>}
          {!isAlreadyValidated && !isAlreadyRejected && (<>
            <button onClick={() => handleValidate("REJECTED")} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Rejeter</button>
            <button onClick={() => handleValidate("VALIDATED")} disabled={saving || !directorSignature} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {directorSignature ? "Valider" : "Signature requise"}</button>
          </>)}
        </div>
      </div>

      {/* En-tête */}
      <div className="bg-white border-2 border-slate-800 rounded-xl p-4 text-center">
        <h2 className="text-lg font-bold text-slate-900">
          {evaluation.title || evaluation.evaluationTypeName || "ÉVALUATION MENSUELLE"} — {monthLabel} {year}
        </h2>
        <div className="text-sm text-slate-600 mt-1">
          Classe : <strong>{evaluation.classNameResolved || "—"}</strong>
          {" · "}Enseignant : {evaluation.teacherFirstName} {evaluation.teacherLastName}
        </div>
        <div className="text-xs text-slate-500 mt-1">
          Statut : <strong>{evaluation.status}</strong>
          {" · "}Seuil de réussite : {evaluation.seuilReussite ?? 10}/20
          {evaluation.evaluationTypeName && " · Type : " + evaluation.evaluationTypeName}
        </div>
        <p className="text-xs text-slate-500 mt-1 italic">NB : Pour chaque épreuve, l'élève évalué(e) n'aura de bonus de perfectionnement que lorsqu'il(elle) aura atteint la maîtrise minimale fixée.</p>
      </div>

      {/* Tableau des notes */}
      <div className="bg-white border-2 border-slate-800 rounded-xl p-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N°</th>
                <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "180px" }}>Nom et prénom</th>
                <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Sexe</th>
                {subjects.map((subj: any, idx: number) => (
                  isMaternelle ? (
                    <th key={idx} rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[80px]">{subj.subjectName}<div className="text-[9px] text-slate-400 font-normal">TS/S/PS</div></th>
                  ) : (
                    <th key={idx} colSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center min-w-[180px]">{subj.subjectName}</th>
                  )
                ))}
                {!isMaternelle && <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Total gén.</th>}
                <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Rang</th>
                <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-16">Seuil</th>
                <th colSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center w-24">Seuil atteint</th>
                {isMaternelle && <th rowSpan={2} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-32">Appréciation</th>}
              </tr>
              {!isMaternelle && (
                <tr className="bg-slate-50">
                  {subjects.map((_: any, idx: number) => (<><th key={"cm-"+idx} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CM/18</th><th key={"cp-"+idx} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">CP/2</th><th key={"t-"+idx} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[10px]">Total</th></>))}
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Oui</th>
                  <th className="border border-slate-300 px-1 py-1 font-bold text-slate-600 text-[10px]">Non</th>
                </tr>
              )}
            </thead>
            <tbody>
              {scores.length === 0 ? (
                <tr><td colSpan={isMaternelle ? 10 + subjects.length : 10 + subjects.length * 3} className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm">Aucune note saisie.</td></tr>
              ) : scores.map((s: any, idx: number) => {
                const totalGeneral = s.totalGeneral || 0;
                const seuilAtteint = totalGeneral >= (evaluation.seuilReussite ?? 10);
                return (
                  <tr key={s.studentId || idx} className={cn("hover:bg-slate-50", idx % 2 === 1 && "bg-slate-50/50")}>
                    <td className="border border-slate-300 px-2 py-1 text-center font-semibold">{idx + 1}</td>
                    <td className="border border-slate-300 px-2 py-1 font-medium">{s.nom} {s.prenom}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center">{s.sexe}</td>
                    {subjects.map((subj: any, subIdx: number) => {
                      const sc = s.scores?.[subIdx] || {};
                      if (isMaternelle) {
                        const code = sc.qualitativeCode;
                        return <td key={subIdx} className="border border-slate-300 px-2 py-1 text-center"><span className={cn("inline-block px-2 py-0.5 rounded text-[10px] font-bold", code === "TS" ? "bg-emerald-600 text-white" : code === "S" ? "bg-blue-600 text-white" : code === "PS" ? "bg-amber-600 text-white" : "text-slate-400")}>{code || "—"}</span></td>;
                      }
                      return <><td key={"cm"+subIdx} className="border border-slate-300 px-2 py-1 text-center">{sc.cm ?? "—"}</td><td key={"cp"+subIdx} className="border border-slate-300 px-2 py-1 text-center">{sc.cp ?? "—"}</td><td key={"t"+subIdx} className="border border-slate-300 px-2 py-1 text-center font-bold bg-slate-50">{sc.total ?? "—"}</td></>;
                    })}
                    {!isMaternelle && <td className="border border-slate-300 px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">{totalGeneral.toFixed(2)}</td>}
                    <td className="border border-slate-300 px-2 py-1 text-center font-bold">{idx + 1}{idx === 0 ? "er" : "ème"}</td>
                    <td className="border border-slate-300 px-2 py-1 text-center">{isMaternelle ? "S" : "10"}</td>
                    <td className="border border-slate-300 px-1 py-1 text-center">{seuilAtteint ? "✓" : ""}</td>
                    <td className="border border-slate-300 px-1 py-1 text-center">{!seuilAtteint && totalGeneral > 0 ? "✓" : ""}</td>
                    {isMaternelle && <td className="border border-slate-300 px-2 py-1 text-center font-bold text-xs">{s.appreciation || "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Récapitulatif */}
      <div className="bg-white border-2 border-slate-300 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase">Récapitulatif</h3>
        <div className="overflow-x-auto"><table className="w-full border-collapse text-sm">
          <thead><tr className="bg-slate-100"><th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase text-left">Indicateur</th><th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase text-center">Garçons</th><th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase text-center">Filles</th><th className="border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 uppercase text-center">Total</th></tr></thead>
          <tbody>
            <tr><td className="border border-slate-300 px-3 py-2 font-semibold">Effectif total</td><td className="border border-slate-300 px-3 py-2 text-center">{evaluation.effectifTotalGarcons ?? "—"}</td><td className="border border-slate-300 px-3 py-2 text-center">{evaluation.effectifTotalFilles ?? "—"}</td><td className="border border-slate-300 px-3 py-2 text-center font-bold">{evaluation.effectifTotalClasse ?? "—"}</td></tr>
            <tr><td className="border border-slate-300 px-3 py-2 font-semibold">Ayant composé</td><td className="border border-slate-300 px-3 py-2 text-center">{evaluation.ayantComposeG ?? "—"}</td><td className="border border-slate-300 px-3 py-2 text-center">{evaluation.ayantComposeF ?? "—"}</td><td className="border border-slate-300 px-3 py-2 text-center font-bold">{evaluation.ayantComposeTotal ?? "—"}</td></tr>
            <tr className="bg-emerald-50/50"><td className="border border-slate-300 px-3 py-2 font-semibold">Ont atteint le seuil</td><td className="border border-slate-300 px-3 py-2 text-center text-emerald-700">{evaluation.ayantAtteintSeuilG ?? "—"}</td><td className="border border-slate-300 px-3 py-2 text-center text-emerald-700">{evaluation.ayantAtteintSeuilF ?? "—"}</td><td className="border border-slate-300 px-3 py-2 text-center font-bold text-emerald-700">{evaluation.ayantAtteintSeuilTotal ?? "—"}</td></tr>
            <tr className="bg-blue-50/50"><td className="border border-slate-300 px-3 py-2 font-bold">% de réussite</td><td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-700">{evaluation.pourcentageReussiteG?.toFixed?.(2) ?? "—"}%</td><td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-700">{evaluation.pourcentageReussiteF?.toFixed?.(2) ?? "—"}%</td><td className="border border-slate-300 px-3 py-2 text-center font-bold text-blue-800">{evaluation.pourcentageReussiteTotal?.toFixed?.(2) ?? "—"}%</td></tr>
          </tbody>
        </table></div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t-2 border-slate-300">
        <div className="space-y-2"><div className="text-sm font-bold text-slate-800">Le Titulaire</div>{evaluation.teacherSignature ? <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2"><img src={evaluation.teacherSignature} alt="Sig" className="max-h-24 mx-auto" /></div> : <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400 italic">Non signé</div>}</div>
        <div className="space-y-2"><div className="text-sm font-bold text-slate-800">Le Directeur {isAlreadyValidated ? "" : "(obligatoire)"}</div>{directorSignature ? <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2 relative"><img src={directorSignature} alt="Sig" className="max-h-24 mx-auto" />{!isAlreadyValidated && <button type="button" onClick={() => setDirectorSignature(null)} className="absolute top-1 right-1 text-xs text-red-500">Effacer</button>}</div> : <SignatureCanvas width={400} height={120} disabled={saving || isAlreadyValidated} placeholder="Signature (obligatoire)" onSignatureChange={(data) => setDirectorSignature(data)} />}</div>
      </div>
    </div>
  );
}
