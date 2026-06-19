'use client';

/**
 * ============================================================================
 * PLATFORM AGGREGATION WORKSPACE
 * ============================================================================
 * 
 * Consolidation multi-écoles — récupère les vraies données d'agrégation
 * depuis l'API platform au lieu d'afficher des données mock.
 * 
 * Endpoints:
 *   GET /api/platform/aggregation → { tenants, students, revenue, etc. }
 *   GET /api/platform/dashboard → KPIs globaux
 * ============================================================================
 */

import { useState } from 'react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { Loader2, AlertCircle, Building2, Users, DollarSign, GraduationCap, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

const PRIMARY = '#0D1F6E';
const GOLD = '#F5A623';

function formatCurrency(n: number) {
  if (!n || isNaN(n)) return '0 FCFA';
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';
}

function formatNumber(n: number) {
  if (!n || isNaN(n)) return '0';
  return new Intl.NumberFormat('fr-FR').format(n);
}

export default function PlatformAggregationWorkspace() {
  const { data, loading, error, refetch } = usePlatformData<any>('/aggregation');
  const { data: dashData } = usePlatformData<any>('/dashboard');
  const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'finance'>('overview');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: PRIMARY }} />
        <span className="ml-2 text-gray-600 text-sm">Chargement de l'agrégation globale...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="text-sm text-red-600 font-medium">{error}</p>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg" style={{ backgroundColor: PRIMARY }}>
          <RefreshCw className="w-4 h-4" /> Réessayer
        </button>
      </div>
    );
  }

  // Extract real data from API response
  const tenants = data?.tenants || dashData?.totalTenants || 0;
  const students = data?.totalStudents || dashData?.totalStudents || 0;
  const revenue = data?.totalRevenue || dashData?.monthlyRevenue || 0;
  const activeSubscriptions = data?.activeSubscriptions || dashData?.activeSubscriptions || 0;
  const trialSubscriptions = data?.trialSubscriptions || dashData?.trialSubscriptions || 0;
  const tenantList = data?.tenantBreakdown || data?.tenantsList || [];

  const kpis = [
    { label: 'Établissements', value: formatNumber(tenants), icon: Building2, color: PRIMARY, sub: `${activeSubscriptions} actifs, ${trialSubscriptions} en essai` },
    { label: 'Total Élèves', value: formatNumber(students), icon: Users, color: '#059669', sub: 'Tous établissements confondus' },
    { label: 'Revenus Mensuels', value: formatCurrency(revenue), icon: DollarSign, color: GOLD, sub: 'Encaissements plateforme' },
    { label: 'Taux d\'Adoption', value: `${tenants > 0 ? Math.round((activeSubscriptions / tenants) * 100) : 0}%`, icon: TrendingUp, color: '#7C3AED', sub: 'Établissements actifs' },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agrégation Globale</h1>
          <p className="text-sm text-gray-500">Consolidation multi-écoles — données en temps réel</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          <RefreshCw className="w-3.5 h-3.5" /> Actualiser
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {[
          { id: 'overview' as const, label: 'Vue d\'ensemble' },
          { id: 'tenants' as const, label: 'Par établissement' },
          { id: 'finance' as const, label: 'Finances' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-xs font-bold transition ${
              activeTab === tab.id
                ? 'border-b-2 text-blue-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            style={activeTab === tab.id ? { borderColor: PRIMARY, color: PRIMARY } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">{kpi.label}</p>
                <Icon className="w-5 h-5" style={{ color: kpi.color }} />
              </div>
              <p className="text-2xl font-black text-gray-900">{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Synthèse de la plateforme</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Établissements totaux</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(tenants)}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Abonnements actifs</p>
              <p className="text-xl font-bold text-emerald-600">{formatNumber(activeSubscriptions)}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">En période d'essai</p>
              <p className="text-xl font-bold text-amber-600">{formatNumber(trialSubscriptions)}</p>
            </div>
          </div>
          {dashData?.pendingReviews !== undefined && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl">
              <p className="text-xs text-blue-600">Avis en attente de modération: <strong>{dashData.pendingReviews}</strong></p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'tenants' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <h3 className="text-lg font-bold text-gray-900 p-6 border-b border-slate-100">Répartition par établissement</h3>
          {tenantList.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase">Établissement</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase">Élèves</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase">Abonnement</th>
                  <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody>
                {tenantList.map((t: any, i: number) => (
                  <tr key={t.id || i} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">{t.name || t.tenantName || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">{formatNumber(t.studentCount || t.students || 0)}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">{t.subscriptionPlan || t.plan || '—'}</td>
                    <td className="px-6 py-4 text-sm text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        t.subscriptionStatus === 'ACTIVE_SUBSCRIBED' || t.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : t.subscriptionStatus === 'ACTIVE_TRIAL' || t.status === 'trial'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}>
                        {t.subscriptionStatus || t.status || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-gray-400 text-sm">
              Aucune donnée détaillée par établissement disponible. Les données d'agrégation sont récupérées en temps réel depuis l'API.
            </div>
          )}
        </div>
      )}

      {activeTab === 'finance' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Synthèse financière</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 rounded-xl">
              <p className="text-xs text-emerald-600 mb-1">Revenus mensuels</p>
              <p className="text-xl font-bold text-emerald-700">{formatCurrency(revenue)}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-xs text-blue-600 mb-1">Établissements payants</p>
              <p className="text-xl font-bold text-blue-700">{formatNumber(activeSubscriptions)}</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl">
              <p className="text-xs text-amber-600 mb-1">En période d'essai</p>
              <p className="text-xl font-bold text-amber-700">{formatNumber(trialSubscriptions)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
