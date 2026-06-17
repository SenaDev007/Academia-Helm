/**
 * ============================================================================
 * LABORATORY RESERVATIONS
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Calendar, Clock, Beaker, CheckCircle2, XCircle, Clock4, Plus, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface ReservationItem {
  id?: string;
  teacher?: string;
  teacherName?: string;
  class?: string;
  className?: string;
  subject?: string;
  lab?: string;
  labName?: string;
  date?: string;
  reservationDate?: string;
  scheduledAt?: string;
  time?: string;
  timeSlot?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
}

export default function LabReservations() {
  const { academicYear } = useModuleContext();
  // Les réservations sont stockées comme des sessions (cf. endpoints : POST labs/:id/reservations)
  const { data: reservations, loading, error, refetch } = useModulesList<ReservationItem>(
    'labs',
    'sessions',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reservationForm, setReservationForm] = useState({ labId: '', date: '', startTime: '', endTime: '', purpose: '' });

  const handleCreateReservation = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(`labs/${reservationForm.labId}/reservations`, reservationForm, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setReservationForm({ labId: '', date: '', startTime: '', endTime: '', purpose: '' });
      await refetch();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création de la réservation');
    } finally {
      setSubmitting(false);
    }
  };

  const safeReservations = reservations ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des réservations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les réservations. {error}
        </div>
      )}

      {/* Header & New Reservation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <Calendar className="w-6 h-6 mr-3 text-blue-600" />
            Planning des Réservations
          </h3>
          <p className="text-slate-500 text-sm font-medium">Gérez l'occupation des espaces spécialisés.</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-sm hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle Réservation</span>
          </button>
        </div>
      </div>

      {safeReservations.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucune réservation de laboratoire pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {safeReservations.map((res: any, i: number) => {
            const id = res?.id ?? `RES-${i}`;
            const teacher = res?.teacher ?? res?.teacherName ?? '—';
            const cls = res?.class ?? res?.className ?? '—';
            const subject = res?.subject ?? '—';
            const lab = res?.lab ?? res?.labName ?? '—';
            const date = res?.date ?? res?.reservationDate ?? (res?.scheduledAt ? new Date(res.scheduledAt).toLocaleDateString('fr-FR') : '—');
            const time = res?.time ?? res?.timeSlot ?? (res?.startTime && res?.endTime ? `${res.startTime} - ${res.endTime}` : '—');
            const status = (res?.status ?? 'PENDING').toString().toUpperCase();
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center justify-between gap-6"
              >
                <div className="flex items-center gap-6 flex-1">
                  <div className="p-4 bg-slate-50 rounded-2xl text-slate-400">
                    <Beaker className="w-8 h-8" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8 flex-1">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Enseignant & Classe</p>
                      <p className="font-black text-slate-900">{teacher}</p>
                      <p className="text-xs font-bold text-blue-600">{cls}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Matière & Lab</p>
                      <p className="font-bold text-slate-700">{subject}</p>
                      <p className="text-xs font-medium text-slate-500">{lab}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date & Horaire</p>
                      <p className="font-bold text-slate-700 flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        {date}
                      </p>
                      <p className="text-xs font-medium text-slate-500 flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                        {time}
                      </p>
                    </div>
                    <div className="flex items-center">
                      {status === 'VALIDATED' ? (
                        <div className="flex items-center text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                          Validé
                        </div>
                      ) : status === 'PENDING' ? (
                        <div className="flex items-center text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                          <Clock4 className="w-3.5 h-3.5 mr-2" />
                          En Attente
                        </div>
                      ) : (
                        <div className="flex items-center text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                          <Clock4 className="w-3.5 h-3.5 mr-2" />
                          Soumis
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="p-3 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 text-slate-400 rounded-2xl transition-all" title="Valider">
                    <CheckCircle2 className="w-5 h-5" />
                  </button>
                  <button className="p-3 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-2xl transition-all" title="Rejeter">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Reservation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Nouvelle Réservation</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ID Laboratoire</label>
                <input type="text" value={reservationForm.labId} onChange={(e) => setReservationForm({ ...reservationForm, labId: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
                <input type="date" value={reservationForm.date} onChange={(e) => setReservationForm({ ...reservationForm, date: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Heure début</label>
                  <input type="time" value={reservationForm.startTime} onChange={(e) => setReservationForm({ ...reservationForm, startTime: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Heure fin</label>
                  <input type="time" value={reservationForm.endTime} onChange={(e) => setReservationForm({ ...reservationForm, endTime: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Objet</label>
                <textarea value={reservationForm.purpose} onChange={(e) => setReservationForm({ ...reservationForm, purpose: e.target.value })} className="w-full px-4 py-2 bg-gray-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 h-20" />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold">Annuler</button>
              <button onClick={handleCreateReservation} disabled={submitting} className="px-4 py-2 bg-navy-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {submitting ? 'Envoi...' : 'Réserver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
