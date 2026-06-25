'use client';

import { useState, useEffect, useCallback } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ClipboardList,
  Search,
  BookOpen,
  NotebookPen,
  Palette,
  Users,
  CheckCircle2,
  Library,
  BarChart3,
  Plus,
  Filter,
  Calendar,
  MessageSquare,
  Bell,
  ChevronRight,
  Clock,
  MoreVertical,
  ArrowRight,
  AlertTriangle,
  Edit,
  Trash2,
} from 'lucide-react';
import { FormModal } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyService } from '@/services/pedagogy.service';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';

const TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { id: 'homework', label: 'Devoirs & Exercices', icon: ClipboardList },
  { id: 'research', label: 'Recherches & Exposés', icon: Search },
  { id: 'lessons', label: 'Leçons & Récitations', icon: BookOpen },
  { id: 'notebooks', label: 'Cahiers & Copies', icon: NotebookPen },
  { id: 'practical', label: 'Activités pratiques', icon: Palette },
  { id: 'student-followup', label: 'Suivi par élève', icon: Users },
  { id: 'feedback', label: 'Corrections & Retours', icon: CheckCircle2 },
  { id: 'activity-library', label: 'Bibliothèque d\'activités', icon: Library },
  { id: 'stats', label: 'Statistiques & Alertes', icon: BarChart3 },
];

export default function TeacherTasksWorkspace() {
  const confirmDialog = useConfirmDialog();
  const [activeTab, setActiveTab] = useState('dashboard');
  const { academicYear, schoolLevel } = useModuleContext();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  // Modals
  const [modal, setModal] = useState<'none' | 'create-homework' | 'edit-homework'>('none');
  const [selectedHomework, setSelectedHomework] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const [hwData, teachersData, classesData, subjectsData] = await Promise.all([
        pedagogyService.getHomeworkEntries(),
        pedagogyService.getTeachers(),
        pedagogyService.getAcademicClasses(academicYear.id),
        pedagogyService.getSubjects(academicYear.id)
      ]);
      setHomeworks(hwData || []);
      setTeachers(teachersData || []);
      setClasses(classesData || []);
      setSubjects(subjectsData || []);
    } catch (e) {
      console.error("Error loading tasks workspace data:", e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateHomework = async (data: any) => {
    if (!academicYear?.id) return;
    try {
      const selectedClass = classes.find(c => c.id === data.classId);
      const schoolLevelId = selectedClass?.schoolLevelId || schoolLevel?.id || undefined;

      await pedagogyService.createHomeworkEntry({
        ...data,
        academicYearId: academicYear.id,
        ...(schoolLevelId ? { schoolLevelId } : {}),
        dueDate: new Date(data.dueDate).toISOString(),
        maxScore: data.maxScore ? parseFloat(data.maxScore) : undefined
      });
      toast({
        title: "Succès",
        description: "Le devoir a été créé avec succès.",
      });
      loadData();
      setModal('none');
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Impossible de créer le devoir.",
        variant: "destructive"
      });
    }
  };

  const handleEditHomework = async (data: any) => {
    if (!selectedHomework?.id) return;
    try {
      await pedagogyService.updateHomeworkEntry(selectedHomework.id, {
        ...data,
        dueDate: new Date(data.dueDate).toISOString(),
        maxScore: data.maxScore ? parseFloat(data.maxScore) : undefined
      });
      toast({
        title: "Succès",
        description: "Le devoir a été mis à jour avec succès.",
      });
      loadData();
      setModal('none');
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Impossible de mettre à jour le devoir.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteHomework = async (id: string) => {
    const ok = await confirmDialog.danger('Ce devoir sera définitivement supprimé.', 'Supprimer le devoir');
    if (!ok) return;
    try {
      await pedagogyService.deleteHomeworkEntry(id);
      toast({
        title: "Succès",
        description: "Le devoir a été supprimé.",
      });
      loadData();
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Impossible de supprimer le devoir.",
        variant: "destructive"
      });
    }
  };

  return (
    <>
    {confirmDialog.dialog}
    <div className="flex flex-col h-full bg-slate-50/30">
      {/* Top Header & Navigation */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-8 h-8 text-indigo-600" />
              Espace Travaux & Suivi Pédagogique
            </h1>
            <p className="text-slate-500 mt-1">Gérer les devoirs, exposés et le suivi quotidien des élèves</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-all">
              <Filter className="w-4 h-4" />
              Filtres
            </button>
            <button 
              onClick={() => setModal('create-homework')}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-100"
            >
              <Plus className="w-4 h-4" />
              Nouvelle Activité
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="px-8 flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
                  isActive 
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <TasksDashboard homeworks={homeworks} />}
            {activeTab === 'homework' && (
              <HomeworkList 
                homeworks={homeworks} 
                classes={classes} 
                subjects={subjects} 
                onDelete={handleDeleteHomework}
                onEdit={(hw) => {
                  setSelectedHomework(hw);
                  setModal('edit-homework');
                }}
              />
            )}
            {activeTab === 'research' && <ResearchExposes />}
            {activeTab === 'lessons' && <LessonsTracking />}
            {activeTab === 'notebooks' && <NotebooksCopies />}
            {activeTab === 'practical' && <PracticalActivities />}
            {activeTab === 'student-followup' && <StudentEngagementFollowup />}
            {activeTab === 'feedback' && <CorrectionsFeedback />}
            {activeTab === 'activity-library' && <ActivityLibrary />}
            {activeTab === 'stats' && <StatsAlerts />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modal New Homework */}
      <FormModal
        isOpen={modal === 'create-homework'}
        onClose={() => setModal('none')}
        title="Créer un Devoir / Exercice"
        onSave={handleCreateHomework}
        fields={[
          { name: 'title', label: 'Titre du devoir', type: 'text', placeholder: 'Ex: Calcul des fractions' },
          { name: 'description', label: 'Consigne / Description', type: 'textarea', placeholder: 'Ex: Faire les exercices 4 et 5 page 42' },
          { 
            name: 'classId', 
            label: 'Classe', 
            type: 'select', 
            options: classes.map(c => ({ value: c.id, label: c.name })) 
          },
          { 
            name: 'subjectId', 
            label: 'Matière', 
            type: 'select', 
            options: subjects.map(s => ({ value: s.id, label: s.name })) 
          },
          { name: 'dueDate', label: 'Date d\'échéance', type: 'date' },
          { name: 'maxScore', label: 'Note maximale (Optionnel)', type: 'number', placeholder: 'Ex: 20' }
        ]}
      />

      {/* Modal Edit Homework */}
      <FormModal
        isOpen={modal === 'edit-homework'}
        onClose={() => setModal('none')}
        title="Modifier le Devoir / Exercice"
        initialData={selectedHomework ? {
          ...selectedHomework,
          dueDate: selectedHomework.dueDate ? selectedHomework.dueDate.split('T')[0] : ''
        } : null}
        onSave={handleEditHomework}
        fields={[
          { name: 'title', label: 'Titre du devoir', type: 'text', placeholder: 'Ex: Calcul des fractions' },
          { name: 'description', label: 'Consigne / Description', type: 'textarea', placeholder: 'Ex: Faire les exercices 4 et 5 page 42' },
          { 
            name: 'classId', 
            label: 'Classe', 
            type: 'select', 
            options: classes.map(c => ({ value: c.id, label: c.name })) 
          },
          { 
            name: 'subjectId', 
            label: 'Matière', 
            type: 'select', 
            options: subjects.map(s => ({ value: s.id, label: s.name })) 
          },
          { name: 'dueDate', label: 'Date d\'échéance', type: 'date' },
          { name: 'maxScore', label: 'Note maximale (Optionnel)', type: 'number', placeholder: 'Ex: 20' }
        ]}
      />
    </div>
    </>
  );
}

interface TasksDashboardProps {
  homeworks?: any[];
}

function TasksDashboard({ homeworks }: TasksDashboardProps) {
  return (
    <div className="space-y-8">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Devoirs en cours', value: '12', icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Non rendus', value: '24', icon: Bell, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'À corriger', value: '45', icon: NotebookPen, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Récitations faites', value: '180', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat, i) => (
          <div key={i} className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className={`p-2.5 w-10 h-10 rounded-xl mb-3 flex items-center justify-center ${stat.bg} ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activities */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Activités Récentes</h3>
              <button className="text-indigo-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all">
                Voir tout <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {(!homeworks || homeworks.length === 0) ? (
                <div className="p-10 flex flex-col items-center justify-center text-center gap-3">
                  <ClipboardList className="w-8 h-8 text-slate-200" />
                  <p className="text-sm font-bold text-slate-400">Aucune activité récente</p>
                  <p className="text-xs text-slate-300">Les devoirs et exercices créés apparaîtront ici</p>
                </div>
              ) : (
                homeworks.slice(0, 5).map((hw: any, i: number) => (
                  <div key={hw.id ?? i} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-slate-50 rounded-xl">
                        <ClipboardList className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-600 uppercase">{hw.subjectId || 'Matière'}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-md font-bold uppercase">Devoir</span>
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm">{hw.title}</h4>
                        <p className="text-xs text-slate-500">{hw.classId || ''}{hw.dueDate ? ` • ${new Date(hw.dueDate).toLocaleDateString()}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700">
                        En cours
                      </span>
                      <button className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-indigo-900 rounded-3xl shadow-xl text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Bell className="w-24 h-24" />
               </div>
               <h3 className="font-bold mb-2">Suivi Parent</h3>
               <p className="text-xs text-indigo-200 mb-6">45 parents ont acquitté la réception du dernier devoir.</p>
               <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2">
                 Détails des notifications <ArrowRight className="w-3 h-3" />
               </button>
            </div>
            <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
               <h3 className="font-bold text-slate-900 mb-2">Alertes Pédagogiques</h3>
               <div className="space-y-3 mt-4">
                 <div className="flex items-center gap-3 p-2 bg-rose-50 rounded-xl border border-rose-100">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-rose-700">3 élèves n'ont pas copié la leçon.</span>
                 </div>
                 <div className="flex items-center gap-3 p-2 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                    <span className="text-xs font-bold text-amber-700">Récitation non faite par 2 élèves.</span>
                 </div>
               </div>
            </div>
          </div>
        </div>

        {/* Calendar / Deadlines Sidebar */}
        <div className="space-y-6">
          <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              Échéances à venir
            </h3>
            <div className="space-y-6">
              {[
                { day: 'Lun', date: '15', title: 'Exposé Bio', time: '08:00' },
                { day: 'Mar', date: '16', title: 'Devoir Maths', time: '10:30' },
                { day: 'Jeu', date: '18', title: 'Récitation', time: '14:00' },
              ].map((item, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{item.day}</span>
                    <span className="text-lg font-black text-slate-900">{item.date}</span>
                  </div>
                  <div className="flex-1 p-3 bg-slate-50 rounded-2xl">
                    <h4 className="font-bold text-slate-900 text-xs">{item.title}</h4>
                    <p className="text-[10px] text-slate-500">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl">
             <div className="flex items-center gap-2 text-emerald-700 mb-3">
               <MessageSquare className="w-4 h-4" />
               <span className="text-xs font-bold uppercase">Sarah AI Assist</span>
             </div>
             <p className="text-xs text-emerald-600 leading-relaxed mb-4 italic">
               &quot;Voulez-vous que je génère 5 exercices de calcul de fractions adaptés pour le groupe de remédiation ?&quot;
             </p>
             <button className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-900/20">
               Générer les exercices
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HomeworkListProps {
  homeworks: any[];
  classes: any[];
  subjects: any[];
  onDelete: (id: string) => Promise<void>;
  onEdit: (hw: any) => void;
}

function HomeworkList({ homeworks, classes, subjects, onDelete, onEdit }: HomeworkListProps) {
  const getClassLabel = (classId: string) => classes.find(c => c.id === classId)?.name || classId;
  const getSubjectLabel = (subjectId: string) => subjects.find(s => s.id === subjectId)?.name || subjectId;

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-50 flex items-center justify-between">
        <h3 className="font-bold text-slate-900 text-lg">Gestion des Devoirs & Exercices</h3>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Rechercher..." className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm w-64" />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <th className="px-6 py-4">Titre & Description</th>
            <th className="px-6 py-4">Matière</th>
            <th className="px-6 py-4">Classe</th>
            <th className="px-6 py-4">Échéance</th>
            <th className="px-6 py-4">Points Max</th>
            <th className="px-6 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {homeworks.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-sm">
                Aucun devoir enregistré.
              </td>
            </tr>
          ) : (
            homeworks.map((hw) => (
              <tr key={hw.id} className="hover:bg-slate-50/30 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <ClipboardList className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{hw.title}</h4>
                      <p className="text-xs text-slate-400 max-w-xs truncate">{hw.description || 'Pas de description'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-700">{getSubjectLabel(hw.subjectId)}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{getClassLabel(hw.classId)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-600">{hw.dueDate ? new Date(hw.dueDate).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{hw.maxScore || 'Non noté'}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => onEdit(hw)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors animate-none"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDelete(hw.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors animate-none"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function LessonsTracking() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            Suivi des Récitations
          </h3>
          <div className="space-y-3">
             {[
               { name: 'KOFFI Aya', topic: 'Table de 7', status: 'SUCCESS' },
               { name: 'SOSSOU Marc', topic: 'Poésie : Demain dès l\'aube', status: 'PENDING' },
               { name: 'ADJOVI Luc', topic: 'Verbes du 2ème groupe', status: 'FAILED' },
             ].map((r, i) => (
               <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                 <div>
                   <p className="text-sm font-bold text-slate-800">{r.name}</p>
                   <p className="text-[10px] text-slate-500">{r.topic}</p>
                 </div>
                 <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                   r.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : r.status === 'FAILED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                 }`}>
                   {r.status}
                 </span>
               </div>
             ))}
          </div>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <NotebookPen className="w-5 h-5 text-blue-500" />
            Leçons à Recopier
          </h3>
          <div className="space-y-3">
             {[
               { name: 'TOURE Amina', lesson: 'Géographie : Le climat', state: 'COPIED' },
               { name: 'GOMEZ Pierre', lesson: 'Géographie : Le climat', state: 'PARTIAL' },
               { name: 'IDRISSOU Ali', lesson: 'Géographie : Le climat', state: 'NOT_COPIED' },
             ].map((l, i) => (
               <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                 <div>
                   <p className="text-sm font-bold text-slate-800">{l.name}</p>
                   <p className="text-[10px] text-slate-500">{l.lesson}</p>
                 </div>
                 <div className="flex gap-1">
                    {[1, 2, 3].map((step) => (
                      <div key={step} className={`w-3 h-3 rounded-full ${
                        l.state === 'COPIED' ? 'bg-emerald-500' : l.state === 'PARTIAL' && step < 3 ? 'bg-amber-500' : 'bg-slate-200'
                      }`} />
                    ))}
                 </div>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentEngagementFollowup() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-50">
        <h3 className="font-bold text-slate-900">Engagement Pédagogique par Élève</h3>
      </div>
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <th className="px-6 py-4">Élève</th>
            <th className="px-6 py-4">Devoirs Faits</th>
            <th className="px-6 py-4">Participation</th>
            <th className="px-6 py-4">Score ORION</th>
            <th className="px-6 py-4 text-right">Alerte Parent</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {[
            { name: 'ADJOVI Jean', done: '10/12', participation: '85%', score: 88 },
            { name: 'BOKO Marie', done: '12/12', participation: '95%', score: 96 },
            { name: 'DOSSOU Paul', done: '5/12', participation: '40%', score: 42 },
          ].map((s, i) => (
            <tr key={i} className="hover:bg-slate-50/30 transition-colors">
              <td className="px-6 py-4 text-sm font-bold text-slate-900">{s.name}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{s.done}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{s.participation}</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full max-w-[60px]">
                    <div className={`h-full rounded-full ${s.score < 50 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${s.score}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-700">{s.score}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <button className={`px-3 py-1 rounded-lg text-[10px] font-bold ${
                  s.score < 50 ? 'bg-rose-600 text-white shadow-lg shadow-rose-200' : 'bg-slate-100 text-slate-500'
                }`}>
                  {s.score < 50 ? 'Notifier Parent' : 'R.A.S'}
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

function ResearchExposes() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
       <h3 className="font-bold text-slate-900 text-lg mb-6">Gestion des Recherches & Exposés</h3>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
             <div key={i} className="p-5 border border-slate-100 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-xs font-bold text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded">Exposé de Groupe</span>
                   <span className="text-xs text-slate-400"><Clock className="w-3 h-3 inline mr-1"/> 22 Mai 2025</span>
                </div>
                <h4 className="font-bold text-slate-900 mb-1">Les sources d'énergie renouvelable</h4>
                <p className="text-xs text-slate-500 mb-4">SVT • 3ème B</p>
                <div className="flex justify-between items-center text-sm border-t border-slate-50 pt-3">
                   <span className="text-amber-600 font-bold">À présenter en classe</span>
                   <button className="text-indigo-600 hover:underline text-xs font-bold">Évaluer (3/5 groupes passés)</button>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
}

function NotebooksCopies() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
       <h3 className="font-bold text-slate-900 text-lg mb-6 flex items-center gap-2">
         <NotebookPen className="w-5 h-5 text-blue-500" />
         Contrôle des Cahiers & Copies
       </h3>
       <div className="space-y-4">
          {[
            { student: 'DOSSOU Paul', comment: 'Cahier très bien tenu.', status: 'Validé', color: 'text-emerald-600 bg-emerald-50' },
            { student: 'KOFFI Aya', comment: 'Leçons 3 et 4 manquantes.', status: 'À reprendre', color: 'text-amber-600 bg-amber-50' },
            { student: 'SOSSOU Marc', comment: 'Non présenté.', status: 'Alerte', color: 'text-rose-600 bg-rose-50' }
          ].map((c, i) => (
             <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                <div>
                   <p className="font-bold text-slate-900 text-sm">{c.student}</p>
                   <p className="text-xs text-slate-500">{c.comment}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${c.color}`}>{c.status}</span>
             </div>
          ))}
       </div>
    </div>
  );
}

function PracticalActivities() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 text-center">
       <Palette className="w-12 h-12 text-slate-300 mx-auto mb-4" />
       <h3 className="font-bold text-slate-900 text-lg mb-2">Activités Pratiques (Arts, TP, Sport)</h3>
       <p className="text-slate-500 text-sm mb-6">Suivez les projets créatifs, les expériences scientifiques ou les évaluations sportives.</p>
       <button className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
         + Créer un projet pratique
       </button>
    </div>
  );
}

function CorrectionsFeedback() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
       <h3 className="font-bold text-slate-900 text-lg mb-6">Corrections & Retours Automatisés</h3>
       <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
       <table className="w-full text-left">
          <thead>
             <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100">
                <th className="pb-3">Activité</th>
                <th className="pb-3">Élève</th>
                <th className="pb-3">Note / Appréciation</th>
                <th className="pb-3 text-right">Action</th>
             </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
             {[1,2,3].map((i) => (
                <tr key={i}>
                   <td className="py-4 text-sm font-bold text-slate-900">Devoir Histoire</td>
                   <td className="py-4 text-sm text-slate-600">Élève {i}</td>
                   <td className="py-4"><span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded">15/20</span></td>
                   <td className="py-4 text-right">
                      <button className="text-indigo-600 text-xs font-bold hover:underline">Modifier</button>
                   </td>
                </tr>
             ))}
          </tbody>
       </table>
       </div>
    </div>
  );
}

function ActivityLibrary() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
       <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-900 text-lg">Bibliothèque de Modèles</h3>
          <button className="text-sm text-indigo-600 font-bold bg-indigo-50 px-3 py-1.5 rounded-lg">+ Importer Modèle</button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['Modèle d\'Exposé', 'Fiche Exercice (Maths)', 'Grille Évaluation (Oral)'].map((l, i) => (
             <div key={i} className="p-4 border border-slate-100 rounded-xl hover:border-indigo-300 transition-colors cursor-pointer group">
                <Library className="w-6 h-6 text-slate-400 mb-3 group-hover:text-indigo-500" />
                <h4 className="font-bold text-sm text-slate-900">{l}</h4>
                <p className="text-[10px] text-slate-400 mt-1">Utilisé 4 fois</p>
             </div>
          ))}
       </div>
    </div>
  );
}

function StatsAlerts() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
       <h3 className="font-bold text-slate-900 text-lg mb-6">Statistiques d'Engagement & Alertes ORION</h3>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
             <p className="text-xs font-bold text-slate-500 uppercase mb-2">Taux Global de Réalisation</p>
             <h4 className="text-3xl font-black text-emerald-600">82%</h4>
             <p className="text-xs text-slate-400 mt-1">+2% depuis le mois dernier</p>
          </div>
          <div className="p-5 bg-rose-50 rounded-2xl border border-rose-100">
             <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <p className="text-xs font-bold text-rose-700 uppercase">Alertes de Décrochage</p>
             </div>
             <p className="text-sm font-bold text-rose-900 mb-1">3 élèves sous les 40% de rendus.</p>
             <button className="text-xs text-rose-600 font-bold underline">Convoquer les parents</button>
          </div>
       </div>
    </div>
  );
}
