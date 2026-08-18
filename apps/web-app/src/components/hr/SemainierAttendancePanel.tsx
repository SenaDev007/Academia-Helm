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
  /** ⭐ Callback optionnel pour stocker le pointage dans le rapport quotidien JSON
   *    au lieu de l'API HR staff_attendances. Si fourni, onMark est appelé
   *    au lieu de /api/hr/attendance/semainier-check-in.
   *    Signature: (teacherId, teacherName, status, motif?) => void
   */
  onMark?: (teacherId: string, teacherName: string, status: string, motif?: string) => void;
  /** ⭐ Données de présence actuelles (depuis le rapport quotidien JSON).
   *    Si fourni, remplace le fetch API. Format: [{ teacherId, status, motif }]
   */
  attendanceData?: any[];
  /** ⭐ Désactiver les boutons (rapport déjà soumis/validé) */
  disabled?: boolean;
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

// ⭐ Map statut → libellé affiché (Présent / Retard / Absent / Demi-journée / Mission)
//    au lieu d'afficher la valeur brute (PRESENT / LATE / ABSENT / HALF_DAY / MISSION)
const STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Présent',
  LATE: 'Retard',
  ABSENT: 'Absent',
  HALF_DAY: 'Demi-journée',
  MISSION: 'Mission',
};

export function SemainierAttendancePanel({ date, onMark, attendanceData, disabled }: SemainierAttendancePanelProps) {
  const { user } = useAppSession();
  const targetDate = date || new Date().toISOString().split('T')[0];

  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // staffId en cours de save
  // ⭐ Modal pour le motif d'absence
  const [absenceModal, setAbsenceModal] = useState<{ teacherId: string; teacherName: string } | null>(null);
  const [absenceMotif, setAbsenceMotif] = useState('');

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

  // ⭐ TOUJOURS charger la liste des enseignants depuis l'API RH
  //    (même si attendanceData est fourni non vide) car attendanceData ne
  //    contient que les statuts des enseignants déjà pointés — pas la liste
  //    complète des enseignants actifs qu'il faut afficher pour pointage.
  //    attendanceData sert uniquement à retrouver le statut d'un enseignant
  //    (via getStaffStatus ci-dessous).
  useEffect(() => { loadStaff(); }, [loadStaff]);

  // ⭐ Récupérer le statut d'un enseignant depuis attendanceData (rapport JSON)
  //    ou depuis staff (API HR)
  const getStaffStatus = (s: any): string | null => {
    if (attendanceData && onMark) {
      // Mode rapport quotidien : chercher dans attendanceData
      const entry = attendanceData.find((a: any) => a.teacherId === s.teacherId || a.teacherId === s.staffId);
      return entry?.status || null;
    }
    return s.status || null;
  };

  const handleMark = async (staffId: string, staffName: string, status: string) => {
    // ⭐ Si onMark est fourni (mode rapport quotidien), l'utiliser au lieu de l'API HR
    if (onMark) {
      if (status === 'ABSENT') {
        // Ouvrir le modal pour le motif d'absence
        setAbsenceModal({ teacherId: staffId, teacherName: staffName });
        setAbsenceMotif('');
        return; // Ne pas marquer tout de suite — attendre le motif
      }
      setSaving(staffId);
      onMark(staffId, staffName, status);
      setSaving(null);
      return;
    }
    // Mode legacy : appeler l'API HR
    setSaving(staffId);
    try {
      const res = await fetch("/api/hr/attendance/semainier-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ staffId, date: targetDate, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Pointage impossible", { description: data.message });
        return;
      }
      toast.success(`✅ ${data.staffName} marqué(e) "${status}"`);
      loadStaff();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(null);
    }
  };

  // ⭐ Confirmer le motif d'absence et marquer l'enseignant
  const confirmAbsence = () => {
    if (absenceModal && onMark) {
      onMark(absenceModal.teacherId, absenceModal.teacherName, 'ABSENT', absenceMotif);
      setAbsenceModal(null);
      setAbsenceMotif('');
    }
  };

  // === Stats rapides ===
  // ⭐ FIX : calculer les stats à partir du statut RÉEL de chaque enseignant
  //    (via getStaffStatus qui lit depuis attendanceData si fourni, ou depuis
  //    staff.status sinon). Avant ce fix, les stats lisaient `s.status` directement
  //    sur l'objet staff (qui reste null en mode rapport quotidien) → les cartes
  //    affichaient toujours 0 pour Présents/Retards/Absents et Total pour
  //    Non marqués (qui était donc faux aussi).
  const getEffectiveStatus = (s: any): string | null => getStaffStatus(s);
  const stats = {
    total: staff.length,
    present: staff.filter((s: any) => getEffectiveStatus(s) === 'PRESENT').length,
    late: staff.filter((s: any) => getEffectiveStatus(s) === 'LATE').length,
    absent: staff.filter((s: any) => getEffectiveStatus(s) === 'ABSENT').length,
    halfDay: staff.filter((s: any) => getEffectiveStatus(s) === 'HALF_DAY').length,
    mission: staff.filter((s: any) => getEffectiveStatus(s) === 'MISSION').length,
    // ⭐ Non marqués = enseignants sans statut (null) — pas seulement ceux sans s.status
    notMarked: staff.filter((s: any) => !getEffectiveStatus(s)).length,
    selfMarked: staff.filter((s: any) => s.markedByRole === 'SELF').length,
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
                const currentStatus = getStaffStatus(s);
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
                        {/* ⭐ Afficher le rôle admin si le staff a un double rôle (DIRECTEUR, CENSEUR...) */}
                        {s.staffRoleType && s.staffRoleType !== 'TEACHER' && (
                          <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700">
                            {s.staffRoleType}
                          </span>
                        )}
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
                      {currentStatus ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn("px-2 py-0.5 rounded text-xs font-bold", STATUS_BADGES[currentStatus] || 'bg-slate-100')}>
                            {/* ⭐ Afficher le libellé français (Présent/Retard/Absent/Demi-journée/Mission) au lieu de la valeur brute */}
                            {STATUS_LABELS[currentStatus] || currentStatus}
                          </span>
                          {isSelfMarked && (
                            <span className="text-[10px] text-purple-600 font-semibold flex items-center gap-0.5">
                              <Check className="h-2.5 w-2.5" /> AUTO-POINTÉ
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">Non marqué</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {isSelfMarked ? (
                        <div className="text-xs text-purple-600 italic text-center">
                          🔒 Auto-pointé — non modifiable
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-center flex-wrap">
                          {STATUS_OPTIONS.map(opt => {
                            const Icon = opt.icon;
                            const isActive = currentStatus === opt.value;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => handleMark(s.staffId, s.staffName, opt.value)}
                                disabled={saving === s.staffId || disabled}
                                title={opt.label}
                                className={cn(
                                  "px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition",
                                  isActive ? opt.activeClass : opt.inactiveClass,
                                  (saving === s.staffId || disabled) && "opacity-50 cursor-not-allowed"
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

      {/* ⭐ MODAL: Motif d'absence */}
      {absenceModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b bg-rose-50 border-rose-200">
              <div className="flex items-center gap-3">
                <X className="h-10 w-10 text-rose-500" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Motif d'absence</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{absenceModal.teacherName}</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                Indiquez le motif de l'absence
              </label>
              <textarea
                value={absenceMotif}
                onChange={(e) => setAbsenceMotif(e.target.value)}
                rows={3}
                placeholder="Ex: Maladie, Congé, Formation, Mission..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400"
                autoFocus
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
              <button
                onClick={() => { setAbsenceModal(null); setAbsenceMotif(''); }}
                className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg">
                Annuler
              </button>
              <button
                onClick={confirmAbsence}
                disabled={!absenceMotif.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                <X className="h-4 w-4" />
                Confirmer l'absence
              </button>
            </div>
          </div>
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
