/**
 * ============================================================================
 * MODULE 1 : GESTION DES ÉLÈVES & SCOLARITÉ
 * ============================================================================
 * 
 * Module complet de gestion des élèves utilisant le Module Blueprint
 * 
 * Fonctionnalités :
 * - Admission & inscription
 * - Dossier élève complet
 * - Responsables légaux
 * - Organisation des classes
 * - Affectations par année scolaire
 * - Assiduité
 * - Discipline
 * - Transferts
 * - Documents administratifs
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, User, BookOpen, AlertCircle, FileText, Edit, Trash2, Eye, Users } from 'lucide-react';
import {
  ModuleContainer,
  FormModal,
  ConfirmModal,
  ReadOnlyModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { formatGradeLabel } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface Student {
  id: string;
  studentCode?: string;
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
  
  // Filtres
  const [filters, setFilters] = useState({
    classId: '',
    status: '',
    search: '',
  });

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    if (academicYear && schoolLevel) {
      loadStudents();
      loadStatistics();
    }
  }, [academicYear, schoolLevel, filters]);

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
            <button
              onClick={handleCreate}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvel élève</span>
            </button>
          ),
        }}
        subModules={{
          modules: [
            { id: 'list', label: 'Liste des élèves', href: '/app/students' },
            { id: 'enrollments', label: 'Inscriptions', href: '/app/students/enrollments' },
            { id: 'classes', label: 'Classes', href: '/app/students/classes' },
            { id: 'matricules', label: 'Matricules', href: '/app/students/matricules' },
            { id: 'id-cards', label: 'Cartes Scolaires', href: '/app/students/id-cards' },
            { id: 'attendance', label: 'Assiduité', href: '/app/students/attendance' },
            { id: 'discipline', label: 'Discipline', href: '/app/students/discipline' },
            { id: 'documents', label: 'Documents', href: '/app/students/documents' },
          ],
        }}
        content={{
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
                    Code
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
                      {student.studentCode || 'N/A'}
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
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleView(student)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Voir"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(student)}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {student.status !== 'ARCHIVED' && (
                          <button
                            onClick={() => handleDelete(student)}
                            className="text-red-600 hover:text-red-900"
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
              onClick={() => {
                // TODO: Récupérer les données du formulaire
                handleSubmit({});
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              {selectedStudent ? 'Modifier' : 'Créer'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom *
              </label>
              <input
                type="text"
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
              defaultValue={selectedStudent?.nationality || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
              </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Langue principale
            </label>
            <select
              defaultValue={selectedStudent?.primaryLanguage || 'FR'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Langue principale"
            >
              <option value="FR">Français</option>
              <option value="EN">Anglais</option>
            </select>
          </div>
        </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code élève</label>
                  <p className="text-sm text-gray-900">{selectedStudent.studentCode || 'N/A'}</p>
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
    </>
  );
}
