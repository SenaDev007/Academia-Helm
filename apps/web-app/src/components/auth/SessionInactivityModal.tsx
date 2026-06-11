/**
 * ============================================================================
 * SESSION INACTIVITY MODAL
 * ============================================================================
 *
 * Modal d'avertissement affiché après 15 minutes d'inactivité.
 * Compte à rebours de 30 secondes avec indicateur circulaire.
 *
 * - L'utilisateur peut cliquer « Rester connecté(e) » pour continuer
 * - Si aucune action dans les 30 secondes → la session est verrouillée
 * ============================================================================
 */

'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, LogOut, ShieldAlert } from 'lucide-react';
import { useSessionManager } from '@/contexts/SessionManagerContext';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';

const NAVY = '#0b2f73';
const GOLD = '#f5b335';
const WARNING_COUNTDOWN_S = 30;

export default function SessionInactivityModal() {
  const { sessionState, countdownSeconds, handleStayConnected, handleLogoutFromLock } =
    useSessionManager();
  const { shouldReduceMotion } = useMotionBudget();

  const isVisible = sessionState === 'warning';

  // Pourcentage restant pour l'indicateur circulaire
  const progressPercent = useMemo(
    () => Math.max(0, (countdownSeconds / WARNING_COUNTDOWN_S) * 100),
    [countdownSeconds],
  );

  // Rayon du cercle SVG
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="session-inactivity-backdrop"
          initial={shouldReduceMotion ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            // Ne pas fermer en cliquant sur le fond
            e.stopPropagation();
          }}
        >
          <motion.div
            key="session-inactivity-modal"
            initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative mx-4 w-full max-w-md rounded-2xl border border-amber-200/80 bg-white p-8 shadow-2xl"
            style={{ boxShadow: `0 24px 48px -12px rgba(0,0,0,0.25), 0 0 0 1px ${GOLD}20` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête avec icône */}
            <div className="mb-6 flex flex-col items-center text-center">
              <div
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: '#fef3c7' }}
              >
                <ShieldAlert className="h-8 w-8 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Session inactive
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Aucune activité détectée depuis 15 minutes.
                <br />
                Votre session sera verrouillée automatiquement.
              </p>
            </div>

            {/* Indicateur circulaire de compte à rebours */}
            <div className="mb-6 flex items-center justify-center">
              <div className="relative flex h-28 w-28 items-center justify-center">
                <svg className="absolute h-28 w-28 -rotate-90" viewBox="0 0 100 100">
                  {/* Cercle de fond */}
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="5"
                  />
                  {/* Cercle de progression */}
                  <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    stroke={countdownSeconds <= 10 ? '#ef4444' : GOLD}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{
                      transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease',
                    }}
                  />
                </svg>
                <div className="flex flex-col items-center">
                  <span
                    className="text-3xl font-bold tabular-nums"
                    style={{
                      color: countdownSeconds <= 10 ? '#ef4444' : NAVY,
                    }}
                  >
                    {countdownSeconds}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    secondes
                  </span>
                </div>
              </div>
            </div>

            {/* Message d'urgence si temps presque écoulé */}
            {countdownSeconds <= 10 && (
              <motion.p
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 text-center text-xs font-semibold text-red-600"
              >
                <Clock className="mr-1 inline h-3 w-3" />
                Déverrouillage imminent ! Cliquez pour rester connecté(e).
              </motion.p>
            )}

            {/* Boutons d'action */}
            <div className="space-y-3">
              <motion.button
                onClick={handleStayConnected}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg transition-colors"
                style={{
                  background: `linear-gradient(135deg, ${NAVY}, #144798)`,
                }}
              >
                Rester connecté(e)
              </motion.button>

              <button
                onClick={handleLogoutFromLock}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
