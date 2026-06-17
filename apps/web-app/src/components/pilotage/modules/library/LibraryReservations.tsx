/**
 * ============================================================================
 * LIBRARY RESERVATIONS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint : GET /modules-complementaires/library/reservations?academicYearId=...
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Calendar, Clock, Book, XCircle, Timer, MoreVertical, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface ReservationItem {
  id: string;
  reader?: string;
  readerName?: string;
  student?: string;
  user?: string;
  book?: string;
  bookTitle?: string;
  title?: string;
  date?: string;
  reservedAt?: string;
  expires?: string;
  expiresAt?: string;
  expiryDate?: string;
  status?: string;
  priority?: string;
  [key: string]: any;
}

export default function LibraryReservations() {
  const { academicYear } = useModuleContext();
  const { data: reservations, loading, error } = useModulesList<ReservationItem>(
    'library',
    'reservations',
    academicYear?.id,
  );

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
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <Timer className="w-6 h-6 mr-3 text-blue-600" />
            File d'Attente des Réservations
          </h3>
          <p className="text-slate-500 text-sm font-medium">Gérez les priorités et les délais de retrait.</p>
        </div>
        <button className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/10">
          Nouvelle Réservation
        </button>
      </div>

      {reservations.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-3xl border border-slate-200">
          Aucune réservation pour cette année scolaire.
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reservations.map((res, i) => {
          const reader = res.reader ?? res.readerName ?? res.student ?? res.user ?? '—';
          const bookTitle = res.book ?? res.bookTitle ?? res.title ?? '—';
          const date = res.date ?? res.reservedAt ?? '—';
          const expires = res.expires ?? res.expiresAt ?? res.expiryDate ?? '—';
          const status = (res.status ?? 'WAITING').toString().toUpperCase();
          const priority = (res.priority ?? 'NORMALE').toString().toUpperCase();
          return (
          <motion.div
            key={res.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group ${
              status === 'AVAILABLE' ? 'border-emerald-200' : ''
            }`}
          >
            {status === 'AVAILABLE' && (
              <div className="absolute top-0 right-0 p-4">
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </div>
            )}

            <div className="space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                    priority === 'HAUTE' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'
                  }`}> Priorité {priority}</span>
                  <h4 className="text-lg font-black text-slate-900 mt-2 leading-tight">{reader}</h4>
                </div>
                <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                  <MoreVertical className="w-5 h-5 text-slate-300" />
                </button>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4">
                <div className="p-2.5 bg-white rounded-xl shadow-sm text-slate-400">
                  <Book className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-900 truncate">{bookTitle}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {res.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Réservé le</p>
                  <p className="text-xs font-black text-slate-700 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-2 text-slate-300" />
                    {date}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Expire le</p>
                  <p className={`text-xs font-black flex items-center ${status === 'EXPIRED' ? 'text-rose-600' : 'text-slate-700'}`}>
                    <Clock className="w-3.5 h-3.5 mr-2 text-slate-300" />
                    {expires}
                  </p>
                </div>
              </div>

              <div className="pt-4 flex items-center gap-3">
                {status === 'AVAILABLE' ? (
                  <button className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20">
                    Prêt pour retrait
                  </button>
                ) : status === 'WAITING' ? (
                  <div className="flex-1 py-2.5 bg-blue-50 text-blue-600 text-center rounded-xl text-[10px] font-black uppercase tracking-widest">
                    En attente de retour
                  </div>
                ) : (
                  <div className="flex-1 py-2.5 bg-slate-100 text-slate-400 text-center rounded-xl text-[10px] font-black uppercase tracking-widest">
                    Réservation expirée
                  </div>
                )}
                <button className="p-2.5 bg-slate-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
          );
        })}
      </div>
      )}
    </div>
  );
}
