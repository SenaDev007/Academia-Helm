'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — FORMULAIRE DE CONNEXION (portail autonome)
 * ============================================================================
 *
 * Email + mot de passe (pas de matricule, pas d'établissement).
 * Pattern Helm : POST BFF → persistClientSession → markFreshLogin →
 * full-reload vers /prof/dashboard (les Server Components relisent les cookies).
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GraduationCap, Loader2, Lock, Mail, AlertCircle } from 'lucide-react';
import { persistClientSession, markFreshLogin, clearClientSessionSync } from '@/lib/auth/client-access-token';

interface LoginErrors {
  email?: string;
  password?: string;
  submit?: string;
}

export function ProfLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = (field: 'email' | 'password', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const next: LoginErrors = {};
    if (!formData.email.trim()) next.email = 'Email requis';
    else if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) next.email = 'Adresse email invalide';
    if (!formData.password) next.password = 'Mot de passe requis';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch('/api/teacher-portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Identifiants invalides.');
      }

      // ── Persistance client (pattern Helm) ──
      persistClientSession({
        accessToken: data.accessToken,
        serverSessionId: data.portalSessionId,
        user: data.user,
        tenant: data.tenant,
        portalType: 'TEACHER',
        expiresAt: data.expiresAt,
        scope: data.scope ?? null,
      } as any);

      // ── Redirection (pattern Helm : full reload) ──
      markFreshLogin();
      const redirect = searchParams.get('redirect');
      window.location.href = redirect && redirect.startsWith('/prof')
        ? redirect
        : '/prof/dashboard';
    } catch (error: any) {
      clearClientSessionSync();
      setErrors({ submit: error?.message || 'Connexion impossible. Vérifiez votre connexion.' });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-white">
          <GraduationCap className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Connexion à votre espace</h1>
        <p className="mt-2 text-sm text-slate-500">
          Helm Enseignant — votre espace pédagogique personnel
        </p>
      </div>

      {searchParams.get('error') === 'portal' && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Ce portail est réservé aux comptes Helm Enseignant. Pour un compte d’école,
          connectez-vous depuis le portail de votre établissement.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Adresse email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="vous@example.com"
              value={formData.email}
              onChange={(e) => setField('email', e.target.value)}
            />
          </div>
          {errors.email && <p className="mt-1.5 text-xs text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
            Mot de passe
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setField('password', e.target.value)}
            />
          </div>
          {errors.password && <p className="mt-1.5 text-xs text-red-600">{errors.password}</p>}
        </div>

        {errors.submit && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {errors.submit}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Connexion…' : 'Se connecter'}
        </button>

        <p className="text-center text-sm text-slate-500">
          Pas encore d’espace ?{' '}
          <Link href="/prof/register" className="font-semibold text-teal-700 hover:text-teal-800">
            Créez-le en 3 minutes
          </Link>
        </p>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        Enseignant d’une école déjà cliente d’Academia Helm ? Utilisez le portail de votre
        établissement (matricule + école).
      </p>
    </div>
  );
}
