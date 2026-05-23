/**
 * ============================================================================
 * ASSIGNMENTS WORKSPACE - MODULE 2 (Affectations & Charges)
 * ============================================================================
 * 
 * Gestion des affectations enseignants ↔ classes :
 * 1. Attribution des matières aux enseignants par classe
 * 2. Contrôle de la charge horaire effective
 * 3. Vérification des habilitations (matières qualifiées)
 * 4. Gestion des conflits de disponibilité
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Plus,
  X,
  BookOpen,
  Layers,
  ChevronRight,
  Filter,
  BarChart3,
  UserCheck,
  UserPlus,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FormModal, 
  ConfirmModal 
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { pedagogyService } from '@/services/pedagogy.service';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// --- Types ---

interface AcademicClass {
  id: string;
  name: string;
  level?: { id: string; name: string };
  series?: { id: string; name: string };
}

interface ClassSubject {
  id: string;
  weeklyHours: number;
  coefficient: number;
  subject: { id: string; name: string; code: string };
  assignments: any[];
}

interface TeacherProfile {
  id: string;
  teacherId: string;
  maxWeeklyHours: number;
  teacher: { id: string; firstName: string; lastName: string; matricule: string };
  subjectQualifications: { subjectId: string }[];
  levelAuthorizations: { levelId: string }[];
  availabilities: any[];
}

export default function AssignmentsWorkspace() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Data
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  
  // Selection
  const [activeSubject, setActiveSubject] = useState<ClassSubject | null>(null);
  const [search, setSearch] = useState('');

  // Modals
  const [modal, setModal] = useState<'none' | 'assign-teacher'>('none');

  // --- Loaders ---

  const loadInitialData = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const [classesData, teachersData] = await Promise.all([
        pedagogyService.getAcademicClasses(academicYear.id),
        pedagogyService.getTeacherProfiles(academicYear.id)
      ]);
      setClasses(classesData || []);
      setTeachers(teachersData || []);
      if (classesData && classesData.length > 0) setSelectedClassId(classesData[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  const loadClassSubjects = useCallback(async () => {
    if (!selectedClassId || !academicYear?.id) return;
    try {
      const data = await pedagogyService.getClassSubjects(selectedClassId, academicYear.id);
      setClassSubjects(data || []);
    } catch (e) {
      console.error(e);
    }
  }, [selectedClassId, academicYear?.id]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);
  useEffect(() => { loadClassSubjects(); }, [loadClassSubjects]);

  // --- Actions ---

  const handleAssignTeacher = async (teacherId: string) => {
    if (!activeSubject || !academicYear?.id) return;
    try {
      await pedagogyService.createTeacherAssignment({
        academicYearId: academicYear.id,
        teacherId,
        classSubjectId: activeSubject.id
      });
      loadClassSubjects();
      setModal('none');
      toast({
        title: "Succès",
        description: "Enseignant affecté avec succès.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Impossible d'affecter l'enseignant.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await pedagogyService.deleteTeacherAssignment(assignmentId);
      loadClassSubjects();
      toast({
        title: "Succès",
        description: "Affectation retirée avec succès.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e.message || "Impossible de retirer l'affectation.",
        variant: "destructive"
      });
    }
  };

  // --- Helpers ---

  const getTeacherLoad = (teacherId: string) => {
    // Calculer la charge totale réelle pour ce prof dans toutes les classes
    // Note: Pour un vrai dashboard, il faudrait une vue globale du backend
    // Ici on simule avec les données locales (ce qui n'est pas suffisant si on ne charge pas tout)
    // TODO: Utiliser un endpoint de statistiques backend
    return 0; 
  };

  const isQualified = (teacher: TeacherProfile, subjectId: string) => {
    return teacher.subjectQualifications.some(q => q.subjectId === subjectId);
  };

  const isAuthorized = (teacher: TeacherProfile, levelId?: string) => {
    if (!levelId) return true;
    if (teacher.levelAuthorizations.length === 0) return true;
    return teacher.levelAuthorizations.some(a => a.levelId === levelId);
  };

  const selectedClass = classes.find(c => c.id === selectedClassId);

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-6 overflow-hidden">
      {/* Liste des Classes (Gauche) */}
      <div className="w-1/4 bg-white rounded-3xl border border-gray-100 flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-50">
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Classes
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {classes.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedClassId(c.id)}
              className={cn(
                "w-full text-left p-4 rounded-2xl transition-all group",
                selectedClassId === c.id ? "bg-indigo-50 border-indigo-100" : "hover:bg-gray-50 border-transparent"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn("font-bold text-sm", selectedClassId === c.id ? "text-indigo-900" : "text-gray-900")}>
                    {c.name}
                  </p>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {c.level?.name || 'Niveau indéfini'}
                  </p>
                </div>
                <ChevronRight className={cn("w-4 h-4 transition-transform", selectedClassId === c.id ? "text-indigo-600 translate-x-1" : "text-gray-300")} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Grille d'affectation (Centre) */}
      <div className="flex-1 bg-white rounded-3xl border border-gray-100 flex flex-col shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-gray-900">
              Affectations : {selectedClass?.name}
            </h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
              Configuration des binômes Enseignants ↔ Matières
            </p>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
             <div className="text-center">
                <p className="text-[8px] font-black text-gray-400 uppercase">Progression</p>
                <p className="text-sm font-black text-indigo-600">
                  {classSubjects.filter(cs => cs.assignments.length > 0).length} / {classSubjects.length}
                </p>
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {classSubjects.map(cs => {
              const assigned = cs.assignments[0]?.teacher;
              
              return (
                <div 
                  key={cs.id}
                  className={cn(
                    "p-5 rounded-3xl border transition-all flex flex-col gap-4",
                    assigned ? "bg-white border-indigo-100 shadow-md shadow-indigo-50" : "bg-gray-50/50 border-dashed border-gray-200"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center font-black text-xs text-indigo-600">
                        {cs.subject.code}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{cs.subject.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                           <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                             <Clock className="w-3 h-3" /> {cs.weeklyHours}h/sem
                           </span>
                        </div>
                      </div>
                    </div>
                    {assigned && (
                      <button 
                        onClick={() => handleRemoveAssignment(cs.assignments[0].id)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-2">
                    {assigned ? (
                      <div className="flex items-center gap-3 p-3 bg-indigo-50/50 rounded-2xl border border-indigo-50">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-[10px] font-black">
                          {assigned.firstName[0]}{assigned.lastName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-indigo-900 truncate">
                            {assigned.lastName} {assigned.firstName}
                          </p>
                          <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">
                            Enseignant Affecté
                          </p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveSubject(cs);
                          setModal('assign-teacher');
                        }}
                        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all text-xs font-black uppercase tracking-widest"
                      >
                        <UserPlus className="w-4 h-4" />
                        Affecter un enseignant
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal Affectation */}
      <FormModal
        isOpen={modal === 'assign-teacher'}
        onClose={() => setModal('none')}
        title="Assistant d'affectation"
        size="lg"
      >
        <div className="space-y-6">
          <div className="p-4 bg-indigo-50 rounded-2xl flex items-center gap-4">
             <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-black text-indigo-600 shadow-sm">
                {activeSubject?.subject.code}
             </div>
             <div>
                <p className="text-sm font-black text-indigo-900">{activeSubject?.subject.name}</p>
                <p className="text-xs text-indigo-500 font-bold uppercase tracking-widest">Charge : {activeSubject?.weeklyHours}h hebdomadaires</p>
             </div>
          </div>

          <div className="space-y-3">
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Chercher par nom ou habilitation..."
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
             </div>

             <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto pr-2">
                {teachers
                  .filter(t => 
                    `${t.teacher.firstName} ${t.teacher.lastName}`.toLowerCase().includes(search.toLowerCase())
                  )
                  .map(t => {
                    const qualified = isQualified(t, activeSubject?.subject.id || '');
                    const authorized = isAuthorized(t, selectedClass?.level?.id);
                    
                    return (
                      <button
                        key={t.id}
                        disabled={!qualified || !authorized}
                        onClick={() => handleAssignTeacher(t.teacherId)}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                          qualified && authorized 
                            ? "bg-white border-gray-100 hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-50" 
                            : "bg-gray-50 border-transparent opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div className="flex items-center gap-4">
                           <div className={cn(
                             "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs",
                             qualified && authorized ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-400"
                           )}>
                              {t.teacher.firstName[0]}{t.teacher.lastName[0]}
                           </div>
                           <div>
                              <p className="font-bold text-gray-900 text-sm">{t.teacher.lastName} {t.teacher.firstName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                 <span className={cn(
                                   "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                                   qualified ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                 )}>
                                   {qualified ? 'Habilité' : 'Non Habilité'}
                                 </span>
                                 <div className="w-1 h-1 rounded-full bg-gray-300" />
                                 <span className="text-[8px] font-bold text-gray-400 uppercase">Capacité : {t.maxWeeklyHours}h</span>
                              </div>
                           </div>
                        </div>
                        <UserPlus className="w-5 h-5 text-indigo-300 group-hover:text-indigo-600" />
                      </button>
                    );
                  })
                }
             </div>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
