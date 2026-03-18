/**
 * Tarification Page Component
 *
 * Alignée sur les plans HELM (SEED, GROW, LEAD, NETWORK)
 * et sur la spec officielle de pricing.
 */

import PremiumHeader from '../layout/PremiumHeader';
import Link from 'next/link';
import { CheckCircle, Users, ArrowRight, Building2 } from 'lucide-react';
import { useState } from 'react';
import { HELM_PLANS, type HelmPlanKey } from '@/lib/services/HelmPricingService';

function formatAmount(amount: number | null) {
  if (amount == null) return 'Sur devis';
  return `${amount.toLocaleString('fr-FR')} FCFA`;
}

interface PlanMeta {
  code: HelmPlanKey;
  studentsRange: string;
  description: string;
}

const PLAN_META: PlanMeta[] = [
  {
    code: 'SEED',
    studentsRange: '1 – 150 élèves',
    description: 'Idéal pour démarrer avec une école unique structurée.',
  },
  {
    code: 'GROW',
    studentsRange: '151 – 400 élèves',
    description: 'Pour les établissements en croissance qui pilotent leurs indicateurs.',
  },
  {
    code: 'LEAD',
    studentsRange: '401 – 800 élèves',
    description: 'Pour les grands établissements qui veulent dominer leur marché.',
  },
  {
    code: 'NETWORK',
    studentsRange: 'Multi-campus',
    description: 'Pour les groupes scolaires et réseaux éducatifs.',
  },
];

export default function TarificationPage() {
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');

  return (
    <div className="min-h-screen bg-white">
      <PremiumHeader />
      <div className="h-20" />

      <section className="py-16 md:py-20 bg-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-4">
            Pilotez votre école avec Academia Helm
          </h1>
          <p className="text-lg md:text-xl text-slate-600 leading-relaxed mb-4">
            Tout inclus. Un seul prix. Zéro surprise.
          </p>
          <p className="text-sm md:text-base text-slate-600">
            Les 9 modules complets dans chaque plan — élèves, finances, IA ORION, bulletins, et plus.
          </p>
        </div>
      </section>

      <section className="py-10 bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col items-center mb-10">
            <div className="inline-flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-navy-900" />
              <span className="text-sm font-semibold uppercase tracking-wide text-navy-900">
                Plans basés sur l&apos;effectif élèves
              </span>
            </div>
            <div className="bg-white rounded-full border border-gold-300 px-4 py-2 inline-flex items-center gap-3 shadow-sm">
              <span className="text-xs font-medium text-slate-600">Période de facturation</span>
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
            {PLAN_META.map((meta) => {
              const plan = HELM_PLANS[meta.code];
              const isHighlighted = plan.highlighted;
              const isNetwork = meta.code === 'NETWORK';
              const price =
                billingCycle === 'MONTHLY' ? plan.monthlyPrice : plan.annualPrice;

              const borderClass =
                meta.code === 'SEED'
                  ? 'border-blue-600/50 bg-gradient-to-b from-white to-blue-50/40'
                  : meta.code === 'GROW'
                  ? 'border-gold-500 bg-gradient-to-b from-white to-amber-50/60'
                  : meta.code === 'LEAD'
                  ? 'border-indigo-700/70 bg-gradient-to-b from-white to-indigo-50/60'
                  : 'border-slate-500/70 bg-gradient-to-b from-white to-slate-900/5';

              const headerPillClass =
                meta.code === 'SEED'
                  ? 'bg-blue-50 text-blue-800'
                  : meta.code === 'GROW'
                  ? 'bg-amber-50 text-amber-800'
                  : meta.code === 'LEAD'
                  ? 'bg-indigo-50 text-indigo-800'
                  : 'bg-slate-100 text-slate-800';

              const ctaClass = isNetwork
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : meta.code === 'SEED'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : meta.code === 'GROW'
                ? 'bg-amber-500 text-slate-900 hover:bg-amber-600'
                : 'bg-indigo-700 text-white hover:bg-indigo-800';

              return (
                <div
                  key={meta.code}
                  className={`relative flex flex-col rounded-2xl border-2 p-6 shadow-sm ${borderClass} ${
                    isHighlighted ? 'shadow-[0_0_30px_rgba(245,166,35,0.3)] ring-2 ring-amber-400/60' : ''
                  } transition-all duration-300`}
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
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${headerPillClass}`}
                    >
                      {meta.studentsRange}
                    </span>
                    <h2
                      className={`mt-1 text-xl font-bold ${
                        meta.code === 'SEED'
                          ? 'text-blue-900'
                          : meta.code === 'GROW'
                          ? 'text-amber-800'
                          : meta.code === 'LEAD'
                          ? 'text-indigo-900'
                          : 'text-slate-900'
                      }`}
                    >
                      {plan.name}
                    </h2>
                    <p
                      className={`text-sm ${
                        meta.code === 'SEED'
                          ? 'text-blue-700'
                          : meta.code === 'GROW'
                          ? 'text-amber-700'
                          : meta.code === 'LEAD'
                          ? 'text-indigo-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {plan.tagline}
                    </p>
                  </div>

                  <div className="mt-4 mb-4">
                    <div className="text-sm text-slate-500 mb-1">
                      {billingCycle === 'MONTHLY' ? 'Abonnement mensuel' : 'Abonnement annuel'}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-navy-900">
                        {formatAmount(price)}
                      </span>
                      {price != null && (
                        <span className="text-sm text-slate-600">
                          {billingCycle === 'MONTHLY' ? '/ mois' : '/ an'}
                        </span>
                      )}
                    </div>
                    {billingCycle === 'ANNUAL' && price != null && plan.monthlyPrice != null && (
                      <p className="mt-1 text-xs text-gold-600 font-medium">
                        Équivalent {Math.round(price / 12).toLocaleString('fr-FR')} FCFA/mois
                      </p>
                    )}
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>9 modules inclus dans chaque plan</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{meta.description}</p>
                  </div>

                  <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                      Souscription initiale
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-navy-900">
                        {formatAmount(plan.setupFee)}
                      </span>
                      <span className="text-xs text-slate-600">one-shot à l&apos;ouverture</span>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <Link
                      href={
                        isNetwork
                          ? '/contact-enterprise'
                          : `/signup?plan=${meta.code.toLowerCase()}`
                      }
                      className={`group inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${ctaClass}`}
                    >
                      {isNetwork ? 'Demander un devis' : `Choisir ${plan.name}`}
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="p-3 rounded-lg bg-navy-900 text-white mr-2">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base md:text-lg font-semibold text-navy-900 mb-1">
                  Les 9 modules. Dans chaque plan. Sans exception.
                </h3>
                <p className="text-sm text-slate-600">
                  Nos concurrents vendent chaque brique séparément. Avec Academia Helm, vous
                  pilotez l&apos;école entière dès le premier jour : élèves, finances, examens,
                  RH, QHSE, communication, IA ORION, et modules complémentaires.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}


