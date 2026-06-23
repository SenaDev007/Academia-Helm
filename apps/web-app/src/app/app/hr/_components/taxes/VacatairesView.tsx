'use client';

import { useState, useEffect } from 'react';
import { UserCheck, FileText, Loader2, Download, RefreshCw } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';

const PRIMARY = '#1A2BA6';

export function VacatairesView() {
  const { tenant, academicYear } = useModuleContext();
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { fetchPayslips(); }, [tenant?.id, academicYear?.id]);

  async function fetchPayslips() {
    if (!tenant?.id) return;
    try {
      setLoading(true);
      const res = await hrFetch<any[]>(hrUrl('taxes/payroll/payslips', {
        tenantId: tenant.id,
        ...(academicYear?.id ? { academicYearId: academicYear.id } : {}),
        staffType: 'VACATAIRE',
      }));
      setPayslips(Array.isArray(res) ? res : []);
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    } finally { setLoading(false); }
  }

  async function handleGenerate() {
    if (!tenant?.id || !academicYear?.id) return;
    try {
      setGenerating(true);
      await hrFetch(hrUrl('taxes/payroll/generate', { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          academicYearId: academicYear.id,
          tenantId: tenant.id,
          staffType: 'VACATAIRE',
          period: new Date().toISOString().split('T')[0],
        },
      });
      toast({ variant: 'success', title: 'Fiches vacataires générées' });
      fetchPayslips();
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    } finally { setGenerating(false); }
  }

  function exportExcel() {
    window.open(hrUrl('taxes/export/payslips', {
      tenantId: tenant?.id,
      ...(academicYear?.id ? { academicYearId: academicYear.id } : {}),
      staffType: 'VACATAIRE',
      period: 'all',
    }), '_blank');
  }

  function viewPdf(payslipId: string) {
    window.open(hrUrl(`taxes/payslips/${payslipId}/pdf`, { tenantId: tenant?.id }), '_blank');
  }

  const totalNet = payslips.reduce((acc, p) => acc + Number(p.netAPayer || 0), 0);
  const totalGross = payslips.reduce((acc, p) => acc + Number(p.salaireBrut || 0), 0);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="h-5 w-5" style={{ color: PRIMARY }} />
              État des Vacataires
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Personnel vacataire — non soumis à la CNSS/IRPP (net = brut)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleGenerate} disabled={generating || !academicYear?.id} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50 transition" style={{ backgroundColor: PRIMARY }}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Générer
            </button>
            <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition">
              <Download className="h-4 w-4" /> Excel
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Vacataires</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{payslips.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Masse brute</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totalGross)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Net à payer</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{formatCurrency(totalNet)}</p>
        </div>
      </div>

      {/* Table */}
      {payslips.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center">
          <UserCheck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Aucune fiche vacataire générée.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold text-slate-600">Nom</th>
                  <th className="px-3 py-3 text-left font-semibold text-slate-600 hidden sm:table-cell">Sit. Matrim.</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Salaire base</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600 hidden md:table-cell">Avantages</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600 hidden md:table-cell">Gratific.</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Brut</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600 hidden lg:table-cell">Avance</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600 hidden lg:table-cell">Oppos.</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600 hidden lg:table-cell">Taxes R/T</th>
                  <th className="px-3 py-3 text-right font-semibold text-slate-600">Net à payer</th>
                  <th className="px-3 py-3 text-center font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-3 py-3 font-bold text-slate-900 whitespace-nowrap">
                      {p.staff?.firstName} {p.staff?.lastName}
                    </td>
                    <td className="px-3 py-3 text-slate-500 hidden sm:table-cell">{p.staff?.maritalStatus || '—'}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{formatCurrency(p.salaireBase || 0)}</td>
                    <td className="px-3 py-3 text-right text-slate-600 hidden md:table-cell">{formatCurrency(p.indemnites || 0)}</td>
                    <td className="px-3 py-3 text-right text-slate-600 hidden md:table-cell">{formatCurrency(p.gratificationsEtrennes || 0)}</td>
                    <td className="px-3 py-3 text-right font-bold text-slate-900">{formatCurrency(p.salaireBrut || 0)}</td>
                    <td className="px-3 py-3 text-right text-rose-600 hidden lg:table-cell">{formatCurrency(p.avanceAcompte || 0)}</td>
                    <td className="px-3 py-3 text-right text-rose-600 hidden lg:table-cell">{formatCurrency(p.opposition || 0)}</td>
                    <td className="px-3 py-3 text-right text-rose-600 hidden lg:table-cell">{formatCurrency(p.taxesRadioTele || 0)}</td>
                    <td className="px-3 py-3 text-right font-bold text-emerald-600">{formatCurrency(p.netAPayer || 0)}</td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => viewPdf(p.id)} className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 transition" title="Fiche PDF">
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr className="font-bold">
                  <td colSpan={5} className="px-3 py-3 text-right text-slate-700">TOTAUX</td>
                  <td className="px-3 py-3 text-right text-slate-900">{formatCurrency(totalGross)}</td>
                  <td colSpan={3} className="px-3 py-3 hidden lg:table-cell"></td>
                  <td className="px-3 py-3 text-right text-emerald-600">{formatCurrency(totalNet)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
