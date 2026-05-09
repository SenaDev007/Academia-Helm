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
  LayoutDashboard
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
  content: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED';
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
  const [activeTab, setActiveTab] = useState<'diaries' | 'lessons' | 'progress'>('diaries');

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
        body: JSON.stringify({
          ...data,
          classSubjectId: selectedSubjectId,
          academicYearId: academicYear.id,
          schoolLevelId: 'ALL' // Should be from class context
        })
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
        <div className="flex border-b border-gray-50 bg-white">
          <button 
            onClick={() => setActiveTab('diaries')}
            className={cn("px-8 py-5 text-xs font-black uppercase tracking-widest border-b-2 transition-all", activeTab === 'diaries' ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-gray-400 hover:text-gray-600")}
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
            onClick={() => setActiveTab('progress')}
            className={cn("px-8 py-5 text-xs font-black uppercase tracking-widest border-b-2 transition-all", activeTab === 'progress' ? "border-indigo-600 text-indigo-600 bg-indigo-50/30" : "border-transparent text-gray-400 hover:text-gray-600")}
          >
            Taux de Progression
          </button>

          <div className="ml-auto flex items-center px-6 gap-2">
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
        </div>
      </div>

      {/* Modal New Diary Entry */}
      <FormModal
        isOpen={modal === 'create-diary'}
        onClose={() => setModal('none')}
        title="Saisie de Séance (Cahier de textes)"
        onSave={handleCreateDiary}
        fields={[
          {
            name: 'date',
            label: 'Date de la séance',
            type: 'date',
            defaultValue: new Date().toISOString().split('T')[0]
          },
          {
            name: 'notes',
            label: 'Résumé du cours',
            type: 'textarea',
            placeholder: 'Décrivez les notions abordées aujourd\'hui...'
          },
          {
            name: 'homework',
            label: 'Travail à faire (Devoirs)',
            type: 'textarea',
            placeholder: 'Exercices, lectures...'
          }
        ]}
      />
    </div>
  );
}
