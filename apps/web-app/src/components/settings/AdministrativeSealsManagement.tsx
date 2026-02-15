/**
 * ============================================================================
 * ADMINISTRATIVE SEALS MANAGEMENT COMPONENT
 * ============================================================================
 * 
 * Interface de gestion des cachets administratifs
 * - Liste des cachets
 * - Création/édition de cachets
 * - Gestion des versions
 * - Historique d'utilisation
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Stamp, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  History, 
  CheckCircle, 
  XCircle,
  Download,
  Upload,
  Settings
} from 'lucide-react';

interface AdministrativeSeal {
  id: string;
  label: string;
  type: 'INSTITUTIONAL' | 'NOMINATIVE' | 'TRANSACTIONAL';
  role?: string;
  holderName?: string;
  holderTitle?: string;
  isActive: boolean;
  validFrom?: string;
  validTo?: string;
  versions?: any[];
  _count?: {
    versions: number;
    usages: number;
  };
}

export default function AdministrativeSealsManagement() {
  const [seals, setSeals] = useState<AdministrativeSeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUsageHistory, setShowUsageHistory] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [selectedSeal, setSelectedSeal] = useState<AdministrativeSeal | null>(null);
  const [filters, setFilters] = useState({
    type: '',
    isActive: '',
  });

  useEffect(() => {
    loadSeals();
  }, [filters]);

  const loadSeals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.isActive !== '') params.append('isActive', filters.isActive);

      const response = await fetch(`/api/settings/administrative-seals?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSeals(data);
      }
    } catch (error) {
      console.error('Error loading seals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSeal = () => {
    setSelectedSeal(null);
    setShowCreateModal(true);
  };

  const handleEditSeal = (seal: AdministrativeSeal) => {
    setSelectedSeal(seal);
    setShowEditModal(true);
  };

  const handleViewUsage = (seal: AdministrativeSeal) => {
    setSelectedSeal(seal);
    setShowUsageHistory(true);
  };

  const handleCreateVersion = (seal: AdministrativeSeal) => {
    setSelectedSeal(seal);
    setShowVersionModal(true);
  };

  const handleToggleActive = async (seal: AdministrativeSeal) => {
    try {
      const endpoint = seal.isActive 
        ? `/api/settings/administrative-seals/${seal.id}/deactivate`
        : `/api/settings/administrative-seals/${seal.id}/activate`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        loadSeals();
      }
    } catch (error) {
      console.error('Error toggling seal status:', error);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      INSTITUTIONAL: 'Institutionnel',
      NOMINATIVE: 'Nominatif',
      TRANSACTIONAL: 'Transactionnel',
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      INSTITUTIONAL: 'bg-blue-100 text-blue-800',
      NOMINATIVE: 'bg-green-100 text-green-800',
      TRANSACTIONAL: 'bg-purple-100 text-purple-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Cachets Administratifs</h2>
          <p className="text-sm text-gray-600 mt-1">
            Gérez les cachets officiels de votre établissement
          </p>
        </div>
        <button
          onClick={handleCreateSeal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nouveau cachet
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les types</option>
              <option value="INSTITUTIONAL">Institutionnel</option>
              <option value="NOMINATIVE">Nominatif</option>
              <option value="TRANSACTIONAL">Transactionnel</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={filters.isActive}
              onChange={(e) => setFilters({ ...filters, isActive: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous</option>
              <option value="true">Actifs</option>
              <option value="false">Inactifs</option>
            </select>
          </div>
        </div>
      </div>

      {/* Seals List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cachet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle / Titulaire
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Validité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {seals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Aucun cachet trouvé. Créez votre premier cachet pour commencer.
                  </td>
                </tr>
              ) : (
                seals.map((seal) => (
                  <tr key={seal.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Stamp className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{seal.label}</div>
                          <div className="text-xs text-gray-500">
                            {seal._count?.versions || 0} version(s)
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeColor(seal.type)}`}>
                        {getTypeLabel(seal.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {seal.role || seal.holderName || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {seal.validFrom && seal.validTo ? (
                        <div>
                          <div>{new Date(seal.validFrom).toLocaleDateString('fr-FR')}</div>
                          <div className="text-xs">→ {new Date(seal.validTo).toLocaleDateString('fr-FR')}</div>
                        </div>
                      ) : (
                        'Sans limite'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {seal._count?.usages || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {seal.isActive ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm">Actif</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="w-4 h-4" />
                          <span className="text-sm">Inactif</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleCreateVersion(seal)}
                          className="text-purple-600 hover:text-purple-900"
                          title="Créer une version"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleViewUsage(seal)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Historique d'utilisation"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditSeal(seal)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(seal)}
                          className={seal.isActive ? "text-red-600 hover:text-red-900" : "text-green-600 hover:text-green-900"}
                          title={seal.isActive ? "Désactiver" : "Activer"}
                        >
                          {seal.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <SealFormModal
          seal={selectedSeal}
          onClose={() => {
            setShowCreateModal(false);
            setShowEditModal(false);
            setSelectedSeal(null);
          }}
          onSuccess={() => {
            loadSeals();
            setShowCreateModal(false);
            setShowEditModal(false);
            setSelectedSeal(null);
          }}
        />
      )}

      {/* Version Creation Modal */}
      {showVersionModal && selectedSeal && (
        <SealVersionModal
          seal={selectedSeal}
          onClose={() => {
            setShowVersionModal(false);
            setSelectedSeal(null);
          }}
          onSuccess={() => {
            loadSeals();
            setShowVersionModal(false);
            setSelectedSeal(null);
          }}
        />
      )}

      {/* Usage History Modal */}
      {showUsageHistory && selectedSeal && (
        <UsageHistoryModal
          seal={selectedSeal}
          onClose={() => {
            setShowUsageHistory(false);
            setSelectedSeal(null);
          }}
        />
      )}
    </div>
  );
}

// Modal de formulaire pour créer/éditer un cachet
function SealFormModal({ seal, onClose, onSuccess }: { seal: AdministrativeSeal | null; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    label: seal?.label || '',
    type: seal?.type || 'INSTITUTIONAL',
    role: seal?.role || '',
    holderName: seal?.holderName || '',
    holderTitle: seal?.holderTitle || '',
    validFrom: seal?.validFrom ? new Date(seal.validFrom).toISOString().split('T')[0] : '',
    validTo: seal?.validTo ? new Date(seal.validTo).toISOString().split('T')[0] : '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const endpoint = seal
        ? `/api/settings/administrative-seals/${seal.id}`
        : '/api/settings/administrative-seals';

      const response = await fetch(endpoint, {
        method: seal ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          ...formData,
          schoolId: 'current-school-id', // TODO: Récupérer depuis le contexte
          academicYearId: 'current-academic-year-id', // TODO: Récupérer depuis le contexte
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Erreur: ${error.message || 'Une erreur est survenue'}`);
      }
    } catch (error) {
      console.error('Error saving seal:', error);
      alert('Une erreur est survenue lors de la sauvegarde');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {seal ? 'Modifier le cachet' : 'Nouveau cachet'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Libellé du cachet *
              </label>
              <input
                type="text"
                required
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Cachet Direction"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de cachet *
              </label>
              <select
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="INSTITUTIONAL">Institutionnel</option>
                <option value="NOMINATIVE">Nominatif</option>
                <option value="TRANSACTIONAL">Transactionnel</option>
              </select>
            </div>

            {formData.type === 'INSTITUTIONAL' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rôle
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: DIRECTEUR, CENSEUR, ECONOME"
                />
              </div>
            )}

            {formData.type === 'NOMINATIVE' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du titulaire
                  </label>
                  <input
                    type="text"
                    value={formData.holderName}
                    onChange={(e) => setFormData({ ...formData, holderName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nom complet"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fonction
                  </label>
                  <input
                    type="text"
                    value={formData.holderTitle}
                    onChange={(e) => setFormData({ ...formData, holderTitle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Directeur Général"
                  />
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valide à partir de
                </label>
                <input
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valide jusqu'au
                </label>
                <input
                  type="date"
                  value={formData.validTo}
                  onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Enregistrement...' : seal ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Modal d'historique d'utilisation
function UsageHistoryModal({ seal, onClose }: { seal: AdministrativeSeal; onClose: () => void }) {
  const [usageHistory, setUsageHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsageHistory();
  }, []);

  const loadUsageHistory = async () => {
    try {
      const response = await fetch(`/api/settings/administrative-seals/${seal.id}/usage`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsageHistory(data);
      }
    } catch (error) {
      console.error('Error loading usage history:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Historique d'utilisation - {seal.label}
          </h3>

          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : usageHistory.length === 0 ? (
            <p className="text-gray-500 text-center p-8">Aucune utilisation enregistrée</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type de document</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisé par</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usageHistory.map((usage) => (
                    <tr key={usage.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {new Date(usage.usedAt).toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {usage.documentType}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {usage.user?.firstName} {usage.user?.lastName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
