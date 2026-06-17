'use client';

import { useState } from 'react';
import { Users, Plus, Search, MapPin, Bus, CreditCard, MoreVertical, Loader2, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface AssignmentItem {
  id: string;
  student?: string;
  studentName?: string;
  studentId?: string;
  class?: string;
  className?: string;
  route?: string;
  routeName?: string;
  routeId?: string;
  stop?: string;
  stopName?: string;
  stopId?: string;
  payment?: string;
  paymentStatus?: string;
  status?: string;
  assignmentStatus?: string;
  [key: string]: any;
}

const EMPTY_FORM = { studentId: '', routeId: '', stopId: '' };

export default function TransportStudents() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<AssignmentItem>('transport', 'assignments', academicYear?.id);

  const students = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ studentId: string; routeId: string; stopId: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('transport/assignments', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de l\'affectation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher un élève..." 
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-100 focus:outline-none focus:ring-2 focus:ring-navy-900/5 transition-all text-sm font-medium"
          />
        </div>
        <button
          onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}
          className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all"
        >
          <Plus className="w-4 h-4" />
          Affecter un Élève
        </button>
      </div>

      {students.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Itinéraire / Arrêt</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Abonnement</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Paiement</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => {
                  const name = student.student || student.studentName || `Élève ${student.id}`;
                  const className = student.class || student.className || '';
                  const route = student.route || student.routeName || '—';
                  const stop = student.stop || student.stopName || '—';
                  const payment = student.payment || student.paymentStatus || 'PENDING';
                  const status = student.status || student.assignmentStatus || 'ACTIVE';
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-navy-50 flex items-center justify-center text-navy-900 font-black text-xs">
                            {name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm tracking-tight uppercase">{name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{className}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Bus className="w-3 h-3 text-slate-400" /> {route}
                          </p>
                          <p className="text-[10px] font-medium text-slate-500 flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-slate-300" /> {stop}
                          </p>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-widest italic">Annuel (A/R)</span>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          payment === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {payment}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                          {status}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Affecter un élève</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Student ID</label>
                <input
                  type="text"
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="student-001"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Route ID</label>
                <input
                  type="text"
                  value={formData.routeId}
                  onChange={(e) => setFormData({ ...formData, routeId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="route-001"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Stop ID</label>
                <input
                  type="text"
                  value={formData.stopId}
                  onChange={(e) => setFormData({ ...formData, stopId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="stop-001"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-bold">
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-bold disabled:opacity-50"
              >
                {submitting ? 'Envoi...' : 'Affecter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
