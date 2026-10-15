'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — SUCCÈS DU PAIEMENT (vérification serveur)
 * ============================================================================
 *
 * Callback après paiement FedaPay — MÊME PATTERN QUE LE PATRONAT :
 * FedaPay redirige vers /prof/checkout/success?id={transactionId}&status=approved
 * en REMPLAÇANT les query params d'origine (invoiceId…).
 *
 *   1. Résoudre la facture : invoiceId dans l'URL, sinon lookup
 *      GET /teacher-portal/public/checkout/by-transaction/{id} ;
 *   2. Vérifier le statut RÉEL côté serveur :
 *      POST /teacher-portal/public/checkout/verify { invoiceId }
 *      → le backend interroge l'API FedaPay et active l'abonnement
 *        (idempotent — le webhook fait la même chose en parallèle) ;
 *   3. Retries (5 × 3 s) si PENDING — l'activation peut prendre quelques
 *      secondes après le retour de FedaPay ;
 *   4. Succès → compteur activé + redirection automatique vers le tableau
 *      de bord (compte à rebours).
 *
 * ⚠️ Sans cet appel, si le webhook FedaPay n'arrive pas, l'abonnement
 *    n'est jamais activé — bien que l'utilisateur voie « Paiement réussi ».
 */

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  GraduationCap,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  CalendarClock,
  LayoutDashboard,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 3000;
const AUTO_REDIRECT_DELAY_MS = 8000;

interface VerifyResult {
  outcome: string;
  invoiceId?: string;
  invoiceNumber?: string;
  amount?: number;
  currentPeriodEnd?: string | null;
  daysRemaining?: number | null;
  message?: string;
}

/** Compte à rebours + redirection automatique vers l'espace enseignant. */
function AutoRedirectToDashboard() {
  const [countdown, setCountdown] = useState(Math.ceil(AUTO_REDIRECT_DELAY_MS / 1000));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          window.location.href = '/prof/dashboard';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <p className="mt-4 text-center text-xs text-slate-500">
      Redirection automatique vers votre tableau de bord dans {countdown}s…
    </p>
  );
}

export default function ProfCheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}

function SuccessContent() {
  const searchParams = useSearchParams();
  // FedaPay remplace les query params : ?id={transactionId}&status=approved
  const fedapayStatus = searchParams.get('status');
  const transactionId = searchParams.get('id') ?? searchParams.get('transactionId');
  const invoiceIdParam = searchParams.get('invoiceId');

  const [state, setState] = useState<'idle' | 'looking-up' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const isApproved =
      fedapayStatus === 'approved' || fedapayStatus === 'success' || Boolean(invoiceIdParam);

    if (!isApproved || (!transactionId && !invoiceIdParam)) {
      setState('error');
      setMessage(
        'Aucun paiement identifié dans le retour de la passerelle. Si vous venez de payer, patientez une minute puis rechargez cette page.',
      );
      return;
    }

    (async () => {
      try {
        // ── 1. Résoudre la facture (id direct ou lookup par transaction) ──
        let invoiceId = invoiceIdParam;
        if (!invoiceId && transactionId) {
          setState('looking-up');
          const lookup = await apiClient.get(
            `/teacher-portal/public/checkout/by-transaction/${encodeURIComponent(transactionId)}`,
            { timeout: 20000 },
          );
          invoiceId = lookup.data?.invoiceId ?? null;
          if (!invoiceId) {
            if (cancelledRef.current) return;
            setState('error');
            setMessage(
              'Aucune facture trouvée pour ce paiement. Si le montant a été débité, contactez le support — l’activation sera effectuée manuellement.',
            );
            return;
          }
        }

        // ── 2. Vérification serveur avec retries (pattern patronat) ──
        setState('verifying');
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          if (cancelledRef.current) return;
          try {
            const verify = await apiClient.post(
              '/teacher-portal/public/checkout/verify',
              { invoiceId },
              { timeout: 30000 },
            );
            const data: VerifyResult = verify.data;

            if (data?.outcome === 'verified' || data?.outcome === 'already_paid') {
              if (cancelledRef.current) return;
              setResult(data);
              setState('success');
              return;
            }

            // PENDING → retry (l'activation FedaPay peut prendre quelques secondes)
            if (attempt < MAX_RETRIES) {
              setMessage(
                data?.message ||
                  'Confirmation du paiement en cours… quelques secondes de patience.',
              );
              await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
              continue;
            }

            // Toujours pas confirmé après les retries
            if (cancelledRef.current) return;
            setResult(data);
            setState('error');
            setMessage(
              data?.message ||
                'Le paiement n’a pas encore été confirmé par la passerelle. Si le montant a été débité, l’activation interviendra automatiquement — vous pouvez vérifier l’état dans vos paramètres.',
            );
            return;
          } catch (e: any) {
            if (cancelledRef.current) return;
            if (attempt < MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
              continue;
            }
            setState('error');
            setMessage(
              e?.response?.data?.message ||
                'La vérification du paiement a échoué. Rechargez la page ou vérifiez l’état de votre abonnement dans vos paramètres.',
            );
            return;
          }
        }
      } catch (e: any) {
        if (cancelledRef.current) return;
        setState('error');
        setMessage(
          e?.response?.data?.message ||
            'Erreur lors de la vérification du paiement. Rechargez la page dans quelques instants.',
        );
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [fedapayStatus, transactionId, invoiceIdParam]);

  const periodEnd = result?.currentPeriodEnd
    ? new Date(result.currentPeriodEnd).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/prof" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-base font-bold text-slate-900">Helm Enseignant</span>
          </Link>
          <Link href="/prof/login" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
            Se connecter
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
            {state === 'idle' || state === 'looking-up' || state === 'verifying' ? (
              <>
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-teal-600" />
                <h1 className="mt-6 text-xl font-bold text-slate-900">
                  Vérification de votre paiement…
                </h1>
                <p className="mt-3 text-sm text-slate-600">
                  {message ||
                    'Nous confirmons votre paiement auprès de la passerelle — ceci prend quelques secondes.'}
                </p>
                <p className="mt-4 text-xs text-slate-400">
                  Ne fermez pas cette page : votre compteur d’abonnement sera activé
                  automatiquement.
                </p>
              </>
            ) : state === 'success' ? (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
                  <CheckCircle className="h-8 w-8 text-teal-600" />
                </div>
                <h1 className="mt-6 text-xl font-bold text-slate-900 sm:text-2xl">
                  Paiement réussi — votre compteur est activé !
                </h1>
                <p className="mt-3 text-sm text-slate-600">
                  Votre abonnement <strong>Helm Enseignant</strong> est actif. Le décompte de vos
                  30 jours est en cours.
                </p>

                <div className="mt-6 space-y-2 rounded-xl border border-teal-200 bg-teal-50 p-5 text-left text-sm">
                  {result?.invoiceNumber && (
                    <p className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Facture</span>
                      <span className="font-semibold text-slate-900">{result.invoiceNumber}</span>
                    </p>
                  )}
                  {result?.amount != null && (
                    <p className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Montant réglé</span>
                      <span className="font-semibold text-slate-900">
                        {result.amount.toLocaleString('fr-FR')} FCFA
                      </span>
                    </p>
                  )}
                  {periodEnd && (
                    <p className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Valide jusqu’au</span>
                      <span className="font-semibold text-slate-900">{periodEnd}</span>
                    </p>
                  )}
                  {result?.daysRemaining != null && (
                    <p className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Jours restants</span>
                      <span className="font-semibold text-teal-700">{result.daysRemaining}</span>
                    </p>
                  )}
                </div>

                <Link
                  href="/prof/dashboard"
                  className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700"
                >
                  <LayoutDashboard className="h-5 w-5" />
                  Accéder à mon espace
                </Link>
                <AutoRedirectToDashboard />
              </>
            ) : (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                  <AlertCircle className="h-8 w-8 text-amber-600" />
                </div>
                <h1 className="mt-6 text-xl font-bold text-slate-900">Confirmation en attente</h1>
                <p className="mt-3 text-sm text-slate-600">{message}</p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Revérifier maintenant
                  </button>
                  <Link
                    href="/prof/parametres?tab=abonnement"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700"
                  >
                    <CalendarClock className="h-4 w-4" />
                    Voir mon abonnement
                  </Link>
                </div>
                <p className="mt-4 text-xs text-slate-400">
                  Si le montant a été débité, votre abonnement sera activé automatiquement dès
                  confirmation par la passerelle.
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
