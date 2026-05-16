/**
 * FederisArchivesPage Component
 * 
 * Registre National des Archives & Diplômes
 * Module 20 de l'infrastructure Academia Federis
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

interface ArchiveEntry {
  id: string;
  candidateName: string;
  exam: string;
  session: string;
  result: 'ADMIS' | 'ECHEC';
  certificateStatus: 'GENERATED' | 'PENDING' | 'ISSUED';
}

export default function FederisArchivesPage() {
  const [archives, setArchives] = useState<ArchiveEntry[]>([
    { id: '1', candidateName: 'Alice Mensah', exam: 'BEPC', session: '2023', result: 'ADMIS', certificateStatus: 'ISSUED' },
    { id: '2', candidateName: 'Koffi Zinsou', exam: 'BAC', session: '2023', result: 'ADMIS', certificateStatus: 'GENERATED' },
    { id: '3', candidateName: 'Ekué Dossou', exam: 'BEPC', session: '2022', result: 'ADMIS', certificateStatus: 'ISSUED' },
    { id: '4', candidateName: 'Yawa Lawson', exam: 'BAC', session: '2024', result: 'ADMIS', certificateStatus: 'PENDING' },
  ]);

  return (
    <div className="space-y-8">
      {/* Header Premium Archives */}
      <div className="bg-gradient-to-br from-blue-950 to-indigo-900 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-32 -mb-32 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center space-x-4 mb-6">
             <div className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10">
                <AppIcon name="folder" size="dashboard" className="text-blue-300" />
             </div>
             <div>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300">National Registry</span>
                <h1 className="text-4xl font-black tracking-tight">Archives & Diplômes</h1>
             </div>
          </div>
          <p className="text-blue-100/70 text-lg max-w-2xl font-medium leading-relaxed">
            Consultez les registres historiques des examens nationaux et gérez la délivrance sécurisée des diplômes et attestations de réussite.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
         {/* Filtres de recherche */}
         <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
               <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Recherche Avancée</h3>
               <div className="space-y-4">
                  <div>
                     <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Examen</label>
                     <select className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold p-3 focus:ring-2 focus:ring-blue-900 transition-all">
                        <option>Tous les examens</option>
                        <option>CEP</option>
                        <option>BEPC</option>
                        <option>BAC</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-[10px] font-bold text-gray-500 uppercase block mb-2">Session</label>
                     <select className="w-full bg-gray-50 border-none rounded-xl text-xs font-bold p-3 focus:ring-2 focus:ring-blue-900 transition-all">
                        <option>2024</option>
                        <option>2023</option>
                        <option>2022</option>
                        <option>2021</option>
                     </select>
                  </div>
                  <button className="w-full py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-900/10">
                     Filtrer les Archives
                  </button>
               </div>
            </div>

            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
               <div className="flex items-center space-x-3 mb-4">
                  <AppIcon name="warning" size="menu" className="text-blue-900" />
                  <h4 className="text-xs font-black text-blue-900 uppercase">Aide à la vérification</h4>
               </div>
               <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
                  Utilisez le matricule unique national pour vérifier l'authenticité d'un diplôme via le QR Code sécurisé Helm-Certify.
               </p>
            </div>
         </div>

         {/* Liste des diplômés */}
         <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
               <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Registre des Admis</h3>
                  <div className="flex items-center space-x-2">
                     <button className="p-2 bg-gray-50 rounded-lg text-gray-400 hover:text-blue-900 transition-colors">
                        <AppIcon name="print" size="submenu" />
                     </button>
                     <button className="p-2 bg-gray-50 rounded-lg text-gray-400 hover:text-blue-900 transition-colors">
                        <AppIcon name="finance" size="submenu" />
                     </button>
                  </div>
               </div>
               
               <div className="divide-y divide-gray-50">
                  {archives.map(entry => (
                    <div key={entry.id} className="p-8 flex items-center justify-between hover:bg-gray-50 transition-all group">
                       <div className="flex items-center space-x-6">
                          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center font-black text-blue-900 text-xl group-hover:bg-blue-900 group-hover:text-white transition-all">
                             {entry.candidateName[0]}
                          </div>
                          <div>
                             <h4 className="text-lg font-black text-gray-900">{entry.candidateName}</h4>
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                {entry.exam} • Session {entry.session} • <span className="text-green-600">Admis</span>
                             </p>
                          </div>
                       </div>

                       <div className="flex items-center space-x-8">
                          <div className="text-right">
                             <div className={cn(
                               "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded inline-block mb-1",
                               entry.certificateStatus === 'ISSUED' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                             )}>
                                {entry.certificateStatus === 'ISSUED' ? 'Délivré' : entry.certificateStatus === 'GENERATED' ? 'Généré' : 'En attente'}
                             </div>
                             <p className="text-[10px] font-bold text-gray-400 block uppercase">Statut Diplôme</p>
                          </div>
                          <button className="p-4 bg-gray-50 rounded-2xl text-gray-900 hover:bg-blue-900 hover:text-white transition-all shadow-sm">
                             <AppIcon name="document" size="submenu" />
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
