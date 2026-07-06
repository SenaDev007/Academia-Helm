'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Plus, Lock, Unlock, Archive, Edit, Trash2, BarChart3, X,
  Gem, Smartphone, Building2, Store, Banknote, TrendingUp, Clock,
  ArrowUpRight, ArrowDownRight, Receipt, ChevronRight, Sparkles,
  ArrowLeftRight, Send, Loader2, PiggyBank, ArrowDownCircle,
  FileSpreadsheet, FileText,
  CreditCard, Calculator, Boxes, Truck, GraduationCap, BookOpen,
  Users, Coffee, ShieldCheck,
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';
import {
  exportCashRegisterTransactionsToExcel,
  exportAllCashRegistersToExcel,
} from '@/lib/exports/excel-exports';
import {
  cashRegisterFilename,
  allCashRegistersFilename,
} from '@/lib/exports/filename-helpers';

interface CashRegister {
  id: string;
  code: string;
  name: string;
  description?: string;
  location?: string;
  openingBalance: string | number;
  currentBalance: string | number;
  isOpen: boolean;
  isActive: boolean;
  openedAt?: string;
  closedAt?: string;
  createdAt?: string;
  responsibleUser?: { id: string; firstName: string; lastName: string; email: string };
  openedBy?: { id: string; firstName: string; lastName: string };
  closedBy?: { id: string; firstName: string; lastName: string };
  _count?: { transactions: number };
  transactions?: Array<{
    id: string;
    amount: string | number;
    paymentMethod: string;
    receiptNumber?: string;
    reference?: string;
    createdAt: string;
    studentAccount?: {
      student?: { id: string; firstName: string; lastName: string };
    };
  }>;
  // Champs bancaires
  bankName?: string;
  bankAccountNumber?: string;
  bankIBAN?: string;
  bankBranch?: string;
  bankAccountType?: string;
  bankContact?: string;
}

// Helper : choisir l'icône selon le code/nom de la caisse
function getCaisseIcon(reg: CashRegister) {
  const code = (reg.code || '').toUpperCase();
  const name = (reg.name || '').toLowerCase();

  // Caisse principale / coffre-fort
  if (code === 'MAIN' || name.includes('principal') || name.includes('coffre'))
    return Gem;

  // Paiements en ligne (Fedapay / FeexPay)
  if (code === 'ONLINE' || name.includes('en ligne') || name.includes('paiement en ligne'))
    return CreditCard;

  // Tontine / Épargne
  if (code === 'TONTINE' || name.includes('tontine') || name.includes('épargne') || name.includes('epargne'))
    return PiggyBank;

  // Caisse d'accueil / secrétariat
  if (code === 'ACCUEIL' || name.includes('accueil') || name.includes('secrétariat') || name.includes('secretariat'))
    return Users;

  // Caisse cantine
  if (code === 'CANTEEN' || name.includes('cantine') || name.includes('réfectoire'))
    return Coffee;

  // Caisse mobile / terrain
  if (code === 'MOBILE' || name.includes('mobile') || name.includes('cellulaire') || name.includes('terrain'))
    return Smartphone;

  // Caisse comptabilité
  if (code === 'COMPTA' || name.includes('comptab') || name.includes('compte'))
    return Calculator;

  // Caisse économat / magasin
  if (code === 'ECO' || name.includes('économ') || name.includes('economs') || name.includes('magasin'))
    return Boxes;

  // Caisse examen
  if (code === 'EXAMEN' || name.includes('examen') || name.includes('concours'))
    return GraduationCap;

  // Caisse transport
  if (code === 'TRANSPORT' || name.includes('transport'))
    return Truck;

  // Caisse activités parascolaires
  if (code === 'ACTIVITES' || name.includes('activit') || name.includes('parascolaire'))
    return BookOpen;

  // Caisse banque
  if (code === 'BANQUE' || name.includes('banque') || name.includes('bank'))
    return Banknote;

  // Caisse boutique / shop
  if (name.includes('shop') || name.includes('boutique'))
    return Store;

  // Bureau générique
  if (name.includes('bureau'))
    return Building2;

  // Icône par défaut
  return Wallet;
}

// Couleurs pour les caisses secondaires (cycle)
const CAISSE_COLORS = [
  { bg: 'from-blue-500 to-cyan-500', ring: 'ring-blue-400', glow: 'shadow-blue-500/30', text: 'text-blue-600' },
  { bg: 'from-purple-500 to-pink-500', ring: 'ring-purple-400', glow: 'shadow-purple-500/30', text: 'text-purple-600' },
  { bg: 'from-amber-500 to-orange-500', ring: 'ring-amber-400', glow: 'shadow-amber-500/30', text: 'text-amber-600' },
  { bg: 'from-emerald-500 to-teal-500', ring: 'ring-emerald-400', glow: 'shadow-emerald-500/30', text: 'text-emerald-600' },
  { bg: 'from-rose-500 to-red-500', ring: 'ring-rose-400', glow: 'shadow-rose-500/30', text: 'text-rose-600' },
  { bg: 'from-indigo-500 to-violet-500', ring: 'ring-indigo-400', glow: 'shadow-indigo-500/30', text: 'text-indigo-600' },
];

// ============================================================================
// Composant : AnimatedBalance
// Solde animé en rotation continue — défilement de chiffres aléatoires
// pendant quelques secondes, puis affiche le vrai solde.
// L'animation s'arrête au survol (hover) pour permettre la lecture.
// ============================================================================
function AnimatedBalance({ amount, className = '', isMain = false }: { amount: number; className?: string; isMain?: boolean }) {
  const [displayAmount, setDisplayAmount] = useState(amount);
  const [isHovered, setIsHovered] = useState(false);
  const [phase, setPhase] = useState<'rotating' | 'settling' | 'stable'>('rotating');

  useEffect(() => {
    if (isHovered) {
      // Au survol → afficher le vrai montant immédiatement
      setDisplayAmount(amount);
      setPhase('stable');
      return;
    }

    // Phase 1: rotation (chiffres aléatoires pendant 2s)
    setPhase('rotating');
    const rotateInterval = setInterval(() => {
      setDisplayAmount(Math.floor(Math.random() * 900000) + 10000);
    }, 60);

    // Phase 2: settling (défilement ralenti vers le vrai montant pendant 1.5s)
    const settleTimer = setTimeout(() => {
      clearInterval(rotateInterval);
      setPhase('settling');
      const steps = 20;
      const startVal = displayAmount;
      const diff = amount - startVal;
      let step = 0;
      const settleInterval = setInterval(() => {
        step++;
        if (step >= steps) {
          setDisplayAmount(amount);
          setPhase('stable');
          clearInterval(settleInterval);
        } else {
          setDisplayAmount(Math.round(startVal + (diff * step) / steps));
        }
      }, 75);
    }, 2000);

    return () => {
      clearInterval(rotateInterval);
      clearTimeout(settleTimer);
    };
  }, [amount, isHovered]);

  // Phase stable: après 3.5s, relancer l'animation (cycle continu)
  useEffect(() => {
    if (phase !== 'stable' || isHovered) return;
    const restartTimer = setTimeout(() => {
      setPhase('rotating');
    }, 4000); // 4s stable puis relance
    return () => clearTimeout(restartTimer);
  }, [phase, isHovered]);

  const formatted = new Intl.NumberFormat('fr-FR').format(Math.round(displayAmount));

  return (
    <span
      className={`${className} ${phase === 'rotating' ? 'tabular-nums' : ''} transition-opacity`}
      style={{ opacity: phase === 'rotating' ? 0.7 : 1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {formatted}
    </span>
  );
}

// Noms de caisses prédéfinis avec auto-génération de code, emplacement et description
const PREDEFINED_CAISSES = [
  { name: 'Caisse principale', code: 'MAIN', location: 'Bureau de la Direction', description: 'Coffre-fort principal de l\'établissement — toutes les recettes y sont consolidées.' },
  { name: 'Caisse d\'accueil', code: 'ACCUEIL', location: 'Bureau d\'accueil', description: 'Caisse du secrétariat pour les paiements courants (inscriptions, frais divers).' },
  { name: 'Caisse cantine', code: 'CANTEEN', location: 'Réfectoire / Cantine', description: 'Caisse dédiée à la collecte des frais de cantine et snack.' },
  { name: 'Caisse mobile', code: 'MOBILE', location: 'Mobile / Terrain', description: 'Caisse mobile pour les encaissements sur le terrain (événements, sorties).' },
  { name: 'Caisse comptabilité', code: 'COMPTA', location: 'Service comptabilité', description: 'Caisse du service comptable pour les virements et dépenses.' },
  { name: 'Caisse economat', code: 'ECO', location: 'Économat / Magasin', description: 'Caisse de l\'économat pour les achats et approvisionnements.' },
  { name: 'Caisse examen', code: 'EXAMEN', location: 'Salle des examens', description: 'Caisse dédiée aux frais d\'examens et concours.' },
  { name: 'Caisse transport', code: 'TRANSPORT', location: 'Service transport', description: 'Caisse pour la collecte des frais de transport scolaire.' },
  { name: 'Caisse activités', code: 'ACTIVITES', location: 'Service activités parascolaires', description: 'Caisse pour les activités parascolaires, sorties et événements.' },
  { name: 'Caisse banque', code: 'BANQUE', location: 'Banque partenaire', description: 'Caisse de liaison avec le compte bancaire de l\'établissement.' },
  { name: 'Caisse Tontine / Épargne', code: 'TONTINE', location: 'Coffre-fort / Banque', description: 'Caisse d\'épargne isolée pour constituer une réserve financière. Les cotisations (transferts entrants) augmentent l\'épargne, les retraits (transferts sortants) la diminuent. Le solde représente l\'épargne cumulée de l\'établissement.' },
  { name: 'Caisse Paiements en Ligne', code: 'ONLINE', location: 'En ligne', description: 'Caisse virtuelle pour les paiements Fedapay et FeexPay (Mobile Money, carte bancaire). Créée automatiquement au premier paiement en ligne.' },
];

export default function CashRegistersContent() {
  const confirmDialog = useConfirmDialog();
  const { toast } = useToast();
  const { tenant } = useAppSession();
  const { schoolLevel } = useModuleContext();
  const [exporting, setExporting] = useState<'excel' | 'pdf' | 'global-excel' | 'global-pdf' | null>(null);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<CashRegister | null>(null);
  const [closeModal, setCloseModal] = useState<CashRegister | null>(null);
  const [statsModal, setStatsModal] = useState<CashRegister | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [selectedRegister, setSelectedRegister] = useState<CashRegister | null>(null);
  const [transferModal, setTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ fromId: '', toId: '', amount: '', note: '' });
  const [transferPending, setTransferPending] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  // Onglet actif : constellation | historique
  const [activeTab, setActiveTab] = useState<'constellation' | 'historique'>('constellation');
  // Historique des transferts
  const [transfers, setTransfers] = useState<any[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    location: '',
    openingBalance: '0',
    responsibleUserId: '',
    // Champs bancaires
    bankName: '',
    bankAccountNumber: '',
    bankIBAN: '',
    bankBranch: '',
    bankAccountType: '',
    bankContact: '',
  });

  // Détection : le nom de la caisse contient "banque" → afficher les champs bancaires
  const isBankCaisse = formData.name.toLowerCase().includes('banque') || formData.code.toUpperCase() === 'BANQUE';

  const [closeForm, setCloseForm] = useState({
    countedBalance: '',
    note: '',
  });

  const loadRegisters = useCallback(async () => {
    try {
      setLoading(true);
      const data = await financeService.getCashRegisters();
      const list = Array.isArray(data) ? data : [];
      setRegisters(list);
      // Synchroniser la caisse sélectionnée avec les données fraîches
      // (sinon le panneau de détails garde l'ancien solde jusqu'à un rechargement)
      setSelectedRegister((prev) => {
        if (!prev) return prev;
        const updated = list.find((r: any) => r.id === prev.id);
        return updated || prev;
      });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e.message || 'Impossible de charger les caisses',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Charger les détails complets (avec transactions) quand on sélectionne une caisse
  const loadRegisterDetails = useCallback(async (registerId: string) => {
    try {
      const details = await financeService.getCashRegister(registerId);
      if (details) {
        setSelectedRegister(details);
      }
    } catch (e: any) {
      console.warn('Failed to load register details:', e?.message);
    }
  }, []);

  useEffect(() => {
    loadRegisters();
    // Charger le staff non-enseignant (ADMIN + SUPPORT) depuis le module RH
    // pour le sélecteur de responsable de caisse
    Promise.all([
      fetch('/api/hr/staff?category=ADMIN', { credentials: 'include' }).then((r) => r.ok ? r.json() : []),
      fetch('/api/hr/staff?category=SUPPORT', { credentials: 'include' }).then((r) => r.ok ? r.json() : []),
    ])
      .then(([admin, support]) => {
        const all = [...(Array.isArray(admin) ? admin : []), ...(Array.isArray(support) ? support : [])];
        setStaffList(all);
      })
      .catch(() => setStaffList([]));
  }, [loadRegisters]);

  // Charger l'historique des transferts
  const loadTransfers = useCallback(async () => {
    setTransfersLoading(true);
    try {
      const data = await financeService.getCashRegisterTransfers({ limit: 100 });
      setTransfers(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('loadTransfers error:', e);
      setTransfers([]);
    } finally {
      setTransfersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'historique') {
      loadTransfers();
    }
  }, [activeTab, loadTransfers]);

  // Charger les transferts quand on sélectionne une caisse (pour les stats tontine
  // et la traçabilité des entrants/sortants)
  useEffect(() => {
    if (selectedRegister) {
      loadTransfers();
    }
  }, [selectedRegister?.id, loadTransfers]);

  // Identifier la caisse principale (code MAIN ou première créée)
  const mainRegister = useMemo(() => {
    return registers.find((r) => r.code?.toUpperCase() === 'MAIN') || registers[0] || null;
  }, [registers]);

  // Caisses secondaires (toutes sauf la principale)
  const secondaryRegisters = useMemo(() => {
    if (!mainRegister) return registers;
    return registers.filter((r) => r.id !== mainRegister.id);
  }, [registers, mainRegister]);

  // Statistiques globales
  const globalStats = useMemo(() => {
    const totalBalance = registers.reduce((sum, r) => sum + Number(r.currentBalance || 0), 0);
    const openCount = registers.filter((r) => r.isOpen).length;
    const totalTransactions = registers.reduce((sum, r) => sum + (r._count?.transactions || 0), 0);
    return { totalBalance, openCount, totalCaisses: registers.length, totalTransactions };
  }, [registers]);

  // Handler : sélection d'un nom prédéfini → auto-génère code, emplacement, description
  const selectPredefinedCaisse = (predef: typeof PREDEFINED_CAISSES[0]) => {
    setFormData((prev) => ({
      ...prev,
      name: predef.name,
      code: predef.code,
      location: predef.location,
      description: predef.description,
    }));
  };

  // Handler : nom personnalisé → vide les champs auto-générés si le nom ne match plus
  const handleNameChange = (name: string) => {
    const match = PREDEFINED_CAISSES.find((p) => p.name === name);
    setFormData((prev) => ({
      ...prev,
      name,
      // Si le nom correspond à un prédéfini, auto-générer
      ...(match ? { code: match.code, location: match.location, description: match.description } : {}),
    }));
  };

  const handleCreate = async () => {
    if (!formData.code || !formData.name) {
      toast({ title: 'Erreur', description: 'Code et nom sont requis', variant: 'destructive' });
      return;
    }
    try {
      await financeService.createCashRegister({
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        location: formData.location || undefined,
        openingBalance: Number(formData.openingBalance) || 0,
        responsibleUserId: formData.responsibleUserId || undefined,
        // Champs bancaires (envoyés seulement si la caisse est de type banque)
        ...(isBankCaisse ? {
          bankName: formData.bankName || undefined,
          bankAccountNumber: formData.bankAccountNumber || undefined,
          bankIBAN: formData.bankIBAN || undefined,
          bankBranch: formData.bankBranch || undefined,
          bankAccountType: formData.bankAccountType || undefined,
          bankContact: formData.bankContact || undefined,
        } : {}),
      });
      toast({ title: '✅ Caisse créée', description: `${formData.code} - ${formData.name}` });
      setCreateModal(false);
      setFormData({ code: '', name: '', description: '', location: '', openingBalance: '0', responsibleUserId: '', bankName: '', bankAccountNumber: '', bankIBAN: '', bankBranch: '', bankAccountType: '', bankContact: '' });
      loadRegisters();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleUpdate = async () => {
    if (!editModal) return;
    try {
      const updated = await financeService.updateCashRegister(editModal.id, {
        name: editModal.name,
        description: editModal.description,
        location: editModal.location,
        responsibleUserId: editModal.responsibleUserId || undefined,
        // Soldes — modifiables depuis le modal d'édition
        openingBalance: Number(editModal.openingBalance) || 0,
        currentBalance: Number(editModal.currentBalance) || 0,
        // Champs bancaires
        bankName: editModal.bankName || undefined,
        bankAccountNumber: editModal.bankAccountNumber || undefined,
        bankIBAN: editModal.bankIBAN || undefined,
        bankBranch: editModal.bankBranch || undefined,
        bankAccountType: editModal.bankAccountType || undefined,
        bankContact: editModal.bankContact || undefined,
      });
      toast({ title: '✅ Caisse mise à jour', description: 'Les modifications ont été enregistrées.' });
      setEditModal(null);
      // Mise à jour immédiate du panneau de détails si la caisse éditée est sélectionnée
      if (selectedRegister && selectedRegister.id === editModal.id) {
        setSelectedRegister({ ...selectedRegister, ...editModal });
      }
      // Recharger la liste pour propager les changements
      await loadRegisters();
    } catch (e: any) {
      console.error('Erreur update caisse:', e);
      toast({ title: 'Erreur', description: e.message || 'Une erreur est survenue.', variant: 'destructive' });
    }
  };

  const handleOpen = async (reg: CashRegister) => {
    try {
      await financeService.openCashRegister(reg.id, {});
      toast({ title: '🔓 Caisse ouverte', description: `${reg.code} - ${reg.name}` });
      loadRegisters();
      if (selectedRegister?.id === reg.id) {
        setSelectedRegister({ ...reg, isOpen: true });
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleClose = async () => {
    if (!closeModal) return;
    try {
      const result = await financeService.closeCashRegister(closeModal.id, {
        countedBalance: closeForm.countedBalance ? Number(closeForm.countedBalance) : undefined,
      });
      if (result.closure?.hasDiscrepancy) {
        toast({
          title: '⚠️ Écart détecté',
          description: `Écart de ${formatCurrency(result.closure.discrepancy)} XOF`,
          variant: 'destructive',
        });
      } else {
        toast({ title: '🔒 Caisse fermée' });
      }
      setCloseModal(null);
      setCloseForm({ countedBalance: '', note: '' });
      loadRegisters();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  // Export Excel d'une caisse spécifique
  const handleExportRegisterExcel = async () => {
    if (!selectedRegister) return;
    setExporting('excel');
    try {
      await exportCashRegisterTransactionsToExcel(
        selectedRegister,
        selectedRegister.transactions || [],
        transfers,
        {
          schoolName: tenant?.name || 'Établissement',
          schoolLogoUrl: tenant?.id ? `/api/tenants/${tenant.id}/logo` : null,
          schoolLevel: schoolLevel?.code || undefined,
          schoolAddress: tenant?.address || null,
          schoolPhone: tenant?.phone || null,
          schoolEmail: tenant?.email || null,
        }
      );
      toast({ title: '✅ Export Excel généré', description: `Caisse ${selectedRegister.code}` });
    } catch (e: any) {
      toast({ title: 'Erreur export Excel', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  // Export PDF d'une caisse spécifique
  const handleExportRegisterPdf = async () => {
    if (!selectedRegister) return;
    setExporting('pdf');
    try {
      // Utiliser le backend Puppeteer pour un PDF professionnel
      const res = await fetch(`/api/finance/exports/cash-register/pdf?registerId=${selectedRegister.id}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      toast({ title: '✅ PDF généré', description: `Caisse ${selectedRegister.code}` });
    } catch (e: any) {
      toast({ title: 'Erreur export PDF', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  // Export Excel global (toutes les caisses)
  const handleExportGlobalExcel = async () => {
    setExporting('global-excel');
    try {
      await exportAllCashRegistersToExcel(registers, transfers, {
        schoolName: tenant?.name || 'Établissement',
        schoolLogoUrl: tenant?.id ? `/api/tenants/${tenant.id}/logo` : null,
        schoolLevel: schoolLevel?.code || undefined,
        schoolAddress: tenant?.address || null,
        schoolPhone: tenant?.phone || null,
        schoolEmail: tenant?.email || null,
      });
      toast({ title: '✅ Export Excel global généré', description: `${registers.length} caisse(s)` });
    } catch (e: any) {
      toast({ title: 'Erreur export Excel', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  // Export PDF global (toutes les caisses)
  const handleExportGlobalPdf = async () => {
    setExporting('global-pdf');
    try {
      // Utiliser le backend Puppeteer pour un PDF professionnel
      const res = await fetch(`/api/finance/exports/cash-registers/pdf`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      toast({ title: '✅ PDF global généré', description: `${registers.length} caisse(s)` });
    } catch (e: any) {
      toast({ title: 'Erreur export PDF', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  const handleArchive = async (reg: CashRegister) => {
    const ok = await confirmDialog.danger(
      `La caisse "${reg.code} - ${reg.name}" sera archivée. Elle ne pourra plus être utilisée.`,
      'Archiver',
    );
    if (!ok) return;
    try {
      await financeService.archiveCashRegister(reg.id);
      toast({ title: '📦 Caisse archivée' });
      loadRegisters();
      if (selectedRegister?.id === reg.id) setSelectedRegister(null);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleStats = async (reg: CashRegister) => {
    try {
      const data = await financeService.getCashRegisterStats(reg.id);
      setStats(data);
      setStatsModal(reg);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  // Ouvrir le modal de transfert (pré-rempli avec la caisse sélectionnée si possible)
  const openTransfer = (fromReg?: CashRegister) => {
    setTransferForm({
      fromId: fromReg?.id || '',
      toId: '',
      amount: '',
      note: '',
    });
    setTransferModal(true);
  };

  const handleTransfer = async () => {
    if (!transferForm.fromId || !transferForm.toId) {
      toast({ title: 'Erreur', description: 'Sélectionnez les caisses source et cible', variant: 'destructive' });
      return;
    }
    if (transferForm.fromId === transferForm.toId) {
      toast({ title: 'Erreur', description: 'Les caisses source et cible doivent être différentes', variant: 'destructive' });
      return;
    }
    const amount = parseFloat(transferForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Erreur', description: 'Montant invalide', variant: 'destructive' });
      return;
    }
    setTransferPending(true);
    try {
      const result = await financeService.transferCashRegister({
        fromId: transferForm.fromId,
        toId: transferForm.toId,
        amount,
        note: transferForm.note || undefined,
      });
      toast({
        title: '✅ Transfert réussi',
        description: `${formatCurrency(amount)} XOF transférés de ${result.from.code} vers ${result.to.code}`,
      });
      setTransferModal(false);
      loadRegisters();
      // Recharger aussi l'historique des transferts (au cas où l'utilisateur
      // est sur l'onglet Historique, il verra le nouveau transfert immédiatement)
      loadTransfers();
      if (selectedRegister) {
        // Mettre à jour le solde affiché dans le panneau de détails
        const updated = result.from.id === selectedRegister.id ? result.from : result.to.id === selectedRegister.id ? result.to : null;
        if (updated) {
          setSelectedRegister({ ...selectedRegister, currentBalance: String(updated.newBalance) });
        }
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setTransferPending(false);
    }
  };

  // Position des caisses secondaires en cercle autour du coffre-fort
  // Le rayon et la hauteur de la zone s'adaptent dynamiquement au nombre de caisses
  // pour éviter la compression visuelle.
  const getPosition = (index: number, total: number) => {
    if (total <= 0) return { x: 0, y: 0 };
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2; // Commence en haut
    // Rayon dynamique : croît avec le nombre de caisses, sans plafond arbitraire
    // 160px pour 1 caisse, +40px par caisse supplémentaire (sans limite haute)
    const radius = Math.max(180, 140 + total * 45);
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  };

  // Hauteur dynamique de la zone de constellation.
  // Doit accommoder le diamètre du cercle + la taille des cartes (~200px) + padding.
  const constellationHeight = useMemo(() => {
    const total = secondaryRegisters.length;
    const radius = Math.max(180, 140 + total * 45);
    const diameter = radius * 2;
    // 320 = cartes (200) + padding haut/bas (120)
    return Math.max(640, diameter + 320);
  }, [secondaryRegisters.length]);

  return (
    <>
      {confirmDialog.dialog}
      <ModuleContentArea
        layout="custom"
        toolbar={
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-slate-600">
              Gestion des caisses — coffre-fort central et caisses secondaires.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => setCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle caisse
              </Button>
              <Button variant="outline" onClick={() => openTransfer()} disabled={registers.filter((r) => r.isOpen).length < 2}>
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Transférer
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportGlobalExcel} disabled={exporting !== null || registers.length === 0}>
                {exporting === 'global-excel' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Excel global
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportGlobalPdf} disabled={exporting !== null || registers.length === 0}>
                {exporting === 'global-pdf' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                PDF global
              </Button>
            </div>
          </div>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
          </div>
        ) : registers.length === 0 ? (
          <div className="text-center py-24">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Gem className="h-16 w-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 mb-4 text-lg">Aucune caisse configurée</p>
              <Button onClick={() => setCreateModal(true)} size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Créer le coffre-fort principal
              </Button>
            </motion.div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* === BANDEAU STATISTIQUES GLOBALES === */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white rounded-xl p-4 shadow-lg"
              >
                <p className="text-xs text-slate-400 uppercase tracking-wide">Solde total</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(globalStats.totalBalance)}</p>
                <p className="text-xs text-slate-400 mt-0.5">FCFA</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
              >
                <p className="text-xs text-slate-500 uppercase tracking-wide">Caisses ouvertes</p>
                <p className="text-2xl font-bold mt-1 text-emerald-600">{globalStats.openCount}<span className="text-slate-400 text-lg">/{globalStats.totalCaisses}</span></p>
                <div className="flex gap-1 mt-1">
                  {registers.map((r) => (
                    <div key={r.id} className={`w-2 h-2 rounded-full ${r.isOpen ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                  ))}
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
              >
                <p className="text-xs text-slate-500 uppercase tracking-wide">Transactions totales</p>
                <p className="text-2xl font-bold mt-1 text-indigo-600">{globalStats.totalTransactions}</p>
                <p className="text-xs text-slate-400 mt-0.5">toutes caisses</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
              >
                <p className="text-xs text-slate-500 uppercase tracking-wide">Caisses actives</p>
                <p className="text-2xl font-bold mt-1 text-blue-600">{registers.filter((r) => r.isActive).length}</p>
                <p className="text-xs text-slate-400 mt-0.5">caisses configurées</p>
              </motion.div>
            </div>

            {/* === ONGLETS : Constellation | Historique === */}
            <div className="flex items-center gap-2 border-b border-slate-200">
              <button
                onClick={() => setActiveTab('constellation')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'constellation'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  Caisses
                </div>
              </button>
              <button
                onClick={() => setActiveTab('historique')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'historique'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Historique des transferts
                  {transfers.length > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 text-indigo-700">
                      {transfers.length}
                    </span>
                  )}
                </div>
              </button>
            </div>

            {/* === CONTENU ONGLET CONSTELLATION === */}
            {activeTab === 'constellation' && (
            <>
            {/* === CONSTELLATION COFFRE-FORT + CAISSES === */}
            <div
              className="relative bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200 overflow-hidden transition-all duration-500 ease-out"
              style={{ minHeight: `${constellationHeight}px`, height: `${constellationHeight}px` }}
            >

              {/* Décor : grille subtile en fond */}
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
                backgroundSize: '30px 30px',
              }} />

              {/* SVG pour les lignes de connexion */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                {secondaryRegisters.map((reg, idx) => {
                  const pos = getPosition(idx, secondaryRegisters.length);
                  return (
                    <line
                      key={reg.id}
                      x1="50%"
                      y1="50%"
                      x2={`calc(50% + ${pos.x}px)`}
                      y2={`calc(50% + ${pos.y}px)`}
                      stroke={reg.isOpen ? '#10b981' : '#cbd5e1'}
                      strokeWidth="1.5"
                      strokeDasharray={reg.isOpen ? '0' : '4 4'}
                      opacity="0.5"
                    />
                  );
                })}
              </svg>

              {/* COFFRE-FORT CENTRAL */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ zIndex: 2 }}>
                <motion.button
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedRegister(mainRegister)}
                  className="relative group"
                >
                  {/* Halo pulsant */}
                  {mainRegister?.isOpen && (
                    <motion.div
                      className="absolute inset-0 rounded-3xl bg-emerald-400/30"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.5, 0, 0.5],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                    />
                  )}
                  {/* Second halo (décalé) */}
                  {mainRegister?.isOpen && (
                    <motion.div
                      className="absolute inset-0 rounded-3xl bg-indigo-400/20"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.3, 0, 0.3],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: 0.5,
                      }}
                    />
                  )}

                  {/* Carte coffre-fort */}
                  <div className={`relative bg-gradient-to-br ${mainRegister?.isOpen ? 'from-slate-900 via-indigo-900 to-slate-900' : 'from-slate-700 to-slate-900'} text-white rounded-3xl p-6 shadow-2xl ring-2 ${mainRegister?.isOpen ? 'ring-emerald-400/50' : 'ring-slate-500/30'} backdrop-blur-md w-64`}>
                    {/* Effet de brillance */}
                    <div className="absolute inset-0 rounded-3xl opacity-20" style={{
                      background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
                    }} />

                    <div className="relative">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                          <Gem className="w-6 h-6 text-white" />
                        </div>
                        {mainRegister?.isOpen ? (
                          <div className="flex items-center gap-1.5">
                            <motion.div
                              className="w-2 h-2 rounded-full bg-emerald-400"
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            />
                            <span className="text-xs text-emerald-300 font-medium">Ouverte</span>
                          </div>
                        ) : (
                          <Badge className="bg-slate-600/50 text-slate-300">
                            <Lock className="w-3 h-3 mr-1" />Fermée
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">{mainRegister?.code || 'MAIN'}</p>
                      <p className="text-sm font-semibold text-white mb-1">{mainRegister?.name || 'Caisse principale'}</p>
                      {/* Description défilante (marquee) */}
                      {mainRegister?.description && (
                        <div className="relative overflow-hidden h-4 mb-2">
                          <motion.div
                            className="absolute whitespace-nowrap text-[10px] text-slate-300"
                            animate={{ x: ['100%', '-100%'] }}
                            transition={{
                              duration: mainRegister.description.length > 50 ? 15 : 10,
                              repeat: Infinity,
                              ease: 'linear',
                            }}
                          >
                            {mainRegister.description}
                          </motion.div>
                        </div>
                      )}
                      <p className="text-3xl font-bold text-white"><AnimatedBalance amount={Number(mainRegister?.currentBalance || 0)} isMain className="text-white" /></p>
                      <p className="text-xs text-slate-400 mt-1">FCFA · {mainRegister?._count?.transactions || 0} transactions</p>
                    </div>
                  </div>
                </motion.button>

                {/* Label COFFRE-FORT */}
                <div className="text-center mt-3">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">
                    💎 Coffre-Fort
                  </span>
                </div>
              </div>

              {/* CAISSES SECONDAIRES — disposées en cercle */}
              {secondaryRegisters.map((reg, idx) => {
                const pos = getPosition(idx, secondaryRegisters.length);
                const color = CAISSE_COLORS[idx % CAISSE_COLORS.length];
                const Icon = getCaisseIcon(reg);
                return (
                  <div
                    key={reg.id}
                    className="absolute top-1/2 left-1/2"
                    style={{
                      transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                      zIndex: 2,
                    }}
                  >
                    <motion.button
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3 + idx * 0.1, type: 'spring', stiffness: 200 }}
                      whileHover={{ scale: 1.08, y: -4 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => loadRegisterDetails(reg.id)}
                      className="relative group"
                    >
                      {/* Halo si ouverte */}
                      {reg.isOpen && (
                        <motion.div
                          className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${color.bg} opacity-30`}
                          animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity, delay: idx * 0.3 }}
                        />
                      )}

                      {/* Carte caisse secondaire */}
                      <div className={`relative bg-white rounded-2xl p-4 shadow-lg ring-1 ${reg.isOpen ? `ring-2 ${color.ring} ${color.glow} shadow-xl` : 'ring-slate-200'} w-44 transition-all`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color.bg} flex items-center justify-center shadow-md`}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          {reg.isOpen ? (
                            <motion.div
                              className="w-2 h-2 rounded-full bg-emerald-400"
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            />
                          ) : (
                            <Lock className="w-3 h-3 text-slate-300" />
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-mono">{reg.code}</p>
                        <p className="text-xs font-semibold text-slate-800 truncate">{reg.name}</p>
                        {/* Description défilante (marquee) si elle est longue */}
                        {reg.description && (
                          <div className="relative overflow-hidden h-4 mt-0.5">
                            <motion.div
                              className="absolute whitespace-nowrap text-[10px] text-slate-500"
                              animate={{ x: ['100%', '-100%'] }}
                              transition={{
                                duration: reg.description.length > 40 ? 12 : 8,
                                repeat: Infinity,
                                ease: 'linear',
                              }}
                            >
                              {reg.description}
                            </motion.div>
                          </div>
                        )}
                        <p className={`text-lg font-bold ${color.text} mt-1`}><AnimatedBalance amount={Number(reg.currentBalance || 0)} className={color.text} /></p>
                        <p className="text-[10px] text-slate-400">{reg._count?.transactions || 0} transactions</p>
                        {!reg.isActive && (
                          <div className="absolute top-1 right-1">
                            <Archive className="w-3 h-3 text-slate-300" />
                          </div>
                        )}
                      </div>
                    </motion.button>
                  </div>
                );
              })}

              {/* Légende en bas */}
              <div className="absolute bottom-3 left-3 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400" /> Ouverte</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-300" /> Fermée</span>
                <span className="flex items-center gap-1"><Archive className="w-3 h-3" /> Archivée</span>
              </div>
            </div>
            </>
            )}

            {/* === CONTENU ONGLET HISTORIQUE === */}
            {activeTab === 'historique' && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                {transfersLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
                  </div>
                ) : transfers.length === 0 ? (
                  <div className="text-center py-16">
                    <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 text-sm">Aucun transfert enregistré pour le moment.</p>
                    <p className="text-slate-400 text-xs mt-1">Les transferts entre caisses apparaîtront ici automatiquement.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">Caisse source</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">Caisse cible</th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-600">Montant</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">Note</th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">Référence</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transfers.map((t: any, idx: number) => {
                          const isAutoAlloc = t.status === 'AUTO_ALLOCATION';
                          return (
                          <tr key={t.id || idx} className={`hover:bg-slate-50 ${isAutoAlloc ? 'bg-violet-50/30' : ''}`}>
                            <td className="px-4 py-3 text-xs text-slate-600">
                              {t.createdAt ? new Date(t.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                              {isAutoAlloc && (
                                <span className="ml-1 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-100 text-violet-700">
                                  AUTO
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${isAutoAlloc ? 'bg-violet-50 text-violet-700' : 'bg-rose-50 text-rose-700'}`}>
                                  {t.fromCode || '—'}
                                </span>
                                <span className="text-xs text-slate-600">{t.fromName || ''}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${isAutoAlloc ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                  {t.toCode || '—'}
                                </span>
                                <span className="text-xs text-slate-600">{t.toName || ''}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-indigo-600">
                              {formatCurrency(Number(t.amount || 0))}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">
                              {t.note || '—'}
                            </td>
                            <td className="px-4 py-3 text-[10px] font-mono text-slate-400">
                              {t.reference || '—'}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* === PANNEAU DÉTAILS (au clic sur une caisse) === */}
            <AnimatePresence mode="wait">
              {selectedRegister && (() => {
                // Calculer la couleur de la caisse sélectionnée
                const isMain = selectedRegister.code?.toUpperCase() === 'MAIN' || selectedRegister === mainRegister;
                const secondaryIdx = secondaryRegisters.findIndex((r) => r.id === selectedRegister.id);
                const color = isMain ? null : CAISSE_COLORS[secondaryIdx % CAISSE_COLORS.length];
                const headerBg = isMain
                  ? 'from-slate-900 via-indigo-900 to-slate-900'
                  : color?.bg ?? 'from-slate-700 to-slate-900';
                return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
                >
                  {/* En-tête du panneau — couleur de la caisse */}
                  <div className={`bg-gradient-to-r ${headerBg} text-white p-5`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                          {(() => {
                            const Icon = getCaisseIcon(selectedRegister);
                            return <Icon className="w-6 h-6 text-white" />;
                          })()}
                        </div>
                        <div>
                          <p className="text-xs text-white/70 uppercase tracking-wide">{selectedRegister.code}</p>
                          <h3 className="text-lg font-bold text-white">{selectedRegister.name}</h3>
                          <p className="text-xs text-white/70">{selectedRegister.location || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedRegister.isOpen ? (
                          <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                            <motion.div className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
                            Ouverte
                          </Badge>
                        ) : selectedRegister.isActive ? (
                          <Badge className="bg-white/20 text-white/80">
                            <Lock className="w-3 h-3 mr-1" />Fermée
                          </Badge>
                        ) : (
                          <Badge className="bg-white/20 text-white/60">
                            <Archive className="w-3 h-3 mr-1" />Archivée
                          </Badge>
                        )}
                        <button onClick={() => setSelectedRegister(null)} className="text-white/60 hover:text-white p-1">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Corps du panneau */}
                  <div className="p-5 space-y-4">
                    {/* KPI cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <p className="text-xs text-slate-500">Solde courant</p>
                        <p className="text-xl font-bold text-slate-900">{formatCurrency(Number(selectedRegister.currentBalance || 0))}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <p className="text-xs text-slate-500">Solde d'ouverture</p>
                        <p className="text-xl font-bold text-slate-700">{formatCurrency(Number(selectedRegister.openingBalance || 0))}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <p className="text-xs text-slate-500">Transactions</p>
                        <p className="text-xl font-bold text-indigo-600">{selectedRegister._count?.transactions || 0}</p>
                      </div>
                    </div>

                    {/* Statistiques spéciales pour la caisse Tontine / Épargne */}
                    {selectedRegister.code === 'TONTINE' && (() => {
                      const tontineTransfers = transfers.filter((t: any) =>
                        t.fromCashRegisterId === selectedRegister.id || t.toCashRegisterId === selectedRegister.id
                      );
                      const totalCotisations = tontineTransfers
                        .filter((t: any) => t.toCashRegisterId === selectedRegister.id)
                        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
                      const totalRetraits = tontineTransfers
                        .filter((t: any) => t.fromCashRegisterId === selectedRegister.id)
                        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
                      const nbCotisations = tontineTransfers.filter((t: any) => t.toCashRegisterId === selectedRegister.id).length;
                      const nbRetraits = tontineTransfers.filter((t: any) => t.fromCashRegisterId === selectedRegister.id).length;
                      const daysSinceCreation = selectedRegister.createdAt
                        ? Math.max(1, Math.floor((Date.now() - new Date(selectedRegister.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
                        : 1;
                      const croissanceMoyenne = totalCotisations / daysSinceCreation;

                      return (
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-200">
                          <div className="flex items-center gap-2 mb-3">
                            <PiggyBank className="w-4 h-4 text-emerald-600" />
                            <p className="text-sm font-semibold text-emerald-800">Épargne Tontine — Suivi</p>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-white rounded-lg p-2.5 border border-emerald-100">
                              <p className="text-[10px] text-emerald-600 uppercase font-semibold">Total cotisations</p>
                              <p className="text-base font-bold text-emerald-700">{formatCurrency(totalCotisations)}</p>
                              <p className="text-[10px] text-slate-400">{nbCotisations} cotisation(s)</p>
                            </div>
                            <div className="bg-white rounded-lg p-2.5 border border-rose-100">
                              <p className="text-[10px] text-rose-600 uppercase font-semibold">Total retraits</p>
                              <p className="text-base font-bold text-rose-700">{formatCurrency(totalRetraits)}</p>
                              <p className="text-[10px] text-slate-400">{nbRetraits} retrait(s)</p>
                            </div>
                            <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                              <p className="text-[10px] text-slate-500 uppercase font-semibold">Épargne nette</p>
                              <p className="text-base font-bold text-slate-800">{formatCurrency(totalCotisations - totalRetraits)}</p>
                              <p className="text-[10px] text-slate-400">Cotisations − Retraits</p>
                            </div>
                            <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                              <p className="text-[10px] text-blue-600 uppercase font-semibold">Croissance / jour</p>
                              <p className="text-base font-bold text-blue-700">{formatCurrency(croissanceMoyenne)}</p>
                              <p className="text-[10px] text-slate-400">{daysSinceCreation} jour(s) depuis création</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Infos détaillées */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Responsable</p>
                        <p className="font-medium text-slate-800">
                          {selectedRegister.responsibleUser
                            ? `${selectedRegister.responsibleUser.firstName} ${selectedRegister.responsibleUser.lastName}`
                            : 'Non assigné'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Dernière ouverture</p>
                        <p className="font-medium text-slate-800">
                          {selectedRegister.openedAt
                            ? new Date(selectedRegister.openedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Ouverte par</p>
                        <p className="font-medium text-slate-800">
                          {selectedRegister.openedBy
                            ? `${selectedRegister.openedBy.firstName} ${selectedRegister.openedBy.lastName}`
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Dernière fermeture</p>
                        <p className="font-medium text-slate-800">
                          {selectedRegister.closedAt
                            ? new Date(selectedRegister.closedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </p>
                      </div>
                    </div>

                    {selectedRegister.description && (
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Description</p>
                        <p className="text-sm text-slate-700">{selectedRegister.description}</p>
                      </div>
                    )}

                    {/* Informations bancaires — affichées si la caisse a des infos banque */}
                    {selectedRegister.bankName && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Banknote className="w-4 h-4 text-amber-600" />
                          <p className="text-sm font-semibold text-amber-800">Informations bancaires</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {selectedRegister.bankName && (
                            <div><span className="text-xs text-slate-500">Banque :</span> <span className="font-medium text-slate-800">{selectedRegister.bankName}</span></div>
                          )}
                          {selectedRegister.bankAccountNumber && (
                            <div><span className="text-xs text-slate-500">N° compte :</span> <span className="font-mono text-slate-800">{selectedRegister.bankAccountNumber}</span></div>
                          )}
                          {selectedRegister.bankIBAN && (
                            <div><span className="text-xs text-slate-500">IBAN :</span> <span className="font-mono text-xs text-slate-800">{selectedRegister.bankIBAN}</span></div>
                          )}
                          {selectedRegister.bankBranch && (
                            <div><span className="text-xs text-slate-500">Agence :</span> <span className="text-slate-800">{selectedRegister.bankBranch}</span></div>
                          )}
                          {selectedRegister.bankAccountType && (
                            <div><span className="text-xs text-slate-500">Type :</span> <span className="text-slate-800">{selectedRegister.bankAccountType === 'COURANT' ? 'Compte courant' : 'Compte épargne'}</span></div>
                          )}
                          {selectedRegister.bankContact && (
                            <div><span className="text-xs text-slate-500">Contact :</span> <span className="text-slate-800">{selectedRegister.bankContact}</span></div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Transactions récentes de cette caisse */}
                    {selectedRegister.transactions && selectedRegister.transactions.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-slate-500">Transactions récentes (encaissements)</p>
                          <Badge variant="outline" className="text-[10px]">
                            {selectedRegister._count?.transactions || selectedRegister.transactions.length} au total
                          </Badge>
                        </div>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Date</th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Élève</th>
                                  <th className="px-3 py-2 text-right font-medium text-slate-600 text-xs">Montant</th>
                                  <th className="px-3 py-2 text-center font-medium text-slate-600 text-xs">Méthode</th>
                                  <th className="px-3 py-2 text-left font-medium text-slate-600 text-xs">Reçu</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {selectedRegister.transactions.map((tx: any) => {
                                  const methodLabels: Record<string, string> = {
                                    CASH: '💵 Espèces',
                                    FEDAPAY: '💳 Fedapay',
                                    FEEXPAY: '📱 FeexPay',
                                    WIRE: '🏦 Virement',
                                    MOBILE_MONEY: '📱 Mobile Money',
                                  };
                                  const methodColors: Record<string, string> = {
                                    CASH: 'bg-emerald-50 text-emerald-700',
                                    FEDAPAY: 'bg-violet-50 text-violet-700',
                                    FEEXPAY: 'bg-amber-50 text-amber-700',
                                    WIRE: 'bg-blue-50 text-blue-700',
                                    MOBILE_MONEY: 'bg-orange-50 text-orange-700',
                                  };
                                  return (
                                    <tr key={tx.id} className="hover:bg-slate-50">
                                      <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                                        {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
                                        <span className="text-slate-400 ml-1">
                                          {tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-xs font-medium text-slate-800">
                                        {tx.studentAccount?.student
                                          ? `${tx.studentAccount.student.lastName} ${tx.studentAccount.student.firstName}`
                                          : '—'}
                                      </td>
                                      <td className="px-3 py-2 text-xs text-right font-mono font-semibold text-emerald-700">
                                        +{formatCurrency(Number(tx.amount))}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${methodColors[tx.paymentMethod] || 'bg-slate-50 text-slate-700'}`}>
                                          {methodLabels[tx.paymentMethod] || tx.paymentMethod}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 text-xs font-mono text-slate-500">
                                        {tx.receiptNumber || '—'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                      {selectedRegister.isActive && !selectedRegister.isOpen && (
                        <Button onClick={() => handleOpen(selectedRegister)} className="bg-emerald-600 hover:bg-emerald-700">
                          <Unlock className="h-4 w-4 mr-2" />Ouvrir la caisse
                        </Button>
                      )}
                      {selectedRegister.isOpen && (
                        <Button
                          onClick={() => {
                            setCloseModal(selectedRegister);
                            setCloseForm({ countedBalance: String(selectedRegister.currentBalance), note: '' });
                          }}
                          className="bg-rose-600 hover:bg-rose-700"
                        >
                          <Lock className="h-4 w-4 mr-2" />Fermer la caisse
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => handleStats(selectedRegister)}>
                        <BarChart3 className="h-4 w-4 mr-2" />Statistiques
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportRegisterExcel} disabled={exporting !== null}>
                        {exporting === 'excel' ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                        )}
                        Excel
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportRegisterPdf} disabled={exporting !== null}>
                        {exporting === 'pdf' ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4 mr-2" />
                        )}
                        PDF
                      </Button>
                      {selectedRegister.isOpen && (
                        <Button variant="outline" onClick={() => openTransfer(selectedRegister)} className="text-indigo-600 hover:bg-indigo-50">
                          <ArrowLeftRight className="h-4 w-4 mr-2" />Transférer
                        </Button>
                      )}
                      {/* Boutons Tontine / Épargne */}
                      {selectedRegister.code === 'TONTINE' ? (
                        <Button
                          variant="outline"
                          onClick={() => {
                            // Retrait depuis la tontine vers la caisse principale
                            const mainReg = registers.find((r: any) => r.code === 'MAIN' && r.isOpen);
                            if (!mainReg) {
                              toast({ title: 'Erreur', description: 'Aucune caisse principale (MAIN) ouverte pour le retrait.', variant: 'destructive' });
                              return;
                            }
                            setTransferForm({
                              fromId: selectedRegister.id,
                              toId: mainReg.id,
                              amount: '',
                              note: 'Retrait depuis l\'épargne tontine',
                            });
                            setTransferModal(true);
                          }}
                          className="text-rose-600 hover:bg-rose-50 border-rose-200"
                        >
                          <ArrowDownCircle className="h-4 w-4 mr-2" />Retirer de l'épargne
                        </Button>
                      ) : (
                        selectedRegister.code !== 'ONLINE' && selectedRegister.isOpen && (
                          <Button
                            variant="outline"
                            onClick={async () => {
                              // Cotisation vers la tontine : créer ou récupérer la caisse TONTINE
                              let tontineReg = registers.find((r: any) => r.code === 'TONTINE');
                              if (!tontineReg) {
                                // La caisse TONTINE n'existe pas encore — la créer
                                try {
                                  await financeService.createCashRegister({
                                    code: 'TONTINE',
                                    name: 'Caisse Tontine / Épargne',
                                    description: 'Caisse d\'épargne isolée pour constituer une réserve financière.',
                                    location: 'Coffre-fort / Banque',
                                    openingBalance: 0,
                                  });
                                  await loadRegisters();
                                  const refreshed = await financeService.getCashRegisters();
                                  tontineReg = (Array.isArray(refreshed) ? refreshed : []).find((r: any) => r.code === 'TONTINE');
                                } catch (e: any) {
                                  toast({ title: 'Erreur', description: 'Impossible de créer la caisse Tontine: ' + e.message, variant: 'destructive' });
                                  return;
                                }
                              }
                              if (!tontineReg) {
                                toast({ title: 'Erreur', description: 'Caisse Tontine introuvable.', variant: 'destructive' });
                                return;
                              }
                              setTransferForm({
                                fromId: selectedRegister.id,
                                toId: tontineReg.id,
                                amount: '',
                                note: 'Cotisation vers l\'épargne tontine',
                              });
                              setTransferModal(true);
                            }}
                            className="text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                          >
                            <PiggyBank className="h-4 w-4 mr-2" />Cotiser vers l'épargne
                          </Button>
                        )
                      )}
                      <Button variant="outline" onClick={() => setEditModal(selectedRegister)}>
                        <Edit className="h-4 w-4 mr-2" />Modifier
                      </Button>
                      {selectedRegister.isActive && (
                        <Button variant="outline" onClick={() => handleArchive(selectedRegister)} className="text-rose-600 hover:bg-rose-50">
                          <Archive className="h-4 w-4 mr-2" />Archiver
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
              })()}
            </AnimatePresence>
          </div>
        )}
      </ModuleContentArea>

      {/* === Modal Création === */}
      <Dialog open={createModal} onOpenChange={setCreateModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle caisse</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {/* 1. Nom de la caisse — avec suggestions prédéfinies */}
            <div>
              <Label htmlFor="name">Nom de la caisse *</Label>
              <Input
                id="name"
                placeholder="Sélectionnez un nom ou tapez le vôtre..."
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="mb-2"
              />
              {/* Suggestions prédéfinies — cliquer pour auto-remplir */}
              <div className="flex flex-wrap gap-1.5">
                {PREDEFINED_CAISSES.map((predef) => {
                  const isActive = formData.name === predef.name;
                  return (
                    <button
                      key={predef.code}
                      type="button"
                      onClick={() => selectPredefinedCaisse(predef)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600'
                      }`}
                    >
                      {predef.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">💡 Cliquez sur un nom prédéfini pour auto-générer le code, l'emplacement et la description.</p>
            </div>

            {/* 2. Code + Solde d'ouverture */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  placeholder="ex: CAISSE-01"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label htmlFor="openingBalance">Solde d'ouverture (XOF)</Label>
                <Input
                  id="openingBalance"
                  type="number"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                />
              </div>
            </div>

            {/* 3. Emplacement */}
            <div>
              <Label htmlFor="location">Emplacement</Label>
              <Input
                id="location"
                placeholder="ex: Bureau d'accueil"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            {/* 3b. Responsable — sélection depuis le staff RH (non-enseignant) */}
            <div>
              <Label htmlFor="responsibleUserId">Responsable de la caisse</Label>
              <select
                id="responsibleUserId"
                value={formData.responsibleUserId}
                onChange={(e) => setFormData({ ...formData, responsibleUserId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Aucun responsable assigné —</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}{s.position ? ` — ${s.position}` : ''}{s.employeeNumber ? ` (${s.employeeNumber})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                💡 Le responsable est sélectionné parmi le staff administratif et de soutien (non-enseignant) du module RH.
              </p>
            </div>

            {/* 4. Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Description optionnelle"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* 5. Champs bancaires — affichés seulement si le nom contient "banque" */}
            {isBankCaisse && (
              <div className="space-y-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-800">Informations bancaires</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="bankName" className="text-xs">Nom de la banque</Label>
                    <Input id="bankName" placeholder="ex: Ecobank Bénin" value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="bankAccountNumber" className="text-xs">N° de compte</Label>
                    <Input id="bankAccountNumber" placeholder="ex: 1234567890" value={formData.bankAccountNumber} onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="bankIBAN" className="text-xs">IBAN</Label>
                    <Input id="bankIBAN" placeholder="ex: BJ66 BJBJ 0100..." value={formData.bankIBAN} onChange={(e) => setFormData({ ...formData, bankIBAN: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="bankBranch" className="text-xs">Agence</Label>
                    <Input id="bankBranch" placeholder="ex: Cotonou Centre" value={formData.bankBranch} onChange={(e) => setFormData({ ...formData, bankBranch: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="bankAccountType" className="text-xs">Type de compte</Label>
                    <select id="bankAccountType" value={formData.bankAccountType} onChange={(e) => setFormData({ ...formData, bankAccountType: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm">
                      <option value="">— Choisir —</option>
                      <option value="COURANT">Compte courant</option>
                      <option value="EPARGNE">Compte épargne</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="bankContact" className="text-xs">Contact gestionnaire</Label>
                    <Input id="bankContact" placeholder="ex: M. Koffi — 01 97 12 34 56" value={formData.bankContact} onChange={(e) => setFormData({ ...formData, bankContact: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModal(false)}>Annuler</Button>
            <Button onClick={handleCreate}>Créer la caisse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal Édition — identique au modal création avec tous les champs === */}
      <Dialog open={!!editModal} onOpenChange={(v) => !v && setEditModal(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier la caisse {editModal?.code}</DialogTitle>
          </DialogHeader>
          {editModal && (
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              {/* Nom */}
              <div>
                <Label htmlFor="edit-name">Nom de la caisse *</Label>
                <Input id="edit-name" value={editModal.name} onChange={(e) => setEditModal({ ...editModal, name: e.target.value })} />
              </div>

              {/* Solde d'ouverture (lecture seule en édition = solde courant modifiable) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-openingBalance">Solde d'ouverture (XOF)</Label>
                  <Input
                    id="edit-openingBalance"
                    type="number"
                    value={String(editModal.openingBalance ?? '')}
                    onChange={(e) => setEditModal({ ...editModal, openingBalance: e.target.value } as any)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-currentBalance">Solde courant (XOF)</Label>
                  <Input
                    id="edit-currentBalance"
                    type="number"
                    value={String(editModal.currentBalance ?? '')}
                    onChange={(e) => setEditModal({ ...editModal, currentBalance: e.target.value } as any)}
                  />
                </div>
              </div>

              {/* Emplacement */}
              <div>
                <Label htmlFor="edit-location">Emplacement</Label>
                <Input id="edit-location" value={editModal.location || ''} onChange={(e) => setEditModal({ ...editModal, location: e.target.value })} />
              </div>

              {/* Responsable */}
              <div>
                <Label htmlFor="edit-responsible">Responsable de la caisse</Label>
                <select
                  id="edit-responsible"
                  value={editModal.responsibleUserId || ''}
                  onChange={(e) => setEditModal({ ...editModal, responsibleUserId: e.target.value || undefined } as any)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Aucun responsable assigné —</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}{s.position ? ` — ${s.position}` : ''}{s.employeeNumber ? ` (${s.employeeNumber})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Input id="edit-description" value={editModal.description || ''} onChange={(e) => setEditModal({ ...editModal, description: e.target.value })} />
              </div>

              {/* Champs bancaires — si la caisse est de type banque */}
              {(editModal.name?.toLowerCase().includes('banque') || editModal.code?.toUpperCase() === 'BANQUE') && (
                <div className="space-y-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-amber-600" />
                    <p className="text-sm font-semibold text-amber-800">Informations bancaires</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Nom de la banque</Label>
                      <Input value={editModal.bankName || ''} onChange={(e) => setEditModal({ ...editModal, bankName: e.target.value } as any)} />
                    </div>
                    <div>
                      <Label className="text-xs">N° de compte</Label>
                      <Input value={editModal.bankAccountNumber || ''} onChange={(e) => setEditModal({ ...editModal, bankAccountNumber: e.target.value } as any)} />
                    </div>
                    <div>
                      <Label className="text-xs">IBAN</Label>
                      <Input value={editModal.bankIBAN || ''} onChange={(e) => setEditModal({ ...editModal, bankIBAN: e.target.value } as any)} />
                    </div>
                    <div>
                      <Label className="text-xs">Agence</Label>
                      <Input value={editModal.bankBranch || ''} onChange={(e) => setEditModal({ ...editModal, bankBranch: e.target.value } as any)} />
                    </div>
                    <div>
                      <Label className="text-xs">Type de compte</Label>
                      <select value={editModal.bankAccountType || ''} onChange={(e) => setEditModal({ ...editModal, bankAccountType: e.target.value } as any)} className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-sm">
                        <option value="">— Choisir —</option>
                        <option value="COURANT">Compte courant</option>
                        <option value="EPARGNE">Compte épargne</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Contact gestionnaire</Label>
                      <Input value={editModal.bankContact || ''} onChange={(e) => setEditModal({ ...editModal, bankContact: e.target.value } as any)} />
                    </div>
                  </div>
                </div>
              )}

              {/* Infos dynamiques (lecture seule) */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                <div><strong>Ouverte le :</strong> {editModal.openedAt ? new Date(editModal.openedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</div>
                <div><strong>Fermée le :</strong> {editModal.closedAt ? new Date(editModal.closedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</div>
                <div><strong>Ouv. par :</strong> {editModal.openedBy ? `${editModal.openedBy.firstName || ''} ${editModal.openedBy.lastName || ''}`.trim() : '—'}</div>
                <div><strong>Ferm. par :</strong> {editModal.closedBy ? `${editModal.closedBy.firstName || ''} ${editModal.closedBy.lastName || ''}`.trim() : '—'}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>Annuler</Button>
            <Button onClick={handleUpdate}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal Fermeture === */}
      <Dialog open={!!closeModal} onOpenChange={(v) => !v && setCloseModal(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fermer la caisse {closeModal?.code}</DialogTitle>
          </DialogHeader>
          {closeModal && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 p-3 rounded-md text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-500">Solde théorique :</span>
                  <span className="font-semibold">{formatCurrency(Number(closeModal.currentBalance))} XOF</span>
                </div>
                <div className="text-xs text-slate-400">
                  Dernière ouverture : {closeModal.openedAt ? new Date(closeModal.openedAt).toLocaleString('fr-FR') : '-'}
                </div>
              </div>
              <div>
                <Label htmlFor="countedBalance">Solde physique compté (XOF)</Label>
                <Input
                  id="countedBalance"
                  type="number"
                  value={closeForm.countedBalance}
                  onChange={(e) => setCloseForm({ ...closeForm, countedBalance: e.target.value })}
                  placeholder="Saisir le montant compté en caisse"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Un écart sera signalé si le montant ne correspond pas au solde théorique.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseModal(null)}>Annuler</Button>
            <Button onClick={handleClose}>Fermer la caisse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal Statistiques === */}
      <Dialog open={!!statsModal} onOpenChange={(v) => !v && setStatsModal(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Statistiques — {statsModal?.code} {statsModal?.name}</DialogTitle>
          </DialogHeader>
          {stats && (
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              {/* KPIs principaux */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <p className="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold">Volume total</p>
                  <p className="text-base font-bold text-emerald-900">{formatCurrency(stats.totalVolume)}</p>
                  <p className="text-[10px] text-emerald-500">FCFA</p>
                </div>
                <div className="bg-rose-50 p-3 rounded-lg">
                  <p className="text-[10px] text-rose-600 uppercase tracking-wide font-semibold">Annulations</p>
                  <p className="text-base font-bold text-rose-900">{formatCurrency(stats.reversalVolume)}</p>
                  <p className="text-[10px] text-rose-500">FCFA</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-[10px] text-blue-600 uppercase tracking-wide font-semibold">Volume net</p>
                  <p className="text-base font-bold text-blue-900">{formatCurrency(stats.netVolume)}</p>
                  <p className="text-[10px] text-blue-500">FCFA</p>
                </div>
                <div className="bg-indigo-50 p-3 rounded-lg">
                  <p className="text-[10px] text-indigo-600 uppercase tracking-wide font-semibold">Transactions</p>
                  <p className="text-base font-bold text-indigo-900">{stats.totalTransactions}</p>
                  <p className="text-[10px] text-indigo-500">opérations</p>
                </div>
              </div>

              {/* Transferts in/out */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Transferts entrants</p>
                  <p className="text-2xl font-bold text-emerald-900">{stats.transfersIn || 0}</p>
                  <p className="text-[10px] text-emerald-600">{formatCurrency(stats.totalIn || 0)} FCFA reçus</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg">
                  <p className="text-xs font-semibold text-rose-700 mb-1">Transferts sortants</p>
                  <p className="text-2xl font-bold text-rose-900">{stats.transfersOut || 0}</p>
                  <p className="text-[10px] text-rose-600">{formatCurrency(stats.totalOut || 0)} FCFA envoyés</p>
                </div>
              </div>

              {/* Graphique 1 : Répartition par direction (barres horizontales) */}
              {stats.byDirection && stats.byDirection.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Répartition par direction</p>
                  <div className="space-y-2">
                    {stats.byDirection.map((d: any) => {
                      const maxTotal = Math.max(...stats.byDirection.map((x: any) => Number(x.total || 0)), 1);
                      const pct = (Number(d.total || 0) / maxTotal) * 100;
                      const colorClass = d.direction === 'CREDIT' ? 'bg-emerald-500' : d.direction === 'DEBIT' ? 'bg-rose-500' : 'bg-slate-400';
                      const label = d.direction === 'CREDIT' ? 'Crédit (entrées)' : d.direction === 'DEBIT' ? 'Débit (sorties)' : 'Neutre';
                      return (
                        <div key={d.direction}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium text-slate-700">{label}</span>
                            <span className="text-slate-600">{d.count} tx · {formatCurrency(Number(d.total || 0))} FCFA</span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full ${colorClass} rounded-full`}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Graphique 2 : Évolution sur 7 jours (barres verticales) */}
              {stats.evolution && stats.evolution.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Évolution sur 7 jours</p>
                  <div className="flex items-end justify-between gap-1 h-32">
                    {stats.evolution.map((e: any, idx: number) => {
                      const maxValue = Math.max(...stats.evolution.map((x: any) => Math.max(Number(x.credit || 0), Number(x.debit || 0))), 1);
                      const creditH = (Number(e.credit || 0) / maxValue) * 100;
                      const debitH = (Number(e.debit || 0) / maxValue) * 100;
                      const dateLabel = new Date(e.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                          <div className="flex items-end gap-0.5 h-24 w-full justify-center">
                            <div
                              className="w-2 bg-emerald-500 rounded-t"
                              style={{ height: `${creditH}%` }}
                              title={`Crédit: ${formatCurrency(Number(e.credit || 0))} FCFA`}
                            />
                            <div
                              className="w-2 bg-rose-500 rounded-t"
                              style={{ height: `${debitH}%` }}
                              title={`Débit: ${formatCurrency(Number(e.debit || 0))} FCFA`}
                            />
                          </div>
                          <span className="text-[9px] text-slate-500">{dateLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-center gap-4 mt-2 text-[10px] text-slate-600">
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded" /> Crédit</span>
                    <span className="flex items-center gap-1"><div className="w-2 h-2 bg-rose-500 rounded" /> Débit</span>
                  </div>
                </div>
              )}

              {/* Solde courant */}
              {stats.register && (
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-3 rounded-lg text-white">
                  <p className="text-[10px] uppercase tracking-wide opacity-80">Solde courant de la caisse</p>
                  <p className="text-2xl font-bold">{formatCurrency(Number(stats.register.currentBalance || 0))} FCFA</p>
                  <p className="text-[10px] opacity-80">{stats.register.isOpen ? '🟢 Caisse ouverte' : '🔴 Caisse fermée'}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatsModal(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal Transfert === */}
      <Dialog open={transferModal} onOpenChange={setTransferModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
              Transfert entre caisses
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Caisse source */}
            <div>
              <Label htmlFor="fromId">Caisse source (débit)</Label>
              <select
                id="fromId"
                value={transferForm.fromId}
                onChange={(e) => setTransferForm({ ...transferForm, fromId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Sélectionner —</option>
                {registers.filter((r) => r.isOpen && r.isActive).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name} (Solde: {formatCurrency(Number(r.currentBalance))} XOF)
                  </option>
                ))}
              </select>
            </div>

            {/* Flèche visuelle */}
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5 text-indigo-600" />
              </div>
            </div>

            {/* Caisse cible */}
            <div>
              <Label htmlFor="toId">Caisse cible (crédit)</Label>
              <select
                id="toId"
                value={transferForm.toId}
                onChange={(e) => setTransferForm({ ...transferForm, toId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Sélectionner —</option>
                {registers.filter((r) => r.isOpen && r.isActive && r.id !== transferForm.fromId).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name} (Solde: {formatCurrency(Number(r.currentBalance))} XOF)
                  </option>
                ))}
              </select>
            </div>

            {/* Montant */}
            <div>
              <Label htmlFor="transferAmount">Montant à transférer (XOF)</Label>
              <Input
                id="transferAmount"
                type="number"
                min={0}
                value={transferForm.amount}
                onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                placeholder="Ex: 50000"
              />
              {transferForm.fromId && transferForm.amount && (
                <p className="text-xs text-slate-500 mt-1">
                  Solde source après transfert : {formatCurrency(Number(registers.find((r) => r.id === transferForm.fromId)?.currentBalance || 0) - parseFloat(transferForm.amount || '0'))} XOF
                </p>
              )}
            </div>

            {/* Note */}
            <div>
              <Label htmlFor="transferNote">Note (optionnel)</Label>
              <Input
                id="transferNote"
                value={transferForm.note}
                onChange={(e) => setTransferForm({ ...transferForm, note: e.target.value })}
                placeholder="Ex: Approvisionnement caisse cantine"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferModal(false)}>Annuler</Button>
            <Button
              onClick={handleTransfer}
              disabled={transferPending || !transferForm.fromId || !transferForm.toId || !transferForm.amount}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {transferPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Transfert...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" />Transférer</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
