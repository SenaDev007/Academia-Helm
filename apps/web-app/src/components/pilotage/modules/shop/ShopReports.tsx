/**
 * ============================================================================
 * SHOP REPORTS & ANALYSIS - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React from 'react';
import { 
  BarChart3, PieChart, TrendingUp, TrendingDown,
  Calendar, Download, Filter, FileText, ArrowRight,
  Zap, Info, Activity
} from 'lucide-react';

export default function ShopReports() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard 
          label="Marge Brute" 
          value={formatCurrency(12450000)} 
          trend="+8.5%" 
          trendUp={true} 
          icon={TrendingUp} 
        />
        <SummaryCard 
          label="Valeur Stock Immobilisée" 
          value={formatCurrency(38200000)} 
          trend="-2.1%" 
          trendUp={false} 
          icon={Activity} 
        />
        <SummaryCard 
          label="Panier Moyen" 
          value={formatCurrency(14500)} 
          trend="+540 F" 
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
                     <option>Année 2026</option>
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
            <button className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-navy-900/20">
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
                  <ReportRow name="Cahier Academia 200p" qty={1250} revenue={1500000} stock={450} status="TOP" />
                  <ReportRow name="Uniforme Polo (M)" qty={850} revenue={12750000} stock={12} status="TOP" />
                  <ReportRow name="Gourde Isotherme" qty={420} revenue={2310000} stock={0} status="RUPTURE" />
                  <ReportRow name="Kit Papeterie CP1" qty={380} revenue={7030000} stock={85} status="NORMAL" />
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
  const formatCurrency = (val: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(val);
  
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
