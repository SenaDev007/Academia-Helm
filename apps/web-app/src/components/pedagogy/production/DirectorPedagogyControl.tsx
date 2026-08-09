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
  ChevronRight, X, Eye, Sigma, FlaskConical, Users, Palette, Award, Calendar,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDirectorPedagogyDashboard,
  usePendingCahierJournals, usePendingFiches, usePendingRegisters,
  usePendingEvaluations, usePendingCahierTextes,
  useCahierJournalDetail, useFicheDetail, useRegisterDetail,
  useEvaluationDetail, useCahierTexteDetail,
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
  { id: "cahier-journal", label: "Cahiers Journal", icon: FileSpreadsheet },
  { id: "fiches", label: "Fiches Pédagogiques", icon: FileText },
  { id: "registres", label: "Registres d'Appel", icon: ClipboardList },
  { id: "evaluations", label: "Évaluations Mensuelles", icon: BookOpen },
  { id: "cahier-textes", label: "Cahiers de Test", icon: Award },
] as const;

type TabId = typeof TABS[number]["id"];

const SHEET_TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  MATH: { label: "Mathématiques", icon: Sigma, color: "bg-blue-100 text-blue-700" },
  FRANCAIS: { label: "Français", icon: BookOpen, color: "bg-emerald-100 text-emerald-700" },
  EST: { label: "Éduc. Scientifique & Tech.", icon: FlaskConical, color: "bg-purple-100 text-purple-700" },
  ES: { label: "Éducation Sociale", icon: Users, color: "bg-amber-100 text-amber-700" },
  EA: { label: "Éducation Artistique", icon: Palette, color: "bg-pink-100 text-pink-700" },
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
        {tab === "fiches" && (
          <PendingFichesTab tenantId={tenantId} academicYearId={academicYearId} userId={userId} refreshKey={refreshKey} onRefresh={refresh} />
        )}
        {tab === "registres" && (
          <PendingRegistersTab tenantId={tenantId} academicYearId={academicYearId} userId={userId} refreshKey={refreshKey} onRefresh={refresh} />
        )}
        {tab === "evaluations" && (
          <PendingEvaluationsTab tenantId={tenantId} academicYearId={academicYearId} userId={userId} refreshKey={refreshKey} onRefresh={refresh} />
        )}
        {tab === "cahier-textes" && (
          <PendingCahierTestsTab tenantId={tenantId} academicYearId={academicYearId} userId={userId} refreshKey={refreshKey} onRefresh={refresh} />
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
    { label: "Cahiers de Test", count: dashboard.pendingCahierTests, icon: Award, color: "bg-rose-50 text-rose-700 border-rose-200", tab: "cahier-textes" as TabId },
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
  const { data: items = [], isLoading: loading, refetch } = usePendingCahierJournals(academicYearId);
  const [selected, setSelected] = useState<any>(null);
  const [modalItem, setModalItem] = useState<any>(null);

  // Recharger quand refreshKey change
  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

  const handleValidate = async (action: "VALIDATED" | "REJECTED", reason?: string) => {
    if (!modalItem) return;
    await pedagogySpaceService.validateCahierJournal(modalItem.id, {
      action,
      validatedBy: userId,
      rejectionReason: reason,
    });
    toast.success(action === "VALIDATED" ? "✅ Cahier journal validé" : "Cahier journal rejeté");
    onRefresh();
    // Invalider le cache pour forcer le re-fetch
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

  // ⭐ Si un cahier journal est sélectionné, afficher la vue détaillée in-page
  //    (pas un modal — identique à l'interface enseignant)
  if (selected) {
    return (
      <CahierJournalDirectorDetail
        journal={selected}
        onBack={() => setSelected(null)}
        onValidated={() => {
          setSelected(null);
          onRefresh();
          refetch();
        }}
      />
    );
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <FileSpreadsheet className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-700">Aucun cahier journal en attente</p>
      </div>
    );
  }

  // ⭐ Hiérarchisation : par classe → trimestre
  const getTrimester = (month: number): string => {
    if (month >= 9 || month === 12) return 'Trimestre 1';
    if (month >= 1 && month <= 3) return 'Trimestre 2';
    if (month >= 4 && month <= 6) return 'Trimestre 3';
    return 'Vacances (été)';
  };
  const grouped = items.reduce((acc: Record<string, any[]>, item: any) => {
    const key = item.classNameResolved || item.className || 'Sans classe';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const classNames = Object.keys(grouped).sort();

  // ⭐ Grouper par trimestre pour chaque classe
  const groupedByTrimester: Record<string, Record<string, any[]>> = {};
  for (const cn of classNames) {
    groupedByTrimester[cn] = {};
    for (const item of grouped[cn]) {
      const trimester = getTrimester(item.month || 1);
      if (!groupedByTrimester[cn][trimester]) groupedByTrimester[cn][trimester] = [];
      groupedByTrimester[cn][trimester].push(item);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Cahiers Journal en attente</h3>
          <p className="text-sm text-slate-500">{items.length} soumission(s) · {classNames.length} classe(s)</p>
        </div>
        <button onClick={() => refetch()} className="p-2 hover:bg-slate-100 rounded-lg"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {/* ⭐ Hiérarchisé par classe → trimestre */}
      {classNames.map((className) => (
        <div key={className} className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
            <FileSpreadsheet className="h-4 w-4 text-slate-600" />
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{className}</h4>
            <span className="ml-auto text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full">
              {grouped[className].length}
            </span>
          </div>
          {/* ⭐ Sous-groupement par trimestre */}
          {Object.keys(groupedByTrimester[className]).map(trimester => (
            <div key={trimester} className="space-y-2 pl-4">
              <div className="flex items-center gap-2 px-2 py-1 bg-indigo-50 rounded">
                <Calendar className="h-3 w-3 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{trimester}</span>
                <span className="ml-auto text-xs text-indigo-500">
                  {groupedByTrimester[className][trimester].length} soumission(s)
                </span>
              </div>
              {/* ⭐ Registres du trimestre */}
              <div className="space-y-2 pl-4">
                {groupedByTrimester[className][trimester].map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">
                        Semaine du {formatDateFR(item.weekStartDate)} au {formatDateFR(item.weekEndDate)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Enseignant: {item.teacherFirstName} {item.teacherLastName}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Soumis le {formatDateTimeFR(item.submittedAt)}
                      </p>
                      {/* ⭐ Indicateur fiches pédagogiques manquantes */}
                      <FichesStatusIndicator journalId={item.id} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => handleView(item)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                        <Eye className="h-3 w-3" /> Voir
                      </button>
                      <button onClick={() => setModalItem(item)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                        <CheckCircle2 className="h-3 w-3" /> Traiter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

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
  const { data: items = [], isLoading: loading, refetch } = usePendingFiches(academicYearId);
  const [selected, setSelected] = useState<any>(null);
  const [modalItem, setModalItem] = useState<any>(null);

  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-700">Aucune fiche en attente</p>
      </div>
    );
  }

  // ⭐ Hiérarchisation : par classe → mois → semaine → jour
  const monthNames = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const dayNames = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  // Grouper par classe
  const groupedByClass: Record<string, any[]> = {};
  for (const item of items) {
    const key = item.classNameResolved || 'Sans classe';
    if (!groupedByClass[key]) groupedByClass[key] = [];
    groupedByClass[key].push(item);
  }
  const classNames = Object.keys(groupedByClass).sort();

  // Pour chaque classe, grouper par mois
  const groupedByMonth: Record<string, Record<string, Record<string, any[]>>> = {};
  for (const cn of classNames) {
    groupedByMonth[cn] = {};
    for (const item of groupedByClass[cn]) {
      const dateField = item.lessonDate || item.adminDate;
      const d = dateField ? new Date(dateField) : new Date();
      const monthKey = `${monthNames[d.getMonth() + 1]} ${d.getFullYear()}`;
      if (!groupedByMonth[cn][monthKey]) groupedByMonth[cn][monthKey] = {};
      // Grouper par semaine (numéro de semaine)
      const weekKey = `Semaine ${item.adminWeek || Math.ceil(d.getDate() / 7)}`;
      if (!groupedByMonth[cn][monthKey][weekKey]) groupedByMonth[cn][monthKey][weekKey] = [];
      groupedByMonth[cn][monthKey][weekKey].push(item);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Fiches Pédagogiques en attente</h3>
          <p className="text-sm text-slate-500">{items.length} soumission(s) · {classNames.length} classe(s)</p>
        </div>
        <button onClick={() => refetch()} className="p-2 hover:bg-slate-100 rounded-lg"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {/* ⭐ Hiérarchisé par classe → mois → semaine → jour */}
      {classNames.map((className) => (
        <div key={className} className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
            <FileText className="h-4 w-4 text-slate-600" />
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{className}</h4>
            <span className="ml-auto text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full">
              {groupedByClass[className].length}
            </span>
          </div>
          {/* Sous-groupement par mois */}
          {Object.keys(groupedByMonth[className]).map(monthKey => (
            <div key={monthKey} className="space-y-2 pl-4">
              <div className="flex items-center gap-2 px-2 py-1 bg-blue-50 rounded">
                <Calendar className="h-3 w-3 text-blue-600" />
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wide">{monthKey}</span>
              </div>
              {/* Sous-groupement par semaine */}
              {Object.keys(groupedByMonth[className][monthKey]).map(weekKey => (
                <div key={weekKey} className="space-y-2 pl-4">
                  <div className="flex items-center gap-2 px-2 py-1 bg-emerald-50 rounded">
                    <Clock className="h-3 w-3 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700">{weekKey}</span>
                    <span className="ml-auto text-xs text-emerald-500">
                      {groupedByMonth[className][monthKey][weekKey].length} fiche(s)
                    </span>
                  </div>
                  {/* Liste des fiches du jour */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4">
                    {groupedByMonth[className][monthKey][weekKey].map(item => {
                      const sheetConfig = SHEET_TYPE_LABELS[item.sheetType] || { label: item.sheetType, icon: FileText, color: "bg-slate-100" };
                      const Icon = sheetConfig.icon;
                      const dateField = item.lessonDate || item.adminDate;
                      const dayLabel = dateField ? dayNames[new Date(dateField).getDay()] : '—';
                      return (
                        <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-white">
                          <div className="flex items-start justify-between mb-2">
                            <div className={cn("flex items-center gap-2 px-2 py-1 rounded text-xs font-bold", sheetConfig.color)}>
                              <Icon className="h-3 w-3" /> {sheetConfig.label}
                            </div>
                            <span className="text-xs text-slate-400">{dayLabel}</span>
                          </div>
                          <p className="text-sm text-slate-600 line-clamp-2">
                            {item.competence ? item.competence.replace(/<[^>]*>/g, '').substring(0, 80) + "..." : "—"}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {item.teacherFirstName} {item.teacherLastName}
                            {" · "}{dateField ? formatDateFR(dateField) : '—'}
                          </p>
                          <div className="flex items-center gap-2 mt-3">
                            <button onClick={() => handleView(item)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                              <Eye className="h-3 w-3" /> Voir
                            </button>
                            <button onClick={() => setModalItem(item)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                              <CheckCircle2 className="h-3 w-3" /> Traiter
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      {/* ⭐ L'ancien modal a été remplacé par la vue in-page PedagogicalFicheDirectorDetail */}

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
  const { data: items = [], isLoading: loading, refetch } = usePendingRegisters(academicYearId);
  const [selected, setSelected] = useState<any>(null);
  const [modalItem, setModalItem] = useState<any>(null);

  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-700">Aucun registre en attente</p>
      </div>
    );
  }

  // ⭐ Catégoriser par classe
  const grouped = items.reduce((acc: Record<string, any[]>, item: any) => {
    const key = item.classNameResolved || item.className || 'Sans classe';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const classNames = Object.keys(grouped).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Registres d'Appel en attente</h3>
          <p className="text-sm text-slate-500">{items.length} soumission(s) · {classNames.length} classe(s)</p>
        </div>
        <button onClick={() => refetch()} className="p-2 hover:bg-slate-100 rounded-lg"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {/* ⭐ Groupé par classe */}
      {classNames.map((className) => (
        <div key={className} className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
            <ClipboardList className="h-4 w-4 text-slate-600" />
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{className}</h4>
            <span className="ml-auto text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full">
              {grouped[className].length}
            </span>
          </div>
          <div className="space-y-2 pl-4">
            {grouped[className].map(item => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white">
                <div>
                  <p className="font-medium text-slate-900">
                    Registre de {MONTH_NAMES[item.month] || item.month} {item.year}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.teacherFirstName} {item.teacherLastName}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className="text-emerald-600 font-semibold">Présences: {item.pourcentagePresences ?? "—"}%</span>
                    <span className="text-red-600 font-semibold">Absences: {item.pourcentageAbsences ?? "—"}%</span>
                    <span className="text-slate-500">Demi-j: {item.demiJourneeMois ?? "—"}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Soumis le {formatDateTimeFR(item.submittedAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleView(item)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                    <Eye className="h-3 w-3" /> Voir
                  </button>
                  <button onClick={() => setModalItem(item)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                    <CheckCircle2 className="h-3 w-3" /> Traiter
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ⭐ L'ancien modal a été remplacé par la vue in-page AttendanceRegisterDirectorDetail
          (rendue au début du composant quand `selected` est défini) */}

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
  const { data: items = [], isLoading: loading, refetch } = usePendingEvaluations(academicYearId);
  const [selected, setSelected] = useState<any>(null);
  const [modalItem, setModalItem] = useState<any>(null);

  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-700">Aucune évaluation en attente</p>
      </div>
    );
  }

  // ⭐ Hiérarchisation : par classe → trimestre
  const getTrimester = (month: number): string => {
    if (month >= 9 || month === 12) return 'Trimestre 1';
    if (month >= 1 && month <= 3) return 'Trimestre 2';
    if (month >= 4 && month <= 6) return 'Trimestre 3';
    return 'Vacances (été)';
  };
  const grouped = items.reduce((acc: Record<string, any[]>, item: any) => {
    const key = item.classNameResolved || item.className || 'Sans classe';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const classNames = Object.keys(grouped).sort();

  // ⭐ Grouper par trimestre pour chaque classe
  const groupedByTrimester: Record<string, Record<string, any[]>> = {};
  for (const cn of classNames) {
    groupedByTrimester[cn] = {};
    for (const item of grouped[cn]) {
      const m = item.registerMonth || item.month || 1;
      const trimester = getTrimester(m);
      if (!groupedByTrimester[cn][trimester]) groupedByTrimester[cn][trimester] = [];
      groupedByTrimester[cn][trimester].push(item);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Évaluations Mensuelles en attente</h3>
          <p className="text-sm text-slate-500">{items.length} soumission(s) · {classNames.length} classe(s)</p>
        </div>
        <button onClick={() => refetch()} className="p-2 hover:bg-slate-100 rounded-lg"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {/* ⭐ Hiérarchisé par classe → trimestre */}
      {classNames.map((className) => (
        <div key={className} className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
            <BookOpen className="h-4 w-4 text-slate-600" />
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{className}</h4>
            <span className="ml-auto text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full">
              {grouped[className].length}
            </span>
          </div>
          {/* ⭐ Sous-groupement par trimestre */}
          {Object.keys(groupedByTrimester[className]).map(trimester => (
            <div key={trimester} className="space-y-2 pl-4">
              <div className="flex items-center gap-2 px-2 py-1 bg-indigo-50 rounded">
                <Calendar className="h-3 w-3 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{trimester}</span>
                <span className="ml-auto text-xs text-indigo-500">
                  {groupedByTrimester[className][trimester].length} soumission(s)
                </span>
              </div>
              {/* ⭐ Évaluations du trimestre */}
              <div className="space-y-2 pl-4">
                {groupedByTrimester[className][trimester].map(item => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white">
                <div>
                  <p className="font-medium text-slate-900">
                    Évaluation N°{item.evaluationNumber || "—"} — {MONTH_NAMES[item.registerMonth || item.month] || "—"} {item.registerYear || item.year}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {item.teacherFirstName} {item.teacherLastName}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    <span className="text-blue-600 font-semibold">% réussite total: {item.pourcentageReussiteTotal?.toFixed?.(1) ?? item.pourcentageReussiteTotal ?? "—"}%</span>
                    <span className="text-emerald-600">Atteint: {item.ayantAtteintSeuilTotal ?? "—"}/{item.ayantComposeTotal ?? "—"}</span>
                    <span className="text-slate-500">Seuil: {item.seuilReussite ?? 10}/20</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">Soumis le {formatDateTimeFR(item.submittedAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleView(item)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                    <Eye className="h-3 w-3" /> Voir
                  </button>
                  <button onClick={() => setModalItem(item)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                    <CheckCircle2 className="h-3 w-3" /> Traiter
                  </button>
                </div>
              </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Modal remplacé par vue in-page MonthlyEvaluationDirectorDetail */}

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
// Pending Cahiers de Test (SECONDAIRE)
// ============================================================================

const TEST_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  DEVOIR: { label: "Devoir", color: "bg-blue-100 text-blue-700" },
  COMPOSITION: { label: "Composition", color: "bg-purple-100 text-purple-700" },
  INTERROGATION: { label: "Interrogation", color: "bg-amber-100 text-amber-700" },
  TEST: { label: "Test", color: "bg-emerald-100 text-emerald-700" },
};

function PendingCahierTestsTab({ tenantId, academicYearId, userId, refreshKey, onRefresh }: {
  tenantId: string; academicYearId: string; userId: string; refreshKey: number; onRefresh: () => void;
}) {
  // ⭐ Hook React Query partagé — cache 2 min, dégradation gracieuse
  const queryClient = useQueryClient();
  const { data: items = [], isLoading: loading, refetch } = usePendingCahierTextes(academicYearId);
  const [selected, setSelected] = useState<any>(null);
  const [modalItem, setModalItem] = useState<any>(null);

  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

  const handleValidate = async (action: "VALIDATED" | "REJECTED", reason?: string) => {
    if (!modalItem) return;
    await pedagogySpaceService.validateCahierTexte(modalItem.id, {
      action,
      validatedBy: userId,
      rejectionReason: reason,
    });
    toast.success(action === "VALIDATED" ? "✅ Cahier de test validé" : "Cahier de test rejeté");
    onRefresh();
    queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "pending-cahier-textes"] });
    queryClient.invalidateQueries({ queryKey: ["pedagogy", "director", "dashboard"] });
  };

  const handleView = async (item: any) => {
    try {
      const data = await pedagogySpaceService.getCahierTexteDetail(item.id);
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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <Award className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-700">Aucun cahier de test en attente</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Cahiers de Test en attente</h3>
          <p className="text-sm text-slate-500">{items.length} soumission(s)</p>
        </div>
        <button onClick={() => refetch()} className="p-2 hover:bg-slate-100 rounded-lg"><RefreshCw className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(item => {
          const testType = TEST_TYPE_LABELS[item.testType] || { label: item.testType, color: "bg-slate-100 text-slate-700" };
          return (
            <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-start justify-between mb-2">
                <div className={cn("flex items-center gap-2 px-2 py-1 rounded text-xs font-bold", testType.color)}>
                  {testType.label} N°{item.testNumber}
                </div>
                <span className="text-xs text-slate-400">T{item.trimester}</span>
              </div>
              <p className="font-medium text-slate-900 text-sm mb-1">{item.testTitle}</p>
              <p className="text-xs text-slate-500">
                Classe: <strong>{item.classNameResolved || "—"}</strong>
                {item.subjectName && <span> · {item.subjectName}</span>}
              </p>
              <p className="text-xs text-slate-500">
                {item.teacherFirstName} {item.teacherLastName} · {formatDateFR(item.testDate)}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs">
                <span>Sur {item.maxScore} · Seuil {item.passingScore} · Coef {item.coefficient}</span>
              </div>
              {item.averageScore !== null && item.averageScore !== undefined && (
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="font-bold text-blue-700">Moy: {item.averageScore?.toFixed(2)}</span>
                  <span className="font-bold text-emerald-700">Réussite: {item.passRate?.toFixed(1)}%</span>
                  <span className="text-slate-500">{item.totalStudents} élèves</span>
                </div>
              )}
              <p className="text-xs text-slate-400 mt-1">Soumis le {formatDateTimeFR(item.submittedAt)}</p>
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
                <button onClick={() => handleView(item)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                  <Eye className="h-3 w-3" /> Voir détail
                </button>
                <button onClick={() => setModalItem(item)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                  <CheckCircle2 className="h-3 w-3" /> Traiter
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{selected.testTitle}</h3>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-slate-100 rounded"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div><strong>Type:</strong> {TEST_TYPE_LABELS[selected.testType]?.label || selected.testType} N°{selected.testNumber}</div>
                <div><strong>Trimestre:</strong> T{selected.trimester}</div>
                <div><strong>Date:</strong> {formatDateFR(selected.testDate)}</div>
                <div><strong>Classe:</strong> {selected.classNameResolved || "—"}</div>
                <div><strong>Matière:</strong> {selected.subjectName || "—"}</div>
                <div><strong>Enseignant:</strong> {selected.teacherFirstName} {selected.teacherLastName}</div>
                <div><strong>Sur:</strong> {selected.maxScore} points</div>
                <div><strong>Seuil réussite:</strong> {selected.passingScore}</div>
                <div><strong>Coefficient:</strong> {selected.coefficient}</div>
              </div>

              {/* Statistiques */}
              {selected.averageScore !== null && selected.averageScore !== undefined && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <strong>Statistiques:</strong>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2 text-xs">
                    <div>Effectif: {selected.totalStudents || "—"} ({selected.boysCount || 0}G / {selected.girlsCount || 0}F)</div>
                    <div>Présents: {selected.totalPresent ?? "—"} / Absents: {selected.totalAbsent ?? "—"}</div>
                    <div className="font-bold text-blue-700">Moyenne: {selected.averageScore?.toFixed?.(2) ?? "—"}</div>
                    <div className="font-bold text-emerald-700">Réussite: {selected.passRate?.toFixed?.(1) ?? "—"}%</div>
                    <div>Note max: {selected.highestScore ?? "—"}</div>
                    <div>Note min: {selected.lowestScore ?? "—"}</div>
                    <div>G moy: {selected.boysAverage?.toFixed?.(2) ?? "—"} · F moy: {selected.girlsAverage?.toFixed?.(2) ?? "—"}</div>
                    <div>Réussi: {selected.passedCount ?? "—"} / Échoué: {selected.failedCount ?? "—"}</div>
                  </div>
                </div>
              )}

              {/* Notes des élèves */}
              {(() => {
                let scores = selected.studentScores;
                if (typeof scores === "string") {
                  try { scores = JSON.parse(scores); } catch { scores = []; }
                }
                if (!Array.isArray(scores) || scores.length === 0) {
                  return <div className="text-slate-400 text-xs italic">Aucune note saisie.</div>;
                }
                return (
                  <div>
                    <strong>Notes des élèves ({scores.length}):</strong>
                    <div className="overflow-x-auto mt-2 border border-slate-200 rounded-lg max-h-80 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 sticky top-0">
                          <tr>
                            <th className="px-2 py-1 text-left">N°</th>
                            <th className="px-2 py-1 text-left">Nom</th>
                            <th className="px-2 py-1 text-center">Sexe</th>
                            <th className="px-2 py-1 text-center">Note /{selected.maxScore}</th>
                            <th className="px-2 py-1 text-center">Statut</th>
                            <th className="px-2 py-1 text-left">Appréciation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scores.map((s: any, i: number) => {
                            const sc = parseFloat(s.score);
                            const isPassed = !isNaN(sc) && sc >= (selected.passingScore || 10);
                            return (
                              <tr key={s.studentId || i} className="hover:bg-slate-50">
                                <td className="px-2 py-1">{s.numero || i + 1}</td>
                                <td className="px-2 py-1">{s.nom} {s.prenom}</td>
                                <td className="px-2 py-1 text-center">{s.sexe}</td>
                                <td className="px-2 py-1 text-center font-bold">{s.absent ? "Absent" : (s.score ?? "—")}</td>
                                <td className="px-2 py-1 text-center">
                                  {s.absent ? "—" : (!isNaN(sc) ? (isPassed ? "✅" : "❌") : "—")}
                                </td>
                                <td className="px-2 py-1 text-xs">{s.appreciation || "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {selected.pedagogicalObservations && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                  <strong>Observations pédagogiques:</strong>
                  <p className="mt-1 text-slate-700">{selected.pedagogicalObservations}</p>
                </div>
              )}
              {selected.recommandations && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                  <strong>Recommandations:</strong>
                  <p className="mt-1 text-slate-700">{selected.recommandations}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ValidationModal
        open={!!modalItem}
        onClose={() => setModalItem(null)}
        onValidate={handleValidate}
        title={`Cahier de test — ${modalItem?.testTitle || ""}`}
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
  onBack,
  onValidated,
}: {
  journal: any;
  onBack: () => void;
  onValidated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [directorSignature, setDirectorSignature] = useState<string | null>(journal.directorSignature || null);
  const [directorGeneralObservation, setDirectorGeneralObservation] = useState<string>(journal.observations || "");
  const [directorObservations, setDirectorObservations] = useState<Record<string, string>>({});
  const [dynamicSubjects, setDynamicSubjects] = useState<any[]>([]);
  // ⭐ Fiches pédagogiques rattachées au cahier journal (vue hiérarchique par jour)
  const [fichesData, setFichesData] = useState<any>(null);
  const [fichesLoading, setFichesLoading] = useState(false);
  const [exportingFiche, setExportingFiche] = useState<string | null>(null);

  // ⭐ Charger les fiches pédagogiques rattachées à ce cahier journal
  useEffect(() => {
    if (!journal.id) return;
    let cancelled = false;
    (async () => {
      setFichesLoading(true);
      try {
        const res = await apiClient.get(`/pedagogy-space/cahier-journal/${journal.id}/fiches`);
        if (!cancelled) setFiches(res.data);
      } catch {
        if (!cancelled) setFichesData(null);
      } finally {
        if (!cancelled) setFichesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [journal.id]);

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
  useEffect(() => {
    if (!journal.classId || !journal.academicYearId) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy-space/subjects/available?academicYearId=${journal.academicYearId}&classId=${journal.classId}&teacherId=${journal.teacherId}`,
          { credentials: "include" }
        );
        const data = await res.json();
        setDynamicSubjects(Array.isArray(data) ? data : []);
      } catch {
        setDynamicSubjects([]);
      }
    })();
  }, [journal.id, journal.classId, journal.academicYearId, journal.teacherId]);

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

  const handleValidate = async (action: 'VALIDATED' | 'REJECTED') => {
    if (action === 'VALIDATED' && !directorSignature) {
      toast.error("Signature obligatoire", {
        description: "Vous devez signer avant de valider le cahier journal.",
      });
      return;
    }
    const ok = window.confirm(
      action === 'VALIDATED'
        ? `Valider ce cahier journal ?\n\nL'enseignant recevra une notification (email + WhatsApp + SMS) avec votre décision et votre signature.`
        : `Rejeter ce cahier journal ?\n\nL'enseignant recevra une notification de rejet.`
    );
    if (!ok) return;
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
          ? "L'enseignant a été notifié et recevra la version validée avec votre signature."
          : "L'enseignant a été notifié du rejet.",
      });
      onValidated();
    } catch (err: any) {
      toast.error('Erreur lors de la validation', { description: err.message });
    } finally {
      setSaving(false);
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

  return (
    <div className="space-y-4">
      {/* ⭐ Action bar */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Retour à la liste
        </button>
        <div className="flex items-center gap-2">
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
              <button
                onClick={() => handleValidate('REJECTED')}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Rejeter
              </button>
              <button
                onClick={() => handleValidate('VALIDATED')}
                disabled={saving || !directorSignature}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                title={!directorSignature ? "Signature obligatoire" : "Valider"}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {directorSignature ? 'Valider' : 'Signature requise'}
              </button>
            </>
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

      {/* ⭐ FICHES PÉDAGOGIQUES RATTACHÉES — Vue hiérarchique par jour */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Fiches Pédagogiques Jointes</h3>
            <p className="text-xs text-slate-500">
              {fichesData?.stats ? `${fichesData.stats.totalFiches || 0} fiche(s) · ${fichesData.stats.totalFichesPreparees || 0}/${fichesData.stats.totalMatieresPlanifiees || 0} préparées` : ''}
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
                <div key={day} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-3.5 w-3.5 text-blue-600" />
                    <h4 className="text-xs font-bold uppercase text-slate-700">{dayLabels[day]}</h4>
                    <span className="text-[10px] text-slate-400">{dayFiches.length} fiche(s)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {dayFiches.map((fiche: any) => (
                      <div key={fiche.id} className="flex items-center justify-between border border-slate-100 rounded-lg p-2 bg-slate-50/50">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-700 truncate">
                            {fiche.sheetType} — {fiche.titre || fiche.cours || 'Sans titre'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {fiche.status === 'SUBMITTED' ? '✓ Soumise' : fiche.status === 'VALIDATED' ? '✓ Validée' : 'Brouillon'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleExportFiche(fiche.id)}
                          disabled={exportingFiche === fiche.id}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 shrink-0 ml-2"
                        >
                          {exportingFiche === fiche.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Download className="h-2.5 w-2.5" />}
                          PDF
                        </button>
                      </div>
                    ))}
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
};

function PedagogicalFicheDirectorDetail({ fiche, userId, onBack, onValidated }: { fiche: any; userId: string; onBack: () => void; onValidated: () => void; }) {
  const [saving, setSaving] = useState(false);
  const [directorSignature, setDirectorSignature] = useState<string | null>(fiche.directorSignature || null);
  const [directorGeneralObservation, setDirectorGeneralObservation] = useState<string>(fiche.directorObservation || "");
  const [sectionObservations, setSectionObservations] = useState<Record<string, string>>({});

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

  const handleValidate = async (action: "VALIDATED" | "REJECTED") => {
    if (action === "VALIDATED" && !directorSignature) { toast.error("Signature obligatoire"); return; }
    if (!window.confirm(action === "VALIDATED" ? "Valider cette fiche ?" : "Rejeter cette fiche ?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pedagogy-space/director/fiches/" + fiche.id + "/director-update", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ directorSectionObservations: sectionObservations, directorObservation: directorGeneralObservation, directorSignature, action, validatedBy: userId }) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      toast.success(action === "VALIDATED" ? "Fiche validée" : "Fiche rejetée");
      onValidated();
    } catch (err: any) { toast.error("Erreur", { description: err.message }); } finally { setSaving(false); }
  };

  const renderField = (label: string, value: string | null | undefined) => (
    <div className="mb-3"><label className="block text-xs font-bold text-slate-600 uppercase mb-1">{label}</label><div className="text-sm text-slate-800 min-h-[40px] p-2 bg-slate-50 rounded border border-slate-200">{value ? <div dangerouslySetInnerHTML={{ __html: value }} /> : <span className="text-slate-300">—</span>}</div></div>
  );
  const renderObs = (key: string, label: string) => (
    <div className="mb-3 bg-red-50/30 p-2 rounded border border-red-200"><label className="block text-xs font-bold text-red-700 uppercase mb-1">{label} (rouge)</label><textarea value={sectionObservations[key] || ""} onChange={(e) => setSectionObservations(prev => ({ ...prev, [key]: e.target.value }))} disabled={saving || isAlreadyValidated} placeholder="Observation..." className="w-full px-2 py-1 text-xs text-red-700 font-semibold border border-red-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-red-400 resize-none" style={{ minHeight: "50px" }} /></div>
  );
  const fmt = (d: string | Date) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-3">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"><ChevronRight className="w-4 h-4 rotate-180" /> Retour</button>
        <div className="flex items-center gap-2">
          {isAlreadyValidated && <span className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">Validé</span>}
          {isAlreadyRejected && <span className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-bold">Rejeté</span>}
          {!isAlreadyValidated && !isAlreadyRejected && (<><button onClick={() => handleValidate("REJECTED")} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Rejeter</button><button onClick={() => handleValidate("VALIDATED")} disabled={saving || !directorSignature} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {directorSignature ? "Valider" : "Signature requise"}</button></>)}
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
