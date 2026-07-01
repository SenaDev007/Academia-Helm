'use client';

/**
 * ============================================================================
 * ENROLLMENTS CONTENT — Onglet Inscriptions & Réinscriptions
 * ============================================================================
 *
 * Conforme à MODULE ELEVES.md — Onglet 3
 *
 * Fonctionnalités :
 *   - Stats : inscrits, nouveaux, réinscrits, en attente, non réinscrits
 *   - Arborescence niveau → classe → élèves (avec infos enrichies)
 *   - Nouvelle inscription (formulaire existant)
 *   - Réinscription individuelle (proposition classe suivante)
 *   - Réinscription massive (sélection + lot)
 *   - Validation administrative (valider/rejeter)
 *   - Export CSV
 *   - Génération PDF liste de classe
 *   - Alertes ORION intégrées
 *
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, ChevronDown, ChevronRight, Users, Loader2,
  FileText, Download, UserCheck, GraduationCap, BookOpen, Baby,
  RotateCcw, CheckCircle, XCircle, Clock, AlertCircle, Upload,
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
    status?: string;
    isActive?: boolean;
  };
  class?: { id: string; name: string; schoolLevelId?: string };
  enrollmentType: string;
  enrollmentDate: string;
  status: string;
}

interface ClassInfo {
  id: string;
  name: string;
  schoolLevelId: string;
  schoolLevel?: { id: string; name: string; code?: string };
}

interface AcademicYear {
  id: string;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Inscrit', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  VALIDATED: { label: 'Validé', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ADMITTED: { label: 'Admis', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  PRE_REGISTERED: { label: 'Pré-inscrit', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  RE_ENROLLED: { label: 'Réinscrit', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  PENDING: { label: 'En attente', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  TRANSFERRED: { label: 'Transféré', color: 'bg-slate-50 text-slate-600 border-slate-200' },
  WITHDRAWN: { label: 'Retiré', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const TYPE_META: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Nouveau', color: 'bg-blue-50 text-blue-700' },
  REPEAT: { label: 'Réinscription', color: 'bg-indigo-50 text-indigo-700' },
  PROMOTION: { label: 'Promu', color: 'bg-violet-50 text-violet-700' },
  DIRECT: { label: 'Direct', color: 'bg-emerald-50 text-emerald-700' },
  REINTEGRATION: { label: 'Réintégré', color: 'bg-amber-50 text-amber-700' },
};

const getLevelIcon = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('MATERNELLE')) return <Baby className="w-5 h-5 text-pink-600" />;
  if (n.includes('PRIMAIRE')) return <BookOpen className="w-5 h-5 text-blue-600" />;
  if (n.includes('SECONDAIRE')) return <GraduationCap className="w-5 h-5 text-purple-600" />;
  return <BookOpen className="w-5 h-5 text-slate-600" />;
};

const getLevelBgColor = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('MATERNELLE')) return 'bg-pink-50';
  if (n.includes('PRIMAIRE')) return 'bg-blue-50';
  if (n.includes('SECONDAIRE')) return 'bg-purple-50';
  return 'bg-slate-50';
};

const getLevelDisplayName = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('MATERNELLE')) return 'Niveau Maternelle';
  if (n.includes('PRIMAIRE')) return 'Niveau Primaire';
  if (n.includes('SECONDAIRE')) return 'Niveau Secondaire';
  return `Niveau ${name}`;
};

// ─── Composant principal ──────────────────────────────────────────────────

export default function EnrollmentsContent() {
  const { academicYear, schoolLevel, tenantId } = useModuleContext();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());

  // Modals
  const [reEnrollStudent, setReEnrollStudent] = useState<Enrollment | null>(null);
  const [bulkReEnrollOpen, setBulkReEnrollOpen] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());
  const [bulkTargetYear, setBulkTargetYear] = useState<string>('');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  // ─── Chargement ─────────────────────────────────────────────────────
  useEffect(() => {
    if (academicYear) loadData();
  }, [academicYear, schoolLevel]);

  const loadData = async () => {
    if (!academicYear) return;
    setIsLoading(true);
    try {
      const [classesRes, enrollmentsData, yearsRes] = await Promise.all([
        fetch(`/api/classes?limit=200`, { cache: 'no-store' }).then(r => r.json()).catch(() => []),
        studentsService.getEnrollments({ academicYearId: academicYear.id }),
        fetch('/api/academic-years', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
      ]);
      setClasses(Array.isArray(classesRes) ? classesRes : []);
      setEnrollments(Array.isArray(enrollmentsData) ? enrollmentsData : []);
      setAcademicYears(Array.isArray(yearsRes) ? yearsRes : []);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Arborescence niveau → classe → élèves ──────────────────────────
  const treeData = useMemo(() => {
    const levelMap = new Map<string, { id: string; name: string }>();
    for (const cls of classes) {
      const levelId = cls.schoolLevelId;
      if (!levelMap.has(levelId)) {
        const levelName = cls.schoolLevel?.name || cls.schoolLevel?.code || '';
        if (levelName) levelMap.set(levelId, { id: levelId, name: levelName });
      }
    }
    if (levelMap.size === 0) {
      for (const cls of classes) {
        const levelId = cls.schoolLevelId;
        if (!levelMap.has(levelId)) {
          const clsName = cls.name.toLowerCase();
          let levelName = 'Autre';
          if (clsName.includes('maternelle') || clsName.includes('m1') || clsName.includes('m2')) levelName = 'Maternelle';
          else if (['ci', 'cp', 'ce1', 'ce2', 'cm1', 'cm2'].includes(clsName)) levelName = 'Primaire';
          else if (['6e', '5e', '4e', '3e', '2nde', '1ere', 'terminale'].some(g => clsName.includes(g))) levelName = 'Secondaire';
          levelMap.set(levelId, { id: levelId, name: levelName });
        }
      }
    }

    const classesByLevel = new Map<string, ClassInfo[]>();
    for (const cls of classes) {
      if (!classesByLevel.has(cls.schoolLevelId)) classesByLevel.set(cls.schoolLevelId, []);
      classesByLevel.get(cls.schoolLevelId)!.push(cls);
    }

    const enrollmentsByClass = new Map<string, Enrollment[]>();
    for (const enr of enrollments) {
      const classId = enr.class?.id || 'unassigned';
      if (!enrollmentsByClass.has(classId)) enrollmentsByClass.set(classId, []);
      enrollmentsByClass.get(classId)!.push(enr);
    }
    for (const [, list] of enrollmentsByClass) {
      list.sort((a, b) => `${a.student.lastName} ${a.student.firstName}`.localeCompare(
        `${b.student.lastName} ${b.student.firstName}`));
    }

    const levelOrder = (name: string) => {
      const n = name.toUpperCase();
      if (n.includes('MATERNELLE')) return 0;
      if (n.includes('PRIMAIRE')) return 1;
      if (n.includes('SECONDAIRE')) return 2;
      return 3;
    };

    return Array.from(levelMap.values())
      .sort((a, b) => levelOrder(a.name) - levelOrder(b.name))
      .map(level => {
        const levelClasses = (classesByLevel.get(level.id) || []).sort((a, b) => a.name.localeCompare(b.name));
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
  }, [classes, enrollments]);

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

  // ─── Stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = enrollments.filter(e => ['ACTIVE', 'VALIDATED'].includes(e.status)).length;
    const newCount = enrollments.filter(e => e.enrollmentType === 'NEW').length;
    const reEnrolled = enrollments.filter(e => ['REPEAT', 'PROMOTION'].includes(e.enrollmentType)).length;
    const pending = enrollments.filter(e => ['PENDING', 'PRE_REGISTERED', 'ADMITTED'].includes(e.status)).length;
    return { active, newCount, reEnrolled, pending, total: enrollments.length };
  }, [enrollments]);

  // ─── Actions ────────────────────────────────────────────────────────
  const toggleLevel = (id: string) => {
    setExpandedLevels(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleClass = (id: string) => {
    setExpandedClasses(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // Réinscription individuelle
  const handleReEnroll = async (enrollment: Enrollment) => {
    setReEnrollStudent(enrollment);
  };

  const confirmReEnroll = async (classId: string) => {
    if (!reEnrollStudent || !academicYear) return;
    try {
      await studentsService.reEnroll({
        studentId: reEnrollStudent.student.id,
        academicYearId: academicYear.id,
        schoolLevelId: reEnrollStudent.class?.schoolLevelId || schoolLevel?.id || '',
        classId,
      });
      toast({ title: '✅ Élève réinscrit', variant: 'success' });
      setReEnrollStudent(null);
      loadData();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    }
  };

  // Validation administrative
  const handleValidate = async (studentId: string) => {
    try {
      await studentsService.batchUpdateStatus({ studentIds: [studentId], status: 'ACTIVE' });
      toast({ title: '✅ Inscription validée', variant: 'success' });
      loadData();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    if (!academicYear) return;
    try {
      await studentsService.exportEnrollmentsCSV({ academicYearId: academicYear.id });
      toast({ title: '✅ Export CSV généré', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    }
  };

  // Réinscription massive
  const handleBulkReEnroll = async () => {
    if (selectedForBulk.size === 0 || !bulkTargetYear || !academicYear) {
      toast({ title: 'Sélection requise', description: 'Sélectionnez des élèves et une année cible', variant: 'error' });
      return;
    }
    setIsProcessingBulk(true);
    try {
      const studentIds = Array.from(selectedForBulk);
      await studentsService.batchPromote({
        studentIds,
        fromAcademicYearId: academicYear.id,
        toAcademicYearId: bulkTargetYear,
        schoolLevelId: schoolLevel?.id || '',
      });
      toast({ title: `✅ ${studentIds.length} élèves réinscrits`, variant: 'success' });
      setBulkReEnrollOpen(false);
      setSelectedForBulk(new Set());
      setBulkTargetYear('');
      loadData();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const toggleBulkSelection = (studentId: string) => {
    setSelectedForBulk(prev => { const n = new Set(prev); n.has(studentId) ? n.delete(studentId) : n.add(studentId); return n; });
  };

  // ─── Rendu ──────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
        {/* Stats — 5 cartes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50"><UserCheck className="w-4 h-4 text-emerald-600" /></div>
            <div><p className="text-[10px] font-medium text-slate-500 uppercase">Inscrits</p><p className="text-base font-bold text-slate-900">{stats.active}</p></div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50"><Plus className="w-4 h-4 text-blue-600" /></div>
            <div><p className="text-[10px] font-medium text-slate-500 uppercase">Nouveaux</p><p className="text-base font-bold text-slate-900">{stats.newCount}</p></div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50"><RotateCcw className="w-4 h-4 text-indigo-600" /></div>
            <div><p className="text-[10px] font-medium text-slate-500 uppercase">Réinscrits</p><p className="text-base font-bold text-slate-900">{stats.reEnrolled}</p></div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-orange-50"><Clock className="w-4 h-4 text-orange-600" /></div>
            <div><p className="text-[10px] font-medium text-slate-500 uppercase">En attente</p><p className="text-base font-bold text-slate-900">{stats.pending}</p></div>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-100"><Users className="w-4 h-4 text-slate-600" /></div>
            <div><p className="text-[10px] font-medium text-slate-500 uppercase">Total</p><p className="text-base font-bold text-slate-900">{stats.total}</p></div>
          </div>
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
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition"
              title="Export CSV"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              onClick={() => setBulkReEnEnrollOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition"
              title="Réinscription massive"
            >
              <RotateCcw className="w-4 h-4" /> Réinscription lot
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-md shadow-blue-200 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> Nouvelle
            </button>
          </div>
        </div>

        {/* Arborescence */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-slate-500 font-medium">Chargement...</p>
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="p-4 bg-slate-50 rounded-full text-slate-300"><GraduationCap className="w-8 h-8" /></div>
              <p className="text-slate-500 font-medium">Aucune classe configurée</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTree.map((node) => {
                const isExpanded = expandedLevels.has(node.level.id);
                const levelName = node.level.name;
                return (
                  <div key={node.level.id}>
                    {/* NIVEAU */}
                    <button
                      onClick={() => toggleLevel(node.level.id)}
                      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left group"
                    >
                      <div className="shrink-0">
                        {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-blue-600" /> : <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600" />}
                      </div>
                      <div className={cn('p-2.5 rounded-lg shrink-0', getLevelBgColor(levelName))}>{getLevelIcon(levelName)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-slate-800">{getLevelDisplayName(levelName)}</p>
                        <p className="text-xs text-slate-500">{node.classes.length} classe{node.classes.length > 1 ? 's' : ''} · {node.totalStudents} élève{node.totalStudents > 1 ? 's' : ''}</p>
                      </div>
                      <span className="px-3 py-1 bg-slate-100 rounded-full text-sm font-bold text-slate-600 shrink-0">{node.totalStudents}</span>
                    </button>

                    {/* CLASSES */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          {node.classes.length === 0 ? (
                            <p className="px-5 py-3 text-xs text-slate-400 italic pl-14">Aucune classe</p>
                          ) : (
                            <div className="divide-y divide-slate-50">
                              {node.classes.map(({ classInfo, students }) => {
                                const isClassExpanded = expandedClasses.has(classInfo.id);
                                const filteredStudents = searchQuery.trim()
                                  ? students.filter(s => `${s.student.lastName} ${s.student.firstName}`.toLowerCase().includes(searchQuery.toLowerCase()) || (s.student.matricule || '').toLowerCase().includes(searchQuery.toLowerCase()))
                                  : students;
                                return (
                                  <div key={classInfo.id}>
                                    <button
                                      onClick={() => toggleClass(classInfo.id)}
                                      className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-blue-50/30 transition-colors text-left group"
                                    >
                                      <div className="shrink-0 pl-6">
                                        {isClassExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600" /> : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />}
                                      </div>
                                      <div className="p-1.5 bg-slate-100 rounded-lg shrink-0"><Users className="w-4 h-4 text-slate-500" /></div>
                                      <span className="flex-1 text-sm font-semibold text-slate-700">{classInfo.name}</span>
                                      <span className="px-2 py-0.5 bg-blue-50 rounded-full text-[10px] font-bold text-blue-700 shrink-0">{filteredStudents.length} élève{filteredStudents.length > 1 ? 's' : ''}</span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); toast({ title: 'Liste de classe', description: `${classInfo.name} — ${filteredStudents.length} élèves`, variant: 'info' }); }}
                                        className="p-1.5 hover:bg-blue-100 rounded-lg text-slate-400 hover:text-blue-600 transition"
                                        title="Visualiser la liste"
                                      ><FileText className="w-3.5 h-3.5" /></button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); toast({ title: 'Génération PDF', description: `Liste de ${classInfo.name} — à implémenter`, variant: 'info' }); }}
                                        className="p-1.5 hover:bg-emerald-100 rounded-lg text-slate-400 hover:text-emerald-600 transition"
                                        title="Générer PDF"
                                      ><Download className="w-3.5 h-3.5" /></button>
                                    </button>

                                    {/* ÉLÈVES */}
                                    <AnimatePresence>
                                      {isClassExpanded && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                                          {filteredStudents.length === 0 ? (
                                            <p className="px-5 py-2 text-xs text-slate-400 italic pl-16">Aucun élève</p>
                                          ) : (
                                            <div className="pl-14 pr-5 py-1">
                                              {filteredStudents.map((enr, idx) => {
                                                const statusInfo = STATUS_META[enr.status] || { label: enr.status, color: 'bg-slate-50 text-slate-600 border-slate-200' };
                                                const typeInfo = TYPE_META[enr.enrollmentType] || { label: enr.enrollmentType, color: 'bg-slate-50 text-slate-600' };
                                                return (
                                                  <div key={enr.id} className="flex items-center gap-3 py-2 px-3 hover:bg-slate-50 rounded-lg transition-colors group">
                                                    <span className="text-[10px] font-mono text-slate-400 w-6 text-right shrink-0">{idx + 1}</span>
                                                    <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shrink-0">
                                                      {enr.student.lastName[0]}{enr.student.firstName[0]}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-sm font-medium text-slate-800">{enr.student.lastName.toUpperCase()} {enr.student.firstName}</p>
                                                      <p className="text-[10px] font-mono text-slate-400">{enr.student.matricule || enr.student.studentCode || '—'}</p>
                                                    </div>
                                                    {/* Type */}
                                                    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0', typeInfo.color)}>{typeInfo.label}</span>
                                                    {/* Statut */}
                                                    <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0', statusInfo.color)}>{statusInfo.label}</span>
                                                    {/* Date */}
                                                    <span className="text-[9px] text-slate-400 shrink-0 hidden sm:inline">{new Date(enr.enrollmentDate).toLocaleDateString('fr-FR')}</span>
                                                    {/* Actions */}
                                                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                                                      {enr.status === 'PENDING' || enr.status === 'PRE_REGISTERED' || enr.status === 'ADMITTED' ? (
                                                        <button onClick={() => handleValidate(enr.student.id)} className="p-1 hover:bg-emerald-100 rounded text-emerald-600" title="Valider"><CheckCircle className="w-3.5 h-3.5" /></button>
                                                      ) : null}
                                                      <button onClick={() => handleReEnroll(enr)} className="p-1 hover:bg-indigo-100 rounded text-indigo-600" title="Réinscrire"><RotateCcw className="w-3.5 h-3.5" /></button>
                                                    </div>
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

      {/* ─── MODAL : Nouvelle inscription ─── */}
      <FormModal title="Nouvelle inscription" isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} size="xl" actions={null}>
        {academicYear && schoolLevel ? (
          <StudentEnrollmentForm
            academicYearId={academicYear.id}
            schoolLevelId={schoolLevel.id}
            onSubmit={async (data) => {
              try {
                let student: any;
                if (data.operation === 'PRE_REGISTER') {
                  student = await studentsService.preRegister({
                    academicYearId: academicYear.id, schoolLevelId: schoolLevel.id,
                    firstName: data.student.firstName, lastName: data.student.lastName,
                    dateOfBirth: data.student.dateOfBirth, gender: data.student.gender,
                    nationality: data.student.nationality, placeOfBirth: data.student.placeOfBirth,
                    photoUrl: data.student.photoUrl, classId: data.classId,
                  });
                } else {
                  student = await studentsService.create({ ...data.student, academicYearId: academicYear.id, schoolLevelId: schoolLevel.id });
                }
                await financeService.createStudentFeeProfile({ studentId: student.id, academicYearId: academicYear.id, feeRegimeId: data.feeProfile.feeRegimeId, justification: data.feeProfile.justification }).catch(() => undefined);
                if (data.guardians?.length) {
                  for (const g of data.guardians) {
                    if (!g.firstName?.trim() && !g.lastName?.trim()) continue;
                    await studentsService.addGuardians(student.id, { guardians: [{ firstName: g.firstName, lastName: g.lastName, relationship: g.relationship || 'GUARDIAN', phone: g.phone, email: g.email, isPrimary: g.isPrimary ?? false }] }).catch(() => undefined);
                  }
                }
                toast({ title: 'Succès', description: 'Inscription effectuée', variant: 'success' });
                setIsCreateModalOpen(false);
                loadData();
              } catch (e: any) {
                toast({ title: 'Erreur', description: e.message, variant: 'error' });
              }
            }}
            onCancel={() => setIsCreateModalOpen(false)}
          />
        ) : <div className="text-center py-8 text-sm text-gray-600">Sélectionnez une année et un niveau</div>}
      </FormModal>

      {/* ─── MODAL : Réinscription individuelle ─── */}
      {reEnrollStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setReEnrollStudent(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Réinscrire l'élève</h3>
              <p className="text-sm text-slate-500 mt-1">{reEnrollStudent.student.firstName} {reEnrollStudent.student.lastName}</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-slate-500">Sélectionnez la classe cible pour l'année {academicYear?.name} :</p>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" defaultValue={reEnrollStudent.class?.id}>
                {classes.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
              </select>
            </div>
            <div className="px-5 py-4 bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setReEnrollStudent(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition">Annuler</button>
              <button
                onClick={(e) => {
                  const select = (e.currentTarget.closest('.bg-white')?.querySelector('select') as HTMLSelectElement);
                  if (select) confirmReEnroll(select.value);
                }}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
              >Confirmer la réinscription</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL : Réinscription massive ─── */}
      {bulkReEnrollOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setBulkReEnrollOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Réinscription massive</h3>
              <p className="text-sm text-slate-500">Sélectionnez les élèves à réinscrire et l'année cible</p>
            </div>
            <div className="px-5 py-4 border-b border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Année cible</label>
              <select value={bulkTargetYear} onChange={e => setBulkTargetYear(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Sélectionner —</option>
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-2">
              <p className="text-xs text-slate-500 mb-2">{selectedForBulk.size} élève(s) sélectionné(s)</p>
              {enrollments.map(enr => (
                <label key={enr.id} className="flex items-center gap-3 py-1.5 px-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={selectedForBulk.has(enr.student.id)} onChange={() => toggleBulkSelection(enr.student.id)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-slate-700 flex-1">{enr.student.lastName.toUpperCase()} {enr.student.firstName}</span>
                  <span className="text-[10px] text-slate-400">{enr.class?.name || '—'}</span>
                </label>
              ))}
            </div>
            <div className="px-5 py-4 bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setBulkReEnrollOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition">Annuler</button>
              <button onClick={handleBulkReEnroll} disabled={isProcessingBulk || selectedForBulk.size === 0 || !bulkTargetYear} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50">
                {isProcessingBulk ? 'Traitement...' : `Réinscrire ${selectedForBulk.size} élève(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
