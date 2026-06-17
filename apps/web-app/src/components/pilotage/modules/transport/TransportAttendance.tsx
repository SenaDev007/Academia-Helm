'use client';

import { useState } from 'react';
import { Users, CheckCircle2, XCircle, Clock, Search, Filter, Calendar, Loader2, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

// TODO: endpoint non disponible — garder mock
// Le backend expose uniquement POST transport/attendances (pas de GET).
// Les présences restent en données statiques en attendant un endpoint de lecture.

const EMPTY_FORM = { studentId: '', tripId: '', status: 'PRESENT' };

export default function TransportAttendance() {
  const { academicYear } = useModuleContext();

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ studentId: string; tripId: string; status: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<{ name: string; status: string; time: string } | null>(null);

  const attendance = [
    { id: '1', name: 'Fatou Sow', route: 'Circuit Nord', stop: 'Rond-point Central', status: 'PRESENT', time: '07:15' },
    { id: '2', name: 'Abdoulaye Diallo', route: 'Circuit Est', stop: 'Pharmacie du Marché', status: 'ABSENT', time: '—' },
    { id: '3', name: 'Mariama Ba', route: 'Circuit Nord', stop: 'Rond-point Central', status: 'PRESENT', time: '07:12' },
  ];

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('transport/attendances', formData, buildModulesApiOptions(academicYear?.id));
      setLastSubmission({
        name: `Élève ${formData.studentId}`,
        status: formData.status,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      });
      setModalOpen(false);
      setFormData(EMPTY_FORM);
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Erreur lors de l\'enregistrement de la présence');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
          <Calendar className="w-5 h-5 text-navy-900" />
          <p className="font-black text-slate-900 uppercase tracking-tighter text-sm">Vendredi 15 Mai 2026</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all">
            <Filter className="w-4 h-4" /> Filtres
          </button>
          <button
            onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}
            className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all"
          >
            <Users className="w-4 h-4" /> Marquer Présence
          </button>
        </div>
      </div>

      {lastSubmission && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
          ✓ Présence enregistrée : <strong>{lastSubmission.name}</strong> — {lastSubmission.status} à {lastSubmission.time}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Itinéraire / Arrêt</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Heure de montée</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendance.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs">
                        {entry.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <p className="font-black text-slate-900 text-sm tracking-tight uppercase">{entry.name}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-bold text-slate-700">{entry.route}</p>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">{entry.stop}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-slate-300" />
                      <span className="text-sm font-black text-slate-900">{entry.time}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit ${
                      entry.status === 'PRESENT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {entry.status === 'PRESENT' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="text-xs font-black text-navy-900 uppercase tracking-widest hover:underline">Détails</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Marquer une présence</h3>
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
                <label className="text-xs font-bold text-slate-500 uppercase">Trip ID</label>
                <input
                  type="text"
                  value={formData.tripId}
                  onChange={(e) => setFormData({ ...formData, tripId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="trip-001"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Statut</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="PRESENT">Présent</option>
                  <option value="ABSENT">Absent</option>
                  <option value="LATE">En retard</option>
                  <option value="EXCUSED">Excusé</option>
                </select>
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
                {submitting ? 'Envoi...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
