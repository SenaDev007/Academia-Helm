import React from 'react';
import { 
  Package, Search, Filter, Plus, 
  ArrowDownCircle, ArrowUpCircle, History,
  AlertTriangle, CheckCircle2, MoreHorizontal,
  BarChart3, RefreshCcw
} from 'lucide-react';

export default function CanteenStocks() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Stock KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StockCard 
          title="Valeur Totale Stock" 
          value="1,250,000 F" 
          desc="Toutes catégories" 
          icon={BarChart3} 
          color="navy" 
        />
        <StockCard 
          title="Articles Critiques" 
          value="03" 
          desc="Seuil d'alerte atteint" 
          icon={AlertTriangle} 
          color="red" 
        />
        <StockCard 
          title="Mouvements (24h)" 
          value="12" 
          desc="Entrées & Sorties" 
          icon={RefreshCcw} 
          color="blue" 
        />
        <StockCard 
          title="Produits Frais" 
          value="28" 
          desc="À consommer d'ici 48h" 
          icon={CheckCircle2} 
          color="emerald" 
        />
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-gray-50/50 to-white">
          <div>
            <h3 className="font-black text-navy-900 text-xl tracking-tight">Inventaire & Stocks</h3>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Gestion des denrées et consommables</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Rechercher un produit..." 
                className="pl-11 pr-4 py-2.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-navy-500/20 w-64 transition-all"
              />
            </div>
            <button className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100">
              <ArrowDownCircle className="w-4 h-4" />
              <span>Entrée</span>
            </button>
            <button className="flex items-center space-x-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100">
              <ArrowUpCircle className="w-4 h-4" />
              <span>Sortie</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Produit & Catégorie</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Quantité Actuelle</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Unité</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Seuil Alerte</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Dernière Entrée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <StockRow 
                name="Riz Parfumé (Mélange)"
                category="Céréales"
                qty="150"
                unit="KG"
                threshold="50"
                status="OK"
                lastEntry="12 Mai 2026"
              />
              <StockRow 
                name="Huile Végétale (Cœur de Lion)"
                category="Liquides"
                qty="12"
                unit="L"
                threshold="20"
                status="Faible"
                lastEntry="08 Mai 2026"
              />
              <StockRow 
                name="Poulet Entier (Fermier)"
                category="Protéines"
                qty="5"
                unit="Unité"
                threshold="15"
                status="Critique"
                lastEntry="14 Mai 2026"
              />
              <StockRow 
                name="Tomates Fraiches"
                category="Légumes"
                qty="45"
                unit="KG"
                threshold="10"
                status="OK"
                lastEntry="15 Mai 2026"
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StockCard({ title, value, desc, icon: Icon, color }: any) {
  const colors: any = {
    navy: 'text-navy-600 bg-navy-50',
    red: 'text-red-600 bg-red-50',
    blue: 'text-blue-600 bg-blue-50',
    emerald: 'text-emerald-600 bg-emerald-50',
  };
  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <button className="p-2 text-gray-300 hover:text-navy-600 transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-navy-900 mt-1">{value}</p>
      <p className="text-[10px] text-gray-400 font-medium mt-1 uppercase tracking-tighter">{desc}</p>
    </div>
  );
}

function StockRow({ name, category, qty, unit, threshold, status, lastEntry }: any) {
  const statusStyles: any = {
    'OK': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Faible': 'bg-amber-50 text-amber-600 border-amber-100',
    'Critique': 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <tr className="group hover:bg-navy-50/30 transition-all duration-300">
      <td className="px-8 py-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gray-50 rounded-xl group-hover:bg-white transition-colors border border-gray-100">
            <Package className="w-4 h-4 text-navy-400" />
          </div>
          <div>
            <p className="text-sm font-black text-navy-900 tracking-tight">{name}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{category}</p>
          </div>
        </div>
      </td>
      <td className="px-8 py-6">
        <p className="text-lg font-black text-navy-900 tracking-tighter">{qty}</p>
      </td>
      <td className="px-8 py-6">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{unit}</p>
      </td>
      <td className="px-8 py-6 text-center">
        <p className="text-xs font-bold text-navy-400 italic">{threshold} {unit}</p>
      </td>
      <td className="px-8 py-6">
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border w-fit flex items-center space-x-1.5 ${statusStyles[status]}`}>
          {status === 'OK' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
          <span>{status}</span>
        </div>
      </td>
      <td className="px-8 py-6 text-right">
        <div className="flex flex-col items-end">
          <p className="text-xs font-bold text-navy-900">{lastEntry}</p>
          <button className="text-[9px] font-black text-navy-500 uppercase tracking-widest hover:underline mt-1 flex items-center space-x-1">
            <History className="w-3 h-3" />
            <span>Historique</span>
          </button>
        </div>
      </td>
    </tr>
  );
}
