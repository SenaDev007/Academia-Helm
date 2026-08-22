'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, RefreshCw, Calendar, Pencil, Check, X, FileDown,
  ChevronLeft, ChevronRight,
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

// Domaines pour MATERNELLE — Structure conforme au document officiel :
// 5 grands domaines (I-V), chacun contenant des "périodes d'activités"
// (sous-domaines). "Education pour la santé" est un sous-domaine de Domaine I.
const MATERNELLE_DOMAINS = [
  { domain: 'I', subDomains: ['Education pour la santé', 'Passage aux toilettes', 'Lavage des mains', 'Goûters'] },
  { domain: 'II', subDomains: ['Expression corporelle'] },
  { domain: 'III', subDomains: ['Pré-lecture', 'Pré-écriture', 'Pré-mathématique', 'Observation', 'Education sensorielle', 'Travaux manuels'] },
  { domain: 'IV', subDomains: ['Expression plastique', 'Expression émotionnelle'] },
  { domain: 'V', subDomains: ['Poésie', 'Chant', 'Contes', 'Comptine', 'Communication orale'] },
];

// Colonnes semaines pour MATERNELLE — format {month, week} qui match le seed data
// Le seed stocke month='Septembre' et week='3ème semaine' séparément
const MATERNELLE_WEEKS: { month: string; week: string; trimester: number }[] = [
  // 1er Trimestre
  { month: 'Septembre', week: '3ème semaine', trimester: 1 },
  { month: 'Septembre', week: '4ème semaine', trimester: 1 },
  { month: 'Octobre', week: '1ère semaine', trimester: 1 },
  { month: 'Octobre', week: '2ème semaine', trimester: 1 },
  { month: 'Octobre', week: '3ème semaine', trimester: 1 },
  { month: 'Octobre', week: '4ème semaine', trimester: 1 },
  { month: 'Octobre', week: '5ème semaine', trimester: 1 },
  { month: 'Novembre', week: '1ère semaine', trimester: 1 },
  { month: 'Novembre', week: '2ème semaine', trimester: 1 },
  { month: 'Novembre', week: '3ème semaine', trimester: 1 },
  { month: 'Novembre', week: '4ème semaine', trimester: 1 },
  { month: 'Décembre', week: 'Congés', trimester: 1 },
  // 2e Trimestre
  { month: 'Janvier', week: '1ère semaine', trimester: 2 },
  { month: 'Janvier', week: '2ème semaine', trimester: 2 },
  { month: 'Janvier', week: '3ème semaine', trimester: 2 },
  { month: 'Janvier', week: '4ème semaine', trimester: 2 },
  { month: 'Février', week: '1ère semaine', trimester: 2 },
  { month: 'Février', week: '2ème semaine', trimester: 2 },
  { month: 'Février', week: '3ème semaine', trimester: 2 },
  { month: 'Février', week: '4ème semaine', trimester: 2 },
  { month: 'Mars', week: '1ère semaine', trimester: 2 },
  { month: 'Mars', week: '2ème semaine', trimester: 2 },
  { month: 'Mars', week: '3ème semaine', trimester: 2 },
  { month: 'Mars', week: '4ème semaine', trimester: 2 },
  // 3e Trimestre
  { month: 'Avril', week: '1ère semaine', trimester: 3 },
  { month: 'Avril', week: '2ème semaine', trimester: 3 },
  { month: 'Avril', week: '3ème semaine', trimester: 3 },
  { month: 'Avril', week: '4ème semaine', trimester: 3 },
  { month: 'Mai', week: '1ère semaine', trimester: 3 },
  { month: 'Mai', week: '2ème semaine', trimester: 3 },
  { month: 'Mai', week: '3ème semaine', trimester: 3 },
  { month: 'Mai', week: '4ème semaine', trimester: 3 },
  { month: 'Juin', week: '1ère semaine', trimester: 3 },
  { month: 'Juin', week: '2ème semaine', trimester: 3 },
  { month: 'Juin', week: '3ème semaine', trimester: 3 },
  { month: 'Juin', week: '4ème semaine', trimester: 3 },
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
const TRIMESTER_COLORS: Record<number, string> = { 1: 'bg-blue-500', 2: 'bg-emerald-500', 3: 'bg-amber-500' };

// ⭐ Mois maternelle en ordre (pagination — 1 page = 1 mois)
const MATERNELLE_MONTHS = [
  { month: 'Septembre', trimester: 1 }, { month: 'Octobre', trimester: 1 },
  { month: 'Novembre', trimester: 1 }, { month: 'Décembre', trimester: 1 },
  { month: 'Janvier', trimester: 2 }, { month: 'Février', trimester: 2 },
  { month: 'Mars', trimester: 2 },
  { month: 'Avril', trimester: 3 }, { month: 'Mai', trimester: 3 },
  { month: 'Juin', trimester: 3 },
];

// ⭐ Semaines par mois maternelle (variable selon le mois — comme le PDF)
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
  const [selectedClass, setSelectedClass] = useState<string>('MATERNELLE_GRANDS');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState(0);
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
  //    ⭐ force=true : réinsère les données officielles (sans écraser les personnalisations)
  const handleSeedAll = useCallback(async (force = false) => {
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
          force,
        },
      });
      
      clearInterval(progressInterval);
      setSeedProgress(100);
      
      if (result?.skipped) {
        toast({ title: 'ℹ️ Déjà initialisé', description: `${result.count} planifications existent déjà. Cliquez sur "Mettre à jour" pour rafraîchir.` });
      } else if (force) {
        const msg = result?.skippedCustom 
          ? `${result.count} planifications mises à jour (${result.skippedCustom} personnalisations conservées).`
          : `${result.count} planifications mises à jour avec les dernières données officielles.`;
        toast({ title: '✅ Mise à jour terminée', description: msg });
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

  // ⭐ Trouver le contenu d'une cellule (maternelle) — par domain + subDomain + month + week
  const getMaternelleContent = (domain: string, subDomain: string, month: string, week: string): AnnualPlan | null => {
    return plans.find(p =>
      p.domain === domain &&
      p.subDomain === subDomain &&
      p.month === month &&
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
          <button
            onClick={() => handleSeedAll(true)}
            disabled={seeding}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-sm font-bold"
            title="Réinsère les dernières données officielles (conserve vos personnalisations)"
          >
            <RefreshCw className="w-4 h-4" /> Mettre à jour
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
        // ═══ TABLEAU MATERNELLE AVEC PAGINATION (1 page = 1 mois, comme le PDF) ═══
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
                <col style={{ width: '10%' }} />
                <col style={{ width: '22%' }} />
                {currentWeeks.map((wk, i) => (
                  <col key={i} style={{ width: `${68 / Math.max(currentWeeks.length, 1)}%` }} />
                ))}
              </colgroup>
              <thead>
                <tr className={cn('text-white', TRIMESTER_COLORS[currentMonthData.trimester])}>
                  <th className="p-2 border border-blue-300 text-center">Domaine</th>
                  <th className="p-2 border border-blue-300 text-left">Période d'activité</th>
                  {currentWeeks.map(wk => (
                    <th key={wk} className="p-2 border border-blue-300 text-center">{wk}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MATERNELLE_DOMAINS.map(dom => {
                  // ⭐ ROWSPAN pour la colonne Domaine : le numéro romain (I-V) est
                  //    affiché dans la 1ère ligne du domaine et s'étend sur toutes
                  //    les lignes des sous-domaines de ce domaine.
                  return dom.subDomains.map((sub, subIdx) => (
                    <tr key={`${dom.domain}-${sub}`} className="hover:bg-blue-50/30">
                      {subIdx === 0 && (
                        <td
                          rowSpan={dom.subDomains.length}
                          className={cn(
                            'p-2 border border-blue-300 font-bold text-white text-center text-base align-middle',
                            TRIMESTER_COLORS[currentMonthData.trimester]
                          )}
                        >
                          {dom.domain}
                        </td>
                      )}
                      <td className="p-1 border border-slate-200 font-semibold text-slate-600 bg-white text-[10px]">
                        {sub}
                      </td>
                      {currentWeeks.map(wk => {
                        const plan = getMaternelleContent(dom.domain, sub, currentMonthData.month, wk);
                        return (
                          <td key={wk} className="p-1 border border-slate-200 align-top">
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
                                    'text-[9px] leading-tight cursor-pointer p-1 rounded',
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
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // ═══ TABLEAU PRIMAIRE — Mois (lignes) × Matières (colonnes) ═══
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
          <table className="text-xs border-collapse" style={{ minWidth: '1800px' }}>
            <thead>
              {/* Ligne 1 : Group headers (Éducation Sociale, Éducation Artistique) */}
              <tr className="bg-blue-600 text-white">
                {groupHeaders.map((g, i) => (
                  <th
                    key={i}
                    colSpan={g.colCount}
                    className={cn(
                      'p-2 border border-blue-400 text-center font-bold',
                      g.group === 'Éducation Sociale' ? 'bg-indigo-500' :
                      g.group === 'Éducation Artistique' ? 'bg-purple-500' : 'bg-blue-600'
                    )}
                  >
                    {g.group || ''}
                  </th>
                ))}
              </tr>
              {/* Ligne 2 : Column headers */}
              <tr className="bg-blue-400 text-white">
                {PRIMAIRE_COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className={cn(
                      'p-2 border border-blue-300 text-center font-bold',
                      col.key === 'trimester' ? 'bg-blue-500 sticky left-0 z-10 min-w-[60px]' :
                      col.key === 'month' ? 'bg-blue-500 sticky left-[60px] z-10 min-w-[80px]' :
                      col.group === 'Éducation Sociale' ? 'bg-indigo-400' :
                      col.group === 'Éducation Artistique' ? 'bg-purple-400' : 'bg-blue-400'
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
