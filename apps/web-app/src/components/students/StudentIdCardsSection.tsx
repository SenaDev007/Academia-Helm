/**
 * ============================================================================
 * STUDENT ID CARDS SECTION - MODULE 1
 * ============================================================================
 * 
 * Composant pour la gestion des cartes d'identité scolaires
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  RefreshCw,
} from 'lucide-react';
import { studentsService } from '@/services/students.service';
import { toast } from '@/components/ui/toast';

interface IdCard {
  id: string;
  cardNumber: string;
  qrPayload: string;
  qrHash: string;
  pdfPath?: string;
  generatedAt: string;
  validUntil?: string;
  isActive: boolean;
  isRevoked: boolean;
  revokedAt?: string;
  revocationReason?: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    gender?: string;
  };
  academicYear: {
    id: string;
    name: string;
    startDate: string;
    endDate?: string;
  };
  schoolLevel: {
    id: string;
    code: string;
    label: string;
  };
}

interface IdCardStats {
  total: number;
  active: number;
  revoked: number;
  expired: number;
  expiredRate: number;
}

export default function StudentIdCardsSection() {
  const [stats, setStats] = useState<IdCardStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState<IdCard | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const academicYearId = localStorage.getItem('academicYearId') || '';
      const data = await studentsService.getIdCardStats(academicYearId);
      setStats(data);
    } catch (error: any) {
      console.error('Error loading stats:', error);
      toast({ title: 'Erreur', description: error.message || 'Impossible de charger les statistiques', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateBulk = async () => {
    if (!confirm('Générer les cartes pour tous les élèves sans carte ?')) {
      return;
    }

    try {
      setIsLoading(true);
      const academicYearId = localStorage.getItem('academicYearId') || '';
      const schoolLevelId = localStorage.getItem('schoolLevelId') || '';

      if (!academicYearId || !schoolLevelId) {
        toast({ title: 'Attention', description: 'Veuillez sélectionner une année scolaire et un niveau', variant: 'error' });
        return;
      }

      const data = await studentsService.generateBulkIdCards({ academicYearId, schoolLevelId });
      toast({ title: 'Succès', description: `${data.succeeded} carte(s) générée(s) avec succès sur ${data.total}`, variant: 'success' });
      loadStats();
    } catch (error: any) {
      console.error('Error generating bulk ID cards:', error);
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de la génération en lot', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeCard = async () => {
    if (!selectedCard || !revokeReason.trim()) {
      toast({ title: 'Attention', description: 'Veuillez saisir un motif de révocation', variant: 'error' });
      return;
    }

    try {
      setIsLoading(true);
      await studentsService.revokeIdCard(selectedCard.id, revokeReason);
      toast({ title: 'Succès', description: 'Carte révoquée avec succès', variant: 'success' });
      setIsRevokeModalOpen(false);
      setSelectedCard(null);
      setRevokeReason('');
      loadStats();
    } catch (error: any) {
      console.error('Error revoking card:', error);
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de la révocation', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <CreditCard className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Actives</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Révoquées</p>
                <p className="text-2xl font-bold text-red-600">{stats.revoked}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Expirées</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.expired}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
        
        <div className="space-y-4">
          {/* Génération en lot */}
          <button
            onClick={handleGenerateBulk}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Users className="h-4 w-4" />
            Générer les cartes pour tous les élèves sans carte
          </button>
        </div>
      </div>

      {/* Modal de révocation */}
      {isRevokeModalOpen && selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Révoquer la carte {selectedCard.cardNumber}
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Élève: {selectedCard.student.firstName} {selectedCard.student.lastName}
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motif de révocation (obligatoire)
              </label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Ex: Carte perdue, carte volée, carte endommagée..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setIsRevokeModalOpen(false);
                  setSelectedCard(null);
                  setRevokeReason('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                onClick={handleRevokeCard}
                disabled={isLoading || !revokeReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Révoquer
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      )}
    </div>
  );
}

