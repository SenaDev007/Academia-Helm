/**
 * ============================================================================
 * ENROLLMENTS CONTENT — Onglet Inscriptions (structure arborescente)
 * ============================================================================
 *
 * Affichage hiérarchique :
 *   Niveau scolaire (Maternelle, Primaire, Secondaire)
 *     └── Classe (Maternelle 1, Maternelle 2, CI, CP, CE1, ...)
 *           └── Élèves (liste alphabétique)
 *
 * Options par classe :
 *   - Visualisation de la liste dans l'application
 *   - Génération PDF de la liste
 *
 * Bouton "Classes" supprimé (plus besoin).
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, ChevronDown, ChevronRight, Users, Loader2,
  FileText, Download, UserCheck, GraduationCap, BookOpen,
} from 'lucide-react';
import { FormModal } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { motion, AnimatePresence } from 'framer-motion';
import StudentEnrollmentForm from '@/components/students/StudentEnrollmentForm';
import { studentsService } from '@/services/students.service';
import { financeService } from '@/services/finance.service';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface Enrollment {
  id: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    matricule?: string | null;
    studentCode?: string;
    gender?: string | null;
  };
  class?: { id: string; name: string; schoolLevelId?: string };
  enrollmentType: string;
  enrollmentDate: string;
  status: string;
}

interface SchoolLevel {
  id: string;
  name: string;
  code?: string;
  order?: number;
}

interface ClassInfo {
  id: string;
  name: string;
  schoolLevelId: string;
}

export default function EnrollmentsContent() {
  const { academicYear, schoolLevel, tenantId } = useModuleContext();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [schoolLevels, setSchoolLevels] = useState<SchoolLevel[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // État d'expansion des niveaux et classes
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());

  // ─── Chargement des données ──────────────────────────────────────────────
  useEffect(() => {
    if (academicYear) loadData();
  }, [academicYear, schoolLevel]);

  const loadData = async () => {
    if (!academicYear) return;
    setIsLoading(true);
    try {
      // Charger en parallèle : niveaux, classes, inscriptions
      const [levelsRes, classesRes, enrollmentsData] = await Promise.all([
        fetch('/api/school-levels', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
        fetch(`/api/classes?limit=200`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
        studentsService.getEnrollments({ academicYearId: academicYear.id }),
      ]);

      setSchoolLevels(Array.isArray(levelsRes) ? levelsRes : []);
      setClasses(Array.isArray(classesRes) ? classesRes : []);
      setEnrollments(Array.isArray(enrollmentsData) ? enrollmentsData : []);
    } catch (e: any) {
      console.error('Failed to load enrollments:', e);
      toast({ title: 'Erreur', description: e.message || 'Impossible de charger les données', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Groupage : niveau → classes → élèves ───────────────────────────────
  const treeData = useMemo(() => {
    // Grouper les classes par niveau
    const classesByLevel = new Map<string, ClassInfo[]>();
    for (const cls of classes) {
      if (!classesByLevel.has(cls.schoolLevelId)) {
        classesByLevel.set(cls.schoolLevelId, []);
      }
      classesByLevel.get(cls.schoolLevelId)!.push(cls);
    }

    // Grouper les inscriptions par classe
    const enrollmentsByClass = new Map<string, Enrollment[]>();
    for (const enr of enrollments) {
      const classId = enr.class?.id || 'unassigned';
      if (!enrollmentsByClass.has(classId)) {
        enrollmentsByClass.set(classId, []);
      }
      enrollmentsByClass.get(classId)!.push(enr);
    }

    // Trier les élèves par nom dans chaque classe
    for (const [classId, list] of enrollmentsByClass) {
      list.sort((a, b) => {
        const nameA = `${a.student.lastName} ${a.student.firstName}`.toLowerCase();
        const nameB = `${b.student.lastName} ${b.student.firstName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }

    // Construire l'arbre
    return schoolLevels
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(level => {
        const levelClasses = (classesByLevel.get(level.id) || []).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        const levelEnrollments = enrollments.filter(e => {
          const cls = classes.find(c => c.id === e.class?.id);
          return cls?.schoolLevelId === level.id;
        });
        return {
          level,
          classes: levelClasses.map(cls => ({
            classInfo: cls,
            students: enrollmentsByClass.get(cls.id) || [],
          })),
          totalStudents: levelEnrollments.length,
        };
      });
  }, [schoolLevels, classes, enrollments, searchQuery]);

  // ─── Filtrage par recherche ─────────────────────────────────────────────
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return treeData;
    const q = searchQuery.toLowerCase();
    return treeData.map(node => ({
      ...node,
      classes: node.classes.map(c => ({
        ...c,
        students: c.students.filter(s =>
          `${s.student.lastName} ${s.student.firstName}`.toLowerCase().includes(q) ||
          (s.student.matricule || '').toLowerCase().includes(q)
        ),
      })),
    }));
  }, [treeData, searchQuery]);

  // ─── Toggle expansion ────────────────────────────────────────────────────
  const toggleLevel = (levelId: string) => {
    setExpandedLevels(prev => {
      const next = new Set(prev);
      if (next.has(levelId)) next.delete(levelId);
      else next.add(levelId);
      return next;
    });
  };

  const toggleClass = (classId: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  // ─── Stats globales ──────────────────────────────────────────────────────
  const totalActive = enrollments.filter(e => e.status === 'ACTIVE' || e.status === 'VALIDATED').length;
  const totalNew = enrollments.filter(e => e.enrollmentType === 'NEW').length;
  const totalPending = enrollments.filter(e => e.status === 'PENDING' || e.status === 'PRE_REGISTERED').length;

  return (
    <>
      <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
        {/* Header Stat Cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Élèves inscrits', value: totalActive, icon: <UserCheck className="w-5 h-5 text-emerald-600" />, color: 'bg-emerald-50' },
            { label: 'Nouveaux', value: totalNew, icon: <Plus className="w-5 h-5 text-blue-600" />, color: 'bg-blue-50' },
            { label: 'En attente', value: totalPending, icon: <Users className="w-5 h-5 text-amber-600" />, color: 'bg-amber-50' },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className={cn('p-2.5 rounded-lg', stat.color)}>{stat.icon}</div>
              <div>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-lg font-bold text-slate-900">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un élève ou matricule..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
            />
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-md shadow-blue-200 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Inscription
          </button>
        </div>

        {/* Arborescence Niveau → Classe → Élèves */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-slate-500 font-medium">Chargement des inscriptions...</p>
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                <GraduationCap className="w-8 h-8" />
              </div>
              <p className="text-slate-500 font-medium">Aucun niveau scolaire configuré</p>
              <p className="text-xs text-slate-400">Configurez les niveaux dans Paramètres → Structure académique</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTree.map((node) => {
                const isExpanded = expandedLevels.has(node.level.id);
                const hasClasses = node.classes.length > 0;

                return (
                  <div key={node.level.id}>
                    {/* ─── NIVEAU ─── */}
                    <button
                      onClick={() => toggleLevel(node.level.id)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left group"
                    >
                      <div className="shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                        )}
                      </div>
                      <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                        <BookOpen className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800">{node.level.name}</p>
                        <p className="text-xs text-slate-500">
                          {node.classes.length} classe{node.classes.length > 1 ? 's' : ''} · {node.totalStudents} élève{node.totalStudents > 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600 shrink-0">
                        {node.totalStudents}
                      </span>
                    </button>

                    {/* ─── CLASSES du niveau ─── */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          {!hasClasses ? (
                            <p className="px-5 py-3 text-xs text-slate-400 italic pl-14">
                              Aucune classe configurée pour ce niveau
                            </p>
                          ) : (
                            <div className="divide-y divide-slate-50">
                              {node.classes.map(({ classInfo, students }) => {
                                const isClassExpanded = expandedClasses.has(classInfo.id);
                                const filteredStudents = searchQuery.trim()
                                  ? students.filter(s =>
                                      `${s.student.lastName} ${s.student.firstName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                      (s.student.matricule || '').toLowerCase().includes(searchQuery.toLowerCase())
                                    )
                                  : students;

                                return (
                                  <div key={classInfo.id}>
                                    {/* En-tête classe */}
                                    <button
                                      onClick={() => toggleClass(classInfo.id)}
                                      className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-blue-50/30 transition-colors text-left group"
                                    >
                                      <div className="shrink-0 pl-6">
                                        {isClassExpanded ? (
                                          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                                        ) : (
                                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                                        )}
                                      </div>
                                      <div className="p-1.5 bg-slate-100 rounded-lg shrink-0">
                                        <Users className="w-4 h-4 text-slate-500" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-700">{classInfo.name}</p>
                                      </div>
                                      <span className="px-2 py-0.5 bg-blue-50 rounded-full text-[10px] font-bold text-blue-700 shrink-0">
                                        {filteredStudents.length} élève{filteredStudents.length > 1 ? 's' : ''}
                                      </span>
                                      {/* Actions classe */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toast({ title: 'Liste de classe', description: `${classInfo.name} — ${filteredStudents.length} élèves`, variant: 'info' });
                                          }}
                                          className="p-1.5 hover:bg-blue-100 rounded-lg text-slate-400 hover:text-blue-600 transition"
                                          title="Visualiser la liste"
                                        >
                                          <FileText className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toast({ title: 'Génération PDF', description: `Liste de ${classInfo.name} — à implémenter`, variant: 'info' });
                                          }}
                                          className="p-1.5 hover:bg-emerald-100 rounded-lg text-slate-400 hover:text-emerald-600 transition"
                                          title="Générer PDF"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </button>

                                    {/* Liste des élèves */}
                                    <AnimatePresence>
                                      {isClassExpanded && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.15 }}
                                          className="overflow-hidden"
                                        >
                                          {filteredStudents.length === 0 ? (
                                            <p className="px-5 py-2 text-xs text-slate-400 italic pl-16">
                                              Aucun élève dans cette classe
                                            </p>
                                          ) : (
                                            <div className="pl-14 pr-5 py-1">
                                              {filteredStudents.map((enr, idx) => (
                                                <div
                                                  key={enr.id}
                                                  className="flex items-center gap-3 py-2 px-3 hover:bg-slate-50 rounded-lg transition-colors group"
                                                >
                                                  <span className="text-[10px] font-mono text-slate-400 w-6 text-right shrink-0">
                                                    {idx + 1}
                                                  </span>
                                                  <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shrink-0">
                                                    {enr.student.lastName[0]}{enr.student.firstName[0]}
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-800">
                                                      {enr.student.lastName.toUpperCase()} {enr.student.firstName}
                                                    </p>
                                                    <p className="text-[10px] font-mono text-slate-400">
                                                      {enr.student.matricule || enr.student.studentCode || '—'}
                                                    </p>
                                                  </div>
                                                  <span className={cn(
                                                    'px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0',
                                                    enr.status === 'ACTIVE' || enr.status === 'VALIDATED'
                                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                      : enr.status === 'PENDING' || enr.status === 'PRE_REGISTERED'
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                        : 'bg-slate-50 text-slate-600 border-slate-200'
                                                  )}>
                                                    {enr.status === 'ACTIVE' || enr.status === 'VALIDATED' ? 'Inscrit' :
                                                     enr.status === 'PRE_REGISTERED' ? 'Pré-inscrit' :
                                                     enr.status === 'PENDING' ? 'En attente' : enr.status}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <FormModal
        title="Nouvelle inscription"
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        size="xl"
        actions={null}
      >
        {academicYear && schoolLevel ? (
          <StudentEnrollmentForm
            academicYearId={academicYear.id}
            schoolLevelId={schoolLevel.id}
            onSubmit={async (data) => {
              try {
                let student: any;
                if (data.operation === 'PRE_REGISTER') {
                  student = await studentsService.preRegister({
                    academicYearId: academicYear.id,
                    schoolLevelId: schoolLevel.id,
                    firstName: data.student.firstName,
                    lastName: data.student.lastName,
                    dateOfBirth: data.student.dateOfBirth,
                    gender: data.student.gender,
                    nationality: data.student.nationality,
                    placeOfBirth: data.student.placeOfBirth,
                    photoUrl: data.student.photoUrl,
                    regimeType: undefined,
                    classId: data.classId,
                  });
                } else {
                  student = await studentsService.create({
                    ...data.student,
                    academicYearId: academicYear.id,
                    schoolLevelId: schoolLevel.id,
                  });
                }
                await financeService.createStudentFeeProfile({
                  studentId: student.id,
                  academicYearId: academicYear.id,
                  feeRegimeId: data.feeProfile.feeRegimeId,
                  justification: data.feeProfile.justification,
                }).catch(() => undefined);
                if (data.guardians?.length) {
                  for (const g of data.guardians) {
                    if (!g.firstName?.trim() && !g.lastName?.trim()) continue;
                    await studentsService.addGuardians(student.id, {
                      guardians: [{
                        firstName: g.firstName,
                        lastName: g.lastName,
                        relationship: g.relationship || 'GUARDIAN',
                        phone: g.phone,
                        email: g.email,
                        isPrimary: g.isPrimary ?? false,
                      }]
                    }).catch(() => undefined);
                  }
                }
                if (data.classId && data.operation === 'ADMIT') {
                  await studentsService.enrollStudent(student.id, {
                    academicYearId: academicYear.id,
                    schoolLevelId: schoolLevel.id,
                    classId: data.classId,
                    enrollmentType: 'NEW',
                    enrollmentDate: new Date().toISOString(),
                  }).catch(() => undefined);
                }
                toast({ title: 'Succès', description: 'Inscription effectuée avec succès', variant: 'success' });
                setIsCreateModalOpen(false);
                loadData();
              } catch (e: any) {
                toast({ title: 'Erreur', description: e.message || 'Erreur lors de l\'inscription', variant: 'error' });
              }
            }}
            onCancel={() => setIsCreateModalOpen(false)}
          />
        ) : (
          <div className="text-center py-8 text-sm text-gray-600">
            Veuillez sélectionner une année scolaire et un niveau
          </div>
        )}
      </FormModal>
    </>
  );
}
