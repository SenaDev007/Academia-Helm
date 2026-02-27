/**
 * ============================================================================
 * SOUS-MODULE DOCUMENTS & CARTE SCOLAIRE (Module 1)
 * ============================================================================
 * Carte scolaire, QR vérification publique, certificats, export PDF.
 */

'use client';

import Link from 'next/link';
import { FileText } from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import StudentIdCardsSection from '@/components/students/StudentIdCardsSection';

export default function StudentsIdCardsPage() {
  return (
    <ModuleContainer
      header={{
        title: 'Documents & carte scolaire',
        description: 'Carte scolaire, QR de vérification, certificats, export PDF. Documents administratifs par élève ci-dessous.',
        icon: 'users',
        kpis: [],
        actions: (
          <Link
            href="/app/students/documents"
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
          >
            <FileText className="w-4 h-4" />
            <span>Documents administratifs</span>
          </Link>
        ),
      }}
      content={{
        layout: 'default',
        children: <StudentIdCardsSection />,
      }}
    />
  );
}

