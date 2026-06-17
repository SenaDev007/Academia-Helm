/**
 * ============================================================================
 * EDUCAST REPORTS
 * ============================================================================
 * TODO: endpoint non disponible — `educast/dashboard` n'existe pas encore côté backend.
 *       Les rapports utilisent des données mockées. Quand l'endpoint sera disponible,
 *       remplacer par : const { data, loading, error } = useModulesDashboard('educast', academicYear?.id);
 */

'use client';

import { motion } from 'framer-motion';
import { FileText, Download, Printer, Share2, Calendar, Filter, Plus, PieChart, BarChart } from 'lucide-react';

export default function EduCastReports() {
  const reports = [
    { title: 'Rapport d\'Engagement Mensuel - Mai 2026', type: 'GLOBAL', date: '15/05/2026', size: '2.4 MB' },
    { title: 'Statistiques de consultation par Classe', type: 'CLASSE', date: '12/05/2026', size: '1.1 MB' },
    { title: 'Audit Modération et Signalements', type: 'MODÉRATION', date: '10/05/2026', size: '850 KB' },
    { title: 'Performance des contenus Enseignants', type: 'TEACHER', date: '01/05/2026', size: '3.2 MB' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
          <FileText className="w-6 h-6 mr-3 text-blue-600" />
          Rapports EduCast
        </h3>
        <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-navy-900/10">
          <Printer className="w-4 h-4 text-[#C9A84C]" />
          <span>Générer Rapport</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 group hover:border-blue-200 transition-all cursor-pointer">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
            <PieChart className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-lg font-black text-slate-900">Résumé Analytique</h4>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Générer un PDF complet des KPIs</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 group hover:border-emerald-200 transition-all cursor-pointer">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
            <BarChart className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-lg font-black text-slate-900">Export de Données</h4>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Télécharger les vues au format Excel/CSV</p>
          </div>
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
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
