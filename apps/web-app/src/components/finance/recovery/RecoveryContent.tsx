'use client';

/**
 * ============================================================================
 * RECOVERY CONTENT — Recouvrement & Arriérés (shell avec onglets)
 * ============================================================================
 *
 * Outil fintech de pilotage du recouvrement :
 *   - Dashboard KPIs (total arriérés, taux recouvrement, élèves bloqués, promesses)
 *   - Vue Arriérés (tableau filtrable par niveau, classe, montant)
 *   - Vue Relances (historique des relances envoyées)
 *   - Vue Promesses (promesses de paiement + suivi honoré/rompu)
 *   - Vue Actions (historique des actions : appel, email, visite, courrier)
 *   - Vue Cas (dossiers consolidés par élève)
 *
 * Backend : 2 systèmes coexistent
 *   - OLD : RecoveryReminder (cron nightly + envoi email réel)
 *   - NEW : FeeArrear + CollectionReminder + PaymentPromise + CollectionAction + CollectionCase
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

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertCircle, TrendingDown, Users, Wallet, Target, RefreshCw,
  Send, Play, Loader2, ChevronRight, Filter, Search,
  Phone, Mail, FileText, UserCheck, Clock, AlertTriangle,
  Zap, CheckCircle2, XCircle, Calendar, Plus, Eye, FileSpreadsheet,
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';
import { WhatsAppIcon, GmailIcon, SmsIcon } from '../OfficialIcons';

type TabId = 'dashboard' | 'arrears' | 'reminders' | 'promises' | 'actions' | 'cases';

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Tableau de bord', icon: TrendingDown },
  { id: 'arrears', label: 'Arriérés', icon: AlertCircle },
  { id: 'reminders', label: 'Relances', icon: Send },
  { id: 'promises', label: 'Promesses', icon: Target },
  { id: 'actions', label: 'Actions', icon: Phone },
  { id: 'cases', label: 'Dossiers', icon: FileText },
];

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
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [escalating, setEscalating] = useState(false);

  // Données
  const [arrears, setArrears] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [promises, setPromises] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);

  // Filtres arriérés
  const [arrearLevelFilter, setArrearLevelFilter] = useState<string>('ALL');
  const [arrearSearch, setArrearSearch] = useState('');
  const [arrearSchoolLevelId, setArrearSchoolLevelId] = useState<string>('ALL');
  const [arrearClassId, setArrearClassId] = useState<string>('ALL');
  const [arrearYearId, setArrearYearId] = useState<string>('ALL');

  // Filtres promesses
  const [promiseStatusFilter, setPromiseStatusFilter] = useState<string>('ALL');

  // Filtres actions
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('ALL');

  // Modal relance manuelle (NOUVEAU système multi-canal)
  const [manualModal, setManualModal] = useState(false);
  const [manualAccountId, setManualAccountId] = useState('');
  const [manualLevel, setManualLevel] = useState<'PREMIERE_RELANCE' | 'DEUXIEME_RELANCE' | 'MISE_EN_DEMEURE'>('PREMIERE_RELANCE');
  // État pour l'envoi multi-canal
  const [sendingMulti, setSendingMulti] = useState(false);

  // Modal saisie manuelle d'arriéré (onboarding nouveaux clients)
  const [manualArrearModal, setManualArrearModal] = useState(false);
  const [arrearStudentId, setArrearStudentId] = useState('');
  const [arrearAmount, setArrearAmount] = useState('');
  const [arrearReason, setArrearReason] = useState('');
  const [arrearYearName, setArrearYearName] = useState('');
  const [arrearSaving, setArrearSaving] = useState(false);

  // Modals Phase 2
  const [promiseModal, setPromiseModal] = useState<{ arrearId: string; studentName: string; balanceDue: number } | null>(null);
  const [actionModal, setActionModal] = useState<{ arrearId: string; studentName: string } | null>(null);
  const [caseDetailModal, setCaseDetailModal] = useState<any | null>(null);

  const loadAll = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const [arrearsData, remindersData, statsData, promisesData, actionsData, casesData] = await Promise.all([
        // ⚠️ Les arriérés sont chargés SANS filtre academicYearId pour inclure
        // les arriérés antérieurs (saisis manuellement pour l'onboarding).
        // Le backend findAllArrears retourne tous les arriérés du tenant si
        // academicYearId n'est pas fourni.
        financeService.getArrears({}).catch(() => []),
        financeService.getRecoveryReminders({ academicYearId: academicYear.id }).catch(() => []),
        financeService.getCollectionStatistics(academicYear.id).catch(() => null),
        financeService.getCollectionPromises({ academicYearId: academicYear.id }).catch(() => []),
        financeService.getCollectionActions({ academicYearId: academicYear.id }).catch(() => []),
        financeService.getCollectionCases({ academicYearId: academicYear.id }).catch(() => []),
      ]);
      setArrears(Array.isArray(arrearsData) ? arrearsData : []);
      setReminders(Array.isArray(remindersData) ? remindersData : []);
      setStatistics(statsData);
      setPromises(Array.isArray(promisesData) ? promisesData : []);
      setActions(Array.isArray(actionsData) ? actionsData : []);
      setCases(Array.isArray(casesData) ? casesData : []);
    } catch (e) {
      console.error('Failed to load recovery data', e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleDetectArrears = async () => {
    if (!academicYear?.id) return;
    setDetecting(true);
    try {
      const result = await financeService.detectArrears(academicYear.id);
      toast({
        title: '✅ Détection terminée',
        description: `${result?.length ?? 0} arriéré(s) détecté(s) ou mis à jour.`,
      });
      await loadAll();
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
      // Trouver l'arriéré correspondant au compte élève sélectionné
      // (manualAccountId = studentAccountId)
      const matchingArrear = arrears.find((a) => a.studentAccountId === manualAccountId);
      if (!matchingArrear) {
        // Fallback : si pas d'arriéré trouvé, on appelle l'ancien système
        await financeService.sendManualReminder({
          studentAccountId: manualAccountId,
          level: 'WARNING',
          channel: 'SMS',
        });
        toast({
          title: '⚠️ Relance envoyée (ancien système)',
          description: 'Aucun arriéré trouvé pour cet élève. Relance basique envoyée par email.',
        });
      } else {
        // NOUVEAU système : envoi multi-canal (email + WhatsApp + SMS) au parent
        const result = await financeService.sendRecoveryNotification(
          matchingArrear.id,
          ['email', 'whatsapp', 'sms'],
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
          variant: sent.length > 0 ? 'default' : 'destructive',
        });
      }
      setManualModal(false);
      loadAll();
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
      const s = result?.channels?.[channel];
      if (s?.status === 'skipped') {
        toast({ title: 'Contact manquant', description: s.error || `Aucun contact pour ${channel}`, variant: 'destructive' });
      } else if (s?.status === 'failed') {
        toast({ title: 'Échec d\'envoi', description: s.error || `Échec ${channel}`, variant: 'destructive' });
      } else {
        toast({
          title: '✅ Relance envoyée',
          description: `${channel.charAt(0).toUpperCase() + channel.slice(1)} envoyé${s?.to ? ` à ${s.to}` : ''}`,
        });
      }
      loadAll();
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
        description: `${formatCurrency(amount)} FCFA ajouté aux arriérés de l'élève pour l'année ${result.academicYearName || yearName}.` +
          (result.yearCreated ? ' (année scolaire créée automatiquement)' : ''),
      });
      setManualArrearModal(false);
      setArrearStudentId('');
      setArrearAmount('');
      setArrearReason('');
      setArrearYearName('');
      loadAll();
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
      loadAll();
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

  // Marquer une promesse comme honorée ou rompue
  const handleUpdatePromiseStatus = async (promiseId: string, status: 'HONORED' | 'BROKEN') => {
    try {
      await financeService.updatePromiseStatus(promiseId, status);
      toast({
        title: status === 'HONORED' ? '✅ Promesse honorée' : '❌ Promesse rompue',
        description: status === 'HONORED'
          ? 'La promesse a été marquée comme honorée.'
          : 'La promesse a été marquée comme rompue. Une escalade est recommandée.',
      });
      loadAll();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.message || 'Erreur réseau',
        variant: 'destructive',
      });
    }
  };

  // Créer une promesse de paiement
  const handleCreatePromise = async (data: { arrearId: string; promisedAmount: number; promiseDate: string; notes?: string }) => {
    try {
      await financeService.createPaymentPromise(data);
      toast({ title: '✅ Promesse enregistrée', description: 'La promesse de paiement a été créée.' });
      setPromiseModal(null);
      loadAll();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur', variant: 'destructive' });
    }
  };

  // Créer une action de recouvrement
  const handleCreateAction = async (data: { arrearId: string; actionType: string; description?: string }) => {
    try {
      await financeService.createCollectionAction(data);
      toast({ title: '✅ Action enregistrée', description: "L'action de recouvrement a été journalisée." });
      setActionModal(null);
      loadAll();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur', variant: 'destructive' });
    }
  };

  // Filtrage des promesses
  const filteredPromises = useMemo(() => {
    if (promiseStatusFilter === 'ALL') return promises;
    return promises.filter((p) => p.status === promiseStatusFilter);
  }, [promises, promiseStatusFilter]);

  // Filtrage des actions
  const filteredActions = useMemo(() => {
    if (actionTypeFilter === 'ALL') return actions;
    return actions.filter((a) => a.actionType === actionTypeFilter);
  }, [actions, actionTypeFilter]);

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
      result = result.filter((a) => {
        return a.student?.schoolLevelId === arrearSchoolLevelId;
      });
    }
    if (arrearClassId !== 'ALL') {
      result = result.filter((a) => {
        const enrollment = a.student?.studentEnrollments?.[0];
        return enrollment?.classId === arrearClassId;
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
  }, [arrears, arrearLevelFilter, arrearSearch, arrearSchoolLevelId, arrearClassId, arrearYearId]);

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
          />
        ) : activeTab === 'reminders' ? (
          <RemindersTab
            reminders={reminders}
            arrears={arrears}
            onSendChannel={(arrearId, channel) => handleSendChannelReminder(arrearId, channel, 'PREMIERE_RELANCE')}
          />
        ) : activeTab === 'promises' ? (
          <PromisesTab
            promises={filteredPromises}
            totalCount={promises.length}
            statusFilter={promiseStatusFilter}
            setStatusFilter={setPromiseStatusFilter}
            onUpdateStatus={handleUpdatePromiseStatus}
            onNewPromise={(arrear) => setPromiseModal({
              arrearId: arrear.id,
              studentName: arrear.student ? `${arrear.student.lastName} ${arrear.student.firstName}` : 'Élève',
              balanceDue: Number(arrear.balanceDue) || 0,
            })}
            arrears={arrears}
          />
        ) : activeTab === 'actions' ? (
          <ActionsTab
            actions={filteredActions}
            totalCount={actions.length}
            typeFilter={actionTypeFilter}
            setTypeFilter={setActionTypeFilter}
            onNewAction={(arrear) => setActionModal({
              arrearId: arrear.id,
              studentName: arrear.student ? `${arrear.student.lastName} ${arrear.student.firstName}` : 'Élève',
            })}
            arrears={arrears}
          />
        ) : (
          <CasesTab cases={cases} onViewCase={(c) => setCaseDetailModal(c)} />
        )}
      </ModuleContentArea>

      {/* Modal nouvelle promesse */}
      {promiseModal && (
        <PromiseModal
          data={promiseModal}
          onClose={() => setPromiseModal(null)}
          onSubmit={handleCreatePromise}
        />
      )}

      {/* Modal nouvelle action */}
      {actionModal && (
        <ActionModal
          data={actionModal}
          onClose={() => setActionModal(null)}
          onSubmit={handleCreateAction}
        />
      )}

      {/* Modal détail dossiers */}
      {caseDetailModal && (
        <CaseDetailModal caseData={caseDetailModal} onClose={() => setCaseDetailModal(null)} />
      )}

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
          value={`${formatCurrency(kpis.totalArrears)} FCFA`}
          subtext={`${kpis.studentsWithArrears} élève(s) concerné(s)`}
        />
        <KpiCard
          icon={TrendingDown}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          label="Taux de recouvrement"
          value={`${recoveryRate.toFixed(1)}%`}
          subtext={`${formatCurrency(totalCollected)} encaissé`}
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
                  {formatCurrency(totalLevel)} FCFA
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
                        {formatCurrency(a.balanceDue)} FCFA
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
  onSendChannel: (arrearId: string, channel: 'email' | 'whatsapp' | 'sms') => void;
}) {
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  // Charger les niveaux scolaires
  useEffect(() => {
    fetch('/api/school-levels', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setSchoolLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setSchoolLevels([]));
  }, []);

  // Charger les classes
  useEffect(() => {
    fetch('/api/all-classes', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setClasses(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => setClasses([]));
  }, []);

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

  // Export PDF des arriérés (filtre appliqué) — génère le PDF côté frontend avec jsPDF
  const handleExportPDF = async () => {
    try {
      // Charger jsPDF + autoTable depuis CDN (même pattern que finance-exports.ts)
      const loadJsPdf = (): Promise<any> => new Promise((resolve) => {
        if ((window as any).jspdf && (window as any).jspdf.jsPDF) {
          resolve((window as any).jspdf.jsPDF);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => resolve((window as any).jspdf.jsPDF);
        document.head.appendChild(script);
      });
      const loadAutoTable = (jsPDF: any): Promise<void> => new Promise((resolve) => {
        if ((window as any).autoTable) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
      });

      const jsPDF = await loadJsPdf();
      await loadAutoTable(jsPDF);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Titre
      doc.setFont('times', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(13, 31, 110);
      doc.text('Liste des arriérés', pageWidth / 2, 20, { align: 'center' });

      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      doc.text(`Exporté le ${dateStr}`, pageWidth / 2, 26, { align: 'center' });

      // Ligne séparatrice
      doc.setDrawColor(13, 31, 110);
      doc.setLineWidth(0.5);
      doc.line(14, 30, pageWidth - 14, 30);

      // Tableau
      const levelLabels: Record<string, string> = {
        LOW: 'Faible', MEDIUM: 'Moyen', HIGH: 'Élevé', CRITICAL: 'Critique',
      };
      const tableData = arrears.map((a) => [
        a.student ? `${a.student.lastName} ${a.student.firstName}` : '—',
        a.student?.studentEnrollments?.[0]?.class?.name || '—',
        a.studentFee?.feeDefinition?.label || a.notes || '—',
        a.totalDue != null ? Number(a.totalDue).toLocaleString('fr-FR') : '—',
        a.totalPaid != null ? Number(a.totalPaid).toLocaleString('fr-FR') : '—',
        a.balanceDue != null ? Number(a.balanceDue).toLocaleString('fr-FR') : '—',
        levelLabels[a.arrearsLevel] || a.arrearsLevel || '—',
      ]);

      const totalBalance = arrears.reduce((s, a) => s + (Number(a.balanceDue) || 0), 0);
      tableData.push(['', '', '', '', 'TOTAL', totalBalance.toLocaleString('fr-FR'), '']);

      (doc as any).autoTable({
        startY: 34,
        head: [['Élève', 'Classe', 'Frais', 'Total dû', 'Payé', 'Solde', 'Niveau']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [13, 31, 110], fontSize: 9, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right', fontStyle: 'bold' },
        },
        didParseCell: (data: any) => {
          if (data.row.index === tableData.length - 1 && data.column.index >= 4) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [220, 230, 250];
          }
        },
      });

      doc.save(`Arrieres_recouvrement_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      console.error('Export PDF error:', e);
    }
  };

  // Export Excel des arriérés (filtre appliqué) — génère le XLSX côté frontend avec ExcelJS
  const handleExportExcel = async () => {
    try {
      const loadExcelJS = (): Promise<any> => new Promise((resolve) => {
        if ((window as any).ExcelJS) { resolve((window as any).ExcelJS); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
        script.onload = () => resolve((window as any).ExcelJS);
        document.head.appendChild(script);
      });
      const ExcelJS = await loadExcelJS();
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Arriérés', { properties: { defaultRowHeight: 18 } });

      // Titre
      ws.mergeCells('A1:G1');
      const titleCell = ws.getCell('A1');
      titleCell.value = 'Liste des arriérés';
      titleCell.font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };
      titleCell.alignment = { horizontal: 'center' };
      ws.getRow(1).height = 28;

      // Date d'export
      ws.mergeCells('A2:G2');
      ws.getCell('A2').value = `Exporté le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
      ws.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
      ws.getCell('A2').alignment = { horizontal: 'center' };

      // En-têtes
      const headers = ['Élève', 'Classe', 'Frais', 'Total dû (FCFA)', 'Payé (FCFA)', 'Solde (FCFA)', 'Niveau'];
      headers.forEach((h, i) => {
        const cell = ws.getCell(4, i + 1);
        cell.value = h;
        cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        cell.alignment = { horizontal: i >= 3 && i <= 5 ? 'right' : 'left', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
      ws.getRow(4).height = 22;

      // Données
      const levelLabels: Record<string, string> = { LOW: 'Faible', MEDIUM: 'Moyen', HIGH: 'Élevé', CRITICAL: 'Critique' };
      let totalBalance = 0;
      let row = 5;
      for (const a of arrears) {
        const amount = Number(a.balanceDue) || 0;
        totalBalance += amount;
        const values = [
          a.student ? `${a.student.lastName} ${a.student.firstName}` : '—',
          a.student?.studentEnrollments?.[0]?.class?.name || '—',
          a.studentFee?.feeDefinition?.label || a.notes || '—',
          Number(a.totalDue) || 0,
          Number(a.totalPaid) || 0,
          amount,
          levelLabels[a.arrearsLevel] || a.arrearsLevel || '—',
        ];
        values.forEach((v, i) => {
          const cell = ws.getCell(row, i + 1);
          cell.value = v;
          cell.font = { size: 10 };
          cell.alignment = { horizontal: i >= 3 && i <= 5 ? 'right' : 'left', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          if (i >= 3 && i <= 5) cell.numFmt = '#,##0';
        });
        // Couleur niveau
        const levelCell = ws.getCell(row, 7);
        if (a.arrearsLevel === 'CRITICAL') levelCell.font = { size: 10, color: { argb: 'FFDC2626' }, bold: true };
        else if (a.arrearsLevel === 'HIGH') levelCell.font = { size: 10, color: { argb: 'FFEA580C' }, bold: true };
        else if (a.arrearsLevel === 'MEDIUM') levelCell.font = { size: 10, color: { argb: 'FFD97706' }, bold: true };
        row++;
      }

      // Ligne total
      if (arrears.length > 0) {
        ws.mergeCells(row, 1, row, 5);
        const totalLabel = ws.getCell(row, 1);
        totalLabel.value = 'TOTAL SOLDE RESTANT';
        totalLabel.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        totalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        totalLabel.alignment = { horizontal: 'right', vertical: 'middle' };
        const totalCell = ws.getCell(row, 6);
        totalCell.value = totalBalance;
        totalCell.numFmt = '#,##0';
        totalCell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        totalCell.alignment = { horizontal: 'right', vertical: 'middle' };
        ws.getCell(row, 7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        ws.getRow(row).height = 26;
      }

      // Largeurs colonnes
      ws.columns = [
        { width: 24 }, { width: 16 }, { width: 28 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 12 },
      ];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Arrieres_recouvrement_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
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
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
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
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
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
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
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
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
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
                className="pl-9"
              />
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {arrears.length} affiché(s) sur {totalCount} total
        </div>
      </div>

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

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Élève</TableHead>
              <TableHead>Classe</TableHead>
              <TableHead>Frais</TableHead>
              <TableHead className="text-right">Total dû</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead className="text-right">Solde</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead>Dernier paiement</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {arrears.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500 py-12">
                  Aucun arriéré trouvé. Lancez la détection pour identifier les impayés.
                </TableCell>
              </TableRow>
            ) : (
              arrears.map((a) => {
                const config = ARREARS_LEVEL_CONFIG[a.arrearsLevel || 'LOW'] || ARREARS_LEVEL_CONFIG.LOW;
                return (
                  <TableRow key={a.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">
                      {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.studentId}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {a.student?.studentEnrollments?.[0]?.class?.name || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {a.studentFee?.feeDefinition?.label || a.notes || '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(a.totalDue)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-emerald-700">{formatCurrency(a.totalPaid)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold text-rose-700">{formatCurrency(a.balanceDue)}</TableCell>
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
                        {/* WhatsApp */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-emerald-100 hover:shadow-sm transition-all duration-150"
                          onClick={() => onSendChannel(a.id, 'whatsapp')}
                          title="Envoyer relance par WhatsApp"
                        >
                          <WhatsAppIcon className="w-3.5 h-3.5" />
                        </Button>
                        {/* SMS */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-blue-100 hover:shadow-sm transition-all duration-150"
                          onClick={() => onSendChannel(a.id, 'sms')}
                          title="Envoyer relance par SMS"
                        >
                          <SmsIcon className="w-3.5 h-3.5" />
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
}: {
  reminders: any[];
  arrears: any[];
  onSendChannel: (arrearId: string, channel: 'email' | 'whatsapp' | 'sms') => void;
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
                          {/* WhatsApp */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-emerald-100 hover:shadow-sm transition-all duration-150"
                            onClick={() => onSendChannel(matchingArrear.id, 'whatsapp')}
                            title="Renvoyer par WhatsApp"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                          </Button>
                          {/* SMS */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-blue-100 hover:shadow-sm transition-all duration-150"
                            onClick={() => onSendChannel(matchingArrear.id, 'sms')}
                            title="Renvoyer par SMS"
                          >
                            <SmsIcon className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Aucun arriéré actif</span>
                      )}
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
  useEffect(() => {
    fetch('/api/all-classes', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setClasses(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => setClasses([]));
  }, []);

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Send className="w-5 h-5 text-blue-600" />
          Relance manuelle
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Sélectionnez un élève par niveau scolaire et classe, puis choisissez le niveau de relance.
          La relance sera envoyée automatiquement par <strong>email + WhatsApp + SMS</strong> au parent.
        </p>
        <div className="space-y-4">
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
                    {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.id} — {formatCurrency(a.balance)} FCFA
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

          {/* Niveau de relance (termes français) */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
              Niveau de relance
            </Label>
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

          {/* Info envoi multi-canal */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>📧 ⚙️ 📱 Envoi automatique multi-canal :</strong> La relance sera envoyée au parent sur les 3 canaux
              (email + WhatsApp + SMS) en arrière-plan. Vous recevrez un rapport détaillé.
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-2">
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
  useEffect(() => {
    fetch('/api/all-classes', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setClasses(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => setClasses([]));
  }, []);

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Plus className="w-5 h-5 text-amber-600" />
          Saisir un arriéré
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Saisissez manuellement un arriéré pour un élève (issu des registres papier).
          Sélectionnez d'abord le niveau scolaire, puis la classe, puis l'élève.
        </p>
        <div className="space-y-4">
          {/* Ligne 1 : Niveau scolaire + Classe (côte à côte) */}
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PHASE 2 — Vue Promesses de paiement                                */
/* ------------------------------------------------------------------ */

const PROMISE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  PENDING: { label: 'En attente', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock },
  HONORED: { label: 'Honorée', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 },
  BROKEN: { label: 'Rompu', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: XCircle },
};

function PromisesTab({
  promises,
  totalCount,
  statusFilter,
  setStatusFilter,
  onUpdateStatus,
  onNewPromise,
  arrears,
}: {
  promises: any[];
  totalCount: number;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  onUpdateStatus: (id: string, status: 'HONORED' | 'BROKEN') => void;
  onNewPromise: (arrear: any) => void;
  arrears: any[];
}) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedArrear, setSelectedArrear] = useState<any | null>(null);

  return (
    <div className="space-y-4">
      {/* Filtres + bouton nouvelle promesse */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Statut</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              <SelectItem value="PENDING">En attente</SelectItem>
              <SelectItem value="HONORED">Honorée</SelectItem>
              <SelectItem value="BROKEN">Rompu</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-slate-500 ml-auto">
          {promises.length} affiché(s) sur {totalCount} total
        </div>
        <Button
          size="sm"
          onClick={() => setShowNewModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle promesse
        </Button>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Élève</TableHead>
              <TableHead>Frais</TableHead>
              <TableHead className="text-right">Montant promis</TableHead>
              <TableHead>Date promise</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Créé par</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promises.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-12">
                  Aucune promesse de paiement enregistrée.
                </TableCell>
              </TableRow>
            ) : (
              promises.map((p) => {
                const config = PROMISE_STATUS_CONFIG[p.status || 'PENDING'] || PROMISE_STATUS_CONFIG.PENDING;
                const StatusIcon = config.icon;
                const isOverdue = p.status === 'PENDING' && new Date(p.promisedDate) < new Date();
                return (
                  <TableRow key={p.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">
                      {p.feeArrear?.student
                        ? `${p.feeArrear.student.lastName} ${p.feeArrear.student.firstName}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {p.feeArrear?.studentFee?.feeDefinition?.label || '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-emerald-700">
                      {formatCurrency(p.promisedAmount)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className={isOverdue ? 'text-rose-600 font-semibold' : 'text-slate-700'}>
                        {new Date(p.promisedDate).toLocaleDateString('fr-FR')}
                      </span>
                      {isOverdue && (
                        <Badge variant="outline" className="ml-2 text-[10px] text-rose-700 border-rose-300 bg-rose-50">
                          En retard
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${config.color} ${config.bg} ${config.border} border`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {p.creator ? `${p.creator.firstName} ${p.creator.lastName}` : 'Système'}
                    </TableCell>
                    <TableCell className="text-center">
                      {p.status === 'PENDING' && (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => onUpdateStatus(p.id, 'HONORED')}
                            className="p-1.5 hover:bg-emerald-100 rounded text-emerald-700"
                            title="Marquer honorée"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onUpdateStatus(p.id, 'BROKEN')}
                            className="p-1.5 hover:bg-rose-100 rounded text-rose-700"
                            title="Marquer rompu"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal sélection d'arrieré pour nouvelle promesse */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Sélectionner un arrieré</h3>
            <p className="text-xs text-slate-500 mb-3">Choisissez l'arriéré pour lequel créer une promesse de paiement.</p>
            {arrears.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4 text-center">Aucun arriéré disponible.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {arrears.slice(0, 50).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setSelectedArrear(a);
                      setShowNewModal(false);
                      onNewPromise(a);
                    }}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                  >
                    <p className="font-semibold text-sm">
                      {a.student ? `${a.student.lastName} ${a.student.firstName}` : '—'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {a.studentFee?.feeDefinition?.label || 'Frais'} · Solde : {formatCurrency(a.balanceDue)} FCFA
                    </p>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setShowNewModal(false)}>Annuler</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PHASE 2 — Vue Actions de recouvrement                              */
/* ------------------------------------------------------------------ */

const ACTION_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  CALL: { label: 'Appel téléphonique', icon: Phone, color: 'text-blue-600' },
  EMAIL: { label: 'Email', icon: Mail, color: 'text-indigo-600' },
  MEETING: { label: 'Réunion / Visite', icon: Users, color: 'text-purple-600' },
  LETTER: { label: 'Courrier / Mise en demeure', icon: FileText, color: 'text-rose-600' },
  SUSPENSION: { label: 'Suspension', icon: AlertTriangle, color: 'text-orange-600' },
  OTHER: { label: 'Autre', icon: AlertCircle, color: 'text-slate-600' },
  REMINDER: { label: 'Rappel automatique', icon: Zap, color: 'text-amber-600' },
  WARNING: { label: 'Avertissement', icon: AlertTriangle, color: 'text-amber-600' },
  BLOCK: { label: 'Blocage', icon: AlertCircle, color: 'text-rose-600' },
};

function ActionsTab({
  actions,
  totalCount,
  typeFilter,
  setTypeFilter,
  onNewAction,
  arrears,
}: {
  actions: any[];
  totalCount: number;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  onNewAction: (arrear: any) => void;
  arrears: any[];
}) {
  const [showNewModal, setShowNewModal] = useState(false);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Type d'action</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les types</SelectItem>
              {Object.entries(ACTION_TYPE_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-slate-500 ml-auto">
          {actions.length} affiché(s) sur {totalCount} total
        </div>
        <Button
          size="sm"
          onClick={() => setShowNewModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle action
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Date</TableHead>
              <TableHead>Élève</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Effectué par</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500 py-12">
                  Aucune action de recouvrement enregistrée.
                </TableCell>
              </TableRow>
            ) : (
              actions.map((a) => {
                const cfg = ACTION_TYPE_CONFIG[a.actionType] || ACTION_TYPE_CONFIG.OTHER;
                const Icon = cfg.icon;
                return (
                  <TableRow key={a.id} className="hover:bg-slate-50">
                    <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                      {new Date(a.performedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      <span className="text-xs text-slate-400 ml-1">
                        {new Date(a.performedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {a.feeArrear?.student
                        ? `${a.feeArrear.student.lastName} ${a.feeArrear.student.firstName}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${cfg.color} border-current`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 max-w-md">
                      {a.notes || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {a.performer ? `${a.performer.firstName} ${a.performer.lastName}` : 'Système'}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Sélectionner un arrieré</h3>
            <p className="text-xs text-slate-500 mb-3">Choisissez l'arriéré pour lequel journaliser une action.</p>
            {arrears.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4 text-center">Aucun arriéré disponible.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {arrears.slice(0, 50).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setShowNewModal(false);
                      onNewAction(a);
                    }}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                  >
                    <p className="font-semibold text-sm">
                      {a.student ? `${a.student.lastName} ${a.student.firstName}` : '—'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {a.studentFee?.feeDefinition?.label || 'Frais'} · Solde : {formatCurrency(a.balanceDue)} FCFA
                    </p>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setShowNewModal(false)}>Annuler</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PHASE 2 — Vue Dossiers (cas consolidés par élève)                  */
/* ------------------------------------------------------------------ */

const CASE_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ON_TIME: { label: 'À jour', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  LATE: { label: 'En retard', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  CRITICAL: { label: 'Critique', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  BLOCKED: { label: 'Bloqué', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
};

const ESCALATION_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Aucune', color: 'text-slate-500' },
  1: { label: 'Niveau 1 — Rappel', color: 'text-blue-600' },
  2: { label: 'Niveau 2 — SMS + WhatsApp', color: 'text-amber-600' },
  3: { label: 'Niveau 3 — Direction', color: 'text-orange-600' },
  4: { label: 'Niveau 4 — Blocage', color: 'text-rose-600' },
};

function CasesTab({
  cases,
  onViewCase,
}: {
  cases: any[];
  onViewCase: (c: any) => void;
}) {
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [filterSchoolLevelId, setFilterSchoolLevelId] = useState<string>('ALL');
  const [filterClassId, setFilterClassId] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/school-levels', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setSchoolLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setSchoolLevels([]));
    fetch('/api/all-classes', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setClasses(Array.isArray(d) ? d : (d?.data ?? [])))
      .catch(() => setClasses([]));
  }, []);

  const filteredClasses = useMemo(() => {
    if (filterSchoolLevelId === 'ALL') return classes;
    const selectedLevel = schoolLevels.find((l) => l.id === filterSchoolLevelId);
    const slId = selectedLevel?.schoolLevelId || filterSchoolLevelId;
    return classes.filter((c: any) =>
      c.schoolLevelId === slId || c.schoolLevel?.code === selectedLevel?.code || c.schoolLevel?.id === slId
    );
  }, [classes, filterSchoolLevelId, schoolLevels]);

  const filteredCases = useMemo(() => {
    let result = cases;
    if (filterSchoolLevelId !== 'ALL') {
      result = result.filter((c) => c.student?.schoolLevelId === filterSchoolLevelId);
    }
    if (filterClassId !== 'ALL') {
      result = result.filter((c) => {
        const enrollment = c.student?.studentEnrollments?.[0];
        return enrollment?.classId === filterClassId;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((c) => {
        const name = `${c.student?.lastName || ''} ${c.student?.firstName || ''}`.toLowerCase();
        return name.includes(q);
      });
    }
    return result;
  }, [cases, filterSchoolLevelId, filterClassId, search]);

  // Export Excel
  const handleExportExcel = async () => {
    const ExcelJS = (window as any).ExcelJS;
    if (!ExcelJS) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
      script.onload = () => doExportExcel();
      document.head.appendChild(script);
    } else {
      doExportExcel();
    }
  };
  const doExportExcel = async () => {
    const ExcelJS = (window as any).ExcelJS;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Dossiers');
    const headers = ['Élève', 'Total dû', 'Payé', 'Reste à payer', 'Statut', 'Niveau escalade', 'Dernière action'];
    headers.forEach((h, i) => {
      const cell = ws.getCell(1, i + 1);
      cell.value = h; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    });
    filteredCases.forEach((c, i) => {
      ws.getCell(i + 2, 1).value = c.student ? `${c.student.lastName} ${c.student.firstName}` : '—';
      ws.getCell(i + 2, 2).value = Number(c.totalDue) || 0;
      ws.getCell(i + 2, 3).value = Number(c.totalPaid) || 0;
      ws.getCell(i + 2, 4).value = Number(c.outstandingAmount) || 0;
      ws.getCell(i + 2, 5).value = c.status || '—';
      ws.getCell(i + 2, 6).value = c.escalationLevel || 0;
      ws.getCell(i + 2, 7).value = c.lastActionAt ? new Date(c.lastActionAt).toLocaleDateString('fr-FR') : '—';
    });
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dossiers_recouvrement_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Niveau scolaire</Label>
            <Select value={filterSchoolLevelId} onValueChange={(v) => { setFilterSchoolLevelId(v); setFilterClassId('ALL'); }}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous les niveaux</SelectItem>
                {schoolLevels.map((l) => (<SelectItem key={l.id} value={l.id}>{l.label || l.code || l.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Classe</Label>
            <Select value={filterClassId} onValueChange={setFilterClassId}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les classes</SelectItem>
                {filteredClasses.map((c: any) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Rechercher</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom ou prénom..." className="pl-9" />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="border-emerald-300 text-emerald-700 hover:bg-emerald-100">
            <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Excel
          </Button>
        </div>
        <div className="text-xs text-slate-500 mt-2">{filteredCases.length} affiché(s) sur {cases.length} total</div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Élève</TableHead>
              <TableHead className="text-right">Total dû</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead className="text-right">Reste à payer</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Niveau escalade</TableHead>
              <TableHead>Dernière action</TableHead>
              <TableHead className="text-center">Détails</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-12">
                  Aucun dossier de recouvrement. Lancez la détection des arriérés puis synchronisez les dossiers.
                </TableCell>
              </TableRow>
            ) : (
              filteredCases.map((c) => {
                const config = CASE_STATUS_CONFIG[c.status] || CASE_STATUS_CONFIG.ON_TIME;
                const escalation = ESCALATION_LABELS[c.escalationLevel || 0] || ESCALATION_LABELS[0];
                return (
                  <TableRow key={c.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">
                      {c.student ? `${c.student.lastName} ${c.student.firstName}` : c.studentId}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatCurrency(c.totalDue)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-emerald-700">{formatCurrency(c.totalPaid)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-bold text-rose-700">{formatCurrency(c.outstandingAmount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${config.color} ${config.bg} ${config.border} border`}>{config.label}</Badge>
                    </TableCell>
                    <TableCell><span className={`text-xs font-semibold ${escalation.color}`}>{escalation.label}</span></TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {c.lastActionAt ? new Date(c.lastActionAt).toLocaleDateString('fr-FR') : '—'}
                      {c.blockedUntil && (<span className="block text-[10px] text-rose-600">Bloqué jusqu'au {new Date(c.blockedUntil).toLocaleDateString('fr-FR')}</span>)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewCase(c)} title="Voir le dossier">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal — Nouvelle promesse de paiement                              */
/* ------------------------------------------------------------------ */

function PromiseModal({
  data,
  onClose,
  onSubmit,
}: {
  data: { arrearId: string; studentName: string; balanceDue: number };
  onClose: () => void;
  onSubmit: (data: { arrearId: string; promisedAmount: number; promiseDate: string; notes?: string }) => void;
}) {
  const [amount, setAmount] = useState(String(data.balanceDue || ''));
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return;
    if (!date) return;
    onSubmit({ arrearId: data.arrearId, promisedAmount: amt, promiseDate: date, notes: notes.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-600" />
          Nouvelle promesse de paiement
        </h3>
        <p className="text-xs text-slate-500 mb-4">Élève : <strong>{data.studentName}</strong> · Solde dû : {formatCurrency(data.balanceDue)} FCFA</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Montant promis (FCFA)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              max={data.balanceDue}
              min={1}
              required
            />
            <p className="text-[10px] text-slate-500 mt-1">Ne peut pas dépasser le solde dû ({formatCurrency(data.balanceDue)} FCFA).</p>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Date promise</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Notes (optionnel)</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500"
              rows={2}
              placeholder="Conditions, modalités..."
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">Enregistrer</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal — Nouvelle action de recouvrement                            */
/* ------------------------------------------------------------------ */

function ActionModal({
  data,
  onClose,
  onSubmit,
}: {
  data: { arrearId: string; studentName: string };
  onClose: () => void;
  onSubmit: (data: { arrearId: string; actionType: string; description?: string }) => void;
}) {
  const [actionType, setActionType] = useState('CALL');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ arrearId: data.arrearId, actionType, description: description.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Phone className="w-5 h-5 text-indigo-600" />
          Journaliser une action
        </h3>
        <p className="text-xs text-slate-500 mb-4">Élève : <strong>{data.studentName}</strong></p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Type d'action</Label>
            <Select value={actionType} onValueChange={setActionType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ACTION_TYPE_CONFIG).filter(([k]) => !['REMINDER', 'WARNING', 'BLOCK'].includes(k)).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Description / Notes</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="Ex : Appel passé au père, promet de payer vendredi. Ou : Visite à domicile, parent absent..."
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">Journaliser</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal — Détail d'un dossier                                        */
/* ------------------------------------------------------------------ */

function CaseDetailModal({ caseData, onClose }: { caseData: any; onClose: () => void }) {
  const config = CASE_STATUS_CONFIG[caseData.status] || CASE_STATUS_CONFIG.ON_TIME;
  const escalation = ESCALATION_LABELS[caseData.escalationLevel || 0] || ESCALATION_LABELS[0];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Dossier de recouvrement
            </h3>
            <p className="text-sm text-slate-500">
              {caseData.student ? `${caseData.student.lastName} ${caseData.student.firstName}` : 'Élève'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <XCircle className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Statut + escalade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Statut</p>
              <Badge variant="outline" className={`${config.color} ${config.bg} ${config.border} border`}>
                {config.label}
              </Badge>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Niveau d'escalade</p>
              <p className={`text-sm font-semibold ${escalation.color}`}>{escalation.label}</p>
            </div>
          </div>

          {/* Montants */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Total dû</p>
                <p className="text-base font-bold text-slate-900">{formatCurrency(caseData.totalDue)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Payé</p>
                <p className="text-base font-bold text-emerald-700">{formatCurrency(caseData.totalPaid)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Reste</p>
                <p className="text-base font-bold text-rose-700">{formatCurrency(caseData.outstandingAmount)}</p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Dernière action</p>
              <p className="text-slate-700">
                {caseData.lastActionAt ? new Date(caseData.lastActionAt).toLocaleDateString('fr-FR') : '—'}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Bloqué jusqu'au</p>
              <p className="text-slate-700">
                {caseData.blockedUntil ? new Date(caseData.blockedUntil).toLocaleDateString('fr-FR') : '—'}
              </p>
            </div>
          </div>

          {/* Workflow d'escalade — explication */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              Workflow d'escalade automatique
            </p>
            <ul className="text-[11px] text-amber-800 space-y-1">
              <li><strong>Niveau 1</strong> — Rappel interne (notification système)</li>
              <li><strong>Niveau 2</strong> — SMS + WhatsApp (rappel ferme)</li>
              <li><strong>Niveau 3</strong> — Notification direction (critique)</li>
              <li><strong>Niveau 4</strong> — Blocage administratif</li>
            </ul>
            <p className="text-[10px] text-amber-700 mt-2">
              Cliquez sur « Lancer escalade auto » en haut pour déclencher le workflow sur tous les cas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
