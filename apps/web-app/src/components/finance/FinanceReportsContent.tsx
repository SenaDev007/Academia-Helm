/**
 * ============================================================================
 * ACADEMIA HELM - FINANCE REPORTS CONTENT
 * ============================================================================
 *
 * Refonte complète selon spec Academia Helm (sous-module 7 — Rapports
 * financiers). 4 sous-onglets :
 *
 *   1. Bilan périodique     — agrégats encaissements/dépenses/solde sur une
 *                              période filtrée (date, classe, caisse).
 *   2. État des arriérés    — liste nominative des élèves en retard, avec
 *                              filtres niveau de gravité + statut.
 *   3. Journal de caisse    — détail des opérations par caisse et période,
 *                              avec totaux entrées/sorties/solde net.
 *   4. Comparatif & projet. — N vs N-1, projection trésorerie, comparatif
 *                              multi-caisses.
 *
 * Chaque sous-onglet propose :
 *   - Des filtres dynamiques (date, classe, caisse, type).
 *   - Des KPI cards synthétiques.
 *   - Un export PDF + Excel respectant rigoureusement le pattern Encaissements
 *     (drawOfficialHeader avec logo école + drapeau Bénin, formatAmount avec
 *     espace comme séparateur, "Francs CFA" non tronqué).
 *
 * Layout : le ModuleHeader + SubModuleNavigation sont gérés par le layout
 * parent (app/finance/layout.tsx) — ce composant ne fait que le contenu métier.
 * ============================================================================
 */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, FileText, FileSpreadsheet, Loader2, Filter, Download,
  TrendingUp, TrendingDown, Wallet, BarChart3, AlertTriangle,
  Layers, Archive, Coins, ArrowRightLeft, ChevronRight,
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
import {
  exportBilanPeriodiqueToPdf,
  exportBilanPeriodiqueToExcel,
  exportCashJournalToPdf,
  exportCashJournalToExcel,
  exportArrearsStateToPdf,
  exportArrearsStateToExcel,
} from '@/lib/exports/reports-exports';
import DocumentPreviewModal from '@/components/students/DocumentPreviewModal';

type SubTab = 'bilan' | 'arrieres' | 'journal' | 'comparatif';

const SUB_TABS: { id: SubTab; label: string; icon: any }[] = [
  { id: 'bilan', label: 'Bilan périodique', icon: BarChart3 },
  { id: 'arrieres', label: 'État des arriérés', icon: Archive },
  { id: 'journal', label: 'Journal de caisse', icon: Wallet },
  { id: 'comparatif', label: 'Comparatif & Projections', icon: TrendingUp },
];

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  WIRE: 'Virement',
  FEDAPAY: 'Fedapay',
  FEEXPAY: 'FeexPay',
  BANK: 'Banque',
  CHECK: 'Chèque',
};

const ARREARS_LEVEL_LABELS: Record<string, string> = {
  LOW: 'Faible', MEDIUM: 'Moyen', HIGH: 'Élevé', CRITICAL: 'Critique',
};

const ARREARS_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Ouvert', PARTIALLY_PAID: 'Partiellement payé', PAID: 'Soldé',
  WRITTEN_OFF: 'Abandonné', TRANSFERRED: 'Transféré',
};

export default function FinanceReportsContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const { tenant } = useAppSession();
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<SubTab>('bilan');
  const [previewDoc, setPreviewDoc] = useState<{ filePath: string; fileName: string; mimeType: string } | null>(null);

  // Filtres globaux par sous-onglet
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [classId, setClassId] = useState('');
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [txType, setTxType] = useState(''); // PAYMENT | REVERSAL | ''
  const [arrearLevel, setArrearLevel] = useState(''); // LOW | MEDIUM | HIGH | CRITICAL
  const [arrearStatus, setArrearStatus] = useState(''); // OPEN | PARTIALLY_PAID | ...

  // Listes pour les filtres
  const [cashRegisters, setCashRegisters] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  // Données
  const [bilan, setBilan] = useState<any>(null);
  const [journal, setJournal] = useState<any>(null);
  const [arrears, setArrears] = useState<any[]>([]);
  const [comparative, setComparative] = useState<any>(null);
  const [projection, setProjection] = useState<any>(null);
  const [cashComparative, setCashComparative] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

  // ─── Chargement des listes de filtres ───
  useEffect(() => {
    financeService.getCashRegisters({ isActive: true })
      .then((d) => setCashRegisters(Array.isArray(d) ? d : []))
      .catch(() => setCashRegisters([]));
  }, []);

  // Charger les classes (via fee-structures pour ne pas appeler un endpoint inexistant)
  // On garde une liste simple basée sur les enrollments récupérés via les comptes élèves
  useEffect(() => {
    if (!academicYear?.id) return;
    financeService.getStudentAccounts({ academicYearId: academicYear.id })
      .then((d) => {
        const accs = Array.isArray(d) ? d : [];
        const classMap = new Map<string, string>();
        accs.forEach((a) => {
          const cls = a.studentEnrollments?.[0]?.class;
          if (cls?.id && cls?.name) classMap.set(cls.id, cls.name);
        });
        setClasses(Array.from(classMap.entries()).map(([id, name]) => ({ id, name })));
      })
      .catch(() => setClasses([]));
  }, [academicYear?.id]);

  // ─── Chargement Bilan périodique ───
  const loadBilan = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const data = await financeService.getBilanPeriodique(academicYear.id, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        classId: classId || undefined,
        cashRegisterId: cashRegisterId || undefined,
      });
      setBilan(data);
    } catch (e: any) {
      console.error('Bilan error:', e);
      toast({ title: 'Erreur chargement bilan', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, dateFrom, dateTo, classId, cashRegisterId, toast]);

  // ─── Chargement Journal de caisse ───
  const loadJournal = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const data = await financeService.getJournalCaisse(academicYear.id, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        cashRegisterId: cashRegisterId || undefined,
        type: txType || undefined,
      });
      setJournal(data);
    } catch (e: any) {
      console.error('Journal error:', e);
      toast({ title: 'Erreur chargement journal', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, dateFrom, dateTo, cashRegisterId, txType, toast]);

  // ─── Chargement Arriérés ───
  const loadArrears = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const data = await financeService.getArrears({ academicYearId: academicYear.id });
      setArrears(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Arrears error:', e);
      toast({ title: 'Erreur chargement arriérés', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, toast]);

  // ─── Chargement Comparatif ───
  const loadComparatif = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const [comp, proj, cashComp] = await Promise.all([
        financeService.getComparativeYear(academicYear.id).catch(() => null),
        financeService.getProjectionTresorerie(academicYear.id).catch(() => null),
        financeService.getCashRegisterComparative(academicYear.id).catch(() => []),
      ]);
      setComparative(comp);
      setProjection(proj);
      setCashComparative(Array.isArray(cashComp) ? cashComp : []);
    } catch (e: any) {
      console.error('Comparatif error:', e);
      toast({ title: 'Erreur chargement comparatif', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, toast]);

  // ─── Chargement initial + sur changement de sous-onglet ───
  useEffect(() => {
    if (!academicYear?.id) return;
    if (subTab === 'bilan') loadBilan();
    else if (subTab === 'journal') loadJournal();
    else if (subTab === 'arrieres') loadArrears();
    else if (subTab === 'comparatif') loadComparatif();
  }, [subTab, academicYear?.id]);

  // ─── Infos école pour l'en-tête des exports ───
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
      const header = {
        ...schoolInfo,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      } as any;

      if (subTab === 'bilan') {
        if (!bilan) throw new Error('Bilan non chargé');
        const { url } = await exportBilanPeriodiqueToPdf(bilan, header);
        setPreviewDoc({
          filePath: url,
          fileName: `bilan-periodique-${new Date().toISOString().slice(0, 10)}.pdf`,
          mimeType: 'application/pdf',
        });
      } else if (subTab === 'arrieres') {
        const { url } = await exportArrearsStateToPdf(filteredArrears, header);
        setPreviewDoc({
          filePath: url,
          fileName: `etat-arrieres-${new Date().toISOString().slice(0, 10)}.pdf`,
          mimeType: 'application/pdf',
        });
      } else if (subTab === 'journal') {
        if (!journal) throw new Error('Journal non chargé');
        const { url } = await exportCashJournalToPdf(journal, header);
        setPreviewDoc({
          filePath: url,
          fileName: `journal-caisse-${new Date().toISOString().slice(0, 10)}.pdf`,
          mimeType: 'application/pdf',
        });
      } else if (subTab === 'comparatif') {
        toast({ title: 'Export non disponible', description: 'L\'export du comparatif sera ajouté prochainement.', variant: 'default' });
        return;
      }
      toast({ title: '✅ Export PDF généré', description: 'Le document est prêt.' });
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
      const header = {
        ...schoolInfo,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      } as any;

      if (subTab === 'bilan') {
        if (!bilan) throw new Error('Bilan non chargé');
        await exportBilanPeriodiqueToExcel(bilan, header);
      } else if (subTab === 'arrieres') {
        await exportArrearsStateToExcel(filteredArrears, header);
      } else if (subTab === 'journal') {
        if (!journal) throw new Error('Journal non chargé');
        await exportCashJournalToExcel(journal, header);
      } else if (subTab === 'comparatif') {
        toast({ title: 'Export non disponible', description: 'L\'export du comparatif sera ajouté prochainement.' });
        return;
      }
      toast({ title: '✅ Export Excel généré', description: 'Le fichier a été téléchargé.' });
    } catch (e: any) {
      toast({ title: 'Erreur export Excel', description: e?.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  // ─── Filtrage local des arriérés ───
  const filteredArrears = useMemo(() => {
    let list = arrears;
    if (arrearLevel) list = list.filter((a) => a.arrearsLevel === arrearLevel);
    if (arrearStatus) list = list.filter((a) => a.status === arrearStatus);
    return list;
  }, [arrears, arrearLevel, arrearStatus]);

  // ─── Toolbar filtres dynamique selon sous-onglet ───
  const renderFilters = () => {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          <Calendar className="w-4 h-4 text-slate-500" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-sm bg-transparent border-none focus:outline-none focus:ring-0 px-1 py-0.5"
            title="Date de début"
          />
          <span className="text-slate-400 text-xs">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-sm bg-transparent border-none focus:outline-none focus:ring-0 px-1 py-0.5"
            title="Date de fin"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-slate-500 hover:text-rose-600 ml-1"
              title="Effacer le filtre"
            >✕</button>
          )}
        </div>

        {/* Caisse — visible sur bilan + journal */}
        {(subTab === 'bilan' || subTab === 'journal') && (
          <select
            value={cashRegisterId}
            onChange={(e) => setCashRegisterId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            title="Filtrer par caisse"
          >
            <option value="">Toutes les caisses</option>
            {cashRegisters.map((cr) => (
              <option key={cr.id} value={cr.id}>{cr.code} — {cr.name}</option>
            ))}
          </select>
        )}

        {/* Classe — visible sur bilan uniquement */}
        {subTab === 'bilan' && (
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            title="Filtrer par classe"
          >
            <option value="">Toutes les classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        {/* Type transaction — visible sur journal uniquement */}
        {subTab === 'journal' && (
          <select
            value={txType}
            onChange={(e) => setTxType(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            title="Filtrer par type"
          >
            <option value="">Tous types</option>
            <option value="PAYMENT">Paiements</option>
            <option value="REVERSAL">Annulations</option>
          </select>
        )}

        {/* Niveau + statut — visibles sur arriérés uniquement */}
        {subTab === 'arrieres' && (
          <>
            <select
              value={arrearLevel}
              onChange={(e) => setArrearLevel(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              title="Filtrer par niveau de gravité"
            >
              <option value="">Tous niveaux</option>
              <option value="LOW">Faible</option>
              <option value="MEDIUM">Moyen</option>
              <option value="HIGH">Élevé</option>
              <option value="CRITICAL">Critique</option>
            </select>
            <select
              value={arrearStatus}
              onChange={(e) => setArrearStatus(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
              title="Filtrer par statut"
            >
              <option value="">Tous statuts</option>
              <option value="OPEN">Ouvert</option>
              <option value="PARTIALLY_PAID">Partiellement payé</option>
              <option value="PAID">Soldé</option>
              <option value="WRITTEN_OFF">Abandonné</option>
              <option value="TRANSFERRED">Transféré</option>
            </select>
          </>
        )}

        {/* Bouton Appliquer */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (subTab === 'bilan') loadBilan();
            else if (subTab === 'journal') loadJournal();
            else if (subTab === 'arrieres') loadArrears();
            else if (subTab === 'comparatif') loadComparatif();
          }}
          className="border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          <Filter className="w-4 h-4 mr-1.5" />
          Appliquer
        </Button>

        {/* Boutons export */}
        <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exporting !== null} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
          {exporting === 'excel' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1.5" />}
          Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting !== null} className="border-rose-300 text-rose-700 hover:bg-rose-50">
          {exporting === 'pdf' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileText className="w-4 h-4 mr-1.5" />}
          PDF
        </Button>
      </div>
    );
  };

  // ─── Sous-onglets ───
  const renderSubTabs = () => (
    <div className="flex items-center gap-1 border-b border-slate-200 mb-4">
      {SUB_TABS.map((t) => {
        const Icon = t.icon;
        const isActive = subTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              isActive
                ? 'border-blue-600 text-blue-700'
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
  const KpiCard = ({ title, value, icon: Icon, color, sub }: any) => {
    const colorMap: any = {
      blue: 'bg-blue-50 text-blue-600 border-blue-100',
      emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      rose: 'bg-rose-50 text-rose-600 border-rose-100',
      amber: 'bg-amber-50 text-amber-600 border-amber-100',
      slate: 'bg-slate-50 text-slate-700 border-slate-200',
    };
    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-xl border ${colorMap[color] || colorMap.slate}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-lg font-black text-slate-900 tracking-tight">{value}</h3>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    );
  };

  // ─── 1. Bilan périodique ───
  const renderBilan = () => {
    const k = bilan?.kpi || { totalEncaissement: 0, totalDepenses: 0, soldeNet: 0 };
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Encaissements" value={formatCurrency(k.totalEncaissement)} icon={TrendingUp} color="emerald" />
          <KpiCard title="Dépenses" value={formatCurrency(k.totalDepenses)} icon={TrendingDown} color="rose" />
          <KpiCard
            title="Solde net"
            value={formatCurrency(k.soldeNet)}
            icon={Wallet}
            color={k.soldeNet >= 0 ? 'blue' : 'rose'}
            sub={k.soldeNet >= 0 ? 'Excédent' : 'Déficit'}
          />
          <KpiCard
            title="Transactions"
            value={bilan?.parClasse?.reduce((s: number, c: any) => s + (Number(c.count) || 0), 0) || 0}
            icon={BarChart3}
            color="amber"
            sub="sur la période"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Répartition par classe */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-500" />
                Encaissements par classe
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Classe</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-center">Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-8">Chargement…</TableCell></TableRow>
                ) : !bilan?.parClasse || bilan.parClasse.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-8">Aucune donnée pour cette période.</TableCell></TableRow>
                ) : (
                  bilan.parClasse.map((c: any, i: number) => (
                    <TableRow key={i} className="hover:bg-slate-50">
                      <TableCell className="font-medium">{c.className || '—'}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-700">{formatCurrency(c.total)}</TableCell>
                      <TableCell className="text-center text-slate-500">{c.count || 0} tx</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Répartition par catégorie */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-500" />
                Dépenses par catégorie
              </h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-center">Volume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-8">Chargement…</TableCell></TableRow>
                ) : !bilan?.parCategorie || bilan.parCategorie.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-8">Aucune dépense sur la période.</TableCell></TableRow>
                ) : (
                  bilan.parCategorie.map((c: any, i: number) => (
                    <TableRow key={i} className="hover:bg-slate-50">
                      <TableCell className="font-medium">{c.category || '—'}</TableCell>
                      <TableCell className="text-right font-bold text-rose-700">{formatCurrency(c.total)}</TableCell>
                      <TableCell className="text-center text-slate-500">{c.count || 0} dp</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    );
  };

  // ─── 2. État des arriérés ───
  const renderArrears = () => {
    const totalDue = filteredArrears.reduce((s, a) => s + (Number(a.totalDue) || 0), 0);
    const totalPaid = filteredArrears.reduce((s, a) => s + (Number(a.totalPaid) || 0), 0);
    const totalBalance = filteredArrears.reduce((s, a) => s + (Number(a.balanceDue) || 0), 0);
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Arriérés" value={filteredArrears.length} icon={Archive} color="rose" sub={`sur ${arrears.length} total`} />
          <KpiCard title="Total dû" value={formatCurrency(totalDue)} icon={AlertTriangle} color="amber" />
          <KpiCard title="Total payé" value={formatCurrency(totalPaid)} icon={TrendingUp} color="emerald" />
          <KpiCard title="Solde restant" value={formatCurrency(totalBalance)} icon={Wallet} color="rose" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800">Liste nominative des élèves en arriéré</h3>
            <p className="text-xs text-slate-500 mt-1">
              {filteredArrears.length} élève(s) — filtres appliqués : niveau {arrearLevel || 'tous'}, statut {arrearStatus || 'tous'}
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Élève</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Année</TableHead>
                <TableHead className="text-right">Total dû</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead className="text-right">Solde</TableHead>
                <TableHead>Niveau</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">Chargement…</TableCell></TableRow>
              ) : filteredArrears.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">Aucun arriéré — excellent !</TableCell></TableRow>
              ) : (
                filteredArrears.slice(0, 100).map((a) => {
                  const student = a.student
                    ? `${a.student.lastName} ${a.student.firstName}`
                    : '—';
                  const cls = a.student?.studentEnrollments?.[0]?.class?.name || '—';
                  const year = a.academicYear?.label || a.academicYearName || '—';
                  return (
                    <TableRow key={a.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium">{student}</TableCell>
                      <TableCell>{cls}</TableCell>
                      <TableCell className="text-slate-500">{year}</TableCell>
                      <TableCell className="text-right">{formatCurrency(a.totalDue)}</TableCell>
                      <TableCell className="text-right text-emerald-700">{formatCurrency(a.totalPaid)}</TableCell>
                      <TableCell className="text-right font-bold text-rose-700">{formatCurrency(a.balanceDue)}</TableCell>
                      <TableCell>
                        <Badge variant={a.arrearsLevel === 'CRITICAL' || a.arrearsLevel === 'HIGH' ? 'destructive' : 'outline'}>
                          {ARREARS_LEVEL_LABELS[a.arrearsLevel] || a.arrearsLevel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{ARREARS_STATUS_LABELS[a.status] || a.status}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {filteredArrears.length > 100 && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
              100 premiers résultats affichés sur {filteredArrears.length}. Utilisez l'export Excel pour la liste complète.
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── 3. Journal de caisse ───
  const renderJournal = () => {
    const t = journal?.totals || { totalIn: 0, totalOut: 0, netBalance: 0, count: 0 };
    const rows = journal?.rows || [];
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Transactions" value={t.count} icon={BarChart3} color="slate" sub="sur la période" />
          <KpiCard title="Entrées" value={formatCurrency(t.totalIn)} icon={TrendingUp} color="emerald" />
          <KpiCard title="Sorties" value={formatCurrency(t.totalOut)} icon={TrendingDown} color="rose" />
          <KpiCard title="Solde net" value={formatCurrency(t.netBalance)} icon={Wallet} color={t.netBalance >= 0 ? 'blue' : 'rose'} />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-500" />
              Détail des opérations
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {rows.length} opération(s) — filtrées par caisse {cashRegisterId ? cashRegisters.find((c) => c.id === cashRegisterId)?.name : 'toutes'} et type {txType || 'tous'}
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Date</TableHead>
                <TableHead>Reçu</TableHead>
                <TableHead>Élève</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Caisse</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead>Méthode</TableHead>
                <TableHead>Caissier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">Chargement…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-8">Aucune opération sur cette période.</TableCell></TableRow>
              ) : (
                rows.slice(0, 100).map((r: any) => {
                  const student = `${r.studentLastName || ''} ${r.studentFirstName || ''}`.trim() || '—';
                  const cashier = `${r.cashierLastName || ''} ${r.cashierFirstName || ''}`.trim() || '—';
                  const isReversal = r.type === 'REVERSAL';
                  return (
                    <TableRow key={r.id} className="hover:bg-slate-50">
                      <TableCell className="text-xs text-slate-600">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.receiptNumber || '—'}</TableCell>
                      <TableCell className="font-medium">{student}</TableCell>
                      <TableCell className="text-slate-500">{r.className || '—'}</TableCell>
                      <TableCell className="text-slate-500">{r.cashRegisterName || r.cashRegisterCode || '—'}</TableCell>
                      <TableCell className={`text-right font-bold ${isReversal ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {isReversal ? '-' : ''}{formatCurrency(r.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{METHOD_LABELS[r.paymentMethod] || r.paymentMethod || '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">{cashier}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {rows.length > 100 && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500">
              100 premiers résultats affichés sur {rows.length}. Utilisez l'export Excel pour la liste complète.
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── 4. Comparatif & Projections ───
  const renderComparatif = () => {
    const cur = comparative?.current;
    const prev = comparative?.previous;
    const deltas = comparative?.deltas;
    const proj = projection;
    return (
      <div className="space-y-5">
        {/* Comparatif N vs N-1 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-500" />
              Comparatif {comparative?.currentYearLabel || 'année N'} vs {comparative?.previousYearLabel || 'N-1'}
            </h3>
            {!prev && <p className="text-xs text-amber-600 mt-1">Aucune année précédente trouvée pour comparaison.</p>}
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Indicateur</TableHead>
                <TableHead className="text-right">Année N</TableHead>
                <TableHead className="text-right">Année N-1</TableHead>
                <TableHead className="text-right">Δ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-8">Chargement…</TableCell></TableRow>
              ) : !cur ? (
                <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-8">Aucune donnée.</TableCell></TableRow>
              ) : (
                <>
                  <ComparatifRow label="Total dû" current={cur.totalDue} previous={prev?.totalDue} delta={deltas?.totalDue} formatCur />
                  <ComparatifRow label="Total payé" current={cur.totalPaid} previous={prev?.totalPaid} delta={deltas?.totalPaid} formatCur />
                  <ComparatifRow label="Encaissements" current={cur.totalEncaissement} previous={prev?.totalEncaissement} delta={deltas?.totalEncaissement} formatCur />
                  <ComparatifRow label="Dépenses" current={cur.totalDepenses} previous={prev?.totalDepenses} delta={deltas?.totalDepenses} formatCur />
                  <ComparatifRow label="Solde net" current={cur.soldeNet} previous={prev?.soldeNet} delta={deltas?.soldeNet} formatCur />
                  <ComparatifRow label="Taux recouvrement" current={cur.tauxRecouvrement} previous={prev?.tauxRecouvrement} delta={deltas?.tauxRecouvrement} suffix="%" />
                </>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Projection trésorerie */}
        {proj && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Projection de trésorerie
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
              <ProjCard title="Solde actuel" value={formatCurrency(proj.soldeActuel)} color="blue" />
              <ProjCard title="Flux net mensuel" value={formatCurrency(proj.fluxNetMensuel)} color={proj.fluxNetMensuel >= 0 ? 'emerald' : 'rose'} />
              <ProjCard title="Projection fin trimestre" value={formatCurrency(proj.projectionFinTrimestre)} color={proj.projectionFinTrimestre >= 0 ? 'emerald' : 'rose'} />
              <ProjCard title="Projection fin année" value={formatCurrency(proj.projectionFinAnnee)} color={proj.projectionFinAnnee >= 0 ? 'emerald' : 'rose'} />
            </div>
            {proj.risqueDeficit && (
              <div className="p-4 bg-rose-50 border-t border-rose-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-rose-900">⚠️ Risque de déficit détecté en fin d'année</p>
                  <p className="text-xs text-rose-700 mt-1">
                    Au rythme actuel, la trésorerie sera négative en fin d'année scolaire.
                    Des mesures correctives sont recommandées (relance recouvrement, réduction dépenses).
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comparatif multi-caisses */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-500" />
              Comparatif par caisse
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Caisse</TableHead>
                <TableHead className="text-right">Solde actuel</TableHead>
                <TableHead className="text-right">Encaissements</TableHead>
                <TableHead className="text-right">Annulations</TableHead>
                <TableHead className="text-center">Transactions</TableHead>
                <TableHead className="text-center">État</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">Chargement…</TableCell></TableRow>
              ) : !cashComparative || cashComparative.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">Aucune caisse active.</TableCell></TableRow>
              ) : (
                cashComparative.map((c: any) => (
                  <TableRow key={c.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium">
                      <span className="font-mono text-xs text-slate-500 mr-1">{c.code}</span>
                      {c.name}
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(c.currentBalance)}</TableCell>
                    <TableCell className="text-right text-emerald-700">{formatCurrency(c.paymentTotal)}</TableCell>
                    <TableCell className="text-right text-rose-700">{formatCurrency(c.reversalTotal)}</TableCell>
                    <TableCell className="text-center text-slate-500">{c.transactionCount}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={c.isOpen ? 'default' : 'outline'}>
                        {c.isOpen ? 'Ouverte' : 'Fermée'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  const ComparatifRow = ({ label, current, previous, delta, formatCur, suffix }: any) => {
    const fmt = (v: any) => formatCur ? formatCurrency(Number(v) || 0) : `${v}${suffix || ''}`;
    const deltaNum = Number(delta) || 0;
    const isPositive = deltaNum >= 0;
    return (
      <TableRow className="hover:bg-slate-50">
        <TableCell className="font-medium">{label}</TableCell>
        <TableCell className="text-right font-bold">{fmt(current)}</TableCell>
        <TableCell className="text-right text-slate-600">{previous != null ? fmt(previous) : '—'}</TableCell>
        <TableCell className={`text-right font-bold ${previous != null ? (isPositive ? 'text-emerald-700' : 'text-rose-700') : 'text-slate-400'}`}>
          {previous != null ? `${isPositive ? '+' : ''}${formatCur ? formatCurrency(deltaNum) : `${deltaNum}${suffix || ''}`}` : '—'}
        </TableCell>
      </TableRow>
    );
  };

  const ProjCard = ({ title, value, color }: any) => {
    const colorMap: any = {
      blue: 'border-blue-200 bg-blue-50 text-blue-700',
      emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      rose: 'border-rose-200 bg-rose-50 text-rose-700',
    };
    return (
      <div className={`p-4 rounded-xl border ${colorMap[color]}`}>
        <p className="text-xs font-bold uppercase tracking-widest mb-1 opacity-80">{title}</p>
        <h3 className="text-lg font-black">{value}</h3>
      </div>
    );
  };

  return (
    <ModuleContentArea
      layout="custom"
      toolbar={
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Rapports financiers</h2>
            <p className="text-xs text-slate-500">Cockpit analytique — année {academicYear?.name || academicYear?.label || 'non sélectionnée'}</p>
          </div>
          {renderFilters()}
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
          {subTab === 'bilan' && renderBilan()}
          {subTab === 'arrieres' && renderArrears()}
          {subTab === 'journal' && renderJournal()}
          {subTab === 'comparatif' && renderComparatif()}
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
