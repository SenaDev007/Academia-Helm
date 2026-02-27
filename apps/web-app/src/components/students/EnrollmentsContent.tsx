/**
 * Contenu du sous-module Admission & cycle de vie (sans ModuleContainer).
 * Utilisé dans StudentsModulePage pour affichage par onglet (même page que Paramètres).
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, CheckCircle, XCircle, Clock, Users } from 'lucide-react';
import { FormModal } from '@/components/modules/blueprint';
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
  class?: { id: string; name: string };
  enrollmentType: string;
  enrollmentDate: string;
  status: string;
}

export default function EnrollmentsContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (academicYear && schoolLevel) loadEnrollments();
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
    } catch (e) {
      console.error('Failed to load enrollments:', e);
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
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/students/classes"
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 text-sm font-medium"
            >
              <Users className="w-4 h-4" />
              Voir les classes
            </Link>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Nouvelle inscription
            </button>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600 mt-3">Chargement...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Élève</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classe</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {enrollments.map((enrollment) => (
                    <tr key={enrollment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {enrollment.student.lastName} {enrollment.student.firstName}
                        </div>
                        <div className="text-sm text-gray-500">{enrollment.student.studentCode}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatGradeLabel(enrollment.class?.name) || 'Non affecté'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{enrollment.enrollmentType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(enrollment.enrollmentDate).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                            enrollment.status
                          )}`}
                        >
                          {getStatusIcon(enrollment.status)}
                          {enrollment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!isLoading && enrollments.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-600">Aucune inscription</div>
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
                  const err = await studentResponse.json().catch(() => ({}));
                  throw new Error(err.message || "Erreur lors de la création de l'élève");
                }
                const student = await studentResponse.json();
                await fetch('/api/finance/student-fee-profiles', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    studentId: student.id,
                    academicYearId: academicYear.id,
                    feeRegimeId: data.feeProfile.feeRegimeId,
                    justification: data.feeProfile.justification,
                  }),
                }).catch(() => undefined);
                if (data.guardians?.length) {
                  for (const g of data.guardians) {
                    if (!g.firstName?.trim() && !g.lastName?.trim()) continue;
                    await fetch(`/api/students/${student.id}/guardians`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        firstName: g.firstName,
                        lastName: g.lastName,
                        relationship: g.relationship || 'GUARDIAN',
                        phone: g.phone,
                        email: g.email,
                        isPrimary: g.isPrimary ?? false,
                      }),
                    }).catch(() => undefined);
                  }
                }
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
                setIsCreateModalOpen(false);
                loadEnrollments();
              } catch (e: any) {
                throw e;
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
