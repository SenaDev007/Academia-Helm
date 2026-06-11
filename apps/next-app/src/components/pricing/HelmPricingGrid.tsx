'use client';

import { useState } from 'react';
import HelmPricingCard from './HelmPricingCard';
import type { HelmPlanKey } from '@/lib/services/HelmPricingService';

export interface HelmPricingGridProps {
  initialBillingCycle?: 'MONTHLY' | 'ANNUAL';
}

export default function HelmPricingGrid({
  initialBillingCycle = 'MONTHLY',
}: HelmPricingGridProps) {
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>(
    initialBillingCycle,
  );

  const plans: HelmPlanKey[] = ['SEED', 'GROW', 'LEAD', 'NETWORK'];

  return (
    <section className="w-full">
      <div className="flex flex-col items-center mb-10">
        <div className="bg-white/80 rounded-full border border-gold-300 px-4 py-2 inline-flex items-center gap-3 shadow-sm">
          <span className="text-xs font-medium text-slate-600">
            Période de facturation
          </span>
          <button
            type="button"
            onClick={() => setBillingCycle('MONTHLY')}
            className={`px-3 py-1 text-xs rounded-full font-semibold ${
              billingCycle === 'MONTHLY'
                ? 'bg-navy-900 text-white'
                : 'bg-transparent text-slate-600 hover:bg-slate-100'
            }`}
          >
            Mensuel
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('ANNUAL')}
            className={`px-3 py-1 text-xs rounded-full font-semibold ${
              billingCycle === 'ANNUAL'
                ? 'bg-gold-500 text-white'
                : 'bg-transparent text-slate-600 hover:bg-slate-100'
            }`}
          >
            Annuel
          </button>
          {billingCycle === 'ANNUAL' && (
            <span className="ml-2 text-xs font-semibold text-gold-600">
              2 mois offerts
            </span>
          )}
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

