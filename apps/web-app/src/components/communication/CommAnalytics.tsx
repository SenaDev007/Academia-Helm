/**
 * CommAnalytics Component
 * 
 * ONGLET 13 — Rapports & Analytique
 * Graphiques et statistiques des performances de communication.
 * 
 * ⭐ V3: Now fetches REAL data from GET /api/chat/v2/analytics
 *    (previously had hardcoded fake metrics like '82%', '14,520 messages')
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  MessageSquare,
  FolderOpen,
  AlertTriangle,
  Megaphone,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CommAnalytics() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/chat/v2/analytics', { credentials: 'include' });
        if (res.ok) setStats(await res.json());
      } catch (e) {
        console.error('Failed to load analytics:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const metrics = [
    { label: "Messages aujourd'hui", value: stats?.messagesToday?.toLocaleString('fr-FR') ?? '0', icon: MessageSquare, color: 'text-blue-400' },
    { label: 'Utilisateurs actifs', value: stats?.activeUsersToday?.toLocaleString('fr-FR') ?? '0', icon: Users, color: 'text-emerald-400' },
    { label: 'Groupes actifs', value: stats?.totalGroups?.toLocaleString('fr-FR') ?? '0', icon: Users, color: 'text-violet-400' },
    { label: 'Messages non lus', value: stats?.totalUnread?.toLocaleString('fr-FR') ?? '0', icon: AlertTriangle, color: 'text-amber-400' },
    { label: 'Annonces publiées', value: stats?.totalAnnouncements?.toLocaleString('fr-FR') ?? '0', icon: Megaphone, color: 'text-rose-400' },
    { label: 'Fichiers partagés', value: stats?.filesShared?.toLocaleString('fr-FR') ?? '0', icon: FolderOpen, color: 'text-cyan-400' },
    { label: 'Signalements en attente', value: stats?.pendingReports?.toLocaleString('fr-FR') ?? '0', icon: AlertTriangle, color: 'text-red-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-violet-400" /> Analytique des Communications
            </h2>
            <p className="text-slate-400 text-sm mt-2">
              Statistiques en temps réel de Yeshua Connect — messages, utilisateurs actifs, groupes, fichiers.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500 uppercase tracking-wider">Aujourd'hui</p>
            <p className="text-3xl font-black">{stats?.messagesToday ?? 0}</p>
            <p className="text-xs text-emerald-400 flex items-center gap-1 justify-end">
              <TrendingUp className="w-3 h-3" /> messages envoyés
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <Icon className={cn('w-5 h-5', metric.color)} />
              </div>
              <p className="text-2xl font-black text-slate-900">{metric.value}</p>
              <p className="text-xs text-slate-500 mt-1">{metric.label}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Résumé Yeshua Connect</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Communication aujourd'hui</p>
            <p className="text-lg font-bold text-slate-900">{stats?.messagesToday ?? 0} messages</p>
            <p className="text-xs text-slate-400">{stats?.activeUsersToday ?? 0} utilisateurs actifs</p>
          </div>
          <div>
            <p className="text-slate-500">Engagement</p>
            <p className="text-lg font-bold text-slate-900">{stats?.totalUnread ?? 0} non lus</p>
            <p className="text-xs text-slate-400">{stats?.filesShared ?? 0} fichiers partagés</p>
          </div>
          <div>
            <p className="text-slate-500">Annonces</p>
            <p className="text-lg font-bold text-slate-900">{stats?.totalAnnouncements ?? 0} publiées</p>
            <p className="text-xs text-slate-400">{stats?.totalGroups ?? 0} groupes actifs</p>
          </div>
          <div>
            <p className="text-slate-500">Modération</p>
            <p className="text-lg font-bold text-slate-900">{stats?.pendingReports ?? 0} signalements</p>
            <p className="text-xs text-slate-400">en attente de traitement</p>
          </div>
        </div>
      </div>
    </div>
  );
}
