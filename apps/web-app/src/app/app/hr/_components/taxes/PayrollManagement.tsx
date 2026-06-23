'use client';

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, FileText, Download } from 'lucide-react';
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
        method: 'POST',
        body: { academicYearId: currentYear.id, period, staffType },
      });
      toast({ variant: 'success', title: `${res.payslipsCount} fiche(s) générée(s)`, description: `Brut: ${formatCurrency(res.totalGross)} · Net: ${formatCurrency(res.totalNet)}` });
      loadData();
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    } finally { setGenerating(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  const totalGross = payslips.reduce((s, p) => s + Number(p.salaireBrut), 0);
  const totalNet = payslips.reduce((s, p) => s + Number(p.netAPayer), 0);
  const totalDeductions = payslips.reduce((s, p) => s + Number(p.totalRetenues), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-slate-900">États de paiement & Fiches de paie</h3>
          <p className="text-xs text-slate-500 mt-0.5">Calculs automatiques (CNSS, ITS, VPS) avec taux configurables</p>
        </div>
      </div>

      {/* Génération */}
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
        </div>
      </div>

      {/* Stats */}
      {payslips.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Salaire brut total</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(totalGross)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Retenues totales</p>
            <p className="text-lg font-bold text-red-600">{formatCurrency(totalDeductions)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Net à payer total</p>
            <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalNet)}</p>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-600">Nom</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-600">Base</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-600">Brut</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-600">CNSS Ouv.</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-600">ITS</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-600">Retenues</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-600">Net à payer</th>
            </tr>
          </thead>
          <tbody>
            {payslips.map((p, i) => (
              <tr key={p.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                <td className="px-4 py-2">
                  <div className="font-bold text-slate-900">{p.staff?.firstName} {p.staff?.lastName}</div>
                  <div className="text-xs text-slate-400">{p.staff?.position || ''}</div>
                </td>
                <td className="px-4 py-2 text-right">{formatCurrency(Number(p.salaireBase))}</td>
                <td className="px-4 py-2 text-right font-bold">{formatCurrency(Number(p.salaireBrut))}</td>
                <td className="px-4 py-2 text-right text-red-600">{formatCurrency(Number(p.cnssOuvriere))}</td>
                <td className="px-4 py-2 text-right text-red-600">{formatCurrency(Number(p.itsNet))}</td>
                <td className="px-4 py-2 text-right text-red-600">{formatCurrency(Number(p.totalRetenues))}</td>
                <td className="px-4 py-2 text-right font-bold text-emerald-600">{formatCurrency(Number(p.netAPayer))}</td>
              </tr>
            ))}
            {payslips.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                Aucune fiche pour cette période — cliquez sur « Générer fiches ».
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
