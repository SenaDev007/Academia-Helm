/**
 * ============================================================================
 * MODULE TRANSVERSAL — PARAMÈTRES DE L'APPLICATION
 * ============================================================================
 * Centre de contrôle stratégique d'Academia Hub
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Settings, Globe, Shield, Brain, MessageSquare, CloudOff, History, ToggleLeft, ToggleRight, Stamp } from 'lucide-react';
import { ModuleContainer, ModuleHeader } from '@/components/modules/blueprint';
import AdministrativeSealsManagement from '@/components/settings/AdministrativeSealsManagement';
import ElectronicSignaturesManagement from '@/components/settings/ElectronicSignaturesManagement';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<string>('general');
  const [loading, setLoading] = useState(true);
  const [generalSettings, setGeneralSettings] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [securitySettings, setSecuritySettings] = useState<any>(null);
  const [orionSettings, setOrionSettings] = useState<any>(null);
  const [atlasSettings, setAtlasSettings] = useState<any>(null);
  const [offlineSyncSettings, setOfflineSyncSettings] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // TODO: Charger les paramètres depuis l'API
      setLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'Général & Identité', icon: Globe },
    { id: 'features', label: 'Modules & Fonctionnalités', icon: ToggleLeft },
    { id: 'security', label: 'Sécurité & Conformité', icon: Shield },
    { id: 'seals', label: 'Cachets & Signatures', icon: Stamp },
    { id: 'orion', label: 'IA ORION', icon: Brain },
    { id: 'atlas', label: 'IA ATLAS', icon: MessageSquare },
    { id: 'offline', label: 'Synchronisation Offline', icon: CloudOff },
    { id: 'history', label: 'Historique & Audit', icon: History },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Identité de l'établissement</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'établissement</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nom de l'établissement"
                    defaultValue={generalSettings?.schoolName || ''}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fuseau horaire</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue={generalSettings?.timezone || 'Africa/Porto-Novo'}
                  >
                    <option value="Africa/Porto-Novo">Africa/Porto-Novo (UTC+1)</option>
                    <option value="Africa/Lagos">Africa/Lagos (UTC+1)</option>
                    <option value="Africa/Abidjan">Africa/Abidjan (UTC+0)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Langue par défaut</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue={generalSettings?.defaultLanguage || 'FR'}
                  >
                    <option value="FR">Français</option>
                    <option value="EN">English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Devise</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    defaultValue={generalSettings?.currency || 'XOF'}
                  >
                    <option value="XOF">XOF (FCFA)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        );

      case 'features':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Modules & Fonctionnalités</h3>
              <div className="space-y-4">
                {features.map((feature) => (
                  <div
                    key={feature.featureCode}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <h4 className="font-semibold text-gray-800">{feature.featureCode}</h4>
                      <p className="text-sm text-gray-600">Statut: {feature.status}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {feature.isEnabled ? (
                        <button className="text-green-600 hover:text-green-700">
                          <ToggleRight className="w-6 h-6" />
                        </button>
                      ) : (
                        <button className="text-gray-400 hover:text-gray-600">
                          <ToggleLeft className="w-6 h-6" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Paramètres de sécurité</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Longueur minimale du mot de passe
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue={securitySettings?.passwordMinLength || 8}
                      min={6}
                      max={20}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Durée de session (minutes)
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue={securitySettings?.sessionTimeoutMinutes || 30}
                      min={5}
                      max={480}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'orion':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Paramètres ORION</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-800">Activer ORION</h4>
                    <p className="text-sm text-gray-600">Activez l'IA de pilotage ORION</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {orionSettings?.isEnabled ? (
                      <button className="text-green-600 hover:text-green-700">
                        <ToggleRight className="w-6 h-6" />
                      </button>
                    ) : (
                      <button className="text-gray-400 hover:text-gray-600">
                        <ToggleLeft className="w-6 h-6" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'atlas':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Paramètres ATLAS</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-800">Activer ATLAS</h4>
                    <p className="text-sm text-gray-600">Activez le chatbot IA ATLAS</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {atlasSettings?.isEnabled ? (
                      <button className="text-green-600 hover:text-green-700">
                        <ToggleRight className="w-6 h-6" />
                      </button>
                    ) : (
                      <button className="text-gray-400 hover:text-gray-600">
                        <ToggleLeft className="w-6 h-6" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'offline':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Paramètres de synchronisation offline</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-800">Activer la synchronisation offline</h4>
                    <p className="text-sm text-gray-600">Permet l'utilisation de l'application hors ligne</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {offlineSyncSettings?.isEnabled ? (
                      <button className="text-green-600 hover:text-green-700">
                        <ToggleRight className="w-6 h-6" />
                      </button>
                    ) : (
                      <button className="text-gray-400 hover:text-gray-600">
                        <ToggleLeft className="w-6 h-6" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'seals':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('seals')}
                    className="px-6 py-4 text-sm font-medium text-blue-600 border-b-2 border-blue-600"
                  >
                    Cachets Administratifs
                  </button>
                  <button
                    onClick={() => setActiveTab('signatures')}
                    className="px-6 py-4 text-sm font-medium text-gray-600 hover:text-gray-800"
                  >
                    Signatures Électroniques
                  </button>
                </div>
              </div>
              <div className="p-6">
                {activeTab === 'seals' ? (
                  <AdministrativeSealsManagement />
                ) : (
                  <ElectronicSignaturesManagement />
                )}
              </div>
            </div>
          </div>
        );

      case 'history':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Historique des changements</h3>
              <div className="space-y-4">
                {history.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Aucun changement enregistré pour le moment.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-gray-800">{item.key}</h4>
                            <p className="text-sm text-gray-600">{item.category}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Modifié le {new Date(item.changedAt).toLocaleString('fr-FR')}
                            </p>
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

      default:
        return null;
    }
  };

  return (
    <ModuleContainer>
      <ModuleHeader
        title="Paramètres de l'application"
        description="Centre de contrôle stratégique d'Academia Hub. Configurez l'établissement, activez/désactivez des capacités, adaptez le comportement métier."
        icon={Settings}
        kpis={[]}
        actions={[]}
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
          <div className="text-center py-12 text-gray-500">Chargement des paramètres...</div>
        ) : (
          renderTabContent()
        )}
      </div>
    </ModuleContainer>
  );
}

