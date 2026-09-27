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
import { Crown } from 'lucide-react';
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
        <div className="min-h-screen bg-[#071528] pt-24 flex items-start justify-center">
          <div className="text-blue-100/60 text-sm">Chargement…</div>
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
    <div className="min-h-screen bg-[#071528] relative overflow-hidden">
      {/* Halo lumineux (ADN WinAgro) */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] rounded-full bg-blue-600/10 blur-[130px] pointer-events-none" />
      <FederisHeader />
      <div className="pt-24 pb-12 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="fed-badge fed-badge-amber mb-3">Activation</div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight">
              Activation du compte Patronat
            </h1>
            <p className="text-blue-100/60">
              {patronatName ? (
                <>
                  Espace : <span className="font-semibold text-amber-300">{patronatName}</span>
                </>
              ) : (
                'Finalisez la configuration de votre espace'
              )}
            </p>
            {isNewAccount && (
              <p className="mt-3 inline-block text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-700/40 rounded-full px-4 py-1.5">
                Compte créé avec succès. Activez votre abonnement pour accéder à l&rsquo;espace
                patronat.
              </p>
            )}
          </div>

          {/* Statut d'abonnement existant (renouvellement) */}
          {subscription && subscription.status === 'ACTIVE' && (
            <div className="mb-8 p-4 fed-glass-dark rounded-2xl text-sm text-blue-100">
              <p className="font-semibold text-white">Abonnement actif : {subscription.plan}</p>
              {subscription.expiresAt && (
                <p className="text-blue-100/60 mt-1">
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
                    'relative text-left p-8 rounded-3xl transition-all duration-200 fed-card-shimmer',
                    plan.recommended
                      ? 'border-2 border-amber-500 shadow-2xl shadow-amber-500/15 bg-gradient-to-b from-white to-amber-50/40'
                      : 'fed-card border-blue-100',
                    isSelected && 'ring-2 ring-[#1e3a8a] ring-offset-2 ring-offset-[#071528]',
                  )}
                  aria-pressed={isSelected}
                >
                  {plan.recommended && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#0b1d3a] px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/30 inline-flex items-center gap-1.5">
                      <Crown size={12} />
                      Recommandée
                    </span>
                  )}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-black text-[#0b1d3a]">{plan.name}</h3>
                      <p className="text-sm text-slate-500 mt-1">{plan.positioning}</p>
                    </div>
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1',
                        isSelected ? 'border-[#1e3a8a] bg-[#1e3a8a]' : 'border-slate-300',
                      )}
                    >
                      {isSelected && <AppIcon name="check" size="action" className="text-white" />}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-3xl font-black text-[#0b1d3a]">
                      {plan.amount.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-sm text-slate-500 font-medium">
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
                            plan.recommended ? 'text-amber-600' : 'text-[#1e3a8a]',
                          )}
                        />
                        <span className="text-sm text-slate-600 leading-relaxed">{f}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {/* Paiement */}
          <div className="fed-glass-dark rounded-3xl shadow-2xl p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-black text-white">Paiement de l&rsquo;abonnement</h2>
                <p className="text-sm text-blue-100/70 mt-1">
                  Montant à régler :{' '}
                  <span className="font-bold text-amber-300">
                    {(PLANS.find((p) => p.code === selectedPlan)?.amount ?? 0).toLocaleString(
                      'fr-FR',
                    )}{' '}
                    FCFA
                  </span>{' '}
                  — {PLANS.find((p) => p.code === selectedPlan)?.name}, par année scolaire.
                </p>
                <p className="text-xs text-blue-100/50 mt-2">
                  Aucun prélèvement automatique. Des rappels sont envoyés à J-7, J-3 et J-1 avant
                  l&rsquo;échéance. Les archives officielles restent accessibles en lecture après
                  expiration.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePayment}
                disabled={loading}
                className="fed-btn-gold fed-btn-shimmer w-full sm:w-auto flex-shrink-0 px-8 py-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Initialisation…' : 'Payer avec Fedapay'}
              </button>
            </div>

            {message && (
              <div
                className={cn(
                  'p-4 rounded-2xl border text-sm',
                  message.type === 'error'
                    ? 'bg-red-950/40 border-red-800/40 text-red-300'
                    : message.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-700/40 text-emerald-300'
                      : 'bg-blue-950/40 border-blue-800/40 text-blue-200',
                )}
              >
                {message.text}
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-blue-100/40">
                Tarif par entité souscriptrice, TTC sauf mention contraire. Une alerte est émise à
                80 % et 100 % des quotas — aucun dépassement n&rsquo;est facturé automatiquement.
              </p>
              <Link
                href={federisLink('/login')}
                className="text-sm text-amber-400 font-semibold hover:text-amber-300 flex-shrink-0"
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
