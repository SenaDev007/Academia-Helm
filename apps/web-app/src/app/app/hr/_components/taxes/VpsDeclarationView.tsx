'use client';

import { useState, useEffect } from 'react';
import { FileBarChart, FileText, Loader2, Eye, Printer, RefreshCw } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';

const PRIMARY = '#1A2BA6';

export function VpsDeclarationView() {
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
      // VPS is part of IST declaration
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
      toast({ variant: 'success', title: 'Déclaration VPS générée' });
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
              <FileBarChart className="h-5 w-5" style={{ color: PRIMARY }} />
              VPS — Versement Préventif à la Source
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Retenue à la source de 4% sur les salaires — versée mensuellement à la DGI
            </p>
          </div>
          <button onClick={handleGenerate} disabled={generating || !academicYear?.id} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50 transition" style={{ backgroundColor: PRIMARY }}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Générer
          </button>
        </div>
      </div>

      {/* Declarations */}
      {declarations.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center">
          <FileBarChart className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Aucune déclaration VPS générée.</p>
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

                {/* VPS Summary */}
                <div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Masse salariale brute</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{formatCurrency(data.totalGross || 0)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Taux VPS</p>
                    <p className="text-sm font-bold text-[#1A2BA6] mt-1">{data.vpsRate || 4}%</p>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">VPS à verser</p>
                    <p className="text-sm font-bold text-amber-700 mt-1">{formatCurrency(data.vps || 0)}</p>
                  </div>
                </div>

                {/* Expandable details */}
                {isExpanded && data.staffDetails && Array.isArray(data.staffDetails) && (
                  <div className="p-4 border-t border-slate-100 overflow-x-auto">
                    <h4 className="text-sm font-bold text-slate-700 mb-3">Détail par employé</h4>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="px-2 py-2 text-left">Nom</th>
                          <th className="px-2 py-2 text-right">Salaire brut</th>
                          <th className="px-2 py-2 text-right">Taux VPS</th>
                          <th className="px-2 py-2 text-right">VPS retenu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.staffDetails.map((s: any, i: number) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="px-2 py-2 font-bold">{s.name}</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(s.grossSalary || 0)}</td>
                            <td className="px-2 py-2 text-center">{data.vpsRate || 4}%</td>
                            <td className="px-2 py-2 text-right font-bold text-amber-700">{formatCurrency(((s.grossSalary || 0) * (data.vpsRate || 4)) / 100)}</td>
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
