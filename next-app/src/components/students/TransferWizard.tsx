/**
 * TransferWizard Component
 * 
 * Assistant de création de demande de transfert inter-écoles
 * 
 * Implémente l'addendum Offline-First :
 * - Distinction global_student_id (permanent) vs local_student_matricule (par école)
 * - Les étapes 1-3 sont disponibles hors ligne (brouillon DRAFT)
 * - L'étape 4 (envoi officiel) exige une connexion serveur
 */

'use client';

import { useState } from 'react';
import { 
  ArrowRight, 
  Search, 
  User, 
  Building2, 
  FileText, 
  CheckCircle2,
  X,
  Wifi,
  WifiOff,
  Shield,
  Hash,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TransferWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TransferWizard({ isOpen, onClose }: TransferWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedSchool, setSelectedSchool] = useState<any>(null);
  const [newLocalMatricule, setNewLocalMatricule] = useState('');
  const [transferReason, setTransferReason] = useState('');
  // Simule l'état de connexion (dans la vraie app : hook useNetworkStatus)
  const isOnline = true;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-950/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex h-[600px] border border-white/20">
        {/* Sidebar Steps */}
        <div className="w-72 bg-gradient-to-b from-blue-900 to-indigo-950 p-10 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-12">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center border border-white/10">
                <ArrowRight className="w-4 h-4 text-blue-300" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-200">Transfert Helm</span>
            </div>

            <div className="space-y-8">
              {[
                { n: 1, l: 'Choisir l\'élève', i: <User className="w-4 h-4" /> },
                { n: 2, l: 'École destination', i: <Building2 className="w-4 h-4" /> },
                { n: 3, l: 'Préparer dossier', i: <FileText className="w-4 h-4" /> },
                { n: 4, l: 'Confirmation', i: <CheckCircle2 className="w-4 h-4" /> },
              ].map((s) => (
                <div key={s.n} className={cn(
                  "flex items-center space-x-4 transition-all",
                  step === s.n ? "opacity-100 translate-x-2" : "opacity-40"
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center border-2 text-[10px] font-black",
                    step === s.n ? "border-blue-400 bg-blue-400 text-blue-900 shadow-[0_0_15px_rgba(96,165,250,0.5)]" : "border-white/20"
                  )}>
                    {s.n}
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest">{s.l}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-10 border-t border-white/10 text-[9px] font-bold text-white/40 uppercase tracking-widest leading-relaxed">
            Academia Helm Inter-Connect <br /> Secured Mobility Protocol v4.0
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="p-10 flex items-center justify-between border-b border-gray-50">
            <div>
              <h2 className="text-2xl font-black text-gray-900 italic tracking-tighter">
                {step === 1 && "Sélection de l'élève"}
                {step === 2 && "Établissement d'accueil"}
                {step === 3 && "Composition du dossier scolaire"}
                {step === 4 && "Validation finale de l'envoi"}
              </h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Étape {step} sur 4</p>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-gray-50 rounded-2xl text-gray-300 hover:text-gray-900 transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 p-10 overflow-y-auto">
            {step === 1 && (
              <div className="space-y-6">
                {/* Règle Addendum : Explication Double ID */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Système de double identification</p>
                    <p className="text-[10px] font-medium text-indigo-700 mt-1 leading-relaxed">
                      Chaque élève possède un <strong>Identifiant Global Helm</strong> (permanent, quel que soit l'école) et un <strong>Matricule Local</strong> propre à chaque établissement. Le transfert conserve l'ID global.
                    </p>
                  </div>
                </div>

                <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-blue-600 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Rechercher par nom, ID Global Helm ou matricule local..." 
                    className="w-full pl-14 pr-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-900/5 focus:border-blue-900 outline-none transition-all placeholder:text-gray-300"
                  />
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 1, name: 'Alice Mensah', globalId: 'AH-STU-2026-000000045', localMat: 'EPA/2026/045', class: '3ème A' },
                    { id: 2, name: 'Koffi Zinsou', globalId: 'AH-STU-2026-000000123', localMat: 'CSL/2026/085', class: 'CM2 B' },
                  ].map(s => (
                    <button 
                      key={s.id} 
                      onClick={() => setSelectedStudent(s)}
                      className={cn(
                        "p-5 rounded-2xl border text-left flex items-center justify-between transition-all group",
                        selectedStudent?.id === s.id ? "bg-blue-900 border-blue-900 shadow-xl" : "bg-white border-gray-100 hover:border-blue-200 shadow-sm"
                      )}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black", selectedStudent?.id === s.id ? "bg-white/20 text-white" : "bg-blue-50 text-blue-900")}>
                          {s.name[0]}
                        </div>
                        <div>
                          <p className={cn("text-xs font-black", selectedStudent?.id === s.id ? "text-white" : "text-gray-900")}>{s.name}</p>
                          {/* Double identification : Global ID + Local Matricule */}
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className={cn("text-[9px] font-black uppercase tracking-widest flex items-center gap-1", selectedStudent?.id === s.id ? "text-blue-200" : "text-indigo-500")}>
                              <Hash className="w-3 h-3" />{s.globalId}
                            </span>
                            <span className={cn("text-[9px] font-bold", selectedStudent?.id === s.id ? "text-blue-300" : "text-gray-400")}>•</span>
                            <span className={cn("text-[9px] font-bold uppercase tracking-widest", selectedStudent?.id === s.id ? "text-blue-300" : "text-gray-400")}>
                              Mat. local : {s.localMat}
                            </span>
                            <span className={cn("text-[9px] font-bold", selectedStudent?.id === s.id ? "text-blue-300" : "text-gray-400")}>•</span>
                            <span className={cn("text-[9px] font-bold", selectedStudent?.id === s.id ? "text-blue-200" : "text-gray-400")}>{s.class}</span>
                          </div>
                        </div>
                      </div>
                      {selectedStudent?.id === s.id && <CheckCircle2 className="w-5 h-5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                 <div className="relative group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 group-focus-within:text-blue-600 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Rechercher une école dans l'annuaire Helm..." 
                    className="w-full pl-14 pr-6 py-5 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-900/5 focus:border-blue-900 outline-none transition-all placeholder:text-gray-300"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 1, name: 'Lycée de l\'Excellence', city: 'Cotonou', code: 'E-COT-001' },
                    { id: 2, name: 'Groupe Scolaire Les Pépites', city: 'Porto-Novo', code: 'E-PNV-042' },
                  ].map(sc => (
                    <button 
                      key={sc.id} 
                      onClick={() => setSelectedSchool(sc)}
                      className={cn(
                        "p-5 rounded-2xl border text-left flex items-center justify-between transition-all",
                        selectedSchool?.id === sc.id ? "bg-blue-900 border-blue-900 shadow-xl" : "bg-white border-gray-100 hover:border-blue-200 shadow-sm"
                      )}
                    >
                      <div className="flex items-center space-x-4">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black", selectedSchool?.id === sc.id ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-900")}>
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className={cn("text-xs font-black", selectedSchool?.id === sc.id ? "text-white" : "text-gray-900")}>{sc.name}</p>
                          <p className={cn("text-[10px] font-bold uppercase tracking-widest mt-0.5", selectedSchool?.id === sc.id ? "text-blue-200" : "text-gray-400")}>{sc.city} • {sc.code}</p>
                        </div>
                      </div>
                      {selectedSchool?.id === sc.id && <CheckCircle2 className="w-5 h-5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
               <div className="space-y-5">
                 {/* Nouveau matricule local pour l'école destination */}
                 <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                   <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                     <Hash className="w-3.5 h-3.5" />
                     Matricule local à l'école destination
                   </p>
                   <p className="text-[10px] text-amber-700 mb-3 leading-relaxed">
                     L'ID Global Helm <strong className="font-black">{selectedStudent?.globalId || 'AH-STU-...'}</strong> est conservé. 
                     L'école <strong>{selectedSchool?.name || 'destination'}</strong> attribuera son propre matricule local :
                   </p>
                   <input
                     type="text"
                     value={newLocalMatricule}
                     onChange={(e) => setNewLocalMatricule(e.target.value)}
                     placeholder="Ex : EPB/2027/018 (attribué par l'école destination)"
                     className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-400 outline-none placeholder:text-gray-300"
                   />
                 </div>

                 <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                    <p className="text-[10px] font-black text-blue-900 uppercase tracking-[0.2em] mb-3">Checklist du dossier transférable</p>
                    <div className="space-y-3">
                       {[
                         { l: 'Identité élève + Photo (ID Global conservé)', s: true },
                         { l: 'Bulletins des 3 derniers trimestres', s: true },
                         { l: 'Historique de classe & absences', s: true },
                         { l: 'Observations pédagogiques', s: true },
                         { l: 'Certificat de scolarité actuel', s: true },
                         { l: 'Certificat de transfert officiel', s: true },
                         { l: 'Situation comptable (Soldé)', s: false },
                         { l: 'Données médicales (autorisation requise)', s: false },
                       ].map((item, i) => (
                         <div key={i} className="flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-800">{item.l}</span>
                            {item.s ? (
                              <CheckCircle2 className="w-4 h-4 text-blue-600" />
                            ) : (
                              <span className="text-[9px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full uppercase tracking-widest">Autorisation requise</span>
                            )}
                         </div>
                       ))}
                    </div>
                 </div>

                 <div>
                   <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Motif du transfert</p>
                   <textarea
                     value={transferReason}
                     onChange={(e) => setTransferReason(e.target.value)}
                     placeholder="Déménagement de la famille, admission dans une filière spécialisée..."
                     rows={2}
                     className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-900/10 outline-none resize-none placeholder:text-gray-300"
                   />
                 </div>
               </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                {/* Règle Offline-First critique */}
                <div className={cn(
                  "rounded-2xl p-4 flex items-start gap-3 border",
                  isOnline ? "bg-green-50 border-green-100" : "bg-red-50 border-red-200"
                )}>
                  {isOnline ? <Wifi className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> : <WifiOff className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
                  <div>
                    <p className={cn("text-[10px] font-black uppercase tracking-widest", isOnline ? "text-green-900" : "text-red-900")}>
                      {isOnline ? "Connexion active — Envoi possible" : "Hors ligne — Envoi impossible"}
                    </p>
                    <p className={cn("text-[10px] font-medium mt-1 leading-relaxed", isOnline ? "text-green-700" : "text-red-700")}>
                      {isOnline
                        ? "La connexion serveur est disponible. L'envoi officiel créera l'inscription dans l'école destination et attribuera définitivement le nouveau matricule local."
                        : "Règle Offline-First : aucun transfert inter-écoles ne devient officiel sans synchronisation serveur. Le brouillon a été sauvegardé localement."}
                    </p>
                  </div>
                </div>

                {/* Récapitulatif de la double identification */}
                <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Récapitulatif de la double identification</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl p-3 border border-indigo-100">
                      <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1 flex items-center gap-1"><Shield className="w-3 h-3"/>ID Global Helm (conservé)</p>
                      <p className="text-xs font-black text-gray-900 break-all">{selectedStudent?.globalId || '—'}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-amber-100">
                      <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-1"><Hash className="w-3 h-3"/>Nouveau Matricule Local</p>
                      <p className="text-xs font-black text-gray-900">{newLocalMatricule || '(attribué à la finalisation)'}</p>
                    </div>
                    <div className="col-span-2 bg-white rounded-xl p-3 border border-gray-100">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">École source → École destination</p>
                      <p className="text-xs font-bold text-gray-700">{selectedStudent?.class || '—'} → {selectedSchool?.name || '—'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                    <FileText className="w-8 h-8 text-blue-900" />
                  </div>
                  <p className="text-xs font-medium text-gray-400 max-w-xs">
                    Statut initial : <strong className="text-blue-900">REQUESTED</strong>. L'école <strong>{selectedSchool?.name}</strong> recevra une notification et devra accepter la demande.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="p-10 border-t border-gray-50 flex items-center justify-between">
            <button 
              disabled={step === 1}
              onClick={() => setStep(s => s - 1)}
              className="px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 disabled:opacity-0 transition-all"
            >
              Précédent
            </button>
            <button 
              onClick={() => {
                if (step === 4) {
                  onClose();
                } else {
                  setStep(s => s + 1);
                }
              }}
              className="px-10 py-4 bg-blue-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl hover:bg-blue-800 transition-all flex items-center gap-3"
            >
              {step === 4 ? "Envoyer la demande" : "Continuer"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
