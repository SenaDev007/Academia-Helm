/**
 * ============================================================================
 * SHOP DASHBOARD - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React from 'react';
import { 
  DollarSign, ShoppingBag, Package, TrendingUp, 
  AlertTriangle, CheckCircle2, Clock, ArrowRight,
  TrendingDown, ShoppingCart, UserCheck, Zap, BarChart3
} from 'lucide-react';

export default function ShopDashboard() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Chiffre d'Affaires (Mois)" 
          value={formatCurrency(4850000)} 
          icon={DollarSign} 
          color="navy" 
          trend="+15.4%" 
          trendUp={true}
        />
        <KPICard 
          title="Commandes en Attente" 
          value="24" 
          icon={ShoppingCart} 
          color="amber" 
          sub="À préparer"
        />
        <KPICard 
          title="Articles en Rupture" 
          value="7" 
          icon={Package} 
          color="red" 
          sub="Action requise"
        />
        <KPICard 
          title="Panier Moyen" 
          value={formatCurrency(12500)} 
          icon={TrendingUp} 
          color="emerald" 
          trend="+5%" 
          trendUp={true}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Activity Chart Placeholder */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Performance des Ventes</h3>
              <p className="text-sm text-gray-400 font-medium">Évolution du CA sur les 30 derniers jours</p>
            </div>
            <select className="bg-gray-50 border-none text-xs font-bold text-navy-600 rounded-xl px-4 py-2 outline-none">
              <option>30 derniers jours</option>
              <option>Trimestre en cours</option>
              <option>Année scolaire</option>
            </select>
          </div>
          
          <div className="h-[300px] w-full bg-gradient-to-b from-gray-50 to-white rounded-2xl border border-dashed border-gray-200 flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
            <div className="text-center z-10">
              <BarChart3 className="w-12 h-12 text-navy-200 mb-3 mx-auto group-hover:scale-110 transition-transform duration-500" />
              <p className="text-sm font-bold text-navy-300">Graphique analytique ORION</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Données synchronisées en temps réel</p>
            </div>
          </div>
        </div>

        {/* ORION / Sara AI Insights */}
        <div className="space-y-6">
          <div className="bg-navy-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-navy-800 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-navy-800 rounded-xl">
                  <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                </div>
                <h3 className="font-black text-lg uppercase tracking-tight">Sara AI Insights</h3>
              </div>
              <p className="text-navy-100 text-sm leading-relaxed mb-6 font-medium">
                "Le kit scolaire <span className="text-white font-bold">CP1</span> est en forte demande cette semaine (+60%). Prévoyez un stock tampon de 50 unités supplémentaires pour le pic de lundi."
              </p>
              <button className="w-full py-3 bg-white text-navy-900 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-navy-50 transition-all active:scale-95">
                Appliquer la recommandation
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
            <h3 className="font-black text-navy-900 uppercase tracking-tight mb-6">Alertes Stock Critique</h3>
            <div className="space-y-4">
              <StockAlertItem name="Cahier de dessin (A4)" stock={2} threshold={10} />
              <StockAlertItem name="Gourde Academia" stock={0} threshold={5} isRupture={true} />
              <StockAlertItem name="Uniforme Garçon - Taille L" stock={3} threshold={8} />
            </div>
            <button className="w-full mt-6 py-3 border border-gray-100 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all uppercase tracking-widest">
              Gérer les approvisionnements
            </button>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Ventes Récentes</h3>
            <p className="text-sm text-gray-400 font-medium">Dernières opérations enregistrées en caisse</p>
          </div>
          <button className="px-6 py-2.5 bg-gray-50 text-navy-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all">
            Exporter le journal
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Référence</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Client / Élève</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Articles</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Mode</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date & Heure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <TransactionRow 
                refNo="#VTE-2026-0045" 
                name="Saliou Diallo" 
                student="6ème B" 
                items="Uniforme (x1), Badge (x1)" 
                amount={45000} 
                mode="Wallet" 
                status="Complété" 
                time="Il y a 5 min"
              />
              <TransactionRow 
                refNo="#VTE-2026-0044" 
                name="Marie Koné" 
                student="CM2 A" 
                items="Kit Papeterie (x2)" 
                amount={12000} 
                mode="Espèces" 
                status="Complété" 
                time="Il y a 14 min"
              />
              <TransactionRow 
                refNo="#VTE-2026-0043" 
                name="Jean-Marc Koffi" 
                student="Tle D" 
                items="Cahiers TP (x5)" 
                amount={7500} 
                mode="MoMo" 
                status="Vérification" 
                time="Il y a 22 min"
              />
              <TransactionRow 
                refNo="#VTE-2026-0042" 
                name="Awa Touré" 
                student="Maternelle" 
                items="Gourde, Sac à dos" 
                amount={18500} 
                mode="Carte" 
                status="Complété" 
                time="Il y a 35 min"
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Sub-components
function KPICard({ title, value, icon: Icon, color, trend, trendUp, sub }: any) {
  const colorMap: any = {
    navy: 'bg-navy-50 text-navy-600 border-navy-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
      <div className="flex items-center justify-between mb-6">
        <div className={`p-4 rounded-2xl border ${colorMap[color]} group-hover:scale-110 transition-transform duration-500`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter border ${
            trendUp ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
          }`}>
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
        <div className="flex items-baseline space-x-2">
          <h4 className="text-2xl font-black text-navy-900">{value}</h4>
          {sub && <span className="text-[10px] font-bold text-gray-400 uppercase">{sub}</span>}
        </div>
      </div>
    </div>
  );
}

function StockAlertItem({ name, stock, threshold, isRupture }: any) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-white hover:border-navy-100 transition-all group cursor-pointer">
      <div className="flex items-center space-x-4">
        <div className={`p-2 rounded-lg ${isRupture ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
          <Package className="w-4 h-4" />
        </div>
        <div>
          <p className="text-xs font-black text-navy-900 group-hover:text-navy-600 transition-colors">{name}</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase">Seuil: {threshold} unités</p>
        </div>
      </div>
      <div className={`px-3 py-1 rounded-full text-[10px] font-black border ${
        isRupture ? 'bg-red-50 text-red-600 border-red-100' : 'bg-amber-50 text-amber-600 border-amber-100'
      }`}>
        {stock} restants
      </div>
    </div>
  );
}

function TransactionRow({ refNo, name, student, items, amount, mode, status, time }: any) {
  const formatCurrency = (val: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(val);
  
  return (
    <tr className="hover:bg-gray-50/50 transition-colors group">
      <td className="px-8 py-5">
        <span className="text-xs font-black text-navy-900 group-hover:text-navy-600">{refNo}</span>
      </td>
      <td className="px-8 py-5">
        <div>
          <p className="text-xs font-bold text-navy-900">{name}</p>
          <p className="text-[10px] text-gray-400 font-medium">{student}</p>
        </div>
      </td>
      <td className="px-8 py-5">
        <p className="text-xs text-gray-600 font-medium truncate max-w-[200px]">{items}</p>
      </td>
      <td className="px-8 py-5">
        <span className="text-sm font-black text-navy-900">{formatCurrency(amount)}</span>
      </td>
      <td className="px-8 py-5">
        <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-tight">{mode}</span>
      </td>
      <td className="px-8 py-5">
        <div className="flex items-center space-x-2">
          <div className={`w-1.5 h-1.5 rounded-full ${status === 'Complété' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`}></div>
          <span className="text-xs font-bold text-gray-600">{status}</span>
        </div>
      </td>
      <td className="px-8 py-5">
        <div className="flex items-center space-x-2 text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase">{time}</span>
        </div>
      </td>
    </tr>
  );
}
