/**
 * Pricing Management Component
 * 
 * Interface pour gérer le pricing depuis le panel super admin
 * - Configuration pricing globale
 * - Group tiers
 * - Overrides (promos)
 */

'use client';

import { useState, useEffect } from 'react';
import {
  getActivePricingConfig,
  getAllPricingConfigs,
  createPricingConfig,
  getPricingGroupTiers,
  upsertPricingGroupTier,
  getPricingOverrides,
  createPricingOverride,
  deactivatePricingOverride,
  type PricingConfig,
  type PricingGroupTier,
  type PricingOverride,
} from '@/services/pricing-admin.service';
import {
  Settings,
  DollarSign,
  Users,
  Tag,
  Save,
  Plus,
  X,
  Loader,
  AlertCircle,
  CheckCircle,
  History,
} from 'lucide-react';

type Tab = 'config' | 'tiers' | 'overrides' | 'history';

export default function PricingManagement() {
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Config state
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [configForm, setConfigForm] = useState<Partial<PricingConfig>>({});

  // Group tiers state
  const [tiers, setTiers] = useState<PricingGroupTier[]>([]);
  const [tierForm, setTierForm] = useState<Partial<PricingGroupTier>>({});
  const [showTierForm, setShowTierForm] = useState(false);

  // Overrides state
  const [overrides, setOverrides] = useState<PricingOverride[]>([]);
  const [overrideForm, setOverrideForm] = useState<Partial<PricingOverride>>({});
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  // History state
  const [configHistory, setConfigHistory] = useState<PricingConfig[]>([]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === 'config') {
        const activeConfig = await getActivePricingConfig();
        setConfig(activeConfig);
        setConfigForm(activeConfig);
      } else if (activeTab === 'tiers') {
        const tiersData = await getPricingGroupTiers();
        setTiers(tiersData);
      } else if (activeTab === 'overrides') {
        const overridesData = await getPricingOverrides();
        setOverrides(overridesData);
      } else if (activeTab === 'history') {
        const history = await getAllPricingConfigs();
        setConfigHistory(history);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const newConfig = await createPricingConfig(configForm);
      setConfig(newConfig);
      setConfigForm(newConfig);
      setSuccess('✅ Nouvelle version de configuration créée avec succès');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTier = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await upsertPricingGroupTier(tierForm);
      setSuccess('✅ Group tier sauvegardé avec succès');
      setTimeout(() => setSuccess(null), 5000);
      setShowTierForm(false);
      setTierForm({});
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOverride = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await createPricingOverride(overrideForm);
      setSuccess('✅ Override créé avec succès');
      setTimeout(() => setSuccess(null), 5000);
      setShowOverrideForm(false);
      setOverrideForm({});
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivateOverride = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir désactiver cet override ?')) return;
    setIsLoading(true);
    setError(null);
    try {
      await deactivatePricingOverride(id);
      setSuccess('✅ Override désactivé');
      setTimeout(() => setSuccess(null), 5000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la désactivation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-navy-900 mb-2">Gestion du Pricing</h1>
        <p className="text-slate-600">Configurez les prix, groupes et promotions</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
          <CheckCircle className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('config')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'config'
                ? 'border-navy-900 text-navy-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Configuration Globale
          </button>
          <button
            onClick={() => setActiveTab('tiers')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tiers'
                ? 'border-navy-900 text-navy-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Group Tiers
          </button>
          <button
            onClick={() => setActiveTab('overrides')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overrides'
                ? 'border-navy-900 text-navy-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Tag className="w-4 h-4 inline mr-2" />
            Promotions / Overrides
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-navy-900 text-navy-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            Historique
          </button>
        </nav>
      </div>

      {/* Content */}
      {isLoading && activeTab !== 'config' ? (
        <div className="flex items-center justify-center py-16">
          <Loader className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Configuration Globale */}
          {activeTab === 'config' && config && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-navy-900 mb-2">
                  Configuration Pricing Active (Version {config.version})
                </h2>
                <p className="text-sm text-slate-600">
                  ⚠️ Créer une nouvelle version pour modifier (versionning obligatoire)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Prix souscription initiale (FCFA)
                  </label>
                  <input
                    type="number"
                    value={configForm.initialSubscriptionFee || ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, initialSubscriptionFee: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Prix mensuel de base (FCFA)
                  </label>
                  <input
                    type="number"
                    value={configForm.monthlyBasePrice || ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, monthlyBasePrice: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Prix annuel de base (FCFA)
                  </label>
                  <input
                    type="number"
                    value={configForm.yearlyBasePrice || ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, yearlyBasePrice: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    % Réduction annuel
                  </label>
                  <input
                    type="number"
                    value={configForm.yearlyDiscountPercent || ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, yearlyDiscountPercent: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Supplément bilingue mensuel (FCFA)
                  </label>
                  <input
                    type="number"
                    value={configForm.bilingualMonthlyAddon || ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, bilingualMonthlyAddon: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Supplément bilingue annuel (FCFA)
                  </label>
                  <input
                    type="number"
                    value={configForm.bilingualYearlyAddon || ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, bilingualYearlyAddon: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Prix école supplémentaire (FCFA)
                  </label>
                  <input
                    type="number"
                    value={configForm.schoolAdditionalPrice || ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, schoolAdditionalPrice: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Durée trial (jours)
                  </label>
                  <input
                    type="number"
                    value={configForm.trialDays || ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, trialDays: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Durée grace (jours)
                  </label>
                  <input
                    type="number"
                    value={configForm.graceDays || ''}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, graceDays: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Jours de rappel (JSON: [7, 3, 1])
                  </label>
                  <input
                    type="text"
                    value={JSON.stringify(configForm.reminderDays || [])}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setConfigForm({ ...configForm, reminderDays: parsed });
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-900"
                    placeholder="[7, 3, 1]"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveConfig}
                  disabled={isLoading}
                  className="btn-primary-crimson flex items-center disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Publication...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Publier nouvelle version
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Group Tiers */}
          {activeTab === 'tiers' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-navy-900">Group Tiers</h2>
                <button
                  onClick={() => setShowTierForm(!showTierForm)}
                  className="btn-primary-crimson flex items-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Ajouter un tier
                </button>
              </div>

              {showTierForm && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-navy-900 mb-4">Nouveau Group Tier</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Nombre d'écoles
                      </label>
                      <input
                        type="number"
                        value={tierForm.schoolsCount || ''}
                        onChange={(e) =>
                          setTierForm({ ...tierForm, schoolsCount: parseInt(e.target.value) })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Prix mensuel (FCFA)
                      </label>
                      <input
                        type="number"
                        value={tierForm.monthlyPrice || ''}
                        onChange={(e) =>
                          setTierForm({ ...tierForm, monthlyPrice: parseInt(e.target.value) })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Prix annuel (FCFA)
                      </label>
                      <input
                        type="number"
                        value={tierForm.yearlyPrice || ''}
                        onChange={(e) =>
                          setTierForm({ ...tierForm, yearlyPrice: parseInt(e.target.value) })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setShowTierForm(false);
                        setTierForm({});
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                    <button onClick={handleSaveTier} className="btn-primary-crimson">
                      Sauvegarder
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Nombre d'écoles
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Prix mensuel
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Prix annuel
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {tiers.map((tier) => (
                      <tr key={tier.id}>
                        <td className="px-6 py-4">{tier.schoolsCount}</td>
                        <td className="px-6 py-4">{tier.monthlyPrice.toLocaleString()} FCFA</td>
                        <td className="px-6 py-4">{tier.yearlyPrice.toLocaleString()} FCFA</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              tier.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {tier.isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              setTierForm(tier);
                              setShowTierForm(true);
                            }}
                            className="text-soft-gold hover:text-gold-600 text-sm"
                          >
                            Modifier
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Overrides */}
          {activeTab === 'overrides' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-navy-900">Promotions / Overrides</h2>
                <button
                  onClick={() => setShowOverrideForm(!showOverrideForm)}
                  className="btn-primary-crimson flex items-center"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Créer un override
                </button>
              </div>

              {showOverrideForm && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-navy-900 mb-4">Nouvel Override</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Code promo (optionnel)
                      </label>
                      <input
                        type="text"
                        value={overrideForm.code || ''}
                        onChange={(e) => setOverrideForm({ ...overrideForm, code: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md"
                        placeholder="PROMO2024"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Remise % (optionnel)
                      </label>
                      <input
                        type="number"
                        value={overrideForm.percentDiscount || ''}
                        onChange={(e) =>
                          setOverrideForm({
                            ...overrideForm,
                            percentDiscount: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-md"
                        placeholder="10"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Prix fixe (optionnel)
                      </label>
                      <input
                        type="number"
                        value={overrideForm.fixedPrice || ''}
                        onChange={(e) =>
                          setOverrideForm({ ...overrideForm, fixedPrice: parseInt(e.target.value) })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-md"
                        placeholder="100000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Date d'expiration (optionnel)
                      </label>
                      <input
                        type="date"
                        value={
                          overrideForm.expiresAt
                            ? new Date(overrideForm.expiresAt).toISOString().split('T')[0]
                            : ''
                        }
                        onChange={(e) =>
                          setOverrideForm({
                            ...overrideForm,
                            expiresAt: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setShowOverrideForm(false);
                        setOverrideForm({});
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                    <button onClick={handleCreateOverride} className="btn-primary-crimson">
                      Créer
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Code / Tenant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Remise
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Expiration
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {overrides.map((override) => (
                      <tr key={override.id}>
                        <td className="px-6 py-4">
                          {override.code || override.tenant?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          {override.percentDiscount
                            ? `${override.percentDiscount}%`
                            : override.fixedPrice
                            ? `${override.fixedPrice.toLocaleString()} FCFA`
                            : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          {override.expiresAt
                            ? new Date(override.expiresAt).toLocaleDateString('fr-FR')
                            : 'Aucune'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              override.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {override.isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {override.isActive && (
                            <button
                              onClick={() => handleDeactivateOverride(override.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Désactiver
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* History */}
          {activeTab === 'history' && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-navy-900">Historique des Configurations</h2>
              </div>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Version
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Créé le
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase">
                      Créé par
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {configHistory.map((config) => (
                    <tr key={config.id}>
                      <td className="px-6 py-4 font-semibold">Version {config.version}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            config.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {config.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {new Date(config.createdAt).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-6 py-4">{config.createdBy || 'SYSTEM'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
