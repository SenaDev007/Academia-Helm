/**
 * ============================================================================
 * SHOP REPORTS & ANALYSIS - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Students.
 *  - Boutons : <Button> shadcn
 *  - Table : <Table> shadcn
 *  - Notifications : useToast() (au lieu de alert())
 *  - Cards : rounded-xl (au lieu de rounded-[2.5rem])
 *  - Typo : font-semibold (au lieu de font-black uppercase tracking-widest)
 * ============================================================================
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, BarChart3, PieChart, TrendingUp, Activity, Zap, Download, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';

interface ShopStats {
  grossMargin?: number;
  marginTotal?: number;
  stockValue?: number;
  stockTotalValue?: number;
  averageBasket?: number;
  basketAverage?: number;
  topProducts?: Array<{
    name?: string;
    productName?: string;
    qty?: number;
    quantity?: number;
    revenue?: number;
    stock?: number;
    remainingStock?: number;
    status?: string;
  }>;
  salesByCategory?: Array<{ label?: string; value?: number }>;
  monthlyEvolution?: Array<{ label?: string; value?: number }>;
}

const DEFAULT_STATS: ShopStats = {
  grossMargin: 0,
  stockValue: 0,
  averageBasket: 0,
  topProducts: [],
};

export default function ShopReports() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [stats, setStats] = useState<ShopStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const data = await modulesApi.get<ShopStats>(
          'shop/stats',
          buildModulesApiOptions(academicYear.id),
        );
        if (!cancelled) {
          setStats(data?.data ?? data);
        }
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
        <span className="ml-2 text-gray-600">Chargement des rapports...</span>
      </div>
    );
  }

  const safeStats: ShopStats = { ...DEFAULT_STATS, ...(stats ?? {}) };
  const topProducts = safeStats.topProducts ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. {error}
        </div>
      )}

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          label="Marge Brute"
          value={formatCurrency(safeStats.grossMargin ?? safeStats.marginTotal ?? 0)}
          trend="—"
          trendUp={true}
          icon={TrendingUp}
        />
        <SummaryCard
          label="Valeur Stock Immobilisée"
          value={formatCurrency(safeStats.stockValue ?? safeStats.stockTotalValue ?? 0)}
          trend="—"
          trendUp={false}
          icon={Activity}
        />
        <SummaryCard
          label="Panier Moyen"
          value={formatCurrency(safeStats.averageBasket ?? safeStats.basketAverage ?? 0)}
          trend="—"
          trendUp={true}
          icon={Zap}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales by Category Chart Placeholder */}
        <Card className="p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-semibold text-navy-900">Ventes par Catégorie</h3>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Download className="w-4 h-4" />
            </Button>
          </div>
          <div className="h-[300px] w-full bg-slate-50 rounded-xl border border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden">
            <PieChart className="w-12 h-12 text-slate-300" />
            <p className="absolute bottom-6 text-xs text-slate-400">Graphique Analytique</p>
          </div>
        </Card>

        {/* Sales Evolution Chart Placeholder */}
        <Card className="p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-semibold text-navy-900">Évolution Mensuelle</h3>
            <select className="text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 outline-none">
              <option>Année {new Date().getFullYear()}</option>
            </select>
          </div>
          <div className="h-[300px] w-full bg-slate-50 rounded-xl border border-dashed border-slate-200 flex items-center justify-center relative overflow-hidden">
            <BarChart3 className="w-12 h-12 text-slate-300" />
            <p className="absolute bottom-6 text-xs text-slate-400">Graphique de Tendance</p>
          </div>
        </Card>
      </div>

      {/* Top Products Table */}
      <Card className="shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-base font-semibold text-navy-900">Articles les plus vendus</h3>
          <Button
            size="sm"
            onClick={() => toast({ title: 'Bientôt disponible', description: 'L\'export complet du rapport sera disponible prochainement.' })}
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Générer Rapport Complet
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">Quantité Vendue</TableHead>
                <TableHead className="text-right">CA Total</TableHead>
                <TableHead className="text-right">Stock Restant</TableHead>
                <TableHead>Performance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-gray-400 py-12">
                    Aucune donnée disponible pour cette année scolaire.
                  </TableCell>
                </TableRow>
              ) : (
                topProducts.map((p: any, i: number) => {
                  const name = p?.name ?? p?.productName ?? `Produit #${i + 1}`;
                  const qty = p?.qty ?? p?.quantity ?? 0;
                  const revenue = p?.revenue ?? 0;
                  const stock = p?.stock ?? p?.remainingStock ?? 0;
                  const status = qty >= 800 ? 'TOP' : stock <= 0 ? 'RUPTURE' : 'NORMAL';
                  return (
                    <ReportRow
                      key={`rep-${i}`}
                      name={name}
                      qty={qty}
                      revenue={revenue}
                      stock={stock}
                      status={status}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, trend, trendUp, icon: Icon }: any) {
  return (
    <Card className="p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-indigo-50 rounded-lg text-indigo-600">
          <Icon className="w-5 h-5" />
        </div>
        <Badge variant="outline" className={`text-xs ${trendUp ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
          {trend}
        </Badge>
      </div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <h4 className="text-2xl font-semibold text-navy-900">{value}</h4>
    </Card>
  );
}

function ReportRow({ name, qty, revenue, stock, status }: any) {
  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell className="text-sm font-medium text-navy-900">{name}</TableCell>
      <TableCell className="text-right text-sm text-gray-600">{qty} unités</TableCell>
      <TableCell className="text-right text-sm font-semibold text-navy-900">{formatCurrency(revenue)}</TableCell>
      <TableCell className="text-right text-sm text-gray-600">{stock} unités</TableCell>
      <TableCell>
        <Badge variant="outline" className={`text-xs ${
          status === 'TOP' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : status === 'RUPTURE' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-gray-50 text-gray-500 border-gray-100'
        }`}>
          {status}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
