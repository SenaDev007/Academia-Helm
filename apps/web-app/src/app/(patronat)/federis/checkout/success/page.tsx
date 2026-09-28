/**
 * Page Success Checkout - Federis
 * ============================================================================
 *
 * Callback après paiement Fedapay — MÊME PATTERN QUE HELM
 * (/signup/confirmation) : cette page ne se contente PAS d'afficher un
 * message statique.
 *
 * Fedapay redirige vers /checkout/success?id={transactionId}&status=approved
 * en REMPLAÇANT les query params d'origine (invoiceId…) :
 *   1. Résoudre la facture : invoiceId dans l'URL, sinon lookup
 *      GET /federis/public/checkout/by-transaction/{id} ;
 *   2. Vérifier le statut RÉEL côté serveur :
 *      POST /federis/public/checkout/verify { invoiceId }
 *      → le backend interroge l'API Fedapay, active l'abonnement
 *        (idempotent), attribue le sous-domaine patronat
 *        (patronatnational… / patronat{département}…) et envoie l'email
 *        automatique avec les identifiants et le domaine ;
 *   3. Retries (5 × 3 s) si PENDING — l'activation peut prendre quelques
 *      secondes après le retour de Fedapay ;
 *   4. Succès → domaine + URL de connexion + redirection automatique vers
 *      la page de connexion DU sous-domaine patronat (compte à rebours).
 *
 * ⚠️ Sans cet appel, si le webhook Fedapay n'arrive pas, l'abonnement
 *    n'est jamais activé — bien que l'utilisateur voie « Paiement réussi ».
 */

'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, CheckCircle, ExternalLink, Globe, Loader2, Mail, RefreshCw } from 'lucide-react';
import FederisHeader from '@/components/federis/FederisHeader';
import AppIcon from '@/components/ui/AppIcon';
import { apiClient } from '@/lib/api/client';
import { federisLink } from '@/lib/federis/useFederisPath';

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 3000;
const AUTO_REDIRECT_DELAY_MS = 8000;

interface VerifyResult {
  invoiceId: string;
  invoiceNumber?: string;
  status: string;
  activated: boolean;
  subdomain: string | null;
  siteUrl: string | null;
  loginUrl: string | null;
  plan?: string | null;
  expiresAt?: string | null;
  /** Statut de création du domaine dédié (pattern Helm domainReports). */
  domainStatus?: 'created' | 'failed' | 'not_configured' | null;
  domainError?: string | null;
  outcome?: string;
  message?: string;
}

/** Compte à rebours + redirection automatique vers la page de connexion patronat. */
function AutoRedirectToLogin({ loginUrl }: { loginUrl: string }) {
  const [countdown, setCountdown] = useState(Math.ceil(AUTO_REDIRECT_DELAY_MS / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          window.location.href = loginUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loginUrl]);

  return (
    <p className="text-xs text-slate-500 mt-4">
      Redirection automatique vers votre page de connexion dans {countdown}s...
    </p>
  );
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  // Fedapay remplace les query params : ?id={transactionId}&status=approved
  const fedapayStatus = searchParams.get('status');
  const transactionId = searchParams.get('id') ?? searchParams.get('transactionId');
  const invoiceIdParam = searchParams.get('invoiceId');
  // Compat anciens liens
  const legacyPaymentId = searchParams.get('payment_id');

  const isApproved =
    fedapayStatus === 'approved' || fedapayStatus === 'success' || Boolean(legacyPaymentId);

  const [state, setState] = useState<'idle' | 'looking-up' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // ── Étape 1+2 : résoudre la facture puis vérifier le paiement réel ──
  useEffect(() => {
    if (!isApproved) return;

    const run = async () => {
      try {
        // 1. Résoudre l'identifiant de facture
        let invoiceId = invoiceIdParam ?? null;
        if (!invoiceId && transactionId) {
          setState('looking-up');
          setMessage('Recherche de votre paiement en cours...');
          const res = await apiClient.get(
            `/federis/public/checkout/by-transaction/${encodeURIComponent(transactionId)}`,
            { timeout: 15000 },
          );
          if (!res.data?.found || !res.data?.invoiceId) {
            throw new Error(
              `Impossible de retrouver votre paiement (transaction Fedapay #${transactionId}). Contactez le support avec cette référence.`,
            );
          }
          invoiceId = res.data.invoiceId as string;
        }
        if (!invoiceId) {
          throw new Error(
            "Impossible de retrouver votre paiement : aucun identifiant dans l'URL. Contactez le support.",
          );
        }

        // 2. Vérification réelle côté serveur (retries si PENDING)
        setState('verifying');
        let lastPending: VerifyResult | null = null;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          if (cancelledRef.current) return;
          setMessage(
            attempt === 1
              ? 'Vérification de votre paiement en cours...'
              : `Confirmation en cours (tentative ${attempt}/${MAX_RETRIES})...`,
          );
          try {
            const res = await apiClient.post(
              '/federis/public/checkout/verify',
              { invoiceId },
              { timeout: 30000 },
            );
            const data: VerifyResult = res.data;
            if (cancelledRef.current) return;

            if (data.activated && data.status === 'SUCCESS') {
              setResult(data);
              setState('success');
              setMessage('');
              return;
            }
            if (data.status === 'PENDING') {
              // ⭐ Le backend renvoie PENDING (et non une erreur) si l'API
              //    FedaPay est injoignable — pattern Helm. On retente.
              lastPending = data;
              await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
              continue;
            }
            // Échec définitif (declined / canceled / erreur)
            setResult(data);
            setState('error');
            setMessage(
              data.message ||
                'Le paiement n\u2019a pas été confirmé. Si vous avez été débité, contactez le support avec la référence de votre transaction Fedapay.',
            );
            return;
          } catch (err: any) {
            if (attempt === MAX_RETRIES) throw err;
            await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
          }
        }
        // ⭐ Toutes les tentatives ont renvoyé PENDING : paiement pas encore
        //    tranché côté FedaPay (webhook en retard / API lente). On sort
        //    proprement avec un message + bouton « Revérifier » au lieu de
        //    rester bloqué indéfiniment sur le spinner.
        setState('error');
        setMessage(
          lastPending?.message ||
            'Votre paiement est encore en cours de confirmation côté FedaPay. Si vous avez été débité, cliquez sur \u00ab Revérifier \u00bb dans quelques instants — votre espace patronat sera activé automatiquement.',
        );
      } catch (err: any) {
        if (cancelledRef.current) return;
        console.error('[FederisCheckoutSuccess] Erreur :', err);
        setState('error');
        setMessage(err?.response?.data?.message ?? err?.message ?? 'Erreur lors de la vérification du paiement.');
      }
    };

    run();
  }, [isApproved, invoiceIdParam, transactionId]);

  // ── Échec / retour annulé de Fedapay ──
  if (!isApproved) {
    return (
      <div className="fed-card p-10 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AppIcon name="warning" size="dashboard" className="text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-blue-900 tracking-tight mb-2">
          Paiement non abouti
        </h1>
        <p className="text-slate-500 mb-6">
          Une erreur est survenue lors du paiement ou la transaction a été annulée. Aucun montant
          n&apos;a été encaissé — vous pouvez réessayer.
        </p>
        <Link href={federisLink('/checkout')} className="fed-btn-navy px-6 py-3 text-sm">
          Réessayer
        </Link>
      </div>
    );
  }

  // ── Vérification en cours ──
  if (state !== 'success' && state !== 'error') {
    return (
      <div className="fed-card p-10 text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-800 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-blue-900 tracking-tight mb-2">
          Confirmation de votre paiement
        </h1>
        <p className="text-slate-500 text-sm">{message || 'Vérification de votre paiement en cours...'}</p>
        <p className="text-xs text-slate-400 mt-4">
          Ne fermez pas cette page — l&apos;activation de votre espace patronat est en cours.
        </p>
      </div>
    );
  }

  // ── Échec de vérification ──
  if (state === 'error') {
    return (
      <div className="fed-card p-10 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AppIcon name="warning" size="dashboard" className="text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-blue-900 tracking-tight mb-2">
          Paiement non confirmé
        </h1>
        <p className="text-slate-500 mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="fed-btn-navy px-6 py-3 text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Revérifier
          </button>
          <Link href={federisLink('/checkout')} className="fed-btn-navy px-6 py-3 text-sm">
            Retour au paiement
          </Link>
        </div>
      </div>
    );
  }

  // ── Succès : espace activé + domaine dédié ──
  const subdomain = result?.subdomain;
  const siteUrl = result?.siteUrl ?? (subdomain ? `https://${subdomain}` : null);
  const loginUrl = result?.loginUrl ?? (siteUrl ? `${siteUrl}/login` : null);
  // ⭐ Domaine dédié opérationnel ? (pattern Helm domainReports — si la
  //    création Cloudflare/Vercel a échoué, on ne redirige PAS automatiquement
  //    vers un domaine inaccessible et on propose le portail Federis.)
  const domainReady =
    !result?.domainStatus || result.domainStatus === 'created' || result.domainStatus === null;

  return (
    <div className="fed-card p-10 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="w-9 h-9 text-green-600" />
      </div>
      <h1 className="text-2xl font-bold text-blue-900 tracking-tight mb-2">
        Paiement réussi — votre espace est activé
      </h1>
      <p className="text-slate-500 mb-6">
        Votre abonnement Federis est actif
        {result?.invoiceNumber ? (
          <> (facture <span className="font-mono font-semibold">{result.invoiceNumber}</span>)</>
        ) : null}
        .
      </p>

      {/* Domaine dédié du patronat */}
      {siteUrl && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-6 text-left">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center flex-shrink-0">
              <Globe className="h-5 w-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
                Votre domaine dédié
              </p>
              <a
                href={siteUrl}
                className="text-lg font-bold text-blue-900 break-all hover:text-blue-800 underline decoration-amber-400 decoration-2 underline-offset-4"
              >
                {siteUrl.replace(/^https?:\/\//, '')}
              </a>
              <p className="text-sm text-slate-500 mt-2">
                C&apos;est la page publique de votre patronat. Votre interface d&apos;administration
                des examens est accessible depuis ce domaine.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Email identifiants envoyé */}
      <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-left flex items-start gap-3">
        <Mail className="h-5 w-5 text-blue-800 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-slate-600">
          Un email avec vos <strong>identifiants de connexion</strong> et votre domaine vient
          d&apos;être envoyé à votre adresse institutionnelle. Vous pouvez aussi vous connecter
          dès maintenant avec l&apos;email et le mot de passe définis à l&apos;inscription.
        </p>
      </div>

      {/* ⭐ Domaine dédié non encore opérationnel (pattern Helm domainReports) */}
      {!domainReady && siteUrl && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-left">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            La configuration technique de votre domaine dédié{' '}
            <span className="font-semibold">{siteUrl.replace(/^https?:\/\//, '')}</span> n&apos;a pas
            pu être finalisée automatiquement
            {result?.domainError ? ` (${result.domainError})` : ''}. Notre équipe technique en a
            été informée. Vous pouvez accéder dès maintenant à votre espace depuis la page de
            connexion Federis — votre domaine dédié sera activé dès que possible.
          </p>
        </div>
      )}

      {loginUrl && (
        <>
          <a
            href={loginUrl}
            className="fed-btn-navy px-6 py-3 text-sm inline-flex items-center gap-2"
          >
            Me connecter à mon espace patronat
            <ExternalLink className="h-4 w-4" />
          </a>
          {domainReady ? (
            <AutoRedirectToLogin loginUrl={loginUrl} />
          ) : (
            <p className="text-xs text-slate-500 mt-4">
              En attendant votre domaine dédié, connectez-vous depuis le{' '}
              <Link
                href={federisLink('/login')}
                className="font-semibold text-blue-800 underline underline-offset-2"
              >
                portail Federis
              </Link>
              .
            </p>
          )}
        </>
      )}
      {!loginUrl && (
        <Link href={federisLink('/dashboard')} className="fed-btn-navy px-6 py-3 text-sm">
          Accéder au tableau de bord
        </Link>
      )}

      {message && (
        <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-left">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">{message}</p>
        </div>
      )}
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
