/**
 * ============================================================================
 * EDUCAST ANALYTICS
 * ============================================================================
 *
 * Refonte juillet 2026 : le composant était entièrement codé en dur (74%, 42 min,
 * 1240 partages, 8.5/10, [45,80,55,90,65,30], Top Classes Terminal D/3ème B...).
 * Désormais on branche useModulesDashboard('educast') qui appelle GET /educast/stats
 * (ou /educast/dashboard). Si l'API ne renvoie pas un champ, on affiche 0/— plutôt
 * qu'une valeur fictive.
 * ============================================================================
 */

'use client';

import { BarChart3, TrendingUp, Clock, Share2, MousePointer2, PieChart, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';

interface EduCastAnalyticsData {
  completionRate?: number;
  averageWatchTime?: number; // minutes
  totalShares?: number;
  engagementScore?: number; // 0-10
  subjectBreakdown?: Array<{ subject: string; percent: number }>;
  topClasses?: Array<{ className: string; score: number; color?: string }>;
}

const DEFAULT_DATA: EduCastAnalyticsData = {
  completionRate: 0,
  averageWatchTime: 0,
  totalShares: 0,
  engagementScore: 0,
  subjectBreakdown: [],
  topClasses: [],
};

const SUBJECT_FALLBACK: Array<{ subject: string; percent: number }> = [
  { subject: 'MATHS', percent: 0 },
  { subject: 'FRANÇAIS', percent: 0 },
  { subject: 'SVT', percent: 0 },
  { subject: 'ANGLAIS', percent: 0 },
  { subject: 'HG', percent: 0 },
  { subject: 'AUTRE', percent: 0 },
];

const CLASS_COLOR_PALETTE = ['bg-emerald-500', 'bg-blue-500', 'bg-blue-500', 'bg-amber-500'];

export default function EduCastAnalytics() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesDashboard<EduCastAnalyticsData>('educast', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des statistiques...</span>
      </div>
    );
  }

  const stats = { ...DEFAULT_DATA, ...(data ?? {}) };

  const subjectBreakdown = (stats.subjectBreakdown?.length ? stats.subjectBreakdown : SUBJECT_FALLBACK);
  const topClasses = stats.topClasses ?? [];

  const kpiCards = [
    { label: 'Taux de Complétion', value: `${stats.completionRate ?? 0}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: 'Moyenne' },
    { label: 'Temps Visionnage / Élève', value: `${stats.averageWatchTime ?? 0} min`, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50', trend: 'Hebdomadaire' },
    { label: 'Partages Internes', value: (stats.totalShares ?? 0).toLocaleString('fr-FR'), icon: Share2, color: 'text-rose-600', bg: 'bg-rose-50', trend: 'Cumul' },
    { label: 'Engagement Global', value: `${stats.engagementScore ?? 0}/10`, icon: MousePointer2, color: 'text-blue-600', bg: 'bg-blue-50', trend: 'Score Sarah AI' },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. Affichage des valeurs par défaut.
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((stat, i) => (
          <Card key={i} className="p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-medium text-slate-500">{stat.label}</h4>
              <div className={`p-2 rounded-lg ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-semibold text-slate-900 mb-2">{stat.value}</div>
            <Badge variant="outline" className="bg-slate-50 text-slate-600">{stat.trend}</Badge>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Chart — Consultations par Matière */}
        <div className="bg-slate-900 rounded-xl p-6 text-white min-h-[400px] flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold">Consultations par Matière</h3>
              <p className="text-white/60 text-sm">Répartition du temps de visionnage hebdomadaire</p>
            </div>
            <BarChart3 className="w-7 h-7 text-amber-400" />
          </div>

          <div className="flex items-end justify-between h-48 gap-4 px-4">
            {subjectBreakdown.map((s, i) => {
              const h = Math.max(2, Math.min(100, s.percent ?? 0));
              return (
                <div
                  key={i}
                  className="w-full bg-gradient-to-t from-amber-500/20 to-amber-400 rounded-t-xl relative group"
                  style={{ height: `${h}%` }}
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-white text-slate-900 px-2 py-1 rounded text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    {s.percent ?? 0}%
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between text-xs text-white/40 px-4 pt-4">
            {subjectBreakdown.map((s, i) => (
              <span key={i}>{s.subject}</span>
            ))}
          </div>
        </div>

        {/* Engagement Level by Class */}
        <Card className="border border-slate-200 p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-navy-900">Top Classes Actives</h3>
            <PieChart className="w-5 h-5 text-slate-300" />
          </div>
          {topClasses.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Aucune donnée de performance disponible.
            </div>
          ) : (
            <div className="space-y-6 flex-1 flex flex-col justify-center">
              {topClasses.map((c, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-900">{c.className}</span>
                    <span className="text-slate-500">{c.score}% engagement</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${c.color || CLASS_COLOR_PALETTE[i % CLASS_COLOR_PALETTE.length]}`}
                      style={{ width: `${Math.min(100, c.score)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
