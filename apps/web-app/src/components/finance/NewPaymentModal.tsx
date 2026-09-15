'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Download, CheckCircle2, Search, Phone, ArrowRight, Loader2,
  AlertCircle, CheckCircle, Shield, Lock, Smartphone, CreditCard, ShoppingCart,
  SlidersHorizontal, Zap, User, GraduationCap, Layers,
} from 'lucide-react';
import { WhatsAppIcon, GmailIcon, HelmConnectIcon } from './OfficialIcons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAppSession } from '@/contexts/AppSessionContext';
import { financeService } from '@/services/finance.service';
import { networkDetectionService } from '@/lib/offline/network-detection.service';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { FedapayLogo } from './FedapayLogo';
import ShopCartSection, { type ShopCartItem } from './ShopCartSection';
import GeneralFeesSection, { type GeneralFeeAddOn } from './GeneralFeesSection';
// ⭐ FIX 2026-09-07 : l'import pointait vers '@/lib/fedapay/detect-operator'
//    (module INEXISTANT — renommé en feexpay au commit 11a5b9ed sans mettre à
//    jour ce fichier). Les fonctions importées étaient de toute façon inutilisées
//    — seul le type opérateur est nécessaire.
import type { FeexPayOperator } from '@/lib/feexpay/detect-operator';

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
  { value: 'FEDAPAY', label: 'Fedapay', isFedapay: true },
];

const FEE_TYPE_LABELS: Record<string, string> = {
  INSCRIPTION: 'Inscription',
  REINSCRIPTION: 'Réinscription',
  TUITION: 'Scolarité',
  CANTEEN: 'Cantine',
  EXAMEN: "Frais d'examen",
  GENERAL: 'Frais généraux',
  OTHER: 'Autre',
};

// Ordre d'affichage des lignes de frais (réplication du PRIORITY_ORDER backend)
const PRIORITY_ORDER_FRONT = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'GENERAL', 'OTHER'];

/**
 * ⭐ FLUX POST-INSCRIPTION — élève préréglé : le modal s'ouvre directement
 * sur l'étape paiement (sélecteurs niveau/classe/élève remplacés par une
 * carte récapitulative). Le compte est récupéré via
 * GET /finance/accounts/student/:studentId (getOrCreate côté backend).
 */
export interface PresetStudent {
  studentId: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  academicClassName?: string;
  physicalClassName?: string;
}

/** Ligne de frais du compte (AccountBreakdown) telle que renvoyée par l'API */
interface FeeLine {
  id: string;
  name: string;
  feeType: string;
  remaining: number;
  initial: number;
  feeStructureTotal?: number;
}

export default function NewPaymentModal({
  academicYearId,
  accounts = [],
  onClose,
  onSuccess,
  defaultPaymentMethod,
  refreshTrigger = 0,
  presetStudent,
  presetMode = 'ENROLLMENT',
}: {
  academicYearId: string;
  /** Liste des comptes (module Finance). Optionnel si presetStudent est fourni. */
  accounts?: any[];
  onClose: () => void;
  onSuccess: () => void;
  defaultPaymentMethod?: string;
  /**
   * ⭐ Incrémenté par le parent après un paiement réussi pour forcer le
   *    rechargement des caisses ouvertes (et autres données locales du
   *    modal) sans devoir fermer/rouvrir le modal.
   */
  refreshTrigger?: number;
  /**
   * ⭐ Flux post-inscription : élève déjà connu — pas de sélecteurs, le
   *    compte est chargé automatiquement (getOrCreate).
   */
  presetStudent?: PresetStudent;
  /**
   * ⭐ Contexte d'ouverture en mode préréglé : ENROLLMENT = flux
   *    post-inscription (titre dédié frais d'inscription), ACCOUNT =
   *    encaissement direct depuis l'onglet « Compte élève » (l'élève est
   *    sélectionné dans le tableau, on encaisse pour lui directement).
   */
  presetMode?: 'ENROLLMENT' | 'ACCOUNT';
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
  const { user } = useAppSession();

  // ⭐ Rôles autorisés à encaisser sur la caisse FONDE (caisse promoteur)
  //    Empêche un caissier (ACCOUNTANT) de sélectionner la caisse du promoteur.
  //    Doit matcher avec PROMOTER_CAISSE_ALLOWED_ROLES côté backend.
  const PROMOTER_CAISSE_ROLES = ['PROMOTER', 'PROMOTEUR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'];
  const userRole = (user?.role || '').toUpperCase();
  const canUsePromoterCaisse = PROMOTER_CAISSE_ROLES.includes(userRole);

  // Panier boutique (multi-action : frais + articles boutique en un seul encaissement)
  const [shopCartItems, setShopCartItems] = useState<ShopCartItem[]>([]);

  // ⭐ FLUX POST-INSCRIPTION : compte préréglé (chargé via getOrCreate)
  const [presetAccount, setPresetAccount] = useState<any | null>(null);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);

  // ⭐ FLEXIBILITÉ ENCAISSEMENT (sept. 2026) :
  // - allocationMode : AUTO = cascade classique (montant global), MANUAL =
  //   répartition personnalisée ligne par ligne (la comptable précise le
  //   dispatching selon le parent en face d'elle).
  // - generalFeeAmounts : montants saisis dans la section « Frais généraux »
  //   (visible dans les DEUX modes — permet de payer les frais généraux en
  //   même temps que le reste, AVANT que la scolarité soit soldée).
  // - manualFeeAmounts : montants par ligne en mode personnalisé (hors GENERAL).
  const [allocationMode, setAllocationMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [generalFeeAmounts, setGeneralFeeAmounts] = useState<Record<string, string>>({});
  const [manualFeeAmounts, setManualFeeAmounts] = useState<Record<string, string>>({});
  // ⭐ Frais généraux À LA CARTE (sept. 2026) : sélection catalogue dans la
  //    section Frais généraux (pattern « articles boutique »). Les breakdowns
  //    correspondants sont créés à la volée par le backend au moment de
  //    l'encaissement (generalFeeAddOns).
  const [generalAddOns, setGeneralAddOns] = useState<GeneralFeeAddOn[]>([]);

  // ⭐ Espèces : montant remis par le client + reliquat calculé automatiquement
  // (uniquement pertinent quand paymentMethod === 'CASH')
  const [tenderedAmount, setTenderedAmount] = useState('');

  // Sélecteurs niveau + classe + recherche élève
  const [levels, setLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [fedapayOperator, setFeexpayOperator] = useState<FeexPayOperator>('mtn');
  const [fedapayPhone, setFeexpayPhone] = useState('');

  // Charge les caisses ouvertes
  // ⭐ Recharge quand refreshTrigger change (après un paiement réussi, le parent
  //    l'incrémente pour forcer le refresh sans fermer le modal).
  // ⭐ FILTRE PAR RÔLE : la caisse FONDE (caisse promoteur) n'est visible que
  //    pour les rôles PROMOTER/PROMOTEUR/SUPER_ADMIN/PLATFORM_OWNER. Un caissier
  //    (ACCOUNTANT) ne peut pas la sélectionner — double sécurité avec le backend.
  useEffect(() => {
    financeService.getCashRegisters({ isActive: true, isOpen: true })
      .then((data) => {
        const all = Array.isArray(data) ? data : [];
        // ⭐ Filtrer la caisse FONDE si l'utilisateur n'a pas le droit
        const filtered = canUsePromoterCaisse
          ? all
          : all.filter((c: any) => c.code !== 'FONDE');
        setOpenCashRegisters(filtered);
      })
      .catch(() => setOpenCashRegisters([]));
  }, [refreshTrigger, canUsePromoterCaisse]);

  // ⭐ FIX 2026-09-15 (demande utilisateur) : la caisse d'ACCUEIL est
  //    présélectionnée par défaut dans le sélecteur Caisse — c'est la caisse
  //    du secrétariat où transitent la majorité des encaissements courants
  //    (code ACCUEIL — « Caisse d'accueil » dans les prédéfinis Multi-caisses).
  //    Garde-fous :
  //    - on ne remplace JAMAIS un choix déjà fait par l'utilisateur
  //      (cashRegisterId déjà défini, y compris après « Nouveau paiement »
  //      qui le réinitialise à '' → la caisse Accueil se re-sélectionne) ;
  //    - si l'école n'a pas de caisse d'accueil OUVERTE, on ne présélectionne
  //      rien du tout (comportement inchangé — « — Aucune caisse — ») ;
  //    - aucun impact sur Fedapay : le flux en ligne n'envoie pas de
  //      cashRegisterId (la caisse ONLINE est auto-assignée côté backend).
  useEffect(() => {
    if (cashRegisterId) return;
    if (!openCashRegisters.length) return;
    const normalize = (s: string) => (s || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim();
    const accueil = openCashRegisters.find(
      (r: any) => normalize(r.code) === 'accueil' || normalize(r.name).includes('accueil')
    );
    if (accueil) setCashRegisterId(accueil.id);
  }, [openCashRegisters, cashRegisterId]);

  // Charge les niveaux scolaires activés
  useEffect(() => {
    fetch('/api/school-levels')
      .then((r) => r.json())
      .then((d) => setLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setLevels([]));
  }, []);

  // Charge les classes (filtrées par niveau si sélectionné)
  // ⭐ FIX 2026-09-09 (« bascule d'année globale ») : l'URL porte l'année du
  //    contexte (prop academicYearId) et l'effet se REJOUE quand elle change
  //    — avant, les classes restaient celles de l'année active serveur,
  //    décalées des comptes/élèves affichés (année sélectionnée).
  useEffect(() => {
    fetch(`/api/all-classes${academicYearId ? `?academicYearId=${academicYearId}` : ''}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : (d.data ?? []);
        setClasses(list);
      })
      .catch(() => setClasses([]));
  }, [academicYearId]);

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

  const selectedAccount = presetStudent ? presetAccount : accounts.find((a) => a.id === studentAccountId);
  const amountNum = parseFloat(amount);

  // ⭐ Chargement du compte préréglé (flux post-inscription) — getOrCreate
  //    côté backend : le compte existe déjà (créé à l'admission) et son
  //    calcul reflète la classe physique (recalculé après affectation).
  useEffect(() => {
    if (!presetStudent?.studentId || !academicYearId || presetAccount) return;
    setPresetLoading(true);
    setPresetError(null);
    financeService.getStudentAccountByStudentId(presetStudent.studentId, academicYearId)
      .then((res: any) => {
        const acc = res?.account ?? res;
        if (!acc?.id) throw new Error('Compte financier introuvable pour cet élève.');
        // Injecter les infos élève (le getOrCreate n'inclut pas la relation student)
        acc.student = acc.student ?? {
          id: presetStudent.studentId,
          firstName: presetStudent.firstName,
          lastName: presetStudent.lastName,
          matricule: presetStudent.matricule ?? '',
        };
        setPresetAccount(acc);
        setStudentAccountId(acc.id);
      })
      .catch((e: any) => setPresetError(e?.message || 'Impossible de charger le compte de l\u00e9lève.'))
      .finally(() => setPresetLoading(false));
  }, [presetStudent?.studentId, academicYearId, presetAccount]);

  // ── Lignes de frais du compte sélectionné ──
  // Découplage du format API (breakdowns) vers un format plat + tri prioritaire.
  const feeLines: FeeLine[] = useMemo(() => {
    const breakdowns: any[] = selectedAccount?.breakdowns ?? [];
    const lines: FeeLine[] = breakdowns.map((b: any) => ({
      id: b.id,
      name: b.feeStructure?.name ?? 'Frais',
      feeType: b.feeStructure?.feeType ?? 'OTHER',
      remaining: Number(b.remainingAmount ?? 0),
      initial: Number(b.initialAmount ?? 0),
      feeStructureTotal: Number(b.feeStructure?.totalAmount ?? 0),
    }));
    return lines
      .filter((l: FeeLine) => l.remaining > 0)
      .sort((a: FeeLine, b: FeeLine) => {
        const ia = PRIORITY_ORDER_FRONT.indexOf(a.feeType);
        const ib = PRIORITY_ORDER_FRONT.indexOf(b.feeType);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
  }, [selectedAccount]);

  const generalFeeLines = useMemo(() => feeLines.filter((l) => l.feeType === 'GENERAL'), [feeLines]);
  const standardFeeLines = useMemo(() => feeLines.filter((l) => l.feeType !== 'GENERAL'), [feeLines]);

  // Reset des montants quand on change d'élève (le preset ne change jamais,
  // mais le sélecteur standard oui)
  useEffect(() => {
    setGeneralFeeAmounts({});
    setManualFeeAmounts({});
    setGeneralAddOns([]);
  }, [studentAccountId]);

  const parseFeeAmount = (v: string | undefined): number => {
    const n = parseFloat(v ?? '');
    return isNaN(n) || n < 0 ? 0 : n;
  };

  // ── Totaux frais selon le mode ──
  // AUTO : montant global + Σ frais généraux (lignes du compte + à la carte —
  //        imputés explicitement, le reste part en cascade sur les frais non
  //        généraux).
  // MANUAL : Σ de toutes les lignes saisies (standard + généraux) — le
  //          dispatching est intégralement décidé par la comptable.
  const generalAddOnsTotal = useMemo(
    () => generalAddOns.reduce((s, a) => s + parseFeeAmount(a.amount), 0),
    [generalAddOns],
  );
  const generalFeesTotal = useMemo(
    () => generalFeeLines.reduce((s, l) => s + parseFeeAmount(generalFeeAmounts[l.id]), 0) + generalAddOnsTotal,
    [generalFeeLines, generalFeeAmounts, generalAddOnsTotal],
  );
  const manualFeesTotal = useMemo(
    () => standardFeeLines.reduce((s, l) => s + parseFeeAmount(manualFeeAmounts[l.id]), 0),
    [standardFeeLines, manualFeeAmounts],
  );
  const feeAmountTotal = allocationMode === 'MANUAL'
    ? manualFeesTotal + generalFeesTotal
    : (amountNum || 0) + generalFeesTotal;

  // Calcul du total boutique (somme des articles du panier)
  const shopCartTotal = useMemo(() => {
    return shopCartItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
  }, [shopCartItems]);

  // Total combiné : frais (global ou personnalisé + frais généraux) + articles boutique
  const totalAmount = feeAmountTotal + shopCartTotal;
  const hasShopItems = shopCartItems.length > 0;

  // ⭐ Espèces : calcul automatique du reliquat (monnaie à rendre au client)
  // tenderedNum = montant que le client a remis (ex: 50000 FCFA)
  // changeGiven = monnaie à rendre = max(0, tenderedNum - totalAmount)
  const tenderedNum = parseFloat(tenderedAmount) || 0;
  const changeGiven = Math.max(0, tenderedNum - totalAmount);
  const isTenderedInsufficient = tenderedNum > 0 && tenderedNum < totalAmount;

  // Aperçu d'imputation — reflète le mode de répartition :
  //  - Frais généraux saisis (imputation explicite, affichés en tête)
  //  - AUTO : cascade du montant global sur les restants non couverts
  //  - MANUAL : chaque ligne saisie (le dispatching est déjà explicite)
  // Détecte les personnalisations (initialAmount != feeStructure.totalAmount).
  useEffect(() => {
    if (!selectedAccount || feeAmountTotal <= 0) {
      setPreview(null);
      return;
    }
    const lines: { name: string; pay: number; feeType: string; personalized: boolean; originalAmount?: number }[] = [];
    const buildLine = (l: FeeLine, pay: number) => {
      const isPersonalized = Math.abs((l.feeStructureTotal ?? 0) - l.initial) > 0.01;
      lines.push({
        name: l.name,
        pay,
        feeType: l.feeType,
        personalized: isPersonalized,
        originalAmount: isPersonalized ? l.feeStructureTotal : undefined,
      });
    };

    // 1. Frais généraux — imputation explicite (les DEUX modes) :
    //    lignes du compte + frais à la carte (créés côté backend).
    for (const l of generalFeeLines) {
      const pay = parseFeeAmount(generalFeeAmounts[l.id]);
      if (pay > 0) buildLine(l, pay);
    }
    for (const a of generalAddOns) {
      const pay = parseFeeAmount(a.amount);
      if (pay > 0) {
        lines.push({
          name: `${a.name} (à la carte)`,
          pay,
          feeType: 'GENERAL',
          personalized: false,
        });
      }
    }

    // 2. Reste des frais
    if (allocationMode === 'MANUAL') {
      for (const l of standardFeeLines) {
        const pay = parseFeeAmount(manualFeeAmounts[l.id]);
        if (pay > 0) buildLine(l, pay);
      }
    } else {
      // Cascade du montant global sur les restants non couverts par les
      // frais généraux déjà imputés (miroir exact du backend).
      let remaining = amountNum || 0;
      if (remaining > 0) {
        for (const l of standardFeeLines) {
          if (remaining <= 0) break;
          const alreadyGeneral = l.feeType === 'GENERAL' ? parseFeeAmount(generalFeeAmounts[l.id]) : 0;
          const rem = l.remaining - alreadyGeneral;
          if (rem <= 0) continue;
          const delta = Math.min(remaining, rem);
          buildLine(l, delta);
          remaining -= delta;
        }
      }
    }

    setPreview({ totalPay: feeAmountTotal, lines });
  }, [selectedAccount, amountNum, allocationMode, generalFeeLines, standardFeeLines, generalFeeAmounts, manualFeeAmounts, feeAmountTotal, generalAddOns]);

  // ⭐ Construit les imputations explicites (flexibilité sept. 2026) :
  //  - section Frais généraux — lignes DU COMPTE (les deux modes) ;
  //  - répartition personnalisée (mode MANUAL) pour les autres lignes.
  // Si aucune ligne n'est saisie (mode AUTO pur), on renvoie undefined →
  // le backend applique la cascade classique + FIFO arriérés (comportement
  // historique inchangé).
  // NB : les frais généraux À LA CARTE ne figurent PAS ici — ils partent via
  // buildGeneralFeeAddOns() (le backend crée les breakdowns à la volée puis
  // fusionne les montants dans ces imputations explicites).
  const buildManualAllocations = (): { accountBreakdownId: string; amount: number }[] | undefined => {
    const allocations: { accountBreakdownId: string; amount: number }[] = [];
    for (const l of generalFeeLines) {
      const pay = parseFeeAmount(generalFeeAmounts[l.id]);
      if (pay > 0) allocations.push({ accountBreakdownId: l.id, amount: pay });
    }
    if (allocationMode === 'MANUAL') {
      for (const l of standardFeeLines) {
        const pay = parseFeeAmount(manualFeeAmounts[l.id]);
        if (pay > 0) allocations.push({ accountBreakdownId: l.id, amount: pay });
      }
    }
    return allocations.length > 0 ? allocations : undefined;
  };

  // ⭐ Frais généraux à la carte (sept. 2026) : [{ feeStructureId, amount }]
  //    pour le backend (création des breakdowns + imputation explicite).
  const buildGeneralFeeAddOns = (): { feeStructureId: string; amount: number }[] | undefined => {
    const addOns = generalAddOns
      .map((a) => ({ feeStructureId: a.feeStructureId, amount: parseFeeAmount(a.amount) }))
      .filter((a) => a.amount > 0);
    return addOns.length > 0 ? addOns : undefined;
  };

  // Ligne de frais dépassée ? (saisie > restant dû) — bloque le submit
  const oversetLine = useMemo(() => {
    for (const l of feeLines) {
      // Les frais généraux sont vérifiés dans les deux modes ; les autres
      // lignes uniquement en répartition personnalisée.
      if (l.feeType === 'GENERAL' || allocationMode === 'MANUAL') {
        const map = l.feeType === 'GENERAL' ? generalFeeAmounts : manualFeeAmounts;
        const pay = parseFeeAmount(map[l.id]);
        if (pay > l.remaining) return { name: l.name, pay, remaining: l.remaining };
      }
    }
    // Frais généraux à la carte : plafonnés au montant du frais (structure)
    for (const a of generalAddOns) {
      const pay = parseFeeAmount(a.amount);
      if (pay > a.feeAmount) return { name: a.name, pay, remaining: a.feeAmount };
    }
    return null;
  }, [feeLines, generalFeeAmounts, manualFeeAmounts, allocationMode, generalAddOns]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validation : soit frais (global ou lignes) > 0, soit articles boutique
    if (feeAmountTotal <= 0 && !hasShopItems) {
      toast({
        title: 'Montant requis',
        description: 'Saisissez un montant de frais, une répartition ou ajoutez au moins un article boutique.',
        variant: 'destructive',
      });
      return;
    }
    if (!studentAccountId) {
      // ⭐ Mode préréglé : le compte peut encore être en cours de chargement
      if (presetStudent) {
        toast({
          title: presetError ? 'Compte indisponible' : 'Compte en cours de chargement',
          description: presetError || 'Patientez un instant — le compte financier de l\u2019élève se charge.',
          variant: 'destructive',
        });
      }
      return;
    }

    // ⭐ Répartition : une ligne saisie ne peut pas dépasser son restant dû
    if (oversetLine) {
      toast({
        title: 'Répartition invalide',
        description: `« ${oversetLine.name} » : ${formatCurrency(oversetLine.pay)} saisis pour un restant dû de ${formatCurrency(oversetLine.remaining)}.`,
        variant: 'destructive',
      });
      return;
    }

    if (!networkDetectionService.isConnected()) {
      toast({ title: 'Hors Ligne', description: 'Les transactions financières nécessitent une connexion internet.', variant: 'destructive' });
      return;
    }

    // Caisse obligatoire pour les espèces
    if (paymentMethod === 'CASH' && !cashRegisterId) {
      toast({ title: 'Caisse requise', description: 'Sélectionnez une caisse ouverte pour les paiements en espèces.', variant: 'destructive' });
      return;
    }

    // ⭐ Espèces : vérifier que le montant remis est suffisant
    if (paymentMethod === 'CASH' && tenderedNum > 0 && isTenderedInsufficient) {
      toast({
        title: 'Montant remis insuffisant',
        description: `Le client a remis ${formatCurrency(tenderedNum)} mais le total à encaisser est ${formatCurrency(totalAmount)}. Manquant : ${formatCurrency(totalAmount - tenderedNum)}.`,
        variant: 'destructive',
      });
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
      if (feeAmountTotal <= 0) {
        toast({ title: 'Montant requis', description: 'Les paiements Fedapay concernent les frais scolaires (pas la boutique).', variant: 'destructive' });
        return;
      }
      const manualAllocations = buildManualAllocations();
      const generalFeeAddOns = buildGeneralFeeAddOns();
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
        // Note : on ne génère pas de référence côté client — Fedapay génère la sienne
        // (comme dans le projet de référence Zohar Decor qui marche)
        const FedaPay = (window as any).FedaPay;
        const widget = FedaPay.init({
          public_key: keyData.publicKey,
          transaction: {
            amount: feeAmountTotal,
            description: `Scolarité ${studentName}`.substring(0, 100),
          },
          customer: {
            firstname: selectedAccount.student?.firstName || '',
            lastname: selectedAccount.student?.lastName || '',
          },
          onComplete: async (response: any) => {
            // Log pour débogage
            console.log('🔄 Fedapay onComplete reçu:', JSON.stringify(response));

            // Vérifier les raisons d'annulation (comme le projet de référence)
            if (response?.reason === 'DIALOG DISMISSED' || response?.reason === 'USERCANCELLED') {
              toast({ title: 'Paiement annulé', description: 'Le checkout Fedapay a été fermé.' });
              setLoading(false);
              return;
            }

            // ✅ Paiement réussi — créer la FinanceTransaction côté backend
            // (approche du projet de référence Zohar Decor qui marche)
            // Le webhook Fedapay reste comme sécurité (idempotence) mais ne doit
            // pas être le seul mécanisme car il n'est pas toujours envoyé en test.
            // Note : response.reference peut être undefined — on génère un fallback.
            const fedapayReference = response?.reference || response?.id || `FEDAPAY-${Date.now()}`;
            console.log('📝 Référence Fedapay utilisée:', fedapayReference);
            try {
              const result = await financeService.createTransaction({
                academicYearId,
                studentAccountId,
                amount: feeAmountTotal,
                paymentMethod: 'FEDAPAY',
                reference: fedapayReference,
                // ⭐ Répartition explicite (frais généraux / personnalisée)
                manualAllocations,
                // ⭐ Frais généraux à la carte (création des lignes à la volée)
                generalFeeAddOns,
              });
              if (result?.id) {
                setReceipt({
                  id: result.id,
                  receiptNumber: result.receiptNumber || fedapayReference,
                  createdAt: result.createdAt || new Date().toISOString(),
                });
                toast({
                  title: '✅ Paiement confirmé',
                  description: `Reçu ${result.receiptNumber} généré. Référence Fedapay : ${fedapayReference}.`,
                });
                onSuccess();
              } else {
                toast({
                  title: 'Paiement initié',
                  description: `Référence Fedapay : ${fedapayReference}. Le reçu est en cours de génération.`,
                });
                setReceipt({
                  id: fedapayReference,
                  receiptNumber: fedapayReference,
                  createdAt: new Date().toISOString(),
                });
                onSuccess();
              }
            } catch (err: any) {
              console.error('❌ createTransaction after Fedapay failed:', err);
              console.error('   Response:', err?.message);
              toast({
                title: 'Paiement reçu mais transaction non enregistrée',
                description: `Référence Fedapay : ${fedapayReference}. Erreur: ${err?.message || 'Inconnue'}. Contactez l'administrateur.`,
                variant: 'destructive',
              });
              setReceipt({
                id: fedapayReference,
                receiptNumber: fedapayReference,
                createdAt: new Date().toISOString(),
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

    // ── FedaPay désactivé pour le moment — uniquement Fedapay pour les paiements en ligne ──
    // Pour réactiver FedaPay plus tard, décommenter le bloc ci-dessous.
    /*
    if (paymentMethod === 'FEDAPAY') { ... }
    */

    setLoading(true);
    try {
      // ⭐ Imputations explicites (frais généraux + répartition personnalisée)
      const manualAllocations = buildManualAllocations();
      const generalFeeAddOns = buildGeneralFeeAddOns();

      // ─── Multi-action : frais + articles boutique en une seule opération ───
      // Si l'utilisateur a ajouté des articles boutique au panier, on appelle
      // l'endpoint multi-action qui crée à la fois la FinanceTransaction (frais)
      // et la ShopSale (articles boutique) liées entre elles. Le reçu PDF affichera
      // les deux sections (frais scolaires + articles boutique + récapitulatif global).
      if (hasShopItems) {
        const result = await financeService.createMultiActionTransaction({
          academicYearId,
          studentAccountId,
          feeAmount: feeAmountTotal,
          shopItems: shopCartItems.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
          })),
          paymentMethod,
          reference: reference.trim() || undefined,
          cashRegisterId: cashRegisterId || undefined,
          // ⭐ Espèces : montant remis + reliquat (calculé sur le total combiné frais + boutique)
          tenderedAmount: paymentMethod === 'CASH' && tenderedNum > 0 ? tenderedNum : undefined,
          changeGiven: paymentMethod === 'CASH' && tenderedNum > 0 ? changeGiven : undefined,
          // ⭐ Répartition explicite (frais généraux / personnalisée)
          manualAllocations,
          // ⭐ Frais généraux à la carte (création des lignes à la volée)
          generalFeeAddOns,
        });

        // Le résultat contient { transaction, shopSale, totalAmount, feeAmount, shopAmount }
        // ⭐ V4.0 (spec §6 — paiements) : X-Sync-Status: pending → la mutation
        //    est EN FILE côté Service Worker (réseau KO). JAMAIS une confirmation
        //    identique à un paiement réellement enregistré côté serveur : état
        //    explicite « en attente de validation réseau », pas de reçu affiché
        //    (le numéro de reçu et le PDF n'existent pas encore côté serveur).
        if ((result as any)?.syncPending) {
          toast({
            title: '⏳ En attente de validation réseau',
            description: `Réseau indisponible — l'encaissement de ${formatCurrency(feeAmountTotal)} est enregistré sur cet appareil et sera transmis au serveur à la reconnexion. Le reçu sera généré après validation.`,
          });
          onSuccess();
        } else {
        const tx = result?.transaction;
        if (tx?.id) {
          setReceipt({
            id: tx.id,
            receiptNumber: tx.receiptNumber || '—',
            createdAt: tx.createdAt || new Date().toISOString(),
          });
          toast({
            title: '✅ Encaissement multi-action confirmé',
            description: `Reçu ${tx.receiptNumber} généré. Total encaissé : ${formatCurrency(result.totalAmount)} (Frais : ${formatCurrency(result.feeAmount)} + Boutique : ${formatCurrency(result.shopAmount)}).`,
          });
          onSuccess();
        } else if (result?.shopSale && !tx) {
          // Cas où feeAmount = 0 (uniquement boutique) — pas de FinanceTransaction créée
          // On affiche un toast mais on n'a pas de reçu PDF (la ShopSale n'en génère pas)
          toast({
            title: 'Vente boutique enregistrée',
            description: `Vente ${result.shopSale.saleNumber} créée pour ${formatCurrency(result.shopAmount)}.`,
          });
          onSuccess();
        } else {
          toast({ title: 'Paiement enregistré', description: 'Le reçu est en cours de génération.' });
          onSuccess();
        }
        } // fin du else syncPending (multi-action)
      } else {
        // ─── Paiement standard (frais uniquement) ───
        const result = await financeService.createTransaction({
          academicYearId,
          studentAccountId,
          amount: feeAmountTotal,
          paymentMethod,
          reference: reference.trim() || undefined,
          cashRegisterId: cashRegisterId || undefined,
          // ⭐ Espèces : montant remis + reliquat (pour traçabilité reçu PDF/WhatsApp/SMS)
          tenderedAmount: paymentMethod === 'CASH' && tenderedNum > 0 ? tenderedNum : undefined,
          changeGiven: paymentMethod === 'CASH' && tenderedNum > 0 ? changeGiven : undefined,
          // ⭐ Répartition explicite (frais généraux / personnalisée)
          manualAllocations,
          // ⭐ Frais généraux à la carte (création des lignes à la volée)
          generalFeeAddOns,
        });
        // Le backend renvoie la transaction avec receiptNumber + createdAt
        // + déclenche la génération PDF en fire-and-forget
        // ⭐ V4.0 (spec §6 — paiements) : X-Sync-Status: pending → en file côté
        //    Service Worker — état explicite, JAMAIS un faux « reçu généré ».
        if ((result as any)?.syncPending) {
          toast({
            title: '⏳ En attente de validation réseau',
            description: `Réseau indisponible — le paiement de ${formatCurrency(feeAmountTotal)} est enregistré sur cet appareil et sera transmis au serveur à la reconnexion. Le reçu sera généré après validation.`,
          });
          onSuccess();
        } else if (result?.id) {
          setReceipt({
            id: result.id,
            receiptNumber: result.receiptNumber || '—',
            createdAt: result.createdAt || new Date().toISOString(),
          });
          toast({ title: 'Paiement enregistré', description: `Reçu ${result.receiptNumber} généré.` });
          onSuccess();
        } else {
          toast({ title: 'Paiement enregistré', description: 'Le reçu est en cours de génération.' });
          onSuccess();
        }
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

  const handleResendReceipt = async (channel: 'email' | 'whatsapp' | 'sms' | 'helm_connect') => {
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
    setShopCartItems([]);
    setTenderedAmount('');
    // ⭐ FIX 2026-09-07 : setFeexpayModalOpen/setFeexpayError référaient des
    //    états supprimés avec le widget FedaPay inline (commit 11a5b9ed) —
    //    références mortes supprimées.
    setFeexpayPhone('');
    setGeneralFeeAmounts({});
    setManualFeeAmounts({});
    setGeneralAddOns([]);
    setAllocationMode('AUTO');
    // ⚠️ En mode préréglé (flux post-inscription), on ne réinitialise PAS le
    // compte préréglé — l'élève reste sélectionné pour un second encaissement.
    if (presetStudent) {
      setStudentAccountId(presetAccount?.id ?? '');
    } else {
      setPresetAccount(null);
    }
  };

  /**
   * Handler du widget FedaPay inline — appelé quand le client clique sur
   * "Payer X FCFA" dans le widget inline. Déclenche le push USSD via
   * /api/finance/payments/fedapay/initiate puis crée la FinanceTransaction
   * côté backend (pour que le reçu soit généré et le solde mis à jour).
   */

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-blue-100 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold">
            {presetStudent
              ? (presetMode === 'ACCOUNT' ? 'Nouvel encaissement' : 'Encaissement — Frais d\u2019inscription')
              : 'Nouveau paiement'}
          </h3>
          {presetStudent && (
            <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300 bg-blue-50 shrink-0">
              {presetMode === 'ACCOUNT' ? 'Compte élève' : 'Flux post-inscription'}
            </Badge>
          )}
        </div>

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
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
              {/* ⭐ WhatsApp — GRAYED OUT (replaced by Helm Connect) */}
              <Button
                size="sm"
                variant="outline"
                disabled
                className="opacity-40 cursor-not-allowed"
                title="WhatsApp désactivé — utilisez Helm Connect"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 mr-1.5 grayscale" />
                WhatsApp
              </Button>
              {/* ⭐ Helm Connect — REPLACES SMS */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResendReceipt('helm_connect')}
                disabled={sendingChannel === 'helm_connect'}
              >
                <HelmConnectIcon className="w-3.5 h-3.5 mr-1.5" />
                {sendingChannel === 'helm_connect' ? 'Envoi...' : 'Helm Connect'}
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

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ display: receipt ? 'none' : undefined }}>
          {/* ⭐ FLUX POST-INSCRIPTION : carte élève préréglée (remplace les sélecteurs) */}
          {presetStudent ? (
            <div className="md:col-span-2 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {presetLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : `${presetStudent.firstName[0] ?? ''}${presetStudent.lastName[0] ?? ''}`}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">
                      {presetStudent.lastName.toUpperCase()} {presetStudent.firstName}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                      {presetStudent.matricule && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{presetStudent.matricule}</span>
                      )}
                      {presetStudent.academicClassName && (
                        <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" />Officielle : {presetStudent.academicClassName}</span>
                      )}
                      {presetStudent.physicalClassName && (
                        <span className="flex items-center gap-1"><Layers className="w-3 h-3" />Physique : {presetStudent.physicalClassName}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">Solde à payer</p>
                  <p className="text-lg font-bold text-rose-600">{formatCurrency(Number(presetAccount?.balance ?? 0))}</p>
                </div>
              </div>
              {presetError && (
                <p className="text-xs text-rose-600 mt-3 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> {presetError}
                </p>
              )}
            </div>
          ) : (
            <>
          {/* Sélecteurs Niveau + Classe (filtrage en cascade) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </>
          )}

          {/* ⭐ TOGGLE DE RÉPARTITION (flexibilité sept. 2026) — la comptable
              précise au système comment dispatcher le paiement selon le parent
              en face d'elle (cascade auto vs répartition personnalisée). */}
          {selectedAccount && !presetLoading && feeLines.length > 0 && (
            <div className="md:col-span-2">
              <Label className="text-xs mb-1.5 block">Répartition du paiement</Label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setAllocationMode('AUTO')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                    allocationMode === 'AUTO'
                      ? 'bg-white text-blue-700 shadow-sm border border-blue-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Zap className={`w-3.5 h-3.5 ${allocationMode === 'AUTO' ? 'text-blue-600' : ''}`} />
                  Cascade automatique
                </button>
                <button
                  type="button"
                  onClick={() => setAllocationMode('MANUAL')}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                    allocationMode === 'MANUAL'
                      ? 'bg-white text-violet-700 shadow-sm border border-violet-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <SlidersHorizontal className={`w-3.5 h-3.5 ${allocationMode === 'MANUAL' ? 'text-violet-600' : ''}`} />
                  Répartition personnalisée
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                {allocationMode === 'AUTO'
                  ? 'Le montant est imputé automatiquement : inscription → scolarité → annexes (+ frais généraux saisis ci-dessous).'
                  : 'Vous précisez le montant à imputer sur chaque ligne de frais — selon ce que le parent décide de payer maintenant (ex. inscription + uniforme, sans la scolarité).'}
              </p>
            </div>
          )}

          {/* Montant global — uniquement en mode AUTO */}
          {allocationMode === 'AUTO' && (
            <div>
              <Label>Montant frais (XOF)</Label>
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} required={feeAmountTotal <= 0 && !hasShopItems} />
            </div>
          )}

          {/* ⭐ GRILLE DE RÉPARTITION PERSONNALISÉE — remplace le montant
              global : la comptable saisit ligne par ligne (hors frais généraux,
              gérés dans leur section dédiée ci-dessous). */}
          {allocationMode === 'MANUAL' && (
            <div className="md:col-span-2 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-violet-700" />
                  <span className="text-sm font-bold text-violet-900">Répartition personnalisée</span>
                </div>
                <span className="text-xs text-slate-500">Restant dû total : {formatCurrency(standardFeeLines.reduce((s, l) => s + l.remaining, 0))}</span>
              </div>
              {standardFeeLines.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Aucun frais restant à payer pour cet élève.</p>
              ) : (
                <div className="space-y-2">
                  {standardFeeLines.map((l) => (
                    <div key={l.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_140px_150px] items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{l.name}</p>
                        <p className="text-[11px] text-slate-400">
                          Restant : <span className="font-semibold text-slate-600">{formatCurrency(l.remaining)}</span>
                          {parseFeeAmount(manualFeeAmounts[l.id]) > l.remaining && (
                            <span className="ml-2 text-rose-600 font-semibold">⚠ Dépasse le restant dû</span>
                          )}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] hidden sm:inline-flex justify-self-center">{FEE_TYPE_LABELS[l.feeType] || l.feeType}</Badge>
                      <div className="justify-self-end">
                        <Input
                          type="number"
                          min={0}
                          max={l.remaining}
                          placeholder="0"
                          className="w-[140px] text-right"
                          value={manualFeeAmounts[l.id] ?? ''}
                          onChange={(e) => setManualFeeAmounts((prev) => ({ ...prev, [l.id]: e.target.value }))}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-violet-200">
                    <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">Total frais imputés</span>
                    <span className="text-base font-bold text-violet-900">{formatCurrency(manualFeesTotal)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <div>
            <Label>Méthode de paiement</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="flex items-center gap-2">
                      {m.isFedapay && (
                        <FedapayLogo className="h-3.5 w-auto" />
                      )}
                      <span>{m.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* FedaPay désactivé pour le moment — uniquement Fedapay */}
          <div>
            <Label>
              Caisse {paymentMethod === 'CASH' ? '*' : '(optionnel)'}
              {(paymentMethod === 'FEDAPAY' || paymentMethod === 'FEDAPAY') && (
                <span className="text-[10px] text-slate-500 ml-1">(auto : Caisse Paiements en Ligne)</span>
              )}
            </Label>
            <Select
              value={paymentMethod === 'FEDAPAY' ? '_none' : (cashRegisterId || '_none')}
              onValueChange={(v) => setCashRegisterId(v === '_none' ? '' : v)}
              disabled={paymentMethod === 'FEDAPAY' || paymentMethod === 'FEDAPAY'}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner une caisse ouverte" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">
                  {paymentMethod === 'FEDAPAY' || paymentMethod === 'FEDAPAY'
                    ? 'Caisse Paiements en Ligne (automatique)'
                    : '— Aucune caisse —'}
                </SelectItem>
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
            {(paymentMethod === 'FEDAPAY' || paymentMethod === 'FEDAPAY') && (
              <p className="text-xs text-blue-600 mt-1 flex items-center gap-1.5">
                {paymentMethod === 'FEDAPAY' && (
                  <FedapayLogo className="h-3 w-auto" />
                )}
                {paymentMethod === 'FEDAPAY' && (
                  <CreditCard className="w-3 h-3" />
                )}
                <span>
                  Les paiements en ligne sont automatiquement rattachés à la
                  <strong className="mx-1">Caisse Paiements en Ligne</strong>
                  (créée automatiquement si elle n'existe pas).
                </span>
              </p>
            )}
          </div>

          {/* ⭐ Montant remis en espèces + reliquat auto (uniquement pour CASH) */}
          {paymentMethod === 'CASH' && (
            <div>
              <Label>Montant remis par le client (XOF)</Label>
              <Input
                type="number"
                min={0}
                value={tenderedAmount}
                onChange={(e) => setTenderedAmount(e.target.value)}
                placeholder="Ex: 50000 (laisser vide si exact)"
              />
              {tenderedNum > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-sm bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <span className="text-emerald-700 font-medium">💰 Reliquat à rendre :</span>
                    <span className="font-bold text-emerald-900">{formatCurrency(changeGiven)}</span>
                  </div>
                  {isTenderedInsufficient && (
                    <p className="text-xs text-rose-600 flex items-center gap-1">
                      ⚠️ Le montant remis ({formatCurrency(tenderedNum)}) est inférieur au total à encaisser ({formatCurrency(totalAmount)}).
                      Manquant : {formatCurrency(totalAmount - tenderedNum)}.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

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

          {/* ⭐ SECTION FRAIS GÉNÉRAUX (sept. 2026 — refonte « à la carte ») :
              remplace l'ancienne section (lignes GENERAL du compte uniquement,
              invisible quand le compte n'en avait pas). Désormais TOUJOURS
              visible dès qu'un élève est sélectionné :
                1. lignes GENERAL déjà sur le compte (paiements partiels) ;
                2. frais généraux À LA CARTE sélectionnés dans le catalogue
                   (pattern « articles boutique ») — le backend crée les
                   breakdowns à la volée (generalFeeAddOns) au moment de
                   l'encaissement : uniforme, fournitures… payables en même
                   temps que le reste, SANS exiger l'inscription/scolarité
                   soldées. */}
          {selectedAccount && !presetLoading && (
            <div className="md:col-span-2">
              <GeneralFeesSection
                academicYearId={academicYearId}
                accountLines={generalFeeLines.map((l) => ({ id: l.id, name: l.name, remaining: l.remaining }))}
                accountAmounts={generalFeeAmounts}
                onAccountAmountsChange={setGeneralFeeAmounts}
                addOns={generalAddOns}
                onAddOnsChange={setGeneralAddOns}
              />
            </div>
          )}

          {/* Récapitulatif frais (global + généraux) — affiché si frais généraux saisis */}
          {generalFeesTotal > 0 && (
            <div className="md:col-span-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm flex justify-between items-center">
              <span className="text-amber-800 font-medium">
                Total frais à encaisser {allocationMode === 'AUTO' ? '(montant global + frais généraux)' : '(répartition personnalisée + frais généraux)'}
              </span>
              <span className="text-base font-bold text-amber-900">{formatCurrency(feeAmountTotal)}</span>
            </div>
          )}

          {/* Section Articles Boutique (multi-action : frais + boutique en un seul encaissement) */}
          <div className="md:col-span-2">
            <ShopCartSection
              academicYearId={academicYearId}
              items={shopCartItems}
              onItemsChange={setShopCartItems}
            />
          </div>

          {/* Récapitulatif total (frais + boutique) — affiché si panier boutique non vide */}
          {hasShopItems && (
            <div className="md:col-span-2 rounded-lg border-2 border-violet-300 bg-violet-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingCart className="w-4 h-4 text-violet-700" />
                <span className="text-sm font-bold text-violet-900">Récapitulatif de l'encaissement</span>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Frais scolaires {allocationMode === 'MANUAL' ? '(répartition personnalisée)' : ''}</span>
                  <span className="font-medium">{formatCurrency(feeAmountTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Articles boutique ({shopCartItems.length} article{shopCartItems.length > 1 ? 's' : ''})</span>
                  <span className="font-medium">{formatCurrency(shopCartTotal)}</span>
                </div>
                <div className="flex justify-between pt-2 mt-2 border-t-2 border-violet-300">
                  <span className="text-base font-bold text-violet-900">TOTAL ENCAISSÉ</span>
                  <span className="text-lg font-bold text-violet-900">{formatCurrency(totalAmount)}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3 italic">
                💡 Le reçu PDF généré inclura une section « Articles Boutique »
                avec le détail des articles et un récapitulatif global combinant
                frais scolaires et articles boutique.
              </p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-4 md:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button
              type="submit"
              disabled={loading || (paymentMethod === 'CASH' && !cashRegisterId) || (feeAmountTotal <= 0 && !hasShopItems)}
            >
              {loading
                ? 'Enregistrement...'
                : hasShopItems
                  ? `Encaisser ${formatCurrency(totalAmount)} (frais + boutique)`
                  : feeAmountTotal > 0
                    ? `Encaisser ${formatCurrency(totalAmount)}`
                    : 'Valider paiement'}
            </Button>
          </div>
        </form>

      </motion.div>
    </div>
  );
}
