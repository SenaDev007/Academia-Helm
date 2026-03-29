/**
 * ============================================================================
 * BASE MODAL - COMPOSANT DE BASE POUR TOUS LES MODALS
 * ============================================================================
 * 
 * Modal de base avec :
 * - Structure standardisée (Header, Body, Footer)
 * - Accessibilité (focus trap, ARIA)
 * - Gestion du contexte (année, niveau, langue)
 * - Support offline-first
 * 
 * ============================================================================
 */

'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { getFadeMotion, getModalMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';

export interface BaseModalProps {
  /** Titre du modal */
  title: string;
  /** Sous-titre métier (optionnel) */
  subtitle?: string;
  /** Contenu principal */
  children: ReactNode;
  /** Ouvert/fermé */
  isOpen: boolean;
  /** Callback de fermeture */
  onClose: () => void;
  /** Footer (boutons) */
  footer?: ReactNode;
  /** Taille */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Désactiver la fermeture par ESC (pour modals critiques) */
  disableEscClose?: boolean;
  /** Désactiver la fermeture par clic sur overlay (pour modals critiques) */
  disableOverlayClose?: boolean;
  /** Afficher le contexte (année, niveau, langue) */
  showContext?: boolean;
  /** Style personnalisé */
  className?: string;
}

export default function BaseModal({
  title,
  subtitle,
  children,
  isOpen,
  onClose,
  footer,
  size = 'md',
  disableEscClose = false,
  disableOverlayClose = false,
  showContext = true,
  className,
}: BaseModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const { academicYear, schoolLevel, isBilingualEnabled } = useModuleContext();
  const { shouldReduceMotion } = useMotionBudget();
  const fadeMotion = getFadeMotion(shouldReduceMotion);
  const modalMotion = getModalMotion(shouldReduceMotion);

  // Focus trap
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    // Focus sur le modal
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    if (firstElement) {
      firstElement.focus();
    }

    // Gestion ESC
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableEscClose) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, disableEscClose, onClose]);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <motion.div
            className="fixed inset-0 bg-black/55 backdrop-blur-[2px]"
            onClick={disableOverlayClose ? undefined : onClose}
            aria-hidden="true"
            initial={fadeMotion.initial}
            animate={fadeMotion.animate}
            exit={fadeMotion.exit}
            transition={fadeMotion.transition}
          />

          {/* Modal — bottom-sheet mobile, centré md+ */}
          <div className="flex min-h-full items-end md:items-center justify-center p-0 md:p-4">
            <motion.div
              ref={modalRef}
              className={cn(
                'relative bg-white/98 shadow-2xl w-full max-h-[90vh] overflow-y-auto',
                'rounded-t-2xl md:rounded-2xl border border-white/70',
                sizeClasses[size],
                className
              )}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              aria-describedby={subtitle ? 'modal-subtitle' : undefined}
              initial={modalMotion.initial}
              animate={modalMotion.animate}
              exit={modalMotion.exit}
              transition={modalMotion.transition}
            >
              <div className="absolute inset-0 pointer-events-none rounded-t-2xl md:rounded-2xl bg-[radial-gradient(circle_at_top_right,rgba(245,179,53,0.10),transparent_42%)]" />
              {/* Drag handle mobile */}
              <div className="md:hidden w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4 mt-3 flex-shrink-0" aria-hidden />
              {/* Header */}
              <div className="relative flex items-start justify-between px-4 md:px-6 py-4 border-b border-gray-200/80">
                <div className="flex-1 min-w-0">
                  <h2
                    id="modal-title"
                    className="text-lg font-semibold text-gray-900"
                  >
                    {title}
                  </h2>
                  {subtitle && (
                    <p
                      id="modal-subtitle"
                      className="text-sm text-gray-600 mt-1"
                    >
                      {subtitle}
                    </p>
                  )}
                  {showContext && (academicYear || schoolLevel) && (
                    <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                      {academicYear && (
                        <span>Année: {academicYear.label}</span>
                      )}
                      {schoolLevel && (
                        <>
                          <span>•</span>
                          <span>Niveau: {schoolLevel.label}</span>
                        </>
                      )}
                      {isBilingualEnabled && (
                        <>
                          <span>•</span>
                          <span>Bilingue activé</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {!disableEscClose && (
                  <button
                    onClick={onClose}
                    className="ml-4 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    aria-label="Fermer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="relative px-6 py-4 max-h-[60vh] overflow-y-auto">
                {children}
              </div>

              {/* Footer */}
              {footer && (
                <div className="relative flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200/80 bg-gray-50/80 backdrop-blur">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

