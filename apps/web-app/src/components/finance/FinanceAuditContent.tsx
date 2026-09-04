/**
 * ============================================================================
 * ACADEMIA HELM - FINANCE AUDIT CONTENT
 * ============================================================================
 *
 * Refonte complète selon spec Academia Helm (Contrôle & Audit financier).
 * 5 sous-onglets :
 *
 *   1. Tableau de bord       — KPIs synthétiques + alertes ORION consolidées
 *   2. Anomalies             — liste des anomalies détectées (filtrable résolu/non)
 *   3. Transactions susp.    — annulations, transactions nocturnes, montants élevés
 *   4. Écarts caisse         — comparaison solde théorique vs solde déclaré
 *   5. Historique audit      — log des actions financières
 *
 * + une section dédiée Top comptables actifs.
 *
 * Export PDF + Excel selon le pattern Encaissements (drawOfficialHeader avec
 * logo école + drapeau Bénin, formatAmount avec espace, "Francs CFA" complet).
 *
 * Layout : ModuleHeader + SubModuleNavigation gérés par app/finance/layout.tsx.
 * ============================================================================
 */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck, AlertTriangle, FileText, FileSpreadsheet, Loader2, Download,
  TrendingUp, TrendingDown, Wallet, BarChart3, Clock, Users, Eye, Activity,
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAppSession } from '@/contexts/AppSessionContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';
import { exportAuditReportToPdf, exportAuditReportToExcel } from '@/lib/exports/reports-exports';
import DocumentPreviewModal from '@/components/students/DocumentPreviewModal';

type SubTab = 'dashboard' | 'anomalies' | 'suspicious' | 'ecarts' | 'audit';

const SUB_TABS: { id: SubTab; label: string; icon: any }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: Activity },
  { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
  { id: 'suspicious', label: 'Transactions suspectes', icon: Eye },
  { id: 'ecarts', label: 'Écarts caisse', icon: Wallet },
  { id: 'audit', label: 'Historique audit', icon: ShieldCheck },
];

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  WIRE: 'Virement',
  FEDAPAY: 'Fedapay',
  FEDAPAY: 'FedaPay',
  BANK: 'Banque',
  CHECK: 'Chèque',
};

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  MULTIPLE_CANCELLATION: 'Annulations multiples',
  ABNORMAL_TIME_TRANSACTION: 'Transaction à heure anormale',
  CASH_MISMATCH: 'Écart de caisse',
  FREQUENT_ADJUSTMENT: 'Ajustements fréquents',
  SUSPICIOUS_PARTIAL_PAYMENT: 'Paiement partiel suspect',
  MANUAL_OVERRIDE_EXCESS: 'Excès de modifications manuelles',
};

const ANOMALY_SEVERITY_LABELS: Record<string, string> = {
  HIGH: 'Élevée', MEDIUM: 'Moyenne', LOW: 'Faible', CRITICAL: 'Critique',
};

const ANOMALY_SEVERITY_BADGE: Record<string, 'destructive' | 'outline' | 'default'> = {
  HIGH: 'destructive', CRITICAL: 'destructive', MEDIUM: 'default', LOW: 'outline',
};

export default function FinanceAuditContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { tenant } = useAppSession();
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [previewDoc, setPreviewDoc] = useState<{ filePath: string; fileName: string; mimeType: string } | null>(null);

  // Données
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [suspicious, setSuspicious] = useState<any>(null);
  const [cashMismatches, setCashMismatches] = useState<any[]>([]);
  const [missedClosures, setMissedClosures] = useState<any>(null);
  const [topAccountants, setTopAccountants] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

  // Filtres
  const [anomalyFilter, setAnomalyFilter] = useState<'all' | 'resolved' | 'unresolved'>('all');
  const [logFilter, setLogFilter] = useState('');

  // ─── Chargement anomalies ───
  const loadAnomalies = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const data = await financeService.getAnomalies(100);
      setAnomalies(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Anomalies error:', e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  // ─── Chargement suspicious ───
  const loadSuspicious = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const data = await financeService.getSuspiciousTransactions(academicYear.id, { days: 30, minAmount: 100000 });
      setSuspicious(data);
    } catch (e: any) {
      console.error('Suspicious error:', e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  // ─── Chargement écarts caisse ───
  const loadCashMismatches = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const data = await financeService.getCashMismatches(academicYear.id);
      setCashMismatches(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Cash mismatches error:', e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  // ─── Chargement clôtures manquées + top comptables ───
  const loadDashboardData = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const [mc, ta, al] = await Promise.all([
        financeService.getMissedClosures(academicYear.id, 30).catch(() => ({ missed: [], stats: { totalExpected: 0, totalMissed: 0, totalDone: 0, missRate: 0 } })),
        financeService.getTopAccountants(academicYear.id, 30).catch(() => []),
        financeService.getAuditLogs(50).catch(() => []),
      ]);
      setMissedClosures(mc);
      setTopAccountants(Array.isArray(ta) ? ta : []);
      setAuditLogs(Array.isArray(al) ? al : []);
    } catch (e: any) {
      console.error('Dashboard error:', e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  // ─── Chargement audit logs ───
  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await financeService.getAuditLogs(200);
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Audit logs error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Chargement initial + sur changement sous-onglet ───
  useEffect(() => {
    if (!academicYear?.id) return;
    if (subTab === 'dashboard') loadDashboardData();
    else if (subTab === 'anomalies') loadAnomalies();
    else if (subTab === 'suspicious') loadSuspicious();
    else if (subTab === 'ecarts') loadCashMismatches();
    else if (subTab === 'audit') loadAuditLogs();
  }, [subTab, academicYear?.id]);

  // ─── Infos école pour les exports ───
  const schoolInfo = useMemo(() => ({
    schoolName: tenant?.name || 'Établissement',
    schoolLogoUrl: tenant?.id ? `/api/tenants/${tenant.id}/logo` : null,
    academicYear: academicYear?.name || academicYear?.label || '',
    schoolLevel: schoolLevel?.code || undefined,
    schoolAddress: tenant?.address || null,
    schoolPhone: tenant?.phone || null,
    schoolEmail: tenant?.email || null,
    schoolSlogan: (tenant as any)?.slogan || null,
  }), [tenant, academicYear, schoolLevel]);

  // ─── Handlers export ───
  const handleExportPdf = async () => {
    if (!academicYear?.id) return;
    setExporting('pdf');
    try {
      // S'assurer qu'on a toutes les données
      const [anomData, suspData, mmData, taData, alData] = await Promise.all([
        anomalies.length ? anomalies : financeService.getAnomalies(100).catch(() => []),
        suspicious || financeService.getSuspiciousTransactions(academicYear.id, { days: 30, minAmount: 100000 }).catch(() => null),
        cashMismatches.length ? cashMismatches : financeService.getCashMismatches(academicYear.id).catch(() => []),
        topAccountants.length ? topAccountants : financeService.getTopAccountants(academicYear.id, 30).catch(() => []),
        auditLogs.length ? auditLogs : financeService.getAuditLogs(50).catch(() => []),
      ]);
      const mc = missedClosures || await financeService.getMissedClosures(academicYear.id, 30).catch(() => ({ missed: [], stats: { totalExpected: 0, totalMissed: 0, totalDone: 0, missRate: 0 } }));

      const auditData = {
        anomalies: Array.isArray(anomData) ? anomData : [],
        suspicious: suspData || { reversals: [], nocturnal: [], highValue: [], stats: { reversalCount: 0, reversalTotal: 0, nocturnalCount: 0, highValueCount: 0, highValueTotal: 0 } },
        cashMismatches: Array.isArray(mmData) ? mmData : [],
        missedClosures: mc || { missed: [], stats: { totalExpected: 0, totalMissed: 0, totalDone: 0, missRate: 0 } },
        topAccountants: Array.isArray(taData) ? taData : [],
        auditLogs: Array.isArray(alData) ? alData : [],
      };

      const { url } = await exportAuditReportToPdf(auditData, schoolInfo);
      setPreviewDoc({
        filePath: url,
        fileName: `audit-financier-${new Date().toISOString().slice(0, 10)}.pdf`,
        mimeType: 'application/pdf',
      });
      toast({ title: '✅ Export PDF généré', description: 'Le rapport d\'audit est prêt.' });
    } catch (e: any) {
      toast({ title: 'Erreur export PDF', description: e?.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    if (!academicYear?.id) return;
    setExporting('excel');
    try {
      const [anomData, suspData, mmData, taData, alData] = await Promise.all([
        anomalies.length ? anomalies : financeService.getAnomalies(100).catch(() => []),
        suspicious || financeService.getSuspiciousTransactions(academicYear.id, { days: 30, minAmount: 100000 }).catch(() => null),
        cashMismatches.length ? cashMismatches : financeService.getCashMismatches(academicYear.id).catch(() => []),
        topAccountants.length ? topAccountants : financeService.getTopAccountants(academicYear.id, 30).catch(() => []),
        auditLogs.length ? auditLogs : financeService.getAuditLogs(50).catch(() => []),
      ]);
      const mc = missedClosures || await financeService.getMissedClosures(academicYear.id, 30).catch(() => ({ missed: [], stats: { totalExpected: 0, totalMissed: 0, totalDone: 0, missRate: 0 } }));

      const auditData = {
        anomalies: Array.isArray(anomData) ? anomData : [],
        suspicious: suspData || { reversals: [], nocturnal: [], highValue: [], stats: { reversalCount: 0, reversalTotal: 0, nocturnalCount: 0, highValueCount: 0, highValueTotal: 0 } },
        cashMismatches: Array.isArray(mmData) ? mmData : [],
        missedClosures: mc || { missed: [], stats: { totalExpected: 0, totalMissed: 0, totalDone: 0, missRate: 0 } },
        topAccountants: Array.isArray(taData) ? taData : [],
        auditLogs: Array.isArray(alData) ? alData : [],
      };

      await exportAuditReportToExcel(auditData, schoolInfo);
      toast({ title: '✅ Export Excel généré', description: 'Le fichier a été téléchargé.' });
    } catch (e: any) {
      toast({ title: 'Erreur export Excel', description: e?.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  // ─── Filtres anomalies ───
  const filteredAnomalies = useMemo(() => {
    if (anomalyFilter === 'resolved') return anomalies.filter((a) => a.resolved);
    if (anomalyFilter === 'unresolved') return anomalies.filter((a) => !a.resolved);
    return anomalies;
  }, [anomalies, anomalyFilter]);

  // ─── Filtre audit logs ───
  const filteredAuditLogs = useMemo(() => {
    if (!logFilter) return auditLogs;
    const q = logFilter.toLowerCase();
    return auditLogs.filter((l) =>
      (l.entityType || '').toLowerCase().includes(q) ||
      (l.action || '').toLowerCase().includes(q) ||
      (l.performer && `${l.performer.lastName} ${l.performer.firstName}`.toLowerCase().includes(q))
    );
  }, [auditLogs, logFilter]);

  // ─── Sous-onglets ───
  const renderSubTabs = () => (
    <div className="flex items-center gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
      {SUB_TABS.map((t) => {
        const Icon = t.icon;
        const isActive = subTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              isActive
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {t.label}
          </button>
        );
      })}
    </div>
  );

  // ─── KPI Card ───
  const KpiCard = ({ title, value, icon: Icon, color, sub, alert }: any) => {
    const colorMap: any = {
      blue: 'bg-blue-50 text-blue-600 border-blue-100',
      emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      rose: 'bg-rose-50 text-rose-600 border-rose-100',
      amber: 'bg-amber-50 text-amber-600 border-amber-100',
      slate: 'bg-slate-50 text-slate-700 border-slate-200',
    };
    return (
      <div className={`bg-white p-5 rounded-2xl border ${alert ? 'border-rose-300 shadow-rose-100 shadow-sm' : 'border-slate-200 shadow-sm'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-xl border ${colorMap[color] || colorMap.slate}`}>
            <Icon className="w-5 h-5" />
          </div>
          {alert && <Badge variant="destructive" className="text-xs">Alerte</Badge>}
        </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-lg font-black text-slate-900 tracking-tight">{value}</h3>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    );
  };

  // ─── 1. Tableau de bord ───
  const renderDashboard = () => {
    const sus = suspicious?.stats || { reversalCount: 0, reversalTotal: 0, nocturnalCount: 0, highValueCount: 0, highValueTotal: 0 };
    const unresolvedCount = anomalies.filter((a) => !a.resolved).length;
    const mismatchCritical = cashMismatches.filter((m) => Math.abs(Number(m.ecart) || 0) > 1000).length;
    const closureMissRate = missedClosures?.stats?.missRate || 0;
    return (
      <div className="space-y-5">
        {/* Bannière ORION */}
        <div className="rounded-xl border bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 p-5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <ShieldCheck className="w-6 h-6 text-amber-700" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-amber-900">ORION — Audit financier</h3>
              <p className="text-sm text-amber-800 mt-1">
                Synthèse des alertes des 30 derniers jours. Les indicateurs ci-dessous sont calculés
                automatiquement à partir des transactions, clôtures et écarts caisse.
              </p>
            </div>
          </div>
        </div>

        {/* KPIs principaux */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Anomalies non résolues"
            value={unresolvedCount}
            icon={AlertTriangle}
            color={unresolvedCount > 0 ? 'rose' : 'emerald'}
            sub={`sur ${anomalies.length} total`}
            alert={unresolvedCount > 0}
          />
          <KpiCard
            title="Annulations (30j)"
            value={sus.reversalCount}
            icon={TrendingDown}
            color={sus.reversalCount > 5 ? 'rose' : 'amber'}
            sub={`${formatCurrency(sus.reversalTotal)} FCFA`}
          />
          <KpiCard
            title="Écarts caisse critiques"
            value={mismatchCritical}
            icon={Wallet}
            color={mismatchCritical > 0 ? 'rose' : 'emerald'}
            sub={mismatchCritical > 0 ? 'vérification requise' : 'aucun écart > 1000 FCFA'}
            alert={mismatchCritical > 0}
          />
          <KpiCard
            title="Taux clôtures manquées"
            value={`${closureMissRate}%`}
            icon={Clock}
            color={closureMissRate > 20 ? 'rose' : (closureMissRate > 5 ? 'amber' : 'emerald')}
            sub={`${missedClosures?.stats?.totalMissed || 0} manquantes`}
            alert={closureMissRate > 20}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Transactions suspectes */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Eye className="w-4 h-4 text-rose-500" />
                Transactions suspectes (30j)
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              <SuspRow label="Annulations" value={sus.reversalCount} detail={`${formatCurrency(sus.reversalTotal)} FCFA`} alert={sus.reversalCount > 5} />
              <SuspRow label="Transactions nocturnes" value={sus.nocturnalCount} detail="entre 21h et 6h" alert={sus.nocturnalCount > 3} />
              <SuspRow label="Montants élevés (≥100k FCFA)" value={sus.highValueCount} detail={`${formatCurrency(sus.highValueTotal)} FCFA`} />
            </div>
          </div>

          {/* Top comptables actifs */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                Top 5 comptables actifs (30j)
              </h3>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Comptable</TableHead>
                  <TableHead className="text-center">Tx</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!topAccountants || topAccountants.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-6">Aucune activité.</TableCell></TableRow>
                ) : (
                  topAccountants.slice(0, 5).map((a: any, i: number) => (
                    <TableRow key={i} className="hover:bg-slate-50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs flex items-center justify-center font-bold">
                            {i + 1}
                          </span>
                          <div>
                            <div>{`${a.lastName || ''} ${a.firstName || ''}`.trim() || '—'}</div>
                            <div className="text-xs text-slate-500">{a.role || '—'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{a.transactionCount || 0}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">{formatCurrency(a.paymentTotal)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </div>
        </div>

        {/* Clôtures manquées - résumé */}
        {missedClosures && missedClosures.missed && missedClosures.missed.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Clôtures manquées — 30 derniers jours
              </h3>
              <Badge variant={missedClosures.stats.missRate > 20 ? 'destructive' : 'outline'}>
                {missedClosures.stats.missRate}% du temps
              </Badge>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-3">
                {missedClosures.stats.totalMissed} clôture(s) manquées sur {missedClosures.stats.totalExpected} attendues.
                Les caisses suivantes n'ont pas été clôturées chaque jour ouvré :
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set(missedClosures.missed.map((m: any) => m.cashRegisterId))).map((regId: any) => {
                  const reg = missedClosures.missed.find((m: any) => m.cashRegisterId === regId);
                  const count = missedClosures.missed.filter((m: any) => m.cashRegisterId === regId).length;
                  return (
                    <Badge key={regId} variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                      {reg?.cashRegisterCode} — {reg?.cashRegisterName} : {count} jour(s)
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const SuspRow = ({ label, value, detail, alert }: any) => (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
      <Badge variant={alert ? 'destructive' : 'outline'} className={alert ? '' : 'bg-slate-50 text-slate-700'}>
        {value}
      </Badge>
    </div>
  );

  // ─── 2. Anomalies ───
  const renderAnomalies = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">Filtrer :</span>
        {(['all', 'unresolved', 'resolved'] as const).map((f) => (
          <Button
            key={f}
            variant={anomalyFilter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAnomalyFilter(f)}
          >
            {f === 'all' ? `Toutes (${anomalies.length})` : f === 'unresolved' ? `Non résolues (${anomalies.filter((a) => !a.resolved).length})` : `Résolues (${anomalies.filter((a) => a.resolved).length})`}
          </Button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Type</TableHead>
              <TableHead>Gravité</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead>Date détection</TableHead>
              <TableHead className="text-center">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">Chargement…</TableCell></TableRow>
            ) : filteredAnomalies.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">Aucune anomalie 🎉</TableCell></TableRow>
            ) : (
              filteredAnomalies.map((a) => (
                <TableRow key={a.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">
                    {ANOMALY_TYPE_LABELS[a.type] || a.type || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ANOMALY_SEVERITY_BADGE[a.severity] || 'outline'}>
                      {ANOMALY_SEVERITY_LABELS[a.severity] || a.severity || '—'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {a.referenceId ? String(a.referenceId).slice(0, 12) + '…' : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {a.detectedAt ? new Date(a.detectedAt).toLocaleString('fr-FR') : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={a.resolved ? 'default' : 'destructive'}>
                      {a.resolved ? 'Résolu' : 'Non résolu'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );

  // ─── 3. Transactions suspectes ───
  const renderSuspicious = () => {
    const rev = suspicious?.reversals || [];
    const noc = suspicious?.nocturnal || [];
    const hv = suspicious?.highValue || [];
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard title="Annulations" value={rev.length} icon={TrendingDown} color="rose" sub={formatCurrency(rev.reduce((s: number, r: any) => s + Number(r.amount), 0))} />
          <KpiCard title="Nocturnes (21h-6h)" value={noc.length} icon={Clock} color="amber" />
          <KpiCard title="Montants élevés" value={hv.length} icon={TrendingUp} color="blue" sub={formatCurrency(hv.reduce((s: number, r: any) => s + Number(r.amount), 0))} />
        </div>

        {/* Annulations */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-rose-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              Annulations récentes (30 jours)
            </h3>
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Date</TableHead>
                <TableHead>Reçu</TableHead>
                <TableHead>Élève</TableHead>
                <TableHead>Caissier</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Méthode</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!rev || rev.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">Aucune annulation.</TableCell></TableRow>
              ) : (
                rev.slice(0, 20).map((r: any) => {
                  const student = r.studentAccount?.student
                    ? `${r.studentAccount.student.lastName} ${r.studentAccount.student.firstName}`
                    : '—';
                  const cashier = r.cashier ? `${r.cashier.lastName} ${r.cashier.firstName}` : '—';
                  return (
                    <TableRow key={r.id} className="hover:bg-slate-50">
                      <TableCell className="text-xs text-slate-600">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.receiptNumber || '—'}</TableCell>
                      <TableCell className="font-medium">{student}</TableCell>
                      <TableCell className="text-slate-500">{cashier}</TableCell>
                      <TableCell className="text-right font-bold text-rose-700">-{formatCurrency(r.amount)}</TableCell>
                      <TableCell><Badge variant="outline">{METHOD_LABELS[r.paymentMethod] || r.paymentMethod || '—'}</Badge></TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
        </div>

        {/* Transactions nocturnes */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-amber-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Transactions nocturnes (21h - 6h)
            </h3>
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Date/heure</TableHead>
                <TableHead>Reçu</TableHead>
                <TableHead>Élève</TableHead>
                <TableHead>Caissier</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!noc || noc.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-6">Aucune transaction nocturne.</TableCell></TableRow>
              ) : (
                noc.slice(0, 20).map((r: any, i: number) => {
                  const student = `${r.studentLastName || ''} ${r.studentFirstName || ''}`.trim() || '—';
                  const cashier = `${r.cashierLastName || ''} ${r.cashierFirstName || ''}`.trim() || '—';
                  return (
                    <TableRow key={r.id || i} className="hover:bg-slate-50">
                      <TableCell className="text-xs text-slate-600">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.receiptNumber || '—'}</TableCell>
                      <TableCell className="font-medium">{student}</TableCell>
                      <TableCell className="text-slate-500">{cashier}</TableCell>
                      <TableCell className="text-right font-bold text-amber-700">{formatCurrency(r.amount)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
        </div>

        {/* Montants élevés */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-blue-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Transactions à montant élevé (≥ 100 000 FCFA)
            </h3>
          </div>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Date</TableHead>
                <TableHead>Reçu</TableHead>
                <TableHead>Élève</TableHead>
                <TableHead>Caissier</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!hv || hv.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-6">Aucune transaction élevée.</TableCell></TableRow>
              ) : (
                hv.slice(0, 20).map((r: any) => {
                  const student = r.studentAccount?.student
                    ? `${r.studentAccount.student.lastName} ${r.studentAccount.student.firstName}`
                    : '—';
                  const cashier = r.cashier ? `${r.cashier.lastName} ${r.cashier.firstName}` : '—';
                  return (
                    <TableRow key={r.id} className="hover:bg-slate-50">
                      <TableCell className="text-xs text-slate-600">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.receiptNumber || '—'}</TableCell>
                      <TableCell className="font-medium">{student}</TableCell>
                      <TableCell className="text-slate-500">{cashier}</TableCell>
                      <TableCell className="text-right font-bold text-blue-700">{formatCurrency(r.amount)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      </div>
    );
  };

  // ─── 4. Écarts caisse ───
  const renderEcarts = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-500" />
            Comparaison solde théorique vs solde déclaré
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Solde théorique = solde d'ouverture + Σ(paiements) - Σ(annulations).
            Un écart &gt; 1 000 FCFA est considéré comme critique.
          </p>
        </div>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Caisse</TableHead>
              <TableHead className="text-right">Solde théorique</TableHead>
              <TableHead className="text-right">Solde déclaré</TableHead>
              <TableHead className="text-right">Écart</TableHead>
              <TableHead className="text-center">État</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">Chargement…</TableCell></TableRow>
            ) : !cashMismatches || cashMismatches.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">Aucune caisse active.</TableCell></TableRow>
            ) : (
              cashMismatches.map((m) => {
                const ecart = Math.abs(Number(m.ecart) || 0);
                const isCritical = ecart > 1000;
                const isWarning = ecart > 100 && !isCritical;
                return (
                  <TableRow key={m.id} className={`hover:bg-slate-50 ${isCritical ? 'bg-rose-50' : (isWarning ? 'bg-amber-50' : '')}`}>
                    <TableCell className="font-medium">
                      <span className="font-mono text-xs text-slate-500 mr-1">{m.code}</span>
                      {m.name}
                    </TableCell>
                    <TableCell className="text-right text-slate-600">{formatCurrency(m.theoreticalBalance)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(m.currentBalance)}</TableCell>
                    <TableCell className={`text-right font-bold ${isCritical ? 'text-rose-700' : (isWarning ? 'text-amber-700' : 'text-emerald-700')}`}>
                      {formatCurrency(m.ecart)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={isCritical ? 'destructive' : (isWarning ? 'default' : 'outline')}>
                        {isCritical ? 'CRITIQUE' : (isWarning ? 'À vérifier' : 'OK')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );

  // ─── 5. Historique audit ───
  const renderAudit = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Rechercher (entité, action, utilisateur)…"
          value={logFilter}
          onChange={(e) => setLogFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 flex-1 max-w-md"
        />
        <span className="text-xs text-slate-500">{filteredAuditLogs.length} entrée(s)</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto -mx-4 sm:mx-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Date</TableHead>
              <TableHead>Entité</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Par</TableHead>
              <TableHead>Référence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">Chargement…</TableCell></TableRow>
            ) : filteredAuditLogs.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">Aucune entrée d'audit.</TableCell></TableRow>
            ) : (
              filteredAuditLogs.slice(0, 100).map((l) => {
                const performer = l.performer
                  ? `${l.performer.lastName || ''} ${l.performer.firstName || ''}`.trim()
                  : '—';
                return (
                  <TableRow key={l.id} className="hover:bg-slate-50">
                    <TableCell className="text-xs text-slate-600">
                      {l.performedAt ? new Date(l.performedAt).toLocaleString('fr-FR') : '—'}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{l.entityType || '—'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.action || '—'}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-700">{performer}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {l.entityId ? String(l.entityId).slice(0, 8) + '…' : '—'}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
        {filteredAuditLogs.length > 100 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
            100 premiers résultats affichés sur {filteredAuditLogs.length}. Utilisez l'export Excel pour la liste complète.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <ModuleContentArea
      layout="custom"
      toolbar={
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Contrôle & Audit financier</h2>
            <p className="text-xs text-slate-500">Alertes ORION, anomalies, transactions suspectes — année {academicYear?.name || academicYear?.label || 'non sélectionnée'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exporting !== null} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
              {exporting === 'excel' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1.5" />}
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting !== null} className="border-rose-300 text-rose-700 hover:bg-rose-50">
              {exporting === 'pdf' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileText className="w-4 h-4 mr-1.5" />}
              PDF
            </Button>
          </div>
        </div>
      }
    >
      {renderSubTabs()}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          <span className="ml-2 text-slate-500">Chargement…</span>
        </div>
      ) : (
        <>
          {subTab === 'dashboard' && renderDashboard()}
          {subTab === 'anomalies' && renderAnomalies()}
          {subTab === 'suspicious' && renderSuspicious()}
          {subTab === 'ecarts' && renderEcarts()}
          {subTab === 'audit' && renderAudit()}
        </>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          filePath={previewDoc.filePath}
          fileName={previewDoc.fileName}
          mimeType={previewDoc.mimeType}
          onClose={() => {
            if (previewDoc.filePath.startsWith('blob:')) URL.revokeObjectURL(previewDoc.filePath);
            setPreviewDoc(null);
          }}
        />
      )}
    </ModuleContentArea>
  );
}
