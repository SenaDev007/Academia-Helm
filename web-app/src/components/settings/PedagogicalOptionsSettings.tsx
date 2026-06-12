/**
 * Pedagogical Options Settings Component
 * 
 * Interface pour activer/désactiver les options pédagogiques
 * (ex: BILINGUAL_TRACK)
 */

'use client';

import { useState } from 'react';
import { useFeature, FeatureCode } from '@/hooks/useFeature';
import { enableFeature, disableFeature, getPricingImpact } from '@/lib/features/tenant-features.service';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

export default function PedagogicalOptionsSettings() {
  const { isEnabled: isBilingualEnabled, loading, refresh } = useFeature(FeatureCode.BILINGUAL_TRACK);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pricingImpact, setPricingImpact] = useState<{ monthly: number; annual: number } | null>(null);

  const handleToggle = async () => {
    if (!isBilingualEnabled) {
      // Afficher modal de confirmation avec impact pricing
      const impact = await getPricingImpact();
      setPricingImpact(impact);
      setShowConfirmModal(true);
    } else {
      // Désactiver avec confirmation
      if (confirm('Êtes-vous sûr de vouloir désactiver l\'option bilingue ?\n\nLes données EN existantes seront conservées mais masquées.')) {
        await handleDisable();
      }
    }
  };

  const handleEnable = async () => {
    setIsProcessing(true);
    try {
      const result = await enableFeature(FeatureCode.BILINGUAL_TRACK, 'Activation depuis les paramètres');
      
      alert(
        `Option bilingue activée avec succès.\n\n` +
        `Impact sur la tarification :\n` +
        `• +${result.pricingImpact.monthly.toLocaleString()} FCFA/mois\n` +
        `• +${result.pricingImpact.annual.toLocaleString()} FCFA/an`
      );
      
      refresh();
      setShowConfirmModal(false);
      setPricingImpact(null);
    } catch (error) {
      console.error('Error enabling feature:', error);
      alert('Erreur lors de l\'activation de l\'option bilingue');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisable = async () => {
    setIsProcessing(true);
    try {
      const result = await disableFeature(FeatureCode.BILINGUAL_TRACK, 'Désactivation depuis les paramètres');
      
      alert(
        `Option bilingue désactivée.\n\n` +
        `Réduction sur la tarification :\n` +
        `• ${result.pricingImpact.monthly.toLocaleString()} FCFA/mois\n` +
        `• ${result.pricingImpact.annual.toLocaleString()} FCFA/an\n\n` +
        `Les données EN existantes sont conservées mais masquées.`
      );
      
      refresh();
    } catch (error) {
      console.error('Error disabling feature:', error);
      alert('Erreur lors de la désactivation de l\'option bilingue');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Options pédagogiques</h2>
        <p className="text-gray-600">
          Gérez les fonctionnalités pédagogiques optionnelles de votre établissement.
        </p>
      </div>

      {/* Option Bilingue */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                id="bilingual-track"
                checked={isBilingualEnabled}
                onChange={handleToggle}
                disabled={loading || isProcessing}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="bilingual-track" className="text-lg font-semibold text-gray-900 cursor-pointer">
                Enseignement bilingue (Francophone / Anglophone)
              </label>
            </div>
            
            <p className="text-sm text-gray-600 ml-8 mb-4">
              Activez cette option pour gérer des classes, matières, examens et bulletins
              en français ET en anglais. Les élèves peuvent être associés aux deux tracks.
            </p>

            {isBilingualEnabled && (
              <div className="ml-8 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Impact sur la tarification :
                </p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• +15 000 FCFA/mois</li>
                  <li>• +150 000 FCFA/an</li>
                </ul>
              </div>
            )}

            {!isBilingualEnabled && (
              <div className="ml-8 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-900">
                  <strong>Note :</strong> Cette option impacte la tarification et la structure pédagogique.
                  Une confirmation sera requise avant activation.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Confirmation */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Activer l'option bilingue ?
            </h3>
            
            <div className="space-y-4 mb-6">
              <p className="text-gray-700">
                Cette option vous permettra de gérer des classes, matières, examens et bulletins
                en français ET en anglais.
              </p>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Impact sur la tarification :
                </p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• +15 000 FCFA/mois</li>
                  <li>• +150 000 FCFA/an</li>
                </ul>
              </div>

              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-900">
                  <strong>Important :</strong> Le prix de votre abonnement sera recalculé
                  et appliqué dès la prochaine facturation.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setPricingImpact(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                disabled={isProcessing}
              >
                Annuler
              </button>
              <button
                onClick={handleEnable}
                disabled={isProcessing}
                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <AppIcon name="view" size="action" className="animate-spin" />
                    Activation...
                  </>
                ) : (
                  'Activer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

