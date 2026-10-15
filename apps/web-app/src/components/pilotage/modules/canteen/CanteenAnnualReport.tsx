/**
 * ============================================================================
 * CANTEEN ANNUAL REPORT — Bilan annuel de la cantine
 * ============================================================================
 * ⭐ 2026-10-15 — Modèle métier Cantine scolaire au Bénin
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, BarChart3, Wallet, TrendingUp, TrendingDown, Coins, Lock, CheckCircle2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const API_BASE = '/api/modules-complementaires/canteen/business';

export default function CanteenAnnualReport() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/report?academicYearId=${academicYear.id}`, { credentials: 'include' });
      if (res.ok) setReport(await res.json());
    } catch { /* silent */ } finally { setLoading(false); }
  }, [academicYear?.id]);

  useEffect(() => { load(); }, [load]);

  const handleClose = async () => {
    if (!confirm('Clôturer le bilan annuel ? Cette action est irréversible.')) return;
    setClosing(true);
    try {
      const res = await fetch(`${API_BASE}/report/close?academicYearId=${academicYear.id}`, {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Erreur');
      await load();
      toast({ title: '✅ Bilan annuel clôturé' });
    } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
    finally { setClosing(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  if (!report) return <div className="text-center py-16 text-slate-500">Aucune donnée disponible.</div>;

  const fmt = (v: number) => (v || 0).toLocaleString('fr-FR') + ' F';

  return (
    <div className="space-y-6">
      {/* Statut */}
      <div className={`p-4 rounded-xl border flex items-center gap-3 ${report.isClosed ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
        {report.isClosed ? <Lock className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
        <div>
          <p className="text-sm font-bold">{report.isClosed ? 'Bilan clôturé' : 'Bilan en cours'}</p>
          <p className="text-xs">{report.isClosed ? `Clôturé le ${new Date(report.closedAt).toLocaleDateString('fr-FR')}` : 'Le bilan est calculé en temps réel à partir des ventes et dispatching.'}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 shadow-sm">
          <div className="flex items-center gap-3"><Wallet className="w-8 h-8 p-2 bg-blue-50 text-blue-600 rounded-lg" /><div><p className="text-xs text-slate-500">Capital initial</p><p className="text-2xl font-bold text-slate-900">{fmt(report.initialCapital)}</p></div></div>
        </Card>
        <Card className="p-6 shadow-sm">
          <div className="flex items-center gap-3"><TrendingUp className="w-8 h-8 p-2 bg-green-50 text-green-600 rounded-lg" /><div><p className="text-xs text-slate-500">Recette totale</p><p className="text-2xl font-bold text-green-700">{fmt(report.totalRevenue)}</p></div></div>
        </Card>
        <Card className="p-6 shadow-sm">
          <div className="flex items-center gap-3"><TrendingDown className="w-8 h-8 p-2 bg-red-50 text-red-600 rounded-lg" /><div><p className="text-xs text-slate-500">Total achats</p><p className="text-2xl font-bold text-red-700">{fmt(report.totalPurchases)}</p></div></div>
        </Card>
        <Card className="p-6 shadow-sm">
          <div className="flex items-center gap-3"><Coins className="w-8 h-8 p-2 bg-amber-50 text-amber-600 rounded-lg" /><div><p className="text-xs text-slate-500">Bénéfice total</p><p className="text-2xl font-bold text-amber-700">{fmt(report.totalProfit)}</p></div></div>
        </Card>
      </div>

      {/* Dispatching summary */}
      <Card className="p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-slate-500" />Répartition des recettes</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg"><p className="text-xs text-slate-500">Réapprovisionnement</p><p className="text-lg font-bold text-slate-700">{fmt(report.totalRestock)}</p></div>
          <div className="p-4 bg-blue-50 rounded-lg"><p className="text-xs text-slate-500">Part de l'école</p><p className="text-lg font-bold text-blue-700">{fmt(report.totalSchoolAmount)}</p></div>
          <div className="p-4 bg-purple-50 rounded-lg"><p className="text-xs text-slate-500">Part du vendeur</p><p className="text-lg font-bold text-purple-700">{fmt(report.totalSellerAmount)}</p></div>
          <div className="p-4 bg-amber-50 rounded-lg"><p className="text-xs text-slate-500">Épargne / Bénéfice</p><p className="text-lg font-bold text-amber-700">{fmt(report.totalSavings)}</p></div>
        </div>
      </Card>

      {/* Bilan final */}
      <Card className="p-6 shadow-sm border-2 border-amber-200">
        <h3 className="font-semibold text-slate-900 text-lg mb-4 flex items-center gap-2"><Coins className="w-5 h-5 text-amber-600" />Bilan final</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-emerald-50 rounded-lg text-center"><p className="text-xs text-slate-500">Capital récupéré</p><p className="text-2xl font-bold text-emerald-700">{fmt(report.capitalRecovered)}</p></div>
          <div className="p-4 bg-amber-50 rounded-lg text-center"><p className="text-xs text-slate-500">Bénéfice total</p><p className="text-2xl font-bold text-amber-700">{fmt(report.totalProfit)}</p></div>
          <div className="p-4 bg-purple-50 rounded-lg text-center"><p className="text-xs text-slate-500">Part cantinière ({report.cantiniereRate || 0}%)</p><p className="text-2xl font-bold text-purple-700">{fmt(report.cantiniereAmount)}</p></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="text-slate-600">Repas vendus (total): <strong>{report.mealsSoldTotal || 0}</strong></div>
          <div className="text-slate-600">Repas gaspillés: <strong>{report.mealsWastedTotal || 0}</strong></div>
        </div>
      </Card>

      {/* Clôture */}
      {!report.isClosed && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={handleClose} disabled={closing} className="border-red-300 text-red-600 hover:bg-red-50">
            {closing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
            Clôturer le bilan annuel
          </Button>
        </div>
      )}
    </div>
  );
}
