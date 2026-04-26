/**
 * ============================================================================
 * SOUS-MODULE ADMISSION & CYCLE DE VIE (Module 1)
 * ============================================================================
 * Pré-inscription, admission, réinscription, affectation/classe, transfert.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, CheckCircle, XCircle, Clock, Users } from 'lucide-react';
import {
  ModuleContainer,
  FormModal,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { formatGradeLabel } from '@/lib/utils';
import StudentEnrollmentForm from '@/components/students/StudentEnrollmentForm';

interface Enrollment {
  id: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    studentCode?: string;
  };
  class?: {
    id: string;
    name: string;
  };
  enrollmentType: string;
  enrollmentDate: string;
  status: string;
}

export default function EnrollmentsPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (academicYear && schoolLevel) {
      loadEnrollments();
    }
  }, [academicYear, schoolLevel]);

  const loadEnrollments = async () => {
    if (!academicYear || !schoolLevel) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        academicYearId: academicYear.id,
        schoolLevelId: schoolLevel.id,
      });

      const response = await fetch(`/api/students/enrollments?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEnrollments(data);
      }
    } catch (error) {
      console.error('Failed to load enrollments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VALIDATED':
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VALIDATED':
      case 'ACTIVE':
        return <CheckCircle className="w-4 h-4" />;
      case 'PENDING':
        return <Clock className="w-4 h-4" />;
      case 'REJECTED':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <>
      <ModuleContainer
        header={{
          title: 'Admission & cycle de vie',
          description: 'Pré-inscription, admission, réinscription, affectation classe, changement de classe, transfert',
          icon: 'bookOpen',
          actions: (
            <div className="flex items-center gap-2">
              <Link
                href="/app/students/classes"
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
              >
                <Users className="w-4 h-4" />
                <span>Voir les classes</span>
              </Link>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Nouvelle inscription</span>
              </button>
            </div>
          ),
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
                    placeholder="Rechercher..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          ),
          isLoading,
          children: (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Élève
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Classe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {enrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {enrollment.student.lastName} {enrollment.student.firstName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {enrollment.student.studentCode}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatGradeLabel(enrollment.class?.name) || 'Non affecté'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {enrollment.enrollmentType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(enrollment.enrollmentDate).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full flex items-center space-x-1 w-fit ${getStatusColor(
                          enrollment.status
                        )}`}
                      >
                        {getStatusIcon(enrollment.status)}
                        <span>{enrollment.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        }}
      />

      <FormModal
        title="Nouvelle inscription"
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        size="xl"
        actions={null} // Les actions sont gérées par le formulaire
      >
        {academicYear && schoolLevel ? (
          <StudentEnrollmentForm
            academicYearId={academicYear.id}
            schoolLevelId={schoolLevel.id}
            onSubmit={async (data) => {
              try {
                // 1. Créer l'élève
                const studentResponse = await fetch('/api/students', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ...data.student,
                    academicYearId: academicYear.id,
                    schoolLevelId: schoolLevel.id,
                  }),
                });

                if (!studentResponse.ok) {
                  const error = await studentResponse.json().catch(() => ({}));
                  throw new Error(error.message || 'Erreur lors de la création de l\'élève');
                }

                const student = await studentResponse.json();

                // 2. Créer le profil tarifaire
                const profileResponse = await fetch('/api/finance/student-fee-profiles', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    studentId: student.id,
                    academicYearId: academicYear.id,
                    feeRegimeId: data.feeProfile.feeRegimeId,
                    justification: data.feeProfile.justification,
                  }),
                });

                if (!profileResponse.ok) {
                  const error = await profileResponse.json().catch(() => ({}));
                  throw new Error(error.message || 'Erreur lors de la création du profil tarifaire');
                }

                // 3. Créer les parents / tuteurs le cas échéant
                if (data.guardians && data.guardians.length > 0) {
                  for (const g of data.guardians) {
                    if (!g.firstName.trim() && !g.lastName.trim()) continue;
                    await fetch(`/api/students/${student.id}/guardians`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        firstName: g.firstName,
                        lastName: g.lastName,
                        relationship: g.relationship || 'GUARDIAN',
                        phone: g.phone || undefined,
                        email: g.email || undefined,
                        isPrimary: g.isPrimary ?? false,
                      }),
                    }).catch(() => undefined);
                  }
                }

                // 4. Créer l'inscription dans une classe si fournie
                if (data.classId) {
                  await fetch(`/api/students/${student.id}/enroll`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      academicYearId: academicYear.id,
                      schoolLevelId: schoolLevel.id,
                      classId: data.classId,
                      enrollmentType: 'NEW',
                      enrollmentDate: new Date().toISOString(),
                    }),
                  }).catch(() => undefined);
                }

                // 5. Recharger les inscriptions
                setIsCreateModalOpen(false);
                loadEnrollments();
              } catch (error: any) {
                throw error;
              }
            }}
            onCancel={() => setIsCreateModalOpen(false)}
          />
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-600">
              Veuillez sélectionner une année scolaire et un niveau
            </p>
          </div>
        )}
      </FormModal>
    </>
  );
}

