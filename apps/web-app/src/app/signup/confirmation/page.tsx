/**
 * Page de confirmation de paiement (succès ou échec)
 *
 * Layout : Header public + Footer public de Academia Helm
 */

'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/ui/header-1'
import { Footer2 } from '@/components/ui/footer-2'
import { CheckCircle, XCircle, ExternalLink, RefreshCw, HeadphonesIcon } from 'lucide-react'

export default function ConfirmationPage() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const draftId = searchParams.get('draftId')
  const paymentId = searchParams.get('paymentId')
  const transactionId = searchParams.get('id')

  const isApproved = status === 'approved'

  return (
    <>
      <Header />
      {/* Spacer pour le header fixe (responsive h-14 md:h-16) */}
      <div className="h-14 md:h-16" />
      <main
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 px-4 py-12"
        data-draft-id={draftId ?? undefined}
        data-payment-id={paymentId ?? undefined}
      >
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center border border-slate-100">

          {isApproved ? (
            <>
              {/* Succès */}
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>

              <h1 className="text-2xl font-bold text-blue-900 mb-2">
                Paiement confirmé !
              </h1>
              <p className="text-slate-600 mb-6">
                Votre établissement a été créé avec succès sur Academia Helm.
                Vous allez recevoir vos accès par email dans quelques minutes.
              </p>

              <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left border border-blue-100">
                <p className="text-sm text-slate-500 mb-1">
                  Référence de transaction
                </p>
                <p className="font-mono text-sm text-blue-700">
                  #{transactionId}
                </p>
              </div>

              <Link
                href="https://academiahelm.com/portal"
                className="btn-primary-crimson block w-full py-3 px-6 rounded-xl flex items-center justify-center"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Accéder à mon portail
              </Link>
            </>
          ) : (
            <>
              {/* Échec */}
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>

              <h1 className="text-2xl font-bold text-blue-900 mb-2">
                Paiement non abouti
              </h1>
              <p className="text-slate-600 mb-6">
                Votre paiement n&apos;a pas pu être traité.
                Veuillez réessayer ou contacter le support.
              </p>

              <div className="flex flex-col gap-3">
                <Link
                  href="/signup"
                  className="btn-primary-crimson block w-full py-3 px-6 rounded-xl flex items-center justify-center"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Réessayer
                </Link>
                <Link
                  href="/contact"
                  className="block w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center"
                >
                  <HeadphonesIcon className="w-5 h-5 mr-2" />
                  Contacter le support
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer2 />
    </>
  )
}
