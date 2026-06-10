/**
 * ============================================================================
 * ORION SUMMARY - RÉSUMÉ ORION
 * ============================================================================
 * 
 * Composant standard pour afficher un résumé ORION
 * 
 * ============================================================================
 */

'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatCard } from '../cards/StatCard';

export interface OrionMetric {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export interface OrionSummaryProps {
  metrics: OrionMetric[];
  className?: string;
}

export function OrionSummary({ metrics, className }: OrionSummaryProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4', className)}>
      {metrics.map((metric, index) => (
        <StatCard
          key={index}
          title={metric.label}
          value={metric.value}
          trend={
            metric.trend
              ? {
                  value: metric.trend.value,
                  label: 'vs période précédente',
                  isPositive: metric.trend.isPositive,
                }
              : undefined
          }
          variant="primary"
        />
      ))}
    </div>
  );
}
