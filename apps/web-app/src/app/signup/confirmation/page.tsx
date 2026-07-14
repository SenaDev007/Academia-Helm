/**
 * Page de confirmation de paiement (succès ou échec)
 *
 * Layout : Header public + Footer public de Academia Helm
 *
 * ⭐ CRITIQUE : Cette page ne se contente PLUS d'afficher un message statique.
 * Quand status=approved, elle appelle POST /api/onboarding/payment/{paymentId}/verify
 * qui côté backend :
 *   1. Interroge FedaPay pour confirmer le statut de la transaction
 *   2. Si approved → déclenche handlePaymentSuccess → activateTenantAfterPayment
 *      (crée tenant + school + user + subscription dans une transaction Prisma)
 *   3. Envoie l'email de bienvenue au promoteur avec son sous-domaine + loginUrl
 *
 * Sans cet appel, si le webhook FedaPay n'arrive pas (URL mal configurée,
 * signature mismatch, etc.), le tenant n'est jamais créé et aucun email
 * n'est envoyé — bien que l'utilisateur voie le message de succès.
 *
 * L'appel est retry jusqu'à 5 fois (3s d'intervalle) car l'activation peut
 * prendre quelques secondes après le retour de FedaPay.
 */

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/ui/header-1'
import { Footer2 } from '@/components/ui/footer-2'
import { CheckCircle, XCircle, ExternalLink, RefreshCw, HeadphonesIcon, Loader2, AlertCircle } from 'lucide-react'

const MAX_RETRIES = 5
const RETRY_INTERVAL_MS = 3000
const AUTO_REDIRECT_DELAY_MS = 5000

/**
 * ⭐ Redirige automatiquement l'utilisateur vers son portail tenant après 5 secondes.
 * Affiche un compte à rebours pour ne pas surprendre l'utilisateur.
 */
function AutoRedirectToPortal({ portalUrl }: { portalUrl: string }) {
  const [countdown, setCountdown] = useState(Math.ceil(AUTO_REDIRECT_DELAY_MS / 1000))

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          window.location.href = portalUrl
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [portalUrl])

  return (
    <p className="text-xs text-slate-500 mt-4">
      Redirection automatique vers votre portail dans {countdown}s...
    </p>
  )
}

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const draftId = searchParams.get('draftId')
  const paymentIdParam = searchParams.get('paymentId')
  const transactionId = searchParams.get('id') // ID numérique FedaPay

  const isApproved = status === 'approved'

  const [verifyState, setVerifyState] = useState<'loading' | 'success' | 'error' | 'idle' | 'looking-up'>('idle')
  const [verifyMessage, setVerifyMessage] = useState<string>('')
  const [subdomain, setSubdomain] = useState<string | null>(null)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [fedapayReference, setFedapayReference] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [verifyErrorDetail, setVerifyErrorDetail] = useState<string | null>(null)
  const [resolvedPaymentId, setResolvedPaymentId] = useState<string | null>(null)

  useEffect(() => {
    if (!isApproved) return

    // ⭐ Si paymentId est dans l'URL → on l'utilise directement.
    // Sinon, on essaie de le retrouver via le transactionId FedaPay (param 'id').
    // FedaPay ne préserve pas les query params d'origine après redirection.
    const resolvePaymentId = async () => {
      if (paymentIdParam) {
        setResolvedPaymentId(paymentIdParam)
        return
      }

      if (!transactionId) {
        setVerifyState('error')
        setVerifyMessage('Impossible de retrouver votre paiement : aucun identifiant dans l\'URL. Contactez le support.')
        return
      }

      // Lookup par transactionId FedaPay
      setVerifyState('looking-up')
      setVerifyMessage('Recherche de votre paiement en cours...')
      try {
        const res = await fetch(`/api/onboarding/payment/by-transaction/${transactionId}`)
        const data = await res.json()
        if (data.found && data.paymentId) {
          setResolvedPaymentId(data.paymentId)
          if (data.reference) {
            setFedapayReference(data.reference)
          }
        } else {
          setVerifyState('error')
          setVerifyMessage(`Impossible de retrouver votre paiement (transaction FedaPay #${transactionId}). Contactez le support avec cette référence.`)
        }
      } catch (err: any) {
        setVerifyState('error')
        setVerifyMessage(`Erreur lors de la recherche du paiement: ${err.message}`)
      }
    }

    resolvePaymentId()
  }, [isApproved, paymentIdParam, transactionId])

  // ⭐ Une fois qu'on a le paymentId (direct ou résolu), lancer la vérification.
  useEffect(() => {
    if (!isApproved || !resolvedPaymentId) return

    let cancelled = false
    setVerifyState('loading')
    setVerifyMessage('Vérification de votre paiement en cours...')

    const verify = async (attemptNum: number) => {
      if (cancelled) return
      try {
        const response = await fetch(`/api/onboarding/payment/${resolvedPaymentId}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        if (cancelled) return

        const data = await response.json()

        if (cancelled) return

        // ⭐ Stocker la vraie référence FedaPay renvoyée par le backend
        const realRef = data.fedapayReference || data.reference || data.transactionId
        if (realRef) {
          setFedapayReference(String(realRef))
        }

        if (data.verifyError) {
          setVerifyErrorDetail(data.verifyError)
        }

        // Si tenant activé → succès
        if (data.tenantActivated || data.status === 'SUCCESS') {
          setVerifyState('success')
          setVerifyMessage('Votre établissement a été activé. Un email avec vos accès vous a été envoyé à l\'adresse du promoteur.')
          if (data.firstTenantSubdomain) {
            setSubdomain(data.firstTenantSubdomain)
          }
          if (data.firstTenantPortalUrl) {
            setPortalUrl(data.firstTenantPortalUrl)
          } else if (data.firstTenantSubdomain) {
            setPortalUrl(`https://${data.firstTenantSubdomain}.academiahelm.com/login?portal=SCHOOL&tenant=${data.firstTenantSubdomain}`)
          }
          return
        }

        // Si la transaction est approved mais tenant pas encore activé, retry
        if (data.transactionStatus === 'approved' || data.verified) {
          if (attemptNum < MAX_RETRIES) {
            setVerifyMessage(`Paiement confirmé, activation en cours... (tentative ${attemptNum + 1}/${MAX_RETRIES})`)
            setAttempt(attemptNum + 1)
            setTimeout(() => verify(attemptNum + 1), RETRY_INTERVAL_MS)
          } else {
            setVerifyState('success')
            setVerifyMessage('Paiement confirmé. L\'activation de votre établissement est en cours de traitement côté serveur. Vous recevrez vos accès par email dans quelques minutes.')
          }
          return
        }

        // Transaction pas encore approved
        if (attemptNum < MAX_RETRIES) {
          setVerifyMessage(`Vérification en cours... (tentative ${attemptNum + 1}/${MAX_RETRIES})`)
          setAttempt(attemptNum + 1)
          setTimeout(() => verify(attemptNum + 1), RETRY_INTERVAL_MS)
        } else {
          setVerifyState('error')
          setVerifyMessage('Le statut de votre paiement n\'a pas pu être confirmé après plusieurs tentatives. Notre support va vérifier manuellement.')
        }
      } catch (err: any) {
        if (cancelled) return
        if (attemptNum < MAX_RETRIES) {
          setVerifyMessage(`Connexion au serveur... (tentative ${attemptNum + 1}/${MAX_RETRIES})`)
          setAttempt(attemptNum + 1)
          setTimeout(() => verify(attemptNum + 1), RETRY_INTERVAL_MS)
        } else {
          setVerifyState('error')
          setVerifyMessage(`Erreur lors de la vérification: ${err.message}`)
        }
      }
    }

    verify(0)

    return () => {
      cancelled = true
    }
  }, [isApproved, resolvedPaymentId])

  return (
    <>
      <Header />
      {/* Spacer pour le header fixe (responsive h-14 md:h-16) */}
      <div className="h-14 md:h-16" />
      <main
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30 px-4 py-12"
        data-draft-id={draftId ?? undefined}
        data-payment-id={resolvedPaymentId ?? undefined}
        data-transaction-id={transactionId ?? undefined}
      >
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center border border-slate-100">

          {isApproved ? (
            <>
              {/* Succès */}
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                {verifyState === 'loading' || verifyState === 'looking-up' ? (
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                ) : verifyState === 'error' ? (
                  <AlertCircle className="w-10 h-10 text-amber-500" />
                ) : (
                  <CheckCircle className="w-10 h-10 text-green-600" />
                )}
              </div>

              <h1 className="text-2xl font-bold text-blue-900 mb-2">
                {verifyState === 'looking-up'
                  ? 'Recherche...'
                  : verifyState === 'loading'
                    ? 'Vérification...'
                    : verifyState === 'error'
                      ? 'Paiement reçu — Activation en cours'
                      : 'Paiement confirmé !'}
              </h1>

              <p className="text-slate-600 mb-6">
                {verifyMessage || (
                  <>
                    Votre établissement a été créé avec succès sur Academia Helm.
                    Vous allez recevoir vos accès par email dans quelques minutes.
                  </>
                )}
              </p>

              {/* ⭐ Détail de l'erreur de vérification (si FedaPay API a échoué) */}
              {verifyErrorDetail && verifyState === 'error' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-left">
                  <p className="text-xs text-amber-800 font-medium mb-1">
                    ℹ️ Information technique
                  </p>
                  <p className="text-xs text-amber-700 break-all">
                    {verifyErrorDetail}
                  </p>
                  <p className="text-xs text-amber-600 mt-2">
                    Notre équipe a été notifiée. Votre paiement sera traité manuellement si nécessaire.
                  </p>
                </div>
              )}

              {/* ⭐ URL de connexion complète (hostname complet, pas juste le slug) */}
              {portalUrl && (
                <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left border border-blue-100">
                  <p className="text-sm text-slate-500 mb-1">
                    Votre URL de connexion
                  </p>
                  <p className="font-mono text-sm text-blue-700 break-all">
                    {portalUrl}
                  </p>
                </div>
              )}

              {/* ⭐ Vraie référence FedaPay (récupérée via l'API verify, pas l'ID numérique de l'URL) */}
              <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left border border-slate-100">
                <p className="text-sm text-slate-500 mb-1">
                  Référence de transaction FedaPay
                </p>
                <p className="font-mono text-sm text-slate-700 break-all">
                  {fedapayReference || transactionId || '—'}
                </p>
              </div>

              {verifyState === 'error' && (
                <div className="flex flex-col gap-3 mb-4">
                  <Link
                    href="/contact"
                    className="block w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center"
                  >
                    <HeadphonesIcon className="w-5 h-5 mr-2" />
                    Contacter le support
                  </Link>
                </div>
              )}

              <Link
                href={portalUrl || 'https://academiahelm.com/portal'}
                className="btn-primary-gold block w-full py-3 px-6 rounded-xl flex items-center justify-center"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Accéder à mon portail
              </Link>

              {/* ⭐ Redirection automatique vers le portail après 5 secondes si activation réussie */}
              {verifyState === 'success' && portalUrl && (
                <AutoRedirectToPortal portalUrl={portalUrl} />
              )}

              {verifyState === 'loading' && attempt > 0 && (
                <p className="text-xs text-slate-400 mt-4">
                  Veuillez patienter pendant l'activation de votre établissement...
                </p>
              )}
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
                  className="btn-primary-gold block w-full py-3 px-6 rounded-xl flex items-center justify-center"
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

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  )
}
