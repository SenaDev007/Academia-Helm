/**
 * ============================================================================
 * SOUS-MODULE 6 — Clôture & Trésorerie (Academia Helm)
 * ============================================================================
 *
 * Refonte complète :
 *   - KPIs (total encaissé, total dépensé, solde cumulé, trésorerie)
 *   - Graphique évolution (encaissements vs dépenses)
 *   - Bouton "Clôturer la journée" visible
 *   - Tableau avec filtre période + ligne totaux
 *   - Modal clôture avec rapprochement caisse
 *   - Toasts succès/erreur
 *   - Exports Excel/PDF
 *   - Design moderne (cartes, badges colorés)
 *
 * ============================================================================
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  CheckCircle, Eye, Lock, Calendar, TrendingUp, TrendingDown, Wallet,
  AlertTriangle, FileSpreadsheet, FileText, Loader2, BarChart3,
} from 'lucide-react';
import {
  ModuleContentArea,
} from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAppSession } from '@/contexts/AppSessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { loadXlsx } from '@/lib/exports/xlsx-loader';
import { loadPdfLibs } from '@/lib/exports/pdf-loader';
import {
  preloadSchoolLogo, drawOfficialHeader, drawFooter, formatAmount, SchoolHeader,
} from '@/lib/exports/finance-exports';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export default function TreasuryPage() {
  const confirmDialog = useConfirmDialog();
  const { toast } = useToast();
  const { academicYear } = useModuleContext();
  const { tenant } = useAppSession();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'cloture'>('dashboard');
  const [closures, setClosures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalClosure, setModalClosure] = useState(false);
  const [detailClosure, setDetailClosure] = useState<any | null>(null);
  const [closureDate, setClosureDate] = useState(new Date().toISOString().split('T')[0]);
  const [physicalAmount, setPhysicalAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const loadClosures = async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { academicYearId: academicYear.id };
      if (filterFrom) params.from = filterFrom;
      if (filterTo) params.to = filterTo;
      const data = await financeService.getTreasuryClosures(academicYear.id);
      setClosures(Array.isArray(data) ? data : []);
    } catch {
      setClosures([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClosures();
  }, [academicYear?.id, filterFrom, filterTo]);

  // Charger le preview quand le modal est ouvert et la date change
  useEffect(() => {
    if (!modalClosure || !academicYear?.id) return;
    setPreviewLoading(true);
    fetch(`/api/finance/treasury/daily-closures/preview?academicYearId=${academicYear.id}&date=${closureDate}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setPreviewData(data))
      .catch(() => setPreviewData(null))
      .finally(() => setPreviewLoading(false));
  }, [modalClosure, closureDate, academicYear?.id]);

  // KPIs
  const kpis = useMemo(() => {
    const totalIncome = closures.reduce((s, c) => s + Number(c.totalIncome ?? 0), 0);
    const totalExpense = closures.reduce((s, c) => s + Number(c.totalExpense ?? 0), 0);
    const totalNet = closures.reduce((s, c) => s + Number(c.netBalance ?? 0), 0);
    const anomalies = closures.filter((c) => c.anomalyDetected).length;
    const autoCount = closures.filter((c) => c.closureType === 'AUTO').length;
    const unvalidated = closures.filter((c) => !c.validatedById).length;
    return { totalIncome, totalExpense, totalNet, anomalies, autoCount, unvalidated };
  }, [closures]);

  // Données pour graphique (par date)
  const chartData = useMemo(() => {
    return closures.slice(0, 30).reverse().map((c) => ({
      date: new Date(c.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      Encaissements: Number(c.totalIncome ?? 0),
      Dépenses: Number(c.totalExpense ?? 0),
      Solde: Number(c.netBalance ?? 0),
    }));
  }, [closures]);

  const handleCreateClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYear?.id) return;
    setSubmitting(true);
    try {
      await financeService.createTreasuryClosure({
        academicYearId: academicYear.id,
        date: closureDate,
        physicalAmount: physicalAmount ? Number(physicalAmount) : undefined,
        validate: true,
      });
      toast({ title: '✅ Clôture validée', description: `La journée du ${new Date(closureDate).toLocaleDateString('fr-FR')} a été clôturée.` });
      setModalClosure(false);
      setPhysicalAmount('');
      loadClosures();
    } catch (e: any) {
      toast({ title: 'Erreur clôture', description: e?.message || 'Erreur', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async (id: string, date: string) => {
    try {
      await financeService.validateTreasuryClosure(id);
      toast({ title: '✅ Clôture validée', description: `La clôture du ${new Date(date).toLocaleDateString('fr-FR')} a été validée.` });
      loadClosures();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const XLSX = await loadXlsx();
      const data: any[][] = [
        ['', tenant?.name || 'Établissement', ''],
        ['', 'Clôtures journalières', ''],
        [academicYear?.name ? `Année : ${academicYear.name}` : '', '', ''],
        ['', '', ''],
        ['Date', 'Type', 'Encaissements', 'Dépenses', 'Solde', 'Montant physique', 'Écart', 'Anomalie', 'Validée par'],
      ];
      closures.forEach((c) => {
        data.push([
          new Date(c.date).toLocaleDateString('fr-FR'),
          c.closureType === 'AUTO' ? 'Auto' : 'Manuel',
          Number(c.totalIncome ?? 0),
          Number(c.totalExpense ?? 0),
          Number(c.netBalance ?? 0),
          c.physicalAmount != null ? Number(c.physicalAmount) : '',
          c.discrepancy != null ? Number(c.discrepancy) : '',
          c.anomalyDetected ? 'Oui' : 'Non',
          c.validator ? `${c.validator.firstName} ${c.validator.lastName}` : '—',
        ]);
      });
      data.push(['']);
      data.push(['TOTAL', '', kpis.totalIncome, kpis.totalExpense, kpis.totalNet, '', '', '', '']);
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 18 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Clôtures');
      XLSX.writeFile(wb, `clotures-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e: any) {
      toast({ title: 'Erreur export', description: e?.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  // Export PDF
  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      const { jsPDF, autoTable } = await loadPdfLibs();
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // En-tête officiel (pattern Encaissements)
      const header: SchoolHeader = {
        schoolName: tenant?.name || 'Établissement',
        schoolLogoUrl: tenant?.id ? `/api/tenants/${tenant.id}/logo` : undefined,
        academicYear: academicYear?.name || '',
        schoolAddress: tenant?.address || null,
        schoolPhone: tenant?.phone || null,
        schoolEmail: tenant?.email || null,
      };
      const logoBase64 = await preloadSchoolLogo(header.schoolLogoUrl);
      drawOfficialHeader(doc, header, pageWidth, logoBase64);

      // Titre
      let yPos = 50;
      doc.setFont('times', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(13, 31, 110);
      doc.text('Clôtures journalières', pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;

      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;

      doc.setDrawColor(13, 31, 110);
      doc.setLineWidth(0.5);
      doc.line(14, yPos, pageWidth - 14, yPos);
      yPos += 5;

      const tableData = closures.map((c) => [
        new Date(c.date).toLocaleDateString('fr-FR'),
        c.closureType === 'AUTO' ? 'Auto' : 'Manuel',
        formatAmount(c.totalIncome),
        formatAmount(c.totalExpense),
        formatAmount(c.netBalance),
        c.anomalyDetected ? 'Oui' : 'Non',
        c.validator ? `${c.validator.firstName} ${c.validator.lastName}` : '—',
      ]);
      tableData.push(['TOTAL', '', formatAmount(kpis.totalIncome), formatAmount(kpis.totalExpense), formatAmount(kpis.totalNet), '', '']);

      autoTable(doc, {
        head: [['Date', 'Type', 'Encaissé (FCFA)', 'Dépensé (FCFA)', 'Solde (FCFA)', 'Anomalie', 'Validée par']],
        body: tableData,
        startY: yPos,
        theme: 'grid',
        headStyles: { fillColor: [13, 31, 110], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'center' },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
        columnStyles: {
          2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
          5: { halign: 'center' },
        },
        didParseCell: (data: any) => {
          if (data.row.index === tableData.length - 1 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.textColor = [146, 64, 14];
          }
          if (data.section === 'body' && data.column.index === 5 && data.row.index < tableData.length - 1) {
            if (data.cell.raw === 'Oui') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
          }
        },
        didDrawPage: (data: any) => {
          drawFooter(doc, pageWidth, pageHeight, data.pageNumber);
        },
      });

      doc.save(`clotures-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      toast({ title: 'Erreur export', description: e?.message, variant: 'destructive' });
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      {confirmDialog.dialog}
      <div className="space-y-4">
        {/* Sous-onglets */}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <Button
            variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('dashboard')}
            className={activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-600'}
          >
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Tableau de bord
          </Button>
          <Button
            variant={activeTab === 'cloture' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('cloture')}
            className={activeTab === 'cloture' ? 'bg-indigo-600 text-white' : 'text-slate-600'}
          >
            <Lock className="w-4 h-4 mr-1.5" />
            Clôture journalière
          </Button>
        </div>

        {/* === SOUS-ONGLET TABLEAU DE BORD === */}
        {activeTab === 'dashboard' && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Total encaissé</p>
                <p className="text-xl font-bold text-emerald-700">{formatCurrency(kpis.totalIncome)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{closures.length} clôture(s)</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center mb-2">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Total dépensé</p>
                <p className="text-xl font-bold text-rose-700">{formatCurrency(kpis.totalExpense)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{kpis.anomalies} anomalie(s)</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2">
                  <Wallet className="w-4 h-4" />
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Solde cumulé</p>
                <p className={`text-xl font-bold ${kpis.totalNet >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{formatCurrency(kpis.totalNet)}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Trésorerie globale</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-2">
                  <Lock className="w-4 h-4" />
                </div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold mb-1">Non validées</p>
                <p className="text-xl font-bold text-amber-700">{kpis.unvalidated}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{kpis.autoCount} auto / {closures.length - kpis.autoCount} manuel</p>
              </div>
            </div>

            {/* Graphique évolution */}
            {chartData.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Évolution des clôtures (30 derniers jours)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Encaissements" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Dépenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {/* === SOUS-ONGLET CLÔTURE JOURNALIÈRE === */}
        {activeTab === 'cloture' && (
        <ModuleContentArea
          layout="custom"
          toolbar={
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="text-xs bg-transparent border-none focus:outline-none px-1 py-0.5" title="Du" />
                  <span className="text-slate-400 text-xs">→</span>
                  <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="text-xs bg-transparent border-none focus:outline-none px-1 py-0.5" title="Au" />
                  {(filterFrom || filterTo) && (
                    <button onClick={() => { setFilterFrom(''); setFilterTo(''); }} className="text-xs text-slate-500 hover:text-rose-600 ml-1">✕</button>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exporting !== null || closures.length === 0} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-8">
                  {exporting === 'excel' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1.5" />} Excel
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting !== null || closures.length === 0} className="border-rose-300 text-rose-700 hover:bg-rose-50 h-8">
                  {exporting === 'pdf' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileText className="w-4 h-4 mr-1.5" />} PDF
                </Button>
              </div>
              <Button size="sm" onClick={() => { setClosureDate(new Date().toISOString().split('T')[0]); setPhysicalAmount(''); setModalClosure(true); }}>
                <Lock className="w-4 h-4 mr-1.5" />
                Clôturer la journée
              </Button>
            </div>
          }
        >
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Encaissements</TableHead>
                  <TableHead className="text-right">Dépenses</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead>Physique</TableHead>
                  <TableHead>Écart</TableHead>
                  <TableHead>Anomalie</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="text-center text-gray-500 py-12">Chargement…</TableCell></TableRow>
                ) : closures.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-gray-500 py-12">
                      <Lock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      Aucune clôture. Cliquez sur « Clôturer la journée » pour commencer.
                    </TableCell>
                  </TableRow>
                ) : (
                  closures.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50">
                      <TableCell className="text-sm text-slate-700 whitespace-nowrap">
                        {new Date(c.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        {c.closureType === 'AUTO' ? (
                          <Badge variant="outline" className={`text-[10px] ${c.anomalyDetected ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            Auto {c.anomalyDetected && '⚠'}
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">Manuel</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-700 whitespace-nowrap">{formatCurrency(Number(c.totalIncome ?? 0))}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-rose-700 whitespace-nowrap">{formatCurrency(Number(c.totalExpense ?? 0))}</TableCell>
                      <TableCell className={`text-right font-mono text-xs font-bold ${Number(c.netBalance ?? 0) >= 0 ? 'text-indigo-700' : 'text-rose-700'} whitespace-nowrap`}>
                        {formatCurrency(Number(c.netBalance ?? 0))}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">{c.physicalAmount != null ? formatCurrency(Number(c.physicalAmount)) : '—'}</TableCell>
                      <TableCell className="text-xs">
                        {c.discrepancy != null && Math.abs(Number(c.discrepancy)) > 0.01 ? (
                          <span className="text-rose-600 font-semibold">{formatCurrency(Number(c.discrepancy))}</span>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {c.anomalyDetected ? (
                          <span className="inline-flex items-center gap-1 text-rose-600 text-xs font-medium">
                            <AlertTriangle className="w-3 h-3" /> Oui
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        {c.validatedById ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle className="w-3 h-3 mr-1" /> Validée
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            En attente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailClosure(c)} title="Voir détails">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {!c.validatedById && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-emerald-100" onClick={async () => {
                              const ok = await confirmDialog.warning(`La clôture du ${new Date(c.date).toLocaleDateString('fr-FR')} sera validée définitivement.`, 'Valider la clôture');
                              if (ok) handleValidate(c.id, c.date);
                            }} title="Valider">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {closures.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                    <td colSpan={2} className="px-3 py-2 text-right text-slate-700 text-sm">TOTAUX ({closures.length})</td>
                    <td className="px-3 py-2 text-right font-mono text-sm text-emerald-700">{formatCurrency(kpis.totalIncome)}</td>
                    <td className="px-3 py-2 text-right font-mono text-sm text-rose-700">{formatCurrency(kpis.totalExpense)}</td>
                    <td className={`px-3 py-2 text-right font-mono text-sm ${kpis.totalNet >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{formatCurrency(kpis.totalNet)}</td>
                    <td colSpan={5}></td>
                  </tr>
                </tfoot>
              )}
            </Table>
            </div>
          </div>
        </ModuleContentArea>
        )}
      </div>

      {/* Modal clôture */}
      {modalClosure && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" onClick={() => setModalClosure(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 px-6 py-4 text-white">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Clôture journalière
              </h3>
              <p className="text-xs text-indigo-100 mt-1">
                Les encaissements et dépenses du jour sont calculés automatiquement.
              </p>
            </div>
            <form onSubmit={handleCreateClosure} className="p-6 space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">Date</Label>
                <Input type="date" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} required />
              </div>

              {/* Rapprochement par caisse (preview) */}
              {previewLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                </div>
              ) : previewData ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                    <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Rapprochement de la journée</div>
                  </div>
                  <div className="p-4 space-y-3">
                    {/* Totaux */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-emerald-50 rounded-lg p-2 text-center">
                        <div className="text-[10px] uppercase text-emerald-600 font-semibold">Encaissé</div>
                        <div className="text-sm font-bold text-emerald-700">{formatCurrency(previewData.totalIncome || 0)}</div>
                      </div>
                      <div className="bg-rose-50 rounded-lg p-2 text-center">
                        <div className="text-[10px] uppercase text-rose-600 font-semibold">Dépensé</div>
                        <div className="text-sm font-bold text-rose-700">{formatCurrency(previewData.totalExpense || 0)}</div>
                      </div>
                      <div className={`rounded-lg p-2 text-center ${(previewData.netBalance || 0) >= 0 ? 'bg-indigo-50' : 'bg-rose-50'}`}>
                        <div className={`text-[10px] uppercase font-semibold ${(previewData.netBalance || 0) >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>Solde</div>
                        <div className={`text-sm font-bold ${(previewData.netBalance || 0) >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{formatCurrency(previewData.netBalance || 0)}</div>
                      </div>
                    </div>

                    {/* Par caisse */}
                    {previewData.byRegister && previewData.byRegister.length > 0 && (
                      <div>
                        <div className="text-[10px] text-slate-500 font-semibold uppercase mb-1">Par caisse</div>
                        <div className="space-y-1">
                          {previewData.byRegister.map((r: any) => (
                            <div key={r.cashRegisterId} className="flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-indigo-50 text-indigo-700">{r.code}</span>
                                <span className="text-slate-700">{r.name}</span>
                              </div>
                              <div className="flex items-center gap-3 font-mono">
                                <span className="text-emerald-600">+{formatCurrency(r.income)}</span>
                                <span className="text-rose-600">−{formatCurrency(r.expense)}</span>
                                <span className={`font-bold ${r.net >= 0 ? 'text-slate-700' : 'text-rose-700'}`}>{formatCurrency(r.net)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <div>
                <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5 block">
                  Montant physique caisse (FCFA)
                </Label>
                <Input type="number" value={physicalAmount} onChange={(e) => setPhysicalAmount(e.target.value)} placeholder="Pour rapprochement (optionnel)" />
                <p className="text-[10px] text-slate-500 mt-1">
                  💡 Saisissez le montant compté physiquement. L'écart avec le solde théorique sera calculé automatiquement.
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>⚠️ Verrouillage :</strong> Après validation, les transactions de cette journée ne pourront plus être modifiées.
                </p>
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" onClick={() => setModalClosure(false)}>Annuler</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                  Valider clôture
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal détail */}
      {detailClosure && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" onClick={() => setDetailClosure(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className={`px-6 py-4 border-b border-slate-200 ${detailClosure.anomalyDetected ? 'bg-rose-50' : detailClosure.closureType === 'AUTO' ? 'bg-amber-50' : 'bg-emerald-50'}`}>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Clôture du {new Date(detailClosure.date).toLocaleDateString('fr-FR')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {detailClosure.closureType === 'AUTO' ? 'Clôture automatique' : 'Clôture manuelle'}
                {detailClosure.validatedById ? ' · Validée' : ' · En attente de validation'}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-600 font-semibold mb-1">Encaissé</div>
                  <div className="font-bold text-emerald-700">{formatCurrency(Number(detailClosure.totalIncome ?? 0))}</div>
                </div>
                <div className="bg-rose-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-rose-600 font-semibold mb-1">Dépensé</div>
                  <div className="font-bold text-rose-700">{formatCurrency(Number(detailClosure.totalExpense ?? 0))}</div>
                </div>
                <div className={`rounded-lg p-3 text-center ${Number(detailClosure.netBalance ?? 0) >= 0 ? 'bg-indigo-50' : 'bg-rose-50'}`}>
                  <div className={`text-[10px] uppercase tracking-wide font-semibold mb-1 ${Number(detailClosure.netBalance ?? 0) >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>Solde</div>
                  <div className={`font-bold ${Number(detailClosure.netBalance ?? 0) >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>{formatCurrency(Number(detailClosure.netBalance ?? 0))}</div>
                </div>
              </div>

              {detailClosure.physicalAmount != null && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Montant physique</div>
                    <div className="font-medium text-slate-800">{formatCurrency(Number(detailClosure.physicalAmount))}</div>
                  </div>
                  <div className={`rounded-lg p-3 ${detailClosure.discrepancy != null && Math.abs(Number(detailClosure.discrepancy)) > 0.01 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                    <div className={`text-[10px] uppercase tracking-wide font-semibold mb-1 ${detailClosure.discrepancy != null && Math.abs(Number(detailClosure.discrepancy)) > 0.01 ? 'text-rose-600' : 'text-emerald-600'}`}>Écart</div>
                    <div className={`font-medium ${detailClosure.discrepancy != null && Math.abs(Number(detailClosure.discrepancy)) > 0.01 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {detailClosure.discrepancy != null ? formatCurrency(Number(detailClosure.discrepancy)) : '—'}
                    </div>
                  </div>
                </div>
              )}

              {detailClosure.anomalyDetected && detailClosure.anomalyNote && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wide text-rose-600 font-semibold mb-1">⚠️ Anomalie détectée</div>
                  <p className="text-sm text-rose-800">{detailClosure.anomalyNote}</p>
                </div>
              )}

              {detailClosure.validatedById && detailClosure.validator && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Validée par {detailClosure.validator.firstName} {detailClosure.validator.lastName}
                  {detailClosure.validatedAt && ` le ${new Date(detailClosure.validatedAt).toLocaleDateString('fr-FR')}`}
                </div>
              )}

              {!detailClosure.validatedById && (
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={async () => {
                    const ok = await confirmDialog.warning('Cette clôture sera validée définitivement.', 'Valider');
                    if (ok) { handleValidate(detailClosure.id, detailClosure.date); setDetailClosure(null); }
                  }}>
                    <CheckCircle className="w-4 h-4 mr-1.5" /> Valider
                  </Button>
                </div>
              )}
            </div>
            <div className="bg-slate-50 px-6 py-3 flex justify-end border-t border-slate-200">
              <Button variant="outline" onClick={() => setDetailClosure(null)}>Fermer</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
