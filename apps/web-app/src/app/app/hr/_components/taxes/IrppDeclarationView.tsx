'use client';

import { useState, useEffect } from 'react';
import { Percent, FileText, Loader2, Eye, Printer, RefreshCw, AlertCircle } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';

const PRIMARY = '#1A2BA6';

export function IrppDeclarationView() {
  const { tenant, academicYear } = useModuleContext();
  const [declarations, setDeclarations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchDeclarations(); }, [tenant?.id, academicYear?.id]);

  async function fetchDeclarations() {
    if (!tenant?.id) return;
    try {
      setLoading(true);
      // IRPP is part of IST declaration — fetch IST type and extract IRPP data
      const res = await hrFetch<any[]>(hrUrl('taxes/declarations', {
        tenantId: tenant.id,
        ...(academicYear?.id ? { academicYearId: academicYear.id } : {}),
        type: 'IST',
      }));
      setDeclarations(Array.isArray(res) ? res : []);
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    } finally { setLoading(false); }
  }

  async function handleGenerate() {
    if (!tenant?.id || !academicYear?.id) return;
    try {
      setGenerating(true);
      // Generate current month period: "2026-06"
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await hrFetch(hrUrl('taxes/declarations/ist/generate', { tenantId: tenant.id }), {
        method: 'POST',
        body: { academicYearId: academicYear.id, period, tenantId: tenant.id },
      });
      toast({ variant: 'success', title: 'Déclaration IRPP générée' });
      fetchDeclarations();
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    } finally { setGenerating(false); }
  }

  function viewPdf(declId: string) {
    window.open(hrUrl(`taxes/declarations/${declId}/pdf`, { tenantId: tenant?.id }), '_blank');
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Percent className="h-5 w-5" style={{ color: PRIMARY }} />
              IRPP — Impôt sur le Revenu des Personnes Physiques
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Impôt progressif par tranches (0% à 30%) — déclaration mensuelle
            </p>
          </div>
          <button onClick={handleGenerate} disabled={generating || !academicYear?.id} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50 transition" style={{ backgroundColor: PRIMARY }}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Générer
          </button>
        </div>
      </div>

      {/* IRPP Progressive Scale Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-blue-900">Barème progressif IRPP (Bénin)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-2">
              {[
                { range: '0 – 60 000', rate: '0%' },
                { range: '60 001 – 150 000', rate: '10%' },
                { range: '150 001 – 250 000', rate: '15%' },
                { range: '250 001 – 500 000', rate: '20%' },
                { range: '> 500 000', rate: '30%' },
              ].map((bracket, i) => (
                <div key={i} className="bg-white rounded-lg p-2 text-center border border-blue-100">
                  <p className="text-[10px] text-slate-500">{bracket.range}</p>
                  <p className="text-sm font-bold text-blue-700">{bracket.rate}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Declarations list */}
      {declarations.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center">
          <Percent className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Aucune déclaration IRPP générée.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {declarations.map((decl) => {
            const data = decl.data || {};
            const isExpanded = expandedId === decl.id;
            return (
              <div key={decl.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{decl.period || 'Période'}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Statut: <span className="font-bold">{decl.status}</span></p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setExpandedId(isExpanded ? null : decl.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#1A2BA6] border border-[#1A2BA6]/20 rounded-lg hover:bg-[#1A2BA6]/5 transition">
                      <Eye className="h-3.5 w-3.5" /> Détails
                    </button>
                    <button onClick={() => viewPdf(decl.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition">
                      <FileText className="h-3.5 w-3.5" /> PDF
                    </button>
                    <button onClick={() => { const w = window.open(hrUrl(`taxes/declarations/${decl.id}/pdf`, { tenantId: tenant?.id }), '_blank'); w?.addEventListener('load', () => w.print()); }} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                      <Printer className="h-3.5 w-3.5" /> Imprimer
                    </button>
                  </div>
                </div>

                {/* IRPP Summary */}
                <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Base imposable</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{formatCurrency(data.taxableAmount || data.baseImposable || 0)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">IRPP dû</p>
                    <p className="text-sm font-bold text-rose-600 mt-1">{formatCurrency(data.irpp || 0)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Nombre d'employés</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{data.staffCount || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Période</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{decl.period || '—'}</p>
                  </div>
                </div>

                {/* Expandable: per-staff IRPP breakdown */}
                {isExpanded && data.staffDetails && Array.isArray(data.staffDetails) && (
                  <div className="p-4 border-t border-slate-100 overflow-x-auto">
                    <h4 className="text-sm font-bold text-slate-700 mb-3">Détail par employé</h4>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-2 py-2 text-left">Nom</th>
                          <th className="px-2 py-2 text-right">Salaire brut</th>
                          <th className="px-2 py-2 text-right">CNSS ouvrière</th>
                          <th className="px-2 py-2 text-right">Base imposable</th>
                          <th className="px-2 py-2 text-right">IRPP retenu</th>
                          <th className="px-2 py-2 text-right">Net à payer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.staffDetails.map((s: any, i: number) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="px-2 py-2 font-bold">{s.name}</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(s.grossSalary || 0)}</td>
                            <td className="px-2 py-2 text-right text-rose-600">-{formatCurrency(s.cnssEmployee || 0)}</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(s.taxableAmount || 0)}</td>
                            <td className="px-2 py-2 text-right text-rose-600 font-bold">-{formatCurrency(s.irpp || 0)}</td>
                            <td className="px-2 py-2 text-right font-bold text-emerald-600">{formatCurrency(s.netSalary || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
