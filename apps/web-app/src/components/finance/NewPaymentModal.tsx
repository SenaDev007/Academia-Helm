'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Wallet, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { financeService } from '@/services/finance.service';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { formatCurrency } from '@/lib/utils';

const METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'WIRE', label: 'Virement' },
  { value: 'FEDAPAY', label: 'Fedapay' },
];

// Mapping : type de frais → code de caisse recommandé
const FEE_TYPE_TO_CAISSE_CODE: Record<string, string> = {
  INSCRIPTION: 'ACCUEIL',
  REINSCRIPTION: 'ACCUEIL',
  TUITION: 'ACCUEIL',
  CANTEEN: 'CANTEEN',
  EXAMEN: 'ACCUEIL',
  OTHER: 'ACCUEIL',
};

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
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [openCashRegisters, setOpenCashRegisters] = useState<any[]>([]);
  const [preview, setPreview] = useState<{ totalPay: number; lines: { name: string; pay: number; feeType: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoSelected, setAutoSelected] = useState(false);
  const { toast } = useToast();

  // Charge les caisses ouvertes pour la sélection
  useEffect(() => {
    financeService
      .getCashRegisters({ isActive: true, isOpen: true })
      .then((data) => setOpenCashRegisters(Array.isArray(data) ? data : []))
      .catch(() => setOpenCashRegisters([]));
  }, []);

  const selectedAccount = accounts.find((a) => a.id === studentAccountId);
  const amountNum = parseFloat(amount);

  // Détection du type de frais prioritaire (premier non-payé dans l'ordre INSCRIPTION > TUITION > CANTEEN > etc.)
  const primaryFeeType = useMemo(() => {
    if (!selectedAccount) return null;
    const breakdowns = selectedAccount.breakdowns ?? [];
    const order = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'OTHER'];
    const sorted = [...breakdowns].sort((a, b) => order.indexOf(a.feeStructure?.feeType ?? '') - order.indexOf(b.feeStructure?.feeType ?? ''));
    const firstUnpaid = sorted.find((b) => Number(b.remainingAmount ?? 0) > 0);
    return firstUnpaid?.feeStructure?.feeType ?? null;
  }, [selectedAccount]);

  // Auto-sélection intelligente de la caisse selon le type de frais
  useEffect(() => {
    if (!primaryFeeType || openCashRegisters.length === 0 || autoSelected) return;
    const recommendedCode = FEE_TYPE_TO_CAISSE_CODE[primaryFeeType];
    if (!recommendedCode) return;
    // Chercher une caisse ouverte dont le code correspond
    const recommended = openCashRegisters.find((r) => r.code?.toUpperCase() === recommendedCode);
    if (recommended) {
      setCashRegisterId(recommended.id);
      setAutoSelected(true);
    } else {
      // Fallback : première caisse ouverte (ex: MAIN ou ACCUEIL)
      const fallback = openCashRegisters.find((r) => r.code?.toUpperCase() === 'MAIN') || openCashRegisters[0];
      if (fallback) {
        setCashRegisterId(fallback.id);
        setAutoSelected(true);
      }
    }
  }, [primaryFeeType, openCashRegisters, autoSelected]);

  useEffect(() => {
    if (!selectedAccount || !amountNum || amountNum <= 0) {
      setPreview(null);
      return;
    }
    const balance = Number(selectedAccount.balance);
    const pay = Math.min(amountNum, balance);
    const breakdowns = selectedAccount.breakdowns ?? [];
    let remaining = pay;
    const lines: { name: string; pay: number; feeType: string }[] = [];
    const order = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'OTHER'];
    const sorted = [...breakdowns].sort((a, b) => order.indexOf(a.feeStructure?.feeType ?? '') - order.indexOf(b.feeStructure?.feeType ?? ''));
    for (const b of sorted) {
      if (remaining <= 0) break;
      const rem = Number(b.remainingAmount ?? 0);
      if (rem <= 0) continue;
      const delta = Math.min(remaining, rem);
      lines.push({ name: b.feeStructure?.name ?? b.feeStructureId, pay: delta, feeType: b.feeStructure?.feeType ?? 'OTHER' });
      remaining -= delta;
    }
    setPreview({ totalPay: pay, lines });
  }, [selectedAccount, amountNum]);

  // Si l'utilisateur change manuellement de caisse, désactiver l'auto-sélection
  const handleCashRegisterChange = (id: string) => {
    setCashRegisterId(id);
    setAutoSelected(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentAccountId || !amountNum || amountNum <= 0) return;

    if (!networkDetectionService.isConnected()) {
      toast({ title: 'Hors Ligne', description: 'Les transactions financières nécessitent une connexion internet.', variant: 'destructive' });
      return;
    }

    // Si paiement CASH, une caisse ouverte est obligatoire
    if (paymentMethod === 'CASH' && !cashRegisterId) {
      toast({ title: 'Caisse requise', description: 'Sélectionnez une caisse ouverte pour les paiements en espèces.', variant: 'destructive' });
      return;
    }

    // Fedapay → toujours vers la caisse banque si elle existe
    let finalCashRegisterId = cashRegisterId;
    if (paymentMethod === 'FEDAPAY') {
      const bankCaisse = openCashRegisters.find((r) => r.code?.toUpperCase() === 'BANQUE' || r.name?.toLowerCase().includes('banque'));
      if (bankCaisse) finalCashRegisterId = bankCaisse.id;
    }

    setLoading(true);
    try {
      await financeService.createTransaction({
        academicYearId,
        studentAccountId,
        amount: amountNum,
        paymentMethod,
        reference: reference.trim() || undefined,
        cashRegisterId: finalCashRegisterId || undefined,
      });
      toast({ title: 'Paiement enregistré', description: 'Le reçu a été généré avec succès.' });
      onSuccess();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Impossible d\'enregistrer le paiement', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Caisse actuellement sélectionnée (pour afficher le solde)
  const selectedCaisse = openCashRegisters.find((r) => r.id === cashRegisterId);
  // Caisse recommandée selon le type de frais
  const recommendedCaisseCode = primaryFeeType ? FEE_TYPE_TO_CAISSE_CODE[primaryFeeType] : null;

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
            <Select value={studentAccountId} onValueChange={(v) => { setStudentAccountId(v); setAutoSelected(false); }}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un compte" /></SelectTrigger>
              <SelectContent>
                {accounts.filter((a) => Number(a.balance) > 0).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.studentId} — Solde {formatCurrency(a.balance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Badge du type de frais détecté */}
          {primaryFeeType && (
            <div className="flex items-center gap-2 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-slate-500">Type de frais prioritaire :</span>
              <Badge variant="outline" className="text-indigo-700 border-indigo-300 bg-indigo-50">
                {primaryFeeType === 'INSCRIPTION' ? 'Inscription' :
                 primaryFeeType === 'REINSCRIPTION' ? 'Réinscription' :
                 primaryFeeType === 'TUITION' ? 'Scolarité' :
                 primaryFeeType === 'CANTEEN' ? 'Cantine' :
                 primaryFeeType === 'EXAMEN' ? 'Examen' : 'Autre'}
              </Badge>
              {recommendedCaisseCode && (
                <span className="text-slate-400">→ Caisse recommandée : <strong className="text-slate-600">{recommendedCaisseCode}</strong></span>
              )}
            </div>
          )}

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
            <Label>Caisse {paymentMethod === 'CASH' ? '*' : '(optionnel)'}</Label>
            <Select value={cashRegisterId} onValueChange={handleCashRegisterChange}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une caisse ouverte" /></SelectTrigger>
              <SelectContent>
                {openCashRegisters.length === 0 ? (
                  <SelectItem value="_none" disabled>
                    Aucune caisse ouverte — ouvrez-en une dans Multi-caisses
                  </SelectItem>
                ) : (
                  openCashRegisters.map((reg) => {
                    const isRecommended = recommendedCaisseCode && reg.code?.toUpperCase() === recommendedCaisseCode;
                    return (
                      <SelectItem key={reg.id} value={reg.id}>
                        {reg.code} — {reg.name} (Solde : {formatCurrency(reg.currentBalance)}){isRecommended ? ' ⭐' : ''}
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
            {autoSelected && selectedCaisse && (
              <p className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Caisse auto-sélectionnée : {selectedCaisse.code} — {selectedCaisse.name}. Vous pouvez la modifier.
              </p>
            )}
            {paymentMethod === 'CASH' && openCashRegisters.length === 0 && (
              <p className="text-xs text-rose-600 mt-1">
                ⚠️ Aucune caisse ouverte. Ouvrez une caisse dans l'onglet Multi-caisses pour encaisser en espèces.
              </p>
            )}
            {paymentMethod === 'FEDAPAY' && (
              <p className="text-xs text-amber-600 mt-1">
                💡 Les paiements Fedapay seront automatiquement dirigés vers la caisse banque si elle existe.
              </p>
            )}
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
                  <span className="flex items-center gap-1">
                    {l.name}
                    <Badge variant="outline" className="text-[10px] ml-1">{l.feeType}</Badge>
                  </span>
                  <span>{formatCurrency(l.pay)}</span>
                </div>
              ))}
              <div className="flex justify-between font-medium mt-2 pt-2 border-t">
                <span>Total imputé</span>
                <span>{formatCurrency(preview.totalPay)}</span>
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading || (paymentMethod === 'CASH' && !cashRegisterId)}>
              {loading ? 'Enregistrement...' : 'Valider paiement'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
