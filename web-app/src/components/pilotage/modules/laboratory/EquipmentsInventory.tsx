/**
 * ============================================================================
 * EQUIPMENTS INVENTORY
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { 
  Microscope, 
  Search, 
  Filter, 
  MoreVertical, 
  AlertCircle, 
  CheckCircle2, 
  Wrench,
  Download,
  Plus
} from 'lucide-react';

export default function EquipmentsInventory() {
  const equipments = [
    { id: 'EQ-001', name: 'Microscope Binoculaire X400', category: 'Optique', lab: 'Lab SVT', status: 'GOOD', lastMaintenance: '12/01/2026' },
    { id: 'EQ-002', name: 'Balance de Précision 0.01g', category: 'Mesure', lab: 'Lab Chimie', status: 'AVERAGE', lastMaintenance: '05/02/2026' },
    { id: 'EQ-003', name: 'Oscilloscope Numérique', category: 'Physique', lab: 'Lab Physique', status: 'OUT_OF_ORDER', lastMaintenance: '20/12/2025' },
    { id: 'EQ-004', name: 'Kit Robotique Lego Spike', category: 'Robotique', lab: 'Lab Informatique', status: 'NEW', lastMaintenance: 'N/A' },
    { id: 'EQ-005', name: 'Centrifugeuse Médicale', category: 'Biologie', lab: 'Lab SVT', status: 'GOOD', lastMaintenance: '15/02/2026' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW': return <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest">Neuf</span>;
      case 'GOOD': return <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest">Bon État</span>;
      case 'AVERAGE': return <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest">Moyen</span>;
      case 'OUT_OF_ORDER': return <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest">HS</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher un équipement (nom, code, catégorie)..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
          />
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all">
            <Filter className="w-5 h-5" />
          </button>
          <button className="p-2.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all">
            <Download className="w-5 h-5" />
          </button>
          <button className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-2xl font-black text-sm hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/10">
            <Plus className="w-4 h-4" />
            <span>Ajouter</span>
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Équipement</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Catégorie</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Laboratoire</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">État</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dernière Maintenance</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {equipments.map((eq, i) => (
              <motion.tr 
                key={eq.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
              >
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-white group-hover:scale-110 transition-all">
                      <Microscope className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{eq.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{eq.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="text-sm font-bold text-slate-600">{eq.category}</span>
                </td>
                <td className="px-8 py-5">
                  <span className="text-sm font-bold text-slate-600">{eq.lab}</span>
                </td>
                <td className="px-8 py-5">
                  {getStatusBadge(eq.status)}
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center text-xs font-bold text-slate-500">
                    <Wrench className="w-3.5 h-3.5 mr-2 text-slate-300" />
                    {eq.lastMaintenance}
                  </div>
                </td>
                <td className="px-8 py-5 text-right">
                  <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <MoreVertical className="w-5 h-5 text-slate-300" />
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
