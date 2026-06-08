/**
 * ============================================================================
 * MODULE PLANIFICATION & ÉTUDES
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Plus, Calendar, Clock, Building } from 'lucide-react';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import ModulePageLayout from './ModulePageLayout';

export default function PlanningModulePage() {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();

  return (
    <ModulePageLayout
      title="Planification & Études"
      subtitle={`${currentLevel?.code === 'MATERNELLE' ? 'Maternelle' :
                 currentLevel?.code === 'PRIMAIRE' ? 'Primaire' :
                 currentLevel?.code === 'SECONDAIRE' ? 'Secondaire' : currentLevel?.code} | ${currentYear?.name || ''}`}
      actions={
        <>
          <button className="flex items-center space-x-2 px-4 py-2 bg-navy-900 text-white rounded-md hover:bg-navy-800 transition-colors">
            <Plus className="w-4 h-4" />
            <span>Créer un emploi du temps</span>
          </button>
          <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            <Calendar className="w-4 h-4" />
            <span>Vue calendrier</span>
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Vue d'ensemble */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Classes</p>
              <Building className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-navy-900">—</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Matières</p>
              <Clock className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-navy-900">—</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Salles</p>
              <Building className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-navy-900">—</p>
          </div>
        </div>

        {/* Emploi du temps */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-navy-900 mb-4">Emploi du temps</h3>
          <div className="text-center text-gray-400 py-12">
            Emploi du temps (à implémenter)
          </div>
        </div>
      </div>
    </ModulePageLayout>
  );
}

