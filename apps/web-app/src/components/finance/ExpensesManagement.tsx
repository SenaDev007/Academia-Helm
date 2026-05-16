/**
 * ExpensesManagement Component
 * 
 * Gestion des dépenses, engagements et bons de commande.
 */

'use client';

import { useState } from 'react';
import { 
  TrendingDown, 
  Plus, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Filter,
  Search
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

export default function ExpensesManagement() {
  const [expenses, setExpenses] = useState([
    { id: 'EXP-001', category: 'FOURNITURES', description: 'Papeterie examen', amount: 450000, status: 'PAID', date: '2026-05-10' },
    { id: 'EXP-002', category: 'MAINTENANCE', description: 'Réparation climatiseurs', amount: 125000, status: 'PENDING', date: '2026-05-12' },
    { id: 'EXP-003', category: 'ENERGIE', description: 'Facture CIE Mai', amount: 890000, status: 'APPROVED', date: '2026-05-14' },
  ]);

  return (
    <div className="space-y-6">
      {/* Header / Search */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              placeholder="Rechercher une dépense..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          <button className="p-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all">
            <Filter className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all">
          <Plus className="w-4 h-4" /> Nouvel Engagement
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: List */}
        <div className="lg:col-span-2 space-y-4">
          {expenses.map((exp) => (
            <div key={exp.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-rose-50 rounded-xl group-hover:scale-110 transition-transform">
                  <TrendingDown className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">{exp.description}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full uppercase tracking-widest">{exp.category}</span>
                    <span className="text-xs text-slate-400 font-medium">{exp.date}</span>
                  </div>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className="text-lg font-black text-slate-900">{formatCurrency(exp.amount)}</p>
                <div className="flex items-center justify-end gap-1">
                  {exp.status === 'PAID' ? (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Payé
                    </span>
                  ) : exp.status === 'APPROVED' ? (
                    <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Approuvé
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> En attente
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Summary / Categories */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
             <h3 className="font-bold mb-4 flex items-center gap-2">
               <TrendingDown className="w-4 h-4 text-rose-400" />
               Répartition Budgétaire
             </h3>
             <div className="space-y-4">
                {[
                  { label: 'Personnel', value: 65, color: 'bg-blue-500' },
                  { label: 'Logistique', value: 20, color: 'bg-emerald-500' },
                  { label: 'Maintenance', value: 15, color: 'bg-amber-500' },
                ].map((cat, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">{cat.label}</span>
                      <span className="font-bold">{cat.value}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all duration-1000", cat.color)} style={{ width: `${cat.value}%` }} />
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
