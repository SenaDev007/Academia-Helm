/**
 * ============================================================================
 * ORION DASHBOARD - MODULE 8
 * ============================================================================
 * Dashboard de pilotage direction avec IA ORION
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Brain, AlertTriangle, TrendingUp, FileText, Eye, BarChart3 } from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function OrionDashboardPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any[]>([]);

  useEffect(() => {
    // TODO: Fetch dashboard data from API
    setLoading(false);
  }, [academicYear, schoolLevel]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'INFO':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'LOW':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="ORION — Pilotage Direction"
        description="Intelligence de décision éducative. Analyse, alertes et insights pour le pilotage stratégique de l'établissement."
        icon="orion"
        kpis={[
          { label: 'Alertes actives', value: String(alerts.length), unit: '' },
          { label: 'Insights', value: String(insights.length), unit: '' },
          { label: 'KPIs suivis', value: String(kpis.length), unit: '' },
          { label: 'Conformité', value: '92%', unit: '' },
        ]}
        actions={[
          { label: 'Générer insights', onClick: () => console.log('Generate insights'), primary: true },
          { label: 'Calculer KPIs', onClick: () => console.log('Calculate KPIs') },
        ]}
      />

      <div className="p-6 space-y-6">
        {/* Alertes critiques */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-gray-800">Alertes critiques</h3>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Chargement...</div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Aucune alerte critique pour le moment.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.slice(0, 5).map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 border rounded-lg ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold mb-1">{alert.title}</h4>
                        <p className="text-sm mb-2">{alert.description}</p>
                        {alert.recommendation && (
                          <p className="text-xs mt-2 opacity-90">
                            💡 {alert.recommendation}
                          </p>
                        )}
                      </div>
                      <button className="text-xs px-2 py-1 bg-white/50 rounded hover:bg-white/80">
                        Acquitter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* KPIs principaux */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-gray-800">Taux d'absence</h4>
            </div>
            <div className="text-3xl font-bold text-gray-900">8.5%</div>
            <div className="text-sm text-gray-600 mt-1">↓ 2.1% vs mois précédent</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-gray-800">Taux d'impayé</h4>
            </div>
            <div className="text-3xl font-bold text-gray-900">12.3%</div>
            <div className="text-sm text-gray-600 mt-1">↑ 1.2% vs mois précédent</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-gray-800">Masse salariale</h4>
            </div>
            <div className="text-3xl font-bold text-gray-900">8.5M</div>
            <div className="text-sm text-gray-600 mt-1">XOF/mois</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h4 className="font-semibold text-gray-800">Incidents critiques</h4>
            </div>
            <div className="text-3xl font-bold text-gray-900">2</div>
            <div className="text-sm text-gray-600 mt-1">En cours</div>
          </div>
        </div>

        {/* Insights ORION */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-800">Insights ORION</h3>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Chargement...</div>
            ) : insights.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Brain className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Aucun insight disponible pour le moment.</p>
                <button className="mt-4 text-blue-600 hover:underline">
                  Générer des insights
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {insights.map((insight) => (
                  <div
                    key={insight.id}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(insight.priority)}`}>
                            {insight.priority}
                          </span>
                          <span className="text-xs text-gray-500">{insight.category}</span>
                        </div>
                        <h4 className="font-semibold text-gray-800">{insight.title}</h4>
                      </div>
                      {!insight.isRead && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{insight.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
