/**
 * ============================================================================
 * PHARMACY & STOCKS TAB
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  Pill, 
  Plus, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Search, 
  AlertTriangle,
  Package,
  Calendar,
  MoreHorizontal
} from 'lucide-react';

export default function PharmacyStock() {
  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Total Articles</p>
            <p className="text-3xl font-black text-slate-900">124</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-2xl text-blue-600">
            <Package className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Stock Faible</p>
            <p className="text-3xl font-black text-amber-600">8</p>
          </div>
          <div className="p-4 bg-amber-50 rounded-2xl text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Péremption &lt; 30j</p>
            <p className="text-3xl font-black text-rose-600">3</p>
          </div>
          <div className="p-4 bg-rose-50 rounded-2xl text-rose-600">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Inventory Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher un médicament..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Approvisionner
          </button>
          <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center hover:bg-slate-800 transition-colors shadow-sm">
            <ArrowDownCircle className="w-4 h-4 mr-2" />
            Sortie Stock
          </button>
        </div>
      </div>

      {/* Inventory List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <h3 className="font-black text-slate-900 flex items-center">
            <Pill className="w-5 h-5 mr-2 text-blue-600" />
            Inventaire Actif
          </h3>
          <div className="flex space-x-2">
            {['Tous', 'Médicaments', 'Consommables', 'Urgences'].map((cat, i) => (
              <button key={i} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${
                i === 0 ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
              }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-y divide-slate-100 border-b border-slate-100">
          {[
            { name: 'Paracétamol 500mg', type: 'Médicament', qty: 450, unit: 'comp.', status: 'OK', color: 'bg-emerald-500', expiry: 'Jan 2026' },
            { name: 'Alcool Chirurgical 70%', type: 'Consommable', qty: 2, unit: 'litres', status: 'LOW', color: 'bg-amber-500', expiry: 'Oct 2024' },
            { name: 'Compresses Stériles', type: 'Consommable', qty: 85, unit: 'unités', status: 'OK', color: 'bg-emerald-500', expiry: 'Mars 2027' },
            { name: 'Bétadine Jaune', type: 'Antiseptique', qty: 5, unit: 'flacons', status: 'OK', color: 'bg-emerald-500', expiry: 'Dec 2025' },
            { name: 'Masques Chirurgicaux', type: 'Protection', qty: 12, unit: 'boîtes', status: 'OK', color: 'bg-emerald-500', expiry: 'Aout 2026' },
            { name: 'Ventoline Spray', type: 'Urgence', qty: 1, unit: 'unité', status: 'CRITICAL', color: 'bg-rose-500', expiry: 'Juin 2024' },
            { name: 'Gants Examen (M)', type: 'Consommable', qty: 3, unit: 'boîtes', status: 'OK', color: 'bg-emerald-500', expiry: 'Sep 2028' },
            { name: 'Thermomètre Infra', type: 'Matériel', qty: 4, unit: 'unités', status: 'OK', color: 'bg-emerald-500', expiry: 'N/A' },
          ].map((item, i) => (
            <motion.div 
              key={i} 
              whileHover={{ backgroundColor: '#F8FAFC' }}
              className="p-6 transition-colors group relative"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
                <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded-md transition-all">
                  <MoreHorizontal className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">{item.type}</p>
              <h4 className="font-black text-slate-900 mb-4">{item.name}</h4>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-2xl font-black text-slate-900">{item.qty}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.unit}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Expire</p>
                  <p className="text-xs font-black text-slate-600">{item.expiry}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
