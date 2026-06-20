/**
 * Onboarding Error Page
 *
 * Page affichée en cas d'erreur lors de l'onboarding
 * Layout : Header public + Footer public de Academia Helm
 */

'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/ui/header-1';
import { Footer2 } from '@/components/ui/footer-2';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function OnboardingErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'Une erreur est survenue lors de la création de votre compte.';
  const paymentId = searchParams.get('payment_id');

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-red-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>

            <h1 className="text-3xl font-bold text-blue-900 mb-4">
              Erreur lors de l&apos;onboarding
            </h1>

            <div className="bg-white border border-slate-200 rounded-lg p-8 mb-8 shadow-sm">
              <p className="text-slate-700 mb-4">{error}</p>

              {paymentId && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
                  <p className="text-sm text-amber-800">
                    <strong>ID de paiement :</strong> {paymentId}
                  </p>
                  <p className="text-xs text-amber-700 mt-2">
                    Si votre paiement a été effectué, contactez le support avec cet ID.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="btn-primary-gold inline-flex items-center justify-center"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Réessayer
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-6 py-3 border-2 border-blue-900 text-blue-900 rounded-md font-semibold hover:bg-blue-900 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Contacter le support
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer2 />
    </>
  );
}

