'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, RefreshCw, Calendar, BookOpen, FileDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { cn } from '@/lib/utils';
import { ModuleContainer } from '@/components/modules/blueprint';
import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';
import { useAppSession } from '@/contexts/AppSessionContext';

const CLASS_LEVELS = [
  { value: 'MATERNELLE_GRANDS', label: 'Maternelle' },
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

// ⭐ Domaines SANS préfixe (doivent matcher le seed data)
const MATERNELLE_DOMAINS = [
  { domain: 'Education pour la santé', subDomains: ['Passage aux toilettes', 'Lavage des mains', 'Goûters'] },
  { domain: 'Expression corporelle', subDomains: ['Expression corporelle'] },
  { domain: 'Pré-lecture / Pré-écriture / Pré-mathématique', subDomains: ['Pré-lecture', 'Pré-écriture', 'Pré-mathématique', 'Observation', 'Education sensorielle', 'Travaux manuels'] },
  { domain: 'Expression plastique / Expression émotionnelle', subDomains: ['Expression plastique', 'Expression émotionnelle'] },
  { domain: 'Poésie / Chant / Contes / Comptine / Communication orale', subDomains: ['Poésie', 'Chant', 'Contes', 'Comptine', 'Communication orale'] },
];

// ⭐ Mois maternelle en ordre (pour pagination)
const MATERNELLE_MONTHS = [
  { month: 'Septembre', trimester: 1 },
  { month: 'Octobre', trimester: 1 },
  { month: 'Novembre', trimester: 1 },
  { month: 'Décembre', trimester: 1 },
  { month: 'Janvier', trimester: 2 },
  { month: 'Février', trimester: 2 },
  { month: 'Mars', trimester: 2 },
  { month: 'Avril', trimester: 3 },
  { month: 'Mai', trimester: 3 },
  { month: 'Juin', trimester: 3 },
];

// ⭐ Semaines pour chaque mois maternelle (variable selon le mois)
const MATERNELLE_MONTH_WEEKS: Record<string, string[]> = {
  'Septembre': ['3ème semaine', '4ème semaine'],
  'Octobre': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine', '5ème semaine'],
  'Novembre': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'],
  'Décembre': ['Congés'],
  'Janvier': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'],
  'Février': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'],
  'Mars': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'],
  'Avril': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'],
  'Mai': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'],
  'Juin': ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'],
};

const TRIMESTER_LABELS: Record<number, string> = { 1: '1er Trim.', 2: '2e Trim.', 3: '3e Trim.' };
const TRIMESTER_COLORS: Record<number, string> = { 1: 'bg-blue-500', 2: 'bg-emerald-500', 3: 'bg-amber-500' };

interface AnnualPlan {
  id: string; classLevel: string; trimester: number; month: string; week: string;
  domain: string; subDomain?: string; content: string; isCustom: boolean;
}

export default function TeacherAnnualPlanningPage() {
  const { user } = useAppSession();
  const userRole = user?.role || '';
  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Planification annuelle',
        description: academicYear
          ? `Planification pédagogique annuelle officielle — année ${academicYear.label} (lecture seule)`
          : 'Planification pédagogique annuelle officielle (lecture seule)',
        icon: 'book',
      }}
      subModules={{
        modules: getVisiblePedagogyTabs(userRole).map((tab) => {
          const Icon = tab.icon;
          return { id: tab.id, label: tab.label, href: tab.path, icon: <Icon className="w-4 h-4" /> };
        }),
        activeModuleId: 'annual-planning',
      }}
      content={{ layout: 'custom', children: <TeacherAnnualPlanningContent /> }}
    />
  );
}

function TeacherAnnualPlanningContent() {
  const { academicYear } = useModuleContext();
  const { currentLevel } = useSchoolLevel();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('MATERNELLE_GRANDS');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [maternellePage, setMaternellePage] = useState(0);

  const isMaternelle = selectedClass === 'MATERNELLE_GRANDS';
  const currentMonthData = MATERNELLE_MONTHS[maternellePage] || MATERNELLE_MONTHS[0];
  const currentWeeks = MATERNELLE_MONTH_WEEKS[currentMonthData.month] || [];

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

  useEffect(() => { loadPlans(); setMaternellePage(0); }, [loadPlans]);

  const getPrimaireContent = (tri: number, month: string, domainKey: string) =>
    plans.find(p => p.trimester === tri && p.month === month && (p.domain === domainKey || p.subDomain === domainKey));

  const getMaternelleContent = (domain: string, subDomain: string, month: string, week: string) =>
    plans.find(p => p.domain === domain && p.subDomain === subDomain && p.month === month && p.week === week);

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
      {/* Header + selectors */}
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
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium">
            {CLASS_LEVELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button onClick={async () => {
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
          }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold">
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} PDF
          </button>
          <button onClick={loadPlans} className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100" title="Rafraîchir">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* TABLEAU */}
      {plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucune planification disponible pour {CLASS_LEVELS.find(c => c.value === selectedClass)?.label}.</p>
          <p className="text-xs text-slate-400 mt-1">La direction n'a pas encore initialisé la planification.</p>
        </div>
      ) : isMaternelle ? (
        // ═══ TABLEAU MATERNELLE AVEC PAGINATION (un mois par page) ═══
        <div className="space-y-3">
          {/* Pagination header */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-3">
            <button
              onClick={() => setMaternellePage(p => Math.max(0, p - 1))}
              disabled={maternellePage === 0}
              className="p-2 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <span className={cn('inline-block px-3 py-1 rounded-full text-xs font-bold text-white', TRIMESTER_COLORS[currentMonthData.trimester])}>
                {TRIMESTER_LABELS[currentMonthData.trimester]}
              </span>
              <span className="ml-2 text-sm font-bold text-slate-700">{currentMonthData.month}</span>
              <span className="ml-2 text-xs text-slate-400">Page {maternellePage + 1}/{MATERNELLE_MONTHS.length}</span>
            </div>
            <button
              onClick={() => setMaternellePage(p => Math.min(MATERNELLE_MONTHS.length - 1, p + 1))}
              disabled={maternellePage === MATERNELLE_MONTHS.length - 1}
              className="p-2 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Table for current month — prend TOUTE la largeur disponible */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
            <table className="text-xs border-collapse w-full table-fixed">
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '14%' }} />
                {currentWeeks.map((wk, i) => (
                  <col key={i} style={{ width: `${68 / Math.max(currentWeeks.length, 1)}%` }} />
                ))}
              </colgroup>
              <thead>
                <tr className={cn('text-white', TRIMESTER_COLORS[currentMonthData.trimester])}>
                  <th className="p-2 border border-blue-300 text-left">Domaines</th>
                  <th className="p-2 border border-blue-300 text-left">Sous-domaine</th>
                  {currentWeeks.map(wk => (
                    <th key={wk} className="p-2 border border-blue-300 text-center">{wk}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATERNELLE_DOMAINS.map(dom => (
                  <React.Fragment key={dom.domain}>
                    <tr className="bg-slate-100">
                      <td colSpan={2 + currentWeeks.length} className="p-2 font-bold text-slate-700 border border-slate-300">
                        {dom.domain}
                      </td>
                    </tr>
                    {dom.subDomains.map(sub => (
                      <tr key={`${dom.domain}-${sub}`} className="hover:bg-blue-50/30">
                        <td className="p-1 border border-slate-200 bg-slate-50">&nbsp;</td>
                        <td className="p-1 border border-slate-200 font-semibold text-slate-600 bg-white">{sub}</td>
                        {currentWeeks.map(wk => {
                          const plan = getMaternelleContent(dom.domain, sub, currentMonthData.month, wk);
                          return (
                            <td key={wk} className="p-1 border border-slate-200 align-top">
                              {plan ? (
                                <div className={cn('text-[9px] leading-tight p-1 rounded', plan.isCustom ? 'bg-amber-50 text-amber-900' : 'text-slate-700')}>
                                  {plan.content}
                                </div>
                              ) : <span className="text-slate-300">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // ═══ TABLEAU PRIMAIRE (tous trimestres en une seule table) ═══
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
          <table className="text-xs border-collapse" style={{ minWidth: '1800px' }}>
            <thead>
              <tr className="bg-blue-600 text-white">
                {groupHeaders.map((g, i) => (
                  <th key={i} colSpan={g.colCount} className={cn('p-2 border border-blue-400 text-center font-bold', g.group === 'Éducation Sociale' ? 'bg-indigo-500' : g.group === 'Éducation Artistique' ? 'bg-purple-500' : 'bg-blue-600')}>{g.group || ''}</th>
                ))}
              </tr>
              <tr className="bg-blue-400 text-white">
                {PRIMAIRE_COLUMNS.map(col => (
                  <th key={col.key} className={cn('p-2 border border-blue-300 text-center font-bold', col.key === 'trimester' ? 'bg-blue-500 sticky left-0 z-10 min-w-[60px]' : col.key === 'month' ? 'bg-blue-500 sticky left-[60px] z-10 min-w-[80px]' : col.group === 'Éducation Sociale' ? 'bg-indigo-400' : col.group === 'Éducation Artistique' ? 'bg-purple-400' : 'bg-blue-400')}>{col.label}</th>
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
                            <div className={cn('text-[9px] leading-tight p-0.5 rounded', plan.isCustom ? 'bg-amber-50 text-amber-900' : 'text-slate-700')}>{plan.content}</div>
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
        Pour la Maternelle, naviguez entre les mois avec les flèches ← →.
      </div>
    </div>
  );
}

// ⭐ React.Fragment est importé via React en haut de fichier
