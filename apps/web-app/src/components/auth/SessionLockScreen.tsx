/**
 * ============================================================================
 * SESSION LOCK SCREEN
 * ============================================================================
 *
 * Écran de verrouillage plein écran affiché après inactivité prolongée.
 * L'utilisateur doit saisir ses identifiants pour déverrouiller la session
 * et reprendre son travail là où il en était.
 *
 * Après 30 minutes de verrouillage sans interaction → déconnexion automatique.
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Lock, Mail, Eye, EyeOff, LogOut, Loader, AlertCircle } from 'lucide-react';
import { useSessionManager } from '@/contexts/SessionManagerContext';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { BRAND } from '@/lib/brand';

const NAVY = '#0b2f73';
const GOLD = '#f5b335';

export default function SessionLockScreen() {
  const { sessionState, handleUnlock, handleLogoutFromLock } = useSessionManager();
  const { shouldReduceMotion } = useMotionBudget();

  const isVisible = sessionState === 'locked';

  // Champs du formulaire
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-remplir l'email depuis la session stockée
  useEffect(() => {
    if (!isVisible) return;
    try {
      const raw = localStorage.getItem('session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.user?.email) {
          setEmail(parsed.user.email);
        }
      }
    } catch {}
  }, [isVisible]);

  // Réinitialiser le formulaire quand l'écran apparaît
  useEffect(() => {
    if (isVisible) {
      setPassword('');
      setError(null);
      setShowPassword(false);
      setIsLoading(false);
    }
  }, [isVisible]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password.trim()) {
        setError('Veuillez saisir votre mot de passe.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await handleUnlock(email, password);
        if (!result.success) {
          setError(result.error || 'Identifiants incorrects.');
          setPassword('');
        }
      } catch {
        setError('Erreur de connexion. Veuillez réessayer.');
        setPassword('');
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, handleUnlock],
  );

  const dur = useMemo(
    () => (shouldReduceMotion ? 0 : 0.35),
    [shouldReduceMotion],
  );

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="lock-screen-backdrop"
          initial={shouldReduceMotion ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900/95 via-[#0b2f73]/90 to-slate-900/95 backdrop-blur-md"
        >
          {/* Effets de fond décoratifs */}
          <div className="pointer-events-none absolute inset-0 opacity-30" aria-hidden>
            {!shouldReduceMotion && (
              <>
                <motion.div
                  className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl"
                  animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
                  transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute -right-16 bottom-24 h-80 w-80 rounded-full bg-amber-300/15 blur-3xl"
                  animate={{ x: [0, -16, 0], y: [0, 14, 0] }}
                  transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
                />
              </>
            )}
          </div>

          <motion.div
            key="lock-screen-card"
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: dur, ease: 'easeOut' }}
            className="relative z-10 mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur-md md:p-10"
            style={{
              boxShadow: `0 24px 48px -12px rgba(11,47,115,0.3), 0 0 0 1px ${GOLD}18`,
            }}
          >
            {/* En-tête */}
            <div className="mb-8 flex flex-col items-center text-center">
              {/* Logo */}
              <div className="mb-4">
                <Image
                  src="/images/logo-Academia Hub.png"
                  alt={BRAND.name}
                  width={80}
                  height={80}
                  className="h-16 w-16 object-contain opacity-70 grayscale-[30%]"
                  priority
                />
              </div>

              {/* Icône verrou */}
              <motion.div
                className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: '#dbeafe' }}
                animate={
                  shouldReduceMotion
                    ? undefined
                    : { scale: [1, 1.05, 1] }
                }
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Lock className="h-8 w-8" style={{ color: NAVY }} />
              </motion.div>

              <h2 className="text-2xl font-bold text-slate-900">
                Session verrouillée
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Saisissez vos identifiants pour déverrouiller
                <br />
                et reprendre votre travail.
              </p>
            </div>

            {/* Message d'erreur */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                  className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/95 p-3.5 shadow-sm"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <p className="text-sm text-red-800">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Formulaire de déverrouillage */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email (pré-rempli, désactivé) */}
              <div>
                <label
                  htmlFor="lock-email"
                  className="mb-2 block text-sm font-semibold text-slate-900"
                >
                  Adresse email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    id="lock-email"
                    value={email}
                    readOnly
                    disabled
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-500 placeholder:text-slate-400"
                    placeholder="votre.email@etablissement.com"
                  />
                </div>
              </div>

              {/* Mot de passe */}
              <div>
                <label
                  htmlFor="lock-password"
                  className="mb-2 block text-sm font-semibold text-slate-900"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="lock-password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-12 transition-all placeholder:text-slate-400 focus:border-[#0b2f73] focus:ring-[#0b2f73]"
                    placeholder="••••••••"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Bouton Déverrouiller */}
              <motion.button
                type="submit"
                disabled={isLoading || !password.trim()}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${NAVY}, #144798)`,
                }}
              >
                {isLoading ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    Vérification...
                  </>
                ) : (
                  <>
                    <Lock className="h-5 w-5" />
                    Déverrouiller
                  </>
                )}
              </motion.button>
            </form>

            {/* Lien de déconnexion */}
            <div className="mt-6 text-center">
              <button
                onClick={handleLogoutFromLock}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
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
