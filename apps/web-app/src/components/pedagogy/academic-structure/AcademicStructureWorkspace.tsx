/**
 * MODULE 2 — Structure académique : onglets Niveaux, Cycles, Classes, Sections, Séries, Salles
 */

'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Copy,
  GraduationCap,
  Layers,
  LayoutGrid,
  Loader2,
  Plus,
  School,
  Users,
} from 'lucide-react';
import BaseModal from '@/components/modules/blueprint/modals/BaseModal';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import {
  pedagogyFetch,
  academicStructureUrl,
  academicSeriesUrl,
} from '@/lib/pedagogy/academic-structure-client';
import { cn } from '@/lib/utils';
import { SETTINGS_SCHOOL_LEVELS_UPDATED_EVENT } from '@/lib/settings/events';

const PRIMARY = '#1A2BA6';
const ACCENT = '#F5A623';

type TabId = 'levels' | 'cycles' | 'classes' | 'sections' | 'series' | 'rooms';

interface AcademicLevelRow {
  id: string;
  name: string;
  orderIndex: number;
  isActive: boolean;
  cycles?: { id: string; name: string }[];
}

interface AcademicCycleRow {
  id: string;
  name: string;
  orderIndex: number;
  isActive: boolean;
  level?: { id: string; name: string };
}

interface AcademicClassRow {
  id: string;
  name: string;
  code: string;
  capacity?: number | null;
  isActive: boolean;
  languageTrack?: string | null;
  level?: { id: string; name: string };
  cycle?: { id: string; name: string };
  room?: { id: string; roomCode: string; roomName: string } | null;
}

interface SeriesRow {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  level?: { name: string };
}

interface RoomRow {
  id: string;
  name?: string;
  roomName?: string;
  roomCode?: string;
  type?: string;
  roomType?: string;
  capacity?: number | null;
  status?: string;
}

function normalizeLevelKey(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const CANONICAL_ORDER = ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE'] as const;

function isCanonicalLevelName(name: string): boolean {
  const k = normalizeLevelKey(name);
  return CANONICAL_ORDER.includes(k as (typeof CANONICAL_ORDER)[number]);
}

function roomDisplayName(r: RoomRow): string {
  return r.name ?? r.roomName ?? r.roomCode ?? '—';
}

function roomTypeDisplay(r: RoomRow): string {
  return r.type ?? r.roomType ?? '—';
}

export function AcademicStructureWorkspace() {
  const { academicYear, isBilingualEnabled } = useModuleContext();
  const { availableYears } = useAcademicYear();
  const yearId = academicYear?.id ?? '';

  const [tab, setTab] = useState<TabId>('levels');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [levels, setLevels] = useState<AcademicLevelRow[]>([]);
  const [cycles, setCycles] = useState<AcademicCycleRow[]>([]);
  const [classes, setClasses] = useState<AcademicClassRow[]>([]);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [rooms, setRooms] = useState<RoomRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupFrom, setDupFrom] = useState<string>('');
  const [dupTo, setDupTo] = useState<string>('');
  const [dupRunning, setDupRunning] = useState(false);

  const [cycleModal, setCycleModal] = useState<
    | null
    | { mode: 'create' }
    | { mode: 'edit'; cycle: AcademicCycleRow }
  >(null);
  const [cycleForm, setCycleForm] = useState({ levelId: '', name: '', orderIndex: 0 });

  const [classModal, setClassModal] = useState<
    | null
    | { mode: 'create' }
    | { mode: 'edit'; cls: AcademicClassRow }
  >(null);
  const [classForm, setClassForm] = useState({
    levelId: '',
    cycleId: '',
    name: '',
    code: '',
    capacity: '' as string | number,
    roomId: '' as string,
    languageTrack: '' as string,
  });

  const [seriesModal, setSeriesModal] = useState<
    null | { mode: 'create' } | { mode: 'edit'; row: SeriesRow }
  >(null);
  const [seriesForm, setSeriesForm] = useState({ name: '', description: '' });

  const [roomModal, setRoomModal] = useState<null | { mode: 'create' }>(null);
  const [roomForm, setRoomForm] = useState({
    name: '',
    type: 'CLASSROOM',
    capacity: '' as string | number,
  });

  const secondaryLevelId = useMemo(() => {
    const l = levels.find((x) => /secondaire/i.test(x.name));
    return l?.id;
  }, [levels]);

  const loadLevels = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const data = await pedagogyFetch<AcademicLevelRow[]>(
        academicStructureUrl('levels', { academicYearId: yearId }),
      );
      setLevels(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setLevels([]);
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  const loadCycles = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const data = await pedagogyFetch<AcademicCycleRow[]>(
        academicStructureUrl('cycles', { academicYearId: yearId }),
      );
      setCycles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setCycles([]);
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  const loadClasses = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const data = await pedagogyFetch<AcademicClassRow[]>(
        academicStructureUrl('classes', { academicYearId: yearId }),
      );
      setClasses(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setClasses([]);
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  const loadSeries = useCallback(async () => {
    if (!yearId || !secondaryLevelId) {
      setSeries([]);
      return;
    }
    setLoading(true);
    try {
      const data = await pedagogyFetch<SeriesRow[]>(
        academicSeriesUrl('', { academicYearId: yearId, levelId: secondaryLevelId }),
      );
      setSeries(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setSeries([]);
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [yearId, secondaryLevelId]);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rooms', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('Salles indisponibles');
      const data = (await res.json()) as RoomRow[];
      setRooms(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setRooms([]);
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'levels') loadLevels();
    else if (tab === 'cycles') {
      loadLevels();
      loadCycles();
    } else if (tab === 'classes') {
      loadLevels();
      loadCycles();
      loadClasses();
      loadRooms();
    } else if (tab === 'sections') {
      loadClasses();
    } else if (tab === 'series') {
      loadLevels();
    } else if (tab === 'rooms') loadRooms();
  }, [tab, loadLevels, loadCycles, loadClasses, loadSeries, loadRooms]);

  useEffect(() => {
    if (tab === 'series' && secondaryLevelId) loadSeries();
  }, [tab, secondaryLevelId, loadSeries]);

  /** Après changement des niveaux dans Paramètres → Structure (EducationLevel). */
  useEffect(() => {
    const onSettingsLevelsChanged = () => {
      void loadLevels();
      if (tab === 'cycles') void loadCycles();
      if (tab === 'classes') {
        void loadCycles();
        void loadClasses();
      }
      if (tab === 'series') void loadSeries();
    };
    window.addEventListener(SETTINGS_SCHOOL_LEVELS_UPDATED_EVENT, onSettingsLevelsChanged);
    return () => window.removeEventListener(SETTINGS_SCHOOL_LEVELS_UPDATED_EVENT, onSettingsLevelsChanged);
  }, [tab, loadLevels, loadCycles, loadClasses, loadSeries]);

  /** Retour sur l’onglet : resynchroniser avec le backend (sync Paramètres → niveaux pédagogiques). */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible' || !yearId) return;
      if (tab === 'levels') void loadLevels();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [tab, yearId, loadLevels]);

  const canonicalMissing = useMemo(() => {
    const keys = new Set(levels.map((l) => normalizeLevelKey(l.name)));
    return CANONICAL_ORDER.filter((c) => !keys.has(c));
  }, [levels]);

  const seedCanonicalLevels = async () => {
    if (!yearId) return;
    try {
      const names = ['Maternelle', 'Primaire', 'Secondaire'] as const;
      for (let i = 0; i < names.length; i++) {
        const name = names[i];
        if (levels.some((l) => normalizeLevelKey(l.name) === normalizeLevelKey(name))) continue;
        await pedagogyFetch(academicStructureUrl('levels'), {
          method: 'POST',
          body: { academicYearId: yearId, name, orderIndex: i },
        });
      }
      setNotice({ type: 'ok', text: 'Niveaux officiels ajoutés.' });
      await loadLevels();
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    }
  };

  const toggleLevel = async (level: AcademicLevelRow) => {
    const activeCount = levels.filter((l) => l.isActive).length;
    if (level.isActive && activeCount <= 1) {
      setNotice({ type: 'err', text: 'Au moins un niveau doit rester actif.' });
      return;
    }
    try {
      await pedagogyFetch(academicStructureUrl(`levels/${level.id}`), {
        method: 'PUT',
        body: { isActive: !level.isActive },
      });
      setNotice({ type: 'ok', text: 'Niveau mis à jour.' });
      await loadLevels();
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    }
  };

  const openCreateCycle = () => {
    setCycleForm({
      levelId: levels[0]?.id ?? '',
      name: '',
      orderIndex: cycles.filter((c) => c.level?.id === levels[0]?.id).length,
    });
    setCycleModal({ mode: 'create' });
  };

  const saveCycle = async () => {
    if (!yearId || !cycleForm.levelId || !cycleForm.name.trim()) return;
    try {
      if (cycleModal?.mode === 'create') {
        await pedagogyFetch(academicStructureUrl('cycles'), {
          method: 'POST',
          body: {
            academicYearId: yearId,
            levelId: cycleForm.levelId,
            name: cycleForm.name.trim(),
            orderIndex: Number(cycleForm.orderIndex) || 0,
          },
        });
      } else if (cycleModal?.mode === 'edit') {
        await pedagogyFetch(academicStructureUrl(`cycles/${cycleModal.cycle.id}`), {
          method: 'PUT',
          body: {
            name: cycleForm.name.trim(),
            orderIndex: Number(cycleForm.orderIndex) || 0,
          },
        });
      }
      setCycleModal(null);
      setNotice({ type: 'ok', text: 'Cycle enregistré.' });
      await loadCycles();
      await loadLevels();
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    }
  };

  const openCreateClass = () => {
    const lvl = levels[0];
    const cy = cycles.find((c) => c.level?.id === lvl?.id) ?? cycles[0];
    setClassForm({
      levelId: lvl?.id ?? '',
      cycleId: cy?.id ?? '',
      name: '',
      code: '',
      capacity: '',
      roomId: '',
      languageTrack: '',
    });
    setClassModal({ mode: 'create' });
  };

  const saveClass = async () => {
    if (!yearId || !classForm.levelId || !classForm.cycleId || !classForm.name.trim() || !classForm.code.trim()) {
      setNotice({ type: 'err', text: 'Complétez niveau, cycle, nom et code.' });
      return;
    }
    try {
      const cap =
        classForm.capacity === '' || classForm.capacity === undefined
          ? undefined
          : Number(classForm.capacity);
      const body = {
        academicYearId: yearId,
        levelId: classForm.levelId,
        cycleId: classForm.cycleId,
        name: classForm.name.trim(),
        code: classForm.code.trim(),
        capacity: Number.isFinite(cap as number) ? cap : undefined,
        roomId: classForm.roomId || undefined,
        languageTrack: classForm.languageTrack || undefined,
      };
      if (classModal?.mode === 'create') {
        await pedagogyFetch(academicStructureUrl('classes'), { method: 'POST', body });
      } else if (classModal?.mode === 'edit') {
        await pedagogyFetch(academicStructureUrl(`classes/${classModal.cls.id}`), {
          method: 'PUT',
          body: {
            name: classForm.name.trim(),
            code: classForm.code.trim(),
            capacity: Number.isFinite(cap as number) ? cap : undefined,
            roomId: classForm.roomId ? classForm.roomId : null,
            languageTrack: classForm.languageTrack || null,
          },
        });
      }
      setClassModal(null);
      setNotice({ type: 'ok', text: 'Classe enregistrée.' });
      await loadClasses();
      await loadLevels();
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    }
  };

  const deactivateClass = async (id: string) => {
    try {
      await pedagogyFetch(academicStructureUrl(`classes/${id}/deactivate`), { method: 'PUT' });
      setNotice({ type: 'ok', text: 'Classe désactivée.' });
      await loadClasses();
      await loadLevels();
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    }
  };

  const saveSeries = async () => {
    if (!yearId || !secondaryLevelId || !seriesForm.name.trim()) {
      setNotice({ type: 'err', text: 'Nom de série requis (niveau Secondaire requis).' });
      return;
    }
    try {
      if (seriesModal?.mode === 'create') {
        await pedagogyFetch(academicSeriesUrl(''), {
          method: 'POST',
          body: {
            academicYearId: yearId,
            levelId: secondaryLevelId,
            name: seriesForm.name.trim(),
            description: seriesForm.description.trim() || undefined,
          },
        });
      } else if (seriesModal?.mode === 'edit') {
        await pedagogyFetch(academicSeriesUrl(seriesModal.row.id), {
          method: 'PUT',
          body: {
            name: seriesForm.name.trim(),
            description: seriesForm.description.trim() || undefined,
          },
        });
      }
      setSeriesModal(null);
      setNotice({ type: 'ok', text: 'Série enregistrée.' });
      await loadSeries();
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    }
  };

  const toggleSeriesActive = async (row: SeriesRow) => {
    try {
      await pedagogyFetch(academicSeriesUrl(row.id), {
        method: 'PUT',
        body: { isActive: !row.isActive },
      });
      await loadSeries();
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    }
  };

  const saveRoom = async () => {
    if (!roomForm.name.trim()) {
      setNotice({ type: 'err', text: 'Nom de salle requis.' });
      return;
    }
    try {
      const cap =
        roomForm.capacity === '' ? undefined : Math.max(1, Number(roomForm.capacity) || 1);
      await pedagogyFetch('/api/rooms', {
        method: 'POST',
        body: {
          name: roomForm.name.trim(),
          type: roomForm.type,
          capacity: cap,
          status: 'available',
        },
      });
      setRoomModal(null);
      setNotice({ type: 'ok', text: 'Salle créée.' });
      await loadRooms();
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    }
  };

  const tabs: { id: TabId; label: string; icon: typeof Layers }[] = [
    { id: 'levels', label: 'Niveaux', icon: Layers },
    { id: 'cycles', label: 'Cycles', icon: School },
    { id: 'classes', label: 'Classes', icon: Users },
    { id: 'sections', label: 'Sections', icon: LayoutGrid },
    { id: 'series', label: 'Séries', icon: GraduationCap },
    { id: 'rooms', label: 'Salles', icon: Building2 },
  ];

  const addAction = () => {
    if (tab === 'cycles') openCreateCycle();
    else if (tab === 'classes') openCreateClass();
    else if (tab === 'series') {
      setSeriesForm({ name: '', description: '' });
      setSeriesModal({ mode: 'create' });
    } else if (tab === 'rooms') {
      setRoomForm({ name: '', type: 'CLASSROOM', capacity: '' });
      setRoomModal({ mode: 'create' });
    }
  };

  const showAdd =
    tab === 'cycles' || tab === 'classes' || tab === 'series' || tab === 'rooms';

  const refreshAfterDuplicateTo = async (targetYearId: string) => {
    if (targetYearId !== yearId) return;
    await loadLevels();
    if (tab === 'cycles') await loadCycles();
    if (tab === 'classes') {
      await loadCycles();
      await loadClasses();
      await loadRooms();
    }
    if (tab === 'sections') await loadClasses();
    if (tab === 'series') await loadSeries();
  };

  const runDuplicate = async () => {
    if (!dupFrom || !dupTo || dupFrom === dupTo) {
      setNotice({ type: 'err', text: 'Sélectionnez deux années différentes.' });
      return;
    }
    setDupRunning(true);
    try {
      const res = await pedagogyFetch<{
        levelsCopied: number;
        cyclesCopied: number;
        classesCopied: number;
        seriesCopied: number;
        seriesSubjectsCopied: number;
      }>(academicStructureUrl('duplicate'), {
        method: 'POST',
        body: { fromAcademicYearId: dupFrom, toAcademicYearId: dupTo },
      });
      setNotice({
        type: 'ok',
        text: `Duplication réussie : ${res.levelsCopied} niveau(x), ${res.cyclesCopied} cycle(s), ${res.classesCopied} classe(s), ${res.seriesCopied} série(s), ${res.seriesSubjectsCopied} lien(s) matière–série.`,
      });
      setDupOpen(false);
      await refreshAfterDuplicateTo(dupTo);
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setDupRunning(false);
    }
  };

  const capacityVisual = (cap?: number | null, effective = 0) => {
    if (cap == null || cap <= 0) {
      return <span className="text-xs text-gray-400">—</span>;
    }
    const ratio = effective / cap;
    const label = `${Math.round(ratio * 100)} %`;
    const color =
      ratio >= 0.9
        ? 'bg-red-100 text-red-800 border border-red-200'
        : ratio >= 0.8
          ? 'bg-amber-100 text-amber-900 border border-amber-200'
          : 'bg-emerald-100 text-emerald-900 border border-emerald-200';
    return (
      <span className={cn('rounded px-2 py-0.5 text-xs font-medium', color)} title="Taux de remplissage">
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {notice && (
        <div
          className={cn(
            'rounded-lg border px-4 py-2 text-sm',
            notice.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900',
          )}
        >
          {notice.text}
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => setNotice(null)}
          >
            Fermer
          </button>
        </div>
      )}

      <div
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        style={{ borderLeftWidth: 4, borderLeftColor: PRIMARY }}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Année scolaire active
          </p>
          <p className="text-lg font-semibold text-slate-900">{academicYear?.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showAdd && (
            <button
              type="button"
              onClick={addAction}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
              style={{ backgroundColor: PRIMARY }}
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const sorted = [...availableYears].sort(
                (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
              );
              const cur = sorted.find((y) => y.id === yearId);
              const idx = cur ? sorted.indexOf(cur) : -1;
              const prev = idx > 0 ? sorted[idx - 1] : sorted[0];
              const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : sorted[sorted.length - 1];
              setDupFrom(prev?.id ?? '');
              setDupTo(next?.id ?? yearId);
              setDupOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
          >
            <Copy className="h-4 w-4" style={{ color: ACCENT }} />
            Dupliquer année
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
                active
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              )}
              style={active ? { color: PRIMARY } : undefined}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {t.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      )}

      {!loading && tab === 'levels' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              L’activation des trois niveaux (Maternelle, Primaire, Secondaire) suit les{' '}
              <strong>paramètres de l’établissement</strong> (Structure pédagogique). Les changements y sont
              appliqués ici automatiquement à chaque chargement.
            </p>
            {canonicalMissing.length > 0 && (
              <button
                type="button"
                onClick={seedCanonicalLevels}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: ACCENT }}
              >
                Compléter Maternelle · Primaire · Secondaire
              </button>
            )}
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Niveau</th>
                <th className="px-4 py-3">Ordre</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {levels.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Aucun niveau pour cette année. Utilisez le bouton ci-dessus pour créer la base
                    officielle.
                  </td>
                </tr>
              ) : (
                levels.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {l.name}
                      {isCanonicalLevelName(l.name) && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                          Officiel
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.orderIndex}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          l.isActive
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-slate-200 text-slate-700',
                        )}
                      >
                        {l.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isCanonicalLevelName(l.name) ? (
                        <Link
                          href={settingsHref}
                          className="text-sm font-medium hover:underline"
                          style={{ color: PRIMARY }}
                        >
                          Régler dans Paramètres
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleLevel(l)}
                          className="text-sm font-medium hover:underline"
                          style={{ color: PRIMARY }}
                        >
                          {l.isActive ? 'Désactiver' : 'Activer'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'cycles' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Niveau</th>
                <th className="px-4 py-3">Ordre</th>
                <th className="px-4 py-3">Actif</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cycles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Aucun cycle. Ajoutez par exemple CI, CP, 6ème… selon votre niveau.
                  </td>
                </tr>
              ) : (
                cycles.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.level?.name ?? '—'}</td>
                    <td className="px-4 py-3">{c.orderIndex}</td>
                    <td className="px-4 py-3">{c.isActive ? 'Oui' : 'Non'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-sm font-medium hover:underline"
                        style={{ color: PRIMARY }}
                        onClick={() => {
                          setCycleForm({
                            levelId: c.level?.id ?? '',
                            name: c.name,
                            orderIndex: c.orderIndex,
                          });
                          setCycleModal({ mode: 'edit', cycle: c });
                        }}
                      >
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'classes' && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Classe</th>
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Niveau</th>
                <th className="px-4 py-3">Piste</th>
                <th className="px-4 py-3">Capacité</th>
                <th className="px-4 py-3">Taux</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                    Aucune classe. Créez des cycles puis des classes.
                  </td>
                </tr>
              ) : (
                classes.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {c.name}{' '}
                      <span className="text-slate-400">({c.code})</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.cycle?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.level?.name ?? '—'}</td>
                    <td className="px-4 py-3">{c.languageTrack ?? '—'}</td>
                    <td className="px-4 py-3">{c.capacity ?? '—'}</td>
                    <td className="px-4 py-3">{capacityVisual(c.capacity, 0)}</td>
                    <td className="px-4 py-3">
                      {c.isActive ? (
                        <span className="text-emerald-700">Active</span>
                      ) : (
                        <span className="text-slate-500">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="mr-2 text-sm font-medium hover:underline"
                        style={{ color: PRIMARY }}
                        onClick={() => {
                          setClassForm({
                            levelId: c.level?.id ?? levels[0]?.id ?? '',
                            cycleId: c.cycle?.id ?? '',
                            name: c.name,
                            code: c.code,
                            capacity: c.capacity ?? '',
                            roomId: c.room?.id ?? '',
                            languageTrack: c.languageTrack ?? '',
                          });
                          setClassModal({ mode: 'edit', cls: c });
                        }}
                      >
                        Modifier
                      </button>
                      {c.isActive && (
                        <button
                          type="button"
                          className="text-sm font-medium text-amber-700 hover:underline"
                          onClick={() => deactivateClass(c.id)}
                        >
                          Désactiver
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === 'sections' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Sections &amp; pistes linguistiques</h3>
          <p className="mt-2 text-sm text-slate-600">
            Les sections bilingues (ex. 6ème A — FR / EN) sont gérées via le champ{' '}
            <strong>Piste</strong> sur chaque classe (FR, EN).{' '}
            {isBilingualEnabled
              ? 'Le mode bilingue est activé pour votre établissement.'
              : 'Activez le bilingue dans les paramètres pour verrouiller la politique linguistique.'}
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="px-3 py-2">Classe</th>
                  <th className="px-3 py-2">Piste</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2">{c.languageTrack ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === 'series' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {!secondaryLevelId ? (
            <p className="p-6 text-sm text-amber-800">
              Ajoutez d&apos;abord le niveau <strong>Secondaire</strong> pour gérer les séries.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="px-4 py-3">Série</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Actif</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {series.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      Aucune série (A, C, D…). Ajoutez une série pour le secondaire.
                    </td>
                  </tr>
                ) : (
                  series.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-slate-600">{s.description ?? '—'}</td>
                      <td className="px-4 py-3">{s.isActive ? 'Oui' : 'Non'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="mr-2 text-sm font-medium hover:underline"
                          style={{ color: PRIMARY }}
                          onClick={() => {
                            setSeriesForm({
                              name: s.name,
                              description: s.description ?? '',
                            });
                            setSeriesModal({ mode: 'edit', row: s });
                          }}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="text-sm text-slate-600 hover:underline"
                          onClick={() => toggleSeriesActive(s)}
                        >
                          {s.isActive ? 'Désactiver' : 'Activer'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!loading && tab === 'rooms' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <th className="px-4 py-3">Salle</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Capacité</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Aucune salle enregistrée.
                  </td>
                </tr>
              ) : (
                rooms.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium">{roomDisplayName(r)}</td>
                    <td className="px-4 py-3">{roomTypeDisplay(r)}</td>
                    <td className="px-4 py-3">{r.capacity ?? '—'}</td>
                    <td className="px-4 py-3">{r.status ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <BaseModal
        title={cycleModal?.mode === 'edit' ? 'Modifier le cycle' : 'Nouveau cycle'}
        isOpen={cycleModal != null}
        onClose={() => setCycleModal(null)}
        showContext={false}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCycleModal(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveCycle}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              Enregistrer
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          {cycleModal?.mode === 'create' && (
            <label className="block text-sm">
              <span className="text-slate-600">Niveau</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={cycleForm.levelId}
                onChange={(e) => setCycleForm((f) => ({ ...f, levelId: e.target.value }))}
              >
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm">
            <span className="text-slate-600">Nom du cycle</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={cycleForm.name}
              onChange={(e) => setCycleForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex. CM2, 6ème"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Ordre d&apos;affichage</span>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={cycleForm.orderIndex}
              onChange={(e) => setCycleForm((f) => ({ ...f, orderIndex: Number(e.target.value) }))}
            />
          </label>
        </div>
      </BaseModal>

      <BaseModal
        title={classModal?.mode === 'edit' ? 'Modifier la classe' : 'Nouvelle classe'}
        isOpen={classModal != null}
        onClose={() => setClassModal(null)}
        size="lg"
        showContext={false}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setClassModal(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveClass}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              Enregistrer
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {classModal?.mode === 'create' && (
            <>
              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-600">Niveau</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={classForm.levelId}
                  onChange={(e) => setClassForm((f) => ({ ...f, levelId: e.target.value }))}
                >
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-slate-600">Cycle</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={classForm.cycleId}
                  onChange={(e) => setClassForm((f) => ({ ...f, cycleId: e.target.value }))}
                >
                  {cycles
                    .filter((c) => c.level?.id === classForm.levelId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            </>
          )}
          <label className="block text-sm">
            <span className="text-slate-600">Nom</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={classForm.name}
              onChange={(e) => setClassForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Code</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={classForm.code}
              onChange={(e) => setClassForm((f) => ({ ...f, code: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Capacité max</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={classForm.capacity}
              onChange={(e) => setClassForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Piste linguistique (FR / EN)</span>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={classForm.languageTrack}
                onChange={(e) => setClassForm((f) => ({ ...f, languageTrack: e.target.value }))}
              >
                <option value="">—</option>
                <option value="FR">FR</option>
                <option value="EN">EN</option>
              </select>
            {isBilingualEnabled && (
              <span className="mt-1 block text-xs text-slate-500">
                Mode bilingue activé au niveau établissement.
              </span>
            )}
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">Salle (optionnel)</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={classForm.roomId}
              onChange={(e) => setClassForm((f) => ({ ...f, roomId: e.target.value }))}
            >
              <option value="">—</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {roomDisplayName(r)} ({roomTypeDisplay(r)})
                </option>
              ))}
            </select>
          </label>
        </div>
      </BaseModal>

      <BaseModal
        title={seriesModal?.mode === 'edit' ? 'Modifier la série' : 'Nouvelle série'}
        isOpen={seriesModal != null}
        onClose={() => setSeriesModal(null)}
        showContext={false}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSeriesModal(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveSeries}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              Enregistrer
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-slate-600">Nom (ex. A, C, D)</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={seriesForm.name}
              onChange={(e) => setSeriesForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Description</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              rows={3}
              value={seriesForm.description}
              onChange={(e) => setSeriesForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
        </div>
      </BaseModal>

      <BaseModal
        title="Nouvelle salle"
        isOpen={roomModal != null}
        onClose={() => setRoomModal(null)}
        showContext={false}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRoomModal(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveRoom}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              Créer
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="text-slate-600">Nom</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={roomForm.name}
              onChange={(e) => setRoomForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Type</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={roomForm.type}
              onChange={(e) => setRoomForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="CLASSROOM">Salle de classe</option>
              <option value="LAB">Laboratoire</option>
              <option value="COMPUTER_ROOM">Salle informatique</option>
              <option value="LIBRARY">Bibliothèque</option>
              <option value="MULTIPURPOSE">Salle polyvalente</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Capacité</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={roomForm.capacity}
              onChange={(e) => setRoomForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </label>
        </div>
      </BaseModal>

      <BaseModal
        title="Dupliquer la structure vers une nouvelle année"
        isOpen={dupOpen}
        onClose={() => !dupRunning && setDupOpen(false)}
        showContext={false}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={dupRunning}
              onClick={() => setDupOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={dupRunning || dupFrom === dupTo}
              onClick={runDuplicate}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: PRIMARY }}
            >
              {dupRunning && <Loader2 className="h-4 w-4 animate-spin" />}
              {dupRunning ? 'Duplication…' : 'Lancer la duplication'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Copie transactionnelle : niveaux, cycles, classes (sans salle ni professeur principal), séries
          secondaires et coefficients matière–série. L&apos;année cible ne doit pas encore contenir de niveaux
          pédagogiques.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">Année source</span>
            <select
              disabled={dupRunning}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-50"
              value={dupFrom}
              onChange={(e) => setDupFrom(e.target.value)}
            >
              {availableYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label ?? y.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Année cible</span>
            <select
              disabled={dupRunning}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-50"
              value={dupTo}
              onChange={(e) => setDupTo(e.target.value)}
            >
              {availableYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label ?? y.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {dupFrom === dupTo && (
          <p className="mt-3 text-sm text-amber-800">Choisissez deux années distinctes.</p>
        )}
      </BaseModal>
    </div>
  );
}
