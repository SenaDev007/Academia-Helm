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
  CalendarDays, CalendarRange, Folder, FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDirectorPedagogyDashboard,
  usePendingCahierJournals, usePendingFiches, usePendingRegisters,
  usePendingEvaluations,
  usePendingSemainiers, useSemainierReports, useSemainierCatalogue,
  useCahierJournalDetail, useFicheDetail, useRegisterDetail,
  useEvaluationDetail,
} from "@/lib/query/pedagogy-hooks";
import { pedagogySpaceService } from "@/services/pedagogy-space.service";
import apiClient from "@/lib/api/client";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { SignatureCanvas } from "@/components/ui/SignatureCanvas";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useAppSession } from "@/contexts/AppSessionContext";
// ⭐ Import des composants full-fidelity du Cahier du Semainier (même rendu que l'espace enseignant)
import { DailyReportCard, WeeklyReportCard } from "@/components/pedagogy/production/CahierSemaineTab";

interface DirectorPedagogyControlProps {
  tenantId: string;
  academicYearId: string;
  userId: string;
}

// ⭐ RESTRICTION NIVEAU : Cahier Journal, Fiches Pédagogiques, Registres d'Appel
//    et Évaluations Mensuelles sont réservés aux niveaux MATERNELLE + PRIMAIRE.
//    Un directeur affecté au SECONDAIRE ne voit PAS ces onglets dans son espace
//    de validation direction. Le PROMOTEUR et les rôles plateforme ont accès à TOUT.
//    ⭐ Cahier du Semainier est visible pour TOUS les niveaux (maternelle + primaire
//       + secondaire) car le semainier est une responsabilité transverse.
const TABS = [
  { id: "dashboard", label: "Tableau de bord", icon: AlertTriangle, maternellePrimaireOnly: false },
  { id: "monthly-plans", label: "Planifications Mensuelles", icon: CalendarRange, maternellePrimaireOnly: true },
  { id: "cahier-journal", label: "Cahiers Journal & Fiches", icon: FileSpreadsheet, maternellePrimaireOnly: true },
  { id: "registres", label: "Registres d'Appel", icon: ClipboardList, maternellePrimaireOnly: true },
  { id: "evaluations", label: "Évaluations Mensuelles", icon: BookOpen, maternellePrimaireOnly: true },
  { id: "seminaire", label: "Cahier du Semainier", icon: CalendarDays, maternellePrimaireOnly: false },
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

  // ⭐ Récupérer le niveau scolaire actif depuis le dropdown (useModuleContext)
  //    et le rôle de l'utilisateur (useAppSession) pour filtrer les onglets.
  const { schoolLevel } = useModuleContext();
  const { user } = useAppSession();

  // ⭐ Déterminer si le niveau scolaire actif est "Secondaire"
  const schoolLevelCode = (schoolLevel?.code || '').toUpperCase();
  const isSecondaryLevel =
    schoolLevelCode.includes('SECOND') ||
    schoolLevelCode.includes('COLLEGE') ||
    schoolLevelCode.includes('LYCEE');

  // ⭐ Rôles "accès global" qui voient TOUS les onglets quel que soit le niveau sélectionné
  const GLOBAL_ACCESS_ROLES = new Set([
    'PROMOTER', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN',
  ]);
  const userRole = (user?.role || '').toUpperCase();
  const hasGlobalAccess = GLOBAL_ACCESS_ROLES.has(userRole);

  // ⭐ Filtrer les onglets visibles selon le niveau scolaire :
  //    - maternellePrimaireOnly=true → masqué si isSecondaryLevel (sauf accès global)
  //    Le PROMOTEUR voit tous les onglets quel que soit le niveau sélectionné.
  const VISIBLE_TABS = TABS.filter(t => {
    if (t.maternellePrimaireOnly && isSecondaryLevel && !hasGlobalAccess) return false;
    return true;
  });

  // ⭐ Si l'onglet actif n'est plus visible (ex: directeur passe au niveau Secondaire
  //    alors que l'onglet 'cahier-journal' est actif), on revient à l'onglet 'dashboard'.
  useEffect(() => {
    if (tab !== 'dashboard' && !VISIBLE_TABS.some(t => t.id === tab)) {
      setTab('dashboard');
    }
  }, [tab, VISIBLE_TABS]);

  const refresh = () => setRefreshKey(k => k + 1);

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-100">
          {VISIBLE_TABS.map(t => {
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
          <DashboardTab tenantId={tenantId} academicYearId={academicYearId} refreshKey={refreshKey} onNavigate={setTab} isSecondaryLevel={isSecondaryLevel} hasGlobalAccess={hasGlobalAccess} />
        )}
        {tab === "cahier-journal" && (
          <PendingCahierJournalsTab tenantId={tenantId} academicYearId={academicYearId} userId={userId} refreshKey={refreshKey} onRefresh={refresh} />
        )}
        {tab === "monthly-plans" && (
          <PendingMonthlyPlansTab tenantId={tenantId} academicYearId={academicYearId} userId={userId} refreshKey={refreshKey} onRefresh={refresh} />
        )}
        {tab === "registres" && (
          <PendingRegistersTab tenantId={tenantId} academicYearId={academicYearId} userId={userId} refreshKey={refreshKey} onRefresh={refresh} />
        )}
        {tab === "evaluations" && (
          <PendingEvaluationsTab tenantId={tenantId} academicYearId={academicYearId} userId={userId} refreshKey={refreshKey} onRefresh={refresh} />
        )}
        {tab === "seminaire" && (
          <PendingSemainiersTab tenantId={tenantId} academicYearId={academicYearId} userId={userId} refreshKey={refreshKey} onRefresh={refresh} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Tableau de bord
// ============================================================================

function DashboardTab({ tenantId, academicYearId, refreshKey, onNavigate, isSecondaryLevel, hasGlobalAccess }: {
  tenantId: string; academicYearId: string; refreshKey: number; onNavigate: (t: TabId) => void; isSecondaryLevel: boolean; hasGlobalAccess: boolean;
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
    {
      label: "Cahiers Journal",
      pending: dashboard.pendingCahierJournals,
      validated: dashboard.validatedCahierJournals || 0,
      rejected: dashboard.rejectedCahierJournals || 0,
      total: dashboard.totalCahierJournals || (dashboard.pendingCahierJournals || 0),
      icon: FileSpreadsheet,
      color: "bg-blue-50 text-blue-700 border-blue-200",
      tab: "cahier-journal" as TabId,
    },
    {
      label: "Fiches Pédagogiques",
      pending: dashboard.pendingFiches,
      validated: dashboard.validatedFiches || 0,
      rejected: dashboard.rejectedFiches || 0,
      total: dashboard.totalFiches || (dashboard.pendingFiches || 0),
      icon: FileText,
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      tab: "fiches" as TabId,
    },
    {
      label: "Registres d'Appel",
      pending: dashboard.pendingAttendanceRegisters,
      validated: dashboard.validatedAttendanceRegisters || 0,
      rejected: dashboard.rejectedAttendanceRegisters || 0,
      total: dashboard.totalAttendanceRegisters || (dashboard.pendingAttendanceRegisters || 0),
      icon: ClipboardList,
      color: "bg-amber-50 text-amber-700 border-amber-200",
      tab: "registres" as TabId,
    },
    {
      label: "Évaluations Mensuelles",
      pending: dashboard.pendingMonthlyEvaluations,
      validated: dashboard.validatedMonthlyEvaluations || 0,
      rejected: dashboard.rejectedMonthlyEvaluations || 0,
      total: dashboard.totalMonthlyEvaluations || (dashboard.pendingMonthlyEvaluations || 0),
      icon: BookOpen,
      color: "bg-purple-50 text-purple-700 border-purple-200",
      tab: "evaluations" as TabId,
    },
    {
      label: "Cahier du Semainier",
      pending: dashboard.pendingWeeklySummaries || dashboard.pendingWeeklyLogs || 0,
      validated: 0,
      rejected: 0,
      total: dashboard.pendingWeeklySummaries || dashboard.pendingWeeklyLogs || 0,
      icon: CalendarDays,
      color: "bg-purple-50 text-purple-700 border-purple-200",
      tab: "seminaire" as TabId,
    },
  ];

  // ⭐ Filtrer les cartes visibles selon le niveau scolaire :
  //    Si le directeur est au niveau Secondaire et n'a pas d'accès global,
  //    on masque les cartes pour Cahiers Journal, Registres, Évaluations
  //    (ces fonctionnalités sont réservées Maternelle + Primaire).
  const VISIBLE_CARDS = isSecondaryLevel && !hasGlobalAccess
    ? cards.filter(card => !card.tab || !['cahier-journal', 'registres', 'evaluations'].includes(card.tab as string))
    : cards;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Tableau de bord — Validation pédagogique</h2>
        <p className="text-sm text-slate-500 mt-1">
          {dashboard.totalPending} soumission(s) en attente de validation
        </p>
      </div>

      {/* ⭐ COMPTEUR TOTAL avec breakdown par statut (en attente / validés / rejetés) */}
      {/*    Ex: "47 registres au total — 5 en attente, 38 validés, 4 rejetés" */}
      {(dashboard.totalProcessed || 0) > 0 && (
        <div className="bg-gradient-to-r from-slate-50 to-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Synthèse globale — {dashboard.totalProcessed} élément(s) traité(s) au total
            </h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-blue-200 rounded-lg p-2.5 text-center">
              <div className="text-2xl font-bold text-blue-700">{dashboard.totalPending}</div>
              <div className="text-[10px] font-semibold uppercase text-blue-600 mt-0.5 flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" /> En attente
              </div>
            </div>
            <div className="bg-white border border-emerald-200 rounded-lg p-2.5 text-center">
              <div className="text-2xl font-bold text-emerald-700">{dashboard.totalValidated}</div>
              <div className="text-[10px] font-semibold uppercase text-emerald-600 mt-0.5 flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Validés
              </div>
            </div>
            <div className="bg-white border border-red-200 rounded-lg p-2.5 text-center">
              <div className="text-2xl font-bold text-red-700">{dashboard.totalRejected}</div>
              <div className="text-[10px] font-semibold uppercase text-red-600 mt-0.5 flex items-center justify-center gap-1">
                <XCircle className="h-3 w-3" /> Rejetés
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {VISIBLE_CARDS.map((card) => {
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
              <div className="flex-1 min-w-0">
                {/* ⭐ Affichage du compteur total + breakdown par statut */}
                <div className="flex items-baseline gap-1.5">
                  <div className="text-3xl font-bold">{card.total}</div>
                  <div className="text-[10px] text-slate-500 font-medium">au total</div>
                </div>
                <div className="text-xs font-semibold uppercase tracking-wide mt-1">{card.label}</div>
                {/* ⭐ Breakdown par statut (uniquement si au moins 1 validé/rejeté) */}
                {(card.validated > 0 || card.rejected > 0) && (
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] font-medium">
                    <span className="text-blue-600 flex items-center gap-0.5" title="En attente de validation">
                      <Clock className="h-2.5 w-2.5" /> {card.pending}
                    </span>
                    <span className="text-emerald-600 flex items-center gap-0.5" title="Validés">
                      <CheckCircle2 className="h-2.5 w-2.5" /> {card.validated}
                    </span>
                    <span className="text-red-600 flex items-center gap-0.5" title="Rejetés">
                      <XCircle className="h-2.5 w-2.5" /> {card.rejected}
                    </span>
                  </div>
                )}
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

  // ⭐ Pre-populer les 3 trimesters (T1, T2, T3) sous chaque school level
  //    Même si un trimestre a 0 items dans le sous-onglet courant, on l'affiche
  //    comme dossier vide — permet au bouton 'Tout replier' de ne replier QUE
  //    ces niveaux vides (cf. demande utilisateur).
  const ALL_TRIMESTERS_CJ = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
  for (const sl of Object.keys(hierarchy)) {
    for (const tr of ALL_TRIMESTERS_CJ) {
      if (!hierarchy[sl][tr]) {
        hierarchy[sl][tr] = {}; // Trimestre vide (0 items)
      }
    }
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
  //    'Tout replier' ne replie QUE les niveaux vides (ceux qui n'ont pas d'items
  //    dans le sous-onglet courant) — cf. demande utilisateur.
  //    Les niveaux avec items restent dépliés pour préserver la visibilité des items.
  const allSchoolLevelKeysCJ = sortedLevels;
  const allTrimesterKeysCJ: string[] = [];
  const allClassKeysCJ: string[] = [];
  // ⭐ Niveaux vides = niveaux avec 0 item dans le sous-onglet courant
  const emptySchoolLevelKeysCJ: string[] = [];
  const emptyTrimesterKeysCJ: string[] = [];
  for (const sl of sortedLevels) {
    let slHasItems = false;
    for (const tr of Object.keys(hierarchy[sl])) {
      const trimesterKey = `${sl}::${tr}`;
      allTrimesterKeysCJ.push(trimesterKey);
      const classKeysInTrimester = Object.keys(hierarchy[sl][tr]);
      const trimesterItemsCount = classKeysInTrimester.reduce(
        (s, cn) => s + (hierarchy[sl][tr][cn]?.length || 0), 0
      );
      for (const cn of classKeysInTrimester) {
        allClassKeysCJ.push(`${sl}::${tr}::${cn}`);
      }
      if (trimesterItemsCount === 0) {
        emptyTrimesterKeysCJ.push(trimesterKey);
      } else {
        slHasItems = true;
      }
    }
    if (!slHasItems) {
      emptySchoolLevelKeysCJ.push(sl);
    }
  }
  const handleExpandAllCJ = () => {
    setCollapsedSchoolLevels(new Set());
    setCollapsedTrimesters(new Set());
    setCollapsedClasses(new Set());
  };
  // ⭐ 'Tout replier' ne replie QUE les niveaux vides (sans items dans le sous-onglet courant)
  const handleCollapseAllCJ = () => {
    setCollapsedSchoolLevels(new Set(emptySchoolLevelKeysCJ));
    setCollapsedTrimesters(new Set(emptyTrimesterKeysCJ));
    setCollapsedClasses(new Set()); // Les classes ont toujours des items (construites à partir d'items)
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
            title="Tout replier (replie uniquement les niveaux vides — les niveaux avec items restent visibles)"
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

  // ⭐ Pre-populer les 3 trimesters (T1, T2, T3) sous chaque school level
  //    Même si un trimestre a 0 items dans le sous-onglet courant, on l'affiche
  //    comme dossier vide — permet au bouton 'Tout replier' de ne replier QUE
  //    ces niveaux vides (cf. demande utilisateur).
  const ALL_TRIMESTERS_PF = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
  for (const sl of Object.keys(hierarchy)) {
    for (const tr of ALL_TRIMESTERS_PF) {
      if (!hierarchy[sl][tr]) {
        hierarchy[sl][tr] = {};
      }
    }
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
  //    'Tout replier' ne replie QUE les niveaux vides (ceux qui n'ont pas d'items
  //    dans le sous-onglet courant) — les niveaux avec items restent dépliés.
  const allSchoolLevelKeysPF = sortedLevels;
  const allTrimesterKeysPF: string[] = [];
  const allClassKeysPF: string[] = [];
  const emptySchoolLevelKeysPF: string[] = [];
  const emptyTrimesterKeysPF: string[] = [];
  for (const sl of sortedLevels) {
    let slHasItems = false;
    for (const tr of Object.keys(hierarchy[sl])) {
      const trimesterKey = `${sl}::${tr}`;
      allTrimesterKeysPF.push(trimesterKey);
      const classKeysInTrimester = Object.keys(hierarchy[sl][tr]);
      const trimesterItemsCount = classKeysInTrimester.reduce(
        (s, cn) => s + (hierarchy[sl][tr][cn]?.length || 0), 0
      );
      for (const cn of classKeysInTrimester) {
        allClassKeysPF.push(`${sl}::${tr}::${cn}`);
      }
      if (trimesterItemsCount === 0) {
        emptyTrimesterKeysPF.push(trimesterKey);
      } else {
        slHasItems = true;
      }
    }
    if (!slHasItems) {
      emptySchoolLevelKeysPF.push(sl);
    }
  }
  const handleExpandAllPF = () => {
    setCollapsedSchoolLevels(new Set());
    setCollapsedTrimesters(new Set());
    setCollapsedClasses(new Set());
  };
  const handleCollapseAllPF = () => {
    setCollapsedSchoolLevels(new Set(emptySchoolLevelKeysPF));
    setCollapsedTrimesters(new Set(emptyTrimesterKeysPF));
    setCollapsedClasses(new Set());
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
            title="Tout replier (replie uniquement les niveaux vides — les niveaux avec items restent visibles)"
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

  // ⭐ Pre-populer les 3 trimesters (T1, T2, T3) sous chaque school level
  //    Même si un trimestre a 0 items dans le sous-onglet courant, on l'affiche
  //    comme dossier vide — permet au bouton 'Tout replier' de ne replier QUE
  //    ces niveaux vides (cf. demande utilisateur).
  const ALL_TRIMESTERS_RG = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
  for (const sl of Object.keys(hierarchy)) {
    for (const tr of ALL_TRIMESTERS_RG) {
      if (!hierarchy[sl][tr]) {
        hierarchy[sl][tr] = {};
      }
    }
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
  //    'Tout replier' ne replie QUE les niveaux vides (ceux qui n'ont pas d'items
  //    dans le sous-onglet courant) — les niveaux avec items restent dépliés.
  const allSchoolLevelKeys = sortedLevels;
  const allTrimesterKeys: string[] = [];
  const allClassKeys: string[] = [];
  const emptySchoolLevelKeys: string[] = [];
  const emptyTrimesterKeys: string[] = [];
  for (const sl of sortedLevels) {
    let slHasItems = false;
    for (const tr of Object.keys(hierarchy[sl])) {
      const trimesterKey = `${sl}::${tr}`;
      allTrimesterKeys.push(trimesterKey);
      const classKeysInTrimester = Object.keys(hierarchy[sl][tr]);
      const trimesterItemsCount = classKeysInTrimester.reduce(
        (s, cn) => s + (hierarchy[sl][tr][cn]?.length || 0), 0
      );
      for (const cn of classKeysInTrimester) {
        allClassKeys.push(`${sl}::${tr}::${cn}`);
      }
      if (trimesterItemsCount === 0) {
        emptyTrimesterKeys.push(trimesterKey);
      } else {
        slHasItems = true;
      }
    }
    if (!slHasItems) {
      emptySchoolLevelKeys.push(sl);
    }
  }
  const handleExpandAll = () => {
    setCollapsedSchoolLevels(new Set());
    setCollapsedTrimesters(new Set());
    setCollapsedClasses(new Set());
  };
  const handleCollapseAll = () => {
    setCollapsedSchoolLevels(new Set(emptySchoolLevelKeys));
    setCollapsedTrimesters(new Set(emptyTrimesterKeys));
    setCollapsedClasses(new Set());
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
            title="Tout replier (replie uniquement les niveaux vides — les niveaux avec items restent visibles)"
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

  // ⭐ Pre-populer les 3 trimesters (T1, T2, T3) sous chaque school level
  //    Même si un trimestre a 0 items dans le sous-onglet courant, on l'affiche
  //    comme dossier vide — permet au bouton 'Tout replier' de ne replier QUE
  //    ces niveaux vides (cf. demande utilisateur).
  const ALL_TRIMESTERS_EV = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
  for (const sl of Object.keys(hierarchy)) {
    for (const tr of ALL_TRIMESTERS_EV) {
      if (!hierarchy[sl][tr]) {
        hierarchy[sl][tr] = {};
      }
    }
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
  //    'Tout replier' ne replie QUE les niveaux vides (ceux qui n'ont pas d'items
  //    dans le sous-onglet courant) — les niveaux avec items restent dépliés.
  const allSchoolLevelKeys = sortedLevels;
  const allTrimesterKeys: string[] = [];
  const allClassKeys: string[] = [];
  const emptySchoolLevelKeys: string[] = [];
  const emptyTrimesterKeys: string[] = [];
  for (const sl of sortedLevels) {
    let slHasItems = false;
    for (const tr of Object.keys(hierarchy[sl])) {
      const trimesterKey = `${sl}::${tr}`;
      allTrimesterKeys.push(trimesterKey);
      const classKeysInTrimester = Object.keys(hierarchy[sl][tr]);
      const trimesterItemsCount = classKeysInTrimester.reduce(
        (s, cn) => s + (hierarchy[sl][tr][cn]?.length || 0), 0
      );
      for (const cn of classKeysInTrimester) {
        allClassKeys.push(`${sl}::${tr}::${cn}`);
      }
      if (trimesterItemsCount === 0) {
        emptyTrimesterKeys.push(trimesterKey);
      } else {
        slHasItems = true;
      }
    }
    if (!slHasItems) {
      emptySchoolLevelKeys.push(sl);
    }
  }
  const handleExpandAll = () => {
    setCollapsedSchoolLevels(new Set());
    setCollapsedTrimesters(new Set());
    setCollapsedClasses(new Set());
  };
  const handleCollapseAll = () => {
    setCollapsedSchoolLevels(new Set(emptySchoolLevelKeys));
    setCollapsedTrimesters(new Set(emptyTrimesterKeys));
    setCollapsedClasses(new Set());
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
            title="Tout replier (replie uniquement les niveaux vides — les niveaux avec items restent visibles)"
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
      toast.success("📧 Notification envoyée à l'enseignant", {
        description: `L'enseignant recevra ${journal.status === 'VALIDATED' ? 'la version validée' : 'le rejet'} avec vos observations par email, WhatsApp et SMS.`,
      });
      setHasBeenSent(true);
    } catch (err: any) {
      toast.error("Erreur lors de l'envoi", { description: err.message });
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

// ============================================================================
// ⭐ PHASE 4 — CAHIER DU SEMAINIER : Validation direction
// ============================================================================
//  Nouvel onglet "Cahier du Semainier" dans DirectorPedagogyControl
//  4 sous-onglets : En attente (SUBMITTED) / Validés (VALIDATED) / Rejetés (REJECTED) / Catalogue
//  Le directeur peut consulter, valider ou rejeter les rapports de fin de semaine
//  soumis par les semainiers.
// ============================================================================

function PendingSemainiersTab({ tenantId, academicYearId, userId, refreshKey, onRefresh }: {
  tenantId: string; academicYearId: string; userId: string; refreshKey: number; onRefresh: () => void;
}) {
  // ⭐ 4 sous-onglets : en attente / validés / rejetés / catalogue
  const [statusTab, setStatusTab] = useState<'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'CATALOGUE'>('SUBMITTED');
  // ⭐ FIX : fetch ALL semainiers une seule fois (status='ALL'), puis filtrer côté client.
  //    Avant ce fix, on fetchait 3 fois (une par statusTab), mais les badges de
  //    compteur affichaient TOUS le même nombre (le count du sous-onglet actif)
  //    car ils utilisaient le même `items` array.
  //    Maintenant on fetch ALL une fois, on calcule les counts par statut, et on
  //    filtre l'affichage selon le sous-onglet actif.
  //    Catalogue : ne contient QUE les semainiers VALIDATED (cahiers de semaine
  //    officiellement validés par le directeur — pas tous les 36 semaines).
  const { data: allSemainiers = [], isLoading: loading, refetch } = usePendingSemainiers(academicYearId, 'ALL');
  const [selected, setSelected] = useState<any>(null);
  // ⭐ États repliables (chevrons) pour la hiérarchie : trimester → items
  const [collapsedTrimesters, setCollapsedTrimesters] = useState<Set<string>>(new Set());

  // ⭐ Compter les items par statut (pour les badges des sous-onglets)
  const submittedCount = allSemainiers.filter((c: any) => (c.status || '').toUpperCase() === 'SUBMITTED').length;
  const validatedCount = allSemainiers.filter((c: any) => (c.status || '').toUpperCase() === 'VALIDATED').length;
  const rejectedCount = allSemainiers.filter((c: any) => (c.status || '').toUpperCase() === 'REJECTED').length;

  // ⭐ Items à afficher selon le sous-onglet actif (filtrer côté client)
  //    CATALOGUE : ne montre QUE les VALIDATED
  //    SUBMITTED/VALIDATED/REJECTED : montre les items correspondants
  const items = statusTab === 'CATALOGUE'
    ? allSemainiers.filter((c: any) => (c.status || '').toUpperCase() === 'VALIDATED')
    : allSemainiers.filter((c: any) => (c.status || '').toUpperCase() === statusTab);

  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey, refetch]);

  // ⭐ Réinitialiser la sélection quand on change de sous-onglet
  useEffect(() => {
    setSelected(null);
  }, [statusTab]);

  // ⭐ Note : la validation/rejet se fait maintenant dans SemainierDirectorDetail
  //    (vue détaillée) qui a son propre SignModal (avec SignatureCanvas) et
  //    RejectModal (avec motif). Plus de ValidationModal générique au niveau liste.

  const handleView = async (item: any) => {
    setSelected(item); // la vue détaillée utilise useSemainierReports(configId) en interne
  };

  const toggleCollapse = (key: string) => {
    setCollapsedTrimesters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ⭐ Si un semainier est sélectionné, afficher la vue détaillée in-page
  if (selected) {
    return (
      <SemainierDirectorDetail
        config={selected}
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

  // ⭐ Hiérarchisation : trimester → items (le semainier n'a pas de schoolLevel)
  const getTrimester = (trimesterNum?: number): string => {
    if (trimesterNum === 1) return 'Trimestre 1';
    if (trimesterNum === 2) return 'Trimestre 2';
    if (trimesterNum === 3) return 'Trimestre 3';
    return 'Trimestre inconnu';
  };

  const hierarchy: Record<string, any[]> = {};
  for (const item of items) {
    const tr = getTrimester(item.trimester);
    if (!hierarchy[tr]) hierarchy[tr] = [];
    hierarchy[tr].push(item);
  }

  // ⭐ Pre-populer les 3 trimesters même vides
  const ALL_TRIMESTERS_SM = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
  for (const tr of ALL_TRIMESTERS_SM) {
    if (!hierarchy[tr]) hierarchy[tr] = [];
  }

  const tabConfig = {
    SUBMITTED: { label: 'En attente', icon: Clock, color: 'text-blue-700 bg-blue-50' },
    VALIDATED: { label: 'Validés', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
    REJECTED: { label: 'Rejetés', icon: XCircle, color: 'text-red-700 bg-red-50' },
    CATALOGUE: { label: 'Catalogue', icon: CalendarRange, color: 'text-slate-700 bg-slate-50' },
  };

  // ⭐ Helper format date court
  const fmtDate = (s?: string) => {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('fr-FR');
  };

  // ⭐ Statut badge
  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    const styles: Record<string, string> = {
      PENDING: 'bg-slate-100 text-slate-700',
      SIGNED: 'bg-blue-100 text-blue-700',
      SUBMITTED: 'bg-amber-100 text-amber-700',
      VALIDATED: 'bg-emerald-100 text-emerald-700',
      REJECTED: 'bg-rose-100 text-rose-700',
    };
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      SIGNED: 'Signé',
      SUBMITTED: 'Soumis',
      VALIDATED: 'Validé',
      REJECTED: 'Rejeté',
    };
    return (
      <span className={cn('px-2 py-0.5 rounded text-xs font-bold', styles[s] || styles.PENDING)}>
        {labels[s] || s}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* ⭐ En-tête descriptif */}
      <div className="bg-gradient-to-r from-purple-50 to-slate-50 border border-purple-200 rounded-xl p-3">
        <div className="flex items-start gap-2">
          <CalendarDays className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Validation des Cahiers du Semainier</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {statusTab === 'CATALOGUE'
                ? 'Catalogue de toutes les semaines de l\'année (tous statuts confondus).'
                : `Le semainier soumet chaque semaine un rapport quotidien (5 jours) + un rapport hebdo. Validez ou rejetez les soumissions reçues.`}
            </p>
          </div>
        </div>
      </div>

      {/* ⭐ Sous-onglets statut : En attente / Validés / Rejetés / Catalogue */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {(Object.keys(tabConfig) as Array<keyof typeof tabConfig>).map(s => {
          const cfg = tabConfig[s];
          const Icon = cfg.icon;
          // ⭐ FIX : chaque sous-onglet affiche son PROPRE compteur (pas le même)
          //    Avant, tous les badges affichaient le même `items.length` (celui du
          //    sous-onglet actif) — par ex. 36 36 36 si on était sur un sous-onglet
          //    avec 36 items. Maintenant chaque badge a son propre count.
          //    Catalogue : affiche le count de VALIDATED (seuls les validés sont
          //    dans le catalogue).
          const count = s === 'SUBMITTED' ? submittedCount
            : s === 'VALIDATED' ? validatedCount
              : s === 'REJECTED' ? rejectedCount
                : s === 'CATALOGUE' ? validatedCount
                  : null;
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
              {count !== null && (
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                  s === 'SUBMITTED' ? "bg-blue-100 text-blue-700"
                    : s === 'VALIDATED' || s === 'CATALOGUE' ? "bg-emerald-100 text-emerald-700"
                      : s === 'REJECTED' ? "bg-rose-100 text-rose-700"
                        : "bg-slate-200 text-slate-700"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
          <CalendarDays className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-medium">
            {statusTab === 'SUBMITTED' && 'Aucun semainier en attente de validation'}
            {statusTab === 'VALIDATED' && 'Aucun semainier validé'}
            {statusTab === 'REJECTED' && 'Aucun semainier rejeté'}
            {statusTab === 'CATALOGUE' && 'Aucun semainier validé dans le catalogue'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {statusTab === 'CATALOGUE'
              ? 'Le catalogue ne contient que les cahiers de semaine OFFICIELLEMENT VALIDÉS par le directeur. Validez d\'abord des semainiers dans l\'onglet "En attente" pour les voir apparaître ici.'
              : 'Les semainiers soumis par les enseignants apparaîtront ici pour validation.'}
          </p>
        </div>
      ) : statusTab === 'CATALOGUE' ? (
        // ⭐ CATALOGUE : dossiers imbriqués par année scolaire → trimestre → semaines
        //    Pattern identique à CatalogueTab (cahiers journaux) :
        //    - Niveau racine : liste des années scolaires (dossiers)
        //    - Clic sur une année → liste des trimestres (dossiers)
        //    - Clic sur un trimestre → liste des semaines (chacune avec 5 rapports journaliers + 1 rapport hebdo)
        //    - Clic sur une semaine → vue détaillée SemainierDirectorDetail
        <SemainierCatalogueContent
          academicYearId={academicYearId}
          onView={(cfg) => handleView(cfg)}
        />
      ) : (
        // ⭐ 3 sous-onglets statut : hiérarchie par trimestre (chevrons collapsibles)
        <div className="space-y-3">
          {Object.keys(hierarchy).sort((a, b) => {
            const ord = (x: string) => x === 'Trimestre 1' ? 1 : x === 'Trimestre 2' ? 2 : 3;
            return ord(a) - ord(b);
          }).map(tr => {
            const trimesterItems = hierarchy[tr] || [];
            const isCollapsed = collapsedTrimesters.has(tr);
            return (
              <div key={tr} className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCollapse(tr)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed
                      ? <ChevronRight className="h-4 w-4 text-slate-500" />
                      : <ChevronDown className="h-4 w-4 text-slate-500" />}
                    <span className="font-bold text-slate-900">{tr}</span>
                    <span className="text-xs text-slate-500">({trimesterItems.length})</span>
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="p-3 space-y-2">
                    {trimesterItems.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-3">
                        Aucun semainier dans ce trimestre pour ce statut.
                      </p>
                    ) : (
                      trimesterItems
                        .sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0))
                        .map((cfg: any) => (
                          <div key={cfg.id} className="border border-slate-200 rounded-lg p-3 hover:shadow-sm transition-all bg-white">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="flex flex-col items-center justify-center w-14 h-14 bg-purple-50 border border-purple-200 rounded-lg shrink-0">
                                  <div className="text-[10px] font-bold uppercase text-purple-600">Sem</div>
                                  <div className="text-lg font-bold text-purple-700">{cfg.weekNumber}</div>
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 text-sm">
                                    {cfg.teacherName || 'Enseignant non assigné'}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {fmtDate(cfg.weekStartDate)} → {fmtDate(cfg.weekEndDate)}
                                  </p>
                                  <p className="text-xs text-slate-600 mt-0.5">
                                    <span className="font-semibold">Classes :</span>{' '}
                                    {cfg.classNames?.join(', ') || cfg.classIds?.join(', ') || '—'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex-1" />
                              <div className="flex items-center gap-2">
                                {getStatusBadge(cfg.status)}
                                <button
                                  onClick={() => handleView(cfg)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                                  title="Voir le détail (rapports journaliers + hebdo)"
                                >
                                  <Eye className="h-3.5 w-3.5" /> Voir
                                </button>
                                <button
                                  onClick={() => window.open(`/api/pedagogy-space/seminar-config/${cfg.id}/export?format=pdf`, '_blank')}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100"
                                  title="Exporter en PDF"
                                >
                                  <Download className="h-3.5 w-3.5" /> PDF
                                </button>
                                {statusTab === 'SUBMITTED' && (
                                  <button
                                    onClick={() => handleView(cfg)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border-2 border-emerald-300 rounded-lg hover:bg-emerald-100"
                                    title="Ouvrir la vue détaillée pour signer ou rejeter ce semainier"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Signer / Rejeter
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ⭐ Pas de modal ici — la signature/rejet se fait dans la vue détaillée
          (SemainierDirectorDetail) qui a son propre SignModal + RejectModal
          avec SignatureCanvas pour la signature manuscrite du directeur */}
    </div>
  );
}

// ============================================================================
// ⭐ SEMAINIER DIRECTOR DETAIL — Vue détaillée in-page d'un semainier
// ============================================================================
//    Affiche :
//      - En-tête (semaine, trimestre, dates, enseignant, classes, statut)
//      - Boutons Valider / Rejeter (si statut SUBMITTED)
//      - Liste des 5 rapports journaliers (Lun-Ven) avec contenu détaillé
//      - Rapport hebdomadaire (page 8)
//      - Signatures (enseignant + directeur)
// ============================================================================
function SemainierDirectorDetail({ config, userId, onBack, onValidated }: {
  config: any;
  userId: string;
  onBack: () => void;
  onValidated: () => void;
}) {
  // ⭐ Hook React Query — fetch les rapports journaliers + hebdo
  const { data: reportsData, isLoading: loadingReports } = useSemainierReports(config.id);
  // ⭐ 2 modals séparés : un pour SIGNER (valider avec signature), un pour REJETER
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  // ⭐ État pour stocker la signature en cours de dessin (avant confirmation)
  //    Pattern identique à CahierSemaineTab : SignatureCanvas appelle
  //    onSignatureChange à chaque trait, on stocke dans un état, et on ne
  //    soumet QUE quand l'utilisateur clique "Confirmer la signature".
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  // ⭐ État pour le motif de rejet
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);

  const dailyReports = reportsData?.dailyReports || [];
  const weeklyReport = reportsData?.weeklyReport;

  // ⭐ Helper format date court + long
  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('fr-FR') : '—';

  // ⭐ Handler SIGNATURE du directeur :
  //    - Ouvre le modal de signature
  //    - Le directeur dessine sa signature via SignatureCanvas
  //    - Sur "Confirmer la signature" : appelle validateSemainier avec action='VALIDATED'
  //      + directorSignature=<base64 de la signature>
  //    - Le backend enregistre la signature + change le statut à VALIDATED
  //    - La signature est propagée automatiquement à TOUTES les zones de
  //      signature du directeur (DailyReportCard + WeeklyReportCard) car
  //      ces composants lisent `config.directorSignature` et l'affichent
  //      quand `status === 'VALIDATED'`.
  const handleConfirmSignature = async () => {
    if (!pendingSignature) {
      toast.error('Veuillez dessiner votre signature avant de confirmer');
      return;
    }
    setSaving(true);
    try {
      await pedagogySpaceService.validateSemainier(config.id, {
        action: 'VALIDATED',
        directorSignature: pendingSignature,  // ⭐ base64 de la signature dessinée
        validatedBy: userId,
      });
      toast.success('✅ Cahier du Semainier signé et validé', {
        description: 'Votre signature a été propagée à toutes les zones de signature du document.',
      });
      setSignModalOpen(false);
      setPendingSignature(null);
      onValidated();
    } catch (e: any) {
      toast.error('Erreur lors de la signature', { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ⭐ Handler REJET du directeur :
  //    - Ouvre le modal de rejet
  //    - Le directeur saisit un motif de rejet
  //    - Sur "Confirmer le rejet" : appelle validateSemainier avec action='REJECTED'
  //      + rejectionReason=<motif>
  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Veuillez saisir un motif de rejet');
      return;
    }
    setSaving(true);
    try {
      await pedagogySpaceService.validateSemainier(config.id, {
        action: 'REJECTED',
        directorSignature: '',
        validatedBy: userId,
        rejectionReason,
      });
      toast.success('Cahier du Semainier rejeté');
      setRejectModalOpen(false);
      setRejectionReason('');
      onValidated();
    } catch (e: any) {
      toast.error('Erreur lors du rejet', { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ⭐ Récupérer les stats agrégées depuis le rapport hebdo (auto-calculées par le backend)
  const parseJson = (v: any) => {
    if (!v) return null;
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return null; }
    }
    return v;
  };
  const staffStats = parseJson(weeklyReport?.staffAttendanceStats);
  const studentStats = parseJson(weeklyReport?.studentAttendanceStats);

  const isAlreadyValidated = (config.status || '').toUpperCase() === 'VALIDATED';
  const isAlreadyRejected = (config.status || '').toUpperCase() === 'REJECTED';
  const isSubmitted = (config.status || '').toUpperCase() === 'SUBMITTED';

  return (
    <div className="space-y-4">
      {/* ⭐ Bandeau retour */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
          ← Retour à la liste
        </button>
        <div className="flex-1" />
        {/* ⭐ Statut + boutons d'action */}
        <div className="flex items-center gap-2">
          <span className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-bold',
            isAlreadyValidated ? 'bg-emerald-100 text-emerald-700'
              : isAlreadyRejected ? 'bg-rose-100 text-rose-700'
                : isSubmitted ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-700'
          )}>
            {isAlreadyValidated ? '✓ Validé' : isAlreadyRejected ? '✗ Rejeté' : isSubmitted ? '⏳ En attente' : 'Non soumis'}
          </span>
          {isSubmitted && (
            <>
              {/* ⭐ Bouton "Signer" (valider avec signature) — vert, ouvre le modal SignatureCanvas */}
              <button
                onClick={() => setSignModalOpen(true)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                title="Signer et valider ce cahier de semaine — votre signature sera propagée à toutes les zones de signature du document"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Signer
              </button>
              {/* ⭐ Bouton "Rejeter" — rouge, ouvre le modal de motif de rejet */}
              <button
                onClick={() => setRejectModalOpen(true)}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                title="Rejeter ce cahier de semaine — l'enseignant devra le modifier et le resoumettre"
              >
                <XCircle className="h-4 w-4" />
                Rejeter
              </button>
            </>
          )}
          <button
            onClick={() => window.open(`/api/pedagogy-space/seminar-config/${config.id}/export?format=pdf`, '_blank')}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold"
            title="Exporter le rapport complet en PDF"
          >
            <Download className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>

      {/* ⭐ En-tête du semainier */}
      <div className="bg-white rounded-2xl border-2 border-purple-200 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex flex-col items-center justify-center w-20 h-20 bg-purple-50 border-2 border-purple-300 rounded-xl shrink-0">
            <div className="text-[10px] font-bold uppercase text-purple-600">Semaine</div>
            <div className="text-2xl font-bold text-purple-700">S{config.weekNumber}</div>
            <div className="text-[10px] font-bold uppercase text-purple-600">T{config.trimester}</div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900">Cahier du Semainier</h2>
            <p className="text-sm text-slate-600 mt-1">
              <strong>Période :</strong> {fmtDate(config.weekStartDate)} → {fmtDate(config.weekEndDate)}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              <strong>Semainier :</strong> {config.teacherName || '—'}
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              <strong>Classes :</strong>{' '}
              {config.classNames?.join(', ') || config.classIds?.join(', ') || '—'}
            </p>
          </div>
        </div>

        {/* ⭐ Stats agrégées (depuis le rapport hebdo si présent) */}
        {staffStats && studentStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-[10px] font-semibold uppercase opacity-70 text-blue-700">Présence enseignants</p>
              <p className="text-2xl font-bold mt-1 text-blue-700">
                {staffStats.averagePresenceRate != null ? `${staffStats.averagePresenceRate}%` : '—'}
              </p>
              <p className="text-[10px] opacity-60 mt-0.5">{staffStats.totalPresent || 0}/{staffStats.totalRecords || 0} présences</p>
            </div>
            <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-center">
              <p className="text-[10px] font-semibold uppercase opacity-70 text-emerald-700">Présence élèves</p>
              <p className="text-2xl font-bold mt-1 text-emerald-700">
                {studentStats.averageAttendanceRate != null ? `${studentStats.averageAttendanceRate}%` : '—'}
              </p>
              <p className="text-[10px] opacity-60 mt-0.5">{studentStats.totalAbsent || 0} absences cumulées</p>
            </div>
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-[10px] font-semibold uppercase opacity-70 text-amber-700">Jours couverts</p>
              <p className="text-2xl font-bold mt-1 text-amber-700">{staffStats.daysCovered || 0}/5</p>
              <p className="text-[10px] opacity-60 mt-0.5">rapports journaliers</p>
            </div>
            <div className="border border-rose-200 bg-rose-50 rounded-lg p-3 text-center">
              <p className="text-[10px] font-semibold uppercase opacity-70 text-rose-700">Classes à risque</p>
              <p className="text-2xl font-bold mt-1 text-rose-700">
                {studentStats.highAbsenceClasses?.length || 0}
              </p>
              <p className="text-[10px] opacity-60 mt-0.5">&gt; 30% d'absents</p>
            </div>
          </div>
        )}
      </div>

      {/* ⭐ Liste des 5 rapports journaliers */}
      {loadingReports ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : dailyReports.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900 text-center">
          <CalendarDays className="h-10 w-10 mx-auto text-amber-400 mb-2" />
          <p className="font-medium">Aucun rapport journalier pour ce semainier</p>
          <p className="text-xs text-amber-700 mt-1">
            Le semainier n'a pas encore saisi les rapports journaliers pour cette semaine.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-700 uppercase">Rapports journaliers ({dailyReports.length}/5)</h3>
          {/* ⭐ FIX : utiliser le VRAI DailyReportCard (comme l'espace enseignant)
              au lieu du DailyReportSummaryCard (résumé compact). L'utilisateur
              a demandé que le catalogue reflète EXACTEMENT ce qui est dans le
              Cahier du Semainier de l'espace pédagogique — pas un résumé.
              Le composant DailyReportCard gère déjà le mode read-only via
              `disabled={config?.status === 'SUBMITTED' || 'VALIDATED'}`. */}
          {dailyReports
            .sort((a, b) => (a.dayOfWeek || 0) - (b.dayOfWeek || 0))
            .map((dr: any) => (
              <DailyReportCard
                key={dr.id}
                config={config}
                selectedDay={dr.dayOfWeek}
                dailyReport={dr}
                setDailyReport={() => {/* no-op : read-only en catalogue */}}
              />
            ))
          }
        </div>
      )}

      {/* ⭐ Rapport hebdo (page 8) si présent — utilise le VRAI WeeklyReportCard
          (pas un résumé) pour que le catalogue soit identique à l'espace enseignant */}
      {weeklyReport && (
        <WeeklyReportCard
          config={config}
          weeklyReport={weeklyReport}
          setWeeklyReport={() => {/* no-op : read-only en catalogue */}}
        />
      )}

      {/* ⭐ Signatures bas de page */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="grid grid-cols-2 gap-6">
          <div className="text-center">
            <p className="text-xs font-bold text-slate-700 uppercase">Signature du Semainier</p>
            <p className="text-sm mt-1">{config.teacherName || '—'}</p>
            <div className="mt-3 h-[80px] border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center">
              {config.teacherSignature ? (
                <img src={config.teacherSignature} alt="Signature semainier" className="max-h-20 mx-auto" />
              ) : (
                <span className="text-xs text-slate-400 italic">Non signé</span>
              )}
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-slate-700 uppercase">Visa de la Direction</p>
            <p className="text-sm mt-1">
              {isAlreadyValidated ? 'Validé' : isAlreadyRejected ? 'Rejeté' : 'En attente'}
            </p>
            <div className="mt-3 h-[80px] border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center">
              {config.directorSignature && isAlreadyValidated ? (
                <img src={config.directorSignature} alt="Signature directeur" className="max-h-20 mx-auto" />
              ) : (
                <span className="text-xs text-slate-400 italic">
                  {isSubmitted ? 'En attente de validation' : '—'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ⭐ MODAL DE SIGNATURE (validation avec signature manuscrite)
          Pattern identique au modal de signature enseignant dans CahierSemaineTab :
          - SignatureCanvas stocke la signature dans pendingSignature à chaque trait
          - L'utilisateur clique "Confirmer la signature" pour soumettre
          - La signature (base64) est envoyée au backend via validateSemainier
          - Le backend enregistre directorSignature + change status → VALIDATED
          - La signature est propagée automatiquement à toutes les zones de signature
            (DailyReportCard + WeeklyReportCard) car ces composants lisent
            config.directorSignature et l'affichent quand status === 'VALIDATED' */}
      {signModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* En-tête coloré emerald */}
            <div className="px-6 py-4 border-b bg-emerald-50 border-emerald-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Signature du Directeur</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Semaine S{config.weekNumber} · {config.teacherName || '—'}
                  </p>
                </div>
              </div>
            </div>
            {/* Body */}
            <div className="p-6 space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>ℹ️ Propagation automatique :</strong> Votre signature sera appliquée à
                toutes les zones de signature du directeur dans le document
                (5 rapports journaliers + 1 rapport hebdomadaire).
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Votre signature
                </label>
                <SignatureCanvas
                  width={360}
                  height={140}
                  placeholder="Signez ici..."
                  onSignatureChange={(data: string | null) => setPendingSignature(data)}
                />
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={() => { setSignModalOpen(false); setPendingSignature(null); }}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmSignature}
                disabled={saving || !pendingSignature}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmer la signature
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ MODAL DE REJET (avec motif obligatoire) */}
      {rejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* En-tête coloré rose */}
            <div className="px-6 py-4 border-b bg-rose-50 border-rose-200">
              <div className="flex items-center gap-3">
                <XCircle className="h-10 w-10 text-rose-600" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Rejet du Cahier du Semainier</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Semaine S{config.weekNumber} · {config.teacherName || '—'}
                  </p>
                </div>
              </div>
            </div>
            {/* Body */}
            <div className="p-6 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                <strong>⚠ Conséquences :</strong> Après rejet, l'enseignant devra modifier les
                rapports et les resoumettre. Le motif de rejet sera visible par l'enseignant.
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Motif du rejet <span className="text-rose-600">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  placeholder="Expliquez la raison du rejet (ex: rapports incomplets, informations manquantes...)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400"
                  autoFocus
                />
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={() => { setRejectModalOpen(false); setRejectionReason(''); }}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={saving || !rejectionReason.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ⭐ CARTE RÉSUMÉ D'UN RAPPORT JOURNALIER — vue compacte pour le directeur
// ============================================================================
function DailyReportSummaryCard({ report, weekStartDate }: { report: any; weekStartDate: string }) {
  const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
  const dayName = DAY_NAMES[(report.dayOfWeek || 1) - 1];

  // ⭐ Calculer la date précise du jour (lundi + (day-1))
  const dayDate = (() => {
    const base = new Date(weekStartDate);
    base.setDate(base.getDate() + ((report.dayOfWeek || 1) - 1));
    return base.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  })();

  // ⭐ Parse JSON fields
  const parseJson = (v: any) => {
    if (!v) return null;
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return null; }
    }
    return v;
  };
  const teacherAttendance = parseJson(report.teacherAttendance);
  const studentPresence = parseJson(report.studentPresence);
  const pedagogy = parseJson(report.pedagogy);
  const discipline = parseJson(report.discipline);
  const hygiene = parseJson(report.hygiene);

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center justify-center w-10 h-10 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-[9px] font-bold uppercase text-blue-600">{dayName.substring(0, 3)}</div>
            <div className="text-sm font-bold text-blue-700">{dayDate.split('/')[0]}</div>
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">{dayName} {dayDate}</p>
            <p className="text-xs text-slate-500">
              {teacherAttendance?.staff?.length || teacherAttendance?.length || 0} enseignants •{' '}
              {studentPresence?.summary?.totalRecords || 0} élèves pointés
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {studentPresence?.attendanceRate != null && (
            <span className={cn(
              'px-2 py-0.5 rounded text-xs font-bold',
              Number(studentPresence.attendanceRate) >= 90 ? 'bg-emerald-100 text-emerald-700'
                : Number(studentPresence.attendanceRate) >= 70 ? 'bg-amber-100 text-amber-700'
                  : 'bg-rose-100 text-rose-700'
            )}>
              {Number(studentPresence.attendanceRate).toFixed(1)}% présence
            </span>
          )}
        </div>
      </div>
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Section 1 : Présence enseignants */}
        <div className="border-l-2 border-blue-300 pl-2">
          <p className="font-bold text-slate-700 uppercase text-[10px]">1. Présence enseignants</p>
          {teacherAttendance ? (
            <div className="mt-1">
              {teacherAttendance.summary ? (
                <div className="flex gap-3 text-[11px]">
                  <span className="text-emerald-700">✓ {teacherAttendance.summary.present || 0} présents</span>
                  <span className="text-rose-700">✗ {teacherAttendance.summary.absent || 0} absents</span>
                  <span className="text-amber-700">⏰ {teacherAttendance.summary.late || 0} retards</span>
                </div>
              ) : (
                <p className="text-slate-500 italic">{(teacherAttendance.staff || teacherAttendance).length || 0} enseignants pointés</p>
              )}
            </div>
          ) : <p className="text-slate-400 italic">—</p>}
        </div>

        {/* Section 2 : Présence élèves */}
        <div className="border-l-2 border-emerald-300 pl-2">
          <p className="font-bold text-slate-700 uppercase text-[10px]">2. Présence élèves</p>
          {studentPresence ? (
            <div className="mt-1 text-[11px]">
              <p className="text-emerald-700 font-semibold">
                Taux : {Number(studentPresence.attendanceRate || studentPresence.globalRate || 0).toFixed(1)}%
              </p>
              {studentPresence.highAbsenceClasses?.length > 0 && (
                <p className="text-rose-700 mt-0.5">
                  ⚠ Classes à risque : {studentPresence.highAbsenceClasses.join(', ')}
                </p>
              )}
            </div>
          ) : <p className="text-slate-400 italic">—</p>}
        </div>

        {/* Section 3 : Pédagogie */}
        <div className="border-l-2 border-purple-300 pl-2">
          <p className="font-bold text-slate-700 uppercase text-[10px]">3. Pédagogie</p>
          {pedagogy ? (
            <div className="mt-1 text-[11px] text-slate-700">
              {pedagogy.scheduleRespected !== undefined && (
                <p>EDT respecté : {pedagogy.scheduleRespected ? '✓' : '✗'}</p>
              )}
              {pedagogy.missingCourses?.length > 0 && (
                <p className="text-rose-600">{pedagogy.missingCourses.length} cours manquants</p>
              )}
              {pedagogy.modifiedCourses?.length > 0 && (
                <p className="text-amber-600">{pedagogy.modifiedCourses.length} cours modifiés</p>
              )}
            </div>
          ) : <p className="text-slate-400 italic">—</p>}
        </div>

        {/* Section 4 : Discipline */}
        <div className="border-l-2 border-amber-300 pl-2">
          <p className="font-bold text-slate-700 uppercase text-[10px]">4. Discipline</p>
          {discipline ? (
            <div className="mt-1 text-[11px] text-slate-700">
              {discipline.positiveBehaviors ? <p>✓ Positif signalé</p> : null}
              {discipline.problemBehaviors ? <p className="text-rose-600">⚠ Problèmes signalés</p> : null}
            </div>
          ) : <p className="text-slate-400 italic">—</p>}
        </div>

        {/* Section 5 : Hygiène */}
        <div className="border-l-2 border-cyan-300 pl-2">
          <p className="font-bold text-slate-700 uppercase text-[10px]">5. Hygiène & logistique</p>
          {hygiene ? (
            <div className="mt-1 text-[11px] text-slate-700">
              {hygiene.roomCleanliness && <p>Salles : {hygiene.roomCleanliness}</p>}
              {hygiene.toilets && <p>Toilettes : {hygiene.toilets}</p>}
            </div>
          ) : <p className="text-slate-400 italic">—</p>}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ⭐ PHASE 4 (refactor) — CATALOGUE SEMAINIERS : dossiers imbriqués
// ============================================================================
//  Architecture en dossiers (pattern identique à CatalogueTab pour cahier journal):
//    📁 Année scolaire 2024-2025  (folder)
//      └─ 📁 Trimestre 1  (folder)
//          ├─ 📄 Semaine S1  (item: clic → vue détaillée + PDF)
//          ├─ 📄 Semaine S2
//          └─ 📄 Semaine S3 ...
//      └─ 📁 Trimestre 2
//      └─ 📁 Trimestre 3
//    📁 Année scolaire 2025-2026
//      └─ ...
//
//  Chaque "semaine" (S1, S2...) contient 5 rapports journaliers (Lun-Ven)
//  + 1 rapport hebdomadaire global, téléchargeables en PDF individuel ou
//  groupé (via le bouton PDF de la vue détaillée).
// ============================================================================

function SemainierCatalogueContent({ academicYearId, onView }: {
  academicYearId: string;
  onView: (cfg: any) => void;
}) {
  // ⭐ Navigation path (breadcrumbs) : [{ type: 'year', id, label }, ...]
  const [path, setPath] = useState<{ type: 'year' | 'trimester'; id: string; label: string; academicYearId?: string }[]>([]);
  // ⭐ Liste des années scolaires (chargées au démarrage)
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  // ⭐ Semainiers de l'année sélectionnée (tous statuts)
  const [semainiers, setSemainiers] = useState<any[]>([]);
  const [loadingYears, setLoadingYears] = useState(true);
  const [loadingSemainiers, setLoadingSemainiers] = useState(false);

  // === Chargement initial : liste des années scolaires ===
  useEffect(() => {
    (async () => {
      setLoadingYears(true);
      try {
        const res = await fetch('/api/academic-years', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const years = Array.isArray(data) ? data : (data?.data ?? []);
          // Trier par startDate desc (année la plus récente en premier)
          years.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
          setAcademicYears(years);
        } else {
          setAcademicYears([]);
        }
      } catch (e) {
        setAcademicYears([]);
      } finally {
        setLoadingYears(false);
      }
    })();
  }, []);

  // === Chargement des semainiers quand une année est sélectionnée ===
  //    On utilise l'hook useSemainierCatalogue mais en mode manuel pour
  //    éviter le re-fetch quand l'année racine du composant change.
  const loadSemainiersForYear = useCallback(async (yearId: string) => {
    setLoadingSemainiers(true);
    try {
      const res = await fetch(`/api/pedagogy-space/seminar-config?academicYearId=${yearId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const allSemainiers = Array.isArray(data) ? data : (data?.data ?? []);
        // ⭐ FIX : le catalogue ne contient QUE les semainiers VALIDATED
        //    (cahiers de semaine officiellement validés par le directeur)
        const validatedOnly = allSemainiers.filter((c: any) =>
          (c.status || '').toUpperCase() === 'VALIDATED'
        );
        setSemainiers(validatedOnly);
      } else {
        setSemainiers([]);
      }
    } catch (e) {
      setSemainiers([]);
      toast.error("Erreur chargement semainiers");
    } finally {
      setLoadingSemainiers(false);
    }
  }, []);

  // === Navigation ===
  const navigateIntoYear = (year: any) => {
    setPath([{ type: 'year', id: year.id, label: year.label || `${year.startDate?.substring(0, 4)}-${year.endDate?.substring(0, 4)}` }]);
    loadSemainiersForYear(year.id);
  };

  const navigateIntoTrimester = (trimesterNum: number) => {
    if (path.length === 0 || path[0].type !== 'year') return;
    setPath([
      path[0],
      { type: 'trimester', id: `T${trimesterNum}`, label: `Trimestre ${trimesterNum}` },
    ]);
  };

  const navigateUp = (level: 'root' | 'year') => {
    if (level === 'root') {
      setPath([]);
      setSemainiers([]);
    } else if (level === 'year') {
      // Revenir à la liste des trimestres (enlever le dernier folder "trimester")
      setPath(path.filter(p => p.type === 'year'));
    }
  };

  // === Regroupement par trimestre ===
  const trimesterGroups: Record<number, any[]> = { 1: [], 2: [], 3: [] };
  for (const cfg of semainiers) {
    const tr = cfg.trimester || 1;
    if (!trimesterGroups[tr]) trimesterGroups[tr] = [];
    trimesterGroups[tr].push(cfg);
  }

  // === Trimestres visibles (avec semainiers) ===
  const visibleTrimesters = [1, 2, 3].filter(tr => trimesterGroups[tr].length > 0);
  // Si tous vides, on affiche quand même T1 T2 T3 comme dossiers vides
  const trimestersToShow = visibleTrimesters.length > 0 ? [1, 2, 3] : [1, 2, 3];

  // === Helper format date ===
  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('fr-FR') : '—';

  // === Helper statut badge ===
  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    const styles: Record<string, string> = {
      PENDING: 'bg-slate-100 text-slate-700',
      SIGNED: 'bg-blue-100 text-blue-700',
      SUBMITTED: 'bg-amber-100 text-amber-700',
      VALIDATED: 'bg-emerald-100 text-emerald-700',
      REJECTED: 'bg-rose-100 text-rose-700',
    };
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      SIGNED: 'Signé',
      SUBMITTED: 'Soumis',
      VALIDATED: 'Validé',
      REJECTED: 'Rejeté',
    };
    return (
      <span className={cn('px-2 py-0.5 rounded text-xs font-bold', styles[s] || styles.PENDING)}>
        {labels[s] || s}
      </span>
    );
  };

  // === Rendu : breadcrumbs ===
  const breadcrumbs = (
    <div className="flex items-center gap-1.5 text-sm bg-white border border-slate-200 rounded-lg p-2 mb-3 flex-wrap">
      <button
        onClick={() => navigateUp('root')}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold",
          path.length === 0 ? "bg-purple-100 text-purple-700" : "text-slate-600 hover:bg-slate-100"
        )}
      >
        <Folder className="h-3.5 w-3.5" /> Catalogue
      </button>
      {path.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <button
            onClick={() => {
              if (p.type === 'year') navigateUp('root');
              else if (p.type === 'trimester') navigateUp('year');
            }}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold",
              i === path.length - 1 ? "bg-purple-100 text-purple-700" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {p.type === 'year' ? <Folder className="h-3.5 w-3.5" /> : <FolderOpen className="h-3.5 w-3.5" />}
            {p.label}
          </button>
        </div>
      ))}
    </div>
  );

  // === Rendu : niveau racine (liste des années scolaires) ===
  if (path.length === 0) {
    return (
      <div className="space-y-3">
        {breadcrumbs}
        {loadingYears ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
        ) : academicYears.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center text-amber-900">
            <CalendarDays className="h-12 w-12 mx-auto text-amber-400 mb-2" />
            <p className="font-bold">Aucune année scolaire configurée</p>
            <p className="text-xs text-amber-700 mt-1">
              Créez une année scolaire dans Paramètres → Années scolaires pour générer des semainiers.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {academicYears.map(year => {
              // ⭐ Déterminer si l'année est active
              const isActive = year.isActive || year.status === 'ACTIVE';
              return (
                <button
                  key={year.id}
                  onClick={() => navigateIntoYear(year)}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md",
                    isActive
                      ? "bg-emerald-50 border-emerald-300 hover:bg-emerald-100"
                      : "bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50"
                  )}
                >
                  <div className="flex-shrink-0">
                    <Folder className={cn("h-10 w-10", isActive ? "text-emerald-600" : "text-purple-500")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm">
                      {year.label || `${year.startDate?.substring(0, 4)}-${year.endDate?.substring(0, 4)}`}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {fmtDate(year.startDate)} → {fmtDate(year.endDate)}
                    </p>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                        ● Active
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // === Rendu : niveau année → liste des trimestres ===
  if (path.length === 1 && path[0].type === 'year') {
    return (
      <div className="space-y-3">
        {breadcrumbs}
        {loadingSemainiers ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
        ) : (
          <>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-900">
              <strong>{semainiers.length} cahier(s) de semaine validé(s)</strong> pour {path[0].label}
              {semainiers.length === 0 && (
                <span className="ml-2 opacity-70 italic">
                  — Aucun cahier validé pour cette année. Le catalogue ne contient que les cahiers OFFICIELLEMENT VALIDÉS par le directeur.
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {trimestersToShow.map(tr => {
                const items = trimesterGroups[tr] || [];
                const validatedCount = items.filter(s => s.status === 'VALIDATED').length;
                return (
                  <button
                    key={tr}
                    onClick={() => navigateIntoTrimester(tr)}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all hover:shadow-md",
                      items.length > 0
                        ? "bg-white border-purple-200 hover:border-purple-400 hover:bg-purple-50"
                        : "bg-slate-50 border-slate-200 opacity-70"
                    )}
                  >
                    <Folder className={cn("h-10 w-10", items.length > 0 ? "text-purple-500" : "text-slate-400")} />
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 text-sm">Trimestre {tr}</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {items.length} semaine(s) • {validatedCount} validée(s)
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // === Rendu : niveau trimestre → liste des semaines ===
  if (path.length === 2 && path[1].type === 'trimester') {
    const trimesterNum = parseInt(path[1].id.replace('T', ''));
    const items = (trimesterGroups[trimesterNum] || []).sort((a, b) => (a.weekNumber || 0) - (b.weekNumber || 0));
    return (
      <div className="space-y-3">
        {breadcrumbs}
        {items.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center text-amber-900">
            <CalendarDays className="h-10 w-10 mx-auto text-amber-400 mb-2" />
            <p className="font-bold">Aucun semainier dans le Trimestre {trimesterNum}</p>
            <p className="text-xs text-amber-700 mt-1">
              Générez des semainiers via "Paramétrage" dans l'espace pédagogique enseignant.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((cfg: any) => (
              <div key={cfg.id} className="border-2 border-slate-200 rounded-lg p-3 hover:border-purple-300 hover:shadow-sm transition-all bg-white">
                <div className="flex flex-wrap items-center gap-3">
                  {/* ⭐ Badge Semaine */}
                  <div className="flex flex-col items-center justify-center w-16 h-16 bg-purple-50 border-2 border-purple-200 rounded-xl shrink-0">
                    <div className="text-[10px] font-bold uppercase text-purple-600">Sem</div>
                    <div className="text-xl font-bold text-purple-700">S{cfg.weekNumber}</div>
                  </div>
                  {/* ⭐ Infos */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm">
                      {cfg.teacherName || 'Enseignant non assigné'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {fmtDate(cfg.weekStartDate)} → {fmtDate(cfg.weekEndDate)}
                    </p>
                    {cfg.classNames && cfg.classNames.length > 0 && (
                      <p className="text-xs text-slate-600 mt-0.5">
                        <span className="font-semibold">Classes :</span> {cfg.classNames.join(', ')}
                      </p>
                    )}
                    {/* ⭐ Indicateur rapports disponibles */}
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
                      <span className="flex items-center gap-0.5">
                        <FileText className="h-3 w-3" /> 5 rapports journaliers
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-0.5">
                        <CalendarRange className="h-3 w-3" /> 1 rapport hebdo
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(cfg.status)}
                    <button
                      onClick={() => onView(cfg)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                      title="Voir les 6 rapports (5 journaliers + 1 hebdo)"
                    >
                      <Eye className="h-3.5 w-3.5" /> Voir
                    </button>
                    <button
                      onClick={() => window.open(`/api/pedagogy-space/seminar-config/${cfg.id}/export?format=pdf`, '_blank')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100"
                      title="Télécharger le PDF complet de la semaine"
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback (ne devrait jamais arriver)
  return <div className="text-center text-slate-500 text-sm py-6">{breadcrumbs}<p>Navigation invalide</p></div>;
}

// ============================================================================
// ⭐ Onglet "Planifications Mensuelles" — Planifs mensuelles soumises par les enseignants
//    Le directeur peut valider (avec signature) ou rejeter (avec observation).
//    Chaque planif soumise contient: classLevel + month + teacher + cells + signature titulaire
// ============================================================================

function PendingMonthlyPlansTab({
  tenantId, academicYearId, userId, refreshKey, onRefresh,
}: {
  tenantId: string;
  academicYearId: string;
  userId: string;
  refreshKey: number;
  onRefresh: () => void;
}) {
  // ⭐ Étapes A-D : Refonte conforme au pattern Cahier Journal
  // A) Status sub-tabs (SUBMITTED / VALIDATED / REJECTED)
  // B) Hiérarchie collapsible : schoolLevel → month → classLevel → items
  // C) Dashboard card (inline — pas de card séparée)
  // D) Vue détail in-page (remplace le modal)

  const [statusTab, setStatusTab] = useState<'SUBMITTED' | 'VALIDATED' | 'REJECTED'>('SUBMITTED');
  const [pendingPlans, setPendingPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [directorSignature, setDirectorSignature] = useState<string | null>(null);
  const [rejectObservation, setRejectObservation] = useState("");
  const [validating, setValidating] = useState(false);
  const [modalPlan, setModalPlan] = useState<any | null>(null);

  // Collapse states for hierarchy
  const [collapsedSchoolLevels, setCollapsedSchoolLevels] = useState<Set<string>>(new Set());
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set());

  // Load pending monthly plans with status filter
  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pedagogy/monthly-plans/pending?academicYearId=${encodeURIComponent(academicYearId)}&status=${statusTab}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch pending monthly plans");
      const data = await res.json();
      setPendingPlans(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error("Failed to load pending monthly plans:", e);
      setPendingPlans([]);
    } finally {
      setLoading(false);
    }
  }, [academicYearId, statusTab]);

  useEffect(() => { loadPending(); }, [loadPending, refreshKey]);

  // Reset selection on tab change
  useEffect(() => {
    setSelectedPlan(null);
    setModalPlan(null);
  }, [statusTab]);

  // Load director signature
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/school-directors?userId=${encodeURIComponent(userId)}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const sig = data?.signatureDataUrl || data?.signatureUploadedUrl || null;
        setDirectorSignature(sig);
      } catch (e) { /* silent */ }
    })();
  }, [userId]);

  const handleValidate = async (plan: any) => {
    if (!directorSignature) {
      toast.error("Signature du directeur requise. Configurez votre signature dans votre profil.");
      return;
    }
    setValidating(true);
    try {
      const params = new URLSearchParams({
        academicYearId,
        classLevel: plan.classLevel,
        month: plan.month,
        teacherId: plan.teacherId || '',
      });
      const res = await fetch(
        `/api/pedagogy/monthly-plans/validate?${params.toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "VALIDATE", directorSignature }),
          credentials: "include",
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.backendError?.message || (err as any)?.error || `Échec (${res.status})`);
      }
      toast.success(`Planification ${plan.classLevel} — ${plan.month} validée`);
      setModalPlan(null);
      onRefresh();
      loadPending();
    } catch (e: any) {
      toast.error("Échec validation: " + e.message);
    } finally {
      setValidating(false);
    }
  };

  const handleReject = async (plan: any) => {
    if (!rejectObservation.trim()) {
      toast.error("Veuillez indiquer une observation pour le rejet.");
      return;
    }
    setValidating(true);
    try {
      const params = new URLSearchParams({
        academicYearId,
        classLevel: plan.classLevel,
        month: plan.month,
        teacherId: plan.teacherId || '',
      });
      const res = await fetch(
        `/api/pedagogy/monthly-plans/validate?${params.toString()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "REJECT", directorObservation: rejectObservation.trim() }),
          credentials: "include",
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any)?.backendError?.message || (err as any)?.error || `Échec (${res.status})`);
      }
      toast.success(`Planification ${plan.classLevel} — ${plan.month} rejetée`);
      setRejectObservation("");
      setModalPlan(null);
      onRefresh();
      loadPending();
    } catch (e: any) {
      toast.error("Échec rejet: " + e.message);
    } finally {
      setValidating(false);
    }
  };

  // ⭐ V3-12: Load the full planning cells when "Voir" is clicked, so the
  //    director sees the actual table with all domains, weeks, and content —
  //    not just basic metadata. Same pattern as CahierJournal director view.
  const [planDetailCells, setPlanDetailCells] = useState<any[]>([]);
  const [planDetailLoading, setPlanDetailLoading] = useState(false);

  useEffect(() => {
    if (!selectedPlan) { setPlanDetailCells([]); return; }
    setPlanDetailLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/pedagogy/monthly-plans?academicYearId=${encodeURIComponent(academicYearId)}&classLevel=${encodeURIComponent(selectedPlan.classLevel)}&month=${encodeURIComponent(selectedPlan.month)}&teacherId=${encodeURIComponent(selectedPlan.teacherId || '')}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("Failed to load plan detail");
        const data = await res.json();
        setPlanDetailCells(data.cells || []);
      } catch (e) {
        console.error("Failed to load plan detail:", e);
        setPlanDetailCells([]);
      } finally {
        setPlanDetailLoading(false);
      }
    })();
  }, [selectedPlan, academicYearId]);

  // ⭐ V3-12: Determine the fiche structure for the selected plan's class level
  const planDetailIsMaternelle = selectedPlan?.classLevel === "MATERNELLE_GRANDS";
  const planDetailFiche = planDetailIsMaternelle
    ? [
        { code: "I", label: "D1 : Santé et environnement", color: "bg-emerald-600", subRows: ["Education pour la santé", "Passage aux toilettes", "Lavage des mains", "Goûter"] },
        { code: "II", label: "D2 : Expression corporelle", color: "bg-rose-600", subRows: ["Expression corporelle"] },
        { code: "III", label: "D3 : Pré-apprentissages", color: "bg-blue-600", subRows: ["Pré-lecture", "Pré-écriture", "Pré-mathématique", "Observation", "Education sensorielle", "Travaux manuels", "Expression plastique"] },
        { code: "IV", label: "D4 : Santé Emotionnelle", color: "bg-purple-600", subRows: ["Expression émotionnelle"] },
        { code: "V", label: "D5 : Relations et de l'Interaction Sociale et socio-affective", color: "bg-indigo-600", subRows: ["Poésie", "Chant", "Devinette", "Comptine", "Conte", "Langage"] },
      ]
    : [
        { code: "FRANÇAIS", label: "FRANÇAIS", color: "bg-blue-600", subRows: ["Vocab théma", "Comm Orale", "Lecture", "Expression Écrite", "Dictée", "Vocab", "Grammaire", "Orthographe", "Écriture", "Conjugaison"] },
        { code: "MATH", label: "MATH", color: "bg-emerald-600", subRows: ["Arithmétique", "Mesure", "Géométrie"] },
        { code: "EST", label: "EST", color: "bg-amber-600", subRows: [] },
        { code: "EA", label: "ÉA", color: "bg-purple-600", subRows: ["Chant", "Atelier", "Dessin", "Contes", "Poésie"] },
        { code: "ES", label: "ÉS", color: "bg-indigo-600", subRows: ["Morale", "Civisme", "Compétence 2 (Histoire)", "Compétence 3 (Géographie)"] },
        { code: "EPS", label: "EPS", color: "bg-rose-600", subRows: [] },
        { code: "PETIT_PROJET", label: "Petit Projet", color: "bg-slate-600", subRows: [] },
      ];
  const planDetailWeekLabels = planDetailIsMaternelle
    ? ["1ère semaine", "2ème semaine", "3ème semaine", "4ème semaine"]
    : ["Première Semaine", "Deuxième Semaine", "Troisième Semaine", "Quatrième Semaine", "Cinquième Semaine"];

  // Find a cell by week + domain + subDomain
  const findPlanCell = (week: number, domain: string, subDomain?: string) =>
    planDetailCells.find(c => c.weekNumber === week && c.domain === domain && (c.subDomain || "") === (subDomain || ""));

  // ⭐ In-page detail view (Étape D — replaces modal)
  //    V3-12: Now renders the FULL planning table (like the teacher sees),
  //    not just basic metadata. The director can see all domains × weeks × content.
  if (selectedPlan) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedPlan(null)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
        >
          <ChevronRight className="h-4 w-4 rotate-180" /> Retour à la liste
        </button>

        {/* Header — same style as Cahier Journal director view */}
        <div className="bg-white border-2 border-slate-800 rounded-xl p-4 text-center">
          <h2 className="text-lg font-bold text-slate-900">
            PLANIFICATION MENSUELLE — {selectedPlan.classLevel}
          </h2>
          <div className="text-sm text-slate-600 mt-1">
            Mois de <strong>{selectedPlan.month}</strong>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Enseignant : {selectedPlan.teacherFirstName} {selectedPlan.teacherLastName}
            {" · "}Statut : <strong>{statusTab === 'SUBMITTED' ? 'Soumis' : statusTab === 'VALIDATED' ? 'Validé' : 'Rejeté'}</strong>
            {selectedPlan.submittedAt && ` · Soumis le ${new Date(selectedPlan.submittedAt).toLocaleDateString('fr-FR')}`}
          </div>
        </div>

        {/* Action bar */}
        {statusTab === 'SUBMITTED' && (
          <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-3">
            <div className="text-sm text-slate-600">
              {selectedPlan.cellCount} cellule(s) · {selectedPlan.customCount} personnalisée(s)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setModalPlan(selectedPlan); setRejectObservation(""); }}
                disabled={validating}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" /> Rejeter
              </button>
              <button
                onClick={() => handleValidate(selectedPlan)}
                disabled={validating || !directorSignature}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {directorSignature ? 'Valider' : 'Signature requise'}
              </button>
            </div>
          </div>
        )}

        {/* ⭐ V3-12: Full planning table (read-only) — same structure as the teacher's MonthlyPlanningTab */}
        {planDetailLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-sm text-slate-500">Chargement de la planification…</span>
          </div>
        ) : planDetailCells.length === 0 ? (
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center text-sm text-slate-500">
            Aucune cellule de planification trouvée pour cette planification.
          </div>
        ) : (
          <>
            {/* Desktop table (md+) */}
            <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
              <table className="text-xs border-collapse w-full" style={{ minWidth: planDetailIsMaternelle ? '900px' : '1100px' }}>
                <colgroup>
                  <col style={{ width: "15%" }} />
                  {planDetailWeekLabels.map((_, i) => (
                    <col key={i} style={{ width: planDetailIsMaternelle ? "21%" : "17%" }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="bg-slate-700 text-white">
                    <th className="p-2 border border-slate-400 text-center" rowSpan={2}>
                      {planDetailIsMaternelle ? "Domaines" : "Champ de Formation"}
                    </th>
                    {planDetailWeekLabels.map((wk, i) => (
                      <th key={i} className="p-2 border border-slate-400 text-center">{wk}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {planDetailFiche.map(champ => {
                    const rows = champ.subRows.length > 0 ? champ.subRows : [null];
                    return rows.map((subRow, subIdx) => (
                      <tr key={`${champ.code}-${subIdx}`} className="hover:bg-purple-50/30">
                        <td className={cn(
                          "p-2 border border-slate-300 align-middle",
                          subIdx === 0 ? cn(champ.color, "text-white text-center") : "bg-slate-50 text-slate-600 text-left pl-3"
                        )}>
                          {subIdx === 0 ? (
                            <div>
                              <div className="font-bold text-sm">{champ.label}</div>
                              {subRow && <div className="text-[10px] opacity-90 mt-0.5">{subRow}</div>}
                            </div>
                          ) : (
                            <div className="text-[10px] font-medium pl-4">↳ {subRow}</div>
                          )}
                        </td>
                        {planDetailWeekLabels.map((_, weekIdx) => {
                          const cell = findPlanCell(weekIdx + 1, champ.code, subRow || undefined);
                          return (
                            <td key={weekIdx} className="p-1 border border-slate-200 align-top">
                              {cell ? (
                                <div
                                  className={cn(
                                    "text-[9px] leading-tight p-1 rounded min-h-[60px]",
                                    cell.isCustom ? "bg-amber-50 text-amber-900 border border-amber-200"
                                      : cell.isAutoProposed ? "bg-purple-50 text-purple-900 border border-purple-100"
                                      : "text-slate-700"
                                  )}
                                  dangerouslySetInnerHTML={{ __html: cell.content }}
                                />
                              ) : (
                                <div className="text-[9px] text-slate-300 p-1 min-h-[60px]">—</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile layout (cards per week) */}
            <div className="md:hidden space-y-4">
              {planDetailWeekLabels.map((wk, weekIdx) => (
                <div key={weekIdx} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-3 bg-slate-700 text-white font-bold text-sm">{wk}</div>
                  <div className="divide-y divide-slate-100">
                    {planDetailFiche.map(champ => {
                      const rows = champ.subRows.length > 0 ? champ.subRows : [null];
                      return rows.map((subRow, subIdx) => {
                        const cell = findPlanCell(weekIdx + 1, champ.code, subRow || undefined);
                        if (!cell) return null;
                        return (
                          <div key={`${champ.code}-${subIdx}`} className="p-3">
                            <div className={cn("inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white mb-1", champ.color)}>
                              {champ.label}{subRow ? ` · ${subRow}` : ''}
                            </div>
                            <div
                              className={cn(
                                "text-xs leading-tight p-2 rounded min-h-[40px]",
                                cell.isCustom ? "bg-amber-50 text-amber-900 border border-amber-200"
                                  : cell.isAutoProposed ? "bg-purple-50 text-purple-900 border border-purple-100"
                                  : "text-slate-700 bg-slate-50"
                              )}
                              dangerouslySetInnerHTML={{ __html: cell.content }}
                            />
                          </div>
                        );
                      });
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Signatures */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t-2 border-slate-300">
          <div className="space-y-2">
            <div className="text-sm font-bold text-slate-800">Le Titulaire de la classe</div>
            <div className="text-xs text-slate-500">{selectedPlan.teacherFirstName} {selectedPlan.teacherLastName} — Signature</div>
            {selectedPlan.teacherSignature ? (
              <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                <img src={selectedPlan.teacherSignature} alt="Signature Titulaire" className="max-h-24 mx-auto" />
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl p-4 text-center text-xs text-slate-400 italic">
                Non signé par l'enseignant
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="text-sm font-bold text-slate-800">Le Directeur / La Directrice</div>
            <div className="text-xs text-slate-500">Signature et cachet</div>
            {selectedPlan.directorSignature ? (
              <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2">
                <img src={selectedPlan.directorSignature} alt="Signature Directeur" className="max-h-24 mx-auto" />
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-xl p-4 text-center text-xs text-slate-400 italic">
                {statusTab === 'SUBMITTED' ? 'En attente de validation' : '—'}
              </div>
            )}
          </div>
        </div>

        {/* Director observation (if rejected) */}
        {selectedPlan.directorObservation && (
          <div className="border-t border-slate-100 pt-4">
            <div className="text-xs font-semibold text-slate-700 mb-1">Observation du directeur :</div>
            <p className="text-sm text-slate-600 p-3 bg-amber-50 rounded-lg">{selectedPlan.directorObservation}</p>
          </div>
        )}

        {/* Reject modal (still uses modal for the observation textarea) */}
        {modalPlan && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Rejeter la planification</h3>
                <button onClick={() => setModalPlan(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-slate-600">Planification {modalPlan.classLevel} — {modalPlan.month}</p>
                <textarea
                  value={rejectObservation}
                  onChange={e => setRejectObservation(e.target.value)}
                  rows={3}
                  placeholder="Indiquez la raison du rejet (visible par l'enseignant)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  autoFocus
                />
              </div>
              <div className="p-4 border-t border-slate-100 flex gap-2">
                <button onClick={() => setModalPlan(null)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200">Annuler</button>
                <button onClick={() => handleReject(modalPlan)} disabled={validating || !rejectObservation.trim()} className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {validating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmer le rejet'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ⭐ Build hierarchy: schoolLevel → month → classLevel → items (Étape B)
  const levelOrder = ['Maternelle', 'Primaire', 'Secondaire', 'Collège', 'Lycée', 'Autres'];
  const levelColors: Record<string, string> = {
    Maternelle: 'text-pink-700 bg-pink-50 border-pink-200',
    Primaire: 'text-blue-700 bg-blue-50 border-blue-200',
    Secondaire: 'text-purple-700 bg-purple-50 border-purple-200',
    Collège: 'text-amber-700 bg-amber-50 border-amber-200',
    Lycée: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    Autres: 'text-slate-700 bg-slate-50 border-slate-200',
  };
  const monthOrder = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'];

  // Derive schoolLevel from classLevel
  // ⭐ FIX Issue D (chevron fix is also part of same batch):
  //   Benin education system:
  //     Maternelle = PS / MS / GS (Petite/Moyenne/Grande Section)
  //     Primaire  = CI (Cours d'Initiation), CP, CE1, CE2, CM1, CM2
  //     Secondaire = 6e, 5e, 4e, 3e, 2nde, 1ère, Terminale
  //   The previous version misclassified CI and CP as Maternelle — wrong.
  const getSchoolLevel = (classLevel: string): string => {
    const cl = (classLevel || '').toUpperCase();
    // Maternelle : PS, MS, GS (Petite/Moyenne/Grande Section) + anything with 'MAT'
    if (cl === 'PS' || cl === 'MS' || cl === 'GS' || cl.includes('MAT')) return 'Maternelle';
    // Primaire : CI, CP, CE1, CE2, CM1, CM2 (exact match to avoid 'CP' matching 'CP-XYZ' etc.)
    if (cl === 'CI' || cl === 'CP' || cl === 'CE1' || cl === 'CE2' || cl === 'CM1' || cl === 'CM2') return 'Primaire';
    // Secondaire : 6e à 3e, 2nde, 1ère, Terminale
    if (cl === '6E' || cl === '5E' || cl === '4E' || cl === '3E' ||
        cl === '2NDE' || cl === 'SND' || cl === '1ERE' || cl === '1ER' || cl === 'TERMINALE' || cl === 'TERM') return 'Secondaire';
    return 'Autres';
  };

  const hierarchy: Record<string, Record<string, Record<string, any[]>>> = {};
  for (const plan of pendingPlans) {
    const schoolLevel = plan.schoolLevelName || getSchoolLevel(plan.classLevel) || 'Autres';
    const month = plan.month || 'Mois inconnu';
    const classLevel = plan.classLevel || 'Sans classe';
    if (!hierarchy[schoolLevel]) hierarchy[schoolLevel] = {};
    if (!hierarchy[schoolLevel][month]) hierarchy[schoolLevel][month] = {};
    if (!hierarchy[schoolLevel][month][classLevel]) hierarchy[schoolLevel][month][classLevel] = [];
    hierarchy[schoolLevel][month][classLevel].push(plan);
  }

  const sortedLevels = Object.keys(hierarchy).sort((a, b) => {
    const ia = levelOrder.indexOf(a); const ib = levelOrder.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const toggleCollapse = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
    setter(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };

  // Compute all keys for expand/collapse all
  const allLevelKeys = sortedLevels;
  const allMonthKeys: string[] = [];
  const allClassKeys: string[] = [];
  const emptyLevelKeys: string[] = [];
  const emptyMonthKeys: string[] = [];
  for (const sl of sortedLevels) {
    let slHasItems = false;
    for (const mo of Object.keys(hierarchy[sl])) {
      const monthKey = `${sl}::${mo}`;
      allMonthKeys.push(monthKey);
      const classKeys = Object.keys(hierarchy[sl][mo]);
      const monthItemsCount = classKeys.reduce((s, cn) => s + (hierarchy[sl][mo][cn]?.length || 0), 0);
      for (const cn of classKeys) allClassKeys.push(`${sl}::${mo}::${cn}`);
      if (monthItemsCount === 0) emptyMonthKeys.push(monthKey);
      else slHasItems = true;
    }
    if (!slHasItems) emptyLevelKeys.push(sl);
  }

  const handleExpandAll = () => { setCollapsedSchoolLevels(new Set()); setCollapsedMonths(new Set()); setCollapsedClasses(new Set()); };
  const handleCollapseAll = () => { setCollapsedSchoolLevels(new Set(emptyLevelKeys)); setCollapsedMonths(new Set(emptyMonthKeys)); setCollapsedClasses(new Set()); };

  // ⭐ Status sub-tabs config (Étape A)
  const tabConfig = {
    SUBMITTED: { label: 'En attente', icon: Clock, color: 'text-blue-700 bg-blue-50' },
    VALIDATED: { label: 'Validés', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
    REJECTED: { label: 'Rejetés', icon: XCircle, color: 'text-red-700 bg-red-50' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (pendingPlans.length === 0) {
    return (
      <div className="text-center py-12">
        <CalendarRange className="h-12 w-12 mx-auto text-slate-300 mb-2" />
        <p className="text-sm font-bold text-slate-700">
          {statusTab === 'SUBMITTED' ? 'Aucune planification en attente' : statusTab === 'VALIDATED' ? 'Aucune planification validée' : 'Aucune planification rejetée'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Les planifications mensuelles {statusTab === 'SUBMITTED' ? 'soumises' : statusTab === 'VALIDATED' ? 'validées' : 'rejetées'} par les enseignants apparaîtront ici.
        </p>
      </div>
    );
  }

  // ⭐ In-page detail view (Étape D) — if selectedPlan is set, render detail instead of list
  return (
    <div className="space-y-4">
      {/* Header + status sub-tabs (Étape A) */}
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
                statusTab === s ? `${cfg.color} border-current` : 'text-slate-500 hover:text-slate-700 border-transparent'
              )}
            >
              <Icon className="h-4 w-4" />
              {cfg.label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-500">{pendingPlans.length} élément(s)</span>
          <button onClick={handleExpandAll} className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200" title="Tout déplier">
            <ChevronsUpDown className="h-3.5 w-3.5" /> Tout déplier
          </button>
          <button onClick={handleCollapseAll} className="flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200" title="Tout replier">
            <ChevronsDownUp className="h-3.5 w-3.5" /> Tout replier
          </button>
          <button onClick={loadPending} className="p-2 hover:bg-slate-100 rounded-lg" title="Recharger">
            <RefreshCw className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* ⭐ Collapsible hierarchy (Étape B) */}
      <div className="space-y-3">
        {sortedLevels.map(schoolLevel => {
          const months = hierarchy[schoolLevel];
          const monthNames = Object.keys(months).sort((a, b) => {
            const ia = monthOrder.indexOf(a); const ib = monthOrder.indexOf(b);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
          });
          const totalItems = monthNames.reduce((s, mo) => s + Object.values(months[mo]).reduce((cs, items) => cs + items.length, 0), 0);
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
                  ({monthNames.length} mois · {totalItems} planif(s))
                </span>
              </button>
              {!isLevelCollapsed && (
                <div className="bg-white border-t border-slate-200 p-3 space-y-2">
                  {monthNames.map(month => {
                    const classes = months[month];
                    const classNames = Object.keys(classes).sort();
                    const monthItems = classNames.reduce((s, cn) => s + classes[cn].length, 0);
                    const monthKey = `${schoolLevel}::${month}`;
                    const isMonthCollapsed = collapsedMonths.has(monthKey);
                    return (
                      <div key={month} className="border border-indigo-100 rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleCollapse(setCollapsedMonths, monthKey)}
                          className="w-full flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                        >
                          {isMonthCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-indigo-600" /> : <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />}
                          <Calendar className="h-4 w-4 text-indigo-600" />
                          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{month}</span>
                          <span className="ml-auto text-xs text-indigo-500">{monthItems} planif(s) · {classNames.length} classe(s)</span>
                        </button>
                        {!isMonthCollapsed && (
                          <div className="p-2 space-y-2 bg-white">
                            {classNames.map(className => {
                              const classPlans = classes[className];
                              const classKey = `${schoolLevel}::${month}::${className}`;
                              const isClassCollapsed = collapsedClasses.has(classKey);
                              return (
                                <div key={className} className="border border-slate-200 rounded-lg overflow-hidden">
                                  <button
                                    onClick={() => toggleCollapse(setCollapsedClasses, classKey)}
                                    className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
                                  >
                                    {isClassCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-slate-600" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-600" />}
                                    <CalendarRange className="h-4 w-4 text-slate-600" />
                                    <span className="text-sm font-bold text-slate-700 uppercase tracking-wide">{className}</span>
                                    <span className="ml-auto text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full">{classPlans.length}</span>
                                  </button>
                                  {!isClassCollapsed && (
                                    <div className="p-2 space-y-2 bg-white">
                                      {classPlans.map((plan, idx) => {
                                        const teacherName = `${plan.teacherFirstName || ''} ${plan.teacherLastName || ''}`.trim() || 'Enseignant';
                                        return (
                                          <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">{plan.classLevel}</span>
                                                <span className="text-sm font-bold text-slate-900">{plan.month}</span>
                                                {plan.submittedAt && <span className="text-[10px] text-slate-400">soumis le {new Date(plan.submittedAt).toLocaleDateString('fr-FR')}</span>}
                                              </div>
                                              <div className="text-xs text-slate-600"><strong>Enseignant :</strong> {teacherName}</div>
                                              <div className="text-xs text-slate-500 mt-0.5">{plan.cellCount} cellule(s) — {plan.customCount} personnalisée(s)</div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                              <button onClick={() => setSelectedPlan(plan)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                                                <Eye className="h-3 w-3" /> Voir
                                              </button>
                                              {statusTab === 'SUBMITTED' && (
                                                <button onClick={() => { setModalPlan(plan); setRejectObservation(""); }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                                                  <CheckCircle2 className="h-3 w-3" /> Traiter
                                                </button>
                                              )}
                                              {statusTab !== 'SUBMITTED' && (
                                                <span className={cn('px-2 py-1 text-[10px] font-bold uppercase rounded', statusTab === 'VALIDATED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                                                  {statusTab === 'VALIDATED' ? '✓ Validé' : '✗ Rejeté'}
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

      {/* ⭐ Validation modal (Étape D — for reject with observation) */}
      {modalPlan && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Traiter — {modalPlan.classLevel} {modalPlan.month}</h3>
              <button onClick={() => setModalPlan(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-600">{modalPlan.teacherFirstName} {modalPlan.teacherLastName} · {modalPlan.cellCount} cellules</p>
              {directorSignature && (
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-1">Votre signature :</div>
                  <img src={directorSignature} alt="Signature" className="max-h-16 border border-slate-200 rounded p-1" />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Observation (pour rejet)</label>
                <textarea value={rejectObservation} onChange={e => setRejectObservation(e.target.value)} rows={3} placeholder="Raison du rejet (visible par l'enseignant)" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-2">
              <button onClick={() => setModalPlan(null)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-200">Annuler</button>
              <button onClick={() => handleReject(modalPlan)} disabled={validating || !rejectObservation.trim()} className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 disabled:opacity-50">
                {validating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Rejeter'}
              </button>
              <button onClick={() => handleValidate(modalPlan)} disabled={validating || !directorSignature} className="flex-1 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {validating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
