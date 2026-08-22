'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, RefreshCw, Calendar, BookOpen, FileDown,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { cn } from '@/lib/utils';

const CLASS_LEVELS = [
  { value: 'MATERNELLE_GRANDS', label: 'Maternelle (Grands)' },
  { value: 'CI', label: 'CI' },
  { value: 'CP', label: 'CP' },
  { value: 'CE1', label: 'CE1' },
  { value: 'CE2', label: 'CE2' },
  { value: 'CM1', label: 'CM1' },
  { value: 'CM2', label: 'CM2' },
];

const PRIMAIRE_COLUMNS = [
  { group: '', key: 'trimester', label: 'Trim.' },
  { group: '', key: 'month', label: 'Mois' },
  { group: '', key: 'Français', label: 'Français' },
  { group: '', key: 'Mathématiques', label: 'Maths' },
  { group: '', key: 'EST', label: 'EST' },
  { group: '', key: 'EPS', label: 'EPS' },
  { group: 'Éducation Sociale', key: 'Morale', label: 'Morale' },
  { group: 'Éducation Sociale', key: 'Civisme', label: 'Civisme' },
  { group: 'Éducation Sociale', key: 'Histoire', label: 'Histoire' },
  { group: 'Éducation Sociale', key: 'Géographie', label: 'Géographie' },
  { group: 'Éducation Artistique', key: 'Chant', label: 'Chant' },
  { group: 'Éducation Artistique', key: 'Poésie', label: 'Poésie' },
  { group: 'Éducation Artistique', key: 'Conte', label: 'Conte' },
  { group: 'Éducation Artistique', key: 'Dessin', label: 'Dessin' },
  { group: 'Éducation Artistique', key: 'Couture', label: 'Couture' },
];

const PRIMAIRE_ROWS = [
  { trimester: 1, month: 'Septembre' }, { trimester: 1, month: 'Octobre' },
  { trimester: 1, month: 'Novembre' }, { trimester: 1, month: 'Décembre' },
  { trimester: 2, month: 'Janvier' }, { trimester: 2, month: 'Février' },
  { trimester: 2, month: 'Mars' },
  { trimester: 3, month: 'Avril' }, { trimester: 3, month: 'Mai' },
  { trimester: 3, month: 'Juin' },
];

const MATERNELLE_DOMAINS = [
  { domain: 'I. Education pour la santé', subDomains: ['Passage aux toilettes', 'Lavage des mains', 'Goûters'] },
  { domain: 'II. Expression corporelle', subDomains: ['Expression corporelle'] },
  { domain: 'III. Pré-lecture / Pré-écriture / Pré-mathématique', subDomains: ['Pré-lecture', 'Pré-écriture', 'Pré-mathématique', 'Observation', 'Education sensorielle', 'Travaux manuels'] },
  { domain: 'IV. Expression plastique / Expression émotionnelle', subDomains: ['Expression plastique', 'Expression émotionnelle'] },
  { domain: 'V. Poésie / Chant / Contes / Comptine / Communication orale', subDomains: ['Poésie', 'Chant', 'Contes', 'Comptine', 'Communication orale'] },
];

const MATERNELLE_WEEKS = [
  'Septembre 3ème', 'Septembre 4ème',
  'Octobre 1ère', 'Octobre 2ème', 'Octobre 3ème', 'Octobre 4ème', 'Octobre 5ème',
  'Novembre 1ère', 'Novembre 2ème', 'Novembre 3ème', 'Novembre 4ème',
  'Décembre Congés',
  'Janvier 1ère', 'Janvier 2ème', 'Janvier 3ème', 'Janvier 4ème',
  'Février 1ère', 'Février 2ème', 'Février 3ème', 'Février 4ème',
  'Mars 1ère', 'Mars 2ème', 'Mars 3ème', 'Mars 4ème',
  'Avril 1ère', 'Avril 2ème', 'Avril 3ème', 'Avril 4ème',
  'Mai 1ère', 'Mai 2ème', 'Mai 3ème', 'Mai 4ème',
  'Juin 1ère', 'Juin 2ème', 'Juin 3ème', 'Juin 4ème',
];

const TRIMESTER_LABELS: Record<number, string> = { 1: '1er Trim.', 2: '2e Trim.', 3: '3e Trim.' };

interface AnnualPlan {
  id: string; classLevel: string; trimester: number; month: string; week: string;
  domain: string; subDomain?: string; content: string; isCustom: boolean;
}

export default function TeacherAnnualPlanningPage() {
  const { academicYear } = useModuleContext();
  const { currentLevel } = useSchoolLevel();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('CM2');
  const [exportingPdf, setExportingPdf] = useState(false);

  const isMaternelle = selectedClass === 'MATERNELLE_GRANDS';

  const loadPlans = useCallback(async () => {
    if (!academicYear?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await pedagogyFetch<AnnualPlan[]>(
        `/api/pedagogy/annual-plans?academicYearId=${academicYear.id}&classLevel=${selectedClass}`
      );
      setPlans(Array.isArray(data) ? data : []);
    } catch (e) { console.error('Failed to load:', e); }
    finally { setLoading(false); }
  }, [academicYear?.id, selectedClass]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  const getPrimaireContent = (tri: number, month: string, domainKey: string) =>
    plans.find(p => p.trimester === tri && p.month === month && (p.domain === domainKey || p.subDomain === domainKey));

  const getMaternelleContent = (domain: string, subDomain: string, week: string) =>
    plans.find(p => p.domain === domain && p.subDomain === subDomain && p.week === week);

  const groupHeaders = useMemo(() => {
    const groups: { group: string; colCount: number }[] = [];
    for (const col of PRIMAIRE_COLUMNS) {
      if (col.group) {
        const existing = groups.find(g => g.group === col.group);
        if (existing) existing.colCount++;
        else groups.push({ group: col.group, colCount: 1 });
      } else {
        groups.push({ group: '', colCount: 1 });
      }
    }
    return groups;
  }, []);

  const getTrimesterBg = (tri: number) => tri === 1 ? 'bg-blue-50/30' : tri === 2 ? 'bg-emerald-50/30' : 'bg-amber-50/30';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
        <span className="ml-2 text-sm text-slate-500">Chargement de la planification…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + selectors — LECTURE SEULE pour enseignant */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <BookOpen className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Planification pédagogique annuelle</h2>
            <p className="text-xs text-slate-500">
              {CLASS_LEVELS.find(c => c.value === selectedClass)?.label} — {academicYear?.label || ''} (lecture seule)
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
          <button
            onClick={async () => {
              setExportingPdf(true);
              try {
                const res = await fetch(`/api/pedagogy/annual-plans/export-pdf?academicYearId=${academicYear?.id}&classLevel=${selectedClass}`, { credentials: 'include' });
                if (!res.ok) throw new Error('Erreur génération PDF');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `planification_${selectedClass}.pdf`; a.click();
                URL.revokeObjectURL(url);
              } catch (e: any) { console.error(e); }
              finally { setExportingPdf(false); }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold"
          >
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} PDF
          </button>
          <button onClick={loadPlans} className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100" title="Rafraîchir">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* TABLEAU — même structure que director UI mais SANS édition */}
      {plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucune planification disponible pour {CLASS_LEVELS.find(c => c.value === selectedClass)?.label}.</p>
          <p className="text-xs text-slate-400 mt-1">La direction n'a pas encore initialisé la planification.</p>
        </div>
      ) : isMaternelle ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
          <table className="text-xs border-collapse" style={{ minWidth: '2400px' }}>
            <thead>
              <tr className="bg-slate-800 text-white">
                <th rowSpan={2} className="p-2 border border-slate-600 text-left sticky left-0 bg-slate-800 z-10 min-w-[180px]">Domaines</th>
                <th rowSpan={2} className="p-2 border border-slate-600 text-left sticky left-[180px] bg-slate-800 z-10 min-w-[120px]">Sous-domaine</th>
                <th colSpan={12} className="p-2 border border-slate-600 text-center bg-blue-900">1er Trimestre</th>
                <th colSpan={12} className="p-2 border border-slate-600 text-center bg-emerald-900">2e Trimestre</th>
                <th colSpan={12} className="p-2 border border-slate-600 text-center bg-amber-900">3e Trimestre</th>
              </tr>
              <tr className="bg-slate-700 text-white">
                {MATERNELLE_WEEKS.map((w, i) => (
                  <th key={w} className={cn('p-1 border border-slate-600 text-center min-w-[80px] font-bold', i < 12 ? 'bg-blue-800' : i < 24 ? 'bg-emerald-800' : 'bg-amber-800')}>
                    {w.replace('Septembre ', 'Sept ').replace('Octobre ', 'Oct ').replace('Novembre ', 'Nov ')
                       .replace('Décembre ', 'Déc ').replace('Janvier ', 'Jan ').replace('Février ', 'Fév ')
                       .replace('Mars ', 'Mars ').replace('Avril ', 'Avr ').replace('Mai ', 'Mai ').replace('Juin ', 'Juin ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATERNELLE_DOMAINS.map(dom => (
                <>
                  <tr key={dom.domain} className="bg-slate-100">
                    <td colSpan={2 + MATERNELLE_WEEKS.length} className="p-2 font-bold text-slate-700 border border-slate-300">{dom.domain}</td>
                  </tr>
                  {dom.subDomains.map(sub => (
                    <tr key={`${dom.domain}-${sub}`} className="hover:bg-blue-50/30">
                      <td className="p-1 border border-slate-200 bg-slate-50 sticky left-0 z-10"></td>
                      <td className="p-1 border border-slate-200 font-semibold text-slate-600 sticky left-[180px] z-10 bg-white">{sub}</td>
                      {MATERNELLE_WEEKS.map(week => {
                        const plan = getMaternelleContent(dom.domain, sub, week);
                        return (
                          <td key={week} className="p-1 border border-slate-200 align-top min-w-[80px]">
                            {plan ? (
                              <div className={cn('text-[8px] leading-tight p-0.5 rounded', plan.isCustom ? 'bg-amber-50 text-amber-900' : 'text-slate-700')}>
                                {plan.content}
                              </div>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
          <table className="text-xs border-collapse" style={{ minWidth: '1800px' }}>
            <thead>
              <tr className="bg-slate-800 text-white">
                {groupHeaders.map((g, i) => (
                  <th key={i} colSpan={g.colCount} className={cn('p-2 border border-slate-600 text-center font-bold', g.group === 'Éducation Sociale' ? 'bg-indigo-800' : g.group === 'Éducation Artistique' ? 'bg-purple-800' : 'bg-slate-800')}>{g.group || ''}</th>
                ))}
              </tr>
              <tr className="bg-slate-700 text-white">
                {PRIMAIRE_COLUMNS.map(col => (
                  <th key={col.key} className={cn('p-2 border border-slate-600 text-center font-bold', col.key === 'trimester' ? 'bg-blue-800 sticky left-0 z-10 min-w-[60px]' : col.key === 'month' ? 'bg-blue-800 sticky left-[60px] z-10 min-w-[80px]' : col.group === 'Éducation Sociale' ? 'bg-indigo-700' : col.group === 'Éducation Artistique' ? 'bg-purple-700' : 'bg-slate-700')}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PRIMAIRE_ROWS.map((row, idx) => {
                const prev = idx > 0 ? PRIMAIRE_ROWS[idx - 1] : null;
                const showTri = !prev || prev.trimester !== row.trimester;
                return (
                  <tr key={idx} className={cn('border-b border-slate-200', getTrimesterBg(row.trimester))}>
                    <td className="p-2 border border-slate-200 font-bold text-center text-slate-600 sticky left-0 z-10 bg-inherit">{showTri ? TRIMESTER_LABELS[row.trimester] : ''}</td>
                    <td className="p-2 border border-slate-200 font-bold text-slate-700 sticky left-[60px] z-10 bg-inherit">{row.month}</td>
                    {PRIMAIRE_COLUMNS.slice(2).map(col => {
                      const plan = getPrimaireContent(row.trimester, row.month, col.key);
                      return (
                        <td key={col.key} className={cn('p-1 border border-slate-200 align-top min-w-[100px]', col.group === 'Éducation Sociale' ? 'bg-indigo-50/30' : col.group === 'Éducation Artistique' ? 'bg-purple-50/30' : '')}>
                          {plan ? (
                            <div className={cn('text-[9px] leading-tight p-0.5 rounded', plan.isCustom ? 'bg-amber-50 text-amber-900' : 'text-slate-700')}>
                              {plan.content}
                            </div>
                          ) : <span className="text-slate-300 text-[9px]">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">
        <strong>📖 Planification officielle :</strong> Consultez la planification pédagogique annuelle de chaque niveau.
        Vous pouvez naviguer entre toutes les classes (Maternelle, CI, CP, CE1, CE2, CM1, CM2) via le sélecteur.
        Le bouton PDF vous permet de télécharger la planification d'une classe.
      </div>
    </div>
  );
}
