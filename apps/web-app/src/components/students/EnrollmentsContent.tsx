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
  ShieldAlert, Info, BrainCircuit, ChevronUp, EyeOff, Eye, FileDown, Pencil, FileSpreadsheet,
  DollarSign, UserPlus, RefreshCw, Trash2, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormModal } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { motion, AnimatePresence } from 'framer-motion';
import DocumentPreviewModal from './DocumentPreviewModal';
import StudentEnrollmentForm from '@/components/students/StudentEnrollmentForm';
import ImportElevesModal from '@/components/students/ImportElevesModal';
import { studentsService } from '@/services/students.service';
import { apiFetch } from '@/lib/api/client';
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
  // ⭐ Classe officielle (AcademicClass) — utilisée pour le groupement dans l'onglet Inscriptions.
  // L'inscription est rattachée à la classe officielle (admission) ; l'affectation à une section
  // physique (classId) est une étape ultérieure.
  academicClass?: {
    id: string;
    name: string;
    code?: string;
    level?: { id: string; name: string };
  };
  enrollmentType: string;
  enrollmentDate: string;
  status: string;
}

interface ClassInfo {
  id: string;
  name: string;
  schoolLevelId?: string;
  schoolLevel?: { id: string; name: string; code?: string };
  // ⭐ Champs pour AcademicClass (classes officielles) — niveau pédagogique (AcademicLevel)
  // mappé vers un SchoolLevel pour l'affichage dans l'arborescence.
  levelId?: string;
  level?: { id: string; name: string; code?: string };
  code?: string;
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
  const router = useRouter();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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
  // ⭐ Export Excel par classe (bouton à côté du PDF)
  const [excelGeneratingClassId, setExcelGeneratingClassId] = useState<string | null>(null);
  // ⭐ Export PDF de toutes les classes d'un niveau
  const [allPdfGeneratingLevelId, setAllPdfGeneratingLevelId] = useState<string | null>(null);
  // ⭐ Exports globaux (toutes classes confondues)
  const [isGlobalExcelExporting, setIsGlobalExcelExporting] = useState(false);
  const [isGlobalPdfExporting, setIsGlobalPdfExporting] = useState(false);

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
  // ⭐ Mode 'official' car l'onglet Inscriptions travaille sur les classes officielles.
  useEffect(() => {
    if (!academicYear || classes.length === 0) return;
    const checkAll = async () => {
      const results = await Promise.all(
        classes.map(async (cls) => {
          try {
            const res = await studentsService.checkClassListPdfExists(cls.id, academicYear.id, 'official');
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
        // ⭐ Charger les classes OFFICIELLES (AcademicClass) pour l'affichage
        // de la "classe officielle" dans la table inscriptions.
        // On garde aussi /api/all-classes en parallèle pour le modal "Changer de classe"
        // qui a besoin des classes physiques (sections CI/A, CE1-B…).
        fetch(`/api/academic-classes?isActive=true`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() : [])
          .then(data => Array.isArray(data) ? data : (data?.data || data?.classes || []))
          .catch(() => []),
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
      // ⭐ Normaliser les AcademicClass vers ClassInfo pour réutiliser la même arborescence.
      // On mappe level.id → schoolLevelId pour le groupement par niveau dans le tree.
      const academicClasses: ClassInfo[] = (Array.isArray(classesRes) ? classesRes : [])
        .filter((ac: any) => ac && ac.id && ac.name)
        .map((ac: any) => ({
          id: ac.id,
          name: ac.name,
          schoolLevelId: ac.level?.id || ac.schoolLevelId || 'unknown',
          schoolLevel: ac.level ? { id: ac.level.id, name: ac.level.name, code: ac.level.code } : undefined,
          level: ac.level ? { id: ac.level.id, name: ac.level.name } : undefined,
        }));
      setClasses(academicClasses);
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

  // ─── Arborescence niveau → classe officielle → élèves ─────────────────
  // ⭐ L'onglet Inscriptions groupe par classe OFFICIELLE (AcademicClass).
  // Les élèves sont rattachés via StudentEnrollment.academicClassId.
  const treeData = useMemo(() => {
    // ⭐ Détecter si les classes sont des AcademicClass (ont levelId/level) ou Class (ont schoolLevelId/schoolLevel)
    // const isAcademic = classes.some(c => c.levelId || c.level);

    const levelMap = new Map<string, { id: string; name: string }>();
    for (const cls of classes) {
      // ⭐ Préférer level (AcademicClass) à schoolLevel (Class physique)
      const levelId = cls.levelId || cls.schoolLevelId || '';
      if (!levelId) continue;
      if (!levelMap.has(levelId)) {
        const levelName = cls.level?.name || cls.level?.code || cls.schoolLevel?.name || cls.schoolLevel?.code || '';
        if (levelName) levelMap.set(levelId, { id: levelId, name: levelName });
      }
    }
    if (levelMap.size === 0) {
      for (const cls of classes) {
        const levelId = cls.levelId || cls.schoolLevelId || '';
        if (!levelMap.has(levelId)) {
          const clsName = (cls.name || '').toLowerCase();
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
      const levelId = cls.levelId || cls.schoolLevelId || '';
      if (!levelId) continue;
      if (!classesByLevel.has(levelId)) classesByLevel.set(levelId, []);
      classesByLevel.get(levelId)!.push(cls);
    }

    // ⭐ Pour les inscriptions : utiliser academicClassId en priorité (classe officielle),
    // avec fallback sur classId (classe physique) pour les inscriptions legacy.
    const enrollmentsByClass = new Map<string, Enrollment[]>();
    for (const enr of enrollments) {
      const classId = (enr as any).academicClass?.id || (enr as any).academicClassId || enr.class?.id || 'unassigned';
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
        // ⭐ Pour le comptage des élèves du niveau : utiliser academicClassId (officiel)
        // avec fallback sur classId (physique) pour les inscriptions legacy.
        const levelEnrollments = enrollments.filter(e => {
          const acid = (e as any).academicClass?.id || (e as any).academicClassId;
          const cls = acid ? classes.find(c => c.id === acid) : classes.find(c => c.id === e.class?.id);
          return (cls?.levelId || cls?.schoolLevelId) === level.id;
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

  // ─── Élèves orphelins (sans classe officielle OU classe non chargée) ──
  // Ces élèves ont un enrollment mais :
  //   - academicClassId est null ET classId est null (admission convertie sans classe)
  //   - OU academicClassId/classId pointe vers une classe qui n'est pas dans `classes`
  //
  // Sans cette section, ces élèves sont INVISIBLES dans l'arbre (qui ne groupe que par
  // classe chargée), alors qu'ils sont comptés dans les stats → confusion pour l'admin.
  const unassignedEnrollments = useMemo(() => {
    const loadedClassIds = new Set(classes.map(c => c.id));
    const orphans = enrollments.filter(e => {
      const acid = (e as any).academicClass?.id || (e as any).academicClassId;
      const classId = acid || e.class?.id;
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
    // Inscrits = élèves dont le dossier est complet (matricule généré + classe assignée).
    // Inclut ACTIVE (élève officiellement en classe), VALIDATED (dossier validé),
    // et ADMITTED (élève admis via admission/convertToStudent — a déjà son matricule
    // et sa classe via admit()). Avant, ADMITTED était compté comme "en attente"
    // ce qui était faux : un élève ADMITTED est inscrit, pas en attente.
    const active = enrollments.filter(e =>
      ['ACTIVE', 'VALIDATED', 'ADMITTED', 'RE_ENROLLED'].includes(e.status)
    ).length;
    const newCount = enrollments.filter(e => e.enrollmentType === 'NEW').length;
    const reEnrolled = enrollments.filter(e => ['REPEAT', 'PROMOTION'].includes(e.enrollmentType)).length;
    // En attente = élèves PAS encore admis (pré-inscrits sans matricule, ou en
    // attente de validation). ADMITTED est exclu car l'élève est déjà inscrit.
    const pending = enrollments.filter(e =>
      ['PENDING', 'PRE_REGISTERED'].includes(e.status)
    ).length;
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

  // ⭐ Bascule "Nouvel élève / Ancien élève" — impacte les frais
  // (INSCRIPTION vs REINSCRIPTION) en recalculant le StudentAccount.
  const handleToggleEnrollmentType = async (
    enrollment: Enrollment,
    newType: 'NEW' | 'REPEAT',
  ) => {
    if (!academicYear) return;
    if (enrollment.enrollmentType === newType) return; // pas de changement
    try {
      const result = await studentsService.updateEnrollmentType({
        studentId: enrollment.student.id,
        academicYearId: academicYear.id,
        enrollmentType: newType,
      });
      toast({
        title: newType === 'NEW' ? '✅ Marqué comme nouvel élève' : '✅ Marqué comme ancien élève',
        description: result.accountRecalculated
          ? 'Compte financier recalculé automatiquement'
          : 'Type mis à jour (compte financier non recalculé)',
        variant: 'success',
      });
      loadData();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    }
  };

  // ⭐ Suppression définitive d'un élève (uniquement si PRE_REGISTERED ou ADMITTED)
  const handleDeleteStudent = async (enrollment: Enrollment) => {
    if (!confirm(
      `Êtes-vous sûr de vouloir supprimer définitivement ${enrollment.student.firstName} ${enrollment.student.lastName} ?\n\n` +
      `Cette action est IRRÉVERSIBLE et supprimera :\n` +
      `• L'inscription et le dossier académique\n` +
      `• Le compte financier (s'il n'y a pas de paiements)\n` +
      `• Les photos, responsables, et toutes les données liées\n\n` +
      `Tapez "SUPPRIMER" pour confirmer :`
    )) return;

    const input = prompt('Confirmez la suppression en tapant SUPPRIMER :');
    if (input !== 'SUPPRIMER') {
      toast({ title: 'Suppression annulée', variant: 'info' });
      return;
    }

    try {
      const result = await studentsService.deleteStudent(enrollment.student.id);
      toast({
        title: '✅ Élève supprimé',
        description: result.message,
        variant: 'success',
      });
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

  /**
   * ⭐ Sélectionne / désélectionne TOUS les élèves visibles dans l'arborescence
   *    (tous niveaux + classes déployés). Utilisé par la case "select all" de la barre d'actions.
   */
  const toggleSelectAllVisible = () => {
    const allVisibleIds: string[] = [];
    // Élèves non affectés (orphelins)
    if (Array.isArray(unassignedEnrollments)) {
      unassignedEnrollments.forEach(enr => {
        if (enr?.student?.id) allVisibleIds.push(enr.student.id);
      });
    }
    // Élèves dans les classes de l'arborescence
    // ⭐ Structure : filteredTree = [{ level, classes: [{ classInfo, students }], totalStudents }]
    //    ( PAS "groups" — c'était le bug : level.groups était undefined → crash .forEach)
    if (Array.isArray(filteredTree)) {
      filteredTree.forEach(levelNode => {
        const classes = levelNode?.classes;
        if (!Array.isArray(classes)) return;
        classes.forEach(cls => {
          const students = cls?.students;
          if (!Array.isArray(students)) return;
          students.forEach(enr => {
            if (enr?.student?.id) allVisibleIds.push(enr.student.id);
          });
        });
      });
    }
    // Si tous sont déjà sélectionnés → désélectionner tout, sinon → sélectionner tous
    const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedForBulk.has(id));
    if (allSelected) {
      setSelectedForBulk(new Set());
    } else {
      setSelectedForBulk(new Set(allVisibleIds));
    }
  };

  const clearBulkSelection = () => setSelectedForBulk(new Set());

  /**
   * ⭐ Action multiple : marquer les élèves sélectionnés comme ANCIENS (REPEAT).
   *    Bascule le type d'inscription de NEW → REPEAT, ce qui recalcul le StudentAccount
   *    (frais de réinscription au lieu de frais d'inscription).
   */
  const handleBulkMarkAsOld = async () => {
    if (selectedForBulk.size === 0 || !academicYear) return;
    if (!confirm(`Marquer ${selectedForBulk.size} élève(s) comme ANCIENS (frais de réinscription) ?`)) return;
    setIsProcessingBulk(true);
    let success = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const studentId of Array.from(selectedForBulk)) {
      try {
        await studentsService.updateEnrollmentType({
          studentId,
          academicYearId: academicYear.id,
          enrollmentType: 'REPEAT',
        });
        success++;
      } catch (e: any) {
        failed++;
        errors.push(`${studentId.slice(0, 8)}: ${e.message}`);
      }
    }
    toast({
      title: '✅ Action terminée',
      description: `${success} marqué(s) ancien(s) · ${failed} échec(s)`,
      variant: failed > 0 ? 'warning' : 'success',
    });
    clearBulkSelection();
    setIsProcessingBulk(false);
    loadData();
  };

  /**
   * ⭐ Action multiple : marquer les élèves sélectionnés comme NOUVEAUX (NEW).
   *    Bascule REPEAT → NEW (frais d'inscription complets).
   */
  const handleBulkMarkAsNew = async () => {
    if (selectedForBulk.size === 0 || !academicYear) return;
    if (!confirm(`Marquer ${selectedForBulk.size} élève(s) comme NOUVEAUX (frais d'inscription complets) ?`)) return;
    setIsProcessingBulk(true);
    let success = 0;
    let failed = 0;
    for (const studentId of Array.from(selectedForBulk)) {
      try {
        await studentsService.updateEnrollmentType({
          studentId,
          academicYearId: academicYear.id,
          enrollmentType: 'NEW',
        });
        success++;
      } catch (e: any) {
        failed++;
      }
    }
    toast({
      title: '✅ Action terminée',
      description: `${success} marqué(s) nouveau(x) · ${failed} échec(s)`,
      variant: failed > 0 ? 'warning' : 'success',
    });
    clearBulkSelection();
    setIsProcessingBulk(false);
    loadData();
  };

  /**
   * ⭐ Action multiple : suppression définitive des élèves sélectionnés.
   *    Double confirmation (prompt "SUPPRIMER") pour éviter les accidents.
   *    Ne supprime que les élèves en statut PRE_REGISTERED ou ADMITTED (sans paiements).
   */
  const handleBulkDelete = async () => {
    if (selectedForBulk.size === 0) return;
    if (!confirm(
      `⚠️ SUPPRESSION DÉFINITIVE de ${selectedForBulk.size} élève(s) ?\n\n` +
      `Cette action est IRRÉVERSIBLE et supprimera :\n` +
      `• Les inscriptions et dossiers académiques\n` +
      `• Les comptes financiers (s'il n'y a pas de paiements)\n` +
      `• Les photos, responsables, et toutes les données liées\n\n` +
      `Confirmez en tapant SUPPRIMER dans le champ qui va s'ouvrir.`
    )) return;

    const input = prompt(`Tapez SUPPRIMER pour confirmer la suppression de ${selectedForBulk.size} élève(s) :`);
    if (input !== 'SUPPRIMER') {
      toast({ title: 'Suppression annulée', variant: 'info' });
      return;
    }

    setIsProcessingBulk(true);
    let success = 0;
    let failed = 0;
    const failedIds: string[] = [];
    for (const studentId of Array.from(selectedForBulk)) {
      try {
        await studentsService.deleteStudent(studentId);
        success++;
      } catch (e: any) {
        failed++;
        failedIds.push(studentId);
      }
    }
    toast({
      title: '✅ Suppression terminée',
      description: `${success} supprimé(s) · ${failed} échec(s) (peut-être des paiements liés)`,
      variant: failed > 0 ? 'warning' : 'success',
    });
    clearBulkSelection();
    setIsProcessingBulk(false);
    loadData();
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
            {/* ⭐ Bouton Excel global — TOUTES les classes officielles, une feuille par classe */}
            <button
              onClick={async () => {
                if (!academicYear) return;
                setIsGlobalExcelExporting(true);
                try {
                  await studentsService.exportGlobalExcel(academicYear.id);
                  toast({ title: '✅ Excel global généré', description: 'Toutes les classes', variant: 'success' });
                } catch (e: any) {
                  toast({ title: 'Erreur', description: e.message, variant: 'error' });
                } finally {
                  setIsGlobalExcelExporting(false);
                }
              }}
              disabled={isGlobalExcelExporting || isGlobalPdfExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 transition disabled:opacity-50"
              title="Excel global — toutes les classes dans un seul fichier (une feuille par classe)"
            >
              {isGlobalExcelExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              {isGlobalExcelExporting ? '...' : 'Excel global'}
            </button>
            {/* ⭐ Bouton PDF global — TOUTES les classes officielles, page-break par classe */}
            <button
              onClick={async () => {
                if (!academicYear) return;
                setIsGlobalPdfExporting(true);
                try {
                  await studentsService.exportGlobalPdf(academicYear.id);
                  toast({ title: '✅ PDF global généré', description: 'Toutes les classes', variant: 'success' });
                } catch (e: any) {
                  toast({ title: 'Erreur', description: e.message, variant: 'error' });
                } finally {
                  setIsGlobalPdfExporting(false);
                }
              }}
              disabled={isGlobalExcelExporting || isGlobalPdfExporting}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-300 transition disabled:opacity-50"
              title="PDF global — toutes les classes dans un seul PDF (page-break par classe)"
            >
              {isGlobalPdfExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              {isGlobalPdfExporting ? '...' : 'PDF global'}
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-300 transition"
              title="Importer des élèves depuis Excel"
            >
              <Upload className="w-4 h-4" /> Importer
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

        {/* ⭐ Barre d'actions multiples — s'affiche quand ≥1 élève est sélectionné */}
        {selectedForBulk.size > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAllVisible}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900"
                title="Sélectionner / désélectionner tous les élèves visibles"
              >
                <input
                  type="checkbox"
                  checked={(() => {
                    const allIds: string[] = [];
                    if (Array.isArray(unassignedEnrollments)) {
                      unassignedEnrollments.forEach(e => { if (e?.student?.id) allIds.push(e.student.id); });
                    }
                    if (Array.isArray(filteredTree)) {
                      filteredTree.forEach(l => {
                        if (!Array.isArray(l?.classes)) return;
                        l.classes.forEach(c => {
                          if (!Array.isArray(c?.students)) return;
                          c.students.forEach(e => { if (e?.student?.id) allIds.push(e.student.id); });
                        });
                      });
                    }
                    return allIds.length > 0 && allIds.every(id => selectedForBulk.has(id));
                  })()}
                  onChange={() => {/* handled by onClick on parent */}}
                  className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">
                  {selectedForBulk.size} sélectionné{selectedForBulk.size > 1 ? 's' : ''}
                </span>
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleBulkMarkAsOld}
                disabled={isProcessingBulk || !academicYear}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-200 transition disabled:opacity-50"
                title="Marquer comme anciens (frais de réinscription)"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Marquer anciens
              </button>
              <button
                onClick={handleBulkMarkAsNew}
                disabled={isProcessingBulk || !academicYear}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition disabled:opacity-50"
                title="Marquer comme nouveaux (frais d'inscription complets)"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Marquer nouveaux
              </button>
              <button
                onClick={() => setBulkReEnrollOpen(true)}
                disabled={isProcessingBulk}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 transition disabled:opacity-50"
                title="Réinscription massive vers une autre année"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Réinscrire
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isProcessingBulk}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-md border border-red-200 transition disabled:opacity-50"
                title="Supprimer définitivement (uniquement élèves sans paiements)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
              <button
                onClick={clearBulkSelection}
                disabled={isProcessingBulk}
                className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition disabled:opacity-50"
                title="Effacer la sélection"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        {isProcessingBulk && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            <Loader2 className="w-4 h-4 animate-spin" />
            Traitement en cours...
          </div>
        )}

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
                                        <span className="w-6 shrink-0 text-center">✓</span>
                                        <span className="w-56 shrink-0">Nom & Matricule</span>
                                        <span className="w-20 shrink-0">Type</span>
                                        <span className="w-24 shrink-0">Statut</span>
                                        <span className="w-24 shrink-0">Date</span>
                                        <span className="w-20 shrink-0">Actions</span>
                                      </div>
                                      {group.students.map((enr, idx) => {
                                        const statusInfo = STATUS_META[enr.status] || { label: enr.status, color: 'bg-slate-50 text-slate-600 border-slate-200' };
                                        const typeInfo = TYPE_META[enr.enrollmentType] || { label: enr.enrollmentType, color: 'bg-slate-50 text-slate-600' };
                                        const isBulkSelected = selectedForBulk.has(enr.student.id);
                                        return (
                                          <div key={enr.id} className={`flex items-center gap-3 py-2 px-3 hover:bg-amber-50/40 rounded-lg transition-colors group whitespace-nowrap min-w-max ${isBulkSelected ? 'bg-blue-50' : ''}`}>
                                            <span className="w-8 text-center text-sm font-bold text-slate-500 shrink-0">{idx + 1}</span>
                                            <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-xs font-bold text-amber-600 group-hover:bg-amber-200 group-hover:text-amber-700 transition-colors shrink-0 overflow-hidden">
                                              {enr.student.photoUrl ? (
                                                <img src={enr.student.photoUrl} alt="" className="w-full h-full object-cover rounded-full" />
                                              ) : (
                                                <>{enr.student.lastName[0]}{enr.student.firstName[0]}</>
                                              )}
                                            </div>
                                            <div className="w-6 shrink-0 flex justify-center">
                                              <input
                                                type="checkbox"
                                                checked={isBulkSelected}
                                                onChange={() => toggleBulkSelection(enr.student.id)}
                                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                title="Sélectionner pour action multiple"
                                              />
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
                                              {/* ⭐ Toggle Nouvel/Ancien élève — impacte les frais */}
                                              {enr.enrollmentType === 'NEW' ? (
                                                <button
                                                  onClick={() => handleToggleEnrollmentType(enr, 'REPEAT')}
                                                  className="p-1 hover:bg-amber-100 rounded text-amber-600"
                                                  title="Marquer comme ancien élève (frais de réinscription)"
                                                ><RefreshCw className="w-4 h-4" /></button>
                                              ) : (
                                                <button
                                                  onClick={() => handleToggleEnrollmentType(enr, 'NEW')}
                                                  className="p-1 hover:bg-blue-100 rounded text-blue-600"
                                                  title="Marquer comme nouvel élève (frais d'inscription)"
                                                ><UserPlus className="w-4 h-4" /></button>
                                              )}
                                              <button
                                                onClick={() => router.push(`/app/finance/accounts?studentId=${enr.student.id}`)}
                                                className="p-1 hover:bg-emerald-100 rounded text-emerald-600"
                                                title="Régime & Finance"
                                              ><DollarSign className="w-4 h-4" /></button>
                                              {/* ⭐ Supprimer (seulement si PRE_REGISTERED ou ADMITTED) */}
                                              {(enr.status === 'PRE_REGISTERED' || enr.status === 'ADMITTED') && (
                                                <button
                                                  onClick={() => handleDeleteStudent(enr)}
                                                  className="p-1 hover:bg-red-100 rounded text-red-600"
                                                  title="Supprimer définitivement"
                                                ><Trash2 className="w-4 h-4" /></button>
                                              )}
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
                    <div className={cn('w-full flex items-center gap-3 px-5 py-4 transition-colors text-left group', getLevelHoverColor(node.level.name))}>
                    <button
                      onClick={() => toggleLevel(node.level.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
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
                    {/* ⭐ Bouton : PDF de toutes les classes du niveau */}
                    <button
                      onClick={async () => {
                        if (!academicYear) return;
                        // Résoudre le code du niveau depuis le nom
                        const upperName = levelName.toUpperCase();
                        const levelCode = upperName.includes('MATERNELLE') ? 'MATERNELLE'
                          : upperName.includes('PRIMAIRE') ? 'PRIMAIRE'
                          : upperName.includes('SECONDAIRE') ? 'SECONDAIRE' : '';
                        if (!levelCode) {
                          toast({ title: 'Erreur', description: 'Code niveau non résolu', variant: 'error' });
                          return;
                        }
                        setAllPdfGeneratingLevelId(node.level.id);
                        try {
                          await studentsService.exportAllClassesPdf(academicYear.id, levelCode);
                          toast({ title: '✅ PDF généré', description: `Toutes les listes ${levelName}`, variant: 'success' });
                        } catch (e: any) {
                          toast({ title: 'Erreur PDF', description: e.message, variant: 'error' });
                        } finally {
                          setAllPdfGeneratingLevelId(null);
                        }
                      }}
                      disabled={allPdfGeneratingLevelId === node.level.id}
                      className={cn(
                        'p-1.5 rounded-lg transition shrink-0',
                        allPdfGeneratingLevelId === node.level.id
                          ? 'bg-blue-100 text-blue-600 cursor-wait'
                          : cn('text-slate-400', getLevelButtonHover(levelName)),
                      )}
                      title="Générer le PDF de toutes les classes de ce niveau"
                    >
                      {allPdfGeneratingLevelId === node.level.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <FileText className="w-4 h-4" />}
                    </button>
                    </div>

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
                                          // ⭐ Mode 'official' : on génère le PDF par classe officielle (AcademicClass).
                                          // Toutes les sections physiques (CE1-A, CE1-B...) sont regroupées dans ce PDF.
                                          studentsService.generateAndStoreClassListPdf(classInfo.id, academicYear.id, 'official')
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
                                            // ⭐ Mode 'official' : récupère le PDF officiel stocké en DB.
                                            const { url, fileName } = await studentsService.getStoredClassListPdf(classInfo.id, academicYear.id, 'official');
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
                                      {/* ⭐ Bouton Excel — génère un fichier Excel pour cette classe officielle */}
                                      <button
                                        onClick={async () => {
                                          if (!academicYear) return;
                                          setExcelGeneratingClassId(classInfo.id);
                                          try {
                                            await studentsService.exportClassExcel(academicYear.id, classInfo.id, classInfo.name);
                                            toast({ title: '✅ Excel généré', description: classInfo.name, variant: 'success' });
                                          } catch (e: any) {
                                            toast({ title: 'Erreur Excel', description: e.message, variant: 'error' });
                                          } finally {
                                            setExcelGeneratingClassId(null);
                                          }
                                        }}
                                        disabled={excelGeneratingClassId === classInfo.id}
                                        className={cn(
                                          'p-1.5 rounded-lg transition shrink-0',
                                          excelGeneratingClassId === classInfo.id
                                            ? 'bg-green-100 text-green-600 cursor-wait'
                                            : cn('text-slate-400 hover:bg-green-100 hover:text-green-600'),
                                        )}
                                        title="Générer le fichier Excel de cette classe"
                                      >
                                        {excelGeneratingClassId === classInfo.id
                                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          : <FileSpreadsheet className="w-3.5 h-3.5" />}
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
                                                <span className="w-6 shrink-0 text-center">✓</span>
                                                <span className="w-56 shrink-0">Nom & Matricule</span>
                                                <span className="w-20 shrink-0">Type</span>
                                                <span className="w-24 shrink-0">Statut</span>
                                                <span className="w-24 shrink-0">Date</span>
                                                <span className="w-20 shrink-0">Actions</span>
                                              </div>
                                              {filteredStudents.map((enr, idx) => {
                                                const statusInfo = STATUS_META[enr.status] || { label: enr.status, color: 'bg-slate-50 text-slate-600 border-slate-200' };
                                                const typeInfo = TYPE_META[enr.enrollmentType] || { label: enr.enrollmentType, color: 'bg-slate-50 text-slate-600' };
                                                const isBulkSelected = selectedForBulk.has(enr.student.id);
                                                return (
                                                  <div key={enr.id} className={`flex items-center gap-3 py-2 px-3 hover:bg-slate-50 rounded-lg transition-colors group whitespace-nowrap min-w-max ${isBulkSelected ? 'bg-blue-50' : ''}`}>
                                                    <span className="w-8 text-center text-sm font-bold text-slate-500 shrink-0">{idx + 1}</span>
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors shrink-0 overflow-hidden">
                                                      {enr.student.photoUrl ? (
                                                        <img src={enr.student.photoUrl} alt="" className="w-full h-full object-cover rounded-full" />
                                                      ) : (
                                                        <>{enr.student.lastName[0]}{enr.student.firstName[0]}</>
                                                      )}
                                                    </div>
                                                    <div className="w-6 shrink-0 flex justify-center">
                                                      <input
                                                        type="checkbox"
                                                        checked={isBulkSelected}
                                                        onChange={() => toggleBulkSelection(enr.student.id)}
                                                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        title="Sélectionner pour action multiple"
                                                      />
                                                    </div>
                                                    <div className="w-56 shrink-0">
                                                      <p className="text-sm font-medium text-slate-800 truncate">{enr.student.lastName.toUpperCase()} {enr.student.firstName}</p>
                                                      <p className="text-[10px] font-mono text-slate-400">{enr.student.matricule || enr.student.studentCode || '—'}</p>
                                                    </div>
                                                    <div className="w-20 shrink-0 flex justify-center"><span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold inline-block', typeInfo.color)}>{typeInfo.label}</span></div>
                                                    <div className="w-24 shrink-0 flex justify-center"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block', statusInfo.color)}>{statusInfo.label}</span></div>
                                                    <span className="w-24 text-xs text-slate-500 shrink-0">{new Date(enr.enrollmentDate).toLocaleDateString('fr-FR')}</span>
                                                    <div className="flex gap-1 w-32 shrink-0">
                                                      {enr.status === 'PENDING' || enr.status === 'PRE_REGISTERED' || enr.status === 'ADMITTED' ? (
                                                        <button onClick={() => handleValidate(enr.student.id)} className="p-1 hover:bg-emerald-100 rounded text-emerald-600" title="Valider"><CheckCircle className="w-4 h-4" /></button>
                                                      ) : null}
                                                      <button onClick={() => setEditEnrollment(enr)} className="p-1 hover:bg-amber-100 rounded text-amber-600" title="Éditer / Compléter"><Pencil className="w-4 h-4" /></button>
                                                      <button onClick={() => handleReEnroll(enr)} className="p-1 hover:bg-indigo-100 rounded text-indigo-600" title="Réinscrire"><RotateCcw className="w-4 h-4" /></button>
                                                      {/* ⭐ Toggle Nouvel/Ancien élève — impacte les frais */}
                                                      {enr.enrollmentType === 'NEW' ? (
                                                        <button
                                                          onClick={() => handleToggleEnrollmentType(enr, 'REPEAT')}
                                                          className="p-1 hover:bg-amber-100 rounded text-amber-600"
                                                          title="Marquer comme ancien élève (frais de réinscription)"
                                                        ><RefreshCw className="w-4 h-4" /></button>
                                                      ) : (
                                                        <button
                                                          onClick={() => handleToggleEnrollmentType(enr, 'NEW')}
                                                          className="p-1 hover:bg-blue-100 rounded text-blue-600"
                                                          title="Marquer comme nouvel élève (frais d'inscription)"
                                                        ><UserPlus className="w-4 h-4" /></button>
                                                      )}
                                                      <button
                                                        onClick={() => router.push(`/app/finance/accounts?studentId=${enr.student.id}`)}
                                                        className="p-1 hover:bg-emerald-100 rounded text-emerald-600"
                                                        title="Régime & Finance"
                                                      ><DollarSign className="w-4 h-4" /></button>
                                                      {/* ⭐ Supprimer (seulement si PRE_REGISTERED ou ADMITTED) */}
                                                      {(enr.status === 'PRE_REGISTERED' || enr.status === 'ADMITTED') && (
                                                        <button
                                                          onClick={() => handleDeleteStudent(enr)}
                                                          className="p-1 hover:bg-red-100 rounded text-red-600"
                                                          title="Supprimer définitivement"
                                                        ><Trash2 className="w-4 h-4" /></button>
                                                      )}
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
        <StudentEnrollmentForm
          onSubmit={async (data) => {
            try {
              const effectiveSchoolLevelId = data.schoolLevelId || schoolLevel!.schoolLevelId || schoolLevel!.id;

              // 1. Pré-inscrire l'élève — ne PAS envoyer photoUrl dans le payload
              //    (sera uploadée via uploadPhoto séparément pour persister dans student_photos).
              //    Le backend preRegister persiste déjà npi, photoUrl, placeOfBirth, etc.
              // ⭐ FIX: data.classId est en réalité l'UUID d'un AcademicClass (CP, CE1, 6ème…)
              //    récupéré depuis /api/academic-classes. Il faut l'envoyer comme
              //    `academicClassId` (pas `classId`) sinon le backend lève une erreur
              //    P2003 FK violation car l'UUID n'existe pas dans la table `classes`
              //    (classes physiques) → HTTP 400 "Référence invalide".
              const student = await studentsService.preRegister({
                academicYearId: academicYear!.id,
                schoolLevelId: effectiveSchoolLevelId,
                firstName: data.student.firstName,
                lastName: data.student.lastName,
                // Convertir la date string (YYYY-MM-DD) en ISO pour Prisma
                dateOfBirth: data.student.dateOfBirth ? new Date(data.student.dateOfBirth).toISOString() : undefined,
                gender: data.student.gender || undefined,
                nationality: data.student.nationality || undefined,
                placeOfBirth: data.student.placeOfBirth || undefined,
                npi: data.student.npi || undefined,
                // ⭐ data.classId = UUID d'AcademicClass → envoyé comme academicClassId
                academicClassId: data.classId || undefined,
                // ⭐ enrollmentType : 'NEW' (frais INSCRIPTION) ou 'REPEAT' (frais RÉINSCRIPTION)
                enrollmentType: data.enrollmentType,
              });

              // 1b. Upload photo via endpoint dédié (pattern RH) si data URL présente
              if (data.student.photoUrl && data.student.photoUrl.startsWith('data:')) {
                await studentsService.uploadPhoto(student.id, data.student.photoUrl)
                  .catch((e: any) => console.warn('uploadPhoto:', e?.message));
              }

              // 2. Admettre l'élève (génère matricule + compte financier)
              // ⭐ Ne PAS envoyer classId ici — data.classId est un AcademicClass UUID,
              // pas un Class UUID. Le preRegister a déjà assigné academicClassId.
              // admit n'a pas de paramètre academicClassId, donc on ne fait rien
              // pour la classe ici (l'enrollment a déjà academicClassId du preRegister).
              const admitted = await studentsService.admit({
                studentId: student.id,
                academicYearId: academicYear!.id,
                schoolLevelId: effectiveSchoolLevelId,
              });

              // 3. Ajouter les parents (non bloquant)
              if (data.guardians?.length) {
                for (const g of data.guardians) {
                  if (!g.firstName?.trim() && !g.lastName?.trim()) continue;
                  await studentsService.addGuardians(student.id, {
                    guardians: [{
                      firstName: g.firstName, lastName: g.lastName,
                      relationship: g.relationship || 'GUARDIAN',
                      phone: g.phone, email: g.email, isPrimary: g.isPrimary ?? false,
                    }],
                  }).catch((e: any) => console.warn('Guardian:', e?.message));
                }
              }

              toast({
                title: 'Inscription effectuée',
                description: `${data.student.firstName} ${data.student.lastName} a été admis(e)${admitted?.matricule ? ` (matricule: ${admitted.matricule})` : ''}.`,
                variant: 'success',
              });
              setIsCreateModalOpen(false);
              loadData();
              return admitted;
            } catch (e: any) {
              console.error('Erreur inscription:', e);
              toast({
                title: "Erreur lors de l'inscription",
                description: e?.message || 'Une erreur est survenue.',
                variant: 'error',
              });
              throw e;
            }
          }}
          onCancel={() => setIsCreateModalOpen(false)}
        />
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

      {/* ─── MODAL : Éditer / Compléter une inscription ─── */}
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
            schoolLevelId={schoolLevel.schoolLevelId || schoolLevel.id}
            initialData={{
              firstName: editEnrollment.student.firstName || '',
              lastName: editEnrollment.student.lastName || '',
              gender: (editEnrollment.student.gender as any) || '',
              dateOfBirth: editEnrollment.student.dateOfBirth || '',
              nationality: editEnrollment.student.nationality || '',
              placeOfBirth: editEnrollment.student.placeOfBirth || '',
              photoUrl: editEnrollment.student.photoUrl || '',
              npi: editEnrollment.student.npi || '',
              // ⭐ Priorité à academicClass.id (UUID AcademicClass — type attendu par le <select>)
              //    Fallback sur class.id (UUID classe physique — ancien format)
              classId: editEnrollment.academicClass?.id || editEnrollment.class?.id || '',
              // ⭐ Précharger enrollmentType (NEW/REPEAT) pour ne pas fausser l'UI
              enrollmentType: editEnrollment.enrollmentType || 'NEW',
              // Pré-remplir les guardians depuis les données existantes
              guardians: (editEnrollment.student.studentGuardians || []).map((sg: any) => ({
                id: sg.guardian?.id, // ⭐ Conserver l'ID pour détecter update vs create
                studentGuardianId: sg.id, // ⭐ ID de la junction pour PUT/DELETE
                firstName: sg.guardian?.firstName || '',
                lastName: sg.guardian?.lastName || '',
                phone: sg.guardian?.phone || '',
                email: sg.guardian?.email || '',
                relationship: sg.relationship || sg.guardian?.relationship || 'PÈRE',
                isPrimary: sg.isPrimary ?? false,
              })),
            }}
            onSubmit={async (data) => {
              try {
                // Update des infos élève — ne PAS envoyer photoUrl (géré par uploadPhoto séparément)
                // Le backend UpdateStudentPrismaDto a forbidNonWhitelisted=true ; on n'envoie QUE
                // les champs whitelistés pour éviter tout 400 "property X should not exist".
                await studentsService.update(editEnrollment.student.id, {
                  firstName: data.student.firstName,
                  lastName: data.student.lastName,
                  dateOfBirth: data.student.dateOfBirth ? new Date(data.student.dateOfBirth).toISOString() : undefined,
                  gender: data.student.gender || undefined,
                  nationality: data.student.nationality || undefined,
                  placeOfBirth: data.student.placeOfBirth || undefined,
                  npi: data.student.npi || undefined,
                  // ⚠️ PAS de photoUrl ici — la photo est uploadée via uploadPhoto (endpoint dédié)
                });
                // Upload photo si nouvelle (data URL)
                if (data.student.photoUrl && data.student.photoUrl.startsWith('data:')) {
                  await studentsService.uploadPhoto(editEnrollment.student.id, data.student.photoUrl)
                    .catch((e: any) => console.warn('uploadPhoto:', e?.message));
                }
                // Changement de classe
                if (data.classId && data.classId !== editEnrollment.class?.id) {
                  await studentsService.changeClass(editEnrollment.student.id, academicYear.id, data.classId)
                    .catch((e: any) => console.warn('changeClass:', e?.message));
                }
                // Guardians — distinguer nouveaux (POST) vs existants (PUT)
                // ⭐ Avant : on appelait addGuardians (POST) pour chaque guardian,
                //    y compris les existants — ce qui violait @@unique([studentId, guardianId])
                //    et échouait silencieusement. Maintenant on met à jour les existants.
                if (data.guardians?.length) {
                  // Récupérer la liste actuelle des studentGuardianIds pour détecter les suppressions
                  const existingStudentGuardianIds = (editEnrollment.student.studentGuardians || [])
                    .map((sg: any) => sg.id);
                  const keptStudentGuardianIds: string[] = [];

                  for (const g of data.guardians) {
                    if (!g.firstName?.trim() && !g.lastName?.trim()) continue;
                    if (g.id && g.studentGuardianId) {
                      // Guardian existant → PUT update
                      keptStudentGuardianIds.push(g.studentGuardianId);
                      await apiFetch(`/students/${editEnrollment.student.id}/guardians/${g.id}`, {
                        method: 'PUT',
                        body: {
                          firstName: g.firstName,
                          lastName: g.lastName,
                          phone: g.phone || null,
                          email: g.email || null,
                        },
                      }).catch((e: any) => console.warn('updateGuardian:', e?.message));
                      // Update aussi la relation (relationship + isPrimary)
                      await apiFetch(`/students/${editEnrollment.student.id}/guardians/relation/${g.studentGuardianId}`, {
                        method: 'PUT',
                        body: {
                          relationship: g.relationship || 'PÈRE',
                          isPrimary: g.isPrimary ?? false,
                        },
                      }).catch((e: any) => console.warn('updateGuardianRelation:', e?.message));
                    } else {
                      // Nouveau guardian → POST
                      await studentsService.addGuardians(editEnrollment.student.id, {
                        guardians: [{
                          firstName: g.firstName, lastName: g.lastName,
                          relationship: g.relationship || 'GUARDIAN',
                          phone: g.phone, email: g.email, isPrimary: g.isPrimary ?? false,
                        }],
                      }).catch((e: any) => console.warn('addGuardian:', e?.message));
                    }
                  }

                  // Supprimer les guardians qui ne sont plus dans la liste
                  const toDelete = existingStudentGuardianIds.filter((id: string) => !keptStudentGuardianIds.includes(id));
                  for (const studentGuardianId of toDelete) {
                    await apiFetch(`/students/${editEnrollment.student.id}/guardians/${studentGuardianId}`, {
                      method: 'DELETE',
                    }).catch((e: any) => console.warn('deleteGuardian:', e?.message));
                  }
                }
                toast({ title: '✅ Inscription mise à jour', variant: 'success' });
                setEditEnrollment(null);
                loadData();
              } catch (e: any) {
                console.error('Erreur modification inscription:', e);
                toast({
                  title: "Erreur lors de la modification",
                  description: e?.message || 'Une erreur est survenue.',
                  variant: 'error',
                });
                throw e;
              }
            }}
            onCancel={() => setEditEnrollment(null)}
          />
        </FormModal>
      )}

      {/* ─── MODAL : Import en masse ─── */}
      <ImportElevesModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          // Recharger la liste des inscriptions après import
          window.location.reload();
        }}
      />
    </>
  );
}
