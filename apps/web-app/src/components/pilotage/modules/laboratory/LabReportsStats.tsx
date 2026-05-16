/**
 * ============================================================================
 * LABORATORY REPORTS & STATS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  BarChart3, 
  FileText, 
  Download, 
  TrendingUp, 
  PieChart, 
  Calendar,
  Filter,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

export default function LabReportsStats() {
  const reports = [
    { title: 'Rapport d\'Occupation Mensuel', date: 'Avril 2026', type: 'UTILISATION', status: 'GÉNÉRÉ' },
    { title: 'Bilan Annuel des Équipements', date: 'Année 2025-2026', type: 'INVENTAIRE', status: 'GÉNÉRÉ' },
    { title: 'État de Consommation Réactifs', date: 'Trimestre 1', type: 'STOCK', status: 'EN COURS' },
    { title: 'Registre de Maintenance T2', date: 'Mai 2026', type: 'MAINTENANCE', status: 'GÉNÉRÉ' },
    { title: 'Rapport financier consommables', date: 'Mars 2026', type: 'FINANCE', status: 'GÉNÉRÉ' },
  ];

  return (
    <div className="space-y-8">
      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 flex items-center">
              <TrendingUp className="w-6 h-6 mr-3 text-blue-600" />
              Utilisation par Matière
            </h3>
            <button className="p-2.5 bg-slate-50 rounded-2xl text-slate-400 hover:text-blue-600 transition-all">
              <Filter className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-6">
            {[
              { label: 'Physique', val: 75, color: 'bg-blue-500' },
              { label: 'Chimie', val: 62, color: 'bg-emerald-500' },
              { label: 'SVT', val: 48, color: 'bg-amber-500' },
              { label: 'Technologie', val: 35, color: 'bg-indigo-500' },
              { label: 'Informatique', val: 92, color: 'bg-slate-900' },
            ].map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase tracking-tighter">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="text-slate-900">{item.val}h / mois</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${item.val}%` }}
                    className={`h-full ${item.color}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 flex items-center">
              <PieChart className="w-6 h-6 mr-3 text-emerald-600" />
              État Global du Parc
            </h3>
          </div>
          <div className="flex-1 flex items-center justify-center relative">
            <div className="w-48 h-48 rounded-full border-[16px] border-emerald-500 border-l-amber-500 border-b-rose-500 relative flex items-center justify-center">
              <div className="text-center">
                <p className="text-3xl font-black text-slate-900">142</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
              </div>
            </div>
            <div className="absolute right-0 space-y-4">
              {[
                { label: 'Opérationnel', color: 'bg-emerald-500' },
                { label: 'Maintenance', color: 'bg-amber-500' },
                { label: 'Hors Service', color: 'bg-rose-500' },
              ].map((dot, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${dot.color}`} />
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter">{dot.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Documents & Exports</h3>
          <button className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all">
            <FileText className="w-4 h-4 text-[#C9A84C]" />
            <span>Nouveau Rapport</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map((rep, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group flex items-start justify-between"
            >
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:bg-blue-50 group-hover:text-blue-600 transition-all w-fit">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 mb-1">{rep.title}</h4>
                  <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest gap-3">
                    <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> {rep.date}</span>
                    <span className="flex items-center"><CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> {rep.status}</span>
                  </div>
                </div>
              </div>
              <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-300 hover:text-blue-600">
                <Download className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
