/**
 * FederisReportsPage — Rapports & Bilans institutionnels (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ VRAIES DONNÉES (2026-09-28) — remplace l'ancienne page de démonstration
 *    (3 rapports codés en dur). Agrégation d'APIs réelles existantes :
 *      - GET /federis/patronat/dashboard   → KPIs + examens (bilan de session,
 *        logistique : centres, candidats, écoles)
 *      - GET /federis/patronat/subscription→ factures (bilan financier)
 *      - GET /federis/patronat/children    → réseau territorial (national)
 *
 * Trois rapports consultables + impression (bilan de session).
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { FedPage, FedStagger, FedStaggerItem, FedCountUp } from '@/components/federis/federis-motion';

interface DashboardData {
  patronat: { name: string; orgLevel: string | null; territoryName?: string | null };
  academicYear: { label: string; name: string } | null;
  kpis: {
    schoolsAttached: number;
    schoolsPending: number;
    manualSchools: number;
    candidates: number;
    activeExams: number;
    upcomingExams: number;
    inProgressExams: number;
    centers: number;
    incidents: number;
    childPatronats: number;
  };
  exams: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
    startDate: string;
    endDate: string;
    totalCandidates: number;
    totalCenters: number;
  }>;
  childrenPatronats: Array<{
    id: string;
    name: string;
    territoryName: string | null;
    status: string;
    subscriptionStatus: string;
    schoolsCount: number;
  }>;
}

interface SubscriptionData {
  planLabel: string;
  amountXOF: number;
  status: string;
  invoices: Array<{
    id: string;
    number: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: string;
  }>;
}

type ReportKind = 'SESSION' | 'FINANCIAL' | 'NETWORK';

const REPORT_TABS: Array<{ kind: ReportKind; label: string; icon: string }> = [
  { kind: 'SESSION', label: 'Bilan de session', icon: 'exams' },
  { kind: 'FINANCIAL', label: 'Bilan financier', icon: 'finance' },
  { kind: 'NETWORK', label: 'Réseau & logistique', icon: 'network' },
];

const EXAM_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Brouillon', className: 'bg-slate-100 text-slate-600' },
  PUBLISHED: { label: 'Publié', className: 'bg-blue-100 text-blue-800' },
  REGISTRATION: { label: 'Inscriptions', className: 'bg-amber-100 text-amber-800' },
  IN_PROGRESS: { label: 'En cours', className: 'bg-indigo-100 text-indigo-800' },
  COMPLETED: { label: 'Terminé', className: 'bg-green-100 text-green-800' },
  ARCHIVED: { label: 'Archivé', className: 'bg-gray-100 text-gray-500' },
};

export default function FederisReportsPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<ReportKind>('SESSION');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, subRes] = await Promise.all([
        apiClient.get('/federis/patronat/dashboard', { timeout: 25000 }),
        apiClient
          .get('/federis/patronat/subscription', { timeout: 20000 })
          .catch(() => null),
      ]);
      setDashboard(dashRes.data ?? null);
      setSubscription(subRes?.data ?? null);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          'Impossible de charger les données des rapports. Veuillez réessayer.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const financialSummary = useMemo(() => {
    if (!subscription?.invoices) return null;
    const paid = subscription.invoices.filter((i) => i.status === 'PAID');
    const unpaid = subscription.invoices.filter((i) => i.status === 'UNPAID');
    const totalPaid = paid.reduce((s, i) => s + i.amount, 0);
    const totalUnpaid = unpaid.reduce((s, i) => s + i.amount, 0);
    return { paidCount: paid.length, unpaidCount: unpaid.length, totalPaid, totalUnpaid };
  }, [subscription]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-72 bg-blue-100 rounded-full" />
        <div className="fed-card h-40" />
        <div className="fed-card h-64" />
      </div>
    );
  }

  const k = dashboard?.kpis;

  return (
    <FedPage className="space-y-8">
      {/* Header Reports */}
      <div className="bg-gradient-to-br from-[#0b1d3a] to-[#071528] p-12 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-blue-400/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="fed-badge fed-badge-amber mb-3">Module analyse</div>
            <h1 className="text-2xl md:text-3xl font-black mb-2 tracking-tight">
              Rapports &amp; Bilans
            </h1>
            <p className="text-blue-100/70 font-medium max-w-xl text-base">
              Bilans consolidés de votre patronat — session{' '}
              {dashboard?.academicYear?.name ?? 'en cours'}, calculés en direct depuis vos données
              réelles : examens, candidats, centres, facturation et réseau.
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="fed-btn-gold fed-btn-shimmer px-8 py-3.5 text-sm flex-shrink-0"
          >
            <AppIcon name="document" size="submenu" />
            Imprimer le bilan
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* Sélecteur de rapport */}
      <div className="flex flex-wrap gap-3">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            onClick={() => setActiveReport(tab.kind)}
            className={cn(
              'px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all',
              activeReport === tab.kind
                ? 'bg-[#0b1d3a] text-white shadow-lg'
                : 'bg-white text-slate-500 border border-blue-100 hover:border-[#1e3a8a]/40 hover:text-[#1e3a8a]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════ BILAN DE SESSION ══════════ */}
      {activeReport === 'SESSION' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Examens actifs', value: k?.activeExams ?? 0 },
              { label: 'Candidats inscrits', value: k?.candidates ?? 0 },
              { label: 'Centres mobilisés', value: k?.centers ?? 0 },
              { label: 'Incidents signalés', value: k?.incidents ?? 0 },
            ].map((kpi) => (
              <div key={kpi.label} className="fed-card p-6">
                <p className="text-3xl font-black text-[#1e3a8a]">
                  <FedCountUp value={kpi.value} />
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                  {kpi.label}
                </p>
              </div>
            ))}
          </div>

          <div className="fed-card overflow-hidden">
            <div className="p-6 border-b border-blue-50">
              <h3 className="text-sm font-black text-[#0b1d3a] uppercase tracking-widest">
                Examens de la session {dashboard?.academicYear?.name ?? ''}
              </h3>
            </div>
            {dashboard?.exams?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#f7f9fc] text-left text-xs text-slate-500 uppercase tracking-wide">
                      <th className="px-6 py-3 font-semibold">Examen</th>
                      <th className="px-4 py-3 font-semibold">Période</th>
                      <th className="px-4 py-3 font-semibold text-center">Candidats</th>
                      <th className="px-4 py-3 font-semibold text-center">Centres</th>
                      <th className="px-4 py-3 font-semibold">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.exams.map((exam) => {
                      const badge =
                        EXAM_STATUS_LABELS[exam.status] ?? {
                          label: exam.status,
                          className: 'bg-gray-100 text-gray-600',
                        };
                      return (
                        <tr key={exam.id} className="border-t border-slate-100 hover:bg-[#f7f9fc]">
                          <td className="px-6 py-3.5">
                            <div className="font-medium text-[#0b1d3a]">{exam.name}</div>
                            <div className="text-xs text-slate-400">{exam.code}</div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600 text-xs">
                            {new Date(exam.startDate).toLocaleDateString('fr-FR')} →{' '}
                            {new Date(exam.endDate).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-4 py-3.5 text-center text-slate-700 font-semibold">
                            {exam.totalCandidates}
                          </td>
                          <td className="px-4 py-3.5 text-center text-slate-700 font-semibold">
                            {exam.totalCenters}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={cn(
                                'px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest',
                                badge.className,
                              )}
                            >
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                Aucun examen enregistré pour cette session — créez vos campagnes d&apos;examen
                depuis le module Examens nationaux.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ BILAN FINANCIER ══════════ */}
      {activeReport === 'FINANCIAL' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="fed-card p-6">
              <p className="text-2xl font-black text-[#1e3a8a]">
                {(financialSummary?.totalPaid ?? 0).toLocaleString('fr-FR')}
              </p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                Encaissé (F CFA)
              </p>
            </div>
            <div className="fed-card p-6">
              <p className="text-2xl font-black text-amber-600">
                {(financialSummary?.totalUnpaid ?? 0).toLocaleString('fr-FR')}
              </p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                En attente (F CFA)
              </p>
            </div>
            <div className="fed-card p-6">
              <p className="text-2xl font-black text-[#1e3a8a]">
                <FedCountUp value={financialSummary?.paidCount ?? 0} />
              </p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                Factures payées
              </p>
            </div>
            <div className="fed-card p-6">
              <p className="text-2xl font-black text-amber-600">
                <FedCountUp value={financialSummary?.unpaidCount ?? 0} />
              </p>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                Factures impayées
              </p>
            </div>
          </div>

          <div className="fed-card overflow-hidden">
            <div className="p-6 border-b border-blue-50">
              <h3 className="text-sm font-black text-[#0b1d3a] uppercase tracking-widest">
                Facturation de l&apos;abonnement ({subscription?.planLabel ?? '—'})
              </h3>
            </div>
            {subscription?.invoices?.length ? (
              <div className="divide-y divide-slate-100">
                {subscription.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-[#f7f9fc]"
                  >
                    <div>
                      <p className="font-medium text-[#0b1d3a] text-sm">Facture {inv.number}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(inv.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-semibold text-slate-700 text-sm">
                        {inv.amount.toLocaleString('fr-FR')} {inv.currency}
                      </p>
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest',
                          inv.status === 'PAID'
                            ? 'bg-green-100 text-green-700'
                            : inv.status === 'UNPAID'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-500',
                        )}
                      >
                        {inv.status === 'PAID' ? 'Payée' : inv.status === 'UNPAID' ? 'Impayée' : inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-sm text-slate-500">
                Aucune facture enregistrée — l&apos;historique apparaîtra après activation de
                l&apos;abonnement.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ RÉSEAU & LOGISTIQUE ══════════ */}
      {activeReport === 'NETWORK' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Écoles rattachées', value: k?.schoolsAttached ?? 0 },
              { label: 'Rattachements en attente', value: k?.schoolsPending ?? 0 },
              { label: 'Écoles hors Helm', value: k?.manualSchools ?? 0 },
              { label: 'Patronats territoriaux', value: k?.childPatronats ?? 0 },
            ].map((kpi) => (
              <div key={kpi.label} className="fed-card p-6">
                <p className="text-3xl font-black text-[#1e3a8a]">
                  <FedCountUp value={kpi.value} />
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                  {kpi.label}
                </p>
              </div>
            ))}
          </div>

          {dashboard?.childrenPatronats?.length ? (
            <FedStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dashboard.childrenPatronats.map((child) => (
                <FedStaggerItem key={child.id}>
                  <div className="fed-card fed-card-shimmer p-8 h-full">
                    <h3 className="text-lg font-black text-[#0b1d3a] mb-1">{child.name}</h3>
                    <p className="text-[#1e3a8a] text-xs font-bold uppercase tracking-widest mb-4">
                      {child.territoryName ?? 'Territoire non précisé'}
                    </p>
                    <div className="pt-4 border-t border-blue-50 flex items-center justify-between">
                      <p className="text-xs text-slate-500 font-semibold">
                        {child.schoolsCount} école(s)
                      </p>
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest',
                          child.subscriptionStatus === 'ACTIVE'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-800',
                        )}
                      >
                        {child.subscriptionStatus === 'ACTIVE' ? 'Actif' : 'Paiement requis'}
                      </span>
                    </div>
                  </div>
                </FedStaggerItem>
              ))}
            </FedStagger>
          ) : (
            <div className="fed-card px-6 py-12 text-center text-sm text-slate-500">
              Aucun patronat territorial rattaché — le bilan du réseau s&apos;alimentera dès la
              création de vos premiers patronats territoriaux.
            </div>
          )}
        </div>
      )}
    </FedPage>
  );
}
