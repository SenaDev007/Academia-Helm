/**
 * ============================================================================
 * LIBRARY REPORTS & STATS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint stats       : GET  /modules-complementaires/library/dashboard
 * Endpoint génération  : POST /modules-complementaires/library/reports
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, FileText, Download, Calendar, Printer, Share2, TrendingUp, Filter, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface LibraryDashboardStats {
  rotationRate?: number;
  averageLoanDuration?: number;
  maxLoanDuration?: number;
  penaltyRevenue?: number;
  totalRevenue?: number;
  [key: string]: any;
}

// TODO: endpoint liste des rapports non disponible — garder mock
const REPORTS_MOCK = [
  { title: 'Rapport Annuel de Fréquentation', type: 'COMPLET', date: '01/01/2026', size: '2.4 MB', author: 'Logiciel System' },
  { title: 'Analyse des Retards et Pénalités', type: 'FINANCE', date: '12/05/2026', size: '1.1 MB', author: 'Sarah AI' },
  { title: 'Inventaire Physique - Section Littérature', type: 'INVENTAIRE', date: '10/05/2026', size: '850 KB', author: 'Admin' },
];

export default function LibraryReports() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesDashboard<LibraryDashboardStats>('library', academicYear?.id);
  const [generating, setGenerating] = useState(false);

  const rotationRate = data?.rotationRate ?? 68;
  const avgLoanDays = data?.averageLoanDuration ?? 9.2;
  const maxLoanDays = data?.maxLoanDuration ?? 14;
  const penaltyRevenue = data?.penaltyRevenue ?? data?.totalRevenue ?? 42500;

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      await modulesApi.post(
        'library/reports',
        { generatedAt: new Date().toISOString() },
        buildModulesApiOptions(academicYear?.id),
      );
      alert('Rapport généré avec succès.');
    } catch (e: any) {
      console.error('Erreur génération rapport :', e?.message || e);
      alert(e?.message || 'Erreur lors de la génération du rapport');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des statistiques...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques depuis le serveur. Affichage des valeurs par défaut.
          <details className="mt-1 text-xs text-amber-700"><summary>Détail</summary>{error}</details>
        </div>
      )}

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taux de Rotation</h4>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-4xl font-black text-slate-900 mb-2">{rotationRate}%</div>
          <p className="text-[10px] font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-lg">+12% vs mois dernier</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Temps Moyen Emprunt</h4>
            <Calendar className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-4xl font-black text-slate-900 mb-2">{avgLoanDays} Jours</div>
          <p className="text-[10px] font-bold text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded-lg">Dans les limites ({maxLoanDays}j)</p>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recettes Pénalités</h4>
            <FileText className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-4xl font-black text-slate-900 mb-2">{penaltyRevenue.toLocaleString('fr-FR')} F CFA</div>
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
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/10 disabled:opacity-50"
          >
            <Printer className="w-4 h-4 text-[#C9A84C]" />
            <span>{generating ? 'Génération…' : 'Nouveau Rapport'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {REPORTS_MOCK.map((report, i) => (
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
