/**
 * ============================================================================
 * MEDICAL RECORDS TAB
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter, 
  User, 
  Heart, 
  ShieldAlert, 
  ChevronRight,
  MoreVertical,
  Plus,
  Download
} from 'lucide-react';

export default function MedicalRecords() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Rechercher un élève par nom, matricule..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
          />
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4" />
            <span>Filtres</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-navy-900 text-white rounded-xl text-sm font-medium hover:bg-navy-800 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            <span>Nouveau Dossier</span>
          </button>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-100">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Élève</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Groupe Sanguin</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Vigilance</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Dernière Visite</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {[
              { name: 'Jean Dupont', id: 'MAT-2024-001', class: '6ème A', blood: 'A+', alerts: ['Allergie Arachide'], lastVisit: '12/05/2024', status: 'CRITICAL' },
              { name: 'Marie Kassa', id: 'MAT-2024-045', class: 'CM2 B', blood: 'O+', alerts: [], lastVisit: '10/04/2024', status: 'STABLE' },
              { name: 'Koffi Mensah', id: 'MAT-2023-112', class: 'Terminal D', blood: 'B-', alerts: ['Asthme'], lastVisit: '02/05/2024', status: 'MODERATE' },
              { name: 'Sarah Lawson', id: 'MAT-2024-089', class: '3ème B', blood: 'AB+', alerts: [], lastVisit: '20/05/2024', status: 'STABLE' },
              { name: 'Marc Yao', id: 'MAT-2024-121', class: 'CE1', blood: 'A-', alerts: ['Allergie Latex'], lastVisit: 'Jamais', status: 'STABLE' },
            ].map((record, i) => (
              <motion.tr 
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                      {record.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{record.name}</p>
                      <p className="text-xs text-slate-500">{record.class} • {record.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700">
                    <Heart className="w-3 h-3 mr-1 fill-rose-500" />
                    {record.blood}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {record.alerts.length > 0 ? record.alerts.map((alert, j) => (
                      <span key={j} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                        <ShieldAlert className="w-2.5 h-2.5 mr-1" />
                        {alert}
                      </span>
                    )) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                  {record.lastVisit}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors" title="Télécharger le dossier">
                      <Download className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <p className="text-sm text-slate-500">
          Affichage de <span className="font-bold text-slate-900">5</span> sur <span className="font-bold text-slate-900">128</span> dossiers
        </p>
        <div className="flex space-x-2">
          <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-400 bg-slate-50 cursor-not-allowed">Précédent</button>
          <button className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Suivant</button>
        </div>
      </div>
    </div>
  );
}
