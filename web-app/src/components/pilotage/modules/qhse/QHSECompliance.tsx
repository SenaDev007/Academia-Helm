/**
 * ============================================================================
 * QHSE REGULATORY COMPLIANCE
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Scale, CheckCircle2, AlertCircle, Clock, FileCheck, Shield, ExternalLink, ChevronRight } from 'lucide-react';

export default function QHSECompliance() {
  const complianceItems = [
    { id: 1, requirement: 'Certificat Sécurité Incendie', authority: 'Protection Civile', dueDate: '15/06/2026', status: 'CONFORME', progress: 100 },
    { id: 2, requirement: 'Agrément Sanitaire Cantine', authority: 'Ministère Santé', dueDate: '01/05/2026', status: 'ALERTE', progress: 85 },
    { id: 3, requirement: 'Contrôle Installations Gaz', authority: 'Bureau Veritas', dueDate: '20/05/2026', status: 'EN_ATTENTE', progress: 0 },
    { id: 4, requirement: 'Mise à jour Plan Évacuation', authority: 'Interne', dueDate: '10/06/2026', status: 'CONFORME', progress: 100 },
  ];

  return (
    <div className="space-y-8">
      {/* Compliance Header */}
      <div className="bg-emerald-600 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-xl shadow-emerald-600/20">
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                <Scale className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-3xl font-black uppercase tracking-tighter">Statut de Conformité</h3>
            </div>
            <p className="text-emerald-50 font-medium text-lg leading-relaxed">
              Votre établissement est actuellement conforme à <span className="font-black text-white underline">95.4%</span> des exigences réglementaires QHSE.
            </p>
            <div className="flex items-center gap-4">
               <button className="px-8 py-4 bg-white text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-white/10 hover:bg-emerald-50 transition-all">
                  Télécharger Certificat
               </button>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-[2rem] p-8 border border-white/10 flex flex-col justify-center">
             <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-black uppercase tracking-widest">Progression Globale</span>
                <span className="text-2xl font-black">95%</span>
             </div>
             <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-white w-[95%]" />
             </div>
             <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-6">
                Dernière mise à jour : 15 Mai 2026 • 09:45
             </p>
          </div>
        </div>
        <div className="absolute -bottom-10 -right-10 opacity-10">
          <Shield className="w-64 h-64" />
        </div>
      </div>

      {/* Requirement List */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
         <table className="w-full text-left">
           <thead>
             <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
               <th className="px-8 py-5">Exigence / Obligation</th>
               <th className="px-8 py-5">Autorité</th>
               <th className="px-8 py-5">Date Échéance</th>
               <th className="px-8 py-5">Statut</th>
               <th className="px-8 py-5 text-right">Actions</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-50">
             {complianceItems.map((item, i) => (
               <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                 <td className="px-8 py-5">
                   <div className="flex items-center gap-4">
                     <div className={`p-2.5 rounded-xl ${
                       item.status === 'CONFORME' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                     }`}>
                       <FileCheck className="w-5 h-5" />
                     </div>
                     <p className="font-black text-slate-900">{item.requirement}</p>
                   </div>
                 </td>
                 <td className="px-8 py-5 text-xs font-black text-slate-600 uppercase">{item.authority}</td>
                 <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 font-mono uppercase">
                      <Clock className="w-4 h-4 text-slate-400" /> {item.dueDate}
                    </div>
                 </td>
                 <td className="px-8 py-5">
                    <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                      item.status === 'CONFORME' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                      item.status === 'ALERTE' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}>
                      {item.status.replace('_', ' ')}
                    </span>
                 </td>
                 <td className="px-8 py-5 text-right">
                    <button className="p-3 hover:bg-emerald-50 rounded-xl text-slate-300 hover:text-emerald-600 transition-all">
                       <ExternalLink className="w-5 h-5" />
                    </button>
                 </td>
               </tr>
             ))}
           </tbody>
         </table>
      </div>
    </div>
  );
}
