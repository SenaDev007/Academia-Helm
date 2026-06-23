/**
 * ============================================================================
 * CONTROL WORKSPACE - MODULE 2 (Contrôle Direction & Audit ORION)
 * ============================================================================
 * 
 * Centre de supervision pédagogique pour la Direction :
 * 1. Pilotage par les indicateurs de performance (KPIs)
 * 2. Workflow de validation des documents (Cahiers, Fiches)
 * 3. Audit prédictif ORION (Risques de couverture, Retards)
 * 4. Analyse comparative des départements/enseignants
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  Users, 
  Zap, 
  TrendingUp, 
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Award,
  Eye,
  MessageSquare,
  Stamp,
  Fingerprint,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormModal, ConfirmModal } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyService } from '@/services/pedagogy.service';
import { useToast } from '@/components/ui/use-toast';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// --- Types ---

interface OrionInsight {
  id: string;
  title: string;
  description: string;
  severity: 'GREEN' | 'YELLOW' | 'RED';
  category: string;
}

interface RiskFlag {
  id: string;
  entityName: string;
  reason: string;
  level: 'YELLOW' | 'RED';
}

interface KpiDashboard {
  lessonPlanRate: number;
  journalRate: number;
  classLogRate: number;
  weeklyReportRate: number;
  overallRate: number;
  totalActiveAssignments: number;
}

export default function ControlWorkspace() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const cleanup = networkDetectionService.onNetworkStatusChange((online) => {
      setIsOffline(!online);
    });
    setIsOffline(!networkDetectionService.isConnected());
    return cleanup;
  }, []);
  
  // Data
  const [kpis, setKpis] = useState<KpiDashboard | null>(null);
  const [insights, setInsights] = useState<OrionInsight[]>([]);
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);

  // --- Loaders ---

  const loadControlData = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const [kpiData, orionData, pendingData] = await Promise.all([
        pedagogyService.getKpiDashboard(academicYear.id).catch(() => null),
        pedagogyService.getOrionDashboard(academicYear.id).catch(() => ({ insights: [], riskFlags: [] })),
        // On simule la récupération des documents en attente de validation
        // Use the dedicated director endpoint for submitted documents
        // instead of fetching ALL class diaries and filtering client-side
        fetch(`/api/pedagogy/director/documents/submitted?academicYearId=${academicYear.id}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }).then(r => r.ok ? r.json() : []).catch(() => [])
      ]);
      setKpis(kpiData);
      setInsights(orionData.insights || []);
      setRiskFlags(orionData.riskFlags || []);
      setPendingApprovals(pendingData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  const [activeTab, setActiveTab] = useState<'global' | 'documents' | 'teachers' | 'classes' | 'reports'>('global');

  useEffect(() => { loadControlData(); }, [loadControlData]);

  return (
    <div className="space-y-6 pb-10">
      {isOffline && (
        <div className="bg-amber-50 text-amber-800 p-4 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <p className="text-sm font-medium">Vous êtes en mode hors ligne. Certaines données d'analyse peuvent ne pas être à jour.</p>
        </div>
      )}
      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-100 bg-white rounded-t-3xl px-4">
        <button 
          onClick={() => setActiveTab('global')}
          className={cn("px-6 py-4 text-sm font-black tracking-wide border-b-2 transition-all", activeTab === 'global' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600")}
        >
          Vue Globale & Validations
        </button>
        <button 
          onClick={() => setActiveTab('documents')}
          className={cn("px-6 py-4 text-sm font-black tracking-wide border-b-2 transition-all", activeTab === 'documents' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600")}
        >
          Tous les Documents
        </button>
        <button 
          onClick={() => setActiveTab('teachers')}
          className={cn("px-6 py-4 text-sm font-black tracking-wide border-b-2 transition-all", activeTab === 'teachers' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600")}
        >
          Suivi par Enseignant
        </button>
        <button 
          onClick={() => setActiveTab('classes')}
          className={cn("px-6 py-4 text-sm font-black tracking-wide border-b-2 transition-all", activeTab === 'classes' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600")}
        >
          Suivi par Classe
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={cn("px-6 py-4 text-sm font-black tracking-wide border-b-2 transition-all", activeTab === 'reports' ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-400 hover:text-gray-600")}
        >
          Rapports Institutionnels
        </button>
      </div>

      {activeTab === 'global' && (
        <div className="space-y-8">
      {/* Top Section : Global Health */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Qualité Pédagogique</p>
              <h3 className="text-4xl font-black text-gray-900">{kpis ? Math.round(kpis.overallRate * 100) : 0}%</h3>
            </div>
            <div className="mt-6 flex items-center gap-2 text-emerald-600 font-bold text-xs">
              <TrendingUp className="w-4 h-4" /> +4.2% ce mois
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Couverture Programme</p>
              <h3 className="text-4xl font-black text-gray-900">58%</h3>
            </div>
            <div className="mt-6 flex items-center gap-2 text-amber-600 font-bold text-xs">
              <Clock className="w-4 h-4" /> En retard (Objectif: 65%)
            </div>
          </div>
          <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Documents Validés</p>
              <h3 className="text-4xl font-black text-gray-900">{pendingApprovals.length > 0 ? `-${pendingApprovals.length}` : 'OK'}</h3>
            </div>
            <div className="mt-6 flex items-center gap-2 text-indigo-600 font-bold text-xs">
              <Zap className="w-4 h-4" /> {pendingApprovals.length} en attente
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden flex flex-col justify-center">
           <div className="absolute top-0 right-0 p-8 opacity-10">
              <Activity className="w-24 h-24" />
           </div>
           <div className="relative">
              <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-2">Audit ORION</p>
              <h4 className="text-2xl font-black leading-tight">Score de Conformité Institutionnelle</h4>
              <div className="mt-6 text-4xl font-black">Grade A-</div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Approbations en attente */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-gray-50 flex items-center justify-between">
            <h4 className="text-xl font-black text-gray-900 flex items-center gap-3">
              <Fingerprint className="w-6 h-6 text-indigo-600" />
              Workflow d'Approbation
            </h4>
            <span className="px-3 py-1 bg-amber-100 text-amber-600 rounded-full text-[10px] font-black uppercase">
              {pendingApprovals.length} Action(s)
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {pendingApprovals.length === 0 ? (
              <div className="py-20 text-center text-gray-300">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-bold">Tous les documents sont visés.</p>
              </div>
            ) : pendingApprovals.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-5 bg-gray-50 rounded-3xl border border-gray-100 hover:border-indigo-200 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Cahier de Texte - {doc.classSubject.class.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Séance du {format(new Date(doc.date), 'dd/MM/yyyy')} • {doc.classSubject.subject.name}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                   <button className="p-3 bg-white border border-gray-200 text-gray-400 hover:text-indigo-600 rounded-2xl transition-all" title="Lire et amender">
                      <Eye className="w-5 h-5" />
                   </button>
                   <button className="p-3 bg-white border border-gray-200 text-gray-400 hover:text-rose-600 rounded-2xl transition-all" title="Rejeter / Demander correction">
                      <AlertTriangle className="w-5 h-5" />
                   </button>
                   <button className="p-3 bg-indigo-600 text-white rounded-2xl hover:scale-105 transition-all shadow-md shadow-indigo-100" title="Valider le document">
                      <Stamp className="w-5 h-5" />
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Prédictif ORION */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-gray-50 flex items-center justify-between">
            <h4 className="text-xl font-black text-gray-900 flex items-center gap-3">
              <Zap className="w-6 h-6 text-amber-500" />
              Intelligence Auditive ORION
            </h4>
            <BarChart3 className="w-6 h-6 text-gray-300" />
          </div>
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            {/* Alertes Critiques */}
            {riskFlags.map(risk => (
              <div key={risk.id} className="flex gap-4 p-5 bg-rose-50 rounded-3xl border border-rose-100">
                 <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
                 <div>
                    <p className="text-xs font-black text-rose-800 uppercase tracking-widest mb-1">Alerte Critique : {risk.entityName}</p>
                    <p className="text-sm text-rose-700 font-medium leading-relaxed">{risk.reason}</p>
                 </div>
              </div>
            ))}

            {/* Insights */}
            <div className="space-y-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Analyse Prédictive</p>
              {insights.map(insight => (
                <div key={insight.id} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl hover:bg-white hover:shadow-lg hover:shadow-gray-100 transition-all cursor-default">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      insight.severity === 'GREEN' ? "bg-emerald-500" : insight.severity === 'YELLOW' ? "bg-amber-500" : "bg-rose-500"
                    )} />
                    <div>
                       <p className="text-sm font-bold text-gray-900">{insight.title}</p>
                       <p className="text-[10px] text-gray-400 font-bold">{insight.category}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Teacher Performance Matrix */}
      <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm">
         <div className="flex items-center justify-between mb-10">
            <div>
               <h4 className="text-2xl font-black text-gray-900 tracking-tight">Matrice de Performance Pédagogique</h4>
               <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mt-1">Comparaison des taux de production par département</p>
            </div>
            <button className="flex items-center gap-2 px-6 py-3 bg-gray-50 rounded-2xl text-xs font-black text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all">
               <Activity className="w-4 h-4" /> ANALYSER TOUT
            </button>
         </div>

         <div className="space-y-8">
            {[
              { dept: 'Département Scientifique', rate: 92, status: 'Excellence', color: 'bg-emerald-500' },
              { dept: 'Département Littéraire', rate: 74, status: 'Satisfaisant', color: 'bg-indigo-500' },
              { dept: 'Département Arts & Sport', rate: 45, status: 'Alerte', color: 'bg-amber-500' },
            ].map((d, i) => (
              <div key={i} className="space-y-2">
                 <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-gray-900">{d.dept}</p>
                    <div className="flex items-center gap-3">
                       <span className="text-[10px] font-black uppercase tracking-tighter text-gray-400">{d.status}</span>
                       <span className="text-sm font-black text-gray-900">{d.rate}%</span>
                    </div>
                 </div>
                 <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${d.rate}%` }}
                      transition={{ duration: 1, delay: i * 0.1 }}
                      className={cn("h-full rounded-full", d.color)} 
                    />
                 </div>
              </div>
            ))}
         </div>
      </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-gray-900">Bibliothèque des Documents Soumis</h3>
              <div className="flex gap-2">
                 <select className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600">
                    <option>Tous les types</option>
                    <option>Fiches Pédagogiques</option>
                    <option>Cahiers Journaux</option>
                    <option>Cahiers de Textes</option>
                    <option>Cahiers de Semaine</option>
                 </select>
                 <select className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600">
                    <option>Tous les statuts</option>
                    <option>En attente (Documents reçus)</option>
                    <option>Validés (Archives)</option>
                    <option>Rejetés</option>
                    <option>Observations envoyées</option>
                 </select>
              </div>
           </div>
           
           <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                 <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                       <th className="pb-4">Document</th>
                       <th className="pb-4">Auteur</th>
                       <th className="pb-4">Classe / Matière</th>
                       <th className="pb-4">Date de soumission</th>
                       <th className="pb-4">Statut</th>
                       <th className="pb-4 text-right">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    <tr className="hover:bg-gray-50 transition-colors">
                       <td className="py-4">
                          <div className="flex items-center gap-3">
                             <FileText className="w-5 h-5 text-indigo-500" />
                             <span className="font-bold text-gray-900">Fiche: Les fractions</span>
                          </div>
                       </td>
                       <td className="py-4 text-gray-600">M. KOFFI A.</td>
                       <td className="py-4 text-gray-600">CM2 Alpha • Maths</td>
                       <td className="py-4 text-gray-600">12 Mai 2025</td>
                       <td className="py-4"><span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded font-bold text-xs uppercase">Validé</span></td>
                       <td className="py-4 text-right">
                          <button className="text-indigo-600 hover:text-indigo-800 font-bold text-xs">Ouvrir</button>
                       </td>
                    </tr>
                    <tr className="hover:bg-gray-50 transition-colors">
                       <td className="py-4">
                          <div className="flex items-center gap-3">
                             <FileText className="w-5 h-5 text-amber-500" />
                             <span className="font-bold text-gray-900">Cahier Journal Semaine 12</span>
                          </div>
                       </td>
                       <td className="py-4 text-gray-600">Mme. TRAORÉ</td>
                       <td className="py-4 text-gray-600">Terminale C</td>
                       <td className="py-4 text-gray-600">14 Mai 2025</td>
                       <td className="py-4"><span className="text-amber-600 bg-amber-50 px-2 py-1 rounded font-bold text-xs uppercase">Observation Envoyée</span></td>
                       <td className="py-4 text-right">
                          <button className="text-indigo-600 hover:text-indigo-800 font-bold text-xs">Ouvrir</button>
                       </td>
                    </tr>
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {activeTab === 'teachers' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
           <h3 className="text-2xl font-black text-gray-900 mb-6">Suivi Pédagogique par Enseignant</h3>
           <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                 <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                       <th className="pb-4">Enseignant</th>
                       <th className="pb-4">Fiches Pédago.</th>
                       <th className="pb-4">Cahier Journal</th>
                       <th className="pb-4">Cahier de Texte</th>
                       <th className="pb-4">Retards / Alertes</th>
                       <th className="pb-4">Statut Global</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    <tr className="hover:bg-gray-50 transition-colors">
                       <td className="py-4 font-bold text-gray-900">Mme. Traoré A.</td>
                       <td className="py-4"><span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded font-bold">4/5 Validées</span></td>
                       <td className="py-4 text-emerald-600 font-medium">À jour</td>
                       <td className="py-4 text-amber-600 font-medium">Incomplet (Lundi)</td>
                       <td className="py-4"><span className="text-gray-400">-</span></td>
                       <td className="py-4"><span className="text-emerald-600 font-black">Satisfaisant</span></td>
                    </tr>
                    <tr className="hover:bg-gray-50 transition-colors">
                       <td className="py-4 font-bold text-gray-900">M. Koné J.</td>
                       <td className="py-4"><span className="text-rose-600 bg-rose-50 px-2 py-1 rounded font-bold">1/5 Validée</span></td>
                       <td className="py-4 text-rose-600 font-medium">En retard</td>
                       <td className="py-4 text-emerald-600 font-medium">À jour</td>
                       <td className="py-4"><span className="text-rose-600 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> 2 Retards</span></td>
                       <td className="py-4"><span className="text-rose-600 font-black">Alerte</span></td>
                    </tr>
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {activeTab === 'classes' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
           <h3 className="text-2xl font-black text-gray-900 mb-6">Couverture Pédagogique par Classe</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 border border-gray-100 rounded-2xl shadow-sm">
                 <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-black">Terminale C</h4>
                    <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold">Couverture: 100%</span>
                 </div>
                 <p className="text-sm text-gray-600 mb-2">Matières couvertes : 8/8</p>
                 <p className="text-sm text-gray-600 mb-2">Heures prévues : 32h</p>
                 <p className="text-sm text-gray-600">Heures assurées (Cahier texte) : <strong className="text-emerald-600">32h</strong></p>
              </div>
              <div className="p-6 border border-rose-100 rounded-2xl shadow-sm bg-rose-50/20">
                 <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-black text-rose-900">6ème A</h4>
                    <span className="text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-bold">Couverture: 85%</span>
                 </div>
                 <p className="text-sm text-gray-600 mb-2">Matières couvertes : 9/10</p>
                 <p className="text-sm text-gray-600 mb-2">Heures prévues : 28h</p>
                 <p className="text-sm text-gray-600">Heures assurées (Cahier texte) : <strong className="text-rose-600">24h</strong> 🔴 (SVT manquant)</p>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
           <h3 className="text-2xl font-black text-gray-900 mb-2">Rapports & Exports Institutionnels</h3>
           <p className="text-sm text-gray-500 mb-8">Générez des rapports PDF avec signature numérique et cachet de l'établissement.</p>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: 'Rapport Hebdo Pédagogique', desc: 'Synthèse des cahiers de texte et journaux de la semaine.' },
                { title: 'Rapport Mensuel Production', desc: 'Analyse des fiches pédagogiques validées et taux de couverture.' },
                { title: 'Bilan Institutionnel Complet', desc: 'Export global pour l\'inspection académique.' },
              ].map((r, i) => (
                <div key={i} className="p-6 border border-gray-100 rounded-2xl hover:border-indigo-300 transition-all cursor-pointer group">
                   <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <FileText className="w-6 h-6" />
                   </div>
                   <h4 className="font-bold text-gray-900 mb-2">{r.title}</h4>
                   <p className="text-xs text-gray-500">{r.desc}</p>
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
}
