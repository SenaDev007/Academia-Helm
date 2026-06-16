/**
 * ============================================================================
 * LIBRARY REPORTS & STATS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { BarChart3, PieChart, FileText, Download, Calendar, Printer, Share2, TrendingUp, Filter } from 'lucide-react';

export default function LibraryReports() {
  const reports = [
    { title: 'Rapport Annuel de Fréquentation', type: 'COMPLET', date: '01/01/2026', size: '2.4 MB', author: 'Logiciel System' },
    { title: 'Analyse des Retards et Pénalités', type: 'FINANCE', date: '12/05/2026', size: '1.1 MB', author: 'Sarah AI' },
    { title: 'Inventaire Physique - Section Littérature', type: 'INVENTAIRE', date: '10/05/2026', size: '850 KB', author: 'Admin' },
  ];

  return (
    <div className="space-y-8">
      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taux de Rotation</h4>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-4xl font-black text-slate-900 mb-2">68%</div>
          <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-lg">+12% vs mois dernier</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Temps Moyen Emprunt</h4>
            <Calendar className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-4xl font-black text-slate-900 mb-2">9.2 Jours</div>
          <p className="text-[10px] font-bold text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded-lg">Dans les limites (14j)</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recettes Pénalités</h4>
            <FileText className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-4xl font-black text-slate-900 mb-2">42 500 F CFA</div>
          <p className="text-[10px] font-bold text-slate-400 bg-slate-50 w-fit px-2 py-0.5 rounded-lg">Mois en cours</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
          <BarChart3 className="w-6 h-6 mr-3 text-blue-600" />
          Rapports Générés
        </h3>
        <div className="flex gap-2">
          <button className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400">
            <Filter className="w-5 h-5" />
          </button>
          <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/10">
            <Printer className="w-4 h-4 text-[#C9A84C]" />
            <span>Nouveau Rapport</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {reports.map((report, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-xl transition-all group"
          >
            <div className="flex items-center gap-6 flex-1">
              <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">
                <FileText className="w-8 h-8 text-slate-400 group-hover:text-blue-600" />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{report.title}</h4>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{report.type}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">• {report.date}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">• {report.size}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-3 bg-slate-50 hover:bg-navy-900 hover:text-white rounded-xl text-slate-400 transition-all shadow-sm">
                <Download className="w-5 h-5" />
              </button>
              <button className="p-3 bg-slate-50 hover:bg-navy-900 hover:text-white rounded-xl text-slate-400 transition-all shadow-sm">
                <Printer className="w-5 h-5" />
              </button>
              <button className="p-3 bg-slate-50 hover:bg-navy-900 hover:text-white rounded-xl text-slate-400 transition-all shadow-sm">
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
