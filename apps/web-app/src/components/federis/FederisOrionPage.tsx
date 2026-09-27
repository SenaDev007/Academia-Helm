/**
 * FederisOrionPage Component
 * 
 * ORION - Analyse institutionnelle
 */

'use client';

import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { FedPage } from '@/components/federis/federis-motion';
import { apiClient } from '@/lib/api/client';

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  count?: number;
}

export default function FederisOrionPage({ tenantId }: { tenantId: string }) {
  // ⭐ ORION lecture seule — alertes réelles du cockpit patronat (API dashboard)
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get('/federis/patronat/dashboard', { timeout: 20000 });
        const raw = (res.data?.orionAlerts ?? []) as Omit<Alert, 'id'>[];
        if (!cancelled) {
          setAlerts(raw.map((a, i) => ({ ...a, id: `orion-${i}` })));
        }
      } catch {
        if (!cancelled) setAlerts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const getSeverityBadge = (severity: string) => {
    const styles = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      info: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return (
      <span className={cn('px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border', styles[severity as keyof typeof styles])}>
        {severity}
      </span>
    );
  };

  return (
    <FedPage className="space-y-6">
      <div>
        <div className="fed-badge mb-3">Module analyse</div>
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-12 h-12 bg-amber-500/15 border border-amber-400/30 rounded-xl flex items-center justify-center">
            <AppIcon name="sparkles" size="dashboard" className="text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-[#0b1d3a] tracking-tight">ORION</h1>
            <p className="text-slate-500 font-medium text-sm">Analyse institutionnelle</p>
          </div>
        </div>
      </div>

      {/* Alertes */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-[#0b1d3a]">Alertes</h2>

        {loading ? (
          <div className="text-center py-8 text-slate-500">Chargement...</div>
        ) : alerts.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <AppIcon name="success" size="dashboard" className="text-green-600 mx-auto mb-2" />
            <p className="text-green-800 font-medium">Aucune alerte à signaler</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'bg-white rounded-2xl border p-6',
                alert.severity === 'critical' && 'border-red-200 bg-red-50/30',
                alert.severity === 'warning' && 'border-yellow-200 bg-yellow-50/30',
                alert.severity === 'info' && 'border-blue-200 bg-blue-50/30'
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-3">
                  {getSeverityBadge(alert.severity)}
                  <h3 className="text-lg font-black text-[#0b1d3a]">{alert.category}</h3>
                </div>
                {typeof alert.count === 'number' && (
                  <span className="px-2.5 py-1 rounded-lg bg-[#0b1d3a] text-amber-400 text-xs font-black">
                    {alert.count}
                  </span>
                )}
              </div>
              <p className="text-slate-700 mt-2">{alert.message}</p>
            </div>
          ))
        )}
      </div>

      {/* Rapports */}
      <div className="fed-card p-6">
        <h2 className="text-xl font-black text-[#0b1d3a] mb-4">Rapports institutionnels</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="p-4 border border-blue-100 rounded-2xl bg-[#f7f9fc] text-left hover:border-[#1e3a8a]/40 hover:shadow-md transition-all">
            <AppIcon name="document" size="menu" className="text-[#1e3a8a] mb-2" />
            <p className="font-bold text-[#0b1d3a]">Rapport d'inscription</p>
            <p className="text-sm text-slate-500 mt-1">Statistiques par école et par examen</p>
          </button>
          <button className="p-4 border border-blue-100 rounded-2xl bg-[#f7f9fc] text-left hover:border-[#1e3a8a]/40 hover:shadow-md transition-all">
            <AppIcon name="finance" size="menu" className="text-[#1e3a8a] mb-2" />
            <p className="font-bold text-[#0b1d3a]">Rapport logistique</p>
            <p className="text-sm text-slate-500 mt-1">Centres, salles, surveillants</p>
          </button>
        </div>
      </div>
    </FedPage>
  );
}

