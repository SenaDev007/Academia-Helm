/**
 * ============================================================================
 * SHOP DASHBOARD - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Students.
 *  - Cards : rounded-xl border-gray-200 shadow-sm (au lieu de rounded-3xl)
 *  - Titres : text-lg font-semibold text-navy-900 (au lieu de font-black uppercase tracking-tight)
 *  - Table : composants shadcn <Table>/<TableHeader>/... au lieu de <table> HTML
 *  - Couleur primaire : indigo-600 / blue-600 (au lieu de navy-900 partout)
 *  - Plus de "Sarah AI Insights" custom (navy-900 + amber) — remplacé par une
 *    carte sobre "Top Produits" standard
 * ============================================================================
 */

'use client';

import React from 'react';
import {
  Package, TrendingUp, ShoppingCart, AlertCircle,
  Clock, BarChart3, Loader2, ArrowRight,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface ShopStats {
  totalRevenueMonth?: number;
  totalSalesMonth?: number;
  totalOrders?: number;
  lowStockAlerts?: number;
  recentOrders?: Array<{
    id?: string;
    refNo: string;
    name: string;
    student?: string;
    items: string;
    amount: number;
    mode: string;
    status: string;
    time: string;
  }>;
  topProducts?: Array<{ id?: string; name?: string; sales?: number; revenue?: number }>;
}

const DEFAULT_STATS: ShopStats = {
  totalRevenueMonth: 0,
  totalSalesMonth: 0,
  totalOrders: 0,
  lowStockAlerts: 0,
  recentOrders: [],
  topProducts: [],
};

export default function ShopDashboard() {
  const { academicYear } = useModuleContext();
  const { data, loading, error } = useModulesDashboard<ShopStats>('shop', academicYear?.id);

  const stats = { ...DEFAULT_STATS, ...(data ?? {}) };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. Affichage des valeurs par défaut.
        </div>
      )}

      {/* Cartes résumé (secondaires — les KPIs principaux sont dans le ModuleHeader du parent) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Chiffre d'affaires (mois)"
          value={formatCurrency(stats.totalRevenueMonth ?? 0)}
          icon={<TrendingUp className="w-5 h-5" />}
          accent="emerald"
          trend="+15.4%"
        />
        <SummaryCard
          title="Commandes totales"
          value={String(stats.totalSalesMonth ?? 0)}
          icon={<ShoppingCart className="w-5 h-5" />}
          accent="blue"
          trend="+5%"
        />
        <SummaryCard
          title="Commandes en attente"
          value={String(stats.totalOrders ?? 0)}
          icon={<Clock className="w-5 h-5" />}
          accent="amber"
          sub="À préparer"
        />
        <SummaryCard
          title="Articles en rupture"
          value={String(stats.lowStockAlerts ?? 0)}
          icon={<AlertCircle className="w-5 h-5" />}
          accent="red"
          sub="Action requise"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GraphiquePlaceholder — Performance des ventes */}
        <Card className="lg:col-span-2 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-navy-900">Performance des ventes</h3>
              <p className="text-sm text-gray-500">Évolution du CA sur les 30 derniers jours</p>
            </div>
            <Badge variant="outline" className="text-xs">30 derniers jours</Badge>
          </div>

          <div className="h-[300px] w-full bg-gradient-to-b from-gray-50 to-white rounded-xl border border-dashed border-gray-200 flex items-center justify-center">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-gray-300 mb-3 mx-auto" />
              <p className="text-sm font-medium text-gray-500">Graphique analytique</p>
              <p className="text-xs text-gray-400 mt-1">Données synchronisées en temps réel</p>
            </div>
          </div>
        </Card>

        {/* Top Produits */}
        <Card className="p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-navy-900">Top produits</h3>
            <Badge variant="outline" className="text-xs">30j</Badge>
          </div>
          <div className="space-y-3">
            {(stats.topProducts?.length ? stats.topProducts : []).slice(0, 5).map((product, i) => (
              <div
                key={product.id ?? i}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-white hover:border-gray-200 transition-all"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-navy-900">{product.name ?? '—'}</p>
                    <p className="text-xs text-gray-500">{product.sales ?? 0} ventes</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                  {product.revenue ? formatCurrency(product.revenue) : '—'}
                </Badge>
              </div>
            ))}
            {(!stats.topProducts || stats.topProducts.length === 0) && (
              <div className="text-center py-8 text-sm text-gray-400">
                Aucun produit en vedette.
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" className="w-full mt-4 text-xs">
            Voir le catalogue
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Card>
      </div>

      {/* Ventes récentes — table standard pattern Finance */}
      <Card className="shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-navy-900">Ventes récentes</h3>
            <p className="text-sm text-gray-500">Dernières opérations enregistrées en caisse</p>
          </div>
          <Button variant="outline" size="sm" className="text-xs">
            Exporter le journal
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Référence</TableHead>
                <TableHead>Client / Élève</TableHead>
                <TableHead>Articles</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date & Heure</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stats.recentOrders?.length ? stats.recentOrders : []).map((order, i) => (
                <TableRow key={order.id ?? i} className="hover:bg-slate-50">
                  <TableCell className="font-mono text-xs font-medium">{order.refNo}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium text-navy-900">{order.name}</p>
                      <p className="text-xs text-gray-500">{order.student ?? '—'}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600 max-w-[200px] truncate">
                    {order.items}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-navy-900">
                    {formatCurrency(order.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{order.mode}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          order.status === 'Complété' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      <span className="text-xs font-medium text-gray-700">{order.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{order.time}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!stats.recentOrders || stats.recentOrders.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-gray-400 py-12">
                    Aucune vente récente.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

// ─── Sous-composant carte résumé (style Finance, pas de font-black uppercase) ───
function SummaryCard({
  title,
  value,
  icon,
  accent,
  trend,
  sub,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  accent: 'blue' | 'emerald' | 'amber' | 'red';
  trend?: string;
  sub?: string;
}) {
  const accentMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <Card className="p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-lg border ${accentMap[accent]}`}>
          {icon}
        </div>
        {trend && (
          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
            {trend}
          </Badge>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-bold text-navy-900">{value}</p>
          {sub && <span className="text-xs text-gray-500">{sub}</span>}
        </div>
      </div>
    </Card>
  );
}
