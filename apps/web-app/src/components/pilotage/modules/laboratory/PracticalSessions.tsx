/**
 * ============================================================================
 * PRACTICAL SESSIONS (SÉANCES PRATIQUES)
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, GraduationCap, Search, FileText, Users, Plus, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface SessionItem {
  id?: string;
  theme?: string;
  title?: string;
  subject?: string;
  teacher?: string;
  teacherName?: string;
  date?: string;
  sessionDate?: string;
  scheduledAt?: string;
  students?: number;
  studentCount?: number;
  attendees?: number;
  status?: string;
}

export default function PracticalSessions() {
  const { academicYear } = useModuleContext();
  const { data: sessions, loading, error, refetch } = useModulesList<SessionItem>(
    'labs',
    'sessions',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionForm, setSessionForm] = useState({ labId: '', subject: '', date: '', duration: 0, studentCount: 0 });

  const handleCreateSession = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('labs/sessions', sessionForm, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setSessionForm({ labId: '', subject: '', date: '', duration: 0, studentCount: 0 });
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création de la séance');
    } finally {
      setSubmitting(false);
    }
  };

  const safeSessions = sessions ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des séances...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les séances. {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Historique des Travaux Pratiques</h3>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Rechercher..." className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none" />
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-[#C9A84C] text-white rounded-xl font-bold text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Enregistrer Séance</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Séance</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Enseignant</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Élèves</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Rapport</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {safeSessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-16 text-center text-gray-500">
                  Aucune séance enregistrée pour cette année scolaire.
                </td>
              </tr>
            ) : (
              safeSessions.map((ses: any, i: number) => {
                const theme = ses?.theme ?? ses?.title ?? `Séance #${i + 1}`;
                const subject = ses?.subject ?? '—';
                const teacher = ses?.teacher ?? ses?.teacherName ?? '—';
                const date = ses?.date ?? ses?.sessionDate ?? (ses?.scheduledAt ? new Date(ses.scheduledAt).toLocaleDateString('fr-FR') : '—');
                const students = ses?.students ?? ses?.studentCount ?? ses?.attendees ?? 0;
                const id = ses?.id ?? `SES-${i}`;
                return (
                  <motion.tr
                    key={id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-slate-100 rounded-xl">
                          <GraduationCap className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900">{theme}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{subject} • {id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-slate-600">{teacher}</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center text-sm font-bold text-slate-600">
                        <Users className="w-4 h-4 mr-2 text-slate-300" />
                        {students} Présents
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-slate-500">{date}</td>
                    <td className="px-8 py-5 text-right">
                      <button className="inline-flex items-center px-4 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                        <FileText className="w-3.5 h-3.5 mr-2" />
                        Voir Rapport
                      </button>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Session Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Nouvelle Séance</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ID Laboratoire</label>
                <input type="text" value={sessionForm.labId} onChange={(e) => setSessionForm({ ...sessionForm, labId: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Matière</label>
                <input type="text" value={sessionForm.subject} onChange={(e) => setSessionForm({ ...sessionForm, subject: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
                <input type="date" value={sessionForm.date} onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Durée (min)</label>
                  <input type="number" value={sessionForm.duration} onChange={(e) => setSessionForm({ ...sessionForm, duration: Number(e.target.value) })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Élèves</label>
                  <input type="number" value={sessionForm.studentCount} onChange={(e) => setSessionForm({ ...sessionForm, studentCount: Number(e.target.value) })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold">Annuler</button>
              <button onClick={handleCreateSession} disabled={submitting} className="px-4 py-2 bg-[#C9A84C] text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {submitting ? 'Envoi...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
