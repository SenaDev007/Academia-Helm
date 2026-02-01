/**
 * ============================================================================
 * KPI CARD WIDGET - WIDGET RÉUTILISABLE POUR KPI
 * ============================================================================
 */

'use client';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  onClick?: () => void;
}

export function KpiCard({ title, value, subtitle, trend, icon, onClick }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white p-6 rounded-lg shadow ${
        onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center">
              <span
                className={`text-xs font-medium ${
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-gray-500 ml-1">vs mois dernier</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="ml-4 text-gray-400">{icon}</div>
        )}
      </div>
    </div>
  );
}
