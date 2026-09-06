/**
 * ============================================================================
 * ORION ALERTS CARD — Carte d'alertes ORION stable (React Query)
 * ============================================================================
 *
 * ⭐ Avant : utilisait useEffect + setInterval(60s) avec setAlerts([]) dans
 *    le catch → pendant chaque re-fetch, la carte disparaissait (return null)
 *    puis réapparaissait → effet "clignotement" toutes les 60s.
 *
 * ⭐ Maintenant : React Query avec staleTime 5min + placeholderData
 *    (keepPreviousData). Les anciennes alertes restent affichées pendant
 *    le re-fetch, donc pas de clignotement. La carte reste visible même
 *    si pas d'alertes (état stable "Aucune alerte active" au lieu de null).
 *
 * ============================================================================
 */

'use client';

import { useL } from '@/lib/i18n/bilingual';
import { AlertTriangle, ChevronRight, Brain, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

interface OrionAlertsCardProps {
  academicYearId: string;
  schoolLevelId?: string;
}

async function fetchOrionAlerts({ queryKey }: { queryKey: any }): Promise<any[]> {
  const [, academicYearId, schoolLevelId] = queryKey;
  if (!academicYearId) return [];

  try {
    const url = `/api/orion/alerts?academicYearId=${academicYearId}&schoolLevelId=${schoolLevelId || ''}&status=active&limit=3`;
    const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.items || []);
  } catch {
    return [];
  }
}

export default function OrionAlertsCard({ academicYearId, schoolLevelId }: OrionAlertsCardProps) {
  // ⭐ P4-final : libellés dans la langue du profil (piste EN → anglais)
  const L = useL();
  const { data: alerts = [], isLoading } = useQuery<any[]>({
    queryKey: ['orion-alerts', academicYearId, schoolLevelId],
    queryFn: fetchOrionAlerts,
    enabled: !!academicYearId,
    staleTime: 5 * 60 * 1000, // 5 min — ne pas re-fetch trop souvent (évite clignotement)
    gcTime: 30 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData, // ⭐ garder les anciennes données pendant le re-fetch
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  // ⭐ Affichage initial (premier chargement, pas encore de données)
  if (isLoading && (!alerts || alerts.length === 0)) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Brain className="w-5 h-5 text-navy-900" />
          <h3 className="text-lg font-semibold text-navy-900">{L("Analyse ORION", "ORION Analytics")}</h3>
        </div>
        <div className="text-center py-6">
          <Brain className="w-8 h-8 text-gray-300 mx-auto mb-2 animate-pulse" />
          <p className="text-sm text-gray-400">Chargement des alertes…</p>
        </div>
      </div>
    );
  }

  // ⭐ État stable : aucune alerte — on garde la carte visible (ne pas retourner null)
  //    pour éviter le clignotement de la mise en page.
  if (!alerts || alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Brain className="w-5 h-5 text-navy-900" />
            <h3 className="text-lg font-semibold text-navy-900">{L("Analyse ORION", "ORION Analytics")}</h3>
          </div>
          <Link
            href="/app#orion-alerts"
            className="text-sm text-navy-600 hover:text-navy-900 font-medium flex items-center space-x-1"
          >
            <span>{L("Voir l'analyse", "View analysis")}</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="text-center py-8">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600">{L("Aucune alerte active", "No active alerts")}</p>
          <p className="text-xs text-gray-400 mt-1">{L("Tout est sous contrôle", "Everything is under control")}</p>
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'HIGH':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-navy-900" />
          <h3 className="text-lg font-semibold text-navy-900">{L("Analyse ORION", "ORION Analytics")}</h3>
        </div>
        <Link
          href="/app#orion-alerts"
          className="text-sm text-navy-600 hover:text-navy-900 font-medium flex items-center space-x-1"
        >
          <span>{L("Voir l'analyse complète", "View full analysis")}</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-3">
        {alerts.slice(0, 3).map((alert) => (
          <div
            key={alert.id}
            className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
          >
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium mb-1">{alert.title}</p>
                <p className="text-sm opacity-90">{alert.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
