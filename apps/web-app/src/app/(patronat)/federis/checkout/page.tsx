/**
 * Page Checkout Academia Federis — Activation du compte Patronat
 *
 * Cahier des charges §12 + proposition tarifaire (27 septembre 2026) :
 *   - Deux offres publiées : Federis Essentiel (100 000 FCFA / année scolaire)
 *     et Federis Institution (250 000 FCFA / année scolaire).
 *   - Paiement via Fedapay (création de facture + transaction).
 *   - Pas de prélèvement automatique — renouvellement manuel par année scolaire.
 *   - Le statut de l'abonnement est visible ; l'interface connectée est bloquée
 *     si l'abonnement a expiré (contrôle côté layout).
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import FederisHeader from '@/components/federis/FederisHeader';
import AppIcon from '@/components/ui/AppIcon';
import { apiClient } from '@/lib/api/client';
import { federisLink, getFederisBasePath } from '@/lib/federis/useFederisPath';
import { cn } from '@/lib/utils';

type PlanCode = 'ESSENTIEL' | 'INSTITUTION';

const PLANS: Array<{
  code: PlanCode;
  name: string;
  positioning: string;
  amount: number;
  quotas: string[];
  features: string[];
  recommended?: boolean;
}> = [
  {
    code: 'ESSENTIEL',
    name: 'Federis Essentiel',
    positioning: 'Pour les patronats qui démarrent.',
    amount: 100_000,
    quotas: [
      "Jusqu'à 5 écoles membres",
      "Jusqu'à 500 candidatures validées sur l'année scolaire",
      '1 campagne active à la fois',
    ],
    features: [
      'Inscriptions, import de candidats, centres et salles, listes et suivi des résultats',
      "Contrôle des accès par rôle et traçabilité des opérations importantes",
      'Guides de démarrage et prise en main en autonomie',
    ],
  },
  {
    code: 'INSTITUTION',
    name: 'Federis Institution',
    positioning: 'Pour les patronats à l’échelle départementale ou régionale.',
    amount: 250_000,
    recommended: true,
    quotas: [
      "Jusqu'à 25 écoles membres",
      "Jusqu'à 3 000 candidatures validées sur l'année scolaire",
      "Jusqu'à 3 campagnes actives simultanément",
    ],
    features: [
      'Toutes les fonctions d’Essentiel, plus pilotage multi-campagnes et rapports étendus',
      'Banque d’épreuves avec gestion des versions et des droits d’accès',
      'Prise en main assistée et traitement prioritaire des demandes',
    ],
  },
];

interface SubscriptionInfo {
  plan: string;
  status: string;
  expiresAt?: string | null;
}

export default function FederisCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 pt-24 flex items-start justify-center">
          <div className="text-gray-500 text-sm">Chargement…</div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const federisBase = getFederisBasePath();

  const [patronatName, setPatronatName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>('INSTITUTION');
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(
    null,
  );

  const isNewAccount = searchParams.get('status') === 'new';

  useEffect(() => {
    const name = searchParams.get('name') || '';
    if (name) setPatronatName(name);

    // Si déjà connecté, charge le statut d'abonnement (renouvellement / changement de plan)
    (async () => {
      try {
        const res = await apiClient.get('/federis/patronat/subscription', { timeout: 15000 });
        if (res.data) {
          setSubscription({
            plan: res.data.plan,
            status: res.data.status,
            expiresAt: res.data.expiresAt,
          });
          if (!name && res.data.planLabel) setPatronatName(res.data.planLabel);
          if (res.data.plan === 'ESSENTIEL' || res.data.plan === 'INSTITUTION') {
            setSelectedPlan(res.data.plan as PlanCode);
          }
        }
      } catch {
        // Non connecté (flux d'inscription) — ignore silencieusement
      }
    })();
     
  }, []);

  const handlePayment = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiClient.post(
        '/federis/patronat/checkout',
        { plan: selectedPlan },
        { timeout: 30000 },
      );
      const { paymentUrl, provider, message: apiMessage, invoice } = res.data ?? {};

      if (paymentUrl) {
        // Redirection vers Fedapay
        window.location.href = paymentUrl;
        return;
      }

      // Fedapay non configuré sur cet environnement : facture créée,
      // finalisation par l'équipe (règle §12.3 — aucune activation automatique).
      setMessage({
        type: 'success',
        text: `${apiMessage ?? 'Facture créée.'} Référence : ${invoice?.number ?? '—'}. L'équipe vous contactera pour finaliser l'activation.`,
      });
    } catch (err: any) {
      console.error('[FederisCheckout] Erreur :', err);
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        router.push(`${federisBase}/login?redirect=${encodeURIComponent(federisBase + '/checkout')}`);
        return;
      }
      const msg =
        err?.response?.data?.message ??
        'Une erreur est survenue lors de la création du paiement. Veuillez réessayer.';
      setMessage({ type: 'error', text: Array.isArray(msg) ? msg.join(' ') : String(msg) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <FederisHeader />
      <div className="pt-24 pb-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Activation du compte Patronat
            </h1>
            <p className="text-gray-600">
              {patronatName ? (
                <>
                  Espace : <span className="font-semibold text-blue-900">{patronatName}</span>
                </>
              ) : (
                'Finalisez la configuration de votre espace'
              )}
            </p>
            {isNewAccount && (
              <p className="mt-3 inline-block text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-1.5">
                Compte créé avec succès. Activez votre abonnement pour accéder à l&rsquo;espace
                patronat.
              </p>
            )}
          </div>

          {/* Statut d'abonnement existant (renouvellement) */}
          {subscription && subscription.status === 'ACTIVE' && (
            <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-900">
              <p className="font-semibold">Abonnement actif : {subscription.plan}</p>
              {subscription.expiresAt && (
                <p className="text-blue-700 mt-1">
                  Échéance : {new Date(subscription.expiresAt).toLocaleDateString('fr-FR')} — le
                  renouvellement est manuel, sans prélèvement automatique.
                </p>
              )}
            </div>
          )}

          {/* Cartes d'offres */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.code;
              return (
                <button
                  key={plan.code}
                  type="button"
                  onClick={() => setSelectedPlan(plan.code)}
                  className={cn(
                    'relative text-left p-8 rounded-2xl border-2 bg-white transition-all duration-200',
                    isSelected
                      ? 'border-blue-800 shadow-lg ring-1 ring-blue-800'
                      : 'border-gray-200 hover:border-blue-300',
                  )}
                  aria-pressed={isSelected}
                >
                  {plan.recommended && (
                    <span className="absolute -top-3 left-6 bg-amber-500 text-blue-950 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                      Recommandée
                    </span>
                  )}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-blue-950">{plan.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{plan.positioning}</p>
                    </div>
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1',
                        isSelected ? 'border-blue-800 bg-blue-800' : 'border-gray-300',
                      )}
                    >
                      {isSelected && <AppIcon name="check" size="action" className="text-white" />}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-3xl font-black text-blue-900">
                      {plan.amount.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-sm text-gray-600 font-medium">
                      FCFA / année scolaire
                    </span>
                  </div>

                  <ul className="space-y-3">
                    {[...plan.quotas, ...plan.features].map((f, fi) => (
                      <li key={fi} className="flex items-start space-x-2.5">
                        <AppIcon
                          name="check"
                          size="action"
                          className={cn(
                            'flex-shrink-0 mt-0.5',
                            plan.recommended ? 'text-amber-600' : 'text-blue-700',
                          )}
                        />
                        <span className="text-sm text-gray-700 leading-relaxed">{f}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {/* Paiement */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Paiement de l&rsquo;abonnement</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Montant à régler :{' '}
                  <span className="font-bold text-blue-900">
                    {(PLANS.find((p) => p.code === selectedPlan)?.amount ?? 0).toLocaleString(
                      'fr-FR',
                    )}{' '}
                    FCFA
                  </span>{' '}
                  — {PLANS.find((p) => p.code === selectedPlan)?.name}, par année scolaire.
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Aucun prélèvement automatique. Des rappels sont envoyés à J-7, J-3 et J-1 avant
                  l&rsquo;échéance. Les archives officielles restent accessibles en lecture après
                  expiration.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePayment}
                disabled={loading}
                className="w-full sm:w-auto flex-shrink-0 px-8 py-4 bg-blue-800 text-white rounded-xl font-bold hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {loading ? 'Initialisation…' : 'Payer avec Fedapay'}
              </button>
            </div>

            {message && (
              <div
                className={cn(
                  'p-4 rounded-md border text-sm',
                  message.type === 'error'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : message.type === 'success'
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-blue-50 border-blue-100 text-blue-700',
                )}
              >
                {message.text}
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-gray-400">
                Tarif par entité souscriptrice, TTC sauf mention contraire. Une alerte est émise à
                80 % et 100 % des quotas — aucun dépassement n&rsquo;est facturé automatiquement.
              </p>
              <Link
                href={federisLink('/login')}
                className="text-sm text-blue-800 font-semibold hover:text-blue-900 flex-shrink-0"
              >
                J&rsquo;ai déjà un abonnement — me connecter
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
