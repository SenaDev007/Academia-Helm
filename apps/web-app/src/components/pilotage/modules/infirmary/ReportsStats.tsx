/**
 * ============================================================================
 * REPORTS & STATS TAB
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Download, 
  FileJson, 
  FileText, 
  Filter,
  Calendar,
  Share2,
  Table as TableIcon
} from 'lucide-react';

export default function ReportsStats() {
  return (
    <div className="space-y-8">
      {/* Analytics Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center">
                <TrendingUp className="w-6 h-6 mr-3 text-blue-600" />
                Fréquentation de l'Infirmerie
              </h3>
              <p className="text-slate-500 text-sm font-medium">Évolution des passages sur les 6 derniers mois.</p>
            </div>
            <select className="bg-slate-50 border-none rounded-xl text-xs font-bold px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20">
              <option>Derniers 6 mois</option>
              <option>Année Scolaire</option>
            </select>
          </div>
          
          <div className="h-64 flex items-end justify-between px-4 space-x-4">
            {[
              { month: 'Jan', val: 45, color: 'bg-blue-200' },
              { month: 'Fév', val: 52, color: 'bg-blue-300' },
              { month: 'Mar', val: 38, color: 'bg-blue-400' },
              { month: 'Avr', val: 65, color: 'bg-blue-500' },
              { month: 'Mai', val: 78, color: 'bg-blue-600' },
              { month: 'Juin', val: 30, color: 'bg-slate-200' },
            ].map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${d.val}%` }}
                  transition={{ delay: i * 0.1, duration: 0.8 }}
                  className={`w-full rounded-t-xl ${d.color} relative group`}
                >
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {d.val} visites
                  </div>
                </motion.div>
                <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{d.month}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center">
            <PieChart className="w-6 h-6 mr-3 text-emerald-600" />
            Répartition Motifs
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Maux de tête / Fièvre', val: 42, color: 'bg-blue-500' },
              { label: 'Bobologie / Chutes', val: 28, color: 'bg-emerald-500' },
              { label: 'Douleurs Abdominales', val: 15, color: 'bg-amber-500' },
              { label: 'Urgences / Autres', val: 15, color: 'bg-rose-500' },
            ].map((d, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-600">{d.label}</span>
                  <span className="text-slate-900">{d.val}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${d.color}`} style={{ width: `${d.val}%` }} />
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-10 py-3 bg-slate-50 text-slate-600 rounded-2xl text-xs font-black hover:bg-slate-100 transition-colors uppercase tracking-widest">
            Analyser par classe
          </button>
        </div>
      </div>

      {/* Report Generation */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100">
          <h3 className="text-xl font-black text-slate-900 mb-2 flex items-center">
            <BarChart3 className="w-6 h-6 mr-3 text-slate-400" />
            Générateur de Rapports Sanitaires
          </h3>
          <p className="text-slate-500 text-sm font-medium">Extractions de données conformes aux standards académiques et médicaux.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-x divide-y divide-slate-100">
          {[
            { title: 'Journal de l\'Infirmerie', desc: 'Registre complet des passages quotidiens.', icon: FileText },
            { title: 'Bilan Sanitaire Annuel', desc: 'Statistiques globales pour le conseil intérieur.', icon: BarChart3 },
            { title: 'Export Données Vigilance', desc: 'Liste des allergies et contre-indications.', icon: TableIcon },
            { title: 'Inventaire Pharmacie', desc: 'État des stocks et prévisions d\'achat.', icon: PieChart },
            { title: 'Rapport Incidents Graves', desc: 'Détails des urgences et transferts.', icon: ShieldAlert },
            { title: 'Audit Accès Dossiers', desc: 'Journal de consultation des données RGPD.', icon: Calendar },
          ].map((rep, i) => (
            <motion.div 
              key={i} 
              whileHover={{ backgroundColor: '#F8FAFC' }}
              className="p-8 group cursor-pointer transition-colors"
            >
              <div className="p-3 bg-slate-50 rounded-2xl w-fit mb-6 group-hover:bg-blue-50 transition-colors">
                <rep.icon className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <h4 className="font-black text-slate-900 mb-2">{rep.title}</h4>
              <p className="text-sm text-slate-500 font-medium mb-6 leading-relaxed">{rep.desc}</p>
              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 transition-all">
                  <Download className="w-4 h-4 inline mr-2" />
                  PDF
                </button>
                <button className="flex-1 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 transition-all">
                  <FileJson className="w-4 h-4 inline mr-2" />
                  JSON
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
