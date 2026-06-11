/**
 * ============================================================================
 * ENTITY SYNC INDICATOR - INDICATEUR VISUEL DE SYNCHRONISATION PAR ENTITÉ
 * ============================================================================
 *
 * Composant compact à afficher sur chaque ligne de données (élève, classe,
 * paiement, etc.) pour indiquer visuellement son statut de synchronisation.
 *
 * 3 états visuels :
 * - 🟢 SYNCED   (vert)  : Donnée synchronisée avec le serveur
 * - 🔵 PENDING  (bleu)  : Modification locale en attente de sync
 * - 🟠 CONFLICT (orange) : Conflit entre version locale et serveur
 * - 🔴 ERROR    (rouge)  : Erreur lors de la synchronisation
 * - ⚪ UNKNOWN  (gris)   : Statut indéterminé
 *
 * RÈGLE UX : Section 22.2 du Cahier Technique — Chaque donnée affichée
 * doit porter un indicateur visuel de son état de synchronisation.
 * ============================================================================
 */

'use client';

import { Cloud, CloudOff, AlertTriangle, RefreshCcw, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntitySyncStatus } from '@/hooks/useEntitySyncStatus';

export interface EntitySyncIndicatorProps {
  /** Statut de synchronisation de l'entité */
  status: EntitySyncStatus;
  /** Date/heure de dernière synchronisation (optionnel) */
  lastSync?: string | null;
  /** Type d'opération en attente (CREATE, UPDATE, DELETE) */
  pendingOperation?: 'CREATE' | 'UPDATE' | 'DELETE' | null;
  /** Message d'erreur (si status = ERROR ou CONFLICT) */
  errorMessage?: string | null;
  /** Variante d'affichage */
  variant?: 'badge' | 'dot' | 'icon' | 'tooltip';
  /** Classes CSS supplémentaires */
  className?: string;
}

const STATUS_CONFIG: Record<
  EntitySyncStatus,
  {
    icon: typeof Cloud;
    color: string;
    bg: string;
    dotColor: string;
    label: string;
    shortLabel: string;
    description: string;
  }
> = {
  SYNCED: {
    icon: Cloud,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
    dotColor: 'bg-green-500',
    label: 'Synchronisé',
    shortLabel: 'Sync',
    description: 'Donnée synchronisée avec le serveur',
  },
  PENDING: {
    icon: RefreshCcw,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    dotColor: 'bg-blue-500',
    label: 'En attente',
    shortLabel: 'Attente',
    description: 'Modification locale en attente de synchronisation',
  },
  CONFLICT: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
    dotColor: 'bg-orange-500',
    label: 'Conflit',
    shortLabel: 'Conflit',
    description: 'Conflit détecté — la version serveur diffère',
  },
  ERROR: {
    icon: CloudOff,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    dotColor: 'bg-red-500',
    label: 'Erreur',
    shortLabel: 'Erreur',
    description: 'Erreur lors de la synchronisation',
  },
  UNKNOWN: {
    icon: HelpCircle,
    color: 'text-gray-400',
    bg: 'bg-gray-50 border-gray-200',
    dotColor: 'bg-gray-400',
    label: 'Inconnu',
    shortLabel: '—',
    description: 'Statut de synchronisation indéterminé',
  },
};

/**
 * Indicateur visuel de synchronisation pour une entité.
 *
 * Plusieurs variantes d'affichage :
 * - `badge` : Badge complet avec icône + texte (défaut, pour les vues détaillées)
 * - `dot`   : Simple point coloré (pour les listes compactes / tableaux)
 * - `icon`  : Icône seule sans texte (pour les cartes)
 * - `tooltip`: Icône avec tooltip au survol (pour les tableaux denses)
 */
export default function EntitySyncIndicator({
  status,
  lastSync,
  pendingOperation,
  errorMessage,
  variant = 'badge',
  className,
}: EntitySyncIndicatorProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.UNKNOWN;
  const Icon = config.icon;

  // Construire le texte du tooltip
  const tooltipParts: string[] = [config.description];
  if (pendingOperation) {
    const opLabels = { CREATE: 'Création', UPDATE: 'Modification', DELETE: 'Suppression' };
    tooltipParts.push(`Opération : ${opLabels[pendingOperation]}`);
  }
  if (lastSync) {
    try {
      tooltipParts.push(`Dernière sync : ${new Date(lastSync).toLocaleString('fr-FR')}`);
    } catch {
      // Date invalide — ignorer
    }
  }
  if (errorMessage) {
    tooltipParts.push(`Erreur : ${errorMessage}`);
  }
  const tooltip = tooltipParts.join('\n');

  // === Variante DOT : point coloré minimal ===
  if (variant === 'dot') {
    return (
      <span
        className={cn(
          'inline-block w-2 h-2 rounded-full flex-shrink-0',
          config.dotColor,
          status === 'PENDING' && 'animate-pulse',
          className
        )}
        title={tooltip}
        aria-label={config.label}
      />
    );
  }

  // === Variante ICON : icône seule ===
  if (variant === 'icon') {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center',
          config.color,
          status === 'PENDING' && 'animate-pulse',
          className
        )}
        title={tooltip}
        aria-label={config.label}
      >
        <Icon size={14} className={status === 'PENDING' ? 'animate-spin' : ''} />
      </span>
    );
  }

  // === Variante TOOLTIP : icône avec popup au survol ===
  if (variant === 'tooltip') {
    return (
      <span className={cn('relative group inline-flex', className)}>
        <span
          className={cn(
            'inline-flex items-center justify-center cursor-help',
            config.color,
            status === 'PENDING' && 'animate-pulse'
          )}
          aria-label={config.label}
        >
          <Icon size={14} className={status === 'PENDING' ? 'animate-spin' : ''} />
        </span>
        {/* Tooltip */}
        <span
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs text-white whitespace-pre-line z-50',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none',
            'bg-gray-900 shadow-lg max-w-[280px]',
            status === 'CONFLICT' && 'bg-orange-700',
            status === 'ERROR' && 'bg-red-700'
          )}
          role="tooltip"
        >
          {tooltip}
          {/* Flèche */}
          <span
            className={cn(
              'absolute top-full left-1/2 -translate-x-1/2 -mt-px',
              'border-4 border-transparent border-t-gray-900',
              status === 'CONFLICT' && 'border-t-orange-700',
              status === 'ERROR' && 'border-t-red-700'
            )}
          />
        </span>
      </span>
    );
  }

  // === Variante BADGE (défaut) : badge complet avec icône + texte ===
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border tracking-wide transition-all',
        config.bg,
        config.color,
        status === 'PENDING' && 'animate-pulse',
        className
      )}
      title={tooltip}
      role="status"
      aria-label={config.label}
    >
      <Icon
        size={12}
        className={cn('flex-shrink-0', status === 'PENDING' && 'animate-spin')}
      />
      <span>{config.label}</span>
      {pendingOperation && status === 'PENDING' && (
        <span className="opacity-70 ml-0.5">
          ({pendingOperation === 'CREATE' ? 'création' : pendingOperation === 'UPDATE' ? 'modif.' : 'suppr.'})
        </span>
      )}
    </div>
  );
}
