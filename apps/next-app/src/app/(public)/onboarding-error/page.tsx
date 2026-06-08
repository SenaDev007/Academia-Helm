/**
 * Onboarding Error Page
 * 
 * Page affichée en cas d'erreur lors de l'onboarding
 */

'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PremiumHeader from '@/components/layout/PremiumHeader';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function OnboardingErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'Une erreur est survenue lors de la création de votre compte.';
  const paymentId = searchParams.get('payment_id');

  return (
    <div className="min-h-screen bg-white">
      <PremiumHeader />
      <div className="h-20" />

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-red-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-12 h-12 text-red-600" />
          </div>

          <h1 className="text-3xl font-bold text-navy-900 mb-4">
            Erreur lors de l'onboarding
          </h1>

          <div className="bg-gray-50 rounded-lg p-8 mb-8">
            <p className="text-slate-700 mb-4">{error}</p>
            
            {paymentId && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>ID de paiement :</strong> {paymentId}
                </p>
                <p className="text-xs text-yellow-700 mt-2">
                  Si votre paiement a été effectué, contactez le support avec cet ID.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="btn-primary-crimson inline-flex items-center justify-center"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Réessayer
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 border-2 border-navy-900 text-navy-900 rounded-md font-semibold hover:bg-navy-900 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Contacter le support
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

