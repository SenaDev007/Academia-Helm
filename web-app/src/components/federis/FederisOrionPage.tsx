/**
 * FederisOrionPage Component
 * 
 * ORION - Analyse institutionnelle
 */

'use client';

import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  type: 'ANOMALY' | 'RISK' | 'INCONSISTENCY';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  createdAt: string;
}

export default function FederisOrionPage({ tenantId }: { tenantId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Charger les alertes ORION depuis l'API
    setAlerts([
      {
        id: '1',
        type: 'INCONSISTENCY',
        severity: 'CRITICAL',
        title: 'Candidats sans école assignée',
        description: '5 candidats inscrits n\'ont pas d\'école assignée. Action requise.',
        createdAt: '2024-01-20T10:30:00Z',
      },
      {
        id: '2',
        type: 'RISK',
        severity: 'WARNING',
        title: 'Capacité centre dépassée',
        description: 'Le centre d\'examen "Littoral" a une capacité de 200 places mais 215 candidats assignés.',
        createdAt: '2024-01-20T09:15:00Z',
      },
    ]);
    setLoading(false);
  }, [tenantId]);

  const getSeverityBadge = (severity: string) => {
    const styles = {
      CRITICAL: 'bg-red-100 text-red-800 border-red-200',
      WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      INFO: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return (
      <span className={cn('px-2 py-1 rounded text-xs font-medium border', styles[severity as keyof typeof styles])}>
        {severity}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-12 h-12 bg-gradient-to-br from-gold-500/20 to-gold-600/20 rounded-lg flex items-center justify-center">
            <AppIcon name="sparkles" size="dashboard" className="text-gold-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ORION</h1>
            <p className="text-gray-600">Analyse institutionnelle</p>
          </div>
        </div>
      </div>

      {/* Alertes */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Alertes</h2>
        
        {loading ? (
          <div className="text-center py-8 text-gray-500">Chargement...</div>
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
                'bg-white rounded-lg border p-6',
                alert.severity === 'CRITICAL' && 'border-red-200 bg-red-50/30',
                alert.severity === 'WARNING' && 'border-yellow-200 bg-yellow-50/30',
                alert.severity === 'INFO' && 'border-blue-200 bg-blue-50/30'
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-3">
                  {getSeverityBadge(alert.severity)}
                  <h3 className="text-lg font-semibold text-gray-900">{alert.title}</h3>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(alert.createdAt).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <p className="text-gray-700 mt-2">{alert.description}</p>
              <div className="mt-4">
                <button className="text-sm font-semibold text-blue-700 hover:text-blue-900">
                  Voir les détails →
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rapports */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Rapports institutionnels</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button className="p-4 border border-gray-200 rounded-lg text-left hover:border-blue-300 hover:shadow-sm transition-all">
            <AppIcon name="document" size="menu" className="text-blue-600 mb-2" />
            <p className="font-semibold text-gray-900">Rapport d'inscription</p>
            <p className="text-sm text-gray-600 mt-1">Statistiques par école et par examen</p>
          </button>
          <button className="p-4 border border-gray-200 rounded-lg text-left hover:border-blue-300 hover:shadow-sm transition-all">
            <AppIcon name="finance" size="menu" className="text-blue-600 mb-2" />
            <p className="font-semibold text-gray-900">Rapport logistique</p>
            <p className="text-sm text-gray-600 mt-1">Centres, salles, surveillants</p>
          </button>
        </div>
      </div>
    </div>
  );
}

