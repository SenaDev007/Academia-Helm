/**
 * ============================================================================
 * TIMETABLES WORKSPACE — Moteur de génération d'emploi du temps
 * ============================================================================
 *
 * Interface 5-onglets :
 *   1. Configuration   — Jours d'école, créneaux horaires
 *   2. Disponibilités  — Grille enseignant × jour × créneau (3 états)
 *   3. Contraintes     — Contraintes obligatoires et préférées (6 types)
 *   4. Génération      — Solution unique ou multi-solutions
 *   5. Emploi du temps — Solutions générées + édition manuelle
 *                        (toggle interne : passer du mode auto au mode manuel
 *                        sans changer d'onglet)
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Settings, Calendar, Zap, CheckCircle, Loader2, Trash2,
  Clock, AlertCircle, Star, Eye, Pencil, X,
  Users, Info, Shield, GitCompare, Sparkles, Printer, Download, Plus, Layers,
  Coffee, Utensils, FileDown, Flag,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

const DAYS = [
  { value: 1, label: 'Lundi' }, { value: 2, label: 'Mardi' }, { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' }, { value: 5, label: 'Vendredi' }, { value: 6, label: 'Samedi' }, { value: 7, label: 'Dimanche' },
];

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8:00 to 18:00

const DEFAULT_TIME_BLOCKS = [
  { start: '08:00', end: '10:00', type: 'BLOCK' },
  { start: '10:00', end: '10:15', type: 'BREAK' },
  { start: '10:15', end: '12:15', type: 'BLOCK' },
  { start: '12:15', end: '14:00', type: 'LUNCH' },
  { start: '14:00', end: '16:00', type: 'BLOCK' },
  { start: '16:00', end: '16:15', type: 'BREAK' },
  { start: '16:15', end: '18:00', type: 'BLOCK' },
];

type TabId = 'config' | 'timetable';
// ⭐ Onglets 'generate' ET 'constraints' SUPPRIMÉS — l'utilisateur a demandé :
//    1. Masquer la génération automatique (les écoles saisissent manuellement)
//    2. Supprimer le sous-onglet "Contraintes" (non nécessaire pour la version actuelle)
//    Seuls restent : 'config' (Jours & créneaux) + 'timetable' (Édition manuelle)

const TABS: { id: TabId; label: string; icon: any; description: string }[] = [
  { id: 'config', label: 'Configuration', icon: Settings, description: 'Jours & créneaux' },
  // ⭐ 'constraints' tab SUPPRIMÉ (utilisateur : "on n'a plus besoin du sous-onglet contrainte")
  // { id: 'constraints', label: 'Contraintes', icon: Shield, description: 'Obligatoires & préférées' },
  // ⭐ 'generate' tab SUPPRIMÉ (utilisateur : "laisser la partie génération automatique")
  // { id: 'generate', label: 'Génération', icon: Zap, description: 'Simple ou multi-solutions' },
  { id: 'timetable', label: 'Emploi du temps', icon: Calendar, description: 'Édition manuelle' },
];

async function steFetch<T>(path: string, options?: { method?: string; body?: any }): Promise<T> {
  const res = await fetch(path, {
    method: options?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...getClientAuthorizationHeader() },
    credentials: 'include', cache: 'no-store',
    ...(options?.body && { body: JSON.stringify(options.body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    let err: { message?: string; error?: string } = {};
    try { if (text.trim()) err = JSON.parse(text); } catch { /* ignore */ }
    throw new Error(err.message ?? err.error ?? res.statusText ?? 'Erreur réseau');
  }
  if (!text.trim()) return null as T;
  return JSON.parse(text) as T;
}

function safeParse(value: any): any {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

// ═══ MAIN COMPONENT ═══

export default function TimetablesWorkspace() {
  const { academicYear } = useModuleContext();
  const { currentLevel } = useSchoolLevel();
  const { toast } = useToast();

  const [tab, setTab] = useState<TabId>('config');
  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [solutions, setSolutions] = useState<any[]>([]);
  const [selectedSolution, setSelectedSolution] = useState<any>(null);

  const schoolLevelId = currentLevel?.id;
  const academicYearId = academicYear?.id;

  const loadConfig = useCallback(async () => {
    if (!schoolLevelId || !academicYearId) return;
    setConfigLoading(true);
    try {
      const data = await steFetch<any>(`/api/timetable-engine/config?schoolLevelId=${schoolLevelId}&academicYearId=${academicYearId}`);
      setConfig(data);
    } catch { /* first load creates default */ } finally { setConfigLoading(false); }
  }, [schoolLevelId, academicYearId]);

  // ⭐ loadSolutions COMMENTÉ — les solutions auto-générées ne sont plus affichées.
  //    La génération automatique est désactivée, on n'a plus besoin de charger les solutions.
  // const loadSolutions = useCallback(async () => {
  //   if (!schoolLevelId || !academicYearId) return;
  //   try {
  //     const data = await steFetch<any[]>(`/api/timetable-engine/solutions?schoolLevelId=${schoolLevelId}&academicYearId=${academicYearId}`);
  //     setSolutions(Array.isArray(data) ? data : []);
  //   } catch { /* silent */ }
  // }, [schoolLevelId, academicYearId]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  // ⭐ loadSolutions() COMMENTÉ — voir ci-dessus
  // useEffect(() => { loadSolutions(); }, [loadSolutions]);

  if (!schoolLevelId || !academicYearId) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-800 mb-1">Sélection requise</h3>
        <p className="text-sm text-slate-500">Veuillez sélectionner un niveau scolaire et une année académique.</p>
      </div>
    );
  }

  const blockCount = (() => {
    if (!config) return DEFAULT_TIME_BLOCKS.filter(b => b.type === 'BLOCK').length;
    const blocks = Array.isArray(config.timeBlocks) ? config.timeBlocks : safeParse(config.timeBlocks);
    return (Array.isArray(blocks) ? blocks : []).filter((b: any) => b?.type === 'BLOCK').length;
  })();

  return (
    <div className="flex flex-col gap-5">
      {/* ⭐ Carte "Générateur d'Emploi du Temps" supprimée sur demande utilisateur.
          Les sous-onglets (Configuration, Contraintes, Génération, Emploi du temps)
          sont directement affichés ci-dessous. */}

      {/* Tabs + content — pas de conteneur border/bg (le ModuleContentArea le fournit déjà) */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-100">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn('flex items-center gap-2 px-5 py-3.5 text-sm font-bold transition-all whitespace-nowrap border-b-2',
                  isActive ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50')}>
                <Icon className="w-4 h-4" />
                <div className="flex flex-col items-start leading-tight">
                  <span>{t.label}</span>
                  <span className={cn('text-[10px] font-medium', isActive ? 'text-blue-500' : 'text-slate-400')}>{t.description}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="p-5">
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}>
              {tab === 'config' && <ConfigTab schoolLevelId={schoolLevelId} academicYearId={academicYearId} />}
              {/* ⭐ Onglet 'constraints' SUPPRIMÉ (utilisateur : "on n'a plus besoin du sous-onglet contrainte")
              {tab === 'constraints' && <ConstraintsTab schoolLevelId={schoolLevelId} />}
              */}
              {/* ⭐ Onglet 'generate' SUPPRIMÉ (génération auto désactivée)
              {tab === 'generate' && <GenerateTab ... />}
              */}
              {/* ⭐ TimetableTab SIMPLIFIÉ — on affiche DIRECTEMENT le ManualEditor
                  sans passer par SolutionsList (qui montrait les solutions auto-générées).
                  L'utilisateur a dit : "dans le sous-onglet emploi du temps, il y a encore
                  solution générée automatiquement qui est toujours présent" → on supprime ça. */}
              {tab === 'timetable' && (
                <TimetableTab
                  solutions={[]}
                  schoolLevelId={schoolLevelId}
                  academicYearId={academicYearId}
                  onAccept={async () => {}}
                  onView={() => {}}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      </div>

      {selectedSolution && <SolutionGridModal solution={selectedSolution} onClose={() => setSelectedSolution(null)} />}
    </div>
  );
}

// ═══ TAB 1: CONFIG ═══

function ConfigTab({ schoolLevelId: headerLevelId, academicYearId }: any) {
  const { toast } = useToast();
  const { availableLevels } = useSchoolLevel();

  // Niveaux réels (sans l'option virtuelle 'ALL')
  const realLevels = (availableLevels || []).filter((l: any) => l.id !== 'ALL' && l.isActive !== false);

  // ⚠️ Sélecteur de niveau LOCAL au sous-onglet Configuration.
  // Indépendant du sélecteur du header (qui sert à switcher le contexte
  // global de l'app, notamment en mode fusion Maternelle+Primaire).
  // Au chargement, on pré-sélectionne :
  //   - le niveau du header s'il est valide (pas 'ALL')
  //   - sinon le premier niveau réel disponible
  const [localLevelId, setLocalLevelId] = useState<string | null>(
    (headerLevelId && headerLevelId !== 'ALL') ? headerLevelId : (realLevels[0]?.id ?? null)
  );

  // Si le header change ET que localLevelId n'a pas encore été touché par
  // l'utilisateur, on synchronise. Mais une fois que l'utilisateur a
  // sélectionné un niveau dans le sous-onglet, on garde son choix.
  useEffect(() => {
    if (headerLevelId && headerLevelId !== 'ALL' && !localLevelId) {
      setLocalLevelId(headerLevelId);
    }
  }, [headerLevelId, localLevelId]);

  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [schoolDays, setSchoolDays] = useState<number[]>([1,2,3,4,5]);
  const [timeBlocks, setTimeBlocks] = useState<any[]>(DEFAULT_TIME_BLOCKS);
  const [saving, setSaving] = useState(false);

  // États pour la duplication vers d'autres niveaux
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateTargetIds, setDuplicateTargetIds] = useState<Set<string>>(new Set());
  const [duplicating, setDuplicating] = useState(false);

  // Charger la config du niveau local
  const loadConfig = useCallback(async () => {
    if (!localLevelId || !academicYearId) return;
    setLoading(true);
    try {
      const data = await steFetch<any>(`/api/timetable-engine/config?schoolLevelId=${localLevelId}&academicYearId=${academicYearId}`);
      setConfig(data);
      if (data) {
        const days = Array.isArray(data.schoolDays) ? data.schoolDays : safeParse(data.schoolDays);
        if (Array.isArray(days)) setSchoolDays(days);
        const blocks = Array.isArray(data.timeBlocks) ? data.timeBlocks : safeParse(data.timeBlocks);
        if (Array.isArray(blocks) && blocks.length > 0) setTimeBlocks(blocks);
        else setTimeBlocks(DEFAULT_TIME_BLOCKS);
      } else {
        // Pas de config existante → valeurs par défaut
        setSchoolDays([1,2,3,4,5]);
        setTimeBlocks(DEFAULT_TIME_BLOCKS);
      }
    } catch { /* first load creates default */ } finally { setLoading(false); }
  }, [localLevelId, academicYearId]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const toggleDay = (day: number) => setSchoolDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a,b) => a-b));
  const addBlock = () => setTimeBlocks(prev => [...prev, { start: '', end: '', type: 'BLOCK' }]);
  const removeBlock = (i: number) => setTimeBlocks(prev => prev.filter((_, idx) => idx !== i));
  const updateBlock = (i: number, field: string, value: string) => setTimeBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, [field]: value } : b));

  const handleSave = async () => {
    if (!localLevelId) {
      toast({ title: 'Niveau requis', description: 'Sélectionnez un niveau scolaire dans le sélecteur ci-dessus.', variant: 'destructive' });
      return;
    }
    if (timeBlocks.find(b => !b.start || !b.end)) { toast({ title: 'Créneau incomplet', variant: 'destructive' }); return; }
    if (schoolDays.length === 0) { toast({ title: 'Aucun jour sélectionné', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await steFetch('/api/timetable-engine/config', { method: 'PUT', body: { schoolDays, timeBlocks, schoolLevelId: localLevelId, academicYearId } });
      toast({ title: '✅ Configuration enregistrée' });
      loadConfig();
    } catch (e: any) { toast({ title: 'Erreur', description: e?.message, variant: 'destructive' }); } finally { setSaving(false); }
  };

  const handleDuplicate = async () => {
    if (duplicateTargetIds.size === 0) {
      toast({ title: 'Aucune cible', description: 'Sélectionnez au moins un niveau destinataire.', variant: 'destructive' });
      return;
    }
    setDuplicating(true);
    try {
      const result = await steFetch<any>('/api/timetable-engine/config/duplicate', {
        method: 'POST',
        body: {
          sourceSchoolLevelId: localLevelId,
          targetSchoolLevelIds: Array.from(duplicateTargetIds),
          academicYearId,
        },
      });
      toast({
        title: '✅ Duplication terminée',
        description: `${result.copied} niveau(x) mis à jour${result.failed ? `, ${result.failed} échec(s)` : ''}.`,
      });
      setShowDuplicateModal(false);
      setDuplicateTargetIds(new Set());
    } catch (e: any) {
      toast({ title: 'Erreur duplication', description: e?.message, variant: 'destructive' });
    } finally {
      setDuplicating(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /><span className="ml-2 text-sm text-slate-500">Chargement…</span></div>;

  // Nom du niveau actuellement configuré (pour l'affichage)
  const currentLevelName = realLevels.find((l: any) => l.id === localLevelId)?.label
    || realLevels.find((l: any) => l.id === localLevelId)?.code
    || localLevelId || '—';

  // Autres niveaux (cibles potentielles pour la duplication)
  const otherLevels = realLevels.filter((l: any) => l.id !== localLevelId);

  return (
    <div className="space-y-5">
      {/* Sélecteur de niveau LOCAL — indépendant du header */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <label className="text-sm font-bold text-slate-800 whitespace-nowrap">Niveau scolaire :</label>
          </div>
          <select
            value={localLevelId || ''}
            onChange={e => setLocalLevelId(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            {realLevels.length === 0 && (
              <option value="">Aucun niveau disponible</option>
            )}
            {realLevels.map((level: any) => (
              <option key={level.id} value={level.id}>
                {level.label || level.code}
              </option>
            ))}
          </select>
          {otherLevels.length > 0 && (
            <button
              onClick={() => { setDuplicateTargetIds(new Set()); setShowDuplicateModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold shadow-sm transition whitespace-nowrap"
              title="Copier les créneaux de ce niveau vers d'autres niveaux"
            >
              <Layers className="w-4 h-4" /> Dupliquer vers…
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-2 italic">
          💡 La configuration des jours et créneaux est spécifique à chaque niveau scolaire. Sélectionnez le niveau à configurer ci-dessus — ce choix n'affecte que ce sous-onglet, pas le reste de l'application.
        </p>
      </div>

      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3"><Calendar className="w-4 h-4 text-blue-600" /><h3 className="text-sm font-bold text-slate-800">Jours d'école — {currentLevelName}</h3></div>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(d => (
            <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
              className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                schoolDays.includes(d.value) ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300')}>
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /><h3 className="text-sm font-bold text-slate-800">Créneaux horaires — {currentLevelName}</h3></div>
          <button onClick={addBlock} className="text-xs font-semibold text-blue-600 hover:underline">+ Ajouter</button>
        </div>
        <div className="space-y-2">
          {timeBlocks.map((block, i) => {
            const isCustomType = !['BLOCK', 'BREAK', 'LUNCH', 'RECESS', 'STUDY', 'ACTIVITY', 'ASSEMBLY'].includes(block.type);
            return (
              <div key={i} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-slate-200 flex-wrap">
                <input type="time" value={block.start} onChange={e => updateBlock(i, 'start', e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded text-sm" />
                <span className="text-slate-400">→</span>
                <input type="time" value={block.end} onChange={e => updateBlock(i, 'end', e.target.value)} className="px-2 py-1.5 border border-slate-200 rounded text-sm" />
                <select
                  value={isCustomType ? '__CUSTOM__' : block.type}
                  onChange={e => {
                    if (e.target.value === '__CUSTOM__') {
                      updateBlock(i, 'type', isCustomType ? block.type : '');
                    } else {
                      updateBlock(i, 'type', e.target.value);
                    }
                  }}
                  className="px-2 py-1.5 border border-slate-200 rounded text-sm bg-white"
                >
                  <option value="BLOCK">Cours</option>
                  <option value="BREAK">Pause</option>
                  <option value="LUNCH">Déjeuner</option>
                  <option value="RECESS">Récréation</option>
                  <option value="STUDY">Étude</option>
                  <option value="ACTIVITY">Activité</option>
                  <option value="ASSEMBLY">Assemblée</option>
                  <option value="CEREMONY">Cérémonial des couleurs</option>
                  <option value="__CUSTOM__">Personnalisé…</option>
                </select>
                {isCustomType && (
                  <input
                    type="text"
                    value={block.type}
                    onChange={e => updateBlock(i, 'type', e.target.value)}
                    placeholder="Saisir un type…"
                    className="px-2 py-1.5 border border-blue-300 rounded text-sm bg-blue-50 w-32"
                    autoFocus
                  />
                )}
                <span className={cn('px-2 py-1 rounded text-[10px] font-bold uppercase',
                  block.type === 'BLOCK' ? 'bg-blue-50 text-blue-700' :
                  block.type === 'BREAK' ? 'bg-amber-50 text-amber-700' :
                  block.type === 'LUNCH' ? 'bg-emerald-50 text-emerald-700' :
                  block.type === 'RECESS' ? 'bg-orange-50 text-orange-700' :
                  block.type === 'STUDY' ? 'bg-violet-50 text-violet-700' :
                  block.type === 'ACTIVITY' ? 'bg-pink-50 text-pink-700' :
                  block.type === 'ASSEMBLY' ? 'bg-cyan-50 text-cyan-700' :
                  block.type === 'CEREMONY' ? 'bg-orange-50 text-orange-700' :
                  'bg-slate-100 text-slate-700')}>
                  {block.type === 'BLOCK' ? 'Cours' :
                   block.type === 'BREAK' ? 'Pause' :
                   block.type === 'LUNCH' ? 'Déjeuner' :
                   block.type === 'RECESS' ? 'Récréation' :
                   block.type === 'STUDY' ? 'Étude' :
                   block.type === 'ACTIVITY' ? 'Activité' :
                   block.type === 'ASSEMBLY' ? 'Assemblée' :
                   block.type === 'CEREMONY' ? 'Cérémonial des couleurs' :
                   block.type || '—'}
                </span>
                <button onClick={() => removeBlock(i)} className="p-1.5 text-red-500 hover:bg-red-50 rounded ml-auto"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-3 italic">
          💡 Les créneaux de type « Cours » sont planifiés par le moteur. Les autres types (Pause, Déjeuner, Récréation, Étude, Activité, Assemblée, ou personnalisé) sont des pauses non planifiables insérées dans la journée.
        </p>
      </div>
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving || !localLevelId}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-md">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Enregistrer
        </button>
      </div>

      {/* Modal: Dupliquer vers d'autres niveaux */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !duplicating && setShowDuplicateModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Dupliquer vers d'autres niveaux</h3>
              </div>
              <button onClick={() => !duplicating && setShowDuplicateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800">
                  Les créneaux actuellement configurés pour <strong>{currentLevelName}</strong> seront copiés vers les niveaux sélectionnés ci-dessous. Les configurations existantes des niveaux cibles seront <strong>remplacées</strong>.
                </p>
              </div>
              <div className="space-y-1.5">
                {otherLevels.map((level: any) => {
                  const isSelected = duplicateTargetIds.has(level.id);
                  return (
                    <button
                      key={level.id}
                      onClick={() => {
                        setDuplicateTargetIds(prev => {
                          const next = new Set(prev);
                          if (next.has(level.id)) next.delete(level.id);
                          else next.add(level.id);
                          return next;
                        });
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                          : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50',
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0',
                        isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300',
                      )}>
                        {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{level.label || level.code}</p>
                        {level.code && level.code !== level.label && (
                          <p className="text-[10px] text-slate-400 font-medium uppercase">{level.code}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button
                onClick={() => { setShowDuplicateModal(false); setDuplicateTargetIds(new Set()); }}
                disabled={duplicating}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDuplicate}
                disabled={duplicating || duplicateTargetIds.size === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition bg-blue-600 hover:bg-blue-700"
              >
                {duplicating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Duplication…</>
                ) : (
                  <><Layers className="w-3.5 h-3.5" /> Dupliquer vers {duplicateTargetIds.size} niveau(x)</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ TAB 2: AVAILABILITY ═══

type AvailabilityStatus = 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE';

const STATUS_META: Record<AvailabilityStatus, { label: string; color: string; bg: string; icon: any }> = {
  AVAILABLE:   { label: 'Disponible', color: 'text-emerald-700', bg: 'bg-emerald-100 hover:bg-emerald-200 border-emerald-300', icon: CheckCircle },
  PREFERRED:   { label: 'Préfér',     color: 'text-amber-700',   bg: 'bg-amber-100 hover:bg-amber-200 border-amber-300',       icon: Star },
  UNAVAILABLE: { label: 'Indispo.',   color: 'text-red-700',     bg: 'bg-red-100 hover:bg-red-200 border-red-300',             icon: X },
};
const STATUS_CYCLE: AvailabilityStatus[] = ['AVAILABLE', 'PREFERRED', 'UNAVAILABLE'];

function AvailabilityTab({ config, schoolLevelId }: { config: any; schoolLevelId: string }) {
  const { toast } = useToast();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const timeBlocks = useMemo(() => {
    if (!config) return DEFAULT_TIME_BLOCKS.filter(b => b.type === 'BLOCK');
    const blocks = Array.isArray(config.timeBlocks) ? config.timeBlocks : safeParse(config.timeBlocks);
    const filtered = (Array.isArray(blocks) ? blocks : []).filter((b: any) => b?.type === 'BLOCK');
    return filtered.length > 0 ? filtered : DEFAULT_TIME_BLOCKS.filter(b => b.type === 'BLOCK');
  }, [config]);

  const schoolDays = useMemo(() => {
    if (!config) return [1,2,3,4,5];
    const days = Array.isArray(config.schoolDays) ? config.schoolDays : safeParse(config.schoolDays);
    return Array.isArray(days) && days.length > 0 ? days : [1,2,3,4,5];
  }, [config]);

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await steFetch<any[]>(`/api/timetable-engine/teachers?schoolLevelId=${schoolLevelId}`);
      const list = Array.isArray(data) ? data : [];
      setTeachers(list);
      if (list.length > 0 && !selectedTeacherId) setSelectedTeacherId(list[0].id);
    } catch (e: any) { toast({ title: 'Erreur', description: e?.message, variant: 'destructive' }); } finally { setLoading(false); }
  }, [schoolLevelId, selectedTeacherId]);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  const getCellStatus = (teacherId: string, day: number, block: any): AvailabilityStatus => {
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher?.availabilities) return 'AVAILABLE';
    const match = teacher.availabilities.find((a: any) => a.dayOfWeek === day && a.startTime === block.start && a.endTime === block.end);
    return (match?.status as AvailabilityStatus) ?? 'AVAILABLE';
  };

  const cycleCell = async (teacherId: string, day: number, block: any) => {
    const current = getCellStatus(teacherId, day, block);
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
    setUpdating(true);
    try {
      setTeachers(prev => prev.map(t => {
        if (t.id !== teacherId) return t;
        const filtered = (t.availabilities || []).filter((a: any) => !(a.dayOfWeek === day && a.startTime === block.start && a.endTime === block.end));
        if (next === 'AVAILABLE') return { ...t, availabilities: filtered };
        return { ...t, availabilities: [...filtered, { id: `temp-${Date.now()}`, teacherId, dayOfWeek: day, startTime: block.start, endTime: block.end, status: next }] };
      }));
      await steFetch('/api/timetable-engine/availability', { method: 'POST', body: { teacherId, dayOfWeek: day, startTime: block.start, endTime: block.end, status: next } });
    } catch (e: any) { toast({ title: 'Erreur', description: e?.message, variant: 'destructive' }); await loadTeachers(); } finally { setUpdating(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /><span className="ml-2 text-sm text-slate-500">Chargement…</span></div>;
  if (teachers.length === 0) return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-10 text-center">
      <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <h3 className="text-sm font-bold text-slate-800 mb-1">Aucun enseignant</h3>
      <p className="text-xs text-slate-500">Ajoutez des enseignants via l'onglet Enseignants & Affectations.</p>
    </div>
  );

  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-800">
          Cliquez sur une cellule pour changer le statut : <span className="font-bold text-emerald-700">Disponible</span> → <span className="font-bold text-amber-700">Préféré</span> → <span className="font-bold text-red-700">Indisponible</span>.
          Les créneaux Préférés sont priorisés par le moteur.
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-64 bg-slate-50 rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">{teachers.length} enseignant{teachers.length > 1 ? 's' : ''}</p>
          <div className="space-y-1">
            {teachers.map(t => (
              <button key={t.id} onClick={() => setSelectedTeacherId(t.id)}
                className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition',
                  selectedTeacherId === t.id ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-white text-slate-700')}>
                <div className="font-bold">{t.lastName} {t.firstName}</div>
                {t.email && <div className={cn('text-[10px]', selectedTeacherId === t.id ? 'text-blue-100' : 'text-slate-400')}>{t.email}</div>}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-x-auto">
          {selectedTeacher && (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-800">{selectedTeacher.lastName} {selectedTeacher.firstName}</h3>
                  <p className="text-xs text-slate-500">{timeBlocks.length} créneau(x) × {schoolDays.length} jour(s)</p>
                </div>
                {updating && <span className="inline-flex items-center gap-1.5 text-xs text-blue-600"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Mise à jour…</span>}
              </div>
              <table className="w-full border-collapse min-w-[600px]">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-xs font-bold text-slate-600 border border-slate-200 bg-slate-100 w-32">Créneau</th>
                    {schoolDays.map(day => (
                      <th key={day} className="p-2 text-center text-xs font-bold text-slate-600 border border-slate-200 bg-slate-100 min-w-[100px]">{DAYS.find(d => d.value === day)?.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeBlocks.map((block, blockIdx) => (
                    <tr key={blockIdx}>
                      <td className="p-2 border border-slate-200 bg-slate-50">
                        <div className="text-xs font-bold text-slate-700">{block.start}</div>
                        <div className="text-[10px] text-slate-400">→ {block.end}</div>
                      </td>
                      {schoolDays.map(day => {
                        const status = getCellStatus(selectedTeacher.id, day, block);
                        const meta = STATUS_META[status];
                        const Icon = meta.icon;
                        return (
                          <td key={day} className="p-1 border border-slate-200">
                            <button onClick={() => cycleCell(selectedTeacher.id, day, block)} disabled={updating}
                              className={cn('w-full h-14 rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 transition-all', meta.bg, status === 'AVAILABLE' && 'opacity-60 hover:opacity-100')}>
                              <Icon className={cn('w-4 h-4', meta.color)} />
                              <span className={cn('text-[10px] font-bold', meta.color)}>{meta.label}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══ ONGLET 3 : CONTRAINTES ═══

const CONSTRAINT_TYPES = [
  { type: 'SUBJECT_TIME_WINDOW', label: 'Fenêtre horaire matière', desc: 'Une matière doit être enseignée dans une plage précise (ex: Maths le matin)', entityType: 'subject' },
  { type: 'TEACHER_MAX_DAILY', label: 'Max journalier enseignant', desc: 'Un enseignant ne peut pas avoir plus de N séances par jour', entityType: 'teacher' },
  { type: 'SUBJECT_DISTRIBUTION', label: 'Distribution matière', desc: 'Limite le nombre de séances d\'une matière par jour et par classe', entityType: 'subject' },
  { type: 'SUBJECT_NOT_CONSECUTIVE', label: 'Matières non consécutives', desc: 'Deux matières ne doivent pas se suivre immédiatement', entityType: 'subject' },
  { type: 'CLASS_FREE_SLOT', label: 'Créneau libre classe', desc: 'Une classe doit être libre sur un créneau précis', entityType: 'class' },
  { type: 'TEACHER_PREFERRED_DAY', label: 'Jour préféré enseignant', desc: 'Un enseignant préfère un jour spécifique (préférence non bloquante)', entityType: 'teacher' },
];

function ConstraintsTab({ schoolLevelId }: { schoolLevelId: string }) {
  const { toast } = useToast();
  const [constraints, setConstraints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ type: 'SUBJECT_TIME_WINDOW', severity: 'HARD', entityType: 'subject', entityId: '', params: {}, weight: 5, isActive: true });

  const loadConstraints = useCallback(async () => {
    setLoading(true);
    try {
      const data = await steFetch<any[]>(`/api/timetable-engine/constraints?schoolLevelId=${schoolLevelId}`);
      setConstraints(Array.isArray(data) ? data : []);
    } catch (e: any) { toast({ title: 'Erreur', description: e?.message, variant: 'destructive' }); } finally { setLoading(false); }
  }, [schoolLevelId]);

  const loadEntities = useCallback(async () => {
    try {
      const [subs, tchs, cls] = await Promise.all([
        steFetch<any[]>(`/api/subjects?schoolLevelId=${schoolLevelId}`).catch(() => []),
        steFetch<any[]>(`/api/timetable-engine/teachers?schoolLevelId=${schoolLevelId}`).catch(() => []),
        steFetch<any[]>(`/api/pedagogy/academic-structure/classes?schoolLevelId=${schoolLevelId}`).catch(() => []),
      ]);
      setSubjects(Array.isArray(subs) ? subs : []);
      setTeachers(Array.isArray(tchs) ? tchs : []);
      setClasses(Array.isArray(cls) ? cls : []);
    } catch { /* silent */ }
  }, [schoolLevelId]);

  useEffect(() => { loadConstraints(); }, [loadConstraints]);
  useEffect(() => { loadEntities(); }, [loadEntities]);

  const entityOptions = useMemo(() => {
    if (form.entityType === 'subject') return subjects.map((s: any) => ({ id: s.id, label: `${s.name} (${s.code})` }));
    if (form.entityType === 'teacher') return teachers.map((t: any) => ({ id: t.id, label: `${t.lastName} ${t.firstName}` }));
    if (form.entityType === 'class') return classes.map((c: any) => ({ id: c.id, label: c.name }));
    return [];
  }, [form.entityType, subjects, teachers, classes]);

  const handleTypeChange = (type: string) => {
    const meta = CONSTRAINT_TYPES.find(t => t.type === type);
    setForm(prev => ({ ...prev, type, entityType: meta?.entityType || 'subject', entityId: '', params: {} }));
  };

  const handleSubmit = async () => {
    if (!form.entityId) { toast({ title: 'Erreur', description: 'Sélectionnez une entité.', variant: 'destructive' }); return; }
    try {
      if (editing) {
        await steFetch(`/api/timetable-engine/constraints/${editing.id}`, { method: 'PUT', body: { severity: form.severity, params: form.params, weight: form.weight, isActive: form.isActive } });
        toast({ title: '✅ Contrainte mise à jour' });
      } else {
        await steFetch('/api/timetable-engine/constraints', { method: 'POST', body: { ...form, schoolLevelId } });
        toast({ title: '✅ Contrainte créée' });
      }
      setShowModal(false); setEditing(null); await loadConstraints();
    } catch (e: any) { toast({ title: 'Erreur', description: e?.message, variant: 'destructive' }); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette contrainte ?')) return;
    try { await steFetch(`/api/timetable-engine/constraints/${id}`, { method: 'DELETE' }); toast({ title: '✅ Supprimée' }); await loadConstraints(); }
    catch (e: any) { toast({ title: 'Erreur', description: e?.message, variant: 'destructive' }); }
  };

  const handleToggle = async (c: any) => {
    try { await steFetch(`/api/timetable-engine/constraints/${c.id}`, { method: 'PUT', body: { isActive: !c.isActive } }); await loadConstraints(); }
    catch (e: any) { toast({ title: 'Erreur', description: e?.message, variant: 'destructive' }); }
  };

  const handleEdit = (c: any) => {
    setEditing(c);
    setForm({ type: c.type, severity: c.severity, entityType: c.entityType, entityId: c.entityId, params: c.params || {}, weight: c.weight ?? 5, isActive: c.isActive ?? true });
    setShowModal(true);
  };

  const selectedTypeMeta = CONSTRAINT_TYPES.find(t => t.type === form.type);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-800">
          <strong>Types de contraintes :</strong> <span className="font-bold text-red-700">Obligatoire</span> = doit toujours être respectée (le moteur ignore les créneaux qui la violent).
          <span className="font-bold text-amber-700"> Préférée</span> = pénalisée si non respectée (priorité 1 à 10).
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800">{constraints.length} contrainte{constraints.length > 1 ? 's' : ''}</h3>
          <p className="text-xs text-slate-500">{constraints.filter(c => c.severity === 'HARD' && c.isActive).length} obligatoires · {constraints.filter(c => c.severity === 'SOFT' && c.isActive).length} préférées actives</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ type: 'SUBJECT_TIME_WINDOW', severity: 'HARD', entityType: 'subject', entityId: '', params: {}, weight: 5, isActive: true }); setShowModal(true); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold">
          <Pencil className="w-3.5 h-3.5" /> Nouvelle contrainte
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /><span className="ml-2 text-sm text-slate-500">Chargement…</span></div>
      ) : constraints.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-10 text-center">
          <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 mb-1">Aucune contrainte</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">Créez des contraintes pour améliorer la qualité de l'emploi du temps (Maths le matin, max 3 séances/jour, etc.).</p>
        </div>
      ) : (
        <div className="space-y-2">
          {constraints.map(c => {
            const meta = CONSTRAINT_TYPES.find(t => t.type === c.type);
            const entityLabel = c.entityType === 'subject' ? (subjects.find((s: any) => s.id === c.entityId)?.name || c.entityId) :
              c.entityType === 'teacher' ? (() => { const t = teachers.find((t: any) => t.id === c.entityId); return t ? `${t.lastName} ${t.firstName}` : c.entityId; })() :
              (classes.find((cl: any) => cl.id === c.entityId)?.name || c.entityId);
            return (
              <div key={c.id} className={cn('bg-white rounded-xl border p-4 shadow-sm flex items-start gap-3', c.isActive ? 'border-slate-200' : 'border-slate-100 opacity-60')}>
                <div className={cn('px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0', c.severity === 'HARD' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                  {c.severity === 'HARD' ? 'Obligatoire' : 'Préférée'}{c.severity === 'SOFT' && ` · P${c.weight}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-slate-800">{meta?.label || c.type}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">{c.entityType}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    <span className="font-semibold">{entityLabel}</span>
                    {Object.entries(c.params || {}).length > 0 && (
                      <span className="text-slate-400 ml-2">
                        {Object.entries(c.params).map(([k, v]) => {
                          if (k === 'dayOfWeek') return `${k}=${DAYS.find(d => d.value === Number(v))?.label || v}`;
                          if (k === 'otherSubjectId') { const s = subjects.find((s: any) => s.id === v); return `${k}=${s?.name || v}`; }
                          return `${k}=${String(v)}`;
                        }).join(' · ')}
                      </span>
                    )}
                  </div>
                  {meta && <div className="text-[10px] text-slate-400 mt-1">{meta.desc}</div>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => handleToggle(c)} className={cn('px-2 py-1 rounded text-[10px] font-bold', c.isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="font-bold text-slate-900">{editing ? 'Modifier la contrainte' : 'Nouvelle contrainte'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">Type de contrainte</label>
                <select value={form.type} onChange={e => handleTypeChange(e.target.value)} disabled={!!editing} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white disabled:opacity-60">
                  {CONSTRAINT_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                </select>
                {selectedTypeMeta && <p className="text-[11px] text-slate-500 mt-1">{selectedTypeMeta.desc}</p>}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">Type de contrainte</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm({ ...form, severity: 'HARD' })} className={cn('flex-1 px-3 py-2 rounded-lg text-xs font-bold', form.severity === 'HARD' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>Obligatoire</button>
                  <button type="button" onClick={() => setForm({ ...form, severity: 'SOFT' })} className={cn('flex-1 px-3 py-2 rounded-lg text-xs font-bold', form.severity === 'SOFT' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>Préférée</button>
                </div>
              </div>
              {form.severity === 'SOFT' && (
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">Priorité (1-10) : <span className="text-amber-700">{form.weight}</span></label>
                  <input type="range" min={1} max={10} value={form.weight} onChange={e => setForm({ ...form, weight: Number(e.target.value) })} className="w-full" />
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase mb-1.5 block">{form.entityType === 'subject' ? 'Matière' : form.entityType === 'teacher' ? 'Enseignant' : 'Classe'}</label>
                <select value={form.entityId} onChange={e => setForm({ ...form, entityId: e.target.value })} disabled={!!editing} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white disabled:opacity-60">
                  <option value="">— Sélectionner —</option>
                  {entityOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
              <ParamsEditor form={form} onParamChange={(k: string, v: any) => setForm((prev: any) => ({ ...prev, params: { ...prev.params, [k]: v } }))} subjects={subjects} />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4" />
                <span className="text-sm text-slate-700">Contrainte active</span>
              </label>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold">Annuler</button>
              <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold">{editing ? 'Mettre à jour' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ParamsEditor({ form, onParamChange, subjects }: { form: any; onParamChange: (k: string, v: any) => void; subjects: any[] }) {
  const paramFields: Record<string, { key: string; label: string; type: string }[]> = {
    SUBJECT_TIME_WINDOW: [{ key: 'startTime', label: 'Heure début', type: 'time' }, { key: 'endTime', label: 'Heure fin', type: 'time' }],
    TEACHER_MAX_DAILY: [{ key: 'maxPerDay', label: 'Max/jour', type: 'number' }],
    SUBJECT_DISTRIBUTION: [{ key: 'maxPerDayPerClass', label: 'Max/jour/classe', type: 'number' }],
    SUBJECT_NOT_CONSECUTIVE: [{ key: 'otherSubjectId', label: 'Matière incompatible', type: 'select' }],
    CLASS_FREE_SLOT: [{ key: 'dayOfWeek', label: 'Jour', type: 'day' }, { key: 'startTime', label: 'Heure début', type: 'time' }, { key: 'endTime', label: 'Heure fin', type: 'time' }],
    TEACHER_PREFERRED_DAY: [{ key: 'dayOfWeek', label: 'Jour préféré', type: 'day' }],
  };
  const fields = paramFields[form.type] || [];
  if (fields.length === 0) return null;
  return (
    <div className="space-y-3">
      <label className="text-xs font-bold text-slate-700 uppercase block">Paramètres</label>
      <div className="grid grid-cols-2 gap-3">
        {fields.map(f => {
          const value = form.params[f.key] ?? '';
          if (f.type === 'time') return <div key={f.key}><label className="text-xs font-bold text-slate-700 uppercase mb-1 block">{f.label}</label><input type="time" value={value} onChange={e => onParamChange(f.key, e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>;
          if (f.type === 'number') return <div key={f.key}><label className="text-xs font-bold text-slate-700 uppercase mb-1 block">{f.label}</label><input type="number" min={1} value={value} onChange={e => onParamChange(f.key, Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" /></div>;
          if (f.type === 'day') return <div key={f.key}><label className="text-xs font-bold text-slate-700 uppercase mb-1 block">{f.label}</label><select value={value} onChange={e => onParamChange(f.key, Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"><option value="">—</option>{DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>;
          if (f.type === 'select') return <div key={f.key}><label className="text-xs font-bold text-slate-700 uppercase mb-1 block">{f.label}</label><select value={value} onChange={e => onParamChange(f.key, e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"><option value="">—</option>{subjects.filter(s => s.id !== form.entityId).map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}</select></div>;
          return null;
        })}
      </div>
    </div>
  );
}

// ═══ ONGLET 4 : GÉNÉRATION ═══

function GenerateTab({ schoolLevelId, academicYearId, solutionsCount, onGenerated }: any) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [mode, setMode] = useState<'mono' | 'multi'>('multi');
  const [progress, setProgress] = useState('');

  const handleGenerate = async () => {
    setGenerating(true); setProgress('Initialisation…');
    try {
      if (mode === 'multi') {
        setProgress('Génération de 5 solutions…');
        const result = await steFetch<any>('/api/timetable-engine/generate-multi', { method: 'POST', body: { academicYearId, schoolLevelId } });
        toast({ title: '✅ Multi-génération terminée', description: `${result.allSolutions?.length ?? 0} solutions générées, ${result.paretoFront?.length ?? 0} solutions optimales conservées.` });
      } else {
        setProgress('Génération…');
        const solution = await steFetch<any>('/api/timetable-engine/generate', { method: 'POST', body: { academicYearId, schoolLevelId } });
        toast({ title: '✅ Généré', description: `Score: ${solution.score}% · ${solution.conflictCount} conflit(s).` });
      }
      onGenerated();
    } catch (e: any) {
      toast({ title: '❌ Échec', description: e?.message, variant: 'destructive' });
    } finally { setGenerating(false); setProgress(''); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 mb-4"><Zap className="w-8 h-8 text-amber-600" /></div>
        <h3 className="text-lg font-extrabold text-slate-900 mb-2">Lancer la génération</h3>
        <p className="text-sm text-slate-600 mb-6 max-w-xl mx-auto">Le moteur de génération cherche la meilleure organisation possible. Il respecte les contraintes obligatoires et essaie de satisfaire les préférences. En mode multi-solutions, 5 stratégies sont testées puis seules les meilleures sont conservées.</p>
        <div className="inline-flex p-1 bg-white rounded-xl border border-amber-200 mb-6">
          <button onClick={() => setMode('mono')} disabled={generating} className={cn('px-4 py-2 rounded-lg text-xs font-bold', mode === 'mono' ? 'bg-blue-600 text-white' : 'text-slate-600')}>Solution unique</button>
          <button onClick={() => setMode('multi')} disabled={generating} className={cn('px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5', mode === 'multi' ? 'bg-blue-600 text-white' : 'text-slate-600')}><Sparkles className="w-3.5 h-3.5" /> Multi-solutions</button>
        </div>
        <div className="mb-6">
          {mode === 'mono' ? <p className="text-xs text-slate-500">Une seule solution rapide, basée sur la stratégie préférence.</p> :
            <p className="text-xs text-slate-500"><strong>5 solutions</strong> testées (Faisabilité, Préférence, Pédagogie, Confort, Aléatoire) puis seules les meilleures sont conservées.</p>}
        </div>
        <button onClick={handleGenerate} disabled={generating} className="inline-flex items-center gap-2 px-7 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg">
          {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'multi' ? <Sparkles className="w-5 h-5" /> : <Zap className="w-5 h-5" />)}
          {generating ? (progress || 'Génération…') : (mode === 'multi' ? 'Multi-génération' : 'Générer')}
        </button>
        {solutionsCount > 0 && <div className="mt-4 text-xs text-slate-500">{solutionsCount} solution(s) existante(s).</div>}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h4 className="text-sm font-bold text-slate-800 mb-3">Étapes de la génération</h4>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {[{ s:1,l:'Config + ressources',i:Settings },{ s:2,l:'Disponibilités + contraintes',i:Calendar },{ s:3,l:'Tri par stratégie',i:Users },{ s:4,l:'Contraintes obligatoires',i:Zap },{ s:5,l:'Préférences (priorités)',i:Shield },{ s:6,l:'Sélection des meilleures',i:GitCompare }].map(({s,l,i:Icon}) => (
            <div key={s} className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-600 mb-2"><Icon className="w-4 h-4" /></div>
              <div className="text-xs font-bold text-slate-700 leading-tight">{l}</div>
              <div className="text-[10px] text-slate-400">étape {s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══ TAB 5: EMPLOI DU TEMPS (unifié — Solutions + Édition manuelle) ═══

function TimetableTab({ solutions, schoolLevelId, academicYearId, onAccept, onView, onRegenerate }: any) {
  // ⭐ SIMPLIFICATION : on affiche DIRECTEMENT le ManualEditor.
  //    Avant, il y avait un toggle "Solutions générées" / "Édition manuelle"
  //    qui par défaut montrait "Aucune solution générée" + bouton "Générer"
  //    → l'utilisateur voyait encore la génération auto malgré nos commentaires.
  //    Maintenant : pas de toggle, pas de SolutionsList → ManualEditor uniquement.
  return (
    <div className="space-y-4">
      <ManualEditor schoolLevelId={schoolLevelId} academicYearId={academicYearId} />
    </div>
  );
}

function SolutionsList({ solutions, onAccept, onView, onRegenerate }: any) {
  if (solutions.length === 0) return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-10 text-center">
      <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <h3 className="text-sm font-bold text-slate-800 mb-1">Aucune solution générée</h3>
      <p className="text-xs text-slate-500 mb-4">Lancez le moteur pour créer votre premier EDT, ou passez en édition manuelle.</p>
      <div className="flex gap-2 justify-center">
        <button onClick={onRegenerate} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"><Zap className="w-3.5 h-3.5" /> Générer</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {solutions.length > 1 && (
        <div className="flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-lg p-3">
          <GitCompare className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
          <div className="text-xs text-violet-800">
            Les solutions <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 bg-violet-600 text-white rounded text-[10px] font-bold"><Sparkles className="w-2.5 h-2.5" /> PARETO</span> sont non dominées (meilleurs trade-offs).
          </div>
        </div>
      )}
      {solutions.map((sol: any, idx: number) => (
        <div key={sol.id} className={cn('bg-white rounded-xl border p-5 shadow-sm',
          sol.status === 'ACCEPTED' ? 'border-emerald-300 ring-1 ring-emerald-200' : sol.isParetoOptimal ? 'border-violet-300 ring-1 ring-violet-200' : 'border-slate-200')}>
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h4 className="font-bold text-slate-900">Solution #{idx + 1}</h4>
                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                  sol.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : sol.status === 'PROPOSED' ? 'bg-blue-100 text-blue-700' : sol.status === 'ARCHIVED' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700')}>{sol.status}</span>
                {sol.isParetoOptimal && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-violet-600 text-white"><Sparkles className="w-2.5 h-2.5" /> Optimale</span>}
                {sol.strategy && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600">{sol.strategy}</span>}
              </div>
              <p className="text-xs text-slate-500">{sol.notes}</p>
              {sol.createdAt && <p className="text-[10px] text-slate-400 mt-0.5">{new Date(sol.createdAt).toLocaleString('fr-FR')}</p>}
            </div>
            <div className="text-right">
              <div className="text-4xl font-extrabold text-blue-600 leading-none">{sol.score}<span className="text-xl">%</span></div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1">Score global</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {[{l:'Faisabilité',v:sol.feasibilityScore,c:'text-emerald-600',b:'bg-emerald-50'},{l:'Pédagogie',v:sol.pedagogyScore,c:'text-blue-600',b:'bg-blue-50'},{l:'Confort',v:sol.comfortScore,c:'text-amber-600',b:'bg-amber-50'},{l:'Préférence',v:sol.preferenceScore,c:'text-violet-600',b:'bg-violet-50'}].map(s => (
              <div key={s.l} className={cn('rounded-lg p-2.5 text-center', s.b)}><div className={cn('text-xl font-bold', s.c)}>{s.v}%</div><div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{s.l}</div></div>
            ))}
          </div>
          {Array.isArray(sol.violatedSoftConstraints) && sol.violatedSoftConstraints.length > 0 && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> {sol.violatedSoftConstraints.length} préférence(s) non respectée(s)</p>
              {sol.violatedSoftConstraints.slice(0, 3).map((v: any, i: number) => <p key={i} className="text-[11px] text-amber-700 ml-5">• {v.message} <span className="text-amber-500 font-bold">(-{v.penalty})</span></p>)}
            </div>
          )}
          {sol.conflictCount > 0 && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {sol.conflictCount} contrainte(s) obligatoire(s) non respectée(s)</p>
              {Array.isArray(sol.conflicts) && sol.conflicts.slice(0, 3).map((c: any, i: number) => <p key={i} className="text-[11px] text-red-700 ml-5">• {c.message}</p>)}
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => onView(sol)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"><Eye className="w-3.5 h-3.5" /> Voir la grille</button>
            {sol.status !== 'ACCEPTED' && <button onClick={() => onAccept(sol.id)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"><CheckCircle className="w-3.5 h-3.5" /> Accepter</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ManualEditor : édition visuelle héritée, intégrée ───────────────────

interface ManualTimetable {
  id: string;
  name: string;
  isActive: boolean;
}

interface ManualEntry {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject?: { id: string; name: string; code: string };
  teacher?: { id: string; firstName: string; lastName: string };
  room?: { id: string; name: string; code: string };
  class?: { id: string; name: string };
}

function ManualEditor({ schoolLevelId, academicYearId }: { schoolLevelId: string; academicYearId: string }) {
  const { toast } = useToast();
  const { schoolLevel } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  // ⭐ Niveaux réels (sans l'option virtuelle 'ALL')
  const realLevels = (availableLevels || []).filter((l: any) => l.id !== 'ALL' && l.isActive !== false);
  // ⭐ Sélecteur de niveau LOCAL — indépendant du header
  //    Avant ce fix, le ManualEditor utilisait schoolLevel?.id du header qui
  //    pouvait être 'ALL' (Tous les niveaux) → la config n'était pas trouvée
  //    → fallback aux DEFAULT_TIME_BLOCKS → la grille ne respectait pas la config.
  const [localLevelId, setLocalLevelId] = useState<string | null>(
    (schoolLevelId && schoolLevelId !== 'ALL') ? schoolLevelId : (realLevels[0]?.id ?? null)
  );
  const [timetables, setTimetables] = useState<ManualTimetable[]>([]);
  const [activeTimetableId, setActiveTimetableId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [configSchoolDays, setConfigSchoolDays] = useState<number[]>([1,2,3,4,5]);
  const [configTimeBlocks, setConfigTimeBlocks] = useState<any[]>(DEFAULT_TIME_BLOCKS);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  // ⭐ Édition INLINE : au lieu d'un modal, on édite directement dans la cellule
  //    editingCell = { dayOfWeek, blockStart, blockEnd } identifie la cellule en cours d'édition
  const [editingCell, setEditingCell] = useState<{ dayOfWeek: number; blockStart: string; blockEnd: string } | null>(null);
  const [inlineForm, setInlineForm] = useState({ subjectId: '', teacherId: '', roomId: '', startTime: '', endTime: '' });
  const [saving, setSaving] = useState(false);
  // ⭐ Export PDF
  const [exportingPdf, setExportingPdf] = useState(false);
  // ≉ School identity pour le PDF
  const [schoolIdentity, setSchoolIdentity] = useState<any>(null);

  const configuredDays = DAYS.filter(d => configSchoolDays.includes(d.value));

  const loadConfig = useCallback(async () => {
    // ⭐ Utilise localLevelId (pas schoolLevel?.id du header qui peut être 'ALL')
    const levelId = localLevelId;
    if (!levelId || !academicYearId) return;
    try {
      // ⭐ Cache-buster : ajoute un timestamp pour forcer le fetch d'une config fraîche.
      //    Sans ça, si l'utilisateur modifie les jours dans l'onglet Configuration puis
      //    passe à l'onglet Emploi du temps, le navigateur/Vercel peut servir une
      //    version CACHÉE de la config (jours statiques, pas la nouvelle config).
      const ts = Date.now();
      const data = await steFetch<any>(`/api/timetable-engine/config?schoolLevelId=${levelId}&academicYearId=${academicYearId}&_t=${ts}`);
      if (data) {
        const days = Array.isArray(data.schoolDays) ? data.schoolDays : safeParse(data.schoolDays);
        if (Array.isArray(days) && days.length > 0) setConfigSchoolDays(days);
        const blocks = Array.isArray(data.timeBlocks) ? data.timeBlocks : safeParse(data.timeBlocks);
        if (Array.isArray(blocks) && blocks.length > 0) setConfigTimeBlocks(blocks);
      }
    } catch {}
  }, [localLevelId, academicYearId]);

  const loadData = useCallback(async () => {
    if (!academicYearId) return;
    setLoading(true);
    try {
      const [tts, cls, rms, tchs, subs, si] = await Promise.all([
        pedagogyFetch<ManualTimetable[]>(`/api/timetables?academicYearId=${academicYearId}`).catch(() => []),
        pedagogyFetch<any[]>(`/api/pedagogy/academic-structure/classes?academicYearId=${academicYearId}`).catch(() => []),
        pedagogyFetch<any[]>(`/api/rooms`).catch(() => []),
        pedagogyFetch<any[]>(`/api/pedagogy/teacher-profiles?academicYearId=${academicYearId}`).catch(() => []),
        pedagogyFetch<any[]>(`/api/pedagogy/subjects?academicYearId=${academicYearId}`).catch(() => []),
        fetch('/api/pedagogy-space/school-identity', { credentials: 'include' }).then(r => r.json()).catch(() => null),
      ]);
      setClasses(cls || []); setRooms(rms || []); setTeachers(tchs || []); setSubjects(subs || []);
      setSchoolIdentity(si);
      if (tts && tts.length > 0) { setActiveTimetableId(tts[0].id); setTimetables(tts); }
      if (cls && cls.length > 0) setSelectedClassIds([cls[0].id]);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [academicYearId]);

  const loadEntries = useCallback(async () => {
    if (!activeTimetableId) return;
    try { const data = await pedagogyFetch<any>(`/api/timetables/${activeTimetableId}`); setEntries(data?.entries || []); } catch (e) { console.error(e); }
  }, [activeTimetableId]);

  useEffect(() => { loadConfig(); loadData(); }, [loadConfig, loadData]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  const filteredEntries = useMemo(() => {
    if (selectedClassIds.length === 0) return entries;
    return entries.filter(e => { if (!e.classId) return true; return selectedClassIds.includes(e.classId) || selectedClassIds.includes(e.class?.id); });
  }, [entries, selectedClassIds]);

  const toggleClass = (classId: string) => setSelectedClassIds(prev => prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]);

  // ⭐ Récupérer les entries d'une cellule (jour + block)
  const getCellEntries = (dayOfWeek: number, block: any) => {
    return filteredEntries.filter(e => e.dayOfWeek === dayOfWeek && e.startTime >= block.start && e.endTime <= block.end);
  };

  // ⭐ Démarrer l'édition inline d'une cellule
  const startInlineEdit = (dayOfWeek: number, block: any) => {
    setEditingCell({ dayOfWeek, blockStart: block.start, blockEnd: block.end });
    setInlineForm({ subjectId: '', teacherId: '', roomId: '', startTime: block.start, endTime: block.end });
  };

  // ⭐ Sauvegarder l'entry inline
  const handleInlineSave = async () => {
    if (!editingCell || !academicYearId || selectedClassIds.length === 0) return;
    if (!inlineForm.subjectId) { toast({ title: 'Erreur', description: 'Sélectionnez une matière.', variant: 'destructive' }); return; }
    setSaving(true);
    let currentTimetableId = activeTimetableId;
    if (!currentTimetableId) {
      try {
        const newTt = await pedagogyFetch<ManualTimetable>('/api/timetables', { method: 'POST', body: { academicYearId, schoolLevelId: localLevelId || schoolLevelId, name: `EDT ${new Date().getFullYear()}`, startDate: new Date() } });
        if (newTt) { setTimetables([newTt]); setActiveTimetableId(newTt.id); currentTimetableId = newTt.id; } else throw new Error('Création EDT échouée');
      } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); setSaving(false); return; }
    }
    const resolvedSchoolLevelId = localLevelId || schoolLevelId;
    let success = 0, failed = 0;
    for (const classId of selectedClassIds) {
      try {
        await pedagogyFetch(`/api/timetables/${currentTimetableId}/entries`, {
          method: 'POST', body: { classId, subjectId: inlineForm.subjectId, teacherId: inlineForm.teacherId || undefined, roomId: inlineForm.roomId || undefined, dayOfWeek: editingCell.dayOfWeek, startTime: inlineForm.startTime, endTime: inlineForm.endTime, timetableId: currentTimetableId, academicYearId, schoolLevelId: resolvedSchoolLevelId }
        });
        success++;
      } catch { failed++; }
    }
    await loadEntries();
    setEditingCell(null); setSaving(false);
    if (failed === 0) toast({ title: `✅ ${success} séance(s) ajoutée(s)` });
    else toast({ title: 'Partiel', description: `${success} réussie(s), ${failed} échec(s)`, variant: 'destructive' });
  };

  const handleDeleteEntry = async (id: string) => {
    try { await pedagogyFetch(`/api/timetables/entries/${id}`, { method: 'DELETE' }); await loadEntries(); toast({ title: '✅ Séance supprimée' }); }
    catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
  };

  // ⭐ Enregistrer l'EDT actuel (confirmation + rechargement)
  const handleSaveTimetable = async () => {
    if (!activeTimetableId) { toast({ title: 'Aucun EDT à enregistrer', variant: 'destructive' }); return; }
    // Les séances sont déjà enregistrées individuellement (POST par entry).
    // Ce bouton confirme que l'EDT est "terminé" et recharge la liste.
    const className = selectedClassIds.length === 1
      ? (classes.find(c => c.id === selectedClassIds[0])?.name || '')
      : `${selectedClassIds.length} classes`;
    toast({ title: '✅ EDT enregistré', description: `L'emploi du temps de ${className} est sauvegardé.` });
    // Recharger la liste des timetables
    try {
      const tts = await pedagogyFetch<ManualTimetable[]>(`/api/timetables?academicYearId=${academicYearId}`);
      if (tts) setTimetables(tts);
    } catch {}
  };

  // ⭐ Créer un NOUVEL EDT pour d'autres classes
  const handleNewTimetable = async () => {
    if (!academicYearId) return;
    // Désélectionner les classes actuelles
    setSelectedClassIds([]);
    setEntries([]);
    // Créer un nouveau timetable
    try {
      const newTt = await pedagogyFetch<ManualTimetable>('/api/timetables', {
        method: 'POST', body: {
          academicYearId, schoolLevelId: localLevelId || schoolLevelId,
          name: `EDT ${new Date().toLocaleDateString('fr-FR')}`,
          startDate: new Date(),
        },
      });
      if (newTt) {
        setTimetables(prev => [...prev, newTt]);
        setActiveTimetableId(newTt.id);
        toast({ title: '✅ Nouvel EDT créé', description: 'Sélectionnez les classes pour ce nouvel emploi du temps.' });
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  // ⭐ Basculer vers un EDT existant
  const handleSwitchTimetable = async (ttId: string) => {
    setActiveTimetableId(ttId);
    const tt = timetables.find(t => t.id === ttId);
    if (tt) {
      // Charger les entries de cet EDT
      try {
        const data = await pedagogyFetch<any>(`/api/timetables/${ttId}`);
        setEntries(data?.entries || []);
        // Déduire les classes depuis les entries
        const entryClassIds = new Set<string>();
        (data?.entries || []).forEach((e: any) => { if (e.classId) entryClassIds.add(e.classId); if (e.class?.id) entryClassIds.add(e.class.id); });
        setSelectedClassIds(Array.from(entryClassIds));
      } catch { setEntries([]); }
    }
  };

  // ⭐ Export PDF A4 paysage — généré depuis le BACKEND (Puppeteer)
  const handleExportPdf = async () => {
    if (!activeTimetableId || selectedClassIds.length === 0) {
      toast({ title: 'Erreur', description: 'Sélectionnez au moins une classe et ajoutez une séance.', variant: 'destructive' });
      return;
    }
    setExportingPdf(true);
    try {
      const params = new URLSearchParams();
      params.append('classIds', selectedClassIds.join(','));
      const res = await fetch(`/api/timetables/${activeTimetableId}/export-pdf?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erreur génération PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `emploi_du_temps.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: '✅ PDF généré' });
    } catch (e: any) {
      toast({ title: 'Erreur PDF', description: e.message, variant: 'destructive' });
    } finally { setExportingPdf(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /><span className="ml-2 text-sm text-slate-500">Chargement…</span></div>;

  // ⭐ Couleurs pour les matières (cycle)
  const SUBJECT_COLORS = ['bg-blue-50 border-blue-200 text-blue-700','bg-emerald-50 border-emerald-200 text-emerald-700','bg-amber-50 border-amber-200 text-amber-700','bg-rose-50 border-rose-200 text-rose-700','bg-indigo-50 border-indigo-200 text-indigo-700','bg-purple-50 border-purple-200 text-purple-700','bg-cyan-50 border-cyan-200 text-cyan-700'];
  const getSubjectColor = (subjectId?: string) => {
    if (!subjectId) return SUBJECT_COLORS[0];
    const idx = subjects.findIndex(s => s.id === subjectId);
    return SUBJECT_COLORS[Math.abs(idx) % SUBJECT_COLORS.length];
  };

  return (
    <div className="space-y-4">
      {/* ⭐ Sélecteur de niveau scolaire + Liste des EDT sauvegardés + boutons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 p-3">
        {/* Sélecteur de niveau local */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Niveau scolaire</label>
          <select
            value={localLevelId || ''}
            onChange={e => { setLocalLevelId(e.target.value); }}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium bg-white"
          >
            {realLevels.map((l: any) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[250px]">
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Emplois du temps sauvegardés</label>
          {timetables.length === 0 ? (
            <span className="text-xs text-slate-400 italic">Aucun EDT sauvegardé. Cliquez sur "Nouvel EDT" pour commencer.</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {timetables.map(tt => {
                const isActive = tt.id === activeTimetableId;
                // Compter les entries par EDT
                const entryCount = entries.filter(e => e.timetableId === tt.id).length;
                return (
                  <button key={tt.id} onClick={() => handleSwitchTimetable(tt.id)}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                      isActive ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:border-blue-300')}
                    title={tt.name}>
                    {isActive && '✓ '}{tt.name || 'EDT'}{entryCount > 0 && ` (${entryCount})`}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={handleNewTimetable}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold">
            <Plus className="w-3.5 h-3.5" /> Nouvel EDT
          </button>
          <button onClick={handleSaveTimetable} disabled={!activeTimetableId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold">
            <CheckCircle className="w-3.5 h-3.5" /> Enregistrer
          </button>
          <button onClick={handleExportPdf} disabled={exportingPdf || selectedClassIds.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold">
            {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} PDF A4
          </button>
        </div>
      </div>

      {/* ≹ Toolbar : sélecteur multi-classes */}
      <div className="flex flex-wrap items-start gap-3 bg-slate-50 rounded-xl border border-slate-200 p-3">
        <div className="flex-1 min-w-[250px]">
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Classe(s) — sélection multiple possible</label>
          <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto">
            {classes.length === 0 ? <span className="text-xs text-slate-400 italic">Aucune classe</span> :
              classes.map(c => {
                const isSelected = selectedClassIds.includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggleClass(c.id)}
                    className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all', isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:border-blue-300')}>
                    {isSelected && '✓ '}{c.name || c.code}
                  </button>
                );
              })
            }
          </div>
          {selectedClassIds.length > 1 && <span className="text-[10px] text-blue-600 font-semibold mt-1 inline-block">⭐ {selectedClassIds.length} classes — EDT identique</span>}
        </div>
      </div>

      {/* Grille DYNAMIQUE */}
      {selectedClassIds.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-700">Sélectionnez une ou plusieurs classes</p>
          <p className="text-xs text-slate-400 mt-1">Cliquez sur les badges ci-dessus. Multi-sélection possible (CI+CP).</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
          <table className="w-full text-sm border-collapse min-w-[700px]">
            <thead><tr className="bg-slate-100">
              <th className="p-2 text-left text-xs font-bold text-slate-700 border border-slate-200 w-20">Horaire</th>
              {configuredDays.map(d => <th key={d.value} className="p-2 text-center text-xs font-bold text-slate-700 border border-slate-200 min-w-[140px]">{d.label.toUpperCase()}</th>)}
            </tr></thead>
            <tbody>
              {configTimeBlocks.map((block, blockIdx) => {
                const isBreak = block.type !== 'BLOCK';
                // ⭐ Labels pour les types non-Cours (pauses, déjeuner, cérémonial, etc.)
                const breakLabel =
                  block.type === 'LUNCH' ? 'Déjeuner' :
                  block.type === 'BREAK' ? 'Récréation' :
                  block.type === 'RECESS' ? 'Récréation' :
                  block.type === 'CEREMONY' ? 'Cérémonial des couleurs' :
                  block.type === 'STUDY' ? 'Étude' :
                  block.type === 'ACTIVITY' ? 'Activité' :
                  block.type === 'ASSEMBLY' ? 'Assemblée' :
                  block.type || '';
                // ⭐ Icônes pour les types non-Cours
                const BreakIcon =
                  block.type === 'LUNCH' ? Utensils :
                  block.type === 'CEREMONY' ? Flag :
                  block.type === 'STUDY' ? BookOpen :
                  block.type === 'ACTIVITY' ? Users :
                  block.type === 'ASSEMBLY' ? Users :
                  Coffee; // défaut pour BREAK/RECESS
                if (isBreak) {
                  return (
                    <tr key={blockIdx} className="bg-amber-50/50">
                      <td className="p-2 border border-slate-200 text-center"><div className="text-[10px] font-bold text-slate-500">{block.start}</div><div className="text-[10px] font-bold text-slate-500">{block.end}</div></td>
                      <td colSpan={configuredDays.length} className="p-2 border border-slate-200 text-center"><span className="text-xs font-bold text-amber-700 inline-flex items-center gap-1"><BreakIcon className="w-3 h-3" />{breakLabel}</span><span className="text-[10px] text-slate-400 ml-2">({block.start} – {block.end})</span></td>
                    </tr>
                  );
                }
                return (
                  <tr key={blockIdx}>
                    <td className="p-2 border border-slate-200 bg-slate-50 text-center"><div className="text-xs font-bold text-slate-700">{block.start}</div><div className="text-[10px] text-slate-400">{block.end}</div></td>
                    {configuredDays.map(day => {
                      const cellEntries = getCellEntries(day.value, block);
                      const isEditing = editingCell?.dayOfWeek === day.value && editingCell?.blockStart === block.start;
                      return (
                        <td key={day.value} className="p-1 border border-slate-200 align-top" style={{ minHeight: '60px' }}>
                          {/* ⭐ Chaque entry = une "ligne" dans la cellule (aligned with other days via min-height) */}
                          {cellEntries.map(entry => {
                            const colorClass = getSubjectColor(entry.subjectId);
                            return (
                              <div key={entry.id} className={cn('rounded-lg p-1.5 mb-1 border group relative hover:shadow-sm transition', colorClass)} style={{ minHeight: '40px' }}>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold">{entry.startTime}–{entry.endTime}</span>
                                  <button onClick={() => handleDeleteEntry(entry.id)} className="opacity-0 group-hover:opacity-100 p-0.5 bg-red-500 text-white rounded transition" title="Supprimer"><X className="w-2.5 h-2.5" /></button>
                                </div>
                                <div className="text-xs font-bold leading-tight">{entry.subject?.name || '—'}</div>
                                <div className="flex items-center gap-1 text-[9px] text-slate-500">
                                  {entry.teacher && <span>{entry.teacher.firstName?.[0]}. {entry.teacher.lastName}</span>}
                                  {entry.room && <span>· 📍 {entry.room.code}</span>}
                                </div>
                              </div>
                            );
                          })}
                          {/* ⭐ Formulaire INLINE (remplace le modal) */}
                          {isEditing ? (
                            <div className="bg-blue-50 border border-blue-300 rounded-lg p-1.5 space-y-1">
                              <select value={inlineForm.subjectId} onChange={e => setInlineForm({...inlineForm, subjectId: e.target.value})}
                                className="w-full px-1.5 py-1 border border-slate-300 rounded text-[10px] font-medium" autoFocus>
                                <option value="">— Matière —</option>
                                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                              <div className="flex gap-1">
                                <input type="time" value={inlineForm.startTime} onChange={e => setInlineForm({...inlineForm, startTime: e.target.value})} className="w-[45%] px-1 py-0.5 border border-slate-300 rounded text-[10px]" />
                                <input type="time" value={inlineForm.endTime} onChange={e => setInlineForm({...inlineForm, endTime: e.target.value})} className="w-[45%] px-1 py-0.5 border border-slate-300 rounded text-[10px]" />
                              </div>
                              <select value={inlineForm.teacherId} onChange={e => setInlineForm({...inlineForm, teacherId: e.target.value})}
                                className="w-full px-1.5 py-1 border border-slate-300 rounded text-[10px]">
                                <option value="">— Enseignant —</option>
                                {teachers.map(t => <option key={t.teacherId} value={t.teacherId}>{t.teacher?.lastName} {t.teacher?.firstName}</option>)}
                              </select>
                              <select value={inlineForm.roomId} onChange={e => setInlineForm({...inlineForm, roomId: e.target.value})}
                                className="w-full px-1.5 py-1 border border-slate-300 rounded text-[10px]">
                                <option value="">— Salle —</option>
                                {rooms.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
                              </select>
                              <div className="flex gap-1">
                                <button onClick={handleInlineSave} disabled={saving || !inlineForm.subjectId}
                                  className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-[10px] font-bold">
                                  {saving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : '✓ Ajouter'}
                                </button>
                                <button onClick={() => setEditingCell(null)}
                                  className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded text-[10px] font-bold">✕</button>
                              </div>
                            </div>
                          ) : (
                            /* ≉ Bouton + pour ajouter une matière dans cette cellule */
                            <button onClick={() => startInlineEdit(day.value, block)}
                              className="w-full py-1 flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50/50 rounded transition border border-dashed border-slate-200 hover:border-blue-300"
                              style={{ minHeight: '28px' }}>
                              <Plus className="w-3 h-3" />
                            </button>
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
    </div>
  );
}

function SolutionGridModal({ solution, onClose }: { solution: any; onClose: () => void }) {
  const entries: any[] = Array.isArray(solution.entries) ? solution.entries : [];
  const byClass = useMemo(() => {
    const map: Record<string, { className: string; byDay: Record<number, any[]> }> = {};
    for (const e of entries) {
      if (!map[e.classId]) map[e.classId] = { className: e.className || e.classId, byDay: {} };
      if (!map[e.classId].byDay[e.dayOfWeek]) map[e.classId].byDay[e.dayOfWeek] = [];
      map[e.classId].byDay[e.dayOfWeek].push(e);
    }
    Object.values(map).forEach(c => Object.values(c.byDay).forEach(d => d.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))));
    return map;
  }, [entries]);
  const usedDays = useMemo(() => { const s = new Set<number>(); entries.forEach(e => s.add(e.dayOfWeek)); return Array.from(s).sort((a, b) => a - b); }, [entries]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div>
            <h3 className="font-bold text-lg">Grille d'emploi du temps</h3>
            <p className="text-xs text-blue-100">Score {solution.score}% · {entries.length} séance(s) · {Object.keys(byClass).length} classe(s)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-auto p-4 bg-slate-50">
          {entries.length === 0 ? <div className="text-center py-16 text-slate-500"><Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" /><p>Aucune séance.</p></div> : (
            <table className="w-full text-sm border-collapse bg-white rounded-lg overflow-hidden shadow-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-3 text-left text-xs font-bold text-slate-700 border border-slate-200 sticky left-0 bg-slate-100 z-10">Classe</th>
                  {usedDays.map(d => <th key={d} className="p-3 text-center text-xs font-bold text-slate-700 border border-slate-200 min-w-[160px]">{DAYS.find(day => day.value === d)?.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(byClass).map(([classId, classData]) => {
                  const { className, byDay } = classData as any;
                  return (
                    <tr key={classId}>
                      <td className="p-3 font-bold text-slate-800 border border-slate-200 bg-slate-50 sticky left-0 z-10">{className}</td>
                      {usedDays.map(d => (
                        <td key={d} className="p-1.5 border border-slate-200 align-top">
                          {(byDay[d] || []).map((e: any, i: number) => (
                            <div key={i} className={cn(
                              'border rounded-lg p-2 mb-1',
                              e.isMultigrade
                                ? 'bg-amber-50 border-amber-300'
                                : 'bg-blue-50 border-blue-200',
                            )}>
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="text-[10px] font-bold text-blue-700">{e.startTime} → {e.endTime}</div>
                                {e.isMultigrade && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500 text-white rounded text-[8px] font-bold uppercase" title={`Multigrade — alternance avec ${e.multigradePairedClass || 'classe jumelée'}`}>
                                    <Layers className="w-2 h-2" /> MG
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-bold text-slate-800">{e.subjectName}</div>
                              <div className="text-[10px] text-slate-500">{e.teacherName}</div>
                              {e.roomName && <div className="text-[10px] text-slate-400">📍 {e.roomName}</div>}
                              {e.isMultigrade && e.multigradePairedClass && (
                                <div className="text-[9px] text-amber-600 font-bold mt-0.5">↔ {e.multigradePairedClass}</div>
                              )}
                            </div>
                          ))}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
