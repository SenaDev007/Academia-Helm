/**
 * StudentTransferContent Component
 * 
 * Gestion de la mobilité scolaire : transferts inter-écoles
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, 
  Send, 
  Inbox, 
  History as HistoryIcon, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search,
  Filter,
  ArrowRight,
  FileText,
  User
} from 'lucide-react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import TransferWizard from './TransferWizard';

export default function StudentTransferContent() {
  const [activeTab, setActiveTab] = useState<'INTERNAL' | 'OUTGOING' | 'INCOMING' | 'REQUESTS' | 'DOSSIERS' | 'HISTORY' | 'SETTINGS'>('OUTGOING');
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  useEffect(() => {
    // Simulation de données avec double identification (addendum)
    setTimeout(() => {
      setTransfers([
        {
          id: 't1',
          student: { 
            firstName: 'Alice', 
            lastName: 'Mensah', 
            globalId: 'AH-STU-2026-000000045',
            localMat: 'EPA/2026/045'
          },
          targetSchool: { name: "Lycée de l'Excellence" },
          sourceSchool: { name: 'École Primaire Pilote' },
          status: 'SENT_TO_DESTINATION',
          date: new Date().toISOString(),
          type: 'OUTGOING'
        },
        {
          id: 't2',
          student: { 
            firstName: 'Koffi', 
            lastName: 'Zinsou', 
            globalId: 'AH-STU-2026-000000123',
            localMat: 'CSL/2026/085'
          },
          targetSchool: { name: 'École Primaire Pilote' },
          sourceSchool: { name: 'Complexe Scolaire La Joie' },
          status: 'ACCEPTED_BY_DESTINATION',
          date: new Date(Date.now() - 86400000).toISOString(),
          type: 'INCOMING'
        },
        {
          id: 't3',
          student: { 
            firstName: 'Aissatou', 
            lastName: 'Diallo', 
            globalId: 'AH-STU-2025-000000892',
            localMat: 'EPA/2025/112'
          },
          targetSchool: { name: 'Groupe Scolaire Les Pépites' },
          sourceSchool: { name: 'École Primaire Pilote' },
          status: 'COMPLETED',
          date: new Date(Date.now() - 7 * 86400000).toISOString(),
          type: 'OUTGOING'
        }
      ]);
      setLoading(false);
    }, 800);
  }, []);

  const filteredTransfers = transfers.filter(t => t.type === activeTab || (activeTab === 'HISTORY' && ['EXECUTED', 'REJECTED'].includes(t.status)) || (activeTab === 'REQUESTS' && t.type === 'INCOMING' && t.status === 'RECEIVED'));

  return (
    <div className="space-y-6">
      {/* Header Inter-Écoles */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
           <ArrowRightLeft className="w-40 h-40" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
              Mobilité Scolaire
              <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Helm Inter-Connect</span>
            </h2>
            <p className="text-blue-100/70 font-medium max-w-xl">
              Gérez les transferts numériques complets des dossiers élèves entre les établissements du réseau Academia Helm.
            </p>
          </div>
          <button 
            onClick={() => setIsWizardOpen(true)}
            className="px-6 py-3 bg-white text-blue-900 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-50 transition-all flex items-center gap-2 self-start md:self-center"
          >
            <Send className="w-4 h-4" />
            Initier un Transfert
          </button>
        </div>

        <div className="flex items-center space-x-1 mt-8 bg-black/20 p-1 rounded-xl w-fit overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('INTERNAL')}
            className={cn(
              "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'INTERNAL' ? "bg-white text-blue-900 shadow-md" : "text-white/60 hover:text-white"
            )}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Internes
          </button>
          <button 
            onClick={() => setActiveTab('OUTGOING')}
            className={cn(
              "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'OUTGOING' ? "bg-white text-blue-900 shadow-md" : "text-white/60 hover:text-white"
            )}
          >
            <ArrowRight className="w-4 h-4" />
            Sortants
          </button>
          <button 
            onClick={() => setActiveTab('INCOMING')}
            className={cn(
              "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'INCOMING' ? "bg-white text-blue-900 shadow-md" : "text-white/60 hover:text-white"
            )}
          >
            <Inbox className="w-4 h-4" />
            Entrants
          </button>
          <button 
            onClick={() => setActiveTab('REQUESTS')}
            className={cn(
              "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'REQUESTS' ? "bg-white text-blue-900 shadow-md" : "text-white/60 hover:text-white"
            )}
          >
            <Clock className="w-4 h-4" />
            Demandes Reçues
          </button>
          <button 
            onClick={() => setActiveTab('DOSSIERS')}
            className={cn(
              "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'DOSSIERS' ? "bg-white text-blue-900 shadow-md" : "text-white/60 hover:text-white"
            )}
          >
            <FileText className="w-4 h-4" />
            Dossiers Transférés
          </button>
          <button 
            onClick={() => setActiveTab('HISTORY')}
            className={cn(
              "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'HISTORY' ? "bg-white text-blue-900 shadow-md" : "text-white/60 hover:text-white"
            )}
          >
            <HistoryIcon className="w-4 h-4" />
            Historique
          </button>
          <button 
            onClick={() => setActiveTab('SETTINGS')}
            className={cn(
              "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap",
              activeTab === 'SETTINGS' ? "bg-white text-blue-900 shadow-md" : "text-white/60 hover:text-white"
            )}
          >
            <Search className="w-4 h-4" /> {/* Or a Settings Icon if imported, but Search is available */}
            Paramètres
          </button>
        </div>
      </div>

      {/* Liste des transferts */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-20 text-center">
            <div className="w-10 h-10 border-4 border-blue-900/20 border-t-blue-900 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 font-bold">Synchronisation des demandes...</p>
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <HistoryIcon className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-400 font-bold">Aucun transfert dans cette catégorie</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activeTab === 'SETTINGS' ? (
              <div className="p-10 space-y-8">
                 <div>
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4">Politiques de transfert</h3>
                    <div className="space-y-4">
                       <label className="flex items-center space-x-3">
                         <input type="checkbox" className="rounded text-blue-900 focus:ring-blue-900" defaultChecked />
                         <span className="text-xs font-bold text-gray-600">Exiger le consentement parental avant exécution</span>
                       </label>
                       <label className="flex items-center space-x-3">
                         <input type="checkbox" className="rounded text-blue-900 focus:ring-blue-900" defaultChecked />
                         <span className="text-xs font-bold text-gray-600">Bloquer les transferts sortants pour impayés</span>
                       </label>
                       <label className="flex items-center space-x-3">
                         <input type="checkbox" className="rounded text-blue-900 focus:ring-blue-900" defaultChecked />
                         <span className="text-xs font-bold text-gray-600">Notifier le parent à chaque changement de statut</span>
                       </label>
                    </div>
                 </div>

                 {/* Règles Offline-First (addendum) */}
                 <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
                   <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                     <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>
                     Règles Offline-First (Addendum)
                   </h3>
                   <div className="space-y-3">
                     {[
                       { rule: 'Préparation brouillon (DRAFT)', offline: true },
                       { rule: 'Sélection des documents à transférer', offline: true },
                       { rule: 'Prévisualisation du certificat', offline: true },
                       { rule: 'Envoi officiel de la demande', offline: false },
                       { rule: 'Notification école destination', offline: false },
                       { rule: 'Acceptation / Rejet du transfert', offline: false },
                       { rule: 'Création inscription école destination', offline: false },
                       { rule: 'Attribution définitive du matricule local', offline: false },
                       { rule: 'Synchronisation dossier complet', offline: false },
                     ].map((item, i) => (
                       <div key={i} className="flex items-center justify-between">
                         <span className="text-xs font-medium text-gray-700">{item.rule}</span>
                         <span className={cn(
                           "text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest",
                           item.offline ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                         )}>
                           {item.offline ? 'Hors ligne OK' : 'Connexion requise'}
                         </span>
                       </div>
                     ))}
                   </div>
                 </div>

                 {/* Double identification */}
                 <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6">
                   <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-3">Double Identification — Règle système</h3>
                   <div className="space-y-2 text-xs font-medium text-indigo-700">
                     <p>• <strong>global_student_id</strong> : identité permanente dans tout Academia Helm (ex. AH-STU-2026-000000123)</p>
                     <p>• <strong>local_student_matricule</strong> : identifiant administratif attribué par chaque école selon ses standards</p>
                     <p>• Un transfert conserve toujours le <strong>global_student_id</strong></p>
                     <p>• L'école destination attribue son propre <strong>local_student_matricule</strong></p>
                     <p>• Academia Federis utilise le <strong>global_student_id</strong> pour éviter les doublons candidats aux examens</p>
                   </div>
                 </div>
              </div>
            ) : activeTab === 'INTERNAL' ? (
               <div className="p-20 text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ArrowRightLeft className="w-8 h-8 text-blue-300" />
                </div>
                <p className="text-gray-400 font-bold">Aucun transfert interne (changement de classe/site) récent.</p>
              </div>
            ) : filteredTransfers.length === 0 ? (
              <div className="p-20 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <HistoryIcon className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-400 font-bold">Aucun résultat trouvé dans cette catégorie.</p>
              </div>
            ) : (
              filteredTransfers.map(t => (
                <div key={t.id} className="p-6 hover:bg-gray-50/50 transition-all flex items-center justify-between group">
                  <div className="flex items-center space-x-6">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-900" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-gray-900">{t.student.lastName} {t.student.firstName}</h4>
                      <div className="flex items-center space-x-3 mt-1 flex-wrap gap-y-1">
                        {/* ID Global Helm (permanent) */}
                        <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
                          {t.student.globalId}
                        </span>
                        <span className="text-gray-200">•</span>
                        {/* Matricule local de l'école */}
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          Mat : {t.student.localMat}
                        </span>
                        <span className="text-gray-200">•</span>
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                          {t.type === 'OUTGOING' ? `Vers : ${t.targetSchool.name}` : `De : ${t.sourceSchool.name}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-8">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Statut</p>
                      <div className="flex items-center space-x-2">
                         <span className={cn(
                           "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                           t.status === 'SENT_TO_DESTINATION' || t.status === 'REQUESTED' ? "bg-amber-50 text-amber-600" :
                           t.status === 'ACCEPTED_BY_DESTINATION' || t.status === 'APPROVED_BY_SOURCE' ? "bg-blue-50 text-blue-600" :
                           t.status === 'COMPLETED' ? "bg-green-50 text-green-600" : 
                           t.status === 'REJECTED_BY_DESTINATION' || t.status === 'CANCELLED' ? "bg-red-50 text-red-600" : 
                           t.status === 'ARCHIVED' ? "bg-gray-100 text-gray-500" : "bg-gray-50 text-gray-400"
                         )}>
                           {t.status}
                         </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-900 hover:text-white transition-all shadow-sm">
                        Dossier
                      </button>
                      {(activeTab === 'INCOMING' || activeTab === 'REQUESTS') && t.status === 'SENT_TO_DESTINATION' && (
                        <button className="px-4 py-2 bg-blue-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-blue-800 transition-all">
                          Traiter
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Intelligence de transfert ORION */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex items-start space-x-4">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
          <AppIcon name="sparkles" size="dashboard" className="text-amber-600" />
        </div>
        <div>
          <h4 className="text-sm font-black text-amber-900 uppercase tracking-tighter">Analyse Prédictive Mobilité (ORION)</h4>
          <p className="text-xs font-medium text-amber-800 mt-1 leading-relaxed">
            Le flux de transferts sortants a augmenté de 12% ce mois-ci. Les motifs principaux sont liés aux déménagements (45%) et à la recherche de spécialités techniques (30%). 
            <button className="ml-2 underline font-black">Consulter le rapport complet</button>
          </p>
        </div>
      </div>

      <TransferWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)} 
      />
    </div>
  );
}
