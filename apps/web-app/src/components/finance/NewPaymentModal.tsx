'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Download, CheckCircle2 } from 'lucide-react';
import { WhatsAppIcon, GmailIcon, SmsIcon } from './OfficialIcons';
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

const FEE_TYPE_LABELS: Record<string, string> = {
  INSCRIPTION: 'Inscription',
  REINSCRIPTION: 'Réinscription',
  TUITION: 'Scolarité',
  CANTEEN: 'Cantine',
  EXAMEN: "Frais d'examen",
  OTHER: 'Autre',
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
  const [preview, setPreview] = useState<{ totalPay: number; lines: { name: string; pay: number; feeType: string; personalized: boolean; originalAmount?: number }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  // Reçu généré après succès — affiché en bandeau lecture seule
  const [receipt, setReceipt] = useState<{ id: string; receiptNumber: string; createdAt: string } | null>(null);
  const [sendingChannel, setSendingChannel] = useState<string | null>(null);
  const { toast } = useToast();

  // Charge les caisses ouvertes
  useEffect(() => {
    financeService.getCashRegisters({ isActive: true, isOpen: true })
      .then((data) => setOpenCashRegisters(Array.isArray(data) ? data : []))
      .catch(() => setOpenCashRegisters([]));
  }, []);

  const selectedAccount = accounts.find((a) => a.id === studentAccountId);
  const amountNum = parseFloat(amount);

  // Aperçu d'imputation — détecte les personnalisations (initialAmount != feeStructure.totalAmount)
  useEffect(() => {
    if (!selectedAccount || !amountNum || amountNum <= 0) {
      setPreview(null);
      return;
    }
    const balance = Number(selectedAccount.balance);
    const pay = Math.min(amountNum, balance);
    const breakdowns = selectedAccount.breakdowns ?? [];
    let remaining = pay;
    const lines: { name: string; pay: number; feeType: string; personalized: boolean; originalAmount?: number }[] = [];
    const order = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'OTHER'];
    const sorted = [...breakdowns].sort((a, b) => order.indexOf(a.feeStructure?.feeType ?? '') - order.indexOf(b.feeStructure?.feeType ?? ''));
    for (const b of sorted) {
      if (remaining <= 0) break;
      const rem = Number(b.remainingAmount ?? 0);
      if (rem <= 0) continue;
      const delta = Math.min(remaining, rem);
      const fsTotal = Number(b.feeStructure?.totalAmount ?? 0);
      const initial = Number(b.initialAmount ?? 0);
      const isPersonalized = Math.abs(fsTotal - initial) > 0.01;
      lines.push({
        name: b.feeStructure?.name ?? b.feeStructureId,
        pay: delta,
        feeType: b.feeStructure?.feeType ?? 'OTHER',
        personalized: isPersonalized,
        originalAmount: isPersonalized ? fsTotal : undefined,
      });
      remaining -= delta;
    }
    setPreview({ totalPay: pay, lines });
  }, [selectedAccount, amountNum]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentAccountId || !amountNum || amountNum <= 0) return;

    if (!networkDetectionService.isConnected()) {
      toast({ title: 'Hors Ligne', description: 'Les transactions financières nécessitent une connexion internet.', variant: 'destructive' });
      return;
    }

    // Caisse obligatoire pour les espèces
    if (paymentMethod === 'CASH' && !cashRegisterId) {
      toast({ title: 'Caisse requise', description: 'Sélectionnez une caisse ouverte pour les paiements en espèces.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const result = await financeService.createTransaction({
        academicYearId,
        studentAccountId,
        amount: amountNum,
        paymentMethod,
        reference: reference.trim() || undefined,
        cashRegisterId: cashRegisterId || undefined,
      });
      // Le backend renvoie la transaction avec receiptNumber + createdAt
      // + déclenche la génération PDF en fire-and-forget
      if (result?.id) {
        setReceipt({
          id: result.id,
          receiptNumber: result.receiptNumber || '—',
          createdAt: result.createdAt || new Date().toISOString(),
        });
        toast({ title: 'Paiement enregistré', description: `Reçu ${result.receiptNumber} généré.` });
      } else {
        toast({ title: 'Paiement enregistré', description: 'Le reçu est en cours de génération.' });
        onSuccess();
      }
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Impossible d\'enregistrer le paiement', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Actions sur le reçu (depuis le bandeau de succès)
  const handleDownloadReceipt = () => {
    if (!receipt) return;
    window.open(financeService.getReceiptPdfUrl(receipt.id), '_blank');
  };

  const handleResendReceipt = async (channel: 'email' | 'whatsapp' | 'sms') => {
    if (!receipt) return;
    setSendingChannel(channel);
    try {
      const result = await financeService.resendReceipt(receipt.id, [channel]);
      const status = result?.channels?.[channel];
      if (status?.status === 'skipped') {
        toast({ title: 'Contact manquant', description: status.reason || `Aucun contact pour ${channel}.`, variant: 'destructive' });
      } else {
        toast({ title: 'Reçu envoyé', description: `Reçu envoyé par ${channel}${status?.to ? ` à ${status.to}` : ''}.` });
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || `Échec envoi par ${channel}.`, variant: 'destructive' });
    } finally {
      setSendingChannel(null);
    }
  };

  const handleNewPayment = () => {
    setReceipt(null);
    setStudentAccountId('');
    setAmount('');
    setReference('');
    setCashRegisterId('');
    setPreview(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto border border-blue-100 shadow-2xl"
      >
        <h3 className="text-lg font-semibold mb-4">Nouveau paiement</h3>

        {/* Bandeau reçu — affiché après succès, en lecture seule */}
        {receipt && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200"
          >
            <div className="flex items-start gap-3 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-900">Paiement enregistré avec succès</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div>
                    <span className="text-emerald-700">N° reçu : </span>
                    <span className="font-mono font-bold text-emerald-900">{receipt.receiptNumber}</span>
                  </div>
                  <div>
                    <span className="text-emerald-700">Date/heure : </span>
                    <span className="font-medium text-emerald-900">
                      {new Date(receipt.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-200">
              <Button size="sm" onClick={handleDownloadReceipt} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Télécharger PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResendReceipt('email')}
                disabled={sendingChannel === 'email'}
              >
                <GmailIcon className="w-3.5 h-3.5 mr-1.5" />
                {sendingChannel === 'email' ? 'Envoi...' : 'Email'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResendReceipt('whatsapp')}
                disabled={sendingChannel === 'whatsapp'}
              >
                <WhatsAppIcon className="w-3.5 h-3.5 mr-1.5" />
                {sendingChannel === 'whatsapp' ? 'Envoi...' : 'WhatsApp'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResendReceipt('sms')}
                disabled={sendingChannel === 'sms'}
              >
                <SmsIcon className="w-3.5 h-3.5 mr-1.5" />
                {sendingChannel === 'sms' ? 'Envoi...' : 'SMS'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleNewPayment} className="ml-auto">
                Nouveau paiement
              </Button>
            </div>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" style={{ display: receipt ? 'none' : undefined }}>
          <div>
            <Label>Élève / Compte</Label>
            <Select value={studentAccountId} onValueChange={setStudentAccountId}>
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
          <div>
            <Label>Montant (XOF)</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <Label>Méthode de paiement</Label>
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
            <Select value={cashRegisterId || '_none'} onValueChange={(v) => setCashRegisterId(v === '_none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner une caisse ouverte" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Aucune caisse —</SelectItem>
                {openCashRegisters.map((reg) => (
                  <SelectItem key={reg.id} value={reg.id}>
                    {reg.code} — {reg.name} (Solde : {formatCurrency(reg.currentBalance)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {paymentMethod === 'CASH' && openCashRegisters.length === 0 && (
              <p className="text-xs text-rose-600 mt-1">
                ⚠️ Aucune caisse ouverte. Ouvrez une caisse dans l'onglet Multi-caisses.
              </p>
            )}
          </div>
          <div>
            <Label>Observation / Référence</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optionnel" />
          </div>
          {preview && (
            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50 text-sm">
              <p className="font-medium mb-2 text-slate-700">Aperçu de l'imputation</p>
              {preview.lines.map((l, i) => (
                <div key={i} className="flex justify-between items-center py-1">
                  <span className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="truncate">{l.name}</span>
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">{FEE_TYPE_LABELS[l.feeType] || l.feeType}</Badge>
                    {l.personalized && (
                      <Badge variant="outline" className="text-[10px] flex-shrink-0 text-purple-700 border-purple-300 bg-purple-50">
                        <Sparkles className="w-2.5 h-2.5 mr-0.5" />Pers.
                      </Badge>
                    )}
                  </span>
                  <span className="font-medium whitespace-nowrap ml-2">
                    {l.personalized && l.originalAmount != null && (
                      <span className="text-xs text-slate-400 line-through mr-1">{formatCurrency(l.originalAmount)}</span>
                    )}
                    {formatCurrency(l.pay)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between font-semibold mt-2 pt-2 border-t border-slate-300">
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
