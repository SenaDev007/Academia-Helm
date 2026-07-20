"use client";

/**
 * Contrôle Pédagogique Direction — Vue consolidée pour le directeur.
 *
 * Onglets :
 *   1. Tableau de bord — KPIs (semainiers en attente, cahiers récents, devoirs en attente)
 *   2. Validations en attente — Rapports de fin de semaine soumis (valider/rejeter)
 *   3. Semainiers en attente — Anciens semainiers soumis (valider/rejeter)
 *
 * Backend: PedagogicalSpaceService (getDirectorDashboard, getPendingWeeklySummaries,
 *          validateWeeklySummary, getPendingWeeklyLogs, validateWeeklyLog)
 */

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, RefreshCw, CheckCircle2, XCircle, Send, Clock,
  FileText, Users, BookOpen, AlertTriangle, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

interface DirectorControlProps {
  tenantId: string;
  academicYearId: string;
  userId: string;
}

const TABS = [
  { id: "dashboard", label: "Tableau de bord" },
  { id: "summaries", label: "Rapports fin de semaine" },
  { id: "weekly", label: "Semainiers" },
] as const;

export function DirectorControl({ tenantId, academicYearId, userId }: DirectorControlProps) {
  const [tab, setTab] = useState<typeof TABS[number]["id"]>("dashboard");

  return (
    <div className="flex flex-col gap-5">
      {/* Sous-onglets */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-100">
          {TABS.map(t => (
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
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
        {tab === "dashboard" && <DashboardTab tenantId={tenantId} academicYearId={academicYearId} />}
        {tab === "summaries" && <PendingSummariesTab tenantId={tenantId} academicYearId={academicYearId} userId={userId} />}
        {tab === "weekly" && <PendingWeeklyLogsTab tenantId={tenantId} academicYearId={academicYearId} userId={userId} />}
      </div>
    </div>
  );
}

// ============================================================================
// Tableau de bord
// ============================================================================

function DashboardTab({ tenantId, academicYearId }: { tenantId: string; academicYearId: string }) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pedagogy-space/director/dashboard?academicYearId=${academicYearId}`, { credentials: "include" });
      const data = await res.json();
      setDashboard(data);
    } catch { setDashboard(null); }
    finally { setLoading(false); }
  }, [academicYearId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;

  const kpis = [
    { label: "Rapports fin de semaine en attente", value: dashboard?.pendingWeeklyLogs || 0, icon: Send, color: "amber" },
    { label: "Cahiers journaux (7 derniers jours)", value: dashboard?.recentClassLogs || 0, icon: BookOpen, color: "blue" },
    { label: "Devoirs en attente d'évaluation", value: dashboard?.pendingTasks || 0, icon: FileText, color: "rose" },
    { label: "Enseignants actifs", value: dashboard?.activeTeachers || 0, icon: Users, color: "emerald" },
    { label: "Fiches pédagogiques en attente", value: dashboard?.pendingLessonPlans || 0, icon: AlertTriangle, color: "purple" },
  ];

  const colorMap: Record<string, string> = {
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    rose: "bg-rose-50 border-rose-100 text-rose-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    purple: "bg-purple-50 border-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">Tableau de bord pédagogique</h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={`rounded-xl border p-4 ${colorMap[kpi.color]}`}>
              <Icon className="h-5 w-5 mb-2 opacity-60" />
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="text-xs font-medium opacity-80 mt-1">{kpi.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Synthèse</span>
        </div>
        <p className="text-sm text-slate-500">
          {dashboard?.pendingWeeklyLogs > 0
            ? `${dashboard.pendingWeeklyLogs} rapport(s) de fin de semaine en attente de validation.`
            : "Aucun rapport en attente de validation."}
          {dashboard?.pendingTasks > 0 && ` ${dashboard.pendingTasks} devoir(s) en attente d'évaluation par les enseignants.`}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Rapports de fin de semaine en attente
// ============================================================================

function PendingSummariesTab({ tenantId, academicYearId, userId }: { tenantId: string; academicYearId: string; userId: string }) {
  const [summaries, setSummaries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pedagogy-space/director/pending-summaries?academicYearId=${academicYearId}`, { credentials: "include" });
      const data = await res.json();
      setSummaries(Array.isArray(data) ? data : []);
    } catch { setSummaries([]); }
    finally { setLoading(false); }
  }, [academicYearId]);

  useEffect(() => { load(); }, [load]);

  const handleValidate = async (id: string) => {
    try {
      const res = await fetch(`/api/pedagogy-space/director/validate-summary/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "VALIDATED", validatedBy: userId }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Rapport validé");
      load();
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) { toast.error("Veuillez indiquer un motif"); return; }
    try {
      const res = await fetch(`/api/pedagogy-space/director/validate-summary/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "REJECTED", validatedBy: userId, rejectionReason: rejectReason }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("Rapport rejeté");
      setRejecting(null);
      setRejectReason("");
      load();
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;

  if (summaries.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 className="h-12 w-12 text-emerald-300 mx-auto mb-3" />
        <p className="font-medium text-slate-700">Aucun rapport en attente</p>
        <p className="text-sm text-slate-400 mt-1">Tous les rapports de fin de semaine ont été traités.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">Rapports de fin de semaine en attente</h3>
      <p className="text-sm text-slate-500">{summaries.length} rapport(s) soumis par les semainiers</p>

      <div className="space-y-3">
        {summaries.map(s => (
          <div key={s.id} className="p-4 rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium text-slate-900">Semaine {s.weekNumber} — Trimestre {s.trimester}</p>
                <p className="text-xs text-slate-500">
                  Du {new Date(s.weekStartDate).toLocaleDateString("fr-FR")} au {new Date(s.weekEndDate).toLocaleDateString("fr-FR")}
                </p>
                <p className="text-xs text-slate-400">Soumis le {new Date(s.submittedAt).toLocaleDateString("fr-FR")}</p>
              </div>
              <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-bold">En attente</span>
            </div>

            {/* Aperçu rapide */}
            {s.globalLevel && (
              <p className="text-sm text-slate-600 mb-2">
                Niveau global: <strong>{s.globalLevel}</strong>
              </p>
            )}
            {s.generalObservations && (
              <p className="text-xs text-slate-500 mb-2 line-clamp-2">{s.generalObservations}</p>
            )}

            {/* Actions */}
            {rejecting === s.id ? (
              <div className="mt-3 space-y-2">
                <textarea
                  placeholder="Motif du rejet..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
                <div className="flex gap-2">
                  <button onClick={() => handleReject(s.id)} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700">Confirmer le rejet</button>
                  <button onClick={() => { setRejecting(null); setRejectReason(""); }} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs">Annuler</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mt-3">
                <button onClick={() => handleValidate(s.id)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Valider
                </button>
                <button onClick={() => setRejecting(s.id)} className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">
                  <XCircle className="h-3 w-3" /> Rejeter
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Semainiers en attente (ancien système PedagogicalWeeklyLog)
// ============================================================================

function PendingWeeklyLogsTab({ tenantId, academicYearId, userId }: { tenantId: string; academicYearId: string; userId: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pedagogy-space/director/pending?academicYearId=${academicYearId}`, { credentials: "include" });
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }, [academicYearId]);

  useEffect(() => { load(); }, [load]);

  const handleValidate = async (id: string, action: "VALIDATED" | "REJECTED") => {
    try {
      const res = await fetch(`/api/pedagogy-space/director/validate/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, validatedBy: userId }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success(action === "VALIDATED" ? "✅ Semainier validé" : "Semainier rejeté");
      load();
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>;

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-700">Aucun semainier en attente</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">Semainiers en attente de validation</h3>
      <p className="text-sm text-slate-500">{logs.length} semainier(s) soumis</p>

      <div className="space-y-3">
        {logs.map(l => (
          <div key={l.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white">
            <div>
              <p className="font-medium text-slate-900">
                Semaine du {new Date(l.weekStartDate).toLocaleDateString("fr-FR")}
              </p>
              <p className="text-xs text-slate-500">{l.teacherName} · {l.className}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleValidate(l.id, "VALIDATED")} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                <CheckCircle2 className="h-3 w-3 inline mr-1" /> Valider
              </button>
              <button onClick={() => handleValidate(l.id, "REJECTED")} className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">
                <XCircle className="h-3 w-3 inline mr-1" /> Rejeter
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function cn(...c: (string | boolean | undefined)[]) { return c.filter(Boolean).join(" "); }
