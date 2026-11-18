'use client';

/**
 * ============================================================================
 * RECOVERY CONTENT — Recouvrement & Arriérés (shell avec onglets)
 * ============================================================================
 *
 * Outil fintech de pilotage du recouvrement :
 *   - Tableau de bord (KPIs : total arriérés, taux recouvrement)
 *   - Vue Arriérés (tableau filtrable par année, niveau, classe, gravité
 *     + pagination 50 lignes/page — seuls les élèves avec un restant dû > 0)
 *   - Vue Relances (historique des relances envoyées)
 *   - Paramétrage (relance automatique)
 *
 * Nettoyage 2026-11 : les onglets Actions, Promesses et Dossiers ont été
 * retirés (fonctionnalités jugées inutiles) — seul le suivi Arriérés/Relances
 * reste exposé.
 *
 * Backend : 2 systèmes coexistent
 *   - OLD : RecoveryReminder (cron nightly + envoi email réel)
 *   - NEW : FeeArrear + CollectionReminder (dossiers/promesses/actions
 *     retirés 2026-11 — collections_cases conservé pour l'escalade auto)
 *
 * Endpoints utilisés :
 *   GET  /api/finance/collection/arrears
 *   GET  /api/finance/collection/statistics
 *   POST /api/finance/collection/detect-arrears
 *   GET  /api/finance/recovery-reminders (OLD)
 *   POST /api/finance/recovery-reminders/manual (OLD)
 *   POST /api/finance/recovery-reminders/run-nightly (OLD)
 * ============================================================================
 */

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import {
  AlertCircle, TrendingDown, Users, Wallet, RefreshCw,
  Send, Loader2, Search, FileText, AlertTriangle,
  Zap, CheckCircle2, XCircle, Plus, FileSpreadsheet, Trash2, Settings,
  Upload, Banknote, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown, Pencil, Info,
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAppSession } from '@/contexts/AppSessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ImportArrearsModal from '@/components/finance/ImportArrearsModal';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';
import { WhatsAppIcon, GmailIcon, HelmConnectIcon } from '../OfficialIcons';
import { exportArrearsToPdf } from '@/lib/exports/finance-exports';
import { exportArrearsToExcel } from '@/lib/exports/excel-exports';
import { loadPdfLibs } from '@/lib/exports/pdf-loader';
import { loadXlsx } from '@/lib/exports/xlsx-loader';
import { useSchoolLevelsQuery } from '@/lib/query/use-school-levels';
import {
  useArrears, useCollectionReminders, useCollectionStatistics,
} from '@/lib/query/finance-hooks';
import { useQueryClient } from '@tanstack/react-query';

type TabId = 'dashboard' | 'arrears' | 'reminders' | 'settings';

// Nettoyage 2026-11 : onglets Actions / Promesses / Dossiers supprimés —
// seuls Tableau de bord, Arriérés, Relances et Paramétrage restent.
const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Tableau de bord', icon: TrendingDown },
  { id: 'arrears', label: 'Arriérés', icon: AlertCircle },
  { id: 'reminders', label: 'Relances', icon: Send },
  { id: 'settings', label: 'Paramétrage', icon: Settings },
];

// ⭐ Pagination de l'onglet Arriérés : 50 lignes par page, appliquée APRÈS
//    les filtres (année/niveau/classe/gravité/recherche) pour garantir que
//    chaque page reste cohérente avec les filtres actifs.
const ARREARS_PAGE_SIZE = 50;

const ARREARS_LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  LOW: { label: 'Faible', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  MEDIUM: { label: 'Moyen', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  HIGH: { label: 'Élevé', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  CRITICAL: { label: 'Critique', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
};

const REMINDER_LEVEL_CONFIG: Record<string, { label: string; variant: any }> = {
  // OLD system (RecoveryReminder) — toujours utilisé pour l'historique
  WARNING: { label: 'Avertissement', variant: 'secondary' },
  URGENT: { label: 'Urgent', variant: 'default' },
  FINAL_NOTICE: { label: 'Mise en demeure', variant: 'destructive' },
  // NEW system (RecoveryNotificationFinanceService) — termes français
  PREMIERE_RELANCE: { label: 'Première relance', variant: 'secondary' },
  DEUXIEME_RELANCE: { label: 'Deuxième relance', variant: 'default' },
  MISE_EN_DEMEURE: { label: 'Mise en demeure', variant: 'destructive' },
};

// Configuration pour le modal de relance manuelle (NOUVEAU système multi-canal)
const MANUAL_LEVEL_OPTIONS = [
  { value: 'PREMIERE_RELANCE', label: 'Première relance (J+3)', emoji: '📧', description: 'Rappel de paiement' },
  { value: 'DEUXIEME_RELANCE', label: 'Deuxième relance (J+7)', emoji: '⚠️', description: 'Rappel urgent' },
  { value: 'MISE_EN_DEMEURE', label: 'Mise en demeure (J+15)', emoji: '🚨', description: 'Mise en demeure finale' },
];

export default function RecoveryContent() {
  const { academicYear } = useModuleContext();
  const { tenant } = useAppSession();

  // SchoolHeader pour les exports (même pattern que TransactionsContent)
  const schoolInfo = useMemo(() => ({
    schoolName: tenant?.name || 'Établissement',
    schoolLogoUrl: tenant?.id ? `/api/tenants/${tenant.id}/logo` : undefined,
    academicYear: academicYear?.name || '',
    schoolAddress: tenant?.address || null,
    schoolPhone: tenant?.phone || null,
    schoolEmail: tenant?.email || null,
  }), [tenant, academicYear]);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [detecting, setDetecting] = useState(false);
  const [escalating, setEscalating] = useState(false);

  // ⭐ Hooks React Query partagés — remplacent loadAll() + 6 useState + useEffect.
  // Cache 2 min, dégradation gracieuse au timeout, invalidation croisée via
  // queryClient.invalidateQueries après mutations.
  const queryClient = useQueryClient();
  const { data: arrears = [], isLoading: arrearsLoading } = useArrears({});
  const { data: reminders = [], isLoading: remindersLoading } = useCollectionReminders({ academicYearId: academicYear?.id });
  const { data: statistics = null } = useCollectionStatistics(tenant?.id || '', academicYear?.id || '');

  // Loading global — true tant qu'au moins une query est en cours
  const loading = arrearsLoading || remindersLoading;

  // Helper pour invalider toutes les queries recovery après une mutation
  const invalidateRecoveryData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['finance', 'arrears'] });
    queryClient.invalidateQueries({ queryKey: ['finance', 'collection'] });
  }, [queryClient]);

  // Filtres arriérés
  const [arrearLevelFilter, setArrearLevelFilter] = useState<string>('ALL');
  const [arrearSearch, setArrearSearch] = useState('');
  const [arrearSchoolLevelId, setArrearSchoolLevelId] = useState<string>('ALL');
  const [arrearClassId, setArrearClassId] = useState<string>('ALL');
  // ⭐ FIX 2026-09-09 (« bascule d'année globale ») : par défaut, le tableau
  //    des arriérés affiche l'année du CONTEXTE (sélecteur global du header)
  //    au lieu de 'ALL' — la vue multi-années reste disponible via le filtre.
  //    Les arriérés restent chargés multi-années (données recouvrement par
  //    nature) mais le FILTRE suit l'année sélectionnée.
  const [arrearYearId, setArrearYearId] = useState<string>(academicYear?.id || 'ALL');

  // Quand l'année du contexte change, si le filtre année n'a pas été touché
  // manuellement (encore en 'ALL' ou égal à l'ancienne année du contexte),
  // il suit la nouvelle année.
  const lastCtxYearRef = useRef<string | null>(academicYear?.id ?? null);
  useEffect(() => {
    const prevCtx = lastCtxYearRef.current;
    lastCtxYearRef.current = academicYear?.id ?? null;
    if (academicYear?.id && academicYear.id !== prevCtx) {
      setArrearYearId((cur) => (cur === 'ALL' || cur === prevCtx ? academicYear.id! : cur));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id]);

  // Modal relance manuelle (NOUVEAU système multi-canal)
  const [manualModal, setManualModal] = useState(false);
  const [manualAccountId, setManualAccountId] = useState('');
  const [manualLevel, setManualLevel] = useState<'PREMIERE_RELANCE' | 'DEUXIEME_RELANCE' | 'MISE_EN_DEMEURE'>('PREMIERE_RELANCE');
  // État pour l'envoi multi-canal
  const [sendingMulti, setSendingMulti] = useState(false);

  // Modal saisie manuelle d'arriéré (onboarding nouveaux clients)
  const [manualArrearModal, setManualArrearModal] = useState(false);
  const [showImportArrears, setShowImportArrears] = useState(false);
  const [arrearStudentId, setArrearStudentId] = useState('');
  const [arrearAmount, setArrearAmount] = useState('');
  const [arrearReason, setArrearReason] = useState('');
  const [arrearYearName, setArrearYearName] = useState('');
  const [arrearSaving, setArrearSaving] = useState(false);

  // Niveaux scolaires chargés au niveau du parent (pour le filtrage)
  // ⭐ Hook React Query partagé — cache 5 min, dégradation gracieuse au timeout
  const { data: parentSchoolLevelsData = [] } = useSchoolLevelsQuery();
  const parentSchoolLevels = parentSchoolLevelsData;

  // Modal suppression de relance (personnalisé, comme pour les arriérés)
  const [deleteReminderModal, setDeleteReminderModal] = useState<{
    reminderId: string;
    studentName: string;
    reminderLevel: string;
    sentVia: string;
    sentAt: string;
    amountDue: number;
  } | null>(null);
  const [deletingReminder, setDeletingReminder] = useState(false);

  /**
   * Confirme la suppression d'une relance.
   */
  const handleConfirmDeleteReminder = async () => {
    if (!deleteReminderModal) return;
    setDeletingReminder(true);
    try {
      const r = await fetch(`/api/finance/recovery-reminders/${deleteReminderModal.reminderId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.error || data?.message || `Échec (HTTP ${r.status})`);
      }
      toast({ title: '✅ Relance supprimée', description: 'La relance a été retirée de l\'historique.' });
      setDeleteReminderModal(null);
      window.dispatchEvent(new CustomEvent('recovery-reload'));
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur', variant: 'destructive' });
    } finally {
      setDeletingReminder(false);
    }
  };

  // Modal suppression d'arriéré (personnalisé)
  const [deleteArrearModal, setDeleteArrearModal] = useState<{
    arrearId: string;
    studentName: string;
    className: string;
    academicYearName: string;
    balanceDue: number;
    totalDue: number;
    totalPaid: number;
    status: string;
  } | null>(null);
  const [deletingArrear, setDeletingArrear] = useState(false);

  /**
   * Confirme la suppression d'un arriéré via le modal personnalisé.
   * Appelle le BFF DELETE /api/finance/collection/arrears/[id] qui proxy vers
   * le backend DELETE /finance/collection/arrears/:id.
   */
  const handleConfirmDeleteArrear = async () => {
    if (!deleteArrearModal) return;
    setDeletingArrear(true);
    try {
      const r = await fetch(`/api/finance/collection/arrears/${deleteArrearModal.arrearId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.error || data?.message || `Échec de la suppression (HTTP ${r.status})`);
      }
      toast({
        title: '✅ Arriéré supprimé',
        description: `${formatCurrency(deleteArrearModal.balanceDue)} retiré pour ${deleteArrearModal.studentName}.`,
      });
      setDeleteArrearModal(null);
      window.dispatchEvent(new CustomEvent('recovery-reload'));
      // ⭐ Déclencher le rafraîchissement des comptes élèves (cross-page)
      window.dispatchEvent(new CustomEvent('finance-accounts-changed'));
    } catch (e: any) {
      toast({
        title: 'Erreur de suppression',
        description: e?.message || 'Erreur lors de la suppression',
        variant: 'destructive',
      });
    } finally {
      setDeletingArrear(false);
    }
  };

  // ⭐ Modal suppression MULTIPLE d'arriérés (sous-onglet Arriérés)
  // items = les arriérés cochés dans le tableau — un seul appel API, lot transactionnel.
  const [bulkDeleteModal, setBulkDeleteModal] = useState<{
    items: Array<{
      arrearId: string;
      studentName: string;
      className: string;
      academicYearName: string;
      balanceDue: number;
    }>;
  } | null>(null);
  const [deletingBulkArrears, setDeletingBulkArrears] = useState(false);

  /**
   * Confirme la suppression multiple via le modal dédié.
   * Appelle le BFF POST /api/finance/collection/arrears/bulk-delete qui proxy
   * vers le backend POST /finance/collection/arrears/bulk-delete (transaction
   * unique côté backend — tout ou rien).
   */
  const handleConfirmBulkDeleteArrears = async () => {
    if (!bulkDeleteModal) return;
    const ids = bulkDeleteModal.items.map((i) => i.arrearId);
    setDeletingBulkArrears(true);
    try {
      const r = await fetch('/api/finance/collection/arrears/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.error || data?.message || `Échec de la suppression (HTTP ${r.status})`);
      }
      toast({
        title: '✅ Arriérés supprimés',
        description: `${data?.deleted ?? ids.length} arriéré(s) supprimé(s) — ${formatCurrency(Number(data?.deletedAmount) || 0)} retiré(s) du recouvrement.`,
      });
      setBulkDeleteModal(null);
      window.dispatchEvent(new CustomEvent('recovery-reload'));
      // ⭐ Déclencher le rafraîchissement des comptes élèves (cross-page)
      window.dispatchEvent(new CustomEvent('finance-accounts-changed'));
      invalidateRecoveryData();
    } catch (e: any) {
      toast({
        title: 'Erreur de suppression',
        description: e?.message || 'Erreur lors de la suppression',
        variant: 'destructive',
      });
    } finally {
      setDeletingBulkArrears(false);
    }
  };

  // ⭐ loadAll() supprimé — remplacé par les hooks React Query ci-dessus.
  // Les données se rechargent automatiquement quand academicYear?.id change
  // (queryKey dépend de academicYearId).
  // Pour forcer un rechargement après une mutation, utiliser :
  //   invalidateRecoveryData() — invalide toutes les queries recovery.

  // Recharger quand un bouton delete/write-off déclenche l'événement recovery-reload
  // (compatibilité avec les composants enfants qui utilisent toujours window.dispatchEvent)
  useEffect(() => {
    const handler = () => invalidateRecoveryData();
    window.addEventListener('recovery-reload', handler);
    return () => window.removeEventListener('recovery-reload', handler);
  }, [invalidateRecoveryData]);

  const handleDetectArrears = async () => {
    if (!academicYear?.id) return;
    setDetecting(true);
    try {
      const result = await financeService.detectArrears(academicYear.id);
      toast({
        title: '✅ Détection terminée',
        description: `${result?.length ?? 0} arriéré(s) détecté(s) ou mis à jour.`,
      });
      await invalidateRecoveryData();
      // ⭐ Déclencher le rafraîchissement des comptes élèves (cross-page)
      window.dispatchEvent(new CustomEvent('finance-accounts-changed'));
    } catch (e: any) {
      toast({
        title: 'Erreur détection',
        description: e?.message || 'Erreur lors de la détection',
        variant: 'destructive',
      });
    } finally {
      setDetecting(false);
    }
  };

  const handleSendManual = async () => {
    if (!manualAccountId) return;
    setSendingMulti(true);
    try {
      // ⚠️ manualAccountId = StudentAccount.id (sélectionné dans le modal)
      // FeeArrear a studentId (= Student.id), PAS studentAccountId
      // Il faut donc récupérer le studentId depuis le StudentAccount sélectionné.

      // 1. Récupérer le StudentAccount pour obtenir le studentId
      const accountResponse = await fetch(`/api/finance/student-accounts/${manualAccountId}`, { credentials: 'include' });
      const accountData = accountResponse.ok ? await accountResponse.json() : null;
      const studentId = accountData?.studentId;

      if (!studentId) {
        toast({
          title: 'Erreur',
          description: 'Impossible de récupérer les informations de l\'élève.',
          variant: 'destructive',
        });
        setSendingMulti(false);
        return;
      }

      // 2. Trouver l'arriéré correspondant au studentId
      const matchingArrear = arrears.find((a) => a.studentId === studentId);

      if (!matchingArrear) {
        // Fallback : si pas d'arriéré FeeArrear, on appelle l'ancien système
        await financeService.sendManualReminder({
          studentAccountId: manualAccountId,
          level: 'WARNING',
          channel: 'SMS',
        });
        toast({
          title: '⚠️ Relance envoyée (ancien système)',
          description: 'Aucun arriéré FeeArrear trouvé pour cet élève. Relance basique envoyée par SMS.',
        });
      } else {
        // ⭐ NOUVEAU système : envoi multi-canal (email + Helm Connect) au parent
        //    Helm Connect remplace WhatsApp + SMS — le parent reçoit la relance
        //    directement dans son compte Helm Connect.
        const result = await financeService.sendRecoveryNotification(
          matchingArrear.id,
          ['email', 'helm_connect'],
          manualLevel,
        );
        const channels = result?.channels || {};
        const sent = Object.entries(channels).filter(([, v]: any) => v.status === 'sent').map(([k]) => k);
        const failed = Object.entries(channels).filter(([, v]: any) => v.status === 'failed').map(([k]) => k);
        const skipped = Object.entries(channels).filter(([, v]: any) => v.status === 'skipped').map(([k]) => k);

        const parts: string[] = [];
        if (sent.length > 0) parts.push(`✅ Envoyé: ${sent.join(', ')}`);
        if (skipped.length > 0) parts.push(`⏭️ Ignoré: ${skipped.join(', ')} (contact manquant)`);
        if (failed.length > 0) parts.push(`❌ Échec: ${failed.join(', ')}`);

        toast({
          title: sent.length > 0 ? '✅ Relance envoyée' : (skipped.length > 0 ? '⚠️ Contact manquant' : '❌ Échec d\'envoi'),
          description: parts.join(' — ') || 'Aucune notification envoyée.',
          variant: sent.length > 0 ? 'success' : 'destructive',
        });
      }
      setManualModal(false);
      invalidateRecoveryData();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error?.message || 'Erreur réseau',
        variant: 'destructive',
      });
    } finally {
      setSendingMulti(false);
    }
  };

  /**
   * Envoie une relance multi-canal pour un arriéré spécifique (depuis les
   * boutons d'action dans le tableau Relances ou Arriérés).
   * Reproduit le pattern des notifications de reçu (3 boutons icônes).
   */
  const handleSendChannelReminder = async (
    arrearId: string,
    channel: 'email' | 'whatsapp' | 'sms',
    level: 'PREMIERE_RELANCE' | 'DEUXIEME_RELANCE' | 'MISE_EN_DEMEURE' = 'PREMIERE_RELANCE',
  ) => {
    try {
      const result = await financeService.sendRecoveryNotification(arrearId, [channel], level);

      // Vérifier d'abord si le backend a renvoyé une erreur globale
      if (result?.error) {
        toast({ title: 'Erreur', description: result.error.error || 'Échec de l\'envoi', variant: 'destructive' });
        return;
      }

      const s = result?.channels?.[channel];
      if (!s) {
        // Si le canal n'est pas dans la réponse, c'est une erreur
        toast({ title: 'Erreur', description: `Réponse invalide du serveur pour ${channel}`, variant: 'destructive' });
        return;
      }
      if (s.status === 'skipped') {
        toast({ title: '⚠️ Contact manquant', description: s.error || `Aucun contact parent pour ${channel}. Vérifiez les informations du responsable légal.`, variant: 'destructive' });
      } else if (s.status === 'failed') {
        toast({ title: '❌ Échec d\'envoi', description: s.error || `Échec ${channel}`, variant: 'destructive' });
      } else if (s.status === 'sent') {
        toast({
          title: '✅ Relance envoyée',
          description: `${channel.charAt(0).toUpperCase() + channel.slice(1)} envoyé${s.to ? ` à ${s.to}` : ''}`,
        });
      } else {
        // Statut inconnu — ne pas afficher succès
        toast({ title: 'Statut inconnu', description: `Réponse inattendue: ${s.status}`, variant: 'destructive' });
      }
      invalidateRecoveryData();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  /**
   * Saisie manuelle d'un arriéré (onboarding nouveaux clients).
   * Permet aux écoles qui débutent avec Academia Helm de saisir les arriérés
   * existants (sur papier) dans le système.
   */
  const handleCreateManualArrear = async () => {
    if (!arrearStudentId || !arrearAmount) return;
    // Si pas d'année saisie, on utilise l'année active par défaut
    const yearName = arrearYearName.trim() || academicYear?.name || '';
    if (!yearName) {
      toast({ title: 'Erreur', description: 'Veuillez saisir une année scolaire.', variant: 'destructive' });
      return;
    }
    setArrearSaving(true);
    try {
      const amount = Number(arrearAmount);
      if (isNaN(amount) || amount <= 0) {
        toast({ title: 'Erreur', description: 'Le montant doit être un nombre positif.', variant: 'destructive' });
        return;
      }
      // Utiliser academicYearName au lieu de academicYearId — le backend
      // cherchera/créera l'année automatiquement si elle n'existe pas.
      const result = await financeService.createManualArrear({
        studentId: arrearStudentId,
        academicYearName: yearName,
        amount,
        reason: arrearReason || undefined,
      });
      toast({
        title: '✅ Arriéré enregistré',
        description: `${formatCurrency(amount)} ajouté aux arriérés de l'élève pour l'année ${result.academicYearName || yearName}.` +
          (result.yearCreated ? ' (année scolaire créée automatiquement)' : ''),
      });
      setManualArrearModal(false);
      setArrearStudentId('');
      setArrearAmount('');
      setArrearReason('');
      setArrearYearName('');
      invalidateRecoveryData();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur réseau', variant: 'destructive' });
    } finally {
      setArrearSaving(false);
    }
  };

  /**
   * Workflow d'escalade automatique : parcourt tous les cas de l'année et
   * déclenche les relances selon le niveau (1=rappel, 2=SMS+WhatsApp,
   * 3=notification direction, 4=blocage administratif).
   */
  const handleRunEscalation = async () => {
    if (!academicYear?.id) return;
    setEscalating(true);
    try {
      const result = await financeService.runEscalation(academicYear.id);
      toast({
        title: '✅ Escalade terminée',
        description: `${result.processed} cas traités, ${result.triggered} relances déclenchées.`,
      });
      invalidateRecoveryData();
    } catch (e: any) {
      toast({
        title: 'Erreur escalade',
        description: e?.message || 'Erreur lors du workflow',
        variant: 'destructive',
      });
    } finally {
      setEscalating(false);
    }
  };

  // Filtrage des arriérés
  const filteredArrears = useMemo(() => {
    let result = arrears;
    if (arrearYearId !== 'ALL') {
      result = result.filter((a) => a.academicYearId === arrearYearId);
    }
    if (arrearLevelFilter !== 'ALL') {
      result = result.filter((a) => a.arrearsLevel === arrearLevelFilter);
    }
    if (arrearSchoolLevelId !== 'ALL') {
      // ⚠️ arrearSchoolLevelId vient de /api/school-levels qui retourne
      // { id: education_levels_uuid, schoolLevelId: school_levels_uuid, code: 'PRIMAIRE' }
      // a.student.schoolLevelId = UUID de school_levels
      // a.student.schoolLevel.code = 'PRIMAIRE' (depuis la relation schoolLevel)
      // On résout l'ID sélectionné pour obtenir le code
      const selectedLevel = parentSchoolLevels.find((l) => l.id === arrearSchoolLevelId);
      const targetCode = selectedLevel?.code; // ex: 'PRIMAIRE'
      const targetSchoolLevelId = selectedLevel?.schoolLevelId; // UUID school_levels
      result = result.filter((a) => {
        // 1. Match par code (le plus fiable)
        if (targetCode && a.student?.schoolLevel?.code === targetCode) return true;
        // 2. Match sur schoolLevelId (UUID school_levels)
        if (targetSchoolLevelId && a.student?.schoolLevelId === targetSchoolLevelId) return true;
        // 3. Match direct sur l'ID (au cas où)
        if (a.student?.schoolLevelId === arrearSchoolLevelId) return true;
        return false;
      });
    }
    if (arrearClassId !== 'ALL') {
      result = result.filter((a) => {
        // Chercher dans TOUTES les inscriptions de l'élève, pas juste la première
        const enrollments = a.student?.studentEnrollments || [];
        return enrollments.some((e: any) => e.classId === arrearClassId);
      });
    }
    if (arrearSearch.trim()) {
      const q = arrearSearch.toLowerCase().trim();
      result = result.filter((a) => {
        const name = `${a.student?.lastName || ''} ${a.student?.firstName || ''}`.toLowerCase();
        return name.includes(q);
      });
    }
    return result;
  }, [arrears, arrearLevelFilter, arrearSearch, arrearSchoolLevelId, arrearClassId, arrearYearId, parentSchoolLevels]);

  // KPIs calculés
  const kpis = useMemo(() => {
    const totalArrears = arrears.reduce((sum, a) => sum + (Number(a.balanceDue) || 0), 0);
    const criticalCount = arrears.filter((a) => a.arrearsLevel === 'CRITICAL').length;
    const highCount = arrears.filter((a) => a.arrearsLevel === 'HIGH').length;
    const mediumCount = arrears.filter((a) => a.arrearsLevel === 'MEDIUM').length;
    const lowCount = arrears.filter((a) => a.arrearsLevel === 'LOW').length;
    const studentsWithArrears = new Set(arrears.map((a) => a.studentId)).size;
    return { totalArrears, criticalCount, highCount, mediumCount, lowCount, studentsWithArrears };
  }, [arrears]);

  return (
    <div className="space-y-4">
      <ModuleContentArea
        layout="custom"
        toolbar={
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recouvrement & Arriérés</h2>
              <p className="text-xs text-slate-500">
                Pilotez le recouvrement des impayés et suivez les arriérés de l'année {academicYear?.name || '—'}.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setManualArrearModal(true)} className="border-amber-300 text-amber-700 hover:bg-amber-100">
                <Plus className="w-4 h-4 mr-2" />
                Saisir un arriéré
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowImportArrears(true)} className="border-violet-300 text-violet-700 hover:bg-violet-100">
                <Upload className="w-4 h-4 mr-2" />
                Importer arriérés
              </Button>
              <Button variant="outline" size="sm" onClick={() => setManualModal(true)}>
                <Send className="w-4 h-4 mr-2" />
                Relance manuelle
              </Button>
              <Button variant="outline" size="sm" onClick={handleDetectArrears} disabled={detecting}>
                {detecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {detecting ? 'Détection...' : 'Détecter arriérés'}
              </Button>
              <Button
                size="sm"
                onClick={handleRunEscalation}
                disabled={escalating}
                className="bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white"
              >
                {escalating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                {escalating ? 'Escalade...' : 'Lancer escalade auto'}
              </Button>
            </div>
          </div>
        }
      >
        {/* Onglets */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === 'arrears' && arrears.length > 0 && (
                    <Badge variant="outline" className="ml-1 text-[10px] bg-white">{arrears.length}</Badge>
                  )}
                  {tab.id === 'reminders' && reminders.length > 0 && (
                    <Badge variant="outline" className="ml-1 text-[10px] bg-white">{reminders.length}</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu de l'onglet actif */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-slate-600">Chargement...</span>
          </div>
        ) : activeTab === 'dashboard' ? (
          <DashboardTab kpis={kpis} statistics={statistics} arrears={arrears} />
        ) : activeTab === 'arrears' ? (
          <ArrearsTab
            arrears={filteredArrears}
            totalCount={arrears.length}
            levelFilter={arrearLevelFilter}
            setLevelFilter={setArrearLevelFilter}
            search={arrearSearch}
            setSearch={setArrearSearch}
            schoolLevelId={arrearSchoolLevelId}
            setSchoolLevelId={setArrearSchoolLevelId}
            classId={arrearClassId}
            setClassId={setArrearClassId}
            yearId={arrearYearId}
            setYearId={setArrearYearId}
            allYears={Array.from(new Set(arrears.map((a: any) => a.academicYearId))).map((id) => {
              const a = arrears.find((x: any) => x.academicYearId === id);
              return { id, name: a?.academicYear?.name || id };
            })}
            onSendChannel={(arrearId, channel) => handleSendChannelReminder(arrearId, channel, 'PREMIERE_RELANCE')}
            schoolInfo={schoolInfo}
            onBulkDelete={(selected) => setBulkDeleteModal({
              items: selected.map((a: any) => ({
                arrearId: a.id,
                studentName: a.student ? `${a.student.lastName} ${a.student.firstName}` : 'Élève',
                className: a.student?.schoolLevel?.name || a.student?.studentEnrollments?.[0]?.class?.name || '—',
                academicYearName: a.academicYear?.name || '—',
                balanceDue: Number(a.balanceDue) || 0,
              })),
            })}
            onDelete={(a) => setDeleteArrearModal({
              arrearId: a.id,
              studentName: a.student ? `${a.student.lastName} ${a.student.firstName}` : 'Élève',
              className: a.student?.schoolLevel?.name || a.student?.studentEnrollments?.[0]?.class?.name || '—',
              academicYearName: a.academicYear?.name || '—',
              balanceDue: Number(a.balanceDue) || 0,
              totalDue: Number(a.totalDue) || 0,
              totalPaid: Number(a.totalPaid) || 0,
              status: a.status || 'OPEN',
            })}
          />
        ) : activeTab === 'reminders' ? (
          <RemindersTab
            reminders={reminders}
            arrears={arrears}
            onSendChannel={(arrearId, channel) => handleSendChannelReminder(arrearId, channel, 'PREMIERE_RELANCE')}
            onDelete={(r) => setDeleteReminderModal({
              reminderId: r.id,
              studentName: r.studentAccount?.student
                ? `${r.studentAccount.student.lastName} ${r.studentAccount.student.firstName}`
                : 'Élève',
              reminderLevel: r.reminderLevel,
              sentVia: r.sentVia,
              sentAt: r.sentAt ? new Date(r.sentAt).toLocaleDateString('fr-FR') : '—',
              amountDue: Number(r.amountDue) || 0,
            })}
          />
        ) : activeTab === 'settings' ? (
          <SettingsTab />
        ) : null}
      </ModuleContentArea>

      {/* Modal relance manuelle (NOUVEAU système multi-canal) */}
      {manualModal && (
        <ManualReminderModal
          onClose={() => setManualModal(false)}
          onSubmit={handleSendManual}
          academicYearId={academicYear?.id ?? ''}
          accountId={manualAccountId}
          setAccountId={setManualAccountId}
          level={manualLevel}
          setLevel={setManualLevel}
          sending={sendingMulti}
        />
      )}

      {/* Modal saisie manuelle d'arriéré (onboarding nouveaux clients) */}
      {manualArrearModal && (
        <ManualArrearModal
          onClose={() => setManualArrearModal(false)}
          onSubmit={handleCreateManualArrear}
          academicYearId={academicYear?.id ?? ''}
          academicYearName={arrearYearName}
          setAcademicYearName={setArrearYearName}
          defaultYearName={academicYear?.name || ''}
          studentId={arrearStudentId}
          setStudentId={setArrearStudentId}
          amount={arrearAmount}
          setAmount={setArrearAmount}
          reason={arrearReason}
          setReason={setArrearReason}
          saving={arrearSaving}
        />
      )}

      {/* Modal suppression d'arriéré (personnalisé) */}
      {deleteArrearModal && (
        <DeleteArrearModal
          data={deleteArrearModal}
          loading={deletingArrear}
          onClose={() => setDeleteArrearModal(null)}
          onConfirm={handleConfirmDeleteArrear}
        />
      )}

      {/* ⭐ Modal suppression MULTIPLE d'arriérés (personnalisé) */}
      {bulkDeleteModal && (
        <BulkDeleteArrearModal
          items={bulkDeleteModal.items}
          loading={deletingBulkArrears}
          onClose={() => setBulkDeleteModal(null)}
          onConfirm={handleConfirmBulkDeleteArrears}
        />
      )}

      {/* Modal import d'arriérés via Excel */}
      <ImportArrearsModal
        open={showImportArrears}
        onClose={() => setShowImportArrears(false)}
        onSuccess={() => {
          // Recharger les données après import
          invalidateRecoveryData();
        }}
      />

      {/* Modal suppression de relance (personnalisé) */}
      {deleteReminderModal && (
        <DeleteReminderModal
          data={deleteReminderModal}
          loading={deletingReminder}
          onClose={() => setDeleteReminderModal(null)}
          onConfirm={handleConfirmDeleteReminder}
        />
      )}

    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet Paramétrage (relance automatique)                           */
/* ------------------------------------------------------------------ */

function SettingsTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  // Formulaire local
  const [form, setForm] = useState({
    autoRecoveryEnabled: false,
    autoRecoveryChannels: { email: true, whatsapp: true, sms: true },
    autoRecoveryFrequency: 'DAILY',
    autoRecoveryTime: '08:00',
    autoRecoveryMaxLevel: 'MISE_EN_DEMEURE',
    reminderWarningDays: 3,
    reminderUrgentDays: 7,
    reminderFinalDays: 15,
  });

  useEffect(() => {
    fetch('/api/finance/settings', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        // Parser les canaux
        let channels = { email: true, whatsapp: true, sms: true };
        try {
          channels = JSON.parse(data.autoRecoveryChannels || '{}');
        } catch {}
        setForm({
          autoRecoveryEnabled: data.autoRecoveryEnabled ?? false,
          autoRecoveryChannels: channels,
          autoRecoveryFrequency: data.autoRecoveryFrequency || 'DAILY',
          autoRecoveryTime: data.autoRecoveryTime || '08:00',
          autoRecoveryMaxLevel: data.autoRecoveryMaxLevel || 'MISE_EN_DEMEURE',
          reminderWarningDays: data.reminderWarningDays ?? 3,
          reminderUrgentDays: data.reminderUrgentDays ?? 7,
          reminderFinalDays: data.reminderFinalDays ?? 15,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/finance/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          autoRecoveryEnabled: form.autoRecoveryEnabled,
          autoRecoveryChannels: JSON.stringify(form.autoRecoveryChannels),
          autoRecoveryFrequency: form.autoRecoveryFrequency,
          autoRecoveryTime: form.autoRecoveryTime,
          autoRecoveryMaxLevel: form.autoRecoveryMaxLevel,
          reminderWarningDays: form.reminderWarningDays,
          reminderUrgentDays: form.reminderUrgentDays,
          reminderFinalDays: form.reminderFinalDays,
        }),
      });
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde');
      toast({ title: '✅ Paramètres enregistrés', description: 'La relance automatique a été configurée.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/finance/settings/run-auto-recovery', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur');
      toast({
        title: '✅ Relance exécutée',
        description: `${data.sent} relance(s) envoyée(s), ${data.skipped} ignorée(s), ${data.failed} échec(s).`,
      });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-500">Chargement…</div>;
  }

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Relance automatique
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Configurez la relance automatique multi-canal (email + WhatsApp + SMS) pour tous les élèves ayant des arriérés.
            </p>
          </div>
          {/* Switch activé/désactivé */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm font-medium text-slate-700">{form.autoRecoveryEnabled ? 'Activée' : 'Désactivée'}</span>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, autoRecoveryEnabled: !f.autoRecoveryEnabled }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.autoRecoveryEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.autoRecoveryEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
        </div>

        {/* Configuration */}
        <div className={`space-y-4 ${form.autoRecoveryEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
          {/* Canaux */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 block">Canaux de relance</Label>
            <div className="flex gap-3">
              {(['email', 'helm_connect'] as const).map((channel) => (
                <label key={channel} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.autoRecoveryChannels[channel] ?? (channel === 'helm_connect' ? true : false)}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      autoRecoveryChannels: { ...f.autoRecoveryChannels, [channel]: e.target.checked },
                    }))}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700 capitalize">
                    {channel === 'email' ? 'Email' : 'Helm Connect'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Fréquence + Heure */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Fréquence</Label>
              <Select value={form.autoRecoveryFrequency} onValueChange={(v) => setForm((f) => ({ ...f, autoRecoveryFrequency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Quotidienne</SelectItem>
                  <SelectItem value="WEEKLY">Hebdomadaire (lundi)</SelectItem>
                  <SelectItem value="MONTHLY">Mensuelle (1er du mois)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Heure d'exécution</Label>
              <Input
                type="time"
                value={form.autoRecoveryTime}
                onChange={(e) => setForm((f) => ({ ...f, autoRecoveryTime: e.target.value }))}
              />
            </div>
          </div>

          {/* Niveaux de relance (jours) */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2 block">Niveaux de relance (en jours)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[10px] text-slate-500 mb-1 block">1ère relance (J+)</Label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={form.reminderWarningDays}
                  onChange={(e) => setForm((f) => ({ ...f, reminderWarningDays: Number(e.target.value) }))}
                  className="text-center"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-500 mb-1 block">2ème relance (J+)</Label>
                <Input
                  type="number"
                  min="1"
                  max="60"
                  value={form.reminderUrgentDays}
                  onChange={(e) => setForm((f) => ({ ...f, reminderUrgentDays: Number(e.target.value) }))}
                  className="text-center"
                />
              </div>
              <div>
                <Label className="text-[10px] text-slate-500 mb-1 block">Mise en demeure (J+)</Label>
                <Input
                  type="number"
                  min="1"
                  max="90"
                  value={form.reminderFinalDays}
                  onChange={(e) => setForm((f) => ({ ...f, reminderFinalDays: Number(e.target.value) }))}
                  className="text-center"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              💡 Le système calcule l'ancienneté de l'arriéré et envoie le niveau approprié.
              Anti-harcèlement : une relance n'est pas renvoyée si une a été envoyée dans les dernières 24h.
            </p>
          </div>

          {/* Niveau maximum */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Niveau maximum à envoyer automatiquement</Label>
            <Select value={form.autoRecoveryMaxLevel} onValueChange={(v) => setForm((f) => ({ ...f, autoRecoveryMaxLevel: v }))}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PREMIERE_RELANCE">1ère relance uniquement</SelectItem>
                <SelectItem value="DEUXIEME_RELANCE">Jusqu'à la 2ème relance</SelectItem>
                <SelectItem value="MISE_EN_DEMEURE">Jusqu'à la mise en demeure (tous niveaux)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 mt-4">
          <Button
            variant="outline"
            onClick={handleRunNow}
            disabled={running}
            className="border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            Lancer maintenant
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet Dashboard                                                   */
/* ------------------------------------------------------------------ */

function DashboardTab({
  kpis,
  statistics,
  arrears,
}: {
  kpis: { totalArrears: number; criticalCount: number; highCount: number; mediumCount: number; lowCount: number; studentsWithArrears: number };
  statistics: any;
  arrears: any[];
}) {
  const stats = statistics || {};
  // ⚠️ Fix : le backend getCollectionStatistics retourne { totals: { expected, paid, balanceDue, collectionRate } }
  // et non pas { totalCollected, totalDue }. Avant, ces champs n'existaient pas → KPIs toujours à 0.
  const totalCollected = Number(stats.totals?.paid ?? 0);
  const totalDue = Number(stats.totals?.balanceDue ?? kpis.totalArrears);
  const recoveryRate = Number(stats.totals?.collectionRate ?? 0);

  return (
    <div className="space-y-5">
      {/* KPIs principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Wallet}
          iconBg="bg-rose-100"
          iconColor="text-rose-600"
          label="Total arriérés"
          value={formatCurrency(kpis.totalArrears)}
          subtext={`${kpis.studentsWithArrears} élève(s) concerné(s)`}
        />
        <KpiCard
          icon={TrendingDown}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          label="Taux de recouvrement"
          value={`${recoveryRate.toFixed(1)}%`}
          subtext={formatCurrency(totalCollected)}
        />
        <KpiCard
          icon={AlertTriangle}
          iconBg="bg-orange-100"
          iconColor="text-orange-600"
          label="Arriérés critiques"
          value={String(kpis.criticalCount)}
          subtext="Nécessitent une action immédiate"
        />
        <KpiCard
          icon={Users}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          label="Élèves avec arriérés"
          value={String(kpis.studentsWithArrears)}
          subtext={`Dont ${kpis.highCount} élevés + ${kpis.criticalCount} critiques`}
        />
      </div>

      {/* Répartition par niveau */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Répartition des arriérés par niveau de gravité</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((level) => {
            const config = ARREARS_LEVEL_CONFIG[level];
            const count = level === 'LOW' ? kpis.lowCount : level === 'MEDIUM' ? kpis.mediumCount : level === 'HIGH' ? kpis.highCount : kpis.criticalCount;
            const totalLevel = arrears.filter((a) => a.arrearsLevel === level).reduce((s, a) => s + (Number(a.balanceDue) || 0), 0);
            const pct = arrears.length > 0 ? (count / arrears.length) * 100 : 0;
            return (
              <div key={level} className={`${config.bg} ${config.border} border rounded-xl p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${config.color}`}>
                    {config.label}
                  </span>
                  <span className={`text-2xl font-bold ${config.color}`}>{count}</span>
                </div>
                <div className="text-xs text-slate-600 mb-2">
                  {formatCurrency(totalLevel)}
                </div>
                <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      level === 'LOW' ? 'bg-blue-500' :
                      level === 'MEDIUM' ? 'bg-amber-500' :
                      level === 'HIGH' ? 'bg-orange-500' : 'bg-rose-500'
                    } transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{pct.toFixed(0)}% des cas</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 10 élèves + arriérés les plus élevés */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          Top 10 des arriérés les plus élevés
        </h3>
        {arrears.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-8 text-center">
            Aucun arriéré détecté. Lancez la détection pour identifier les impayés.
          </p>
        ) : (
          <div className="space-y-2">
            {[...arrears]
              .sort((a, b) => (Number(b.balanceDue) || 0) - (Number(a.balanceDue) || 0))
              .slice(0, 10)
              .map((a, idx) => {
                const config = ARREARS_LEVEL_CONFIG[a.arrearsLevel || 'LOW'] || ARREARS_LEVEL_CONFIG.LOW;
                return (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${config.bg} ${config.border}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {a.student ? `${a.student.lastName} ${a.student.firstName}` : '—'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {a.studentFee?.feeDefinition?.label || 'Frais'} · Dernier paiement :{' '}
                          {a.lastPaymentDate ? new Date(a.lastPaymentDate).toLocaleDateString('fr-FR') : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-base font-bold ${config.color}`}>
                        {formatCurrency(a.balanceDue)}
                      </p>
                      <Badge variant="outline" className={`text-[10px] ${config.color} ${config.bg} ${config.border} border`}>
                        {config.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet Arriérés                                                    */
/* ------------------------------------------------------------------ */

function ArrearsTab({
  arrears,
  totalCount,
  levelFilter,
  setLevelFilter,
  search,
  setSearch,
  schoolLevelId,
  setSchoolLevelId,
  classId,
  setClassId,
  yearId,
  setYearId,
  allYears,
  onSendChannel,
  schoolInfo,
  onBulkDelete,
  onDelete,
}: {
  arrears: any[];
  totalCount: number;
  levelFilter: string;
  setLevelFilter: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  schoolLevelId: string;
  setSchoolLevelId: (v: string) => void;
  classId: string;
  setClassId: (v: string) => void;
  yearId: string;
  setYearId: (v: string) => void;
  allYears: { id: string; name: string }[];
  onSendChannel: (arrearId: string, channel: 'email' | 'whatsapp' | 'sms' | 'helm_connect') => void;
  schoolInfo: any;
  onBulkDelete: (selectedArrears: any[]) => void;
  onDelete: (arrear: any) => void;
}) {
  const { toast } = useToast();
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  // ⭐ Encaissement d'un arriéré (marquer un élève ayant payé) — modal dédié.
  //    Le POST /finance/collection/arrears/:id/payment enregistre la
  //    FinanceTransaction PAYMENT ; le compte de l'élève est recalculé
  //    automatiquement (trigger DB) et la liste des arriérés se recharge
  //    via l'événement 'recovery-reload' (invalidateRecoveryData).
  const [paymentArrear, setPaymentArrear] = useState<any | null>(null);

  // ⭐ Modification d'un arriéré (correction d'erreur de saisie) — modal dédié.
  //    Le PATCH /finance/collection/arrears/:id met à jour totalDue/totalPaid,
  //    recalcule balanceDue/statut/niveau et resynchronise les miroirs du
  //    compte élève (recalcul dynamique) ; la liste se recharge via
  //    l'événement 'recovery-reload' (invalidateRecoveryData).
  const [editArrear, setEditArrear] = useState<any | null>(null);

  // ⭐ Suppression multiple — sélection des lignes du tableau
  // (cases à cocher + « tout sélectionner » sur la liste filtrée affichée)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Élaguer automatiquement la sélection quand la liste change
  // (lignes supprimées / données rafraîchies) — évite un compte affiché obsolète.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(arrears.map((a: any) => a.id));
      const next = new Set(Array.from(prev).filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [arrears]);

  const selectedArrears = useMemo(
    () => arrears.filter((a: any) => selectedIds.has(a.id)),
    [arrears, selectedIds],
  );
  const selectedTotal = useMemo(
    () => selectedArrears.reduce((s: number, a: any) => s + (Number(a.balanceDue) || 0), 0),
    [selectedArrears],
  );

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // Charger les niveaux scolaires
  useEffect(() => {
    fetch('/api/school-levels', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setSchoolLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setSchoolLevels([]));
  }, []);

  // Charger les classes
  // ⭐ FIX 2026-09-09 : classes de l'année du CONTEXTE (sélecteur global) +
  //    rechargement au switch. Le filtre yearId peut être 'ALL' (vue
  //    multi-années) ; le sélecteur de classe propose les classes de l'année
  //    sélectionnée dans le header, avec repli sur le filtre local.
  const { academicYear: arrearsTabYear } = useModuleContext();
  useEffect(() => {
    const ctxYearId = arrearsTabYear?.id || (yearId && yearId !== 'ALL' ? yearId : '');
    fetch(`/api/all-classes${ctxYearId ? `?academicYearId=${encodeURIComponent(ctxYearId)}` : ''}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setClasses(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => setClasses([]));
  }, [arrearsTabYear?.id, yearId]);

  // Classes filtrées par niveau scolaire
  const filteredClasses = useMemo(() => {
    if (schoolLevelId === 'ALL') return classes;
    const selectedLevel = schoolLevels.find((l) => l.id === schoolLevelId);
    const slId = selectedLevel?.schoolLevelId || schoolLevelId;
    return classes.filter((c: any) =>
      c.schoolLevelId === slId ||
      c.schoolLevel?.code === selectedLevel?.code ||
      c.schoolLevel?.id === slId
    );
  }, [classes, schoolLevelId, schoolLevels]);

  // ⭐ Sous-onglets de l'onglet Arriérés :
  //    - 'list'  : liste détaillée des arriérés (pagination 50 lignes/page)
  //    - 'recap' : récapitulatif hiérarchique par niveau scolaire → classe
  const [arrearsView, setArrearsView] = useState<'list' | 'recap'>('list');

  // ⭐ Pagination 50 lignes/page — appliquée APRÈS les filtres (année/niveau/
  //    classe/gravité/recherche) : les filtres restent donc actifs et cohérents
  //    sur TOUTES les pages. Les TOTAUX du pied de tableau restent calculés sur
  //    la liste filtrée complète (pas seulement la page visible).
  const [arrearsPage, setArrearsPage] = useState(1);
  const arrearsTotalPages = Math.max(1, Math.ceil(arrears.length / ARREARS_PAGE_SIZE));

  // Recalage : si la liste raccourcit (suppression/encaissement) et que la page
  // courante n'existe plus → clamp à la dernière page.
  useEffect(() => {
    if (arrearsPage > arrearsTotalPages) setArrearsPage(arrearsTotalPages);
  }, [arrearsPage, arrearsTotalPages]);

  // Retour à la page 1 dès qu'un filtre change (les filtres modifient le volume)
  useEffect(() => {
    setArrearsPage(1);
  }, [yearId, schoolLevelId, classId, levelFilter, search]);

  const pagedArrears = useMemo(
    () => arrears.slice(
      (arrearsPage - 1) * ARREARS_PAGE_SIZE,
      arrearsPage * ARREARS_PAGE_SIZE,
    ),
    [arrears, arrearsPage],
  );

  // ⭐ Sélection « tout cocher » : porte sur la PAGE courante (50 lignes max) —
  //    les lignes cochées sur les autres pages restent sélectionnées
  //    (suppression en masse sécurisée : on n'efface que ce qu'on voit).
  const pageSelectedCount = pagedArrears.filter((a: any) => selectedIds.has(a.id)).length;
  const allVisibleSelected = pagedArrears.length > 0 && pageSelectedCount === pagedArrears.length;
  const someVisibleSelected = pageSelectedCount > 0 && !allVisibleSelected;
  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        pagedArrears.forEach((a: any) => next.delete(a.id));
      } else {
        pagedArrears.forEach((a: any) => next.add(a.id));
      }
      return next;
    });
  };
  const pageStart = arrears.length === 0 ? 0 : (arrearsPage - 1) * ARREARS_PAGE_SIZE + 1;
  const pageEnd = Math.min(arrearsPage * ARREARS_PAGE_SIZE, arrears.length);

  // Fenêtre de pages : 1 … 4 5 6 7 8 … 12 (ellipse pour les pages éloignées)
  const pageWindow = useMemo(() => {
    const span = 2;
    const items: (number | 'ellipsis')[] = [];
    for (let p = 1; p <= arrearsTotalPages; p++) {
      if (p === 1 || p === arrearsTotalPages || Math.abs(p - arrearsPage) <= span) items.push(p);
      else if (items[items.length - 1] !== 'ellipsis') items.push('ellipsis');
    }
    return items;
  }, [arrearsPage, arrearsTotalPages]);

  // Totaux de la liste filtrée COMPLETE (A + B = C vérifiable ligne par ligne :
  // totalDue = totalPaid + balanceDue)
  const listTotals = useMemo(() => {
    const totalDue = arrears.reduce((s: number, a: any) => s + (Number(a.totalDue) || 0), 0);
    const totalPaid = arrears.reduce((s: number, a: any) => s + (Number(a.totalPaid) || 0), 0);
    const balanceDue = arrears.reduce((s: number, a: any) => s + (Number(a.balanceDue) || 0), 0);
    return { totalDue, totalPaid, balanceDue };
  }, [arrears]);

  // Export PDF des arriérés (filtre appliqué) — génère le PDF côté frontend avec jsPDF
  // Export PDF — utilise finance-exports.ts (même pattern que encaissements)
  const handleExportPDF = async () => {
    try {
      const { blob, url } = await exportArrearsToPdf(arrears, schoolInfo);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Arrieres_recouvrement_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Export PDF error:', e);
    }
  };

  // Export Excel — utilise excel-exports.ts (même pattern que encaissements)
  const handleExportExcel = async () => {
    try {
      await exportArrearsToExcel(arrears, schoolInfo);
    } catch (e: any) {
      console.error('Export Excel error:', e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Année scolaire */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Année scolaire</Label>
            <Select value={yearId} onValueChange={setYearId}>
              <SelectTrigger className="w-full sm:w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les années</SelectItem>
                {allYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Niveau scolaire */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Niveau scolaire</Label>
            <Select value={schoolLevelId} onValueChange={(v) => { setSchoolLevelId(v); setClassId('ALL'); }}>
              <SelectTrigger className="w-full sm:w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les niveaux</SelectItem>
                {schoolLevels.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.label || l.code || l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Classe (filtrée par niveau) */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Classe</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="w-full sm:w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les classes</SelectItem>
                {filteredClasses.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Niveau de gravité */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Niveau de gravité</Label>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous</SelectItem>
                <SelectItem value="LOW">Faible</SelectItem>
                <SelectItem value="MEDIUM">Moyen</SelectItem>
                <SelectItem value="HIGH">Élevé</SelectItem>
                <SelectItem value="CRITICAL">Critique</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recherche */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Rechercher</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom ou prénom..."
                className="pl-9 h-9"
              />
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {arrears.length} affiché(s) sur {totalCount} total
        </div>
      </div>

      {/* ⭐ Sous-onglets de l'onglet Arriérés : liste détaillée / récapitulatif */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setArrearsView('list')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            arrearsView === 'list'
              ? 'border-rose-600 text-rose-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Liste des arriérés
        </button>
        <button
          onClick={() => setArrearsView('recap')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            arrearsView === 'recap'
              ? 'border-rose-600 text-rose-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Récapitulatif des arriérés
        </button>
      </div>

      {arrearsView === 'recap' ? (
        <ArrearsRecapView
          arrears={arrears}
          classes={classes}
          schoolLevels={schoolLevels}
          yearName={yearId !== 'ALL' ? (allYears.find((y) => y.id === yearId)?.name || '') : ''}
        />
      ) : (
        <>
      {/* Boutons export — juste au-dessus du tableau */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExportExcel} className="border-emerald-300 text-emerald-700 hover:bg-emerald-100">
          <FileSpreadsheet className="w-4 h-4 mr-1.5" />
          Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF} className="border-rose-300 text-rose-700 hover:bg-rose-100">
          <FileText className="w-4 h-4 mr-1.5" />
          PDF
        </Button>
      </div>

      {/* ⭐ Barre d'action de suppression multiple (visible quand ≥1 ligne cochée) */}
      {selectedArrears.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <CheckCircle2 className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span className="font-semibold text-rose-700">
              {selectedArrears.length} arriéré{selectedArrears.length > 1 ? 's' : ''} sélectionné{selectedArrears.length > 1 ? 's' : ''}
            </span>
            <span className="text-rose-600 font-mono font-medium">· {formatCurrency(selectedTotal)}</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-slate-500 underline hover:text-slate-700 ml-1"
            >
              Tout désélectionner
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkDelete(selectedArrears)}
            className="border-rose-300 text-rose-700 hover:bg-rose-100 font-semibold"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Supprimer la sélection ({selectedArrears.length})
          </Button>
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={toggleAll}
                  disabled={pagedArrears.length === 0}
                  className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer disabled:opacity-40"
                  title="Tout sélectionner / tout désélectionner (page courante)"
                  aria-label="Tout sélectionner (page courante)"
                />
              </TableHead>
              <TableHead className="whitespace-nowrap">Élève</TableHead>
              <TableHead className="whitespace-nowrap">Classe</TableHead>
              <TableHead className="whitespace-nowrap">Frais</TableHead>
              <TableHead className="text-right whitespace-nowrap">Total dû</TableHead>
              <TableHead className="text-right whitespace-nowrap">Payé</TableHead>
              <TableHead className="text-right whitespace-nowrap">Solde</TableHead>
              <TableHead className="whitespace-nowrap">Niveau</TableHead>
              <TableHead className="whitespace-nowrap">Dernier paiement</TableHead>
              <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {arrears.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-gray-500 py-12">
                  Aucun arriéré trouvé. Lancez la détection pour identifier les impayés.
                </TableCell>
              </TableRow>
            ) : (
              pagedArrears.map((a) => {
                const config = ARREARS_LEVEL_CONFIG[a.arrearsLevel || 'LOW'] || ARREARS_LEVEL_CONFIG.LOW;
                return (
                  <TableRow key={a.id} className={selectedIds.has(a.id) ? 'bg-rose-50/60 hover:bg-rose-50' : 'hover:bg-slate-50'}>
                    <TableCell className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(a.id)}
                        onChange={(e) => toggleOne(a.id, e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                        aria-label={`Sélectionner l'arriéré de ${a.student ? a.student.lastName + ' ' + a.student.firstName : 'cet élève'}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.studentId}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                      {a.student?.studentEnrollments?.[0]?.class?.name || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                      {a.studentFee?.feeDefinition?.label || a.notes || '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm whitespace-nowrap">{formatCurrency(a.totalDue)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-emerald-700 whitespace-nowrap">{formatCurrency(a.totalPaid)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold text-rose-700 whitespace-nowrap">{formatCurrency(a.balanceDue)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${config.color} ${config.bg} ${config.border} border`}>
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {a.lastPaymentDate ? new Date(a.lastPaymentDate).toLocaleDateString('fr-FR') : 'Jamais'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {/* Email */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                          onClick={() => onSendChannel(a.id, 'email')}
                          title="Envoyer relance par email"
                        >
                          <GmailIcon className="w-3.5 h-3.5" />
                        </Button>
                        {/* ⭐ WhatsApp — GRAYED OUT (replaced by Helm Connect) */}
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled
                          className="h-7 w-7 opacity-30 cursor-not-allowed"
                          title="WhatsApp désactivé — utilisez Helm Connect"
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5 grayscale" />
                        </Button>
                        {/* ⭐ Helm Connect — REPLACES SMS */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-blue-100 hover:shadow-sm transition-all duration-150"
                          onClick={() => onSendChannel(a.id, 'helm_connect')}
                          title="Envoyer relance par Helm Connect"
                        >
                          <HelmConnectIcon className="w-3.5 h-3.5" />
                        </Button>
                        {/* ⭐ Modifier — correction d'erreur de saisie sur le
                            montant dû / payé. Le recalcul (restant dû, statut,
                            niveau, miroirs du compte élève) est dynamique. */}
                        {(!a.status || a.status === 'OPEN' || a.status === 'PARTIALLY_PAID') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                            onClick={() => setEditArrear(a)}
                            title="Modifier l'arriéré (correction d'erreur — recalcul automatique du compte)"
                          >
                            <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                          </Button>
                        )}
                        {/* ⭐ Encaisser — marquer l'élève ayant payé son arriéré.
                            Ouvre le modal d'encaissement ciblé : la
                            FinanceTransaction recalcule automatiquement le
                            compte de l'élève (trigger DB) et l'arriéré. */}
                        {(!a.status || a.status === 'OPEN' || a.status === 'PARTIALLY_PAID') && Number(a.balanceDue) > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-emerald-100 hover:shadow-sm transition-all duration-150"
                            onClick={() => setPaymentArrear(a)}
                            title="Encaisser / marquer payé (recalcul automatique du compte)"
                          >
                            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                          </Button>
                        )}
                        {/* Abandonner (write-off) — uniquement si OPEN ou PARTIALLY_PAID */}
                        {(!a.status || a.status === 'OPEN' || a.status === 'PARTIALLY_PAID') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-amber-100 hover:shadow-sm transition-all duration-150"
                            onClick={() => {
                              const reason = window.prompt(
                                `Abandonner cet arriéré de ${formatCurrency(Number(a.balanceDue))} ?\n` +
                                `L'élève ne devra plus ce montant.\n\nMotif de l'abandon :`
                              );
                              if (reason) {
                                financeService.writeOffArrear(a.id, reason)
                                  .then(() => {
                                    toast({ title: '✅ Créance abandonnée', description: `${formatCurrency(Number(a.balanceDue))} retiré du total dû.` });
                                    // Recharger — on utilise un hack: déclencher un state change
                                    window.dispatchEvent(new CustomEvent('recovery-reload'));
                                  })
                                  .catch((e: any) => {
                                    toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
                                  });
                              }
                            }}
                            title="Abandonner la créance (write-off)"
                          >
                            <XCircle className="w-3.5 h-3.5 text-amber-600" />
                          </Button>
                        )}
                        {/* Supprimer */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-rose-100 hover:shadow-sm transition-all duration-150"
                          onClick={() => onDelete(a)}
                          title="Supprimer l'arriéré"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
          {/* Ligne des totaux — calculée sur la liste filtrée COMPLÈTE
              (toutes pages confondues) : A + B = C vérifiable
              (Total dû = Payé + Solde restant). */}
          {arrears.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                <td colSpan={4} className="px-3 py-2 text-right text-slate-700 text-sm whitespace-nowrap">
                  TOTAUX ({arrears.length} arriéré{arrears.length > 1 ? 's' : ''})
                </td>
                <td className="px-3 py-2 text-right font-mono text-sm whitespace-nowrap">
                  {formatCurrency(listTotals.totalDue)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-sm text-emerald-700 whitespace-nowrap">
                  {formatCurrency(listTotals.totalPaid)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-sm font-bold text-rose-700 whitespace-nowrap">
                  {formatCurrency(listTotals.balanceDue)}
                </td>
                <td colSpan={3} className="px-3 py-2"></td>
              </tr>
            </tfoot>
          )}
        </Table>
      </div>

      {/* ⭐ Pagination — 50 lignes par page ; les filtres (année/niveau/
          classe/gravité/recherche) restent appliqués sur toutes les pages
          car la pagination découpe la liste FILTRÉE. */}
      {arrearsTotalPages > 1 && (
        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Affichage <strong className="text-slate-700">{pageStart}–{pageEnd}</strong> sur{' '}
            <strong className="text-slate-700">{arrears.length}</strong> arriéré(s) — page{' '}
            <strong className="text-slate-700">{arrearsPage}</strong>/{arrearsTotalPages}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setArrearsPage(1)}
              disabled={arrearsPage <= 1}
              className="inline-flex items-center px-2 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Première page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setArrearsPage((p) => Math.max(1, p - 1))}
              disabled={arrearsPage <= 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Précédent
            </button>
            <div className="flex items-center gap-0.5">
              {pageWindow.map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`e-${i}`} className="px-2 text-slate-400 text-xs">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setArrearsPage(p)}
                    className={`min-w-[28px] h-7 px-2 text-xs font-bold rounded-lg transition ${
                      p === arrearsPage
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-600 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 border border-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
            </div>
            <button
              onClick={() => setArrearsPage((p) => Math.min(arrearsTotalPages, p + 1))}
              disabled={arrearsPage >= arrearsTotalPages}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Suivant
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setArrearsPage(arrearsTotalPages)}
              disabled={arrearsPage >= arrearsTotalPages}
              className="inline-flex items-center px-2 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Dernière page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {/* ⭐ Modal d'encaissement d'un arriéré (marquer un élève ayant payé) */}
      {paymentArrear && (
        <ArrearPaymentModal
          arrear={paymentArrear}
          onClose={() => setPaymentArrear(null)}
          onSubmitted={(remaining: number) => {
            // Recalcul dynamique : la mutation invalide les queries recovery
            // (arrears + statistics + cases) → la liste et les KPIs se
            // rechargent automatiquement avec les nouveaux soldes.
            window.dispatchEvent(new CustomEvent('recovery-reload'));
            if (remaining <= 0) {
              toast({
                title: '✅ Arriéré entièrement soldé',
                description: 'L\'arriéré passe au statut PAID — le compte de l\'élève a été recalculé automatiquement.',
              });
            } else {
              toast({
                title: '✅ Paiement enregistré',
                description: `Restant dû sur cet arriéré : ${formatCurrency(remaining)} — le compte de l'élève a été recalculé automatiquement.`,
              });
            }
            setPaymentArrear(null);
          }}
        />
      )}

      {/* ⭐ Modal de modification d'un arriéré (correction d'erreur de saisie) */}
      {editArrear && (
        <EditArrearModal
          arrear={editArrear}
          onClose={() => setEditArrear(null)}
          onSubmitted={(updated: any) => {
            // Recalcul dynamique : invalidation des queries recovery +
            // rafraîchissement croisé des comptes élèves (le backend a déjà
            // resynchronisé les miroirs d'arriérés du compte de l'élève).
            window.dispatchEvent(new CustomEvent('recovery-reload'));
            window.dispatchEvent(new CustomEvent('finance-accounts-changed'));
            invalidateRecoveryData();
            const newBalance = Number(updated?.balanceDue ?? 0);
            toast({
              title: '✅ Arriéré modifié',
              description: newBalance <= 0
                ? 'Arriéré corrigé et entièrement soldé — le compte de l\'élève a été recalculé automatiquement.'
                : `Nouveau restant dû : ${formatCurrency(newBalance)} — le compte de l'élève a été recalculé automatiquement.`,
            });
            setEditArrear(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sous-onglet « Récapitulatif des arriérés »                         */
/*  Vue hiérarchique : niveau scolaire (Maternelle / Primaire /        */
/*  Secondaire) → classes physiques → total général.                   */
/*  - Les niveaux et classes sont issus des DONNÉES (aucun nom de      */
/*    classe codé en dur) : classes chargées de la base via            */
/*    /api/all-classes + inscription de l'élève portée par l'arriéré.   */
/*  - Chaque ligne de niveau affiche le total des arriérés restants   */
/*    du niveau ; le niveau se déplie pour révéler ses classes avec    */
/*    le total et l'effectif d'élèves concernés par classe.            */
/*  - Dernière ligne : total général des arriérés restants (filtre      */
/*    année appliqué — par défaut l'année courante).                    */
/* ------------------------------------------------------------------ */

const ARREARS_LEVEL_ORDER: Array<{ key: string; label: string; color: string; bg: string; border: string }> = [
  { key: 'MATERNELLE', label: 'Maternelle', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  { key: 'PRIMAIRE', label: 'Primaire', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  { key: 'SECONDAIRE', label: 'Secondaire', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  { key: 'AUTRE', label: 'Non classé', color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
];

// Normalise le code de niveau (FR majuscule / EN → FR)
function normalizeLevelCode(rawCode: string | undefined | null): string {
  const c = (rawCode || '').toUpperCase().trim();
  if (c === 'MATERNELLE' || c === 'NURSERY' || c === 'MATERNEL') return 'MATERNELLE';
  if (c === 'PRIMAIRE' || c === 'PRIMARY') return 'PRIMAIRE';
  if (c === 'SECONDAIRE' || c === 'SECONDARY') return 'SECONDAIRE';
  return c || 'AUTRE';
}

function ArrearsRecapView({
  arrears,
  classes,
  schoolLevels,
  yearName,
}: {
  arrears: any[];
  classes: any[];
  schoolLevels: any[];
  yearName: string;
}) {
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());

  // Résolution niveau ← classes physiques (base) avec repli sur le niveau
  // de l'élève porté par l'arriéré.
  const classLevelByClassId = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of classes) {
      const code = normalizeLevelCode(c.schoolLevel?.code) !== 'AUTRE'
        ? normalizeLevelCode(c.schoolLevel?.code)
        : normalizeLevelCode(schoolLevels.find((l: any) => l.schoolLevelId === c.schoolLevelId)?.code);
      m.set(c.id, code);
    }
    return m;
  }, [classes, schoolLevels]);

  // ⭐ Regroupement niveau → classe → total. Les classes affichées sous
  //    chaque niveau proviennent des données (aucune classe codée en dur) :
  //    la classe de l'élève est portée par son inscription (relation
  //    studentEnrollments → class), niveau résolu depuis la classe.
  const levelsData = useMemo(() => {
    const byLevel = new Map<string, {
      total: number;
      students: Set<string>;
      classes: Map<string, { total: number; students: Set<string> }>;
    }>();
    for (const a of arrears) {
      const balance = Number(a.balanceDue) || 0;
      if (balance <= 0) continue;
      const enrollment = a.student?.studentEnrollments?.[0];
      const classId = enrollment?.classId || '';
      const className = enrollment?.class?.name || '—';
      const level = classLevelByClassId.get(classId)
        || normalizeLevelCode(a.student?.schoolLevel?.code);
      if (!byLevel.has(level)) {
        byLevel.set(level, { total: 0, students: new Set(), classes: new Map() });
      }
      const lvl = byLevel.get(level)!;
      lvl.total += balance;
      if (a.student?.id) lvl.students.add(a.student.id);
      if (!lvl.classes.has(className)) {
        lvl.classes.set(className, { total: 0, students: new Set() });
      }
      const cls = lvl.classes.get(className)!;
      cls.total += balance;
      if (a.student?.id) cls.students.add(a.student.id);
    }
    // Trier les classes par total décroissant puis nom
    for (const lvl of byLevel.values()) {
      lvl.classes = new Map(
        Array.from(lvl.classes.entries())
          .sort((x, y) => y[1].total - x[1].total || x[0].localeCompare(y[0])),
      );
    }
    return byLevel;
  }, [arrears, classLevelByClassId]);

  const grandTotal = useMemo(
    () => arrears.reduce((s: number, a: any) => s + (Number(a.balanceDue) || 0), 0),
    [arrears],
  );
  const grandStudents = useMemo(
    () => new Set(arrears.filter((a: any) => (Number(a.balanceDue) || 0) > 0).map((a: any) => a.student?.id).filter(Boolean)).size,
    [arrears],
  );

  const toggleLevel = (key: string) => {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (arrears.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-600 bg-white rounded-xl border border-slate-200">
        Aucun arriéré restant — rien à récapituler. Les élèves à jour ne figurent pas ici.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-rose-600 to-rose-700 px-4 py-3 text-white flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-bold text-sm">Récapitulatif des arriérés par niveau scolaire</h3>
        </div>
        <div className="text-xs text-rose-100">
          {yearName ? `Année ${yearName}` : 'Toutes années'} · {grandStudents} élève(s) concerné(s)
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="whitespace-nowrap">Niveau / Classe</TableHead>
              <TableHead className="text-right whitespace-nowrap">Élèves concernés</TableHead>
              <TableHead className="text-right whitespace-nowrap">Arriérés restants</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ARREARS_LEVEL_ORDER.map((levelDef) => {
              const lvl = levelsData.get(levelDef.key);
              if (!lvl || lvl.total <= 0) return null;
              const isExpanded = expandedLevels.has(levelDef.key);
              const classRows = Array.from(lvl.classes.entries());
              return (
                <Fragment key={levelDef.key}>
                  {/* Ligne de niveau — total du niveau, dépliable */}
                  <TableRow
                    className={`${levelDef.bg} border ${levelDef.border} cursor-pointer select-none`}
                    onClick={() => toggleLevel(levelDef.key)}
                  >
                    <TableCell className="font-bold whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          className={`w-4 h-4 ${levelDef.color} transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                        />
                        <span className={levelDef.color}>{levelDef.label}</span>
                        <span className="text-xs text-slate-500 font-normal">
                          ({classRows.length} classe{classRows.length > 1 ? 's' : ''})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">{lvl.students.size}</TableCell>
                    <TableCell className="text-right font-mono font-bold whitespace-nowrap">
                      {formatCurrency(lvl.total)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>

                  {/* Classes physiques du niveau (données de la base) */}
                  {isExpanded && classRows.map(([className, cls]) => (
                    <TableRow key={`${levelDef.key}-${className}`} className="hover:bg-slate-50">
                      <TableCell className="pl-10 text-sm text-slate-700 whitespace-nowrap">
                        <Users className="w-3.5 h-3.5 inline mr-2 text-slate-400" />
                        {className}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-600 whitespace-nowrap">
                        {cls.students.size}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-rose-700 whitespace-nowrap">
                        {formatCurrency(cls.total)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              );
            })}

            {/* Total général des arriérés restants (filtre année appliqué) */}
            <TableRow className="bg-slate-100 border-t-2 border-slate-400 font-bold">
              <TableCell className="whitespace-nowrap uppercase tracking-wide text-slate-800 text-sm">
                Total général des arriérés restants
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {yearName ? `(${yearName})` : '(toutes années)'}
                </span>
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">{grandStudents}</TableCell>
              <TableCell className="text-right font-mono text-sm text-rose-700 whitespace-nowrap">
                {formatCurrency(grandTotal)}
              </TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglet Relances (système OLD)                                      */
/* ------------------------------------------------------------------ */

function RemindersTab({
  reminders,
  arrears,
  onSendChannel,
  onDelete,
}: {
  reminders: any[];
  arrears: any[];
  onSendChannel: (arrearId: string, channel: 'email' | 'whatsapp' | 'sms' | 'helm_connect') => void;
  onDelete: (reminder: any) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>Élève</TableHead>
            <TableHead className="text-right">Solde dû</TableHead>
            <TableHead>Niveau</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Origine</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reminders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-gray-500 py-12">
                Aucune relance envoyée pour cette année.
              </TableCell>
            </TableRow>
          ) : (
            reminders.map((r) => {
              const config = REMINDER_LEVEL_CONFIG[r.reminderLevel] || { label: r.reminderLevel, variant: 'secondary' };
              // Trouver l'arriéré correspondant pour les boutons d'action
              const matchingArrear = arrears.find((a) => a.studentAccountId === r.studentAccountId);
              return (
                <TableRow key={r.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">
                    {r.studentAccount?.student
                      ? `${r.studentAccount.student.lastName} ${r.studentAccount.student.firstName}`
                      : r.studentAccountId}
                  </TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(r.amountDue)}</TableCell>
                  <TableCell>
                    <Badge variant={config.variant as any}>{config.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.sentVia}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {r.sentAt ? new Date(r.sentAt).toLocaleDateString('fr-FR') : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.createdBySystem ? 'secondary' : 'default'}>
                      {r.createdBySystem ? 'Auto' : 'Manuel'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {matchingArrear ? (
                        <>
                          {/* Email */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                            onClick={() => onSendChannel(matchingArrear.id, 'email')}
                            title="Renvoyer par email"
                          >
                            <GmailIcon className="w-3.5 h-3.5" />
                          </Button>
                          {/* ⭐ WhatsApp — GRAYED OUT (replaced by Helm Connect) */}
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled
                            className="h-7 w-7 opacity-30 cursor-not-allowed"
                            title="WhatsApp désactivé — utilisez Helm Connect"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5 grayscale" />
                          </Button>
                          {/* ⭐ Helm Connect — REPLACES SMS */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-blue-100 hover:shadow-sm transition-all duration-150"
                            onClick={() => onSendChannel(matchingArrear.id, 'helm_connect')}
                            title="Renvoyer par Helm Connect"
                          >
                            <HelmConnectIcon className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic mr-2">Aucun arriéré actif</span>
                      )}
                      {/* Supprimer */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-rose-100 hover:shadow-sm transition-all duration-150"
                        onClick={() => onDelete(r)}
                        title="Supprimer la relance"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Carte KPI                                                          */
/* ------------------------------------------------------------------ */

function KpiCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  subtext,
}: {
  icon: any;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{subtext}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal relance manuelle                                             */
/* ------------------------------------------------------------------ */

function ManualReminderModal({
  onClose,
  onSubmit,
  academicYearId,
  accountId,
  setAccountId,
  level,
  setLevel,
  sending,
}: {
  onClose: () => void;
  onSubmit: () => void;
  academicYearId: string;
  accountId: string;
  setAccountId: (v: string) => void;
  level: 'PREMIERE_RELANCE' | 'DEUXIEME_RELANCE' | 'MISE_EN_DEMEURE';
  setLevel: (v: 'PREMIERE_RELANCE' | 'DEUXIEME_RELANCE' | 'MISE_EN_DEMEURE') => void;
  sending: boolean;
}) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Charger les niveaux scolaires
  useEffect(() => {
    fetch('/api/school-levels', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setSchoolLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL' && l.isActive !== false) : []))
      .catch(() => setSchoolLevels([]));
  }, []);

  // Charger les classes
  // ⭐ FIX 2026-09-09 : classes de l'année du CONTEXTE (prop academicYearId,
  //    transmise par le parent depuis useModuleContext) + rechargement au switch.
  useEffect(() => {
    fetch(`/api/all-classes${academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : ''}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setClasses(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => setClasses([]));
  }, [academicYearId]);

  // Charger les comptes élèves avec solde dû
  useEffect(() => {
    if (!academicYearId) return;
    financeService
      .getStudentAccounts({ academicYearId })
      .then((d) => setAccounts(Array.isArray(d) ? d.filter((a) => Number(a.balance) > 0) : []))
      .catch(() => setAccounts([]));
  }, [academicYearId]);

  // Classes filtrées par niveau scolaire
  const filteredClasses = useMemo(() => {
    if (!selectedLevelId) return classes;
    const selectedLevel = schoolLevels.find((l) => l.id === selectedLevelId);
    const schoolLevelId = selectedLevel?.schoolLevelId || selectedLevelId;
    return classes.filter((c) =>
      c.schoolLevelId === schoolLevelId ||
      c.schoolLevel?.code === selectedLevel?.code ||
      c.schoolLevel?.id === schoolLevelId
    );
  }, [classes, selectedLevelId, schoolLevels]);

  // Comptes filtrés par classe (via studentEnrollments)
  const filteredAccounts = useMemo(() => {
    if (!selectedClassId) return accounts;
    return accounts.filter((a) =>
      a.student?.studentEnrollments?.some((e: any) => e.classId === selectedClassId) ||
      a.studentEnrollments?.some((e: any) => e.classId === selectedClassId)
    );
  }, [accounts, selectedClassId]);

  // Reset accountId quand on change de classe
  useEffect(() => {
    setAccountId('');
  }, [selectedClassId, setAccountId]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden max-h-[calc(100dvh-2rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-2xl shrink-0">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-600" />
            Relance manuelle
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Sélectionnez un élève par niveau scolaire et classe, puis choisissez le niveau de relance.
            La relance sera envoyée automatiquement par <strong>email + WhatsApp + SMS</strong> au parent.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto overscroll-contain">
          {/* Colonne gauche : Sélection élève */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">1</span>
              Sélection de l'élève
            </h4>
            {/* Niveau scolaire */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
                Niveau scolaire
              </Label>
              <Select value={selectedLevelId} onValueChange={setSelectedLevelId}>
                <SelectTrigger><SelectValue placeholder="Tous les niveaux" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous les niveaux</SelectItem>
                  {schoolLevels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label || l.code || l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Classe (filtrée par niveau) */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
                Classe {selectedLevelId && <span className="text-slate-400 normal-case font-normal">(filtrée par niveau)</span>}
              </Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Toutes les classes</SelectItem>
                  {filteredClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.code ? `(${c.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLevelId && filteredClasses.length === 0 && (
                <p className="text-xs text-slate-500 mt-1">Aucune classe pour ce niveau.</p>
              )}
            </div>

            {/* Élève (filtré par classe) */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
                Élève {selectedClassId && <span className="text-slate-400 normal-case font-normal">(filtré par classe)</span>}
              </Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un élève avec solde dû" /></SelectTrigger>
                <SelectContent>
                  {filteredAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.id} — {formatCurrency(a.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filteredAccounts.length === 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Aucun élève avec solde dû{selectedClassId ? ' dans cette classe' : ''}.
                </p>
              )}
            </div>

            {/* Info envoi multi-canal */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>📧 ⚙️ 📱 Envoi automatique multi-canal :</strong> La relance sera envoyée au parent sur les 3 canaux
                (email + WhatsApp + SMS) en arrière-plan. Vous recevrez un rapport détaillé.
              </p>
            </div>
          </div>

          {/* Colonne droite : Niveau de relance */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold">2</span>
              Niveau de relance
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {MANUAL_LEVEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLevel(opt.value as any)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    level === opt.value
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{opt.emoji}</span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900">{opt.label}</div>
                      <div className="text-xs text-slate-500">{opt.description}</div>
                    </div>
                    {level === opt.value && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pied : actions — toujours visible (fixe) */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={sending}>Annuler</Button>
          <Button onClick={onSubmit} disabled={!accountId || sending}>
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Envoyer la relance
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal saisie manuelle d'arriéré (onboarding nouveaux clients)      */
/* ------------------------------------------------------------------ */

function ManualArrearModal({
  onClose,
  onSubmit,
  academicYearId,
  academicYearName,
  setAcademicYearName,
  defaultYearName,
  studentId,
  setStudentId,
  amount,
  setAmount,
  reason,
  setReason,
  saving,
}: {
  onClose: () => void;
  onSubmit: () => void;
  academicYearId: string;
  academicYearName: string;
  setAcademicYearName: (v: string) => void;
  defaultYearName: string;
  studentId: string;
  setStudentId: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  reason: string;
  setReason: (v: string) => void;
  saving: boolean;
}) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState('');

  // Charger les niveaux scolaires
  useEffect(() => {
    fetch('/api/school-levels', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setSchoolLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setSchoolLevels([]));
  }, []);

  // Charger les classes
  // ⭐ FIX 2026-09-09 : classes de l'année du CONTEXTE (prop academicYearId,
  //    transmise par le parent depuis useModuleContext) + rechargement au switch.
  useEffect(() => {
    fetch(`/api/all-classes${academicYearId ? `?academicYearId=${encodeURIComponent(academicYearId)}` : ''}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setClasses(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => setClasses([]));
  }, [academicYearId]);

  // Charger les comptes élèves
  useEffect(() => {
    if (!academicYearId) return;
    financeService
      .getStudentAccounts({ academicYearId })
      .then((d) => setAccounts(Array.isArray(d) ? d : []))
      .catch(() => setAccounts([]));
  }, [academicYearId]);

  // Classes filtrées par niveau scolaire
  const filteredClasses = useMemo(() => {
    if (!selectedLevelId) return classes;
    const selectedLevel = schoolLevels.find((l) => l.id === selectedLevelId);
    const slId = selectedLevel?.schoolLevelId || selectedLevelId;
    return classes.filter((c: any) =>
      c.schoolLevelId === slId ||
      c.schoolLevel?.code === selectedLevel?.code ||
      c.schoolLevel?.id === slId
    );
  }, [classes, selectedLevelId, schoolLevels]);

  // Comptes filtrés par classe
  const filteredAccounts = useMemo(() => {
    let result = accounts;
    if (selectedClassId) {
      result = result.filter((a: any) =>
        a.student?.studentEnrollments?.some((e: any) => e.classId === selectedClassId) ||
        a.studentEnrollments?.some((e: any) => e.classId === selectedClassId)
      );
    }
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase().trim();
      result = result.filter((a: any) => {
        const name = a.student
          ? `${a.student.lastName} ${a.student.firstName}`.toLowerCase()
          : '';
        const matricule = (a.student?.matricule || '').toLowerCase();
        return name.includes(q) || matricule.includes(q);
      });
    }
    return result;
  }, [accounts, selectedClassId, studentSearch]);

  // Reset studentId quand on change de classe
  useEffect(() => {
    setStudentId('');
  }, [selectedClassId, setStudentId]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[calc(100dvh-2rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-900 mb-1 px-6 pt-6 flex items-center gap-2">
          <Plus className="w-5 h-5 text-amber-600" />
          Saisir un arriéré
        </h3>
        <p className="text-xs text-slate-500 px-6">
          Saisissez manuellement un arriéré pour un élève (issu des registres papier).
          Sélectionnez d'abord le niveau scolaire, puis la classe, puis l'élève.
        </p>
        <div className="space-y-4 p-6 overflow-y-auto overscroll-contain">
          {/* Ligne 1 : Niveau scolaire + Classe (côte à côte) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
                Niveau scolaire
              </Label>
              <Select value={selectedLevelId} onValueChange={(v) => { setSelectedLevelId(v); setSelectedClassId(''); }}>
                <SelectTrigger><SelectValue placeholder="Tous les niveaux" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous les niveaux</SelectItem>
                  {schoolLevels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.label || l.code || l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
                Classe {selectedLevelId && <span className="text-slate-400 normal-case font-normal">(filtrée par niveau)</span>}
              </Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Toutes les classes</SelectItem>
                  {filteredClasses.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ligne 2 : Recherche + autocomplétion élève (combiné) */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
              Élève {selectedClassId && <span className="text-slate-400 normal-case font-normal">(filtré par classe)</span>}
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
              <Input
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  // Réinitialiser la sélection si on modifie la recherche
                  if (studentId) setStudentId('');
                }}
                placeholder="Tapez le nom, prénom ou matricule de l'élève..."
                className="pl-9"
                autoComplete="off"
              />
              {/* Liste déroulante d'autocomplétion */}
              {studentSearch.trim() && !studentId && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {filteredAccounts.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-slate-500">
                      Aucun élève trouvé{selectedClassId ? ' dans cette classe' : ''}.
                    </p>
                  ) : (
                    filteredAccounts.slice(0, 50).map((a: any) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          // ⚠️ a.id = StudentAccount ID, a.studentId = Student ID
                          // Le backend createManualArrear attend un Student ID (FK vers students)
                          setStudentId(a.studentId || a.id);
                          // Mettre le nom dans le champ de recherche pour affichage
                          const name = a.student
                            ? `${a.student.lastName} ${a.student.firstName}${a.student.matricule ? ` · ${a.student.matricule}` : ''}`
                            : a.id;
                          setStudentSearch(name);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 transition border-b border-slate-50 last:border-b-0 flex items-center gap-2"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                          {a.student?.lastName?.[0] || '?'}{a.student?.firstName?.[0] || ''}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 truncate">
                            {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.id}
                          </p>
                          {a.student?.matricule && (
                            <p className="text-xs text-slate-400 font-mono">{a.student.matricule}</p>
                          )}
                        </div>
                        {Number(a.balance) > 0 && (
                          <span className="text-xs text-rose-600 font-mono shrink-0">
                            {formatCurrency(Number(a.balance))} F
                          </span>
                        )}
                      </button>
                    ))
                  )}
                  {filteredAccounts.length > 50 && (
                    <p className="px-3 py-1.5 text-[10px] text-slate-400 text-center bg-slate-50">
                      {filteredAccounts.length} résultats — affinez votre recherche
                    </p>
                  )}
                </div>
              )}
            </div>
            {/* Indicateur de sélection */}
            {studentId && (
              <div className="mt-1.5 flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-sm font-medium text-emerald-800">
                  {(() => {
                    const selected = filteredAccounts.find((a: any) => (a.studentId || a.id) === studentId) ||
                      accounts.find((a: any) => (a.studentId || a.id) === studentId);
                    return selected?.student
                      ? `${selected.student.lastName} ${selected.student.firstName}${selected.student.matricule ? ` · ${selected.student.matricule}` : ''}`
                      : 'Élève sélectionné';
                  })()}
                </span>
                <button
                  type="button"
                  onClick={() => { setStudentId(''); setStudentSearch(''); }}
                  className="ml-auto text-xs text-emerald-600 hover:text-rose-600"
                >
                  Changer
                </button>
              </div>
            )}
          </div>

          {/* Ligne 3 : Année scolaire + Montant (côte à côte) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
                Année scolaire concernée
              </Label>
              <Input
                type="text"
                value={academicYearName}
                onChange={(e) => setAcademicYearName(e.target.value)}
                placeholder={defaultYearName || 'ex: 2024-2025'}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                💡 Si l'année n'existe pas, elle sera créée automatiquement.
              </p>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
                Montant de l'arriéré (FCFA)
              </Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="ex: 25000"
                className="font-mono font-semibold"
              />
            </div>
          </div>

          {/* Motif */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
              Motif (optionnel)
            </Label>
            <Input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ex: Arriéré frais de scolarité 2024-2025"
            />
          </div>

          {/* Info */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800">
              💡 Cet arriéré sera ajouté au compte financier de l'élève et apparaîtra
              dans le tableau des arriérés. Il pourra faire l'objet de relances
              (email + WhatsApp + SMS) via les boutons d'action.
            </p>
          </div>
        </div>

        {/* Actions — pied FIXE toujours visible (pas besoin de scroller) */}
        <div className="flex gap-2 justify-end px-6 py-3 border-t border-slate-200 bg-slate-50 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
          <Button
            onClick={onSubmit}
            disabled={!studentId || !amount || saving}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Enregistrer l'arriéré
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Modal — Confirmation de suppression de relance (personnalisé)      */
/* ------------------------------------------------------------------ */

function DeleteReminderModal({
  data,
  loading,
  onClose,
  onConfirm,
}: {
  data: {
    reminderId: string;
    studentName: string;
    reminderLevel: string;
    sentVia: string;
    sentAt: string;
    amountDue: number;
  };
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const levelLabel = REMINDER_LEVEL_CONFIG[data.reminderLevel]?.label || data.reminderLevel;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête rouge */}
        <div className="bg-gradient-to-br from-rose-600 to-rose-700 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Supprimer la relance</h3>
              <p className="text-xs text-rose-100 mt-0.5">Action irréversible</p>
            </div>
          </div>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-rose-700 leading-relaxed">
              Vous êtes sur le point de supprimer définitivement cette relance de l'historique.
              Cette action <strong>ne peut pas être annulée</strong>.
            </p>
          </div>

          {/* Détails de la relance */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Détails de la relance</div>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Élève :</span>
                <span className="font-semibold text-slate-900">{data.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Niveau :</span>
                <span className="font-medium text-slate-700">{levelLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Canal :</span>
                <span className="font-medium text-slate-700">{data.sentVia}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date d'envoi :</span>
                <span className="font-medium text-slate-700">{data.sentAt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Montant dû :</span>
                <span className="font-bold text-rose-700">{formatCurrency(data.amountDue)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Suppression…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer définitivement
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Modal — Confirmation de suppression d'arriéré (personnalisé)       */
/* ------------------------------------------------------------------ */

const ARREAR_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  OPEN: { label: 'Ouvert', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  PARTIALLY_PAID: { label: 'Partiellement payé', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  PAID: { label: 'Soldé', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  WRITTEN_OFF: { label: 'Abandonné', color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
  TRANSFERRED: { label: 'Reporté', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
};

function DeleteArrearModal({
  data,
  loading,
  onClose,
  onConfirm,
}: {
  data: {
    arrearId: string;
    studentName: string;
    className: string;
    academicYearName: string;
    balanceDue: number;
    totalDue: number;
    totalPaid: number;
    status: string;
  };
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const statusCfg = ARREAR_STATUS_LABELS[data.status] || { label: data.status, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête rouge */}
        <div className="bg-gradient-to-br from-rose-600 to-rose-700 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Supprimer l'arriéré</h3>
              <p className="text-xs text-rose-100 mt-0.5">Action irréversible</p>
            </div>
          </div>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-4">
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-rose-700 leading-relaxed">
              Vous êtes sur le point de supprimer définitivement cet arriéré.
              Cette action <strong>ne peut pas être annulée</strong> et supprimera
              également toutes les relances, promesses et actions de recouvrement
              qui y sont rattachées.
            </p>
          </div>

          {/* Détails de l'arriéré */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Détails de l'arriéré</div>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Élève :</span>
                <span className="font-semibold text-slate-900">{data.studentName}</span>
              </div>
              {data.className !== '—' && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Classe :</span>
                  <span className="font-medium text-slate-700">{data.className}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Année scolaire :</span>
                <span className="font-medium text-slate-700">{data.academicYearName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Statut :</span>
                <Badge variant="outline" className={`${statusCfg.bg} ${statusCfg.color} border-current`}>
                  {statusCfg.label}
                </Badge>
              </div>
            </div>
          </div>

          {/* Récapitulatif financier */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Total dû</div>
              <div className="text-sm font-bold text-slate-700">{formatCurrency(data.totalDue)}</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-200">
              <div className="text-[10px] uppercase tracking-wide text-emerald-600 mb-1">Payé</div>
              <div className="text-sm font-bold text-emerald-700">{formatCurrency(data.totalPaid)}</div>
            </div>
            <div className="bg-rose-50 rounded-lg p-3 text-center border border-rose-200">
              <div className="text-[10px] uppercase tracking-wide text-rose-600 mb-1">Reste</div>
              <div className="text-sm font-bold text-rose-700">{formatCurrency(data.balanceDue)}</div>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Le compte élève sera ajusté : le montant de l'arriéré sera retiré du
            total dû et du solde. Les inscriptions avec <code className="bg-slate-100 px-1 rounded">previousArrears</code> seront
            également ajustées.
          </p>
        </div>

        {/* Actions */}
        <div className="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Suppression…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer définitivement
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal — Suppression MULTIPLE d'arriérés                            */
/* ------------------------------------------------------------------ */

function BulkDeleteArrearModal({
  items,
  loading,
  onClose,
  onConfirm,
}: {
  items: Array<{
    arrearId: string;
    studentName: string;
    className: string;
    academicYearName: string;
    balanceDue: number;
  }>;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const totalBalance = items.reduce((s, i) => s + (i.balanceDue || 0), 0);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={loading ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[calc(100dvh-2rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête rouge */}
        <div className="bg-gradient-to-br from-rose-600 to-rose-700 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                Supprimer {items.length} arriéré{items.length > 1 ? 's' : ''}
              </h3>
              <p className="text-xs text-rose-100 mt-0.5">Action irréversible — suppression en lot</p>
            </div>
          </div>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-rose-700 leading-relaxed">
              Vous êtes sur le point de supprimer définitivement{' '}
              <strong>{items.length} arriéré{items.length > 1 ? 's' : ''}</strong>{' '}
              ({formatCurrency(totalBalance)} au total). Cette action{' '}
              <strong>ne peut pas être annulée</strong> et supprimera également toutes les
              relances, promesses et actions de recouvrement rattachées. Le lot est traité en
              une seule opération : en cas d'erreur sur un seul arriéré, rien n'est supprimé.
            </p>
          </div>

          {/* Liste des arriérés sélectionnés */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Arriérés sélectionnés
              </div>
              <div className="text-xs text-slate-500">{items.length} élève(s)</div>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {items.map((i) => (
                <div key={i.arrearId} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{i.studentName}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {i.className !== '—' ? `${i.className} · ` : ''}{i.academicYearName}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-rose-700 font-mono whitespace-nowrap">
                    {formatCurrency(i.balanceDue)}
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-rose-50 px-4 py-2 border-t border-rose-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wide">
                Total à retirer
              </span>
              <span className="text-sm font-bold text-rose-700 font-mono">
                {formatCurrency(totalBalance)}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Les comptes élèves seront ajustés uniquement si les arriérés y sont comptabilisés
            (arriérés intégrés au compte). Les inscriptions avec{' '}
            <code className="bg-slate-100 px-1 rounded">previousArrears</code> seront
            également ajustées. Une trace d'audit groupée est enregistrée.
          </p>
        </div>

        {/* Actions */}
        <div className="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Suppression…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer {items.length} arriéré{items.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Modal — Encaissement d'un arriéré (marquer un élève ayant payé)    */
/* ------------------------------------------------------------------ */

function ArrearPaymentModal({
  arrear,
  onClose,
  onSubmitted,
}: {
  arrear: any;
  onClose: () => void;
  /** Appelé après enregistrement avec le NOUVEAU restant dû de l'arriéré. */
  onSubmitted: (remainingBalanceDue: number) => void;
}) {
  const { toast } = useToast();
  const balanceDue = Number(arrear.balanceDue) || 0;
  const [amount, setAmount] = useState<string>(String(balanceDue || ''));
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const studentName = arrear.student
    ? `${arrear.student.lastName} ${arrear.student.firstName}`
    : '—';
  const className = arrear.student?.studentEnrollments?.[0]?.class?.name || '—';
  const feeLabel = arrear.studentFee?.feeDefinition?.label || arrear.notes || '—';
  const parsedAmount = Number(amount) || 0;
  const amountInvalid = parsedAmount <= 0 || parsedAmount > balanceDue + 1e-9;
  const newRemaining = Math.max(0, balanceDue - (amountInvalid ? 0 : parsedAmount));

  const handleSubmit = async () => {
    if (amountInvalid || submitting) return;
    setSubmitting(true);
    try {
      const result = await financeService.recordArrearPayment(arrear.id, {
        amount: parsedAmount,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      const remaining = Number(result?.arrear?.balanceDue ?? newRemaining);
      onSubmitted(remaining);
    } catch (e: any) {
      // L'erreur serveur (montant > restant dû, caisse fermée, etc.) est
      // affichée TELLE QUELLE — l'utilisateur sait exactement quoi corriger.
      const message =
        e?.response?.data?.message ||
        e?.data?.message ||
        e?.message ||
        'Erreur inconnue lors de l\'encaissement.';
      toast({
        title: '❌ Encaissement refusé',
        description: Array.isArray(message) ? message.join(' · ') : String(message),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[calc(100dvh-2rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête émeraude */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Encaisser un arriéré</h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                Marquer l'élève ayant payé — recalcul automatique du compte
              </p>
            </div>
          </div>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Récapitulatif de l'arriéré */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                {studentName}
              </div>
              <div className="text-xs text-slate-500">{className}</div>
            </div>
            <div className="px-4 py-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Total dû</p>
                <p className="text-sm font-bold text-slate-900">{formatCurrency(Number(arrear.totalDue))}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Payé</p>
                <p className="text-sm font-bold text-emerald-700">{formatCurrency(Number(arrear.totalPaid))}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Restant dû</p>
                <p className="text-sm font-bold text-rose-700">{formatCurrency(balanceDue)}</p>
              </div>
            </div>
            {feeLabel && feeLabel !== '—' && (
              <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-500 truncate">
                {feeLabel}
              </div>
            )}
          </div>

          {/* Montant encaissé */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Montant encaissé (FCFA)
            </Label>
            <Input
              type="number"
              min={1}
              max={balanceDue}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting}
              className="font-mono"
            />
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setAmount(String(balanceDue))}
                className="text-emerald-700 underline hover:text-emerald-800"
              >
                Solde total ({formatCurrency(balanceDue)})
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setAmount(String(Math.floor(balanceDue / 2)))}
                className="text-slate-600 underline hover:text-slate-800"
              >
                Moitié
              </button>
              {amountInvalid && (
                <span className="ml-auto text-rose-600 font-medium">
                  Doit être entre 1 et {formatCurrency(balanceDue)}
                </span>
              )}
            </div>
          </div>

          {/* Mode de paiement */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Mode de paiement
            </Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Espèces</SelectItem>
                <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                <SelectItem value="WIRE">Virement bancaire</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Référence (optionnelle) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Référence <span className="normal-case font-normal text-slate-400">(optionnel)</span>
            </Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="N° bordereau, référence Mobile Money…"
              disabled={submitting}
            />
          </div>

          {/* Note (optionnelle) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Note <span className="normal-case font-normal text-slate-400">(optionnel)</span>
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Commentaire tracé sur l'arriéré…"
              disabled={submitting}
            />
          </div>

          {/* Explication du recalcul */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-emerald-800 leading-relaxed">
              Un reçu <strong>{formatCurrency(parsedAmount)}</strong> est enregistré sur le compte de
              l'élève. Le solde du compte, l'arriéré et les statistiques de recouvrement sont
              <strong> recalculés automatiquement</strong> — restant dû après encaissement :
              <strong className="ml-1">{formatCurrency(newRemaining)}</strong>.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || amountInvalid}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Banknote className="w-4 h-4 mr-2" />
                Encaisser {formatCurrency(parsedAmount)}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Modal — Modification d'un arriéré (correction d'erreur de saisie)   */
/* ------------------------------------------------------------------ */

function EditArrearModal({
  arrear,
  onClose,
  onSubmitted,
}: {
  arrear: any;
  onClose: () => void;
  /** Appelé après enregistrement avec l'arriéré MIS À JOUR (balanceDue recalculé). */
  onSubmitted: (updatedArrear: any) => void;
}) {
  const { toast } = useToast();
  const oldTotalDue = Number(arrear.totalDue) || 0;
  const oldTotalPaid = Number(arrear.totalPaid) || 0;
  const oldBalance = Number(arrear.balanceDue) || 0;

  const [totalDue, setTotalDue] = useState<string>(String(oldTotalDue));
  const [totalPaid, setTotalPaid] = useState<string>(String(oldTotalPaid));
  const [notes, setNotes] = useState<string>(arrear.notes || '');
  const [submitting, setSubmitting] = useState(false);

  const studentName = arrear.student
    ? `${arrear.student.lastName} ${arrear.student.firstName}`
    : '—';
  const className = arrear.student?.studentEnrollments?.[0]?.class?.name || '—';
  const academicYearName = arrear.academicYear?.name || '';
  const feeLabel = arrear.studentFee?.feeDefinition?.label || arrear.notes || '—';

  const parsedDue = Number(totalDue);
  const parsedPaid = Number(totalPaid);
  const dueInvalid = !Number.isFinite(parsedDue) || parsedDue < 0;
  const paidInvalid = !Number.isFinite(parsedPaid) || parsedPaid < 0;
  const paidExceeds = !dueInvalid && !paidInvalid && parsedPaid > parsedDue;
  const formInvalid = dueInvalid || paidInvalid || paidExceeds;

  // ⭐ Recalcul dynamique en direct : nouveau restant dû + statut prévisionnel
  const newBalance = formInvalid ? oldBalance : parsedDue - parsedPaid;
  const newStatus = newBalance <= 0 ? 'PAID' : parsedPaid > 0 ? 'PARTIALLY_PAID' : 'OPEN';
  const changed =
    !formInvalid &&
    (parsedDue !== oldTotalDue || parsedPaid !== oldTotalPaid || notes !== (arrear.notes || ''));

  const handleSubmit = async () => {
    if (formInvalid || submitting || !changed) return;
    setSubmitting(true);
    try {
      const updated = await financeService.updateArrear(arrear.id, {
        totalDue: parsedDue,
        totalPaid: parsedPaid,
        notes: notes.trim() || undefined,
        reason: 'Correction manuelle depuis le tableau des arriérés',
      });
      onSubmitted(updated);
    } catch (e: any) {
      const message =
        e?.response?.data?.message ||
        e?.data?.message ||
        e?.message ||
        'Erreur inconnue lors de la modification.';
      toast({
        title: '❌ Modification refusée',
        description: Array.isArray(message) ? message.join(' · ') : String(message),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[calc(100dvh-2rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête indigo */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-6 py-4 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Modifier l'arriéré</h3>
              <p className="text-xs text-indigo-100 mt-0.5">
                Correction d'erreur de saisie — recalcul automatique du compte
              </p>
            </div>
          </div>
        </div>

        {/* Corps scrollable — le pied (Annuler / Enregistrer) reste TOUJOURS visible */}
        <div className="p-6 space-y-4 overflow-y-auto overscroll-contain">
          {/* Récapitulatif actuel de l'arriéré */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                {studentName}
              </div>
              <div className="text-xs text-slate-500">
                {className}{academicYearName ? ` · ${academicYearName}` : ''}
              </div>
            </div>
            <div className="px-4 py-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Total dû</p>
                <p className="text-sm font-bold text-slate-900">{formatCurrency(oldTotalDue)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Payé</p>
                <p className="text-sm font-bold text-emerald-700">{formatCurrency(oldTotalPaid)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Restant dû</p>
                <p className="text-sm font-bold text-rose-700">{formatCurrency(oldBalance)}</p>
              </div>
            </div>
            {feeLabel && feeLabel !== '—' && (
              <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-500 truncate">
                {feeLabel}
              </div>
            )}
          </div>

          {/* Montant total dû */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Montant total dû (FCFA)
            </Label>
            <Input
              type="number"
              min={0}
              value={totalDue}
              onChange={(e) => setTotalDue(e.target.value)}
              disabled={submitting}
              className="font-mono"
            />
            {dueInvalid && (
              <p className="text-xs text-rose-600">Doit être un nombre positif ou nul.</p>
            )}
          </div>

          {/* Montant déjà payé */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Montant déjà payé (FCFA)
            </Label>
            <Input
              type="number"
              min={0}
              value={totalPaid}
              onChange={(e) => setTotalPaid(e.target.value)}
              disabled={submitting}
              className="font-mono"
            />
            <p className="text-xs text-slate-500">
              Utilisez « Encaisser » pour enregistrer un NOUVEAU paiement — ce champ
              corrige un total saisi à tort (ex. paiement doublé ou jamais enregistré).
            </p>
            {paidInvalid && (
              <p className="text-xs text-rose-600">Doit être un nombre positif ou nul.</p>
            )}
            {paidExceeds && (
              <p className="text-xs text-rose-600 font-medium">
                Le montant payé ne peut pas dépasser le montant total dû.
              </p>
            )}
          </div>

          {/* Nouveau restant dû — recalcul en direct */}
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Info className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wide">
                Nouveau restant dû
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-lg font-bold font-mono text-indigo-900">
                {formatCurrency(Math.max(0, newBalance))}
              </span>
              {newBalance !== oldBalance && (
                <Badge variant="outline" className="text-[10px] border-indigo-300 text-indigo-700 bg-white">
                  {newStatus === 'PAID' ? 'soldé' : newStatus === 'PARTIALLY_PAID' ? 'partiellement payé' : 'ouvert'}
                </Badge>
              )}
            </div>
          </div>

          {/* Motif de la correction */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Motif de la correction <span className="normal-case font-normal text-slate-400">(tracé dans l'audit)</span>
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex. montant saisi à tort (erreur de frappe), paiement omis…"
              disabled={submitting}
            />
          </div>

          {/* Explication du recalcul */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-emerald-800 leading-relaxed">
              Après enregistrement, le restant dû, le statut, le niveau de gravité et les
              miroirs d'arriérés du compte de l'élève sont <strong>recalculés
              automatiquement</strong> — le compte élève, les KPIs de recouvrement et le
              bilan des encaissements reflètent immédiatement la correction.
            </p>
          </div>
        </div>

        {/* Actions — pied FIXE toujours visible (pas besoin de scroller) */}
        <div className="bg-slate-50 px-6 py-3 flex justify-end gap-2 border-t border-slate-200 shrink-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || formInvalid || !changed}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Pencil className="w-4 h-4 mr-2" />
                Enregistrer la correction
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
