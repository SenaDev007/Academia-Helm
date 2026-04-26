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
import { useModuleContext } from '@/hooks/useModuleContext';
import {
  FileText,
  BookOpen,
  Calendar,
  User,
  RefreshCw,
  Download,
  DollarSign,
  CreditCard,
  History,
  ArrowRightLeft,
  Users,
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
    placeOfBirth?: string;
    npi?: string;
    regimeType?: string;
    studentCode?: string;
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
  guardians?: Array<{
    id: string;
    relationship: string;
    isPrimary: boolean;
    guardian: { id: string; firstName: string; lastName: string; phone?: string; email?: string };
  }>;
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
  auditTrail?: Array<{
    id: string;
    action: string;
    createdAt: string;
    userId?: string | null;
    beforeData?: any;
    afterData?: any;
  }>;
}

type VerificationQR = { publicUrl: string; qrImage: string; isActive: boolean };

export default function StudentDossierSection({ studentId }: { studentId: string }) {
  const { schoolLevel, academicYear } = useModuleContext();
  const [dossier, setDossier] = useState<DossierData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<
    'identity' | 'academic' | 'documents' | 'finance' | 'history' | 'card' | 'parents' | 'status'
  >('identity');
  const [academicYearId] = useState<string>('');
  const [historyData, setHistoryData] = useState<any>(null);
  const [auditData] = useState<DossierData['auditTrail'] | null>(null);
  const [changeClassModal, setChangeClassModal] = useState(false);
  const [changeClassPayload, setChangeClassPayload] = useState({ academicYearId: '', newClassId: '' });
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([]);
  const [changeClassSubmitting, setChangeClassSubmitting] = useState(false);
  const [verificationQR, setVerificationQR] = useState<VerificationQR | null>(null);
  const [verificationQRLoading, setVerificationQRLoading] = useState(false);
  const [regenerateQRLoading, setRegenerateQRLoading] = useState(false);

  useEffect(() => {
    loadDossier();
  }, [studentId, academicYearId]);

  const effectiveAcademicYearId = academicYear?.id || academicYearId;
  useEffect(() => {
    if (selectedTab !== 'card' || !studentId || !effectiveAcademicYearId) {
      setVerificationQR(null);
      return;
    }
    let cancelled = false;
    setVerificationQRLoading(true);
    fetch(`/api/students/${studentId}/verification-qr?academicYearId=${encodeURIComponent(effectiveAcademicYearId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setVerificationQR({ publicUrl: data.publicUrl, qrImage: data.qrImage, isActive: data.isActive });
        else if (!cancelled) setVerificationQR(null);
      })
      .catch(() => { if (!cancelled) setVerificationQR(null); })
      .finally(() => { if (!cancelled) setVerificationQRLoading(false); });
    return () => { cancelled = true; };
  }, [selectedTab, studentId, effectiveAcademicYearId]);

  useEffect(() => {
    if (selectedTab === 'history' && studentId) {
      fetch(`/api/students/${studentId}/history`)
        .then((r) => r.ok ? r.json() : null)
        .then(setHistoryData)
        .catch(() => setHistoryData(null));
    }
  }, [selectedTab, studentId]);

  // Classes chargées depuis la BDD (Paramètres), filtrées par niveau scolaire
  useEffect(() => {
    if (!changeClassModal || !changeClassPayload.academicYearId) {
      if (changeClassModal) setClassesList([]);
      return;
    }
    const params = new URLSearchParams({ academicYearId: changeClassPayload.academicYearId });
    if (schoolLevel?.id && schoolLevel.id !== 'ALL') params.set('schoolLevelId', schoolLevel.id);
    fetch(`/api/classes?${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: any) => {
        const list = Array.isArray(data) ? data : data?.data ?? data?.classes ?? [];
        setClassesList(list.map((c: any) => ({ id: c.id, name: c.name || c.code || c.id })));
      })
      .catch(() => setClassesList([]));
  }, [changeClassModal, changeClassPayload.academicYearId, schoolLevel?.id]);

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
              { id: 'academic', label: 'Scolarité', icon: BookOpen },
              { id: 'parents', label: 'Parents', icon: Users },
              { id: 'finance', label: 'Finance', icon: DollarSign },
              { id: 'documents', label: 'Documents', icon: FileText },
              { id: 'history', label: 'Historique', icon: History },
              { id: 'status', label: 'Statut & Parcours', icon: Calendar },
              { id: 'card', label: 'Carte scolaire', icon: CreditCard },
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
                    <div className="flex items-center gap-2 mb-1">
                      <label className="block text-sm font-medium text-gray-700">Matricule</label>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        Identité institutionnelle
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 font-mono" title="Non modifiable">{dossier.identity.matricule || 'N/A'}</p>
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
                  {dossier.identity.placeOfBirth && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lieu de naissance</label>
                      <p className="text-sm text-gray-900">{dossier.identity.placeOfBirth}</p>
                    </div>
                  )}
                  {dossier.identity.npi && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">NPI (Numéro d&apos;identification personnel)</label>
                      <p className="text-sm text-gray-900">{dossier.identity.npi}</p>
                    </div>
                  )}
                  {dossier.identity.regimeType && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Régime</label>
                      <p className="text-sm text-gray-900">
                        {dossier.identity.regimeType === 'TEACHER_CHILD'
                          ? 'Enfant enseignant'
                          : dossier.identity.regimeType === 'SCHOLARSHIP'
                          ? 'Bourse'
                          : dossier.identity.regimeType === 'SPECIAL'
                          ? 'Spécial'
                          : 'Normal'}
                      </p>
                    </div>
                  )}
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
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Parcours académique</h3>
                <button
                  onClick={() => setChangeClassModal(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Changement de classe
                </button>
              </div>
              <div>
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

          {selectedTab === 'parents' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Parents / tuteurs</h3>
              {!dossier.guardians?.length ? (
                <p className="text-gray-600">Aucun parent ou tuteur enregistré</p>
              ) : (
                <div className="space-y-4">
                  {dossier.guardians.map((sg) => (
                    <div key={sg.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">
                          {sg.guardian.firstName} {sg.guardian.lastName}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700">
                          {sg.relationship}
                          {sg.isPrimary ? ' — Principal' : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        {sg.guardian.phone && <span>Tél. {sg.guardian.phone}</span>}
                        {sg.guardian.email && <span>{sg.guardian.email}</span>}
                      </div>
                    </div>
                  ))}
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

          {selectedTab === 'finance' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Situation financière</h3>
              <p className="text-sm text-gray-600">
                Cette section est dédiée à la synthèse financière (soldes, arriérés, échéancier) issue du module Finance.
              </p>
              <p className="text-sm text-gray-600">
                Le détail du régime tarifaire de l&apos;élève est présenté dans la section{' '}
                <span className="font-medium">Régime tarifaire</span> de l&apos;onglet{' '}
                <span className="font-medium">Identité</span>.
              </p>
            </div>
          )}

          {selectedTab === 'history' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Historique & journal des actions</h3>
              {!historyData ? (
                <p className="text-gray-500">Chargement...</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-700 mb-2">Inscriptions & transferts</h4>
                    <div>
                      <h5 className="font-medium text-gray-700 mb-2">Inscriptions</h5>
                      {historyData.enrollments?.length === 0 ? (
                        <p className="text-gray-600 text-sm">Aucune inscription</p>
                      ) : (
                        <ul className="space-y-2">
                          {historyData.enrollments?.map((e: any) => (
                            <li key={e.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded p-2">
                              <History className="w-4 h-4 text-gray-400" />
                              <span>{e.academicYearName}</span>
                              <span className="text-gray-600">— {e.className || 'Non affecté'}</span>
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-200">{e.status}</span>
                              {e.previousArrears > 0 && (
                                <span className="text-amber-700">Arriérés: {e.previousArrears}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {historyData.transfers?.length > 0 && (
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">Transferts</h5>
                        <ul className="space-y-2">
                          {historyData.transfers.map((t: any) => (
                            <li key={t.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded p-2">
                              <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                              {t.fromClassName} → {t.toClassName} — {t.status}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-700 mb-2">Journal d&apos;audit (Module 1)</h4>
                    {auditData && auditData.length > 0 ? (
                      <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-80 overflow-y-auto">
                        {auditData.map((entry) => (
                          <div key={entry.id} className="p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900">{entry.action}</span>
                              <span className="text-xs text-gray-500">
                                {new Date(entry.createdAt).toLocaleString('fr-FR')}
                              </span>
                            </div>
                            {entry.userId && (
                              <p className="text-xs text-gray-500 mt-1">
                                Utilisateur: <span className="font-mono">{entry.userId}</span>
                              </p>
                            )}
                            {entry.afterData && (
                              <p className="text-xs text-gray-500 mt-1 truncate">
                                Détails: <span className="font-mono">{JSON.stringify(entry.afterData)}</span>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Aucune entrée d&apos;audit disponible.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedTab === 'status' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Statut & Parcours</h3>
                  <p className="text-sm text-gray-600">
                    Promotion annuelle, réinscription ou redoublement de l&apos;élève. Les opérations sont
                    enregistrées dans le journal d&apos;audit et soumises aux règles de clôture d&apos;année.
                  </p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/students/${dossier.identity.id}/academic-dossier${academicYearId ? `?academicYearId=${academicYearId}` : ''}`);
                      if (!res.ok) {
                        window.alert('Impossible de générer le dossier académique (PDF).');
                        return;
                      }
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `dossier-academique-${dossier.identity.matricule || dossier.identity.id}.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (e) {
                      window.alert('Erreur lors du téléchargement du dossier académique.');
                    }
                  }}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger le dossier académique
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Statut actuel</h4>
                  <p className="text-sm text-gray-700">
                    Statut : <span className="font-semibold">{dossier.identity.status}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Le changement de statut et les promotions sont soumis aux politiques de l&apos;établissement.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Actions annuelles</h4>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => window.alert('Promotion annuelle : à déclencher depuis la page dédiée Promotions.')}
                      className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                    >
                      Promotion
                    </button>
                    <button
                      onClick={() => window.alert('Réinscription : utiliser le sous-module Inscriptions (réinscription).')}
                      className="inline-flex items-center px-3 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700"
                    >
                      Réinscription
                    </button>
                    <button
                      onClick={() => window.alert('Redoublement : workflow backend prêt, UI spécialisée à finaliser.')}
                      className="inline-flex items-center px-3 py-2 bg-yellow-500 text-white rounded-md text-sm hover:bg-yellow-600"
                    >
                      Redoublement
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Ces actions s&apos;appuient sur les endpoints du cycle de vie élève (promotion, réinscription,
                    redoublement) et alimentent ORION pour le calcul des KPI annuels.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'card' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Carte scolaire</h3>

              {/* QR public — vérification carte (spec: afficher QR, badge statut, régénérer) */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">QR vérification publique</h4>
                <p className="text-xs text-gray-600 mb-3">
                  Ce QR permet de vérifier l&apos;authenticité de la carte (verify.academiahelm.com). Aucune donnée sensible dans le QR.
                </p>
                {verificationQRLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Chargement du QR…
                  </div>
                ) : verificationQR ? (
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="flex flex-col items-center gap-2">
                      {verificationQR.qrImage ? (
                        <img src={verificationQR.qrImage} alt="QR vérification" className="w-[180px] h-[180px] rounded border border-gray-200" />
                      ) : (
                        <div className="w-[180px] h-[180px] rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                          QR non disponible
                        </div>
                      )}
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          verificationQR.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {verificationQR.isActive ? 'Carte active' : 'Carte désactivée'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <p className="text-xs text-gray-600">
                        Vérification : <a href={verificationQR.publicUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">verify.academiahelm.com</a>
                      </p>
                      <button
                        type="button"
                        disabled={regenerateQRLoading}
                        onClick={async () => {
                          if (!effectiveAcademicYearId) return;
                          setRegenerateQRLoading(true);
                          try {
                            const res = await fetch(`/api/students/${studentId}/verification-token/regenerate`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ academicYearId: effectiveAcademicYearId }),
                            });
                            if (res.ok) {
                              const qrRes = await fetch(`/api/students/${studentId}/verification-qr?academicYearId=${encodeURIComponent(effectiveAcademicYearId)}`);
                              const d = qrRes.ok ? await qrRes.json() : null;
                              if (d) setVerificationQR({ publicUrl: d.publicUrl, qrImage: d.qrImage, isActive: d.isActive });
                            } else {
                              const err = await res.json().catch(() => ({}));
                              window.alert(err.message || 'Régénération impossible (limite anti-abus : 1 fois / 5 min ou rôle insuffisant).');
                            }
                          } finally {
                            setRegenerateQRLoading(false);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-amber-800 bg-amber-100 border border-amber-200 rounded hover:bg-amber-200 disabled:opacity-50"
                      >
                        <RefreshCw className={regenerateQRLoading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} />
                        {regenerateQRLoading ? 'En cours…' : 'Régénérer QR'}
                      </button>
                      <p className="text-xs text-gray-500">Rôle directeur uniquement. Limite : 1 fois / 5 min.</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Sélectionnez une année scolaire ou générez un token à l&apos;admission.</p>
                )}
              </div>

              {dossier.currentIdCard ? (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium">N° carte : {dossier.currentIdCard.cardNumber}</p>
                  <p className="text-xs text-gray-500">
                    Générée le {new Date(dossier.currentIdCard.generatedAt).toLocaleDateString('fr-FR')}
                  </p>
                  <a
                    href="/app/students/id-cards"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
                  >
                    <CreditCard className="w-4 h-4" />
                    Voir / Télécharger PDF
                  </a>
                </div>
              ) : (
                <p className="text-gray-600">Aucune carte générée. Générer depuis la page Cartes Scolaires.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Changement de classe */}
      {changeClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setChangeClassModal(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Changement de classe</h3>
            {dossier?.academicRecords?.length > 0 ? (
              <>
                <div className="space-y-2 mb-4">
                  <label className="block text-sm font-medium text-gray-700">Année scolaire</label>
                  <select
                    value={changeClassPayload.academicYearId}
                    onChange={(e) => setChangeClassPayload({ ...changeClassPayload, academicYearId: e.target.value, newClassId: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Choisir</option>
                    {dossier.academicRecords.map((r: any) => (
                      <option key={r.id} value={r.academicYearId}>{r.academicYear?.name ?? r.academicYearId}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 mb-4">
                  <label className="block text-sm font-medium text-gray-700">Nouvelle classe</label>
                  <select
                    value={changeClassPayload.newClassId}
                    onChange={(e) => setChangeClassPayload({ ...changeClassPayload, newClassId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Choisir</option>
                    {classesList.map((c) => (
                      <option key={c.id} value={c.id}>{formatGradeLabel(c.name)}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-600 mb-4">Aucune année scolaire dans le dossier.</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setChangeClassModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                disabled={!changeClassPayload.academicYearId || !changeClassPayload.newClassId || changeClassSubmitting}
                onClick={async () => {
                  if (!changeClassPayload.academicYearId || !changeClassPayload.newClassId) return;
                  setChangeClassSubmitting(true);
                  try {
                    const res = await fetch('/api/students/change-class', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        studentId,
                        academicYearId: changeClassPayload.academicYearId,
                        newClassId: changeClassPayload.newClassId,
                      }),
                    });
                    if (res.ok) {
                      setChangeClassModal(false);
                      loadDossier();
                      if (selectedTab === 'history') {
                        fetch(`/api/students/${studentId}/history`).then((r) => r.ok ? r.json() : null).then(setHistoryData);
                      }
                    } else {
                      const err = await res.json().catch(() => ({}));
                      window.alert(err.message || 'Changement de classe impossible (notes existantes ?)');
                    }
                  } finally {
                    setChangeClassSubmitting(false);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {changeClassSubmitting ? 'En cours...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

