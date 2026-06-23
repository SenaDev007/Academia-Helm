'use client';

import { useState, useEffect } from 'react';
import { Loader2, FileText, Table, Save, Download, Eye, Printer } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';

const STATEMENT_TYPES = [
  { value: 'BILAN_ACTIF', label: 'Bilan — Actif' },
  { value: 'BILAN_PASSIF', label: 'Bilan — Passif' },
  { value: 'COMPTE_RESULTAT', label: 'Compte de Résultat' },
  { value: 'TFT', label: 'Tableau de Flux de Trésorerie' },
];

export function FinancialStatements() {
  const { tenant } = useModuleContext();
  const { currentYear } = useAcademicYear();
  const [type, setType] = useState('BILAN_ACTIF');
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedAmounts, setEditedAmounts] = useState<Record<string, { amountN?: number; amountN1?: number }>>({});

  useEffect(() => {
    if (!tenant?.id || !currentYear?.id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await hrFetch<any[]>(hrUrl('taxes/financial-statements', { tenantId: tenant.id, academicYearId: currentYear.id, type }));
        setLines(Array.isArray(res) ? res : []);
        setEditedAmounts({});
      } catch (e: any) {
        toast({ variant: 'error', title: 'Erreur', description: e.message });
      } finally { setLoading(false); }
    })();
  }, [tenant?.id, currentYear?.id, type]);

  const handleAmountChange = (lineId: string, field: 'amountN' | 'amountN1', value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    setEditedAmounts(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: numValue },
    }));
  };

  const handleSave = async () => {
    if (!tenant?.id || Object.keys(editedAmounts).length === 0) return;
    setSaving(true);
    try {
      const updates = Object.entries(editedAmounts).map(([id, amounts]) => ({ id, ...amounts }));
      await hrFetch(hrUrl('taxes/financial-statements/batch', { tenantId: tenant.id }), { method: 'PUT', body: { updates } });
      toast({ variant: 'success', title: 'Montants enregistrés' });
      setEditedAmounts({});
      // Recharger
      const res = await hrFetch<any[]>(hrUrl('taxes/financial-statements', { tenantId: tenant.id, academicYearId: currentYear.id, type }));
      setLines(Array.isArray(res) ? res : []);
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    } finally { setSaving(false); }
  };

  const getDisplayAmount = (line: any, field: 'amountN' | 'amountN1') => {
    const edited = editedAmounts[line.id]?.[field];
    return edited !== undefined ? edited : Number(line[field] || 0);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      {/* Header + sélecteur type */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-slate-900">États financiers SYSCOHADA</h3>
          <p className="text-xs text-slate-500 mt-0.5">Bilan, Compte de Résultat, TFT — Année : {currentYear?.name || 'N/A'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={type} onChange={e => setType(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6]">
            {STATEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button onClick={handleSave} disabled={saving || Object.keys(editedAmounts).length === 0} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg bg-[#1A2BA6] hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
          </button>
          <button onClick={() => window.open(hrUrl('taxes/financial-statements-pdf', { tenantId: tenant?.id, academicYearId: currentYear?.id, type }), '_blank')} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-[#1A2BA6] border border-[#1A2BA6]/20 rounded-lg hover:bg-[#1A2BA6]/5 transition" title="Visualiser le PDF">
            <Eye className="h-4 w-4" /> Voir
          </button>
          <button onClick={() => { const w = window.open(hrUrl('taxes/financial-statements-pdf', { tenantId: tenant?.id, academicYearId: currentYear?.id, type }), '_blank'); w?.addEventListener('load', () => w.print()); }} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition" title="Imprimer">
            <Printer className="h-4 w-4" /> Imprimer
          </button>
          <button onClick={() => window.open(hrUrl('taxes/financial-statements-pdf', { tenantId: tenant?.id, academicYearId: currentYear?.id, type }), '_blank')} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 transition" title="Télécharger PDF">
            <Download className="h-4 w-4" /> PDF
          </button>
          <button onClick={() => window.open(hrUrl('taxes/export/financial-statements', { tenantId: tenant?.id, academicYearId: currentYear?.id, type }), '_blank')} className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition" title="Télécharger Excel">
            <Download className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      {/* Tableau éditable */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-16">Réf</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Libellé</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600 w-12">Note</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600 w-40">Exercice N</th>
              <th className="text-right px-4 py-3 font-semibold text-slate-600 w-40">Exercice N-1</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const isBold = line.isSubtotal || line.isTotal;
              const hasEdited = editedAmounts[line.id];
              return (
                <tr key={line.id} className={`border-b border-slate-100 ${isBold ? 'bg-slate-50 font-bold' : i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                  <td className="px-4 py-2 text-xs font-mono text-slate-400">{line.lineCode}</td>
                  <td className="px-4 py-2 text-slate-800">
                    {isBold && <Table className="inline h-3 w-3 mr-1 text-[#1A2BA6]" />}
                    {line.lineLabel}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400">{line.note || ''}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={getDisplayAmount(line, 'amountN')}
                      onChange={e => handleAmountChange(line.id, 'amountN', e.target.value)}
                      className={`w-full px-2 py-1 text-right border rounded text-sm focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6] ${hasEdited ? 'border-amber-300 bg-amber-50' : 'border-transparent'}`}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={getDisplayAmount(line, 'amountN1')}
                      onChange={e => handleAmountChange(line.id, 'amountN1', e.target.value)}
                      className={`w-full px-2 py-1 text-right border rounded text-sm focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6] ${hasEdited?.amountN1 !== undefined ? 'border-amber-300 bg-amber-50' : 'border-transparent'}`}
                    />
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-slate-400">Aucune donnée — le référentiel SYSCOHADA sera initialisé automatiquement.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {Object.keys(editedAmounts).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm text-amber-800 font-medium">{Object.keys(editedAmounts).length} ligne(s) modifiée(s) — n'oubliez pas d'enregistrer</p>
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-xs font-bold text-white rounded-lg bg-amber-600 hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Enregistrer'}
          </button>
        </div>
      )}
    </div>
  );
}
