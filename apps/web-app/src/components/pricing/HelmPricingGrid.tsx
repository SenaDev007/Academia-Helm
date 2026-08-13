'use client';

import HelmPricingCard from './HelmPricingCard';

export interface HelmPricingGridProps {
  initialBillingCycle?: 'MONTHLY' | 'ANNUAL';
}

/**
 * Grille des 4 plans Academia Helm.
 *
 * ⭐ Aligné sur le contrat d'abonnement (Article 4) :
 *   - Facturation ANNUELLE uniquement (plus d'option mensuelle)
 *   - Frais d'activation uniformes : 300 000 FCFA
 *   - 4 plans : Helm Essentiel / Croissance / Performance / Institution
 */
export default function HelmPricingGrid({
  initialBillingCycle = 'ANNUAL',
}: HelmPricingGridProps) {
  // Le contrat prévoit uniquement de la facturation annuelle.
  // On garde l'argument initialBillingCycle pour rétro-compatibilité
  // mais il est forcé à 'ANNUAL'.
  const billingCycle: 'MONTHLY' | 'ANNUAL' = 'ANNUAL';
  void initialBillingCycle;

  const plans: Array<'SEED' | 'GROW' | 'LEAD' | 'NETWORK'> = ['SEED', 'GROW', 'LEAD', 'NETWORK'];

  return (
    <section className="w-full">
      <div className="flex flex-col items-center mb-10">
        <div className="bg-white/80 rounded-full border border-gold-300 px-4 py-2 inline-flex items-center gap-3 shadow-sm">
          <span className="text-xs font-semibold text-slate-700">
            Facturation annuelle — Frais d&apos;activation 300 000 FCFA
          </span>
          <span className="ml-2 text-xs font-semibold text-gold-600">
            WhatsApp illimité inclus
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <HelmPricingCard
            key={plan}
            plan={plan}
            billingCycle={billingCycle}
          />
        ))}
      </div>
    </section>
  );
}
