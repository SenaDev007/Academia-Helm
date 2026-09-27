/**
 * Page Success Checkout - Federis
 * 
 * Callback après paiement Fedapay réussi
 */

'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import FederisHeader from '@/components/federis/FederisHeader';
import AppIcon from '@/components/ui/AppIcon';
import { federisLink } from '@/lib/federis/useFederisPath';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  // ⭐ État dérivé directement des paramètres (pas d'effet → pas de flash de chargement)
  const paymentId = searchParams.get('payment_id');
  const status = searchParams.get('status');
  const success = Boolean(paymentId && status === 'success');

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <FederisHeader />
      <div className="pt-20 pb-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {success ? (
            <div className="fed-card p-10 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AppIcon name="success" size="dashboard" className="text-green-600" />
              </div>
              <div className="fed-badge fed-badge-amber mb-3">Paiement</div>
              <h1 className="text-2xl font-black text-[#0b1d3a] tracking-tight mb-2">
                Paiement réussi
              </h1>
              <p className="text-slate-500 mb-6">
                Votre compte Federis a été activé avec succès.
              </p>
              <Link
                href={federisLink('/dashboard')}
                className="fed-btn-navy px-6 py-3 text-sm"
              >
                Accéder au tableau de bord
                <AppIcon name="arrowRight" size="action" className="text-white" />
              </Link>
            </div>
          ) : (
            <div className="fed-card p-10 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AppIcon name="warning" size="dashboard" className="text-red-600" />
              </div>
              <div className="fed-badge mb-3">Paiement</div>
              <h1 className="text-2xl font-black text-[#0b1d3a] tracking-tight mb-2">
                Paiement échoué
              </h1>
              <p className="text-slate-500 mb-6">
                Une erreur est survenue lors du paiement. Veuillez réessayer.
              </p>
              <Link
                href={federisLink('/checkout')}
                className="fed-btn-navy px-6 py-3 text-sm"
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

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f7f9fc]">
          <FederisHeader />
          <div className="pt-20 pb-12">
            <div className="max-w-2xl mx-auto px-4 text-center">
              <p className="text-slate-500">Vérification du paiement...</p>
            </div>
          </div>
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}

