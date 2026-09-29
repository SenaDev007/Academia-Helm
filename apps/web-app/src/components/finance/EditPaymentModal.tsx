'use client';

/**
 * ⭐ MODAL D'ÉDITION D'UN ENCAISSEMENT (sept. 2026 — PROMOTEUR uniquement).
 *
 * Accessible depuis le tableau « Historique des encaissements » de l'onglet
 * Compte élève (StudentAccountsContent) — les boutons Éditer/Supprimer ne
 * sont visibles que pour le promoteur, et le backend re-vérifie le rôle.
 *
 * Objectif : aligner les encaissements saisis sur les documents papier
 * fournis par les écoles (montant, mode, date, heure, référence, caisse).
 *
 * Côté backend (FinanceTransactionService.update), l'édition :
 *  - ré-échelonne les imputations au prorata du nouveau montant ;
 *  - ajuste les soldes du compte (totalPaid/balance) et de(s) caisse(s) ;
 *  - recalcul le hash d'intégrité (trigger verify_integrity_hash) ;
 *  - trace l'opération dans financial_audit_logs ;
 *  - régénère le reçu PDF.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Pencil, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getModalMotion } from '@/lib/motion/presets';
import { useMotionBudget } from '@/lib/motion/use-motion-budget';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  WIRE: 'Virement',
  FEDAPAY: 'Fedapay (en ligne)',
};

/** Fuseau Bénin (UTC+1) — les écoles saisissent l'heure locale. */
const BENIN_OFFSET_MS = 60 * 60 * 1000;

/** Décompose une date ISO (UTC) en date + heure murale Bénin (UTC+1). */
function toBeninParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '', time: '' };
  const shifted = new Date(d.getTime() + BENIN_OFFSET_MS);
  const isoShifted = shifted.toISOString();
  return { date: isoShifted.slice(0, 10), time: isoShifted.slice(11, 16) };
}

/** Reconstruit une date ISO absolue depuis date + heure murales Bénin. */
function fromBeninParts(date: string, time: string): string {
  const hh = time || '00:00';
  return new Date(`${date}T${hh}:00+01:00`).toISOString();
}

export default function EditPaymentModal({
  transaction,
  studentName,
  onClose,
  onSuccess,
}: {
  transaction: any;
  studentName?: string;
  onClose: () => void;
  onSuccess: (result: any) => void;
}) {
  const { shouldReduceMotion } = useMotionBudget();
  const modalMotion = getModalMotion(shouldReduceMotion);

  const isFedapay = transaction?.paymentMethod === 'FEDAPAY';

  const initialParts = transaction?.createdAt ? toBeninParts(transaction.createdAt) : { date: '', time: '' };

  const [amount, setAmount] = useState(transaction ? String(Number(transaction.amount ?? 0)) : '');
  const [paymentMethod, setPaymentMethod] = useState(transaction?.paymentMethod ?? 'CASH');
  const [datePart, setDatePart] = useState(initialParts.date);
  const [timePart, setTimePart] = useState(initialParts.time);
  const [reference, setReference] = useState(transaction?.reference ?? '');
  const [cashRegisterId, setCashRegisterId] = useState<string>(transaction?.cashRegisterId ?? '__none__');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caisses, setCaisses] = useState<any[]>([]);

  // Charger les caisses actives (pour le déplacement de l'encaissement)
  useEffect(() => {
    if (isFedapay) return; // FEDAPAY : caisse verrouillée (en ligne)
    financeService.getCashRegisters({ isActive: true })
      .then((d) => setCaisses(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => setCaisses([]));
  }, [isFedapay]);

  const amountNum = parseFloat(amount);
  const amountChanged = transaction ? Math.abs((amountNum || 0) - Number(transaction.amount ?? 0)) > 0.005 : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Le montant doit être supérieur à 0.');
      return;
    }
    if (!datePart) {
      setError('La date du paiement est requise.');
      return;
    }
    if (!reason.trim()) {
      setError('Le motif de la correction est obligatoire (trace d\u2019audit).');
      return;
    }
    setLoading(true);
    try {
      const payload: any = {
        amount: amountNum,
        paymentMethod,
        createdAt: fromBeninParts(datePart, timePart),
        reason: reason.trim(),
      };
      if (reference !== (transaction?.reference ?? '')) payload.reference = reference;
      if (!isFedapay) payload.cashRegisterId = cashRegisterId === '__none__' ? null : cashRegisterId;
      const result = await financeService.updateTransaction(transaction.id, payload);
      onSuccess(result);
    } catch (err: any) {
      setError(err?.message || 'Échec de la modification. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <motion.div
        initial={modalMotion.initial}
        animate={modalMotion.animate}
        transition={modalMotion.transition}
        className="bg-white rounded-xl p-6 max-w-lg w-full border border-blue-100 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Pencil className="w-5 h-5 text-indigo-600" />
            Modifier l&apos;encaissement
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" type="button">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Reçu <span className="font-mono font-semibold">{transaction?.receiptNumber || '—'}</span>
          {studentName ? ` — ${studentName}` : ''}
          {` — actuellement ${formatCurrency(Number(transaction?.amount ?? 0))}`}
        </p>

        {/* Avertissement : opération sensible réservée au promoteur */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Correction <strong>promoteur</strong> : les imputations sur les frais, le solde du compte et
            les caisses seront recalculés, le reçu PDF régénéré. L&apos;opération est tracée dans le
            journal d&apos;audit.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-amount">Montant (FCFA)</Label>
            <Input
              id="edit-amount"
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mode de paiement</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger disabled={isFedapay}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(isFedapay ? ['FEDAPAY'] : ['CASH', 'MOBILE_MONEY', 'WIRE']).map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m] ?? m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isFedapay && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Mode verrouillé (paiement en ligne).
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-caisse">Caisse</Label>
              {isFedapay ? (
                <Input
                  value={transaction?.cashRegister?.name || 'Caisse Paiements en Ligne'}
                  disabled
                />
              ) : (
                <Select value={cashRegisterId} onValueChange={setCashRegisterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucune caisse" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucune caisse</SelectItem>
                    {caisses.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.code ? `(${c.code})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-date">Date du paiement</Label>
              <Input
                id="edit-date"
                type="date"
                value={datePart}
                onChange={(e) => setDatePart(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-time">Heure</Label>
              <Input
                id="edit-time"
                type="time"
                value={timePart}
                onChange={(e) => setTimePart(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="edit-reference">Référence</Label>
            <Input
              id="edit-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Référence du paiement (ex: TX-2609-001, bordereau…)"
            />
          </div>

          <div>
            <Label htmlFor="edit-reason">Motif de la correction *</Label>
            <Input
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: alignement sur le bordereau papier de l'école"
              required
            />
          </div>

          {amountChanged && (
            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
              Les imputations sur les frais seront réparties au prorata du nouveau montant
              ({formatCurrency(amountNum || 0)} au lieu de {formatCurrency(Number(transaction?.amount ?? 0))}).
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enregistrer la correction
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
