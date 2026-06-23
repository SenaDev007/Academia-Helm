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
  const [editedCells, setEditedCells] = useState<Record<string, any>>({});

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

  const noteCodes = useMemo(() => [...new Set(notes.map(n => n.noteCode))].sort(), [notes]);

  const currentNoteLines = useMemo(() =>
    notes.filter(n => n.noteCode === selectedNote).sort((a, b) => a.sortOrder - b.sortOrder),
  [notes, selectedNote]);

  // Extraire les colonnes spécifiques de la première ligne (metadata.columns)
  const noteColumns = useMemo(() => {
    if (currentNoteLines.length === 0) return null;
    const meta = currentNoteLines[0]?.metadata as any;
    return meta?.columns || null;
  }, [currentNoteLines]);

  const currentNoteTitle = currentNoteLines[0]?.noteTitle || '';

  const handleSave = async (id: string) => {
    const edits = editedCells[id];
    if (!edits) return;
    try {
      await hrFetch(hrUrl(`taxes/financial-notes/${id}`, { tenantId: tenant.id }), { method: 'PUT', body: edits });
      toast({ variant: 'success', title: 'Ligne enregistrée' });
      setEditedCells(prev => { const c = { ...prev }; delete c[id]; return c; });
    } catch (e: any) {
      toast({ variant: 'error', title: 'Erreur', description: e.message });
    }
  };

  const getCellValue = (line: any, field: string) => {
    const edited = editedCells[line.id]?.[field];
    if (edited !== undefined) return edited;
    if (field === 'amountN') return Number(line.amountN || 0);
    if (field === 'amountN1') return Number(line.amountN1 || 0);
    // Pour les colonnes spécifiques, stocker dans metadata
    const meta = line.metadata as any || {};
    return meta[field] ?? 0;
  };

  const handleCellChange = (lineId: string, field: string, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    setEditedCells(prev => ({
      ...prev,
      [lineId]: { ...prev[lineId], [field]: numValue },
    }));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  // Définir les colonnes à afficher
  const displayColumns = noteColumns
    ? noteColumns.map((col: string, i: number) => ({ key: i === 0 ? 'amountN' : i === 1 ? 'amountN1' : `col_${i}`, label: col }))
    : [
        { key: 'amountN', label: 'Année N' },
        { key: 'amountN1', label: 'Année N-1' },
      ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-bold text-slate-900">Notes annexes SYSCOHADA</h3>
        <p className="text-xs text-slate-500 mt-0.5">36 notes — Année : {currentYear?.name || 'N/A'}</p>
      </div>

      <div className="flex gap-4">
        {/* Liste des notes */}
        <div className="w-56 shrink-0 bg-white rounded-xl border border-slate-200 p-2 max-h-[600px] overflow-y-auto">
          {noteCodes.map(code => {
            const noteLines = notes.filter(n => n.noteCode === code);
            const title = noteLines[0]?.noteTitle || code;
            const hasColumns = (noteLines[0]?.metadata as any)?.columns;
            return (
              <button
                key={code}
                onClick={() => setSelectedNote(code)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition mb-0.5 ${selectedNote === code ? 'bg-[#1A2BA6] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <div className="font-bold flex items-center gap-1">
                  {code}
                  {hasColumns && <span className="text-[8px] px-1 rounded bg-amber-200 text-amber-800">cols</span>}
                </div>
                <div className={`text-[10px] truncate ${selectedNote === code ? 'text-blue-100' : 'text-slate-400'}`}>{title}</div>
              </button>
            );
          })}
        </div>

        {/* Tableau de la note sélectionnée */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden overflow-x-auto">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#1A2BA6]" />
              <h4 className="text-sm font-bold text-slate-900">{selectedNote} — {currentNoteTitle}</h4>
              {noteColumns && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">{noteColumns.length} colonnes</span>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-slate-600 min-w-[200px]">Libellé</th>
                  {displayColumns.map((col: any) => (
                    <th key={col.key} className="text-right px-3 py-2 font-semibold text-slate-600 whitespace-nowrap min-w-[100px]">{col.label}</th>
                  ))}
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {currentNoteLines.map((line, i) => {
                  const hasEdit = !!editedCells[line.id];
                  return (
                    <tr key={line.id} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                      <td className="px-4 py-2 text-slate-700">{line.lineLabel}</td>
                      {displayColumns.map((col: any) => (
                        <td key={col.key} className="px-2 py-2">
                          <input
                            type="number"
                            value={getCellValue(line, col.key)}
                            onChange={e => handleCellChange(line.id, col.key, e.target.value)}
                            className={`w-full px-2 py-1 text-right border rounded text-sm focus:ring-2 focus:ring-[#1A2BA6]/20 focus:border-[#1A2BA6] ${hasEdit ? 'border-amber-300 bg-amber-50' : 'border-transparent'}`}
                          />
                        </td>
                      ))}
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
