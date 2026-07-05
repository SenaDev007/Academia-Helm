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

type TabId = 'dashboard' | 'arrears' | 'reminders' | 'promises' | 'actions' | 'cases';

const TABS: Array<{ id: TabId; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Dashboard', icon: TrendingDown },
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
  WARNING: { label: 'Warning', variant: 'secondary' },
  URGENT: { label: 'Urgent', variant: 'default' },
  FINAL_NOTICE: { label: 'Final', variant: 'destructive' },
};

export default function RecoveryContent() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);

  // Données
  const [arrears, setArrears] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);

  // Filtres arriérés
  const [arrearLevelFilter, setArrearLevelFilter] = useState<string>('ALL');
  const [arrearSearch, setArrearSearch] = useState('');

  // Modal relance manuelle (système OLD)
  const [manualModal, setManualModal] = useState(false);
  const [manualAccountId, setManualAccountId] = useState('');
  const [manualLevel, setManualLevel] = useState('WARNING');

  const loadAll = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const [arrearsData, remindersData, statsData] = await Promise.all([
        financeService.getArrears({ academicYearId: academicYear.id }).catch(() => []),
        financeService.getRecoveryReminders({ academicYearId: academicYear.id }).catch(() => []),
        financeService.getCollectionStatistics(academicYear.id).catch(() => null),
      ]);
      setArrears(Array.isArray(arrearsData) ? arrearsData : []);
      setReminders(Array.isArray(remindersData) ? remindersData : []);
      setStatistics(statsData);
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
    try {
      await financeService.sendManualReminder({
        studentAccountId: manualAccountId,
        level: manualLevel,
        channel: 'SMS',
      });
      setManualModal(false);
      toast({ title: '✅ Rappel envoyé', description: 'La relance a été envoyée avec succès.' });
      loadAll();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error?.message || 'Erreur réseau',
        variant: 'destructive',
      });
    }
  };

  // Filtrage des arriérés
  const filteredArrears = useMemo(() => {
    let result = arrears;
    if (arrearLevelFilter !== 'ALL') {
      result = result.filter((a) => a.arrearsLevel === arrearLevelFilter);
    }
    if (arrearSearch.trim()) {
      const q = arrearSearch.toLowerCase().trim();
      result = result.filter((a) => {
        const name = `${a.student?.lastName || ''} ${a.student?.firstName || ''}`.toLowerCase();
        return name.includes(q);
      });
    }
    return result;
  }, [arrears, arrearLevelFilter, arrearSearch]);

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
            <div className="flex gap-2">
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
          />
        ) : activeTab === 'reminders' ? (
          <RemindersTab reminders={reminders} />
        ) : activeTab === 'promises' ? (
          <PlaceholderTab
            icon={Target}
            title="Promesses de paiement"
            description="Suivi des promesses de paiement (montant + date promise + statut PENDING/HONORED/BROKEN). Cette vue sera implémentée dans la phase 2."
          />
        ) : activeTab === 'actions' ? (
          <PlaceholderTab
            icon={Phone}
            title="Actions de recouvrement"
            description="Historique des actions (appels, emails, visites, courriers). Cette vue sera implémentée dans la phase 2."
          />
        ) : (
          <PlaceholderTab
            icon={FileText}
            title="Dossiers de recouvrement"
            description="Dossiers consolidés par élève avec timeline complète. Cette vue sera implémentée dans la phase 2."
          />
        )}
      </ModuleContentArea>

      {/* Modal relance manuelle (système OLD) */}
      {manualModal && (
        <ManualReminderModal
          onClose={() => setManualModal(false)}
          onSubmit={handleSendManual}
          academicYearId={academicYear?.id ?? ''}
          accountId={manualAccountId}
          setAccountId={setManualAccountId}
          level={manualLevel}
          setLevel={setManualLevel}
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
  const totalCollected = Number(stats.totalCollected ?? 0);
  const totalDue = Number(stats.totalDue ?? kpis.totalArrears);
  const recoveryRate = totalDue > 0 ? (totalCollected / (totalCollected + totalDue)) * 100 : 0;

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
}: {
  arrears: any[];
  totalCount: number;
  levelFilter: string;
  setLevelFilter: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Niveau</Label>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les niveaux</SelectItem>
              <SelectItem value="LOW">Faible</SelectItem>
              <SelectItem value="MEDIUM">Moyen</SelectItem>
              <SelectItem value="HIGH">Élevé</SelectItem>
              <SelectItem value="CRITICAL">Critique</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Rechercher un élève</Label>
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
        <div className="text-xs text-slate-500 ml-auto">
          {arrears.length} affiché(s) sur {totalCount} total
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Élève</TableHead>
              <TableHead>Frais</TableHead>
              <TableHead className="text-right">Total dû</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead className="text-right">Solde</TableHead>
              <TableHead>Niveau</TableHead>
              <TableHead>Dernier paiement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {arrears.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-12">
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
                      {a.studentFee?.feeDefinition?.label || '—'}
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

function RemindersTab({ reminders }: { reminders: any[] }) {
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {reminders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-500 py-12">
                Aucune relance envoyée pour cette année.
              </TableCell>
            </TableRow>
          ) : (
            reminders.map((r) => {
              const config = REMINDER_LEVEL_CONFIG[r.reminderLevel] || { label: r.reminderLevel, variant: 'secondary' };
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
/*  Placeholder pour onglets phase 2                                   */
/* ------------------------------------------------------------------ */

function PlaceholderTab({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="font-bold text-slate-900 text-lg mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">{description}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
        <Clock className="w-3 h-3" />
        Phase 2 — à implémenter
      </div>
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
}: {
  onClose: () => void;
  onSubmit: () => void;
  academicYearId: string;
  accountId: string;
  setAccountId: (v: string) => void;
  level: string;
  setLevel: (v: string) => void;
}) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!academicYearId) return;
    financeService
      .getStudentAccounts({ academicYearId })
      .then((d) => setAccounts(Array.isArray(d) ? d.filter((a) => Number(a.balance) > 0) : []))
      .catch(() => setAccounts([]));
  }, [academicYearId]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-blue-600" />
          Relance manuelle
        </h3>
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
              Compte élève
            </Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un élève avec solde dû" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.student ? `${a.student.lastName} ${a.student.firstName}` : a.id} — {formatCurrency(a.balance)} FCFA
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {accounts.length === 0 && (
              <p className="text-xs text-slate-500 mt-1">Aucun élève avec solde dû pour cette année.</p>
            )}
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
              Niveau de relance
            </Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WARNING">Warning (J+3)</SelectItem>
                <SelectItem value="URGENT">Urgent (J+7)</SelectItem>
                <SelectItem value="FINAL_NOTICE">Final (J+15)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={onSubmit} disabled={!accountId}>Envoyer la relance</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
