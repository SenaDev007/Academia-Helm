/**
 * ============================================================================
 * ORION PANEL - PANEL ORION STANDARD
 * ============================================================================
 * 
 * Composant standard pour afficher les panels ORION dans les dashboards
 * Utilisé partout où ORION doit être visible
 * 
 * ============================================================================
 */

'use client';

import { ReactNode } from 'react';
import { Brain, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AlertCard } from '../cards/AlertCard';

export interface OrionPanelProps {
  title?: string;
  alerts?: Array<{
    id: string;
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'error' | 'success';
    action?: {
      label: string;
      onClick: () => void;
    };
  }>;
  summary?: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children?: ReactNode;
}

export function OrionPanel({
  title = 'ORION - Intelligence Pédagogique',
  alerts = [],
  summary,
  className,
  collapsible = false,
  defaultCollapsed = false,
  children,
}: OrionPanelProps) {
  return (
    <div className={cn('rounded-lg border border-blue-200 bg-blue-50/50 p-6', className)}>
      <div className="flex items-start space-x-3 mb-4">
        <div className="p-2 rounded-lg bg-blue-100">
          <Brain className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-600">
            Alertes et insights en temps réel
          </p>
        </div>
      </div>

      {summary && <div className="mb-4">{summary}</div>}
      
      {children && <div className="mb-4">{children}</div>}

      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              title={alert.title}
              message={alert.message}
              severity={alert.severity}
              action={alert.action}
            />
          ))}
        </div>
      )}

      {alerts.length === 0 && !summary && (
        <div className="text-center py-8 text-sm text-gray-500">
          Aucune alerte pour le moment
        </div>
      )}
    </div>
  );
}
