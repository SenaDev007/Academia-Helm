/**
 * ============================================================================
 * STAT CARD - CARTE DE STATISTIQUE (KPI)
 * ============================================================================
 * 
 * Composant standard pour afficher des statistiques/KPI
 * Utilisé dans tous les dashboards
 * 
 * ============================================================================
 */

'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'default',
  className,
  onClick,
}: StatCardProps) {
  const variantStyles = {
    default: 'bg-white border-gray-200',
    primary: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    danger: 'bg-red-50 border-red-200',
  };

  const iconStyles = {
    default: 'text-gray-600 bg-gray-100',
    primary: 'text-blue-600 bg-blue-100',
    success: 'text-green-600 bg-green-100',
    warning: 'text-yellow-600 bg-yellow-100',
    danger: 'text-red-600 bg-red-100',
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-6 transition-shadow',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:shadow-md',
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className="mt-2 flex items-center">
              <span
                className={cn(
                  'text-sm font-medium',
                  trend.isPositive ? 'text-green-600' : 'text-red-600',
                )}
              >
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-sm text-gray-500 ml-2">{trend.label}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn('p-3 rounded-lg', iconStyles[variant])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
