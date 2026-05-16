/**
 * FederisReportsPage Component
 * 
 * Bilans de Session & Rapports Institutionnels
 * Module 18 de l'infrastructure Academia Federis
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface Report {
  id: string;
  title: string;
  type: 'SESSION' | 'FINANCIAL' | 'LOGISTIC';
  date: string;
  status: 'FINAL' | 'DRAFT';
}

export default function FederisReportsPage() {
  const [reports, setReports] = useState<Report[]>([
    { id: '1', title: 'Bilan Global Session BAC 2023', type: 'SESSION', date: '2023-08-15', status: 'FINAL' },
    { id: '2', title: 'Rapport d\'Audit Financier Q1 2024', type: 'FINANCIAL', date: '2024-04-10', status: 'FINAL' },
    { id: '3', title: 'Inventaire Logistique Centers Littoral', type: 'LOGISTIC', date: '2024-05-01', status: 'DRAFT' },
  ]);

  return (
    <div className="space-y-8">
      {/* Header Reports */}
      <div className="bg-gradient-to-br from-gray-900 to-blue-950 p-12 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
           <div>
              <h1 className="text-4xl font-black mb-2 italic tracking-tighter">Rapports & Bilans</h1>
              <p className="text-blue-100/70 font-medium max-w-xl text-lg">
                Générez et archivez les rapports institutionnels de fin de session, les bilans financiers et les audits logistiques.
              </p>
           </div>
           
           <button className="px-8 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-500 transition-all flex items-center gap-3">
              <AppIcon name="plus" size="submenu" />
              Nouveau Rapport
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {reports.map(report => (
           <div key={report.id} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <AppIcon name="document" size="large" className="text-gray-900" />
              </div>
              
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-sm",
                report.type === 'SESSION' ? "bg-blue-50 text-blue-900" : 
                report.type === 'FINANCIAL' ? "bg-amber-50 text-amber-900" : "bg-purple-50 text-purple-900"
              )}>
                 <AppIcon name={report.type === 'FINANCIAL' ? 'finance' : 'document'} size="dashboard" />
              </div>

              <h3 className="text-lg font-black text-gray-900 mb-2 leading-tight">{report.title}</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">
                 {report.type} • {new Date(report.date).toLocaleDateString()}
              </p>
              
              <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
                 <div className={cn(
                   "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                   report.status === 'FINAL' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                 )}>
                    {report.status}
                 </div>
                 <button className="text-[10px] font-black text-blue-900 uppercase tracking-widest hover:underline">Consulter</button>
              </div>
           </div>
         ))}
      </div>
    </div>
  );
}
