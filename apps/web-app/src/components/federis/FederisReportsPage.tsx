/**
 * FederisReportsPage — Rapports & Bilans institutionnels (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ VRAIES DONNÉES (2026-09-28) — remplace l'ancienne page de démonstration
 *    (3 rapports codés en dur) — bilan de session alimenté par le tableau de
 *    bord (GET /federis/patronat/dashboard).
 *
 * ⭐ T46 (2026-10-01) — Onglets « Procès-verbal » et « Statistiques » : la
 *    reproduction de A à Z du module Examen d'Academia Helm (PV d'évaluation /
 *    statistiques des notes et moyennes) adaptée aux examens nationaux —
 *    chaque type d'examen (CEP, BEPC, Baccalauréat, CAP) y trouve son PV et
 *    ses statistiques, avec génération PDF officielle A4 paysage.
 *
 * Cinq onglets : Procès-verbal · Statistiques · Bilan de session · Bilan
 * financier · Réseau & logistique (les trois derniers = rapports consolidés).
 * ⭐ T51 (2026-10-01) — retour promoteur : les onglets « Bilan financier » et
 *    « Réseau & logistique » sont SUPPRIMÉS (la facturation de l'abonnement
 *    n'a rien à voir avec les rapports d'examens). Le module = 3 onglets :
 *    Procès-verbal · Statistiques · Bilan de session.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { FedPage, FedCountUp } from '@/components/federis/federis-motion';
// ⭐ T55 — libellés de statut partagés + humanisation (plus d'ID brut).
import { getExamStatusLabel, getExamStatusStyles } from '@/hooks/useFederisExams';
// ⭐ T46 — Procès-verbal & Statistiques par examen (reproduction Helm)
import FederisProcVerbalTab from './reports/FederisProcVerbalTab';
import FederisStatsTab from './reports/FederisStatsTab';

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
}

type ReportKind = 'PV' | 'STATS' | 'SESSION';

const REPORT_TABS: Array<{ kind: ReportKind; label: string; icon: string }> = [
  // ⭐ T46 — PV et statistiques par examen (CEP/BEPC/BAC/CAP), reproduction
  //    du module Examen d'Academia Helm — en tête du module.
  { kind: 'PV', label: 'Procès-verbal', icon: 'document' },
  { kind: 'STATS', label: 'Statistiques', icon: 'analysis' },
  { kind: 'SESSION', label: 'Bilan de session', icon: 'exams' },
];

// ⭐ T51/T55 — statuts : le dictionnaire LOCAL a été remplacé par les helpers
//    partagés de useFederisExams (couverture complète + insensible à la casse
//    + humanisation — plus JAMAIS d'identifiant brut comme RESULTS_PUBLISHED).

export default function FederisReportsPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<ReportKind>('PV');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashRes = await apiClient.get('/federis/patronat/dashboard', { timeout: 25000 });
      setDashboard(dashRes.data ?? null);
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

  // ⭐ T46 — Les onglets PV / Statistiques ont leur PROPRE chargement (registre
  //    par examen) : ils s'affichent immédiatement, sans attendre le dashboard
  //    consolidé (qui ne concerne que le bilan de session).
  const isConsolidated = activeReport === 'SESSION';

  if (loading && isConsolidated) {
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
      {/* Header — style Helm : titre + description + action, sans panneau sombre */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="fed-badge mb-2">Module analyse</div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Rapports et statistiques
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl leading-relaxed">
            Procès-verbaux, statistiques et bilan de la session, examen par examen — CEP, BEPC,
            Baccalauréat, CAP.
          </p>
        </div>

        {isConsolidated && (
          <button
            type="button"
            onClick={() => window.print()}
            className="fed-btn-gold px-4 py-2.5 text-sm flex-shrink-0"
          >
            <AppIcon name="document" size="submenu" />
            Imprimer le bilan
          </button>
        )}
      </div>

      {error && isConsolidated && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
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
              'px-4 py-2 rounded-lg text-xs font-semibold transition-colors',
              activeReport === tab.kind
                ? 'bg-blue-900 text-white shadow-lg'
                : 'bg-white text-slate-500 border border-blue-100 hover:border-blue-800/40 hover:text-blue-800',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════ PROCÈS-VERBAL (T46 — reproduction Helm, par examen) ══════════ */}
      {activeReport === 'PV' && <FederisProcVerbalTab />}

      {/* ══════════ STATISTIQUES (T46 — reproduction Helm, par examen) ══════════ */}
      {activeReport === 'STATS' && <FederisStatsTab />}

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
                <p className="text-3xl font-bold text-blue-800">
                  <FedCountUp value={kpi.value} />
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">
                  {kpi.label}
                </p>
              </div>
            ))}
          </div>

          <div className="fed-card overflow-hidden">
            <div className="p-6 border-b border-blue-50">
              <h3 className="text-sm font-bold text-blue-900 uppercase">
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
                      const badge = {
                        label: getExamStatusLabel(exam.status),
                        className: getExamStatusStyles(exam.status),
                      };
                      return (
                        <tr key={exam.id} className="border-t border-slate-100 hover:bg-[#f7f9fc]">
                          <td className="px-6 py-3.5">
                            <div className="font-medium text-blue-900">{exam.name}</div>
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
                                'px-2.5 py-1 rounded-full text-[9px] font-bold uppercase',
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
    </FedPage>
  );
}
