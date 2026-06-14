/**
 * FederisExamsPage Component
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { federisLink } from '@/lib/federis/useFederisPath';

interface Exam {
  id: string;
  name: string;
  code: string;
  academicYear: string;
  status: string;
  candidatesCount: number;
  startDate: string;
}

export default function FederisExamsPage({ tenantId }: { tenantId: string }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Charger depuis l'API
    setExams([
      { id: '1', name: 'CEP 2024', code: 'CEP', academicYear: '2024-2025', status: 'IN_PROGRESS', candidatesCount: 450, startDate: '2024-06-15' },
      { id: '2', name: 'BEPC 2024', code: 'BEPC', academicYear: '2024-2025', status: 'REGISTRATION_OPEN', candidatesCount: 320, startDate: '2024-07-10' },
    ]);
    setLoading(false);
  }, [tenantId]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      REGISTRATION_OPEN: 'bg-blue-100 text-blue-800',
      REGISTRATION_CLOSED: 'bg-yellow-100 text-yellow-800',
      IN_PROGRESS: 'bg-green-100 text-green-800',
      COMPLETED: 'bg-purple-100 text-purple-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return (
      <span className={cn('px-2 py-1 rounded text-xs font-medium', styles[status] || styles.DRAFT)}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Examens</h1>
          <p className="text-gray-600 mt-1">Gérez vos examens nationaux</p>
        </div>
        <Link
          href={federisLink('/exams/create')}
          className="px-4 py-2 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 transition-colors inline-flex items-center gap-2"
        >
          <AppIcon name="add" size="submenu" className="text-white" />
          Créer un examen
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Année</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Candidats</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : exams.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Aucun examen</td></tr>
              ) : (
                exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{exam.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exam.academicYear}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(exam.status)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{exam.candidatesCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link href={`/federis/exams/${exam.id}`} className="text-blue-600 hover:text-blue-900">Voir</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

