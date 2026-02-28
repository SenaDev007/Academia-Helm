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
import StudentIdCardsSection from '@/components/students/StudentIdCardsSection';
import StudentsModuleDashboard from '@/components/students/StudentsModuleDashboard';

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
  const { academicYear, schoolLevel, isLoading: contextLoading } = useModuleContext();
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
  /** Onglet actif (Dashboard par défaut à l'ouverture du module) */
  const [activeSubModuleId, setActiveSubModuleId] = useState<string>('dashboard');
  const studentFormRef = useRef<HTMLFormElement>(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (academicYear && schoolLevel) {
      loadStudents();
      loadStatistics();
    }
  }, [academicYear, schoolLevel, filters]);

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
          setStudents(data);
        }
      } catch (error) {
        console.error('Failed to load students:', error);
      } finally {
        setIsLoading(false);
      }
    };

  const loadStatistics = async () => {
    if (!academicYear || !schoolLevel) return;

    try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel.id,
      });

      const response = await fetch(`/api/students/statistics?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStatistics(data);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
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
          setIsEditModalOpen(false);
          loadStudents();
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
          setIsCreateModalOpen(false);
          loadStudents();
          loadStatistics();
        }
      }
    } catch (error) {
      console.error('Failed to save student:', error);
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
          kpis: statistics
            ? [
                {
                  label: 'Total',
                  value: statistics.total || 0,
                  icon: 'users',
                  trend: 'neutral',
                },
                {
                  label: 'Actifs',
                  value: statistics.active || 0,
                  icon: 'checkCircle',
                  trend: 'up',
                },
                {
                  label: 'Archivés',
                  value: statistics.archived || 0,
                  icon: 'archive',
                  trend: 'neutral',
                },
              ]
            : [],
          actions: (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreate}
                disabled={schoolLevel?.id === 'ALL'}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span>Créer un nouvel élève</span>
              </button>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Import</span>
              </button>
              <button
                onClick={() => window.alert('Export EDUCMASTER : utilisez l\'action "Exporter" sur une ligne élève')}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export EDUCMASTER</span>
              </button>
            </div>
          ),
        }}
        subModules={{
          activeModuleId: activeSubModuleId,
          onModuleChange: setActiveSubModuleId,
          modules: [
            { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
            { id: 'a-admission', label: 'Admission & cycle de vie', icon: <UserPlus className="w-4 h-4" /> },
            { id: 'e-documents-carte', label: 'Documents & carte scolaire', icon: <CreditCard className="w-4 h-4" /> },
            { id: 'b-identite', label: 'Identité & relations', icon: <User className="w-4 h-4" /> },
            { id: 'c-historique', label: 'Historique & multi-année', icon: <History className="w-4 h-4" /> },
            { id: 'd-regimes-finance', label: 'Régimes & situation fin.', icon: <DollarSign className="w-4 h-4" /> },
            { id: 'f-interop', label: 'Interopérabilité nationale', icon: <Share2 className="w-4 h-4" /> },
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
            : activeSubModuleId === 'a-admission'
            ? {
                layout: 'default',
                children: <EnrollmentsContent />,
              }
            : activeSubModuleId === 'e-documents-carte'
              ? {
                  layout: 'default',
                  children: (
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                        <a
                          href="/app/students/documents"
                          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 text-sm font-medium"
                        >
                          <FileText className="w-4 h-4" />
                          Documents administratifs
                        </a>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                        <StudentIdCardsSection />
                      </div>
                    </div>
                  ),
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
                aria-label="Filtrer par classe"
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
                aria-label="Filtrer par statut"
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
                aria-label="Filtrer par régime"
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
                aria-label="Filtrer par arriérés"
              >
                <option value="">Tous</option>
                <option value="true">Avec arriérés</option>
                <option value="false">Sans arriérés</option>
              </select>
            </div>
          ),
          toolbar: (
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {students.length} élève{students.length > 1 ? 's' : ''} trouvé{students.length > 1 ? 's' : ''}
          </div>
              </div>
          ),
          isLoading,
          emptyMessage: students.length === 0 ? 'Aucun élève trouvé' : undefined,
          children: (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                    <tr>
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
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`/app/students/${student.id}/dossier`}
                          className="text-indigo-600 hover:text-indigo-900 p-1"
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
                    ))}
                  </tbody>
                </table>
          ),
        }}
      />

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
    </>
  );
}
