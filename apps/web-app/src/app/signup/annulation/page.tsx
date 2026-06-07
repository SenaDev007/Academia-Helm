'use client'
import Link from 'next/link'

export default function AnnulationPage() {
  return (
    <div className="min-h-screen flex items-center
      justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white
        rounded-2xl shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold
          text-gray-900 mb-4">
          Paiement annulé
        </h1>
        <p className="text-gray-600 mb-6">
          Vous avez annulé le processus de paiement.
        </p>
        <Link href="/signup"
          className="block w-full bg-blue-600
          text-white py-3 px-6 rounded-xl
          font-semibold">
          Recommencer
        </Link>
      </div>
    </div>
  )
}
