/**
 * Page de connexion Academia Federis — pattern d'authentification Academia Helm
 * ============================================================================
 *
 * Reproduit EXACTEMENT le flux de connexion d'Academia Helm (LoginPage.tsx),
 * adapté au portail PATRONAT (cahier des charges §6.4) :
 *
 *   1. POST /api/auth/login (BFF) avec portal_type: 'PATRONAT'
 *      → cookies de session posés par la BFF (academia_session, academia_token,
 *        x-tenant-id) — le tenant patronat est auto-résolu côté backend
 *        (user.tenantId posé par /federis/public/register).
 *   2. ⭐ 2FA TOTP : si le backend exige un code (requires2fa), affichage du
 *      champ « code à 6 chiffres » puis POST /api/auth/2fa/verify-login
 *      (même mécanique de promesse résolue que Helm).
 *   3. persistClientSession() → localStorage (accessToken, refreshToken,
 *      serverSessionId, session, miroir Cache API pour le Service Worker).
 *   4. saveEmailForTenant() → dernier email mémorisé.
 *   5. Vérification de l'espace patronat via /federis/patronat/profile
 *      (404 → « Aucun espace patronat » + logout propre).
 *   6. markFreshLogin() + redirection full-reload vers le tableau de bord
 *      (pattern Helm : window.location.href pour que les Server Components
 *      relisent les cookies fraîchement posés).
 *
 * Au montage (pattern Helm exact — anti-boucle) :
 *   - isRecentlyLoggedOut(60 s) → ne rien tenter
 *   - hasLocalSessionHints() → validation silencieuse via /api/auth/me
 *     → session valide : bouton « Continuer vers le tableau de bord »
 *       (PAS d'auto-redirect, cf. boucle infinie documentée dans Helm)
 *     → session invalide : clearClientSessionSync()
 *
 * Interface distincte de l'espace école, branding institutionnel Federis.
 */

'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, ArrowRight, Eye, EyeOff, KeyRound, Loader, Lock, Mail } from 'lucide-react';
import FederisHeader from '@/components/federis/FederisHeader';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import { apiClient } from '@/lib/api/client';
import {
  persistClientSession,
  markFreshLogin,
  hasLocalSessionHints,
  isRecentlyLoggedOut,
  clearClientSessionSync,
} from '@/lib/auth/client-access-token';
import { getSavedEmailForTenant, saveEmailForTenant } from '@/lib/auth/saved-email';
import { useFetchWithTimeout } from '@/lib/hooks/use-fetch-with-timeout';
import { getAppBaseUrl } from '@/lib/utils/urls';
import { cn } from '@/lib/utils';

/** Clé de mémorisation du dernier email (pattern Helm : 1 clé par espace). */
const FEDERIS_EMAIL_KEY = 'federis';

export default function FederisLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 pt-24 flex items-start justify-center">
          <div className="text-gray-500 text-sm">Chargement…</div>
        </div>
      }
    >
      <FederisLoginForm />
    </Suspense>
  );
}

function FederisLoginForm() {
  const searchParams = useSearchParams();
  const federisBase = getFederisBasePath();
  const { fetchWithTimeout } = useFetchWithTimeout();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [validSessionDetected, setValidSessionDetected] = useState(false);

  // ── 2FA TOTP (pattern Helm : promesse résolue par le panneau de code) ──
  const [twoFactorPrompt, setTwoFactorPrompt] = useState<{
    tempToken: string;
    email?: string;
  } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [twoFactorVerifying, setTwoFactorVerifying] = useState(false);
  const twoFactorResolveRef = useRef<((data: any | null) => void) | null>(null);

  // ── Détection d'une session déjà valide (pattern Helm, au montage) ──
  //    ⛔ PAS d'auto-redirect : boucle infinie documentée côté Helm après
  //    logout avec données stale. On affiche un bouton « Continuer ».
  useEffect(() => {
    // Logout récent (< 60 s) → ne même pas tenter la validation
    if (isRecentlyLoggedOut(60000)) return;
    // Pas d'indices de session en localStorage → afficher le formulaire
    if (!hasLocalSessionHints()) return;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          setValidSessionDetected(true);
        } else {
          // Session invalide → purger les données stale (faux positifs futurs)
          clearClientSessionSync();
          try {
            sessionStorage.setItem('academia_just_logged_out', Date.now().toString());
          } catch {
            /* ignore */
          }
        }
      } catch {
        // Erreur réseau — afficher le formulaire normalement
      }
    })();
  }, []);

  // ── Dernier email utilisé (pattern Helm saveEmailForTenant) ──
  useEffect(() => {
    const saved = getSavedEmailForTenant(FEDERIS_EMAIL_KEY);
    if (saved) setFormData((f) => (f.email ? f : { ...f, email: saved }));
  }, []);

  /** Déconnexion complète (BFF + localStorage) — profil patronat invalide. */
  const logoutCleanup = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearClientSessionSync();
  };

  /** Traduit les messages backend en messages clairs pour le portail Federis. */
  const humanizeLoginError = (message?: string): string => {
    const msg = (message || '').toString();
    if (msg.includes('PATRONAT_NO_SPACE')) {
      return "Aucun espace patronat n'est associé à ce compte. Cette connexion est réservée aux patronats et organismes d'examens.";
    }
    if (msg.includes('PORTAL_MISMATCH')) {
      return 'Ce compte ne peut pas utiliser le portail Patronat. Utilisez le portail correspondant à votre rôle (école, enseignant ou parent).';
    }
    if (msg === 'Unauthorized' || msg.toLowerCase().includes('invalid credentials')) {
      return 'Identifiants incorrects. Vérifiez votre adresse électronique et votre mot de passe.';
    }
    if (msg.toLowerCase().includes('tenant')) {
      return "Votre organisation est introuvable ou inactive. Contactez l'administrateur de la plateforme.";
    }
    return msg || 'Email ou mot de passe incorrect.';
  };

  // ── 2FA : ouvre le panneau de code, résout la promesse à la complétion ──
  const promptFor2FA = (tempToken: string, email?: string): Promise<any | null> => {
    setTwoFactorCode('');
    setTwoFactorError(null);
    setTwoFactorPrompt({ tempToken, email });
    return new Promise((resolve) => {
      twoFactorResolveRef.current = resolve;
    });
  };

  /** Soumet le code TOTP → POST /api/auth/2fa/verify-login (pattern Helm). */
  const submitTwoFactorCode = async () => {
    if (!twoFactorPrompt || twoFactorVerifying) return;
    const code = twoFactorCode.replace(/\D/g, '');
    if (code.length !== 6) {
      setTwoFactorError("Saisissez les 6 chiffres de votre application d'authentification.");
      return;
    }
    setTwoFactorVerifying(true);
    setTwoFactorError(null);
    try {
      const res = await fetchWithTimeout('/api/auth/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twoFactorTempToken: twoFactorPrompt.tempToken,
          code,
          portal_type: 'PATRONAT',
        }),
      });
      const data = await res.json().catch(() => ({}) as any);
      if (res.ok && data.success && data.accessToken) {
        setTwoFactorPrompt(null);
        twoFactorResolveRef.current?.(data);
        twoFactorResolveRef.current = null;
      } else {
        setTwoFactorError(data.message || 'Code de vérification invalide.');
      }
    } catch {
      setTwoFactorError('Impossible de vérifier le code — vérifiez votre connexion.');
    } finally {
      setTwoFactorVerifying(false);
    }
  };

  /** Annule le panneau 2FA (résout la promesse avec null). */
  const cancelTwoFactor = () => {
    setTwoFactorPrompt(null);
    twoFactorResolveRef.current?.(null);
    twoFactorResolveRef.current = null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = "L'adresse électronique est requise";
    }
    if (!formData.password) {
      newErrors.password = 'Le mot de passe est requis';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      // ── 1. Authentification via le BFF (pose les cookies de session) ──
      //    Pattern Helm : fetchWithTimeout (10 s + abort-on-unmount) au lieu
      //    d'un fetch nu — sur réseau instable, un fetch sans timeout reste
      //    en échec silencieux pendant des minutes (spinner sans fin).
      const response = await fetchWithTimeout('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          portal_type: 'PATRONAT',
        }),
      });

      // ⭐ Parse tolérant (pattern Helm) : une page d'erreur non-JSON ne doit
      //    pas devenir une SyntaxError opaque.
      let data = await response.json().catch(() => ({}) as any);

      if (!response.ok) {
        throw new Error(humanizeLoginError(data.message));
      }

      // ── 2. 2FA TOTP (pattern Helm) : le backend exige un code ──
      if (data.requires2fa && data.twoFactorTempToken) {
        const completed = await promptFor2FA(data.twoFactorTempToken, data.email);
        if (!completed) return; // annulé par l'utilisateur
        data = completed;
      }

      // ── 3. Persistance client (pattern Helm persistClientSession) ──
      //    localStorage : accessToken / refreshToken / serverSessionId /
      //    session (tenantId) + miroir Cache API pour le Service Worker.
      persistClientSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        serverSessionId: data.serverSessionId,
        user: data.user,
        tenant: data.tenant,
        portalType: 'PATRONAT',
        expiresAt: data.expiresAt,
      });
      saveEmailForTenant(formData.email.trim(), data.tenant?.id || FEDERIS_EMAIL_KEY);

      // ── 4. Vérification de l'espace patronat (garde-fou Federis) ──
      //    Un compte Helm valide mais sans patronat ne doit PAS accéder à
      //    l'espace → logout propre + message explicite.
      //    ⭐ profileRole est hissé HORS du try interne : const profileRes est
      //    block-scoped — référencé après le bloc, il levait
      //    « ReferenceError: profileRes is not defined » (connexion bloquée).
      //
      //    ⭐ 2026-10-02 (T59) — incident « Impossible de vérifier votre espace
      //    patronat » signalé par le promoteur : diagnostic complet (API directe
      //    + BFF + CORS/preflight + données réelles du compte promoteur + flow
      //    complet dans un vrai navigateur sur patronatnational) → chaîne 100 %
      //    saine ; l'échec était transitoire (fenêtre de déploiement). Durcissement :
      //    1 retry automatique sur erreur RÉSEAU/timeout/5xx — une erreur passagère
      //    ne doit plus détruire une connexion par ailleurs valide (logout + purge).
      //    404 inchangé (aucun espace patronat) ; trace console pour diagnostic.
      const fetchProfileOnce = () =>
        apiClient.get('/federis/patronat/profile', { timeout: 15000 });
      const fetchProfileWithRetry = async (): Promise<any> => {
        try {
          return await fetchProfileOnce();
        } catch (err: any) {
          const status = err?.response?.status ?? err?.status;
          // Transitoire = pas de réponse (réseau/timeout) ou 5xx (rollout).
          // Les 4xx (401/403/404) ne sont PAS rejoués : erreur définitive.
          if (status && status < 500) throw err;
          console.warn(
            '[FederisLogin] Vérification profile transitoire (statut ' +
              (status ?? 'réseau') + '), nouvel essai dans 700 ms…',
          );
          await new Promise((r) => setTimeout(r, 700));
          return fetchProfileOnce();
        }
      };
      let profileRole: string | null = null;
      try {
        const profileRes = await fetchProfileWithRetry();
        if (!profileRes.data?.id) {
          throw new Error('NO_PATRONAT');
        }
        profileRole = profileRes.data?.userRole ?? profileRes.data?.userFunction ?? null;
      } catch (profileErr: any) {
        console.error(
          '[FederisLogin] Échec vérification espace patronat — statut:',
          profileErr?.response?.status ?? profileErr?.status ?? 'réseau/timeout',
          '— message:', profileErr?.message,
        );
        await logoutCleanup();
        const msg =
          profileErr?.response?.status === 404
            ? "Aucun espace patronat n'est associé à ce compte. Cette connexion est réservée aux patronats et organismes d'examens."
            : "Impossible de vérifier votre espace patronat. Veuillez réessayer.";
        setErrors({ submit: msg });
        return;
      }

      // ── 5. Redirection (pattern Helm : markFreshLogin + full reload) ──
      //    ⭐ 2026-10-01 — les secrétaires de saisie (comptes provisoires
      //    PATRONAT_SAISIE_NOTES) arrivent DIRECTEMENT sur leur UI dédiée
      //    « Saisie des notes » (/saisie) — le tableau de bord patronat ne
      //    les concerne pas (aucune route autorisée pour cette fonction).
      markFreshLogin();
      const redirect = searchParams.get('redirect');
      const defaultPath =
        profileRole === 'PATRONAT_SAISIE_NOTES' || profileRole === 'SAISIE_NOTES'
          ? '/saisie'
          : '/dashboard';
      window.location.href = redirect || `${federisBase}${defaultPath}`;
    } catch (error: any) {
      console.error('[FederisLogin] Erreur :', error);
      const raw = error?.name === 'AbortError' || error?.name === 'TimeoutError'
        ? 'Le serveur ne répond pas dans les 10 secondes. Vérifiez votre connexion et réessayez.'
        : error?.message;
      setErrors({
        submit:
          raw === 'Failed to fetch'
            ? 'Le serveur ne répond pas. Vérifiez votre connexion et réessayez.'
            : humanizeLoginError(raw),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9fc] relative">
      <FederisHeader />
      <div className="pt-28 pb-12 relative z-10">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <Image
                src="/images/logo-Academia Hub.webp"
                alt="Academia Federis — par Academia Helm"
                width={56}
                height={56}
                className="h-14 w-14 object-contain rounded-xl ring-1 ring-gray-100 bg-white"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Connexion à Academia Federis
            </h1>
            {/* Mention obligatoire (cahier des charges §6.4) — badge simple */}
            <p className="text-xs font-medium text-blue-900 bg-blue-50 border border-blue-100 rounded-md px-3 py-1.5 inline-block">
              Accès réservé aux Patronats &amp; Organismes d&rsquo;examens
            </p>
          </div>

          {/* Session déjà valide détectée — bouton « Continuer » (pattern Helm) */}
          {validSessionDetected && !twoFactorPrompt && (
            <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-600 mb-3">
                Une session active a été détectée sur cet appareil.
              </p>
              <button
                type="button"
                onClick={() => {
                  window.location.href = `${federisBase}/dashboard`;
                }}
                className="w-full py-2.5 fed-btn-gold text-sm"
              >
                Continuer vers le tableau de bord
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 shadow-sm"
          >
            {twoFactorPrompt ? (
              /* ── Panneau 2FA TOTP (pattern Helm) ── */
              <div className="space-y-5">
                <div className="text-center">
                  <div className="mx-auto mb-3 w-12 h-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                    <KeyRound className="h-6 w-6 text-blue-800" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Double authentification requise
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Saisissez le code à 6 chiffres généré par votre application
                    d&rsquo;authentification
                    {twoFactorPrompt.email ? (
                      <> pour le compte {twoFactorPrompt.email}</>
                    ) : null}
                    .
                  </p>
                </div>

                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      submitTwoFactorCode();
                    }
                  }}
                  autoFocus
                  className="fed-input px-4 py-3 !text-center !text-2xl !tracking-[0.5em] font-mono"
                  placeholder="000000"
                />

                {twoFactorError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700">{twoFactorError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={submitTwoFactorCode}
                  disabled={twoFactorVerifying}
                  className="w-full py-2.5 fed-btn-gold text-sm"
                >
                  {twoFactorVerifying ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Vérification…
                    </>
                  ) : (
                    'Valider le code'
                  )}
                </button>

                <button
                  type="button"
                  onClick={cancelTwoFactor}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Annuler et revenir au formulaire
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Adresse électronique institutionnelle
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={cn(
                        'fed-input !rounded-lg pl-10 pr-4 py-2.5',
                        errors.email && '!border-red-400',
                      )}
                      placeholder="contact@patronat.org"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={cn(
                        'fed-input !rounded-lg pl-10 pr-11 py-2.5',
                        errors.password && '!border-red-400',
                      )}
                      placeholder="Votre mot de passe"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>

                {errors.submit && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700">{errors.submit}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 fed-btn-gold text-sm"
                >
                  {loading ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Connexion en cours…
                    </>
                  ) : (
                    'Se connecter'
                  )}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <a
                    href={`${getAppBaseUrl()}/forgot-password`}
                    className="text-blue-700 hover:underline transition-colors"
                  >
                    Mot de passe oublié ?
                  </a>
                  <span className="text-gray-400 inline-flex items-center gap-1">
                    <KeyRound className="h-3 w-3" />
                    2FA compatible
                  </span>
                </div>
              </div>
            )}
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-gray-600">
              Pas encore d&rsquo;espace patronat ?{' '}
              <Link
                href={`${federisBase}/register`}
                className="text-blue-700 font-semibold hover:underline transition-colors"
              >
                Créer un compte
              </Link>
            </p>
            <p className="text-xs text-gray-400">
              Vous êtes une école ? Connectez-vous depuis l&rsquo;application Academia Helm de votre
              établissement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
