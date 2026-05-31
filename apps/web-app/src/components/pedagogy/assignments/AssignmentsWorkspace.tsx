/**
 * ============================================================================
 * ASSIGNMENTS WORKSPACE - MODULE 2 (Affectations & Charges)
 * ============================================================================
 *
 * Gestion des affectations enseignants ↔ classes :
 *
 * ► MATERNELLE / PRIMAIRE : Modèle "Titulaire Unique"
 *   - 1 seul enseignant titulaire par classe qui gère TOUTES les matières
 *   - Affecter le titulaire = assigner toutes les classSubjects au même prof
 *
 * ► SECONDAIRE (6e→Terminale, toutes séries) : Modèle "Spécialiste"
 *   - 1 enseignant par matière, plusieurs enseignants dans une même classe
 *   - Affectation matière par matière
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Trash2,
  Star,
  Info,
  GraduationCap,
  Replace,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FormModal,
  ConfirmModal,
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
  assignments: { id: string; teacher: { id: string; firstName: string; lastName: string } }[];
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

// --- Helpers ---

/**
 * Détermine si le niveau est "Titulaire Unique" (Maternelle ou Primaire).
 * Retourne false pour le Secondaire (mode Spécialiste).
 */
const isHomeroomLevel = (levelName?: string): boolean => {
  if (!levelName) return false;
  const n = levelName.toUpperCase();
  return n.includes('MATERN') || n.includes('PRIMA') || n.includes('PRIM');
};

// --- Component ---

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
  const [modal, setModal] = useState<'none' | 'assign-teacher' | 'assign-homeroom' | 'confirm-remove'>('none');
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null);

  // Bulk assignment loading
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // --- Loaders ---

  const loadInitialData = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const [classesData, teachersData] = await Promise.all([
        pedagogyService.getAcademicClasses(academicYear.id),
        pedagogyService.getTeacherProfiles(academicYear.id),
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

  // --- Derived state ---

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const isHomeroom = isHomeroomLevel(selectedClass?.level?.name);

  // Titulaire courant (Maternelle/Primaire) : le prof du premier classSubject assigné
  const currentHomeroom = useMemo(() => {
    if (!isHomeroom) return null;
    const assigned = classSubjects.find(cs => cs.assignments.length > 0);
    return assigned?.assignments[0]?.teacher || null;
  }, [isHomeroom, classSubjects]);

  const homeroomFullyAssigned = isHomeroom && classSubjects.length > 0 &&
    classSubjects.every(cs => cs.assignments.length > 0);

  // --- Actions ---

  /** SECONDAIRE : affecter un enseignant à une matière spécifique */
  const handleAssignTeacher = async (teacherId: string) => {
    if (!activeSubject || !academicYear?.id) return;
    try {
      await pedagogyService.createTeacherAssignment({
        academicYearId: academicYear.id,
        teacherId,
        classSubjectId: activeSubject.id,
      });
      await loadClassSubjects();
      setModal('none');
      toast({ title: 'Succès', description: 'Enseignant affecté avec succès.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || "Impossible d'affecter l'enseignant.", variant: 'destructive' });
    }
  };

  /** MATERNELLE/PRIMAIRE : affecter le titulaire à TOUTES les matières de la classe */
  const handleAssignHomeroom = async (teacherId: string) => {
    if (!academicYear?.id || classSubjects.length === 0) return;
    setBulkAssigning(true);
    try {
      // Supprimer d'abord toutes les affectations existantes
      const removePromises = classSubjects
        .flatMap(cs => cs.assignments.map(a => pedagogyService.deleteTeacherAssignment(a.id)));
      await Promise.all(removePromises);

      // Créer une affectation pour chaque matière
      const assignPromises = classSubjects.map(cs =>
        pedagogyService.createTeacherAssignment({
          academicYearId: academicYear.id,
          teacherId,
          classSubjectId: cs.id,
        })
      );
      await Promise.all(assignPromises);
      await loadClassSubjects();
      setModal('none');
      setSearch('');
      toast({
        title: '✅ Titulaire affecté',
        description: `Le titulaire a été assigné à toutes les ${classSubjects.length} matières de la classe.`,
      });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || "Impossible d'affecter le titulaire.", variant: 'destructive' });
    } finally {
      setBulkAssigning(false);
    }
  };

  /** Retirer le titulaire de toutes les matières (Maternelle/Primaire) */
  const handleRemoveHomeroom = async () => {
    if (!academicYear?.id) return;
    setBulkAssigning(true);
    try {
      const removePromises = classSubjects
        .flatMap(cs => cs.assignments.map(a => pedagogyService.deleteTeacherAssignment(a.id)));
      await Promise.all(removePromises);
      await loadClassSubjects();
      setModal('none');
      toast({ title: 'Titulaire retiré', description: 'Toutes les affectations ont été supprimées.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setBulkAssigning(false);
    }
  };

  /** SECONDAIRE : retirer une affectation individuelle */
  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await pedagogyService.deleteTeacherAssignment(assignmentId);
      await loadClassSubjects();
      toast({ title: 'Succès', description: 'Affectation retirée avec succès.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || "Impossible de retirer l'affectation.", variant: 'destructive' });
    }
  };

  // --- Helpers ---

  const isQualified = (teacher: TeacherProfile, subjectId: string) =>
    teacher.subjectQualifications.some(q => q.subjectId === subjectId);

  const isAuthorized = (teacher: TeacherProfile, levelId?: string) => {
    if (!levelId) return true;
    if (teacher.levelAuthorizations.length === 0) return true;
    return teacher.levelAuthorizations.some(a => a.levelId === levelId);
  };

  const filteredTeachers = teachers.filter(t =>
    `${t.teacher.firstName} ${t.teacher.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  // --- Render helpers ---

  const LevelBadge = ({ cls }: { cls: AcademicClass }) => {
    const homeroom = isHomeroomLevel(cls.level?.name);
    return (
      <span className={cn(
        'text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wide',
        homeroom ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'
      )}>
        {homeroom ? 'Titulaire' : 'Spécialiste'}
      </span>
    );
  };

  // Grouper les classes par niveau pour la sidebar
  const groupedClasses = useMemo(() => {
    const groups: Record<string, AcademicClass[]> = {};
    classes.forEach(cls => {
      const key = cls.level?.name || 'Autre';
      if (!groups[key]) groups[key] = [];
      groups[key].push(cls);
    });
    return groups;
  }, [classes]);

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-6 overflow-hidden">

      {/* ── Sidebar : Liste des Classes ── */}
      <div className="w-72 bg-white rounded-3xl border border-gray-100 flex flex-col shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-50">
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            Classes
          </h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
            {classes.length} classe{classes.length > 1 ? 's' : ''} configurée{classes.length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {Object.entries(groupedClasses).map(([levelName, levelClasses]) => (
            <div key={levelName}>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-3 py-1">
                {levelName}
              </p>
              <div className="space-y-0.5">
                {levelClasses.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClassId(c.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-2xl transition-all',
                      selectedClassId === c.id
                        ? 'bg-indigo-600 shadow-lg shadow-indigo-200'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className={cn(
                        'font-bold text-sm',
                        selectedClassId === c.id ? 'text-white' : 'text-gray-900'
                      )}>
                        {c.name}
                      </p>
                      {selectedClassId !== c.id && <LevelBadge cls={c} />}
                    </div>
                    {selectedClassId === c.id && (
                      <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-wide mt-0.5">
                        {isHomeroomLevel(c.level?.name) ? '📚 Titulaire Unique' : '🎓 Spécialiste / Matière'}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {classes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Layers className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-xs text-gray-400 font-bold">Aucune classe configurée</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Zone principale ── */}
      <div className="flex-1 flex flex-col gap-0 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">

        {/* Header */}
        <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-gray-900">
              {selectedClass?.name || 'Sélectionnez une classe'}
            </h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">
              {isHomeroom
                ? '📚 Mode Titulaire — 1 enseignant pour toutes les matières'
                : '🎓 Mode Spécialiste — 1 enseignant par matière'}
            </p>
          </div>

          {selectedClass && (
            <div className={cn(
              'flex items-center gap-3 px-5 py-3 rounded-2xl border',
              isHomeroom
                ? 'bg-amber-50 border-amber-100'
                : 'bg-violet-50 border-violet-100'
            )}>
              {isHomeroom ? (
                <Star className="w-4 h-4 text-amber-600" />
              ) : (
                <GraduationCap className="w-4 h-4 text-violet-600" />
              )}
              <div>
                <p className={cn('text-xs font-black uppercase tracking-widest',
                  isHomeroom ? 'text-amber-900' : 'text-violet-900'
                )}>
                  {isHomeroom ? 'Maternelle / Primaire' : 'Secondaire'}
                </p>
                <p className={cn('text-[9px] font-bold',
                  isHomeroom ? 'text-amber-600' : 'text-violet-600'
                )}>
                  {classSubjects.length} matière{classSubjects.length > 1 ? 's' : ''}
                  {' '}• {isHomeroom
                    ? (homeroomFullyAssigned ? '✅ Titulaire affecté' : '⚠️ Sans titulaire')
                    : `${classSubjects.filter(cs => cs.assignments.length > 0).length}/${classSubjects.length} affectées`
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedClass ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Layers className="w-16 h-16 text-gray-200 mb-4" />
              <p className="text-gray-400 font-bold">Sélectionnez une classe à gauche</p>
            </div>
          ) : isHomeroom ? (
            /* ══════════════════════════════════════════════════
               MODE TITULAIRE UNIQUE (Maternelle / Primaire)
               ══════════════════════════════════════════════════ */
            <div className="max-w-2xl mx-auto space-y-6">

              {/* Bannière d'explication */}
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex items-start gap-4">
                <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-black text-amber-900">Modèle Titulaire Unique</p>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    En Maternelle et en Primaire, <strong>un seul enseignant titulaire</strong> gère l'ensemble
                    des matières de sa classe. Définissez-le ici — il sera automatiquement affecté
                    à toutes les {classSubjects.length} matières de <strong>{selectedClass.name}</strong>.
                  </p>
                </div>
              </div>

              {/* Carte Titulaire */}
              <div className={cn(
                'rounded-3xl border-2 p-6 transition-all',
                homeroomFullyAssigned
                  ? 'border-emerald-200 bg-emerald-50/30'
                  : 'border-dashed border-amber-200 bg-amber-50/20'
              )}>
                <div className="flex items-center gap-4 mb-6">
                  <div className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center',
                    homeroomFullyAssigned ? 'bg-emerald-100' : 'bg-amber-100'
                  )}>
                    {homeroomFullyAssigned
                      ? <UserCheck className="w-7 h-7 text-emerald-600" />
                      : <UserPlus className="w-7 h-7 text-amber-600" />
                    }
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-gray-900">Enseignant Titulaire</h4>
                    <p className="text-xs text-gray-500 font-bold">Classe : {selectedClass.name}</p>
                  </div>
                </div>

                {homeroomFullyAssigned && currentHomeroom ? (
                  <div className="space-y-4">
                    {/* Avatar + Nom */}
                    <div className="flex items-center gap-5 p-5 bg-white rounded-2xl border border-emerald-100 shadow-sm">
                      <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-lg shadow-indigo-200">
                        {currentHomeroom.firstName[0]}{currentHomeroom.lastName[0]}
                      </div>
                      <div className="flex-1">
                        <p className="text-base font-black text-gray-900">
                          {currentHomeroom.lastName} {currentHomeroom.firstName}
                        </p>
                        <p className="text-xs text-gray-500 font-bold">
                          Titulaire de {selectedClass.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px] bg-emerald-100 text-emerald-700 font-black uppercase px-2 py-0.5 rounded-full">
                            ✓ Affecté à toutes les matières
                          </span>
                        </div>
                      </div>
                      <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    </div>

                    {/* Matières gérées */}
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                        Matières gérées
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {classSubjects.map(cs => (
                          <div key={cs.id} className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-gray-100 text-xs">
                            <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center font-black text-[9px] text-indigo-600 flex-shrink-0">
                              {cs.subject.code}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-800 truncate">{cs.subject.name}</p>
                              <p className="text-[9px] text-gray-400 font-bold">{cs.weeklyHours}h/sem</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => { setSearch(''); setModal('assign-homeroom'); }}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                      >
                        <Replace className="w-4 h-4" />
                        Remplacer le titulaire
                      </button>
                      <button
                        onClick={handleRemoveHomeroom}
                        disabled={bulkAssigning}
                        className="px-5 py-3 bg-red-50 text-red-600 rounded-2xl font-black text-xs hover:bg-red-100 transition-all border border-red-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setSearch(''); setModal('assign-homeroom'); }}
                    className="w-full py-10 border-2 border-dashed border-amber-200 rounded-2xl flex flex-col items-center justify-center gap-3 text-amber-500 hover:border-amber-400 hover:bg-amber-50/50 transition-all"
                  >
                    <UserPlus className="w-10 h-10" />
                    <div className="text-center">
                      <p className="font-black text-sm">Désigner le titulaire</p>
                      <p className="text-xs opacity-70">Il sera affecté à toutes les matières</p>
                    </div>
                  </button>
                )}
              </div>
            </div>

          ) : (
            /* ══════════════════════════════════════════════════
               MODE SPÉCIALISTE (Secondaire)
               ══════════════════════════════════════════════════ */
            <div className="space-y-4">
              <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 flex items-center gap-3">
                <GraduationCap className="w-5 h-5 text-violet-600 flex-shrink-0" />
                <p className="text-xs text-violet-800 font-bold">
                  Niveau secondaire — Affectez <strong>un enseignant spécialisé par matière</strong>.
                  Chaque enseignant peut intervenir dans plusieurs classes.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classSubjects.map(cs => {
                  const assigned = cs.assignments[0]?.teacher;
                  return (
                    <motion.div
                      key={cs.id}
                      layout
                      className={cn(
                        'p-5 rounded-3xl border transition-all flex flex-col gap-4',
                        assigned
                          ? 'bg-white border-indigo-100 shadow-md shadow-indigo-50'
                          : 'bg-gray-50/50 border-dashed border-gray-200'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center font-black text-xs text-indigo-600">
                            {cs.subject.code}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 text-sm">{cs.subject.name}</h4>
                            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {cs.weeklyHours}h/sem · Coeff. {cs.coefficient}
                            </span>
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

                      <div>
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
                              setSearch('');
                              setModal('assign-teacher');
                            }}
                            className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl flex items-center justify-center gap-2 text-gray-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/30 transition-all text-xs font-black uppercase tracking-widest"
                          >
                            <UserPlus className="w-4 h-4" />
                            Affecter un enseignant
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {classSubjects.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <BookOpen className="w-14 h-14 text-gray-200 mb-4" />
                  <p className="text-gray-500 font-bold">Aucune matière configurée</p>
                  <p className="text-xs text-gray-400 mt-1">Ajoutez d'abord des matières dans le Catalogue</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MODAL : Affecter titulaire (Maternelle/Primaire)
          ══════════════════════════════════════════════════ */}
      <FormModal
        isOpen={modal === 'assign-homeroom'}
        onClose={() => setModal('none')}
        title="Désigner le Titulaire de Classe"
        size="lg"
      >
        <div className="space-y-5">
          {/* Info classe */}
          <div className="p-4 bg-amber-50 rounded-2xl flex items-center gap-4 border border-amber-100">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <Star className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-black text-amber-900">Titulaire de {selectedClass?.name}</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Cet enseignant gérera toutes les{' '}
                <strong>{classSubjects.length} matières</strong> de la classe.
              </p>
            </div>
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Chercher un enseignant..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-amber-400 text-sm font-medium"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Liste */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredTeachers.map(t => {
              const isCurrentHomeroom = currentHomeroom?.id === t.teacherId;
              const authorized = isAuthorized(t, selectedClass?.level?.id);
              return (
                <button
                  key={t.id}
                  disabled={!authorized || bulkAssigning}
                  onClick={() => handleAssignHomeroom(t.teacherId)}
                  className={cn(
                    'w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left',
                    isCurrentHomeroom
                      ? 'bg-amber-50 border-amber-200 ring-2 ring-amber-300'
                      : authorized
                      ? 'bg-white border-gray-100 hover:border-amber-400 hover:shadow-md hover:shadow-amber-50'
                      : 'bg-gray-50 border-transparent opacity-40 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-sm">
                      {t.teacher.firstName[0]}{t.teacher.lastName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">
                        {t.teacher.lastName} {t.teacher.firstName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[8px] font-bold text-gray-400">
                          {t.teacher.matricule}
                        </span>
                        <span className="text-gray-200">•</span>
                        <span className="text-[8px] font-bold text-indigo-500">
                          Max {t.maxWeeklyHours}h/sem
                        </span>
                        {isCurrentHomeroom && (
                          <span className="text-[8px] font-black bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
                            Titulaire actuel
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {authorized && !isCurrentHomeroom && (
                    <UserPlus className="w-5 h-5 text-gray-300" />
                  )}
                  {isCurrentHomeroom && (
                    <CheckCircle2 className="w-5 h-5 text-amber-500" />
                  )}
                </button>
              );
            })}
            {filteredTeachers.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8 font-bold">Aucun enseignant trouvé</p>
            )}
          </div>

          {bulkAssigning && (
            <div className="flex items-center justify-center gap-3 py-3 text-amber-600">
              <div className="w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
              <p className="text-sm font-bold">Affectation en cours...</p>
            </div>
          )}
        </div>
      </FormModal>

      {/* ══════════════════════════════════════════════════
          MODAL : Affecter enseignant spécialiste (Secondaire)
          ══════════════════════════════════════════════════ */}
      <FormModal
        isOpen={modal === 'assign-teacher'}
        onClose={() => setModal('none')}
        title="Affecter un Enseignant Spécialiste"
        size="lg"
      >
        <div className="space-y-5">
          {/* Info matière */}
          <div className="p-4 bg-violet-50 rounded-2xl flex items-center gap-4 border border-violet-100">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-black text-indigo-600 shadow-sm text-sm">
              {activeSubject?.subject.code}
            </div>
            <div>
              <p className="text-sm font-black text-violet-900">{activeSubject?.subject.name}</p>
              <p className="text-xs text-violet-600 font-bold uppercase tracking-widest">
                Charge : {activeSubject?.weeklyHours}h · Coeff. {activeSubject?.coefficient}
              </p>
            </div>
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Chercher par nom ou habilitation..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Liste */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {filteredTeachers.map(t => {
              const qualified = isQualified(t, activeSubject?.subject.id || '');
              const authorized = isAuthorized(t, selectedClass?.level?.id);
              return (
                <button
                  key={t.id}
                  disabled={!qualified || !authorized}
                  onClick={() => handleAssignTeacher(t.teacherId)}
                  className={cn(
                    'w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left',
                    qualified && authorized
                      ? 'bg-white border-gray-100 hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-50'
                      : 'bg-gray-50 border-transparent opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs',
                      qualified && authorized ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'
                    )}>
                      {t.teacher.firstName[0]}{t.teacher.lastName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">
                        {t.teacher.lastName} {t.teacher.firstName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn(
                          'text-[8px] font-black uppercase px-1.5 py-0.5 rounded',
                          qualified ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        )}>
                          {qualified ? 'Habilité' : 'Non Habilité'}
                        </span>
                        <span className="text-[8px] font-bold text-gray-400">
                          Capacité : {t.maxWeeklyHours}h
                        </span>
                      </div>
                    </div>
                  </div>
                  {qualified && authorized && <UserPlus className="w-5 h-5 text-indigo-300" />}
                </button>
              );
            })}
            {filteredTeachers.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-8 font-bold">Aucun enseignant trouvé</p>
            )}
          </div>
        </div>
      </FormModal>
    </div>
  );
}
