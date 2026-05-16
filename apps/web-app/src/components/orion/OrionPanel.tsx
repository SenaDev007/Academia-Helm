/**
 * ORION Panel Component
 * 
 * Interface institutionnelle pour ORION, l'assistant de direction
 * 
 * CONTRAINTES :
 * - Accès réservé aux rôles élevés (DIRECTOR, SUPER_DIRECTOR, ADMIN)
 * - Ton institutionnel strict
 * - Présentation sobre et professionnelle
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import {
  askOrion,
  getOrionMonthlySummary,
  getOrionAlerts,
  acknowledgeOrionAlert,
  getOrionHistory,
} from '@/services/orion.service';
import type {
  OrionResponse,
  OrionMonthlySummary,
  OrionAlert,
  OrionAnalysisHistory,
} from '@/types';
import {
  Shield,
  Send,
  Loader,
  AlertTriangle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Clock,
  CheckCircle,
  X,
} from 'lucide-react';
import AppIcon from '@/components/ui/AppIcon';

interface OrionPanelProps {
  userRole: string;
}

export default function OrionPanel({ userRole }: OrionPanelProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<OrionResponse | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<OrionMonthlySummary | null>(null);
  const [alerts, setAlerts] = useState<OrionAlert[]>([]);
  const [history, setHistory] = useState<OrionAnalysisHistory[]>([]);
  const [activeTab, setActiveTab] = useState<'query' | 'summary' | 'alerts' | 'history'>('query');
  const [selectedAlertLevel, setSelectedAlertLevel] = useState<'ALL' | 'INFO' | 'ATTENTION' | 'CRITIQUE'>('ALL');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Vérification de l'accès (rôles autorisés)
  const authorizedRoles = ['DIRECTOR', 'SUPER_DIRECTOR', 'ADMIN'];
  const hasAccess = authorizedRoles.includes(userRole);

  useEffect(() => {
    if (hasAccess) {
      loadInitialData();
    }
  }, [hasAccess]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [response, history]);

  async function loadInitialData() {
    try {
      // Charger le résumé mensuel
      const summary = await getOrionMonthlySummary();
      setMonthlySummary(summary);

      // Charger les alertes
      const alertsData = await getOrionAlerts();
      setAlerts(alertsData);

      // Charger l'historique récent
      const historyData = await getOrionHistory(20);
      setHistory(historyData);
    } catch (error) {
      console.error('Error loading ORION data:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const orionResponse = await askOrion({ query });
      setResponse(orionResponse);
      setQuery('');
      // Recharger l'historique
      const historyData = await getOrionHistory(20);
      setHistory(historyData);
    } catch (error) {
      console.error('Error asking ORION:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAcknowledgeAlert(alertId: string) {
    try {
      await acknowledgeOrionAlert(alertId);
      const alertsData = await getOrionAlerts();
      setAlerts(alertsData);
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  }

  if (!hasAccess) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800 text-sm font-medium">
          L'accès à ORION est réservé aux directeurs et promoteurs.
        </p>
      </div>
    );
  }

  const getAlertLevelConfig = (level: string) => {
    switch (level) {
      case 'CRITIQUE':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-300',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
        };
      case 'ATTENTION':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-300',
          textColor: 'text-orange-800',
          iconColor: 'text-orange-600',
        };
      case 'INFO':
        return {
          icon: Info,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-300',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600',
        };
      default:
        return {
          icon: Info,
          bgColor: 'bg-cloud',
          borderColor: 'border-gray-300',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
        };
    }
  };

  const filteredAlerts = selectedAlertLevel === 'ALL' 
    ? alerts 
    : alerts.filter(a => a.level === selectedAlertLevel);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header Institutionnel */}
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-900 to-blue-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gold-500 rounded-lg flex items-center justify-center">
              <Shield className="w-8 h-8 text-blue-900" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">ORION</h2>
              <p className="text-sm text-graphite-500">Assistant de Direction Institutionnel</p>
            </div>
          </div>
          {response && response.dataSufficient && (
            <div className="flex items-center space-x-2 text-sm text-graphite-500">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Données suffisantes • Confiance: {response.confidence}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-cloud">
        <div className="flex space-x-1 px-6">
          {[
            { id: 'query', label: 'Requête', icon: Send },
            { id: 'summary', label: 'Résumé Mensuel', icon: FileText },
            { id: 'alerts', label: `Alertes ${alerts.length > 0 ? `(${alerts.length})` : ''}`, icon: AlertTriangle },
            { id: 'history', label: 'Historique', icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-gold-500 text-blue-900 font-semibold bg-white'
                    : 'border-transparent text-graphite-700 hover:text-blue-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Query Tab */}
        {activeTab === 'query' && (
          <div className="space-y-6">
            {/* Response */}
            {response && (
              <div className="bg-cloud rounded-lg border border-gray-200 p-6">
                {!response.dataSufficient && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-start space-x-2">
                    <AppIcon 
                      name="warning" 
                      size="alert" 
                      className="text-yellow-600 mt-0.5 flex-shrink-0"
                      aria-hidden={true}
                    />
                    <p className="text-sm text-yellow-800 font-medium">
                      Données insuffisantes pour répondre de manière complète.
                    </p>
                  </div>
                )}

                {/* Faits */}
                {response.answer.facts.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2 uppercase tracking-wide">
                      Faits Observés
                    </h3>
                    <ul className="space-y-2">
                      {response.answer.facts.map((fact, idx) => (
                        <li key={idx} className="flex items-start space-x-2 text-graphite-700">
                          <div className="w-1.5 h-1.5 bg-gold-500 rounded-full mt-2 flex-shrink-0" />
                          <span className="text-sm">{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Interprétation */}
                <div className="mb-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-blue-900 mb-2 uppercase tracking-wide">
                    Interprétation
                  </h3>
                  <p className="text-graphite-700 text-sm leading-relaxed">
                    {response.answer.interpretation}
                  </p>
                </div>

                {/* Vigilance */}
                {response.answer.vigilance && (
                  <div className="pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2 uppercase tracking-wide">
                      Point de Vigilance
                    </h3>
                    <p className="text-graphite-700 text-sm leading-relaxed">
                      {response.answer.vigilance}
                    </p>
                  </div>
                )}

                {/* Data Sources */}
                {response.dataSources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-graphite-500 mb-2">Sources de données :</p>
                    <div className="flex flex-wrap gap-2">
                      {response.dataSources.map((source, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-1 bg-white border border-gray-200 rounded text-graphite-700"
                        >
                          {source.kpi}: {source.value.toLocaleString()} ({source.period})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex space-x-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Posez une question factuelle... (ex: 'Quel est l'état financier ce mois-ci ?')"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-transparent text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="px-6 py-3 bg-blue-900 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 text-sm font-medium"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Analyse...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Envoyer</span>
                  </>
                )}
              </button>
            </form>

            {/* Example Questions */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-graphite-700 mb-3 font-medium uppercase tracking-wide">
                Exemples de Requêtes
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  "Quel est l'état financier ce mois-ci ?",
                  "Quelles sont les tendances des inscriptions ?",
                  "Y a-t-il des points de vigilance ?",
                  "Comparer les performances avec le mois précédent",
                ].map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuery(example)}
                    className="text-left text-xs px-3 py-2 bg-cloud text-graphite-700 rounded-md hover:bg-mist transition-colors border border-gray-200"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {monthlySummary ? (
              <>
                <div className="bg-blue-900 text-white rounded-lg p-4">
                  <p className="text-sm font-semibold mb-1">Période</p>
                  <p className="text-lg">{monthlySummary.period}</p>
                </div>

                {/* Faits */}
                <div>
                  <h3 className="text-sm font-semibold text-navy-900 mb-3 uppercase tracking-wide">
                    Faits Observés
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-cloud rounded-lg p-4 border border-gray-200">
                      <p className="text-xs text-graphite-500 mb-1">Financier</p>
                      <p className="text-sm text-graphite-700">
                        Recettes: {monthlySummary.facts.financial.totalRevenue.toLocaleString()} FCFA
                      </p>
                      <p className="text-sm text-graphite-700">
                        Taux recouvrement: {monthlySummary.facts.financial.recoveryRate}%
                      </p>
                    </div>
                    <div className="bg-cloud rounded-lg p-4 border border-gray-200">
                      <p className="text-xs text-graphite-500 mb-1">Académique</p>
                      <p className="text-sm text-graphite-700">
                        Élèves: {monthlySummary.facts.academic.totalStudents}
                      </p>
                      <p className="text-sm text-graphite-700">
                        Classes: {monthlySummary.facts.academic.totalClasses}
                      </p>
                    </div>
                    <div className="bg-cloud rounded-lg p-4 border border-gray-200">
                      <p className="text-xs text-graphite-500 mb-1">Opérationnel</p>
                      <p className="text-sm text-graphite-700">
                        Enseignants: {monthlySummary.facts.operational.totalTeachers}
                      </p>
                      <p className="text-sm text-graphite-700">
                        Présence: {monthlySummary.facts.operational.teacherPresenceRate}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Interprétation */}
                <div>
                  <h3 className="text-sm font-semibold text-navy-900 mb-3 uppercase tracking-wide">
                    Interprétation
                  </h3>
                  <div className="bg-cloud rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-graphite-700 mb-4 leading-relaxed">
                      {monthlySummary.interpretation.overview}
                    </p>

                    {monthlySummary.interpretation.trends.length > 0 && (
                      <div className="space-y-3">
                        {monthlySummary.interpretation.trends.map((trend, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                            <div className="flex items-center space-x-3">
                              {trend.direction === 'UP' ? (
                                <TrendingUp className="w-5 h-5 text-green-600" />
                              ) : trend.direction === 'DOWN' ? (
                                <TrendingDown className="w-5 h-5 text-red-600" />
                              ) : (
                                <Minus className="w-5 h-5 text-graphite-500" />
                              )}
                              <div>
                                <p className="text-sm font-medium text-blue-900">{trend.metric}</p>
                                <p className="text-xs text-graphite-700">{trend.description}</p>
                              </div>
                            </div>
                            <span className={`text-sm font-semibold ${
                              trend.direction === 'UP' ? 'text-green-600' :
                              trend.direction === 'DOWN' ? 'text-red-600' :
                              'text-graphite-700'
                            }`}>
                              {trend.direction === 'UP' ? '+' : ''}{trend.magnitude}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {monthlySummary.interpretation.highlights.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs font-semibold text-blue-900 mb-2 uppercase tracking-wide">
                          Points Clés
                        </p>
                        <ul className="space-y-2">
                          {monthlySummary.interpretation.highlights.map((highlight, idx) => (
                            <li key={idx} className="flex items-start space-x-2 text-sm text-graphite-700">
                              <div className="w-1.5 h-1.5 bg-gold-500 rounded-full mt-2 flex-shrink-0" />
                              <span>{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Vigilance */}
                {monthlySummary.vigilance.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-navy-900 mb-3 uppercase tracking-wide">
                      Points de Vigilance
                    </h3>
                    <div className="space-y-3">
                      {monthlySummary.vigilance.map((alert) => {
                        const config = getAlertLevelConfig(alert.level);
                        const Icon = config.icon;
                        return (
                          <div
                            key={alert.id}
                            className={`rounded-lg p-4 border-2 ${config.bgColor} ${config.borderColor}`}
                          >
                            <div className="flex items-start space-x-3">
                              <Icon className={`w-5 h-5 ${config.iconColor} mt-0.5 flex-shrink-0`} />
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className={`font-semibold ${config.textColor}`}>
                                    {alert.title}
                                  </h4>
                                  <span className={`text-xs px-2 py-1 rounded ${config.borderColor} ${config.textColor} bg-white`}>
                                    {alert.level}
                                  </span>
                                </div>
                                <p className={`text-sm ${config.textColor} mb-3`}>
                                  {alert.interpretation}
                                </p>
                                <p className={`text-sm font-medium ${config.textColor}`}>
                                  {alert.vigilance}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Loader className="w-8 h-8 animate-spin text-graphite-500 mx-auto mb-4" />
                <p className="text-graphite-700 text-sm">Chargement du résumé mensuel...</p>
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center space-x-2 pb-4 border-b border-gray-200">
              <span className="text-xs text-graphite-700 font-medium">Filtrer par niveau :</span>
              {['ALL', 'INFO', 'ATTENTION', 'CRITIQUE'].map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedAlertLevel(level as any)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    selectedAlertLevel === level
                      ? 'bg-blue-900 text-white'
                      : 'bg-mist text-graphite-700 hover:bg-cloud'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>

            {filteredAlerts.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <p className="text-graphite-700 text-sm">Aucune alerte {selectedAlertLevel !== 'ALL' ? `de niveau ${selectedAlertLevel}` : ''}</p>
              </div>
            ) : (
              filteredAlerts.map((alert) => {
                const config = getAlertLevelConfig(alert.level);
                const Icon = config.icon;
                return (
                  <div
                    key={alert.id}
                    className={`rounded-lg p-5 border-2 ${config.bgColor} ${config.borderColor}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <Icon className={`w-6 h-6 ${config.iconColor}`} />
                          <h3 className={`font-semibold text-lg ${config.textColor}`}>
                            {alert.title}
                          </h3>
                          <span className={`text-xs px-2 py-1 rounded ${config.borderColor} ${config.textColor} bg-white`}>
                            {alert.level}
                          </span>
                        </div>

                        {/* Faits */}
                        {alert.facts.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-graphite-700 mb-2 uppercase tracking-wide">
                              Faits Observés
                            </p>
                            <ul className="space-y-1">
                              {alert.facts.map((fact, idx) => (
                                <li key={idx} className="flex items-start space-x-2 text-sm text-graphite-700">
                                  <div className="w-1.5 h-1.5 bg-gold-500 rounded-full mt-2 flex-shrink-0" />
                                  <span>{fact}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Interprétation */}
                        <p className={`text-sm ${config.textColor} mb-3`}>
                          {alert.interpretation}
                        </p>

                        {/* Vigilance */}
                        <p className={`text-sm font-medium ${config.textColor}`}>
                          {alert.vigilance}
                        </p>
                      </div>

                      {!alert.acknowledgedAt && (
                        <button
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                          className="ml-4 p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                          title="Acquitter l'alerte"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-graphite-500 mx-auto mb-4" />
                <p className="text-graphite-700 text-sm">Aucun historique disponible</p>
              </div>
            ) : (
              history.map((item) => (
                <div key={item.id} className="bg-cloud rounded-lg p-5 border border-gray-200">
                  <div className="flex items-start space-x-4">
                    <Shield className="w-5 h-5 text-gold-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-blue-900">{item.content.title}</h3>
                        <span className="text-xs text-graphite-500">
                          {new Date(item.createdAt).toLocaleString('fr-FR')}
                        </span>
                      </div>

                      {item.content.facts.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-semibold text-graphite-700 mb-1 uppercase tracking-wide">
                            Faits
                          </p>
                          <ul className="space-y-1">
                            {item.content.facts.map((fact, idx) => (
                              <li key={idx} className="text-xs text-graphite-700 flex items-start space-x-2">
                                <div className="w-1 h-1 bg-gold-500 rounded-full mt-1.5 flex-shrink-0" />
                                <span>{fact}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <p className="text-sm text-graphite-700 mb-2">{item.content.interpretation}</p>

                      {item.content.vigilance && (
                        <p className="text-sm font-medium text-orange-700">{item.content.vigilance}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

