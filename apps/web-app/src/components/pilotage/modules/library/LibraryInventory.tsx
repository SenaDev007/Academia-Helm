/**
 * ============================================================================
 * LIBRARY INVENTORY
 * ============================================================================
 *
 * TODO: endpoint non disponible — garder mock. Le backend expose seulement
 * POST library/inventory/campaigns et POST library/inventory/scan (pas de GET).
 * La récupération de la liste des campagnes n'est pas encore implémentée côté backend.
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { ClipboardCheck, Barcode, ShieldCheck, AlertCircle, Plus, ChevronRight, PackageSearch } from 'lucide-react';

export default function LibraryInventory() {
  const campaigns = [
    { id: 'INV-2026-01', title: 'Inventaire Annuel - Section Collège', period: 'Mai 2026', progress: 65, status: 'IN_PROGRESS', found: 420, total: 650 },
    { id: 'INV-2025-02', title: 'Contrôle Trimestriel - Littérature', period: 'Janv 2026', progress: 100, status: 'VALIDATED', found: 145, total: 148 },
    { id: 'INV-2025-01', title: 'Inventaire Rentrée Scolaire', period: 'Sept 2025', progress: 100, status: 'COMPLETED', found: 1240, total: 1248 },
  ];

  return (
    <div className="space-y-8">
      {/* Header & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <PackageSearch className="w-6 h-6 mr-3 text-blue-600" />
            Campagnes d'Inventaire
          </h3>
          <p className="text-slate-500 text-sm font-medium">Contrôlez l'intégrité de votre patrimoine documentaire.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center space-x-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">
            <Barcode className="w-4 h-4 text-slate-400" />
            <span>Mode Scan</span>
          </button>
          <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/10">
            <Plus className="w-4 h-4 text-[#C9A84C]" />
            <span>Nouvelle Campagne</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {campaigns.map((camp, i) => (
          <motion.div
            key={camp.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-xl transition-all group"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <h4 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">{camp.title}</h4>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    camp.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-600' :
                    camp.status === 'VALIDATED' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {camp.status}
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <ClipboardCheck className="w-3.5 h-3.5 mr-2" />
                    Période: {camp.period}
                  </div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                    <Barcode className="w-3.5 h-3.5 mr-2" />
                    ID: {camp.id}
                  </div>
                </div>
              </div>

              <div className="flex-1 max-w-sm">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-2">
                  <span className="text-slate-500">Progression</span>
                  <span className="text-slate-900">{camp.progress}% ({camp.found}/{camp.total})</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${camp.progress}%` }}
                    className={`h-full rounded-full ${camp.progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="flex items-center px-6 py-3 bg-slate-50 hover:bg-navy-900 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                  Rapport
                  <ChevronRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
