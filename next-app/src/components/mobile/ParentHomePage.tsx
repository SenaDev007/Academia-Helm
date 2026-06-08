/**
 * ============================================================================
 * MOBILE - PARENT HOME PAGE
 * ============================================================================
 * 
 * Page d'accueil mobile pour les parents
 * - Paiements scolarité
 * - Absences & retards
 * - Bulletins PDF
 * - Messages école
 * - Notifications push
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { DollarSign, AlertCircle, FileText, MessageSquare, Bell, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface StudentInfo {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  unpaidAmount: number;
  recentAbsences: number;
  newBulletins: number;
  unreadMessages: number;
}

export default function ParentHomePage() {
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStudents = async () => {
      setIsLoading(true);
      try {
        // TODO: Charger les enfants du parent
        // const response = await fetch('/api/parents/students');
        // if (response.ok) {
        //   const data = await response.json();
        //   setStudents(data);
        // }
        setStudents([]); // Temporaire
      } catch (error) {
        console.error('Failed to load students:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStudents();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-navy-900 mb-1">Mes enfants</h2>
        <p className="text-sm text-gray-600">Suivez la scolarité de vos enfants</p>
      </div>

      {/* Liste des enfants */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-8">Chargement...</div>
      ) : students.length === 0 ? (
        <div className="text-center text-gray-400 py-8">
          <p>Aucun enfant enregistré</p>
        </div>
      ) : (
        <div className="space-y-4">
          {students.map((student) => (
            <div key={student.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-navy-900">
                    {student.firstName} {student.lastName}
                  </h3>
                  <p className="text-sm text-gray-600">{student.className}</p>
                </div>
              </div>

              {/* Actions rapides */}
              <div className="space-y-2">
                {student.unpaidAmount > 0 && (
                  <Link
                    href={`/mobile/parent/payments?studentId=${student.id}`}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
                  >
                    <div className="flex items-center space-x-3">
                      <DollarSign className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="text-sm font-medium text-red-900">Paiement en attente</p>
                        <p className="text-xs text-red-700">
                          {formatCurrency(student.unpaidAmount)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-red-600" />
                  </Link>
                )}

                {student.recentAbsences > 0 && (
                  <Link
                    href={`/mobile/parent/absences?studentId=${student.id}`}
                    className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                  >
                    <div className="flex items-center space-x-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                      <div>
                        <p className="text-sm font-medium text-yellow-900">
                          {student.recentAbsences} absence{student.recentAbsences > 1 ? 's' : ''} récente{student.recentAbsences > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-yellow-600" />
                  </Link>
                )}

                {student.newBulletins > 0 && (
                  <Link
                    href={`/mobile/parent/results?studentId=${student.id}`}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          {student.newBulletins} nouveau{student.newBulletins > 1 ? 'x' : ''} bulletin{student.newBulletins > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-blue-600" />
                  </Link>
                )}

                {student.unreadMessages > 0 && (
                  <Link
                    href="/mobile/parent/messages"
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                  >
                    <div className="flex items-center space-x-3">
                      <MessageSquare className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-900">
                          {student.unreadMessages} message{student.unreadMessages > 1 ? 's' : ''} non lu{student.unreadMessages > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-green-600" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions générales */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/mobile/parent/payments"
          className="bg-white rounded-lg border border-gray-200 p-4 text-center"
        >
          <DollarSign className="w-8 h-8 text-navy-900 mx-auto mb-2" />
          <p className="text-sm font-medium text-navy-900">Paiements</p>
        </Link>
        <Link
          href="/mobile/parent/results"
          className="bg-white rounded-lg border border-gray-200 p-4 text-center"
        >
          <FileText className="w-8 h-8 text-navy-900 mx-auto mb-2" />
          <p className="text-sm font-medium text-navy-900">Résultats</p>
        </Link>
        <Link
          href="/mobile/parent/messages"
          className="bg-white rounded-lg border border-gray-200 p-4 text-center"
        >
          <MessageSquare className="w-8 h-8 text-navy-900 mx-auto mb-2" />
          <p className="text-sm font-medium text-navy-900">Messages</p>
        </Link>
        <Link
          href="/mobile/parent/notifications"
          className="bg-white rounded-lg border border-gray-200 p-4 text-center"
        >
          <Bell className="w-8 h-8 text-navy-900 mx-auto mb-2" />
          <p className="text-sm font-medium text-navy-900">Notifications</p>
        </Link>
      </div>
    </div>
  );
}

