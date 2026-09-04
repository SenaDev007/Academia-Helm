'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, X, Calendar, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { financeService } from '@/services/finance.service';

interface PromoterEligibilityModalProps {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  academicYearId: string;
  onSuccess?: () => void;
}

/**
 * Modal de justification pour marquer un élève comme "paiement direct au fondateur".
 *
 * Quand le caissier/secrétaire active le toggle sur la ligne d'un élève, ce modal
 * s'affiche pour saisir le motif (obligatoire) et optionnellement la date d'échéance
 * prévue.
 *
 * Après validation :
 * - L'élève est "déclassifié" de la liste standard des encaissements
 * - Il apparaît dans le sous-onglet "Reçu par le fondateur"
 */
export default function PromoterEligibilityModal({
  open,
  onClose,
  studentId,
  studentName,
  academicYearId,
  onSuccess,
}: PromoterEligibilityModalProps) {
  const [motif, setMotif] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setMotif('');
      setExpectedDate('');
    }
  }, [open, studentId]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!motif.trim()) {
      toast({
        title: 'Motif obligatoire',
        description: 'Veuillez saisir le motif justifiant le paiement direct au fondateur.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await financeService.activatePromoterEligibility({
        studentId,
        academicYearId,
        motif: motif.trim(),
        expectedDate: expectedDate || undefined,
      });

      toast({
        title: '✅ Élève marqué',
        description: `${studentName} sera exclu des encaissements standard et apparaîtra dans "Reçu par le fondateur".`,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.message || 'Échec de l\'activation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Paiement au fondateur</h2>
              <p className="text-sm text-white/80">{studentName}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <p>
              Cet élève sera <strong>exclu de la liste standard</strong> des encaissements
              et apparaîtra dans un sous-onglet dédié <strong>"Reçu par le fondateur"</strong>.
            </p>
          </div>

          <div>
            <Label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 text-amber-600" />
              Motif <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex: Parent ami du fondateur, arrangement particulier, paiement direct convenu..."
              rows={3}
              className="resize-none"
              autoFocus
            />
          </div>

          <div>
            <Label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              Date d'échéance prévue <span className="text-gray-400 text-xs">(optionnel)</span>
            </Label>
            <Input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !motif.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Activation...
              </>
            ) : (
              <>
                <Crown className="w-4 h-4 mr-2" />
                Confirmer
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
