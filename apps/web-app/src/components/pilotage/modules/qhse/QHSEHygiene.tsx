/**
 * ============================================================================
 * QHSE HYGIENE & SALUBRITE
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Droplets, CheckCircle2, AlertCircle, Trash2, Wind, Utensils, Home, MapPin, Plus, ListChecks } from 'lucide-react';

export default function QHSEHygiene() {
  const inspections = [
    { id: 1, zone: 'Cantine Scolaire', status: 'CONFORME', score: 95, lastAudit: '15/05/2026', inspector: 'Dr. Saliou', icon: Utensils, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 2, zone: 'Sanitaires Bloc A', status: 'NON_CONFORME', score: 65, lastAudit: '15/05/2026', inspector: 'M. Diallo', icon: Droplets, color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 3, zone: 'Dortoirs Garçons', status: 'CONFORME', score: 88, lastAudit: '14/05/2026', inspector: 'Dr. Saliou', icon: Home, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 4, zone: 'Salles de classe (1er)', status: 'CONFORME', score: 92, lastAudit: '14/05/2026', inspector: 'Mme Koffi', icon: ListChecks, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="space-y-8">
      {/* Hygiene Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Global</p>
            <p className="text-2xl font-black text-slate-900 tracking-tighter">87.5%</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Non-conformités</p>
            <p className="text-2xl font-black text-slate-900 tracking-tighter">03</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
            <Wind className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inspections ce mois</p>
            <p className="text-2xl font-black text-slate-900 tracking-tighter">24</p>
          </div>
        </div>
      </div>

      {/* Zone Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {inspections.map((inspection, i) => (
          <motion.div
            key={inspection.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm group hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${inspection.bg} ${inspection.color} group-hover:scale-110 transition-transform`}>
                  <inspection.icon className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 uppercase tracking-tight">{inspection.zone}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest">
                      <MapPin className="w-3 h-3" /> {inspection.lastAudit}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-widest border-l border-slate-100 pl-3">
                      Par {inspection.inspector}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xl font-black tracking-tighter mb-1 ${
                  inspection.score >= 90 ? 'text-emerald-600' : inspection.score >= 70 ? 'text-amber-600' : 'text-rose-600'
                }`}>
                  {inspection.score}%
                </div>
                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                  inspection.status === 'CONFORME' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                }`}>
                  {inspection.status === 'CONFORME' ? 'Conforme' : 'Alerte'}
                </span>
              </div>
            </div>
            
            <div className="mt-6 flex items-center gap-2">
              <button className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                Détails du contrôle
              </button>
              <button className="px-4 py-3 bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white rounded-xl transition-all">
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
