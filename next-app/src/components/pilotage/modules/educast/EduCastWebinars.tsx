/**
 * ============================================================================
 * EDUCAST WEBINAIRES & DIRECTS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Globe, Calendar, Clock, Users, Video, Link as LinkIcon, Plus, ChevronRight, MonitorPlay } from 'lucide-react';

export default function EduCastWebinars() {
  const webinars = [
    { id: 1, title: 'Orientation Post-BAC : Écoles d\'ingénieurs', presenter: 'M. Saliou', date: '20/05/2026', time: '18:00', duration: 90, audience: 'Terminale', status: 'PLANNED' },
    { id: 2, title: 'Réunion Parents : Nouveautés Orion 2026', presenter: 'Directeur', date: '22/05/2026', time: '17:00', duration: 60, audience: 'Tous Parents', status: 'PLANNED' },
    { id: 3, title: 'Formation : Pédagogie Différenciée', presenter: 'Responsable Pédagogique', date: '25/05/2026', time: '14:00', duration: 120, audience: 'Enseignants', status: 'PLANNED' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <Globe className="w-6 h-6 mr-3 text-emerald-600" />
            Webinaires & Directs
          </h3>
          <p className="text-slate-500 text-sm font-medium">Planifiez et diffusez vos événements en temps réel.</p>
        </div>
        <button className="px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10 hover:bg-navy-800 transition-all">
          Nouvelle Session
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {webinars.map((webinar, i) => (
          <motion.div
            key={webinar.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-3xl border border-slate-200 p-8 flex flex-col lg:flex-row items-center justify-between gap-8 hover:shadow-xl transition-all group"
          >
            <div className="flex items-center gap-8 flex-1">
              <div className="p-5 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <MonitorPlay className="w-10 h-10" />
              </div>
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase tracking-widest rounded-md">PROCHAINEMENT</span>
                  <h4 className="text-2xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{webinar.title}</h4>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-tighter">{webinar.audience}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-tighter">{webinar.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-tighter">{webinar.time} ({webinar.duration} min)</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <div className="w-5 h-5 rounded-full bg-slate-100" />
                    <span className="text-xs font-bold uppercase tracking-tighter">{webinar.presenter}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-[200px]">
              <button className="w-full py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all shadow-lg">
                S'inscrire
              </button>
              <button className="w-full py-3 bg-slate-50 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">
                Détails
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
