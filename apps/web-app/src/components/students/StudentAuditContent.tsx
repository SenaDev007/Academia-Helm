'use client';

import { useState } from 'react';
import { Fingerprint, Search, Filter, Calendar, User, Clock, ShieldCheck, AlertCircle, History } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { motion } from 'framer-motion';

export default function StudentAuditContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-amber-50 rounded-xl">
          <Fingerprint className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Audit & Traçabilité Complète</h2>
          <p className="text-sm text-slate-500">Historique détaillé des modifications et conformité des dossiers élèves.</p>
        </div>
      </div>

      {/* Audit Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par utilisateur, élève ou action..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all">
            <Calendar className="w-4 h-4 text-slate-400" />
            Période
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all">
            <Filter className="w-4 h-4 text-slate-400" />
            Filtrer
          </button>
        </div>
      </div>

      {/* Audit Log Table Placeholder */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
        <table className="min-w-full divide-y divide-slate-200">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-1/4">Horodatage</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Utilisateur</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Entité</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {[1, 2, 3].map((_, i) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    14/05/2026 10:00:24
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">AD</div>
                    <span className="text-sm font-medium text-slate-700">Admin</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full border border-blue-100 uppercase">UPDATE</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                  Dossier Élève
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 italic">
                  Modification des coordonnées parentales
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} className="px-6 py-8 text-center">
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <History className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">Fin de l'historique récent</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
