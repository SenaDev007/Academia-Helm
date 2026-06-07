/**
 * Template de Modal avec SEO et Accessibilité
 * 
 * Utilisez ce template pour créer de nouveaux modals
 * Optimisé pour l'accessibilité et le SEO
 */

'use client';

import { useEffect, useRef } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface ModalTemplateProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  ariaLabel: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

export default function ModalTemplate({
  isOpen,
  onClose,
  title,
  ariaLabel,
  children,
  size = 'md',
  showCloseButton = true,
}: ModalTemplateProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Gestion de l'accessibilité : focus trap et fermeture avec Escape
  useEffect(() => {
    if (!isOpen) return;

    // Sauvegarder l'élément qui avait le focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus sur le modal
    const modal = modalRef.current;
    if (modal) {
      const firstFocusable = modal.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }

    // Fermeture avec Escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Empêcher le scroll du body
    document.body.style.overflow = 'hidden';

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      // Restaurer le focus
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal — bottom-sheet mobile, centré md+ (spec responsive) */}
      <div className="flex min-h-full items-end md:items-center justify-center p-0 md:p-4">
        <div
          ref={modalRef}
          className={cn(
            'relative bg-white shadow-2xl w-full max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-2xl',
            sizeClasses[size],
            'transform transition-all'
          )}
          role="document"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2
              id="modal-title"
              className="text-2xl font-bold text-gray-900"
            >
              {title}
            </h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Fermer le modal"
                type="button"
              >
                <AppIcon name="close" size="menu" className="text-gray-600" />
              </button>
            )}
          </div>

          {/* Content */}
          <div
            id="modal-description"
            className="p-6"
            aria-label={ariaLabel}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

