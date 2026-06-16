/**
 * ============================================================================
 * AdminLoginPage — page d'authentification du back-office Academia Helm
 * ============================================================================
 *
 * Système d'auth SÉPARÉ de celui des tenants Academia Helm.
 *
 * Flow :
 *   1. L'utilisateur choisit Google Sign-In OU email/password (si activé)
 *   2. Après validation du 1er facteur → on affiche l'écran OTP (6 chiffres)
 *   3. L'utilisateur saisit le code reçu par email
 *   4. Si valide → cookie `academia_admin_session` posé → redirect /admin
 *
 * Design : navy foncé + accents dorés — distinct de la page de login tenant
 * (qui est sur fond clair). Look "back-office sécurisé".
 * ============================================================================
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Loader2,
  AlertCircle,
  Lock,
  Mail,
  ArrowLeft,
  ArrowRight,
  KeyRound,
  Smartphone,
} from 'lucide-react';

type Step = 'credentials' | 'otp' | 'success';
type Method = 'google' | 'password';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/admin';

  const [step, setStep] = useState<Step>('credentials');
  const [method, setMethod] = useState<Method | null>(null);

  // Identifiants
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // État serveur
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string>('');

  // UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(true);
  const [passwordEnabled, setPasswordEnabled] = useState(false);

  // Vérifier la config (Google dispo ? password activé ?)
  useEffect(() => {
    // Pas d'API dédiée pour checker la config — on l'infère à la première
    // interaction. Par défaut, on affiche Google et on cache password.
    // Si Google init renvoie 503, on sait qu'il n'est pas configuré.
    fetch('/api/admin-auth/google/init', { method: 'POST' })
      .then((r) => setGoogleConfigured(r.ok || r.status !== 503))
      .catch(() => setGoogleConfigured(false));
    // Pour password : on tente de savoir en checkant un endpoint simple
    // (en l'absence d'endpoint dédié, on l'affiche toujours — l'API renverra 503 si désactivé)
    setPasswordEnabled(true);
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    setMethod('google');
    try {
      const res = await fetch('/api/admin-auth/google/init', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur init Google OAuth');
      }
      const { authUrl } = (await res.json()) as { authUrl: string };
      // Rediriger vers Google
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur Google OAuth');
      setIsLoading(false);
      setMethod(null);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setMethod('password');
    try {
      const res = await fetch('/api/admin-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Identifiants invalides');
      setPendingToken(data.pendingToken);
      setPendingEmail(data.email);
      setStep('otp');
      // Focus premier input OTP
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  // Callback Google : si on revient avec ?code=...&state=... dans l'URL
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (code && state) {
      // Flow Google callback
      setStep('otp');
      setMethod('google');
      setIsLoading(true);
      fetch('/api/admin-auth/google/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erreur callback Google');
          setPendingToken(data.pendingToken);
          setPendingEmail(data.email);
          setError(null);
          setTimeout(() => otpRefs.current[0]?.focus(), 100);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Erreur callback Google');
          setStep('credentials');
          setMethod(null);
        })
        .finally(() => setIsLoading(false));
    }
  }, [searchParams]);

  const handleOtpChange = (index: number, value: string) => {
    // N'autoriser que les chiffres
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    // Auto-focus next
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length) {
      const newOtp = ['', '', '', '', '', ''];
      for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i];
      setOtp(newOtp);
      otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      setError('Veuillez saisir les 6 chiffres du code');
      return;
    }
    if (!pendingToken) {
      setError('Session invalide. Veuillez recommencer.');
      setStep('credentials');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin-auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, otp: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Code OTP invalide');
      setStep('success');
      // Rediriger après un court délai
      setTimeout(() => {
        router.push(redirectPath);
        router.refresh();
      }, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur vérification OTP');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setStep('credentials');
    setOtp(['', '', '', '', '', '']);
    setError(null);
    setPendingToken(null);
    setMethod(null);
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0a1d3f] via-[#0b2f73] to-[#071d49] px-4 py-8 relative overflow-hidden">
      {/* Décor — grille + halos */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:48px_48px]"
      />
      <div
        aria-hidden
        className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(245,179,53,0.15),transparent_70%)]"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(29,79,165,0.35),transparent_70%)]"
      />

      <div className="relative w-full max-w-md">
        <motion.div
          className="bg-white rounded-3xl shadow-2xl p-7 md:p-9 border border-[#f5b335]/20"
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {/* Logo + Header */}
          <div className="text-center mb-7">
            <motion.div
              className="inline-flex items-center justify-center mb-4"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Image
                src="/images/logo-Academia-Helm.svg"
                alt="Academia Helm"
                width={64}
                height={64}
                className="w-16 h-16 object-contain"
                priority
              />
            </motion.div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#0b2f73] mb-1.5">
              Back-office Academia Helm
            </h1>
            <p className="text-xs md:text-sm text-slate-600">
              Accès réservé aux administrateurs plateforme
            </p>
          </div>

          {/* Badge sécurité */}
          <div className="mb-6 flex items-center justify-center gap-2 rounded-lg bg-[#0b2f73]/5 border border-[#0b2f73]/10 px-3 py-2">
            <Shield className="w-3.5 h-3.5 text-[#0b2f73]" />
            <span className="text-[11px] font-semibold text-[#0b2f73] uppercase tracking-wide">
              Authentification 2 facteurs
            </span>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-5 bg-red-50 border border-red-200 rounded-lg p-3.5 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* ─── Étape 1 : Credentials ─── */}
            {step === 'credentials' && (
              <motion.div
                key="credentials"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {/* Google Sign-In */}
                {googleConfigured && (
                  <>
                    <motion.button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      whileHover={{ y: -1.5 }}
                      whileTap={{ scale: 0.99 }}
                      className="w-full bg-white text-[#0b2f73] border-2 border-[#0b2f73]/15 px-6 py-3 rounded-xl font-semibold hover:bg-slate-50 hover:border-[#0b2f73]/30 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm mb-4"
                    >
                      {isLoading && method === 'google' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      )}
                      Continuer avec Google
                    </motion.button>

                    {/* Séparateur */}
                    <div className="flex items-center gap-3 my-4">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-xs text-slate-400 uppercase tracking-wider">ou</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                  </>
                )}

                {/* Email/password (si activé) */}
                {passwordEnabled ? (
                  <form onSubmit={handlePasswordLogin} className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Email administrateur
                      </label>
                      <div className="relative">
                        <Mail className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none w-5 h-5 text-slate-400 my-auto" />
                        <input
                          type="email"
                          id="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2f73] focus:border-[#0b2f73] transition-all text-sm"
                          placeholder="admin@academiahelm.com"
                          autoComplete="email"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Mot de passe
                      </label>
                      <div className="relative">
                        <Lock className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none w-5 h-5 text-slate-400 my-auto" />
                        <input
                          type="password"
                          id="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2f73] focus:border-[#0b2f73] transition-all text-sm"
                          placeholder="••••••••"
                          autoComplete="current-password"
                        />
                      </div>
                    </div>

                    <motion.button
                      type="submit"
                      disabled={isLoading}
                      whileHover={{ y: -1.5 }}
                      whileTap={{ scale: 0.99 }}
                      className="w-full bg-[#0b2f73] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#144798] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      {isLoading && method === 'password' ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Connexion...
                        </>
                      ) : (
                        <>
                          <Shield className="w-5 h-5" />
                          Continuer
                        </>
                      )}
                    </motion.button>
                  </form>
                ) : !googleConfigured ? (
                  <div className="text-center py-6 text-sm text-slate-500">
                    Aucune méthode d'authentification configurée.
                    <br />
                    Contactez l'administrateur technique.
                  </div>
                ) : null}
              </motion.div>
            )}

            {/* ─── Étape 2 : OTP ─── */}
            {step === 'otp' && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  type="button"
                  onClick={handleBackToCredentials}
                  className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0b2f73] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Retour
                </button>

                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#f5b335]/15 border border-[#f5b335]/30 mb-3">
                    <KeyRound className="w-7 h-7 text-[#a67410]" />
                  </div>
                  <h2 className="text-xl font-bold text-[#0b2f73] mb-1">
                    Vérification 2 facteurs
                  </h2>
                  <p className="text-xs text-slate-600">
                    Code à 6 chiffres envoyé par email à
                    <br />
                    <span className="font-semibold text-[#0b2f73]">{pendingEmail}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOtp}>
                  {/* 6 inputs OTP */}
                  <div className="flex justify-center gap-2 mb-5" onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-11 h-14 text-center text-2xl font-bold border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#f5b335] focus:border-[#f5b335] transition-all text-[#0b2f73]"
                        aria-label={`Chiffre ${i + 1}`}
                      />
                    ))}
                  </div>

                  <motion.button
                    type="submit"
                    disabled={isLoading || otp.join('').length !== 6}
                    whileHover={{ y: -1.5 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full bg-[#f5b335] text-[#0b2f73] px-6 py-3 rounded-xl font-bold hover:bg-[#f7c359] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Vérification...
                      </>
                    ) : (
                      <>
                        Vérifier le code
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                </form>

                <p className="mt-4 text-center text-xs text-slate-500">
                  Le code est valide 10 minutes. Vérifiez vos spams si vous ne le recevez pas.
                </p>
              </motion.div>
            )}

            {/* ─── Étape 3 : Success ─── */}
            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 mb-4"
                >
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                <h2 className="text-xl font-bold text-[#0b2f73] mb-1">Authentification réussie</h2>
                <p className="text-sm text-slate-600">Redirection en cours...</p>
                <Loader2 className="w-5 h-5 animate-spin text-[#0b2f73] mx-auto mt-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-xs text-white/70">
            Vous êtes un établissement ?{' '}
            <a
              href="/login"
              className="text-[#f5b335] hover:text-[#f7c359] font-semibold underline"
            >
              Connexion établissement
            </a>
          </p>
          <p className="text-xs text-white/50">
            <a href="/" className="hover:text-white/80 font-medium underline">
              ← Retour à la page principale
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
