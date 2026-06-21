'use client';

/**
 * ============================================================================
 * SUBSCRIPTIONS WORKSPACE — Catalogue des plans + abonnements actifs
 * ============================================================================
 *
 * Consomme GET /api/platform/plans qui retourne désormais le format enrichi :
 *   { plans: [...], activeSubscriptions: [...], stats: {...} }
 *
 * - Onglet "Catalogue des plans" : cartes SEED/GROW/LEAD/NETWORK avec name,
 *   tagline, prix mensuel/annuel, plage d'élèves (studentMin-studentMax),
 *   liste des features, compteur d'abonnements actifs, badge "Populaire".
 * - Onglet "Abonnements actifs" : tableau tenantName / plan / billingCycle /
 *   statut / jours restants / bilingue / montant mensuel.
 * - Bannière de statistiques en haut : totalActive, totalTrialing, totalMrr (FCFA).
 *
 * Palette AH : blue-900 (titres), amber-500/600 (or, accents, CTAs),
 * red-600 (états d'alerte), emerald (états sains).
 * ============================================================================
 */

import { useState, useMemo } from 'react';
import {
  Package,
  Check,
  Users,
  Sparkles,
  Languages,
  CalendarClock,
  TrendingUp,
  Building2,
} from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface Plan {
  id: string;
  code: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  studentMin: number;
  studentMax: number;
  initialFee: number;
  monthlyAmount: number;
  yearlyAmount: number;
  bilingualMonthly?: number | null;
  bilingualYearly?: number | null;
  features?: string[];
  isPopular?: boolean;
  activeSubscriptions: number;
}

interface ActiveSubscription {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSubdomain?: string | null;
  tenantStatus: string;
  plan: string;
  billingCycle: string;
  status: string;
  bilingualEnabled: boolean;
  currentPeriodEnd?: string | null;
  trialEnd?: string | null;
  daysRemaining: number;
  monthlyAmount: number;
  annualAmount: number;
}

interface PlansData {
  plans: Plan[];
  activeSubscriptions: ActiveSubscription[];
  stats: {
    totalActive: number;
    totalTrialing: number;
    totalGracePeriod: number;
    totalMrr: number;
  };
}

const PLAN_BADGE: Record<string, string> = {
  SEED: 'bg-emerald-100 text-emerald-700',
  GROW: 'bg-sky-100 text-sky-700',
  LEAD: 'bg-violet-100 text-violet-700',
  NETWORK: 'bg-amber-100 text-amber-700',
};

function formatFCFA(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return Number(amount).toLocaleString('fr-FR') + ' F CFA';
}

function planBadgeClass(plan: string): string {
  return PLAN_BADGE[plan?.toUpperCase()] || 'bg-slate-100 text-slate-700';
}

function subStatusBadgeClass(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-100 text-emerald-700';
    case 'TRIALING':
      return 'bg-sky-100 text-sky-700';
    case 'GRACE_PERIOD':
      return 'bg-amber-100 text-amber-700';
    case 'SUSPENDED':
    case 'BLOCKED':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function subStatusLabel(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'Actif';
    case 'TRIALING':
      return 'Essai';
    case 'GRACE_PERIOD':
      return 'Période de grâce';
    case 'SUSPENDED':
      return 'Suspendu';
    case 'BLOCKED':
      return 'Bloqué';
    case 'CANCELED':
      return 'Annulé';
    default:
      return status || '—';
  }
}

export default function SubscriptionsWorkspace() {
  const [activeTab, setActiveTab] = useState<'plans' | 'active'>('plans');
  const { data, loading, error, refetch } = usePlatformData<PlansData>('/plans');

  const plans = useMemo(() => data?.plans || [], [data]);
  const activeSubs = useMemo(() => data?.activeSubscriptions || [], [data]);
  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-blue-900">Abonnements &amp; Plans</h1>
        <p className="text-slate-500">Catalogue des plans et abonnements actifs</p>
      </div>

      {/* Stats banner */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="Abonnements actifs"
            value={String(stats.totalActive ?? 0)}
            accent="emerald"
          />
          <StatCard
            icon={<CalendarClock className="w-5 h-5" />}
            label="En période d'essai"
            value={String(stats.totalTrialing ?? 0)}
            accent="sky"
          />
          <StatCard
            icon={<Sparkles className="w-5 h-5" />}
            label="En période de grâce"
            value={String(stats.totalGracePeriod ?? 0)}
            accent="amber"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="MRR (FCFA / mois)"
            value={formatFCFA(stats.totalMrr ?? 0)}
            accent="blue-900"
          />
        </div>
      )}

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'plans'
              ? 'text-blue-900 border-b-2 border-amber-500'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Catalogue des plans
        </button>
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'active'
              ? 'text-blue-900 border-b-2 border-amber-500'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Abonnements actifs ({activeSubs.length})
        </button>
      </div>

      {loading ? (
        <PlatformLoading label="Chargement des plans…" />
      ) : error ? (
        <PlatformError message={error} onRetry={refetch} />
      ) : !data ? (
        <PlatformEmpty title="Aucune donnée" description="Impossible de charger les plans." />
      ) : activeTab === 'plans' ? (
        plans.length === 0 ? (
          <PlatformEmpty title="Aucun plan" description="Aucun plan d'abonnement n'a été configuré." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        )
      ) : activeSubs.length === 0 ? (
        <PlatformEmpty
          title="Aucun abonnement actif"
          description="Aucun abonnement Helm n'est actuellement actif."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Établissement</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Plan</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Cycle</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Jours restants</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Bilingue</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Montant mensuel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeSubs.map((sub) => {
                  const daysClass =
                    sub.daysRemaining < 7
                      ? 'text-red-600 font-bold'
                      : sub.daysRemaining < 15
                        ? 'text-amber-600 font-bold'
                        : 'text-emerald-700 font-semibold';
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{sub.tenantName}</div>
                        {sub.tenantSubdomain && (
                          <div className="text-xs text-slate-500 font-mono">
                            {sub.tenantSubdomain}.academiahelm.com
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${planBadgeClass(
                            sub.plan,
                          )}`}
                        >
                          {sub.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-700">
                        {sub.billingCycle === 'ANNUAL' ? 'Annuel' : sub.billingCycle === 'MONTHLY' ? 'Mensuel' : sub.billingCycle || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${subStatusBadgeClass(
                            sub.status,
                          )}`}
                        >
                          {subStatusLabel(sub.status)}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm ${daysClass}`}>
                        {sub.daysRemaining > 0 ? `${sub.daysRemaining} j` : 'Expiré'}
                      </td>
                      <td className="px-6 py-4">
                        {sub.bilingualEnabled ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[10px] font-bold uppercase"
                            title="Mode bilingue activé"
                          >
                            <Languages className="w-3 h-3" /> OUI
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">
                        {formatFCFA(sub.monthlyAmount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'emerald' | 'sky' | 'amber' | 'blue-900';
}) {
  const accentMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    'blue-900': 'bg-blue-50 text-blue-900 border-blue-200',
  } as const;
  return (
    <div className={`p-4 rounded-2xl border ${accentMap[accent]}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center">
          {icon}
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      </div>
      <p className="mt-2 text-xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const features: string[] = Array.isArray(plan.features) ? plan.features : [];
  return (
    <div
      className={`relative p-6 bg-white rounded-2xl border-2 shadow-sm flex flex-col ${
        plan.isPopular ? 'border-amber-500' : 'border-slate-200'
      }`}
    >
      {plan.isPopular && (
        <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-extrabold uppercase shadow">
          ★ Populaire
        </span>
      )}
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
          <Package className="w-5 h-5" />
        </div>
        <span
          className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${planBadgeClass(
            plan.code,
          )}`}
        >
          {plan.code}
        </span>
      </div>
      <h3 className="font-bold text-blue-900 text-lg leading-tight">{plan.name}</h3>
      {plan.tagline && <p className="text-xs text-slate-500 mt-1">{plan.tagline}</p>}

      <div className="mt-4 mb-3">
        <div className="text-2xl font-extrabold text-slate-900">
          {Number(plan.monthlyAmount || 0).toLocaleString('fr-FR')}
          <span className="text-xs font-medium text-slate-500"> F CFA / mois</span>
        </div>
        <div className="text-xs text-slate-500 mt-0.5">
          ou {Number(plan.yearlyAmount || 0).toLocaleString('fr-FR')} F CFA / an
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-600 mb-3">
        <Building2 className="w-3.5 h-3.5 text-slate-400" />
        <span>
          {plan.studentMin}-{plan.studentMax} élèves
        </span>
        <span className="text-slate-300">•</span>
        <span>Frais d'activation : {Number(plan.initialFee || 0).toLocaleString('fr-FR')} F CFA</span>
      </div>

      {features.length > 0 && (
        <ul className="space-y-1.5 text-xs text-slate-700 mb-4 flex-1">
          {features.slice(0, 6).map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{f}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span className="inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            Abonnements actifs
          </span>
          <span className="font-bold text-slate-900">{plan.activeSubscriptions}</span>
        </div>
      </div>
    </div>
  );
}
