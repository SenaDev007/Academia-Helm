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
import { 
  FormModal, 
  ConfirmModal 
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
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
  const [loading, setLoading] = useState(false);
  
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
        pedagogyFetch<KpiDashboard>(`/api/pedagogy/kpi/dashboard?academicYearId=${academicYear.id}`),
        pedagogyFetch<any>(`/api/pedagogy/orion/dashboard?academicYearId=${academicYear.id}`),
        // On simule la récupération des documents en attente de validation
        pedagogyFetch<any[]>(`/api/pedagogy/class-diaries?status=SUBMITTED`)
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

  useEffect(() => { loadControlData(); }, [loadControlData]);

  return (
    <div className="space-y-8 pb-10">
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
                   <button className="p-3 bg-white border border-gray-200 text-gray-400 hover:text-indigo-600 rounded-2xl transition-all">
                      <Eye className="w-5 h-5" />
                   </button>
                   <button className="p-3 bg-indigo-600 text-white rounded-2xl hover:scale-105 transition-all shadow-md shadow-indigo-100">
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
  );
}
