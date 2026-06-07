import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { HELM_PLANS, type HelmPlanKey } from '@/lib/services/HelmPricingService';

export interface HelmPricingCardProps {
  plan: HelmPlanKey;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  onSelectPlan?: (plan: HelmPlanKey) => void;
}

export default function HelmPricingCard({
  plan,
  billingCycle,
  onSelectPlan,
}: HelmPricingCardProps) {
  const config = HELM_PLANS[plan];
  const isHighlighted = config.highlighted;
  const isNetwork = plan === 'NETWORK';
  const price =
    billingCycle === 'MONTHLY' ? config.monthlyPrice : config.annualPrice;

  const studentsRange =
    plan === 'SEED'
      ? '1 – 150 élèves'
      : plan === 'GROW'
      ? '151 – 400 élèves'
      : plan === 'LEAD'
      ? '401 – 800 élèves'
      : 'Multi-campus';

  const href = isNetwork ? '/contact-enterprise' : `/signup?plan=${plan.toLowerCase()}`;

  const borderClass =
    plan === 'SEED'
      ? 'border-blue-600/50 bg-gradient-to-b from-white to-blue-50/40'
      : plan === 'GROW'
      ? 'border-gold-500 bg-gradient-to-b from-white to-amber-50/60'
      : plan === 'LEAD'
      ? 'border-indigo-700/70 bg-gradient-to-b from-white to-indigo-50/60'
      : 'border-slate-500/70 bg-gradient-to-b from-white to-slate-900/5';

  const headerPillClass =
    plan === 'SEED'
      ? 'bg-blue-50 text-blue-800'
      : plan === 'GROW'
      ? 'bg-amber-50 text-amber-800'
      : plan === 'LEAD'
      ? 'bg-indigo-50 text-indigo-800'
      : 'bg-slate-100 text-slate-800';

  const ctaClass = isNetwork
    ? 'bg-slate-900 text-white hover:bg-slate-800'
    : plan === 'SEED'
    ? 'bg-blue-600 text-white hover:bg-blue-700'
    : plan === 'GROW'
    ? 'bg-amber-500 text-slate-900 hover:bg-amber-600'
    : 'bg-indigo-700 text-white hover:bg-indigo-800';

  return (
    <div
      className={[
        'relative flex flex-col rounded-2xl border-2 p-6 shadow-sm transition-all duration-300',
        borderClass,
        isHighlighted && 'shadow-[0_0_30px_rgba(245,166,35,0.3)] ring-2 ring-amber-400/60',
      ].join(' ')}
    >
      {isHighlighted && (
        <div className="absolute -top-3 right-4">
          <span className="inline-block px-3 py-1 bg-gold-500 text-white text-xs font-bold rounded-full shadow">
            Le plus choisi
          </span>
        </div>
      )}

      <div className="mb-2">
        <span
          className={[
            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide',
            headerPillClass,
          ].join(' ')}
        >
          {studentsRange}
        </span>
        <h3
          className={[
            'mt-1 text-xl font-bold',
            plan === 'SEED'
              ? 'text-blue-900'
              : plan === 'GROW'
              ? 'text-amber-800'
              : plan === 'LEAD'
              ? 'text-indigo-900'
              : 'text-slate-900',
          ].join(' ')}
        >
          {config.name}
        </h3>
        <p
          className={[
            'text-sm',
            plan === 'SEED'
              ? 'text-blue-700'
              : plan === 'GROW'
              ? 'text-amber-700'
              : plan === 'LEAD'
              ? 'text-indigo-700'
              : 'text-slate-600',
          ].join(' ')}
        >
          {config.tagline}
        </p>
      </div>

      <div className="mt-4 mb-4">
        <div className="text-sm text-slate-500 mb-1">
          {billingCycle === 'MONTHLY' ? 'Abonnement mensuel' : 'Abonnement annuel'}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-navy-900">
            {price == null ? 'Sur devis' : `${price.toLocaleString('fr-FR')} FCFA`}
          </span>
          {price != null && (
            <span className="text-sm text-slate-600">
              {billingCycle === 'MONTHLY' ? '/ mois' : '/ an'}
            </span>
          )}
        </div>
        {billingCycle === 'ANNUAL' && price != null && config.monthlyPrice != null && (
          <p className="mt-1 text-xs text-gold-600 font-medium">
            Équivalent {Math.round(price / 12).toLocaleString('fr-FR')} FCFA/mois — 2 mois offerts
          </p>
        )}
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>9 modules inclus dans chaque plan</span>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
          Souscription initiale
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-navy-900">
            {config.setupFee.toLocaleString('fr-FR')} FCFA
          </span>
          <span className="text-xs text-slate-600">one-shot à l&apos;ouverture</span>
        </div>
      </div>

      <div className="mt-auto">
        {onSelectPlan ? (
          <button
            type="button"
            onClick={() => onSelectPlan(plan)}
            className={[
              'group inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
              ctaClass,
            ].join(' ')}
          >
            {isNetwork ? 'Demander un devis' : `Choisir ${config.name}`}
          </button>
        ) : (
          <Link
            href={href}
            className={[
              'group inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors',
              ctaClass,
            ].join(' ')}
          >
            {isNetwork ? 'Demander un devis' : `Choisir ${config.name}`}
          </Link>
        )}
      </div>
    </div>
  );
}

