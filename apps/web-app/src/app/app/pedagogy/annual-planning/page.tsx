'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, RefreshCw, Calendar, Pencil, Check, X, FileDown,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { ModuleContainer } from '@/components/modules/blueprint';
import { getVisiblePedagogyTabs } from '@/components/pedagogy/pedagogy-tabs';
import { useAppSession } from '@/contexts/AppSessionContext';

// ═══════════════════════════════════════════════════════════════════
//  CONSTANTES — Structure exacte des tableaux (conforme aux PDFs)
// ═══════════════════════════════════════════════════════════════════

// Classes disponibles — 'Maternelle' (pas 'Maternelle (Grands)')
const CLASS_LEVELS = [
  { value: 'MATERNELLE_GRANDS', label: 'Maternelle' },
  { value: 'CI', label: 'CI' },
  { value: 'CP', label: 'CP' },
  { value: 'CE1', label: 'CE1' },
  { value: 'CE2', label: 'CE2' },
  { value: 'CM1', label: 'CM1' },
  { value: 'CM2', label: 'CM2' },
];

// Colonnes pour le tableau PRIMAIRE (CI à CM2) — EXACTEMENT comme le PDF
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

// Structure des mois par trimestre (pour PRIMAIRE)
const PRIMAIRE_ROWS = [
  // 1er Trimestre
  { trimester: 1, month: 'Septembre' },
  { trimester: 1, month: 'Octobre' },
  { trimester: 1, month: 'Novembre' },
  { trimester: 1, month: 'Décembre' },
  // 2e Trimestre
  { trimester: 2, month: 'Janvier' },
  { trimester: 2, month: 'Février' },
  { trimester: 2, month: 'Mars' },
  // 3e Trimestre
  { trimester: 3, month: 'Avril' },
  { trimester: 3, month: 'Mai' },
  { trimester: 3, month: 'Juin' },
];

// Domaines pour MATERNELLE — 5 domaines avec sous-domaines
const MATERNELLE_DOMAINS = [
  { domain: 'I. Education pour la santé', subDomains: ['Passage aux toilettes', 'Lavage des mains', 'Goûters'] },
  { domain: 'II. Expression corporelle', subDomains: ['Expression corporelle'] },
  { domain: 'III. Pré-lecture / Pré-écriture / Pré-mathématique', subDomains: ['Pré-lecture', 'Pré-écriture', 'Pré-mathématique', 'Observation', 'Education sensorielle', 'Travaux manuels'] },
  { domain: 'IV. Expression plastique / Expression émotionnelle', subDomains: ['Expression plastique', 'Expression émotionnelle'] },
  { domain: 'V. Poésie / Chant / Contes / Comptine / Communication orale', subDomains: ['Poésie', 'Chant', 'Contes', 'Comptine', 'Communication orale'] },
];

// Colonnes semaines pour MATERNELLE — tous les mois/semaines en une seule ligne
const MATERNELLE_WEEKS = [
  // 1er Trimestre
  'Septembre 3ème', 'Septembre 4ème',
  'Octobre 1ère', 'Octobre 2ème', 'Octobre 3ème', 'Octobre 4ème', 'Octobre 5ème',
  'Novembre 1ère', 'Novembre 2ème', 'Novembre 3ème', 'Novembre 4ème',
  'Décembre Congés',
  // 2e Trimestre
  'Janvier 1ère', 'Janvier 2ème', 'Janvier 3ème', 'Janvier 4ème',
  'Février 1ère', 'Février 2ème', 'Février 3ème', 'Février 4ème',
  'Mars 1ère', 'Mars 2ème', 'Mars 3ème', 'Mars 4ème',
  // 3e Trimestre
  'Avril 1ère', 'Avril 2ème', 'Avril 3ème', 'Avril 4ème',
  'Mai 1ère', 'Mai 2ème', 'Mai 3ème', 'Mai 4ème',
  'Juin 1ère', 'Juin 2ème', 'Juin 3ème', 'Juin 4ème',
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

const TRIMESTER_LABELS: Record<number, string> = { 1: '1er Trim.', 2: '2e Trim.', 3: '3e Trim.' };

export default function AnnualPlanningPage() {
  const { user } = useAppSession();
  const userRole = user?.role || '';
  const { academicYear } = useModuleContext();

  return (
    <ModuleContainer
      header={{
        title: 'Planification annuelle',
        description: academicYear
          ? `Planification pédagogique annuelle officielle — année ${academicYear.label}`
          : 'Planification pédagogique annuelle officielle',
        icon: 'clipboard',
      }}
      subModules={{
        modules: getVisiblePedagogyTabs(userRole).map((tab) => {
          const Icon = tab.icon;
          return { id: tab.id, label: tab.label, href: tab.path, icon: <Icon className="w-4 h-4" /> };
        }),
        activeModuleId: 'annual-planning',
      }}
      content={{ layout: 'custom', children: <AnnualPlanningContent /> }}
    />
  );
}

function AnnualPlanningContent() {
  const { academicYear } = useModuleContext();
  const { currentLevel } = useSchoolLevel();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<AnnualPlan[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('CM2');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState(0);

  const isMaternelle = selectedClass === 'MATERNELLE_GRANDS';

  const loadPlans = useCallback(async () => {
    if (!academicYear?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await pedagogyFetch<AnnualPlan[]>(
        `/api/pedagogy/annual-plans?academicYearId=${academicYear.id}&classLevel=${selectedClass}`
      );
      const arr = Array.isArray(data) ? data : [];
      setPlans(arr);
      // ⭐ NE PAS auto-seed ici — l'utilisateur clique sur "Initialiser" manuellement
    } catch (e: any) {
      console.error('Failed to load plans:', e);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id, selectedClass, currentLevel?.schoolLevelId]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  // ⭐ Initialiser TOUTES les classes d'un seul clic (pas classe par classe)
  //    Le backend résout le schoolLevelId depuis la DB si non fourni.
  //    On ne bloque pas l'utilisateur si currentLevel?.schoolLevelId est null —
  //    on passe currentLevel?.id (education_levels UUID) en fallback, ou null
  //    et le backend fait SELECT FROM school_levels WHERE tenantId = $1.
  const handleSeedAll = useCallback(async () => {
    if (!academicYear?.id) {
      toast({ title: 'Erreur', description: 'Année scolaire non sélectionnée. Vérifiez le sélecteur d\'année dans l\'en-tête.', variant: 'destructive' });
      return;
    }
    // ⭐ schoolLevelId : essayer schoolLevelId (UUID school_levels), puis id (UUID education_levels)
    //    Le backend résoudra de toute façon via SELECT FROM school_levels
    const slId = currentLevel?.schoolLevelId || currentLevel?.id || '';
    setSeeding(true);
    setSeedProgress(0);
    try {
      const progressInterval = setInterval(() => {
        setSeedProgress(prev => Math.min(prev + 5, 95));
      }, 500);
      
      const result = await pedagogyFetch<any>('/api/pedagogy/annual-plans/seed', {
        method: 'POST',
        body: { 
          academicYearId: academicYear.id, 
          schoolLevelId: slId,
        },
      });
      
      clearInterval(progressInterval);
      setSeedProgress(100);
      
      if (result?.skipped) {
        toast({ title: 'ℹ️ Déjà initialisé', description: `${result.count} planifications existent déjà.` });
      } else {
        toast({ title: '✅ Initialisation terminée', description: `${result.count} planifications insérées pour toutes les classes.` });
      }
      setTimeout(() => { loadPlans(); setSeeding(false); setSeedProgress(0); }, 1000);
    } catch (e: any) {
      setSeeding(false);
      setSeedProgress(0);
      toast({ title: 'Erreur', description: e.message || 'Échec de l\'initialisation', variant: 'destructive' });
    }
  }, [academicYear?.id, currentLevel?.schoolLevelId, currentLevel?.id, loadPlans, toast]);

  // ⭐ Trouver le contenu d'une cellule (primaire) — par trimester + month + domain
  const getPrimaireContent = (trimester: number, month: string, domainKey: string): AnnualPlan | null => {
    return plans.find(p =>
      p.trimester === trimester &&
      p.month === month &&
      (p.domain === domainKey || p.subDomain === domainKey)
    ) || null;
  };

  // ⭐ Trouver le contenu d'une cellule (maternelle) — par subDomain + week
  const getMaternelleContent = (domain: string, subDomain: string, week: string): AnnualPlan | null => {
    return plans.find(p =>
      p.domain === domain &&
      p.subDomain === subDomain &&
      p.week === week
    ) || null;
  };

  const handleSaveEdit = async (planId: string) => {
    try {
      await pedagogyFetch(`/api/pedagogy/annual-plans/${planId}`, {
        method: 'PUT', body: { content: editContent },
      });
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, content: editContent, isCustom: true } : p));
      setEditingId(null);
      toast({ title: '✅ Planification mise à jour' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  // Group headers pour le tableau primaire
  const groupHeaders = useMemo(() => {
    const groups: { group: string; colCount: number; firstKey: string }[] = [];
    for (const col of PRIMAIRE_COLUMNS) {
      if (col.group) {
        const existing = groups.find(g => g.group === col.group);
        if (existing) existing.colCount++;
        else groups.push({ group: col.group, colCount: 1, firstKey: col.key });
      } else {
        groups.push({ group: '', colCount: 1, firstKey: col.key });
      }
    }
    return groups;
  }, []);

  // Trimester change detection for row coloring
  const getTrimesterBg = (tri: number) => {
    if (tri === 1) return 'bg-blue-50/30';
    if (tri === 2) return 'bg-emerald-50/30';
    return 'bg-amber-50/30';
  };

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
              {CLASS_LEVELS.find(c => c.value === selectedClass)?.label} — {academicYear?.label || ''}
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
                a.href = url;
                a.download = `planification_${selectedClass}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
                toast({ title: '✅ PDF généré' });
              } catch (e: any) {
                toast({ title: 'Erreur PDF', description: e.message, variant: 'destructive' });
              } finally { setExportingPdf(false); }
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

      {/* TABLEAU — structure exacte du PDF */}
      {seeding ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-full max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-5 h-5 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-bold text-slate-700">Initialisation en cours…</p>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${seedProgress}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-2">{seedProgress}% — Insertion de 1392 planifications (Maternelle, CI, CP, CE1, CE2, CM1, CM2)</p>
          </div>
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucune planification disponible pour {CLASS_LEVELS.find(c => c.value === selectedClass)?.label}.</p>
          <p className="text-xs text-slate-400 mt-1">Cliquez sur le bouton ci-dessous pour initialiser la planification officielle pour TOUTES les classes.</p>
          <button
            onClick={handleSeedAll}
            disabled={seeding}
            className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
          >
            Initialiser la planification officielle (toutes les classes)
          </button>
        </div>
      ) : isMaternelle ? (
        // ═══ TABLEAU MATERNELLE — Domaines (lignes) × Semaines (colonnes) ═══
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
          <table className="text-xs border-collapse" style={{ minWidth: '2400px' }}>
            <thead>
              {/* Ligne 1 : Trimestre headers */}
              <tr className="bg-slate-800 text-white">
                <th rowSpan={2} className="p-2 border border-slate-600 text-left sticky left-0 bg-slate-800 z-10 min-w-[180px]">Domaines</th>
                <th rowSpan={2} className="p-2 border border-slate-600 text-left sticky left-[180px] bg-slate-800 z-10 min-w-[120px]">Sous-domaine</th>
                {/* Groupes par trimestre */}
                <th colSpan={12} className="p-2 border border-slate-600 text-center bg-blue-900">1er Trimestre</th>
                <th colSpan={12} className="p-2 border border-slate-600 text-center bg-emerald-900">2e Trimestre</th>
                <th colSpan={12} className="p-2 border border-slate-600 text-center bg-amber-900">3e Trimestre</th>
              </tr>
              {/* Ligne 2 : Semaines */}
              <tr className="bg-slate-700 text-white">
                {MATERNELLE_WEEKS.map((w, i) => (
                  <th key={w} className={cn(
                    'p-1 border border-slate-600 text-center min-w-[80px] font-bold',
                    i < 12 ? 'bg-blue-800' : i < 24 ? 'bg-emerald-800' : 'bg-amber-800'
                  )}>
                    {w.replace('Septembre ', 'Sept ').replace('Octobre ', 'Oct ').replace('Novembre ', 'Nov ')
                       .replace('Décembre ', 'Déc ').replace('Janvier ', 'Jan ').replace('Février ', 'Fév ')
                       .replace('Mars ', 'Mars ').replace('Avril ', 'Avr ').replace('Mai ', 'Mai ')
                       .replace('Juin ', 'Juin ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATERNELLE_DOMAINS.map(dom => (
                <>
                  {/* Ligne de titre du domaine */}
                  <tr key={dom.domain} className="bg-slate-100">
                    <td colSpan={2 + MATERNELLE_WEEKS.length} className="p-2 font-bold text-slate-700 border border-slate-300">
                      {dom.domain}
                    </td>
                  </tr>
                  {/* Lignes des sous-domaines */}
                  {dom.subDomains.map(sub => (
                    <tr key={`${dom.domain}-${sub}`} className="hover:bg-blue-50/30">
                      <td className="p-1 border border-slate-200 bg-slate-50 sticky left-0 z-10"></td>
                      <td className="p-1 border border-slate-200 font-semibold text-slate-600 sticky left-[180px] z-10 bg-white">
                        {sub}
                      </td>
                      {MATERNELLE_WEEKS.map(week => {
                        const plan = getMaternelleContent(dom.domain, sub, week);
                        return (
                          <td key={week} className="p-1 border border-slate-200 align-top min-w-[80px]">
                            {plan ? (
                              editingId === plan.id ? (
                                <div className="space-y-1">
                                  <textarea
                                    value={editContent}
                                    onChange={e => setEditContent(e.target.value)}
                                    className="w-full px-1 py-0.5 border border-blue-300 rounded text-[9px] bg-white"
                                    rows={3} autoFocus
                                  />
                                  <div className="flex gap-0.5">
                                    <button onClick={() => handleSaveEdit(plan.id)} className="p-0.5 bg-blue-600 text-white rounded">
                                      <Check className="w-2.5 h-2.5" />
                                    </button>
                                    <button onClick={() => setEditingId(null)} className="p-0.5 bg-slate-200 rounded">
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={cn(
                                    'text-[8px] leading-tight cursor-pointer p-0.5 rounded',
                                    plan.isCustom ? 'bg-amber-50 text-amber-900' : 'text-slate-700'
                                  )}
                                  onClick={() => { setEditingId(plan.id); setEditContent(plan.content); }}
                                  title={plan.isCustom ? 'Modifié par la direction' : 'Contenu officiel'}
                                >
                                  {plan.content}
                                </div>
                              )
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
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
        // ═══ TABLEAU PRIMAIRE — Mois (lignes) × Matières (colonnes) ═══
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
          <table className="text-xs border-collapse" style={{ minWidth: '1800px' }}>
            <thead>
              {/* Ligne 1 : Group headers (Éducation Sociale, Éducation Artistique) */}
              <tr className="bg-slate-800 text-white">
                {groupHeaders.map((g, i) => (
                  <th
                    key={i}
                    colSpan={g.colCount}
                    className={cn(
                      'p-2 border border-slate-600 text-center font-bold',
                      g.group === 'Éducation Sociale' ? 'bg-indigo-800' :
                      g.group === 'Éducation Artistique' ? 'bg-purple-800' : 'bg-slate-800'
                    )}
                  >
                    {g.group || ''}
                  </th>
                ))}
              </tr>
              {/* Ligne 2 : Column headers */}
              <tr className="bg-slate-700 text-white">
                {PRIMAIRE_COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className={cn(
                      'p-2 border border-slate-600 text-center font-bold',
                      col.key === 'trimester' ? 'bg-blue-800 sticky left-0 z-10 min-w-[60px]' :
                      col.key === 'month' ? 'bg-blue-800 sticky left-[60px] z-10 min-w-[80px]' :
                      col.group === 'Éducation Sociale' ? 'bg-indigo-700' :
                      col.group === 'Éducation Artistique' ? 'bg-purple-700' : 'bg-slate-700'
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PRIMAIRE_ROWS.map((row, idx) => {
                const prevRow = idx > 0 ? PRIMAIRE_ROWS[idx - 1] : null;
                const showTrimester = !prevRow || prevRow.trimester !== row.trimester;
                return (
                  <tr key={idx} className={cn('border-b border-slate-200', getTrimesterBg(row.trimester))}>
                    {/* Trimestre (merged-like) */}
                    <td className="p-2 border border-slate-200 font-bold text-center text-slate-600 sticky left-0 z-10 bg-inherit">
                      {showTrimester ? TRIMESTER_LABELS[row.trimester] : ''}
                    </td>
                    {/* Mois */}
                    <td className="p-2 border border-slate-200 font-bold text-slate-700 sticky left-[60px] z-10 bg-inherit">
                      {row.month}
                    </td>
                    {/* Subject columns */}
                    {PRIMAIRE_COLUMNS.slice(2).map(col => {
                      const plan = getPrimaireContent(row.trimester, row.month, col.key);
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            'p-1 border border-slate-200 align-top min-w-[100px]',
                            col.group === 'Éducation Sociale' ? 'bg-indigo-50/30' :
                            col.group === 'Éducation Artistique' ? 'bg-purple-50/30' : ''
                          )}
                        >
                          {plan ? (
                            editingId === plan.id ? (
                              <div className="space-y-1">
                                <textarea
                                  value={editContent}
                                  onChange={e => setEditContent(e.target.value)}
                                  className="w-full px-1 py-0.5 border border-blue-300 rounded text-[9px] bg-white"
                                  rows={4} autoFocus
                                />
                                <div className="flex gap-0.5">
                                  <button onClick={() => handleSaveEdit(plan.id)} className="p-0.5 bg-blue-600 text-white rounded">
                                    <Check className="w-2.5 h-2.5" />
                                  </button>
                                  <button onClick={() => setEditingId(null)} className="p-0.5 bg-slate-200 rounded">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  'text-[9px] leading-tight cursor-pointer p-0.5 rounded',
                                  plan.isCustom ? 'bg-amber-50 text-amber-900' : 'text-slate-700'
                                )}
                                onClick={() => { setEditingId(plan.id); setEditContent(plan.content); }}
                                title={plan.isCustom ? 'Modifié par la direction' : 'Contenu officiel'}
                              >
                                {plan.content}
                                {plan.isCustom && <span className="block text-[7px] text-amber-600">✏️</span>}
                              </div>
                            )
                          ) : (
                            <span className="text-slate-300 text-[9px]">—</span>
                          )}
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        <strong>ℹ️ Information :</strong> Planification conforme au programme officiel ministériel (Bénin).
        Cliquez sur une cellule pour la modifier (direction). Les cellules modifiées sont surlignées en ambre.
        Les enseignants consultent cette planification en lecture seule dans leur UI.
      </div>
    </div>
  );
}
