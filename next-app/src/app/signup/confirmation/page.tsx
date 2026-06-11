'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function ConfirmationPage() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const draftId = searchParams.get('draftId')
  const paymentId = searchParams.get('paymentId')
  const transactionId = searchParams.get('id')

  const isApproved = status === 'approved'

  return (
    <div
      className="min-h-screen flex items-center
      justify-center bg-gray-50 px-4"
      data-draft-id={draftId ?? undefined}
      data-payment-id={paymentId ?? undefined}
    >
      <div className="max-w-md w-full bg-white
        rounded-2xl shadow-lg p-8 text-center">

        {isApproved ? (
          <>
            {/* Succès */}
            <div className="w-20 h-20 bg-green-100
              rounded-full flex items-center justify-center
              mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600"
                fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path strokeLinecap="round"
                  strokeLinejoin="round" strokeWidth={2}
                  d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold
              text-gray-900 mb-2">
              Paiement confirmé !
            </h1>
            <p className="text-gray-600 mb-6">
              Votre établissement a été créé avec succès
              sur Academia Helm. Vous allez recevoir
              vos accès par email dans quelques minutes.
            </p>

            <div className="bg-blue-50 rounded-xl p-4
              mb-6 text-left">
              <p className="text-sm text-gray-500 mb-1">
                Référence de transaction
              </p>
              <p className="font-mono text-sm
                text-blue-700">
                #{transactionId}
              </p>
            </div>

            <Link href="https://academiahelm.com/portal"
              className="block w-full bg-blue-600
              text-white py-3 px-6 rounded-xl
              font-semibold hover:bg-blue-700
              transition-colors">
              Accéder à mon portail
            </Link>
          </>
        ) : (
          <>
            {/* Échec */}
            <div className="w-20 h-20 bg-red-100
              rounded-full flex items-center justify-center
              mx-auto mb-6">
              <svg className="w-10 h-10 text-red-600"
                fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path strokeLinecap="round"
                  strokeLinejoin="round" strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold
              text-gray-900 mb-2">
              Paiement non abouti
            </h1>
            <p className="text-gray-600 mb-6">
              Votre paiement n'a pas pu être traité.
              Veuillez réessayer ou contacter le support.
            </p>

            <div className="flex flex-col gap-3">
              <Link href="/signup"
                className="block w-full bg-blue-600
                text-white py-3 px-6 rounded-xl
                font-semibold hover:bg-blue-700
                transition-colors">
                Réessayer
              </Link>
              <Link href="/contact"
                className="block w-full bg-gray-100
                text-gray-700 py-3 px-6 rounded-xl
                font-semibold hover:bg-gray-200
                transition-colors">
                Contacter le support
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
