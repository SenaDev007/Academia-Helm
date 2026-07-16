/**
 * ============================================================================
 * LABORATORY REPORTS & STATS
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Infirmerie.
 * - 2 alert() → 2 toast() (génération rapport + erreur)
 * - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-medium
 * - <button> custom → <Button> shadcn
 * - Bandeau navy-900 (boutons) → <Button> shadcn
 * - framer-motion conservé pour les animations subtiles
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Loader2, FileText, Download, TrendingUp, PieChart, Filter, CheckCircle2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

interface LabsStats {
  usageBySubject?: Array<{ label?: string; val?: number; value?: number; hours?: number }>;
  equipmentStatus?: {
    total?: number;
    operational?: number;
    maintenance?: number;
    outOfService?: number;
  };
  reports?: Array<{ title?: string; name?: string; date?: string; type?: string; status?: string }>;
}

const DEFAULT_STATS: LabsStats = {
  usageBySubject: [],
  equipmentStatus: { total: 0, operational: 0, maintenance: 0, outOfService: 0 },
  reports: [],
};

export default function LabReportsStats() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [stats, setStats] = useState<LabsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleGenerateReport = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('labs/reports', {}, buildModulesApiOptions(academicYear?.id));
      toast({
        title: 'Rapport généré',
        description: 'Le rapport a été généré avec succès.',
      });
    } catch (e: any) {
      toast({
        title: 'Erreur de génération',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la génération du rapport',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!academicYear?.id) {
      setStats(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await modulesApi.get<LabsStats>(
          'labs/stats',
          buildModulesApiOptions(academicYear.id),
        );
        if (!cancelled) setStats(data?.data ?? data);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.response?.data?.message ?? e?.message ?? 'Erreur de chargement');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYear?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des statistiques...</span>
      </div>
    );
  }

  const safeStats: LabsStats = { ...DEFAULT_STATS, ...(stats ?? {}) };
  const usageBySubject = (safeStats.usageBySubject ?? []).map((item: any, i: number) => ({
    label: item?.label ?? 'Matière',
    val: item?.val ?? item?.value ?? item?.hours ?? 0,
    color: ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-blue-500', 'bg-slate-700'][i % 5],
  }));

  const eq = safeStats.equipmentStatus ?? { total: 0, operational: 0, maintenance: 0, outOfService: 0 };
  const reports = safeStats.reports ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. Affichage des valeurs par défaut. {error}
        </div>
      )}

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
              Utilisation par Matière
            </h3>
            <Button variant="outline" size="icon">
              <Filter className="w-5 h-5" />
            </Button>
          </div>
          <div className="space-y-5">
            {usageBySubject.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">Aucune donnée d&apos;utilisation disponible.</p>
            ) : (
              usageBySubject.map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="text-slate-900">{item.val}h / mois</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color}`}
                      style={{ width: `${Math.min(item.val, 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <PieChart className="w-5 h-5 mr-2 text-emerald-600" />
              État Global du Parc
            </h3>
          </div>
          <div className="flex-1 flex items-center justify-center relative">
            <div className="w-44 h-44 rounded-full border-[14px] border-emerald-500 border-l-amber-500 border-b-rose-500 relative flex items-center justify-center">
              <div className="text-center">
                <p className="text-3xl font-semibold text-slate-900">{eq.total}</p>
                <p className="text-xs text-slate-400">Total</p>
              </div>
            </div>
            <div className="absolute right-0 space-y-3">
              {[
                { label: 'Opérationnel', color: 'bg-emerald-500', value: eq.operational },
                { label: 'Maintenance', color: 'bg-amber-500', value: eq.maintenance },
                { label: 'Hors Service', color: 'bg-rose-500', value: eq.outOfService },
              ].map((dot, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${dot.color}`} />
                  <span className="text-xs text-slate-600">{dot.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">Documents & Exports</h3>
          <Button onClick={handleGenerateReport} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
            {submitting ? 'Génération...' : 'Nouveau Rapport'}
          </Button>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Aucun rapport disponible pour cette année scolaire.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((rep: any, i: number) => (
              <Card key={i} className="p-6 shadow-sm hover:shadow-md transition-all flex items-start justify-between">
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 text-slate-400 rounded-xl w-fit">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">{rep?.title ?? rep?.name ?? `Rapport #${i + 1}`}</h4>
                    <div className="flex items-center text-xs text-slate-400 gap-3">
                      <span className="flex items-center">
                        <FileText className="w-3 h-3 mr-1" /> {rep?.date ?? '—'}
                      </span>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {rep?.status ?? '—'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="hover:bg-slate-50 text-slate-400 hover:text-blue-600">
                  <Download className="w-5 h-5" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
