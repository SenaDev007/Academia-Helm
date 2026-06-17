/**
 * ============================================================================
 * SHOP REPORTS & ANALYSIS - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, BarChart3, PieChart, TrendingUp, Activity, Zap, Calendar, Download, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

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
    <div className="space-y-8 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les statistiques. {error}
        </div>
      )}

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Sales by Category Chart Placeholder */}
         <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Ventes par Catégorie</h3>
               <button className="p-2 bg-gray-50 rounded-xl text-gray-400 hover:text-navy-900 transition-all">
                  <Download className="w-4 h-4" />
               </button>
            </div>
            <div className="h-[300px] w-full bg-gray-50 rounded-3xl border border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
               <PieChart className="w-12 h-12 text-gray-200 group-hover:scale-110 transition-transform" />
               <p className="absolute bottom-6 text-[10px] font-black text-gray-300 uppercase tracking-widest">Graphique Analytique ORION</p>
            </div>
         </div>

         {/* Sales Evolution Chart Placeholder */}
         <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Évolution Mensuelle</h3>
               <div className="flex items-center space-x-2">
                  <select className="text-[10px] font-black uppercase tracking-tight bg-gray-50 border-none rounded-xl px-3 py-2 outline-none">
                     <option>Année {new Date().getFullYear()}</option>
                  </select>
               </div>
            </div>
            <div className="h-[300px] w-full bg-gray-50 rounded-3xl border border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
               <BarChart3 className="w-12 h-12 text-gray-200 group-hover:scale-110 transition-transform" />
               <p className="absolute bottom-6 text-[10px] font-black text-gray-300 uppercase tracking-widest">Graphique de Tendance</p>
            </div>
         </div>
      </div>

      {/* Top Products Table */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
         <div className="p-8 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Articles les plus vendus</h3>
            <button
              onClick={() => alert('Bientôt disponible')}
              className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-navy-900/20"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Générer Rapport Complet</span>
            </button>
         </div>
         <div className="p-0">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-left">
               <thead className="bg-gray-50/50">
                  <tr>
                     <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Produit</th>
                     <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Quantité Vendue</th>
                     <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">CA Total</th>
                     <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Stock Restant</th>
                     <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Performance</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-16 text-center text-gray-500">
                        Aucune donnée disponible pour cette année scolaire.
                      </td>
                    </tr>
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
               </tbody>
            </table>
            </div>
         </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, trend, trendUp, icon: Icon }: any) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
       <div className="flex items-center justify-between mb-8">
          <div className="p-4 bg-navy-50 rounded-2xl text-navy-600 group-hover:scale-110 transition-transform">
             <Icon className="w-6 h-6" />
          </div>
          <div className={`px-3 py-1.5 rounded-full text-[10px] font-black border ${trendUp ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
             {trend}
          </div>
       </div>
       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
       <h4 className="text-3xl font-black text-navy-900">{value}</h4>
    </div>
  );
}

function ReportRow({ name, qty, revenue, stock, status }: any) {
  return (
    <tr className="hover:bg-gray-50 transition-all">
       <td className="px-8 py-5 text-xs font-black text-navy-900">{name}</td>
       <td className="px-8 py-5 text-sm font-bold text-gray-600">{qty} unités</td>
       <td className="px-8 py-5 text-sm font-black text-navy-900">{formatCurrency(revenue)}</td>
       <td className="px-8 py-5 text-sm font-bold text-gray-600">{stock} unités</td>
       <td className="px-8 py-5">
          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight border ${
            status === 'TOP' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : status === 'RUPTURE' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-gray-50 text-gray-400 border-gray-100'
          }`}>
             {status}
          </span>
       </td>
    </tr>
  );
}
