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
  AlertTriangle,
  Users,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormModal, ConfirmModal } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyService } from '@/services/pedagogy.service';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { cn } from '@/lib/utils';
import EntitySyncIndicator from '@/components/offline/EntitySyncIndicator';
import { useEntitySyncStatusBatch } from '@/hooks/useEntitySyncStatus';
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
  const diarySyncStatuses = useEntitySyncStatusBatch('CLASS_DIARY', tenantId ?? undefined);
  const lessonSyncStatuses = useEntitySyncStatusBatch('LESSON_PLAN', tenantId ?? undefined);
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'diaries' | 'lessons' | 'journal' | 'tests' | 'weekly' | 'progress' | 'feedback' | 'students'>('dashboard');

  useEffect(() => {
    const cleanup = networkDetectionService.onNetworkStatusChange((online) => {
      setIsOffline(!online);
    });
    setIsOffline(!networkDetectionService.isConnected());
    return cleanup;
  }, []);

  // Selection
  const [assignedSubjects, setAssignedSubjects] = useState<AssignedSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Data
  const [diaries, setDiaries] = useState<ClassDiary[]>([]);
  const [lessons, setLessons] = useState<LessonPlan[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [weeklyAssignment, setWeeklyAssignment] = useState<any | null>(null);
  const [semainier, setSemainier] = useState<any | null>(null);
  
  // Modals
  const [modal, setModal] = useState<'none' | 'create-diary' | 'create-lesson' | 'create-journal' | 'create-test' | 'create-weekly-entry' | 'report-weekly-incident'>('none');

  // --- Loaders ---

  const loadAssignments = useCallback(async () => {
    if (!user?.id || !academicYear?.id) return;
    try {
      const data = await pedagogyService.getTeacherAssignments(user.id, academicYear.id);
      const mapping = data.map((a: any) => ({
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
    if (!selectedSubjectId || !academicYear?.id) return;
    setLoading(true);
    try {
      const [diariesData, lessonsData, journalsData, testsData, semainierData] = await Promise.all([
        pedagogyService.getClassDiaries(selectedSubjectId),
        pedagogyService.getLessonPlans(selectedSubjectId),
        pedagogyService.getLessonJournals(),
        pedagogyService.getTests(selectedSubjectId),
        pedagogyService.getCurrentSemainier(academicYear.id, schoolLevel?.id || '')
      ]);
      setDiaries(diariesData || []);
      setLessons(lessonsData || []);
      setJournals(journalsData || []);
      setTests(testsData || []);
      if (semainierData) {
        setWeeklyAssignment(semainierData);
        setSemainier(semainierData.semainier);
      } else {
        setWeeklyAssignment(null);
        setSemainier(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedSubjectId, academicYear?.id]);

  useEffect(() => { loadAssignments(); }, [loadAssignments]);
  useEffect(() => { loadProductionData(); }, [loadProductionData]);

  // --- Actions ---

  const handleCreateDiary = async (data: any) => {
    if (!selectedSubjectId || !academicYear?.id) return;
    try {
      await pedagogyService.createClassDiary({
        ...data,
        classSubjectId: selectedSubjectId,
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel?.id || undefined
      });
      toast({
        title: "Succès",
        description: "L'entrée a été enregistrée avec succès.",
      });
      loadProductionData();
      setModal('none');
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erreur",
        description: e.message || "Impossible d'enregistrer l'entrée.",
        variant: "destructive"
      });
    }
  };

  const handleCreateLesson = async (data: any) => {
    if (!selectedSubjectId || !academicYear?.id) return;
    try {
      await pedagogyService.createLessonPlan({
        ...data,
        classSubjectId: selectedSubjectId,
        academicYearId: academicYear.id,
        date: new Date().toISOString(),
      });
      toast({
        title: "Succès",
        description: "La fiche a été enregistrée avec succès.",
      });
      loadProductionData();
      setModal('none');
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erreur",
        description: e.message || "Impossible d'enregistrer la fiche.",
        variant: "destructive"
      });
    }
  };

  const handleCreateJournal = async (data: any) => {
    if (!academicYear?.id) return;
    try {
      await pedagogyService.createLessonJournal({
        ...data,
        academicYearId: academicYear.id,
        weekStartDate: new Date(data.date).toISOString(),
        content: data.content || '',
      });
      toast({
        title: "Succès",
        description: "L'entrée du cahier journal a été enregistrée.",
      });
      loadProductionData();
      setModal('none');
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erreur",
        description: e.message || "Impossible d'enregistrer l'entrée.",
        variant: "destructive"
      });
    }
  };

  const handleCreateTest = async (data: any) => {
    if (!selectedSubjectId || !academicYear?.id) return;
    try {
      const activeSub = assignedSubjects.find(s => s.id === selectedSubjectId);
      await pedagogyService.createTest({
        ...data,
        classSubjectId: selectedSubjectId,
        classId: activeSub?.class.id,
        subjectId: activeSub?.subject.id,
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel?.id || undefined,
        examDate: new Date(data.examDate || new Date()).toISOString(),
        coefficient: parseFloat(data.coefficient || "1.0"),
        maxScore: parseFloat(data.maxScore || "20.0"),
      });
      toast({
        title: "Succès",
        description: "L'évaluation a été enregistrée avec succès.",
      });
      loadProductionData();
      setModal('none');
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erreur",
        description: e.message || "Impossible d'enregistrer l'évaluation.",
        variant: "destructive"
      });
    }
  };

  const handleCreateSemainier = async () => {
    if (!weeklyAssignment || !academicYear?.id) return;
    try {
      await pedagogyService.createSemainier({
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel?.id || undefined,
        assignmentId: weeklyAssignment.id,
        content: '',
      });
      toast({
        title: "Succès",
        description: "Le cahier de semaine a été initialisé.",
      });
      loadProductionData();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erreur",
        description: e.message || "Impossible d'ouvrir le semainier.",
        variant: "destructive"
      });
    }
  };

  const handleAddSemainierEntry = async (data: any) => {
    if (!semainier?.id) return;
    try {
      await pedagogyService.addSemainierDailyEntry(semainier.id, {
        date: new Date(data.date).toISOString(),
        observations: data.observations,
        actions: data.actions
      });
      toast({
        title: "Succès",
        description: "L'activité quotidienne a été enregistrée.",
      });
      loadProductionData();
      setModal('none');
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erreur",
        description: e.message || "Impossible d'ajouter l'entrée.",
        variant: "destructive"
      });
    }
  };

  const handleReportSemainierIncident = async (data: any) => {
    if (!semainier?.id) return;
    try {
      await pedagogyService.reportSemainierIncident(semainier.id, {
        date: new Date(data.date).toISOString(),
        type: data.type,
        description: data.description,
        severity: data.severity,
        actions: data.actions
      });
      toast({
        title: "Succès",
        description: "L'incident a été signalé.",
      });
      loadProductionData();
      setModal('none');
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erreur",
        description: e.message || "Impossible de signaler l'incident.",
        variant: "destructive"
      });
    }
  };

  const handleSubmitSemainier = async () => {
    if (!semainier?.id) return;
    try {
      await pedagogyService.submitSemainier(semainier.id);
      toast({
        title: "Succès",
        description: "Le semainier a été soumis pour validation.",
      });
      loadProductionData();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erreur",
        description: e.message || "Impossible de soumettre le semainier.",
        variant: "destructive"
      });
    }
  };

  const activeSubject = assignedSubjects.find(s => s.id === selectedSubjectId);

  const INCIDENT_TYPES = [
    { value: 'ABSENCE', label: 'Absence' },
    { value: 'RETARD', label: 'Retard' },
    { value: 'DISCIPLINE', label: 'Discipline' },
    { value: 'SECURITY', label: 'Sécurité' },
    { value: 'OTHER', label: 'Autre' },
  ];

  const SEVERITY_LEVELS = [
    { value: 'LOW', label: 'Faible' },
    { value: 'MEDIUM', label: 'Moyen' },
    { value: 'HIGH', label: 'Élevé' },
    { value: 'CRITICAL', label: 'Critique' },
  ];

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
            onClick={() => setActiveTab('tests')}
            className={cn("px-8 py-5 text-xs font-black uppercase tracking-widest border-b-2 transition-all", activeTab === 'tests' ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-gray-400 hover:text-gray-600")}
          >
            Cahier de Test
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
          <button
            onClick={() => setActiveTab('students')}
            className={cn("px-6 py-5 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap", activeTab === 'students' ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-gray-400 hover:text-gray-600")}
          >
            Mes Élèves
          </button>

          <div className="ml-auto flex items-center px-6 gap-2 shrink-0">
             {isOffline && (
               <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-black uppercase mr-2 border border-amber-100">
                 <AlertTriangle className="w-3 h-3" /> Hors ligne
               </span>
             )}
             <button 
              onClick={() => {
                if (activeTab === 'diaries') setModal('create-diary');
                else if (activeTab === 'lessons') setModal('create-lesson');
                else if (activeTab === 'journal') setModal('create-journal');
                else if (activeTab === 'tests') setModal('create-test');
                else if (activeTab === 'weekly') setModal('create-weekly-entry');
              }}
              className={cn(
                "flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl text-xs font-black hover:scale-105 transition-all shadow-md shadow-indigo-100",
                activeTab === 'dashboard' || activeTab === 'progress' || activeTab === 'feedback' ? "hidden" : ""
              )}
             >
                <Plus className="w-4 h-4" />
                {activeTab === 'weekly' ? 'AJOUTER RAPPORT' : 'NOUVELLE ENTRÉE'}
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
                          <span className="text-xs font-bold uppercase">Assistant Sarah AI</span>
                       </div>
                       <p className="text-sm font-medium leading-relaxed mb-4">Générez vos fiches pédagogiques en un clic ou demandez une correction automatique selon les retours de la direction.</p>
                       <button className="w-full py-2 bg-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-500 transition-colors">Ouvrir Sarah AI</button>
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
                               <EntitySyncIndicator variant="dot" status={diarySyncStatuses[d.id] ?? 'UNKNOWN'} />
                               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 transition-all"><Edit3 className="w-4 h-4" /></button>
                                  <button className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 transition-all"><MessageSquare className="w-4 h-4" /></button>
                               </div>
                            </div>
                            <p className="text-gray-600 text-sm leading-relaxed">{d.notes}</p>
                            
                            {d.homework && (
                              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-50">
                                 <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1 flex items-center gap-2">
                                   <Clock className="w-3 h-3" /> Devoir
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
                             <EntitySyncIndicator variant="dot" status={lessonSyncStatuses[l.id] ?? 'UNKNOWN'} />
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
                    <p className="text-xs font-bold text-gray-400">Planifications hebdomadaires</p>
                 </div>

                 <div className="space-y-4">
                     {journals.length === 0 ? (
                       <div className="py-20 text-center bg-white rounded-3xl border border-gray-100 border-dashed">
                          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                          <p className="text-gray-400 font-bold">Le cahier journal est vide pour cette semaine.</p>
                       </div>
                     ) : (
                       journals.map((j: any) => (
                         <div key={j.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                           <div className="flex items-center justify-between mb-2">
                             <div className="flex items-center gap-3">
                               <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                 {new Date(j.weekStartDate).toLocaleDateString('fr-FR')}
                               </span>
                               <h4 className="font-bold text-gray-900">{j.title || 'Planification'}</h4>
                             </div>
                             <span className="text-xs font-bold text-gray-400">{j.status}</span>
                           </div>
                           <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{j.content}</p>
                         </div>
                       ))
                     )}
                 </div>
              </div>
           )}

           {activeTab === 'tests' && (
              <div className="max-w-4xl mx-auto space-y-6">
                 <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Cahier de Test & Devoirs</h3>
                    <p className="text-xs font-bold text-gray-400">Évaluations et contrôles</p>
                 </div>

                 <div className="space-y-4">
                     {tests.length === 0 ? (
                       <div className="py-20 text-center bg-white rounded-3xl border border-gray-100 border-dashed">
                          <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                          <p className="text-gray-400 font-bold">Aucune évaluation enregistrée pour cette classe.</p>
                       </div>
                     ) : (
                       tests.map((t: any) => (
                         <div key={t.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                           <div>
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase">
                                 {t.examType}
                               </span>
                               <h4 className="font-bold text-gray-900">{t.name}</h4>
                             </div>
                             <p className="text-xs text-gray-500 mt-1">
                               Date : {new Date(t.examDate).toLocaleDateString('fr-FR')} • Coefficient : {t.coefficient} • Note Max : {t.maxScore}
                             </p>
                             {t.description && <p className="text-xs text-gray-400 mt-2 italic">{t.description}</p>}
                           </div>
                           <span className="px-3 py-1 bg-gray-50 rounded-xl text-xs font-bold text-gray-600">
                             {t.grades?.length > 0 ? `${t.grades.length} Notes saisies` : 'Non saisi'}
                           </span>
                           <EntitySyncIndicator variant="dot" status={diarySyncStatuses[t.id] ?? 'UNKNOWN'} />
                         </div>
                       ))
                     )}
                 </div>
              </div>
           )}

           {activeTab === 'weekly' && (
              <div className="max-w-4xl mx-auto space-y-6">
                 {!weeklyAssignment ? (
                    <div className="py-20 text-center bg-white rounded-3xl border border-gray-100 border-dashed">
                       <CalendarIcon className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                       <p className="text-gray-400 font-bold">Vous n'êtes pas désigné(e) semainier cette semaine.</p>
                    </div>
                 ) : (
                    <div className="space-y-6">
                      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between flex-wrap gap-4">
                        <div>
                          <h4 className="font-bold text-gray-900">
                             Semaine {weeklyAssignment.weekNumber} — {new Date(weeklyAssignment.weekStartDate).toLocaleDateString('fr-FR')} au {new Date(weeklyAssignment.weekEndDate).toLocaleDateString('fr-FR')}
                          </h4>
                          <p className="text-xs text-gray-400 mt-1">
                             Semainier : {weeklyAssignment.teacher?.lastName} {weeklyAssignment.teacher?.firstName}
                          </p>
                          {semainier && (
                            <span className={cn(
                              "inline-block mt-2 px-2.5 py-1 text-[10px] font-black uppercase rounded-lg",
                              semainier.status === 'VALIDATED' ? "bg-emerald-100 text-emerald-600" :
                              semainier.status === 'SOUMIS' ? "bg-indigo-100 text-indigo-600" : "bg-amber-100 text-amber-600"
                            )}>
                              {semainier.status}
                            </span>
                          )}
                        </div>
                        
                        {!semainier ? (
                          <button
                            onClick={handleCreateSemainier}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-5 py-2.5 rounded-2xl shadow-md transition-all"
                          >
                            Ouvrir le semainier
                          </button>
                        ) : semainier.status === 'EN_COURS' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setModal('create-weekly-entry')}
                              className="bg-indigo-50 text-indigo-600 text-xs font-black px-4 py-2 rounded-xl"
                            >
                              Rapport Journalier
                            </button>
                            <button
                              onClick={() => setModal('report-weekly-incident')}
                              className="bg-rose-50 text-rose-600 text-xs font-black px-4 py-2 rounded-xl"
                            >
                              Signaler un Incident
                            </button>
                            <button
                              onClick={handleSubmitSemainier}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs font-black px-5 py-2.5 rounded-2xl shadow-md"
                            >
                              Soumettre
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {semainier && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                            <h5 className="font-bold text-gray-900 mb-4">Rapports Quotidiens</h5>
                            <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px]">
                              {!semainier.dailyEntries || semainier.dailyEntries.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">Aucune entrée quotidienne enregistrée.</p>
                              ) : (
                                semainier.dailyEntries.map((e: any) => (
                                  <div key={e.id} className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                    <p className="text-[10px] font-black text-indigo-600 uppercase">
                                      {new Date(e.date).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
                                    </p>
                                    <p className="text-xs text-gray-700 mt-1 font-semibold">{e.observations}</p>
                                    {e.actions && <p className="text-[10px] text-gray-400 mt-0.5"><span className="font-bold">Actions:</span> {e.actions}</p>}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col">
                            <h5 className="font-bold text-gray-900 mb-4">Incidents Signalés</h5>
                            <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px]">
                              {!semainier.incidents || semainier.incidents.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">Aucun incident signalé cette semaine.</p>
                              ) : (
                                semainier.incidents.map((inc: any) => (
                                  <div key={inc.id} className="p-3 bg-rose-50/50 rounded-2xl border border-rose-100">
                                    <div className="flex justify-between items-center">
                                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-black uppercase">
                                        {inc.type}
                                      </span>
                                      <span className="text-[9px] text-gray-400">
                                        {new Date(inc.date).toLocaleDateString('fr-FR')}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-700 mt-1 font-semibold">{inc.description}</p>
                                    {inc.actions && <p className="text-[10px] text-gray-400 mt-0.5"><span className="font-bold">Actions:</span> {inc.actions}</p>}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                 )}
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
                             <button className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition-colors">Demander aide à Sarah AI</button>
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

           {/* ── Students tab ── */}
           {activeTab === 'students' && (
              <StudentsOfClassView />
           )}
        </div>
      </div>

      {/* MODALS */}
      <FormModal
        isOpen={modal === 'create-diary'}
        onClose={() => setModal('none')}
        title="Nouvelle entrée — Cahier de Textes"
        onSave={handleCreateDiary}
        fields={[
          {
            name: 'date',
            label: 'Date',
            type: 'date',
            required: true,
            defaultValue: new Date().toISOString().split('T')[0]
          },
          {
            name: 'notes',
            label: 'Résumé du cours',
            type: 'textarea',
            required: true,
            placeholder: 'Décrivez ce qui a été fait pendant la séance...'
          },
          {
            name: 'homework',
            label: 'Devoirs de maison',
            type: 'textarea',
            placeholder: 'Devoirs ou exercices à faire pour la prochaine séance...'
          }
        ]}
      />

      <FormModal
        isOpen={modal === 'create-lesson'}
        onClose={() => setModal('none')}
        title="Nouvelle Fiche Pédagogique"
        onSave={handleCreateLesson}
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
             label: 'Assistance Sarah AI',
             type: 'custom',
             render: () => (
               <div className="p-4 bg-indigo-900 rounded-2xl text-white mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-300" />
                    <div>
                      <p className="text-xs font-bold">Sarah AI Assistant</p>
                      <p className="text-[10px] text-indigo-300">Générer une structure de cours basée sur le titre</p>
                    </div>
                  </div>
                  <button type="button" className="bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-xl text-[10px] font-black transition-all">
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

      <FormModal
        isOpen={modal === 'create-journal'}
        onClose={() => setModal('none')}
        title="Planification — Cahier Journal"
        onSave={handleCreateJournal}
        fields={[
          {
            name: 'date',
            label: 'Date prévue',
            type: 'date',
            required: true,
            defaultValue: new Date().toISOString().split('T')[0]
          },
          {
            name: 'title',
            label: 'Objectif de la séance',
            type: 'text',
            required: true,
            placeholder: 'Ex: Résoudre des équations du second degré'
          },
          {
            name: 'content',
            label: 'Activités prévues',
            type: 'textarea',
            required: true,
            placeholder: 'Détaillez le déroulement prévu...'
          }
        ]}
      />

      <FormModal
        isOpen={modal === 'create-test'}
        onClose={() => setModal('none')}
        title="Nouvelle Évaluation — Cahier de Test"
        onSave={handleCreateTest}
        fields={[
          {
            name: 'name',
            label: 'Nom de l\'évaluation',
            type: 'text',
            required: true,
            placeholder: 'Ex: Devoir de Contrôle N°1'
          },
          {
            name: 'examType',
            label: 'Type d\'évaluation',
            type: 'select',
            required: true,
            options: [
              { value: 'DEVOIR', label: 'Devoir' },
              { value: 'COMPOSITION', label: 'Composition' },
              { value: 'INTERROGATION', label: 'Interrogation' },
              { value: 'DEVOIR_MAISON', label: 'Devoir de maison' }
            ],
            defaultValue: 'DEVOIR'
          },
          {
            name: 'examDate',
            label: 'Date de l\'évaluation',
            type: 'date',
            required: true,
            defaultValue: new Date().toISOString().split('T')[0]
          },
          {
            name: 'coefficient',
            label: 'Coefficient',
            type: 'number',
            required: true,
            defaultValue: '1.0'
          },
          {
            name: 'maxScore',
            label: 'Note Maximale',
            type: 'number',
            required: true,
            defaultValue: '20.0'
          },
          {
            name: 'description',
            label: 'Instructions / Programme',
            type: 'textarea',
            placeholder: 'Chapitres concernés, consignes...'
          }
        ]}
      />

      <FormModal
        isOpen={modal === 'create-weekly-entry'}
        onClose={() => setModal('none')}
        title="Ajouter une entrée journalière — Semainier"
        onSave={handleAddSemainierEntry}
        fields={[
          {
            name: 'date',
            label: 'Date',
            type: 'date',
            required: true,
            defaultValue: new Date().toISOString().split('T')[0]
          },
          {
            name: 'observations',
            label: 'Observations du jour',
            type: 'textarea',
            required: true,
            placeholder: 'Absences notables, météo scolaire, événements...'
          },
          {
            name: 'actions',
            label: 'Actions ou Recommandations',
            type: 'textarea',
            placeholder: 'Mesures prises...'
          }
        ]}
      />

      <FormModal
        isOpen={modal === 'report-weekly-incident'}
        onClose={() => setModal('none')}
        title="Signaler un incident — Semainier"
        onSave={handleReportSemainierIncident}
        fields={[
          {
            name: 'date',
            label: 'Date',
            type: 'date',
            required: true,
            defaultValue: new Date().toISOString().split('T')[0]
          },
          {
            name: 'type',
            label: 'Type d\'incident',
            type: 'select',
            required: true,
            options: INCIDENT_TYPES,
            defaultValue: 'ABSENCE'
          },
          {
            name: 'severity',
            label: 'Gravité',
            type: 'select',
            required: true,
            options: SEVERITY_LEVELS.map(s => ({ value: s.value, label: s.label })),
            defaultValue: 'LOW'
          },
          {
            name: 'description',
            label: 'Description détaillée',
            type: 'textarea',
            required: true,
            placeholder: 'Que s\'est-il passé ?'
          },
          {
            name: 'actions',
            label: 'Actions prises',
            type: 'textarea',
            placeholder: 'Décision prise sur le moment...'
          }
        ]}
      />
    </div>
  );
}

// ─── StudentsOfClassView ──────────────────────────────────────────────────
// Shows the student roster for the teacher's assigned classes.
// Fetches from /api/students?classId=X for each class the teacher teaches.

function StudentsOfClassView() {
  const { academicYear } = useModuleContext();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);

  useEffect(() => {
    if (!user?.id || !academicYear?.id) return;
    (async () => {
      try {
        setLoading(true);
        // Get teacher's assignments to know which classes they teach
        const res = await pedagogyService.getTeacherAssignments(user.id, academicYear.id);
        const list = Array.isArray(res) ? res : [];
        setAssignments(list);
        // Auto-select first class
        if (list.length > 0 && list[0].classSubject?.academicClass) {
          setSelectedClass(list[0].classSubject.academicClass.id);
        }
      } catch (e) {
        console.error('Error loading assignments for students view:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, academicYear?.id]);

  useEffect(() => {
    if (!selectedClass) return;
    (async () => {
      try {
        setStudentsLoading(true);
        // Fetch students enrolled in this class
        const res = await fetch(`/api/students?classId=${selectedClass}`, {
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          setStudents(Array.isArray(data) ? data : (data?.data || []));
        } else {
          setStudents([]);
        }
      } catch (e) {
        setStudents([]);
      } finally {
        setStudentsLoading(false);
      }
    })();
  }, [selectedClass]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Aucune classe assignée</p>
          <p className="text-xs text-slate-400 mt-1">
            Vous n'avez pas encore de classe assignée. Contactez la direction pour une affectation.
          </p>
        </div>
      </div>
    );
  }

  // Extract unique classes from assignments
  const uniqueClasses = Array.from(new Map(
    assignments
      .filter(a => a.classSubject?.academicClass)
      .map(a => [a.classSubject.academicClass.id, a.classSubject.academicClass])
  ).values());

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-gray-900 tracking-tight">Mes Élèves</h3>
        {uniqueClasses.length > 0 && (
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            {uniqueClasses.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {studentsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Aucun élève inscrit dans cette classe.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">#</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Nom</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase hidden sm:table-cell">Genre</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase hidden md:table-cell">Date de naissance</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s: any, i: number) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {s.firstName?.[0]}{s.lastName?.[0]}
                        </div>
                        <span className="font-bold text-slate-900">{s.firstName} {s.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                      {s.gender === 'M' || s.gender === 'MALE' ? 'M' : s.gender === 'F' || s.gender === 'FEMALE' ? 'F' : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <CheckCircle2 className="h-3 w-3" /> Actif
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs text-slate-500">{students.length} élève(s)</span>
          </div>
        </div>
      )}
    </div>
  );
}
