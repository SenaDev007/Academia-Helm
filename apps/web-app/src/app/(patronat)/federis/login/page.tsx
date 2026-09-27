/**
 * Page de connexion Academia Federis
 *
 * Connexion dédiée aux patronats et organismes d'examens (cahier des charges §6.4) :
 *   1. POST /api/auth/login (BFF) avec portal_type PATRONAT → cookies de session
 *   2. Vérification de l'espace patronat via /federis/patronat/profile
 *   3. Redirection vers le tableau de bord institutionnel
 *
 * Interface distincte de l'espace école, branding institutionnel.
 */

'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import FederisHeader from '@/components/federis/FederisHeader';
import { getFederisBasePath } from '@/lib/federis/useFederisPath';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const federisBase = getFederisBasePath();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
          portal_type: 'PATRONAT',
        }),
      });

      const loginData = await loginRes.json().catch(() => ({}));

      if (!loginRes.ok || !loginData.success) {
        const msg =
          loginData?.message === 'Unauthorized'
            ? 'Identifiants incorrects.'
            : loginData?.message || 'Email ou mot de passe incorrect.';
        setErrors({ submit: msg });
        return;
      }

      // ── 2. Vérification de l'espace patronat ──
      try {
        const profileRes = await apiClient.get('/federis/patronat/profile', { timeout: 15000 });
        if (!profileRes.data?.id) {
          throw new Error('NO_PATRONAT');
        }
      } catch (profileErr: any) {
        // Le compte n'est lié à aucun espace patronat → session inutile
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
        const msg =
          profileErr?.response?.status === 404
            ? "Aucun espace patronat n'est associé à ce compte. Cette connexion est réservée aux patronats et organismes d'examens."
            : "Impossible de vérifier votre espace patronat. Veuillez réessayer.";
        setErrors({ submit: msg });
        return;
      }

      // ── 3. Redirection vers le cockpit institutionnel ──
      const redirect = searchParams.get('redirect');
      router.push(redirect || `${federisBase}/dashboard`);
    } catch (error: any) {
      console.error('[FederisLogin] Erreur :', error);
      setErrors({
        submit:
          error?.message === 'Failed to fetch'
            ? 'Le serveur ne répond pas. Vérifiez votre connexion et réessayez.'
            : 'Une erreur est survenue lors de la connexion. Veuillez réessayer.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <FederisHeader />
      <div className="pt-24 pb-12">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <Image
                src="/images/logo-Academia Hub.webp"
                alt="Academia Federis — par Academia Helm"
                width={64}
                height={64}
                className="h-16 w-auto"
                priority
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Connexion à Academia Federis
            </h1>
            {/* Mention obligatoire (cahier des charges §6.4) */}
            <p className="text-sm font-semibold text-blue-900 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 inline-block">
              Accès réservé aux Patronats &amp; Organismes d&rsquo;examens
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-8"
          >
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse électronique institutionnelle
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={cn(
                    'w-full px-4 py-2 border rounded-md',
                    errors.email ? 'border-red-300' : 'border-gray-300',
                    'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                  )}
                  placeholder="contact@patronat.org"
                  autoComplete="email"
                  autoFocus
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={cn(
                    'w-full px-4 py-2 border rounded-md',
                    errors.password ? 'border-red-300' : 'border-gray-300',
                    'focus:ring-2 focus:ring-blue-800 focus:border-blue-800',
                  )}
                  placeholder="Votre mot de passe"
                  autoComplete="current-password"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              {errors.submit && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.submit}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-800 text-white rounded-md font-semibold hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Connexion en cours…' : 'Se connecter'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-gray-600">
              Pas encore d&rsquo;espace patronat ?{' '}
              <Link
                href={`${federisBase}/register`}
                className="text-blue-800 font-semibold hover:text-blue-900"
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
