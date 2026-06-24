'use client';

/**
 * ============================================================================
 * SCHOOL FEE PAYMENT DIALOG — Dialog de paiement des frais scolaires
 * ============================================================================
 *
 * Dialog avec toggle Espèces / Mobile Money.
 *   - Espèces : toujours disponible, crée un Payment status=completed
 *   - Mobile Money : disponible uniquement si FeexPay est configuré.
 *     Initie un paiement FeexPay (payin) → parent reçoit notification.
 *
 * Appelle feexPayService.payCash() ou feexPayService.payMobile().
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Banknote,
  Smartphone,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Wallet,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import {
  feexPayService,
  type FeexPayConfig,
} from '@/services/feexpay.service';

const OPERATORS = [
  { value: 'MTN', label: 'MTN MoMo' },
  { value: 'MOOV', label: 'Moov Money' },
  { value: 'CELTIIS', label: 'Celtiis Cash' },
  { value: 'CORIS', label: 'Coris Money' },
];

const FEE_TYPES = [
  { value: 'INSCRIPTION', label: 'Inscription' },
  { value: 'SCOLARITE', label: 'Scolarité' },
  { value: 'ACTIVITY', label: 'Activité' },
  { value: 'OTHER', label: 'Autre' },
];

export interface SchoolFeePaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** Élève présélectionné (optionnel) */
  student?: {
    id: string;
    name: string;
    schoolLevelId?: string;
  };
  /** Liste des élèves (si student non présélectionné) */
  students?: Array<{
    id: string;
    name: string;
    schoolLevelId?: string;
  }>;
  academicYearId?: string;
  /** Ouvrir la config FeexPay (depuis le parent) */
  onConfigureFeexPay?: () => void;
}

type PaymentMethod = 'CASH' | 'MOBILE_MONEY';

export function SchoolFeePaymentDialog({
  isOpen,
  onClose,
  onSuccess,
  student,
  students,
  academicYearId,
  onConfigureFeexPay,
}: SchoolFeePaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [feexPayConfig, setFeexPayConfig] = useState<FeexPayConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [selectedStudentId, setSelectedStudentId] = useState(student?.id || '');
  const [amount, setAmount] = useState('');
  const [feeType, setFeeType] = useState('SCOLARITE');
  const [description, setDescription] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [operator, setOperator] = useState('MTN');
  const [payerFirstName, setPayerFirstName] = useState('');
  const [payerLastName, setPayerLastName] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadFeexPayConfig();
      if (student) setSelectedStudentId(student.id);
    }
  }, [isOpen, student]);

  const loadFeexPayConfig = async () => {
    try {
      setLoadingConfig(true);
      const cfg = await feexPayService.getConfig();
      setFeexPayConfig(cfg);
    } catch {
      setFeexPayConfig(null);
    } finally {
      setLoadingConfig(false);
    }
  };

  const feexPayReady = feexPayConfig?.configured && feexPayConfig?.hasApiKey;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast({ variant: 'error', title: 'Montant invalide' });
      return;
    }

    if (!selectedStudentId) {
      toast({ variant: 'error', title: 'Élève requis' });
      return;
    }

    const selectedStudent = student || students?.find((s) => s.id === selectedStudentId);
    if (!selectedStudent?.schoolLevelId) {
      toast({ variant: 'error', title: 'Niveau scolaire manquant', description: 'Cet élève n\'a pas de niveau scolaire assigné.' });
      return;
    }

    if (method === 'MOBILE_MONEY') {
      if (!feexPayReady) {
        toast({
          variant: 'error',
          title: 'FeexPay non configuré',
          description: 'Configurez FeexPay dans Paramètres > Paiements avant d\'accepter Mobile Money.',
        });
        return;
      }
      if (!phoneNumber.trim()) {
        toast({ variant: 'error', title: 'Numéro Mobile Money requis' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const basePayload = {
        studentId: selectedStudentId,
        amount: amountNum,
        feeType,
        academicYearId,
        schoolLevelId: selectedStudent.schoolLevelId,
        description: description.trim() || `${FEE_TYPES.find((f) => f.value === feeType)?.label || 'Frais'} — ${selectedStudent.name}`,
      };

      const result =
        method === 'CASH'
          ? await feexPayService.payCash(basePayload)
          : await feexPayService.payMobile({
              ...basePayload,
              phoneNumber: phoneNumber.trim(),
              operator,
              payerFirstName: payerFirstName.trim() || undefined,
              payerLastName: payerLastName.trim() || undefined,
            });

      if (result.success) {
        toast({
          variant: 'success',
          title: method === 'CASH' ? 'Paiement enregistré' : 'Paiement initié',
          description:
            method === 'CASH'
              ? `Paiement de ${formatCurrency(amountNum)} enregistré.`
              : `Le parent va recevoir une notification Mobile Money pour confirmer le paiement de ${formatCurrency(amountNum)}.`,
        });
        onSuccess?.();
        onClose();
        // Reset form
        setAmount('');
        setDescription('');
        setPhoneNumber('');
        setPayerFirstName('');
        setPayerLastName('');
      } else {
        toast({
          variant: 'error',
          title: 'Échec du paiement',
          description: result.message || 'Erreur inconnue',
        });
      }
    } catch (err: any) {
      toast({
        variant: 'error',
        title: 'Erreur',
        description: err?.message || 'Impossible d\'initier le paiement',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-blue-100 overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-5 text-white relative" style={{ background: 'linear-gradient(135deg, #0D1F6E 0%, #1A2BA6 100%)' }}>
          <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white">
            <X size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Encaisser les frais</h3>
              <p className="text-white/70 text-xs mt-0.5">Paiement frais scolaires</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Method toggle */}
          <div>
            <Label>Mode de paiement</Label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <button
                type="button"
                onClick={() => setMethod('CASH')}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  method === 'CASH'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  method === 'CASH' ? 'bg-emerald-100' : 'bg-slate-100'
                }`}>
                  <Banknote className={`h-5 w-5 ${method === 'CASH' ? 'text-emerald-600' : 'text-slate-400'}`} />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-bold ${method === 'CASH' ? 'text-emerald-900' : 'text-slate-600'}`}>
                    Espèces
                  </p>
                  <p className="text-[10px] text-slate-500">Toujours disponible</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMethod('MOBILE_MONEY')}
                disabled={!feexPayReady && !loadingConfig}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  method === 'MOBILE_MONEY'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  method === 'MOBILE_MONEY' ? 'bg-blue-100' : 'bg-slate-100'
                }`}>
                  <Smartphone className={`h-5 w-5 ${method === 'MOBILE_MONEY' ? 'text-blue-600' : 'text-slate-400'}`} />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-bold ${method === 'MOBILE_MONEY' ? 'text-blue-900' : 'text-slate-600'}`}>
                    Mobile Money
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {loadingConfig ? 'Vérification...' : feexPayReady ? 'MTN, Moov, Celtiis' : 'Non configuré'}
                  </p>
                </div>
              </button>
            </div>

            {!feexPayReady && !loadingConfig && method === 'MOBILE_MONEY' && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-amber-800">
                    FeexPay n'est pas configuré. Pour accepter les paiements Mobile Money,
                    configurez votre compte FeexPay dans les Paramètres.
                  </p>
                  {onConfigureFeexPay && (
                    <button
                      type="button"
                      onClick={onConfigureFeexPay}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900"
                    >
                      <Settings size={12} /> Configurer FeexPay
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Student selector (if not preselected) */}
          {!student && students && students.length > 0 && (
            <div>
              <Label>Élève</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un élève" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Amount */}
          <div>
            <Label>Montant (XOF)</Label>
            <Input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="50000"
            />
          </div>

          {/* Fee type */}
          <div>
            <Label>Type de frais</Label>
            <Select value={feeType} onValueChange={setFeeType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEE_TYPES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mobile Money specific fields */}
          {method === 'MOBILE_MONEY' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4 border-t border-slate-100 pt-4"
            >
              <div>
                <Label>Opérateur Mobile Money</Label>
                <Select value={operator} onValueChange={setOperator}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Numéro de téléphone du payeur</Label>
                <Input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="229XXXXXXXX"
                  required
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Le parent recevra une notification sur ce numéro pour confirmer le paiement.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prénom du payeur (optionnel)</Label>
                  <Input
                    value={payerFirstName}
                    onChange={(e) => setPayerFirstName(e.target.value)}
                    placeholder="Jean"
                  />
                </div>
                <div>
                  <Label>Nom du payeur (optionnel)</Label>
                  <Input
                    value={payerLastName}
                    onChange={(e) => setPayerLastName(e.target.value)}
                    placeholder="Dupont"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Description */}
          <div>
            <Label>Observation (optionnel)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scolarité trimestre 1"
            />
          </div>

          {/* Summary */}
          {amount && parseFloat(amount) > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Montant</span>
                <span className="font-bold text-slate-900">{formatCurrency(parseFloat(amount))}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-slate-500">Mode</span>
                <span className="font-medium text-slate-700">
                  {method === 'CASH' ? 'Espèces' : `Mobile Money (${operator})`}
                </span>
              </div>
              {method === 'MOBILE_MONEY' && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <p className="text-[11px] text-blue-600 flex items-center gap-1">
                    <AlertCircle size={11} />
                    Le parent devra confirmer le paiement sur son téléphone.
                  </p>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting || !amount || (method === 'MOBILE_MONEY' && !feexPayReady)}
            className={method === 'CASH' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin mr-2" /> Traitement...</>
            ) : method === 'CASH' ? (
              <><CheckCircle2 size={16} className="mr-2" /> Valider le paiement</>
            ) : (
              <><Smartphone size={16} className="mr-2" /> Lancer le paiement</>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
