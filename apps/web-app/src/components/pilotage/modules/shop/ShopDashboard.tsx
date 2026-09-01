/**
 * ============================================================================
 * SHOP DASHBOARD - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte sept 2026 :
 *  - Bouton "Voir le catalogue" : navigue vers shop:catalog via onNavigate
 *  - Bouton "Exporter le journal" : génère un PDF des ventes récentes avec
 *    le pattern Finance (fetch → blob → DocumentPreviewModal), pas window.open
 *  - Top Produits : affiche `sales` (nb ventes) au lieu de `quantity`
 *  - Performance des ventes : graphique Recharts AreaChart alimenté par
 *    `dailyRevenue` (30 derniers jours)
 *  - Ventes récentes : alimenté par `recentOrders` (10 dernières ventes)
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import {
  Package, TrendingUp, ShoppingCart, AlertCircle,
  Clock, Loader2, ArrowRight, Download,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesDashboard } from '@/lib/modules-complementaires/hooks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import DocumentPreviewModal from '@/components/students/DocumentPreviewModal';

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
  dailyRevenue?: Array<{ date: string; revenue: number }>;
}

const DEFAULT_STATS: ShopStats = {
  totalRevenueMonth: 0,
  totalSalesMonth: 0,
  totalOrders: 0,
  lowStockAlerts: 0,
  recentOrders: [],
  topProducts: [],
  dailyRevenue: [],
};

const PAYMENT_MODE_LABELS: Record<string, string> = {
  CASH: 'Espèces', FEDAPAY: 'FedaPay', WALLET: 'Portefeuille', CARD: 'Carte',
  cash: 'Espèces', fedapay: 'FedaPay', wallet: 'Portefeuille', card: 'Carte',
};

export default function ShopDashboard({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data, loading, error } = useModulesDashboard<ShopStats>('shop', academicYear?.id);
  const [exporting, setExporting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ filePath: string; fileName: string; mimeType: string } | null>(null);

  const stats = { ...DEFAULT_STATS, ...(data ?? {}) };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement...</span>
      </div>
    );
  }

  // ⭐ Tooltip custom pour le graphique
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
          <p className="font-medium text-gray-700 mb-1">{label}</p>
          <p className="text-blue-600 font-semibold">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  // ⭐ Exporter le journal — pattern Finance : fetch → blob → DocumentPreviewModal
  const handleExportJournal = async () => {
    if (!academicYear?.id) {
      toast({ title: 'Année scolaire requise', variant: 'destructive' });
      return;
    }
    setExporting(true);
    try {
      const res = await fetch(
        `/api/modules-complementaires/shop/payments/history/pdf?academicYearId=${academicYear.id}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewDoc({
        filePath: url,
        fileName: `Journal_Ventes_${new Date().toISOString().substring(0, 10)}.pdf`,
        mimeType: 'application/pdf',
      });
    } catch (e: any) {
      toast({ title: 'Erreur export PDF', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. Affichage des valeurs par défaut.
        </div>
      )}

      {/* Cartes résumé */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Chiffre d'affaires (mois)" value={formatCurrency(stats.totalRevenueMonth ?? 0)} icon={<TrendingUp className="w-5 h-5" />} accent="emerald" trend={stats.totalRevenueMonth && stats.totalRevenueMonth > 0 ? '+30j' : undefined} />
        <SummaryCard title="Ventes totales (30j)" value={String(stats.totalSalesMonth ?? 0)} icon={<ShoppingCart className="w-5 h-5" />} accent="blue" sub="transactions" />
        <SummaryCard title="Commandes en attente" value={String(stats.totalOrders ?? 0)} icon={<Clock className="w-5 h-5" />} accent="amber" sub="À préparer" />
        <SummaryCard title="Articles en rupture" value={String(stats.lowStockAlerts ?? 0)} icon={<AlertCircle className="w-5 h-5" />} accent="red" sub="Action requise" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance des ventes — graphique Recharts */}
        <Card className="lg:col-span-2 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-navy-900">Performance des ventes</h3>
              <p className="text-sm text-gray-500">Évolution du CA sur les 30 derniers jours</p>
            </div>
            <Badge variant="outline" className="text-xs">30 derniers jours</Badge>
          </div>
          {(stats.dailyRevenue && stats.dailyRevenue.length > 0) ? (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.dailyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} interval={Math.floor((stats.dailyRevenue.length || 30) / 6)} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#colorRevenue)" name="Revenu" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] w-full bg-gradient-to-b from-gray-50 to-white rounded-xl border border-dashed border-gray-200 flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-500">Aucune donnée de vente</p>
                <p className="text-xs text-gray-400 mt-1">Les ventes apparaîtront ici une fois encaissées</p>
              </div>
            </div>
          )}
        </Card>

        {/* Top Produits */}
        <Card className="p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-navy-900">Top produits</h3>
            <Badge variant="outline" className="text-xs">30j</Badge>
          </div>
          <div className="space-y-3">
            {(stats.topProducts?.length ? stats.topProducts : []).slice(0, 5).map((product, i) => (
              <div key={product.id ?? i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-white hover:border-gray-200 transition-all">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-600"><Package className="w-4 h-4" /></div>
                  <div>
                    <p className="text-sm font-medium text-navy-900">{product.name ?? '—'}</p>
                    <p className="text-xs text-gray-500">{product.sales ?? 0} vente{(product.sales ?? 0) > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">{product.revenue ? formatCurrency(product.revenue) : '—'}</Badge>
              </div>
            ))}
            {(!stats.topProducts || stats.topProducts.length === 0) && (
              <div className="text-center py-8 text-sm text-gray-400">Aucun produit vendu pour le moment.</div>
            )}
          </div>
          {/* ⭐ Bouton "Voir le catalogue" — navigue vers shop:catalog */}
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4 text-xs"
            onClick={() => onNavigate?.('shop:catalog')}
          >
            Voir le catalogue
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Card>
      </div>

      {/* Ventes récentes */}
      <Card className="shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-navy-900">Ventes récentes</h3>
            <p className="text-sm text-gray-500">Dernières opérations enregistrées en caisse</p>
          </div>
          {/* ⭐ Bouton "Exporter le journal" — pattern Finance : fetch → blob → DocumentPreviewModal */}
          <Button variant="outline" size="sm" className="text-xs" onClick={handleExportJournal} disabled={exporting}>
            {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
            {exporting ? 'Génération...' : 'Exporter le journal'}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="whitespace-nowrap">Référence</TableHead>
                <TableHead className="whitespace-nowrap">Client / Élève</TableHead>
                <TableHead>Articles</TableHead>
                <TableHead className="text-right whitespace-nowrap">Montant</TableHead>
                <TableHead className="whitespace-nowrap">Mode</TableHead>
                <TableHead className="whitespace-nowrap">Statut</TableHead>
                <TableHead className="whitespace-nowrap">Date & Heure</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stats.recentOrders?.length ? stats.recentOrders : []).map((order, i) => (
                <TableRow key={order.id ?? i} className="hover:bg-slate-50">
                  <TableCell className="font-mono text-xs font-medium whitespace-nowrap">{order.refNo}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <span className="text-sm font-medium text-navy-900">{order.name}</span>
                    {order.student && <span className="text-xs text-gray-500 ml-1">({order.student})</span>}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600 max-w-[200px] truncate">{order.items}</TableCell>
                  <TableCell className="text-right font-semibold text-navy-900 whitespace-nowrap">{formatCurrency(order.amount)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs whitespace-nowrap">{PAYMENT_MODE_LABELS[order.mode] ?? order.mode ?? '—'}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${order.status === 'Complété' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <span className="text-xs font-medium text-gray-700 whitespace-nowrap">{order.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs whitespace-nowrap">{order.time}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!stats.recentOrders || stats.recentOrders.length === 0) && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-gray-400 py-12">Aucune vente récente.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ⭐ DocumentPreviewModal — pattern Finance : affiche le PDF dans un modal */}
      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => { URL.revokeObjectURL(previewDoc.filePath); setPreviewDoc(null); }} />
      )}
    </div>
  );
}

function SummaryCard({ title, value, icon, accent, trend, sub }: { title: string; value: string; icon: React.ReactNode; accent: 'blue' | 'emerald' | 'amber' | 'red'; trend?: string; sub?: string; }) {
  const accentMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
  };
  return (
    <Card className="p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-lg border ${accentMap[accent]}`}>{icon}</div>
        {trend && <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">{trend}</Badge>}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1 whitespace-nowrap">{title}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-xl font-bold text-navy-900">{value}</p>
          {sub && <span className="text-xs text-gray-500">{sub}</span>}
        </div>
      </div>
    </Card>
  );
}
