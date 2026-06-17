/**
 * ============================================================================
 * CANTEEN ATTENDANCE — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint : GET /modules-complementaires/canteen/attendance?academicYearId=...
 * ============================================================================
 */

import React from 'react';
import {
  Search,
  Activity,
  AlertCircle,
  Scan, Tablet, Calendar, Clock, Loader2
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface AttendanceItem {
  id: string;
  student?: string;
  studentName?: string;
  class?: string;
  className?: string;
  time?: string;
  servedAt?: string;
  timestamp?: string;
  status?: string;
  type?: string;
  mealType?: string;
  note?: string;
  comment?: string;
  isSpecial?: boolean;
  [key: string]: any;
}

export default function CanteenAttendance() {
  const { academicYear } = useModuleContext();
  const { data: attendance, loading, error } = useModulesList<AttendanceItem>(
    'canteen',
    'attendance',
    academicYear?.id,
  );

  const total = attendance.length;
  const served = attendance.filter((a) => {
    const s = (a.status ?? '').toLowerCase();
    return s.includes('servi') || s.includes('served');
  }).length;
  const pending = attendance.filter((a) => {
    const s = (a.status ?? '').toLowerCase();
    return s.includes('attente') || s.includes('pending') || s.includes('non');
  }).length;
  const serviceRate = total > 0 ? Math.round((served / total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des présences...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Service Area */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-gray-50/50 to-white">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-navy-900 text-white rounded-2xl shadow-lg shadow-navy-900/20">
                <Scan className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-navy-900 text-xl tracking-tight">Pointage en Direct</h3>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                  <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">Service en cours</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="relative group">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Numéro de badge, QR, Nom..."
                  className="pl-11 pr-4 py-2.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-navy-500/20 w-64 transition-all"
                />
              </div>
              <button className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-gray-100 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-navy-600 transition-all shadow-sm">
                <Tablet className="w-4 h-4" />
                <span>Mode Tablette</span>
              </button>
            </div>
          </div>

          {attendance.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              Aucun pointage enregistré pour cette année scolaire.
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Élève</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Heure</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type de Repas</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {attendance.map((row) => (
                  <AttendanceRow
                    key={row.id}
                    student={row.student ?? row.studentName ?? '—'}
                    class={row.class ?? row.className ?? '—'}
                    time={row.time ?? row.servedAt ?? row.timestamp ?? '—'}
                    status={row.status ?? 'Non Servi'}
                    type={row.type ?? row.mealType ?? 'Standard'}
                    isSpecial={row.isSpecial}
                    note={row.note ?? row.comment}
                  />
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* Sidebar Statistics */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <h4 className="font-black text-navy-900 mb-6 flex items-center space-x-2">
              <Activity className="w-5 h-5 text-navy-400" />
              <span>Synthèse Direct</span>
            </h4>
            <div className="space-y-6">
              <ProgressStat label="Prévus" value={String(total)} total={total || 1} color="gray" />
              <ProgressStat label="Servis" value={String(served)} total={total || 1} color="emerald" />
              <ProgressStat label="En Attente" value={String(pending)} total={total || 1} color="amber" />
            </div>
            <div className="mt-8 pt-8 border-t border-gray-50">
              <div className="flex justify-between items-end mb-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Taux de Service</p>
                <p className="text-xl font-black text-emerald-600">{serviceRate}%</p>
              </div>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" style={{ width: `${serviceRate}%` }}></div>
              </div>
            </div>
          </div>

          <div className="bg-navy-900 rounded-3xl p-8 text-white shadow-xl">
            <h4 className="font-black mb-4 flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-navy-300" />
              <span>Planning</span>
            </h4>
            <p className="text-xs text-navy-200 leading-relaxed mb-6">Service de demain prévu à <span className="text-white font-bold">12:00</span> pour <span className="text-white font-bold">{total || '—'} élèves</span>.</p>
            <button className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Consulter l'historique</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AttendanceRow({ student, class: className, time, status, type, isSpecial, note }: any) {
  const statusColors: any = {
    'Servi': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Non Servi': 'bg-amber-50 text-amber-600 border-amber-100',
    'Refusé': 'bg-red-50 text-red-600 border-red-100',
  };
  const statusStyle = statusColors[status] ?? statusColors['Non Servi'];

  return (
    <tr className="group hover:bg-navy-50/30 transition-all duration-300">
      <td className="px-8 py-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center text-navy-600 font-black text-xs group-hover:bg-white transition-all shadow-sm">
            {typeof student === 'string' ? student.split(' ').map((n: string) => n[0]).join('') : '—'}
          </div>
          <div>
            <p className="text-sm font-black text-navy-900">{student}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{className}</p>
          </div>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center space-x-2">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-xs font-bold text-navy-900">{time}</p>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border w-fit ${statusStyle}`}>
          {status}
        </div>
        {note && <p className="text-[9px] text-red-400 font-bold mt-1 uppercase">{note}</p>}
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center space-x-2">
          <p className="text-xs font-bold text-navy-800">{type}</p>
          {isSpecial && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"></span>}
        </div>
      </td>
      <td className="px-8 py-6 text-right">
        <button className="p-2 text-gray-400 hover:text-navy-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100">
          <AlertCircle className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

function ProgressStat({ label, value, total, color }: any) {
  const barColors: any = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    gray: 'bg-gray-300',
  };
  const percentage = total > 0 ? (parseInt(value) / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
        <span className="text-gray-400">{label}</span>
        <span className="text-navy-900">{value}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColors[color]}`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}
