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
  Pencil,
  X,
  Loader2,
  AlertCircle,
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

// ─── CATALOGUE EDITING (pricing_plans) ───────────────────────────────────────
//
// Le catalogue SEED / GROW / LEAD / NETWORK est éditable depuis le back-office.
// Les brouillons (EditablePlan) utilisent des chaînes pour les champs numériques
// afin de gérer proprement le état « vide » (= null côté backend) pour les
// montants optionnels (studentMax, monthlyAmount, yearlyAmount,
// bilingualMonthly, bilingualYearly — notamment pour NETWORK « Sur devis »).
// ────────────────────────────────────────────────────────────────────────────

interface EditablePlan {
  id: string;
  code: string;
  name: string;
  tagline: string;
  description: string;
  studentMin: string;
  studentMax: string; // '' = null (Illimité / Sur devis)
  initialFee: string;
  monthlyAmount: string; // '' = null (Sur devis pour NETWORK)
  yearlyAmount: string; // '' = null (Sur devis pour NETWORK)
  bilingualMonthly: string;
  bilingualYearly: string;
  featuresText: string; // fonctionnalités séparées par '\n'
  isPopular: boolean;
  isActive: boolean;
}

function planToDraft(plan: Plan): EditablePlan {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name || '',
    tagline: plan.tagline || '',
    description: plan.description || '',
    studentMin: plan.studentMin != null ? String(plan.studentMin) : '0',
    studentMax: plan.studentMax != null ? String(plan.studentMax) : '',
    initialFee: plan.initialFee != null ? String(plan.initialFee) : '0',
    monthlyAmount: plan.monthlyAmount != null ? String(plan.monthlyAmount) : '',
    yearlyAmount: plan.yearlyAmount != null ? String(plan.yearlyAmount) : '',
    bilingualMonthly: plan.bilingualMonthly != null ? String(plan.bilingualMonthly) : '',
    bilingualYearly: plan.bilingualYearly != null ? String(plan.bilingualYearly) : '',
    featuresText: Array.isArray(plan.features) ? plan.features.join('\n') : '',
    isPopular: !!plan.isPopular,
    // L'endpoint /plans ne renvoie que les plans actifs → on part sur `true`.
    isActive: true,
  };
}

function numOrNull(v: string): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function numOrZero(v: string): number {
  const n = numOrNull(v);
  return n === null ? 0 : n;
}

function draftToPayload(draft: EditablePlan) {
  return {
    code: draft.code,
    name: draft.name.trim(),
    tagline: draft.tagline.trim() || null,
    description: draft.description.trim() || null,
    studentMin: numOrZero(draft.studentMin),
    studentMax: numOrNull(draft.studentMax),
    initialFee: numOrZero(draft.initialFee),
    monthlyAmount: numOrNull(draft.monthlyAmount),
    yearlyAmount: numOrNull(draft.yearlyAmount),
    bilingualMonthly: numOrNull(draft.bilingualMonthly),
    bilingualYearly: numOrNull(draft.bilingualYearly),
    features: draft.featuresText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    isPopular: draft.isPopular,
    isActive: draft.isActive,
  };
}

function isDraftModified(original: Plan, draft: EditablePlan): boolean {
  const origFeatures = Array.isArray(original.features) ? original.features.join('\n') : '';
  const sameNum = (a: string, b: number | null | undefined) =>
    (a === '' ? null : Number(a)) === (b ?? null);
  if (draft.name !== (original.name || '')) return true;
  if (draft.tagline !== (original.tagline || '')) return true;
  if (draft.description !== (original.description || '')) return true;
  if (Number(draft.studentMin || 0) !== (original.studentMin ?? 0)) return true;
  if (!sameNum(draft.studentMax, original.studentMax)) return true;
  if (Number(draft.initialFee || 0) !== (original.initialFee ?? 0)) return true;
  if (!sameNum(draft.monthlyAmount, original.monthlyAmount)) return true;
  if (!sameNum(draft.yearlyAmount, original.yearlyAmount)) return true;
  if (!sameNum(draft.bilingualMonthly, original.bilingualMonthly)) return true;
  if (!sameNum(draft.bilingualYearly, original.bilingualYearly)) return true;
  if (draft.featuresText !== origFeatures) return true;
  if (draft.isPopular !== !!original.isPopular) return true;
  // Les plans chargés depuis /plans sont implicitement actifs.
  if (draft.isActive !== true) return true;
  return false;
}

export default function SubscriptionsWorkspace() {
  const [activeTab, setActiveTab] = useState<'plans' | 'active'>('plans');
  const { data, loading, error, refetch } = usePlatformData<PlansData>('/plans');

  const plans = useMemo(() => data?.plans || [], [data]);
  const activeSubs = useMemo(() => data?.activeSubscriptions || [], [data]);
  const stats = data?.stats;

  // ── Édition du catalogue (pricing_plans) ──
  const [editOpen, setEditOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, EditablePlan>>({});
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const openEdit = () => {
    setEditError(null);
    setEditSuccess(null);
    const map: Record<string, EditablePlan> = {};
    for (const p of plans) map[p.id] = planToDraft(p);
    setDrafts(map);
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (saving) return;
    setEditOpen(false);
    setEditError(null);
    setEditSuccess(null);
  };

  const updateDraft = (id: string, patch: Partial<EditablePlan>) => {
    setDrafts((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  };

  const saveAll = async () => {
    setSaving(true);
    setEditError(null);
    setEditSuccess(null);
    const toUpdate = plans.filter((p) => drafts[p.id] && isDraftModified(p, drafts[p.id]));
    if (toUpdate.length === 0) {
      setSaving(false);
      setEditSuccess('Aucune modification à enregistrer.');
      return;
    }
    const results = await Promise.allSettled(
      toUpdate.map((p) =>
        fetch(`/api/platform/pricing-plans/${encodeURIComponent(p.id)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftToPayload(drafts[p.id])),
        }).then(async (r) => {
          if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            throw new Error(body?.error || body?.message || `Erreur ${r.status}`);
          }
          return r.json();
        }),
      ),
    );
    const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (failures.length > 0) {
      const firstReason = (failures[0].reason as Error)?.message || 'erreur inconnue';
      setSaving(false);
      setEditError(
        `${failures.length} plan(s) n'ont pas pu être mis à jour : ${firstReason}`,
      );
      // Rafraîchit les originaux pour que les plans déjà sauvegardés ne soient
      // plus considérés comme « modifiés » lors d'une nouvelle tentative.
      refetch();
      return;
    }
    setSaving(false);
    setEditSuccess(`Catalogue mis à jour (${toUpdate.length} plan(s) modifié(s)).`);
    refetch();
    setTimeout(() => {
      setEditOpen(false);
      setEditSuccess(null);
    }, 1000);
  };

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
          <div className="space-y-5">
            <div className="flex items-center justify-end">
              <button
                onClick={openEdit}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 transition-colors shadow-sm"
              >
                <Pencil className="w-4 h-4" />
                Éditer le catalogue
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
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

      {editOpen && (
        <CatalogEditModal
          plans={plans}
          drafts={drafts}
          saving={saving}
          editError={editError}
          editSuccess={editSuccess}
          onUpdate={updateDraft}
          onClose={closeEdit}
          onSave={saveAll}
        />
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

// ─── CATALOG EDIT MODAL ─────────────────────────────────────────────────────

function CatalogEditModal({
  plans,
  drafts,
  saving,
  editError,
  editSuccess,
  onUpdate,
  onClose,
  onSave,
}: {
  plans: Plan[];
  drafts: Record<string, EditablePlan>;
  saving: boolean;
  editError: string | null;
  editSuccess: string | null;
  onUpdate: (id: string, patch: Partial<EditablePlan>) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header (sticky) */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-blue-900">Éditer le catalogue des plans</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Modifiez les tarifs, fonctionnalités et options des plans
              SEED, GROW, LEAD, NETWORK. Les montants vides sont envoyés comme
              « Sur devis » (null).
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Fermer"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="p-6 space-y-5">
          {editError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{editError}</span>
            </div>
          )}
          {editSuccess && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
              <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="leading-snug">{editSuccess}</span>
            </div>
          )}

          {plans.map((plan) => {
            const draft = drafts[plan.id];
            if (!draft) return null;
            return (
              <PlanEditCard
                key={plan.id}
                plan={plan}
                draft={draft}
                onChange={(patch) => onUpdate(plan.id, patch)}
              />
            );
          })}
        </div>

        {/* Footer (sticky) */}
        <div className="sticky bottom-0 z-10 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Enregistrer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanEditCard({
  plan,
  draft,
  onChange,
}: {
  plan: Plan;
  draft: EditablePlan;
  onChange: (patch: Partial<EditablePlan>) => void;
}) {
  const isNetwork = plan.code?.toUpperCase() === 'NETWORK';
  const inputClass =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-colors';
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${planBadgeClass(plan.code)}`}
          >
            {plan.code}
          </span>
          <h3 className="font-bold text-blue-900 truncate">{plan.name}</h3>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.isPopular}
              onChange={(e) => onChange({ isPopular: e.target.checked })}
              className="w-3.5 h-3.5 accent-amber-500"
            />
            Populaire
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => onChange({ isActive: e.target.checked })}
              className="w-3.5 h-3.5 accent-amber-500"
            />
            Actif
          </label>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nom">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Slogan (tagline)">
          <input
            type="text"
            value={draft.tagline}
            onChange={(e) => onChange({ tagline: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="Description" full>
          <textarea
            value={draft.description}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            className={`${inputClass} resize-y`}
          />
        </Field>

        <Field label="Élèves minimum">
          <input
            type="number"
            value={draft.studentMin}
            onChange={(e) => onChange({ studentMin: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={isNetwork ? 'Élèves maximum (vide = illimité)' : 'Élèves maximum'}>
          <input
            type="number"
            value={draft.studentMax}
            onChange={(e) => onChange({ studentMax: e.target.value })}
            placeholder={isNetwork ? 'Illimité' : ''}
            className={inputClass}
          />
        </Field>

        <Field label="Frais d'activation (FCFA)">
          <input
            type="number"
            value={draft.initialFee}
            onChange={(e) => onChange({ initialFee: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="hidden md:block" />

        <Field label={isNetwork ? 'Montant mensuel (FCFA — vide = sur devis)' : 'Montant mensuel (FCFA)'}>
          <input
            type="number"
            value={draft.monthlyAmount}
            onChange={(e) => onChange({ monthlyAmount: e.target.value })}
            placeholder={isNetwork ? 'Sur devis' : ''}
            className={inputClass}
          />
        </Field>
        <Field label={isNetwork ? 'Montant annuel (FCFA — vide = sur devis)' : 'Montant annuel (FCFA)'}>
          <input
            type="number"
            value={draft.yearlyAmount}
            onChange={(e) => onChange({ yearlyAmount: e.target.value })}
            placeholder={isNetwork ? 'Sur devis' : ''}
            className={inputClass}
          />
        </Field>

        <Field label="Bilingue mensuel (FCFA)">
          <input
            type="number"
            value={draft.bilingualMonthly}
            onChange={(e) => onChange({ bilingualMonthly: e.target.value })}
            placeholder="Optionnel"
            className={inputClass}
          />
        </Field>
        <Field label="Bilingue annuel (FCFA)">
          <input
            type="number"
            value={draft.bilingualYearly}
            onChange={(e) => onChange({ bilingualYearly: e.target.value })}
            placeholder="Optionnel"
            className={inputClass}
          />
        </Field>

        <Field label="Fonctionnalités (une par ligne)" full>
          <textarea
            value={draft.featuresText}
            onChange={(e) => onChange({ featuresText: e.target.value })}
            rows={5}
            placeholder={'Jusqu\'à 500 élèves\nSupport email\nModule Élèves & Scolarité'}
            className={`${inputClass} resize-y font-mono`}
          />
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
