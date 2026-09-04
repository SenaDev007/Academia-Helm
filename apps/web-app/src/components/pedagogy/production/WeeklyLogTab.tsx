"use client";

import { useState, useEffect, useCallback } from "react";
import { CalendarDays, Loader2, Send, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface WeeklyLogTabProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

export function WeeklyLogTab({ tenantId, academicYearId, teacherId }: WeeklyLogTabProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pedagogy-space/weekly-logs?teacherId=${teacherId}&academicYearId=${academicYearId}`, { credentials: "include" });
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }, [teacherId, academicYearId]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleSubmit = async (id: string) => {
    try {
      const res = await fetch(`/api/pedagogy-space/weekly-logs/submit/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ teacherId }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("✅ Semainier soumis au directeur");
      loadLogs();
    } catch (e: any) { toast.error("Erreur", { description: e.message }); }
  };

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    DRAFT: { label: "Brouillon", color: "bg-slate-100 text-slate-600", icon: Clock },
    SUBMITTED: { label: "Soumis", color: "bg-amber-100 text-amber-700", icon: Send },
    VALIDATED: { label: "Validé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    REJECTED: { label: "Rejeté", color: "bg-red-100 text-red-700", icon: XCircle },
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-slate-900">Cahier du Semainier</h3>
      <p className="text-sm text-slate-500">Soumettez votre cahier hebdomadaire au directeur pour validation.</p>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-slate-400">Aucun semainier. Créez des séances dans le cahier journal pour générer un semainier.</div>
      ) : (
        <div className="space-y-3">
          {logs.map(l => {
            const sc = statusConfig[l.status] || statusConfig.DRAFT;
            const Icon = sc.icon;
            return (
              <div key={l.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-900">
                      Semaine du {new Date(l.weekStartDate).toLocaleDateString("fr-FR")} au {new Date(l.weekEndDate).toLocaleDateString("fr-FR")}
                    </p>
                    <p className="text-xs text-slate-500">{l.classLogIds?.length || 0} séance(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${sc.color}`}>
                    <Icon className="h-3 w-3" /> {sc.label}
                  </span>
                  {l.status === "DRAFT" && (
                    <button onClick={() => handleSubmit(l.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                      <Send className="h-3 w-3" /> Soumettre
                    </button>
                  )}
                  {l.status === "REJECTED" && l.rejectionReason && (
                    <span className="text-xs text-red-600" title={l.rejectionReason}>Motif: {l.rejectionReason}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
