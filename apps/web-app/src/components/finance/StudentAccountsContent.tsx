'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Eye, Unlock, UserCog, Search, Download, Receipt, Clock, FileSpreadsheet, FileText, Loader2, ChevronLeft, ChevronRight, MoreHorizontal, Users, Wallet, TrendingUp, AlertCircle, Pencil, Trash2, Plus } from 'lucide-react';
import { WhatsAppIcon, GmailIcon, SmsIcon } from './OfficialIcons';
import DocumentPreviewModal from '@/components/students/DocumentPreviewModal';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAppSession } from '@/contexts/AppSessionContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { financeService } from '@/services/finance.service';
import { classesService } from '@/services/classes.service';
import { getAcademicYears } from '@/services/settings.service';
import { formatCurrency } from '@/lib/utils';
import { filterAndSortClasses } from '@/lib/finance/class-sort';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  exportStudentAccountsToExcel,
} from '@/lib/exports/excel-exports';
import {
  exportStudentHistoryToPdf,
} from '@/lib/exports/finance-exports';
import {
  studentAccountsFilename,
  studentHistoryFilename,
} from '@/lib/exports/filename-helpers';
import PromoterEligibilityToggle from './PromoterEligibilityToggle';
import EditPaymentModal from './EditPaymentModal';
import NewPaymentModal from './NewPaymentModal';

const STATUS_COLORS: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  OVERDUE: 'bg-orange-100 text-orange-800',
  BLOCKED: 'bg-red-100 text-red-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

export default function StudentAccountsContent({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
  const { academicYear, schoolLevel } = useModuleContext();
  const { tenant, user } = useAppSession();
  const searchParams = useSearchParams();
  const preselectStudentId = searchParams.get('studentId');
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | 'student-pdf' | null>(null);
  // Filtre année : par défaut l'année courante du module context, mais l'utilisateur peut changer
  const [filterYearId, setFilterYearId] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  // ⭐ Task 23 : par défaut, les élèves abandonnés (status=WITHDRAWN) sont masqués.
  // L'utilisateur peut cliquer sur "Afficher les abandonnés" pour les inclure.
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [detailAccount, setDetailAccount] = useState<any | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [unblockReason, setUnblockReason] = useState('');
  const [unblockModal, setUnblockModal] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ filePath: string; fileName: string; mimeType: string } | null>(null);
  // ⭐ PERF 2026-09-16 — feedback instantané : spinner sur le bouton Visualiser
  //    du reçu (remplace l'ancien état booléen jamais affiché).
  const [viewingTxId, setViewingTxId] = useState<string | null>(null);
  const [whatsappMenuId, setWhatsappMenuId] = useState<string | null>(null);

  // ⭐ ÉDITION / SUPPRESSION D'UN ENCAISSEMENT (sept. 2026 — PROMOTEUR
  //    uniquement) : le promoteur aligne les encaissements saisis sur les
  //    documents papier fournis par les écoles. Les boutons ne sont visibles
  //    que pour lui ; le backend re-vérifie le rôle (garde double).
  const PROMOTER_EDIT_ROLES = ['PROMOTER', 'PROMOTEUR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'];
  const isPromoter = PROMOTER_EDIT_ROLES.includes((user?.role || '').toUpperCase());
  const [editPaymentTx, setEditPaymentTx] = useState<any | null>(null);
  const [deletePaymentTx, setDeletePaymentTx] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ⭐ CRÉATION D'UN ENCAISSEMENT POUR L'ÉLÈVE SÉLECTIONNÉ (sept. 2026) :
  //    dans le tableau « Historique des encaissements », un bouton permet
  //    d'encaisser directement pour l'élève sélectionné (le modal s'ouvre
  //    préréglé sur son compte — pas de sélecteurs niveau/classe/élève).
  //    Cas d'usage : le promoteur aligne la base sur les documents papier
  //    fournis par les écoles (encaissements historiques). L'édition et la
  //    suppression restent réservées au promoteur ; la création est un
  //    encaissement standard (mêmes droits que l'onglet Encaissements,
  //    garde backend inchangée).
  const [newPaymentOpen, setNewPaymentOpen] = useState(false);
  const [modalRefreshTrigger, setModalRefreshTrigger] = useState(0);

  // ⭐ Pagination serveur (pattern identique à StudentMovementsContent.tsx — Task 9-a)
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAccounts, setTotalAccounts] = useState(0);
  // ⭐ KPIs globaux (sommes agrégées sur TOUS les comptes, pas seulement la page active)
  const [globalSums, setGlobalSums] = useState<{
    totalDue: number;
    totalPaid: number;
    balance: number;
    actualArrears: number;
  }>({ totalDue: 0, totalPaid: 0, balance: 0, actualArrears: 0 });

  // ─── Splitter redimensionnable entre Comptes élèves (gauche) et Historique (droite) ───
  // leftPercent = pourcentage de largeur du panneau gauche (20% à 80%)
  const [leftPercent, setLeftPercent] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const splitterRef = useRef<HTMLDivElement>(null);

  // Détecter le breakpoint desktop (lg = 1024px) pour activer le splitter
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  // Gestionnaires du splitter (mouse + touch)
  const startResize = useCallback((clientX: number) => {
    setIsResizing(true);
  }, []);

  const onResizeMove = useCallback((clientX: number) => {
    if (!isResizing || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const delta = clientX - rect.left;
    const percent = (delta / rect.width) * 100;
    // Borner entre 20% et 80% pour éviter qu'un tableau devienne inutilisable
    const clamped = Math.max(20, Math.min(80, percent));
    setLeftPercent(clamped);
  }, [isResizing]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => onResizeMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) onResizeMove(e.touches[0].clientX);
    };
    const handleEnd = () => setIsResizing(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleEnd);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, onResizeMove]);

  // L'année effective = filtre utilisateur OU année du contexte
  const effectiveYearId = filterYearId || academicYear?.id || '';

  const loadAccounts = async () => {
    if (!effectiveYearId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        academicYearId: effectiveYearId,
        page: String(currentPage),
        limit: String(PAGE_SIZE),
      });
      if (filterClassId) params.set('classId', filterClassId);
      if (filterStatus) params.set('status', filterStatus);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      // ⭐ Task 23 : inclure les élèves abandonnés si demandé
      if (showWithdrawn) params.set('includeWithdrawn', 'true');
      const data = await financeService.getStudentAccounts(Object.fromEntries(params.entries()));
      // ⭐ Gérer la réponse paginée { data, total, page, totalPages, sums } ou l'ancien format array
      const allItems = Array.isArray(data) ? data : (data?.data ?? []);
      setAccounts(allItems);
      setTotalAccounts(Array.isArray(data) ? data.length : (data?.total ?? 0));
      setTotalPages(Array.isArray(data) ? 1 : (data?.totalPages ?? 1));
      if (!Array.isArray(data) && data?.sums) {
        setGlobalSums({
          totalDue: Number(data.sums.totalDue ?? 0),
          totalPaid: Number(data.sums.totalPaid ?? 0),
          balance: Number(data.sums.balance ?? 0),
          actualArrears: Number(data.sums.actualArrears ?? 0),
        });
      } else {
        // Fallback : calculer sur la page active si pas de sums (rértro-compat)
        setGlobalSums({
          totalDue: allItems.reduce((s, a) => s + Number(a.totalDue ?? 0), 0),
          totalPaid: allItems.reduce((s, a) => s + Number(a.totalPaid ?? 0), 0),
          balance: allItems.reduce((s, a) => s + Number(a.balance ?? 0), 0),
          actualArrears: allItems.reduce((s, a) => s + Number(a.actualArrears ?? 0), 0),
        });
      }
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Erreur de chargement',
        description: e?.message || 'Impossible de charger les comptes élèves.',
        variant: 'destructive',
      });
      setAccounts([]);
      setTotalAccounts(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // ⭐ Recharger quand la page ou les filtres changent (search avec debounce 250ms)
  //    OU quand refreshTrigger change (incrémenté par FeeStructuresContent
  //    après modification/création de frais → le backend a déjà recalculé
  //    les montants synchrone, il suffit de recharger les données frontend).
  useEffect(() => {
    const timeout = setTimeout(() => {
      loadAccounts();
    }, searchQuery ? 250 : 0);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveYearId, filterClassId, filterStatus, searchQuery, currentPage, showWithdrawn, refreshTrigger]);

  // ⭐ Écouter l'événement global 'finance-accounts-changed' dispatché par
  //    FeeOverridesContent (après création/modification/suppression de
  //    personnalisations) et RecoveryContent (après ajout d'arriérés).
  //    Ces composants sont sur des pages/routes séparées — le custom event
  //    permet la communication cross-page sans prop drilling.
  useEffect(() => {
    const handler = () => {
      console.log('[StudentAccounts] finance-accounts-changed event received → reloading');
      loadAccounts();
    };
    window.addEventListener('finance-accounts-changed', handler);
    return () => window.removeEventListener('finance-accounts-changed', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⭐ Reset page à 1 quand les filtres changent (sinon on reste bloqué sur une page vide)
  useEffect(() => {
    setCurrentPage(1);
  }, [filterClassId, filterStatus, searchQuery, effectiveYearId, showWithdrawn]);

  useEffect(() => {
    // Use /api/all-classes (bypasses school-level filter) so ALL classes are shown
    // ⭐ FIX 2026-09-09 (« bascule d'année globale ») : les classes suivent
    //    l'année du CONTEXTE (effectiveYearId = selecteur global + override
    //    local) — avant : année active serveur via BFF fallback, jamais
    //    rechargées au switch → filtre de classe désynchronisé des comptes.
    fetch(`/api/all-classes${effectiveYearId ? `?academicYearId=${effectiveYearId}` : ''}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((d) => setClasses(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setClasses([]));
  }, [effectiveYearId]);
  useEffect(() => {
    getAcademicYears()
      .then((d) => setAcademicYears(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setAcademicYears([]));
  }, []);

  // Pré-sélectionner un élève si l'URL contient ?studentId=X
  // (depuis le bouton "Régime & Finance" dans le module Élève)
  useEffect(() => {
    if (preselectStudentId && accounts.length > 0) {
      // Trouver le compte de cet élève
      const account = accounts.find((a) => a.studentId === preselectStudentId);
      if (account) {
        setSelectedAccountId(account.id);
        loadPaymentHistory(account.id);
      }
    }
  }, [preselectStudentId, accounts]);

  const loadDetail = async (id: string) => {
    try {
      const data = await financeService.getStudentAccountDetails(id);
      setDetailAccount(data);
    } catch (e) {
      console.error(e);
    }
  };

  // Charger l'historique des paiements d'un élève (tableau droit)
  // Utilise getStudentAccountDetails qui inclut les transactions
  const loadPaymentHistory = async (accountId: string) => {
    setLoadingHistory(true);
    try {
      const data = await financeService.getStudentAccountDetails(accountId);
      setPaymentHistory(data?.transactions ?? []);
    } catch (e) {
      console.error(e);
      setPaymentHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Sélectionner un élève dans le tableau gauche → charger son historique à droite
  const selectStudent = (accountId: string) => {
    setSelectedAccountId(accountId);
    loadPaymentHistory(accountId);
  };

  const handleUnblock = async () => {
    if (!unblockModal || !unblockReason.trim()) return;
    try {
      await financeService.unblockStudentAccount(unblockModal, { reason: unblockReason });
      setUnblockModal(null);
      setUnblockReason('');
      toast({ title: 'Compte débloqué', description: 'Le compte a été débloqué avec succès.' });
      loadAccounts();
      if (detailAccount?.id === unblockModal) loadDetail(unblockModal);
    } catch (error: any) {
      toast({ title: 'Erreur', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    }
  };

  // ⭐ ÉDITION D'UN ENCAISSEMENT (promoteur) — après succès : recharger
  //    l'historique du compte affiché + les comptes (soldes), et notifier
  //    les autres pages du module Finance (event finance-accounts-changed).
  const handleEditPaymentSuccess = (result: any) => {
    setEditPaymentTx(null);
    if (result?.warning) {
      toast({ title: 'Paiement modifié', description: result.warning, variant: 'warning' });
    } else {
      toast({
        title: 'Paiement modifié',
        description: `Reçu ${result?.receiptNumber || ''} mis à jour — soldes et imputations recalculés.`,
      });
    }
    if (selectedAccountId) loadPaymentHistory(selectedAccountId);
    if (detailAccount?.id === selectedAccountId && selectedAccountId) loadDetail(selectedAccountId);
    loadAccounts();
    window.dispatchEvent(new CustomEvent('finance-accounts-changed'));
  };

  // ⭐ SUPPRESSION D'UN ENCAISSEMENT (promoteur)
  const handleDeletePayment = async () => {
    if (!deletePaymentTx || !deleteReason.trim()) return;
    setDeleteLoading(true);
    try {
      const result = await financeService.deleteTransaction(deletePaymentTx.id, deleteReason.trim());
      setDeletePaymentTx(null);
      setDeleteReason('');
      toast({
        title: 'Paiement supprimé',
        description: `Reçu ${result?.receiptNumber || deletePaymentTx.receiptNumber || ''} (${formatCurrency(Number(deletePaymentTx.amount ?? 0))}) supprimé — soldes et imputations recalculés.`,
      });
      if (selectedAccountId) loadPaymentHistory(selectedAccountId);
      if (detailAccount?.id === selectedAccountId && selectedAccountId) loadDetail(selectedAccountId);
      loadAccounts();
      window.dispatchEvent(new CustomEvent('finance-accounts-changed'));
    } catch (error: any) {
      toast({ title: 'Erreur de suppression', description: error?.message || 'Erreur réseau', variant: 'destructive' });
    } finally {
      setDeleteLoading(false);
    }
  };

  // ⭐ CRÉATION D'UN ENCAISSEMENT POUR L'ÉLÈVE SÉLECTIONNÉ — après succès :
  //    recharger l'historique du compte affiché + les comptes (soldes) +
  //    le détail éventuellement ouvert, incrémenter le refreshTrigger du
  //    modal (recharge des caisses) et notifier les autres pages Finance.
  //    Le modal reste ouvert (bandeau reçu) — l'utilisateur le ferme lui-même.
  const handleNewPaymentSuccess = () => {
    if (selectedAccountId) loadPaymentHistory(selectedAccountId);
    if (detailAccount?.id === selectedAccountId && selectedAccountId) loadDetail(selectedAccountId);
    loadAccounts();
    setModalRefreshTrigger((n) => n + 1);
    window.dispatchEvent(new CustomEvent('finance-accounts-changed'));
  };

  // ⭐ Compte de l'élève sélectionné (pour prérégler le modal d'encaissement).
  //    On cherche dans les comptes chargés (page courante) — le compte est
  //    forcément présent puisqu'il vient d'être cliqué dans le tableau.
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  // Filtrage frontend par recherche (nom, prénom, matricule) — SUPPRIMÉ
  // (le backend filtre déjà en SQL — pattern identique au module Élève Task 9-a).
  // On conserve juste le tri alphabétique pour l'affichage.
  const filteredAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      const nameA = `${a.student?.lastName || ''} ${a.student?.firstName || ''}`.toLowerCase();
      const nameB = `${b.student?.lastName || ''} ${b.student?.firstName || ''}`.toLowerCase();
      return nameA.localeCompare(nameB, 'fr');
    });
  }, [accounts]);

  // Export CSV de la liste filtrée
  const handleExportCSV = () => {
    if (filteredAccounts.length === 0) {
      toast({ title: 'Aucune donnée', description: 'Rien à exporter.', variant: 'destructive' });
      return;
    }
    const headers = ['Élève', 'Matricule', 'Total dû', 'Payé', 'Solde', 'Statut', 'Personnalisé'];
    const rows = filteredAccounts.map((a) => {
      const name = a.student ? `${a.student.lastName} ${a.student.firstName}` : a.studentId;
      const matricule = a.student?.studentCode || '';
      // ⭐ Task 29 : utiliser hasOverride du backend (pas de comparaison de montants)
      const hasOverride = a.hasOverride === true ||
        (a.breakdowns ?? []).some((b: any) => b.hasOverride === true);
      return [
        name,
        matricule,
        Number(a.totalDue ?? 0),
        Number(a.totalPaid ?? 0),
        Number(a.balance ?? 0),
        a.status || '',
        hasOverride ? 'Oui' : 'Non',
      ];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const yearLabel = academicYears.find((y) => y.id === effectiveYearId)?.name || 'annee';
    link.href = url;
    link.download = `comptes-eleves-${yearLabel}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export réussi', description: `${filteredAccounts.length} compte(s) exporté(s).` });
  };

  // Export Excel de TOUS les comptes élèves (pas seulement la page active)
  // ⭐ Task 20-a : on fetch tous les comptes avec exportAll=true pour avoir la liste complète
  // (au lieu des 50 comptes de la page courante). Pour l'export global (toutes les classes),
  // on crée une feuille Excel par classe via l'option groupByClass.
  const handleExportExcel = async () => {
    if (filteredAccounts.length === 0) {
      toast({ title: 'Aucune donnée', description: 'Rien à exporter.', variant: 'destructive' });
      return;
    }
    setExporting('excel');
    try {
      const yearLabel = academicYears.find((y) => y.id === effectiveYearId)?.name || '';
      const classLabel = filterClassId
        ? classes.find((c) => c.id === filterClassId)?.name || ''
        : '';

      // ⭐ Task 20-a : fetch de TOUS les comptes (sans pagination, cap levé côté backend)
      const exportParams: Record<string, string> = {
        academicYearId: effectiveYearId,
        exportAll: 'true',
        limit: '99999',
      };
      if (filterClassId) exportParams.classId = filterClassId;
      if (filterStatus) exportParams.status = filterStatus;
      if (searchQuery.trim()) exportParams.search = searchQuery.trim();
      // ⭐ Task 23 : respecter le toggle showWithdrawn pour les exports aussi
      if (showWithdrawn) exportParams.includeWithdrawn = 'true';

      const data = await financeService.getStudentAccounts(exportParams);
      const allAccounts: any[] = Array.isArray(data) ? data : (data?.data ?? []);

      if (allAccounts.length === 0) {
        toast({ title: 'Aucune donnée', description: 'Aucun compte à exporter.', variant: 'destructive' });
        return;
      }

      // ⭐ Task 20-a : si aucune classe spécifique n'est filtrée → une feuille par classe.
      // Si une classe est filtrée → une seule feuille (comportement historique).
      const groupByClass = !filterClassId;

      await exportStudentAccountsToExcel(allAccounts, {
        schoolName: tenant?.name || 'Établissement',
        schoolLogoUrl: tenant?.id ? `/api/tenants/${tenant.id}/logo` : null,
        academicYear: yearLabel,
        classFilter: classLabel,
        schoolLevel: schoolLevel?.code || undefined,
        schoolAddress: tenant?.address || null,
        schoolPhone: tenant?.phone || null,
        schoolEmail: tenant?.email || null,
        groupByClass,
      });

      const sheetInfo = groupByClass
        ? ` (${new Set(allAccounts.map((a) => a.studentEnrollments?.[0]?.class?.name || 'Sans classe')).size} feuilles par classe)`
        : '';
      toast({
        title: '✅ Export Excel généré',
        description: `${allAccounts.length} compte(s) exporté(s)${sheetInfo}.`,
      });
    } catch (e: any) {
      toast({ title: 'Erreur export Excel', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  // Export PDF de TOUS les comptes élèves (généré côté backend via Puppeteer)
  // ⭐ Task 20-a : passe le filtre classId au backend pour que le PDF respecte la vue courante.
  // Le backend récupère TOUS les comptes (sans pagination) — pas seulement la page active.
  const handleExportPdf = async () => {
    if (filteredAccounts.length === 0) {
      toast({ title: 'Aucune donnée', description: 'Rien à exporter.', variant: 'destructive' });
      return;
    }
    setExporting('pdf');
    try {
      const classLabel = filterClassId
        ? classes.find((c) => c.id === filterClassId)?.name || ''
        : '';
      // ⭐ Task 20-a : on transmet academicYearId + classId (optionnel) au backend.
      // Le backend PDF récupère TOUS les comptes matchés (pas de pagination).
      const params = new URLSearchParams({ academicYearId: effectiveYearId });
      if (filterClassId) params.set('classId', filterClassId);
      // ⭐ Task 23 : respecter le toggle showWithdrawn pour l'export PDF
      if (showWithdrawn) params.set('includeWithdrawn', 'true');
      const res = await fetch(`/api/finance/exports/student-accounts/pdf?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewDoc({
        filePath: url,
        fileName: studentAccountsFilename(classLabel, 'pdf'),
        mimeType: 'application/pdf',
      });
    } catch (e: any) {
      toast({ title: 'Erreur export PDF', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  // Export PDF de l'historique d'un élève spécifique
  const handleExportStudentHistory = async (account: any) => {
    setExporting('student-pdf');
    try {
      const yearLabel = academicYears.find((y) => y.id === effectiveYearId)?.name || '';
      // Récupérer les transactions de cet élève
      const txs = await financeService.getTransactions({
        academicYearId: effectiveYearId,
        studentAccountId: account.id,
      });
      const transactions = Array.isArray(txs) ? txs : [];
      const studentName = account.student
        ? `${account.student.lastName} ${account.student.firstName}`
        : 'Élève';
      const studentMatricule = account.student?.studentCode || account.student?.matricule || '—';
      const className = account.studentEnrollments?.[0]?.class?.name || '';

      const { url } = await exportStudentHistoryToPdf(transactions, {
        schoolName: tenant?.name || 'Établissement',
        schoolLogoUrl: tenant?.id ? `/api/tenants/${tenant.id}/logo` : null,
        academicYear: yearLabel,
        studentName,
        studentMatricule,
        className,
        schoolLevel: schoolLevel?.code || undefined,
        schoolAddress: tenant?.address || null,
        schoolPhone: tenant?.phone || null,
        schoolEmail: tenant?.email || null,
        // Infos multi-année (FIFO)
        actualArrears: Number(account.actualArrears) || 0,
        feeArrears: account.feeArrears || [],
        totalDue: Number(account.totalDue) || 0,
        totalPaid: Number(account.totalPaid) || 0,
        balance: Number(account.balance) || 0,
      });
      setPreviewDoc({
        filePath: url,
        fileName: studentHistoryFilename(studentName, 'pdf'),
        mimeType: 'application/pdf',
      });
    } catch (e: any) {
      toast({ title: 'Erreur export historique', description: e.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <ModuleContentArea
        layout="custom"
        toolbar={
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-slate-600">
              Solde, total dû, payé et statut par élève et par année.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={filteredAccounts.length === 0 || exporting !== null} className="border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                {exporting === 'excel' ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                )}
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={filteredAccounts.length === 0 || exporting !== null} className="border-rose-300 text-rose-700 hover:bg-rose-100">
                {exporting === 'pdf' ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-1.5" />
                )}
                PDF
              </Button>
            </div>
          </div>
        }
      >
        {/* ⭐ KPIs globaux — sommes agrégées sur TOUS les comptes (pas seulement la page active).
            Pattern identique au module Élève (stats globales calculées sur le vrai total serveur). */}
        <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Élèves</p>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-slate-800 mt-1">{totalAccounts}</p>
            <p className="text-[10px] text-slate-400">compte(s) au total</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Total dû</p>
              <Wallet className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-xl font-bold text-rose-700 mt-1">{formatCurrency(globalSums.totalDue)}</p>
            {globalSums.actualArrears > 0 && (
              <p className="text-[10px] text-amber-600">dont arriérés : {formatCurrency(globalSums.actualArrears)}</p>
            )}
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Total payé</p>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl font-bold text-emerald-700 mt-1">{formatCurrency(globalSums.totalPaid)}</p>
            <p className="text-[10px] text-slate-400">encaissements cumulés</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Reste à payer</p>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <p className={`text-xl font-bold mt-1 ${globalSums.balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {formatCurrency(globalSums.balance)}
            </p>
            <p className="text-[10px] text-slate-400">solde global restant</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-4 items-end">
          {/* Filtre Année scolaire */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Année scolaire</Label>
            <Select
              value={filterYearId || (academicYear?.id ?? 'ALL')}
              onValueChange={(v) => setFilterYearId(v === 'ALL' ? '' : v)}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Année courante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={academicYear?.id ?? 'ALL'}>Année courante</SelectItem>
                {academicYears.filter((y) => y.id !== academicYear?.id).map((y) => (
                  <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Recherche par nom/matricule */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Rechercher</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom, prénom ou matricule..."
                className="pl-9 w-full sm:w-[260px]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Classe</Label>
            <Select value={filterClassId || 'ALL'} onValueChange={(v) => setFilterClassId(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Toutes les classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les classes</SelectItem>
                {filterAndSortClasses(classes).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Statut</Label>
            <Select value={filterStatus || 'ALL'} onValueChange={(v) => setFilterStatus(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les statuts</SelectItem>
                <SelectItem value="PAID">Payé</SelectItem>
                <SelectItem value="PARTIAL">Partiel</SelectItem>
                <SelectItem value="OVERDUE">En retard</SelectItem>
                <SelectItem value="BLOCKED">Bloqué</SelectItem>
                <SelectItem value="ACTIVE">Actif</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* ⭐ Task 23 : Toggle pour afficher/masquer les élèves abandonnés (status=WITHDRAWN) */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Abandonnés</Label>
            <button
              type="button"
              onClick={() => setShowWithdrawn(!showWithdrawn)}
              className={`h-9 px-3 rounded-md border text-xs font-medium transition flex items-center gap-2 ${
                showWithdrawn
                  ? 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              title="Afficher ou masquer les élèves qui ont abandonné (status=WITHDRAWN)"
            >
              <span className={`w-2 h-2 rounded-full ${showWithdrawn ? 'bg-amber-500' : 'bg-slate-300'}`} />
              {showWithdrawn ? 'Affichés' : 'Masqués'}
            </button>
          </div>
        </div>

        {/* Layout 2 tableaux côte à c avec splitter redimensionnable */}
        <div
          ref={containerRef}
          className="flex w-full gap-4 lg:gap-0 flex-col lg:flex-row"
          style={{ minHeight: '400px' }}
        >
          {/* TABLEAU GAUCHE — Comptes élèves (cliquable pour sélectionner) */}
          <div
            className="flex flex-col min-w-0"
            style={{ width: isDesktop ? `calc(${leftPercent}% - 4px)` : '100%' }}
          >
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <UserCog className="w-4 h-4 text-slate-500" />
              Comptes élèves
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-auto" style={{ maxHeight: '70vh' }}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>Élève</TableHead>
                    <TableHead className="text-right">Total dû</TableHead>
                    <TableHead className="text-right">Arriérés</TableHead>
                    <TableHead className="text-right">Payé</TableHead>
                    <TableHead className="text-right">Solde</TableHead>
                    <TableHead>Statut</TableHead>
                    {/* ⭐ Colonne "Fondateur" — toggle pour marquer les élèves dont les parents paient directement le fondateur */}
                    <TableHead className="text-center" title="Marquer pour paiement direct au fondateur">Fondateur</TableHead>
                    <TableHead className="text-center">Historique</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-500 py-8">Chargement...</TableCell>
                    </TableRow>
                  ) : filteredAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-500 py-12">
                        {searchQuery ? `Aucun élève trouvé pour « ${searchQuery} ».` : 'Aucun compte élève.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAccounts.map((a) => {
                      // ⭐ Task 29 : le badge "Pers." ne doit s'afficher que si l'élève
                      // a VRAIMENT un override en DB. Avant on comparait initialAmount
                      // avec feeStructure.totalAmount, ce qui était faux après suppression
                      // d'un override (les breakdowns n'étaient pas toujours recalculés).
                      // Maintenant on utilise la propriété hasOverride envoyée par le backend.
                      const hasOverride = a.hasOverride === true ||
                        (a.breakdowns ?? []).some((b: any) => b.hasOverride === true);
                      const isSelected = selectedAccountId === a.id;

                      // Code couleur basé sur le statut de paiement
                      const totalDue = Number(a.totalDue ?? 0);
                      const totalPaid = Number(a.totalPaid ?? 0);
                      const balance = Number(a.balance ?? 0);
                      const arrearsAmount = Number(a.arrearsAmount ?? 0);
                      const carriedArrears = Number(a.carriedArrears ?? 0);
                      // ⚠️ Utiliser actualArrears (calculé en backend en agrégeant les FeeArrear ouverts)
                      // au lieu de arrearsAmount + carriedArrears qui ne sont pas toujours synchronisés.
                      // On prend le max des deux pour ne jamais sous-estimer les arriérés affichés.
                      const actualArrears = Number(a.actualArrears ?? 0);
                      const totalArrears = Math.max(actualArrears, arrearsAmount + carriedArrears);
                      let rowBg = '';
                      let rowBorder = '';
                      if (balance <= 0) {
                        rowBg = 'bg-green-50'; rowBorder = 'border-l-4 border-green-500';
                      } else if (totalPaid <= 0) {
                        rowBg = 'bg-red-50'; rowBorder = 'border-l-4 border-red-500';
                      } else if (a.status === 'OVERDUE' || a.status === 'BLOCKED') {
                        rowBg = 'bg-orange-50'; rowBorder = 'border-l-4 border-orange-500';
                      } else {
                        rowBg = 'bg-amber-50'; rowBorder = 'border-l-4 border-amber-400';
                      }

                      // Extraire les montants par type de frais depuis les breakdowns
                      const breakdowns = a.breakdowns ?? [];
                      const getAmounts = (feeType: string) => {
                        const b = breakdowns.find((bd: any) => bd.feeStructure?.feeType === feeType);
                        return {
                          due: b ? Number(b.initialAmount ?? 0) : 0,
                          paid: b ? Number(b.paidAmount ?? 0) : 0,
                          remaining: b ? Number(b.remainingAmount ?? 0) : 0,
                        };
                      };
                      const inscription = getAmounts('INSCRIPTION');
                      const reinscription = getAmounts('REINSCRIPTION');
                      const tuition = getAmounts('TUITION');
                      const hasReinscription = reinscription.due > 0;

                      // Helper pour afficher un détail de frais — Total dû figé (jamais de calcul)
                      const FeeDetail = ({ label, due }: { label: string; due: number; paid?: number; remaining?: number }) => {
                        if (due <= 0) return null;
                        return (
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>{label} :</span>
                            <span>{formatCurrency(due)}</span>
                          </div>
                        );
                      };

                      return (
                        <TableRow
                          key={a.id}
                          className={`cursor-pointer transition-all duration-150 ${rowBorder} ${rowBg} ${
                            isSelected
                              ? 'ring-2 ring-blue-500 ring-inset bg-blue-50 shadow-sm'
                              : 'hover:bg-indigo-50 hover:shadow-sm'
                          }`}
                          onClick={() => selectStudent(a.id)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div>
                                {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.studentId}
                              </div>
                              {/* ⭐ Badge Nouvel/Ancien élève */}
                              {(() => {
                                const enrollmentType = a.student?.studentEnrollments?.[0]?.enrollmentType;
                                if (!enrollmentType) return null;
                                const isNew = enrollmentType === 'NEW';
                                return (
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                      isNew
                                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                        : 'bg-amber-100 text-amber-700 border border-amber-200'
                                    }`}
                                    title={isNew ? 'Nouvel élève — paie les frais d\'inscription' : 'Ancien élève — paie les frais de réinscription'}
                                  >
                                    {isNew ? 'Nouveau' : 'Ancien'}
                                  </span>
                                );
                              })()}
                              {hasOverride && (
                                <Badge variant="outline" className="text-purple-700 border-purple-300 bg-purple-50" title="Cet élève a une personnalisation de frais">
                                  <UserCog className="w-3 h-3 mr-1" />Pers.
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          {/* Total dû — INCLUANT les arriérés (FIFO) */}
                          <TableCell className="text-right">
                            <div className="font-semibold text-red-700">{formatCurrency(totalDue)}</div>
                            {totalArrears > 0 && (
                              <div className="text-[10px] text-amber-600 mt-0.5" title="Total dû incluant les arriérés des années antérieures (FIFO)">
                                dont arriérés : {formatCurrency(totalArrears)}
                              </div>
                            )}
                            <div className="mt-1 space-y-0.5 min-w-[120px]">
                              {inscription.due > 0 && <FeeDetail label="Inscription" {...inscription} />}
                              {hasReinscription && <FeeDetail label="Réinscription" {...reinscription} />}
                              {tuition.due > 0 && <FeeDetail label="Scolarité" {...tuition} />}
                              {totalArrears > 0 && <FeeDetail label="Arriérés" due={totalArrears} />}
                            </div>
                          </TableCell>
                          {/* Arriérés — montant des arriérés (récupéré via FeeArrear réels) */}
                          <TableCell className="text-right">
                            {totalArrears > 0 ? (
                              <div>
                                <div className="font-semibold text-amber-700 whitespace-nowrap">{formatCurrency(totalArrears)}</div>
                                {(a.feeArrears?.length > 0 || carriedArrears > 0) && (
                                  <div className="text-[10px] text-amber-500">
                                    {a.feeArrears?.length > 0
                                      ? `${a.feeArrears.length} arriéré${a.feeArrears.length > 1 ? 's' : ''} (multi-année)`
                                      : carriedArrears > 0
                                        ? `dont reporté : ${formatCurrency(carriedArrears)}`
                                        : ''}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </TableCell>
                          {/* Payé — avec détail par frais */}
                          <TableCell className="text-right">
                            <div className="font-semibold text-emerald-700">{formatCurrency(totalPaid)}</div>
                            <div className="mt-1 space-y-0.5 min-w-[120px]">
                              {inscription.due > 0 && (
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Inscription :</span>
                                  <span>{formatCurrency(inscription.paid)}</span>
                                </div>
                              )}
                              {hasReinscription && (
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Réinscription :</span>
                                  <span>{formatCurrency(reinscription.paid)}</span>
                                </div>
                              )}
                              {tuition.due > 0 && (
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Scolarité :</span>
                                  <span>{formatCurrency(tuition.paid)}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          {/* Solde — avec détail par frais (inclut arriérés) */}
                          <TableCell className="text-right">
                            <div className={`font-bold ${balance <= 0 ? 'text-green-600' : 'text-red-600'} whitespace-nowrap`}>{formatCurrency(balance)}</div>
                            <div className="mt-1 space-y-0.5 min-w-[120px]">
                              {totalArrears > 0 && (
                                <div className="flex justify-between text-[10px] text-amber-600">
                                  <span>Arriérés :</span>
                                  <span className={totalArrears <= 0 ? 'text-green-600' : ''}>{formatCurrency(totalArrears)}</span>
                                </div>
                              )}
                              {inscription.due > 0 && (
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Inscription :</span>
                                  <span className={inscription.remaining <= 0 ? 'text-green-600' : ''}>{formatCurrency(inscription.remaining <= 0 ? 0 : inscription.remaining)}</span>
                                </div>
                              )}
                              {hasReinscription && (
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Réinscription :</span>
                                  <span className={reinscription.remaining <= 0 ? 'text-green-600' : ''}>{formatCurrency(reinscription.remaining <= 0 ? 0 : reinscription.remaining)}</span>
                                </div>
                              )}
                              {tuition.due > 0 && (
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Scolarité :</span>
                                  <span className={tuition.remaining <= 0 ? 'text-green-600' : ''}>{formatCurrency(tuition.remaining <= 0 ? 0 : tuition.remaining)}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-800'}>{a.status}</Badge>
                          </TableCell>
                          {/* ⭐ Toggle "Fondateur" — marquer cet élève pour paiement direct au fondateur */}
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <PromoterEligibilityToggle
                              studentId={a.studentId}
                              studentName={a.student ? `${a.student.lastName} ${a.student.firstName}` : a.studentId}
                              academicYearId={effectiveYearId}
                            />
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                              onClick={() => handleExportStudentHistory(a)}
                              disabled={exporting !== null}
                              title="Générer l'historique PDF de cet élève"
                            >
                              {exporting === 'student-pdf' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-slate-600" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                  {/* ⭐ Ligne TOTAUX en rouge — frappe l'œil */}
                  {filteredAccounts.length > 0 && (
                    <TableRow className="bg-red-50 border-t-2 border-red-300 font-bold">
                      <TableCell className="text-right text-red-700 py-3">
                        TOTAUX ({filteredAccounts.length} élève(s))
                      </TableCell>
                      <TableCell className="text-right text-red-700 whitespace-nowrap py-3">
                        {formatCurrency(filteredAccounts.reduce((s, a) => s + Number(a.totalDue ?? 0), 0))}
                      </TableCell>
                      <TableCell className="text-right text-red-700 whitespace-nowrap py-3">
                        {formatCurrency(filteredAccounts.reduce((s, a) =>
                          s + Math.max(Number(a.actualArrears ?? 0), Number(a.arrearsAmount ?? 0) + Number(a.carriedArrears ?? 0)), 0
                        ))}
                      </TableCell>
                      <TableCell className="text-right text-red-700 whitespace-nowrap py-3">
                        {formatCurrency(filteredAccounts.reduce((s, a) => s + Number(a.totalPaid ?? 0), 0))}
                      </TableCell>
                      <TableCell className="text-right text-red-700 whitespace-nowrap py-3">
                        {formatCurrency(filteredAccounts.reduce((s, a) => s + Number(a.balance ?? 0), 0))}
                      </TableCell>
                      <TableCell colSpan={3} className="py-3"></TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ⭐ Pagination serveur — pattern identique à StudentMovementsContent.tsx */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 mt-2">
                <div className="text-xs text-slate-500">
                  Affichage <strong className="text-slate-700">
                    {totalAccounts > 0 ? `${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, totalAccounts)}` : '0'}
                  </strong> sur <strong className="text-slate-700">{totalAccounts}</strong> élève(s)
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1 || loading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Précédent
                  </button>
                  <div className="flex items-center gap-0.5">
                    {(() => {
                      const pages: (number | 'ellipsis')[] = [];
                      const add = (p: number) => { if (!pages.includes(p)) pages.push(p); };
                      add(1);
                      if (currentPage - 1 > 2) pages.push('ellipsis');
                      for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) add(p);
                      if (currentPage + 1 < totalPages - 1) pages.push('ellipsis');
                      if (totalPages > 1) add(totalPages);
                      return pages.map((p, i) => {
                        if (p === 'ellipsis') {
                          return (
                            <span key={`e-${i}`} className="px-2 text-slate-400">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </span>
                          );
                        }
                        return (
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            disabled={loading}
                            className={cn(
                              'min-w-[28px] h-7 px-2 text-xs font-bold rounded-lg transition disabled:opacity-50',
                              p === currentPage
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200'
                            )}
                          >
                            {p}
                          </button>
                        );
                      });
                    })()}
                  </div>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages || loading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Suivant
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SPLITTER — barre de redimensionnement entre les 2 tableaux (visible desktop uniquement) */}
          <div
            ref={splitterRef}
            className="hidden lg:flex flex-col items-center justify-center w-2 cursor-col-resize group relative flex-shrink-0"
            onMouseDown={(e) => {
              e.preventDefault();
              startResize(e.clientX);
            }}
            onTouchStart={(e) => {
              if (e.touches[0]) startResize(e.touches[0].clientX);
            }}
            title="Glissez pour redimensionner"
            style={{ touchAction: 'none' }}
          >
            {/* Zone de clic élargie (invisible) */}
            <div className="absolute inset-y-0 -left-1 -right-1" />
            {/* Ligne visuelle */}
            <div className={`w-0.5 h-full transition-colors ${isResizing ? 'bg-indigo-500' : 'bg-slate-200 group-hover:bg-indigo-400'}`} />
            {/* Poignée centrale avec indicateurs */}
            <div className={`absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 rounded-md px-1 py-2 transition-all ${isResizing ? 'bg-indigo-500' : 'bg-slate-100 group-hover:bg-indigo-50'}`}>
              <div className={`w-1 h-1 rounded-full ${isResizing ? 'bg-white' : 'bg-slate-400 group-hover:bg-indigo-500'}`} />
              <div className={`w-1 h-1 rounded-full ${isResizing ? 'bg-white' : 'bg-slate-400 group-hover:bg-indigo-500'}`} />
              <div className={`w-1 h-1 rounded-full ${isResizing ? 'bg-white' : 'bg-slate-400 group-hover:bg-indigo-500'}`} />
            </div>
          </div>

          {/* TABLEAU DROIT — Historique des encaissements de l'élève sélectionné */}
          <div
            className="flex flex-col min-w-0"
            style={{ width: isDesktop ? `calc(${100 - leftPercent}% - 4px)` : '100%' }}
          >
            {/* ⭐ En-tête + bouton « Nouvel encaissement » pour l'élève
                sélectionné : ouvre le modal préréglé sur son compte (sans
                sélecteurs). Permet au promoteur d'aligner la base sur les
                documents papier, et à tout rôle finance d'encaisser pour
                l'élève affiché sans repasser par l'onglet Encaissements. */}
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-500" />
                Historique des encaissements
                {selectedAccountId && (
                  <span className="text-xs font-normal text-slate-500 ml-1">
                    ({filteredAccounts.find((a) => a.id === selectedAccountId)?.student
                      ? `${filteredAccounts.find((a) => a.id === selectedAccountId)?.student.lastName} ${filteredAccounts.find((a) => a.id === selectedAccountId)?.student.firstName}`
                      : '—'})
                  </span>
                )}
              </h3>
              {selectedAccount && (
                <Button
                  size="sm"
                  onClick={() => setNewPaymentOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  title={`Encaisser un paiement pour ${selectedAccount.student ? `${selectedAccount.student.lastName} ${selectedAccount.student.firstName}` : 'cet élève'}`}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Nouvel encaissement
                </Button>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-auto" style={{ maxHeight: '70vh' }}>
              {!selectedAccountId ? (
                <div className="text-center text-gray-500 py-16">
                  <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p>Sélectionnez un élève à gauche pour voir son historique de paiements.</p>
                </div>
              ) : loadingHistory ? (
                <div className="text-center text-gray-500 py-8">Chargement de l'historique...</div>
              ) : paymentHistory.length === 0 ? (
                <div className="text-center text-gray-500 py-16">
                  <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p>Aucun paiement enregistré pour cet élève.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="whitespace-nowrap">N° reçu</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Montant</TableHead>
                      <TableHead className="whitespace-nowrap">Mode</TableHead>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Heure</TableHead>
                      <TableHead className="whitespace-nowrap">Référence</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentHistory.map((t: any) => (
                      <TableRow key={t.id} className="hover:bg-slate-50">
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {t.receiptNumber || '—'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-700 whitespace-nowrap">
                          {formatCurrency(t.amount)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline">
                            {(() => {
                              const labels: Record<string, string> = {
                                CASH: 'Espèces',
                                MOBILE_MONEY: 'Mobile Money',
                                WIRE: 'Virement',
                                FEDAPAY: 'Fedapay',
                              };
                              return labels[t.paymentMethod] || t.paymentMethod || '—';
                            })()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {t.createdAt ? new Date(t.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap" title={t.reference || ''}>
                          {t.reference || '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1 justify-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                              disabled={viewingTxId !== null}
                              onClick={async () => {
                                if (viewingTxId) return;
                                setViewingTxId(t.id);
                                try {
                                  const res = await fetch(financeService.getReceiptPdfUrl(t.id));
                                  // ⭐ FIX 2026-09-16 — même garde que TransactionsContent :
                                  //    ne pas nourrir le preview avec une erreur JSON (500).
                                  if (!res.ok) {
                                    const j: any = await res.json().catch(() => null);
                                    toast({ title: 'Reçu indisponible', description: j?.message || `Erreur serveur (HTTP ${res.status})`, variant: 'destructive' });
                                    return;
                                  }
                                  const blob = await res.blob();
                                  const url = URL.createObjectURL(blob);
                                  setPreviewDoc({ filePath: url, fileName: `recu-${t.receiptNumber || t.id}.pdf`, mimeType: 'application/pdf' });
                                } catch (e: any) {
                                  toast({ title: 'Erreur', description: 'Impossible de charger le reçu', variant: 'destructive' });
                                } finally {
                                  setViewingTxId(null);
                                }
                              }}
                              title="Visualiser le reçu"
                            >
                              {viewingTxId === t.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                                : <Eye className="w-3.5 h-3.5 text-slate-600" />}
                            </Button>
                            <a
                              href={financeService.getReceiptPdfUrl(t.id)}
                              download={`recu-${t.receiptNumber || t.id}.pdf`}
                              title="Télécharger le reçu PDF"
                              className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-indigo-100 hover:shadow-sm cursor-pointer transition-all duration-150"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-600" />
                            </a>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                              onClick={async () => {
                                try {
                                  const r = await financeService.resendReceipt(t.id, ['email']);
                                  const s = r?.channels?.email;
                                  if (s?.status === 'skipped') toast({ title: 'Contact manquant', description: s.reason, variant: 'destructive' }); else if (s?.status === 'failed') toast({ title: 'Échec d envoi', description: s.error || 'Échec de l envoi', variant: 'destructive' });
                                  else toast({ title: 'Reçu envoyé', description: `Email envoyé${s?.to ? ` à ${s.to}` : ''}` });
                                } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
                              }}
                              title="Envoyer par email"
                            >
                              <GmailIcon className="w-3.5 h-3.5" />
                            </Button>
                            {/* WhatsApp : dropdown avec 2 options (lien wa.me + API auto) */}
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                                onClick={() => setWhatsappMenuId(whatsappMenuId === t.id ? null : t.id)}
                                title="Envoyer par WhatsApp"
                              >
                                <WhatsAppIcon className="w-3.5 h-3.5" />
                              </Button>
                              {whatsappMenuId === t.id && (
                                <div className="absolute right-0 top-8 z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-full sm:w-[180px]">
                                  <button
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-center gap-2"
                                    onClick={async () => {
                                      setWhatsappMenuId(null);
                                      try {
                                        const data = await financeService.getWhatsAppLink(t.id);
                                        if (data?.url) {
                                          window.open(data.url, '_blank');
                                          toast({ title: 'WhatsApp ouvert', description: 'Cliquez sur Envoyer dans WhatsApp.' });
                                        } else {
                                          toast({ title: 'Pas de téléphone', description: 'Aucun numéro de parent trouvé.', variant: 'destructive' });
                                        }
                                      } catch (e: any) {
                                        toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
                                      }
                                    }}
                                  >
                                    <WhatsAppIcon className="w-3.5 h-3.5" />
                                    Envoi rapide (lien)
                                  </button>
                                  <button
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 flex items-center gap-2"
                                    onClick={async () => {
                                      setWhatsappMenuId(null);
                                      try {
                                        const r = await financeService.resendReceipt(t.id, ['whatsapp']);
                                        const s = r?.channels?.whatsapp;
                                        if (s?.status === 'skipped') toast({ title: 'Contact manquant', description: s.reason, variant: 'destructive' });
                                        else if (s?.status === 'failed') toast({ title: 'Échec d envoi', description: s.error || 'Échec de l envoi', variant: 'destructive' });
                                        else toast({ title: 'Reçu envoyé', description: `WhatsApp envoyé${s?.to ? ` à ${s.to}` : ''}` });
                                      } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
                                    }}
                                  >
                                    <WhatsAppIcon className="w-3.5 h-3.5 opacity-60" />
                                    Envoi auto (API)
                                  </button>
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                              onClick={async () => {
                                try {
                                  const r = await financeService.resendReceipt(t.id, ['sms']);
                                  const s = r?.channels?.sms;
                                  if (s?.status === 'skipped') toast({ title: 'Contact manquant', description: s.reason, variant: 'destructive' }); else if (s?.status === 'failed') toast({ title: 'Échec d envoi', description: s.error || 'Échec de l envoi', variant: 'destructive' });
                                  else toast({ title: 'Reçu envoyé', description: `SMS envoyé${s?.to ? ` à ${s.to}` : ''}` });
                                } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
                              }}
                              title="Envoyer par SMS"
                            >
                              <SmsIcon className="w-3.5 h-3.5" />
                            </Button>
                            {/* ⭐ PROMOTEUR uniquement : éditer / supprimer l'encaissement
                                (alignement sur les documents papier de l'école).
                                Visibilité réservée au promoteur — le backend
                                re-vérifie le rôle sur PATCH/DELETE (garde double).
                                Les lignes REVERSAL (écritures d'annulation, montant
                                négatif) ne sont PAS éditables/supprimables — boutons masqués. */}
                            {isPromoter && t.type !== 'REVERSAL' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 hover:bg-amber-100 hover:shadow-sm transition-all duration-150"
                                  onClick={() => setEditPaymentTx(t)}
                                  title="Modifier ce paiement (promoteur)"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-amber-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 hover:bg-red-100 hover:shadow-sm transition-all duration-150"
                                  onClick={() => { setDeletePaymentTx(t); setDeleteReason(''); }}
                                  title="Supprimer ce paiement (promoteur)"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {/* Récapitulatif du total payé si historique non vide */}
              {selectedAccountId && paymentHistory.length > 0 && (
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-sm">
                  <span className="text-slate-500">Total encaissé :</span>
                  <span className="font-bold text-emerald-700">
                    {formatCurrency(paymentHistory.reduce((sum, t) => sum + Number(t.amount ?? 0), 0))}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </ModuleContentArea>
      {detailAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {detailAccount.student ? `${detailAccount.student.lastName} ${detailAccount.student.firstName}` : 'Détail compte'}
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <span className="text-gray-600">Total dû :</span>{' '}
                <span className="font-semibold text-red-700">{formatCurrency(detailAccount.totalDue)}</span>
                {Number(detailAccount.actualArrears ?? 0) > 0 && (
                  <div className="text-[10px] text-amber-600 mt-0.5">
                    dont arriérés : {formatCurrency(Number(detailAccount.actualArrears ?? 0))}
                  </div>
                )}
              </div>
              <div><span className="text-gray-600">Total payé :</span> {formatCurrency(detailAccount.totalPaid)}</div>
              <div><span className="text-gray-600">Solde :</span> {formatCurrency(detailAccount.balance)}</div>
              <div><span className="text-gray-600">Statut :</span> <Badge className={STATUS_COLORS[detailAccount.status]}>{detailAccount.status}</Badge></div>
              {Number(detailAccount.actualArrears ?? detailAccount.arrearsAmount ?? 0) > 0 && (
                <div className="col-span-2">
                  <span className="text-gray-600">Arriérés (multi-année) :</span>{' '}
                  <span className="font-semibold text-amber-700">
                    {formatCurrency(Number(detailAccount.actualArrears ?? detailAccount.arrearsAmount ?? 0))}
                  </span>
                  {detailAccount.feeArrears?.length > 0 && (
                    <span className="text-xs text-slate-500 ml-2">
                      ({detailAccount.feeArrears.length} arriéré{detailAccount.feeArrears.length > 1 ? 's' : ''})
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* Détail des arriérés par année scolaire (multi-année) */}
            {detailAccount.feeArrears?.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  📅 Arriérés par année scolaire
                </h4>
                <ul className="space-y-1.5">
                  {detailAccount.feeArrears.map((arrear: any) => (
                    <li key={arrear.id} className="flex justify-between text-xs bg-white p-2 rounded border border-amber-100">
                      <div>
                        <div className="font-medium text-slate-800">{arrear.academicYearName}</div>
                        {arrear.notes && <div className="text-[10px] text-slate-500 mt-0.5">{arrear.notes}</div>}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-rose-700">{formatCurrency(arrear.balanceDue)} FCFA</div>
                        <div className="text-[10px] text-slate-500">
                          Dû : {formatCurrency(arrear.totalDue)} · Payé : {formatCurrency(arrear.totalPaid)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <h4 className="font-medium mb-2">Détail par frais</h4>
            <ul className="space-y-2">
              {Number(detailAccount.actualArrears ?? detailAccount.arrearsAmount ?? 0) > 0 && (
                <li className="flex justify-between text-sm">
                  <span>Arriéré (multi-année)</span>
                  <span>{formatCurrency(Number(detailAccount.actualArrears ?? detailAccount.arrearsAmount ?? 0))} — Non payé</span>
                </li>
              )}
              {detailAccount.breakdowns?.map((b: any) => {
                const fsTotal = Number(b.feeStructure?.totalAmount ?? 0);
                const initial = Number(b.initialAmount ?? 0);
                // ⭐ Task 29 : utiliser hasOverride du backend au lieu de comparer les montants
                const isOverridden = b.hasOverride === true;
                return (
                  <li key={b.id} className="flex justify-between text-sm">
                    <span className="flex items-center gap-1">
                      {b.feeStructure?.name ?? b.feeStructureId}
                      {isOverridden && (
                        <Badge variant="outline" className="text-[10px] text-purple-700 border-purple-300 bg-purple-50 ml-1" title={`Personnalisé: ${formatCurrency(fsTotal)} → ${formatCurrency(initial)}`}>
                          <UserCog className="w-2.5 h-2.5 mr-0.5" />Pers.
                        </Badge>
                      )}
                    </span>
                    <span className={isOverridden ? 'text-purple-700' : ''}>
                      {isOverridden && <span className="line-through text-slate-400 mr-1">{formatCurrency(fsTotal)}</span>}
                      {formatCurrency(initial)} — Soldé: {formatCurrency(b.paidAmount)}
                    </span>
                  </li>
                );
              })}
            </ul>
            {/* Section Personnalisations — liste les overrides de l'élève pour cette année */}
            {detailAccount.overrides?.length > 0 && (
              <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2 text-purple-900">
                  <UserCog className="w-4 h-4" />
                  Personnalisations appliquées ({detailAccount.overrides.length})
                </h4>
                <ul className="space-y-2">
                  {detailAccount.overrides.map((o: any) => {
                    const original = Number(o.feeStructure?.totalAmount ?? 0);
                    const custom = Number(o.customAmount ?? 0);
                    const reduction = Math.max(0, original - custom);
                    const reductionPct = original > 0 ? Math.round((reduction / original) * 100) : 0;
                    return (
                      <li key={o.id} className="text-sm bg-white rounded p-2 border border-purple-100">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">{o.feeStructure?.name ?? '—'}</p>
                            <p className="text-xs text-slate-500">
                              {o.feeStructure?.class?.name ? `Classe: ${o.feeStructure.class.name} · ` : ''}
                              {reduction > 0 ? `Réduction: ${formatCurrency(reduction)} (${reductionPct}%)` : 'Aucune réduction'}
                            </p>
                            <p className="text-xs text-slate-500 italic mt-0.5">Motif: {o.reason}</p>
                          </div>
                          <div className="text-right whitespace-nowrap">
                            <p className="text-xs text-slate-400 line-through">{formatCurrency(original)}</p>
                            <p className="font-semibold text-emerald-700">{formatCurrency(custom)}</p>
                          </div>
                        </div>
                        {o.creator && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Par {o.creator.firstName || ''} {o.creator.lastName || ''} · {o.createdAt ? new Date(o.createdAt).toLocaleDateString('fr-FR') : ''}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {detailAccount.transactions?.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Dernières transactions</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  {detailAccount.transactions.slice(0, 5).map((t: any) => (
                    <li key={t.id}>{t.receiptNumber} — {formatCurrency(t.amount)} — {t.createdAt ? new Date(t.createdAt).toLocaleDateString('fr-FR') : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <Link href="/app/finance/payments" className={buttonVariants({ variant: 'outline' })}>Voir historique transactions</Link>
              {(detailAccount.transactions?.find((t: any) => t.receiptUrl)?.receiptUrl) && (
                <Button variant="outline" onClick={() => window.open(detailAccount.transactions.find((t: any) => t.receiptUrl).receiptUrl, '_blank')}>Voir reçu</Button>
              )}
              <Button variant="outline" onClick={() => setDetailAccount(null)}>Fermer</Button>
              {detailAccount.isBlocked && (
                <Button onClick={() => { setUnblockModal(detailAccount.id); setDetailAccount(null); }}>Débloquer</Button>
              )}
            </div>
          </div>
        </div>
      )}
      {unblockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Levée de blocage</h3>
            <p className="text-sm text-gray-600 mb-2">Motif obligatoire (audit) :</p>
            <input
              className="w-full border rounded px-3 py-2 mb-4"
              value={unblockReason}
              onChange={(e) => setUnblockReason(e.target.value)}
              placeholder="Ex: accord de règlement"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setUnblockModal(null); setUnblockReason(''); }}>Annuler</Button>
              <Button onClick={handleUnblock} disabled={!unblockReason.trim()}>Débloquer</Button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ MODAL DE CRÉATION D'UN ENCAISSEMENT pour l'élève sélectionné —
          préréglé sur son compte (presetStudent + presetMode ACCOUNT :
          titre « Nouvel encaissement », carte récapitulative de l'élève,
          solde en direct). Le compte est rechargé via getOrCreate côté
          backend avec l'année du filtre courant (effectiveYearId). */}
      {newPaymentOpen && selectedAccount && (
        <NewPaymentModal
          academicYearId={effectiveYearId}
          accounts={[]}
          presetStudent={{
            studentId: selectedAccount.studentId,
            firstName: selectedAccount.student?.firstName ?? '',
            lastName: selectedAccount.student?.lastName ?? '',
            matricule: selectedAccount.student?.studentCode
              ?? selectedAccount.student?.matricule
              ?? undefined,
            academicClassName: selectedAccount.studentEnrollments?.[0]?.class?.name ?? undefined,
          }}
          presetMode="ACCOUNT"
          onClose={() => setNewPaymentOpen(false)}
          onSuccess={handleNewPaymentSuccess}
          refreshTrigger={modalRefreshTrigger}
        />
      )}

      {/* ⭐ MODAL D'ÉDITION D'UN ENCAISSEMENT (promoteur uniquement) */}
      {editPaymentTx && (
        <EditPaymentModal
          transaction={editPaymentTx}
          studentName={
            filteredAccounts.find((a) => a.id === selectedAccountId)?.student
              ? `${filteredAccounts.find((a) => a.id === selectedAccountId)?.student.lastName} ${filteredAccounts.find((a) => a.id === selectedAccountId)?.student.firstName}`.trim()
              : undefined
          }
          onClose={() => setEditPaymentTx(null)}
          onSuccess={handleEditPaymentSuccess}
        />
      )}

      {/* ⭐ MODAL DE CONFIRMATION DE SUPPRESSION (promoteur uniquement) */}
      {deletePaymentTx && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full border border-red-100 shadow-2xl">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
              <Trash2 className="w-5 h-5 text-red-600" />
              Supprimer ce paiement ?
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Reçu <span className="font-mono font-semibold">{deletePaymentTx.receiptNumber || '—'}</span>
              {' — '}
              <span className="font-semibold text-red-700">{formatCurrency(Number(deletePaymentTx.amount ?? 0))}</span>
              {' — '}
              {deletePaymentTx.createdAt
                ? new Date(deletePaymentTx.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : '—'}
            </p>
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                Action <strong>irréversible</strong> (promoteur) : les imputations sur les frais, le solde du
                compte et les caisses seront reversés. L&apos;opération est tracée dans le journal d&apos;audit.
                Préférez la modification quand c&apos;est possible.
              </p>
            </div>
            <label className="text-sm font-medium mb-1 block">Motif de la suppression *</label>
            <input
              className="w-full border rounded px-3 py-2 mb-4"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Ex: paiement inexistant sur le bordereau papier de l'école"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => { setDeletePaymentTx(null); setDeleteReason(''); }}
                disabled={deleteLoading}
              >
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleDeletePayment} disabled={!deleteReason.trim() || deleteLoading}>
                {deleteLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Supprimer définitivement
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de visualisation du reçu PDF */}
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => {
            if (previewDoc.filePath.startsWith('blob:')) URL.revokeObjectURL(previewDoc.filePath);
            setPreviewDoc(null);
          }}
        />
      )}
    </div>
  );
}
