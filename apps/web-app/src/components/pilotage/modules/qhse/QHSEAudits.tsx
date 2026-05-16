/**
 * ============================================================================
 * QHSE AUDITS & INSPECTIONS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { ClipboardList, Calendar, User, Star, ArrowUpRight, CheckCircle2, Search, Filter, Plus, ChevronRight } from 'lucide-react';

export default function QHSEAudits() {
  const audits = [
    { id: 'AUD-2026-001', title: 'Audit Annuel Sécurité Incendie', type: 'SÉCURITÉ', date: '15/05/2026', auditor: 'Bureau Veritas', score: 94, status: 'TERMINE' },
    { id: 'AUD-2026-002', title: 'Inspection Hygiène Cantine', type: 'HYGIÈNE', date: '14/05/2026', auditor: 'Dr. Saliou', score: 88, status: 'EN_COURS' },
    { id: 'AUD-2026-003', title: 'Contrôle Conformité Labos', type: 'CONFORMITÉ', date: '20/05/2026', auditor: 'Direction Académique', score: null, status: 'PLANIFIE' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <ClipboardList className="w-6 h-6 mr-3 text-blue-600" /> Registre des Audits
          </h3>
          <p className="text-slate-500 text-sm font-medium">Planification et suivi des inspections réglementaires et internes.</p>
        </div>
        <button className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Planifier un Audit
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
              <th className="px-8 py-5">Audit / ID</th>
              <th className="px-8 py-5">Auditeur</th>
              <th className="px-8 py-5">Date</th>
              <th className="px-8 py-5">Score</th>
              <th className="px-8 py-5 text-right">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {audits.map((audit, i) => (
              <motion.tr
                key={audit.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
              >
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900">{audit.title}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{audit.type} • {audit.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5 text-xs font-black text-slate-700 uppercase">{audit.auditor}</td>
                <td className="px-8 py-5 text-xs font-bold text-slate-500 font-mono uppercase">{audit.date}</td>
                <td className="px-8 py-5">
                  {audit.score ? (
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-black text-slate-900">{audit.score}%</div>
                      <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${audit.score}%` }} />
                      </div>
                    </div>
                  ) : <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">En attente</span>}
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                      audit.status === 'TERMINE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                      audit.status === 'EN_COURS' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}>
                      {audit.status.replace('_', ' ')}
                    </span>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-all group-hover:translate-x-1" />
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
