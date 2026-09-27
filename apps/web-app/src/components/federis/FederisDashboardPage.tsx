/**
 * FederisDashboardPage — Cockpit institutionnel (cahier des charges §7.1 / §8.1)
 *
 * Vue macro orientée décision — AUCUNE saisie :
 *   - Cartes KPI : écoles rattachées, candidats, examens actifs/à venir, alertes
 *   - Bloc ORION : résumé automatique et alertes prioritaires (lecture seule)
 *   - Examens récents + progression des quotas
 *   - Patronats territoriaux (vue consolidée pour le niveau national)
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppIcon from '@/components/ui/AppIcon';
import { apiClient } from '@/lib/api/client';
import { federisLink } from '@/lib/federis/useFederisPath';
import { cn } from '@/lib/utils';

interface OrionAlert {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  count?: number;
}

interface DashboardData {
  patronat: {
    id: string;
    name: string;
    orgLevel: 'NATIONAL' | 'TERRITORIAL' | string;
    territoryName?: string;
    country?: { code: string; name: string } | null;
  };
  academicYear: { id: string; label: string; name: string } | null;
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
    quotaUsage: {
      schools: { used: number; max: number };
      candidates: { used: number; max: number };
    };
  };
  subscription: {
    plan: string;
    planLabel?: string;
    status: string;
    expiresAt?: string | null;
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
    territoryName?: string;
    status: string;
    subscriptionPlan: string;
    subscriptionStatus: string;
    schoolsCount: number;
  }>;
  orion: { readOnly: boolean; alerts: OrionAlert[]; summary: string };
}

const EXAM_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Brouillon', className: 'bg-gray-100 text-gray-700' },
  REGISTRATION_OPEN: { label: 'Inscriptions ouvertes', className: 'bg-blue-100 text-blue-800' },
  REGISTRATION_CLOSED: { label: 'Inscriptions clôturées', className: 'bg-amber-100 text-amber-800' },
  IN_PROGRESS: { label: 'En cours', className: 'bg-green-100 text-green-800' },
  COMPLETED: { label: 'Terminé', className: 'bg-purple-100 text-purple-800' },
  CANCELLED: { label: 'Annulé', className: 'bg-red-100 text-red-700' },
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Actif', className: 'bg-green-100 text-green-800' },
  PENDING_PAYMENT: { label: 'Paiement requis', className: 'bg-amber-100 text-amber-800' },
  EXPIRED: { label: 'Expiré', className: 'bg-red-100 text-red-700' },
  GRACE_PERIOD: { label: 'Période de grâce', className: 'bg-amber-100 text-amber-800' },
  SUSPENDED: { label: 'Suspendu', className: 'bg-red-100 text-red-700' },
};

export default function FederisDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get('/federis/patronat/dashboard', { timeout: 30000 });
        if (!cancelled) setData(res.data);
      } catch (err: any) {
        console.error('[FederisDashboard] Erreur :', err);
        if (!cancelled) {
          setError(
            err?.response?.data?.message ??
              'Impossible de charger le tableau de bord. Vérifiez votre connexion.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white border border-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-white border border-gray-100 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <AppIcon name="warning" size="dashboard" className="text-amber-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Tableau de bord indisponible</h2>
        <p className="text-sm text-gray-500 mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-blue-800 text-white rounded-lg font-semibold text-sm hover:bg-blue-900 transition-colors"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const { patronat, academicYear, kpis, subscription, exams, childrenPatronats, orion } = data;
  const isNational = patronat.orgLevel === 'NATIONAL';
  const subBadge =
    SUBSCRIPTION_STATUS_LABELS[subscription.status] ??
    ({ label: subscription.status, className: 'bg-gray-100 text-gray-700' } as const);

  return (
    <div className="space-y-6">
      {/* En-tête institutionnel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Tableau de bord — {patronat.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-xs font-bold text-white bg-blue-900 px-2.5 py-1 rounded uppercase tracking-wide">
              {isNational ? 'Patronat national' : 'Patronat territorial'}
            </span>
            {patronat.territoryName && !isNational && (
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded">
                {patronat.territoryName}
              </span>
            )}
            {patronat.country?.name && (
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded">
                {patronat.country.name}
              </span>
            )}
            {academicYear && (
              <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded">
                {academicYear.name}
              </span>
            )}
            <span
              className={cn(
                'text-xs font-bold px-2.5 py-1 rounded',
                subBadge.className,
              )}
              title={`Abonnement : ${subscription.plan}`}
            >
              Abonnement {subBadge.label.toLowerCase()}
            </span>
          </div>
        </div>
        {!isNational && patronat.orgLevel !== 'NATIONAL' && null}
        {(subscription.status === 'PENDING_PAYMENT' || subscription.status === 'EXPIRED') && (
          <Link
            href={federisLink('/checkout')}
            className="px-5 py-2.5 bg-amber-500 text-blue-950 rounded-lg font-bold text-sm hover:bg-amber-400 transition-colors inline-flex items-center gap-2 flex-shrink-0"
          >
            Activer l&rsquo;abonnement
            <AppIcon name="arrowRight" size="submenu" />
          </Link>
        )}
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon="building"
          label="Écoles rattachées"
          value={kpis.schoolsAttached}
          hint={
            kpis.schoolsPending > 0
              ? `${kpis.schoolsPending} demande(s) en attente`
              : 'Toutes validées'
          }
          hintTone={kpis.schoolsPending > 0 ? 'amber' : 'gray'}
        />
        <KpiCard
          icon="user"
          label="Candidats inscrits"
          value={kpis.candidates}
          hint={`Quota ${kpis.quotaUsage.candidates.used}/${kpis.quotaUsage.candidates.max}`}
          hintTone={
            kpis.quotaUsage.candidates.used >= kpis.quotaUsage.candidates.max ? 'red' : 'gray'
          }
        />
        <KpiCard
          icon="exams"
          label="Examens actifs"
          value={kpis.activeExams}
          hint={`${kpis.upcomingExams} à venir · ${kpis.inProgressExams} en cours`}
        />
        <KpiCard
          icon="warning"
          label="Alertes critiques"
          value={orion.alerts.filter((a) => a.severity === 'critical').length}
          hint={orion.summary}
          hintTone={orion.alerts.some((a) => a.severity === 'critical') ? 'red' : 'gray'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">
          {/* Examens récents */}
          <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Examens de l&rsquo;année</h2>
              <Link
                href={federisLink('/exams')}
                className="text-sm text-blue-800 font-semibold hover:text-blue-900"
              >
                Tout voir
              </Link>
            </div>
            {exams.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <AppIcon name="calendar" size="dashboard" className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  Aucun examen pour l&rsquo;année scolaire en cours.
                </p>
                <Link
                  href={federisLink('/exams')}
                  className="inline-block mt-4 px-5 py-2.5 bg-blue-800 text-white rounded-lg text-sm font-semibold hover:bg-blue-900 transition-colors"
                >
                  Créer un examen
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-6 py-3 font-semibold">Examen</th>
                      <th className="px-4 py-3 font-semibold">Statut</th>
                      <th className="px-4 py-3 font-semibold text-center">Candidats</th>
                      <th className="px-4 py-3 font-semibold text-center">Centres</th>
                      <th className="px-4 py-3 font-semibold">Début</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((exam) => {
                      const badge =
                        EXAM_STATUS_LABELS[exam.status] ??
                        ({ label: exam.status, className: 'bg-gray-100 text-gray-700' } as const);
                      return (
                        <tr key={exam.id} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-6 py-3.5 font-medium text-gray-900">{exam.name}</td>
                          <td className="px-4 py-3.5">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-xs font-medium',
                                badge.className,
                              )}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center text-gray-700">
                            {exam.totalCandidates}
                          </td>
                          <td className="px-4 py-3.5 text-center text-gray-700">
                            {exam.totalCenters}
                          </td>
                          <td className="px-4 py-3.5 text-gray-600">
                            {new Date(exam.startDate).toLocaleDateString('fr-FR')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Patronats territoriaux — vue consolidée niveau national */}
          {isNational && (
            <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-base font-bold text-gray-900">
                  Patronats territoriaux du réseau
                </h2>
                <Link
                  href={federisLink('/patronats')}
                  className="text-sm text-blue-800 font-semibold hover:text-blue-900"
                >
                  Gérer
                </Link>
              </div>
              {childrenPatronats.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <AppIcon
                    name="network"
                    size="dashboard"
                    className="text-gray-300 mx-auto mb-3"
                  />
                  <p className="text-sm text-gray-500 mb-4">
                    Aucun patronat territorial rattaché. Créez les patronats de votre réseau pour
                    coordonner les écoles par territoire.
                  </p>
                  <Link
                    href={federisLink('/patronats')}
                    className="inline-block px-5 py-2.5 bg-blue-800 text-white rounded-lg text-sm font-semibold hover:bg-blue-900 transition-colors"
                  >
                    Créer un patronat territorial
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-6 py-3 font-semibold">Patronat</th>
                        <th className="px-4 py-3 font-semibold">Territoire</th>
                        <th className="px-4 py-3 font-semibold text-center">Écoles</th>
                        <th className="px-4 py-3 font-semibold">Abonnement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {childrenPatronats.map((child) => {
                        const childBadge =
                          SUBSCRIPTION_STATUS_LABELS[child.subscriptionStatus] ??
                          ({
                            label: child.subscriptionStatus,
                            className: 'bg-gray-100 text-gray-700',
                          } as const);
                        return (
                          <tr key={child.id} className="border-t border-gray-50 hover:bg-gray-50">
                            <td className="px-6 py-3.5 font-medium text-gray-900">{child.name}</td>
                            <td className="px-4 py-3.5 text-gray-600">
                              {child.territoryName ?? '—'}
                            </td>
                            <td className="px-4 py-3.5 text-center text-gray-700">
                              {child.schoolsCount}
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded text-xs font-medium',
                                  childBadge.className,
                                )}
                              >
                                {childBadge.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Colonne ORION */}
        <div className="space-y-6">
          <section className="bg-[#0b1d3a] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AppIcon name="orion" size="menu" className="text-amber-400" />
                <h2 className="text-base font-bold text-white">ORION — Analyse institutionnelle</h2>
              </div>
              <span className="text-[10px] font-bold text-blue-100/50 uppercase tracking-widest">
                Lecture seule
              </span>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-blue-100/70 mb-4">{orion.summary}</p>
              {orion.alerts.length === 0 ? (
                <div className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-3">
                  <AppIcon name="success" size="menu" className="text-green-400" />
                  <span className="text-sm text-blue-100/70">
                    Aucune anomalie détectée sur le périmètre.
                  </span>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {orion.alerts.map((alert, i) => (
                    <div
                      key={i}
                      className={cn(
                        'rounded-lg px-4 py-3 border',
                        alert.severity === 'critical'
                          ? 'bg-red-500/10 border-red-500/30'
                          : alert.severity === 'warning'
                            ? 'bg-amber-500/10 border-amber-500/30'
                            : 'bg-blue-500/10 border-blue-500/30',
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                          {alert.category}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-wide',
                            alert.severity === 'critical'
                              ? 'text-red-400'
                              : alert.severity === 'warning'
                                ? 'text-amber-400'
                                : 'text-blue-300',
                          )}
                        >
                          {alert.severity === 'critical'
                            ? 'Critique'
                            : alert.severity === 'warning'
                              ? 'Vigilance'
                              : 'Info'}
                        </span>
                      </div>
                      <p className="text-sm text-white/90 leading-snug">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}
              <Link
                href={federisLink('/orion')}
                className="mt-5 inline-flex items-center gap-2 text-sm text-amber-400 font-semibold hover:text-amber-300 transition-colors"
              >
                Analyse complète
                <AppIcon name="arrowRight" size="submenu" />
              </Link>
            </div>
          </section>

          {/* Indicateurs secondaires */}
          <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900">Indicateurs opérationnels</h2>
            <MiniStat
              icon="classes"
              label="Centres d'examen"
              value={kpis.centers}
            />
            <MiniStat icon="warning" label="Incidents consignés" value={kpis.incidents} />
            <MiniStat
              icon="building"
              label="Écoles hors Helm (manuelles)"
              value={kpis.manualSchools}
            />
            {isNational && (
              <MiniStat icon="network" label="Patronats territoriaux" value={kpis.childPatronats} />
            )}
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span className="font-medium">Quota écoles</span>
                <span>
                  {kpis.quotaUsage.schools.used}/{kpis.quotaUsage.schools.max}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    kpis.quotaUsage.schools.used >= kpis.quotaUsage.schools.max
                      ? 'bg-red-500'
                      : kpis.quotaUsage.schools.used >= kpis.quotaUsage.schools.max * 0.8
                        ? 'bg-amber-500'
                        : 'bg-blue-800',
                  )}
                  style={{
                    width: `${Math.min(100, (kpis.quotaUsage.schools.used / kpis.quotaUsage.schools.max) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                Alerte automatique à 80 % — aucun dépassement facturé sans votre accord.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  hintTone = 'gray',
}: {
  icon: string;
  label: string;
  value: number;
  hint?: string;
  hintTone?: 'gray' | 'amber' | 'red';
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</span>
        <div className="w-9 h-9 bg-blue-900/10 rounded-lg flex items-center justify-center">
          <AppIcon name={icon as any} size="submenu" className="text-blue-900" />
        </div>
      </div>
      <div className="text-3xl font-black text-gray-900">{value.toLocaleString('fr-FR')}</div>
      {hint && (
        <p
          className={cn(
            'text-xs mt-1.5',
            hintTone === 'red'
              ? 'text-red-600 font-semibold'
              : hintTone === 'amber'
                ? 'text-amber-600 font-medium'
                : 'text-gray-400',
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function MiniStat({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <AppIcon name={icon as any} size="submenu" className="text-gray-400" />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <span className="text-sm font-bold text-gray-900">{value.toLocaleString('fr-FR')}</span>
    </div>
  );
}
