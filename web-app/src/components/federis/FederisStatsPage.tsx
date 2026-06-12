/**
 * FederisStatsPage Component
 * 
 * Statistiques Nationales & Analytics Transverses
 * Module 17 de l'infrastructure Academia Federis
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

export default function FederisStatsPage() {
  return (
    <div className="space-y-8">
      {/* Header Premium Stats */}
      <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16" />
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
             <div className="w-10 h-10 bg-blue-900 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                <AppIcon name="finance" size="dashboard" className="text-white" />
             </div>
             <h1 className="text-3xl font-black text-gray-900 italic tracking-tighter">Statistiques Nationales</h1>
          </div>
          <p className="text-gray-500 font-medium max-w-xl">
            Analyse transverse des performances académiques, des effectifs et des tendances de réussite sur l'ensemble du réseau Federis.
          </p>
        </div>

        <div className="flex items-center space-x-4 shrink-0">
          <button className="px-6 py-3 bg-blue-900 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all flex items-center gap-3">
            <AppIcon name="document" size="submenu" />
            Exporter Analytics
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="md:col-span-2 bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
            <AppIcon name="finance" size="large" className="text-gray-100 mb-6 w-32 h-32" />
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest text-center">Graphiques Dynamiques en cours de génération...</p>
            <div className="flex space-x-2 mt-4">
               {[1, 2, 3].map(i => (
                 <div key={i} className="w-1.5 h-6 bg-blue-900/10 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
               ))}
            </div>
         </div>

         <div className="space-y-6">
            <div className="bg-blue-900 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
               <div className="relative z-10">
                  <div className="flex items-center space-x-3 mb-6">
                     <AppIcon name="sparkles" size="dashboard" className="text-blue-300" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-blue-200">ORION Stats</span>
                  </div>
                  <h4 className="text-lg font-black mb-4">Tendance 2024</h4>
                  <p className="text-xs text-blue-100/70 leading-relaxed font-medium">
                     "Une augmentation de **12.5%** des inscriptions en filières techniques a été observée. ORION prévoit un besoin accru de jurys spécialisés."
                  </p>
               </div>
            </div>

            <div className="bg-gray-50 border border-gray-100 p-8 rounded-[2.5rem]">
               <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest mb-4">Top Performances</h4>
               <div className="space-y-4">
                  {[
                    { n: 'Lycée de l\'Excellence', p: '98.2%' },
                    { n: 'Collège Notre Dame', p: '95.4%' },
                    { n: 'EPC Littoral', p: '92.1%' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                       <span className="text-[11px] font-bold text-gray-600">{s.n}</span>
                       <span className="text-xs font-black text-blue-900">{s.p}</span>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
