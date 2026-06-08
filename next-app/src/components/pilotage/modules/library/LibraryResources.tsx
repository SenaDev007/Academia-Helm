/**
 * ============================================================================
 * LIBRARY RESOURCES & COPIES
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Book, Hash, ShieldCheck, AlertCircle, MoreHorizontal, Plus, Download, Barcode } from 'lucide-react';

export default function LibraryResources() {
  const copies = [
    { id: 'BC-0012', title: 'Le Petit Prince', copy: 'EX-001', barcode: '892311', status: 'AVAILABLE', condition: 'NEW', location: 'Rayon A1-4' },
    { id: 'BC-0013', title: 'Le Petit Prince', copy: 'EX-002', barcode: '892312', status: 'LOANED', condition: 'GOOD', location: 'Rayon A1-4' },
    { id: 'BC-0024', title: 'L\'Enfant Noir', copy: 'EX-001', barcode: '445210', status: 'RESERVED', condition: 'AVERAGE', location: 'Rayon B2-1' },
    { id: 'BC-0045', title: 'Physique 3ème', copy: 'EX-005', barcode: '112093', status: 'AVAILABLE', condition: 'DAMAGED', location: 'Rayon S-09' },
    { id: 'BC-0056', title: 'Dictionnaire Anglais', copy: 'EX-001', barcode: '778341', status: 'REPAIR', condition: 'UNUSABLE', location: 'Atelier' },
  ];

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-emerald-50 text-emerald-600';
      case 'LOANED': return 'bg-blue-50 text-blue-600';
      case 'RESERVED': return 'bg-blue-50 text-blue-600';
      case 'REPAIR': return 'bg-amber-50 text-amber-600';
      case 'LOST': return 'bg-rose-50 text-rose-600';
      default: return 'bg-slate-50 text-slate-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Gestion des Exemplaires</h3>
        <div className="flex gap-2">
          <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">
            <Download className="w-4 h-4" />
            <span>Exporter Inventaire</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/10">
            <Plus className="w-4 h-4 text-[#C9A84C]" />
            <span>Ajouter Ressources</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-8 py-5">Titre & Exemplaire</th>
              <th className="px-8 py-5">Code-Barres</th>
              <th className="px-8 py-5">Emplacement</th>
              <th className="px-8 py-5">État</th>
              <th className="px-8 py-5">Statut</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {copies.map((copy, i) => (
              <motion.tr
                key={copy.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-slate-50/50 transition-colors group"
              >
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-100 rounded-xl group-hover:bg-blue-50 transition-colors">
                      <Book className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 leading-tight">{copy.title}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{copy.copy}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <div className="flex items-center text-xs font-bold text-slate-600 bg-slate-50 w-fit px-3 py-1.5 rounded-lg border border-slate-100">
                    <Barcode className="w-4 h-4 mr-2 text-slate-400" />
                    {copy.barcode}
                  </div>
                </td>
                <td className="px-8 py-5 text-sm font-bold text-slate-600">{copy.location}</td>
                <td className="px-8 py-5">
                  <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                    copy.condition === 'NEW' ? 'bg-blue-50 text-blue-600' :
                    copy.condition === 'DAMAGED' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'
                  }`}>
                    {copy.condition}
                  </span>
                </td>
                <td className="px-8 py-5">
                  <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${getStatusStyle(copy.status)}`}>
                    {copy.status}
                  </span>
                </td>
                <td className="px-8 py-5 text-right">
                  <button className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <MoreHorizontal className="w-5 h-5 text-slate-300" />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
