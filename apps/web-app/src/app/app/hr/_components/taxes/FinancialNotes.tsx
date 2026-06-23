'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, FileText, Save } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';

export function FinancialNotes() {
  const { tenant } = useModuleContext();
  const { currentYear } = useAcademicYear();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<string>('');
  const [editedAmounts, setEditedAmounts] = useState<Record<string, { amountN?: number; amountN1?: number }>>({});

  useEffect(() => {
    if (!tenant?.id || !currentYear?.id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await hrFetch<any[]>(hrUrl('taxes/financial-notes', { tenantId: tenant.id, academicYearId: currentYear.id }));
        setNotes(Array.isArray(res) ? res : []);
        if (res.length > 0) setSelectedNote(res[0].noteCode);
      } catch {} finally { setLoading(false); }
    })();
  }, [tenant?.id, currentYear?.id]);

  const noteCodes = useMemo(() => {
    const codes = [...new Set(notes.map(n => n.noteCode))];
    return codes.sort();
  }, [notes]);

  const currentNoteLines = useMemo(() => {
    return notes.filter(n => n.noteCode === selectedNote).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [notes, selectedNote]);

  const currentNoteTitle = currentNoteLines[0]?.noteTitle || '';

  const handleSave = async (id: string) => {
    const edits = editedAmounts[id];
    if (!edits) return;
    try {
      await hrFetch(hrUrl(`taxes/financial-notes/${id}`, { tenantId: tenant.id }), { method: 'PUT', body: edits });
      toast({ variant: 'success', title: 'Ligne enregistrée' });
      setEditedAmounts(prev => { const c = { ...prev }; delete c[id]; return c; });
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-900">Notes annexes SYSCOHADA</h3>
        <p className="text-xs text-slate-500 mt-0.5">36 notes annexes — Année : {currentYear?.name || 'N/A'}</p>
      </div>

      <div className="flex gap-4">
        {/* Liste des notes */}
        <div className="w-56 shrink-0 bg-white rounded-xl border border-slate-200 p-2 max-h-[600px] overflow-y-auto">
          {noteCodes.map(code => {
            const noteLines = notes.filter(n => n.noteCode === code);
            const title = noteLines[0]?.noteTitle || code;
            return (
              <button
                key={code}
                onClick={() => setSelectedNote(code)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition mb-0.5 ${selectedNote === code ? 'bg-[#1A2BA6] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <div className="font-bold">{code}</div>
                <div className={`text-[10px] truncate ${selectedNote === code ? 'text-blue-100' : 'text-slate-400'}`}>{title}</div>
              </button>
            );
          })}
        </div>

        {/* Tableau de la note sélectionnée */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#1A2BA6]" />
              <h4 className="text-sm font-bold text-slate-900">{selectedNote} — {currentNoteTitle}</h4>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-slate-600">Libellé</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-600 w-40">Année N</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-600 w-40">Année N-1</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {currentNoteLines.map((line, i) => {
                  const hasEdit = !!editedAmounts[line.id];
                  return (
                    <tr key={line.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                      <td className="px-4 py-2 text-slate-700">{line.lineLabel}</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={editedAmounts[line.id]?.amountN ?? Number(line.amountN || 0)}
                          onChange={e => setEditedAmounts(prev => ({ ...prev, [line.id]: { ...prev[line.id], amountN: parseFloat(e.target.value) || 0 } }))}
                          className={`w-full px-2 py-1 text-right border rounded text-sm focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6] ${hasEdit ? 'border-amber-300 bg-amber-50' : 'border-transparent'}`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={editedAmounts[line.id]?.amountN1 ?? Number(line.amountN1 || 0)}
                          onChange={e => setEditedAmounts(prev => ({ ...prev, [line.id]: { ...prev[line.id], amountN1: parseFloat(e.target.value) || 0 } }))}
                          className={`w-full px-2 py-1 text-right border rounded text-sm focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6] ${hasEdit ? 'border-amber-300 bg-amber-50' : 'border-transparent'}`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        {hasEdit && (
                          <button onClick={() => handleSave(line.id)} className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100" title="Enregistrer">
                            <Save className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
