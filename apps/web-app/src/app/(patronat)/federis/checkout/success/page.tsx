/**
 * Page Success Checkout - Federis
 * 
 * Callback après paiement Fedapay réussi
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import FederisHeader from '@/components/federis/FederisHeader';
import AppIcon from '@/components/ui/AppIcon';

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Vérifier le statut du paiement depuis les paramètres
    const paymentId = searchParams.get('payment_id');
    const status = searchParams.get('status');

    if (paymentId && status === 'success') {
      // TODO: Vérifier le paiement côté serveur
      setSuccess(true);
    } else {
      setSuccess(false);
    }
    setLoading(false);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <FederisHeader />
        <div className="pt-20 pb-12">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <p className="text-gray-600">Vérification du paiement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FederisHeader />
      <div className="pt-20 pb-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {success ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AppIcon name="success" size="dashboard" className="text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Paiement réussi
              </h1>
              <p className="text-gray-600 mb-6">
                Votre compte Federis a été activé avec succès.
              </p>
              <Link
                href="/federis/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 transition-colors"
              >
                Accéder au tableau de bord
                <AppIcon name="arrowRight" size="action" className="text-white" />
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AppIcon name="warning" size="dashboard" className="text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Paiement échoué
              </h1>
              <p className="text-gray-600 mb-6">
                Une erreur est survenue lors du paiement. Veuillez réessayer.
              </p>
              <Link
                href="/federis/checkout"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 transition-colors"
              >
                Réessayer
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

