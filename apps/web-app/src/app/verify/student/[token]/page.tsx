/**
 * ============================================================================
 * PUBLIC VERIFICATION PAGE - VÉRIFICATION QR CODE
 * ============================================================================
 * 
 * Page publique pour vérifier l'identité d'un élève via un token QR Code
 * Aucune authentification requise - Données minimales uniquement
 * 
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, XCircle, User, Calendar, Building, School, AlertCircle } from 'lucide-react';

interface StudentData {
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  dateOfBirth?: string;
  gender?: string;
  photo?: string;
  matricule: string;
  class?: string;
  level?: string;
  academicYear: string;
  status: string;
  institution: string;
  school?: string;
}

export default function PublicVerificationPage() {
  const params = useParams();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [expired, setExpired] = useState(false);
  const [student, setStudent] = useState<StudentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Token manquant');
      return;
    }

    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      setLoading(true);
      const { getApiBaseUrl } = await import('@/lib/utils/urls');
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/public/verify/${token}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setValid(false);
        setExpired(data.isExpired ?? false);
        setError(data.message ?? 'Carte invalide ou désactivée');
        return;
      }

      if (!data.valid || !data.student) {
        setValid(false);
        setExpired(data.isExpired ?? false);
        setError(data.message ?? 'Carte invalide ou désactivée');
        return;
      }

      setValid(true);
      setStudent(data.student);
    } catch (err) {
      console.error('Error verifying token:', err);
      setError('Carte invalide ou désactivée');
      setValid(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Vérification en cours...</p>
        </div>
      </div>
    );
  }

  if (!valid || !student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Vérification échouée
          </h1>
          <p className="text-gray-600 mb-4">
            {expired
              ? 'Ce token de vérification a expiré.'
              : error || 'Carte invalide ou désactivée.'}
          </p>
          <p className="text-sm text-gray-500">
            Veuillez contacter l'établissement pour obtenir un nouveau QR Code.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="bg-blue-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-8 h-8 text-white" />
                <div>
                  <h1 className="text-xl font-bold text-white">
                    Identité Vérifiée
                  </h1>
                  <p className="text-blue-100 text-sm">
                    Carte d'identité scolaire officielle
                  </p>
                </div>
              </div>
              <div className="bg-green-500 px-3 py-1 rounded-full">
                <span className="text-white text-sm font-semibold">VALIDÉ</span>
              </div>
            </div>
          </div>

          {/* Student Information */}
          <div className="p-6">
            <div className="flex items-start space-x-6">
              {/* Photo placeholder */}
              <div className="flex-shrink-0">
                {student.photo ? (
                  <img
                    src={student.photo}
                    alt={`${student.firstName} ${student.lastName}`}
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-4 border-gray-200">
                    <User className="w-12 h-12 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Student Details */}
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {student.fullName ?? `${student.firstName} ${student.lastName}`.trim()}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Matricule: <span className="font-semibold">{student.matricule}</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {student.dateOfBirth && (
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Date de naissance</p>
                        <p className="font-medium text-gray-900">
                          {new Date(student.dateOfBirth).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  )}

                  {student.gender && (
                    <div className="flex items-center space-x-2">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Genre</p>
                        <p className="font-medium text-gray-900">
                          {student.gender === 'M' ? 'Masculin' : student.gender === 'F' ? 'Féminin' : student.gender}
                        </p>
                      </div>
                    </div>
                  )}

                  {student.class && (
                    <div className="flex items-center space-x-2">
                      <School className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Classe</p>
                        <p className="font-medium text-gray-900">{student.class}</p>
                      </div>
                    </div>
                  )}

                  {student.level && (
                    <div className="flex items-center space-x-2">
                      <School className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Niveau</p>
                        <p className="font-medium text-gray-900">{student.level}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Année scolaire</p>
                      <p className="font-medium text-gray-900">{student.academicYear}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Building className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Établissement</p>
                      <p className="font-medium text-gray-900">{student.institution}</p>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        student.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {student.status === 'ACTIVE' ? '✅ Actif' : '❌ Inactif'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Notice */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Informations protégées</p>
              <p>
                Cette page affiche uniquement les informations d'identité minimales.
                Aucune donnée sensible (notes, finances, historique disciplinaire) n'est accessible.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

