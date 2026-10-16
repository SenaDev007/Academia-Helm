'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — SUCCÈS DE L'INSCRIPTION (vérification serveur)
 * ============================================================================
 *
 * Callback après le paiement FedaPay d'INSCRIPTION — même pattern que le
 * checkout du patronat : FedaPay redirige vers
 * /prof/register/success?id={transactionId}&status=approved en REMPLAÇANT
 * les query params d'origine (draftId…).
 *
 *   1. Résoudre l'inscription : draftId dans l'URL, sinon lookup
 *      GET /teacher-portal/public/signup/by-transaction/{id} ;
 *   2. Vérifier le statut RÉEL côté serveur :
 *      POST /teacher-portal/public/signup/verify { draftId }
 *      → le backend interroge l'API FedaPay, CRÉE LE COMPTE (provisioning
 *        complet : niveaux, classes, matières), active l'abonnement 30 jours
 *        et envoie l'email d'identifiants (idempotent — le webhook fait la
 *        même chose en parallèle) ;
 *   3. Retries (5 × 3 s) si PENDING — la création peut prendre quelques
 *      secondes après le retour de FedaPay ;
 *   4. Succès → compte créé : bannière de confirmation + bouton « Se
 *      connecter » (pas de connexion automatique — l'enseignant s'identifie
 *      avec le mot de passe choisi à l'étape 1, rappelé par email).
 *
 * ⚠️ Sans cet appel, si le webhook FedaPay n'arrive pas, le compte n'est
 *    jamais créé — bien que l'utilisateur voie « Paiement réussi ».
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
  LogIn,
  Mail,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 3000;

interface VerifyResult {
  outcome: string;
  draftId?: string;
  email?: string;
  loginUrl?: string;
  currentPeriodEnd?: string | null;
  daysRemaining?: number | null;
  message?: string;
}

export default function ProfRegisterSuccessPage() {
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
  const draftIdParam = searchParams.get('draftId');

  const [state, setState] = useState<'idle' | 'looking-up' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    const isApproved =
      fedapayStatus === 'approved' || fedapayStatus === 'success' || Boolean(draftIdParam);

    if (!isApproved || (!transactionId && !draftIdParam)) {
      setState('error');
      setMessage(
        'Aucun paiement identifié dans le retour de la passerelle. Si vous venez de payer, patientez une minute puis rechargez cette page.',
      );
      return;
    }

    (async () => {
      try {
        // ── 1. Résoudre le draft (draftId direct, sinon lookup par transaction) ──
        let draftId: string | null = draftIdParam;
        if (!draftId && transactionId) {
          setState('looking-up');
          const lookup = await apiClient.get(
            `/teacher-portal/public/signup/by-transaction/${encodeURIComponent(transactionId)}`,
            { timeout: 15000 },
          );
          const data = lookup.data ?? {};
          if (data?.found && data?.draftId) {
            draftId = data.draftId as string;
          } else {
            setState('error');
            setMessage(
              'Votre inscription est introuvable. Si vous venez de payer, patientez une minute puis rechargez cette page.',
            );
            return;
          }
        }

        // ── 2. Vérifier le paiement + créer le compte (retries si PENDING) ──
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          if (cancelledRef.current) return;
          setState('verifying');
          try {
            const verify = await apiClient.post(
              '/teacher-portal/public/signup/verify',
              draftId ? { draftId } : { transactionId },
              { timeout: 25000 },
            );
            const data: VerifyResult = verify.data ?? {};
            const outcome = String(data.outcome || '');

            if (outcome === 'verified' || outcome === 'already_activated') {
              if (cancelledRef.current) return;
              setResult(data);
              setState('success');
              return;
            }

            if (outcome === 'pending' && attempt < MAX_RETRIES) {
              setMessage(
                data?.message ||
                  'Confirmation du paiement en cours — vérification dans quelques secondes…',
              );
              await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
              continue;
            }

            if (cancelledRef.current) return;
            setResult(data);
            setState('error');
            setMessage(
              data?.message ||
                'Le paiement n’a pas encore été confirmé par la passerelle. Si vous avez payé, patientez une minute puis rechargez cette page.',
            );
            return;
          } catch (e: any) {
            if (attempt >= MAX_RETRIES) {
              if (cancelledRef.current) return;
              setState('error');
              setMessage(
                e?.response?.data?.message ||
                  'La vérification du paiement a échoué. Rechargez la page dans une minute.',
              );
              return;
            }
            await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
          }
        }
      } catch (e: any) {
        if (cancelledRef.current) return;
        setState('error');
        setMessage(
          e?.response?.data?.message ||
            'Impossible de vérifier votre paiement pour le moment. Rechargez la page dans une minute.',
        );
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [fedapayStatus, transactionId, draftIdParam]);

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

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* ── En cours de vérification ── */}
          {(state === 'idle' || state === 'looking-up' || state === 'verifying') && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-teal-600" />
              <h1 className="mt-4 text-xl font-bold text-slate-900">
                Vérification de votre paiement…
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {message ||
                  'Nous confirmons votre paiement auprès de la passerelle sécurisée, puis nous créons votre espace enseignant (quelques secondes).'}
              </p>
              <p className="mt-4 text-xs text-slate-400">
                Ne fermez pas cette page — la vérification est automatique.
              </p>
            </div>
          )}

          {/* ── Succès : compte créé ── */}
          {state === 'success' && (
            <div className="rounded-2xl border border-teal-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
                <CheckCircle className="h-8 w-8 text-teal-600" />
              </div>
              <h1 className="mt-4 text-2xl font-bold text-slate-900">
                Votre espace enseignant est prêt !
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Votre paiement a été confirmé et votre compte a été créé. Un email de
                confirmation avec vos identifiants vient de vous être envoyé
                {result?.email ? (
                  <> à <strong>{result.email}</strong></>
                ) : null}.
              </p>

              <div className="mt-5 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-700">
                <p className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                  <span>
                    Connectez-vous avec <strong>votre email</strong> et le{' '}
                    <strong>mot de passe choisi lors de l’inscription</strong>.
                  </span>
                </p>
                {result?.currentPeriodEnd && (
                  <p className="flex items-start gap-2">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    <span>
                      Abonnement actif <strong>30 jours</strong>, jusqu’au{' '}
                      <strong>
                        {new Date(result.currentPeriodEnd).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </strong>
                      .
                    </span>
                  </p>
                )}
              </div>

              <Link
                href="/prof/login"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700"
              >
                <LogIn className="h-5 w-5" />
                Se connecter à mon espace
              </Link>
              <p className="mt-4 text-xs text-slate-400">
                Cahier journal, fiches, évaluations, bulletins : tout est déjà installé pour
                vos niveaux.
              </p>
            </div>
          )}

          {/* ── Erreur / en attente ── */}
          {state === 'error' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                <AlertCircle className="h-8 w-8 text-amber-600" />
              </div>
              <h1 className="mt-4 text-xl font-bold text-slate-900">
                Paiement en attente de confirmation
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{message}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Revérifier maintenant
                </button>
                <Link
                  href="/prof/register"
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  Revenir à l’inscription
                </Link>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Si vous avez payé, votre compte sera créé automatiquement dès la confirmation
                — vos identifiants vous seront envoyés par email.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
