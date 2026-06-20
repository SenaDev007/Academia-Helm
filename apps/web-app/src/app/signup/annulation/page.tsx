/**
 * Page d'annulation de paiement
 *
 * Layout : Header public + Footer public de Academia Helm
 */

'use client'
import Link from 'next/link'
import { Header } from '@/components/ui/header-1'
import { Footer2 } from '@/components/ui/footer-2'
import { XCircle, RefreshCw } from 'lucide-react'

export default function AnnulationPage() {
  return (
    <>
      <Header />
      {/* Spacer pour le header fixe (responsive h-14 md:h-16) */}
      <div className="h-14 md:h-16" />
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center border border-slate-100">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-amber-600" />
          </div>

          <h1 className="text-2xl font-bold text-blue-900 mb-2">
            Paiement annulé
          </h1>
          <p className="text-slate-600 mb-6">
            Vous avez annulé le processus de paiement.
            Aucun montant n&apos;a été débité de votre compte.
          </p>

          <Link
            href="/signup"
            className="btn-primary-crimson block w-full py-3 px-6 rounded-xl flex items-center justify-center"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Recommencer l&apos;inscription
          </Link>
        </div>
      </main>
      <Footer2 />
    </>
  )
}
