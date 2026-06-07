/**
 * ============================================================================
 * ORION ALERT ITEM - ÉLÉMENT D'ALERTE ORION
 * ============================================================================
 * 
 * Composant standard pour un élément d'alerte ORION
 * 
 * ============================================================================
 */

'use client';

import { AlertTriangle, Info, CheckCircle, XCircle, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AlertCard, AlertSeverity } from '../cards/AlertCard';

export interface OrionAlertItemProps {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  timestamp?: Date;
  category?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  className?: string;
}

export function OrionAlertItem({
  id,
  title,
  message,
  severity,
  timestamp,
  category,
  action,
  onDismiss,
  className,
}: OrionAlertItemProps) {
  return (
    <AlertCard
      title={title}
      message={message}
      severity={severity}
      action={action}
      onDismiss={onDismiss}
      className={className}
    />
  );
}
