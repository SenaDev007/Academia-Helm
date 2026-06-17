/**
 * ============================================================================
 * STUDENT MATRICULES SECTION - MODULE 1
 * ============================================================================
 * 
 * Composant pour la gestion des matricules globaux uniques
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  CreditCard,
  Search,
  Plus,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Users
} from 'lucide-react';
import { studentsService } from '@/services/students.service';
import { toast } from '@/components/ui/toast';
import { useModuleContext } from '@/hooks/useModuleContext';

interface MatriculeStats {
  total: number;
  offlineGenerated: number;
  synchronized: number;
  definitive: number;
  byYear: Record<number, number>;
  pendingSynchronization: number;
}

export default function StudentMatriculesSection() {
  const confirmDialog = useConfirmDialog();
  const { academicYear, schoolLevel } = useModuleContext();
  const [stats, setStats] = useState<MatriculeStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchMatricule, setSearchMatricule] = useState('');
  const [selectedStudent] = useState<string | null>(null);

  // Charger les statistiques — recharger quand l'année ou le niveau change
  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id, schoolLevel?.id]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      const data = await studentsService.getMatriculeStats();
      setStats(data);
    } catch (error: any) {
      console.error('Error loading stats:', error);
      toast({ title: 'Erreur', description: error.message || 'Impossible de charger les statistiques des matricules', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateMatricule = async (studentId: string) => {
    try {
      setIsLoading(true);
      const data = await studentsService.generateMatricule(studentId);
      toast({ title: 'Succès', description: `Matricule généré avec succès: ${data.globalMatricule}`, variant: 'success' });
      loadStats();
    } catch (error: any) {
      console.error('Error generating matricule:', error);
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de la génération du matricule', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateBulk = async () => {
    const ok = await confirmDialog.info('Des matricules seront générés pour tous les élèves sans matricule. Voulez-vous continuer ?', 'Générer les matricules');
    if (!ok) {
      return;
    }

    try {
      setIsLoading(true);
      // Récupérer l'année scolaire et le niveau depuis le contexte React
      // (au lieu de lire localStorage avec de mauvaises clés)
      const academicYearId = academicYear?.id || '';
      const schoolLevelId = schoolLevel?.id || '';

      if (!academicYearId) {
        toast({ title: 'Erreur', description: 'Aucune année scolaire sélectionnée. Veuillez sélectionner une année dans le header.', variant: 'error' });
        return;
      }

      const data = await studentsService.generateBulkMatricules({
        academicYearId,
        schoolLevelId,
        status: 'ACTIVE',
      });

      toast({ title: 'Succès', description: `${data.succeeded} matricule(s) généré(s) avec succès sur ${data.total}`, variant: 'success' });
      loadStats();
    } catch (error: any) {
      console.error('Error generating bulk matricules:', error);
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de la génération en lot', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchByMatricule = async () => {
    if (!searchMatricule.trim()) {
      toast({ title: 'Attention', description: 'Veuillez saisir un matricule', variant: 'error' });
      return;
    }

    try {
      setIsLoading(true);
      const student = await studentsService.searchByMatricule(searchMatricule);
      toast({ title: 'Succès', description: `Élève trouvé: ${student.firstName} ${student.lastName}`, variant: 'success' });
      setSearchMatricule('');
    } catch (error: any) {
      console.error('Error searching matricule:', error);
      toast({ title: 'Erreur', description: error.message || 'Matricule non trouvé', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
    {confirmDialog.dialog}
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
                <p className="text-sm text-gray-600">Définitifs</p>
                <p className="text-2xl font-bold text-green-600">{stats.definitive}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Temporaires</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.offlineGenerated}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">À synchroniser</p>
                <p className="text-2xl font-bold text-red-600">{stats.pendingSynchronization}</p>
              </div>
              <RefreshCw className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>
        
        <div className="space-y-4">
          {/* Recherche par matricule */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Rechercher un élève par matricule (ex: AH-BJ-0123-2024-00457)"
              value={searchMatricule}
              onChange={(e) => setSearchMatricule(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleSearchByMatricule()}
            />
            <button
              onClick={handleSearchByMatricule}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              Rechercher
            </button>
          </div>

          {/* Génération en lot */}
          <div>
            <button
              onClick={handleGenerateBulk}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Users className="h-4 w-4" />
              Générer les matricules pour tous les élèves sans matricule
            </button>
          </div>

          {/* Génération individuelle */}
          {selectedStudent && (
            <div>
              <button
                onClick={() => handleGenerateMatricule(selectedStudent)}
                disabled={isLoading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Générer le matricule pour l'élève sélectionné
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Statistiques par année */}
      {stats && stats.byYear && Object.keys(stats.byYear).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Répartition par année</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.byYear).map(([year, count]) => (
              <div key={year} className="bg-gray-50 rounded-md p-3">
                <p className="text-sm text-gray-600">Année {year}</p>
                <p className="text-xl font-bold text-gray-900">{count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      )}
    </div>
    </>
  );
}

