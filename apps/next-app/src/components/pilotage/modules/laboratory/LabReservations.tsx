/**
 * ============================================================================
 * LABORATORY RESERVATIONS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  User, 
  BookOpen, 
  Beaker, 
  CheckCircle2, 
  XCircle,
  Clock4,
  Plus,
  Filter
} from 'lucide-react';

export default function LabReservations() {
  const reservations = [
    { id: 'RES-001', teacher: 'M. Saliou', class: 'Terminal D', subject: 'Physique', lab: 'Lab Physique', date: '20/05/2026', time: '08:00 - 10:00', status: 'VALIDATED' },
    { id: 'RES-002', teacher: 'Mme. Koffi', class: '3ème B', subject: 'Chimie', lab: 'Lab Chimie', date: '21/05/2026', time: '10:00 - 12:00', status: 'PENDING' },
    { id: 'RES-003', teacher: 'M. Lawson', class: '6ème A', subject: 'SVT', lab: 'Lab SVT', date: '22/05/2026', time: '14:00 - 16:00', status: 'SUBMITTED' },
  ];

  return (
    <div className="space-y-6">
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
          <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-sm hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20">
            <Plus className="w-4 h-4" />
            <span>Nouvelle Réservation</span>
          </button>
        </div>
      </div>

      {/* Reservation List */}
      <div className="grid grid-cols-1 gap-4">
        {reservations.map((res, i) => (
          <motion.div
            key={res.id}
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
                  <p className="font-black text-slate-900">{res.teacher}</p>
                  <p className="text-xs font-bold text-blue-600">{res.class}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Matière & Lab</p>
                  <p className="font-bold text-slate-700">{res.subject}</p>
                  <p className="text-xs font-medium text-slate-500">{res.lab}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date & Horaire</p>
                  <p className="font-bold text-slate-700 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                    {res.date}
                  </p>
                  <p className="text-xs font-medium text-slate-500 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                    {res.time}
                  </p>
                </div>
                <div className="flex items-center">
                  {res.status === 'VALIDATED' ? (
                    <div className="flex items-center text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                      Validé
                    </div>
                  ) : res.status === 'PENDING' ? (
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
              <button className="p-3 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-400 rounded-2xl transition-all">
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
