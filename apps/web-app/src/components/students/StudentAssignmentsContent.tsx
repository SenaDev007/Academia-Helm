'use client';

/**
 * ============================================================================
 * AFFECTATIONS — Assignation des élèves aux classes
 * ============================================================================
 *
 * Fonctionnalités :
 *   - Stats : classes ouvertes, élèves affectés, non affectés
 *   - Liste des élèves non affectés (avec recherche)
 *   - Assignation individuelle à une classe (select)
 *   - Liste des élèves affectés par classe (arborescence)
 *   - Changement de classe
 *
 * Selon MODULE ELEVES.md — Onglet 6
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Share2, Search, Loader2, UserCheck, Layers, Layout,
  ChevronDown, ChevronRight, Users, ArrowRight,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { studentsService } from '@/services/students.service';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string | null;
  studentCode?: string;
  status: string;
  isActive: boolean;
  schoolLevelId?: string;
}

interface ClassInfo {
  id: string;
  name: string;
  schoolLevelId: string;
  schoolLevel?: { id: string; name: string; code?: string };
}

interface Enrollment {
  id: string;
  student: Student;
  class?: { id: string; name: string };
  status: string;
}

export default function StudentAssignmentsContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [assigningStudentId, setAssigningStudentId] = useState<string | null>(null);
  // Multi-sélection pour affectation en lot
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(new Set());
  const [selectedAssigned, setSelectedAssigned] = useState<Set<string>>(new Set());
  const [bulkTargetClass, setBulkTargetClass] = useState<string>('');

  useEffect(() => {
    if (academicYear) loadData();
  }, [academicYear, schoolLevel]);

  const loadData = async () => {
    if (!academicYear) return;
    setIsLoading(true);
    try {
      const [studentsData, classesRes, enrollmentsData] = await Promise.all([
        studentsService.getAll({ academicYearId: academicYear.id }),
        fetch(`/api/all-classes`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
        studentsService.getEnrollments({ academicYearId: academicYear.id }),
      ]);

      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setClasses(Array.isArray(classesRes) ? classesRes : []);
      setEnrollments(Array.isArray(enrollmentsData) ? enrollmentsData : []);
    } catch (e: any) {
      console.error('Failed to load assignments:', e);
      toast({ title: 'Erreur', description: e.message || 'Impossible de charger les données', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Élèves non affectés (pas d'enrollment avec classId)
  const unassignedStudents = useMemo(() => {
    const assignedIds = new Set(
      enrollments.filter(e => e.class?.id).map(e => e.student.id)
    );
    return students.filter(s =>
      s.isActive &&
      !assignedIds.has(s.id) &&
      (searchQuery.trim() === '' ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.matricule || '').toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [students, enrollments, searchQuery]);

  // Élèves affectés groupés par classe
  const assignedByClass = useMemo(() => {
    const map = new Map<string, Enrollment[]>();
    for (const enr of enrollments) {
      if (enr.class?.id) {
        if (!map.has(enr.class.id)) map.set(enr.class.id, []);
        map.get(enr.class.id)!.push(enr);
      }
    }
    // Trier par nom
    for (const [, list] of map) {
      list.sort((a, b) =>
        `${a.student.lastName} ${a.student.firstName}`.localeCompare(
          `${b.student.lastName} ${b.student.firstName}`
        )
      );
    }
    return map;
  }, [enrollments]);

  const totalAssigned = enrollments.filter(e => e.class?.id).length;
  const totalUnassigned = unassignedStudents.length;

  const toggleClass = (classId: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const handleAssign = async (studentId: string, classId: string) => {
    if (!classId || !academicYear) return;
    setAssigningStudentId(studentId);
    try {
      await apiFetch('/students/change-class', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          academicYearId: academicYear.id,
          newClassId: classId,
        }),
      });
      toast({ title: '✅ Élève affecté', variant: 'success' });
      loadData();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Échec de l\'affectation', variant: 'error' });
    } finally {
      setAssigningStudentId(null);
    }
  };

  // Multi-affectation : affecter plusieurs élèves non affectés vers une classe
  const handleBulkAssign = async () => {
    if (!academicYear || !bulkTargetClass || selectedUnassigned.size === 0) return;
    setAssigningStudentId('bulk');
    try {
      const studentIds = Array.from(selectedUnassigned);
      await Promise.all(
        studentIds.map(id =>
          apiFetch('/students/change-class', {
            method: 'POST',
            body: JSON.stringify({
              studentId: id,
              academicYearId: academicYear.id,
              newClassId: bulkTargetClass,
            }),
          })
        )
      );
      toast({ title: `✅ ${studentIds.length} élève(s) affecté(s)`, variant: 'success' });
      setSelectedUnassigned(new Set());
      setBulkTargetClass('');
      loadData();
    } catch (e: any) {
      toast({ title: 'Erreur affectation en lot', description: e.message, variant: 'error' });
    } finally {
      setAssigningStudentId(null);
    }
  };

  // Multi-changement de classe : déplacer plusieurs élèves vers une nouvelle classe
  const handleBulkChangeClass = async () => {
    if (!academicYear || !bulkTargetClass || selectedAssigned.size === 0) return;
    setAssigningStudentId('bulk');
    try {
      const studentIds = Array.from(selectedAssigned);
      await Promise.all(
        studentIds.map(id =>
          apiFetch('/students/change-class', {
            method: 'POST',
            body: JSON.stringify({
              studentId: id,
              academicYearId: academicYear.id,
              newClassId: bulkTargetClass,
            }),
          })
        )
      );
      toast({ title: `✅ ${studentIds.length} élève(s) déplacé(s)`, variant: 'success' });
      setSelectedAssigned(new Set());
      setBulkTargetClass('');
      loadData();
    } catch (e: any) {
      toast({ title: 'Erreur changement en lot', description: e.message, variant: 'error' });
    } finally {
      setAssigningStudentId(null);
    }
  };

  const toggleUnassignedSelection = (studentId: string) => {
    setSelectedUnassigned(prev => {
      const next = new Set(prev);
      next.has(studentId) ? next.delete(studentId) : next.add(studentId);
      return next;
    });
  };

  const toggleAssignedSelection = (studentId: string) => {
    setSelectedAssigned(prev => {
      const next = new Set(prev);
      next.has(studentId) ? next.delete(studentId) : next.add(studentId);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50"><Layout className="w-5 h-5 text-blue-600" /></div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Classes ouvertes</p>
            <p className="text-lg font-bold text-slate-900">{classes.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50"><UserCheck className="w-5 h-5 text-emerald-600" /></div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Affectés</p>
            <p className="text-lg font-bold text-slate-900">{totalAssigned}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50"><Layers className="w-5 h-5 text-amber-600" /></div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Non affectés</p>
            <p className="text-lg font-bold text-slate-900">{totalUnassigned}</p>
          </div>
        </div>
      </div>

      {/* Layout 2 colonnes : Non affectés | Affectés par classe */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Colonne gauche : Élèves non affectés */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 bg-amber-50/50">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" />
              Élèves non affectés ({totalUnassigned})
            </h3>
          </div>
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            ) : totalUnassigned === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <UserCheck className="w-10 h-10 text-emerald-300 mb-2" />
                <p className="text-sm text-slate-500">Tous les élèves sont affectés !</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {/* Barre d'action en lot */}
                {selectedUnassigned.size > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border-b border-blue-100">
                    <span className="text-xs font-bold text-blue-700">{selectedUnassigned.size} sélectionné(s)</span>
                    <select
                      value={bulkTargetClass}
                      onChange={(e) => setBulkTargetClass(e.target.value)}
                      className="text-xs border border-blue-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                    >
                      <option value="">Classe cible...</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleBulkAssign}
                      disabled={!bulkTargetClass || assigningStudentId === 'bulk'}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {assigningStudentId === 'bulk' ? '...' : 'Affecter'}
                    </button>
                    <button
                      onClick={() => setSelectedUnassigned(new Set())}
                      className="px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {unassignedStudents.map(student => (
                  <div key={student.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedUnassigned.has(student.id)}
                      onChange={() => toggleUnassignedSelection(student.id)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                      {student.lastName[0]}{student.firstName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {student.lastName.toUpperCase()} {student.firstName}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">
                        {student.matricule || student.studentCode || '—'}
                      </p>
                    </div>
                    <select
                      value=""
                      onChange={(e) => e.target.value && handleAssign(student.id, e.target.value)}
                      disabled={assigningStudentId === student.id}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 shrink-0"
                    >
                      <option value="">Assigner...</option>
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite : Élèves affectés par classe */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 bg-emerald-50/50">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              Élèves affectés par classe
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {classes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Layout className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">Aucune classe configurée</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {/* Tri pédagogique : Maternelle < Primaire < Secondaire, puis CI < CP < ... < CM2 */}
                {[...classes].sort((a, b) => {
                  // Tri par niveau
                  const levelOrder = (name: string) => {
                    const n = (name || '').toUpperCase();
                    if (n.includes('MATERNELLE')) return 0;
                    if (n.includes('PRIMAIRE')) return 1;
                    if (n.includes('SECONDAIRE')) return 2;
                    return 3;
                  };
                  const aLevel = levelOrder(a.schoolLevel?.name || '');
                  const bLevel = levelOrder(b.schoolLevel?.name || '');
                  if (aLevel !== bLevel) return aLevel - bLevel;

                  // Tri par classe dans le niveau
                  const classOrder = (name: string): number => {
                    const n = (name || '').trim().toUpperCase();
                    if (n === 'MATERNELLE 1' || n === 'M1' || n === 'MAT1') return 0;
                    if (n === 'MATERNELLE 2' || n === 'M2' || n === 'MAT2') return 1;
                    if (n === 'CI') return 10;
                    if (n === 'CP') return 11;
                    if (n === 'CE1') return 12;
                    if (n === 'CE2') return 13;
                    if (n === 'CM1') return 14;
                    if (n === 'CM2') return 15;
                    if (n.startsWith('6')) return 20;
                    if (n.startsWith('5')) return 21;
                    if (n.startsWith('4')) return 22;
                    if (n.startsWith('3')) return 23;
                    if (n.startsWith('2NDE')) return 24;
                    if (n.startsWith('1ER')) return 25;
                    if (n.startsWith('TERM') || n.startsWith('TLE')) return 26;
                    return 100 + name.charCodeAt(0);
                  };
                  return classOrder(a.name) - classOrder(b.name);
                }).map(cls => {
                  const studentsInClass = assignedByClass.get(cls.id) || [];
                  const isExpanded = expandedClasses.has(cls.id);
                  return (
                    <div key={cls.id}>
                      <button
                        onClick={() => toggleClass(cls.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left group"
                      >
                        <div className="shrink-0 pl-1">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div className="p-1.5 bg-slate-100 rounded-lg shrink-0"><Users className="w-4 h-4 text-slate-500" /></div>
                        <span className="flex-1 text-sm font-semibold text-slate-700">{cls.name}</span>
                        <span className="px-2 py-0.5 bg-emerald-50 rounded-full text-[10px] font-bold text-emerald-700 shrink-0">
                          {studentsInClass.length}
                        </span>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            {studentsInClass.length === 0 ? (
                              <p className="px-4 py-2 text-xs text-slate-400 italic pl-12">Aucun élève</p>
                            ) : (
                              <div className="pl-12 pr-4 py-1">
                                {/* Barre d'action en lot (changement de classe) */}
                                {selectedAssigned.size > 0 && (
                                  <div className="flex items-center gap-2 p-2 mb-1 bg-amber-50 rounded-lg border border-amber-100">
                                    <span className="text-[10px] font-bold text-amber-700">{selectedAssigned.size} sélectionné(s)</span>
                                    <select
                                      value={bulkTargetClass}
                                      onChange={(e) => setBulkTargetClass(e.target.value)}
                                      className="text-[10px] border border-amber-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1"
                                    >
                                      <option value="">Nouvelle classe...</option>
                                      {classes.filter(c => c.id !== cls.id).map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={handleBulkChangeClass}
                                      disabled={!bulkTargetClass || assigningStudentId === 'bulk'}
                                      className="px-2 py-1 text-[10px] font-bold text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50"
                                    >
                                      {assigningStudentId === 'bulk' ? '...' : 'Déplacer'}
                                    </button>
                                    <button
                                      onClick={() => setSelectedAssigned(new Set())}
                                      className="px-1.5 py-1 text-[10px] text-slate-500 hover:bg-slate-100 rounded"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )}
                                {studentsInClass.map((enr, idx) => (
                                  <div key={enr.id} className="flex items-center gap-3 py-1.5 px-2 hover:bg-slate-50 rounded-lg transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={selectedAssigned.has(enr.student.id)}
                                      onChange={() => toggleAssignedSelection(enr.student.id)}
                                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                                    />
                                    <span className="text-[10px] font-mono text-slate-400 w-5 text-right">{idx + 1}</span>
                                    <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                                      {enr.student.lastName[0]}{enr.student.firstName[0]}
                                    </div>
                                    <span className="text-sm text-slate-700 flex-1">
                                      {enr.student.lastName.toUpperCase()} {enr.student.firstName}
                                    </span>
                                    {/* Changement de classe individuel */}
                                    <select
                                      value=""
                                      onChange={(e) => e.target.value && handleAssign(enr.student.id, e.target.value)}
                                      className="text-[10px] border border-slate-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
                                    >
                                      <option value="">Changer...</option>
                                      {classes.filter(c => c.id !== cls.id).map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                      ))}
                                    </select>
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
          </div>
        </div>
      </div>
    </div>
  );
}
