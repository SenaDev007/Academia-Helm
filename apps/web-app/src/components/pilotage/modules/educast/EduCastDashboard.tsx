/**
 * ============================================================================
 * EDUCAST DASHBOARD
 * ============================================================================
 */

'use client';

import { Play, Headphones, Users, Star, Eye, TrendingUp, AlertCircle, CheckCircle2, ChevronRight, Zap, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';

interface EduCastStats {
  totalContents?: number;
  totalViews?: number;
  activeChannels?: number;
  totalSubscribers?: number;
  recentContents?: Array<{ id: string | number; title: string; type: string; duration: string; author: string; views: number; status: string; monetization: string; price?: string }>;
  topChannels?: Array<{ id?: string; name?: string; subscribers?: number; views?: number }>;
}

const DEFAULT_STATS: EduCastStats = {
  totalContents: 0,
  totalViews: 0,
  activeChannels: 0,
  totalSubscribers: 0,
  recentContents: [],
  topChannels: [],
};

export default function EduCastDashboard() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesDashboard<EduCastStats>('educast', academicYear?.id);

  const stats = { ...DEFAULT_STATS, ...(data ?? {}) };

  const kpiCards = [
    { label: 'Contenus Publiés', value: String(stats.totalContents ?? 0), icon: Play, color: 'text-blue-600', bg: 'bg-blue-50', trend: 'Publications' },
    { label: 'Vues Totales', value: (stats.totalViews ?? 0).toLocaleString('fr-FR'), icon: Eye, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: 'Cumul' },
    { label: 'Chaînes Actives', value: String(stats.activeChannels ?? 0), icon: Star, color: 'text-amber-600', bg: 'bg-amber-50', trend: 'Dont certifiées' },
    { label: 'Abonnés', value: (stats.totalSubscribers ?? 0).toLocaleString('fr-FR'), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', trend: 'Inscriptions' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. Affichage des valeurs par défaut.
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((stat, i) => (
          <Card key={i} className="p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <TrendingUp className="w-4 h-4 text-slate-300" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-slate-500">{stat.label}</h4>
              <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
              <p className="text-xs text-emerald-600 font-medium">{stat.trend}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent contents */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-navy-900">Publications Récentes</h3>
            <Button variant="link" size="sm">Voir Tout</Button>
          </div>
          <Card className="shadow-sm overflow-hidden p-0">
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
              {(stats.recentContents?.length ? stats.recentContents : []).map((content) => (
                <div key={content.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      {content.type === 'Vidéo' ? <Play className="w-5 h-5" /> : content.type === 'Audio' ? <Headphones className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 leading-tight">{content.title}</p>
                      <p className="text-xs text-slate-500">{content.type} • {content.author} • {content.duration}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-900">{content.views}</p>
                      <p className="text-xs text-slate-400">Vues</p>
                    </div>
                    <div className="text-right min-w-[80px]">
                      <Badge variant="outline" className={content.monetization === 'PAYANT' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                        {content.monetization === 'PAYANT' ? `${content.price ?? '0'} F` : 'Gratuit'}
                      </Badge>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-all group-hover:translate-x-1" />
                  </div>
                </div>
              ))}
              {(!stats.recentContents || stats.recentContents.length === 0) && (
                <div className="text-center py-12 text-sm text-slate-400">
                  Aucune publication récente.
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* System Health / Modération */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-navy-900">État du Système</h3>
          <div className="bg-slate-900 rounded-xl p-6 text-white space-y-6 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Star className="w-24 h-24" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-amber-400" />
                <p className="text-sm font-semibold">Modération Active</p>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-semibold text-amber-400">0</p>
                <p className="text-xs text-white/60">Contenus en attente</p>
              </div>
              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-center text-xs font-medium mb-2">
                  <span>Stockage Utilisé</span>
                  <span>65%</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 w-[65%]" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Rappel Modération</p>
              <p className="text-xs text-amber-800/80 leading-relaxed">Les vidéos d&apos;élèves doivent être validées sous 24h par le responsable communication.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
