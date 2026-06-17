/**
 * ============================================================================
 * QHSE REGULATORY COMPLIANCE
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Scale, CheckCircle2, AlertCircle, Clock, FileCheck, Shield, ExternalLink, ChevronRight, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';

interface ComplianceItem {
  id: string | number;
  requirement?: string;
  title?: string;
  name?: string;
  authority?: string;
  issuer?: string;
  dueDate?: string;
  deadline?: string;
  status?: string;
  progress?: number;
}

export default function QHSECompliance() {
  const { academicYear } = useModuleContext();
  const { data: complianceItems, loading, error } = useModulesList<ComplianceItem>('qhse', 'compliance', academicYear?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des exigences réglementaires...</span>
      </div>
    );
  }

  const overall = complianceItems.length > 0
    ? Math.round(complianceItems.reduce((acc, x) => acc + (x.progress ?? (x.status === 'CONFORME' ? 100 : 0)), 0) / complianceItems.length)
    : 0;

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

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
              Votre établissement est actuellement conforme à <span className="font-black text-white underline">{overall}%</span> des exigences réglementaires QHSE.
            </p>
            <div className="flex items-center gap-4">
               <button
                  onClick={() => alert('Bientôt disponible')}
                  className="px-8 py-4 bg-white text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-white/10 hover:bg-emerald-50 transition-all"
               >
                  Télécharger Certificat
               </button>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-[2rem] p-8 border border-white/10 flex flex-col justify-center">
             <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-black uppercase tracking-widest">Progression Globale</span>
                <span className="text-2xl font-black">{overall}%</span>
             </div>
             <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-white transition-all duration-1000" style={{ width: `${overall}%` }} />
             </div>
             <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mt-6">
                Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
             </p>
          </div>
        </div>
        <div className="absolute -bottom-10 -right-10 opacity-10">
          <Shield className="w-64 h-64" />
        </div>
      </div>

      {complianceItems.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-[2.5rem] border border-slate-100">
          Aucune exigence de conformité enregistrée pour cette année scolaire.
        </div>
      ) : (
        /* Requirement List */
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
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
              {complianceItems.map((item, i) => {
                const requirement = item.requirement || item.title || item.name || 'Exigence';
                const authority = item.authority || item.issuer || '—';
                const dueDate = item.dueDate || item.deadline || '—';
                const status = item.status || 'EN_ATTENTE';
                return (
                  <tr key={item.id ?? i} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl ${
                          status === 'CONFORME' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          <FileCheck className="w-5 h-5" />
                        </div>
                        <p className="font-black text-slate-900">{requirement}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-xs font-black text-slate-600 uppercase">{authority}</td>
                    <td className="px-8 py-5">
                       <div className="flex items-center gap-2 text-xs font-bold text-slate-500 font-mono uppercase">
                         <Clock className="w-4 h-4 text-slate-400" /> {dueDate}
                       </div>
                    </td>
                    <td className="px-8 py-5">
                       <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                         status === 'CONFORME' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                         status === 'ALERTE' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                       }`}>
                         {status.replace(/_/g, ' ')}
                       </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                       <button className="p-3 hover:bg-emerald-50 rounded-xl text-slate-300 hover:text-emerald-600 transition-all">
                          <ExternalLink className="w-5 h-5" />
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
