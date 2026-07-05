'use client';

/**
 * ============================================================================
 * FEEXPAY CHECKOUT MODAL — Widget personnalisé (layout paysage, palette FeexPay)
 * ============================================================================
 *
 * FeexPay ne fournit pas de widget officiel — ce composant reproduit l'UX
 * d'un checkout professionnel avec la charte graphique FeexPay :
 *   - Layout paysage (2 colonnes : récap transaction à gauche, formulaire à droite)
 *   - Palette FeexPay : orange #F79E1B, jaune #FFCB05, noir #1A1A1A
 *   - Logo FeexPay en header
 *   - Logos opérateurs (MTN, Moov, Celtiis) dans le sélecteur
 *
 * Spécificités FeexPay :
 *   - Téléphone obligatoire (format 229XXXXXXXXX ou 0XXXXXXXX)
 *   - Auto-détection de l'opérateur depuis le numéro
 *   - Push USSD envoyé au téléphone du client pour confirmation
 *
 * API backend utilisée :
 *   POST /api/finance/payments/feexpay/initiate
 *     body: { studentAccountId, studentName, amount, phone, operator, academicYearId }
 * ============================================================================
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X, Loader2, Smartphone, CheckCircle2, AlertCircle, Phone, ArrowRight,
  Shield, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  detectFeexPayOperator,
  isValidBeninPhone,
  formatPhoneDisplay,
  type FeexPayOperator,
} from '@/lib/feexpay/detect-operator';
import FeexPayLogo from '/public/logos/feexpay.png';
import MtnLogo from '/public/logos/mtn.png';
import MoovLogo from '/public/logos/moov.png';
import CeltiisLogo from '/public/logos/celtiis.png';

type Operator = FeexPayOperator;

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
  {
    label: string;
    shortLabel: string;
    color: string;
    bg: string;
    border: string;
    ring: string;
    logo: string;
  }
> = {
  mtn: {
    label: 'MTN Mobile Money',
    shortLabel: 'MTN',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    ring: 'ring-yellow-400',
    logo: MtnLogo.src,
  },
  moov: {
    label: 'Moov Money',
    shortLabel: 'Moov',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    ring: 'ring-blue-400',
    logo: MoovLogo.src,
  },
  celtiis_bj: {
    label: 'Celtiis Cash',
    shortLabel: 'Celtiis',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    ring: 'ring-orange-400',
    logo: CeltiisLogo.src,
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
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setPhone(data.prefillPhone ?? '');
      setOperator('mtn');
      setStep('form');
      setReference(null);
      setErrorMessage(null);
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
    return detectFeexPayOperator(phone);
  }, [phone]);

  // Update operator if detected and user hasn't manually chosen
  useEffect(() => {
    if (detectedOperator && detectedOperator !== operator) {
      setOperator(detectedOperator);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedOperator]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPhone = phone.replace(/\D/g, '');

    // Validation via utilitaire frontend (formats béninois)
    if (!isValidBeninPhone(phone)) {
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
          description: `Le parent va recevoir une notification sur le ${formatPhoneDisplay(cleanedPhone)} pour confirmer.`,
        });
        pollTimerRef.current = setTimeout(() => {
          // Just keep UI in pending state — webhook is source of truth
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden"
        style={{ maxHeight: '95vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ───────────────── HEADER — Bande FeexPay (orange/jaune) ───────────────── */}
        <header className="relative bg-gradient-to-r from-[#F79E1B] via-[#FFCB05] to-[#F79E1B] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo FeexPay */}
            <div className="bg-white rounded-lg px-3 py-1.5 shadow-sm flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={FeexPayLogo.src}
                alt="FeexPay"
                className="h-7 w-auto object-contain"
              />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1A1A1A] leading-tight">
                Paiement Mobile Money
              </h2>
              <p className="text-xs text-[#1A1A1A]/70">
                Transaction sécurisée par FeexPay · Bénin
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-black/10 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-[#1A1A1A]" />
          </button>
        </header>

        {/* ───────────────── BODY — Layout paysage 2 colonnes ───────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] min-h-[500px]">
          {/* ===== Colonne gauche : Récapitulatif transaction ===== */}
          <aside className="bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D] text-white p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-[#FFCB05]" />
              <p className="text-xs uppercase tracking-wider text-[#FFCB05] font-semibold">
                Récapitulatif
              </p>
            </div>
            <p className="text-sm text-white/60 mb-6">
              Vérifiez les détails avant de confirmer
            </p>

            {/* Bénéficiaire */}
            <div className="mb-5">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">
                Bénéficiaire
              </p>
              <p className="text-base font-semibold leading-tight">{data.studentName}</p>
            </div>

            {/* Montant */}
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">
                Montant à payer
              </p>
              <p className="text-4xl font-bold text-[#FFCB05] leading-none">
                {data.amount.toLocaleString('fr-FR')}
                <span className="text-lg font-medium text-white/60 ml-2">FCFA</span>
              </p>
              <p className="text-xs text-white/40 mt-1.5">
                ≈ {(data.amount / 655.957).toFixed(2)} EUR
              </p>
            </div>

            {/* Opérateur sélectionné */}
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-2">
                Opérateur sélectionné
              </p>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={OPERATOR_META[operator].logo}
                  alt={OPERATOR_META[operator].label}
                  className="h-10 w-10 object-contain rounded bg-white p-1"
                />
                <div>
                  <p className="text-sm font-semibold">{OPERATOR_META[operator].label}</p>
                  {detectedOperator && (
                    <p className="text-[11px] text-[#FFCB05] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Détecté automatiquement
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Sécurité */}
            <div className="mt-auto pt-4 border-t border-white/10">
              <div className="flex items-start gap-2 text-xs text-white/60">
                <Lock className="w-3.5 h-3.5 text-[#FFCB05] flex-shrink-0 mt-0.5" />
                <p>
                  Paiement chiffré SSL. Vos informations bancaires ne sont jamais
                  stockées. FeexPay est agrégateur agréé par la BCEAO.
                </p>
              </div>
            </div>
          </aside>

          {/* ===== Colonne droite : Formulaire / États ===== */}
          <section className="p-6 overflow-y-auto" style={{ maxHeight: '95vh' }}>
            {/* Step: form */}
            {step === 'form' && (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h3 className="font-bold text-slate-900 text-base mb-1">
                    Coordonnées de paiement
                  </h3>
                  <p className="text-xs text-slate-500">
                    Le client recevra une notification sur son téléphone pour confirmer.
                  </p>
                </div>

                {/* Téléphone */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Numéro Mobile Money
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                    <Input
                      type="tel"
                      value={formatPhoneDisplay(phone)}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex : 01 54 12 34 56"
                      className="pl-10 text-base font-medium tracking-wide h-12"
                      autoFocus
                      required
                    />
                  </div>
                  {detectedOperator && (
                    <p className="text-xs text-emerald-700 flex items-center gap-1.5 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Opérateur détecté :{' '}
                      <span className="font-semibold">{OPERATOR_META[detectedOperator].label}</span>
                    </p>
                  )}
                </div>

                {/* Sélecteur opérateur */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    Ou choisissez manuellement
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
                          className={`relative px-2 py-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                            isSelected
                              ? `${meta.bg} ${meta.border} ring-2 ${meta.ring} ring-offset-1`
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={meta.logo}
                            alt={meta.label}
                            className="h-8 w-8 object-contain"
                          />
                          <span className={`text-xs font-semibold ${isSelected ? meta.color : 'text-slate-600'}`}>
                            {meta.shortLabel}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="absolute -top-1.5 -right-1.5 w-5 h-5 text-emerald-500 bg-white rounded-full border border-emerald-200" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Info */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Une notification sera envoyée sur le numéro indiqué. Le client devra
                    saisir son code PIN Mobile Money pour confirmer le paiement.
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
                  className="w-full bg-gradient-to-r from-[#F79E1B] to-[#FFCB05] hover:from-[#E68A0E] hover:to-[#F0BE04] text-[#1A1A1A] font-bold shadow-md h-12 text-base"
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

                <p className="text-[11px] text-center text-slate-400 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" />
                  Transaction sécurisée · FeexPay API v2
                </p>
              </form>
            )}

            {/* Step: pending */}
            {step === 'pending' && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8 space-y-5">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center">
                    <Smartphone className="w-12 h-12 text-[#F79E1B] animate-pulse" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-[#FFCB05] flex items-center justify-center animate-ping" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-xl">En attente de confirmation</h4>
                  <p className="text-sm text-slate-600 max-w-xs">
                    Une notification a été envoyée sur le téléphone du client. Il doit
                    saisir son code PIN Mobile Money pour confirmer.
                  </p>
                </div>
                {reference && (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 w-full max-w-xs">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      Référence FeexPay
                    </p>
                    <p className="font-mono text-sm text-slate-800 break-all">{reference}</p>
                  </div>
                )}
                <div className="flex gap-2 w-full max-w-xs">
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
                    className="flex-1 bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white"
                    onClick={handleConfirmSuccess}
                  >
                    J'ai confirmé
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  La transaction sera vérifiée automatiquement par notre système après confirmation.
                </p>
              </div>
            )}

            {/* Step: error */}
            {step === 'error' && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8 space-y-5">
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900 text-xl">Paiement échoué</h4>
                  <p className="text-sm text-slate-600 max-w-xs">
                    {errorMessage || 'Une erreur est survenue.'}
                  </p>
                </div>
                <Button
                  className="w-full max-w-xs bg-[#1A1A1A] hover:bg-[#2D2D2D] text-white"
                  onClick={() => setStep('form')}
                >
                  Réessayer
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
