/**
 * ============================================================================
 * DASHBOARD ENSEIGNANT
 * ============================================================================
 * 
 * Wireframe :
 * - Classes assignées
 * - Saisie des notes
 * - Cahier journal
 * - Emploi du temps
 * - ORION (pédagogique uniquement)
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { BookOpen, FileText, Calendar, TrendingUp, Users } from 'lucide-react';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import Link from 'next/link';

interface AssignedClass {
  id: string;
  name: string;
  subject: string;
  studentCount: number;
  pendingGrades: number;
}

export default function TeacherDashboard() {
  const { currentYear } = useAcademicYear();
  const { currentLevel } = useSchoolLevel();
  const [classes, setClasses] = useState<AssignedClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadAssignedClasses = async () => {
      if (!currentYear || !currentLevel) return;

      setIsLoading(true);
      try {
        // TODO: Charger les classes assignées à l'enseignant
        // const response = await fetch(`/api/teachers/assigned-classes?academicYearId=${currentYear.id}&schoolLevelId=${currentLevel.id}`);
        // if (response.ok) {
        //   const data = await response.json();
        //   setClasses(data);
        // }
        setClasses([]); // Temporaire
      } catch (error) {
        console.error('Failed to load assigned classes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAssignedClasses();
  }, [currentYear, currentLevel]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900 mb-2">
          Tableau de bord enseignant
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
          href="/app/exams"
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900">Saisie des notes</h3>
              <p className="text-sm text-gray-600">Enregistrer les notes</p>
            </div>
          </div>
        </Link>

        <Link
          href="/app/planning/journal"
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900">Cahier journal</h3>
              <p className="text-sm text-gray-600">Consulter le journal</p>
            </div>
          </div>
        </Link>

        <Link
          href="/app/planning/schedule"
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900">Emploi du temps</h3>
              <p className="text-sm text-gray-600">Voir mon planning</p>
            </div>
          </div>
        </Link>

        <Link
          href="/app/orion/pedagogical"
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 bg-yellow-50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-navy-900">Analyse ORION</h3>
              <p className="text-sm text-gray-600">Insights pédagogiques</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Classes assignées */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-navy-900">Mes classes</h3>
        </div>
        {isLoading ? (
          <div className="p-6 text-center text-gray-400">Chargement...</div>
        ) : classes.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Aucune classe assignée</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {classes.map((classItem) => (
              <div key={classItem.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-navy-900 mb-1">
                      {classItem.name}
                    </h4>
                    <p className="text-sm text-gray-600">{classItem.subject}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 mb-1">
                      {classItem.studentCount} élèves
                    </p>
                    {classItem.pendingGrades > 0 && (
                      <p className="text-sm text-orange-600 font-medium">
                        {classItem.pendingGrades} notes en attente
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

