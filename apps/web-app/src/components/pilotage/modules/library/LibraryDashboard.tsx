/**
 * ============================================================================
 * LIBRARY DASHBOARD — Branché sur backend réel
 * ============================================================================
 *
 * Affiche les statistiques de la bibliothèque pour l'année scolaire courante.
 * Endpoint : GET /modules-complementaires/library/stats?academicYearId=...
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import {
  Book, Users, ArrowUpCircle, Clock, AlertTriangle, TrendingUp,
  Activity, History, Loader2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';

interface LibraryStats {
  totalBooks?: number;
  activeReaders?: number;
  activeLoans?: number;
  overdueLoans?: number;
  lostBooks?: number;
  stockValue?: number;
  topBooks?: Array<{ title: string; author: string; count: number }>;
  weeklyActivity?: number[];
}

const DEFAULT_STATS: LibraryStats = {
  totalBooks: 0,
  activeReaders: 0,
  activeLoans: 0,
  overdueLoans: 0,
  lostBooks: 0,
  stockValue: 0,
  topBooks: [],
  weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
};

const FALLBACK_TOP_BOOKS = [
  { title: 'Aucune donnée', author: '—', count: 0 },
];

export default function LibraryDashboard() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesDashboard<LibraryStats>('library', academicYear?.id);

  const stats = { ...DEFAULT_STATS, ...(data ?? {}) };
  const topBooks = stats.topBooks?.length ? stats.topBooks : FALLBACK_TOP_BOOKS;
  const weeklyActivity = stats.weeklyActivity?.length === 7 ? stats.weeklyActivity : [0, 0, 0, 0, 0, 0, 0];
  const maxWeekly = Math.max(...weeklyActivity, 1);

  const kpiCards = [
    { label: 'Total Livres', value: stats.totalBooks?.toLocaleString('fr-FR') ?? '0', icon: Book, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Lecteurs Actifs', value: stats.activeReaders?.toLocaleString('fr-FR') ?? '0', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Emprunts en cours', value: stats.activeLoans?.toLocaleString('fr-FR') ?? '0', icon: ArrowUpCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Retards', value: stats.overdueLoans?.toLocaleString('fr-FR') ?? '0', icon: Clock, color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Livres perdus', value: stats.lostBooks?.toLocaleString('fr-FR') ?? '0', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Valeur Stock', value: stats.stockValue ? `${(stats.stockValue / 1000000).toFixed(1)}M` : '0', icon: TrendingUp, color: 'text-slate-900', bg: 'bg-slate-100' },
  ];

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
          ⚠ Impossible de charger les statistiques depuis le serveur. Affichage des données par défaut.
          <details className="mt-1 text-xs text-amber-700"><summary>Détail</summary>{error}</details>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className={`p-3 rounded-2xl w-fit mb-4 ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-3xl font-black text-slate-900 mb-1">{stat.value}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Loan Activity Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 flex items-center">
              <Activity className="w-6 h-6 mr-3 text-blue-600" />
              Activité des Emprunts
            </h3>
            <div className="flex bg-slate-50 p-1 rounded-xl">
              <button className="px-4 py-1.5 bg-white text-navy-900 text-[10px] font-black uppercase rounded-lg shadow-sm">Hebdomadaire</button>
              <button className="px-4 py-1.5 text-slate-500 text-[10px] font-black uppercase">Mensuel</button>
            </div>
          </div>
          <div className="h-64 flex items-end justify-between space-x-2">
            {weeklyActivity.map((val, i) => {
              const heightPct = maxWeekly > 0 ? Math.max((val / maxWeekly) * 100, 5) : 5;
              return (
                <div key={i} className="flex-1 flex flex-col items-center group">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    className="w-full bg-slate-100 rounded-t-xl relative overflow-hidden group-hover:bg-blue-100 transition-colors"
                  >
                    <div className="absolute bottom-0 left-0 right-0 bg-blue-600 opacity-20 h-full" />
                  </motion.div>
                  <p className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i]}
                  </p>
                  <p className="text-xs text-slate-600 font-semibold">{val}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Books List */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center">
            <History className="w-6 h-6 mr-3 text-[#C9A84C]" />
            Livres les plus lus
          </h3>
          <div className="space-y-6">
            {topBooks.slice(0, 5).map((book, i) => (
              <div key={i} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300 font-black text-xs group-hover:bg-blue-50 group-hover:text-blue-200 transition-all">
                    IMG
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{book.title}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{book.author}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900">{book.count}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Lectures</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-8 py-3 bg-slate-50 hover:bg-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all">
            Voir tout le classement
          </button>
        </div>
      </div>
    </div>
  );
}
