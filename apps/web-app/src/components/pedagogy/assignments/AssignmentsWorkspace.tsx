/**
 * ============================================================================
 * ASSIGNMENTS WORKSPACE - MODULE 2 (Affectations & Charges)
 * ============================================================================
 *
 * Architecture 3 couches :
 *   1. Classe officielle (AcademicClass) = CE1, CM2, 6ème…
 *   2. Classe physique (Class/section) = CE1 A, CE1 B…
 *   3. Affectation = TeacherClassAssignment lié à une classe physique
 *
 * ► MATERNELLE / PRIMAIRE : Modèle "Titulaire Unique"
 *   - 1 titulaire par SECTION PHYSIQUE (ex: CE1 A, CE1 B)
 *   - Le titulaire gère TOUTES les matières de sa section
 *
 * ► SECONDAIRE : Modèle "Spécialiste"
 *   - 1 enseignant par matière, par section physique
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Search, CheckCircle2, AlertCircle, Clock, Plus, X,
  BookOpen, Layers, ChevronRight, UserCheck, UserPlus, Trash2,
  Star, Info, GraduationCap, Replace, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FormModal, ConfirmModal } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useBilingual } from '@/contexts/BilingualContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const PRIMARY = '#1A2BA6';
const ACCENT = '#F5A623';

// --- Types ---

interface AcademicClass {
  id: string;
  name: string;
  code: string;
  level?: { id: string; name: string };
  series?: { id: string; name: string };
  isActive: boolean;
}

interface PhysicalClass {
  id: string;
  name: string;
  code: string;
  officialClassId: string;
  schoolLevelId: string;
  capacity?: number;
}

interface ClassSubject {
  id: string;
  weeklyHours: number;
  coefficient: number;
  subject: { id: string; name: string; code: string; language?: string };
  assignments: { id: string; classId: string | null; teacher: { id: string; firstName: string; lastName: string; matricule: string } }[];
}

interface TeacherProfile {
  id: string;
  teacherId: string;
  maxWeeklyHours: number;
  teacher: { id: string; firstName: string; lastName: string; matricule: string };
  subjectQualifications: { subjectId: string }[];
  levelAuthorizations: { levelId: string }[];
  assignedLanguages?: string[] | null;
}

const isHomeroomLevel = (levelName?: string): boolean => {
  if (!levelName) return false;
  const n = levelName.toUpperCase();
  return n.includes('MATERN') || n.includes('PRIMA') || n.includes('PRIM');
};

const CANONICAL_CLASS_ORDER = [
  'maternelle 1', 'maternelle 2',
  'ci', 'cp', 'ce1', 'ce2', 'cm1', 'cm2',
  '6eme', '6e', '5eme', '5e', '4eme', '4e', '3eme', '3e',
  '2nde', '1ere', 'terminale',
];
const getClassOrder = (name: string): number => {
  const lower = (name || '').toLowerCase().trim();
  const idx = CANONICAL_CLASS_ORDER.indexOf(lower);
  if (idx >= 0) return idx;
  for (let i = 0; i < CANONICAL_CLASS_ORDER.length; i++) {
    if (lower.startsWith(CANONICAL_CLASS_ORDER[i])) return i;
  }
  return CANONICAL_CLASS_ORDER.length;
};

// --- Component ---

export default function AssignmentsWorkspace() {
  const { academicYear } = useModuleContext();
  const { isEnabled: isBilingual, currentTrack, setCurrentTrack } = useBilingual();
  const { toast } = useToast();

  // Data
  const [loading, setLoading] = useState(false);
  const [academicClasses, setAcademicClasses] = useState<AcademicClass[]>([]);
  const [physicalClasses, setPhysicalClasses] = useState<PhysicalClass[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // Selection — selectedPhysicalClassId is the PRIMARY selection
  const [selectedPhysicalClassId, setSelectedPhysicalClassId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'none' | 'assign-homeroom' | 'assign-teacher' | 'confirm-remove'>('none');
  const [removingAssignmentId, setRemovingAssignmentId] = useState<string | null>(null);
  const [activeSubject, setActiveSubject] = useState<ClassSubject | null>(null);

  // --- Loaders ---

  const loadData = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const [classesData, teachersData] = await Promise.all([
        pedagogyFetch<AcademicClass[]>(`/api/pedagogy/academic-structure/classes?academicYearId=${academicYear.id}`),
        pedagogyFetch<TeacherProfile[]>(`/api/pedagogy/teacher-profiles?academicYearId=${academicYear.id}`),
      ]);

      // Filtrer : ne garder que les classes officielles ACTIVES
      const activeClasses = (classesData || []).filter(c => c.isActive !== false);

      // Charger TOUTES les classes physiques pour cette année
      // On utilise pedagogyFetch (proxy) qui n'a pas le guard x-school-level-id
      const allPhysicalClasses: PhysicalClass[] = [];
      for (const ac of activeClasses) {
        try {
          const sections = await pedagogyFetch<any[]>(
            `/api/pedagogy/academic-structure/sections?academicYearId=${academicYear.id}`
          );
          if (Array.isArray(sections)) {
            for (const s of sections) {
              if (s.officialClass?.id === ac.id) {
                allPhysicalClasses.push({
                  id: s.id,
                  name: s.name,
                  code: s.code,
                  officialClassId: ac.id,
                  schoolLevelId: ac.level?.id || '',
                  capacity: s.capacity,
                });
              }
            }
          }
        } catch {
          // Si l'endpoint sections échoue, on continue sans sections physiques
        }
      }

      setAcademicClasses(activeClasses);
      setPhysicalClasses(allPhysicalClasses);
      setTeachers(teachersData || []);

      // Auto-sélectionner la première section physique
      if (allPhysicalClasses.length > 0 && !selectedPhysicalClassId) {
        setSelectedPhysicalClassId(allPhysicalClasses[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Charger les class_subjects quand la classe officielle de la section sélectionnée change
  const selectedPhysicalClass = physicalClasses.find(pc => pc.id === selectedPhysicalClassId);
  const selectedOfficialClass = academicClasses.find(ac => ac.id === selectedPhysicalClass?.officialClassId);
  const isHomeroom = isHomeroomLevel(selectedOfficialClass?.level?.name);

  const loadClassSubjects = useCallback(async () => {
    if (!selectedOfficialClass?.id || !academicYear?.id) return;
    try {
      const data = await pedagogyFetch<ClassSubject[]>(
        `/api/pedagogy/class-subjects/${selectedOfficialClass.id}?academicYearId=${academicYear.id}`
      );
      // Filtrer par langue en mode bilingue
      let filtered = data || [];
      if (isBilingual) {
        filtered = filtered.filter(cs => {
          const lang = (cs.subject?.language || '').toUpperCase();
          if (currentTrack === 'EN') return lang === 'EN';
          if (currentTrack === 'FR') return lang !== 'EN';
          return true;
        });
      }
      setClassSubjects(filtered);
    } catch (e) {
      console.error(e);
      setClassSubjects([]);
    }
  }, [selectedOfficialClass?.id, academicYear?.id, isBilingual, currentTrack]);

  useEffect(() => {
    loadClassSubjects();
  }, [loadClassSubjects]);

  // --- Derived state ---

  // Filtrer les sections physiques par recherche
  const filteredPhysicalClasses = useMemo(() => {
    if (!search) return physicalClasses;
    const s = search.toLowerCase();
    return physicalClasses.filter(pc => {
      const officialName = academicClasses.find(ac => ac.id === pc.officialClassId)?.name || '';
      return pc.name.toLowerCase().includes(s) || officialName.toLowerCase().includes(s);
    });
  }, [physicalClasses, search, academicClasses]);

  // Grouper les sections par classe officielle (avec ordre canonique)
  const groupedSections = useMemo(() => {
    const groups: Record<string, { officialClass: AcademicClass; sections: PhysicalClass[] }> = {};
    for (const pc of filteredPhysicalClasses) {
      const oc = academicClasses.find(ac => ac.id === pc.officialClassId);
      if (!oc) continue;
      if (!groups[oc.id]) groups[oc.id] = { officialClass: oc, sections: [] };
      groups[oc.id].sections.push(pc);
    }
    return Object.values(groups).sort((a, b) => {
      const ao = getClassOrder(a.officialClass.name);
      const bo = getClassOrder(b.officialClass.name);
      return ao - bo;
    });
  }, [filteredPhysicalClasses, academicClasses]);

  // Titulaire actuel = l'enseignant assigné aux matières de la section physique
  // On accepte les affectations avec le bon classId OU sans classId (anciennes, rétro-compat)
  const currentHomeroom = useMemo(() => {
    if (!isHomeroom || classSubjects.length === 0 || !selectedPhysicalClassId) return null;
    // Chercher une affectation qui correspond à cette section (classId match OU classId NULL)
    for (const cs of classSubjects) {
      const assign = (cs.assignments || []).find(a => a.classId === selectedPhysicalClassId || !a.classId);
      if (assign?.teacher) return assign.teacher;
    }
    return null;
  }, [isHomeroom, classSubjects, selectedPhysicalClassId]);

  const homeroomFullyAssigned = isHomeroom && classSubjects.length > 0 &&
    classSubjects.every(cs => (cs.assignments || []).some(a => a.classId === selectedPhysicalClassId || !a.classId));

  // --- Actions ---

  /** MATERNELLE/PRIMAIRE : affecter le titulaire à TOUTES les matières de la section physique */
  const handleAssignHomeroom = async (teacherId: string) => {
    if (!academicYear?.id || classSubjects.length === 0 || !selectedPhysicalClassId) return;
    setBulkAssigning(true);
    try {
      // 1. Supprimer TOUTES les affectations existantes pour ces classSubjects
      //    (pas seulement celles avec le bon classId — les anciennes avec classId=NULL
      //    doivent aussi être supprimées pour éviter le conflit "already exists")
      const removePromises = classSubjects
        .flatMap(cs => (cs.assignments || []))
        .map(a => pedagogyFetch(`/api/pedagogy/teacher-class-assignments/${a.id}`, { method: 'DELETE' }).catch(() => {}));
      await Promise.all(removePromises);

      // 2. Créer une affectation pour chaque matière, avec classId = section physique
      const assignPromises = classSubjects.map(cs =>
        pedagogyFetch(`/api/pedagogy/teacher-class-assignments`, {
          method: 'POST',
          body: {
            academicYearId: academicYear.id,
            teacherId,
            classSubjectId: cs.id,
            classId: selectedPhysicalClassId,
          },
        })
      );
      await Promise.all(assignPromises);
      await loadClassSubjects();
      setModal('none');
      setSearch('');
      toast({
        title: '✅ Titulaire affecté',
        description: `Le titulaire a été assigné à toutes les ${classSubjects.length} matières de ${selectedPhysicalClass?.name}.`,
      });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || "Impossible d'affecter le titulaire.", variant: 'destructive' });
    } finally {
      setBulkAssigning(false);
    }
  };

  /** Retirer le titulaire de la section physique */
  const handleRemoveHomeroom = async () => {
    if (!academicYear?.id || !selectedPhysicalClassId) return;
    setBulkAssigning(true);
    try {
      // Supprimer TOUTES les affectations existantes pour ces classSubjects
      const removePromises = classSubjects
        .flatMap(cs => (cs.assignments || []))
        .map(a => pedagogyFetch(`/api/pedagogy/teacher-class-assignments/${a.id}`, { method: 'DELETE' }).catch(() => {}));
      await Promise.all(removePromises);
      await loadClassSubjects();
      setModal('none');
      toast({ title: 'Titulaire retiré', description: `Le titulaire de ${selectedPhysicalClass?.name} a été retiré.` });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setBulkAssigning(false);
    }
  };

  /** SECONDAIRE : affecter un enseignant à une matière */
  const handleAssignTeacher = async (teacherId: string) => {
    if (!activeSubject || !academicYear?.id || !selectedPhysicalClassId) return;
    try {
      await pedagogyFetch(`/api/pedagogy/teacher-class-assignments`, {
        method: 'POST',
        body: {
          academicYearId: academicYear.id,
          teacherId,
          classSubjectId: activeSubject.id,
          classId: selectedPhysicalClassId,
        },
      });
      await loadClassSubjects();
      setModal('none');
      toast({ title: 'Succès', description: 'Enseignant affecté avec succès.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || "Impossible d'affecter l'enseignant.", variant: 'destructive' });
    }
  };

  /** Retirer une affectation individuelle */
  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      await pedagogyFetch(`/api/pedagogy/teacher-class-assignments/${assignmentId}`, { method: 'DELETE' });
      await loadClassSubjects();
      setModal('none');
      toast({ title: 'Succès', description: 'Affectation retirée.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  // Filtrer les enseignants éligibles (même niveau)
  const eligibleTeachers = useMemo(() => {
    return teachers.filter(t => {
      // En mode bilingue, filtrer par langue de l'enseignant
      if (isBilingual) {
        const langs = t.assignedLanguages || [];
        const teacherLang = langs.length > 0 ? langs[0] : null;
        if (currentTrack === 'EN' && teacherLang !== 'EN') return false;
        if (currentTrack === 'FR' && teacherLang === 'EN') return false;
      }
      return true;
    });
  }, [teachers, isBilingual, currentTrack]);

  // --- Render ---

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Panneau gauche : Sections physiques ── */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4" style={{ color: PRIMARY }} />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Sections physiques</h3>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher une section..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-slate-400"
              />
            </div>
          </div>

          <div className="flex-1 p-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : groupedSections.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                Aucune section physique trouvée.
                <br />
                Créez des sections dans Paramètres &gt; Structure.
              </div>
            ) : (
              groupedSections.map(({ officialClass, sections }) => (
                <div key={officialClass.id} className="mb-3">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {officialClass.name}
                  </div>
                  {sections.map(pc => {
                    const isSelected = selectedPhysicalClassId === pc.id;
                    return (
                      <button
                        key={pc.id}
                        onClick={() => setSelectedPhysicalClassId(pc.id)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5',
                          isSelected
                            ? 'text-white shadow-sm'
                            : 'text-slate-700 hover:bg-slate-100',
                        )}
                        style={isSelected ? { backgroundColor: PRIMARY } : undefined}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className={cn(
                            'inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black',
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                          )}>
                            {isHomeroomLevel(officialClass.level?.name) ? '★' : '🎓'}
                          </span>
                          {pc.name}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400" />
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Panneau droit : Détail de la section sélectionnée ── */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col">
          {/* Bilingual switch */}
          {isBilingual && (
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl p-1 mx-4 mt-4 mb-2 self-start">
              <button
                onClick={() => setCurrentTrack('FR')}
                className={cn('px-4 py-1.5 rounded-lg text-sm font-bold transition-all',
                  currentTrack === 'FR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500')}
              >
                Français
              </button>
              <button
                onClick={() => setCurrentTrack('EN')}
                className={cn('px-4 py-1.5 rounded-lg text-sm font-bold transition-all',
                  currentTrack === 'EN' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500')}
              >
                English
              </button>
            </div>
          )}

          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <Users className="w-3 h-3" /> Section physique
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    {selectedPhysicalClass?.name || 'Sélectionnez une section'}
                  </h3>
                  {selectedOfficialClass && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      (classe officielle : {selectedOfficialClass.name})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                  {isHomeroom
                    ? '★ Mode Titulaire — 1 enseignant pour toutes les matières'
                    : '🎓 Mode Spécialiste — 1 enseignant par matière'}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedPhysicalClass ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-400 text-xs font-bold">Sélectionnez une section physique à gauche</p>
              </div>
            ) : isHomeroom ? (
              /* ══ MODE TITULAIRE (Maternelle / Primaire) ══ */
              <div className="max-w-2xl mx-auto space-y-4">
                {/* Bannière */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start gap-3">
                  <Info className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Modèle Titulaire Unique</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed font-medium">
                      Un seul enseignant titulaire gère l'ensemble des matières de la section
                      <strong> {selectedPhysicalClass.name}</strong>.
                      Définissez-le ici — il sera automatiquement affecté
                      à toutes les {classSubjects.length} matières.
                    </p>
                  </div>
                </div>

                {/* Carte Titulaire */}
                <div className={cn(
                  'rounded-lg border p-5 bg-white shadow-sm transition-all',
                  homeroomFullyAssigned ? 'border-slate-200' : 'border-dashed border-slate-300',
                )}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${PRIMARY}15` }}>
                      {homeroomFullyAssigned
                        ? <UserCheck className="w-5 h-5" style={{ color: PRIMARY }} />
                        : <Star className="w-5 h-5 text-slate-400" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Titulaire</p>
                      {homeroomFullyAssigned && currentHomeroom ? (
                        <p className="text-base font-bold text-slate-900">
                          {currentHomeroom.lastName} {currentHomeroom.firstName}
                        </p>
                      ) : (
                        <p className="text-base font-bold text-slate-400">Non désigné</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {homeroomFullyAssigned ? (
                      <>
                        <button
                          onClick={() => { setSearch(''); setModal('assign-homeroom'); }}
                          disabled={bulkAssigning}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
                        >
                          <Replace className="w-3.5 h-3.5" /> Remplacer
                        </button>
                        <button
                          onClick={() => setModal('confirm-remove')}
                          disabled={bulkAssigning}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Retirer
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setSearch(''); setModal('assign-homeroom'); }}
                        disabled={bulkAssigning || classSubjects.length === 0}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
                        style={{ backgroundColor: PRIMARY }}
                      >
                        {bulkAssigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                        Désigner le titulaire
                      </button>
                    )}
                  </div>
                </div>

                {/* Liste des matières */}
                {classSubjects.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      {classSubjects.length} matière(s) de cette section
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {classSubjects.map(cs => (
                        <span key={cs.id} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700">
                          {cs.subject.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ══ MODE SPÉCIALISTE (Secondaire) ══ */
              <div className="space-y-3">
                {classSubjects.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 italic">
                    Aucune matière affectée à cette classe officielle.
                    Affectez d'abord des matières dans l'onglet « Matière & Programme ».
                  </div>
                ) : (
                  classSubjects.map(cs => {
                    const assignment = (cs.assignments || []).find(a => a.classId === selectedPhysicalClassId);
                    return (
                      <div key={cs.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{cs.subject.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                            Coeff. {cs.coefficient} · {cs.weeklyHours}h/sem
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {assignment ? (
                            <>
                              <span className="text-xs font-bold text-slate-700">
                                {assignment.teacher.lastName} {assignment.teacher.firstName}
                              </span>
                              <button
                                onClick={() => { setActiveSubject(cs); setModal('assign-teacher'); }}
                                className="text-[10px] font-semibold text-blue-600 hover:underline"
                              >
                                Remplacer
                              </button>
                              <button
                                onClick={() => { setRemovingAssignmentId(assignment.id); setModal('confirm-remove'); }}
                                className="text-[10px] font-semibold text-red-600 hover:underline"
                              >
                                Retirer
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => { setActiveSubject(cs); setModal('assign-teacher'); }}
                              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg text-white"
                              style={{ backgroundColor: PRIMARY }}
                            >
                              <UserPlus className="w-3 h-3" /> Affecter
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ Modals ══ */}

      {/* Modal: Assign Homeroom (Titulaire) */}
      <FormModal
        title={`Désigner le titulaire — ${selectedPhysicalClass?.name || ''}`}
        isOpen={modal === 'assign-homeroom'}
        onClose={() => { setModal('none'); setSearch(''); }}
        onConfirm={() => {}}
        size="large"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800">
              Sélectionnez l'enseignant titulaire pour la section <strong>{selectedPhysicalClass?.name}</strong>.
              Il sera affecté à toutes les {classSubjects.length} matières de cette section.
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un enseignant..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {eligibleTeachers.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">Aucun enseignant disponible.</p>
            ) : (
              eligibleTeachers
                .filter(t => {
                  if (!search) return true;
                  const s = search.toLowerCase();
                  return `${t.teacher.lastName} ${t.teacher.firstName}`.toLowerCase().includes(s)
                    || (t.teacher.matricule || '').toLowerCase().includes(s);
                })
                .map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleAssignHomeroom(t.teacher.id)}
                    disabled={bulkAssigning}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all text-left disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                      {t.teacher.firstName?.[0]}{t.teacher.lastName?.[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{t.teacher.lastName} {t.teacher.firstName}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{t.teacher.matricule} · {t.maxWeeklyHours}h/sem max</p>
                    </div>
                    <UserPlus className="w-4 h-4 ml-auto text-slate-400" />
                  </button>
                ))
            )}
          </div>
        </div>
      </FormModal>

      {/* Modal: Assign Teacher (Spécialiste) */}
      <FormModal
        title={`Affecter un enseignant — ${activeSubject?.subject?.name || ''}`}
        isOpen={modal === 'assign-teacher'}
        onClose={() => { setModal('none'); setSearch(''); }}
        onConfirm={() => {}}
        size="large"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              Section : <strong>{selectedPhysicalClass?.name}</strong> · Matière : <strong>{activeSubject?.subject?.name}</strong>
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-slate-400"
            />
          </div>

          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {eligibleTeachers
              .filter(t => {
                if (!search) return true;
                const s = search.toLowerCase();
                return `${t.teacher.lastName} ${t.teacher.firstName}`.toLowerCase().includes(s);
              })
              .map(t => (
                <button
                  key={t.id}
                  onClick={() => handleAssignTeacher(t.teacher.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                    {t.teacher.firstName?.[0]}{t.teacher.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{t.teacher.lastName} {t.teacher.firstName}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{t.teacher.matricule}</p>
                  </div>
                  <UserPlus className="w-4 h-4 ml-auto text-slate-400" />
                </button>
              ))}
          </div>
        </div>
      </FormModal>

      {/* Modal: Confirm Remove */}
      <ConfirmModal
        title="Confirmer la suppression"
        isOpen={modal === 'confirm-remove'}
        onClose={() => setModal('none')}
        onConfirm={() => {
          if (isHomeroom) {
            handleRemoveHomeroom();
          } else if (removingAssignmentId) {
            handleRemoveAssignment(removingAssignmentId);
            setRemovingAssignmentId(null);
          }
        }}
      >
        <p className="text-sm text-slate-600">
          {isHomeroom
            ? `Voulez-vous vraiment retirer le titulaire de la section ${selectedPhysicalClass?.name} ? Toutes les affectations de matières seront supprimées.`
            : 'Voulez-vous vraiment retirer cette affectation ?'}
        </p>
      </ConfirmModal>
    </div>
  );
}
