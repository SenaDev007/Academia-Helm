'use client';

import { useState, useEffect } from 'react';
import { Crown, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { financeService } from '@/services/finance.service';
import PromoterEligibilityModal from './PromoterEligibilityModal';

interface PromoterEligibilityToggleProps {
  studentId: string;
  studentName: string;
  academicYearId: string;
  initialIsActive?: boolean;
  onChange?: (isActive: boolean) => void;
}

/**
 * Toggle pour marquer un élève comme "paiement direct au fondateur".
 *
 * Comportement :
 * - Si INACTIF → clic ouvre le modal de motif (obligatoire)
 * - Si ACTIF → clic désactive directement (avec confirmation toast)
 *
 * Quand le toggle est activé :
 * - L'élève est exclu du sous-onglet "Encaissements standard"
 * - Il apparaît dans le sous-onglet "Reçu par le fondateur"
 */
export default function PromoterEligibilityToggle({
  studentId,
  studentName,
  academicYearId,
  initialIsActive = false,
  onChange,
}: PromoterEligibilityToggleProps) {
  const [isActive, setIsActive] = useState(initialIsActive);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsActive(initialIsActive);
  }, [initialIsActive]);

  const handleToggle = async () => {
    if (!academicYearId) {
      toast({
        title: 'Année scolaire requise',
        description: 'Veuillez sélectionner une année scolaire.',
        variant: 'destructive',
      });
      return;
    }

    if (!isActive) {
      // Activer → ouvrir le modal de motif
      setModalOpen(true);
      return;
    }

    // Désactiver → confirmation directe
    setLoading(true);
    try {
      await financeService.deactivatePromoterEligibility(studentId, academicYearId);
      setIsActive(false);
      onChange?.(false);
      toast({
        title: '✅ Toggle désactivé',
        description: `${studentName} revient dans la liste standard des encaissements.`,
      });
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.message || 'Échec de la désactivation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleToggle}
        disabled={loading}
        title={isActive
          ? 'Élève marqué "paiement fondateur" — cliquer pour désactiver'
          : 'Marquer cet élève pour paiement direct au fondateur'
        }
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          isActive
            ? 'bg-amber-500'
            : 'bg-gray-300 hover:bg-gray-400'
        } ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
      >
        {loading && <Loader2 className="w-3 h-3 absolute left-1 animate-spin text-white" />}
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isActive ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        >
          {isActive && (
            <Crown className="w-3 h-3 text-amber-600 absolute inset-0 m-auto" />
          )}
        </span>
      </button>

      <PromoterEligibilityModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        studentId={studentId}
        studentName={studentName}
        academicYearId={academicYearId}
        onSuccess={() => {
          setIsActive(true);
          onChange?.(true);
        }}
      />
    </>
  );
}
