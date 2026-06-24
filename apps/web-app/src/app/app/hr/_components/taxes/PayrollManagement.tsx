'use client';

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, FileText, Download, Eye, Printer } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';

export function PayrollManagement() {
  const { tenant } = useModuleContext();
  const { currentYear } = useAcademicYear();
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState(new Date().toISOString().substring(0, 7));
  const [staffType, setStaffType] = useState<'PERMANENT' | 'VACATAIRE'>('PERMANENT');

  const loadData = async () => {
    if (!tenant?.id || !currentYear?.id) return;
    try {
      setLoading(true);
      const res = await hrFetch<any[]>(hrUrl('taxes/payroll/payslips', { tenantId: tenant.id, academicYearId: currentYear.id, period }));
      setPayslips(Array.isArray(res) ? res : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [tenant?.id, currentYear?.id, period]);

  const handleGenerate = async () => {
    if (!tenant?.id || !currentYear?.id) return;
    setGenerating(true);
    try {
      const res = await hrFetch<any>(hrUrl('taxes/payroll/generate', { tenantId: tenant.id }), {
        method: 'POST', body: { academicYearId: currentYear.id, period, staffType },
      });
      toast({ variant: 'success', title: `${res.payslipsCount} fiche(s) générée(s)`, description: `Brut: ${formatCurrency(res.totalGross)} · Net: ${formatCurrency(res.totalNet)}` });
      loadData();
    } catch (e: any) { toast({ variant: 'error', title: 'Erreur', description: e.message }); }
    finally { setGenerating(false); }
  };

  const viewPayslipPdf = (id: string) => window.open(hrUrl(`taxes/payslips/${id}/pdf`, { tenantId: tenant?.id }), '_blank');
  const printPayslipPdf = (id: string) => { const w = window.open(hrUrl(`taxes/payslips/${id}/pdf`, { tenantId: tenant?.id }), '_blank'); w?.addEventListener('load', () => w.print()); };

  const downloadPayslipPdf = async (id: string, name: string) => {
    try {
      const res = await fetch(hrUrl(`taxes/payslips/${id}/pdf`, { tenantId: tenant?.id }));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `Fiche_paie_${name}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { toast({ variant: 'error', title: 'Erreur PDF', description: e.message }); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  const totalGross = payslips.reduce((s, p) => s + Number(p.salaireBrut), 0);
  const totalDeductions = payslips.reduce((s, p) => s + Number(p.totalRetenues), 0);
  const totalNet = payslips.reduce((s, p) => s + Number(p.netAPayer), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-slate-900">États de paiement & Fiches de paie</h3>
          <p className="text-xs text-slate-500 mt-0.5">Calculs automatiques (CNSS, ITS, VPS) avec taux configurables</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Période</label>
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Type personnel</label>
            <select value={staffType} onChange={e => setStaffType(e.target.value as any)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]">
              <option value="PERMANENT">Permanents</option>
              <option value="VACATAIRE">Vacataires</option>
            </select>
          </div>
          <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-[#1A2BA6] hover:opacity-90 disabled:opacity-50">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Générer fiches
          </button>
          <button onClick={() => window.open(hrUrl('taxes/export/payslips', { tenantId: tenant?.id, academicYearId: currentYear?.id, period }), '_blank')} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#1A2BA6] border border-[#1A2BA6]/20 rounded-lg hover:bg-[#1A2BA6]/5 transition">
            <Download className="h-4 w-4" /> Export Excel
          </button>
        </div>
      </div>

      {payslips.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Salaire brut total</p><p className="text-lg font-bold text-slate-900">{formatCurrency(totalGross)}</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Retenues totales</p><p className="text-lg font-bold text-red-600">{formatCurrency(totalDeductions)}</p></div>
          <div className="bg-white rounded-xl border border-slate-200 p-4"><p className="text-xs text-slate-500">Net à payer total</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(totalNet)}</p></div>
        </div>
      )}

      {/* ─── Tableau État de paiement — PERMANENTS ─── */}
      {staffType === 'PERMANENT' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
            <p className="text-xs font-bold text-slate-700">PERSONNELS PERMANENTS — État de paiement</p>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-[#1A2BA6] text-white">
              <tr>
                <th rowSpan={2} className="px-2 py-1 text-left whitespace-nowrap">Nom et Prénoms</th>
                <th rowSpan={2} className="px-2 py-1 text-left whitespace-nowrap">Sit. Matrim.</th>
                <th rowSpan={2} className="px-2 py-1 text-left whitespace-nowrap">Date recrut.</th>
                <th rowSpan={2} className="px-2 py-1 text-right whitespace-nowrap">Salaire</th>
                <th className="px-2 py-1 text-center whitespace-nowrap" colSpan={2}>Avantages</th>
                <th rowSpan={2} className="px-2 py-1 text-right whitespace-nowrap">Salaire Brut</th>
                <th rowSpan={2} className="px-2 py-1 text-right whitespace-nowrap">ITS Brut</th>
                <th rowSpan={2} className="px-2 py-1 text-right whitespace-nowrap">ITS Net</th>
                <th className="px-2 py-1 text-center whitespace-nowrap" colSpan={5}>Retenues</th>
                <th rowSpan={2} className="px-2 py-1 text-right whitespace-nowrap">Net à payer</th>
                <th rowSpan={2} className="px-2 py-1"></th>
              </tr>
              <tr>
                <th className="px-2 py-1 text-right whitespace-nowrap">Prime Saliss.</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">Gratific.</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">CNSS</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">CNSS Patr.</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">VPS</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">Avance/Opp.</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">Taxes R/T</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((p, i) => (
                <tr key={p.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                  <td className="px-2 py-1 font-bold text-slate-900">{p.staff?.firstName} {p.staff?.lastName}</td>
                  <td className="px-2 py-1 text-slate-500">{p.staff?.maritalStatus || '—'}</td>
                  <td className="px-2 py-1 text-slate-500">{p.staff?.hireDate ? new Date(p.staff.hireDate).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(Number(p.salaireBase))}</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(Number(p.primeSalissures))}</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(Number(p.gratificationsEtrennes))}</td>
                  <td className="px-2 py-1 text-right font-bold">{formatCurrency(Number(p.salaireBrut))}</td>
                  <td className="px-2 py-1 text-right text-slate-500">{formatCurrency(Number(p.salaireBrut))}</td>
                  <td className="px-2 py-1 text-right text-red-600">{formatCurrency(Number(p.itsNet))}</td>
                  <td className="px-2 py-1 text-right text-red-600">{formatCurrency(Number(p.cnssOuvriere))}</td>
                  <td className="px-2 py-1 text-right text-slate-500">{formatCurrency(Number(p.cnssPatronale))}</td>
                  <td className="px-2 py-1 text-right text-red-600">{formatCurrency(Number(p.vps))}</td>
                  <td className="px-2 py-1 text-right text-red-600">{formatCurrency(Number(p.avanceAcompte) + Number(p.opposition))}</td>
                  <td className="px-2 py-1 text-right text-red-600">{formatCurrency(Number(p.taxesRadioTele))}</td>
                  <td className="px-2 py-1 text-right font-bold text-emerald-600">{formatCurrency(Number(p.netAPayer))}</td>
                  <td className="px-1 py-1 whitespace-nowrap"><button onClick={() => viewPayslipPdf(p.id)} className="p-1 rounded bg-[#1A2BA6]/10 text-[#1A2BA6] hover:bg-[#1A2BA6]/20" title="Visualiser"><Eye className="h-3 w-3" /></button><button onClick={() => printPayslipPdf(p.id)} className="p-1 rounded bg-slate-50 text-slate-500 hover:bg-slate-100 ml-0.5" title="Imprimer"><Printer className="h-3 w-3" /></button><button onClick={() => downloadPayslipPdf(p.id, `${p.staff?.firstName}_${p.staff?.lastName}`)} className="p-1 rounded bg-rose-50 text-rose-500 hover:bg-rose-100 ml-0.5" title="Télécharger"><Download className="h-3 w-3" /></button></td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold">
                <td colSpan={3} className="px-2 py-1 text-right">TOTAL</td>
                <td className="px-2 py-1 text-right">{formatCurrency(payslips.reduce((s,p) => s + Number(p.salaireBase), 0))}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(payslips.reduce((s,p) => s + Number(p.primeSalissures), 0))}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(payslips.reduce((s,p) => s + Number(p.gratificationsEtrennes), 0))}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(totalGross)}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(totalGross)}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(payslips.reduce((s,p) => s + Number(p.itsNet), 0))}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(payslips.reduce((s,p) => s + Number(p.cnssOuvriere), 0))}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(payslips.reduce((s,p) => s + Number(p.cnssPatronale), 0))}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(payslips.reduce((s,p) => s + Number(p.vps), 0))}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(payslips.reduce((s,p) => s + Number(p.avanceAcompte) + Number(p.opposition), 0))}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(payslips.reduce((s,p) => s + Number(p.taxesRadioTele), 0))}</td>
                <td className="px-2 py-1 text-right text-emerald-600">{formatCurrency(totalNet)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Tableau État de paiement — VACATAIRES ─── */}
      {staffType === 'VACATAIRE' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
            <p className="text-xs font-bold text-slate-700">PERSONNELS VACATAIRES — État de paiement</p>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-[#1A2BA6] text-white">
              <tr>
                <th rowSpan={2} className="px-2 py-1 text-left whitespace-nowrap">Nom et Prénoms</th>
                <th rowSpan={2} className="px-2 py-1 text-left whitespace-nowrap">Sit. Matrim.</th>
                <th rowSpan={2} className="px-2 py-1 text-left whitespace-nowrap">Date recrut.</th>
                <th rowSpan={2} className="px-2 py-1 text-right whitespace-nowrap">Salaire</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">Avantages / Gratifications</th>
                <th rowSpan={2} className="px-2 py-1 text-right whitespace-nowrap">Salaire Brut</th>
                <th className="px-2 py-1 text-center whitespace-nowrap" colSpan={3}>Retenues</th>
                <th rowSpan={2} className="px-2 py-1 text-right whitespace-nowrap">Net à payer</th>
                <th rowSpan={2} className="px-2 py-1 text-center whitespace-nowrap">CIN°</th>
                <th rowSpan={2} className="px-2 py-1 text-center whitespace-nowrap">Signature</th>
                <th rowSpan={2} className="px-2 py-1"></th>
              </tr>
              <tr>
                <th className="px-2 py-1 text-right whitespace-nowrap">Gratific. / Étrennes</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">Avance / salaire</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">Opposition / Assurance</th>
                <th className="px-2 py-1 text-right whitespace-nowrap">Taxes Radio/Télé</th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((p, i) => (
                <tr key={p.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                  <td className="px-2 py-1 font-bold text-slate-900">{p.staff?.firstName} {p.staff?.lastName}</td>
                  <td className="px-2 py-1 text-slate-500">{p.staff?.maritalStatus || '—'}</td>
                  <td className="px-2 py-1 text-slate-500">{p.staff?.hireDate ? new Date(p.staff.hireDate).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(Number(p.salaireBase))}</td>
                  <td className="px-2 py-1 text-right">{formatCurrency(Number(p.gratificationsEtrennes))}</td>
                  <td className="px-2 py-1 text-right font-bold">{formatCurrency(Number(p.salaireBrut))}</td>
                  <td className="px-2 py-1 text-right text-red-600">{formatCurrency(Number(p.avanceAcompte))}</td>
                  <td className="px-2 py-1 text-right text-red-600">{formatCurrency(Number(p.opposition))}</td>
                  <td className="px-2 py-1 text-right text-red-600">{formatCurrency(Number(p.taxesRadioTele))}</td>
                  <td className="px-2 py-1 text-right font-bold text-emerald-600">{formatCurrency(Number(p.netAPayer))}</td>
                  <td className="px-2 py-1 text-center font-mono text-slate-400">{p.staff?.tenantMatricule || '—'}</td>
                  <td className="px-2 py-1 text-center text-slate-300 italic text-[10px]">Signature</td>
                  <td className="px-1 py-1 whitespace-nowrap"><button onClick={() => viewPayslipPdf(p.id)} className="p-1 rounded bg-[#1A2BA6]/10 text-[#1A2BA6] hover:bg-[#1A2BA6]/20" title="Visualiser"><Eye className="h-3 w-3" /></button><button onClick={() => printPayslipPdf(p.id)} className="p-1 rounded bg-slate-50 text-slate-500 hover:bg-slate-100 ml-0.5" title="Imprimer"><Printer className="h-3 w-3" /></button><button onClick={() => downloadPayslipPdf(p.id, `${p.staff?.firstName}_${p.staff?.lastName}`)} className="p-1 rounded bg-rose-50 text-rose-500 hover:bg-rose-100 ml-0.5" title="Télécharger"><Download className="h-3 w-3" /></button></td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold">
                <td colSpan={3} className="px-2 py-1 text-right">TOTAL</td>
                <td className="px-2 py-1 text-right">{formatCurrency(payslips.reduce((s,p) => s + Number(p.salaireBase), 0))}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(payslips.reduce((s,p) => s + Number(p.gratificationsEtrennes), 0))}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(totalGross)}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(payslips.reduce((s,p) => s + Number(p.avanceAcompte), 0))}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(payslips.reduce((s,p) => s + Number(p.opposition), 0))}</td>
                <td className="px-2 py-1 text-right">{formatCurrency(payslips.reduce((s,p) => s + Number(p.taxesRadioTele), 0))}</td>
                <td className="px-2 py-1 text-right text-emerald-600">{formatCurrency(totalNet)}</td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {payslips.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Aucune fiche pour cette période — cliquez sur « Générer fiches ».</p>
        </div>
      )}
    </div>
  );
}
