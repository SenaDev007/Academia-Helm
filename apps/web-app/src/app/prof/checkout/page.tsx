'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — CHECKOUT (activation / renouvellement / réactivation)
 * ============================================================================
 *
 * Même flux de paiement que le portail Patronat : facture + transaction
 * FedaPay → redirection vers le widget de paiement → retour sur
 * /prof/checkout/success qui vérifie le paiement côté serveur (le webhook
 * FedaPay active l'abonnement en parallèle).
 *
 * Contextes d'arrivée sur cette page :
 *   - ONBOARDING  : juste après l'inscription (compteur à activer) ;
 *   - RENOUVELLEMENT : depuis les paramètres ou l'email J-7 / J-24h
 *     (?renew=1 — le paiement ajoute 30 jours, aucun jour perdu) ;
 *   - RÉACTIVATION : compte inactif après la grâce de 7 jours
 *     (?reactivate=1 — à la connexion, l'enseignant est renvoyé ici).
 */

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  GraduationCap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ShieldCheck,
  CalendarClock,
  ArrowLeft,
} from 'lucide-react';
import apiClient from '@/lib/api/client';

interface SubscriptionStatus {
  status: string;
  activated: boolean;
  monthlyFee: number;
  billingCycle: string;
  currentPeriodEnd: string | null;
  currentPeriodStart: string | null;
  daysRemaining: number | null;
  gracePeriodEnd: string | null;
  message: string | null;
}

const FEATURES = [
  'Cahier journal, fiches pédagogiques, cahier de textes — prêts à remplir',
  'Planification mensuelle et annuelle avec export PDF',
  'Évaluations, saisie de notes et génération des bulletins',
  'Tous les niveaux : Maternelle, Primaire, Secondaire',
  'Impression PDF avec VOS en-têtes et pieds de page',
  'Mode hors ligne : préparez vos classes sans connexion',
];

const PERIOD_DAYS = 30;

export default function ProfCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const isReactivate = searchParams.get('reactivate') === '1' || searchParams.get('renew') === '1';

  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await apiClient.get('/teacher-portal/checkout/status', { timeout: 20000 });
      setStatus(response.data);
    } catch (e: any) {
      setError(
        e?.response?.status === 401
          ? 'Session expirée — reconnectez-vous pour poursuivre le paiement.'
          : 'Impossible de charger l’état de votre abonnement. Vérifiez votre connexion.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handlePayment = async () => {
    if (paying) return;
    setPaying(true);
    setError(null);
    try {
      const response = await apiClient.post(
        '/teacher-portal/checkout/initiate',
        // ⭐ L'origine de retour permet à FedaPay de ramener l'enseignant sur
        //    SON domaine (enseignant.academiahelm.com ou academiahelm.com).
        { returnBaseUrl: window.location.origin },
        { timeout: 30000 },
      );
      const { paymentUrl, message } = response.data ?? {};
      if (paymentUrl && typeof paymentUrl === 'string' && paymentUrl.startsWith('https://')) {
        window.location.href = paymentUrl;
        return; // la redirection charge la page de paiement FedaPay
      }
      setError(
        message ||
          'La passerelle de paiement est momentanément indisponible. Réessayez dans quelques instants.',
      );
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          'L’initialisation du paiement a échoué. Vérifiez votre connexion et réessayez.',
      );
    } finally {
      setPaying(false);
    }
  };

  // ── Libellés d'état ──
  const state = status?.status ?? '';
  const periodEnd = status?.currentPeriodEnd
    ? new Date(status.currentPeriodEnd).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;
  const graceEnd = status?.gracePeriodEnd
    ? new Date(status.gracePeriodEnd).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const ctaLabel =
    state === 'SUSPENDED' || state === 'BLOCKED'
      ? 'Réactiver mon compte — 2 000 FCFA'
      : state === 'GRACE_PERIOD'
        ? 'Renouveler et réactiver — 2 000 FCFA'
        : status?.activated
          ? 'Renouveler maintenant — 2 000 FCFA'
          : 'Activer mon abonnement — 2 000 FCFA';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* ── Header ── */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/prof" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-base font-bold text-slate-900">Helm Enseignant</span>
          </Link>
          <Link
            href={status?.activated ? '/prof/dashboard' : '/prof/login'}
            className="text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            {status?.activated ? 'Mon espace' : 'Se connecter'}
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-2xl space-y-6">
          {/* ── Bandeau contextuel ── */}
          {isReactivate && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                <strong>Réactivation de votre compte.</strong> Réglez votre mensualité pour
                redémarrer votre compteur de {PERIOD_DAYS} jours — vos données (cahiers, fiches,
                évaluations, bulletins) ont été intégralement conservées.
              </p>
            </div>
          )}

          {/* ── Carte principale ── */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* En-tête tarifaire */}
            <div className="bg-slate-900 px-6 py-8 text-center sm:px-10">
              <p className="text-sm font-medium uppercase tracking-wide text-teal-400">
                Abonnement mensuel
              </p>
              <div className="mt-3 flex flex-wrap items-baseline justify-center gap-x-2">
                <span className="text-4xl font-extrabold text-white sm:text-5xl">2 000</span>
                <span className="text-lg text-slate-300">FCFA / mois</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                {PERIOD_DAYS} jours d’accès complet — résiliable à tout moment, sans engagement.
              </p>
            </div>

            {/* État de l'abonnement */}
            <div className="px-6 py-6 sm:px-10">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement de l’état de votre abonnement…
                </div>
              ) : state === 'SUSPENDED' || state === 'BLOCKED' ? (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Compte inactif</p>
                    <p className="mt-1">
                      Votre abonnement a expiré et la période de grâce de 7 jours est terminée.
                      Réglez votre mensualité pour réactiver votre espace — vos données sont
                      conservées.
                    </p>
                  </div>
                </div>
              ) : state === 'GRACE_PERIOD' ? (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <CalendarClock className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Période de grâce en cours</p>
                    <p className="mt-1">
                      Votre abonnement a expiré, mais votre espace reste accessible jusqu’au{' '}
                      <strong>{graceEnd}</strong>. Renouvelez dès maintenant pour éviter
                      l’interruption.
                    </p>
                  </div>
                </div>
              ) : status?.activated ? (
                <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      Compteur activé
                      {status.daysRemaining != null
                        ? ` — ${status.daysRemaining} jour${status.daysRemaining > 1 ? 's' : ''} restants`
                        : ''}
                    </p>
                    {periodEnd && (
                      <p className="mt-1">
                        Votre abonnement est actif jusqu’au <strong>{periodEnd}</strong>. Un
                        renouvellement maintenant ajoute {PERIOD_DAYS} jours supplémentaires —
                        aucun jour perdu.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                  <div>
                    <p className="font-semibold text-slate-900">Compteur non activé</p>
                    <p className="mt-1">
                      {status?.message ||
                        'Effectuez le paiement pour activer votre compteur : le décompte de 30 jours est enregistré depuis la création de votre compte.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Inclusion */}
              <ul className="mt-6 space-y-2.5 text-sm text-slate-600">
                {FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                    {feature}
                  </li>
                ))}
              </ul>

              {error && (
                <div className="mt-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Paiement */}
              <button
                onClick={handlePayment}
                disabled={paying || loading}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-teal-600/20 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {paying ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Redirection vers le paiement…
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5" />
                    {ctaLabel}
                  </>
                )}
              </button>

              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                Paiement sécurisé FedaPay — Mobile Money (MTN, Moov, Celtiis) et carte bancaire.
              </p>
            </div>
          </div>

          {/* ── Rappel du cycle ── */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 sm:p-6">
            <p className="flex items-center gap-2 font-semibold text-slate-900">
              <CalendarClock className="h-4 w-4 text-teal-600" />
              Comment fonctionne votre abonnement
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: 'Rappels automatiques',
                  text: 'Un email 7 jours puis 24 heures avant l’expiration de vos 30 jours.',
                },
                {
                  title: 'Grâce de 7 jours',
                  text: 'Après expiration, votre espace reste pleinement actif 7 jours de plus.',
                },
                {
                  title: 'Réactivation simple',
                  text: 'Compte inactif après la grâce ? Un paiement suffit — données conservées.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <Link
              href={status?.activated ? '/prof/dashboard' : '/prof'}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              {status?.activated ? 'Retour à mon espace' : 'Retour à l’accueil'}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
