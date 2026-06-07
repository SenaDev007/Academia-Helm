'use client';

import { useState } from 'react';
import { Share2, Plus, Search, Filter, Layers, Layout, Grid, UserCheck, Settings } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { motion } from 'framer-motion';

export default function StudentAssignmentsContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      {/* Header Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Classes Ouvertes', value: '0', icon: <Layout className="text-blue-600" />, color: 'bg-blue-50' },
          { label: 'Élèves Affectés', value: '0', icon: <UserCheck className="text-emerald-600" />, color: 'bg-emerald-50' },
          { label: 'Non Affectés', value: '0', icon: <Layers className="text-amber-600" />, color: 'bg-amber-50' },
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

      {/* Main Table Content Placeholder */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col items-center justify-center p-12 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <Share2 className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Affectations & Répartitions</h3>
        <p className="text-slate-500 max-w-sm mt-2">
          Gérez l'affectation des élèves dans les classes, les séries (secondaire) et les groupes de TD ou de langue.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-2xl">
          <button className="flex flex-col items-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all group">
            <Grid className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mb-3" />
            <span className="font-semibold text-slate-900">Affectation en Masse</span>
            <span className="text-xs text-slate-500 mt-1">Répartir une liste d'élèves par classe</span>
          </button>
          <button className="flex flex-col items-center p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all group">
            <Settings className="w-8 h-8 text-slate-400 group-hover:text-blue-500 mb-3" />
            <span className="font-semibold text-slate-900">Config. Séries</span>
            <span className="text-xs text-slate-500 mt-1">Gérer les options et spécialités</span>
          </button>
        </div>
      </div>
    </div>
  );
}
