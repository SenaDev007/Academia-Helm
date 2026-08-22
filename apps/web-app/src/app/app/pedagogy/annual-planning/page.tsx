'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, RefreshCw, Calendar, BookOpen, AlertCircle,
  Save, ChevronLeft, ChevronRight, Pencil, Check, X,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

const CLASS_LEVELS = [
  { value: 'MATERNELLE_GRANDS', label: 'Maternelle (Grands)', level: 'MATERNELLE' },
  { value: 'CI', label: 'CI', level: 'PRIMAIRE' },
  { value: 'CP', label: 'CP', level: 'PRIMAIRE' },
  { value: 'CE1', label: 'CE1', level: 'PRIMAIRE' },
  { value: 'CE2', label: 'CE2', level: 'PRIMAIRE' },
  { value: 'CM1', label: 'CM1', level: 'PRIMAIRE' },
  { value: 'CM2', label: 'CM2', level: 'PRIMAIRE' },
];

const TRIMESTERS = [
  { value: 1, label: '1er Trimestre' },
  { value: 2, label: '2ème Trimestre' },
  { value: 3, label: '3ème Trimestre' },
];

interface AnnualPlan {
  id: string;
  classLevel: string;
  trimester: number;
  month: string;
  week: string;
  domain: string;
  subDomain?: string;
  content: string;
  isCustom: boolean;
}

export default function AnnualPlanningPage() {
  const { academicYear } = useModuleContext();
  const { currentLevel } = useSchoolLevel();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('MATERNELLE_GRANDS');
  const [selectedTrimester, setSelectedTrimester] = useState<number>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const loadPlans = useCallback(async () => {
    if (!academicYear?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await pedagogyFetch<AnnualPlan[]>(
        `/api/pedagogy/annual-plans?academicYearId=${academicYear.id}&classLevel=${selectedClass}&trimester=${selectedTrimester}`
      );
      setPlans(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Failed to load plans:', e);
      // Auto-seed si pas de données
      if (currentLevel?.schoolLevelId) {
        try {
          await pedagogyFetch('/api/pedagogy/annual-plans/seed', {
            method: 'POST',
            body: { academicYearId: academicYear.id, schoolLevelId: currentLevel.schoolLevelId },
          });
          // Retry load
          const data2 = await pedagogyFetch<AnnualPlan[]>(
            `/api/pedagogy/annual-plans?academicYearId=${academicYear.id}&classLevel=${selectedClass}&trimester=${selectedTrimester}`
          );
          setPlans(Array.isArray(data2) ? data2 : []);
        } catch (seedErr) {
          console.error('Seed failed:', seedErr);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, selectedClass, selectedTrimester, currentLevel?.schoolLevelId]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  // Group plans by month → week → domain
  const groupedPlans = useMemo(() => {
    const byMonth: Record<string, Record<string, Record<string, AnnualPlan[]>>> = {};
    for (const p of plans) {
      if (!byMonth[p.month]) byMonth[p.month] = {};
      if (!byMonth[p.month][p.week]) byMonth[p.month][p.week] = {};
      if (!byMonth[p.month][p.week][p.domain]) byMonth[p.month][p.week][p.domain] = [];
      byMonth[p.month][p.week][p.domain].push(p);
    }
    return byMonth;
  }, [plans]);

  // Get unique weeks and domains
  const allWeeks = useMemo(() => {
    const weeks = new Set<string>();
    for (const p of plans) weeks.add(p.week);
    return Array.from(weeks);
  }, [plans]);

  const allDomains = useMemo(() => {
    const domains = new Set<string>();
    for (const p of plans) domains.add(p.domain);
    return Array.from(domains);
  }, [plans]);

  const allMonths = useMemo(() => {
    const months = new Set<string>();
    for (const p of plans) months.add(p.month);
    return Array.from(months);
  }, [plans]);

  const handleSaveEdit = async (planId: string) => {
    try {
      await pedagogyFetch(`/api/pedagogy/annual-plans/${planId}`, {
        method: 'PUT',
        body: { content: editContent },
      });
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, content: editContent, isCustom: true } : p));
      setEditingId(null);
      toast({ title: '✅ Planification mise à jour' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const isDirector = true; // Director UI — editable

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-sm text-slate-500">Chargement de la planification…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + selectors */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Planification pédagogique annuelle</h2>
            <p className="text-xs text-slate-500">
              {CLASS_LEVELS.find(c => c.value === selectedClass)?.label} — {TRIMESTERS.find(t => t.value === selectedTrimester)?.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium"
          >
            {CLASS_LEVELS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={selectedTrimester}
            onChange={(e) => setSelectedTrimester(parseInt(e.target.value, 10))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium"
          >
            {TRIMESTERS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            onClick={loadPlans}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100"
            title="Rafraîchir"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Planning table */}
      {plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucune planification disponible pour cette classe et ce trimestre.</p>
          <button
            onClick={async () => {
              if (currentLevel?.schoolLevelId && academicYear?.id) {
                try {
                  await pedagogyFetch('/api/pedagogy/annual-plans/seed', {
                    method: 'POST',
                    body: { academicYearId: academicYear.id, schoolLevelId: currentLevel.schoolLevelId },
                  });
                  loadPlans();
                  toast({ title: '✅ Planification initialisée' });
                } catch (e: any) {
                  toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
                }
              }
            }}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          >
            Initialiser la planification officielle
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
          <table className="w-full text-sm border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-3 text-left text-xs font-bold text-slate-700 border border-slate-200 sticky left-0 bg-slate-100 z-10 min-w-[200px]">
                  Domaine
                </th>
                {allMonths.map(month => (
                  <th key={month} className="p-3 text-center text-xs font-bold text-slate-700 border border-slate-200 min-w-[180px]">
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allDomains.map(domain => (
                <tr key={domain} className="hover:bg-slate-50/50">
                  <td className="p-3 border border-slate-200 font-bold text-xs text-slate-700 bg-slate-50 sticky left-0 z-10">
                    {domain}
                  </td>
                  {allMonths.map(month => {
                    const monthWeeks = groupedPlans[month] || {};
                    const domainPlans = Object.values(monthWeeks).flatMap(weeks => weeks[domain] || []);
                    if (domainPlans.length === 0) {
                      return <td key={month} className="p-2 border border-slate-200 text-center text-slate-300">—</td>;
                    }
                    // Group by subDomain
                    const bySubDomain: Record<string, AnnualPlan[]> = {};
                    for (const p of domainPlans) {
                      const sd = p.subDomain || '_';
                      if (!bySubDomain[sd]) bySubDomain[sd] = [];
                      bySubDomain[sd].push(p);
                    }
                    return (
                      <td key={month} className="p-2 border border-slate-200 align-top">
                        {Object.entries(bySubDomain).map(([subDomain, items]) => (
                          <div key={subDomain} className="mb-2">
                            {subDomain !== '_' && (
                              <div className="text-[10px] font-bold text-slate-500 mb-1">{subDomain}</div>
                            )}
                            {items.map(item => (
                              <div
                                key={item.id}
                                className={cn(
                                  'mb-1 p-1.5 rounded text-[10px] border',
                                  item.isCustom
                                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                                    : 'bg-blue-50 border-blue-200 text-slate-700'
                                )}
                              >
                                {editingId === item.id ? (
                                  <div className="space-y-1">
                                    <textarea
                                      value={editContent}
                                      onChange={e => setEditContent(e.target.value)}
                                      className="w-full px-1 py-0.5 border border-blue-300 rounded text-[10px] bg-white"
                                      rows={3}
                                      autoFocus
                                    />
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => handleSaveEdit(item.id)}
                                        className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[9px] font-bold"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => setEditingId(null)}
                                        className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-[9px]"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start justify-between gap-1">
                                    <span className="flex-1 leading-tight">{item.content}</span>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      {item.week !== 'Congés' && (
                                        <span className="text-[8px] text-slate-400">{item.week}</span>
                                      )}
                                      {isDirector && item.week !== 'Congés' && (
                                        <button
                                          onClick={() => { setEditingId(item.id); setEditContent(item.content); }}
                                          className="p-0.5 text-slate-400 hover:text-blue-600"
                                          title="Modifier"
                                        >
                                          <Pencil className="w-2.5 h-2.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {item.isCustom && (
                                  <span className="text-[7px] text-amber-600 font-bold">✏️ Modifié</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        <strong>ℹ️ Information :</strong> La planification affichée est conforme au programme officiel ministérielle (Bénin).
        La direction peut modifier les cellules (icône ✏️) pour personnaliser. Les modifications sont marquées "✏️ Modifié".
        Les enseignants consultent cette planification dans leur UI (lecture seule).
      </div>
    </div>
  );
}
