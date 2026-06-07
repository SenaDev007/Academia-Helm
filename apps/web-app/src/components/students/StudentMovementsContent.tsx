'use client';

import { useState } from 'react';
import { History, ArrowRightLeft, UserMinus, LogOut, Search, Filter, Calendar, Activity } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { motion } from 'framer-motion';

export default function StudentMovementsContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Sorties définitives', value: '0', icon: <LogOut className="text-rose-600" />, color: 'bg-rose-50' },
          { label: 'Transferts', value: '0', icon: <ArrowRightLeft className="text-blue-600" />, color: 'bg-blue-50' },
          { label: 'Abandons', value: '0', icon: <UserMinus className="text-amber-600" />, color: 'bg-amber-50' },
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i} 
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4"
          >
            <div className={`p-3 rounded-lg ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Placeholder */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <History className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Mouvements & Mobilité</h3>
        <p className="text-slate-500 max-w-sm mt-2">
          Suivez les flux d'entrées et de sorties en cours d'année scolaire. Gérez les certificats de transfert et les radiations.
        </p>
        
        <div className="mt-8 w-full max-w-4xl overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 border border-slate-100 rounded-lg">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Élève</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Motif</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400 italic">
                  Aucun mouvement enregistré pour cette période
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
