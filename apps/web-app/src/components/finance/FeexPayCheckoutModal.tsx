'use client';

/**
 * ============================================================================
 * FEEXPAY CHECKOUT MODAL — Widget personnalisé style Fedapay
 * ============================================================================
 *
 * FeexPay ne fournit pas de widget officiel (uniquement API push USSD).
 * Ce composant reproduit l'UX du widget Fedapay :
 *   - Modal overlay professionnel
 *   - Choix opérateur Mobile Money (MTN / Moov / Celtiis)
 *   - Saisie du numéro de téléphone du client
 *   - Validation → appel backend /api/finance/payments/feexpay/initiate
 *   - Le client reçoit un push USSD sur son téléphone pour confirmer
 *
 * Spécificités FeexPay :
 *   - Téléphone obligatoire (format 229XXXXXXXXX ou 0XXXXXXXX)
 *   - Auto-détection de l'opérateur depuis le numéro (peut être surchargé)
 *   - Statut pollé après initiation (PENDING → SUCCESSFUL/FAILED)
 *
 * API backend utilisée :
 *   POST /api/finance/payments/feexpay/initiate
 *     body: { studentAccountId, studentName, amount, phone, operator, academicYearId }
 *     response: { success, reference, status, message }
 * ============================================================================
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Loader2, Smartphone, CheckCircle2, AlertCircle, Phone, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { FeexPayService } from '../../../../../api-server/src/finance/feexpay.service';

type Operator = 'mtn' | 'moov' | 'celtiis_bj';

interface FeexPayCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (reference: string) => void;
  /** Données de la transaction */
  data: {
    studentAccountId: string;
    studentName: string;
    amount: number;
    academicYearId: string;
    /** Téléphone pré-rempli depuis la fiche parent (optionnel) */
    prefillPhone?: string;
  };
}

const OPERATOR_META: Record<
  Operator,
  { label: string; color: string; bg: string; border: string; ring: string; logo: string }
> = {
  mtn: {
    label: 'MTN Mobile Money',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    ring: 'ring-yellow-400',
    logo: '🟡',
  },
  moov: {
    label: 'Moov Money',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    ring: 'ring-blue-400',
    logo: '🔵',
  },
  celtiis_bj: {
    label: 'Celtiis Cash',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    ring: 'ring-orange-400',
    logo: '🟠',
  },
};

export default function FeexPayCheckoutModal({
  open,
  onClose,
  onSuccess,
  data,
}: FeexPayCheckoutModalProps) {
  const { toast } = useToast();
  const [phone, setPhone] = useState(data.prefillPhone ?? '');
  const [operator, setOperator] = useState<Operator>('mtn');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'pending' | 'success' | 'error'>('form');
  const [reference, setReference] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setPhone(data.prefillPhone ?? '');
      setOperator('mtn');
      setStep('form');
      setReference(null);
      setErrorMessage(null);
      setPollCount(0);
    }
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [open, data.prefillPhone]);

  // Auto-detect operator from phone number
  const detectedOperator = useMemo(() => {
    if (phone.replace(/\D/g, '').length < 5) return null;
    return FeexPayService.detectOperator(phone);
  }, [phone]);

  // Update operator if detected and user hasn't manually chosen
  useEffect(() => {
    if (detectedOperator && detectedOperator !== operator) {
      setOperator(detectedOperator);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedOperator]);

  if (!open) return null;

  const formatPhoneForDisplay = (value: string) => {
    // Format : 01 95 72 22 34
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8, 10)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPhone = phone.replace(/\D/g, '');

    // Validation : formats acceptés 0XXXXXXXX (10), 229XXXXXXXXX (13), +229XXXXXXXXX (14)
    const isValid = /^(01\d{8}|22901\d{8}|\+?22901\d{8})$/.test(
      phone.replace(/[\s\-()+]/g, ''),
    );
    if (!isValid) {
      setErrorMessage('Numéro invalide. Format attendu : 01 95 72 22 34 ou +229 01 95 72 22 34.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/finance/payments/feexpay/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          studentAccountId: data.studentAccountId,
          studentName: data.studentName,
          amount: data.amount,
          phone: cleanedPhone,
          operator,
          academicYearId: data.academicYearId,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setReference(result.reference);
        setStep('pending');
        toast({
          title: '📱 Paiement initié',
          description: `Le parent va recevoir une notification sur le ${formatPhoneForDisplay(cleanedPhone)} pour confirmer.`,
        });
        // Start polling (optional — FeexPay webhook will handle the actual confirmation)
        // We poll once after 30 seconds to update UI, but the webhook is the source of truth
        pollTimerRef.current = setTimeout(() => {
          setPollCount(1);
        }, 30000);
      } else {
        setErrorMessage(result.message || "Échec de l'initiation du paiement.");
        setStep('error');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur réseau');
      setStep('error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmSuccess = () => {
    if (reference) {
      onSuccess(reference);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Paiement FeexPay</h3>
              <p className="text-xs text-slate-500">Mobile Money — Bénin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Récap transaction */}
          <div className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-200">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
              Bénéficiaire
            </p>
            <p className="font-semibold text-slate-900 mb-3">{data.studentName}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
              Montant à payer
            </p>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(data.amount)} <span className="text-sm text-slate-500">FCFA</span>
            </p>
          </div>

          {/* Step: form */}
          {step === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Téléphone */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Numéro Mobile Money
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="tel"
                    value={formatPhoneForDisplay(phone)}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01 95 72 22 34"
                    className="pl-10 text-lg font-medium tracking-wide"
                    autoFocus
                    required
                  />
                </div>
                {detectedOperator && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Opérateur détecté :{' '}
                    <span className="font-semibold text-slate-700">
                      {OPERATOR_META[detectedOperator].label}
                    </span>
                  </p>
                )}
              </div>

              {/* Sélecteur opérateur */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Opérateur
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(OPERATOR_META) as Operator[]).map((op) => {
                    const meta = OPERATOR_META[op];
                    const isSelected = operator === op;
                    return (
                      <button
                        key={op}
                        type="button"
                        onClick={() => setOperator(op)}
                        className={`relative px-2 py-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                          isSelected
                            ? `${meta.bg} ${meta.border} ${meta.color} ring-2 ${meta.ring} ring-offset-1`
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-2xl">{meta.logo}</span>
                        <span className="text-xs font-semibold">{op === 'celtiis_bj' ? 'Celtiis' : op.charAt(0).toUpperCase() + op.slice(1)}</span>
                        {isSelected && (
                          <CheckCircle2 className="absolute -top-1 -right-1 w-4 h-4 text-emerald-500 bg-white rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  Une notification sera envoyée sur le numéro indiqué. Le parent devra
                  confirmer le paiement en saisissant son code PIN Mobile Money.
                </p>
              </div>

              {/* Error */}
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">{errorMessage}</p>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md h-12 text-base font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Initialisation…
                  </>
                ) : (
                  <>
                    Payer {formatCurrency(data.amount)} FCFA
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              <p className="text-[11px] text-center text-slate-400">
                Transaction sécurisée par FeexPay · API v2
              </p>
            </form>
          )}

          {/* Step: pending (push USSD envoyé, en attente de confirmation) */}
          {step === 'pending' && (
            <div className="text-center py-6 space-y-4">
              <div className="relative inline-block">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Smartphone className="w-10 h-10 text-emerald-600 animate-pulse" />
                </div>
                <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center animate-ping" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-lg">En attente de confirmation</h4>
                <p className="text-sm text-slate-600 mt-1">
                  Une notification a été envoyée sur le téléphone du parent. Il doit
                  saisir son code PIN Mobile Money pour confirmer le paiement.
                </p>
              </div>
              {reference && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs text-slate-500">Référence FeexPay</p>
                  <p className="font-mono text-sm text-slate-800">{reference}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setStep('form');
                    setReference(null);
                  }}
                >
                  Annuler
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleConfirmSuccess}
                >
                  J'ai confirmé
                </Button>
              </div>
              <p className="text-[11px] text-slate-400">
                La transaction sera vérifiée automatiquement par notre système après confirmation.
              </p>
            </div>
          )}

          {/* Step: error */}
          {step === 'error' && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-lg">Paiement échoué</h4>
                <p className="text-sm text-slate-600 mt-1">
                  {errorMessage || 'Une erreur est survenue.'}
                </p>
              </div>
              <Button
                className="w-full bg-slate-800 hover:bg-slate-900 text-white"
                onClick={() => setStep('form')}
              >
                Réessayer
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
