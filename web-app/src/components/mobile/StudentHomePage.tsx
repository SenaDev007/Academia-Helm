/**
 * ============================================================================
 * MOBILE - STUDENT HOME PAGE
 * ============================================================================
 * 
 * Page d'accueil mobile pour les élèves
 * - Emploi du temps
 * - Devoirs
 * - Résultats
 * - Notifications
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Calendar, BookOpen, FileText, Bell, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface StudentInfo {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  pendingHomework: number;
  newResults: number;
  unreadNotifications: number;
}

export default function StudentHomePage() {
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStudentInfo = async () => {
      setIsLoading(true);
      try {
        // TODO: Charger les infos de l'élève
        // const response = await fetch('/api/students/me');
        // if (response.ok) {
        //   const data = await response.json();
        //   setStudent(data);
        // }
        setStudent(null); // Temporaire
      } catch (error) {
        console.error('Failed to load student info:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStudentInfo();
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-navy-900 mb-1">Mon espace</h2>
        {student && (
          <p className="text-sm text-gray-600">
            {student.firstName} {student.lastName} • {student.className}
          </p>
        )}
      </div>

      {/* Actions rapides */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/mobile/student/schedule"
          className="bg-white rounded-lg border border-gray-200 p-6 text-center hover:shadow-md transition-shadow"
        >
          <Calendar className="w-10 h-10 text-navy-900 mx-auto mb-3" />
          <p className="text-base font-semibold text-navy-900">Emploi du temps</p>
        </Link>
        <Link
          href="/mobile/student/homework"
          className="bg-white rounded-lg border border-gray-200 p-6 text-center hover:shadow-md transition-shadow"
        >
          <BookOpen className="w-10 h-10 text-navy-900 mx-auto mb-3" />
          <p className="text-base font-semibold text-navy-900">Devoirs</p>
          {student && student.pendingHomework > 0 && (
            <span className="inline-block mt-2 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
              {student.pendingHomework} en attente
            </span>
          )}
        </Link>
        <Link
          href="/mobile/student/results"
          className="bg-white rounded-lg border border-gray-200 p-6 text-center hover:shadow-md transition-shadow"
        >
          <FileText className="w-10 h-10 text-navy-900 mx-auto mb-3" />
          <p className="text-base font-semibold text-navy-900">Résultats</p>
          {student && student.newResults > 0 && (
            <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
              {student.newResults} nouveau{student.newResults > 1 ? 'x' : ''}
            </span>
          )}
        </Link>
        <Link
          href="/mobile/student/notifications"
          className="bg-white rounded-lg border border-gray-200 p-6 text-center hover:shadow-md transition-shadow"
        >
          <Bell className="w-10 h-10 text-navy-900 mx-auto mb-3" />
          <p className="text-base font-semibold text-navy-900">Notifications</p>
          {student && student.unreadNotifications > 0 && (
            <span className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
              {student.unreadNotifications} non lu{student.unreadNotifications > 1 ? 's' : ''}
            </span>
          )}
        </Link>
      </div>

      {/* Aujourd'hui */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-base font-semibold text-navy-900 mb-3">Aujourd'hui</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Mathématiques</p>
              <p className="text-xs text-gray-600">08:00 - 09:30</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Français</p>
              <p className="text-xs text-gray-600">10:00 - 11:30</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

