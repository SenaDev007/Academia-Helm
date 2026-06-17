/**
 * ============================================================================
 * AdminLoginPage — page d'authentification du back-office Academia Helm
 * ============================================================================
 *
 * Système d'auth SÉPARÉ de celui des tenants Academia Helm.
 *
 * Flow :
 *   1. L'utilisateur choisit Google Sign-In OU email/password
 *   2. Connexion directe (pas de 2FA/OTP) → cookie academia_admin_session → redirect /admin
 *
 * Design : navy foncé + accents dorés — distinct de la page de login tenant.
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  AlertCircle,
  Lock,
  Mail,
  Shield,
  ArrowRight,
} from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/admin';

  // Identifiants
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Mot de passe oublié
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState(true);

  // Vérifier la config Google
  useEffect(() => {
    fetch('/api/admin-auth/google/init', { method: 'POST' })
      .then((r) => setGoogleConfigured(r.ok || r.status !== 503))
      .catch(() => setGoogleConfigured(false));
  }, []);

  // Callback Google : si on revient avec ?code=...&state=...
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (code && state) {
      setIsLoading(true);
      fetch('/api/admin-auth/google/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erreur callback Google');
          // Connexion directe sans OTP — la session est posée par le callback
          router.push(redirectPath);
          router.refresh();
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Erreur callback Google');
        })
        .finally(() => setIsLoading(false));
    }
  }, [searchParams, router, redirectPath]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin-auth/google/init', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur init Google OAuth');
      }
      const { authUrl } = (await res.json()) as { authUrl: string };
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur Google OAuth');
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Identifiants invalides');
      // Connexion directe — la session est posée par /api/admin-auth/login
      router.push(redirectPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin-auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setForgotSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#0a1d3f] via-[#0b2f73] to-[#071d49] px-4 py-8 relative overflow-hidden">
      {/* Décor */}
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
          {/* Logo couleur + Header */}
          <div className="text-center mb-7">
            <motion.div
              className="inline-flex items-center justify-center mb-4"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Image
                src="/images/logo-Academia Hub.png"
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
            {/* ─── Étape : Mot de passe oublié ─── */}
            {showForgotPassword ? (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                {forgotSent ? (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 mb-4">
                      <Mail className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h2 className="text-lg font-bold text-[#0b2f73] mb-2">Email envoyé</h2>
                    <p className="text-sm text-slate-600 mb-6">
                      Si un compte admin existe avec cette adresse, un email de réinitialisation a été envoyé à <strong>{forgotEmail}</strong>.
                    </p>
                    <button
                      onClick={() => {
                        setShowForgotPassword(false);
                        setForgotSent(false);
                        setForgotEmail('');
                      }}
                      className="text-sm font-semibold text-[#0b2f73] hover:underline"
                    >
                      ← Retour à la connexion
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setShowForgotPassword(false)}
                      className="mb-4 text-xs font-semibold text-slate-500 hover:text-[#0b2f73] transition-colors"
                    >
                      ← Retour
                    </button>
                    <h2 className="text-lg font-bold text-[#0b2f73] mb-2">Mot de passe oublié</h2>
                    <p className="text-xs text-slate-500 mb-4">
                      Saisissez votre email administrateur pour recevoir un lien de réinitialisation.
                    </p>
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div>
                        <div className="relative">
                          <Mail className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none w-5 h-5 text-slate-400 my-auto" />
                          <input
                            type="email"
                            required
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2f73] focus:border-[#0b2f73] transition-all text-sm"
                            placeholder="votre.email@exemple.com"
                          />
                        </div>
                      </div>
                      <motion.button
                        type="submit"
                        disabled={isLoading}
                        whileHover={{ y: -1.5 }}
                        whileTap={{ scale: 0.99 }}
                        className="w-full bg-[#0b2f73] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#144798] transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                      >
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            Envoyer le lien
                            <ArrowRight className="w-5 h-5" />
                          </>
                        )}
                      </motion.button>
                    </form>
                  </>
                )}
              </motion.div>
            ) : (
              /* ─── Étape : Login ─── */
              <motion.div
                key="login"
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
                      {isLoading ? (
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

                    <div className="flex items-center gap-3 my-4">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-xs text-slate-400 uppercase tracking-wider">ou</span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>
                  </>
                )}

                {/* Email/password */}
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
                        placeholder="votre.email@exemple.com"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                        Mot de passe
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true);
                          setForgotEmail(email);
                          setError(null);
                        }}
                        className="text-xs font-medium text-[#0b2f73] hover:underline transition-colors"
                      >
                        Mot de passe oublié ?
                      </button>
                    </div>
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
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Connexion...
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5" />
                        Se connecter
                      </>
                    )}
                  </motion.button>
                </form>
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
