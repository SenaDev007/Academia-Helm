"use client";

/**
 * ============================================================================
 * TeacherPresenceWorkspace — Module « Présence & Absences » self-service
 * ============================================================================
 *
 * ⭐ 2026-09-15 — INTÉGRATION CAHIER DE SEMAINE ↔ RH :
 * ⭐ 2026-11-21 — PARTAGÉ PAR TOUT LE PERSONNEL : ce workspace est rendu
 * aussi bien par le portail enseignant (/app/teacher/presence) que par la
 * page partagée /app/my-presence (directeurs, secrétaires, comptables,
 * surveillants, censeurs…) — le staff est résolu serveur par l'email, la
 * même page marche pour tous les métiers.
 *
 * Il donne à CHAQUE membre du personnel les mêmes capacités de pointage que
 * l'onglet Présences du module Personnel RH (réservé à la direction) :
 *
 *   Onglet 1 « Ma présence » :
 *     - Carte d'auto-pointage géolocalisé du jour (MyAttendanceCard, GPS
 *       vérifié serveur, mutual exclusion avec le semainier)
 *     - Historique personnel des présences (GET /api/hr/attendance/my-history)
 *       incluant les pointages faits PAR LE SEMAINIER depuis le cahier de
 *       semaine (marqués « Par le semainier ») — tout est synchronisé.
 *
 *   Onglet 2 « Heures supplémentaires » :
 *     - Déclarer ses heures sup (POST /api/hr/attendance/my-overtime)
 *     - Suivre leur validation par la direction (GET /api/hr/attendance/my-overtime)
 *
 *   Onglet 3 « Congés & Absences » :
 *     - Solde de congés (GET /api/hr/leaves/my-balance)
 *     - Créer ses demandes de congé/absence (POST /api/hr/leaves/my-requests)
 *       — congé annuel, maladie, maternité, paternité, sans solde,
 *       exceptionnel, ou ABSENCE justifiée (motif libre) ;
 *       approuvées par la direction dans le module RH (Congés & Absences) ;
 *       à l'approbation, les présences ABSENT sont générées automatiquement.
 *       Le RH est notifié à la soumission ; le personnel est notifié (cloche)
 *       quand le RH approuve ou refuse.
 *     - Annuler une demande en attente (PUT /api/hr/leaves/my-requests/:id/cancel)
 *
 * Le Staff est résolu CÔTÉ SERVEUR par l'email de l'utilisateur connecté :
 * un enseignant ne voit et ne déclare que pour LUI-MÊME.
 *
 * Carte bilingue FR/EN (piste anglophone).
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, MapPin, Clock, Plus, Calendar, CheckCircle2,
  CalendarCheck, Coffee, Ban, RefreshCw, AlertTriangle, Info, UserCheck, Send,
} from "lucide-react";
import { toast } from "sonner";
import { useL } from "@/lib/i18n/bilingual";
import { MyAttendanceCard } from "@/components/hr/MyAttendanceCard";

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

const PRIMARY = "#1A2BA6";

type Tab = "presence" | "overtime" | "leaves";

const STATUS_LABELS: Record<string, string> = {
  PRESENT: "Présent",
  LATE: "Retard",
  ABSENT: "Absent",
  HALF_DAY: "Demi-journée",
  MISSION: "Mission",
};

const STATUS_LABELS_EN: Record<string, string> = {
  PRESENT: "Present",
  LATE: "Late",
  ABSENT: "Absent",
  HALF_DAY: "Half day",
  MISSION: "Mission",
};

const STATUS_CLASSES: Record<string, string> = {
  PRESENT: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  LATE: "bg-amber-50 text-amber-700 border border-amber-100",
  ABSENT: "bg-rose-50 text-rose-700 border border-rose-100",
  HALF_DAY: "bg-blue-50 text-blue-700 border border-blue-100",
  MISSION: "bg-purple-50 text-purple-700 border border-purple-100",
};

/** Provenance du pointage (markedByRole côté RH) */
const SOURCE_LABELS: Record<string, { label: string; labelEn: string; className: string }> = {
  SELF: { label: "Auto-pointé", labelEn: "Self check-in", className: "bg-emerald-100 text-emerald-700" },
  SEMINARIER: { label: "Par le semainier", labelEn: "By weekly monitor", className: "bg-purple-100 text-purple-700" },
  ADMIN: { label: "Direction", labelEn: "Administration", className: "bg-slate-100 text-slate-700" },
};

const LEAVE_TYPES = [
  { value: "ANNUAL", label: "Congé annuel", labelEn: "Annual leave" },
  { value: "SICK", label: "Maladie", labelEn: "Sick leave" },
  { value: "MATERNITY", label: "Maternité", labelEn: "Maternity leave" },
  { value: "PATERNITY", label: "Paternité", labelEn: "Paternity leave" },
  { value: "UNPAID", label: "Sans solde", labelEn: "Unpaid leave" },
  { value: "EXCEPTIONAL", label: "Exceptionnel", labelEn: "Exceptional" },
  // ⭐ 2026-11-21 — Demande d'ABSENCE justifiée (motif libre) : le personnel
  //    peut demander une absence sans que ce soit un congé (ex: problème
  //    personnel, convocation). Ne consomme PAS le solde de congés annuels.
  { value: "ABSENCE", label: "Absence justifiée", labelEn: "Justified absence" },
];

const LEAVE_STATUS: Record<string, { label: string; labelEn: string; className: string }> = {
  PENDING: { label: "En attente", labelEn: "Pending", className: "text-amber-600" },
  APPROVED: { label: "Approuvé", labelEn: "Approved", className: "text-emerald-600" },
  REJECTED: { label: "Refusé", labelEn: "Rejected", className: "text-rose-600" },
  CANCELLED: { label: "Annulé", labelEn: "Cancelled", className: "text-slate-400" },
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 " +
  "placeholder:text-slate-400 focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10 transition";

const labelClass = "block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5";

function calculateDays(start: string, end: string) {
  return Math.ceil(Math.abs(new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
}

export function TeacherPresenceWorkspace() {
  const L = useL();
  const [activeTab, setActiveTab] = useState<Tab>("presence");

  // ─── Onglet 1 : historique des présences ───
  const [historyData, setHistoryData] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/hr/attendance/my-history?limit=60", { credentials: "include" });
      if (res.ok) {
        setHistoryData(await res.json());
      } else {
        setHistoryData(null);
      }
    } catch {
      setHistoryData(null);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ─── Onglet 2 : heures supplémentaires ───
  const [overtimeData, setOvertimeData] = useState<any>(null);
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [otForm, setOtForm] = useState({
    date: new Date().toISOString().split("T")[0],
    hours: "2",
    reason: "",
  });
  const [otSaving, setOtSaving] = useState(false);

  const loadOvertime = useCallback(async () => {
    setOvertimeLoading(true);
    try {
      const res = await fetch("/api/hr/attendance/my-overtime", { credentials: "include" });
      if (res.ok) setOvertimeData(await res.json());
      else setOvertimeData(null);
    } catch {
      setOvertimeData(null);
    } finally {
      setOvertimeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "overtime" && overtimeData === null) loadOvertime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleDeclareOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    const hours = parseFloat(otForm.hours);
    if (!hours || hours <= 0) {
      toast.error(L("Nombre d'heures invalide", "Invalid number of hours"));
      return;
    }
    setOtSaving(true);
    try {
      const res = await fetch("/api/hr/attendance/my-overtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: otForm.date,
          hours,
          reason: otForm.reason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(L("Déclaration impossible", "Declaration failed"), { description: data.message });
        return;
      }
      toast.success(L("✅ Heures supplémentaires déclarées", "✅ Overtime declared"), {
        description: L(
          "La direction les validera dans le module RH → Présences.",
          "The administration will validate them in the HR module → Attendance.",
        ),
      });
      setOtForm((f) => ({ ...f, reason: "" }));
      loadOvertime();
    } catch (e: any) {
      toast.error(L("Erreur", "Error"), { description: e.message });
    } finally {
      setOtSaving(false);
    }
  };

  // ─── Onglet 3 : congés & absences ───
  const [leavesData, setLeavesData] = useState<any>(null);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [balanceData, setBalanceData] = useState<any>(null);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    type: "ANNUAL",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    reason: "",
  });
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadLeaves = useCallback(async () => {
    setLeavesLoading(true);
    try {
      const [reqRes, balRes] = await Promise.all([
        fetch("/api/hr/leaves/my-requests", { credentials: "include" }),
        fetch("/api/hr/leaves/my-balance", { credentials: "include" }),
      ]);
      if (reqRes.ok) setLeavesData(await reqRes.json());
      else setLeavesData(null);
      if (balRes.ok) setBalanceData(await balRes.json());
      else setBalanceData(null);
    } catch {
      setLeavesData(null);
      setBalanceData(null);
    } finally {
      setLeavesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "leaves" && leavesData === null) loadLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(leaveForm.startDate) > new Date(leaveForm.endDate)) {
      toast.error(L("La date de fin doit suivre la date de début", "End date must be after start date"));
      return;
    }
    setLeaveSaving(true);
    try {
      const res = await fetch("/api/hr/leaves/my-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: leaveForm.type,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          reason: leaveForm.reason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(L("Demande impossible", "Request failed"), { description: data.message });
        return;
      }
      toast.success(L("✅ Demande soumise", "✅ Request submitted"), {
        description: L(
          "La direction l'examinera dans le module RH → Congés & Absences.",
          "The administration will review it in the HR module → Leaves & Absences.",
        ),
      });
      setShowLeaveForm(false);
      setLeaveForm((f) => ({ ...f, reason: "" }));
      loadLeaves();
    } catch (e: any) {
      toast.error(L("Erreur", "Error"), { description: e.message });
    } finally {
      setLeaveSaving(false);
    }
  };

  const handleCancelLeave = async (requestId: string) => {
    if (!confirm(L("Annuler cette demande de congé ?", "Cancel this leave request?"))) return;
    setCancellingId(requestId);
    try {
      const res = await fetch(`/api/hr/leaves/my-requests/${requestId}/cancel`, {
        method: "PUT",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(L("Annulation impossible", "Cancellation failed"), { description: data.message });
        return;
      }
      toast.success(L("Demande annulée", "Request cancelled"));
      loadLeaves();
    } catch (e: any) {
      toast.error(L("Erreur", "Error"), { description: e.message });
    } finally {
      setCancellingId(null);
    }
  };

  // ─── Stats personnelles (historique) ───
  const attendances: any[] = historyData?.attendances || [];
  const stats = {
    total: attendances.length,
    present: attendances.filter((a) => a.status === "PRESENT").length,
    late: attendances.filter((a) => a.status === "LATE").length,
    absent: attendances.filter((a) => a.status === "ABSENT").length,
    other: attendances.filter((a) => ["HALF_DAY", "MISSION"].includes(a.status)).length,
  };
  const presenceRate = stats.total > 0
    ? (((stats.present + stats.late + stats.other) / stats.total) * 100).toFixed(1)
    : "—";

  const noStaffRecord = historyData && historyData.staff === null;
  const overtimes: any[] = overtimeData?.overtimes || [];
  const totalValidatedOt = overtimes.filter((o) => o.validated === true).reduce((acc, o) => acc + Number(o.hours), 0);
  const totalPendingOt = overtimes.filter((o) => o.validated !== true).reduce((acc, o) => acc + Number(o.hours), 0);
  const leaveRequests: any[] = leavesData?.requests || [];
  const balance = balanceData?.balance;

  // ═══════════════════════════════ RENDER ═══════════════════════════════
  return (
    <div className="space-y-6 pb-12">

      {/* ─── En-tête + onglets ─── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-[#1A2BA6]" />
              {L("Présence & Absences", "Attendance & Leaves")}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {L(
                "Pointez votre présence, déclarez vos heures supplémentaires et gérez vos demandes de congé — tout est synchronisé avec le module RH.",
                "Check in your attendance, declare overtime and manage your leave requests — everything is synced with the HR module.",
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-1 p-2 overflow-x-auto">
          {([
            { key: "presence", label: "Ma présence", labelEn: "My attendance", icon: MapPin },
            { key: "overtime", label: "Heures supplémentaires", labelEn: "Overtime", icon: Clock },
            { key: "leaves", label: "Congés & Absences", labelEn: "Leaves & Absences", icon: Calendar },
          ] as const).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition",
                  activeTab === t.key
                    ? "text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50",
                )}
                style={activeTab === t.key ? { backgroundColor: PRIMARY } : undefined}
              >
                <Icon className="h-4 w-4" />
                {L(t.label, t.labelEn)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ⚠️ Enseignant sans fiche personnel rattachée */}
      {noStaffRecord && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">
              {L("Aucune fiche personnel rattachée à votre compte", "No staff record linked to your account")}
            </p>
            <p className="text-xs text-amber-800 mt-1">
              {historyData?.message ||
                L(
                  "Contactez la direction pour être rattaché(e) au module RH afin de pointer votre présence, déclarer vos heures supplémentaires et faire vos demandes de congé.",
                  "Contact the administration to be linked to the HR module so you can check in, declare overtime and request leaves.",
                )}
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════ ONGLET 1 : MA PRÉSENCE ═══════════════ */}
      {activeTab === "presence" && (
        <div className="space-y-6">

          {/* Carte auto-pointage du jour (GPS vérifié serveur) */}
          <MyAttendanceCard />

          {/* Stats personnelles */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Jours pointés", labelEn: "Days recorded", value: stats.total, cls: "text-slate-800" },
              { label: "Présences", labelEn: "Present", value: stats.present, cls: "text-emerald-600" },
              { label: "Retards", labelEn: "Late", value: stats.late, cls: "text-amber-600" },
              { label: "Absences", labelEn: "Absent", value: stats.absent, cls: "text-rose-600" },
              { label: "Taux de présence", labelEn: "Attendance rate", value: `${presenceRate}${presenceRate !== "—" ? "%" : ""}`, cls: "text-[#1A2BA6]" },
            ].map((k, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{L(k.label, k.labelEn)}</p>
                <p className={cn("text-xl font-bold mt-0.5", k.cls)}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Historique des présences */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-[#1A2BA6]" />
                <h4 className="font-bold text-slate-900 text-sm">
                  {L("Historique de mes présences", "My attendance history")}
                </h4>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{attendances.length} {L("enregistrement(s)", "record(s)")}</span>
                <button onClick={loadHistory} className="p-1.5 hover:bg-slate-100 rounded-lg" title={L("Recharger", "Reload")}>
                  <RefreshCw className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Date", "Date")}</th>
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Statut", "Status")}</th>
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Arrivée", "Check-in")}</th>
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Départ", "Check-out")}</th>
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Heures", "Hours")}</th>
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Source", "Source")}</th>
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Notes", "Notes")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyLoading ? (
                    <tr><td colSpan={7} className="text-center py-8 text-slate-400">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    </td></tr>
                  ) : attendances.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        {noStaffRecord
                          ? L("Aucun historique — pas de fiche personnel rattachée.", "No history — no staff record linked.")
                          : L("Aucune présence enregistrée pour le moment.", "No attendance recorded yet.")}
                      </td>
                    </tr>
                  ) : (
                    attendances.map((att) => {
                      const src = SOURCE_LABELS[att.markedByRole] || SOURCE_LABELS.ADMIN;
                      return (
                        <tr key={att.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 font-medium text-slate-900">
                            {new Date(att.date).toLocaleDateString(L("fr-FR", "en-GB"), { weekday: "short", day: "numeric", month: "short" })}
                          </td>
                          <td className="px-5 py-3">
                            <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold uppercase", STATUS_CLASSES[att.status] || "bg-slate-100 text-slate-600")}>
                              {L(STATUS_LABELS[att.status] || att.status, STATUS_LABELS_EN[att.status] || att.status)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-600">
                            {att.checkIn ? new Date(att.checkIn).toLocaleTimeString(L("fr-FR", "en-GB"), { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                          <td className="px-5 py-3 text-slate-600">
                            {att.checkOut ? new Date(att.checkOut).toLocaleTimeString(L("fr-FR", "en-GB"), { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                          <td className="px-5 py-3 text-slate-600">{att.hoursWorked != null ? `${att.hoursWorked} h` : "—"}</td>
                          <td className="px-5 py-3">
                            <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", src.className)}>
                              {L(src.label, src.labelEn)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-500 max-w-[220px] truncate" title={att.notes || ""}>{att.notes || "—"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Note explicative */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              {L(
                "Les pointages effectués par le semainier depuis le cahier de semaine apparaissent ici automatiquement (source « Par le semainier ») — les deux canaux sont synchronisés. Si vous auto-pointez votre présence, le semainier ne peut pas la modifier.",
                "Attendances marked by the weekly monitor from the weekly register appear here automatically (source \"By weekly monitor\") — both channels are synchronized. If you check in yourself, the weekly monitor cannot modify it.",
              )}
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════ ONGLET 2 : HEURES SUPPLÉMENTAIRES ═══════════════ */}
      {activeTab === "overtime" && (
        <div className="space-y-6">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{L("H. supp. validées", "Validated overtime")}</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">{totalValidatedOt} h</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{L("H. supp. en attente", "Pending overtime")}</p>
              <p className="text-xl font-bold text-amber-600 mt-0.5">{totalPendingOt} h</p>
            </div>
          </div>

          {/* Formulaire de déclaration */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#1A2BA6]" />
              {L("Déclarer des heures supplémentaires", "Declare overtime")}
            </h4>
            <form onSubmit={handleDeclareOvertime} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>{L("Date", "Date")}</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={otForm.date}
                    onChange={(e) => setOtForm({ ...otForm, date: e.target.value })}
                    required
                    disabled={!!noStaffRecord}
                  />
                </div>
                <div>
                  <label className={labelClass}>{L("Nombre d'heures", "Number of hours")}</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    className={inputClass}
                    value={otForm.hours}
                    onChange={(e) => setOtForm({ ...otForm, hours: e.target.value })}
                    required
                    disabled={!!noStaffRecord}
                  />
                </div>
                <div>
                  <label className={labelClass}>{L("Raison", "Reason")}</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder={L("Ex: Soutien cours du soir…", "E.g. Evening remedial classes…")}
                    value={otForm.reason}
                    onChange={(e) => setOtForm({ ...otForm, reason: e.target.value })}
                    disabled={!!noStaffRecord}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={otSaving || !!noStaffRecord}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:opacity-90 transition disabled:opacity-50"
                style={{ backgroundColor: PRIMARY }}
              >
                {otSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {L("Déclarer les heures", "Declare hours")}
              </button>
            </form>
          </div>

          {/* Historique heures sup */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#1A2BA6]" />
                <h4 className="font-bold text-slate-900 text-sm">{L("Mes heures supplémentaires", "My overtime")}</h4>
              </div>
              <button onClick={loadOvertime} className="p-1.5 hover:bg-slate-100 rounded-lg" title={L("Recharger", "Reload")}>
                <RefreshCw className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Date", "Date")}</th>
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Heures", "Hours")}</th>
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Raison", "Reason")}</th>
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Statut", "Status")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overtimeLoading ? (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
                  ) : overtimes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-400">
                        {L("Aucune heure supplémentaire déclarée.", "No overtime declared yet.")}
                      </td>
                    </tr>
                  ) : (
                    overtimes.map((ot) => (
                      <tr key={ot.id} className="hover:bg-slate-50/50">
                        <td className="px-5 py-3 font-medium text-slate-900">
                          {new Date(ot.date).toLocaleDateString(L("fr-FR", "en-GB"))}
                        </td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {Number(ot.hours)} h
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600 max-w-[280px] truncate" title={ot.notes || ""}>{ot.notes || "—"}</td>
                        <td className="px-5 py-3">
                          {ot.validated === true ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              <CheckCircle2 className="h-3 w-3" /> {L("Validée", "Validated")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                              <Clock className="h-3 w-3" /> {L("En attente", "Pending")}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ ONGLET 3 : CONGÉS & ABSENCES ═══════════════ */}
      {activeTab === "leaves" && (
        <div className="space-y-6">

          {/* Solde de congés */}
          {balance && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Acquis", labelEn: "Earned", value: `${balance.earned ?? 0} j`, cls: "text-slate-800" },
                { label: "Pris (approuvés)", labelEn: "Taken (approved)", value: `${balance.taken ?? 0} j`, cls: "text-rose-600" },
                { label: "En attente", labelEn: "Pending", value: `${balance.pending ?? 0} j`, cls: "text-amber-600" },
                { label: "Solde disponible", labelEn: "Available balance", value: `${balance.balance ?? 0} j`, cls: "text-[#1A2BA6]" },
              ].map((k, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{L(k.label, k.labelEn)}</p>
                  <p className={cn("text-xl font-bold mt-0.5", k.cls)}>{k.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Barre d'actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <p className="text-xs text-slate-500 max-w-xl">
              {L(
                "Vos demandes sont examinées par la direction dans le module RH → Congés & Absences. À l'approbation, vos absences sont automatiquement reportées dans le suivi des présences.",
                "Your requests are reviewed by the administration in the HR module → Leaves & Absences. Once approved, your absences are automatically reflected in the attendance tracking.",
              )}
            </p>
            <button
              onClick={() => setShowLeaveForm((v) => !v)}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition whitespace-nowrap disabled:opacity-50"
              style={{ backgroundColor: PRIMARY }}
              disabled={!!noStaffRecord}
            >
              <Plus className="h-4 w-4" /> {L("Nouvelle demande", "New request")}
            </button>
          </div>

          {/* Formulaire nouvelle demande */}
          {showLeaveForm && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#1A2BA6]" />
                {L("Demande de congé / absence", "Leave / absence request")}
              </h4>
              <form onSubmit={handleCreateLeave} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>{L("Type", "Type")}</label>
                    <select
                      className={inputClass}
                      value={leaveForm.type}
                      onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                    >
                      {LEAVE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{L(t.label, t.labelEn)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{L("Date de début", "Start date")}</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={leaveForm.startDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{L("Date de fin", "End date")}</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={leaveForm.endDate}
                      onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{L("Motif", "Reason")}</label>
                  <textarea
                    className={inputClass + " min-h-[80px] resize-none"}
                    placeholder={L("Raison de la demande…", "Reason for the request…")}
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  {L(
                    `Durée demandée : ${calculateDays(leaveForm.startDate, leaveForm.endDate)} jour(s)`,
                    `Requested duration: ${calculateDays(leaveForm.startDate, leaveForm.endDate)} day(s)`,
                  )}
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowLeaveForm(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
                  >
                    {L("Annuler", "Cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={leaveSaving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {leaveSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {L("Soumettre la demande", "Submit request")}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Liste des demandes */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#1A2BA6]" />
                <h4 className="font-bold text-slate-900 text-sm">{L("Mes demandes", "My requests")}</h4>
              </div>
              <button onClick={loadLeaves} className="p-1.5 hover:bg-slate-100 rounded-lg" title={L("Recharger", "Reload")}>
                <RefreshCw className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Type", "Type")}</th>
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Période", "Period")}</th>
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Durée", "Duration")}</th>
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Motif", "Reason")}</th>
                    <th className="px-5 py-3 text-slate-500 font-semibold">{L("Statut", "Status")}</th>
                    <th className="px-5 py-3 text-slate-500 font-semibold text-right">{L("Actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leavesLoading ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
                  ) : leaveRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400">
                        <Coffee className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        {noStaffRecord
                          ? L("Pas de fiche personnel rattachée.", "No staff record linked.")
                          : L("Aucune demande soumise pour le moment.", "No request submitted yet.")}
                      </td>
                    </tr>
                  ) : (
                    leaveRequests.map((req) => {
                      const st = LEAVE_STATUS[req.status] || LEAVE_STATUS.PENDING;
                      const type = LEAVE_TYPES.find((t) => t.value === req.type);
                      return (
                        <tr key={req.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 font-semibold text-slate-700">
                            {L(type?.label || req.type, type?.labelEn || req.type)}
                          </td>
                          <td className="px-5 py-3 text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              {new Date(req.startDate).toLocaleDateString(L("fr-FR", "en-GB"))}
                              <span className="text-slate-300">→</span>
                              {new Date(req.endDate).toLocaleDateString(L("fr-FR", "en-GB"))}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              {calculateDays(req.startDate, req.endDate)} {L("jrs", "days")}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-500 max-w-[220px] truncate italic" title={req.reason || ""}>
                            {req.reason || "—"}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              {req.status === "PENDING" && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                              <span className={cn("text-xs font-bold uppercase tracking-wider", st.className)}>
                                {L(st.label, st.labelEn)}
                              </span>
                            </div>
                            {req.status === "REJECTED" && req.rejectedReason && (
                              <p className="text-[10px] text-rose-400 mt-0.5 truncate max-w-[180px]" title={req.rejectedReason}>{req.rejectedReason}</p>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {req.status === "PENDING" ? (
                              <button
                                onClick={() => handleCancelLeave(req.id)}
                                disabled={cancellingId === req.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-50"
                              >
                                {cancellingId === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                                {L("Annuler", "Cancel")}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-300 italic">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
