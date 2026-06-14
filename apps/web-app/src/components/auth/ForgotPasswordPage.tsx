/**
 * ============================================================================
 * FORGOT PASSWORD PAGE — ACADEMIA HELM
 * ============================================================================
 *
 * Flux professionnel de récupération de mot de passe :
 *   Étape 1 : Saisie de l'adresse email
 *   Étape 2 : Saisie du code OTP à 6 chiffres reçu par email
 *   Étape 3 : Définition du nouveau mot de passe
 *
 * Palette Academia Helm exclusive :
 *   Navy  #0b2f73  |  Blue  #1d4fa5  |  Gold  #f5b335
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Mail,
  ArrowLeft,
  Loader,
  CheckCircle2,
  AlertCircle,
  Shield,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TurnstileWidget from '@/components/auth/TurnstileWidget';
import { BRAND } from '@/lib/brand';
import { useFetchWithTimeout } from '@/lib/hooks/use-fetch-with-timeout';
import { useSchoolBranding, type SchoolBrandingData } from '@/hooks/useSchoolBranding';

/** ── Palette Academia Helm ── */
const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

type Step = 'email' | 'otp' | 'reset' | 'success';

/** Évalue la force d'un mot de passe */
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '—', color: '#94a3b8' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 1, label: 'Faible', color: '#ef4444' };
  if (score <= 3) return { score: 2, label: 'Moyen', color: GOLD };
  if (score <= 4) return { score: 3, label: 'Bon', color: BLUE };
  return { score: 4, label: 'Fort', color: '#16a34a' };
}

interface ForgotPasswordPageProps {
  schoolBranding?: SchoolBrandingData | null;
}

export default function ForgotPasswordPage({ schoolBranding }: ForgotPasswordPageProps = {}) {
  const searchParams = useSearchParams();
  const { fetchWithTimeout } = useFetchWithTimeout();

  // ── Client-side school branding fallback ──
  // Si le server component n'a pas pu résoudre le branding (API indisponible),
  // on tente de le récupérer côté client via useSchoolBranding.
  const clientBranding = useSchoolBranding(schoolBranding);

  const portalParam = searchParams?.get('portal');
  const tenantParam = searchParams?.get('tenant');

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [emailTouched, setEmailTouched] = useState(false);

  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  const passwordStrength = getPasswordStrength(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordValid = newPassword.length >= 8 && passwordStrength.score >= 2;
  const canSubmitReset = passwordValid && passwordsMatch;

  // Cooldown pour le renvoi de code
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Focus sur le premier champ OTP quand on arrive à l'étape OTP
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputs.current[0]?.focus(), 100);
    }
  }, [step]);

  /** Envoi du code OTP à l'adresse email */
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Veuillez entrer une adresse email valide.');
      setEmailTouched(true);
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWithTimeout('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), turnstileToken: turnstileToken || undefined }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Erreur lors de l\'envoi du code');
      }

      setStep('otp');
      setResendCooldown(60);
      setOtpCode(['', '', '', '', '', '']);
    } catch (err: any) {
      setError(err.message || 'Une erreur inattendue est survenue.');
    } finally {
      setIsLoading(false);
    }
  };

  /** Renvoi du code OTP */
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWithTimeout('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), turnstileToken: turnstileToken || undefined }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Erreur lors du renvoi du code');
      }

      setResendCooldown(60);
      setOtpCode(['', '', '', '', '', '']);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du renvoi du code.');
    } finally {
      setIsLoading(false);
    }
  };

  /** Vérification du code OTP */
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = otpCode.join('');
    if (code.length !== 6) {
      setError('Veuillez saisir les 6 chiffres du code.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWithTimeout('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Code invalide ou expiré.');
      }

      // Le backend renvoie un token de vérification qu'on utilisera pour le reset
      setStep('reset');
    } catch (err: any) {
      setError(err.message || 'Code invalide. Veuillez réessayer.');
      setOtpCode(['', '', '', '', '', '']);
      setTimeout(() => otpInputs.current[0]?.focus(), 100);
    } finally {
      setIsLoading(false);
    }
  };

  /** Définition du nouveau mot de passe */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitReset) return;

    setIsLoading(true);
    setError(null);

    try {
      const code = otpCode.join('');
      const response = await fetchWithTimeout('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code,
          newPassword,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Erreur lors de la réinitialisation');
      }

      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la réinitialisation.');
    } finally {
      setIsLoading(false);
    }
  };

  /** Gestion des inputs OTP (un chiffre par champ) */
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Seulement des chiffres

    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1); // Garder seulement le dernier chiffre
    setOtpCode(newOtp);
    setError(null);

    // Auto-focus sur le champ suivant
    if (value && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }

    // Auto-submit quand tous les champs sont remplis
    if (newOtp.every((d) => d !== '') && newOtp.join('').length === 6) {
      setTimeout(() => {
        const code = newOtp.join('');
        if (code.length === 6) {
          // Trigger verification automatically
          handleVerifyOtpAuto(code);
        }
      }, 150);
    }
  };

  const handleVerifyOtpAuto = async (code: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchWithTimeout('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Code invalide ou expiré.');
      }

      setStep('reset');
    } catch (err: any) {
      setError(err.message || 'Code invalide. Veuillez réessayer.');
      setOtpCode(['', '', '', '', '', '']);
      setTimeout(() => otpInputs.current[0]?.focus(), 100);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      handleVerifyOtp();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newOtp = [...otpCode];
      for (let i = 0; i < 6; i++) {
        newOtp[i] = pasted[i] || '';
      }
      setOtpCode(newOtp);
      // Focus sur le dernier champ rempli ou le champ suivant
      const nextEmpty = newOtp.findIndex((d) => d === '');
      if (nextEmpty >= 0) {
        otpInputs.current[nextEmpty]?.focus();
      } else {
        otpInputs.current[5]?.focus();
      }
    }
  };

  /** Construction du lien de retour vers login */
  const loginHref = useMemo(() => {
    const params = new URLSearchParams();
    if (portalParam) params.set('portal', portalParam);
    if (tenantParam) params.set('tenant', tenantParam);
    const qs = params.toString();
    return qs ? `/login?${qs}` : '/login';
  }, [portalParam, tenantParam]);

  // Titre et description selon l'étape
  const stepConfig: Record<Step, { title: string; subtitle: string; Icon: React.ComponentType<{ className?: string }> }> = {
    email: {
      title: 'Mot de passe oublié',
      subtitle: 'Entrez votre adresse email pour recevoir un code de vérification',
      Icon: Mail,
    },
    otp: {
      title: 'Vérification',
      subtitle: `Un code à 6 chiffres a été envoyé à ${email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`,
      Icon: KeyRound,
    },
    reset: {
      title: 'Nouveau mot de passe',
      subtitle: 'Définissez un mot de passe fort et sécurisé',
      Icon: Lock,
    },
    success: {
      title: 'Mot de passe modifié !',
      subtitle: 'Votre mot de passe a été réinitialisé avec succès',
      Icon: CheckCircle2,
    },
  };

  const currentStep = stepConfig[step];
  const StepIcon = currentStep.Icon;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/90 px-3 py-12 sm:px-6 sm:py-16 lg:px-8">
      {/* ── Background blobs ── */}
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        <motion.div
          className="absolute -left-20 top-24 h-72 w-72 rounded-full blur-3xl"
          style={{ backgroundColor: `${NAVY}25` }}
          animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-16 bottom-24 h-80 w-80 rounded-full blur-3xl"
          style={{ backgroundColor: `${GOLD}20` }}
          animate={{ x: [0, -16, 0], y: [0, 14, 0] }}
          transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: `${BLUE}18` }}
          animate={{ scale: [1, 1.06, 1], opacity: [0.25, 0.38, 0.25] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* ── Navigation ── */}
      <motion.nav
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-3 py-3 sm:px-8 sm:py-4"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-2 min-h-[44px] text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:text-slate-900"
          style={{ borderColor: `${NAVY}18` }}
        >
          <GraduationCap className="h-4 w-4" style={{ color: NAVY }} />
          Accueil
        </Link>
        <Link
          href={loginHref}
          className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-2 min-h-[44px] text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:text-slate-900"
          style={{ borderColor: `${NAVY}18` }}
        >
          <ArrowLeft className="h-4 w-4" />
          Connexion
        </Link>
      </motion.nav>

      {/* ── Main card ── */}
      <div className="relative z-10 w-full max-w-md px-1 sm:px-0">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="rounded-2xl border bg-white/95 p-5 shadow-2xl backdrop-blur-md sm:p-8 md:p-10"
          style={{
            borderColor: `${NAVY}18`,
            boxShadow: `0 24px 48px -12px ${NAVY}14, 0 0 0 1px ${GOLD}12`,
          }}
        >
          {/* ── Step indicator ── */}
          <div className="mb-6 flex items-center justify-center gap-2">
            {(['email', 'otp', 'reset'] as Step[]).map((s, i) => {
              const stepIndex = ['email', 'otp', 'reset'].indexOf(step);
              const isActive = s === step;
              const isCompleted = i < stepIndex;
              return (
                <div key={s} className="flex items-center gap-2">
                  <motion.div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      background: isCompleted
                        ? `linear-gradient(135deg, ${NAVY}, ${BLUE})`
                        : isActive
                          ? `linear-gradient(135deg, ${NAVY}, ${BLUE})`
                          : `${NAVY}12`,
                      color: isCompleted || isActive ? '#fff' : NAVY,
                    }}
                    animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    {isCompleted ? '✓' : i + 1}
                  </motion.div>
                  {i < 2 && (
                    <div
                      className="h-0.5 w-8 rounded-full"
                      style={{
                        background: isCompleted ? `linear-gradient(to right, ${NAVY}, ${BLUE})` : '#e2e8f0',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Header ── */}
          <motion.div
            className="mb-6 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Logo */}
            <div className="mb-4 inline-flex items-center justify-center">
              {clientBranding?.logoUrl ? (
                <Image
                  src={clientBranding.logoUrl}
                  alt={clientBranding.name || BRAND.name}
                  width={64}
                  height={64}
                  className="h-10 w-10 object-contain drop-shadow-lg sm:h-12 sm:w-12 rounded-xl"
                  priority
                />
              ) : (
                <Image
                  src="/images/logo-Academia Hub.png"
                  alt={BRAND.name}
                  width={64}
                  height={64}
                  className="h-10 w-10 object-contain drop-shadow-lg sm:h-12 sm:w-12"
                  priority
                />
              )}
            </div>

            {/* Step icon */}
            <motion.div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ring-white/70"
              style={{
                background: `linear-gradient(135deg, ${NAVY}18, ${BLUE}12)`,
                color: NAVY,
              }}
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <StepIcon className="h-7 w-7" />
            </motion.div>

            <h1 className="text-sm font-semibold tracking-tight sm:text-base" style={{ color: NAVY }}>
              {currentStep.title}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{currentStep.subtitle}</p>
          </motion.div>

          {/* ── Error display ── */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="mb-5"
              >
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/95 p-4 shadow-sm">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ════════════════════════════════════════════════
              ÉTAPE 1 : SAISIE EMAIL
              ════════════════════════════════════════════════ */}
          <AnimatePresence mode="wait">
            {step === 'email' && (
              <motion.form
                key="email-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSendOtp}
                className="space-y-5"
              >
                <div>
                  <label htmlFor="forgot-email" className="mb-2 block text-sm font-semibold text-slate-900">
                    Adresse email
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      id="forgot-email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailTouched(true);
                        setError(null);
                      }}
                      className="w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-4 min-h-[44px] transition-all placeholder:text-slate-400 focus:ring-2"
                      style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                      placeholder="votre.email@etablissement.com"
                      autoFocus
                    />
                    {emailTouched && email && (
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Un code de vérification à 6 chiffres sera envoyé à cette adresse.
                  </p>
                </div>

                {/* ── Cloudflare Turnstile — vérification d'humanité ── */}
                <div className="flex justify-center">
                  <TurnstileWidget
                    onToken={setTurnstileToken}
                    onError={() => setTurnstileToken(null)}
                    onExpire={() => setTurnstileToken(null)}
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={!isLoading ? { scale: 1.01, boxShadow: `0 14px 32px ${NAVY}22` } : {}}
                  whileTap={!isLoading ? { scale: 0.99 } : {}}
                  className="flex w-full items-center justify-center rounded-xl px-4 py-3.5 font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                >
                  {isLoading ? (
                    <>
                      <Loader className="mr-2 h-5 w-5 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-5 w-5" />
                      Envoyer le code
                    </>
                  )}
                </motion.button>
              </motion.form>
            )}

            {/* ════════════════════════════════════════════════
                ÉTAPE 2 : VÉRIFICATION OTP
                ════════════════════════════════════════════════ */}
            {step === 'otp' && (
              <motion.div
                key="otp-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  {/* OTP Input - 6 champs séparés */}
                  <div>
                    <label className="mb-3 block text-center text-sm font-semibold text-slate-900">
                      Code de vérification
                    </label>
                    <div className="flex items-center justify-center gap-2 sm:gap-3" onPaste={handleOtpPaste}>
                      {otpCode.map((digit, index) => (
                        <motion.input
                          key={index}
                          ref={(el) => { otpInputs.current[index] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpChange(index, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(index, e)}
                          className="h-14 w-12 rounded-xl border-2 text-center text-xl font-bold transition-all focus:ring-2 sm:h-16 sm:w-14"
                          style={{
                            borderColor: digit ? NAVY : '#e2e8f0',
                            color: NAVY,
                            '--tw-ring-color': `${NAVY}30`,
                            background: digit ? `${NAVY}06` : 'white',
                          } as React.CSSProperties}
                          autoFocus={index === 0}
                        />
                      ))}
                    </div>
                    <div className="mt-3 space-y-1">
                      <p className="text-center text-xs text-slate-500">
                        Vérifiez votre boîte de réception et vos spams.
                      </p>
                      <p className="text-center text-xs text-slate-400">
                        Si vous ne recevez aucun code, vérifiez que cette adresse email est bien associée à un compte Academia Helm.
                      </p>
                    </div>
                  </div>

                  {/* Bouton vérifier */}
                  <motion.button
                    type="submit"
                    disabled={isLoading || otpCode.join('').length !== 6}
                    whileHover={!isLoading && otpCode.join('').length === 6 ? { scale: 1.01 } : {}}
                    whileTap={!isLoading && otpCode.join('').length === 6 ? { scale: 0.99 } : {}}
                    className="flex w-full items-center justify-center rounded-xl px-4 py-3.5 font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
                    style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                  >
                    {isLoading ? (
                      <>
                        <Loader className="mr-2 h-5 w-5 animate-spin" />
                        Vérification...
                      </>
                    ) : (
                      <>
                        <KeyRound className="mr-2 h-5 w-5" />
                        Vérifier le code
                      </>
                    )}
                  </motion.button>

                  {/* Renvoi de code */}
                  <div className="text-center">
                    {resendCooldown > 0 ? (
                      <p className="text-sm text-slate-500">
                        Renvoyer le code dans{' '}
                        <span className="font-semibold" style={{ color: NAVY }}>
                          {resendCooldown}s
                        </span>
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={isLoading}
                        className="text-sm font-semibold transition-colors hover:underline disabled:opacity-50"
                        style={{ color: BLUE }}
                      >
                        Renvoyer le code
                      </button>
                    )}
                  </div>
                </form>
              </motion.div>
            )}

            {/* ════════════════════════════════════════════════
                ÉTAPE 3 : NOUVEAU MOT DE PASSE
                ════════════════════════════════════════════════ */}
            {step === 'reset' && (
              <motion.form
                key="reset-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleResetPassword}
                className="space-y-5"
              >
                {/* Nouveau mot de passe */}
                <div>
                  <label htmlFor="new-password" className="mb-2 block text-sm font-semibold text-slate-900">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="new-password"
                      required
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setError(null);
                      }}
                      className="w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-11 min-h-[44px] transition-all placeholder:text-slate-400 focus:ring-2"
                      style={{ '--tw-ring-color': `${NAVY}30` } as React.CSSProperties}
                      placeholder="Minimum 8 caractères"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center justify-center w-11 min-h-[44px] pr-1 text-slate-400 hover:text-slate-700 transition-colors"
                      aria-label={showPassword ? 'Masquer' : 'Afficher'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Password strength indicator */}
                  {newPassword && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className="h-1.5 flex-1 rounded-full transition-all duration-300"
                            style={{
                              backgroundColor: passwordStrength.score >= level
                                ? passwordStrength.color
                                : '#e2e8f0',
                            }}
                          />
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Force : <span style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
                      </p>
                    </div>
                  )}

                  {/* Requirements checklist */}
                  <div className="mt-2 space-y-1">
                    {[
                      { label: 'Au moins 8 caractères', met: newPassword.length >= 8 },
                      { label: 'Une lettre majuscule', met: /[A-Z]/.test(newPassword) },
                      { label: 'Un chiffre', met: /\d/.test(newPassword) },
                      { label: 'Un caractère spécial', met: /[^A-Za-z0-9]/.test(newPassword) },
                    ].map((req) => (
                      <div key={req.label} className="flex items-center gap-2">
                        <CheckCircle2
                          className={`h-3.5 w-3.5 transition-colors ${req.met ? 'text-emerald-500' : 'text-slate-300'}`}
                        />
                        <span className={`text-xs transition-colors ${req.met ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confirmer mot de passe */}
                <div>
                  <label htmlFor="confirm-password" className="mb-2 block text-sm font-semibold text-slate-900">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirm-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setError(null);
                      }}
                      className="w-full rounded-xl border-2 border-slate-200 py-3 pl-10 pr-11 min-h-[44px] transition-all placeholder:text-slate-400 focus:ring-2"
                      style={{
                        '--tw-ring-color': `${NAVY}30`,
                        borderColor: confirmPassword && !passwordsMatch ? '#ef4444' : undefined,
                      } as React.CSSProperties}
                      placeholder="Retapez le mot de passe"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 flex items-center justify-center w-11 min-h-[44px] pr-1 text-slate-400 hover:text-slate-700 transition-colors"
                      aria-label={showConfirmPassword ? 'Masquer' : 'Afficher'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && !passwordsMatch && (
                    <p className="mt-1 text-xs text-red-500">Les mots de passe ne correspondent pas</p>
                  )}
                  {confirmPassword && passwordsMatch && (
                    <p className="mt-1 text-xs text-emerald-600">Les mots de passe correspondent</p>
                  )}
                </div>

                <motion.button
                  type="submit"
                  disabled={isLoading || !canSubmitReset}
                  whileHover={!isLoading && canSubmitReset ? { scale: 1.01 } : {}}
                  whileTap={!isLoading && canSubmitReset ? { scale: 0.99 } : {}}
                  className="flex w-full items-center justify-center rounded-xl px-4 py-3.5 font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                >
                  {isLoading ? (
                    <>
                      <Loader className="mr-2 h-5 w-5 animate-spin" />
                      Réinitialisation...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-5 w-5" />
                      Réinitialiser le mot de passe
                    </>
                  )}
                </motion.button>
              </motion.form>
            )}

            {/* ════════════════════════════════════════════════
                ÉTAPE SUCCÈS
                ════════════════════════════════════════════════ */}
            {step === 'success' && (
              <motion.div
                key="success-step"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <motion.div
                  className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ background: `${NAVY}10` }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                >
                  <CheckCircle2 className="h-10 w-10" style={{ color: '#16a34a' }} />
                </motion.div>
                <p className="mb-6 text-sm text-slate-600">
                  Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
                </p>
                <Link
                  href={loginHref}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 font-semibold text-white shadow-lg min-h-[44px]"
                  style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Se connecter
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Footer ── */}
          {step !== 'success' && (
            <div className="mt-6 text-center">
              <Link
                href={loginHref}
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 min-h-[44px]"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour à la connexion
              </Link>
            </div>
          )}
        </motion.div>

        {/* ── Security notice ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 text-center text-xs text-slate-400"
        >
          <Shield className="mr-1 inline h-3 w-3" />
          Protégé par le chiffrement TLS. Votre code expire dans 10 minutes.
        </motion.p>
      </div>
    </div>
  );
}
