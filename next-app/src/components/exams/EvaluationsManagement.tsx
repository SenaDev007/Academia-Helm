/**
 * EvaluationsManagement Component
 * 
 * ONGLET 3 — Gestion des Évaluations
 * Création et gestion des devoirs, compositions, examens blancs, oraux.
 */

'use client';

import { useState } from 'react';
import { Plus, Search, Filter, MoreHorizontal, BookOpen, Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import EntitySyncIndicator from '@/components/offline/EntitySyncIndicator';
import { useEntitySyncStatusBatch } from '@/hooks/useEntitySyncStatus';

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT:            { label: 'Brouillon',  color: 'bg-slate-100 text-slate-500' },
  PLANNED:          { label: 'Planifié',   color: 'bg-blue-50 text-blue-600' },
  OPEN_FOR_GRADING: { label: 'En saisie',  color: 'bg-amber-50 text-amber-600' },
  VALIDATED:        { label: 'Validé',     color: 'bg-emerald-50 text-emerald-600' },
  LOCKED:           { label: 'Verrouillé', color: 'bg-rose-50 text-rose-600' },
};

export default function EvaluationsManagement() {
  const syncStatuses = useEntitySyncStatusBatch('EXAM');
  const [evaluations] = useState([
    { id: 'EVL-001', title: 'Devoir n°3', class: 'Terminale C', subject: 'Mathématiques', type: 'Devoir', date: '14 Mai 2026', scale: '/20', status: 'OPEN_FOR_GRADING', teacher: 'M. Kouassi' },
    { id: 'EVL-002', title: 'Composition Trimestre 2', class: 'Terminale C', subject: 'Physique', type: 'Composition', date: '20 Mai 2026', scale: '/20', status: 'PLANNED', teacher: 'Mme. Traoré' },
    { id: 'EVL-003', title: 'Interrogation Surprise', class: '3ème A', subject: 'Français', type: 'Interrogation', date: '12 Mai 2026', scale: '/20', status: 'VALIDATED', teacher: 'M. Diallo' },
    { id: 'EVL-004', title: 'Examen Blanc BAC', class: 'Terminale C', subject: 'Toutes matières', type: 'Examen Blanc', date: '01 Juin 2026', scale: '/20', status: 'DRAFT', teacher: 'Direction' },
  ]);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input placeholder="Rechercher une évaluation..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all" />
          </div>
          <select className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 outline-none focus:ring-2 focus:ring-emerald-500/20">
            <option>Tous types</option>
            <option>Devoir</option>
            <option>Composition</option>
            <option>Examen Blanc</option>
          </select>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/10">
          <Plus className="w-4 h-4" /> Créer Évaluation
        </button>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'En saisie', count: 3, color: 'border-l-amber-500' },
          { label: 'En attente validation', count: 7, color: 'border-l-blue-500' },
          { label: 'Validées', count: 24, color: 'border-l-emerald-500' },
          { label: 'Verrouillées', count: 18, color: 'border-l-rose-500' },
        ].map((s, i) => (
          <div key={i} className={cn("bg-white p-5 rounded-2xl border border-slate-200 border-l-4 shadow-sm", s.color)}>
            <p className="text-2xl font-black text-slate-900">{s.count}</p>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Liste des Évaluations</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Évaluation</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Matière / Classe</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Sync</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {evaluations.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900">{ev.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{ev.teacher}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-700">{ev.subject}</p>
                    <p className="text-[10px] text-slate-400">{ev.class}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">{ev.type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-slate-400" /> {ev.date}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black", statusConfig[ev.status]?.color)}>
                      {statusConfig[ev.status]?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <EntitySyncIndicator variant="dot" status={syncStatuses[ev.id] ?? 'UNKNOWN'} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-slate-100 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                      <MoreHorizontal className="w-4 h-4 text-slate-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
