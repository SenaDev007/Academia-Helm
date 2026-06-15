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

const PRIMARY = '#1A2BA6';
const ACCENT = '#F5A623';

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
    <div className="flex h-[calc(100vh-23rem)] overflow-hidden bg-white">

      {/* ── Sidebar : Liste des Classes ── */}
      <div className="w-72 border-r border-slate-200 flex flex-col bg-slate-50/20 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4" style={{ color: PRIMARY }} />
            Classes
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
            {classes.length} classe{classes.length > 1 ? 's' : ''} configurée{classes.length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-3 bg-white">
          {Object.entries(groupedClasses).map(([levelName, levelClasses]) => (
            <div key={levelName}>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1">
                {levelName}
              </p>
              <div className="space-y-0.5">
                {levelClasses.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClassId(c.id)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-lg transition-all border border-transparent',
                      selectedClassId === c.id
                        ? 'bg-slate-50 shadow-sm'
                        : 'hover:bg-slate-50/80'
                    )}
                    style={selectedClassId === c.id ? { borderLeft: `3px solid ${PRIMARY}`, paddingLeft: '9px' } : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <p className={cn(
                        'font-bold text-xs',
                        selectedClassId === c.id ? 'text-slate-900' : 'text-slate-800'
                      )}>
                        {c.name}
                      </p>
                      {selectedClassId !== c.id && <LevelBadge cls={c} />}
                    </div>
                    {selectedClassId === c.id && (
                      <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: PRIMARY }}>
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
              <Layers className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-xs text-slate-400 font-bold">Aucune classe configurée</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Zone principale ── */}
      <div className="flex-1 flex flex-col gap-0 bg-white overflow-hidden">

        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {selectedClass?.name || 'Sélectionnez une classe'}
            </h3>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
              {isHomeroom
                ? '📚 Mode Titulaire — 1 enseignant pour toutes les matières'
                : '🎓 Mode Spécialiste — 1 enseignant par matière'}
            </p>
          </div>

          {selectedClass && (
            <div 
              className="flex items-center gap-3 px-3 py-1.5 rounded-lg border text-xs"
              style={isHomeroom 
                ? { backgroundColor: `${ACCENT}15`, borderColor: `${ACCENT}30` }
                : { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }
              }
            >
              {isHomeroom ? (
                <Star className="w-4 h-4" style={{ color: ACCENT }} />
              ) : (
                <GraduationCap className="w-4 h-4 text-violet-600" />
              )}
              <div>
                <p className="font-bold uppercase tracking-wider text-slate-700">
                  {isHomeroom ? 'Maternelle / Primaire' : 'Secondaire'}
                </p>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5">
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
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          {!selectedClass ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Layers className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-slate-400 text-xs font-bold">Sélectionnez une classe à gauche</p>
            </div>
          ) : isHomeroom ? (
            /* ══════════════════════════════════════════════════
               MODE TITULAIRE UNIQUE (Maternelle / Primaire)
               ══════════════════════════════════════════════════ */
            <div className="max-w-2xl mx-auto space-y-4">

              {/* Bannière d'explication */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start gap-3">
                <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">Modèle Titulaire Unique</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed font-medium">
                    En Maternelle et en Primaire, <strong>un seul enseignant titulaire</strong> gère l'ensemble
                    des matières de sa classe. Définissez-le ici — il sera automatiquement affecté
                    à toutes les {classSubjects.length} matières de <strong>{selectedClass.name}</strong>.
                  </p>
                </div>
              </div>

              {/* Carte Titulaire */}
              <div className={cn(
                'rounded-lg border p-5 bg-white shadow-sm transition-all',
                homeroomFullyAssigned
                  ? 'border-slate-200'
                  : 'border-dashed border-slate-300'
              )}>
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${PRIMARY}15` }}
                  >
                    {homeroomFullyAssigned
                      ? <UserCheck className="w-5 h-5" style={{ color: PRIMARY }} />
                      : <UserPlus className="w-5 h-5" style={{ color: PRIMARY }} />
                    }
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Enseignant Titulaire</h4>
                    <p className="text-xs text-slate-500 font-medium">Classe : {selectedClass.name}</p>
                  </div>
                </div>

                {homeroomFullyAssigned && currentHomeroom ? (
                  <div className="space-y-4">
                    {/* Avatar + Nom */}
                    <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-lg border border-slate-200">
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-md"
                        style={{ backgroundColor: PRIMARY }}
                      >
                        {currentHomeroom.firstName[0]}{currentHomeroom.lastName[0]}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900">
                          {currentHomeroom.lastName} {currentHomeroom.firstName}
                        </p>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">
                          Titulaire de {selectedClass.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold uppercase px-2 py-0.5 rounded-full">
                            ✓ Affecté à toutes les matières
                          </span>
                        </div>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    </div>

                    {/* Matières gérées */}
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Matières gérées
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {classSubjects.map(cs => (
                          <div key={cs.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 text-xs bg-white">
                            <div className="w-7 h-7 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center font-bold text-[9px] text-slate-600 flex-shrink-0">
                              {cs.subject.code}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 truncate">{cs.subject.name}</p>
                              <p className="text-[9px] text-slate-400 font-semibold">{cs.weeklyHours}h/sem</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => { setSearch(''); setModal('assign-homeroom'); }}
                        className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold text-white rounded-lg transition-all shadow-sm hover:opacity-95"
                        style={{ backgroundColor: PRIMARY }}
                      >
                        <Replace className="w-4 h-4" />
                        Remplacer le titulaire
                      </button>
                      <button
                        onClick={handleRemoveHomeroom}
                        disabled={bulkAssigning}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-semibold text-xs hover:bg-red-100 transition-all border border-red-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setSearch(''); setModal('assign-homeroom'); }}
                    className="w-full py-8 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-slate-400 hover:bg-slate-50/50 transition-all bg-white"
                  >
                    <UserPlus className="w-8 h-8" style={{ color: PRIMARY }} />
                    <div className="text-center">
                      <p className="font-bold text-xs text-slate-800">Désigner le titulaire</p>
                      <p className="text-[11px] text-slate-400 font-medium">Il sera affecté à toutes les matières</p>
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
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center gap-3">
                <GraduationCap className="w-5 h-5 flex-shrink-0" style={{ color: PRIMARY }} />
                <p className="text-xs text-slate-700 font-medium">
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
                        'p-4 rounded-lg border transition-all flex flex-col gap-3',
                        assigned
                          ? 'bg-white border-slate-200 shadow-sm'
                          : 'bg-slate-50/50 border-dashed border-slate-300'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center font-bold text-xs text-slate-600">
                            {cs.subject.code}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs">{cs.subject.name}</h4>
                            <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" /> {cs.weeklyHours}h/sem · Coeff. {cs.coefficient}
                            </span>
                          </div>
                        </div>
                        {assigned && (
                          <button
                            onClick={() => handleRemoveAssignment(cs.assignments[0].id)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div>
                        {assigned ? (
                          <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                            <div 
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
                              style={{ backgroundColor: PRIMARY }}
                            >
                              {assigned.firstName[0]}{assigned.lastName[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {assigned.lastName} {assigned.firstName}
                              </p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
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
                            className="w-full py-2 border border-dashed border-slate-350 rounded-lg flex items-center justify-center gap-2 text-slate-400 hover:border-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-all text-xs font-semibold bg-white shadow-sm"
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
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="w-10 h-10 text-slate-300 mb-4" />
                  <p className="text-slate-500 text-xs font-bold">Aucune matière configurée</p>
                  <p className="text-[11px] text-slate-400 mt-1">Ajoutez d'abord des matières dans le Catalogue</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal : Affecter titulaire (Maternelle/Primaire) ── */}
      <FormModal
        isOpen={modal === 'assign-homeroom'}
        onClose={() => setModal('none')}
        title="Désigner le Titulaire de Classe"
        size="lg"
      >
        <div className="space-y-4">
          {/* Info classe */}
          <div className="p-3 bg-slate-50 rounded-lg flex items-center gap-3 border border-slate-200">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Titulaire de {selectedClass?.name}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                Cet enseignant gérera toutes les{' '}
                <strong>{classSubjects.length} matières</strong> de la classe.
              </p>
            </div>
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Chercher un enseignant..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 text-sm font-medium transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Liste */}
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {filteredTeachers.map(t => {
              const isCurrentHomeroom = currentHomeroom?.id === t.teacherId;
              const authorized = isAuthorized(t, selectedClass?.level?.id);
              return (
                <button
                  key={t.id}
                  disabled={!authorized || bulkAssigning}
                  onClick={() => handleAssignHomeroom(t.teacherId)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left bg-white',
                    isCurrentHomeroom
                      ? 'border-slate-350 bg-slate-50 shadow-sm'
                      : authorized
                      ? 'border-slate-200 hover:border-slate-400 hover:shadow-sm'
                      : 'bg-slate-50 border-transparent opacity-40 cursor-not-allowed'
                  )}
                  style={isCurrentHomeroom ? { borderLeft: `3px solid ${PRIMARY}`, paddingLeft: '9px' } : undefined}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      {t.teacher.firstName[0]}{t.teacher.lastName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xs">
                        {t.teacher.lastName} {t.teacher.firstName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[9px] font-semibold text-slate-400">
                        <span>
                          {t.teacher.matricule}
                        </span>
                        <span>•</span>
                        <span style={{ color: PRIMARY }}>
                          Max {t.maxWeeklyHours}h/sem
                        </span>
                        {isCurrentHomeroom && (
                          <span className="text-[8px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
                            Titulaire actuel
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {authorized && !isCurrentHomeroom && (
                    <UserPlus className="w-4 h-4 text-slate-400" />
                  )}
                  {isCurrentHomeroom && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                </button>
              );
            })}
            {filteredTeachers.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-8 font-bold">Aucun enseignant trouvé</p>
            )}
          </div>

          {bulkAssigning && (
            <div className="flex items-center justify-center gap-2 py-2 text-slate-600">
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: PRIMARY, borderTopColor: 'transparent' }} />
              <p className="text-xs font-bold">Affectation en cours...</p>
            </div>
          )}
        </div>
      </FormModal>

      {/* ── Modal : Affecter enseignant spécialiste (Secondaire) ── */}
      <FormModal
        isOpen={modal === 'assign-teacher'}
        onClose={() => setModal('none')}
        title="Affecter un Enseignant Spécialiste"
        size="lg"
      >
        <div className="space-y-4">
          {/* Info matière */}
          <div className="p-3 bg-slate-50 rounded-lg flex items-center gap-3 border border-slate-200">
            <div className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center font-bold text-slate-600 shadow-sm text-xs">
              {activeSubject?.subject.code}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">{activeSubject?.subject.name}</p>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                Charge : {activeSubject?.weeklyHours}h · Coeff. {activeSubject?.coefficient}
              </p>
            </div>
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Chercher par nom ou habilitation..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20 focus:border-slate-500 text-sm font-medium transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Liste */}
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {filteredTeachers.map(t => {
              const qualified = isQualified(t, activeSubject?.subject.id || '');
              const authorized = isAuthorized(t, selectedClass?.level?.id);
              return (
                <button
                  key={t.id}
                  disabled={!qualified || !authorized}
                  onClick={() => handleAssignTeacher(t.teacherId)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left bg-white',
                    qualified && authorized
                      ? 'border-slate-200 hover:border-slate-400 hover:shadow-sm'
                      : 'bg-slate-50 border-transparent opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                      style={qualified && authorized ? { backgroundColor: PRIMARY, color: '#fff' } : { backgroundColor: '#f1f5f9', color: '#94a3b8' }}
                    >
                      {t.teacher.firstName[0]}{t.teacher.lastName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xs">
                        {t.teacher.lastName} {t.teacher.firstName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[9px] font-semibold">
                        <span className={cn(
                          'font-bold uppercase px-1.5 py-0.5 rounded-full border text-[8px]',
                          qualified ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                        )}>
                          {qualified ? 'Habilité' : 'Non Habilité'}
                        </span>
                        <span className="text-slate-400">
                          Capacité : {t.maxWeeklyHours}h
                        </span>
                      </div>
                    </div>
                  </div>
                  {qualified && authorized && <UserPlus className="w-4 h-4" style={{ color: PRIMARY }} />}
                </button>
              );
            })}
            {filteredTeachers.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-8 font-bold">Aucun enseignant trouvé</p>
            )}
          </div>
        </div>
      </FormModal>
    </div>
  );
}
