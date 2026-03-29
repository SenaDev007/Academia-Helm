'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'WIRE', label: 'Virement' },
  { value: 'FEDAPAY', label: 'Fedapay' },
];

export default function NewPaymentModal({
  academicYearId,
  accounts,
  onClose,
  onSuccess,
}: {
  academicYearId: string;
  accounts: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [studentAccountId, setStudentAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [preview, setPreview] = useState<{ totalPay: number; lines: { name: string; pay: number }[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedAccount = accounts.find((a) => a.id === studentAccountId);
  const amountNum = parseFloat(amount);

  useEffect(() => {
    if (!selectedAccount || !amountNum || amountNum <= 0) {
      setPreview(null);
      return;
    }
    const balance = Number(selectedAccount.balance);
    const pay = Math.min(amountNum, balance);
    const breakdowns = selectedAccount.breakdowns ?? [];
    let remaining = pay;
    const lines: { name: string; pay: number }[] = [];
    const order = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'ANNEX', 'EXCEPTIONAL'];
    const sorted = [...breakdowns].sort((a, b) => order.indexOf(a.feeStructure?.feeType ?? '') - order.indexOf(b.feeStructure?.feeType ?? ''));
    for (const b of sorted) {
      if (remaining <= 0) break;
      const rem = Number(b.remainingAmount ?? 0);
      if (rem <= 0) continue;
      const delta = Math.min(remaining, rem);
      lines.push({ name: b.feeStructure?.name ?? b.feeStructureId, pay: delta });
      remaining -= delta;
    }
    setPreview({ totalPay: pay, lines });
  }, [selectedAccount, amountNum]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentAccountId || !amountNum || amountNum <= 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ academicYearId, studentAccountId, amount: amountNum, paymentMethod, reference: reference.trim() || undefined }),
      });
      if (res.ok) onSuccess();
      else {
        const err = await res.json();
        alert(err?.message || err?.error || 'Erreur');
      }
    } catch {
      alert('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const formatXOF = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-blue-100 shadow-2xl"
      >
        <h3 className="text-lg font-semibold mb-4">Nouveau paiement</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Élève / Compte</Label>
            <Select value={studentAccountId} onValueChange={setStudentAccountId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un compte" /></SelectTrigger>
              <SelectContent>
                {accounts.filter((a) => Number(a.balance) > 0).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.studentId} — Solde {formatXOF(Number(a.balance))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Montant (XOF)</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <Label>Méthode</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observation / Référence</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optionnel" />
          </div>
          {preview && (
            <div className="rounded border p-3 bg-gray-50 text-sm">
              <p className="font-medium mb-2">Aperçu imputation</p>
              {preview.lines.map((l, i) => (
                <div key={i} className="flex justify-between">
                  <span>{l.name}</span>
                  <span>{formatXOF(l.pay)}</span>
                </div>
              ))}
              <div className="flex justify-between font-medium mt-2 pt-2 border-t">
                <span>Total imputé</span>
                <span>{formatXOF(preview.totalPay)}</span>
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Enregistrement...' : 'Valider paiement'}</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
