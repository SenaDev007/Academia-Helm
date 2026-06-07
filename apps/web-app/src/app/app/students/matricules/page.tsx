/**
 * ============================================================================
 * STUDENTS MATRICULES PAGE - MODULE 1
 * ============================================================================
 */

'use client';

import { ModuleContainer } from '@/components/modules/blueprint';
import StudentMatriculesSection from '@/components/students/StudentMatriculesSection';

export default function StudentsMatriculesPage() {
  return (
    <ModuleContainer
      header={{
        title: 'Matricules Élèves',
        description: 'Gestion des matricules globaux uniques (format AH-BJ-XXXX-YYYY-NNNNN)',
        icon: 'users',
        kpis: [],
      }}
      content={{
        layout: 'default',
        children: <StudentMatriculesSection />,
      }}
    />
  );
}

