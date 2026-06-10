/**
 * ============================================================================
 * CONSUMABLES STOCK
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  Droplets, 
  Search, 
  Plus, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  AlertTriangle,
  Calendar,
  Package,
  MoreHorizontal
} from 'lucide-react';

export default function ConsumablesStock() {
  const consumables = [
    { name: 'Acide Chlorhydrique 1M', cat: 'Réactifs', qty: 2.5, unit: 'L', status: 'IN_STOCK', expiry: 'Jan 2027' },
    { name: 'Papiers Filtre (100pcs)', cat: 'Consommable', qty: 2, unit: 'boîtes', status: 'LOW_STOCK', expiry: 'N/A' },
    { name: 'Gants en Latex (M)', cat: 'Sécurité', qty: 15, unit: 'boîtes', status: 'IN_STOCK', expiry: 'Sep 2028' },
    { name: 'Eau Distillée', cat: 'Réactifs', qty: 0.5, unit: 'L', status: 'CRITICAL', expiry: 'N/A' },
    { name: 'Lames de Microscope', cat: 'Consommable', qty: 500, unit: 'unités', status: 'IN_STOCK', expiry: 'N/A' },
    { name: 'Bétadine 10%', cat: 'Urgence', qty: 1, unit: 'flacon', status: 'IN_STOCK', expiry: 'Mai 2026' },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Actions & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher un produit..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/10">
            <ArrowDownCircle className="w-4 h-4" />
            <span>Réapprovisionner</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
            <ArrowUpCircle className="w-4 h-4" />
            <span>Sortie Stock</span>
          </button>
        </div>
      </div>

      {/* Grid of Consumables */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {consumables.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all group relative overflow-hidden"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-3 rounded-2xl ${
                item.status === 'CRITICAL' ? 'bg-rose-50 text-rose-600' : 
                item.status === 'LOW_STOCK' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'
              }`}>
                <Droplets className="w-6 h-6" />
              </div>
              <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                <MoreHorizontal className="w-5 h-5 text-slate-300" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.cat}</p>
                <h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{item.name}</h4>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-black text-slate-900">{item.qty}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.unit}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center text-[10px] font-bold text-slate-400 mb-1">
                    <Calendar className="w-3 h-3 mr-1" />
                    EXP: {item.expiry}
                  </div>
                  {item.status === 'CRITICAL' && (
                    <div className="flex items-center text-[10px] font-black text-rose-600 animate-pulse">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      RUPTURE PROCHE
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: item.status === 'IN_STOCK' ? '80%' : item.status === 'LOW_STOCK' ? '30%' : '10%' }}
                  className={`h-full ${
                    item.status === 'IN_STOCK' ? 'bg-emerald-500' : 
                    item.status === 'LOW_STOCK' ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
