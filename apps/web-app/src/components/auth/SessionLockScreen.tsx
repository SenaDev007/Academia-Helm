/**
 * ============================================================================
 * SESSION LOCK SCREEN — Horizontal layout with school branding + particles
 * ============================================================================
 *
 * Layout horizontal :
 *   - Colonne gauche : fond Navy→Blue, logo+nom école, particules, titre
 *   - Colonne droite : formulaire blanc (Rester connecté + mot de passe)
 *   - Logo Academia Helm petit en bas à gauche
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Mail, Eye, EyeOff, LogOut, Loader, AlertCircle, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { useSessionManager } from '@/contexts/SessionManagerContext';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { BRAND } from '@/lib/brand';
import { useSchoolBranding } from '@/hooks/useSchoolBranding';
import FloatingEduParticles from '@/components/ui/FloatingEduParticles';

const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

export default function SessionLockScreen() {
  const { sessionState, handleUnlock, handleLogoutFromLock, handleStayConnected } = useSessionManager();
  const { shouldReduceMotion } = useMotionBudget();
  const schoolBranding = useSchoolBranding();

  const isVisible = sessionState === 'locked';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisible) return;
    try {
      const raw = localStorage.getItem('session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.user?.email) setEmail(parsed.user.email);
      }
    } catch {}
  }, [isVisible]);

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

  const dur = useMemo(() => (shouldReduceMotion ? 0 : 0.35), [shouldReduceMotion]);

  const schoolName = schoolBranding?.name || schoolBranding?.schoolName || '';
  const schoolLogo = schoolBranding?.logoUrl || null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="lock-screen-backdrop"
          initial={shouldReduceMotion ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8edf7 50%, #f5f0ff 100%)' }}
        >
          <motion.div
            key="lock-screen-card"
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: dur, ease: 'easeOut' }}
            className="relative mx-4 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl"
            style={{ boxShadow: `0 24px 48px -12px rgba(11,47,115,0.25), 0 0 0 1px ${GOLD}15` }}
          >
            <div className="flex flex-col md:flex-row min-h-[480px]">
              {/* ── Colonne gauche : branding école (fond Navy→Blue + particules) ── */}
              <div
                className="flex-1 p-6 sm:p-8 flex flex-col justify-center relative overflow-hidden"
                style={{ background: `linear-gradient(155deg, ${NAVY} 0%, ${BLUE} 100%)` }}
              >
                {/* Particules éducatives flottantes — variant light pour fond navy */}
                <FloatingEduParticles count={14} opacityMultiplier={2.0} variant="light" />

                {/* Halos lumineux */}
                <div className="pointer-events-none absolute -top-16 -left-10 h-48 w-48 rounded-full opacity-25 blur-3xl" style={{ background: '#ffffff' }} aria-hidden />
                <div className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full opacity-15 blur-3xl" style={{ background: GOLD }} aria-hidden />

                {/* Logo + nom de l'ÉCOLE en haut (mis en avant) */}
                <motion.div
                  className="mb-6 flex flex-col items-center md:items-start relative z-10"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: dur }}
                >
                  {/* Logo école */}
                  <div className="mb-3">
                    {schoolLogo ? (
                      <img
                        src={schoolLogo}
                        alt={schoolName}
                        className="object-contain"
                        style={{ maxHeight: '64px', maxWidth: '180px' }}
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center text-xl font-bold"
                        style={{ background: 'rgba(255,255,255,0.15)', color: GOLD }}
                      >
                        {(schoolName || 'EC').substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Nom de l'école */}
                  {schoolName && (
                    <h1 className="text-lg font-bold text-white tracking-tight text-center md:text-left">
                      {schoolName}
                    </h1>
                  )}
                </motion.div>

                {/* Icône verrou animée */}
                <motion.div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl relative z-10"
                  style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
                  animate={shouldReduceMotion ? undefined : { scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Lock className="h-7 w-7 text-white" />
                </motion.div>

                {/* Titre */}
                <motion.div
                  className="relative z-10 text-center md:text-left"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: dur }}
                >
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    Session verrouillée
                  </h2>
                  <p className="mt-2 text-sm text-blue-200/70 max-w-xs">
                    Votre session a été verrouillée pour des raisons de sécurité.
                    Choisissez une option à droite pour reprendre.
                  </p>
                </motion.div>

                {/* Logo Academia Helm PETIT en bas à gauche */}
                <div className="mt-8 flex items-center gap-2 relative z-10">
                  <Image
                    src={BRAND.logoPath}
                    alt="Academia Helm"
                    width={20}
                    height={20}
                    className="opacity-40"
                    priority
                  />
                  <div>
                    <p className="text-[9px] font-bold text-blue-200/40 uppercase tracking-widest leading-none">
                      Academia Helm
                    </p>
                    <p className="text-[7px] text-blue-200/30 mt-0.5 leading-none">
                      Plateforme de pilotage éducatif
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Séparateur doré vertical ── */}
              <div className="hidden md:block w-px" style={{ background: `linear-gradient(to bottom, transparent, ${GOLD}40, transparent)` }} />

              {/* ── Colonne droite : formulaire (fond blanc) ── */}
              <div className="flex-1 p-6 sm:p-8 md:p-10 bg-white flex flex-col justify-center relative overflow-hidden">
                {/* Particules éducatives flottantes — variant dark pour fond blanc */}
                <FloatingEduParticles count={10} opacityMultiplier={1.0} variant="dark" />

                <div className="relative z-10">
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

                {/* Bouton « Rester connecté(e) » */}
                <motion.button
                  type="button"
                  onClick={handleStayConnected}
                  whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg transition-colors"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, #e0a02e)` }}
                >
                  <RefreshCw className="h-5 w-5" />
                  Rester connecté(e)
                </motion.button>

                {/* Séparateur */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Ou avec mot de passe
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                {/* Formulaire */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="lock-email" className="mb-1.5 block text-sm font-semibold text-slate-900">
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
                        className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-slate-500"
                        placeholder="votre.email@etablissement.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="lock-password" className="mb-1.5 block text-sm font-semibold text-slate-900">
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
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={isLoading || !password.trim()}
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, #144798)` }}
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

                <div className="mt-6 text-center">
                  <button
                    onClick={handleLogoutFromLock}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
                  >
                    <LogOut className="h-4 w-4" />
                    Se déconnecter
                  </button>
                </div>
                </div>{/* /relative z-10 wrapper */}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
