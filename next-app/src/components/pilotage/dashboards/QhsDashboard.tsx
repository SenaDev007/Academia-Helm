/**
 * QHSE Dashboard Component
 * 
 * Dashboard pour la gouvernance, risques et conformité
 */

'use client';

import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface QhsIncident {
  id: string;
  type: string;
  gravity: string;
  status: string;
  title: string;
  description: string;
  createdAt: string;
  academicYear?: { label: string };
  schoolLevel?: { code: string; label: string };
}

interface QhsRisk {
  id: string;
  code: string;
  title: string;
  level: string;
  probability: string;
  impact: string;
  status: string;
}

interface QhsAudit {
  id: string;
  auditType: string;
  date: string;
  status: string;
  globalResult: string;
}

interface QhsStatistics {
  incidents: {
    byGravity: Array<{ gravity: string; _count: number }>;
    byStatus: Array<{ status: string; _count: number }>;
  };
  risks: {
    byLevel: Array<{ level: string; _count: number }>;
    byStatus: Array<{ status: string; _count: number }>;
  };
  audits: {
    byStatus: Array<{ status: string; _count: number }>;
    byResult: Array<{ globalResult: string; _count: number }>;
  };
}

interface QhsDashboardProps {
  tenantId: string;
  academicYearId?: string;
  schoolLevelId?: string;
}

export default function QhsDashboard({
  tenantId,
  academicYearId,
  schoolLevelId,
}: QhsDashboardProps) {
  const [incidents, setIncidents] = useState<QhsIncident[]>([]);
  const [risks, setRisks] = useState<QhsRisk[]>([]);
  const [audits, setAudits] = useState<QhsAudit[]>([]);
  const [statistics, setStatistics] = useState<QhsStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (academicYearId) params.append('academicYearId', academicYearId);
        if (schoolLevelId) params.append('schoolLevelId', schoolLevelId);

        const [incidentsRes, risksRes, auditsRes, statsRes] = await Promise.all([
          fetch(`/api/qhs/incidents?${params.toString()}`),
          fetch(`/api/qhs/risk-register?${params.toString()}`),
          fetch(`/api/qhs/audits?${params.toString()}`),
          fetch(`/api/qhs/statistics?${params.toString()}`),
        ]);

        if (incidentsRes.ok) {
          const data = await incidentsRes.json();
          setIncidents(data);
        }

        if (risksRes.ok) {
          const data = await risksRes.json();
          setRisks(data);
        }

        if (auditsRes.ok) {
          const data = await auditsRes.json();
          setAudits(data);
        }

        if (statsRes.ok) {
          const data = await statsRes.json();
          setStatistics(data);
        }
      } catch (error) {
        console.error('Error loading QHSE data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tenantId, academicYearId, schoolLevelId]);

  const getGravityBadge = (gravity: string) => {
    const styles = {
      MINEUR: 'bg-green-100 text-green-800',
      MAJEUR: 'bg-yellow-100 text-yellow-800',
      CRITIQUE: 'bg-red-100 text-red-800',
    };
    return (
      <span className={cn('px-2 py-1 rounded text-xs font-medium', styles[gravity as keyof typeof styles] || 'bg-gray-100 text-gray-800')}>
        {gravity}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      OUVERT: 'bg-blue-100 text-blue-800',
      EN_COURS: 'bg-yellow-100 text-yellow-800',
      CLOTURE: 'bg-green-100 text-green-800',
      ACTIF: 'bg-red-100 text-red-800',
      EN_SURVEILLANCE: 'bg-yellow-100 text-yellow-800',
      MITIGE: 'bg-green-100 text-green-800',
    };
    return (
      <span className={cn('px-2 py-1 rounded text-xs font-medium', styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800')}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">QHSE+ - Gouvernance & Conformité</h1>
        <p className="text-gray-600 mt-1">
          Tableau de bord des incidents, risques et audits
        </p>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Incidents</h3>
              <AppIcon name="warning" size="menu" className="text-red-600" />
            </div>
            <div className="space-y-2">
              {statistics.incidents.byGravity.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.gravity}</span>
                  <span className="font-semibold text-gray-900">{item._count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Risques</h3>
              <AppIcon name="shieldCheck" size="menu" className="text-yellow-600" />
            </div>
            <div className="space-y-2">
              {statistics.risks.byLevel.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.level}</span>
                  <span className="font-semibold text-gray-900">{item._count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Audits</h3>
              <AppIcon name="document" size="menu" className="text-blue-600" />
            </div>
            <div className="space-y-2">
              {statistics.audits.byStatus.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.status}</span>
                  <span className="font-semibold text-gray-900">{item._count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Incidents */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Incidents récents</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gravité</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Aucun incident
                  </td>
                </tr>
              ) : (
                incidents.slice(0, 10).map((incident) => (
                  <tr key={incident.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{incident.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getGravityBadge(incident.gravity)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{incident.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(incident.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(incident.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risks */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Registre des risques</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Niveau</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Probabilité</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {risks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Aucun risque enregistré
                  </td>
                </tr>
              ) : (
                risks.map((risk) => (
                  <tr key={risk.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{risk.code}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{risk.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        risk.level === 'CRITIQUE' ? 'bg-red-100 text-red-800' :
                        risk.level === 'ELEVE' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      )}>
                        {risk.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{risk.probability}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{risk.impact}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(risk.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audits */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Audits & Inspections</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Résultat</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {audits.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Aucun audit
                  </td>
                </tr>
              ) : (
                audits.map((audit) => (
                  <tr key={audit.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{audit.auditType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(audit.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(audit.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        audit.globalResult === 'CONFORME' ? 'bg-green-100 text-green-800' :
                        audit.globalResult === 'NON_CONFORME' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      )}>
                        {audit.globalResult}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

