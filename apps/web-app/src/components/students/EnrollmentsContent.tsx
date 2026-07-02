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

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Search, ChevronDown, ChevronRight, Users, Loader2,
  FileText, Download, UserCheck, GraduationCap, BookOpen, Baby,
  RotateCcw, CheckCircle, XCircle, Clock, AlertCircle, Upload,
  ShieldAlert, Info, BrainCircuit, ChevronUp, EyeOff, Eye, FileDown, Pencil,
} from 'lucide-react';
import { FormModal } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { motion, AnimatePresence } from 'framer-motion';
import DocumentPreviewModal from './DocumentPreviewModal';
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
    dateOfBirth?: string | null;
    gender?: string | null;
    nationality?: string | null;
    placeOfBirth?: string | null;
    address?: string | null;
    photoUrl?: string | null;
    npi?: string | null;
    schoolLevelId?: string;
    studentGuardians?: Array<{
      isPrimary?: boolean;
      guardian: {
        id: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        email?: string;
        relationship?: string;
      };
    }>;
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

// Badge couleur pour le count d'élèves (respecte la palette du niveau)
const getLevelBadgeColor = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('MATERNELLE')) return 'bg-pink-50 text-pink-700';
  if (n.includes('PRIMAIRE')) return 'bg-blue-50 text-blue-700';
  if (n.includes('SECONDAIRE')) return 'bg-purple-50 text-purple-700';
  return 'bg-slate-50 text-slate-700';
};

// Couleur de survol pour les lignes de classe (respecte la palette du niveau)
const getLevelHoverColor = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('MATERNELLE')) return 'hover:bg-pink-50/30';
  if (n.includes('PRIMAIRE')) return 'hover:bg-blue-50/30';
  if (n.includes('SECONDAIRE')) return 'hover:bg-purple-50/30';
  return 'hover:bg-slate-50';
};

// Couleur du bouton PDF selon le niveau
const getLevelButtonHover = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('MATERNELLE')) return 'hover:bg-pink-100 hover:text-pink-600';
  if (n.includes('PRIMAIRE')) return 'hover:bg-blue-100 hover:text-blue-600';
  if (n.includes('SECONDAIRE')) return 'hover:bg-purple-100 hover:text-purple-600';
  return 'hover:bg-slate-100 hover:text-slate-600';
};

// Couleur du bouton "Généré" (vert) selon le niveau
const getLevelGeneratedColor = (name: string) => {
  const n = name.toUpperCase();
  if (n.includes('MATERNELLE')) return 'text-pink-500';
  if (n.includes('PRIMAIRE')) return 'text-emerald-500';
  if (n.includes('SECONDAIRE')) return 'text-purple-500';
  return 'text-emerald-500';
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
  const [editEnrollment, setEditEnrollment] = useState<Enrollment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());

  // Modals
  const [reEnrollStudent, setReEnrollStudent] = useState<Enrollment | null>(null);
  const [bulkReEnrollOpen, setBulkReEnrollOpen] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());
  const [bulkTargetYear, setBulkTargetYear] = useState<string>('');
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  // Tracking de la génération PDF par classe (pour afficher un spinner par bouton)
  const [pdfGeneratingClassId, setPdfGeneratingClassId] = useState<string | null>(null);
  // Classes qui ont déjà un PDF généré en DB (pour afficher le check ✅)
  const [pdfExistsClasses, setPdfExistsClasses] = useState<Set<string>>(new Set());
  // PDF liste de classe en cours de visualisation (blob URL + fileName)
  const [previewClassPdf, setPreviewClassPdf] = useState<{ filePath: string; fileName: string; mimeType: string } | null>(null);

  // ─── ORION mini-panel ──────────────────────────────────────────────
  // Alertes ciblées sur les inscriptions : élèves sans matricule, cartes manquantes,
  // doublons potentiels. Priorité plus faible que l'onglet Analytics (alertes globales),
  // mais utile pour détecter les anomalies au moment de l'inscription.
  const [orionAlerts, setOrionAlerts] = useState<any[]>([]);
  const [orionKpis, setOrionKpis] = useState<any>(null);
  const [orionCollapsed, setOrionCollapsed] = useState(false);
  const [orionLoading, setOrionLoading] = useState(false);

  // ─── Chargement ─────────────────────────────────────────────────────
  useEffect(() => {
    if (academicYear) loadData();
  }, [academicYear, schoolLevel]);

  // ─── Vérifier quels PDFs existent déjà en DB ─────────────────────────
  // Permet d'afficher un check ✅ sur les classes qui ont déjà un PDF généré
  useEffect(() => {
    if (!academicYear || classes.length === 0) return;
    const checkAll = async () => {
      const results = await Promise.all(
        classes.map(async (cls) => {
          try {
            const res = await studentsService.checkClassListPdfExists(cls.id, academicYear.id);
            return res.exists ? cls.id : null;
          } catch { return null; }
        }),
      );
      setPdfExistsClasses(new Set(results.filter(Boolean) as string[]));
    };
    checkAll();
  }, [academicYear, classes]);

  const loadData = async () => {
    if (!academicYear) return;
    setIsLoading(true);
    setOrionLoading(true);
    try {
      const [classesRes, enrollmentsData, yearsRes, orionKpisData, orionAlertsData] = await Promise.all([
        // ⚠️ Utiliser /api/all-classes (route BFF dédiée) au lieu de /api/classes
        // car /api/classes exige schoolLevelId et échoue en 400 si l'admin est en
        // "Tous les niveaux" (schoolLevelId=ALL). /api/all-classes force le header
        // x-school-level-id=ALL et retourne toutes les classes du tenant.
        fetch(`/api/all-classes`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []),
        // ⚠️ getEnrollments doit être résilient : si l'API échoue (403, 404, réseau),
        // on retourne un tableau vide plutôt que de faire crasher tout l'onglet.
        // Le toast "Erreur de connexion" qui apparaissait venait d'ici.
        studentsService.getEnrollments({ academicYearId: academicYear.id }).catch((e) => {
          console.warn('[Enrollments] load failed:', e?.message);
          return [];
        }),
        fetch('/api/academic-years', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
        // ORION : on charge en parallèle, mais on n'avale pas les erreurs critiques
        // (les KPIs/alertes sont optionnels — l'onglet doit fonctionner même si ORION est KO)
        studentsService.getOrionKpis(academicYear.id).catch((e) => {
          console.warn('[ORION] KPIs load failed:', e?.message);
          return null;
        }),
        studentsService.getOrionAlerts(academicYear.id).catch((e) => {
          console.warn('[ORION] Alerts load failed:', e?.message);
          return [];
        }),
      ]);
      setClasses(Array.isArray(classesRes) ? classesRes : []);
      setEnrollments(Array.isArray(enrollmentsData) ? enrollmentsData : []);
      setAcademicYears(Array.isArray(yearsRes) ? yearsRes : []);
      setOrionKpis(orionKpisData);
      setOrionAlerts(Array.isArray(orionAlertsData) ? orionAlertsData : []);
    } catch (e: any) {
      // Catch global de sécurité — ne devrait plus se déclencher maintenant que
      // tous les appels ont leur propre .catch(), mais on garde au cas où.
      console.error('[EnrollmentsContent] loadData global error:', e);
      // Ne pas afficher de toast "Erreur de connexion" si c'est juste vide
      // → l'utilisateur voit déjà l'état vide dans l'UI.
    } finally {
      setIsLoading(false);
      setOrionLoading(false);
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
        // Tri pédagogique des classes (CI < CP < CE1 < CE2 < CM1 < CM2 < 6e < ... < Maternelle 1 < Maternelle 2)
        // au lieu du tri alphabétique qui donne CE1, CE2, CI, CM1, CM2, CP
        const classOrder = (name: string): number => {
          const n = (name || '').trim().toUpperCase();
          // Maternelle
          if (n === 'MATERNELLE 1' || n === 'M1' || n === 'MAT1') return 0;
          if (n === 'MATERNELLE 2' || n === 'M2' || n === 'MAT2') return 1;
          // Primaire
          if (n === 'CI') return 10;
          if (n === 'CP') return 11;
          if (n === 'CE1') return 12;
          if (n === 'CE2') return 13;
          if (n === 'CM1') return 14;
          if (n === 'CM2') return 15;
          // Secondaire
          if (n === '6E' || n === '6ÈME' || n === '6EME') return 20;
          if (n === '5E' || n === '5ÈME' || n === '5EME') return 21;
          if (n === '4E' || n === '4ÈME' || n === '4EME') return 22;
          if (n === '3E' || n === '3ÈME' || n === '3EME') return 23;
          if (n === '2NDE') return 24;
          if (n === '1ERE' || n === '1ÈRE') return 25;
          if (n === 'TERMINALE' || n === 'TLE') return 26;
          // Fallback : tri alphabétique pour les classes non standard
          return 100 + name.charCodeAt(0);
        };
        const levelClasses = (classesByLevel.get(level.id) || []).sort((a, b) => classOrder(a.name) - classOrder(b.name));
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

  // ─── Élèves orphelins (sans classe ou classe non chargée) ──────────
  // Ces élèves ont un enrollment mais :
  //   - classId est null (admission convertie sans classe, ou preRegister sans classId)
  //   - OU classId pointe vers une classe qui n'est pas dans `classes` (classe supprimée,
  //     ou classe d'un autre schoolLevelId non visible par l'utilisateur courant)
  //
  // Sans cette section, ces élèves sont INVISIBLES dans l'arbre (qui ne groupe que par
  // classe chargée), alors qu'ils sont comptés dans les stats → confusion pour l'admin.
  const unassignedEnrollments = useMemo(() => {
    const loadedClassIds = new Set(classes.map(c => c.id));
    const orphans = enrollments.filter(e => {
      const classId = e.class?.id;
      return !classId || !loadedClassIds.has(classId);
    });
    if (!searchQuery.trim()) return orphans;
    const q = searchQuery.toLowerCase();
    return orphans.filter(s =>
      `${s.student.lastName} ${s.student.firstName}`.toLowerCase().includes(q) ||
      (s.student.matricule || '').toLowerCase().includes(q)
    );
  }, [enrollments, classes, searchQuery]);

  // ─── Orphelins groupés par niveau scolaire ──────────────────────────
  // L'élève a un schoolLevelId sur Student (résolu depuis l'admission). On groupe
  // les orphelins par ce niveau pour que l'admin voie immédiatement combien d'élèves
  // de chaque niveau sont en attente d'affectation.
  //
  // ⚠️ Student.schoolLevelId → school_levels (UUID). On n'a pas toujours le nom du
  // niveau côté frontend, donc on fait un best-effort :
  //   1. Si classes chargées contiennent une classe avec ce schoolLevelId → on prend son nom
  //   2. Sinon, on déduit le nom depuis l'UUID en cherchant dans schoolLevels (non disponible
  //      côté frontend) → on affiche "Niveau inconnu" avec l'UUID tronqué
  //   3. Fallback : on regroupe sous "Non spécifié"
  const unassignedByLevel = useMemo(() => {
    // Construire un map schoolLevelId → nom depuis les classes chargées
    const levelNameMap = new Map<string, string>();
    for (const cls of classes) {
      if (cls.schoolLevel?.name && !levelNameMap.has(cls.schoolLevelId)) {
        levelNameMap.set(cls.schoolLevelId, cls.schoolLevel.name);
      }
    }

    // Grouper les orphelins
    const groups = new Map<string, { levelId: string; levelName: string; students: Enrollment[] }>();
    for (const enr of unassignedEnrollments) {
      // Student.schoolLevelId — peut être undefined pour les anciens élèves
      const studentLevelId = (enr.student as any).schoolLevelId as string | undefined;
      const levelName = studentLevelId
        ? (levelNameMap.get(studentLevelId) || `Niveau ${studentLevelId.substring(0, 8)}…`)
        : 'Non spécifié';
      const key = studentLevelId || '__unspecified__';
      if (!groups.has(key)) {
        groups.set(key, { levelId: key, levelName, students: [] });
      }
      groups.get(key)!.students.push(enr);
    }

    // Trier par ordre de niveau (Maternelle < Primaire < Secondaire < Autre)
    const levelOrder = (name: string) => {
      const n = name.toUpperCase();
      if (n.includes('MATERNELLE')) return 0;
      if (n.includes('PRIMAIRE')) return 1;
      if (n.includes('SECONDAIRE')) return 2;
      return 3;
    };
    return Array.from(groups.values()).sort((a, b) => levelOrder(a.levelName) - levelOrder(b.levelName));
  }, [unassignedEnrollments, classes]);

  // Auto-expand la section "Élèves non affectés" + le premier sous-groupe de niveau
  // si des orphelins sont détectés au premier chargement — pour que l'admin les voie
  // immédiatement sans clic.
  // ⚠️ Cet effect DOIT être placé après la déclaration de `unassignedByLevel`
  // car le dependency array est évalué pendant le render (TDZ sinon).
  const hasAutoExpandedRef = useRef(false);
  useEffect(() => {
    if (hasAutoExpandedRef.current) return;
    if (!isLoading && unassignedEnrollments.length > 0 && unassignedByLevel.length > 0) {
      hasAutoExpandedRef.current = true;
      setExpandedLevels(prev => {
        const next = new Set(prev);
        next.add('__unassigned__');
        // Auto-expand le premier sous-groupe de niveau (le plus urgent)
        const firstGroup = unassignedByLevel[0];
        if (firstGroup) next.add(`__unassigned__${firstGroup.levelId}`);
        return next;
      });
    }
  }, [isLoading, unassignedEnrollments.length, unassignedByLevel.length]);

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

        {/* ─── ORION mini-panel ───
            Alertes ciblées sur les inscriptions : matricules manquants, cartes non générées,
            incohérences statut/inscription. Cliquable et repliable. L'onglet Analytics a déjà
            les alertes globales — ici on n'affiche que ce qui concerne l'inscription en cours. */}
        {(() => {
          // Filtrer pour ne garder que les alertes "inscription" : MISSING_MATRICULE,
          // MISSING_ID_CARD_FOR_EXAM, IDENTITY_INCONSISTENCY. On exclut les alertes trop
          // globales (UNSYNCHRONIZED_MATRICULE, EXPIRED_ID_CARDS, HIGH_REVOCATION_RATE)
          // qui sont déjà visibles dans l'onglet Analytics.
          const enrollmentCategories = new Set([
            'MISSING_MATRICULE',
            'MISSING_ID_CARD_FOR_EXAM',
            'IDENTITY_INCONSISTENCY',
          ]);
          const enrollmentAlerts = (orionAlerts || []).filter(a => enrollmentCategories.has(a.category));
          const criticalCount = enrollmentAlerts.filter(a => a.severity === 'CRITICAL').length;
          const highCount = enrollmentAlerts.filter(a => a.severity === 'HIGH').length;
          const hasAlerts = enrollmentAlerts.length > 0;
          const matriculeCoverage = orionKpis?.matricule?.coverageRate;
          const idCardCoverage = orionKpis?.idCard?.coverageRate;

          // Si pas d'alertes ET pas de KPIs, on masque complètement le panel
          if (!hasAlerts && matriculeCoverage === undefined && idCardCoverage === undefined && !orionLoading) {
            return null;
          }

          const severityMeta = (sev: string) => {
            if (sev === 'CRITICAL') return { label: 'Critique', color: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', icon: AlertCircle };
            if (sev === 'HIGH') return { label: 'Élevée', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', icon: AlertCircle };
            if (sev === 'MEDIUM') return { label: 'Moyenne', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', icon: Info };
            return { label: 'Basse', color: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400', icon: Info };
          };

          return (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
              {/* Header — toujours visible */}
              <button
                onClick={() => setOrionCollapsed(c => !c)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors text-left"
              >
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 shrink-0">
                  <BrainCircuit className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">ORION</span>
                    <span className="text-[10px] text-slate-500">·</span>
                    <span className="text-[10px] font-medium text-slate-400 uppercase">Alertes Inscriptions</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5 truncate">
                    {orionLoading
                      ? 'Analyse des données d\'inscription en cours…'
                      : hasAlerts
                        ? `${enrollmentAlerts.length} alerte(s) · ${criticalCount} critique(s) · ${highCount} élevée(s)`
                        : 'Aucune anomalie critique détectée sur les inscriptions'}
                  </p>
                </div>
                {/* Mini KPIs visibles même replié */}
                {!orionCollapsed && (
                  <div className="hidden sm:flex items-center gap-3 shrink-0">
                    {matriculeCoverage !== undefined && (
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Matricules</p>
                        <p className={cn('text-xs font-bold', matriculeCoverage > 75 ? 'text-emerald-400' : matriculeCoverage > 50 ? 'text-amber-400' : 'text-rose-400')}>
                          {Math.round(matriculeCoverage)}%
                        </p>
                      </div>
                    )}
                    {idCardCoverage !== undefined && (
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Cartes</p>
                        <p className={cn('text-xs font-bold', idCardCoverage > 75 ? 'text-emerald-400' : idCardCoverage > 50 ? 'text-amber-400' : 'text-rose-400')}>
                          {Math.round(idCardCoverage)}%
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {hasAlerts && !orionCollapsed && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded-full text-[10px] font-bold shrink-0">
                    <ShieldAlert className="w-3 h-3" />
                    {enrollmentAlerts.length}
                  </span>
                )}
                <ChevronUp className={cn('w-4 h-4 text-slate-400 shrink-0 transition-transform', orionCollapsed && 'rotate-180')} />
              </button>

              {/* Body — alertes détaillées */}
              <AnimatePresence>
                {!orionCollapsed && hasAlerts && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-slate-700/50"
                  >
                    <div className="bg-slate-950/30 divide-y divide-slate-800">
                      {enrollmentAlerts.map((alert, i) => {
                        const meta = severityMeta(alert.severity);
                        const Icon = meta.icon;
                        return (
                          <div key={i} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-800/30 transition-colors">
                            <div className={cn('p-1.5 rounded-lg shrink-0', meta.color)}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-bold text-slate-100">{alert.title}</p>
                                <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold border', meta.color)}>{meta.label}</span>
                                {typeof alert.count === 'number' && (
                                  <span className="text-[10px] text-slate-400 font-mono">{alert.count} élève(s)</span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{alert.description}</p>
                              {alert.recommendation && (
                                <p className="text-[10px] text-slate-500 mt-1 italic">
                                  <span className="font-semibold text-slate-400">→ </span>{alert.recommendation}
                                </p>
                              )}
                              {/* Liste des élèves concernés (échantillon max 5 du backend) */}
                              {Array.isArray(alert.sampleStudents) && alert.sampleStudents.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wide">Élèves concernés (échantillon) :</p>
                                  {alert.sampleStudents.map((s: any) => (
                                    <div key={s.id} className="flex items-center gap-2 text-[10px] pl-2 py-0.5 hover:bg-slate-800/40 rounded">
                                      <div className="h-4 w-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-bold text-slate-300 shrink-0">
                                        {(s.name || '?').charAt(0)}
                                      </div>
                                      <span className="text-slate-200 font-medium truncate flex-1">{s.name}</span>
                                      <span className="text-slate-500 font-mono shrink-0">
                                        {s.matricule || '— pas de matricule —'}
                                      </span>
                                    </div>
                                  ))}
                                  {typeof alert.count === 'number' && alert.count > alert.sampleStudents.length && (
                                    <p className="text-[9px] text-slate-500 italic pl-2">
                                      + {alert.count - alert.sampleStudents.length} autre(s) élève(s)…
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between">
                      <p className="text-[10px] text-slate-500 italic">
                        Voir l'onglet <span className="font-semibold text-slate-400">Analytics</span> pour toutes les alertes ORION.
                      </p>
                      <button
                        onClick={() => {
                          // Recharger manuellement les données ORION
                          if (academicYear) loadData();
                        }}
                        className="text-[10px] font-bold text-blue-300 hover:text-blue-200 transition"
                      >
                        Re-calculer
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })()}

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
              onClick={() => setBulkReEnrollOpen(true)}
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

        {/* Arborescence + section orphelins */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-slate-500 font-medium">Chargement...</p>
            </div>
          ) : (filteredTree.length === 0 && unassignedEnrollments.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="p-4 bg-slate-50 rounded-full text-slate-300"><GraduationCap className="w-8 h-8" /></div>
              <p className="text-slate-500 font-medium">Aucune classe configurée</p>
              <p className="text-xs text-slate-400 max-w-sm text-center">Créez des classes dans le module Paramétrage, ou vérifiez que votre niveau scolaire correspond à celui des élèves.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* ─── SECTION : Élèves non affectés (orphelins) groupés par niveau ───
                  Affichée en premier pour que l'admin voie immédiatement les élèves
                  qui ont besoin d'une affectation manuelle. Groupés par niveau scolaire
                  (Maternelle / Primaire / Secondaire) pour faciliter l'affectation. */}
              {unassignedEnrollments.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleLevel('__unassigned__')}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-amber-50/50 transition-colors text-left group"
                  >
                    <div className="shrink-0">
                      {expandedLevels.has('__unassigned__') ? <ChevronDown className="w-5 h-5 text-amber-500 group-hover:text-amber-600" /> : <ChevronRight className="w-5 h-5 text-amber-500 group-hover:text-amber-600" />}
                    </div>
                    <div className="p-2.5 rounded-lg shrink-0 bg-amber-50"><AlertCircle className="w-5 h-5 text-amber-600" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-amber-800">Élèves non affectés</p>
                      <p className="text-xs text-amber-600">
                        {unassignedEnrollments.length} élève(s) sans classe — groupés par niveau scolaire · à affecter via l'onglet Affectations
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-amber-100 rounded-full text-sm font-bold text-amber-700 shrink-0">{unassignedEnrollments.length}</span>
                  </button>
                  <AnimatePresence>
                    {expandedLevels.has('__unassigned__') && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        {/* Sous-groupes par niveau scolaire */}
                        {unassignedByLevel.map((group) => {
                          const groupKey = `__unassigned__${group.levelId}`;
                          const isGroupExpanded = expandedLevels.has(groupKey);
                          return (
                            <div key={group.levelId} className="border-t border-amber-100/50 first:border-t-0">
                              <button
                                onClick={() => toggleLevel(groupKey)}
                                className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-amber-50/30 transition-colors text-left group"
                              >
                                <div className="shrink-0 pl-6">
                                  {isGroupExpanded ? <ChevronDown className="w-4 h-4 text-amber-500" /> : <ChevronRight className="w-4 h-4 text-amber-500" />}
                                </div>
                                <div className={cn('p-1.5 rounded-lg shrink-0', getLevelBgColor(group.levelName))}>
                                  {getLevelIcon(group.levelName)}
                                </div>
                                <span className="flex-1 text-sm font-semibold text-amber-800">{getLevelDisplayName(group.levelName)}</span>
                                <span className="px-2 py-0.5 bg-amber-100 rounded-full text-[10px] font-bold text-amber-700 shrink-0">
                                  {group.students.length} élève{group.students.length > 1 ? 's' : ''}
                                </span>
                              </button>
                              <AnimatePresence>
                                {isGroupExpanded && (
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                                    <div className="pl-14 pr-5 py-1 overflow-x-auto">
                                      {/* En-tête de colonnes */}
                                      <div className="flex items-center gap-3 py-1.5 px-3 border-b border-amber-100 whitespace-nowrap min-w-max text-[10px] font-bold text-amber-500 uppercase">
                                        <span className="w-8 text-center shrink-0">N°</span>
                                        <span className="w-8 shrink-0"></span>
                                        <span className="w-56 shrink-0">Nom & Matricule</span>
                                        <span className="w-20 shrink-0">Type</span>
                                        <span className="w-24 shrink-0">Statut</span>
                                        <span className="w-24 shrink-0">Date</span>
                                        <span className="w-20 shrink-0">Actions</span>
                                      </div>
                                      {group.students.map((enr, idx) => {
                                        const statusInfo = STATUS_META[enr.status] || { label: enr.status, color: 'bg-slate-50 text-slate-600 border-slate-200' };
                                        const typeInfo = TYPE_META[enr.enrollmentType] || { label: enr.enrollmentType, color: 'bg-slate-50 text-slate-600' };
                                        return (
                                          <div key={enr.id} className="flex items-center gap-3 py-2 px-3 hover:bg-amber-50/40 rounded-lg transition-colors group whitespace-nowrap min-w-max">
                                            <span className="w-8 text-center text-sm font-bold text-slate-500 shrink-0">{idx + 1}</span>
                                            <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-xs font-bold text-amber-600 group-hover:bg-amber-200 group-hover:text-amber-700 transition-colors shrink-0 overflow-hidden">
                                              {enr.student.photoUrl ? (
                                                <img src={enr.student.photoUrl} alt="" className="w-full h-full object-cover rounded-full" />
                                              ) : (
                                                <>{enr.student.lastName[0]}{enr.student.firstName[0]}</>
                                              )}
                                            </div>
                                            <div className="w-56 shrink-0">
                                              <p className="text-sm font-medium text-slate-800 truncate">{enr.student.lastName.toUpperCase()} {enr.student.firstName}</p>
                                              <p className="text-[10px] font-mono text-slate-400">
                                                {enr.student.matricule || enr.student.studentCode || '— matricule non généré —'}
                                              </p>
                                            </div>
                                            <div className="w-20 shrink-0 flex justify-center"><span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold inline-block', typeInfo.color)}>{typeInfo.label}</span></div>
                                            <div className="w-24 shrink-0 flex justify-center"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block', statusInfo.color)}>{statusInfo.label}</span></div>
                                            <span className="w-24 text-xs text-slate-500 shrink-0">{new Date(enr.enrollmentDate).toLocaleDateString('fr-FR')}</span>
                                            <div className="flex gap-1 w-28 shrink-0">
                                              {enr.status === 'PENDING' || enr.status === 'PRE_REGISTERED' || enr.status === 'ADMITTED' ? (
                                                <button onClick={() => handleValidate(enr.student.id)} className="p-1 hover:bg-emerald-100 rounded text-emerald-600" title="Valider"><CheckCircle className="w-4 h-4" /></button>
                                              ) : null}
                                              <button onClick={() => setEditEnrollment(enr)} className="p-1 hover:bg-amber-100 rounded text-amber-600" title="Éditer / Compléter"><Pencil className="w-4 h-4" /></button>
                                              {/* Générer le matricule si manquant (élève converti sans classe avant le fix) */}
                                              {(!enr.student.matricule && !enr.student.studentCode) && (
                                                <button
                                                  onClick={async () => {
                                                    try {
                                                      await studentsService.generateMatricule(enr.student.id);
                                                      toast({ title: '✅ Matricule généré', variant: 'success' });
                                                      loadData();
                                                    } catch (e: any) {
                                                      toast({ title: 'Erreur génération matricule', description: e.message, variant: 'error' });
                                                    }
                                                  }}
                                                  className="p-1 hover:bg-blue-100 rounded text-blue-600"
                                                  title="Générer le matricule"
                                                ><FileText className="w-4 h-4" /></button>
                                              )}
                                              <button onClick={() => handleReEnroll(enr)} className="p-1 hover:bg-indigo-100 rounded text-indigo-600" title="Réinscrire"><RotateCcw className="w-4 h-4" /></button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* ─── ARBORESCENCE NIVEAU → CLASSE → ÉLÈVES ─── */}
              {filteredTree.map((node) => {
                const isExpanded = expandedLevels.has(node.level.id);
                const levelName = node.level.name;
                return (
                  <div key={node.level.id}>
                    {/* NIVEAU */}
                    <button
                      onClick={() => toggleLevel(node.level.id)}
                      className={cn('w-full flex items-center gap-3 px-5 py-4 transition-colors text-left group', getLevelHoverColor(node.level.name))}
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
                                    <div className={cn('w-full flex items-center gap-3 px-5 py-2.5 transition-colors text-left group', getLevelHoverColor(levelName))}>
                                      <button
                                        onClick={() => toggleClass(classInfo.id)}
                                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                        aria-label={`Basculer la classe ${classInfo.name}`}
                                      >
                                        <div className="shrink-0 pl-6">
                                          {isClassExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600" /> : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />}
                                        </div>
                                        <div className="p-1.5 bg-slate-100 rounded-lg shrink-0"><Users className="w-4 h-4 text-slate-500" /></div>
                                        <span className="flex-1 text-sm font-semibold text-slate-700 truncate">{classInfo.name}</span>
                                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0', getLevelBadgeColor(levelName))}>{filteredStudents.length} élève{filteredStudents.length > 1 ? 's' : ''}</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (!academicYear) return;
                                          setPdfGeneratingClassId(classInfo.id);
                                          // Générer + stocker en DB (pattern RH contrats)
                                          studentsService.generateAndStoreClassListPdf(classInfo.id, academicYear.id)
                                            .then(() => {
                                              // Marquer la classe comme ayant un PDF
                                              setPdfExistsClasses(prev => new Set(prev).add(classInfo.id));
                                              toast({ title: '✅ PDF généré et enregistré', description: classInfo.name, variant: 'success' });
                                            })
                                            .catch(err => toast({ title: 'Erreur PDF', description: err.message, variant: 'error' }))
                                            .finally(() => setPdfGeneratingClassId(null));
                                        }}
                                        disabled={pdfGeneratingClassId === classInfo.id}
                                        className={cn(
                                          'p-1.5 rounded-lg transition shrink-0',
                                          pdfGeneratingClassId === classInfo.id
                                            ? 'bg-blue-100 text-blue-600 cursor-wait'
                                            : cn('text-slate-400', getLevelButtonHover(levelName)),
                                        )}
                                        title="Générer la liste de classe (PDF)"
                                      >
                                        {pdfGeneratingClassId === classInfo.id
                                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          : pdfExistsClasses.has(classInfo.id)
                                            ? <FileDown className={cn('w-3.5 h-3.5', getLevelGeneratedColor(levelName))} />
                                            : <FileDown className="w-3.5 h-3.5" />}
                                      </button>
                                      {/* Bouton Visualiser — récupère le PDF stocké en DB (instantané) */}
                                      <button
                                        onClick={async () => {
                                          if (!academicYear) return;
                                          setPdfGeneratingClassId(classInfo.id);
                                          try {
                                            const { url, fileName } = await studentsService.getStoredClassListPdf(classInfo.id, academicYear.id);
                                            setPreviewClassPdf({ filePath: url, fileName, mimeType: 'application/pdf' });
                                          } catch (err: any) {
                                            toast({ title: '⚠️ Aucun PDF', description: 'Générez d\'abord le document', variant: 'info' });
                                          } finally {
                                            setPdfGeneratingClassId(null);
                                          }
                                        }}
                                        disabled={pdfGeneratingClassId === classInfo.id || !pdfExistsClasses.has(classInfo.id)}
                                        className={cn(
                                          'p-1.5 rounded-lg transition shrink-0',
                                          pdfExistsClasses.has(classInfo.id)
                                            ? cn('text-slate-400', getLevelButtonHover(levelName))
                                            : 'text-slate-300 cursor-not-allowed',
                                        )}
                                        title={pdfExistsClasses.has(classInfo.id) ? 'Visualiser la liste de classe' : 'Générez d\'abord le PDF'}
                                      >
                                        {pdfGeneratingClassId === classInfo.id
                                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          : <Eye className="w-3.5 h-3.5" />}
                                      </button>
                                    </div>

                                    {/* ÉLÈVES */}
                                    <AnimatePresence>
                                      {isClassExpanded && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                                          {filteredStudents.length === 0 ? (
                                            <p className="px-5 py-2 text-xs text-slate-400 italic pl-16">Aucun élève</p>
                                          ) : (
                                            <div className="pl-14 pr-5 py-1 overflow-x-auto">
                                              {/* En-tête de colonnes */}
                                              <div className="flex items-center gap-3 py-1.5 px-3 border-b border-slate-100 whitespace-nowrap min-w-max text-[10px] font-bold text-slate-400 uppercase">
                                                <span className="w-8 text-center shrink-0">N°</span>
                                                <span className="w-8 shrink-0"></span>
                                                <span className="w-56 shrink-0">Nom & Matricule</span>
                                                <span className="w-20 shrink-0">Type</span>
                                                <span className="w-24 shrink-0">Statut</span>
                                                <span className="w-24 shrink-0">Date</span>
                                                <span className="w-20 shrink-0">Actions</span>
                                              </div>
                                              {filteredStudents.map((enr, idx) => {
                                                const statusInfo = STATUS_META[enr.status] || { label: enr.status, color: 'bg-slate-50 text-slate-600 border-slate-200' };
                                                const typeInfo = TYPE_META[enr.enrollmentType] || { label: enr.enrollmentType, color: 'bg-slate-50 text-slate-600' };
                                                return (
                                                  <div key={enr.id} className="flex items-center gap-3 py-2 px-3 hover:bg-slate-50 rounded-lg transition-colors group whitespace-nowrap min-w-max">
                                                    <span className="w-8 text-center text-sm font-bold text-slate-500 shrink-0">{idx + 1}</span>
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shrink-0 overflow-hidden">
                                                      {enr.student.photoUrl ? (
                                                        <img src={enr.student.photoUrl} alt="" className="w-full h-full object-cover rounded-full" />
                                                      ) : (
                                                        <>{enr.student.lastName[0]}{enr.student.firstName[0]}</>
                                                      )}
                                                    </div>
                                                    <div className="w-56 shrink-0">
                                                      <p className="text-sm font-medium text-slate-800 truncate">{enr.student.lastName.toUpperCase()} {enr.student.firstName}</p>
                                                      <p className="text-[10px] font-mono text-slate-400">{enr.student.matricule || enr.student.studentCode || '—'}</p>
                                                    </div>
                                                    <div className="w-20 shrink-0 flex justify-center"><span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold inline-block', typeInfo.color)}>{typeInfo.label}</span></div>
                                                    <div className="w-24 shrink-0 flex justify-center"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block', statusInfo.color)}>{statusInfo.label}</span></div>
                                                    <span className="w-24 text-xs text-slate-500 shrink-0">{new Date(enr.enrollmentDate).toLocaleDateString('fr-FR')}</span>
                                                    <div className="flex gap-1 w-28 shrink-0">
                                                      {enr.status === 'PENDING' || enr.status === 'PRE_REGISTERED' || enr.status === 'ADMITTED' ? (
                                                        <button onClick={() => handleValidate(enr.student.id)} className="p-1 hover:bg-emerald-100 rounded text-emerald-600" title="Valider"><CheckCircle className="w-4 h-4" /></button>
                                                      ) : null}
                                                      <button onClick={() => setEditEnrollment(enr)} className="p-1 hover:bg-amber-100 rounded text-amber-600" title="Éditer / Compléter"><Pencil className="w-4 h-4" /></button>
                                                      <button onClick={() => handleReEnroll(enr)} className="p-1 hover:bg-indigo-100 rounded text-indigo-600" title="Réinscrire"><RotateCcw className="w-4 h-4" /></button>
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

      {/* ─── MODAL : Visualisation PDF liste de classe ───
          Réutilise le même DocumentPreviewModal que l'onglet Admission.
          Le PDF est généré côté backend, retourné comme blob URL, et affiché
          dans une iframe. Les boutons Télécharger + Ouvrir sont intégrés au modal. */}
      {previewClassPdf && (
        <DocumentPreviewModal
          doc={previewClassPdf}
          onClose={() => setPreviewClassPdf(null)}
        />
      )}

      {/* ─── MODAL : Éditer / Compléter une inscription ───
          Ouvre le StudentEnrollmentForm pré-rempli avec les données de l'élève.
          Permet de compléter les informations manquantes (guardians, finances, etc.). */}
      {editEnrollment && academicYear && schoolLevel && (
        <FormModal
          title="Éditer / Compléter l'inscription"
          isOpen={!!editEnrollment}
          onClose={() => setEditEnrollment(null)}
          size="xl"
          actions={null}
        >
          <StudentEnrollmentForm
            academicYearId={academicYear.id}
            schoolLevelId={schoolLevel.id}
            initialData={{
              studentId: editEnrollment.student.id,
              firstName: editEnrollment.student.firstName || '',
              lastName: editEnrollment.student.lastName || '',
              matricule: editEnrollment.student.matricule || undefined,
              studentCode: editEnrollment.student.studentCode,
              gender: (editEnrollment.student.gender as any) || '',
              dateOfBirth: editEnrollment.student.dateOfBirth || '',
              nationality: editEnrollment.student.nationality || '',
              placeOfBirth: editEnrollment.student.placeOfBirth || '',
              address: editEnrollment.student.address || '',
              photoUrl: editEnrollment.student.photoUrl || '',
              npi: editEnrollment.student.npi || '',
              classId: editEnrollment.class?.id,
              // Pré-remplir les guardians depuis l'admission
              guardians: (editEnrollment.student.studentGuardians || []).map(sg => ({
                firstName: sg.guardian?.firstName || '',
                lastName: sg.guardian?.lastName || '',
                relationship: sg.guardian?.relationship || 'PARENT',
                phone: sg.guardian?.phone || '',
                email: sg.guardian?.email || '',
                isPrimary: sg.isPrimary ?? false,
              })),
            }}
            onSubmit={async (data) => {
              try {
                // Mettre à jour l'élève avec les données du formulaire (sans photoUrl)
                const { photoUrl: _photoUrl, ...studentData } = data.student;
                await studentsService.update(editEnrollment.student.id, {
                  ...studentData,
                  academicYearId: academicYear.id,
                  schoolLevelId: schoolLevel.id,
                });
                // Upload photo via endpoint dédié (pattern RH) si une photo a été capturée
                if (data.student.photoUrl && data.student.photoUrl.startsWith('data:')) {
                  try {
                    await studentsService.uploadPhoto(editEnrollment.student.id, data.student.photoUrl);
                  } catch (photoErr: any) {
                    console.warn('Upload photo failed:', photoErr?.message);
                    // Ne pas bloquer la sauvegarde si l'upload photo échoue
                    // (le backend doit être déployé avec le nouvel endpoint)
                  }
                }
                // Mettre à jour la classe si elle a changé
                if (data.classId && data.classId !== editEnrollment.class?.id) {
                  await studentsService.changeClass(editEnrollment.student.id, academicYear.id, data.classId);
                }
                // Ajouter les guardians s'il y en a
                if (data.guardians?.length) {
                  for (const g of data.guardians) {
                    if (!g.firstName?.trim() && !g.lastName?.trim()) continue;
                    await studentsService.addGuardians(editEnrollment.student.id, {
                      guardians: [{
                        firstName: g.firstName, lastName: g.lastName,
                        relationship: g.relationship || 'GUARDIAN',
                        phone: g.phone, email: g.email, isPrimary: g.isPrimary ?? false,
                      }],
                    }).catch(() => undefined);
                  }
                }
                // Régime financier si fourni
                if (data.feeProfile?.feeRegimeId) {
                  await financeService.createStudentFeeProfile({
                    studentId: editEnrollment.student.id,
                    academicYearId: academicYear.id,
                    feeRegimeId: data.feeProfile.feeRegimeId,
                    justification: data.feeProfile.justification,
                  }).catch(() => undefined);
                }
                toast({ title: '✅ Inscription mise à jour', variant: 'success' });
                setEditEnrollment(null);
                loadData();
              } catch (e: any) {
                toast({ title: 'Erreur', description: e.message, variant: 'error' });
              }
            }}
            onCancel={() => setEditEnrollment(null)}
          />
        </FormModal>
      )}
    </>
  );
}
