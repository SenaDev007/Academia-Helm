/**
 * ============================================================================
 * MODULE 1 — ÉLÈVES & INSCRIPTIONS (Spec Dawes)
 * ============================================================================
 *
 * 6 sous-modules métier (pas de duplication avec QHSE / Documents globaux) :
 * Admission & cycle de vie, Identité & relations, Historique & multi-année,
 * Régimes & situation fin., Documents & carte scolaire, Interopérabilité nationale.
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  User,
  Users,
  FileText,
  Edit,
  Trash2,
  Eye,
  Download,
  Upload,
  UserPlus,
  History,
  DollarSign,
  CreditCard,
  Share2,
  LayoutDashboard,
  Fingerprint,
  IdCard,
  Globe,
  Activity,
  HeartPulse,
  Archive,
  MessageSquare,
  GraduationCap,
  ListChecks,
  RefreshCw,
  X,
  CheckSquare,
  // BadgeCheck supprimé — onglet Conformité retiré
} from 'lucide-react';
import {
  ModuleContainer,
  FormModal,
  ConfirmModal,
  ReadOnlyModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { formatGradeLabel } from '@/lib/utils';
import EnrollmentsContent from '@/components/students/EnrollmentsContent';
import AdmissionsContent from '@/components/students/AdmissionsContent';
import StudentIdCardsSection from '@/components/students/StudentIdCardsSection';
import StudentsModuleDashboard from '@/components/students/StudentsModuleDashboard';
import StudentIdentityContent from '@/components/students/StudentIdentityContent';
import StudentHistoryContent from '@/components/students/StudentHistoryContent';
import StudentDossierSection from '@/components/students/StudentDossierSection';
import StudentInteropContent from '@/components/students/StudentInteropContent';
import StudentFamiliesContent from '@/components/students/StudentFamiliesContent';
import StudentAssignmentsContent from '@/components/students/StudentAssignmentsContent';
import StudentMovementsContent from '@/components/students/StudentMovementsContent';
import StudentAffectationsMouvementsContent from '@/components/students/StudentAffectationsMouvementsContent';
import StudentAnalyticsContent from '@/components/students/StudentAnalyticsContent';
// ⭐ StudentComplianceContent et StudentSettingsContent supprimés — onglets retirés du module
import StudentAuditContent from '@/components/students/StudentAuditContent';
import StudentTransferContent from '@/components/students/StudentTransferContent';
import StudentClassListsContent from '@/components/students/StudentClassListsContent';
// ⭐ AbsencesContent supprimé — l'onglet Absences a été retiré du module Élèves
import StudentSaraAssistant from '@/components/students/StudentSaraAssistant';
import { ArrowRightLeft, BarChart3 } from 'lucide-react';
import EntitySyncIndicator from '@/components/offline/EntitySyncIndicator';
import { useEntitySyncStatusBatch } from '@/hooks/useEntitySyncStatus';

// ============================================================================
// TYPES
// ============================================================================

interface Student {
  id: string;
  studentCode?: string;
  matricule?: string | null;
  npi?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  primaryLanguage?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'TRANSFERRED' | 'ARCHIVED';
  schoolLevel?: {
    id: string;
    code: string;
    label: string;
  };
  studentEnrollments?: Array<{
    id: string;
    class?: {
      id: string;
      name: string;
    };
    status: string;
    enrollmentType: string;
  }>;
  studentGuardians?: Array<{
    id: string;
    guardian: {
  firstName: string;
  lastName: string;
      phone?: string;
      email?: string;
    };
    relationship: string;
    isPrimary: boolean;
  }>;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function StudentsModulePage() {
  const { academicYear, schoolLevel, tenantId, isLoading: contextLoading } = useModuleContext();
  const syncStatuses = useEntitySyncStatusBatch('STUDENT', tenantId ?? undefined);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statistics, setStatistics] = useState<any>(null);
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  
  // Filtres
  const [filters, setFilters] = useState({
    classId: '',
    status: '',
    search: '',
    regimeType: '',
    hasArrears: '',
  });
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([]);

  // ⭐ Actions multiples — sélection d'un groupe d'élèves
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false);
  const [isBulkArchiveModalOpen, setIsBulkArchiveModalOpen] = useState(false);
  const [isBulkReenrollModalOpen, setIsBulkReenrollModalOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<string>('ACTIVE');
  const [bulkStatusReason, setBulkStatusReason] = useState<string>('');
  const [bulkArchiveReason, setBulkArchiveReason] = useState<string>('');
  const [bulkReenrollClassId, setBulkReenrollClassId] = useState<string>('');
  const [bulkReenrollType, setBulkReenrollType] = useState<string>('REPEAT');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    action: string;
    success: number;
    failed: number;
    total: number;
    errors?: Array<{ id: string; error: string }>;
  } | null>(null);
  /** Onglet actif (Dashboard par défaut à l'ouverture du module).
   *  Si l'URL contient ?tab=admissions (ex: depuis une notification), on active
   *  automatiquement l'onglet correspondant. */
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) return tab;
    }
    return 'dashboard';
  });
  const studentFormRef = useRef<HTMLFormElement>(null);
  const statsUnauthorizedRef = useRef(false);
  const isStatsLoadingRef = useRef(false);
  const lastStatsRequestKeyRef = useRef<string | null>(null);
  const isStudentsLoadingRef = useRef(false);
  const lastStudentsRequestKeyRef = useRef<string | null>(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (academicYear?.id && schoolLevel?.id) {
      loadStudents();
      loadStatistics();
    }
  }, [
    academicYear?.id,
    schoolLevel?.id,
    filters.classId,
    filters.status,
    filters.search,
    filters.regimeType,
    filters.hasArrears,
  ]);

  useEffect(() => {
    // Réautoriser les appels stats lors d'un changement de contexte.
    statsUnauthorizedRef.current = false;
  }, [academicYear?.id, schoolLevel?.id]);

  // Classes chargées depuis la BDD (configurées dans Paramètres), filtrées par niveau scolaire
  useEffect(() => {
    if (!academicYear?.id) {
      setClassesList([]);
      return;
    }
    const params = new URLSearchParams({ academicYearId: academicYear.id });
    if (schoolLevel?.id && schoolLevel.id !== 'ALL') params.set('schoolLevelId', schoolLevel.id);
    fetch(`/api/classes?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.data ?? data?.classes ?? [];
        setClassesList(list.map((c: any) => ({ id: c.id, name: c.name || c.code || c.id })));
      })
      .catch(() => setClassesList([]));
  }, [academicYear?.id, schoolLevel?.id]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

    const loadStudents = async () => {
    if (!academicYear || !schoolLevel) return;

      const requestKey = JSON.stringify({
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel.id,
        ...filters,
      });
      if (isStudentsLoadingRef.current && lastStudentsRequestKeyRef.current === requestKey) {
        return;
      }
      isStudentsLoadingRef.current = true;
      lastStudentsRequestKeyRef.current = requestKey;
      setIsLoading(true);
      try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel.id,
        ...(filters.classId && { classId: filters.classId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
        ...(filters.regimeType && { regimeType: filters.regimeType }),
        ...(filters.hasArrears && { hasArrears: filters.hasArrears }),
      });

      const response = await fetch(`/api/students?${params}`);
        if (response.ok) {
          const data = await response.json();
          // ⭐ L'API retourne un objet paginé { data: [...], total, page, ... }
          //    mais peut aussi retourner un array (ancien format). On gère les deux.
          const studentsArray = Array.isArray(data) ? data : (data?.data ?? data?.items ?? []);
          setStudents(studentsArray);
        }
      } catch (error) {
        console.error('Failed to load students:', error);
      } finally {
        isStudentsLoadingRef.current = false;
        setIsLoading(false);
      }
    };

  const loadStatistics = async () => {
    if (!academicYear || !schoolLevel) return;
    if (statsUnauthorizedRef.current) return;

    try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel.id,
      });

      const requestKey = params.toString();
      if (isStatsLoadingRef.current && lastStatsRequestKeyRef.current === requestKey) {
        return;
      }
      isStatsLoadingRef.current = true;
      lastStatsRequestKeyRef.current = requestKey;

      const response = await fetch(`/api/students/statistics?${params}`);
      if (response.ok) {
        statsUnauthorizedRef.current = false;
        const data = await response.json();
        setStatistics(data);
      } else if (response.status === 401) {
        // Stopper les boucles d'appels quand le backend refuse le contexte.
        statsUnauthorizedRef.current = true;
        setStatistics(null);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      isStatsLoadingRef.current = false;
    }
  };

  const handleCreate = () => {
    setSelectedStudent(null);
    setIsCreateModalOpen(true);
  };

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setIsEditModalOpen(true);
  };

  const handleView = (student: Student) => {
    setSelectedStudent(student);
    setIsViewModalOpen(true);
  };

  const handleDelete = (student: Student) => {
    setSelectedStudent(student);
    setIsDeleteModalOpen(true);
  };

  const handleSubmit = async (formData: any) => {
    try {
      if (selectedStudent) {
        // Update
        const response = await fetch(`/api/students/${selectedStudent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (response.ok) {
          // ✅ Reset selectedStudent to avoid stale form data on next "Créer"
          setSelectedStudent(null);
          setIsEditModalOpen(false);
          loadStudents();
          loadStatistics(); // ✅ FIX: was missing — caused dashboard KPIs to show 00
        } else {
          const err = await response.json().catch(() => ({}));
          console.error('Update failed:', err);
          alert(`Erreur lors de la modification: ${err.message || response.statusText}`);
        }
      } else {
        // Create
        const response = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            academicYearId: academicYear?.id,
            schoolLevelId: schoolLevel?.id,
          }),
        });
        if (response.ok) {
          setSelectedStudent(null);
          setIsCreateModalOpen(false);
          loadStudents();
          loadStatistics();
        } else {
          const err = await response.json().catch(() => ({}));
          console.error('Create failed:', err);
          alert(`Erreur lors de la création: ${err.message || response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Failed to save student:', error);
      alert(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedStudent) return;

    try {
      const response = await fetch(`/api/students/${selectedStudent.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Suppression demandée' }),
      });
      if (response.ok) {
        setIsDeleteModalOpen(false);
        setSelectedStudent(null);
    loadStudents();
        loadStatistics();
      }
    } catch (error) {
      console.error('Failed to archive student:', error);
    }
  };

  // ============================================================================
  // ⭐ ACTIONS MULTIPLES — Handlers pour les opérations en masse
  // ============================================================================

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedStudentIds((prev) => {
      // Si tous les élèves visibles sont déjà sélectionnés → désélectionner
      if (prev.size === students.length && students.length > 0) {
        return new Set();
      }
      // Sinon → sélectionner tous les élèves visibles
      return new Set(students.map((s) => s.id));
    });
  };

  const clearSelection = () => setSelectedStudentIds(new Set());

  const handleBulkStatusSubmit = async () => {
    if (selectedStudentIds.size === 0) return;
    setIsBulkProcessing(true);
    setBulkResult(null);
    try {
      const response = await fetch('/api/students/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: Array.from(selectedStudentIds),
          status: bulkStatusValue,
          reason: bulkStatusReason || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setBulkResult({
          action: 'Changement de statut',
          success: data.updated ?? data.success ?? 0,
          failed: data.failed ?? data.skipped ?? 0,
          total: data.total ?? selectedStudentIds.size,
          errors: data.errors,
        });
        setIsBulkStatusModalOpen(false);
        setBulkStatusReason('');
        clearSelection();
        await loadStudents();
        await loadStatistics();
      } else {
        setBulkResult({
          action: 'Changement de statut',
          success: 0,
          failed: selectedStudentIds.size,
          total: selectedStudentIds.size,
          errors: [{ id: 'global', error: data.message || 'Erreur serveur' }],
        });
      }
    } catch (e: any) {
      setBulkResult({
        action: 'Changement de statut',
        success: 0,
        failed: selectedStudentIds.size,
        total: selectedStudentIds.size,
        errors: [{ id: 'global', error: e?.message || 'Erreur réseau' }],
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkArchiveSubmit = async () => {
    if (selectedStudentIds.size === 0) return;
    setIsBulkProcessing(true);
    setBulkResult(null);
    try {
      const response = await fetch('/api/students/bulk-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: Array.from(selectedStudentIds),
          reason: bulkArchiveReason || 'Archivage en masse',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setBulkResult({
          action: 'Archivage',
          success: data.archived ?? 0,
          failed: data.failed ?? 0,
          total: data.total ?? selectedStudentIds.size,
          errors: data.errors,
        });
        setIsBulkArchiveModalOpen(false);
        setBulkArchiveReason('');
        clearSelection();
        await loadStudents();
        await loadStatistics();
      } else {
        setBulkResult({
          action: 'Archivage',
          success: 0,
          failed: selectedStudentIds.size,
          total: selectedStudentIds.size,
          errors: [{ id: 'global', error: data.message || 'Erreur serveur' }],
        });
      }
    } catch (e: any) {
      setBulkResult({
        action: 'Archivage',
        success: 0,
        failed: selectedStudentIds.size,
        total: selectedStudentIds.size,
        errors: [{ id: 'global', error: e?.message || 'Erreur réseau' }],
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkReenrollSubmit = async () => {
    if (selectedStudentIds.size === 0 || !academicYear || !schoolLevel) return;
    setIsBulkProcessing(true);
    setBulkResult(null);
    try {
      const response = await fetch('/api/students/bulk-reenroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: Array.from(selectedStudentIds),
          academicYearId: academicYear.id,
          schoolLevelId: schoolLevel.id,
          classId: bulkReenrollClassId || undefined,
          enrollmentType: bulkReenrollType,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setBulkResult({
          action: 'Réinscription',
          success: data.reenrolled ?? 0,
          failed: data.failed ?? 0,
          total: data.total ?? selectedStudentIds.size,
          errors: data.errors,
        });
        setIsBulkReenrollModalOpen(false);
        setBulkReenrollClassId('');
        setBulkReenrollType('REPEAT');
        clearSelection();
        await loadStudents();
        await loadStatistics();
      } else {
        setBulkResult({
          action: 'Réinscription',
          success: 0,
          failed: selectedStudentIds.size,
          total: selectedStudentIds.size,
          errors: [{ id: 'global', error: data.message || 'Erreur serveur' }],
        });
      }
    } catch (e: any) {
      setBulkResult({
        action: 'Réinscription',
        success: 0,
        failed: selectedStudentIds.size,
        total: selectedStudentIds.size,
        errors: [{ id: 'global', error: e?.message || 'Erreur réseau' }],
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800';
      case 'GRADUATED':
        return 'bg-blue-100 text-blue-800';
      case 'TRANSFERRED':
        return 'bg-yellow-100 text-yellow-800';
      case 'ARCHIVED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ACTIVE: 'Actif',
      INACTIVE: 'Inactif',
      GRADUATED: 'Diplômé',
      TRANSFERRED: 'Transféré',
      ARCHIVED: 'Archivé',
    };
    return labels[status] || status;
  };

  const getCurrentClass = (student: Student) => {
    const activeEnrollment = student.studentEnrollments?.find(
      (e) => e.status === 'ACTIVE' || e.status === 'VALIDATED'
    );
    return formatGradeLabel(activeEnrollment?.class?.name) || 'Non affecté';
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (contextLoading) {
      return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Gestion des Élèves & Scolarité',
          description: 'Admission, inscription, dossiers élèves et organisation des classes',
          icon: 'users',
          kpis: [], // Statistiques supprimées — affichage direct du contenu
          actions: null,
        }}
        subModules={{
          activeModuleId: activeSubModuleId,
          onModuleChange: setActiveSubModuleId,
          modules: [
            { id: 'dashboard', label: 'Tableau de Bord', icon: <LayoutDashboard className="w-4 h-4" /> },
            { id: 'admissions', label: 'Admissions', icon: <UserPlus className="w-4 h-4" /> },
            { id: 'enrollments', label: 'Inscriptions', icon: <GraduationCap className="w-4 h-4" /> },
            { id: 'assignments', label: 'Affectations & Mouvements', icon: <Share2 className="w-4 h-4" /> },
            { id: 'class-lists', label: 'Liste des Élèves', icon: <Users className="w-4 h-4" /> },
            { id: 'list', label: 'Liste & Actions en masse', icon: <ListChecks className="w-4 h-4" /> },
            { id: 'movements', label: 'Sorties & Abandons', icon: <History className="w-4 h-4" /> },
            { id: 'cards', label: 'Cartes Scolaires', icon: <IdCard className="w-4 h-4" /> },
            { id: 'dossiers', label: 'Dossiers Élèves', icon: <FileText className="w-4 h-4" /> },
            { id: 'families', label: 'Familles', icon: <User className="w-4 h-4" /> },
            { id: 'transfers', label: 'Transferts & Mobilité', icon: <ArrowRightLeft className="w-4 h-4" /> },
            { id: 'history', label: 'Historique Scolaire', icon: <Archive className="w-4 h-4" /> },
            { id: 'educmaster', label: 'Educmaster', icon: <Globe className="w-4 h-4" /> },
            { id: 'analytics', label: 'ORION, Stats & Audit', icon: <Activity className="w-4 h-4" /> },
          ],
        }}
        content={
          activeSubModuleId === 'dashboard'
            ? {
                layout: 'default',
                children: (
                  <StudentsModuleDashboard
                    onNavigateToSubModule={setActiveSubModuleId}
                    onNewEnrollment={handleCreate}
                    onImport={() => setIsImportModalOpen(true)}
                  />
                ),
              }
            : activeSubModuleId === 'admissions'
            ? {
                layout: 'default',
                children: <AdmissionsContent />,
              }
            : activeSubModuleId === 'enrollments'
            ? {
                layout: 'default',
                children: <EnrollmentsContent />,
              }
            : activeSubModuleId === 'dossiers'
            ? {
                layout: 'default',
                children: <StudentIdentityContent />,
              }
            : activeSubModuleId === 'families'
            ? {
                layout: 'default',
                children: <StudentFamiliesContent />,
              }
            : activeSubModuleId === 'assignments'
            ? {
                layout: 'default',
                children: <StudentAffectationsMouvementsContent />,
              }
            : activeSubModuleId === 'class-lists'
            ? {
                layout: 'default',
                children: <StudentClassListsContent />,
              }
            : activeSubModuleId === 'movements'
            ? {
                layout: 'default',
                children: <StudentMovementsContent />,
              }
            : activeSubModuleId === 'history'
            ? {
                layout: 'default',
                children: <StudentHistoryContent />,
              }
            : activeSubModuleId === 'educmaster'
            ? {
                layout: 'default',
                children: <StudentInteropContent />,
              }
            : activeSubModuleId === 'analytics'
            ? {
                layout: 'default',
                // ⭐ Fusion ORION & Stats + Audit & Conformité en un seul onglet
                children: (
                  <div className="space-y-4">
                    <StudentAnalyticsContent />
                    <StudentAuditContent />
                  </div>
                ),
              }
            : activeSubModuleId === 'transfers'
            ? {
                layout: 'default',
                children: <StudentTransferContent />,
              }
            : activeSubModuleId === 'cards'
            ? {
                layout: 'default',
                children: <StudentIdCardsSection />,
              }

            : {
                layout: 'table',
                filters: (
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Rechercher un élève..."
                          value={filters.search}
                          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <select
                      value={filters.classId}
                      onChange={(e) => setFilters({ ...filters, classId: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Toutes les classes</option>
                      {classesList.map((c) => (
                        <option key={c.id} value={c.id}>{formatGradeLabel(c.name)}</option>
                      ))}
                    </select>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Tous les statuts</option>
                      <option value="ACTIVE">Actif</option>
                      <option value="INACTIVE">Inactif</option>
                      <option value="GRADUATED">Diplômé</option>
                      <option value="TRANSFERRED">Transféré</option>
                      <option value="ARCHIVED">Archivé</option>
                    </select>
                    <select
                      value={filters.regimeType}
                      onChange={(e) => setFilters({ ...filters, regimeType: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Tous les régimes</option>
                      <option value="NORMAL">Normal</option>
                      <option value="TEACHER_CHILD">Enfant enseignant</option>
                      <option value="SCHOLARSHIP">Bourse</option>
                      <option value="SPECIAL">Spécial</option>
                    </select>
                    <select
                      value={filters.hasArrears}
                      onChange={(e) => setFilters({ ...filters, hasArrears: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Tous les soldes</option>
                      <option value="true">Avec arriérés</option>
                      <option value="false">Sans arriérés</option>
                    </select>
                  </div>
                ),
                toolbar: (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        {students.length} élève{students.length > 1 ? 's' : ''} trouvé{students.length > 1 ? 's' : ''}
                        {selectedStudentIds.size > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                            {selectedStudentIds.size} sélectionné{selectedStudentIds.size > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedStudentIds.size > 0 && (
                          <>
                            <button
                              onClick={() => setIsBulkStatusModalOpen(true)}
                              disabled={isBulkProcessing}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 disabled:opacity-50"
                              title="Changer le statut des élèves sélectionnés"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                              Changer statut
                            </button>
                            <button
                              onClick={() => setIsBulkReenrollModalOpen(true)}
                              disabled={isBulkProcessing || !academicYear || !schoolLevel}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200 disabled:opacity-50"
                              title="Réinscrire les élèves sélectionnés pour l'année courante"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Réinscrire
                            </button>
                            <button
                              onClick={() => setIsBulkArchiveModalOpen(true)}
                              disabled={isBulkProcessing}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-md border border-red-200 disabled:opacity-50"
                              title="Archiver les élèves sélectionnés"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              Archiver
                            </button>
                            <button
                              onClick={clearSelection}
                              disabled={isBulkProcessing}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
                              title="Effacer la sélection"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {bulkResult && (
                      <div
                        className={`rounded-md border px-3 py-2 text-xs ${
                          bulkResult.failed > 0 && bulkResult.success === 0
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : bulkResult.failed > 0
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-semibold">{bulkResult.action} :</span>{' '}
                            {bulkResult.success} réussi{bulkResult.success > 1 ? 's' : ''} ·{' '}
                            {bulkResult.failed} échec{bulkResult.failed > 1 ? 's' : ''} ·{' '}
                            {bulkResult.total} au total.
                            {bulkResult.errors && bulkResult.errors.length > 0 && (
                              <ul className="mt-1 ml-4 list-disc space-y-0.5 text-[11px]">
                                {bulkResult.errors.slice(0, 5).map((e, i) => (
                                  <li key={i}>
                                    <span className="font-mono">{e.id.slice(0, 8)}…</span> : {e.error}
                                  </li>
                                ))}
                                {bulkResult.errors.length > 5 && (
                                  <li className="text-gray-500">
                                    + {bulkResult.errors.length - 5} autre(s) erreur(s)…
                                  </li>
                                )}
                              </ul>
                            )}
                          </div>
                          <button
                            onClick={() => setBulkResult(null)}
                            className="text-gray-500 hover:text-gray-800"
                            title="Fermer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ),
                isLoading,
                emptyMessage: students.length === 0 ? 'Aucun élève trouvé' : undefined,
                children: (
                  <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                          <input
                            type="checkbox"
                            checked={students.length > 0 && selectedStudentIds.size === students.length}
                            onChange={toggleSelectAll}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            title="Sélectionner / désélectionner tous les élèves visibles"
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Matricule
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nom & Prénom
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Classe
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Statut
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sync
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.map((student) => {
                        const isSelected = selectedStudentIds.has(student.id);
                        return (
                        <tr
                          key={student.id}
                          className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                        >
                          <td className="px-4 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleStudentSelection(student.id)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                            {student.matricule ?? student.studentCode ?? 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <User className="w-5 h-5 text-gray-600" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {student.lastName} {student.firstName}
                                </div>
                                {student.dateOfBirth && (
                                  <div className="text-sm text-gray-500">
                                    {new Date(student.dateOfBirth).toLocaleDateString('fr-FR')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {getCurrentClass(student)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                                student.status
                              )}`}
                            >
                              {getStatusLabel(student.status)}
                            </span>
                          </td>
                          <td className="px-2 py-3 text-center">
                            <EntitySyncIndicator variant="dot" status={syncStatuses[student.id] ?? 'UNKNOWN'} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-1">
                              <a
                                href={`/app/students/${student.id}/dossier`}
                                className="text-blue-600 hover:text-blue-900 p-1"
                                title="Dossier"
                              >
                                <FileText className="w-4 h-4" />
                              </a>
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await fetch(`/api/students/${student.id}/export-educmaster`, { method: 'POST' });
                                    const json = await res.json();
                                    const blob = new Blob([JSON.stringify(json.data || json, null, 2)], { type: 'application/json' });
                                    const a = document.createElement('a');
                                    a.href = URL.createObjectURL(blob);
                                    a.download = `educmaster-${student.matricule ?? student.studentCode ?? student.id}.json`;
                                    a.click();
                                    URL.revokeObjectURL(a.href);
                                  } catch (e) {
                                    window.alert('Export impossible');
                                  }
                                }}
                                className="text-green-600 hover:text-green-900 p-1"
                                title="Exporter EDUCMASTER"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleView(student)}
                                className="text-blue-600 hover:text-blue-900 p-1"
                                title="Voir"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(student)}
                                className="text-yellow-600 hover:text-yellow-900 p-1"
                                title="Modifier"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              {student.status !== 'ARCHIVED' && (
                                <button
                                  onClick={() => handleDelete(student)}
                                  className="text-red-600 hover:text-red-900 p-1"
                                  title="Archiver"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                ),
              }
        }
      />

      {/* ⭐ StudentSaraAssistant supprimé — le widget ORION global (OrionWidget) 
           est disponible dans toute l'application via app/layout.tsx */}

      {/* Modals */}
      <FormModal
        title={selectedStudent ? 'Modifier l\'élève' : 'Créer un nouvel élève'}
        subtitle={
          selectedStudent
            ? 'Modifiez les informations de l\'élève'
            : 'Remplissez les informations pour créer un nouvel élève'
        }
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setIsEditModalOpen(false);
          setSelectedStudent(null);
        }}
        size="lg"
        actions={
          <>
            <button
              onClick={() => {
                setIsCreateModalOpen(false);
                setIsEditModalOpen(false);
                setSelectedStudent(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => {
                const form = studentFormRef.current;
                if (form) {
                  const fd = new FormData(form);
                  const dateVal = fd.get('dateOfBirth') as string;
                  handleSubmit({
                    lastName: (fd.get('lastName') as string) || '',
                    firstName: (fd.get('firstName') as string) || '',
                    dateOfBirth: dateVal || undefined,
                    gender: (fd.get('gender') as string) || undefined,
                    nationality: (fd.get('nationality') as string) || undefined,
                    npi: (fd.get('npi') as string) || undefined,
                    primaryLanguage: (fd.get('primaryLanguage') as string) || undefined,
                  });
                } else {
                  handleSubmit({});
                }
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              {selectedStudent ? 'Modifier' : 'Créer'}
            </button>
          </>
        }
      >
        <form ref={studentFormRef} id="student-form-modal" onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom *
              </label>
              <input
                type="text"
                name="lastName"
                defaultValue={selectedStudent?.lastName || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prénom *
              </label>
              <input
                type="text"
                name="firstName"
                defaultValue={selectedStudent?.firstName || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de naissance
              </label>
              <input
                type="date"
                name="dateOfBirth"
                defaultValue={
                  selectedStudent?.dateOfBirth
                    ? new Date(selectedStudent.dateOfBirth).toISOString().split('T')[0]
                    : ''
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Genre
              </label>
              <select
                name="gender"
                defaultValue={selectedStudent?.gender || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Genre"
              >
                <option value="">Sélectionner</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nationalité
            </label>
            <input
              type="text"
              name="nationality"
              defaultValue={selectedStudent?.nationality || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              NPI (Numéro d’Identification Personnel)
            </label>
            <input
              type="text"
              name="npi"
              defaultValue={selectedStudent?.npi || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Langue principale
            </label>
            <select
              name="primaryLanguage"
              defaultValue={selectedStudent?.primaryLanguage || 'FR'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Langue principale"
            >
              <option value="FR">Français</option>
              <option value="EN">Anglais</option>
            </select>
          </div>
        </form>
      </FormModal>

      <ReadOnlyModal
        title={`Dossier de ${selectedStudent?.lastName} ${selectedStudent?.firstName}`}
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedStudent(null);
        }}
        size="xl"
        actions={
          <button
            onClick={() => {
              setIsViewModalOpen(false);
              setSelectedStudent(null);
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Fermer
          </button>
        }
      >
        {selectedStudent && (
          <div className="space-y-6">
            {/* Informations générales */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations générales</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-medium text-gray-700">Matricule</label>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      Identité institutionnelle
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 font-mono" title="Non modifiable">{selectedStudent.matricule ?? selectedStudent.studentCode ?? 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NPI (Numéro d’identification personnel)</label>
                  <p className="text-sm text-gray-900">{selectedStudent.npi || '—'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                      selectedStudent.status
                    )}`}
                  >
                    {getStatusLabel(selectedStudent.status)}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
                  <p className="text-sm text-gray-900">
                    {selectedStudent.dateOfBirth
                      ? new Date(selectedStudent.dateOfBirth).toLocaleDateString('fr-FR')
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nationalité</label>
                  <p className="text-sm text-gray-900">{selectedStudent.nationality || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Scolarité */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Scolarité</h3>
              <div className="space-y-2">
                {selectedStudent.studentEnrollments?.map((enrollment) => (
                  <div key={enrollment.id} className="bg-gray-50 rounded-md p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatGradeLabel(enrollment.class?.name) || 'Non affecté'}
                        </p>
                        <p className="text-xs text-gray-600">
                          Type: {enrollment.enrollmentType} | Statut: {enrollment.status}
                        </p>
                      </div>
              </div>
              </div>
                ))}
              </div>
              </div>

            {/* Responsables légaux */}
            {selectedStudent.studentGuardians && selectedStudent.studentGuardians.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Responsables légaux</h3>
                <div className="space-y-2">
                  {selectedStudent.studentGuardians.map((sg) => (
                    <div key={sg.id} className="bg-gray-50 rounded-md p-3">
                      <div className="flex items-center justify-between">
              <div>
                          <p className="text-sm font-medium text-gray-900">
                            {sg.guardian.firstName} {sg.guardian.lastName}
                            {sg.isPrimary && (
                              <span className="ml-2 text-xs text-blue-600">(Principal)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-600">
                            Relation: {sg.relationship}
                            {sg.guardian.phone && ` | ${sg.guardian.phone}`}
                            {sg.guardian.email && ` | ${sg.guardian.email}`}
                          </p>
              </div>
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        )}
      </div>
        )}
      </ReadOnlyModal>

      <ConfirmModal
        title="Archiver l'élève"
        message={`Êtes-vous sûr de vouloir archiver "${selectedStudent?.lastName} ${selectedStudent?.firstName}" ? Cette action est irréversible.`}
        type="danger"
        isOpen={isDeleteModalOpen}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setSelectedStudent(null);
        }}
        confirmLabel="Archiver"
        cancelLabel="Annuler"
      />

      {/* Modal Import de masse */}
      <FormModal
        title="Import de masse d'élèves"
        subtitle="Collez un CSV simple (Nom,Prénom,DateNaissance JJ/MM/AAAA optionnelle). L'année et le niveau actuels seront utilisés."
        isOpen={isImportModalOpen}
        onClose={() => {
          if (isImporting) return;
          setIsImportModalOpen(false);
          setImportText('');
          setImportResult(null);
        }}
        size="lg"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (isImporting) return;
                setIsImportModalOpen(false);
                setImportText('');
                setImportResult(null);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={isImporting || !importText.trim() || !academicYear || !schoolLevel}
              onClick={async () => {
                if (!academicYear || !schoolLevel) return;
                setIsImporting(true);
                setImportResult(null);
                let success = 0;
                let failed = 0;
                try {
                  const lines = importText
                    .split('\n')
                    .map((l) => l.trim())
                    .filter((l) => l.length > 0);
                  if (lines.length <= 1) {
                    setImportResult({ success: 0, failed: 0 });
                    setIsImporting(false);
                    return;
                  }
                  const rows = lines.slice(1); // skip header
                  for (const raw of rows) {
                    const parts = raw.split(/[;,]/).map((p) => p.trim());
                    const [lastName, firstName, dateRaw] = parts;
                    if (!lastName || !firstName) {
                      failed++;
                      continue;
                    }
                    let dateOfBirth: string | undefined;
                    if (dateRaw) {
                      const m = dateRaw.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
                      if (m) {
                        const [_, d, mth, y] = m;
                        dateOfBirth = `${y}-${mth}-${d}`;
                      }
                    }
                    try {
                      const res = await fetch('/api/students', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          firstName,
                          lastName,
                          dateOfBirth,
                          academicYearId: academicYear.id,
                          schoolLevelId: schoolLevel.id,
                        }),
                      });
                      if (res.ok) {
                        success++;
                      } else {
                        failed++;
                      }
                    } catch {
                      failed++;
                    }
                  }
                  setImportResult({ success, failed });
                  await loadStudents();
                  await loadStatistics();
                } finally {
                  setIsImporting(false);
                }
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isImporting && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>Importer</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Format attendu (séparateur point-virgule ou virgule) avec en-tête :
            <span className="font-mono ml-1">Nom,Prénom,DateNaissance</span>.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
            placeholder={'Nom,Prénom,DateNaissance\nDUPONT,Jean,12/09/2012\nDOE,Jane,01/01/2013'}
          />
          {importResult && (
            <p className="text-sm text-gray-700">
              Import terminé : <span className="font-semibold">{importResult.success}</span> ligne(s) réussie(s),
              <span className="font-semibold ml-1">{importResult.failed}</span> en échec.
            </p>
          )}
        </div>
      </FormModal>

      {/* =====================================================================
          ⭐ ACTIONS MULTIPLES — 3 modales (Changer statut / Archiver / Réinscrire)
          ===================================================================== */}

      {/* Modale : Changement de statut en masse */}
      <FormModal
        title={`Changer le statut — ${selectedStudentIds.size} élève(s)`}
        subtitle="Sélectionnez le nouveau statut à appliquer. Un audit log sera écrit pour chaque élève."
        isOpen={isBulkStatusModalOpen}
        onClose={() => {
          if (isBulkProcessing) return;
          setIsBulkStatusModalOpen(false);
          setBulkStatusReason('');
        }}
        size="md"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBulkProcessing}
              onClick={() => {
                setIsBulkStatusModalOpen(false);
                setBulkStatusReason('');
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={isBulkProcessing || selectedStudentIds.size === 0}
              onClick={handleBulkStatusSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isBulkProcessing && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Appliquer à {selectedStudentIds.size} élève(s)
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nouveau statut *
            </label>
            <select
              value={bulkStatusValue}
              onChange={(e) => setBulkStatusValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Inactif</option>
              <option value="GRADUATED">Diplômé</option>
              <option value="TRANSFERRED">Transféré</option>
              <option value="WITHDRAWN">Retiré</option>
              <option value="SUSPENDED">Suspendu</option>
              <option value="ARCHIVED">Archivé</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Raison (optionnel)
            </label>
            <textarea
              value={bulkStatusReason}
              onChange={(e) => setBulkStatusReason(e.target.value)}
              rows={3}
              placeholder="Ex: Passage en masse suite à validation du conseil de classe"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
            ℹ️ Un audit log sera écrit pour chaque élève avec l'ancien et le nouveau statut.
            {bulkStatusValue === 'SUSPENDED' || bulkStatusValue === 'TRANSFERRED'
              ? ' Les tokens de vérification publique seront désactivés.'
              : ''}
          </div>
        </div>
      </FormModal>

      {/* Modale : Archivage en masse */}
      <FormModal
        title={`Archiver — ${selectedStudentIds.size} élève(s)`}
        subtitle="Action irréversible. Les élèves archivés ne seront plus actifs mais conservés en base pour l'historique."
        isOpen={isBulkArchiveModalOpen}
        onClose={() => {
          if (isBulkProcessing) return;
          setIsBulkArchiveModalOpen(false);
          setBulkArchiveReason('');
        }}
        size="md"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBulkProcessing}
              onClick={() => {
                setIsBulkArchiveModalOpen(false);
                setBulkArchiveReason('');
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={isBulkProcessing || selectedStudentIds.size === 0}
              onClick={handleBulkArchiveSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isBulkProcessing && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Archiver {selectedStudentIds.size} élève(s)
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
            ⚠️ Cette action va archiver <strong>{selectedStudentIds.size}</strong> élève(s).
            Ils passeront en statut <strong>ARCHIVED</strong> et ne seront plus comptabilisés
            dans les effectifs actifs. Un audit log sera écrit pour chaque élève.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Raison de l'archivage (recommandé)
            </label>
            <textarea
              value={bulkArchiveReason}
              onChange={(e) => setBulkArchiveReason(e.target.value)}
              rows={3}
              placeholder="Ex: Fin de cycle, départ de l'établissement, etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </FormModal>

      {/* Modale : Réinscription en masse */}
      <FormModal
        title={`Réinscrire — ${selectedStudentIds.size} élève(s)`}
        subtitle={`Année académique : ${academicYear?.name || 'N/A'} · Niveau : ${schoolLevel?.label || schoolLevel?.code || 'N/A'}`}
        isOpen={isBulkReenrollModalOpen}
        onClose={() => {
          if (isBulkProcessing) return;
          setIsBulkReenrollModalOpen(false);
          setBulkReenrollClassId('');
          setBulkReenrollType('REPEAT');
        }}
        size="md"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBulkProcessing}
              onClick={() => {
                setIsBulkReenrollModalOpen(false);
                setBulkReenrollClassId('');
                setBulkReenrollType('REPEAT');
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={isBulkProcessing || selectedStudentIds.size === 0 || !academicYear || !schoolLevel}
              onClick={handleBulkReenrollSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isBulkProcessing && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Réinscrire {selectedStudentIds.size} élève(s)
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
            ✅ Chaque élève sera réinscrit pour l'année <strong>{academicYear?.name || 'courante'}</strong>.
            Un nouveau <code>StudentEnrollment</code> sera créé et l'ancien sera marqué
            comme <strong>TRANSFERRED</strong>.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type d'inscription *
            </label>
            <select
              value={bulkReenrollType}
              onChange={(e) => setBulkReenrollType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="REPEAT">Refaire la même classe (REPEAT)</option>
              <option value="PROMOTION">Passer dans la classe supérieure (PROMOTION)</option>
              <option value="NEW">Nouvelle inscription (NEW — frais complets)</option>
              <option value="TRANSFER">Transfert (TRANSFER)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              REPEAT/PROMOTION → frais de <strong>réinscription</strong>. NEW → frais d'<strong>inscription</strong> complets.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Affecter à une classe (optionnel)
            </label>
            <select
              value={bulkReenrollClassId}
              onChange={(e) => setBulkReenrollClassId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Pas d'affectation (à faire plus tard)</option>
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>{formatGradeLabel(c.name)}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Si sélectionnée, tous les élèves seront affectés à cette classe.
            </p>
          </div>
        </div>
      </FormModal>
    </>
  );
}
