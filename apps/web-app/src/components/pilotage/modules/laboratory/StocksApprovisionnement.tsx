/**
 * ============================================================================
 * STOCKS & APPROVISIONNEMENT
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  Package, 
  ShoppingCart, 
  TrendingDown, 
  Truck, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  MoreVertical,
  Plus
} from 'lucide-react';

export default function StocksApprovisionnement() {
  const requests = [
    { id: 'REQ-001', item: 'Lames de microscope', qty: 200, cost: '45,000 FCFA', status: 'APPROVED', date: '14/05/2026' },
    { id: 'REQ-002', item: 'Acide Sulfurique', qty: 5, cost: '32,000 FCFA', status: 'PENDING', date: '15/05/2026' },
    { id: 'REQ-003', item: 'Ordinateurs Portables HP', qty: 2, cost: '850,000 FCFA', status: 'REJECTED', date: '10/05/2026' },
    { id: 'REQ-004', item: 'Kits Électroniques Arduino', qty: 10, cost: '150,000 FCFA', status: 'ORDERED', date: '08/05/2026' },
  ];

  return (
    <div className="space-y-8">
      {/* Stock Health & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 group hover:border-emerald-200 transition-all">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">142</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Articles en Stock</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 group hover:border-rose-200 transition-all">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl group-hover:scale-110 transition-transform">
            <TrendingDown className="w-8 h-8" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">12</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Articles en Alerte</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 group hover:border-blue-200 transition-all">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
            <Truck className="w-8 h-8" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900">4</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Commandes en Cours</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Demandes d'Approvisionnement</h3>
        <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-sm shadow-xl shadow-navy-900/20">
          <ShoppingCart className="w-4 h-4" />
          <span>Créer une Demande</span>
        </button>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-8 py-4">Article & Quantité</th>
              <th className="px-8 py-4">Coût Estimé</th>
              <th className="px-8 py-4">Statut</th>
              <th className="px-8 py-4">Date Demande</th>
              <th className="px-8 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {requests.map((req, i) => (
              <motion.tr
                key={req.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-slate-50 transition-colors group"
              >
                <td className="px-8 py-5">
                  <div>
                    <p className="font-black text-slate-900">{req.item}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">QTÉ: {req.qty} • {req.id}</p>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="text-sm font-black text-slate-900">{req.cost}</span>
                </td>
                <td className="px-8 py-5">
                  <div className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                    req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                    req.status === 'PENDING' ? 'bg-amber-50 text-amber-600' :
                    req.status === 'REJECTED' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {req.status === 'APPROVED' && <CheckCircle2 className="w-3.5 h-3.5 mr-2" />}
                    {req.status === 'PENDING' && <Clock className="w-3.5 h-3.5 mr-2" />}
                    {req.status === 'ORDERED' && <Truck className="w-3.5 h-3.5 mr-2" />}
                    {req.status}
                  </div>
                </td>
                <td className="px-8 py-5 text-sm font-bold text-slate-500">{req.date}</td>
                <td className="px-8 py-5 text-right">
                  <button className="flex items-center ml-auto text-blue-600 font-black text-xs uppercase tracking-widest hover:translate-x-1 transition-transform">
                    Détails
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
