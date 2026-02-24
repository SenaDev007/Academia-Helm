/**
 * ============================================================================
 * STUDENT DOSSIER SECTION - DOSSIER SCOLAIRE NUMÉRIQUE
 * ============================================================================
 * 
 * Composant pour consulter et gérer le dossier scolaire complet de l'élève
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  BookOpen,
  AlertTriangle,
  Award,
  Calendar,
  User,
  RefreshCw,
  Download,
} from 'lucide-react';
import { formatGradeLabel } from '@/lib/utils';

interface DossierData {
  identity: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: Date;
    gender?: string;
    nationality?: string;
    matricule: string;
    status: string;
    institution: string;
  };
  academicRecords: any[];
  disciplinarySummaries: any[];
  documents: any[];
  reportCards: any[];
  recentAbsences: any[];
  recentDisciplinaryActions: any[];
  currentIdCard: any;
  feeProfile?: {
    id: string;
    feeRegime: {
      id: string;
      code: string;
      label: string;
      description?: string;
      rules: Array<{
        feeType: string;
        discountType: string;
        discountValue: number;
      }>;
    };
    justification?: string;
    validatedAt?: Date;
    validator?: {
      firstName: string;
      lastName: string;
    };
  };
}

export default function StudentDossierSection({ studentId }: { studentId: string }) {
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'identity' | 'academic' | 'discipline' | 'documents'>('identity');
  const [academicYearId, setAcademicYearId] = useState<string>('');

  useEffect(() => {
    loadDossier();
  }, [studentId, academicYearId]);

  const loadDossier = async () => {
    try {
      setLoading(true);
      const url = `/api/students/${studentId}/dossier${academicYearId ? `?academicYearId=${academicYearId}` : ''}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        setDossier(data);
      } else {
        console.error('Failed to load dossier');
      }
    } catch (error) {
      console.error('Error loading dossier:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !dossier) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Aucun dossier trouvé</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {[
              { id: 'identity', label: 'Identité', icon: User },
              { id: 'academic', label: 'Parcours académique', icon: BookOpen },
              { id: 'discipline', label: 'Discipline & Assiduité', icon: AlertTriangle },
              { id: 'documents', label: 'Documents', icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-medium text-sm ${
                    selectedTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {selectedTab === 'identity' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Identité officielle</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                    <p className="text-sm text-gray-900">
                      {dossier.identity.firstName} {dossier.identity.lastName}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Matricule</label>
                    <p className="text-sm text-gray-900 font-mono">{dossier.identity.matricule || 'N/A'}</p>
                  </div>
                  {dossier.identity.dateOfBirth && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
                      <p className="text-sm text-gray-900">
                        {new Date(dossier.identity.dateOfBirth).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  )}
                  {dossier.identity.gender && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
                      <p className="text-sm text-gray-900">{dossier.identity.gender}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Établissement</label>
                    <p className="text-sm text-gray-900">{dossier.identity.institution}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        dossier.identity.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {dossier.identity.status}
                    </span>
                  </div>
                </div>
              </div>

              {dossier.currentIdCard && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Carte scolaire</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      Carte active: <span className="font-medium">{dossier.currentIdCard.cardNumber}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Générée le {new Date(dossier.currentIdCard.generatedAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              )}

              {/* Profil tarifaire */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Régime tarifaire</h3>
                {dossier.feeProfile ? (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            dossier.feeProfile.feeRegime.code === 'STANDARD'
                              ? 'bg-blue-100 text-blue-800'
                              : dossier.feeProfile.feeRegime.code === 'ENFANT_ENSEIGNANT'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {dossier.feeProfile.feeRegime.code === 'STANDARD'
                            ? 'Standard'
                            : dossier.feeProfile.feeRegime.code === 'ENFANT_ENSEIGNANT'
                            ? 'Enfant d\'enseignant'
                            : 'Réduction exceptionnelle'}
                        </span>
                      </div>
                      {dossier.feeProfile.validatedAt && (
                        <span className="text-xs text-gray-500">
                          Validé le {new Date(dossier.feeProfile.validatedAt).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {dossier.feeProfile.feeRegime.label}
                      </p>
                      {dossier.feeProfile.feeRegime.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {dossier.feeProfile.feeRegime.description}
                        </p>
                      )}
                    </div>
                    {dossier.feeProfile.feeRegime.rules.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-2">Règles de réduction :</p>
                        <div className="space-y-1">
                          {dossier.feeProfile.feeRegime.rules.map((rule, idx) => (
                            <div key={idx} className="text-xs text-gray-600">
                              • {rule.feeType}:{' '}
                              {rule.discountType === 'FIXED'
                                ? `${rule.discountValue.toLocaleString('fr-FR')} FCFA`
                                : `${rule.discountValue}%`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {dossier.feeProfile.justification && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-1">Justification :</p>
                        <p className="text-sm text-gray-600">{dossier.feeProfile.justification}</p>
                      </div>
                    )}
                    {dossier.feeProfile.validator && (
                      <div className="mt-2 text-xs text-gray-500">
                        Validé par: {dossier.feeProfile.validator.firstName}{' '}
                        {dossier.feeProfile.validator.lastName}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      Aucun profil tarifaire défini pour cette année scolaire
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedTab === 'academic' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Parcours académique</h3>
                {dossier.academicRecords.length === 0 ? (
                  <p className="text-gray-600">Aucun enregistrement académique</p>
                ) : (
                  <div className="space-y-4">
                    {dossier.academicRecords.map((record) => (
                      <div key={record.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{record.academicYear.name}</h4>
                          <span className="text-sm text-gray-600">{formatGradeLabel(record.class?.name) || 'Non affecté'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          {record.averageScore && (
                            <div>
                              <span className="text-gray-600">Moyenne: </span>
                              <span className="font-medium">{record.averageScore}</span>
                            </div>
                          )}
                          {record.rank && (
                            <div>
                              <span className="text-gray-600">Rang: </span>
                              <span className="font-medium">{record.rank}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-600">Statut: </span>
                            <span className="font-medium">{record.enrollmentStatus}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {dossier.reportCards.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Bulletins</h3>
                  <div className="space-y-2">
                    {dossier.reportCards.slice(0, 5).map((card) => (
                      <div key={card.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div>
                          <p className="font-medium text-gray-900">{card.academicYear.name}</p>
                          <p className="text-sm text-gray-600">
                            {card.quarters?.length || 0} trimestre(s)
                          </p>
                        </div>
                        <button className="text-blue-600 hover:text-blue-700">
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedTab === 'discipline' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Résumés disciplinaires</h3>
                {dossier.disciplinarySummaries.length === 0 ? (
                  <p className="text-gray-600">Aucun résumé disciplinaire</p>
                ) : (
                  <div className="space-y-4">
                    {dossier.disciplinarySummaries.map((summary) => (
                      <div key={summary.id} className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-900 mb-3">
                          {summary.academicYear.name}
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Absences: </span>
                            <span className="font-medium">{summary.absencesCount}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Incidents: </span>
                            <span className="font-medium">{summary.incidentsCount}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Sanctions: </span>
                            <span className="font-medium">{summary.sanctionsCount}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Avertissements: </span>
                            <span className="font-medium">{summary.warningsCount}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {dossier.recentAbsences.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Absences récentes</h3>
                  <div className="space-y-2">
                    {dossier.recentAbsences.slice(0, 10).map((absence) => (
                      <div key={absence.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div>
                          <p className="font-medium text-gray-900">
                            {new Date(absence.date).toLocaleDateString('fr-FR')}
                          </p>
                          <p className="text-sm text-gray-600">
                            {absence.isJustified ? 'Justifiée' : 'Non justifiée'}
                          </p>
                        </div>
                        {absence.reason && (
                          <p className="text-sm text-gray-600">{absence.reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedTab === 'documents' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>
              {dossier.documents.length === 0 ? (
                <p className="text-gray-600">Aucun document</p>
              ) : (
                <div className="space-y-2">
                  {dossier.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                      <div>
                        <p className="font-medium text-gray-900">{doc.fileName}</p>
                        <p className="text-sm text-gray-600">
                          {doc.documentType} - {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <button className="text-blue-600 hover:text-blue-700">
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

