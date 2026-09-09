'use client';

/**
 * ============================================================================
 * GENERAL FEE PAYMENT MODAL — Encaissement DÉDIÉ des frais généraux
 * ============================================================================
 * ⭐ Exigence utilisateur (sept. 2026) : dans l'onglet Encaissements, un bouton
 *    ouvre un modal SPÉCIFIQUE pour l'encaissement des frais généraux, « pour
 *    que les choses soient bien proprement séparées. Il faut que ça soit à
 *    part ». Le paiement est imputé UNIQUEMENT aux AccountBreakdown de type
 *    GENERAL (targetFeeType: 'GENERAL' côté backend) :
 *      - l'encaissement apparaît dans le sous-onglet « Frais généraux »
 *        (bascule automatique après succès) ;
 *      - le solde de l'élève se déduit automatiquement dans l'onglet
 *        « Frais généraux » (event finance-accounts-changed + trigger DB) ;
 *      - le reçu PDF est généré comme pour un paiement standard.
 * Flux volontairement SIMPLE et SÉPARÉ : pas de boutique, pas de Fedapay —
 * uniquement les encaissements directs (espèces / mobile money / virement).
 * ============================================================================
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, Download, CheckCircle2, Search, Layers, Sparkles, Wallet,
} from 'lucide-react';
import { WhatsAppIcon, GmailIcon, HelmConnectIcon } from './OfficialIcons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useL } from '@/lib/i18n/bilingual';
import { financeService } from '@/services/finance.service';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { formatCurrency } from '@/lib/utils';

const METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'WIRE', label: 'Virement bancaire' },
];

/** Breakdown GENERAL d'un compte élève (inclus par /finance/accounts). */
interface GeneralBreakdown {
  id: string;
  initialAmount: number | string;
  paidAmount: number | string;
  remainingAmount: number | string;
  feeStructure: { id: string; name: string; feeType: string; totalAmount: number | string };
}

const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;

export default function GeneralFeePaymentModal({
  academicYearId,
  accounts,
  onClose,
  onSuccess,
  refreshTrigger = 0,
}: {
  academicYearId: string;
  accounts: any[];
  onClose: () => void;
  onSuccess: () => void;
  /** Incrémenté par le parent après un encaissement réussi (refresh caisses). */
  refreshTrigger?: number;
}) {
  const { toast } = useToast();
  const L = useL();
  const { user } = useAppSession();

  const [studentAccountId, setStudentAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [openCashRegisters, setOpenCashRegisters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<{ id: string; receiptNumber: string; createdAt: string } | null>(null);
  const [sendingChannel, setSendingChannel] = useState<string | null>(null);
  const [tenderedAmount, setTenderedAmount] = useState('');

  // Sélecteurs niveau + classe + recherche élève (cascade identique au NewPaymentModal)
  const [levels, setLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  // ⭐ Rôles autorisés à encaisser sur la caisse FONDE (caisse promoteur)
  //    — doit matcher PROMOTER_CAISSE_ALLOWED_ROLES côté backend.
  const PROMOTER_CAISSE_ROLES = ['PROMOTER', 'PROMOTEUR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'];
  const userRole = (user?.role || '').toUpperCase();
  const canUsePromoterCaisse = PROMOTER_CAISSE_ROLES.includes(userRole);

  // Caisses ouvertes (rechargées quand refreshTrigger change)
  useEffect(() => {
    financeService.getCashRegisters({ isActive: true, isOpen: true })
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        const filtered = canUsePromoterCaisse ? all : all.filter((c: any) => c.code !== 'FONDE');
        setOpenCashRegisters(filtered);
      })
      .catch(() => setOpenCashRegisters([]));
  }, [refreshTrigger, canUsePromoterCaisse]);

  useEffect(() => {
    fetch('/api/school-levels')
      .then((r) => r.json())
      .then((d) => setLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setLevels([]));
  }, []);

  // ⭐ FIX 2026-09-09 (« bascule d'année globale ») : classes de l'année du
  //    contexte (prop academicYearId) + rechargement au changement d'année.
  useEffect(() => {
    fetch(`/api/all-classes${academicYearId ? `?academicYearId=${academicYearId}` : ''}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setClasses(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setClasses([]));
  }, [academicYearId]);

  const filteredClasses = useMemo(() => {
    if (!selectedLevelId) return classes;
    const selectedLevel = levels.find((l) => l.id === selectedLevelId);
    const schoolLevelId = selectedLevel?.schoolLevelId || selectedLevelId;
    return classes.filter((c: any) =>
      c.schoolLevelId === schoolLevelId ||
      c.schoolLevel?.code === selectedLevel?.code ||
      c.schoolLevel?.id === schoolLevelId
    );
  }, [classes, selectedLevelId, levels]);

  /**
   * ⭐ Cœur du flux dédié : ne lister que les élèves ayant au moins un frais
   *    GENERAL avec un restant dû > 0 (les autres n'ont rien à encaisser ici).
   */
  const generalBreakdownsOf = (account: any): GeneralBreakdown[] =>
    (account?.breakdowns ?? []).filter(
      (b: any) => b?.feeStructure?.feeType === 'GENERAL' && num(b.remainingAmount) > 0,
    );

  const filteredAccounts = useMemo(() => {
    let result = accounts.filter((a) => generalBreakdownsOf(a).length > 0);

    if (selectedLevelId) {
      const selectedLevel = levels.find((l) => l.id === selectedLevelId);
      const schoolLevelId = selectedLevel?.schoolLevelId || selectedLevelId;
      const levelCode = selectedLevel?.code;
      const levelClassIds = new Set(
        classes
          .filter((c: any) =>
            c.schoolLevelId === schoolLevelId ||
            c.schoolLevel?.code === levelCode ||
            c.schoolLevel?.id === schoolLevelId
          )
          .map((c: any) => c.id)
      );
      result = result.filter((a) => {
        const enrollments = a.student?.studentEnrollments ?? [];
        return enrollments.some((e: any) => levelClassIds.has(e.classId));
      });
    }

    if (selectedClassId) {
      result = result.filter((a) => {
        const enrollments = a.student?.studentEnrollments ?? [];
        return enrollments.some((e: any) => e.classId === selectedClassId);
      });
    }

    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase().trim();
      result = result.filter((a) => {
        const name = `${a.student?.lastName || ''} ${a.student?.firstName || ''} ${a.student?.matricule || ''}`.toLowerCase();
        return name.includes(q);
      });
    }

    return result;
  }, [accounts, selectedLevelId, selectedClassId, studentSearch, levels, classes]);

  // Auto-sélection si la recherche donne un seul résultat
  useEffect(() => {
    if (studentSearch.trim() && filteredAccounts.length === 1 && studentAccountId !== filteredAccounts[0].id) {
      setStudentAccountId(filteredAccounts[0].id);
    }
  }, [studentSearch, filteredAccounts, studentAccountId]);

  const selectedAccount = accounts.find((a) => a.id === studentAccountId);
  const amountNum = parseFloat(amount) || 0;

  // Frais généraux de l'élève sélectionné + total restant
  const generalFees = useMemo(() => generalBreakdownsOf(selectedAccount), [selectedAccount]);
  const generalRemainingTotal = generalFees.reduce((s, b) => s + num(b.remainingAmount), 0);

  // Aperçu d'imputation (frais généraux uniquement)
  const preview = useMemo(() => {
    if (!selectedAccount || amountNum <= 0) return null;
    let remaining = Math.min(amountNum, generalRemainingTotal);
    const lines: { name: string; pay: number; personalized: boolean; originalAmount?: number }[] = [];
    for (const b of generalFees) {
      if (remaining <= 0) break;
      const rem = num(b.remainingAmount);
      if (rem <= 0) continue;
      const delta = Math.min(remaining, rem);
      const fsTotal = num(b.feeStructure.totalAmount);
      const initial = num(b.initialAmount);
      const isPersonalized = Math.abs(fsTotal - initial) > 0.01;
      lines.push({
        name: b.feeStructure.name,
        pay: delta,
        personalized: isPersonalized,
        originalAmount: isPersonalized ? fsTotal : undefined,
      });
      remaining -= delta;
    }
    return { lines, totalPay: lines.reduce((s, l) => s + l.pay, 0), exceeds: amountNum > generalRemainingTotal };
  }, [selectedAccount, amountNum, generalFees, generalRemainingTotal]);

  // Espèces : reliquat
  const tenderedNum = parseFloat(tenderedAmount) || 0;
  const changeGiven = Math.max(0, tenderedNum - amountNum);
  const isTenderedInsufficient = tenderedNum > 0 && tenderedNum < amountNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentAccountId) return;
    if (!amountNum || amountNum <= 0) {
      toast({ title: L('Montant requis', 'Amount required'), description: L('Saisissez le montant à encaisser.', 'Enter the amount to collect.'), variant: 'destructive' });
      return;
    }
    if (amountNum > generalRemainingTotal) {
      toast({
        title: L('Montant trop élevé', 'Amount too high'),
        description: L(
          `Le montant dépasse le restant des frais généraux de cet élève (${formatCurrency(generalRemainingTotal)}).`,
          `The amount exceeds this student's remaining general fees (${formatCurrency(generalRemainingTotal)}).`,
        ),
        variant: 'destructive',
      });
      return;
    }
    if (!networkDetectionService.isConnected()) {
      toast({ title: L('Hors ligne', 'Offline'), description: L('Les transactions financières nécessitent une connexion internet.', 'Financial transactions require an internet connection.'), variant: 'destructive' });
      return;
    }
    if (paymentMethod === 'CASH' && !cashRegisterId) {
      toast({ title: L('Caisse requise', 'Cash register required'), description: L('Sélectionnez une caisse ouverte pour les paiements en espèces.', 'Select an open cash register for cash payments.'), variant: 'destructive' });
      return;
    }
    if (paymentMethod === 'CASH' && tenderedNum > 0 && isTenderedInsufficient) {
      toast({
        title: L('Montant remis insuffisant', 'Insufficient tendered amount'),
        description: L(
          `Le client a remis ${formatCurrency(tenderedNum)} mais le total à encaisser est ${formatCurrency(amountNum)}. Manquant : ${formatCurrency(amountNum - tenderedNum)}.`,
          `The customer tendered ${formatCurrency(tenderedNum)} but the total to collect is ${formatCurrency(amountNum)}. Missing: ${formatCurrency(amountNum - tenderedNum)}.`,
        ),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // ⭐ targetFeeType: 'GENERAL' → le backend impute UNIQUEMENT les frais
      //    généraux (pas de FIFO arriérés, pas d'autres types de frais).
      const result = await financeService.createTransaction({
        academicYearId,
        studentAccountId,
        amount: amountNum,
        paymentMethod,
        reference: reference.trim() || undefined,
        cashRegisterId: cashRegisterId || undefined,
        tenderedAmount: paymentMethod === 'CASH' && tenderedNum > 0 ? tenderedNum : undefined,
        changeGiven: paymentMethod === 'CASH' && tenderedNum > 0 ? changeGiven : undefined,
        targetFeeType: 'GENERAL',
      });
      if (result?.id) {
        setReceipt({
          id: result.id,
          receiptNumber: result.receiptNumber || '—',
          createdAt: result.createdAt || new Date().toISOString(),
        });
        toast({
          title: L('✅ Encaissement frais généraux confirmé', '✅ General fees collection confirmed'),
          description: L(`Reçu ${result.receiptNumber} généré.`, `Receipt ${result.receiptNumber} generated.`),
        });
        onSuccess();
      } else {
        toast({ title: L('Paiement enregistré', 'Payment recorded'), description: L('Le reçu est en cours de génération.', 'The receipt is being generated.') });
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: L('Erreur', 'Error'),
        description: error?.message || L("Impossible d'enregistrer le paiement", 'Could not record the payment'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReceipt = () => {
    if (!receipt) return;
    window.open(financeService.getReceiptPdfUrl(receipt.id), '_blank');
  };

  const handleResendReceipt = async (channel: 'email' | 'whatsapp' | 'sms' | 'helm_connect') => {
    if (!receipt) return;
    setSendingChannel(channel);
    try {
      const result = await financeService.resendReceipt(receipt.id, [channel]);
      const status = result?.channels?.[channel];
      if (status?.status === 'skipped') {
        toast({ title: L('Contact manquant', 'Missing contact'), description: status.reason || L(`Aucun contact pour ${channel}.`, `No contact for ${channel}.`), variant: 'destructive' });
      } else if (status?.status === 'failed') {
        toast({ title: L("Échec d'envoi", 'Send failed'), description: status.error || L(`Échec de l'envoi par ${channel}.`, `Failed to send via ${channel}.`), variant: 'destructive' });
      } else {
        toast({ title: L('Reçu envoyé', 'Receipt sent'), description: L(`Reçu envoyé par ${channel}${status?.to ? ` à ${status.to}` : ''}.`, `Receipt sent via ${channel}${status?.to ? ` to ${status.to}` : ''}.`) });
      }
    } catch (e: any) {
      toast({ title: L('Erreur', 'Error'), description: e?.message || L(`Échec envoi par ${channel}.`, `Failed to send via ${channel}.`), variant: 'destructive' });
    } finally {
      setSendingChannel(null);
    }
  };

  const handleNewCollection = () => {
    setReceipt(null);
    setStudentAccountId('');
    setAmount('');
    setReference('');
    setCashRegisterId('');
    setTenderedAmount('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-indigo-100 shadow-2xl"
      >
        {/* Titre distinctif (flux séparé du paiement standard) */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Layers className="w-4 h-4 text-indigo-700" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">{L('Encaissement des frais généraux', 'General fees collection')}</h3>
            <p className="text-xs text-slate-500">
              {L(
                'Paiement imputé uniquement aux frais généraux de l\u2019année en cours.',
                'Payment allocated to current-year general fees only.',
              )}
            </p>
          </div>
        </div>

        {/* Bandeau reçu — affiché après succès, en lecture seule */}
        {receipt && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="flex items-start gap-3 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-900">{L('Encaissement enregistré avec succès', 'Collection recorded successfully')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
                  <div>
                    <span className="text-emerald-700">N° {L('reçu', 'receipt')} : </span>
                    <span className="font-mono font-bold text-emerald-900">{receipt.receiptNumber}</span>
                  </div>
                  <div>
                    <span className="text-emerald-700">{L('Date/heure', 'Date/time')} : </span>
                    <span className="font-medium text-emerald-900">
                      {new Date(receipt.createdAt).toLocaleString(L('fr-FR', 'en-GB'), { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-200">
              <Button size="sm" onClick={handleDownloadReceipt} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Download className="w-3.5 h-3.5 mr-1.5" /> {L('Télécharger PDF', 'Download PDF')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleResendReceipt('email')} disabled={sendingChannel === 'email'}>
                <GmailIcon className="w-3.5 h-3.5 mr-1.5" />
                {sendingChannel === 'email' ? L('Envoi...', 'Sending...') : 'Email'}
              </Button>
              <Button size="sm" variant="outline" disabled className="opacity-40 cursor-not-allowed" title={L('WhatsApp désactivé — utilisez Helm Connect', 'WhatsApp disabled — use Helm Connect')}>
                <WhatsAppIcon className="w-3.5 h-3.5 mr-1.5 grayscale" />
                WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleResendReceipt('helm_connect')} disabled={sendingChannel === 'helm_connect'}>
                <HelmConnectIcon className="w-3.5 h-3.5 mr-1.5" />
                {sendingChannel === 'helm_connect' ? L('Envoi...', 'Sending...') : 'Helm Connect'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleNewCollection}>
                {L('Nouvel encaissement frais généraux', 'New general fees collection')}
              </Button>
              <Button size="sm" variant="outline" onClick={onClose}>{L('Fermer', 'Close')}</Button>
            </div>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ display: receipt ? 'none' : undefined }}>
          {/* Sélecteurs Niveau + Classe */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{L('Niveau scolaire', 'School level')}</Label>
              <Select value={selectedLevelId || 'ALL'} onValueChange={(v) => { setSelectedLevelId(v === 'ALL' ? '' : v); setSelectedClassId(''); }}>
                <SelectTrigger><SelectValue placeholder={L('Tous les niveaux', 'All levels')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{L('Tous les niveaux', 'All levels')}</SelectItem>
                  {levels.map((l) => (<SelectItem key={l.id} value={l.id}>{l.label ?? l.code ?? l.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{L('Classe', 'Class')}</Label>
              <Select value={selectedClassId || 'ALL'} onValueChange={(v) => setSelectedClassId(v === 'ALL' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={L('Toutes les classes', 'All classes')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{L('Toutes les classes', 'All classes')}</SelectItem>
                  {filteredClasses.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recherche + sélecteur élève (uniquement élèves avec frais généraux en cours) */}
          <div>
            <Label>{L('Élève / Compte', 'Student / Account')}</Label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder={L('Rechercher par nom, prénom ou matricule...', 'Search by name or student ID...')}
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={studentAccountId} onValueChange={setStudentAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={
                  filteredAccounts.length === 0
                    ? L('Aucun élève avec frais généraux en cours', 'No student with pending general fees')
                    : L(`Sélectionner (${filteredAccounts.length} élève${filteredAccounts.length > 1 ? 's' : ''})`, `Select (${filteredAccounts.length} student${filteredAccounts.length > 1 ? 's' : ''})`)
                } />
              </SelectTrigger>
              <SelectContent>
                {filteredAccounts.map((a) => {
                  const rem = generalBreakdownsOf(a).reduce((s, b) => s + num(b.remainingAmount), 0);
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.studentId} — {L('Frais généraux', 'General fees')} : {formatCurrency(rem)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {filteredAccounts.length === 0 && (selectedClassId || studentSearch) && (
              <p className="text-xs text-slate-400 mt-1">
                {L('Aucun élève ne correspond aux critères (ou aucun frais général restant).', 'No student matches the criteria (or no remaining general fees).')}
              </p>
            )}
          </div>

          {/* ⭐ Détail des frais généraux de l'élève sélectionné */}
          {selectedAccount && generalFees.length > 0 && (
            <div className="md:col-span-2 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
              <p className="text-sm font-semibold text-indigo-900 mb-2 flex items-center gap-1.5">
                <Wallet className="w-4 h-4" />
                {L('Frais généraux de l\u2019élève', 'Student\u2019s general fees')}
              </p>
              <div className="space-y-1.5">
                {generalFees.map((b) => {
                  const fsTotal = num(b.feeStructure.totalAmount);
                  const initial = num(b.initialAmount);
                  const isPersonalized = Math.abs(fsTotal - initial) > 0.01;
                  return (
                    <div key={b.id} className="flex items-center justify-between gap-2 bg-white border border-indigo-100 rounded-lg px-3 py-2 text-sm">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{b.feeStructure.name}</span>
                        {isPersonalized && (
                          <Badge variant="outline" className="text-[10px] flex-shrink-0 text-purple-700 border-purple-300 bg-purple-50">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" />{L('Pers.', 'Pers.')}
                          </Badge>
                        )}
                      </span>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <span className="text-xs text-slate-500">
                          {L('Dû', 'Due')} {formatCurrency(initial)} · {L('Payé', 'Paid')} {formatCurrency(num(b.paidAmount))}
                        </span>
                        <span className="font-semibold text-indigo-900">{L('Reste', 'Left')} {formatCurrency(num(b.remainingAmount))}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                          onClick={() => setAmount(String(num(b.remainingAmount)))}
                        >
                          {L('Payer tout', 'Pay all')}
                        </Button>
                      </span>
                    </div>
                  );
                })}
                <div className="flex justify-between items-center pt-2 mt-1 border-t border-indigo-200 text-sm font-semibold text-indigo-900">
                  <span>{L('Total restant (frais généraux)', 'Total remaining (general fees)')}</span>
                  <span>{formatCurrency(generalRemainingTotal)}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>{L('Montant (XOF)', 'Amount (XOF)')}</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            {selectedAccount && generalRemainingTotal > 0 && (
              <button
                type="button"
                onClick={() => setAmount(String(generalRemainingTotal))}
                className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline mt-1"
              >
                {L(`Tout encaisser (${formatCurrency(generalRemainingTotal)})`, `Collect all (${formatCurrency(generalRemainingTotal)})`)}
              </button>
            )}
          </div>

          <div>
            <Label>{L('Méthode de paiement', 'Payment method')}</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>
              {L('Caisse', 'Cash register')} {paymentMethod === 'CASH' ? '*' : L('(optionnel)', '(optional)')}
            </Label>
            <Select value={cashRegisterId || '_none'} onValueChange={(v) => setCashRegisterId(v === '_none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder={L('Sélectionner une caisse ouverte', 'Select an open cash register')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— {L('Aucune caisse', 'No cash register')} —</SelectItem>
                {openCashRegisters.map((reg) => (
                  <SelectItem key={reg.id} value={reg.id}>
                    {reg.code} — {reg.name} ({L('Solde', 'Balance')} : {formatCurrency(reg.currentBalance)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {paymentMethod === 'CASH' && openCashRegisters.length === 0 && (
              <p className="text-xs text-rose-600 mt-1">
                ⚠️ {L('Aucune caisse ouverte. Ouvrez une caisse dans l\u2019onglet Multi-caisses.', 'No open cash register. Open one in the Multi-cash registers tab.')}
              </p>
            )}
          </div>

          {/* Espèces : montant remis + reliquat */}
          {paymentMethod === 'CASH' && (
            <div>
              <Label>{L('Montant remis par le client (XOF)', 'Amount tendered by customer (XOF)')}</Label>
              <Input
                type="number"
                min={0}
                value={tenderedAmount}
                onChange={(e) => setTenderedAmount(e.target.value)}
                placeholder={L('Ex: 50000 (laisser vide si exact)', 'e.g. 50000 (leave empty if exact)')}
              />
              {tenderedNum > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <span className="text-emerald-700 font-medium">💰 {L('Reliquat à rendre :', 'Change to return:')}</span>
                    <span className="font-bold text-emerald-900">{formatCurrency(changeGiven)}</span>
                  </div>
                  {isTenderedInsufficient && (
                    <p className="text-xs text-rose-600 flex items-center gap-1">
                      ⚠️ {L(
                        `Le montant remis (${formatCurrency(tenderedNum)}) est inférieur au total à encaisser (${formatCurrency(amountNum)}). Manquant : ${formatCurrency(amountNum - tenderedNum)}.`,
                        `Tendered (${formatCurrency(tenderedNum)}) is less than the total to collect (${formatCurrency(amountNum)}). Missing: ${formatCurrency(amountNum - tenderedNum)}.`,
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <Label>{L('Observation / Référence', 'Note / Reference')}</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={L('Optionnel', 'Optional')} />
          </div>

          {/* Aperçu d'imputation — frais généraux uniquement */}
          {preview && (
            <div className="md:col-span-2 rounded-lg border border-indigo-200 p-3 bg-indigo-50/40 text-sm">
              <p className="font-medium mb-2 text-indigo-900">{L('Aperçu de l\u2019imputation (frais généraux)', 'Allocation preview (general fees)')}</p>
              {preview.lines.map((l, i) => (
                <div key={i} className="flex justify-between items-center py-1">
                  <span className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="truncate">{l.name}</span>
                    {l.personalized && (
                      <Badge variant="outline" className="text-[10px] flex-shrink-0 text-purple-700 border-purple-300 bg-purple-50">
                        <Sparkles className="w-2.5 h-2.5 mr-0.5" />{L('Pers.', 'Pers.')}
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
              <div className="flex justify-between font-semibold mt-2 pt-2 border-t border-indigo-200">
                <span>{L('Total imputé aux frais généraux', 'Total allocated to general fees')}</span>
                <span>{formatCurrency(preview.totalPay)}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-4 md:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>{L('Annuler', 'Cancel')}</Button>
            <Button
              type="submit"
              disabled={loading || (paymentMethod === 'CASH' && !cashRegisterId) || !amountNum || amountNum <= 0}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {L('Enregistrement...', 'Recording...')}
                </>
              ) : (
                L(`Encaisser ${formatCurrency(amountNum || 0)}`, `Collect ${formatCurrency(amountNum || 0)}`)
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
