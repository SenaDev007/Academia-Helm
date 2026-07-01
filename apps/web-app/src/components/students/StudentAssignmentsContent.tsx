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

  useEffect(() => {
    if (academicYear) loadData();
  }, [academicYear, schoolLevel]);

  const loadData = async () => {
    if (!academicYear) return;
    setIsLoading(true);
    try {
      const [studentsData, classesRes, enrollmentsData] = await Promise.all([
        studentsService.getAll({ academicYearId: academicYear.id }),
        fetch(`/api/classes?limit=200`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
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
                {unassignedStudents.map(student => (
                  <div key={student.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors">
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
                {classes.map(cls => {
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
                                {studentsInClass.map((enr, idx) => (
                                  <div key={enr.id} className="flex items-center gap-3 py-1.5 px-2 hover:bg-slate-50 rounded-lg transition-colors">
                                    <span className="text-[10px] font-mono text-slate-400 w-5 text-right">{idx + 1}</span>
                                    <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                                      {enr.student.lastName[0]}{enr.student.firstName[0]}
                                    </div>
                                    <span className="text-sm text-slate-700 flex-1">
                                      {enr.student.lastName.toUpperCase()} {enr.student.firstName}
                                    </span>
                                    {/* Changement de classe */}
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
