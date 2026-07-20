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
  FileText, BookOpen, ClipboardList, FileSpreadsheet, AlertTriangle,
  ChevronRight, X, Eye, Sigma, FlaskConical, Users, Palette,
} from "lucide-react";
import { toast } from "sonner";

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
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pedagogy-space/director/pedagogy-dashboard?academicYearId=${academicYearId}`, { credentials: "include" });
      const data = await res.json();
      setDashboard(data);
    } catch { setDashboard(null); }
    finally { setLoading(false); }
  }, [academicYearId]);

  useEffect(() => { load(); }, [load, refreshKey]);

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
// Pending Cahier Journals
// ============================================================================

function PendingCahierJournalsTab({ tenantId, academicYearId, userId, refreshKey, onRefresh }: {
  tenantId: string; academicYearId: string; userId: string; refreshKey: number; onRefresh: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [modalItem, setModalItem] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pedagogy-space/director/pending-cahier-journals?academicYearId=${academicYearId}`, { credentials: "include" });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [academicYearId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleValidate = async (action: "VALIDATED" | "REJECTED", reason?: string) => {
    if (!modalItem) return;
    const res = await fetch(`/api/pedagogy-space/director/validate-cahier-journal/${modalItem.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, validatedBy: userId, rejectionReason: reason }),
    });
    if (!res.ok) throw new Error("Erreur lors de la validation");
    toast.success(action === "VALIDATED" ? "✅ Cahier journal validé" : "Cahier journal rejeté");
    onRefresh();
    load();
  };

  const handleView = async (item: any) => {
    try {
      const res = await fetch(`/api/pedagogy-space/director/cahier-journal/${item.id}`, { credentials: "include" });
      const data = await res.json();
      setSelected(data);
    } catch { toast.error("Erreur lors du chargement"); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <FileSpreadsheet className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-700">Aucun cahier journal en attente</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Cahiers Journal en attente</h3>
          <p className="text-sm text-slate-500">{items.length} soumission(s)</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-slate-100 rounded-lg"><RefreshCw className="h-4 w-4" /></button>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white">
            <div>
              <p className="font-medium text-slate-900">
                Semaine du {formatDateFR(item.weekStartDate)} au {formatDateFR(item.weekEndDate)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Classe: <strong>{item.classNameResolved || item.className || "—"}</strong>
                {" · "}
                Enseignant: {item.teacherFirstName} {item.teacherLastName}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Soumis le {formatDateTimeFR(item.submittedAt)}
              </p>
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

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Cahier Journal — {selected.classNameResolved}</h3>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-slate-100 rounded"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div><strong>Semaine:</strong> {formatDateFR(selected.weekStartDate)} au {formatDateFR(selected.weekEndDate)}</div>
              <div><strong>Statut:</strong> {selected.status}</div>
              <div><strong>Observations:</strong> <pre className="whitespace-pre-wrap mt-1">{selected.observations || "—"}</pre></div>
              {(() => {
                let entries = selected.entries;
                if (typeof entries === "string") {
                  try { entries = JSON.parse(entries); } catch { entries = {}; }
                }
                return (
                  <div>
                    <strong>Contenu de la grille:</strong>
                    <pre className="whitespace-pre-wrap mt-1 text-xs bg-slate-50 p-3 rounded-lg max-h-96 overflow-y-auto">
                      {JSON.stringify(entries, null, 2)}
                    </pre>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

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
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [modalItem, setModalItem] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pedagogy-space/director/pending-fiches?academicYearId=${academicYearId}`, { credentials: "include" });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [academicYearId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleValidate = async (action: "VALIDATED" | "REJECTED", reason?: string) => {
    if (!modalItem) return;
    const res = await fetch(`/api/pedagogy-space/director/validate-fiche/${modalItem.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, validatedBy: userId, rejectionReason: reason }),
    });
    if (!res.ok) throw new Error("Erreur");
    toast.success(action === "VALIDATED" ? "✅ Fiche validée" : "Fiche rejetée");
    onRefresh();
    load();
  };

  const handleView = async (item: any) => {
    try {
      const res = await fetch(`/api/pedagogy-space/director/fiches/${item.id}`, { credentials: "include" });
      const data = await res.json();
      setSelected(data);
    } catch { toast.error("Erreur"); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-700">Aucune fiche en attente</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Fiches Pédagogiques en attente</h3>
          <p className="text-sm text-slate-500">{items.length} soumission(s)</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-slate-100 rounded-lg"><RefreshCw className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map(item => {
          const sheetConfig = SHEET_TYPE_LABELS[item.sheetType] || { label: item.sheetType, icon: FileText, color: "bg-slate-100" };
          const Icon = sheetConfig.icon;
          return (
            <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-start justify-between mb-2">
                <div className={cn("flex items-center gap-2 px-2 py-1 rounded text-xs font-bold", sheetConfig.color)}>
                  <Icon className="h-3 w-3" />
                  {sheetConfig.label}
                </div>
                <span className="text-xs text-slate-400">S{item.weekNumber || "—"}</span>
              </div>
              <p className="font-medium text-slate-900 text-sm">
                {item.competence ? item.competence.slice(0, 80) + "..." : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Classe: <strong>{item.classNameResolved || "—"}</strong>
              </p>
              <p className="text-xs text-slate-500">
                {item.teacherFirstName} {item.teacherLastName} · {formatDateFR(item.lessonDate)}
              </p>
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-100">
                <button onClick={() => handleView(item)}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
                  <Eye className="h-3 w-3" /> Voir
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
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Fiche Pédagogique — {SHEET_TYPE_LABELS[selected.sheetType]?.label || selected.sheetType}</h3>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-slate-100 rounded"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><strong>Classe:</strong> {selected.classNameResolved || "—"}</div>
                <div><strong>Enseignant:</strong> {selected.teacherFirstName} {selected.teacherLastName}</div>
                <div><strong>Date:</strong> {formatDateFR(selected.lessonDate)}</div>
                <div><strong>Semaine:</strong> S{selected.weekNumber} — T{selected.trimester}</div>
                <div><strong>Durée:</strong> {selected.durationMinutes} min</div>
                <div><strong>Effectif:</strong> {selected.totalStudents} ({selected.boysCount}G / {selected.girlsCount}F)</div>
                <div><strong>Présents:</strong> {selected.totalPresent} (G{selected.boysPresent}/F{selected.girlsPresent})</div>
                <div><strong>Absents:</strong> {selected.totalAbsent}</div>
              </div>
              <div><strong>Compétence:</strong> <div className="mt-1 text-slate-700">{selected.competence || "—"}</div></div>
              <div><strong>Habileté:</strong> <div className="mt-1 text-slate-700">{selected.habilete || "—"}</div></div>
              <div><strong>Prérequis:</strong> <div className="mt-1 text-slate-700">{selected.prealable || "—"}</div></div>
              <div><strong>Contenu:</strong> <div className="mt-1 text-slate-700">{selected.contenu || "—"}</div></div>
              <div><strong>Méthodes:</strong> <div className="mt-1 text-slate-700">{selected.methodes || "—"}</div></div>
              <div><strong>Moyens didactiques:</strong> <div className="mt-1 text-slate-700">{selected.moyensDidactiques || "—"}</div></div>
              <div><strong>Évaluation:</strong> <div className="mt-1 text-slate-700">{selected.evaluation || "—"}</div></div>
              <div><strong>Référence:</strong> <div className="mt-1 text-slate-700">{selected.reference || "—"}</div></div>
              {selected.deroulement && (
                <div>
                  <strong>Déroulement:</strong>
                  <pre className="whitespace-pre-wrap mt-1 text-xs bg-slate-50 p-3 rounded-lg">
                    {JSON.stringify(typeof selected.deroulement === "string" ? JSON.parse(selected.deroulement) : selected.deroulement, null, 2)}
                  </pre>
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
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [modalItem, setModalItem] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pedagogy-space/director/pending-registers?academicYearId=${academicYearId}`, { credentials: "include" });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [academicYearId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleValidate = async (action: "VALIDATED" | "REJECTED", reason?: string) => {
    if (!modalItem) return;
    const res = await fetch(`/api/pedagogy-space/director/validate-attendance-register/${modalItem.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, validatedBy: userId, rejectionReason: reason }),
    });
    if (!res.ok) throw new Error("Erreur");
    toast.success(action === "VALIDATED" ? "✅ Registre validé" : "Registre rejeté");
    onRefresh();
    load();
  };

  const handleView = async (item: any) => {
    try {
      const res = await fetch(`/api/pedagogy-space/director/attendance-register/${item.id}`, { credentials: "include" });
      const data = await res.json();
      setSelected(data);
    } catch { toast.error("Erreur"); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-700">Aucun registre en attente</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Registres d'Appel en attente</h3>
          <p className="text-sm text-slate-500">{items.length} soumission(s)</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-slate-100 rounded-lg"><RefreshCw className="h-4 w-4" /></button>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white">
            <div>
              <p className="font-medium text-slate-900">
                Registre de {MONTH_NAMES[item.month] || item.month} {item.year}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Classe: <strong>{item.classNameResolved || "—"}</strong>
                {" · "}
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

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Registre d'Appel — {selected.classNameResolved}</h3>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-slate-100 rounded"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><strong>Période:</strong> {MONTH_NAMES[selected.month]} {selected.year}</div>
                <div><strong>Statut:</strong> {selected.status}</div>
                <div><strong>Demi-journées du mois:</strong> {selected.demiJourneeMois ?? "—"}</div>
                <div><strong>Présences possibles:</strong> {selected.presencePossibleMois ?? "—"}</div>
                <div><strong>Total absences:</strong> {selected.totalAbsencesMois ?? "—"}</div>
                <div><strong>Présences effectives:</strong> {selected.totalPresencesEffectivesMois ?? "—"}</div>
                <div><strong>% Présences:</strong> {selected.pourcentagePresences ?? "—"}%</div>
                <div><strong>% Absences:</strong> {selected.pourcentageAbsences ?? "—"}%</div>
              </div>
              {selected.arreteDate && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <strong>Registre arrêté le:</strong> {formatDateTimeFR(selected.arreteDate)} à {selected.arreteHeure}
                  <div className="mt-1 text-xs">
                    Effectif du jour: {selected.effectifJourFilles ?? "—"} filles, {selected.effectifJourGarcons ?? "—"} garçons
                  </div>
                </div>
              )}
              <div>
                <strong>Liste des élèves ({Array.isArray(typeof selected.studentsData === "string" ? JSON.parse(selected.studentsData || "[]") : selected.studentsData) ?
                  (typeof selected.studentsData === "string" ? JSON.parse(selected.studentsData || "[]") : selected.studentsData).length : 0}):</strong>
                <div className="mt-2 max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left">N°</th>
                        <th className="px-2 py-1 text-left">Nom</th>
                        <th className="px-2 py-1 text-center">Sexe</th>
                        <th className="px-2 py-1 text-center">Abs.</th>
                        <th className="px-2 py-1 text-center">Poss.</th>
                        <th className="px-2 py-1 text-center">Eff.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let students = selected.studentsData;
                        if (typeof students === "string") {
                          try { students = JSON.parse(students); } catch { students = []; }
                        }
                        if (!Array.isArray(students)) students = [];
                        return students.map((s: any, i: number) => (
                          <tr key={s.studentId || i} className="hover:bg-slate-50">
                            <td className="px-2 py-1">{s.numero || i + 1}</td>
                            <td className="px-2 py-1">{s.nom} {s.prenom}</td>
                            <td className="px-2 py-1 text-center">{s.sexe}</td>
                            <td className="px-2 py-1 text-center text-red-600">{s.totalAbsences ?? 0}</td>
                            <td className="px-2 py-1 text-center">{s.totalPresencesPossibles ?? 0}</td>
                            <td className="px-2 py-1 text-center text-emerald-600">{s.totalPresenceEffectif ?? 0}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
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
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [modalItem, setModalItem] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pedagogy-space/director/pending-evaluations?academicYearId=${academicYearId}`, { credentials: "include" });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [academicYearId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleValidate = async (action: "VALIDATED" | "REJECTED", reason?: string) => {
    if (!modalItem) return;
    const res = await fetch(`/api/pedagogy-space/director/validate-evaluation/${modalItem.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, validatedBy: userId, rejectionReason: reason }),
    });
    if (!res.ok) throw new Error("Erreur");
    toast.success(action === "VALIDATED" ? "✅ Évaluation validée" : "Évaluation rejetée");
    onRefresh();
    load();
  };

  const handleView = async (item: any) => {
    try {
      const res = await fetch(`/api/pedagogy-space/director/evaluation/${item.id}`, { credentials: "include" });
      const data = await res.json();
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Évaluations Mensuelles en attente</h3>
          <p className="text-sm text-slate-500">{items.length} soumission(s)</p>
        </div>
        <button onClick={load} className="p-2 hover:bg-slate-100 rounded-lg"><RefreshCw className="h-4 w-4" /></button>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white">
            <div>
              <p className="font-medium text-slate-900">
                Évaluation N°{item.evaluationNumber || "—"} — {MONTH_NAMES[item.registerMonth || item.month] || "—"} {item.registerYear || item.year}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Classe: <strong>{item.classNameResolved || "—"}</strong>
                {" · "}
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

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Évaluation — {selected.classNameResolved}</h3>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-slate-100 rounded"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <div><strong>N° Éval:</strong> {selected.evaluationNumber || "—"}</div>
                <div><strong>Étape:</strong> {selected.etapeNumber || "—"}</div>
                <div><strong>Seuil réussite:</strong> {selected.seuilReussite ?? 10}/20</div>
              </div>

              {(() => {
                let subjects = selected.subjectsConfig;
                if (typeof subjects === "string") {
                  try { subjects = JSON.parse(subjects); } catch { subjects = []; }
                }
                if (!Array.isArray(subjects)) subjects = [];

                let scores = selected.studentScores;
                if (typeof scores === "string") {
                  try { scores = JSON.parse(scores); } catch { scores = []; }
                }
                if (!Array.isArray(scores)) scores = [];

                return (
                  <div>
                    <strong>Scores par élève ({scores.length} élèves, {subjects.length} matière(s)):</strong>
                    <div className="overflow-x-auto mt-2 border border-slate-200 rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-2 py-1 text-left">N°</th>
                            <th className="px-2 py-1 text-left">Nom</th>
                            <th className="px-2 py-1 text-center">Sexe</th>
                            {subjects.map((subj: any, idx: number) => (
                              <th key={idx} className="px-2 py-1 text-center" colSpan={3}>
                                {subj.subjectName}
                              </th>
                            ))}
                            <th className="px-2 py-1 text-center">Total</th>
                            <th className="px-2 py-1 text-center">Seuil</th>
                          </tr>
                          <tr className="bg-slate-50">
                            <th colSpan={3}></th>
                            {subjects.flatMap((_: any, idx: number) => ([
                              <th key={`cm-${idx}`} className="px-1 py-1 text-center text-[10px]">CM</th>,
                              <th key={`cp-${idx}`} className="px-1 py-1 text-center text-[10px]">CP</th>,
                              <th key={`t-${idx}`} className="px-1 py-1 text-center text-[10px]">Tot</th>,
                            ]))}
                          </tr>
                        </thead>
                        <tbody>
                          {scores.map((s: any, idx: number) => (
                            <tr key={s.studentId || idx} className="hover:bg-slate-50">
                              <td className="px-2 py-1">{s.numero || idx + 1}</td>
                              <td className="px-2 py-1">{s.nom} {s.prenom}</td>
                              <td className="px-2 py-1 text-center">{s.sexe}</td>
                              {subjects.flatMap((subj: any, subIdx: number) => {
                                const sc = s.scores?.[subIdx] || {};
                                return ([
                                  <td key={`s${idx}-cm${subIdx}`} className="px-1 py-1 text-center">{sc.cm ?? "—"}</td>,
                                  <td key={`s${idx}-cp${subIdx}`} className="px-1 py-1 text-center">{sc.cp ?? "—"}</td>,
                                  <td key={`s${idx}-t${subIdx}`} className="px-1 py-1 text-center font-bold">{sc.total ?? "—"}</td>,
                                ]);
                              })}
                              <td className="px-2 py-1 text-center font-bold text-blue-700">{s.totalGeneral ?? "—"}</td>
                              <td className="px-2 py-1 text-center">
                                {(s.totalGeneral ?? 0) >= (selected.seuilReussite ?? 10) ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

              <div className="p-3 bg-slate-50 rounded-lg">
                <strong>Récapitulatif:</strong>
                <div className="grid grid-cols-3 gap-3 mt-2 text-xs">
                  <div>Effectif: {selected.effectifTotalClasse ?? "—"} ({selected.effectifTotalGarcons ?? "—"}G / {selected.effectifTotalFilles ?? "—"}F)</div>
                  <div>Ayant composé: {selected.ayantComposeTotal ?? "—"} ({selected.ayantComposeG ?? "—"}G / {selected.ayantComposeF ?? "—"}F)</div>
                  <div>Atteint seuil: {selected.ayantAtteintSeuilTotal ?? "—"} ({selected.ayantAtteintSeuilG ?? "—"}G / {selected.ayantAtteintSeuilF ?? "—"}F)</div>
                  <div className="text-blue-600 font-bold">% Réussite: {selected.pourcentageReussiteTotal?.toFixed?.(1) ?? "—"}%</div>
                  <div className="text-blue-600">G: {selected.pourcentageReussiteG?.toFixed?.(1) ?? "—"}%</div>
                  <div className="text-blue-600">F: {selected.pourcentageReussiteF?.toFixed?.(1) ?? "—"}%</div>
                </div>
              </div>
            </div>
          </div>
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
