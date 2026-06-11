/**
 * ============================================================================
 * DASHBOARD ADMINISTRATION
 * ============================================================================
 * 
 * Wireframe :
 * - Élèves & Scolarité
 * - Discipline
 * - Communication
 * - Documents
 * ============================================================================
 */

'use client';

import { Users, AlertCircle, MessageSquare, FileText } from 'lucide-react';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import Link from 'next/link';

export default function AdminDashboard() {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900 mb-2">
          Tableau de bord administration
        </h1>
        <p className="text-gray-600">
          {currentYear?.name} • {currentLevel?.code === 'MATERNELLE' ? 'Maternelle' :
                                 currentLevel?.code === 'PRIMAIRE' ? 'Primaire' :
                                 currentLevel?.code === 'SECONDAIRE' ? 'Secondaire' : currentLevel?.code}
        </p>
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link
          href="/app/students"
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900">Élèves & Scolarité</h3>
              <p className="text-sm text-gray-600">Gérer les élèves</p>
            </div>
          </div>
        </Link>

        <Link
          href="/app/discipline"
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-red-50 rounded-lg">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900">Discipline</h3>
              <p className="text-sm text-gray-600">Gérer la discipline</p>
            </div>
          </div>
        </Link>

        <Link
          href="/app/communication"
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900">Communication</h3>
              <p className="text-sm text-gray-600">Envoyer des messages</p>
            </div>
          </div>
        </Link>

        <Link
          href="/app/documents"
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900">Documents</h3>
              <p className="text-sm text-gray-600">Gérer les documents</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

