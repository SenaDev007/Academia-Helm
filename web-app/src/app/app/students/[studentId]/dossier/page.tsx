/**
 * ============================================================================
 * STUDENT DOSSIER PAGE - MODULE 1
 * ============================================================================
 */

'use client';

import { useParams } from 'next/navigation';
import { ModuleContainer } from '@/components/modules/blueprint';
import StudentDossierSection from '@/components/students/StudentDossierSection';

export default function StudentDossierPage() {
  const params = useParams();
  const studentId = params.studentId as string;

  if (!studentId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">ID élève manquant</p>
      </div>
    );
  }

  return (
    <ModuleContainer
      header={{
        title: 'Dossier Scolaire Numérique',
        description: 'Dossier complet de l\'élève : parcours, résultats, discipline, documents',
        icon: 'users',
        kpis: [],
      }}
      content={{
        layout: 'default',
        children: <StudentDossierSection studentId={studentId} />,
      }}
    />
  );
}

