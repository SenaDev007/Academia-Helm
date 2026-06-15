/**
 * ============================================================================
 * ELECTRONIC SIGNATURES MANAGEMENT COMPONENT
 * ============================================================================
 * 
 * Interface de gestion des signatures électroniques certifiées
 * - Liste des signatures
 * - Création de signatures
 * - Signature de documents
 * - Vérification publique
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  PenTool,
  Plus,
  Eye,
  CheckCircle,
  XCircle,
  FileText,
  Download,
  QrCode,
  Clock,
  Shield,
} from 'lucide-react';

interface ElectronicSignature {
  id: string;
  role: string;
  signatureType: 'visual' | 'certified' | 'combined';
  signatureImageUrl?: string;
  issuedAt: string;
  expiresAt?: string;
  status: 'active' | 'revoked' | 'expired';
  signedDocuments?: any[];
}

export default function ElectronicSignaturesManagement() {
  const [signatures, setSignatures] = useState<ElectronicSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState<ElectronicSignature | null>(null);

  useEffect(() => {
    loadSignatures();
  }, []);

  const loadSignatures = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings/electronic-signatures', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSignatures(data);
      }
    } catch (error) {
      console.error('Error loading signatures:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSignature = () => {
    setSelectedSignature(null);
    setShowCreateModal(true);
  };

  const handleSignDocument = (signature: ElectronicSignature) => {
    setSelectedSignature(signature);
    setShowSignModal(true);
  };

  const handleRevoke = async (signature: ElectronicSignature) => {
    if (!confirm('Êtes-vous sûr de vouloir révoquer cette signature ?')) {
      return;
    }

    try {
      const response = await fetch(`/api/settings/electronic-signatures/${signature.id}/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        loadSignatures();
      }
    } catch (error) {
      console.error('Error revoking signature:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      revoked: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Active',
      revoked: 'Révoquée',
      expired: 'Expirée',
    };
    return labels[status] || status;
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      visual: 'Visuelle',
      certified: 'Certifiée',
      combined: 'Combinée',
    };
    return labels[type] || type;
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
          <h2 className="text-2xl font-bold text-gray-900">Signatures Électroniques</h2>
          <p className="text-sm text-gray-600 mt-1">
            Gérez vos signatures électroniques certifiées
          </p>
        </div>
        <button
          onClick={handleCreateSignature}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nouvelle signature
        </button>
      </div>

      {/* Signatures List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {signatures.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
            <PenTool className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">Aucune signature créée</p>
            <button
              onClick={handleCreateSignature}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Créer votre première signature
            </button>
          </div>
        ) : (
          signatures.map((signature) => (
            <div
              key={signature.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <PenTool className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{signature.role}</h3>
                    <p className="text-sm text-gray-500">{getTypeLabel(signature.signatureType)}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(signature.status)}`}>
                  {getStatusLabel(signature.status)}
                </span>
              </div>

              {signature.signatureImageUrl && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <img
                    src={signature.signatureImageUrl}
                    alt="Signature"
                    className="max-w-full h-20 object-contain mx-auto"
                  />
                </div>
              )}

              <div className="space-y-2 mb-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Émise le {new Date(signature.issuedAt).toLocaleDateString('fr-FR')}</span>
                </div>
                {signature.expiresAt && (
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>Expire le {new Date(signature.expiresAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {signature.signedDocuments && (
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    <span>{signature.signedDocuments.length} document(s) signé(s)</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {signature.status === 'active' && (
                  <>
                    <button
                      onClick={() => handleSignDocument(signature)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Signer un document
                    </button>
                    <button
                      onClick={() => handleRevoke(signature)}
                      className="px-3 py-2 bg-red-100 text-red-600 text-sm rounded-lg hover:bg-red-200 transition-colors"
                      title="Révoquer"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Signature Modal */}
      {showCreateModal && (
        <CreateSignatureModal
          onClose={() => {
            setShowCreateModal(false);
            setSelectedSignature(null);
          }}
          onSuccess={() => {
            loadSignatures();
            setShowCreateModal(false);
            setSelectedSignature(null);
          }}
        />
      )}

      {/* Sign Document Modal */}
      {showSignModal && selectedSignature && (
        <SignDocumentModal
          signature={selectedSignature}
          onClose={() => {
            setShowSignModal(false);
            setSelectedSignature(null);
          }}
          onSuccess={() => {
            loadSignatures();
            setShowSignModal(false);
            setSelectedSignature(null);
          }}
        />
      )}
    </div>
  );
}

// Modal de création de signature
function CreateSignatureModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    role: '',
    signatureType: 'visual' as 'visual' | 'certified' | 'combined',
    signatureImageUrl: '',
    expiresAt: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/settings/electronic-signatures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Erreur: ${error.message || 'Une erreur est survenue'}`);
      }
    } catch (error) {
      console.error('Error creating signature:', error);
      alert('Une erreur est survenue lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Nouvelle signature</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rôle *
              </label>
              <input
                type="text"
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: DIRECTEUR, CENSEUR"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de signature *
              </label>
              <select
                required
                value={formData.signatureType}
                onChange={(e) => setFormData({ ...formData, signatureType: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="visual">Visuelle</option>
                <option value="certified">Certifiée</option>
                <option value="combined">Combinée</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL de l'image de signature (optionnel)
              </label>
              <input
                type="url"
                value={formData.signatureImageUrl}
                onChange={(e) => setFormData({ ...formData, signatureImageUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'expiration (optionnel)
              </label>
              <input
                type="date"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                {submitting ? 'Création...' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Modal de signature de document
function SignDocumentModal({ signature, onClose, onSuccess }: { signature: ElectronicSignature; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    documentType: 'RECEIPT',
    documentId: '',
    documentContent: {},
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/settings/electronic-signatures/sign-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          signatureId: signature.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Document signé avec succès ! URL de vérification: ${data.verificationUrl}`);
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Erreur: ${error.message || 'Une erreur est survenue'}`);
      }
    } catch (error) {
      console.error('Error signing document:', error);
      alert('Une erreur est survenue lors de la signature');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Signer un document</h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de document *
              </label>
              <select
                required
                value={formData.documentType}
                onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="RECEIPT">Reçu</option>
                <option value="REPORT_CARD">Bulletin</option>
                <option value="CERTIFICATE">Certificat</option>
                <option value="DECISION">Décision</option>
                <option value="PV">Procès-verbal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID du document *
              </label>
              <input
                type="text"
                required
                value={formData.documentId}
                onChange={(e) => setFormData({ ...formData, documentId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ID du document à signer"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-900">Signature sécurisée</span>
              </div>
              <p className="text-sm text-blue-700">
                Cette signature sera cryptographiquement sécurisée et vérifiable publiquement via un QR code.
              </p>
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
                {submitting ? 'Signature...' : 'Signer le document'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
