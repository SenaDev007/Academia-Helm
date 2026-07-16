/**
 * ============================================================================
 * LIBRARY DASHBOARD — Branché sur backend réel (Standardisé)
 * ============================================================================
 *
 * Affiche les statistiques de la bibliothèque pour l'année scolaire courante.
 * Endpoint : GET /modules-complementaires/library/stats?academicYearId=...
 * ============================================================================
 */

'use client';

import {
  Book, Users, ArrowUpCircle, Clock, AlertTriangle, TrendingUp,
  Activity, History, Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques depuis le serveur. Affichage des données par défaut.
          <details className="mt-1 text-xs text-amber-700"><summary>Détail</summary>{error}</details>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((stat, i) => (
          <Card key={i} className="p-6 shadow-sm hover:shadow-md transition-all">
            <div className={`p-3 rounded-xl w-fit mb-4 ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-3xl font-semibold text-slate-900 mb-1">{stat.value}</p>
            <p className="text-xs font-medium text-slate-500 leading-tight">{stat.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loan Activity Chart */}
        <Card className="lg:col-span-2 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-blue-600" />
              Activité des Emprunts
            </h3>
            <div className="flex bg-slate-50 p-1 rounded-lg">
              <Button variant="secondary" size="sm" className="h-7 text-xs">Hebdomadaire</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500">Mensuel</Button>
            </div>
          </div>
          <div className="h-56 flex items-end justify-between space-x-2">
            {weeklyActivity.map((val, i) => {
              const heightPct = maxWeekly > 0 ? Math.max((val / maxWeekly) * 100, 5) : 5;
              return (
                <div key={i} className="flex-1 flex flex-col items-center group">
                  <div
                    className="w-full bg-slate-100 rounded-t-lg relative overflow-hidden group-hover:bg-blue-100 transition-colors"
                    style={{ height: `${heightPct}%` }}
                  >
                    <div className="absolute bottom-0 left-0 right-0 bg-blue-600 opacity-20 h-full" />
                  </div>
                  <p className="mt-3 text-xs font-medium text-slate-400">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i]}
                  </p>
                  <p className="text-xs text-slate-600 font-semibold">{val}</p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Top Books List */}
        <Card className="p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center">
            <History className="w-5 h-5 mr-2 text-amber-600" />
            Livres les plus lus
          </h3>
          <div className="space-y-4">
            {topBooks.slice(0, 5).map((book, i) => (
              <div key={i} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-semibold text-xs group-hover:bg-blue-50 group-hover:text-blue-600 transition-all">
                    IMG
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{book.title}</p>
                    <p className="text-xs text-slate-400">{book.author}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{book.count}</p>
                  <p className="text-xs text-slate-400">Lectures</p>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-6">
            Voir tout le classement
          </Button>
        </Card>
      </div>
    </div>
  );
}
