/**
 * ============================================================================
 * HR MODULE - PAYROLL DETAIL PAGE (REFACTORED)
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Calculator, 
  CheckCircle2, 
  FileText, 
  Download, 
  RefreshCcw,
  User,
  ArrowLeft,
  DollarSign,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { toast } from '@/components/ui/toast';

export default function PayrollDetailPage() {
  const { id } = useParams();
  const { tenant, academicYear } = useModuleContext();
  const [period, setPeriod] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchPayroll = async () => {
    if (!tenant?.id || !id) return;
    try {
      setLoading(true);
      const result = await hrFetch<any>(hrUrl(`payroll/periods/${id}`, { tenantId: tenant.id }));
      setPeriod(result);
    } catch (error) {
      console.error('Error fetching payroll detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [tenant?.id, id]);

  const handleGeneratePayrolls = async () => {
    try {
      setProcessing(true);
      await hrFetch<any>(hrUrl(`payroll/periods/${id}/generate`), { method: 'POST', body: { tenantId: tenant.id, academicYearId: academicYear?.id } });
      toast({ variant: 'success', title: 'Lignes de paie générées avec succès' });
      fetchPayroll();
    } catch (error) {
      toast({ variant: 'error', title: 'Erreur lors de la génération' });
    } finally {
      setProcessing(false);
    }
  };

  const handleCalculatePayrollLine = async (lineId: string) => {
    try {
      await hrFetch<any>(hrUrl(`payroll/${lineId}/calculate`), { method: 'POST', body: { tenantId: tenant.id, academicYearId: academicYear?.id } });
      toast({ variant: 'success', title: 'Calcul fiscal effectué' });
      fetchPayroll();
    } catch (error) {
      toast({ variant: 'error', title: 'Erreur de calcul' });
    }
  };

  const handleCalculateAll = async () => {
    try {
      setProcessing(true);
      await hrFetch<any>(hrUrl(`payroll/periods/${id}/calculate`), { method: 'POST', body: { tenantId: tenant.id, academicYearId: academicYear?.id } });
      toast({ variant: 'success', title: 'Calcul global terminé' });
      fetchPayroll();
    } catch (error) {
      toast({ variant: 'error', title: 'Erreur lors du calcul global' });
    } finally {
      setProcessing(false);
    }
  };

  const handleValidateAndPay = async () => {
    try {
      setProcessing(true);
      await hrFetch<any>(hrUrl(`payroll/periods/${id}`, { tenantId: tenant.id }), {
        method: 'PUT',
        body: { status: 'PAID' },
      });
      toast({ variant: 'success', title: 'Paie validée et marquée comme payée' });
      fetchPayroll();
    } catch (error) {
      toast({ variant: 'error', title: 'Erreur lors de la validation' });
    } finally {
      setProcessing(false);
    }
  };

  const handlePreviewPayslip = async (itemId: string) => {
    try {
      const result = await hrFetch<any>(hrUrl(`payroll/${itemId}/payslip-pdf`, { tenantId: tenant.id }));
      if (result?.url) {
        window.open(result.url, '_blank');
      } else if (result?.pdfBase64) {
        const byteCharacters = atob(result.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        toast({ variant: 'info', title: 'Aperçu du bulletin', description: 'Le PDF sera généré par le serveur.' });
      }
    } catch (error) {
      toast({ variant: 'error', title: 'Erreur lors de la génération de l\'aperçu' });
    }
  };

  const handleDownloadPayslip = async (itemId: string, staffName: string) => {
    try {
      const result = await hrFetch<any>(hrUrl(`payroll/${itemId}/payslip-pdf`, { tenantId: tenant.id }));
      if (result?.pdfBase64) {
        const byteCharacters = atob(result.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bulletin_${staffName.replace(/\s+/g, '_')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (result?.url) {
        const a = document.createElement('a');
        a.href = result.url;
        a.download = `bulletin_${staffName.replace(/\s+/g, '_')}.pdf`;
        a.target = '_blank';
        a.click();
      } else {
        toast({ variant: 'info', title: 'Téléchargement', description: 'Le PDF sera généré par le serveur.' });
      }
    } catch (error) {
      toast({ variant: 'error', title: 'Erreur lors du téléchargement' });
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Chargement de la période de paie...</div>;
  if (!period) return <div className="p-8 text-center text-red-500">Période introuvable.</div>;

  const totalNet = period.payrolls?.reduce((acc: number, p: any) => acc + Number(p.netSalary), 0) || 0;

  return (
    <div className="space-y-6 pb-20">
      <div className="px-6 pt-4">
        <Link href="/app/hr/payroll" className="flex items-center gap-2 text-gray-500 hover:text-blue-600 font-bold transition-all group">
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Retour à la liste
        </Link>
      </div>

      <ModuleHeader
        title={`Paie : ${new Date(period.startDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`}
        description={`Période du ${new Date(period.startDate).toLocaleDateString()} au ${new Date(period.endDate).toLocaleDateString()}`}
        icon="rh"
        kpis={[
          { label: 'Total Net', value: totalNet.toLocaleString(), unit: 'XOF' },
          { label: 'Statut', value: period.status, unit: '' },
          { label: 'Agents', value: period.payrolls?.length?.toString() || '0', unit: '' },
        ]}
      />

      <div className="px-6">
        <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-50">
          <div className="flex items-center gap-3">
            <Badge className={period.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}>
              {period.status}
            </Badge>
          </div>
          
          <div className="flex gap-3">
            {period.status === 'OPEN' && (
              <>
                <button 
                  onClick={handleGeneratePayrolls}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-bold text-sm"
                >
                  <RefreshCcw size={16} className={processing ? 'animate-spin' : ''} />
                  Générer les lignes
                </button>
                <button 
                  onClick={handleCalculateAll}
                  disabled={processing}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg transition-all font-bold text-sm"
                >
                  <Calculator size={18} />
                  Calculer Tout (Taxes/CNSS)
                </button>
              </>
            )}
            {period.status === 'CALCULATED' && (
              <button onClick={handleValidateAndPay} disabled={processing} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-lg transition-all font-bold text-sm disabled:opacity-50">
                <ShieldCheck size={18} />
                Valider & Payer
              </button>
            )}
          </div>
        </div>

        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Employé</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Salaire Brut</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Retenues (CNSS/Tax)</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Net à Payer</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">Statut</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {period.payrolls?.map((payroll: any) => (
                <tr key={payroll.id} className="hover:bg-blue-50/10 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                        <User size={20} />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-800 block">
                          {payroll.staff?.firstName} {payroll.staff?.lastName}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase">{payroll.staff?.staffCode}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-gray-700">{Number(payroll.grossSalary).toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-red-500 font-bold">-{ (Number(payroll.employeeCNSS) + Number(payroll.taxWithheld)).toLocaleString() }</span>
                      <span className="text-[9px] text-gray-400 font-medium">CNSS: {Number(payroll.employeeCNSS).toLocaleString()} | Tax: {Number(payroll.taxWithheld).toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-blue-600">{Number(payroll.netSalary).toLocaleString()} XOF</span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={
                      payroll.status === 'VALIDATED' ? 'bg-emerald-50 text-emerald-600' :
                      payroll.status === 'DRAFT' ? 'bg-amber-50 text-amber-600' :
                      'bg-gray-50 text-gray-400'
                    }>
                      {payroll.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {period.status === 'OPEN' && (
                        <button 
                          onClick={() => handleCalculatePayrollLine(payroll.id)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Calculer taxes"
                        >
                          <Calculator size={18} />
                        </button>
                      )}
                      <button onClick={() => handlePreviewPayslip(payroll.id)} className="p-2 text-gray-400 hover:text-emerald-600 transition-colors" title="Aperçu Bulletin">
                        <FileText size={18} />
                      </button>
                      <button onClick={() => handleDownloadPayslip(payroll.id, `${payroll.staff?.firstName} ${payroll.staff?.lastName}`)} className="p-2 text-gray-400 hover:text-gray-900 transition-colors" title="Télécharger PDF">
                        <Download size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!period.payrolls || period.payrolls.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <AlertCircle className="mx-auto mb-2 opacity-20" size={40} />
                    Aucune ligne de paie générée pour cette période.
                    {period.status === 'OPEN' && (
                      <div className="mt-4">
                        <button onClick={handleGeneratePayrolls} className="text-blue-600 font-bold hover:underline">
                          Lancer la génération automatique →
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
