/**
 * LogoutConfirmationModal Component
 * 
 * Modal de confirmation de déconnexion sécurisée
 * Étape 1 du flow de logout
 */

'use client';

import { LogOut, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { getMessageText } from '@/lib/messages/system-messages';
import { getFadeMotion, getModalMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';

export interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal de confirmation de déconnexion
 * 
 * @example
 * ```tsx
 * <LogoutConfirmationModal
 *   isOpen={showLogout}
 *   onConfirm={handleLogout}
 *   onCancel={() => setShowLogout(false)}
 * />
 * ```
 */
export function LogoutConfirmationModal({
  isOpen,
  onConfirm,
  onCancel,
}: LogoutConfirmationModalProps) {
  const { shouldReduceMotion } = useMotionBudget();
  const fadeMotion = getFadeMotion(shouldReduceMotion);
  const modalMotion = getModalMotion(shouldReduceMotion);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          initial={fadeMotion.initial}
          animate={fadeMotion.animate}
          exit={fadeMotion.exit}
          transition={fadeMotion.transition}
        >
          <motion.div
            className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 border border-blue-100"
            initial={modalMotion.initial}
            animate={modalMotion.animate}
            exit={modalMotion.exit}
            transition={modalMotion.transition}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <LogOut className="h-5 w-5 text-orange-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Déconnexion
                </h2>
              </div>
              <button
                onClick={onCancel}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-gray-900 mb-2">
                {getMessageText('logout.confirmation.title')}
              </p>
              <p className="text-sm text-gray-600">
                {getMessageText('logout.confirmation.description')}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={onCancel}
                className="min-w-[100px]"
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={onConfirm}
                className="min-w-[140px]"
              >
                Se déconnecter
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
