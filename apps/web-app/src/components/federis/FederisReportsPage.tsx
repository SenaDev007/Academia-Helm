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
import { FedPage, FedStagger, FedStaggerItem } from '@/components/federis/federis-motion';

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
    <FedPage className="space-y-8">
      {/* Header Reports */}
      <div className="bg-gradient-to-br from-[#0b1d3a] to-[#071528] p-12 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-blue-400/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
           <div>
              <div className="fed-badge fed-badge-amber mb-3">Module analyse</div>
              <h1 className="text-2xl md:text-3xl font-black mb-2 tracking-tight">Rapports & Bilans</h1>
              <p className="text-blue-100/70 font-medium max-w-xl text-lg">
                Générez et archivez les rapports institutionnels de fin de session, les bilans financiers et les audits logistiques.
              </p>
           </div>
           
           <button className="fed-btn-gold fed-btn-shimmer px-8 py-3.5 text-sm">
              <AppIcon name="add" size="submenu" />
              Nouveau Rapport
           </button>
        </div>
      </div>

      <FedStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {reports.map(report => (
           <FedStaggerItem key={report.id}>
           <div className="fed-card fed-card-shimmer p-8 transition-all group relative overflow-hidden h-full">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <AppIcon name="document" size="large" className="text-[#0b1d3a]" />
              </div>
              
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-sm",
                report.type === 'SESSION' ? "bg-[#eff6ff] text-[#1e3a8a]" : 
                report.type === 'FINANCIAL' ? "bg-amber-50 text-amber-900" : "bg-purple-50 text-purple-900"
              )}>
                 <AppIcon name={report.type === 'FINANCIAL' ? 'finance' : 'document'} size="dashboard" />
              </div>

              <h3 className="text-lg font-black text-[#0b1d3a] mb-2 leading-tight">{report.title}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">
                 {report.type} • {new Date(report.date).toLocaleDateString()}
              </p>
              
              <div className="pt-6 border-t border-blue-50 flex items-center justify-between">
                 <div className={cn(
                   "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
                   report.status === 'FINAL' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                 )}>
                    {report.status}
                 </div>
                 <button className="text-[10px] font-black text-[#1e3a8a] uppercase tracking-widest hover:underline">Consulter</button>
              </div>
           </div>
           </FedStaggerItem>
         ))}
      </FedStagger>
    </FedPage>
  );
}
