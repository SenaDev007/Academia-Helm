'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Download, CheckCircle2, Search, Phone, ArrowRight, Loader2,
  AlertCircle, CheckCircle, Shield, Lock, Smartphone,
} from 'lucide-react';
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
import { useModuleContext } from '@/hooks/useModuleContext';
import {
  detectFeexPayOperator,
  isValidBeninPhone,
  formatPhoneDisplay,
  type FeexPayOperator,
} from '@/lib/feexpay/detect-operator';

// Logos opérateurs Mobile Money (officiels dans /public/images/)
const OPERATOR_LOGOS = {
  mtn: '/logos/mtn.png',
  moov: '/logos/moov.png',
  celtiis: '/images/celtiis-cash.png',
} as const;

const OPERATOR_META: Record<FeexPayOperator, { label: string; shortLabel: string; color: string; bg: string; border: string; ring: string }> = {
  mtn: { label: 'MTN Mobile Money', shortLabel: 'MTN', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300', ring: 'ring-yellow-400' },
  moov: { label: 'Moov Money', shortLabel: 'Moov', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-300', ring: 'ring-blue-400' },
  celtiis_bj: { label: 'Celtiis Cash', shortLabel: 'Celtiis', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', ring: 'ring-orange-400' },
};

const METHODS = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'FEEXPAY', label: 'FeexPay (Mobile Money — MTN, Moov, Celtiis)' },
  { value: 'WIRE', label: 'Virement bancaire' },
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
  defaultPaymentMethod,
}: {
  academicYearId: string;
  accounts: any[];
  onClose: () => void;
  onSuccess: () => void;
  defaultPaymentMethod?: string;
}) {
  const [studentAccountId, setStudentAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(defaultPaymentMethod || 'CASH');
  const [reference, setReference] = useState('');
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [openCashRegisters, setOpenCashRegisters] = useState<any[]>([]);
  const [preview, setPreview] = useState<{ totalPay: number; lines: { name: string; pay: number; feeType: string; personalized: boolean; originalAmount?: number }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  // Reçu généré après succès — affiché en bandeau lecture seule
  const [receipt, setReceipt] = useState<{ id: string; receiptNumber: string; createdAt: string } | null>(null);
  const [sendingChannel, setSendingChannel] = useState<string | null>(null);
  const { toast } = useToast();
  const { schoolLevel } = useModuleContext();

  // Sélecteurs niveau + classe + recherche élève
  const [levels, setLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [feexpayOperator, setFeexpayOperator] = useState<FeexPayOperator>('mtn');
  // FeexPay inline widget (pas de modal séparé — meme UX que Fedapay widget)
  const [feexpayInlineOpen, setFeexpayInlineOpen] = useState(false);
  const [feexpayPhone, setFeexpayPhone] = useState('');
  const [feexpaySubmitting, setFeexpaySubmitting] = useState(false);
  const [feexpayError, setFeexpayError] = useState<string | null>(null);
  const [feexpayPrefillPhone, setFeexpayPrefillPhone] = useState<string>('');

  // Charge les caisses ouvertes
  useEffect(() => {
    financeService.getCashRegisters({ isActive: true, isOpen: true })
      .then((data) => setOpenCashRegisters(Array.isArray(data) ? data : []))
      .catch(() => setOpenCashRegisters([]));
  }, []);

  // Charge les niveaux scolaires activés
  useEffect(() => {
    fetch('/api/school-levels')
      .then((r) => r.json())
      .then((d) => setLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setLevels([]));
  }, []);

  // Charge les classes (filtrées par niveau si sélectionné)
  useEffect(() => {
    fetch('/api/all-classes', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : (d.data ?? []);
        setClasses(list);
      })
      .catch(() => setClasses([]));
  }, []);

  // Classes filtrées par niveau sélectionné
  const filteredClasses = useMemo(() => {
    if (!selectedLevelId) return classes;
    // Filtrer par schoolLevelId (UUID school_levels) ou par code de niveau
    const selectedLevel = levels.find((l) => l.id === selectedLevelId);
    const schoolLevelId = selectedLevel?.schoolLevelId || selectedLevelId;
    return classes.filter((c: any) => {
      // Match par schoolLevelId (UUID) ou par schoolLevel.code
      return c.schoolLevelId === schoolLevelId ||
             c.schoolLevel?.code === selectedLevel?.code ||
             c.schoolLevel?.id === schoolLevelId;
    });
  }, [classes, selectedLevelId, levels]);

  // Élèves filtrés par niveau + classe + recherche
  const filteredAccounts = useMemo(() => {
    let result = accounts.filter((a) => Number(a.balance) > 0);

    // Filtrer par niveau si sélectionné (même sans classe spécifique)
    if (selectedLevelId) {
      const selectedLevel = levels.find((l) => l.id === selectedLevelId);
      const schoolLevelId = selectedLevel?.schoolLevelId || selectedLevelId;
      const levelCode = selectedLevel?.code;

      // Les classes de ce niveau
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

    // Filtrer par classe si sélectionnée
    if (selectedClassId) {
      result = result.filter((a) => {
        const enrollments = a.student?.studentEnrollments ?? [];
        return enrollments.some((e: any) => e.classId === selectedClassId);
      });
    }

    // Filtrer par recherche (nom/prénom/matricule)
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

    // ── Fedapay : widget checkout modal + création transaction après succès ──
    // Le widget Fedapay est un overlay professionnel qui demande au client son propre
    // numéro Mobile Money / carte et ses coordonnées. Aucune récupération préalable
    // du téléphone parent n'est nécessaire.
    // ⚠️ Important : après confirmation du paiement dans le widget, on appelle
    // createTransaction côté backend pour créer la FinanceTransaction (sinon le
    // reçu est introuvable et le solde n'est pas mis à jour).
    if (paymentMethod === 'FEDAPAY') {
      if (!selectedAccount?.student) {
        toast({ title: 'Erreur', description: 'Élève introuvable.', variant: 'destructive' });
        return;
      }
      setLoading(true);
      try {
        const studentName = selectedAccount.student
          ? `${selectedAccount.student.lastName} ${selectedAccount.student.firstName}`
          : 'Élève';

        // Récupérer la clé publique Fedapay configurée par l'école
        const keyRes = await fetch('/api/finance/payments/fedapay/public-key', { credentials: 'include' });
        const keyData = await keyRes.json();
        if (!keyData.publicKey) {
          toast({
            title: 'Fedapay non configuré',
            description: "L'école n'a pas configuré Fedapay. Allez dans Paramètres → Paiements pour configurer.",
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        // Charger le script Fedapay checkout dynamiquement
        await new Promise((resolve, reject) => {
          if ((window as any).FedaPay) return resolve(null);
          const script = document.createElement('script');
          script.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7';
          script.onload = () => resolve(null);
          script.onerror = () => reject(new Error('Impossible de charger Fedapay'));
          document.head.appendChild(script);
        });

        // Ouvrir le checkout Fedapay — le client saisit lui-même ses infos
        const FedaPay = (window as any).FedaPay;
        const widget = FedaPay.init({
          public_key: keyData.publicKey,
          transaction: {
            amount: amountNum,
            description: `Scolarité ${studentName}`.substring(0, 100),
          },
          customer: {
            firstname: selectedAccount.student?.firstName || '',
            lastname: selectedAccount.student?.lastName || '',
          },
          onComplete: async (response: any) => {
            if (response?.reason === 'DIALOG DISMISSED') {
              toast({ title: 'Paiement annulé', description: 'Le checkout Fedapay a été fermé.' });
              setLoading(false);
              return;
            }

            // ✅ Succès Fedapay — créer la FinanceTransaction côté backend
            // pour que le reçu soit généré et le solde mis à jour.
            const fedapayReference = response?.reference || '';
            try {
              const result = await financeService.createTransaction({
                academicYearId,
                studentAccountId,
                amount: amountNum,
                paymentMethod: 'FEDAPAY',
                reference: fedapayReference || undefined,
              });
              if (result?.id) {
                setReceipt({
                  id: result.id,
                  receiptNumber: result.receiptNumber || fedapayReference || 'FEDAPAY',
                  createdAt: result.createdAt || new Date().toISOString(),
                });
                toast({
                  title: 'Paiement confirmé',
                  description: `Reçu ${result.receiptNumber} généré. Référence Fedapay : ${fedapayReference}.`,
                });
              } else {
                toast({
                  title: 'Paiement initié',
                  description: `Référence Fedapay : ${fedapayReference}. Le reçu sera généré après confirmation.`,
                });
                setReceipt({
                  id: fedapayReference || 'fedapay-pending',
                  receiptNumber: fedapayReference || 'FEDAPAY',
                  createdAt: new Date().toISOString(),
                });
              }
            } catch (err: any) {
              console.error('createTransaction after Fedapay failed:', err);
              toast({
                title: 'Paiement reçu mais transaction non enregistrée',
                description: `Référence Fedapay : ${fedapayReference}. Contactez l'administrateur pour synchroniser la transaction.`,
                variant: 'destructive',
              });
            } finally {
              setLoading(false);
            }
          },
        });
        widget.open();
      } catch (e: any) {
        toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
        setLoading(false);
      }
      return;
    }

    // ── FeexPay : widget inline (pas de modal séparé) ──
    // FeexPay ne fournit pas de widget officiel. Au lieu d'ouvrir un modal
    // séparé, on bascule le formulaire en mode "widget FeexPay inline" qui
    // remplace les champs habituels par : numéro Mobile Money + sélecteur
    // opérateur + bouton Payer. Même UX que le widget Fedapay mais inline.
    if (paymentMethod === 'FEEXPAY') {
      if (!selectedAccount?.student) {
        toast({ title: 'Erreur', description: 'Élève introuvable.', variant: 'destructive' });
        return;
      }

      // Tenter de pré-remplir avec le téléphone parent (best-effort, non bloquant)
      try {
        const phoneRes = await fetch(
          `/api/finance/transactions/${selectedAccount.id}/whatsapp-link`,
          { credentials: 'include' },
        );
        const phoneData = await phoneRes.json();
        if (phoneData?.phone) {
          setFeexpayPhone(phoneData.phone);
          // Auto-detect operator
          const detected = detectFeexPayOperator(phoneData.phone);
          if (detected) setFeexpayOperator(detected);
        }
      } catch {
        // non bloquant — le client saisira le numéro
      }

      setFeexpayError(null);
      setFeexpayInlineOpen(true);
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
      } else if (status?.status === 'failed') {
        toast({ title: 'Échec d\'envoi', description: status.error || `Échec de l'envoi par ${channel}.`, variant: 'destructive' });
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
    setFeexpayInlineOpen(false);
    setFeexpayPhone('');
    setFeexpayError(null);
  };

  /**
   * Handler du widget FeexPay inline — appelé quand le client clique sur
   * "Payer X FCFA" dans le widget inline. Déclenche le push USSD via
   * /api/finance/payments/feexpay/initiate puis crée la FinanceTransaction
   * côté backend (pour que le reçu soit généré et le solde mis à jour).
   */
  const handleFeexPaySubmit = async () => {
    if (!selectedAccount?.student || !studentAccountId || !amountNum) return;
    if (!isValidBeninPhone(feexpayPhone)) {
      setFeexpayError('Numéro invalide. Format attendu : 01 95 72 22 34 ou +229 01 95 72 22 34.');
      return;
    }
    setFeexpaySubmitting(true);
    setFeexpayError(null);
    try {
      const studentName = selectedAccount.student
        ? `${selectedAccount.student.lastName} ${selectedAccount.student.firstName}`
        : 'Élève';
      const cleanedPhone = feexpayPhone.replace(/\D/g, '');

      // 1. Initier le paiement FeexPay (push USSD au téléphone du client)
      const res = await fetch('/api/finance/payments/feexpay/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          studentAccountId,
          studentName,
          amount: amountNum,
          phone: cleanedPhone,
          operator: feexpayOperator,
          academicYearId,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setFeexpayError(data.message || "Échec de l'initiation du paiement.");
        setFeexpaySubmitting(false);
        return;
      }

      // 2. Succès FeexPay — créer la FinanceTransaction côté backend
      const feexpayReference = data.reference || '';
      try {
        const result = await financeService.createTransaction({
          academicYearId,
          studentAccountId,
          amount: amountNum,
          paymentMethod: 'FEEXPAY',
          reference: feexpayReference || undefined,
        });
        if (result?.id) {
          setReceipt({
            id: result.id,
            receiptNumber: result.receiptNumber || feexpayReference || '—',
            createdAt: result.createdAt || new Date().toISOString(),
          });
          toast({
            title: '📱 Paiement initié',
            description: `Le client va recevoir une notification sur le ${formatPhoneDisplay(cleanedPhone)} pour confirmer. Reçu ${result.receiptNumber} généré.`,
          });
        } else {
          setReceipt({
            id: feexpayReference || 'feexpay-pending',
            receiptNumber: feexpayReference || '—',
            createdAt: new Date().toISOString(),
          });
          toast({
            title: '📱 Paiement initié',
            description: `Notification envoyée sur le ${formatPhoneDisplay(cleanedPhone)}. Référence : ${feexpayReference}.`,
          });
        }
      } catch (err: any) {
        console.error('createTransaction after FeexPay failed:', err);
        setReceipt({
          id: feexpayReference || 'feexpay-pending',
          receiptNumber: feexpayReference || '—',
          createdAt: new Date().toISOString(),
        });
        toast({
          title: 'Paiement initié mais transaction non enregistrée',
          description: `Référence FeexPay : ${feexpayReference}. Contactez l'administrateur pour synchroniser.`,
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      setFeexpayError(e.message || 'Erreur réseau');
    } finally {
      setFeexpaySubmitting(false);
    }
  };

  // Auto-detect operator from phone number for inline widget
  const detectedOperator = useMemo(() => {
    if (feexpayPhone.replace(/\D/g, '').length < 5) return null;
    return detectFeexPayOperator(feexpayPhone);
  }, [feexpayPhone]);

  useEffect(() => {
    if (detectedOperator && detectedOperator !== feexpayOperator) {
      setFeexpayOperator(detectedOperator);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedOperator]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-blue-100 shadow-2xl"
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
              {/* WhatsApp : 2 options (lien + API) */}
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!receipt) return;
                  try {
                    const data = await financeService.getWhatsAppLink(receipt.id);
                    if (data?.url) {
                      window.open(data.url, '_blank');
                      toast({ title: 'WhatsApp ouvert', description: 'Cliquez sur Envoyer dans WhatsApp.' });
                    } else {
                      toast({ title: 'Pas de téléphone', description: 'Aucun numéro de parent trouvé.', variant: 'destructive' });
                    }
                  } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
                }}
              >
                <WhatsAppIcon className="w-3.5 h-3.5 mr-1.5" />
                WhatsApp
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
              <Button size="sm" variant="ghost" onClick={handleNewPayment}>
                Nouveau paiement
              </Button>
              <Button size="sm" variant="outline" onClick={onClose}>
                Fermer
              </Button>
            </div>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ display: (receipt || feexpayInlineOpen) ? 'none' : undefined }}>
          {/* Sélecteurs Niveau + Classe (filtrage en cascade) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Niveau scolaire</Label>
              <Select value={selectedLevelId || 'ALL'} onValueChange={(v) => { setSelectedLevelId(v === 'ALL' ? '' : v); setSelectedClassId(''); }}>
                <SelectTrigger><SelectValue placeholder="Tous les niveaux" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les niveaux</SelectItem>
                  {levels.map((l) => (<SelectItem key={l.id} value={l.id}>{l.label ?? l.code ?? l.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Classe</Label>
              <Select value={selectedClassId || 'ALL'} onValueChange={(v) => setSelectedClassId(v === 'ALL' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toutes les classes</SelectItem>
                  {filteredClasses.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Recherche élève + sélecteur */}
          <div>
            <Label>Élève / Compte</Label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Rechercher par nom, prénom ou matricule..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={studentAccountId} onValueChange={setStudentAccountId}>
              <SelectTrigger><SelectValue placeholder={filteredAccounts.length === 0 ? 'Aucun élève trouvé' : `Sélectionner (${filteredAccounts.length} élève${filteredAccounts.length > 1 ? 's' : ''})`} /></SelectTrigger>
              <SelectContent>
                {filteredAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.studentId} — Solde {formatCurrency(a.balance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filteredAccounts.length === 0 && (selectedClassId || studentSearch) && (
              <p className="text-xs text-slate-400 mt-1">Aucun élève ne correspond aux critères. Ajustez le filtre ou la recherche.</p>
            )}
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
          {/* Note : le sélecteur opérateur Mobile Money pour FeexPay est
              intégré au widget FeexPay inline (palette orange/jaune/noir). */}
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
          <div className="flex gap-2 justify-end pt-4 md:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading || (paymentMethod === 'CASH' && !cashRegisterId)}>
              {loading ? 'Enregistrement...' : 'Valider paiement'}
            </Button>
          </div>
        </form>

        {/* ─────────────────────────────────────────────────────────────── */}
        {/* WIDGET FEEXPAY INLINE — Schéma Fedapay (container inline)      */}
        {/* Palette FeexPay : orange #F79E1B, jaune #FFCB05, noir #1A1A1A  */}
        {/* ─────────────────────────────────────────────────────────────── */}
        {feexpayInlineOpen && !receipt && (
          <div
            id="feexpay-checkout-container"
            className="w-full bg-slate-50 rounded-2xl border-2 border-amber-200 shadow-lg overflow-hidden"
            style={{ minHeight: '520px' }}
          >
            {/* Bandeau branding FeexPay (haut du container, comme Fedapay) */}
            <div className="bg-gradient-to-r from-[#F79E1B] via-[#FFCB05] to-[#F79E1B] px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg px-3 py-1.5 shadow-sm flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-label */}
                  <img src="/logos/feexpay.png" alt="FeexPay" className="h-6 w-auto" />
                </div>
                <div>
                  <h3 className="font-bold text-[#1A1A1A] text-sm leading-tight">
                    Paiement Mobile Money
                  </h3>
                  <p className="text-[10px] text-[#1A1A1A]/70">
                    Transaction sécurisée · FeexPay API v2 · Bénin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFeexpayInlineOpen(false);
                  setFeexpayPhone('');
                  setFeexpayError(null);
                }}
                className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
                aria-label="Fermer"
              >
                <svg className="w-4 h-4 text-[#1A1A1A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Corps du widget — même structure que Fedapay checkout */}
            <div className="bg-white p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Colonne gauche : récapitulatif transaction (fond noir, comme Fedapay) */}
              <aside className="bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D] rounded-xl p-5 text-white flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-[#FFCB05]" />
                  <p className="text-[10px] uppercase tracking-wider text-[#FFCB05] font-semibold">
                    Récapitulatif
                  </p>
                </div>
                <p className="text-xs text-white/60 mb-5">Vérifiez les détails avant de confirmer</p>

                <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Bénéficiaire</p>
                <p className="text-base font-semibold mb-5 leading-tight">
                  {selectedAccount?.student
                    ? `${selectedAccount.student.lastName} ${selectedAccount.student.firstName}`
                    : 'Élève'}
                </p>

                <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Montant à payer</p>
                <p className="text-3xl font-bold text-[#FFCB05] leading-none mb-1">
                  {amountNum.toLocaleString('fr-FR')}
                  <span className="text-base font-medium text-white/60 ml-2">FCFA</span>
                </p>
                <p className="text-xs text-white/40">≈ {(amountNum / 655.957).toFixed(2)} EUR</p>

                {/* Opérateur sélectionné */}
                <div className="mt-5 mb-5">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-2">Opérateur sélectionné</p>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 border border-white/20 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={feexpayOperator === 'mtn' ? OPERATOR_LOGOS.mtn : feexpayOperator === 'moov' ? OPERATOR_LOGOS.moov : OPERATOR_LOGOS.celtiis}
                      alt={OPERATOR_META[feexpayOperator].label}
                      className="h-9 w-9 object-contain rounded bg-white p-1"
                    />
                    <div>
                      <p className="text-sm font-semibold">{OPERATOR_META[feexpayOperator].label}</p>
                      {detectedOperator && (
                        <p className="text-[10px] text-[#FFCB05] flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Détecté automatiquement
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sécurité */}
                <div className="mt-auto pt-4 border-t border-white/10">
                  <div className="flex items-start gap-2 text-[10px] text-white/60">
                    <Lock className="w-3.5 h-3.5 text-[#FFCB05] flex-shrink-0 mt-0.5" />
                    <p>
                      Paiement chiffré SSL. Vos informations ne sont jamais stockées.
                      FeexPay est agréé BCEAO.
                    </p>
                  </div>
                </div>
              </aside>

              {/* Colonne droite : formulaire (comme Fedapay form) */}
              <div className="flex flex-col gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">Coordonnées de paiement</h4>
                  <p className="text-xs text-slate-500">
                    Le client recevra une notification sur son téléphone pour confirmer.
                  </p>
                </div>

                {/* Téléphone */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                    Numéro Mobile Money
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                    <Input
                      type="tel"
                      value={formatPhoneDisplay(feexpayPhone)}
                      onChange={(e) => setFeexpayPhone(e.target.value)}
                      placeholder="Ex : 01 54 12 34 56"
                      className="pl-10 text-base font-medium tracking-wide h-11"
                      autoFocus
                      required
                    />
                  </div>
                  {detectedOperator && (
                    <p className="text-[11px] text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Opérateur détecté : <strong>{OPERATOR_META[detectedOperator].label}</strong>
                    </p>
                  )}
                </div>

                {/* Sélecteur opérateur manuel */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                    Ou choisissez manuellement
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(OPERATOR_META) as FeexPayOperator[]).map((op) => {
                      const meta = OPERATOR_META[op];
                      const isSelected = feexpayOperator === op;
                      return (
                        <button
                          key={op}
                          type="button"
                          onClick={() => setFeexpayOperator(op)}
                          className={`relative px-2 py-2.5 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                            isSelected
                              ? `${meta.bg} ${meta.border} ring-2 ${meta.ring} ring-offset-1`
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={op === 'mtn' ? OPERATOR_LOGOS.mtn : op === 'moov' ? OPERATOR_LOGOS.moov : OPERATOR_LOGOS.celtiis}
                            alt={meta.label}
                            className="h-7 w-7 object-contain"
                          />
                          <span className={`text-[10px] font-semibold ${isSelected ? meta.color : 'text-slate-600'}`}>
                            {meta.shortLabel}
                          </span>
                          {isSelected && (
                            <CheckCircle className="absolute -top-1.5 -right-1.5 w-4 h-4 text-emerald-500 bg-white rounded-full border border-emerald-200" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Info */}
                <div className="bg-amber-50 border border-amber-200 rounded-md p-2.5 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 leading-tight">
                    Une notification sera envoyée. Le client saisit son code PIN Mobile Money pour confirmer.
                  </p>
                </div>

                {/* Error */}
                {feexpayError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-2.5 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-red-800">{feexpayError}</p>
                  </div>
                )}

                {/* Bouton Payer — pleine largeur comme Fedapay */}
                <button
                  type="button"
                  onClick={handleFeexPaySubmit}
                  disabled={feexpaySubmitting}
                  className="w-full bg-gradient-to-r from-[#F79E1B] to-[#FFCB05] hover:from-[#E68A0E] hover:to-[#F0BE04] text-[#1A1A1A] font-bold shadow-md h-12 text-sm rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-auto"
                >
                  {feexpaySubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Initialisation…
                    </>
                  ) : (
                    <>
                      Payer {formatCurrency(amountNum)} FCFA
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-[10px] text-center text-slate-400 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" />
                  Transaction sécurisée · FeexPay API v2
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
