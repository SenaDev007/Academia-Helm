/**
 * Sync Status Badge Component
 * 
 * Badge à afficher sur chaque ligne de liste pour indiquer
 * l'état de synchronisation de l'enregistrement.
 * 
 * RÈGLE : Section 22.2 du Cahier Technique
 */

'use client';

import { Cloud, CloudOff, AlertCircle, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SyncStatus = 'SYNCED' | 'PENDING' | 'ERROR' | 'CONFLICT';

interface SyncStatusBadgeProps {
  status: SyncStatus;
  lastSync?: string;
  className?: string;
}

export default function SyncStatusBadge({ status, lastSync, className }: SyncStatusBadgeProps) {
  const configs = {
    SYNCED: {
      icon: Cloud,
      color: 'text-green-500',
      bg: 'bg-green-50',
      label: 'Synchronisé'
    },
    PENDING: {
      icon: RefreshCcw,
      color: 'text-blue-500',
      bg: 'bg-blue-50',
      label: 'En attente'
    },
    ERROR: {
      icon: CloudOff,
      color: 'text-red-500',
      bg: 'bg-red-50',
      label: 'Erreur'
    },
    CONFLICT: {
      icon: AlertCircle,
      color: 'text-orange-500',
      bg: 'bg-orange-50',
      label: 'Conflit'
    }
  };

  const config = configs[status];
  const Icon = config.icon;

  return (
    <div 
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
        config.bg,
        config.color,
        className
      )}
      title={lastSync ? `Dernière sync : ${new Date(lastSync).toLocaleString()}` : config.label}
    >
      <Icon size={12} className={status === 'PENDING' ? 'animate-spin' : ''} />
      <span>{config.label}</span>
    </div>
  );
}
