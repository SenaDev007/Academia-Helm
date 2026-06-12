/**
 * ============================================================================
 * KPI CARDS - CARTES SYNTHÈSE
 * ============================================================================
 *
 * Cartes KPI clés : Effectifs, Assiduité, Recettes, Alertes
 * Données réelles depuis /api/general/consolidated-report
 * ============================================================================
 */

'use client';

import { Users, TrendingUp, AlertTriangle, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface KPICardsProps {
  data: any;
  isLoading: boolean;
}

export default function KPICards({ data, isLoading }: KPICardsProps) {
  const kpis = [
    {
      label: 'Effectifs',
      value: data?.enrollment?.total || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100',
      format: 'number' as const,
    },
    {
      label: 'Assiduité',
      value: data?.attendance?.rate || 0,
      suffix: '%',
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-100',
      format: 'percent' as const,
    },
    {
      label: 'Recettes',
      value: data?.revenue?.total || 0,
      prefix: 'F CFA',
      icon: DollarSign,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-100',
      format: 'currency' as const,
    },
    {
      label: 'Alertes actives',
      value: data?.alerts?.count || 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-100',
      format: 'number' as const,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-24 mb-4" />
            <div className="h-8 bg-gray-200 rounded w-32 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  const formatValue = (value: number, prefix?: string, suffix?: string) => {
    if (prefix) {
      return `${value.toLocaleString('fr-FR')} ${prefix}`;
    }
    if (suffix) {
      return `${value.toLocaleString('fr-FR')} ${suffix}`;
    }
    return value.toLocaleString('fr-FR');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const hasData = kpi.value > 0;
        return (
          <div
            key={kpi.label}
            className={`bg-white rounded-xl border shadow-sm p-6 hover:shadow-md transition-shadow ${hasData ? kpi.borderColor : 'border-gray-200'}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${kpi.bgColor}`}>
                <Icon className={`w-6 h-6 ${kpi.color}`} />
              </div>
              {hasData && kpi.format !== 'currency' && (
                <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  Actif
                </span>
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
              <p className={`text-3xl font-bold ${hasData ? 'text-gray-900' : 'text-gray-300'}`}>
                {formatValue(kpi.value, kpi.prefix, kpi.suffix)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
