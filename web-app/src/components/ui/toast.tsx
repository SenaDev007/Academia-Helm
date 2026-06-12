/**
 * Toast Component
 * 
 * Composant de notification toast avec système d'appel global
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertTriangle, XCircle, X, Info } from 'lucide-react';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info' | 'destructive';

export interface ToastProps {
  id?: string;
  variant?: ToastVariant;
  title: string;
  description?: string;
  message?: string;
  duration?: number;
  autoClose?: boolean;
  onClose?: () => void;
}

// Système d'événements pour appeler les toasts de n'importe où
type ToastEventDetail = ToastProps;
const TOAST_EVENT = 'academia-toast';

export const toast = (props: ToastProps) => {
  const event = new CustomEvent(TOAST_EVENT, { detail: props });
  window.dispatchEvent(event);
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const addToast = useCallback((toast: ToastProps) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
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
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onRemove={() => t.id && removeToast(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ 
  id, 
  variant = 'info', 
  title, 
  description, 
  message, 
  duration = 5000, 
  autoClose = true,
  onClose,
  onRemove 
}: ToastProps & { onRemove?: () => void }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!autoClose) return;
    
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        if (onRemove) onRemove();
        if (onClose) onClose();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onRemove, autoClose, onClose]);

  const variants = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    error: 'bg-rose-50 border-rose-200 text-rose-900',
    destructive: 'bg-rose-600 border-rose-700 text-white',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
  };

  const icons = {
    success: CheckCircle,
    warning: AlertTriangle,
    error: XCircle,
    destructive: AlertTriangle,
    info: Info,
  };

  const Icon = icons[variant];

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl transition-all duration-300 animate-in slide-in-from-right-5 fade-in',
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10',
        variants[variant]
      )}
    >
      <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', variant === 'destructive' ? 'text-white' : '')} />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">{title}</div>
        {(description || message) && <div className="text-xs mt-1 opacity-90">{description || message}</div>}
      </div>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => {
            if (onRemove) onRemove();
            if (onClose) onClose();
          }, 300);
        }}
        className="ml-2 flex-shrink-0 rounded-md p-1 hover:bg-black/10 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Alias pour compatibilité Shadcn si nécessaire
export const Toast = ToastItem;
