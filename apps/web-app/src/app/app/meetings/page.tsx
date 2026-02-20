/**
 * ============================================================================
 * MODULE TRANSVERSAL — RÉUNIONS ADMINISTRATIVES, PÉDAGOGIQUES & PARENTS
 * ============================================================================
 * Gestion complète des réunions institutionnelles
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Calendar, Users, FileText, CheckSquare, AlertTriangle, Clock, MapPin, FileDown, Edit3, Eye } from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function MeetingsPage() {
  const { academicYear } = useModuleContext();
  const [activeTab, setActiveTab] = useState<string>('upcoming');
  const [loading, setLoading] = useState(true);
  const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
  const [historyMeetings, setHistoryMeetings] = useState<any[]>([]);
  const [orionKPIs, setOrionKPIs] = useState<any>(null);
  const [orionAlerts, setOrionAlerts] = useState<any[]>([]);
  const [decisionStats, setDecisionStats] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [selectedMinutes, setSelectedMinutes] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [academicYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      // TODO: Charger les données depuis l'API
      // const upcoming = await fetch('/api/meetings/upcoming?...');
      // const history = await fetch('/api/meetings/history?...');
      // const kpis = await fetch('/api/meetings/orion/kpis?...');
      // const alerts = await fetch('/api/meetings/orion/alerts?...');
      // const stats = await fetch('/api/meetings/decisions/stats?...');
      // const templatesData = await fetch('/api/meetings/templates?...');
      // setTemplates(templatesData.json());
      setLoading(false);
    } catch (error) {
      console.error('Error loading meetings data:', error);
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'upcoming', label: 'À venir', icon: Clock },
    { id: 'history', label: 'Historique', icon: Calendar },
    { id: 'minutes', label: 'Comptes rendus', icon: FileText },
    { id: 'decisions', label: 'Décisions & Suivi', icon: CheckSquare },
  ];

  const getMeetingTypeColor = (type: string) => {
    switch (type) {
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'PEDAGOGIC':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'PARENTS':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNED':
        return 'bg-blue-100 text-blue-800';
      case 'HELD':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'POSTPONED':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'upcoming':
        return (
          <div className="space-y-6">
            {/* Alertes ORION */}
            {orionAlerts.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-gray-800">Alertes ORION</h3>
                </div>
                <div className="p-4 space-y-3">
                  {orionAlerts.map((alert, index) => (
                    <div
                      key={index}
                      className={`p-4 border rounded-lg ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-1">{alert.title}</h4>
                          <p className="text-sm text-gray-600 mb-2">{alert.description}</p>
                          {alert.recommendation && (
                            <p className="text-xs text-gray-500 mt-2">
                              💡 {alert.recommendation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Réunions à venir */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-800">Réunions à venir</h3>
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Chargement...</div>
                ) : upcomingMeetings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Aucune réunion à venir pour le moment.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcomingMeetings.map((meeting) => (
                      <div
                        key={meeting.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-gray-800">{meeting.title}</h4>
                              <span
                                className={`text-xs px-2 py-1 rounded ${getMeetingTypeColor(
                                  meeting.meetingType,
                                )}`}
                              >
                                {meeting.meetingType}
                              </span>
                              <span
                                className={`text-xs px-2 py-1 rounded ${getStatusColor(
                                  meeting.status,
                                )}`}
                              >
                                {meeting.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{meeting.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(meeting.meetingDate).toLocaleDateString('fr-FR')}
                              </div>
                              {meeting.startTime && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  {meeting.startTime}
                                </div>
                              )}
                              {meeting.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  {meeting.location}
                                </div>
                              )}
                              {meeting.participants && (
                                <div className="flex items-center gap-1">
                                  <Users className="w-4 h-4" />
                                  {meeting.participants.length} participant(s)
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'history':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-800">Historique des réunions</h3>
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Chargement...</div>
                ) : historyMeetings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Aucune réunion dans l'historique pour le moment.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {historyMeetings.map((meeting) => (
                      <div
                        key={meeting.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-gray-800">{meeting.title}</h4>
                              <span
                                className={`text-xs px-2 py-1 rounded ${getMeetingTypeColor(
                                  meeting.meetingType,
                                )}`}
                              >
                                {meeting.meetingType}
                              </span>
                              <span
                                className={`text-xs px-2 py-1 rounded ${getStatusColor(
                                  meeting.status,
                                )}`}
                              >
                                {meeting.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{meeting.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(meeting.meetingDate).toLocaleDateString('fr-FR')}
                              </div>
                              {meeting.minutes && (
                                <div className="flex items-center gap-1">
                                  <FileText className="w-4 h-4" />
                                  Compte rendu disponible
                                </div>
                              )}
                              {meeting.decisions && meeting.decisions.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <CheckSquare className="w-4 h-4" />
                                  {meeting.decisions.length} décision(s)
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'minutes':
        return (
          <div className="space-y-6">
            {/* Templates disponibles */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Templates officiels de comptes rendus</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      // TODO: Afficher les détails du template
                      console.log('Template selected:', template);
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold text-gray-800">{template.name}</h4>
                      {template.isSystem && (
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          Système
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded">{template.meetingType}</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">{template.language}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Réunions avec comptes rendus */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-gray-800">Comptes rendus générés</h3>
              </div>
              <div className="p-4">
                {loading ? (
                  <div className="text-center py-8 text-gray-500">Chargement...</div>
                ) : historyMeetings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Aucun compte rendu généré pour le moment.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {historyMeetings
                      .filter((m) => m.minutes)
                      .map((meeting) => (
                        <div
                          key={meeting.id}
                          className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-gray-800">{meeting.title}</h4>
                                <span
                                  className={`text-xs px-2 py-1 rounded ${getMeetingTypeColor(
                                    meeting.meetingType,
                                  )}`}
                                >
                                  {meeting.meetingType}
                                </span>
                                {meeting.minutes?.validated && (
                                  <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                                    Validé
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                {new Date(meeting.meetingDate).toLocaleDateString('fr-FR')}
                              </p>
                              {meeting.minutes?.template && (
                                <p className="text-xs text-gray-500">
                                  Template: {meeting.minutes.template.name}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {meeting.minutes?.pdfPath && (
                                <button
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                                  onClick={() => {
                                    // TODO: Télécharger le PDF
                                    console.log('Download PDF:', meeting.minutes.pdfPath);
                                  }}
                                >
                                  <FileDown className="w-5 h-5" />
                                </button>
                              )}
                              <button
                                className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                                onClick={() => {
                                  setSelectedMeeting(meeting);
                                  setSelectedMinutes(meeting.minutes);
                                }}
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal pour afficher le compte rendu */}
            {selectedMinutes && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h3 className="text-xl font-semibold text-gray-800">
                      Compte rendu - {selectedMeeting?.title}
                    </h3>
                    <button
                      className="text-gray-500 hover:text-gray-700"
                      onClick={() => {
                        setSelectedMinutes(null);
                        setSelectedMeeting(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-6">
                    <div className="prose max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700">
                        {selectedMinutes.renderedContent || selectedMinutes.content}
                      </pre>
                    </div>
                    <div className="mt-6 flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                        Version {selectedMinutes.version} •{' '}
                        {selectedMinutes.validated ? 'Validé' : 'Non validé'}
                      </div>
                      <div className="flex gap-2">
                        {selectedMinutes.pdfPath && (
                          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            <FileDown className="w-4 h-4 inline mr-2" />
                            Télécharger PDF
                          </button>
                        )}
                        <button
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                          onClick={() => {
                            // TODO: Valider le compte rendu
                            console.log('Validate minutes:', selectedMinutes.id);
                          }}
                        >
                          Valider
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'decisions':
        return (
          <div className="space-y-6">
            {/* Statistiques des décisions */}
            {decisionStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                    <h4 className="font-semibold text-gray-800">Total</h4>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{decisionStats.total}</div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckSquare className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-gray-800">Exécutées</h4>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{decisionStats.done}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {decisionStats.completionRate}%
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckSquare className="w-5 h-5 text-yellow-600" />
                    <h4 className="font-semibold text-gray-800">En cours</h4>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">
                    {decisionStats.inProgress}
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <h4 className="font-semibold text-gray-800">En retard</h4>
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{decisionStats.overdue}</div>
                </div>
              </div>
            )}

            {/* KPIs ORION */}
            {orionKPIs && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-800 mb-4">KPIs ORION</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-1">
                      Taux de tenue des réunions
                    </h4>
                    <div className="text-2xl font-bold text-gray-900">
                      {orionKPIs.meetingHeldRate?.rate || 0}%
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-1">
                      Taux de présence
                    </h4>
                    <div className="text-2xl font-bold text-gray-900">
                      {orionKPIs.attendanceRate?.rate || 0}%
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-1">
                      Taux d'exécution des décisions
                    </h4>
                    <div className="text-2xl font-bold text-gray-900">
                      {orionKPIs.decisionExecutionRate?.rate || 0}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Réunions Administratives, Pédagogiques & Parents"
        description="Gestion complète des réunions institutionnelles. Planification, participants, ordres du jour, comptes rendus, décisions et suivi."
        icon="attendance"
        kpis={[
          {
            label: 'À venir',
            value: String(upcomingMeetings.length),
            unit: '',
          },
          {
            label: 'Taux de présence',
            value: orionKPIs?.attendanceRate?.rate
              ? `${orionKPIs.attendanceRate.rate}%`
              : 'N/A',
            unit: '',
          },
          {
            label: 'Décisions en retard',
            value: decisionStats?.overdue ? String(decisionStats.overdue) : '0',
            unit: '',
          },
        ]}
        actions={[
          { label: 'Nouvelle réunion', onClick: () => console.log('New meeting'), primary: true },
          { label: 'Statistiques', onClick: () => console.log('Stats') },
        ]}
      />

      <div className="p-6">
        {/* Navigation par onglets */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu de l'onglet actif */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Chargement des réunions...</div>
        ) : (
          renderTabContent()
        )}
      </div>
    </div>
  );
}

