/**
 * ============================================================================
 * PRODUCTION WORKSPACE - MODULE 2 (Espace de Production Pédagogique)
 * ============================================================================
 * 
 * Espace de travail pour les enseignants :
 * 1. Cahiers de textes (Class Diaries)
 * 2. Programmations & Fiches (Lesson Plans)
 * 3. Suivi de la progression du programme
 * 4. Validation direction & Feedback
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  BookOpen, 
  FileText, 
  Plus, 
  Search, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  ChevronRight,
  Send,
  MessageSquare,
  Paperclip,
  Save,
  Eye,
  Edit3,
  BarChart,
  LayoutDashboard,
  Sparkles,
  ArrowUpRight,
  History,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FormModal, 
  ConfirmModal 
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// --- Types ---

interface ClassDiary {
  id: string;
  date: string;
  notes: string;
  homework?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'ACKNOWLEDGED';
  classSubject: {
    class: { name: string };
    subject: { name: string; code: string };
  };
}

interface LessonPlan {
  id: string;
  date: string;
  title: string;
  theme?: string;
  competency?: string;
  objectives?: string;
  prerequisites?: string;
  materials?: string;
  duration?: string;
  content: string;
  methodology?: string;
  evaluation?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CORRECTION_REQUIRED';
  version: number;
}

interface AssignedSubject {
  id: string; // ClassSubject ID
  subject: { id: string; name: string; code: string };
  class: { id: string; name: string };
}

export default function ProductionWorkspace() {
  const { academicYear, tenantId } = useModuleContext();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'diaries' | 'lessons' | 'journal' | 'weekly' | 'progress' | 'feedback'>('dashboard');

  // Selection
  const [assignedSubjects, setAssignedSubjects] = useState<AssignedSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Data
  const [diaries, setDiaries] = useState<ClassDiary[]>([]);
  const [lessons, setLessons] = useState<LessonPlan[]>([]);
  
  // Modals
  const [modal, setModal] = useState<'none' | 'create-diary' | 'create-lesson'>('none');

  // --- Loaders ---

  const loadAssignments = useCallback(async () => {
    if (!user?.id || !academicYear?.id) return;
    try {
      // Pour cet exemple, on simule la récupération des affectations de l'enseignant connecté
      // En prod, on utiliserait un endpoint filtré par l'ID de l'enseignant
      const data = await pedagogyFetch<any[]>(`/api/pedagogy/teacher-class-assignments?teacherId=${user.id}&academicYearId=${academicYear.id}`);
      const mapping = data.map(a => ({
        id: a.classSubjectId,
        subject: a.classSubject.subject,
        class: a.classSubject.class
      }));
      setAssignedSubjects(mapping);
      if (mapping.length > 0) setSelectedSubjectId(mapping[0].id);
    } catch (e) {
      console.error(e);
    }
  }, [user?.id, academicYear?.id]);

  const loadProductionData = useCallback(async () => {
    if (!selectedSubjectId) return;
    setLoading(true);
    try {
      const [diariesData, lessonsData] = await Promise.all([
        pedagogyFetch<ClassDiary[]>(`/api/pedagogy/class-diaries?classSubjectId=${selectedSubjectId}`),
        pedagogyFetch<LessonPlan[]>(`/api/pedagogy/lesson-plans?classSubjectId=${selectedSubjectId}`)
      ]);
      setDiaries(diariesData);
      setLessons(lessonsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedSubjectId]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);
  useEffect(() => { loadProductionData(); }, [loadProductionData]);

  // --- Actions ---

  const handleCreateDiary = async (data: any) => {
    if (!selectedSubjectId || !academicYear?.id) return;
    try {
      await pedagogyFetch('/api/pedagogy/class-diaries', {
        method: 'POST',
        body: {
          ...data,
          classSubjectId: selectedSubjectId,
          academicYearId: academicYear.id,
          schoolLevelId: 'ALL' // Should be from class context
        }
      });
      loadProductionData();
      setModal('none');
    } catch (e) {
      console.error(e);
    }
  };

  const activeSubject = assignedSubjects.find(s => s.id === selectedSubjectId);

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-6 overflow-hidden">
      {/* Sidebar : Mes Classes & Matières */}
      <div className="w-80 bg-white rounded-3xl border border-gray-100 flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-50 bg-gray-50/20">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-indigo-600" />
            Mon Portfolio
          </h2>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Saisie des activités</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {assignedSubjects.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSubjectId(s.id)}
              className={cn(
                "w-full text-left p-4 rounded-2xl transition-all border",
                selectedSubjectId === s.id ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" : "hover:bg-gray-50 border-transparent text-gray-700"
              )}
            >
              <div className="flex items-center gap-3">
                 <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs", selectedSubjectId === s.id ? "bg-white/20" : "bg-indigo-50 text-indigo-600")}>
                    {s.subject.code}
                 </div>
                 <div className="min-w-0">
                    <p className="font-bold text-sm truncate">{s.subject.name}</p>
                    <p className={cn("text-[10px] font-bold uppercase", selectedSubjectId === s.id ? "text-indigo-200" : "text-gray-400")}>{s.class.name}</p>
                 </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Zone de Travail */}
      <div className="flex-1 bg-white rounded-3xl border border-gray-100 flex flex-col shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-50 bg-white overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={cn("px-6 py-5 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap", activeTab === 'dashboard' ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-gray-400 hover:text-gray-600")}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('diaries')}
            className={cn("px-6 py-5 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap", activeTab === 'diaries' ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-gray-400 hover:text-gray-600")}
          >
            Cahier de Textes
          </button>
          <button 
            onClick={() => setActiveTab('lessons')}
            className={cn("px-8 py-5 text-xs font-black uppercase tracking-widest border-b-2 transition-all", activeTab === 'lessons' ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-gray-400 hover:text-gray-600")}
          >
            Fiches & Programmations
          </button>
          <button 
            onClick={() => setActiveTab('journal')}
            className={cn("px-8 py-5 text-xs font-black uppercase tracking-widest border-b-2 transition-all", activeTab === 'journal' ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-gray-400 hover:text-gray-600")}
          >
            Cahier Journal
          </button>
          <button 
            onClick={() => setActiveTab('weekly')}
            className={cn("px-8 py-5 text-xs font-black uppercase tracking-widest border-b-2 transition-all", activeTab === 'weekly' ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-gray-400 hover:text-gray-600")}
          >
            Semainier
          </button>
          <button 
            onClick={() => setActiveTab('progress')}
            className={cn("px-6 py-5 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap", activeTab === 'progress' ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-gray-400 hover:text-gray-600")}
          >
            Progression
          </button>
          <button 
            onClick={() => setActiveTab('feedback')}
            className={cn("px-6 py-5 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap", activeTab === 'feedback' ? "border-rose-600 text-rose-600 bg-rose-50/30" : "border-transparent text-gray-400 hover:text-gray-600")}
          >
            Retours Direction
          </button>

          <div className="ml-auto flex items-center px-6 gap-2 shrink-0">
             <button 
              onClick={() => setModal(activeTab === 'diaries' ? 'create-diary' : 'create-lesson')}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black hover:scale-105 transition-all shadow-md shadow-indigo-100"
             >
                <Plus className="w-4 h-4" />
                NOUVELLE ENTRÉE
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50/10 p-8">
           {activeTab === 'dashboard' && (
             <div className="max-w-5xl mx-auto space-y-6">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-8">Vue d'ensemble Pédagogique</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Documents Soumis</p>
                      <h4 className="text-3xl font-black text-gray-900 mt-2">18</h4>
                   </div>
                   <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 shadow-sm">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Validés</p>
                      <h4 className="text-3xl font-black text-emerald-700 mt-2">12</h4>
                   </div>
                   <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 shadow-sm">
                      <p className="text-[10px] font-bold text-amber-600 uppercase">À Corriger</p>
                      <h4 className="text-3xl font-black text-amber-700 mt-2">2</h4>
                   </div>
                   <div className="p-6 bg-rose-50 rounded-3xl border border-rose-100 shadow-sm">
                      <p className="text-[10px] font-bold text-rose-600 uppercase">Rejetés</p>
                      <h4 className="text-3xl font-black text-rose-700 mt-2">0</h4>
                   </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                   <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
                      <h4 className="font-bold text-gray-900 mb-4">Derniers Retours Direction</h4>
                      <div className="space-y-3">
                         <div className="p-3 bg-amber-50 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"/>
                            <div>
                               <p className="text-xs font-bold text-amber-800">Fiche Pédago : Les équations</p>
                               <p className="text-[10px] text-amber-700 mt-1">"Veuillez détailler la phase d'évaluation."</p>
                            </div>
                         </div>
                      </div>
                   </div>
                   <div className="p-6 bg-indigo-900 rounded-3xl shadow-xl text-white">
                      <div className="flex items-center gap-2 mb-4 text-indigo-300">
                         <Sparkles className="w-5 h-5" />
                         <span className="text-xs font-bold uppercase">Assistant Sara AI</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed mb-4">Générez vos fiches pédagogiques en un clic ou demandez une correction automatique selon les retours de la direction.</p>
                      <button className="w-full py-2 bg-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-500 transition-colors">Ouvrir Sara AI</button>
                   </div>
                </div>
             </div>
           )}

           {activeTab === 'diaries' && (
             <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-2xl font-black text-gray-900 tracking-tight">Historique des séances</h3>
                   <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" placeholder="Chercher une séance..." className="pl-11 pr-4 py-2.5 bg-white border border-gray-100 rounded-2xl text-sm" />
                   </div>
                </div>

                <div className="space-y-4">
                  {diaries.length === 0 ? (
                    <div className="py-20 text-center bg-white rounded-3xl border border-gray-100 border-dashed">
                       <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                       <p className="text-gray-400 font-bold">Aucune séance enregistrée pour cette matière.</p>
                    </div>
                  ) : diaries.map(d => (
                    <motion.div 
                      key={d.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="flex gap-6">
                        <div className="w-20 flex flex-col items-center">
                           <div className="text-center">
                              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{format(new Date(d.date), 'MMM', { locale: fr })}</p>
                              <p className="text-3xl font-black text-gray-900">{format(new Date(d.date), 'dd')}</p>
                           </div>
                           <div className={cn(
                             "mt-4 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tighter",
                             d.status === 'APPROVED' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                           )}>
                             {d.status}
                           </div>
                        </div>

                        <div className="flex-1 space-y-4">
                           <div className="flex items-center justify-between">
                              <h4 className="text-lg font-bold text-gray-900">Résumé de la séance</h4>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 transition-all"><Edit3 className="w-4 h-4" /></button>
                                 <button className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 transition-all"><MessageSquare className="w-4 h-4" /></button>
                              </div>
                           </div>
                           <p className="text-gray-600 text-sm leading-relaxed">{d.notes}</p>
                           
                           {d.homework && (
                             <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-50">
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                                  <Clock className="w-3 h-3" /> Travail à faire
                                </p>
                                <p className="text-xs text-amber-900 font-medium">{d.homework}</p>
                             </div>
                           )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
             </div>
           )}

           {activeTab === 'lessons' && (
             <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-2xl font-black text-gray-900 tracking-tight">Mes Fiches Pédagogiques</h3>
                   <div className="flex gap-2">
                      <button className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all">
                        <History className="w-4 h-4" /> Archivées
                      </button>
                      <button 
                        onClick={() => setModal('create-lesson')}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black hover:scale-105 transition-all shadow-md shadow-indigo-100"
                      >
                        <Plus className="w-4 h-4" /> NOUVELLE FICHE
                      </button>
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {lessons.length === 0 ? (
                    <div className="py-20 text-center bg-white rounded-3xl border border-gray-100 border-dashed">
                       <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                       <p className="text-gray-400 font-bold">Aucune fiche pédagogique créée.</p>
                    </div>
                  ) : lessons.map(l => (
                    <motion.div 
                      key={l.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                           <FileText className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900">{l.title}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">{format(new Date(l.date), 'dd MMMM yyyy', { locale: fr })}</span>
                            <span className="text-gray-300">•</span>
                            <span className={cn(
                              "text-[9px] font-black uppercase px-2 py-0.5 rounded-lg",
                              l.status === 'APPROVED' ? "bg-emerald-100 text-emerald-600" : 
                              l.status === 'REJECTED' ? "bg-rose-100 text-rose-600" :
                              l.status === 'CORRECTION_REQUIRED' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                            )}>{l.status}</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-[9px] font-bold text-gray-500 uppercase">v{l.version}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <button className="p-2 hover:bg-gray-50 rounded-xl text-gray-400" title="Consulter"><Eye className="w-4 h-4" /></button>
                         {l.status === 'DRAFT' || l.status === 'CORRECTION_REQUIRED' ? (
                           <>
                             <button className="p-2 hover:bg-gray-50 rounded-xl text-gray-400" title="Modifier"><Edit3 className="w-4 h-4" /></button>
                             <button className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-indigo-100 transition-all">
                               <Send className="w-3 h-3" /> SOUMETTRE
                             </button>
                           </>
                         ) : null}
                      </div>
                    </motion.div>
                  ))}
                </div>
             </div>
           )}

           {activeTab === 'journal' && (
             <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-2xl font-black text-gray-900 tracking-tight">Mon Cahier Journal</h3>
                   <div className="flex gap-2">
                      <button 
                        className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black hover:scale-105 transition-all shadow-md shadow-indigo-100"
                      >
                        <Plus className="w-4 h-4" /> NOUVELLE ENTRÉE
                      </button>
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div className="py-20 text-center bg-white rounded-3xl border border-gray-100 border-dashed">
                       <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                       <p className="text-gray-400 font-bold">Le cahier journal est vide pour cette semaine.</p>
                    </div>
                </div>
             </div>
           )}

           {activeTab === 'weekly' && (
             <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-2xl font-black text-gray-900 tracking-tight">Mon Semainier</h3>
                   <div className="flex gap-2">
                      <button 
                        className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black hover:scale-105 transition-all shadow-md shadow-indigo-100"
                      >
                        <Plus className="w-4 h-4" /> NOUVEAU RAPPORT
                      </button>
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div className="py-20 text-center bg-white rounded-3xl border border-gray-100 border-dashed">
                       <CalendarIcon className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                       <p className="text-gray-400 font-bold">Aucun rapport hebdomadaire soumis.</p>
                    </div>
                </div>
             </div>
           )}

           {activeTab === 'progress' && (
             <div className="max-w-4xl mx-auto space-y-8">
                <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-[2.5rem] p-10 text-white shadow-xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-10 opacity-10">
                      <BarChart className="w-32 h-32" />
                   </div>
                   <div className="relative">
                      <h3 className="text-3xl font-black mb-2">Couverture du Programme</h3>
                      <p className="text-indigo-100/60 font-bold text-sm uppercase tracking-widest">Matière : {activeSubject?.subject.name}</p>
                      
                      <div className="mt-10 flex items-center gap-6">
                         <div className="text-5xl font-black">62%</div>
                         <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-400 rounded-full" style={{ width: '62%' }}></div>
                         </div>
                      </div>
                      <p className="mt-4 text-xs text-indigo-200/80">32 séances effectuées sur 52 prévues pour l'année.</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                      <h4 className="font-black text-gray-900 mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        Chapitres Validés
                      </h4>
                      <ul className="space-y-3">
                         {['Les opérations complexes', 'Géométrie vectorielle'].map((c, i) => (
                           <li key={i} className="flex items-center gap-3 text-xs font-bold text-gray-600 p-2 hover:bg-gray-50 rounded-xl">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              {c}
                           </li>
                         ))}
                      </ul>
                   </div>
                   <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                      <h4 className="font-black text-gray-900 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-500" />
                        En cours / Prochains
                      </h4>
                      <ul className="space-y-3">
                         {['Statistiques descriptives', 'Probabilités'].map((c, i) => (
                           <li key={i} className="flex items-center gap-3 text-xs font-bold text-gray-600 p-2 hover:bg-gray-50 rounded-xl">
                              <div className="w-2 h-2 rounded-full bg-gray-200" />
                              {c}
                           </li>
                         ))}
                      </ul>
                   </div>
                </div>
              </div>
           )}

           {activeTab === 'feedback' && (
             <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-2xl font-black text-gray-900 tracking-tight">Retours & Approbations Direction</h3>
                   <div className="flex gap-2">
                      <button className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-bold shadow-sm">
                        Filtrer par statut
                      </button>
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                   <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                         <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between items-start">
                            <div>
                               <span className="text-[10px] font-bold text-gray-400 uppercase">Cahier Journal • 12 Mai 2025</span>
                               <h4 className="text-lg font-bold text-gray-900 mt-1">À Corriger</h4>
                            </div>
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded uppercase">Action Requise</span>
                         </div>
                         <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-xs text-gray-600 font-medium">"Il manque les objectifs spécifiques pour la séance de Mathématiques de 10h. Veuillez compléter et soumettre à nouveau."</p>
                            <p className="text-[10px] text-gray-400 mt-2 font-bold">— M. le Directeur</p>
                         </div>
                         <div className="mt-4 flex gap-2">
                            <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors">Corriger le document</button>
                            <button className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors">Demander aide à Sara AI</button>
                         </div>
                      </div>
                   </div>
                   
                   <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm flex items-start gap-4 opacity-70">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
                         <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between items-start">
                            <div>
                               <span className="text-[10px] font-bold text-gray-400 uppercase">Fiche Pédagogique • 10 Mai 2025</span>
                               <h4 className="text-lg font-bold text-gray-900 mt-1">Validé</h4>
                            </div>
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase">Archivé</span>
                         </div>
                         <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-xs text-gray-600 font-medium">"Excellent travail, la progression est claire."</p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
           )}
        </div>
      </div>

      <FormModal
        isOpen={modal === 'create-lesson'}
        onClose={() => setModal('none')}
        title="Nouvelle Fiche Pédagogique"
        onSave={async () => {}} // TODO
        size="xl"
        fields={[
          {
            name: 'title',
            label: 'Titre de la leçon',
            type: 'text',
            required: true,
            placeholder: 'Ex: Introduction aux équations du second degré'
          },
          {
            name: 'theme',
            label: 'Thème / Chapitre',
            type: 'text',
            placeholder: 'Ex: Algèbre'
          },
          {
            name: 'competency',
            label: 'Compétence visée',
            type: 'textarea',
            placeholder: 'Décrivez la compétence globale...'
          },
          {
            name: 'objectives',
            label: 'Objectifs pédagogiques',
            type: 'textarea',
            placeholder: 'Énumérez les objectifs spécifiques...'
          },
          {
             name: 'preAi',
             label: 'Assistance Sara AI',
             type: 'custom',
             render: () => (
               <div className="p-4 bg-indigo-900 rounded-2xl text-white mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-300" />
                    <div>
                      <p className="text-xs font-bold">Sara AI Assistant</p>
                      <p className="text-[10px] text-indigo-300">Générer une structure de cours basée sur le titre</p>
                    </div>
                  </div>
                  <button className="bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-xl text-[10px] font-black transition-all">
                    GÉNÉRER
                  </button>
               </div>
             )
          },
          {
            name: 'content',
            label: 'Déroulement de la séance (Activités)',
            type: 'textarea',
            rows: 8,
            placeholder: 'Détaillez les activités enseignant/apprenant...'
          },
          {
            name: 'methodology',
            label: 'Stratégie pédagogique',
            type: 'text',
            placeholder: 'Ex: Travail de groupe, Exposé...'
          },
          {
            name: 'evaluation',
            label: 'Évaluation prévue',
            type: 'textarea',
            placeholder: 'Exercices d\'évaluation...'
          }
        ]}
      />
    </div>
  );
}
