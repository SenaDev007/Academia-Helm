"use client";

/**
 * ============================================================================
 * SemainierAttendancePanel — Panneau de pointage par le semainier
 * ============================================================================
 *
 * Affiche la liste de tous les enseignants actifs pour une date donnée,
 * avec leur statut de présence. Le semainier peut :
 *   - Marquer PRESENT / ABSENT / LATE / HALF_DAY / MISSION
 *   - Voir si l'enseignant a déjà auto-pointé (badge "AUTO")
 *   - Ajouter une note
 *
 * ⭐ Mutual exclusion : si l'enseignant a déjà auto-pointé (markedByRole='SELF'),
 *    le semainier ne peut PAS modifier — badge "Auto-pointé à HH:MM".
 *
 * Endpoints utilisés :
 *   GET  /api/hr/attendance/daily-staff?date=YYYY-MM-DD
 *   POST /api/hr/attendance/semainier-check-in
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Check, X, Clock, AlertCircle, UserCheck, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useAppSession } from "@/contexts/AppSessionContext";

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

interface SemainierAttendancePanelProps {
  /** Date cible (YYYY-MM-DD). Défaut = aujourd'hui. */
  date?: string;
}

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Présent', color: 'emerald', icon: Check,
    activeClass: 'bg-emerald-600 text-white', inactiveClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' },
  { value: 'LATE', label: 'Retard', color: 'amber', icon: Clock,
    activeClass: 'bg-amber-600 text-white', inactiveClass: 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' },
  { value: 'ABSENT', label: 'Absent', color: 'rose', icon: X,
    activeClass: 'bg-rose-600 text-white', inactiveClass: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100' },
  { value: 'HALF_DAY', label: 'Demi-journée', color: 'blue', icon: Clock,
    activeClass: 'bg-blue-600 text-white', inactiveClass: 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100' },
  { value: 'MISSION', label: 'Mission', color: 'purple', icon: AlertCircle,
    activeClass: 'bg-purple-600 text-white', inactiveClass: 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100' },
];

const STATUS_BADGES: Record<string, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-700',
  LATE: 'bg-amber-100 text-amber-700',
  ABSENT: 'bg-rose-100 text-rose-700',
  HALF_DAY: 'bg-blue-100 text-blue-700',
  MISSION: 'bg-purple-100 text-purple-700',
};

export function SemainierAttendancePanel({ date }: SemainierAttendancePanelProps) {
  const { user } = useAppSession();
  const targetDate = date || new Date().toISOString().split('T')[0];

  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // staffId en cours de save

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/attendance/daily-staff?date=${targetDate}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStaff(Array.isArray(data) ? data : []);
      } else {
        setStaff([]);
      }
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const handleMark = async (staffId: string, status: string) => {
    setSaving(staffId);
    try {
      const res = await fetch("/api/hr/attendance/semainier-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          staffId,
          date: targetDate,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Pointage impossible", { description: data.message });
        return;
      }
      toast.success(`✅ ${data.staffName} marqué(e) "${status}"`);
      loadStaff(); // recharge la liste
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(null);
    }
  };

  // === Stats rapides ===
  const stats = {
    total: staff.length,
    present: staff.filter(s => s.status === 'PRESENT').length,
    late: staff.filter(s => s.status === 'LATE').length,
    absent: staff.filter(s => s.status === 'ABSENT').length,
    notMarked: staff.filter(s => !s.status).length,
    selfMarked: staff.filter(s => s.markedByRole === 'SELF').length,
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Chargement des enseignants...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête + stats */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-purple-600" />
              Pointage des enseignants — Semainier
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {new Date(targetDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button onClick={loadStaff} className="p-2 hover:bg-slate-100 rounded-lg" title="Recharger">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
          <StatBox label="Total" value={stats.total} color="slate" />
          <StatBox label="Présents" value={stats.present} color="emerald" />
          <StatBox label="Retards" value={stats.late} color="amber" />
          <StatBox label="Absents" value={stats.absent} color="rose" />
          <StatBox label="Non marqués" value={stats.notMarked} color="blue" />
          <StatBox label="Auto-pointés" value={stats.selfMarked} color="purple" />
        </div>
      </div>

      {/* Liste des enseignants */}
      {staff.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          <UserCheck className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="font-medium">Aucun enseignant actif trouvé</p>
          <p className="text-xs mt-1">Vérifiez que des enseignants sont bien enregistrés dans le module RH.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="text-left px-3 py-2.5 font-bold text-slate-700">Enseignant</th>
                <th className="text-left px-3 py-2.5 font-bold text-slate-700">Niveau</th>
                <th className="text-center px-3 py-2.5 font-bold text-slate-700">Statut actuel</th>
                <th className="text-center px-3 py-2.5 font-bold text-slate-700">Pointage</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s: any) => {
                const isSelfMarked = s.markedByRole === 'SELF';
                return (
                  <tr key={s.staffId} className={cn(
                    "border-b border-slate-100",
                    isSelfMarked && "bg-purple-50/30"
                  )}>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">{s.staffName}</div>
                      <div className="text-xs text-slate-500">
                        {s.matricule || '—'}
                        {s.checkIn && (
                          <span className="ml-2 text-slate-400">
                            • Arrivée: {new Date(s.checkIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {s.schoolLevelCode || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {s.status ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn("px-2 py-0.5 rounded text-xs font-bold", STATUS_BADGES[s.status] || 'bg-slate-100')}>
                            {s.status}
                          </span>
                          {isSelfMarked && (
                            <span className="text-[10px] text-purple-600 font-semibold flex items-center gap-0.5">
                              <Check className="h-2.5 w-2.5" /> AUTO-POINTÉ
                            </span>
                          )}
                          {s.markedByRole === 'SEMINARIER' && (
                            <span className="text-[10px] text-purple-600 font-semibold">
                              PAR SEMAINIER
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">Non marqué</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {isSelfMarked ? (
                        // ⭐ Mutual exclusion : si auto-pointé, le semainier ne peut PAS modifier
                        <div className="text-xs text-purple-600 italic text-center">
                          🔒 Auto-pointé — non modifiable
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-center flex-wrap">
                          {STATUS_OPTIONS.map(opt => {
                            const Icon = opt.icon;
                            const isActive = s.status === opt.value;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => handleMark(s.staffId, opt.value)}
                                disabled={saving === s.staffId}
                                title={opt.label}
                                className={cn(
                                  "px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition",
                                  isActive ? opt.activeClass : opt.inactiveClass,
                                  saving === s.staffId && "opacity-50"
                                )}
                              >
                                {saving === s.staffId ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Icon className="h-3 w-3" />
                                )}
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: any) {
  const colorClasses: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
  };
  return (
    <div className={cn("border rounded-lg p-2", colorClasses[color] || colorClasses.slate)}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] uppercase opacity-70 font-semibold">{label}</p>
    </div>
  );
}
