"use client";

/**
 * Parent Portal — Assiduité
 * Présences/absences/retards de l'enfant.
 */

import { useState, useEffect, useCallback } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import {
  CalendarCheck, Loader2, CheckCircle2, XCircle, Clock,
} from "lucide-react";

export default function ParentAttendancePage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!academicYear?.id || !user?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/parent/children?parentId=${user.id}&academicYearId=${academicYear.id}`, { credentials: "include" });
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setChildren(list);
        if (list.length > 0) setSelectedStudent(list[0].id);
      } catch { setChildren([]); }
    })();
  }, [user?.id, academicYear?.id]);

  const loadAttendance = useCallback(async () => {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/parent/attendance/${selectedStudent}`, { credentials: "include" });
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch { setRecords([]); }
    finally { setLoading(false); }
  }, [selectedStudent]);

  useEffect(() => {
    if (selectedStudent) loadAttendance();
  }, [loadAttendance, selectedStudent]);

  // Calculer les stats du mois
  const stats = records.reduce((acc, r) => {
    acc.total++;
    if (r.status === 'PRESENT') acc.present++;
    if (r.status === 'ABSENT') acc.absent++;
    if (r.status === 'LATE') acc.late++;
    return acc;
  }, { total: 0, present: 0, absent: 0, late: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <CalendarCheck className="h-5 w-5 text-amber-600" />
        <h2 className="text-lg font-bold text-slate-900">Assiduité</h2>
      </div>

      {children.length > 1 && (
        <select
          value={selectedStudent}
          onChange={(e) => setSelectedStudent(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]"
        >
          {children.map((c) => (
            <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
          ))}
        </select>
      )}

      {/* Stats résumé */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500 uppercase">Jours</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 text-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-emerald-700">{stats.present}</p>
          <p className="text-xs text-emerald-700 uppercase">Présents</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-700">{stats.absent}</p>
          <p className="text-xs text-red-700 uppercase">Absents</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
          <Clock className="h-5 w-5 text-amber-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-amber-700">{stats.late}</p>
          <p className="text-xs text-amber-700 uppercase">Retards</p>
        </div>
      </div>

      {/* Historique */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
        </div>
      ) : records.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Date</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">Statut</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Observation</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(r.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'long' })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                      r.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700' :
                      r.status === 'ABSENT' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {r.status === 'PRESENT' ? 'Présent' : r.status === 'ABSENT' ? 'Absent' : 'Retard'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{r.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <CalendarCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucune donnée d'assiduité ce mois-ci.</p>
        </div>
      )}
    </div>
  );
}
