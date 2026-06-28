/**
 * ============================================================================
 * CONFIRM DIALOG - MODAL DE CONFIRMATION PROFESSIONNEL
 * ============================================================================
 *
 * Remplace window.confirm() par un modal élégant avec :
 * - Icônes contextuelles (danger, warning, info, success)
 * - Animations fluides
 * - Support du loading state
 * - Variante destructive (suppression) avec texte de confirmation
 * - Design cohérent avec le design system
 *
 * Usage avec le hook useConfirmDialog :
 *   const confirm = useConfirmDialog();
 *   const ok = await confirm.danger('Supprimer ?', 'Cette action est irréversible.');
 *   if (ok) { ... }
 *
 * ============================================================================
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Trash2,
  XCircle,
  Info,
  CheckCircle,
  ShieldAlert,
  Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfirmType = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmOptions {
  /** Titre du modal */
  title?: string;
  /** Message descriptif */
  description: string;
  /** Type de confirmation (détermine l'icône et les couleurs) */
  type?: ConfirmType;
  /** Label du bouton de confirmation */
  confirmLabel?: string;
  /** Label du bouton d'annulation */
  cancelLabel?: string;
  /** Si true, le bouton confirm a le style destructif */
  destructive?: boolean;
  /** Texte optionnel supplémentaire (ex: détails sur les conséquences) */
  details?: string;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolving: boolean;
  resolver: ((value: boolean) => void) | null;
}

const INITIAL_STATE: ConfirmState = {
  open: false,
  resolving: false,
  title: '',
  description: '',
  type: 'warning',
  confirmLabel: 'Confirmer',
  cancelLabel: 'Annuler',
  destructive: false,
  details: '',
  resolver: null,
};

// ─── Configuration visuelle par type ──────────────────────────────────────────

const TYPE_CONFIG: Record<
  ConfirmType,
  {
    icon: React.ElementType;
    iconColor: string;
    iconBg: string;
    ringColor: string;
  }
> = {
  danger: {
    icon: Trash2,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-50',
    ringColor: 'ring-red-100',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
    ringColor: 'ring-amber-100',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
    ringColor: 'ring-blue-100',
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    ringColor: 'ring-emerald-100',
  },
};

// ─── Composant ConfirmDialog ──────────────────────────────────────────────────

export function ConfirmDialog({
  state,
  onConfirm,
  onCancel,
}: {
  state: ConfirmState;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const config = TYPE_CONFIG[state.type || 'warning'];
  const Icon = config.icon;

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[440px] p-0 overflow-hidden rounded-2xl ring-1 ring-slate-200/60 shadow-xl"
      >
        {/* ─── Header section with icon + title + description ─── */}
        <div className="px-7 pt-7 pb-5">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-2xl ring-1',
                config.iconBg,
                config.ringColor
              )}
            >
              <Icon className={cn('w-7 h-7', config.iconColor)} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <DialogTitle className="text-lg font-bold text-slate-900 leading-tight">
                {state.title || 'Confirmation'}
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {state.description}
              </DialogDescription>
              {state.details && (
                <div className="mt-3 text-xs text-slate-600 bg-slate-50 rounded-lg px-3.5 py-2.5 border border-slate-200/70 leading-relaxed">
                  {state.details}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Footer with action buttons — well separated and padded ─── */}
        <div className="flex items-center justify-end gap-3 px-7 py-5 bg-slate-50/80 border-t border-slate-200/60">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={state.resolving}
            className="min-w-[110px] h-10 font-medium rounded-lg border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            {state.cancelLabel}
          </Button>
          <Button
            variant={state.destructive || state.type === 'danger' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={state.resolving}
            className={cn(
              'min-w-[110px] h-10 font-semibold rounded-lg gap-2 transition-all',
              state.type === 'danger'
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-200 focus-visible:ring-red-500/30'
                : state.type === 'warning'
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-200'
                : state.type === 'success'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200'
            )}
          >
            {state.resolving && <Loader2 className="h-4 w-4 animate-spin" />}
            {state.resolving ? 'Traitement...' : state.confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hook useConfirmDialog ────────────────────────────────────────────────────

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState>(INITIAL_STATE);

  const confirm = useCallback(
    (options: ConfirmOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({
          ...INITIAL_STATE,
          ...options,
          open: true,
          resolving: false,
          resolver: resolve,
          type: options.type || (options.destructive ? 'danger' : 'warning'),
          confirmLabel: options.confirmLabel || (options.destructive ? 'Supprimer' : 'Confirmer'),
        });
      });
    },
    []
  );

  // Shorthand methods
  const danger = useCallback(
    (description: string, title?: string, details?: string) =>
      confirm({
        title: title || 'Action irréversible',
        description,
        type: 'danger',
        destructive: true,
        confirmLabel: 'Supprimer',
        details,
      }),
    [confirm]
  );

  const warning = useCallback(
    (description: string, title?: string, details?: string) =>
      confirm({
        title: title || 'Attention',
        description,
        type: 'warning',
        confirmLabel: 'Confirmer',
        details,
      }),
    [confirm]
  );

  const info = useCallback(
    (description: string, title?: string) =>
      confirm({
        title: title || 'Information',
        description,
        type: 'info',
        confirmLabel: 'OK',
      }),
    [confirm]
  );

  const success = useCallback(
    (description: string, title?: string) =>
      confirm({
        title: title || 'Succès',
        description,
        type: 'success',
        confirmLabel: 'Continuer',
      }),
    [confirm]
  );

  const handleConfirm = useCallback(() => {
    if (state.resolver) {
      // Don't close immediately - let the calling code handle it
      state.resolver(true);
    }
    setState((prev) => ({ ...prev, open: false, resolver: null }));
  }, [state.resolver]);

  const handleCancel = useCallback(() => {
    if (state.resolver) {
      state.resolver(false);
    }
    setState((prev) => ({ ...prev, open: false, resolver: null }));
  }, [state.resolver]);

  const dialog = (
    <ConfirmDialog state={state} onConfirm={handleConfirm} onCancel={handleCancel} />
  );

  return { confirm, danger, warning, info, success, dialog };
}
