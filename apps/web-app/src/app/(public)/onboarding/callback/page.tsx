/**
 * Onboarding Callback - Page de succès après paiement
 *
 * Affiche un message de confirmation et le lien pour se connecter
 * à l'espace de l'établissement (sous-domaine tenant).
 */

'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PremiumHeader from '@/components/layout/PremiumHeader';
import { CheckCircle, LogIn, ExternalLink } from 'lucide-react';
import { getTenantRedirectUrl } from '@/lib/utils/tenant-redirect';

export default function OnboardingCallbackPage() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const subdomain = searchParams.get('subdomain');

  const loginUrl = subdomain
    ? getTenantRedirectUrl({ tenantSlug: subdomain, path: '/login' })
    : null;

  if (status !== 'success') {
    return (
      <div className="min-h-screen bg-white">
        <PremiumHeader />
        <div className="h-20" />
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-slate-700">
              Statut de paiement inconnu ou incomplet. Si vous venez de payer,
              vérifiez votre email ou contactez le support.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center text-crimson-600 hover:underline"
            >
              Retour à l&apos;inscription
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <PremiumHeader />
      <div className="h-20" />

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-green-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold text-navy-900 mb-4">
            Inscription réussie
          </h1>

          <p className="text-slate-700 mb-8">
            Votre établissement a été créé. Vous pouvez maintenant vous connecter
            à votre espace pour configurer votre école et inviter vos équipes.
          </p>

          {loginUrl ? (
            <div className="space-y-4">
              <Link
                href={loginUrl}
                className="btn-primary-crimson inline-flex items-center justify-center w-full sm:w-auto"
              >
                <LogIn className="w-5 h-5 mr-2" />
                Se connecter à mon espace
              </Link>
              <p className="text-sm text-slate-500">
                Vous serez redirigé vers l&apos;espace de votre établissement.
              </p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6 text-left">
              <p className="text-amber-800 text-sm">
                Conservez l&apos;email de confirmation que vous allez recevoir :
                il contiendra le lien direct pour accéder à votre espace.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex items-center text-crimson-600 hover:underline"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Retour à l&apos;accueil
              </Link>
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-slate-200">
            <p className="text-slate-500 text-sm mb-2">
              Période d&apos;essai de 30 jours activée.
            </p>
            <Link
              href="/contact"
              className="text-slate-600 hover:text-crimson-600 text-sm"
            >
              Besoin d&apos;aide ? Contactez le support
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
