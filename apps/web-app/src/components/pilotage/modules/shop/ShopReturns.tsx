/**
 * ============================================================================
 * SHOP RETURNS & EXCHANGES - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React from 'react';
import { 
  RotateCcw, RefreshCcw, Search, Filter, Plus, 
  AlertCircle, CheckCircle2, MoreVertical, Eye,
  Package, DollarSign, User, Calendar, Trash2
} from 'lucide-react';

export default function ShopReturns() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Retours & Échanges</h3>
          <p className="text-sm text-gray-400 font-medium">Gérez les remboursements, avoirs et échanges d'articles</p>
        </div>
        <button className="flex items-center space-x-2 px-8 py-3 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/20 active:scale-95">
          <RotateCcw className="w-4 h-4" />
          <span>Initier un Retour</span>
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <ReturnStat label="Demandes en attente" count={5} color="amber" />
        <ReturnStat label="Articles retournés" count={24} color="blue" />
        <ReturnStat label="Montant remboursé" count={formatCurrency(125000)} color="rose" />
        <ReturnStat label="Taux de retour" count="1.2%" color="emerald" />
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex items-center justify-between">
           <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="N° Ticket ou Nom Client..." 
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-xs outline-none focus:ring-2 focus:ring-navy-500/20 transition-all font-medium"
              />
           </div>
           <div className="flex items-center space-x-3">
              <button className="flex items-center space-x-2 px-5 py-3 bg-gray-50 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all">
                 <Filter className="w-4 h-4" />
                 <span>Filtrer</span>
              </button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">N° Ticket</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Article</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Client</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Motif</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
               <ReturnRow 
                  id="RET-0442" 
                  product="Veste Uniforme (Taille L)" 
                  client="Jean-Marc Koffi" 
                  reason="Taille incorrecte" 
                  type="ÉCHANGE" 
                  status="Traité" 
                  date="Aujourd'hui"
               />
               <ReturnRow 
                  id="RET-0441" 
                  product="Kit Papeterie CP1" 
                  client="Awa Touré" 
                  reason="Article défectueux" 
                  type="REMBOURSEMENT" 
                  status="En attente" 
                  date="Hier"
               />
               <ReturnRow 
                  id="RET-0440" 
                  product="Cahier Academia (x5)" 
                  client="Moussa Diop" 
                  reason="Doublon achat" 
                  type="AVOIR" 
                  status="Approuvé" 
                  date="15 Mai"
               />
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex items-start space-x-4">
         <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
            <AlertCircle className="w-6 h-6" />
         </div>
         <div>
            <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight mb-1">Politique de Retour</h4>
            <p className="text-xs text-amber-700 leading-relaxed font-medium">
               Les articles peuvent être retournés dans un délai de 7 jours après achat s'ils sont dans leur emballage d'origine. Les uniformes portés ou lavés ne sont ni repris ni échangés.
            </p>
         </div>
      </div>
    </div>
  );
}

function ReturnStat({ label, count, color }: any) {
  const colors: any = {
    amber: 'text-amber-600',
    blue: 'text-blue-600',
    rose: 'text-rose-600',
    emerald: 'text-emerald-600',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{label}</p>
       <h4 className={`text-2xl font-black ${colors[color]}`}>{count}</h4>
    </div>
  );
}

function ReturnRow({ id, product, client, reason, type, status, date }: any) {
  const statusStyles: any = {
    'Traité': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'En attente': 'bg-amber-50 text-amber-600 border-amber-100',
    'Approuvé': 'bg-blue-50 text-blue-600 border-blue-100',
  };

  const typeStyles: any = {
    'ÉCHANGE': 'bg-navy-50 text-navy-600 border-navy-100',
    'REMBOURSEMENT': 'bg-rose-50 text-rose-600 border-rose-100',
    'AVOIR': 'bg-gray-50 text-gray-600 border-gray-100',
  };

  return (
    <tr className="hover:bg-gray-50 transition-all group">
       <td className="px-8 py-6 text-xs font-black text-navy-900 group-hover:text-navy-600">{id}</td>
       <td className="px-8 py-6">
          <div className="flex items-center space-x-3">
             <Package className="w-4 h-4 text-gray-300" />
             <span className="text-xs font-bold text-gray-600">{product}</span>
          </div>
       </td>
       <td className="px-8 py-6 text-xs font-bold text-gray-600">{client}</td>
       <td className="px-8 py-6 text-[10px] text-gray-400 font-bold uppercase tracking-tight">{reason}</td>
       <td className="px-8 py-6">
          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight border ${typeStyles[type]}`}>
             {type}
          </span>
       </td>
       <td className="px-8 py-6">
          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight border ${statusStyles[status]}`}>
             {status}
          </span>
       </td>
       <td className="px-8 py-6 text-[10px] font-bold text-gray-400 uppercase tracking-tight">{date}</td>
    </tr>
  );
}
