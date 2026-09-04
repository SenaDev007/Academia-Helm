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

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Settings, Calendar, Zap, CheckCircle, Loader2, Trash2,
  Clock, AlertCircle, Star, Eye, Pencil, X,
  Users, Info, Shield, GitCompare, Sparkles, Printer, Download, Plus, Layers,
  Coffee, Utensils, FileDown, BookOpen, Save,
} from 'lucide-react';
import { BeninFlag } from '@/components/ui/BeninFlag';
import { SUB_SUBJECT_CATALOG } from '@/lib/utils/sub-subject-catalog';
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

/**
 * ⭐ Normalise un nom de matière (côté frontend) pour la déduplication visuelle.
 *    DOIT être identique à SubjectsPrismaService.normalizeSubjectName côté backend.
 *
 * Variantes qui convergent vers le même nom normalisé :
 *   "Lecture-Écriture"      → "lecture ecriture"
 *   "lecture écriture"     → "lecture ecriture"
 *   "Lecture/Ecriture"      → "lecture ecriture"
 *   "Lecture + Écriture"    → "lecture ecriture"
 *   "Lecture et Écriture"   → "lecture ecriture"
 *   "Poésie-Chant"         → "poesie chant"
 */
function normalizeSubjectName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*[-/\\+&]\s*/g, ' ')
    .replace(/\s+(?:et|and)\s+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ⭐ Formate une heure "08:15" → "8h15" (français naturel, sans zéro initial)
 *    Utilisé dans la colonne horaire de l'EDT pour afficher "8h00-10h15" sur une ligne.
 */
function fmtTime(t: string | null | undefined): string {
  if (!t || typeof t !== 'string') return '';
  const [h, m] = t.split(':');
  if (!h || !m) return t;
  return `${parseInt(h, 10)}h${m}`;
}

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
                  academicYearLabel={academicYear?.label}
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
  const [loading, setLoading] = useState(true);
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
            const isCustomType = !['BLOCK', 'BREAK', 'LUNCH', 'RECESS', 'STUDY', 'ACTIVITY', 'ASSEMBLY', 'CEREMONY'].includes(block.type);
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
                {/* ⭐ Sélecteur de jours pour le Cérémonial des couleurs
                    L'école choisit quels jours le cérémonial s'applique (Lundi seulement,
                    Lundi+Vendredi, etc.). Par défaut = tous les jours configurés. */}
                {block.type === 'CEREMONY' && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Jours :</span>
                    {DAYS.filter(d => d.value <= 6).map(d => {
                      const activeDays = Array.isArray(block.activeDays) ? block.activeDays : schoolDays;
                      const isChecked = activeDays.includes(d.value);
                      return (
                        <button key={d.value} type="button"
                          onClick={() => {
                            const current = Array.isArray(block.activeDays) ? block.activeDays : schoolDays;
                            const next = isChecked ? current.filter((x: number) => x !== d.value) : [...current, d.value].sort();
                            updateBlock(i, 'activeDays', next);
                          }}
                          className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all',
                            isChecked ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-400 border-slate-200')}
                        >
                          {d.label.substring(0, 3)}
                        </button>
                      );
                    })}
                  </div>
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
                   block.type === 'CEREMONY' ? 'Cérémonial des couleurs / Hymne national' :
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

function TimetableTab({ solutions, schoolLevelId, academicYearId, academicYearLabel, onAccept, onView, onRegenerate }: any) {
  // ⭐ SIMPLIFICATION : on affiche DIRECTEMENT le ManualEditor.
  //    Avant, il y avait un toggle "Solutions générées" / "Édition manuelle"
  //    qui par défaut montrait "Aucune solution générée" + bouton "Générer"
  //    → l'utilisateur voyait encore la génération auto malgré nos commentaires.
  //    Maintenant : pas de toggle, pas de SolutionsList → ManualEditor uniquement.
  return (
    <div className="space-y-4">
      <ManualEditor schoolLevelId={schoolLevelId} academicYearId={academicYearId} academicYearLabel={academicYearLabel} />
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

function ManualEditor({ schoolLevelId, academicYearId, academicYearLabel }: { schoolLevelId: string; academicYearId: string; academicYearLabel?: string }) {
  const { toast } = useToast();
  const { schoolLevel } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  // ⭐ Niveaux réels (sans l'option virtuelle 'ALL')
  const realLevels = (availableLevels || []).filter((l: any) => l.id !== 'ALL' && l.isActive !== false);
  // ⭐ DEUX IDs différents pour deux usages différents :
  //    - configLevelId = l.id (UUID education_structure) → pour fetch la config
  //      (le ConfigTab sauve avec cet ID, donc on doit l'utiliser pour retrouver)
  //    - localLevelId = l.schoolLevelId (UUID school_levels) → pour créer un Timetable
  //      (le Timetable model a une FK vers school_levels.id)
  //    Avant ce fix, on utilisait le même ID pour les deux → soit la config ne
  //    correspondait pas, soit la création de Timetable échouait (FK invalide).
  const [configLevelId, setConfigLevelId] = useState<string | null>(
    (schoolLevelId && schoolLevelId !== 'ALL') ? schoolLevelId : (realLevels[0]?.id ?? null)
  );
  const [localLevelId, setLocalLevelId] = useState<string | null>(
    (() => {
      // Chercher le schoolLevelId correspondant au configLevelId
      const match = realLevels.find((l: any) => l.id === configLevelId);
      if (match?.schoolLevelId) return match.schoolLevelId;
      // Fallback: premier niveau avec schoolLevelId non null
      const first = realLevels.find((l: any) => l.schoolLevelId);
      return first?.schoolLevelId ?? null;
    })()
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
  // ⭐ Assignations enseignant→classe pour auto-détection du titulaire
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([]);
  // ⭐ Édition INLINE : au lieu d'un modal, on édite directement dans la cellule
  //    editingCell = { dayOfWeek, blockStart, blockEnd } identifie la cellule en cours d'édition
  const [editingCell, setEditingCell] = useState<{ dayOfWeek: number; blockStart: string; blockEnd: string } | null>(null);
  const [inlineForm, setInlineForm] = useState<any>({ subjectId: '', duration: 30, step: '' });
  // ⭐ ID de l'entry en cours d'édition (vs création nouvelle).
  //    Si editingEntryId est défini → handleInlineSave fait un PUT (update)
  //    Sinon → POST (create) comme avant.
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // ⭐ Ref pour empêcher les appels parallèles à handleInlineSave (race condition
  //    entre auto-save et clic manuel). Le state `saving` ne suffit pas car il est
  //    async — deux appels simultanés verraient `saving=false` tous les deux.
  const savingRef = useRef(false);
  // ⭐ Auto-sauvegarde : toutes les 10 secondes, si le formulaire inline est ouvert
  //    avec une matière valide, on déclenche handleInlineSave automatiquement.
  //    L'utilisateur n'a plus besoin de cliquer "Ajouter" — la séance est sauvegardée
  //    en arrière-plan. Le compte à rebours est affiché dans le formulaire.
  const [autoSaveCountdown, setAutoSaveCountdown] = useState<number>(10);
  const countdownRef = useRef<number>(10);
  // ⭐ Timestamp de la dernière activité utilisateur (frappe, clic, sélection).
  //    Si l'utilisateur est actif, on RESET le compte à rebours — pas d'auto-save
  //    pendant que l'utilisateur remplit le formulaire. Le compteur ne décompte
  //    que pendant les 10s de silence complet.
  const lastActivityRef = useRef<number>(Date.now());
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<Date | null>(null);
  // ⭐ Export PDF
  const [exportingPdf, setExportingPdf] = useState(false);
  // ≉ School identity pour le PDF
  const [schoolIdentity, setSchoolIdentity] = useState<any>(null);

  const configuredDays = DAYS.filter(d => configSchoolDays.includes(d.value));

  const loadConfig = useCallback(async () => {
    // ⭐ Utilise configLevelId (UUID education_structure) — c'est l'ID que le
    //    ConfigTab utilise pour sauver la config dans timetable_configs.
    //    localLevelId (UUID school_levels) est utilisé uniquement pour créer
    //    des Timetables (FK vers school_levels).
    const levelId = configLevelId;
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
  }, [configLevelId, academicYearId]);

  const loadData = useCallback(async () => {
    if (!academicYearId) return;
    setLoading(true);
    try {
      const [tts, cls, rms, tchs, subs, si, tca] = await Promise.all([
        pedagogyFetch<ManualTimetable[]>(`/api/timetables?academicYearId=${academicYearId}`).catch(() => []),
        pedagogyFetch<any[]>(`/api/pedagogy/academic-structure/classes?academicYearId=${academicYearId}`).catch(() => []),
        pedagogyFetch<any[]>(`/api/rooms`).catch(() => []),
        pedagogyFetch<any[]>(`/api/pedagogy/teacher-profiles?academicYearId=${academicYearId}`).catch(() => []),
        pedagogyFetch<any[]>(`/api/pedagogy/subjects?academicYearId=${academicYearId}`).catch(() => []),
        fetch('/api/pedagogy-space/school-identity', { credentials: 'include' }).then(r => r.json()).catch(() => null),
        // ⭐ Récupérer les affectations enseignant→classe pour auto-détection
        pedagogyFetch<any[]>(`/api/pedagogy/teacher-class-assignments?academicYearId=${academicYearId}`).catch(() => []),
      ]);
      setClasses(cls || []); setRooms(rms || []); setTeachers(tchs || []); setSubjects(subs || []);
      setTeacherAssignments(Array.isArray(tca) ? tca : (tca?.data || []));
      setSchoolIdentity(si);
      if (tts && tts.length > 0) { setActiveTimetableId(tts[0].id); setTimetables(tts); }
      if (cls && cls.length > 0) setSelectedClassIds([cls[0].id]);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [academicYearId]);

  const loadEntries = useCallback(async () => {
    if (!activeTimetableId) return;
    try {
      const data = await pedagogyFetch<any>(`/api/timetables/${activeTimetableId}`);
      const tEntries = data?.entries || [];
      setEntries(tEntries);
      // ⭐ AUTO-RENAME : si le nom de l'EDT contient "#" (ancien format) ou ne mentionne
      //    pas les classes, on le met à jour automatiquement avec les classes détectées.
      //    Ex: "EDT Primaire #3" → "EDT CI 2026-2027" (basé sur les entries)
      const currentTt = timetables.find(t => t.id === activeTimetableId);
      if (currentTt && tEntries.length > 0) {
        const yearLabel = academicYearLabel || new Date().getFullYear().toString();
        const needsRename = currentTt.name.includes('#') || !currentTt.name.includes(yearLabel);
        if (needsRename) {
          // Extraire les noms de classes uniques depuis les entries
          const classNames = Array.from(new Set(
            tEntries.map((e: any) => e.class?.name).filter(Boolean)
          )).sort();
          if (classNames.length > 0) {
            const newName = `EDT ${classNames.join(' + ')} ${yearLabel}`;
            // Mettre à jour le nom côté backend + local
            pedagogyFetch(`/api/timetables/${activeTimetableId}`, {
              method: 'PUT', body: { name: newName }
            }).then(() => {
              setTimetables(prev => prev.map(t => t.id === activeTimetableId ? { ...t, name: newName } : t));
            }).catch(() => {});
          }
        }
      }
    } catch (e) { console.error(e); }
  }, [activeTimetableId, timetables, academicYearLabel]);

  useEffect(() => { loadConfig(); loadData(); }, [loadConfig, loadData]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  const filteredEntries = useMemo(() => {
    if (selectedClassIds.length === 0) return entries;
    // ⭐ Filtrage par AcademicClass — on accepte les entries dont :
    //    - classId correspond directement à un ID sélectionné (cas section physique)
    //    - class.id correspond (même chose)
    //    - class.officialClassId correspond (l'entry a été créée pour la 1ère section physique
    //      de l'AcademicClass, mais représente l'EDT pour toute la classe académique)
    return entries.filter(e => {
      if (!e.classId) return true;
      return selectedClassIds.includes(e.classId)
        || selectedClassIds.includes(e.class?.id)
        || selectedClassIds.includes(e.class?.officialClassId);
    });
  }, [entries, selectedClassIds]);

  const toggleClass = (classId: string) => setSelectedClassIds(prev => prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]);

  // ⭐ Récupérer les entries d'une cellule (jour + block)
  const getCellEntries = (dayOfWeek: number, block: any) => {
    return filteredEntries.filter(e => e.dayOfWeek === dayOfWeek && e.startTime >= block.start && e.endTime <= block.end);
  };

  // ⭐ Démarrer l'édition inline d'une cellule (NOUVELLE séance)
  //    Plus de sélecteur enseignant ni salle (supprimé pour maternelle/primaire).
  //    L'EDT est commun à toutes les sections de l'AcademicClass — chaque enseignant
  //    verra automatiquement l'EDT de sa classe dans son UI, et chaque parent
  //    verra celui de son enfant.
  const startInlineEdit = (dayOfWeek: number, block: any) => {
    setEditingCell({ dayOfWeek, blockStart: block.start, blockEnd: block.end });
    setEditingEntryId(null); // ⭐ mode création
    setInlineForm({ subjectId: '', duration: 30, step: '' });
  };

  // ⭐ Démarrer l'édition inline d'une séance EXISTANTE (modification)
  //    Pré-remplit le formulaire avec les valeurs actuelles de l'entry.
  //    L'utilisateur peut corriger matière / durée / étape, puis sauvegarder.
  const startInlineEditEntry = (entry: any) => {
    // Trouver le block qui contient cette entry (par startTime/endTime)
    const block = configTimeBlocks.find(b =>
      b.type === 'BLOCK' && b.start <= entry.startTime && b.end >= entry.endTime
    );
    if (!block) {
      toast({ title: 'Erreur', description: 'Impossible de retrouver le créneau horaire de cette séance.', variant: 'destructive' });
      return;
    }
    setEditingCell({ dayOfWeek: entry.dayOfWeek, blockStart: block.start, blockEnd: block.end });
    setEditingEntryId(entry.id); // ⭐ mode édition
    // Calculer la durée depuis startTime/endTime
    const [sh, sm] = (entry.startTime || '').split(':').map(Number);
    const [eh, em] = (entry.endTime || '').split(':').map(Number);
    const duration = (eh * 60 + em) - (sh * 60 + sm) || 30;
    setInlineForm({
      subjectId: entry.subjectId || '',
      duration,
      step: entry.step || '',
    });
  };

  // ⭐ Calculer l'heure de début pour la nouvelle séance = fin de la dernière séance
  //    (ou début du block s'il n'y a pas encore de séance)
  const calcStartTime = (dayOfWeek: number, block: any): string => {
    const cellEntries = getCellEntries(dayOfWeek, block);
    // ⭐ Tenir compte du cérémonial qui occupe du temps au début du block
    const ceremonyInBlock = configTimeBlocks.filter(
      b => b.type === 'CEREMONY' && b.start >= block.start && b.end <= block.end
    );
    let latestEnd = block.start;
    // Si cérémonial ce jour-là, partir après sa fin
    for (const cer of ceremonyInBlock) {
      const cerDays = Array.isArray(cer.activeDays) ? cer.activeDays : configSchoolDays;
      if (cerDays.includes(dayOfWeek) && cer.end > latestEnd) {
        latestEnd = cer.end;
      }
    }
    // Chercher la fin de la dernière séance
    for (const e of cellEntries) {
      if (e.endTime > latestEnd) latestEnd = e.endTime;
    }
    return latestEnd;
  };

  // ⭐ Calculer l'heure de fin = startTime + duration (minutes)
  const calcEndTime = (startTime: string, durationMin: number): string => {
    const [h, m] = startTime.split(':').map(Number);
    const totalMin = h * 60 + m + durationMin;
    const eh = Math.floor(totalMin / 60);
    const em = totalMin % 60;
    return `${eh.toString().padStart(2, '0')}:${em.toString().padStart(2, '0')}`;
  };

  // ⭐ Calculer la durée totale du block en minutes
  const blockDurationMin = (block: any): number => {
    const [sh, sm] = block.start.split(':').map(Number);
    const [eh, em] = block.end.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  };

  // ⭐ Calculer la durée déjà occupée dans une cellule (séances + cérémonial)
  const usedDurationMin = (dayOfWeek: number, block: any): number => {
    let total = 0;
    // Séances existantes
    const cellEntries = getCellEntries(dayOfWeek, block);
    for (const e of cellEntries) {
      const [sh, sm] = (e.startTime || '').split(':').map(Number);
      const [eh, em] = (e.endTime || '').split(':').map(Number);
      total += (eh * 60 + em) - (sh * 60 + sm);
    }
    // Cérémonial
    const ceremonyInBlock = configTimeBlocks.filter(
      b => b.type === 'CEREMONY' && b.start >= block.start && b.end <= block.end
    );
    for (const cer of ceremonyInBlock) {
      const cerDays = Array.isArray(cer.activeDays) ? cer.activeDays : configSchoolDays;
      if (cerDays.includes(dayOfWeek)) {
        const [sh, sm] = cer.start.split(':').map(Number);
        const [eh, em] = cer.end.split(':').map(Number);
        total += (eh * 60 + em) - (sh * 60 + sm);
      }
    }
    return total;
  };

  // ⭐ Sauvegarder l'entry inline
  const handleInlineSave = async () => {
    if (savingRef.current) {
      console.log('[handleInlineSave] Skipped — save already in flight (auto-save + manual click race)');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    if (!editingCell || !academicYearId || selectedClassIds.length === 0) {
      savingRef.current = false;
      setSaving(false);
      return;
    }

    // ⭐ Résoudre le subjectId selon le type de sélection :
    //    - ID normal (ex: "abc-123") → utiliser tel quel
    //    - "__CAT__Lecture" → créer la matière à la volée, puis utiliser son ID
    //    - "__CUSTOM__" → créer la matière personnalisée à la volée
    let resolvedSubjectId = inlineForm.subjectId;
    if (inlineForm.subjectId === '__CUSTOM__') {
      const customName = (inlineForm as any).customSubjectName?.trim();
      if (!customName) { toast({ title: 'Erreur', description: 'Saisissez le nom de la matière.', variant: 'destructive' }); return; }
      // ⭐ Code auto-généré normalisé — utiliser normalizeSubjectName pour cohérence
      //    ex: "Lecture-Écriture" → "lecture ecriture" → "LECTURE-ECRITURE" (uppercase)
      //    Les variantes orthographiques donnent le même code.
      const normalizedCode = normalizeSubjectName(customName).replace(/\s/g, '-').substring(0, 30).toUpperCase() || 'CUSTOM-' + Date.now();
      try {
        const newSub = await pedagogyFetch<any>(`/api/subjects`, {
          method: 'POST', body: {
            academicYearId, schoolLevelId: localLevelId || schoolLevelId,
            code: normalizedCode,
            abbreviation: normalizeSubjectName(customName).replace(/\s/g, '').substring(0, 5).toUpperCase() || 'CUSTOM',
            name: customName, coefficient: 1, weeklyHours: 120,
          },
        });
        // ⭐ Si le backend a retourné une matière existante (dédup intelligente),
        //    ne pas l'ajouter à la liste locale si elle y est déjà.
        if (newSub?.id) {
          resolvedSubjectId = newSub.id;
          setSubjects(prev => prev.some(s => s.id === newSub.id) ? prev : [...prev, newSub]);
        }
        else { toast({ title: 'Erreur', description: 'Impossible de créer la matière.', variant: 'destructive' }); return; }
      } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); return; }
    } else if (inlineForm.subjectId.startsWith('__CAT__')) {
      // ⭐ Matière du catalogue qui n'existe pas encore en DB → créer à la volée
      const catName = inlineForm.subjectId.replace('__CAT__', '');
      const normalizedCatCode = normalizeSubjectName(catName).replace(/\s/g, '-').substring(0, 30).toUpperCase() || 'CAT-' + Date.now();
      try {
        const newSub = await pedagogyFetch<any>(`/api/subjects`, {
          method: 'POST', body: {
            academicYearId, schoolLevelId: localLevelId || schoolLevelId,
            code: normalizedCatCode,
            abbreviation: normalizeSubjectName(catName).replace(/\s/g, '').substring(0, 5).toUpperCase() || 'CAT',
            name: catName, coefficient: 1, weeklyHours: 120,
          },
        });
        if (newSub?.id) {
          resolvedSubjectId = newSub.id;
          setSubjects(prev => prev.some(s => s.id === newSub.id) ? prev : [...prev, newSub]);
        }
        else { toast({ title: 'Erreur', description: 'Impossible de créer la matière.', variant: 'destructive' }); return; }
      } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); return; }
    }

    if (!resolvedSubjectId || resolvedSubjectId.startsWith('__')) {
      toast({ title: 'Erreur', description: 'Sélectionnez une matière.', variant: 'destructive' }); return;
    }
    setSaving(true);

    // ⭐ Calculer startTime et endTime depuis la durée
    //    startTime = fin de la dernière séance (ou début du block, ou fin du cérémonial)
    //    endTime = startTime + duration minutes
    //    EN MODE ÉDITION : on garde le startTime original (l'entry ne change pas de position)
    //    et on recalcule endTime = startTime + nouvelle durée.
    let calcStart: string, calcEnd: string;
    if (editingEntryId) {
      // ⭐ Mode édition — récupérer le startTime actuel de l'entry
      const existingEntry = entries.find(e => e.id === editingEntryId);
      if (existingEntry) {
        calcStart = existingEntry.startTime;
      } else {
        // Fallback : utiliser le calcul normal
        calcStart = calcStartTime(editingCell.dayOfWeek, { start: editingCell.blockStart, end: editingCell.blockEnd });
      }
      calcEnd = calcEndTime(calcStart, Number(inlineForm.duration) || 30);
    } else {
      // ⭐ Mode création — calculer depuis le block
      calcStart = calcStartTime(editingCell.dayOfWeek, { start: editingCell.blockStart, end: editingCell.blockEnd });
      calcEnd = calcEndTime(calcStart, Number(inlineForm.duration) || 30);
    }

    // ⭐ NE PAS auto-créer un EDT silencieusement — c'est ce qui causait la confusion :
    //    l'utilisateur cliquait "Ajouter une matière", un EDT était créé en silence,
    //    puis l'ajout échouait sans explication. Maintenant on demande explicitement
    //    à l'utilisateur de créer un EDT d'abord via le bouton "Nouvel EDT".
    if (!activeTimetableId) {
      toast({
        title: 'Aucun EDT actif',
        description: 'Cliquez sur "Nouvel EDT" pour créer un emploi du temps avant d\'ajouter des séances.',
        variant: 'destructive',
      });
      setSaving(false);
      savingRef.current = false;
      return;
    }
    const currentTimetableId = activeTimetableId;
    const resolvedSchoolLevelId = localLevelId || schoolLevelId;

    // ⭐ MODE ÉDITION : PUT /api/timetables/entries/:id avec les champs modifiés
    //    On ne met à jour qu'une seule entry (pas de boucle sur selectedClassIds).
    if (editingEntryId) {
      try {
        await pedagogyFetch<any>(`/api/timetables/entries/${editingEntryId}`, {
          method: 'PUT',
          body: {
            subjectId: resolvedSubjectId,
            dayOfWeek: editingCell.dayOfWeek,
            startTime: calcStart,
            endTime: calcEnd,
            duration: Number(inlineForm.duration) || 30,
            step: inlineForm.step || undefined,
          },
        });
        await loadEntries();
        savingRef.current = false;
        setSaving(false);
        setLastAutoSaveAt(new Date());
        setEditingCell(null);
        setEditingEntryId(null);
        toast({ title: '✅ Séance modifiée' });
      } catch (e: any) {
        savingRef.current = false;
        setSaving(false);
        console.error('[handleInlineSave] PUT entries failed:', { entryId: editingEntryId, error: e.message });
        toast({
          title: 'Échec de la modification',
          description: e.message || 'Erreur inconnue',
          variant: 'destructive',
        });
      }
      return;
    }

    // ⭐ MODE CRÉATION : POST /api/timetables/:id/entries pour chaque classe sélectionnée
    let success = 0, failed = 0;
    let lastErrorMessage: string | null = null;
    for (const classId of selectedClassIds) {
      try {
        // ⭐ La réponse peut être une entry simple OU { count: N, entries: [...] }
        //    si le backend a résolu l'AcademicClass en plusieurs sections physiques.
        const result = await pedagogyFetch<any>(`/api/timetables/${currentTimetableId}/entries`, {
          method: 'POST', body: { classId, subjectId: resolvedSubjectId, dayOfWeek: editingCell.dayOfWeek, startTime: calcStart, endTime: calcEnd, timetableId: currentTimetableId, academicYearId, schoolLevelId: resolvedSchoolLevelId, step: inlineForm.step || undefined }
        });
        // ⭐ Si le backend a créé plusieurs entries (multi-section), on compte le total
        //    sinon on compte 1 entry par POST réussi.
        success += (result?.count && typeof result.count === 'number') ? result.count : 1;
      } catch (e: any) {
        failed++;
        lastErrorMessage = e.message || 'Erreur inconnue';
        // ⭐ Console.error pour faciliter le debug depuis la console navigateur
        console.error('[handleInlineSave] POST entries failed:', { classId, subjectId: resolvedSubjectId, error: e.message, body: { classId, subjectId: resolvedSubjectId, dayOfWeek: editingCell.dayOfWeek, startTime: calcStart, endTime: calcEnd, timetableId: currentTimetableId, academicYearId, schoolLevelId: resolvedSchoolLevelId, step: inlineForm.step || undefined } });
      }
    }
    await loadEntries();
    savingRef.current = false;
    setSaving(false);
    setLastAutoSaveAt(new Date());
    if (failed === 0) {
      toast({ title: `✅ ${success} séance(s) ajoutée(s)` });
      // ⭐ Fermer le formulaire uniquement en cas de succès complet
      setEditingCell(null);
    } else {
      // ⭐ En cas d'échec : garder le formulaire OUVERT pour permettre à l'utilisateur de réessayer,
      //    ET afficher le message d'erreur réel (au lieu du simple "Partiel" silencieux)
      toast({
        title: `Échec — ${success} réussie(s), ${failed} échec(s)`,
        description: lastErrorMessage || 'Erreur inconnue',
        variant: 'destructive',
      });
    }
  };

  // ⭐ Auto-sauvegarde : toutes les 10 secondes, si le formulaire inline est ouvert
  //    avec une matière valide, on déclenche handleInlineSave automatiquement.
  //    Le compte à rebours est affiché dans le formulaire inline.
  //    Conditions pour déclencher :
  // ⭐ Auto-sauvegarde : toutes les 10 secondes, si le formulaire inline est ouvert
  //    avec une matière valide, on déclenche handleInlineSave automatiquement.
  //    Le compte à rebours est affiché dans le formulaire inline.
  //    Conditions pour déclencher :
  //    1. editingCell est défini (formulaire ouvert)
  //    2. !saving (pas déjà en cours de sauvegarde)
  //    3. inlineForm.subjectId est valide (matière sélectionnée)
  //    4. activeTimetableId existe (un EDT est actif)
  //    5. ⭐ INACTIVITÉ de 10s — si l'utilisateur tape/clique, on reset le compteur
  //       → évite de sauvegarder/fermer en pleine saisie
  useEffect(() => {
    // ⭐ Reset lastActivityRef quand on ouvre le formulaire
    lastActivityRef.current = Date.now();
    countdownRef.current = 10;
    setAutoSaveCountdown(10);

    // ⭐ Si pas d'édition ou sauvegarde en cours → pas de timer
    if (!editingCell || saving) {
      return;
    }
    // ⭐ Vérifier que le formulaire a une matière valide
    const isValidSubject = inlineForm.subjectId &&
      !inlineForm.subjectId.startsWith('__') &&
      !(inlineForm.subjectId === '__CUSTOM__' && !(inlineForm as any).customSubjectName?.trim());
    if (!isValidSubject || !activeTimetableId) {
      return;
    }
    // ⭐ Écouteurs d'activité globale — reset du compteur sur n'importe quelle
    //    interaction utilisateur (frappe, clic, scroll). Sans ça, le compteur
    //    continue même si l'utilisateur tape dans un champ, et finit par sauver
    //    en pleine saisie.
    const onActivity = () => {
      lastActivityRef.current = Date.now();
      countdownRef.current = 10;
      setAutoSaveCountdown(10);
    };
    document.addEventListener('keydown', onActivity);
    document.addEventListener('mousedown', onActivity);
    document.addEventListener('input', onActivity);
    document.addEventListener('change', onActivity);

    // ⭐ Démarrer le compte à rebours
    const interval = setInterval(() => {
      // ⭐ Vérifier l'inactivité — si moins de 10s depuis la dernière activité,
      //    on ne décrémente PAS le compteur (il reste à 10).
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs < 10000) {
        // Encore actif récemment → on s'assure que le compteur est à 10
        if (countdownRef.current !== 10) {
          countdownRef.current = 10;
          setAutoSaveCountdown(10);
        }
        return;
      }
      countdownRef.current -= 1;
      setAutoSaveCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        // ⭐ Reset le compteur AVANT d'appeler handleInlineSave pour éviter
        //    que l'effet ne se redéclenche pendant la sauvegarde
        countdownRef.current = 10;
        setAutoSaveCountdown(10);
        // ⭐ Appeler handleInlineSave dans le prochain tick pour éviter
        //    le warning "setState in render"
        setTimeout(() => handleInlineSave(), 0);
      }
    }, 1000);

    const cleanup = () => {
      clearInterval(interval);
      document.removeEventListener('keydown', onActivity);
      document.removeEventListener('mousedown', onActivity);
      document.removeEventListener('input', onActivity);
      document.removeEventListener('change', onActivity);
    };
    return cleanup;
    // ⚠️ Ne pas inclure handleInlineSave dans les deps — il change à chaque render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCell, editingEntryId, inlineForm.subjectId, inlineForm.customSubjectName, inlineForm.step, inlineForm.duration, saving, activeTimetableId, selectedClassIds]);

  const handleDeleteEntry = async (id: string) => {
    try { await pedagogyFetch(`/api/timetables/entries/${id}`, { method: 'DELETE' }); await loadEntries(); toast({ title: '✅ Séance supprimée' }); }
    catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'destructive' }); }
  };

  // ⭐ Supprimer un EDT complet
  const handleDeleteTimetable = async (ttId: string) => {
    if (!ttId) return;
    try {
      await pedagogyFetch(`/api/timetables/${ttId}`, { method: 'DELETE' });
      setTimetables(prev => prev.filter(t => t.id !== ttId));
      if (activeTimetableId === ttId) {
        setActiveTimetableId(null);
        setEntries([]);
        setSelectedClassIds([]);
      }
      toast({ title: '✅ EDT supprimé' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
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
    const levelId = localLevelId || schoolLevelId;
    if (!levelId || levelId === 'ALL') {
      toast({ title: 'Erreur', description: 'Sélectionnez un niveau scolaire dans le sélecteur ci-dessus avant de créer un EDT.', variant: 'destructive' });
      return;
    }
    // Désélectionner les classes actuelles
    setSelectedClassIds([]);
    setEntries([]);
    // ⭐ Nommer l'EDT de façon professionnelle : niveau + année scolaire
    //    Ex: "EDT Primaire 2026-2027" au lieu de "EDT Primaire #3"
    const levelLabel = realLevels.find((l: any) => l.schoolLevelId === levelId)?.label || realLevels.find((l: any) => l.id === configLevelId)?.label || 'Niveau';
    const yearLabel = academicYear?.label || new Date().getFullYear().toString();
    const edtName = `EDT ${levelLabel} ${yearLabel}`;
    // Créer un nouveau timetable
    try {
      const newTt = await pedagogyFetch<ManualTimetable>('/api/timetables', {
        method: 'POST', body: {
          academicYearId, schoolLevelId: levelId,
          name: edtName,
          startDate: new Date().toISOString(),
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
            value={configLevelId || ''}
            onChange={e => {
              setConfigLevelId(e.target.value);
              // ⭐ Synchroniser localLevelId (schoolLevelId) avec configLevelId (education_structure)
              const match = realLevels.find((l: any) => l.id === e.target.value);
              setLocalLevelId(match?.schoolLevelId || null);
            }}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium bg-white"
          >
            {realLevels.map((l: any) => (
              <option key={l.schoolLevelId || l.id} value={l.id}>{l.label || l.name || l.code}</option>
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
                const entryCount = entries.filter(e => e.timetableId === tt.id).length;
                return (
                  <div key={tt.id} className="inline-flex items-center gap-1">
                    <button onClick={() => handleSwitchTimetable(tt.id)}
                      className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                        isActive ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:border-blue-300')}
                      title={tt.name}>
                      {isActive && '✓ '}{tt.name || 'EDT'}{entryCount > 0 && ` (${entryCount})`}
                    </button>
                    {/* ⭐ Bouton RENOMMER l'EDT */}
                    <button
                      onClick={async () => {
                        const newName = window.prompt('Renommer l\'emploi du temps :', tt.name);
                        if (newName && newName.trim() && newName !== tt.name) {
                          try {
                            await pedagogyFetch(`/api/timetables/${tt.id}`, {
                              method: 'PUT', body: { name: newName.trim() }
                            });
                            setTimetables(prev => prev.map(t => t.id === tt.id ? { ...t, name: newName.trim() } : t));
                            toast({ title: '✅ EDT renommé', description: newName.trim() });
                          } catch (e: any) {
                            toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
                          }
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                      title="Renommer cet EDT">
                      <Pencil className="w-3 h-3" />
                    </button>
                    {/* ⭐ Bouton supprimer l'EDT */}
                    <button onClick={() => handleDeleteTimetable(tt.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                      title="Supprimer cet EDT">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold">
              {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} PDF A4
            </button>
          </div>
          {/* ⭐ Auto-sauvegarde badge — indique que les séances sont sauvegardées
              automatiquement toutes les 10 secondes pendant l'édition inline */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-[9px] font-semibold text-blue-700">
            <Save className="w-2.5 h-2.5" />
            Auto-sauvegarde 10s
            {lastAutoSaveAt && (
              <span className="text-blue-500 ml-1">
                · {lastAutoSaveAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </span>
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
                  block.type === 'CEREMONY' ? 'Cérémonial des couleurs / Hymne national' :
                  block.type === 'STUDY' ? 'Étude' :
                  block.type === 'ACTIVITY' ? 'Activité' :
                  block.type === 'ASSEMBLY' ? 'Assemblée' :
                  block.type || '';
                // ⭐ Icônes pour les types non-Cours
                const BreakIcon =
                  block.type === 'LUNCH' ? Utensils :
                  block.type === 'STUDY' ? BookOpen :
                  block.type === 'ACTIVITY' || block.type === 'ASSEMBLY' ? Users :
                  Coffee; // défaut pour BREAK/RECESS
                // ⭐ CEREMONY n'est PAS rendu comme une ligne séparée.
                //    Au lieu de ça, il est intégré DANS la cellule du BLOCK
                //    dont l'intervalle horaire contient le cérémonial.
                //    Ex: CEREMONY 08:00-08:15 → intégré dans BLOCK 08:00-10:15
                if (isBreak && block.type === 'CEREMONY') {
                  // ⭐ SKIP — le cérémonial sera rendu à l'intérieur des cellules BLOCK
                  return null;
                }
                if (isBreak) {
                  // Ligne PAUSE standard — colSpan sur tous les jours (Déjeuner, Récréation, etc.)
                  return (
                    <tr key={blockIdx} className="bg-amber-50/50">
                      <td className="p-2 border border-slate-200 text-center whitespace-nowrap">
                        <span className="text-[10px] font-bold text-slate-500">{fmtTime(block.start)}-{fmtTime(block.end)}</span>
                      </td>
                      <td colSpan={configuredDays.length} className="p-2 border border-slate-200 text-center"><span className="text-xs font-bold text-amber-700 inline-flex items-center gap-1"><BreakIcon className="w-3 h-3" />{breakLabel}</span></td>
                    </tr>
                  );
                }
                // ⭐ Récupérer les blocks CEREMONY qui tombent dans cet intervalle BLOCK
                const ceremonyInThisBlock = configTimeBlocks.filter(
                  b => b.type === 'CEREMONY' && b.start >= block.start && b.end <= block.end
                );
                return (
                  <tr key={blockIdx}>
                    <td className="p-2 border border-slate-200 bg-slate-50 text-center whitespace-nowrap">
                      <span className="text-[11px] font-bold text-slate-700">{fmtTime(block.start)}-{fmtTime(block.end)}</span>
                    </td>
                    {configuredDays.map(day => {
                      const cellEntries = getCellEntries(day.value, block);
                      const isEditing = editingCell?.dayOfWeek === day.value && editingCell?.blockStart === block.start;
                      return (
                        <td key={day.value} className="p-1 border border-slate-200 align-top" style={{ minHeight: '60px' }}>
                          {/* ⭐ CÉRÉMONIAL DES COULEURS intégré dans la cellule BLOCK
                              Si un CEREMONY tombe dans cet intervalle BLOCK et ce jour est actif,
                              on l'affiche en HAUT de la cellule (avant les cours) avec le drapeau du Bénin.
                              C'est une sous-ligne non-éditable, pas une ligne séparée. */}
                          {ceremonyInThisBlock.map(cer => {
                            const cerDays = Array.isArray(cer.activeDays) ? cer.activeDays : configSchoolDays;
                            if (!cerDays.includes(day.value)) return null;
                            // ⭐ Format compact : drapeau + plage horaire + texte SUR UNE LIGNE
                            //    La hauteur correspond à celle d'une entry normale (24px) pour
                            //    éviter que la ligne de cérémonial soit démesurée par rapport aux autres.
                            const fmtTime = (t: string): string => {
                              if (!t) return '';
                              const [h, m] = t.split(':');
                              return `${parseInt(h, 10)}h${m}`;
                            };
                            return (
                              <div key={`cer-${cer.start}`} className="bg-orange-50 border border-orange-300 rounded-md px-1.5 py-0.5 mb-0.5 flex items-center gap-1" style={{ minHeight: '24px' }}>
                                <BeninFlag size={12} />
                                <span className="text-[10px] font-bold text-orange-700 truncate">
                                  {fmtTime(cer.start)}-{fmtTime(cer.end)} · Cérémonial des couleurs
                                </span>
                              </div>
                            );
                          })}
                          {/* ⭐ Chaque entry = une "ligne" compacte dans la cellule
                              Layout optimisé pour utiliser l'espace parcimonieusement :
                              - Ligne 1 : Nom de la matière + bouton supprimer (X)
                              - Ligne 2 : Durée + plage horaire au format "30min (8h15-8h45)"
                              Plus de ligne teacher/room (sélecteurs supprimés pour maternelle/primaire) */}
                          {cellEntries.map(entry => {
                            const colorClass = getSubjectColor(entry.subjectId);
                            // ⭐ Formatage de l'heure "08:15" → "8h15" (plus naturel en français)
                            const fmtTime = (t: string): string => {
                              if (!t) return '';
                              const [h, m] = t.split(':');
                              return `${parseInt(h, 10)}h${m}`;
                            };
                            const [sh, sm] = (entry.startTime || '').split(':').map(Number);
                            const [eh, em] = (entry.endTime || '').split(':').map(Number);
                            const dur = (eh * 60 + em) - (sh * 60 + sm);
                            return (
                              <div key={entry.id} className={cn('rounded-md px-1.5 py-0.5 mb-0.5 border group relative hover:shadow-sm transition', colorClass)} style={{ minHeight: '24px' }}>
                                {/* Ligne 1 : matière + boutons (modifier + supprimer) */}
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[11px] font-bold leading-tight truncate flex-1">
                                    {entry.subject?.name || '—'}
                                    {/* ⭐ Afficher l'étape si elle est renseignée (ex: "Étape 3" ou "Étapes 1-2") */}
                                    {entry.step && (
                                      <span className="text-[9px] font-semibold text-slate-500 ml-1">· {entry.step}</span>
                                    )}
                                  </span>
                                  {/* ⭐ Bouton MODIFIER (Pencil) — rouvre le formulaire pré-rempli pour édition */}
                                  <button
                                    onClick={() => startInlineEditEntry(entry)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 bg-blue-500 hover:bg-blue-600 text-white rounded transition shrink-0"
                                    title="Modifier cette séance"
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                  </button>
                                  {/* Bouton SUPPRIMER (X) */}
                                  <button
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 bg-red-500 hover:bg-red-600 text-white rounded transition shrink-0 ml-0.5"
                                    title="Supprimer cette séance"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                                {/* Ligne 2 : "30min (8h15-8h45)" — durée + plage horaire entre parenthèses */}
                                <div className="text-[9px] font-semibold text-slate-600 leading-tight">
                                  {dur}min ({fmtTime(entry.startTime)}-{fmtTime(entry.endTime)})
                                </div>
                              </div>
                            );
                          })}
                          {/* ⭐ Formulaire INLINE (remplace le modal) */}
                          {isEditing ? (
                            <div className="bg-blue-50 border border-blue-300 rounded-lg p-1.5 space-y-1">
                              {/* ⭐ Sélecteur de matière par GROUPE (sous-matières)
                                  Au lieu d'un select brut, on utilise optgroup pour organiser
                                  les sous-matières par groupe (Français, Maths, ES, etc.)
                                  + option "Autre…" qui révèle un champ texte personnalisé */}
                              <select value={inlineForm.subjectId} onChange={e => {
                                if (e.target.value === '__CUSTOM__') {
                                  setInlineForm({...inlineForm, subjectId: '__CUSTOM__'});
                                } else {
                                  setInlineForm({...inlineForm, subjectId: e.target.value});
                                }
                              }}
                                className="w-full px-1.5 py-1 border border-slate-300 rounded text-[10px] font-medium" autoFocus>
                                <option value="">— Sélectionner une matière —</option>
                                {/* ⭐ Groupes de sous-matières (catalogue Bénin — francophone + anglophone) */}
                                {SUB_SUBJECT_CATALOG.map(group => (
                                  <optgroup key={group.group} label={group.label}>
                                    {/* D'abord les sous-matières du catalogue qui existent en DB
                                        → comparaison par nom normalisé (case + accent insensitive)
                                        pour matcher "Lecture-Écriture" même si stocké comme "lecture ecriture" */}
                                    {group.items.filter(name => subjects.some(s => normalizeSubjectName(s.name) === normalizeSubjectName(name))).map(name => {
                                      const s = subjects.find(s => normalizeSubjectName(s.name) === normalizeSubjectName(name))!;
                                      return <option key={s.id} value={s.id}>{s.name}</option>;
                                    })}
                                    {/* Puis les sous-matières du catalogue qui n'existent PAS encore en DB
                                        → on les propose avec value = nom (sera créée à la volée) */}
                                    {group.items.filter(name => !subjects.some(s => normalizeSubjectName(s.name) === normalizeSubjectName(name))).map(name => (
                                      <option key={`cat-${name}`} value={`__CAT__${name}`}>{name}</option>
                                    ))}
                                  </optgroup>
                                ))}
                                {/* ⭐ Matières en DB qui ne sont dans aucun groupe du catalogue
                                    → DÉDUPLICATION par nom normalisé : si plusieurs Subject records ont
                                    le même nom (doublons créés avant le fix Phase 10), on n'en affiche
                                    qu'un seul. On prend le premier trouvé. */}
                                {(() => {
                                  const uncatalogued = subjects.filter(s =>
                                    !SUB_SUBJECT_CATALOG.some(g => g.items.some(item => normalizeSubjectName(item) === normalizeSubjectName(s.name)))
                                  );
                                  if (uncatalogued.length === 0) return null;
                                  // ⭐ Déduquer par nom normalisé — afficher uniquement 1 occurrence par nom unique
                                  const seen = new Set<string>();
                                  const uniqueByName: any[] = [];
                                  for (const s of uncatalogued) {
                                    const norm = normalizeSubjectName(s.name);
                                    if (!seen.has(norm)) {
                                      seen.add(norm);
                                      uniqueByName.push(s);
                                    }
                                  }
                                  return (
                                    <optgroup label="📋 Autres (non cataloguées)">
                                      {uniqueByName.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                      ))}
                                    </optgroup>
                                  );
                                })()}
                                {/* ⭐ Option personnalisée */}
                                <option value="__CUSTOM__">✏️ Autre (saisir…) </option>
                              </select>
                              {/* Champ texte si "Autre…" sélectionné — avec suggestions en temps réel
                                  pour éviter les doublons : si l'utilisateur tape "Lecture-Écriture"
                                  et qu'une matière "lecture écriture" existe déjà, on la suggère. */}
                              {inlineForm.subjectId === '__CUSTOM__' && (
                                <div className="relative">
                                  <input type="text" placeholder="Ex: Lecture-Écriture, Poésie-Chant…"
                                    value={inlineForm.customSubjectName || ''}
                                    onChange={e => setInlineForm({...inlineForm, customSubjectName: e.target.value})}
                                    className="w-full px-1.5 py-1 border border-blue-300 rounded text-[10px] bg-blue-50" autoFocus />
                                  {/* ⭐ Suggestions : matières existantes dont le nom normalisé
                                      commence par celui saisi. Permet à l'utilisateur de réutiliser
                                      une matière existante au lieu d'en créer une doublon. */}
                                  {(() => {
                                    const typed = (inlineForm.customSubjectName || '').trim();
                                    if (typed.length < 2) return null;
                                    const normalized = normalizeSubjectName(typed);
                                    if (!normalized) return null;
                                    // Cherche les matières existantes (DB) qui matchent
                                    const matches = subjects.filter(s =>
                                      normalizeSubjectName(s.name).includes(normalized) &&
                                      normalizeSubjectName(s.name) !== normalized // exclude exact match (shown separately)
                                    ).slice(0, 4);
                                    // Cherche aussi une matière qui normalise exactement comme l'input
                                    const exactMatch = subjects.find(s => normalizeSubjectName(s.name) === normalized);
                                    if (exactMatch) {
                                      matches.unshift(exactMatch);
                                    }
                                    if (matches.length === 0) return null;
                                    return (
                                      <div className="absolute z-10 left-0 right-0 top-full mt-0.5 bg-white border border-blue-200 rounded shadow-lg max-h-[100px] overflow-y-auto">
                                        {exactMatch && (
                                          <button
                                            onClick={() => setInlineForm({ ...inlineForm, subjectId: exactMatch.id, customSubjectName: '' })}
                                            className="w-full text-left px-1.5 py-0.5 hover:bg-emerald-50 border-b border-emerald-100 text-[10px]">
                                            <span className="text-emerald-700 font-bold">✓ Existant : </span>
                                            <span className="text-slate-700">{exactMatch.name}</span>
                                            <span className="text-[8px] text-slate-400 ml-1 italic">(cliquer pour réutiliser)</span>
                                          </button>
                                        )}
                                        {matches.filter(m => m.id !== exactMatch?.id).map(s => (
                                          <button
                                            key={s.id}
                                            onClick={() => setInlineForm({ ...inlineForm, subjectId: s.id, customSubjectName: '' })}
                                            className="w-full text-left px-1.5 py-0.5 hover:bg-blue-50 text-[10px]">
                                            <span className="text-slate-600">↳ </span>
                                            <span className="text-slate-700">{s.name}</span>
                                          </button>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                  {/* ⭐ Indicateur "nouvelle matière" si aucune correspondance n'est trouvée */}
                                  {(() => {
                                    const typed = (inlineForm.customSubjectName || '').trim();
                                    if (typed.length < 2) return null;
                                    const normalized = normalizeSubjectName(typed);
                                    const exists = subjects.some(s => normalizeSubjectName(s.name) === normalized);
                                    if (exists) return null;
                                    return (
                                      <div className="text-[9px] text-blue-600 mt-0.5 italic">
                                        ⚑ Nouvelle matière — sera créée (dédup auto activée)
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                              {/* ⭐ DURÉE en minutes (au lieu de startTime/endTime)
                                  L'utilisateur saisit juste la durée (15, 30, 45, etc.)
                                  Le système calcule automatiquement startTime et endTime. */}
                              {(() => {
                                const dur = Number(inlineForm.duration) || 30;
                                const blk = { start: editingCell!.blockStart, end: editingCell!.blockEnd };
                                const st = calcStartTime(editingCell!.dayOfWeek, blk);
                                const et = calcEndTime(st, dur);
                                const total = blockDurationMin(blk);
                                const used = usedDurationMin(editingCell!.dayOfWeek, blk);
                                const remaining = total - used;
                                const exceeds = dur > remaining;
                                return (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <label className="text-[9px] font-bold text-slate-500 whitespace-nowrap">Durée</label>
                                      <input type="number" min="5" step="5" value={inlineForm.duration}
                                        onChange={e => setInlineForm({...inlineForm, duration: Number(e.target.value) || 30})}
                                        className="w-12 px-1 py-0.5 border border-slate-300 rounded text-[10px] text-center font-bold" />
                                      <span className="text-[9px] text-slate-500">min</span>
                                    </div>
                                    {/* Affichage calculé : startTime → endTime */}
                                    <div className="text-[9px] text-slate-500">
                                      → <strong className="text-slate-700">{st}–{et}</strong>
                                    </div>
                                    {/* Durée restante dans le block */}
                                    <div className={cn('text-[9px] font-bold', exceeds ? 'text-rose-600' : 'text-emerald-600')}>
                                      {exceeds
                                        ? `⚠ Dépassement de ${dur - remaining} min (reste ${remaining} min)`
                                        : `Reste ${remaining - dur} min dans ce créneau`}
                                    </div>
                                  </div>
                                );
                              })()}
                              {/* ⭐ Sélecteurs enseignant + salle SUPPRIMÉS pour maternelle/primaire.
                                  L'EDT est commun à toutes les sections de l'AcademicClass — chaque
                                  enseignant verra l'EDT de sa classe dans son UI, et chaque parent
                                  verra celui de son enfant. La réservation de salle se fera via un
                                  autre workflow si nécessaire. */}
                              {/* ⭐ Sélecteur d'ÉTAPE (1-8) — affiché uniquement pour Lecture-Écriture
                                  au CI/CP. L'utilisateur peut préciser quelle(s) étape(s) la séance
                                  couvre : "Étape 1", "Étapes 1-2", "Étape 3", etc.
                                  Détection : on vérifie si le nom de la matière sélectionnée
                                  contient "lecture" ou "ecriture" (normalisé). */}
                              {(() => {
                                // Déterminer le nom de la matière sélectionnée
                                let selectedSubjectName = '';
                                if (inlineForm.subjectId && !inlineForm.subjectId.startsWith('__')) {
                                  const s = subjects.find(s => s.id === inlineForm.subjectId);
                                  selectedSubjectName = s?.name || '';
                                } else if (inlineForm.subjectId?.startsWith('__CAT__')) {
                                  selectedSubjectName = inlineForm.subjectId.replace('__CAT__', '');
                                } else if (inlineForm.subjectId === '__CUSTOM__') {
                                  selectedSubjectName = (inlineForm as any).customSubjectName || '';
                                }
                                const normalizedSubject = normalizeSubjectName(selectedSubjectName);
                                // Afficher le sélecteur si la matière est liée à Lecture/Écriture
                                // (FR : lecture/ecriture | EN : reading/writing — l'équivalent anglophone)
                                const showStepSelector = normalizedSubject.includes('lecture') || normalizedSubject.includes('ecriture')
                                  || normalizedSubject.includes('reading') || normalizedSubject.includes('writing');
                                if (!showStepSelector) return null;
                                // ⭐ Liste des options d'étapes (1-9 + plages combinées courantes)
                                //    Lecture-Écriture au CI/CP comporte jusqu'à 9 étapes.
                                const stepOptions = [
                                  { value: '', label: '(Aucune étape)' },
                                  { value: 'Étape 1', label: 'Étape 1' },
                                  { value: 'Étape 2', label: 'Étape 2' },
                                  { value: 'Étape 3', label: 'Étape 3' },
                                  { value: 'Étape 4', label: 'Étape 4' },
                                  { value: 'Étape 5', label: 'Étape 5' },
                                  { value: 'Étape 6', label: 'Étape 6' },
                                  { value: 'Étape 7', label: 'Étape 7' },
                                  { value: 'Étape 8', label: 'Étape 8' },
                                  { value: 'Étape 9', label: 'Étape 9' },
                                  { value: 'Étapes 1-2', label: 'Étapes 1-2' },
                                  { value: 'Étapes 2-3', label: 'Étapes 2-3' },
                                  { value: 'Étapes 3-4', label: 'Étapes 3-4' },
                                  { value: 'Étapes 4-5', label: 'Étapes 4-5' },
                                  { value: 'Étapes 5-6', label: 'Étapes 5-6' },
                                  { value: 'Étapes 6-7', label: 'Étapes 6-7' },
                                  { value: 'Étapes 7-8', label: 'Étapes 7-8' },
                                  { value: 'Étapes 8-9', label: 'Étapes 8-9' },
                                  { value: 'Étapes 1-3', label: 'Étapes 1-3' },
                                  { value: 'Étapes 3-5', label: 'Étapes 3-5' },
                                  { value: 'Étapes 5-7', label: 'Étapes 5-7' },
                                  { value: 'Étapes 7-9', label: 'Étapes 7-9' },
                                  { value: 'Étapes 1-4', label: 'Étapes 1-4' },
                                  { value: 'Étapes 5-9', label: 'Étapes 5-9' },
                                  { value: 'Étapes 1-9', label: 'Étapes 1-9 (toutes)' },
                                ];
                                return (
                                  <div className="flex items-center gap-1">
                                    <label className="text-[9px] font-bold text-slate-500 whitespace-nowrap">Étape</label>
                                    <select
                                      value={inlineForm.step || ''}
                                      onChange={e => setInlineForm({ ...inlineForm, step: e.target.value })}
                                      className="flex-1 px-1 py-0.5 border border-blue-300 rounded text-[10px] bg-blue-50 font-semibold"
                                    >
                                      {stepOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                );
                              })()}
                              {/* ⭐ Auto-sauvegarde : compte à rebours de 10 secondes
                                  Affiché uniquement quand le formulaire a une matière valide + un EDT actif.
                                  Indique à l'utilisateur que la séance sera sauvegardée automatiquement. */}
                              {(() => {
                                const isValidSubject = inlineForm.subjectId &&
                                  !inlineForm.subjectId.startsWith('__') &&
                                  !(inlineForm.subjectId === '__CUSTOM__' && !(inlineForm as any).customSubjectName?.trim());
                                const canAutoSave = isValidSubject && !!activeTimetableId && !saving;
                                if (!canAutoSave) return null;
                                return (
                                  <div className="flex items-center justify-between gap-1 px-1.5 py-0.5 bg-blue-100/60 border border-blue-200 rounded text-[9px]">
                                    <span className="inline-flex items-center gap-0.5 text-blue-700 font-semibold">
                                      <Save className="w-2.5 h-2.5" />
                                      Auto-sauvegarde
                                    </span>
                                    <span className={cn('font-bold tabular-nums', autoSaveCountdown <= 3 ? 'text-rose-600' : 'text-blue-700')}>
                                      {autoSaveCountdown}s
                                    </span>
                                  </div>
                                );
                              })()}
                              <div className="flex gap-1">
                                <button onClick={handleInlineSave} disabled={saving || !inlineForm.subjectId || (inlineForm.subjectId === '__CUSTOM__' && !(inlineForm as any).customSubjectName?.trim())}
                                  className="flex-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-[10px] font-bold">
                                  {saving ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : (editingEntryId ? '✓ Modifier' : '✓ Ajouter')}
                                </button>
                                <button onClick={() => { setEditingCell(null); setEditingEntryId(null); }}
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
