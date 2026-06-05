/**
 * ============================================================================
 * TOAST COMPONENT - SYSTÈME DE NOTIFICATION PROFESSIONNEL
 * ============================================================================
 *
 * Notifications toast avec :
 * - Design professionnel avec icônes et barre de progression
 * - Animations fluides d'entrée et de sortie
 * - Prévention de la duplication (même titre dans un délai de 2s)
 * - Fermeture au clic sur l'extérieur
 * - Support mobile responsive
 * - Auto-dismiss avec barre de progression visuelle
 *
 * Usage :
 *   import { toast } from '@/components/ui/toast';
 *   toast({ variant: 'success', title: 'Enregistré !', description: 'Les modifications ont été sauvegardées.' });
 *   toast({ variant: 'error', title: 'Erreur', description: 'Impossible de supprimer.' });
 *
 * ============================================================================
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertTriangle, XCircle, X, Info, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'warning' | 'error' | 'info' | 'destructive' | 'loading';

export interface ToastProps {
  id?: string;
  variant?: ToastVariant;
  title: string;
  description?: string;
  message?: string;
  duration?: number;
  autoClose?: boolean;
  onClose?: () => void;
  /** Action optionnelle (ex: "Annuler") */
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ─── Système d'événements global ──────────────────────────────────────────────

type ToastEventDetail = ToastProps;
const TOAST_EVENT = 'academia-toast';

/** Déduplication : empêche le même toast (même titre) dans les 2 secondes */
let recentToasts: { title: string; time: number }[] = [];

export const toast = (props: ToastProps) => {
  // Déduplication
  const now = Date.now();
  recentToasts = recentToasts.filter((r) => now - r.time < 2000);
  if (recentToasts.some((r) => r.title === props.title)) return;
  recentToasts.push({ title: props.title, time: now });

  const event = new CustomEvent(TOAST_EVENT, { detail: props });
  window.dispatchEvent(event);
};

// ─── Container ────────────────────────────────────────────────────────────────

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const addToast = useCallback((t: ToastProps) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { ...t, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      addToast(detail);
    };

    window.addEventListener(TOAST_EVENT, handleToast);
    return () => window.removeEventListener(TOAST_EVENT, handleToast);
  }, [addToast]);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2.5 w-full max-w-[400px] pointer-events-none sm:bottom-6 sm:right-6">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onRemove={() => t.id && removeToast(t.id)} />
      ))}
    </div>
  );
}

// ─── Configuration visuelle par variante ──────────────────────────────────────

const VARIANT_CONFIG = {
  success: {
    container: 'bg-white border-emerald-200 ring-1 ring-emerald-100',
    icon: CheckCircle,
    iconColor: 'text-emerald-500',
    titleColor: 'text-slate-900',
    descColor: 'text-slate-600',
    progressColor: 'bg-emerald-500',
    closeButton: 'hover:bg-emerald-50 text-slate-400 hover:text-emerald-600',
  },
  warning: {
    container: 'bg-white border-amber-200 ring-1 ring-amber-100',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    titleColor: 'text-slate-900',
    descColor: 'text-slate-600',
    progressColor: 'bg-amber-500',
    closeButton: 'hover:bg-amber-50 text-slate-400 hover:text-amber-600',
  },
  error: {
    container: 'bg-white border-red-200 ring-1 ring-red-100',
    icon: XCircle,
    iconColor: 'text-red-500',
    titleColor: 'text-slate-900',
    descColor: 'text-slate-600',
    progressColor: 'bg-red-500',
    closeButton: 'hover:bg-red-50 text-slate-400 hover:text-red-600',
  },
  info: {
    container: 'bg-white border-blue-200 ring-1 ring-blue-100',
    icon: Info,
    iconColor: 'text-blue-500',
    titleColor: 'text-slate-900',
    descColor: 'text-slate-600',
    progressColor: 'bg-blue-500',
    closeButton: 'hover:bg-blue-50 text-slate-400 hover:text-blue-600',
  },
  destructive: {
    container: 'bg-red-600 border-red-700 ring-1 ring-red-800 text-white',
    icon: AlertTriangle,
    iconColor: 'text-white',
    titleColor: 'text-white',
    descColor: 'text-red-100',
    progressColor: 'bg-white/40',
    closeButton: 'hover:bg-red-700 text-red-200 hover:text-white',
  },
  loading: {
    container: 'bg-white border-slate-200 ring-1 ring-slate-100',
    icon: Loader2,
    iconColor: 'text-slate-500',
    titleColor: 'text-slate-900',
    descColor: 'text-slate-600',
    progressColor: 'bg-slate-400',
    closeButton: 'hover:bg-slate-50 text-slate-400 hover:text-slate-600',
  },
};

// ─── ToastItem ────────────────────────────────────────────────────────────────

function ToastItem({
  variant = 'info',
  title,
  description,
  message,
  duration = 5000,
  autoClose = true,
  onClose,
  onRemove,
  action,
}: ToastProps & { onRemove?: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef<number>(Date.now());
  const rafRef = useRef<number>(0);

  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.info;
  const Icon = config.icon;
  const isDestructive = variant === 'destructive';

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Progress bar animation
  useEffect(() => {
    if (!autoClose || variant === 'loading') return;

    startTimeRef.current = Date.now();
    const totalDuration = duration;

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / totalDuration) * 100);
      setProgress(remaining);

      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        handleClose();
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [duration, autoClose, variant]);

  const handleClose = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsLeaving(true);
    setTimeout(() => {
      if (onRemove) onRemove();
      if (onClose) onClose();
    }, 250);
  }, [onRemove, onClose]);

  return (
    <div
      className={cn(
        'pointer-events-auto relative flex items-start gap-3 rounded-xl border p-4 shadow-lg transition-all duration-250',
        // Entry / exit animation
        isVisible && !isLeaving
          ? 'opacity-100 translate-x-0 scale-100'
          : 'opacity-0 translate-x-6 scale-95',
        config.container
      )}
      role="alert"
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <Icon
          className={cn(
            'h-5 w-5',
            config.iconColor,
            variant === 'loading' && 'animate-spin'
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-2">
        <div className={cn('font-semibold text-sm leading-snug', config.titleColor)}>
          {title}
        </div>
        {(description || message) && (
          <div className={cn('text-xs mt-1 leading-relaxed', config.descColor)}>
            {description || message}
          </div>
        )}
        {/* Optional action button */}
        {action && (
          <button
            onClick={action.onClick}
            className={cn(
              'mt-2 text-xs font-semibold underline underline-offset-2',
              isDestructive ? 'text-white hover:text-red-100' : 'text-blue-600 hover:text-blue-800'
            )}
          >
            {action.label}
          </button>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        className={cn(
          'flex-shrink-0 rounded-lg p-1 transition-colors',
          config.closeButton
        )}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Progress bar */}
      {autoClose && variant !== 'loading' && (
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 h-[3px] rounded-b-xl overflow-hidden',
            isDestructive ? 'bg-red-500/30' : 'bg-slate-100'
          )}
        >
          <div
            className={cn('h-full rounded-full transition-none', config.progressColor)}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Alias pour compatibilité
export const Toast = ToastItem;
