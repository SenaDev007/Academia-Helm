/**
 * ============================================================================
 * QHSE REPORTS & ANALYTICS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Download, FileText, BarChart3, PieChart, Calendar, ChevronRight, Share2, Printer, Search } from 'lucide-react';

export default function QHSEReports() {
  const reports = [
    { id: 1, title: 'Rapport Mensuel QHSE - Avril 2026', type: 'MENSUEL', date: '01/05/2026', author: 'Responsable QHSE', size: '4.5 MB' },
    { id: 2, title: 'Bilan Annuel Sécurité Scolaire', type: 'ANNUEL', date: '10/01/2026', author: 'Direction Générale', size: '12.8 MB' },
    { id: 3, title: 'Analyse des Risques - 2ème Trimestre', type: 'TRIMESTRIEL', date: '15/04/2026', author: 'Comité Sécurité', size: '3.2 MB' },
    { id: 4, title: 'Rapport d\'Audit Hygiène Cantine', type: 'INSPECTION', date: '15/05/2026', author: 'Dr. Saliou', size: '1.5 MB' },
  ];

  return (
    <div className="space-y-10">
      {/* Analytics Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Répartition Incidents</h4>
            <PieChart className="w-5 h-5 text-slate-400" />
          </div>
          <div className="aspect-square flex items-center justify-center relative">
             <div className="w-full h-full rounded-full border-[1.5rem] border-emerald-500 border-t-rose-500 border-r-amber-400 opacity-20" />
             <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-black text-slate-900 tracking-tighter">84</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total An</p>
             </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500" /> Sécurité (45%)</span>
               <span className="text-slate-900">38</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-400" /> Hygiène (30%)</span>
               <span className="text-slate-900">25</span>
            </div>
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
               <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Environnement (25%)</span>
               <span className="text-slate-900">21</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Générateur de Rapports</h3>
            <div className="flex items-center gap-2">
               <button className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400">
                <Printer className="w-5 h-5" />
              </button>
              <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest">
                Nouveau Rapport
              </button>
            </div>
          </div>
          
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
             {reports.map((report, i) => (
               <div key={report.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 group cursor-pointer">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-50 text-slate-400 rounded-xl group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                       <p className="font-black text-slate-900 leading-tight">{report.title}</p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Par {report.author} • {report.size}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-6">
                    <div className="text-right hidden md:block">
                       <p className="text-xs font-black text-slate-900">{report.type}</p>
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{report.date}</p>
                    </div>
                    <button className="p-3 bg-slate-50 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                       <Download className="w-5 h-5" />
                    </button>
                 </div>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}
