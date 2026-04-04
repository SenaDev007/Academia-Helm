/**
 * MODULE 2 — Structure académique : onglets Niveaux, Cycles, Classes, Sections, Séries, Salles
 */

'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
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
import { useAppSession } from '@/contexts/AppSessionContext';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { getBilingualSettings } from '@/services/settings.service';
import {
  pedagogyFetch,
  academicStructureUrl,
  academicSeriesUrl,
} from '@/lib/pedagogy/academic-structure-client';
import { cn } from '@/lib/utils';
import {
  SETTINGS_SCHOOL_LEVELS_UPDATED_EVENT,
  SETTINGS_BILINGUAL_UPDATED_EVENT,
} from '@/lib/settings/events';

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

interface SeriesSubjectLink {
  id: string;
  coefficient: number;
  weeklyHours: number;
  subject: { id: string; name: string; code?: string };
}

interface SeriesRow {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  level?: { id?: string; name: string };
  seriesSubjects?: SeriesSubjectLink[];
}

interface SubjectCatalogRow {
  id: string;
  name: string;
  code: string;
}

interface RoomRow {
  id: string;
  roomName?: string;
  roomCode?: string;
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
  return r.roomName ?? r.roomCode ?? '—';
}

function roomTypeDisplay(r: RoomRow): string {
  return r.roomType ?? '—';
}

export function AcademicStructureWorkspace() {
  const searchParams = useSearchParams();
  const { user, tenant } = useAppSession();
  const { academicYear } = useModuleContext();
  const { availableYears } = useAcademicYear();
  const yearId = academicYear?.id ?? '';

  /** Aligné Paramètres : PO / admin plateforme peuvent cibler un tenant (URL ?tenant_id=) ; sinon JWT / session. */
  const tenantQuery = useMemo(() => {
    const cross = ['PLATFORM_OWNER', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '');
    const id = cross ? searchParams.get('tenant_id') || tenant?.id : tenant?.id;
    const s = id && String(id).trim();
    return s ? { tenant_id: s } : ({} as Record<string, string>);
  }, [user?.role, searchParams, tenant?.id]);

  /** Lien Paramètres → onglet Structure (activation des niveaux officiels). */
  const settingsHref = useMemo(() => {
    const params = new URLSearchParams();
    if (tenantQuery.tenant_id) params.set('tenant_id', tenantQuery.tenant_id);
    params.set('tab', 'structure');
    const q = params.toString();
    return `/app/settings${q ? `?${q}` : ''}`;
  }, [tenantQuery]);

  const settingsHrefBilingual = useMemo(() => {
    const params = new URLSearchParams();
    if (tenantQuery.tenant_id) params.set('tenant_id', tenantQuery.tenant_id);
    params.set('tab', 'bilingual');
    const q = params.toString();
    return `/app/settings${q ? `?${q}` : ''}`;
  }, [tenantQuery]);

  /** Option bilingue depuis Paramètres (settings_bilingual), pas le seul feature flag tenant. */
  const [bilingualSettings, setBilingualSettings] = useState<{
    isEnabled: boolean;
    defaultLanguage?: string;
  } | null>(null);
  const bilingualEnabled = bilingualSettings?.isEnabled ?? false;

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
  const [dupConfirmed, setDupConfirmed] = useState(false);

  const [cycleModal, setCycleModal] = useState<
    | null
    | { mode: 'create' }
    | { mode: 'edit'; cycle: AcademicCycleRow }
  >(null);
  const [cycleForm, setCycleForm] = useState({
    levelId: '',
    name: '',
    orderIndex: 0,
    isActive: true,
  });

  const [levelModal, setLevelModal] = useState<
    | null
    | { mode: 'create' }
    | { mode: 'edit'; level: AcademicLevelRow }
  >(null);
  const [levelForm, setLevelForm] = useState({
    name: '',
    orderIndex: 0,
    isActive: true,
  });

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

  const [seriesSubjectsModal, setSeriesSubjectsModal] = useState<SeriesRow | null>(null);
  const [subjectsCatalog, setSubjectsCatalog] = useState<SubjectCatalogRow[]>([]);
  const [subjectsCatalogLoading, setSubjectsCatalogLoading] = useState(false);
  const [seriesSubjectsBusy, setSeriesSubjectsBusy] = useState(false);
  const [newSeriesSubject, setNewSeriesSubject] = useState({
    subjectId: '',
    coefficient: 1,
    weeklyHours: 2,
  });
  const [seriesSubjectEdits, setSeriesSubjectEdits] = useState<
    Record<string, { coefficient: number; weeklyHours: number }>
  >({});

  const [roomModal, setRoomModal] = useState<
    null | { mode: 'create' } | { mode: 'edit'; room: RoomRow }
  >(null);
  const [roomForm, setRoomForm] = useState({
    roomCode: '',
    roomName: '',
    roomType: 'CLASSROOM',
    capacity: '' as string | number,
  });

  const [trackDraft, setTrackDraft] = useState<Record<string, string>>({});
  const [trackSaving, setTrackSaving] = useState<Record<string, boolean>>({});

  const secondaryLevelId = useMemo(() => {
    const byRegex = levels.find((x) => /secondaire/i.test(x.name));
    if (byRegex) return byRegex.id;
    const byCanon = levels.find((x) => normalizeLevelKey(x.name) === 'SECONDAIRE');
    return byCanon?.id;
  }, [levels]);

  const loadLevels = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const data = await pedagogyFetch<AcademicLevelRow[]>(
        academicStructureUrl('levels', { academicYearId: yearId, ...tenantQuery }),
      );
      setLevels(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setLevels([]);
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [yearId, tenantQuery]);

  const loadCycles = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const data = await pedagogyFetch<AcademicCycleRow[]>(
        academicStructureUrl('cycles', { academicYearId: yearId, ...tenantQuery }),
      );
      setCycles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setCycles([]);
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [yearId, tenantQuery]);

  const loadClasses = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const data = await pedagogyFetch<AcademicClassRow[]>(
        academicStructureUrl('classes', { academicYearId: yearId, ...tenantQuery }),
      );
      setClasses(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setClasses([]);
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [yearId, tenantQuery]);

  const loadSeries = useCallback(async () => {
    if (!yearId || !secondaryLevelId) {
      setSeries([]);
      return;
    }
    setLoading(true);
    try {
      const data = await pedagogyFetch<SeriesRow[]>(
        academicSeriesUrl('', { academicYearId: yearId, levelId: secondaryLevelId, ...tenantQuery }),
      );
      setSeries(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setSeries([]);
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [yearId, secondaryLevelId, tenantQuery]);

  const loadRooms = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ academicYearId: yearId }).toString();
      const data = await pedagogyFetch<RoomRow[]>(`/api/rooms?${q}`);
      setRooms(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setRooms([]);
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  const loadBilingualSettings = useCallback(async () => {
    const tid = tenantQuery.tenant_id || tenant?.id;
    if (!tid) {
      setBilingualSettings(null);
      return;
    }
    try {
      const raw = await getBilingualSettings(tid);
      if (raw && typeof raw === 'object' && 'isEnabled' in raw) {
        const r = raw as { isEnabled?: boolean; defaultLanguage?: string };
        setBilingualSettings({
          isEnabled: Boolean(r.isEnabled),
          defaultLanguage: typeof r.defaultLanguage === 'string' ? r.defaultLanguage : undefined,
        });
      } else {
        setBilingualSettings(null);
      }
    } catch {
      setBilingualSettings(null);
    }
  }, [tenantQuery.tenant_id, tenant?.id]);

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
      void loadBilingualSettings();
    } else if (tab === 'sections') {
      void loadClasses();
      void loadBilingualSettings();
    } else if (tab === 'series') {
      loadLevels();
    } else if (tab === 'rooms') loadRooms();
  }, [tab, loadLevels, loadCycles, loadClasses, loadSeries, loadRooms, loadBilingualSettings]);

  /** Recharger les séries quand les niveaux changent (ex. après Paramètres) : `secondaryLevelId` dépend de `levels`. */
  useEffect(() => {
    if (tab !== 'series' || !yearId) return;
    if (!secondaryLevelId) {
      setSeries([]);
      return;
    }
    void loadSeries();
  }, [tab, yearId, secondaryLevelId, loadSeries, levels]);

  /** Après changement des niveaux dans Paramètres → Structure (EducationLevel). */
  useEffect(() => {
    const onSettingsLevelsChanged = () => {
      void loadLevels();
      if (tab === 'cycles') void loadCycles();
      if (tab === 'classes') {
        void loadLevels();
        void loadCycles();
        void loadClasses();
      }
      /** Séries : `loadSeries` est déclenché par l’effet qui dépend de `levels` une fois le GET niveaux terminé. */
    };
    window.addEventListener(SETTINGS_SCHOOL_LEVELS_UPDATED_EVENT, onSettingsLevelsChanged);
    return () => window.removeEventListener(SETTINGS_SCHOOL_LEVELS_UPDATED_EVENT, onSettingsLevelsChanged);
  }, [tab, loadLevels, loadCycles, loadClasses]);

  /** Après enregistrement Paramètres → Bilingue : pistes + liste classes. */
  useEffect(() => {
    const onBilingualUpdated = () => {
      void loadBilingualSettings();
      if (tab === 'sections' || tab === 'classes') void loadClasses();
    };
    window.addEventListener(SETTINGS_BILINGUAL_UPDATED_EVENT, onBilingualUpdated);
    return () => window.removeEventListener(SETTINGS_BILINGUAL_UPDATED_EVENT, onBilingualUpdated);
  }, [tab, loadBilingualSettings, loadClasses]);

  /** Retour sur l’onglet navigateur : resynchroniser avec le backend (Paramètres → pédagogie). */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible' || !yearId) return;
      if (tab === 'levels') void loadLevels();
      else if (tab === 'cycles') {
        void loadLevels();
        void loadCycles();
      } else if (tab === 'classes') {
        void loadLevels();
        void loadCycles();
        void loadClasses();
        void loadRooms();
        void loadBilingualSettings();
      } else if (tab === 'sections') {
        void loadClasses();
        void loadBilingualSettings();
      } else if (tab === 'series') void loadLevels();
      else if (tab === 'rooms') void loadRooms();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [
    tab,
    yearId,
    loadLevels,
    loadCycles,
    loadClasses,
    loadRooms,
    loadBilingualSettings,
  ]);

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
        await pedagogyFetch(academicStructureUrl('levels', { ...tenantQuery }), {
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

  const openCreateLevel = () => {
    setLevelForm({
      name: '',
      orderIndex: levels.length,
      isActive: true,
    });
    setLevelModal({ mode: 'create' });
  };

  const openEditLevel = (level: AcademicLevelRow) => {
    setLevelForm({
      name: level.name,
      orderIndex: level.orderIndex,
      isActive: level.isActive,
    });
    setLevelModal({ mode: 'edit', level });
  };

  const saveLevel = async () => {
    if (!yearId) return;
    if (!levelForm.name.trim()) {
      setNotice({ type: 'err', text: 'Nom du niveau requis.' });
      return;
    }
    try {
      if (levelModal?.mode === 'create') {
        await pedagogyFetch(academicStructureUrl('levels', { ...tenantQuery }), {
          method: 'POST',
          body: {
            academicYearId: yearId,
            name: levelForm.name.trim(),
            orderIndex: Number(levelForm.orderIndex) || 0,
          },
        });
        setNotice({ type: 'ok', text: 'Niveau créé.' });
      } else if (levelModal?.mode === 'edit') {
        await pedagogyFetch(academicStructureUrl(`levels/${levelModal.level.id}`, { ...tenantQuery }), {
          method: 'PUT',
          body: {
            name: levelForm.name.trim(),
            orderIndex: Number(levelForm.orderIndex) || 0,
            isActive: !!levelForm.isActive,
          },
        });
        setNotice({ type: 'ok', text: 'Niveau mis à jour.' });
      }
      setLevelModal(null);
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
      await pedagogyFetch(academicStructureUrl(`levels/${level.id}`, { ...tenantQuery }), {
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
    if (levels.length === 0) {
      setNotice({
        type: 'err',
        text: 'Créez au moins un niveau avant d’ajouter des cycles.',
      });
      return;
    }
    const firstLevelId = levels[0]?.id ?? '';
    setCycleForm({
      levelId: firstLevelId,
      name: '',
      orderIndex: cycles.filter((c) => c.level?.id === firstLevelId).length,
      isActive: true,
    });
    setCycleModal({ mode: 'create' });
  };

  const openEditCycle = (cycle: AcademicCycleRow) => {
    setCycleForm({
      levelId: cycle.level?.id ?? '',
      name: cycle.name,
      orderIndex: cycle.orderIndex,
      isActive: cycle.isActive,
    });
    setCycleModal({ mode: 'edit', cycle });
  };

  const saveCycle = async () => {
    if (!yearId || !cycleForm.levelId || !cycleForm.name.trim()) return;
    if (cycleModal?.mode === 'create') {
      const hasActiveCycle = cycles.some((c) => c.isActive);
      if (!hasActiveCycle && !cycleForm.isActive) {
        setNotice({
          type: 'err',
          text: 'Au moins un cycle doit rester actif : cochez « Cycle actif » ou activez un cycle existant.',
        });
        return;
      }
    }
    try {
      if (cycleModal?.mode === 'create') {
        await pedagogyFetch(academicStructureUrl('cycles', { ...tenantQuery }), {
          method: 'POST',
          body: {
            academicYearId: yearId,
            levelId: cycleForm.levelId,
            name: cycleForm.name.trim(),
            orderIndex: Number(cycleForm.orderIndex) || 0,
            isActive: !!cycleForm.isActive,
          },
        });
      } else if (cycleModal?.mode === 'edit') {
        await pedagogyFetch(academicStructureUrl(`cycles/${cycleModal.cycle.id}`, { ...tenantQuery }), {
          method: 'PUT',
          body: {
            name: cycleForm.name.trim(),
            orderIndex: Number(cycleForm.orderIndex) || 0,
            isActive: !!cycleForm.isActive,
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

  const toggleCycle = async (cycle: AcademicCycleRow) => {
    const activeCount = cycles.filter((c) => c.isActive).length;
    if (cycle.isActive && activeCount <= 1) {
      setNotice({ type: 'err', text: 'Au moins un cycle doit rester actif.' });
      return;
    }
    try {
      await pedagogyFetch(academicStructureUrl(`cycles/${cycle.id}`, { ...tenantQuery }), {
        method: 'PUT',
        body: { isActive: !cycle.isActive },
      });
      setNotice({ type: 'ok', text: 'Cycle mis à jour.' });
      await loadCycles();
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
    if (classForm.languageTrack.trim().toUpperCase() === 'EN' && !bilingualEnabled) {
      setNotice({
        type: 'err',
        text: 'Activez l’option bilingue dans Paramètres pour la piste EN.',
      });
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
        await pedagogyFetch(academicStructureUrl('classes', { ...tenantQuery }), { method: 'POST', body });
      } else if (classModal?.mode === 'edit') {
        await pedagogyFetch(academicStructureUrl(`classes/${classModal.cls.id}`, { ...tenantQuery }), {
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
      await pedagogyFetch(academicStructureUrl(`classes/${id}/deactivate`, { ...tenantQuery }), {
        method: 'PUT',
      });
      setNotice({ type: 'ok', text: 'Classe désactivée.' });
      await loadClasses();
      await loadLevels();
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    }
  };

  const saveLanguageTrack = async (cls: AcademicClassRow, next: string) => {
    if (next.trim().toUpperCase() === 'EN' && !bilingualEnabled) {
      setNotice({
        type: 'err',
        text: 'Activez l’option bilingue dans Paramètres pour attribuer la piste EN.',
      });
      return;
    }
    try {
      setTrackSaving((m) => ({ ...m, [cls.id]: true }));
      await pedagogyFetch(academicStructureUrl(`classes/${cls.id}`, { ...tenantQuery }), {
        method: 'PUT',
        body: { languageTrack: next || null },
      });
      setNotice({ type: 'ok', text: 'Piste linguistique mise à jour.' });
      await loadClasses();
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setTrackSaving((m) => ({ ...m, [cls.id]: false }));
    }
  };

  const saveSeries = async () => {
    if (!yearId || !secondaryLevelId || !seriesForm.name.trim()) {
      setNotice({ type: 'err', text: 'Nom de série requis (niveau Secondaire requis).' });
      return;
    }
    try {
      if (seriesModal?.mode === 'create') {
        await pedagogyFetch(academicSeriesUrl('', { ...tenantQuery }), {
          method: 'POST',
          body: {
            academicYearId: yearId,
            levelId: secondaryLevelId,
            name: seriesForm.name.trim(),
            description: seriesForm.description.trim() || undefined,
          },
        });
      } else if (seriesModal?.mode === 'edit') {
        await pedagogyFetch(academicSeriesUrl(seriesModal.row.id, { ...tenantQuery }), {
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
      await pedagogyFetch(academicSeriesUrl(row.id, { ...tenantQuery }), {
        method: 'PUT',
        body: { isActive: !row.isActive },
      });
      await loadSeries();
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    }
  };

  const refreshSeriesDetail = useCallback(
    async (seriesId: string): Promise<SeriesRow | null> => {
      try {
        return await pedagogyFetch<SeriesRow>(academicSeriesUrl(seriesId, { ...tenantQuery }));
      } catch {
        return null;
      }
    },
    [tenantQuery],
  );

  const openSeriesSubjectsModal = async (row: SeriesRow) => {
    setSeriesSubjectsModal(row);
    setNewSeriesSubject({ subjectId: '', coefficient: 1, weeklyHours: 2 });
    if (!yearId) return;
    setSubjectsCatalogLoading(true);
    try {
      const qs = new URLSearchParams({ academicYearId: yearId });
      if (tenantQuery.tenant_id) qs.set('tenant_id', tenantQuery.tenant_id);
      const data = await pedagogyFetch<SubjectCatalogRow[]>(`/api/subjects?${qs}`);
      setSubjectsCatalog(Array.isArray(data) ? data : []);
    } catch {
      setSubjectsCatalog([]);
      setNotice({ type: 'err', text: 'Impossible de charger les matières.' });
    } finally {
      setSubjectsCatalogLoading(false);
    }
    const fresh = await refreshSeriesDetail(row.id);
    if (fresh) setSeriesSubjectsModal(fresh);
  };

  const seriesSubjectsFingerprint = useMemo(() => {
    const subs = seriesSubjectsModal?.seriesSubjects;
    if (!subs?.length) return '';
    return subs.map((l) => `${l.id}:${l.coefficient}:${l.weeklyHours}`).join('|');
  }, [seriesSubjectsModal?.seriesSubjects]);

  useEffect(() => {
    const subs = seriesSubjectsModal?.seriesSubjects;
    if (!subs?.length) {
      setSeriesSubjectEdits({});
      return;
    }
    const m: Record<string, { coefficient: number; weeklyHours: number }> = {};
    for (const l of subs) {
      m[l.id] = { coefficient: l.coefficient, weeklyHours: l.weeklyHours };
    }
    setSeriesSubjectEdits(m);
  }, [seriesSubjectsModal?.id, seriesSubjectsFingerprint]);

  const addSubjectToSeries = async () => {
    if (!seriesSubjectsModal || !yearId || !newSeriesSubject.subjectId.trim()) {
      setNotice({ type: 'err', text: 'Choisissez une matière à associer.' });
      return;
    }
    setSeriesSubjectsBusy(true);
    try {
      await pedagogyFetch(academicSeriesUrl('subjects', { ...tenantQuery }), {
        method: 'POST',
        body: {
          academicYearId: yearId,
          seriesId: seriesSubjectsModal.id,
          subjectId: newSeriesSubject.subjectId.trim(),
          coefficient: Math.max(0, Math.round(Number(newSeriesSubject.coefficient) || 1)),
          weeklyHours: Math.max(0, Math.round(Number(newSeriesSubject.weeklyHours) || 0)),
        },
      });
      setNotice({ type: 'ok', text: 'Matière ajoutée à la série.' });
      await loadSeries();
      const updated = await refreshSeriesDetail(seriesSubjectsModal.id);
      if (updated) setSeriesSubjectsModal(updated);
      setNewSeriesSubject((s) => ({ ...s, subjectId: '' }));
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setSeriesSubjectsBusy(false);
    }
  };

  const saveSeriesSubjectLink = async (linkId: string) => {
    const ed = seriesSubjectEdits[linkId];
    if (!ed || !seriesSubjectsModal) return;
    setSeriesSubjectsBusy(true);
    try {
      await pedagogyFetch(academicSeriesUrl(`subjects/${linkId}`, { ...tenantQuery }), {
        method: 'PUT',
        body: {
          coefficient: Math.max(0, Math.round(ed.coefficient)),
          weeklyHours: Math.max(0, Math.round(ed.weeklyHours)),
        },
      });
      setNotice({ type: 'ok', text: 'Coefficients / horaires mis à jour.' });
      await loadSeries();
      const updated = await refreshSeriesDetail(seriesSubjectsModal.id);
      if (updated) setSeriesSubjectsModal(updated);
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setSeriesSubjectsBusy(false);
    }
  };

  const removeSeriesSubjectLink = async (linkId: string) => {
    if (!seriesSubjectsModal) return;
    setSeriesSubjectsBusy(true);
    try {
      await pedagogyFetch(academicSeriesUrl(`subjects/${linkId}`, { ...tenantQuery }), {
        method: 'DELETE',
      });
      setNotice({ type: 'ok', text: 'Matière retirée de la série.' });
      await loadSeries();
      const updated = await refreshSeriesDetail(seriesSubjectsModal.id);
      if (updated) setSeriesSubjectsModal(updated);
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    } finally {
      setSeriesSubjectsBusy(false);
    }
  };

  const saveRoom = async () => {
    if (!yearId) return;
    if (!roomForm.roomCode.trim() || !roomForm.roomName.trim()) {
      setNotice({ type: 'err', text: 'Code et nom de salle requis.' });
      return;
    }
    try {
      const cap =
        roomForm.capacity === '' ? undefined : Math.max(1, Number(roomForm.capacity) || 1);
      const body = {
        academicYearId: yearId,
        roomCode: roomForm.roomCode.trim(),
        roomName: roomForm.roomName.trim(),
        roomType: roomForm.roomType,
        capacity: cap,
        status: 'ACTIVE',
      };
      if (roomModal?.mode === 'create') {
        await pedagogyFetch('/api/rooms', { method: 'POST', body });
        setNotice({ type: 'ok', text: 'Salle créée.' });
      } else if (roomModal?.mode === 'edit') {
        await pedagogyFetch(`/api/rooms/${roomModal.room.id}`, { method: 'PUT', body });
        setNotice({ type: 'ok', text: 'Salle mise à jour.' });
      }
      setRoomModal(null);
      await loadRooms();
    } catch (e) {
      setNotice({ type: 'err', text: (e as Error).message });
    }
  };

  const deleteRoom = async (roomId: string) => {
    try {
      await pedagogyFetch(`/api/rooms/${roomId}`, { method: 'DELETE' });
      setNotice({ type: 'ok', text: 'Salle supprimée.' });
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
    if (tab === 'levels') openCreateLevel();
    else if (tab === 'cycles') openCreateCycle();
    else if (tab === 'classes') openCreateClass();
    else if (tab === 'series') {
      setSeriesForm({ name: '', description: '' });
      setSeriesModal({ mode: 'create' });
    } else if (tab === 'rooms') {
      setRoomForm({ roomCode: '', roomName: '', roomType: 'CLASSROOM', capacity: '' });
      setRoomModal({ mode: 'create' });
    }
  };

  const showAdd =
    tab === 'levels' || tab === 'cycles' || tab === 'classes' || tab === 'series' || tab === 'rooms';

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
      }>(academicStructureUrl('duplicate', { ...tenantQuery }), {
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
              setDupConfirmed(false);
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
                        <>
                          <button
                            type="button"
                            onClick={() => openEditLevel(l)}
                            className="mr-3 text-sm font-medium hover:underline"
                            style={{ color: PRIMARY }}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLevel(l)}
                            className="text-sm font-medium hover:underline"
                            style={{ color: PRIMARY }}
                          >
                            {l.isActive ? 'Désactiver' : 'Activer'}
                          </button>
                        </>
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
          <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Les cycles structurent la scolarité <strong>par niveau</strong> (ex. CI, CP, 6ème…). Ils
              s’appuient sur les{' '}
              <button
                type="button"
                className="font-semibold underline decoration-slate-300 hover:decoration-slate-500"
                onClick={() => setTab('levels')}
              >
                niveaux
              </button>{' '}
              définis pour l’année. Pour l’officiel (Maternelle / Primaire / Secondaire), ajustez aussi la{' '}
              <Link href={settingsHref} className="font-semibold underline" style={{ color: PRIMARY }}>
                structure pédagogique
              </Link>{' '}
              en paramètres.
            </p>
            {levels.length === 0 && (
              <button
                type="button"
                onClick={() => setTab('levels')}
                className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: ACCENT }}
              >
                Aller aux niveaux
              </button>
            )}
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Niveau</th>
                <th className="px-4 py-3">Ordre</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {cycles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    {levels.length === 0
                      ? 'Créez d’abord des niveaux pour cette année, puis ajoutez des cycles (CI, CP, 6ème…).'
                      : 'Aucun cycle. Utilisez « Ajouter » pour créer vos cycles par niveau.'}
                  </td>
                </tr>
              ) : (
                cycles.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-3 text-slate-600">{c.level?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.orderIndex}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          c.isActive
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-slate-200 text-slate-700',
                        )}
                      >
                        {c.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEditCycle(c)}
                        className="mr-3 text-sm font-medium hover:underline"
                        style={{ color: PRIMARY }}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCycle(c)}
                        className="text-sm font-medium hover:underline"
                        style={{ color: PRIMARY }}
                      >
                        {c.isActive ? 'Désactiver' : 'Activer'}
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
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <p className="text-sm text-slate-600">
              Les classes pédagogiques correspondent aux <strong>grades</strong> de la{' '}
              <Link href={settingsHref} className="font-semibold underline" style={{ color: PRIMARY }}>
                structure pédagogique
              </Link>{' '}
              (niveaux → cycles → grades). Libellés, codes, rattachements niveau/cycle et capacité (somme des classes physiques du grade pour cette année en paramètres) sont resynchronisés à chaque chargement de cet onglet.
            </p>
          </div>
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
                    Aucune classe. Définissez les grades dans la structure pédagogique (paramètres) ou ajoutez une classe manuellement.
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
            Les pistes linguistiques (FR / EN) sur chaque classe sont alignées sur l’
            <Link href={settingsHrefBilingual} className="font-semibold underline" style={{ color: PRIMARY }}>
              option bilingue
            </Link>{' '}
            en paramètres. À chaque chargement, les pistes sont harmonisées (langue par défaut, désactivation du
            EN si le bilingue est coupé).{' '}
            {bilingualEnabled
              ? 'Le mode bilingue est activé : vous pouvez attribuer FR ou EN par classe.'
              : 'Sans option bilingue, seule la langue par défaut des paramètres s’applique (souvent FR).'}
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="px-3 py-2">Classe</th>
                  <th className="px-3 py-2">Piste</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                        value={trackDraft[c.id] ?? c.languageTrack ?? ''}
                        onChange={(e) =>
                          setTrackDraft((m) => ({ ...m, [c.id]: e.target.value }))
                        }
                      >
                        <option value="">—</option>
                        <option value="FR">FR</option>
                        {bilingualEnabled && <option value="EN">EN</option>}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={!!trackSaving[c.id]}
                        className="text-sm font-medium hover:underline disabled:opacity-50"
                        style={{ color: PRIMARY }}
                        onClick={() =>
                          saveLanguageTrack(c, trackDraft[c.id] ?? c.languageTrack ?? '')
                        }
                      >
                        {trackSaving[c.id] ? 'En cours…' : 'Enregistrer'}
                      </button>
                    </td>
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
              Ajoutez d&apos;abord le niveau <strong>Secondaire</strong> (nom contenant « Secondaire » ou libellé
              canonique SECONDAIRE) pour gérer les séries.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  Les séries du second cycle secondaire (A, C, D…) peuvent être reliées aux{' '}
                  <strong>matières</strong> de l&apos;année (coefficient et volume horaire hebdomadaire). Les
                  matières sont issues du référentiel de l&apos;année scolaire active.
                </p>
              </div>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                    <th className="px-4 py-3">Série</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Matières</th>
                    <th className="px-4 py-3">Actif</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {series.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        Aucune série (A, C, D…). Ajoutez une série pour le secondaire.
                      </td>
                    </tr>
                  ) : (
                    series.map((s) => {
                      const n = s.seriesSubjects?.length ?? 0;
                      return (
                        <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-medium">{s.name}</td>
                          <td className="px-4 py-3 text-slate-600">{s.description ?? '—'}</td>
                          <td className="px-4 py-3 text-slate-700">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                              {n} matière{n !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="px-4 py-3">{s.isActive ? 'Oui' : 'Non'}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              className="mr-2 inline-flex items-center gap-1 text-sm font-medium hover:underline"
                              style={{ color: PRIMARY }}
                              onClick={() => void openSeriesSubjectsModal(s)}
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              Matières
                            </button>
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
                      );
                    })
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {!loading && tab === 'rooms' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Salle</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Capacité</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    Aucune salle enregistrée.
                  </td>
                </tr>
              ) : (
                rooms.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.roomCode ?? '—'}</td>
                    <td className="px-4 py-3 font-medium">{roomDisplayName(r)}</td>
                    <td className="px-4 py-3">{roomTypeDisplay(r)}</td>
                    <td className="px-4 py-3">{r.capacity ?? '—'}</td>
                    <td className="px-4 py-3">{r.status ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="mr-3 text-sm font-medium hover:underline"
                        style={{ color: PRIMARY }}
                        onClick={() => {
                          setRoomForm({
                            roomCode: r.roomCode ?? '',
                            roomName: r.roomName ?? '',
                            roomType: r.roomType ?? 'CLASSROOM',
                            capacity: r.capacity ?? '',
                          });
                          setRoomModal({ mode: 'edit', room: r });
                        }}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-amber-700 hover:underline"
                        onClick={() => deleteRoom(r.id)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <BaseModal
        title={levelModal?.mode === 'edit' ? 'Modifier le niveau' : 'Nouveau niveau'}
        isOpen={levelModal != null}
        onClose={() => setLevelModal(null)}
        showContext={false}
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setLevelModal(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveLevel}
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
            <span className="text-slate-600">Nom du niveau</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={levelForm.name}
              onChange={(e) => setLevelForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex. Secondaire technique"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Ordre d&apos;affichage</span>
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={levelForm.orderIndex}
              onChange={(e) =>
                setLevelForm((f) => ({ ...f, orderIndex: Number(e.target.value) }))
              }
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={levelForm.isActive}
              onChange={(e) => setLevelForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            <span className="text-slate-700">Niveau actif</span>
          </label>
          <p className="text-xs text-slate-500">
            Les niveaux officiels (Maternelle/Primaire/Secondaire) se gèrent via Paramètres.
          </p>
        </div>
      </BaseModal>

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
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cycleForm.isActive}
              onChange={(e) => setCycleForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            <span className="text-slate-700">Cycle actif</span>
          </label>
          {cycleModal?.mode === 'edit' && cycleModal.cycle.level?.name && (
            <p className="text-xs text-slate-500">
              Niveau : <strong>{cycleModal.cycle.level.name}</strong> (non modifiable ici)
            </p>
          )}
          <p className="text-xs text-slate-500">
            L’ordre et le statut s’appliquent dans les listes et filtres (classes, sections…).
          </p>
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
                {bilingualEnabled && <option value="EN">EN</option>}
              </select>
            <span className="mt-1 block text-xs text-slate-500">
              {bilingualEnabled
                ? 'Option bilingue activée (Paramètres).'
                : 'Piste EN disponible après activation dans Paramètres → Bilingue.'}
            </span>
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
        title={
          seriesSubjectsModal ? `Matières — ${seriesSubjectsModal.name}` : 'Matières de la série'
        }
        isOpen={seriesSubjectsModal != null}
        onClose={() => !seriesSubjectsBusy && setSeriesSubjectsModal(null)}
        showContext={false}
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              disabled={seriesSubjectsBusy}
              onClick={() => setSeriesSubjectsModal(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm disabled:opacity-50"
            >
              Fermer
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {subjectsCatalogLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement des matières…
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                      <th className="px-3 py-2">Matière</th>
                      <th className="px-3 py-2">Coeff.</th>
                      <th className="px-3 py-2">H/sem.</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!seriesSubjectsModal?.seriesSubjects?.length ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                          Aucune matière liée. Ajoutez-en une ci-dessous.
                        </td>
                      </tr>
                    ) : (
                      seriesSubjectsModal.seriesSubjects.map((link) => {
                        const ed = seriesSubjectEdits[link.id];
                        const coef = ed?.coefficient ?? link.coefficient;
                        const hrs = ed?.weeklyHours ?? link.weeklyHours;
                        return (
                          <tr key={link.id} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-medium">
                              {link.subject.name}
                              {link.subject.code ? (
                                <span className="ml-1 text-xs font-normal text-slate-500">
                                  ({link.subject.code})
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                className="w-20 rounded border border-slate-200 px-2 py-1"
                                value={coef}
                                disabled={seriesSubjectsBusy}
                                onChange={(e) =>
                                  setSeriesSubjectEdits((m) => ({
                                    ...m,
                                    [link.id]: {
                                      coefficient: Number(e.target.value) || 0,
                                      weeklyHours: m[link.id]?.weeklyHours ?? link.weeklyHours,
                                    },
                                  }))
                                }
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                className="w-20 rounded border border-slate-200 px-2 py-1"
                                value={hrs}
                                disabled={seriesSubjectsBusy}
                                onChange={(e) =>
                                  setSeriesSubjectEdits((m) => ({
                                    ...m,
                                    [link.id]: {
                                      coefficient: m[link.id]?.coefficient ?? link.coefficient,
                                      weeklyHours: Number(e.target.value) || 0,
                                    },
                                  }))
                                }
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                disabled={seriesSubjectsBusy}
                                className="mr-2 text-xs font-medium hover:underline"
                                style={{ color: PRIMARY }}
                                onClick={() => void saveSeriesSubjectLink(link.id)}
                              >
                                Enregistrer
                              </button>
                              <button
                                type="button"
                                disabled={seriesSubjectsBusy}
                                className="text-xs text-amber-700 hover:underline"
                                onClick={() => void removeSeriesSubjectLink(link.id)}
                              >
                                Retirer
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  Associer une matière
                </p>
                {subjectsCatalog.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    Aucune matière pour cette année scolaire. Créez des matières (référentiel) puis revenez
                    ici.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="block min-w-[200px] flex-1 text-sm">
                      <span className="text-slate-600">Matière</span>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                        value={newSeriesSubject.subjectId}
                        disabled={seriesSubjectsBusy}
                        onChange={(e) =>
                          setNewSeriesSubject((s) => ({ ...s, subjectId: e.target.value }))
                        }
                      >
                        <option value="">Choisir…</option>
                        {subjectsCatalog
                          .filter(
                            (sub) =>
                              !seriesSubjectsModal?.seriesSubjects?.some(
                                (l) => l.subject.id === sub.id,
                              ),
                          )
                          .map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.name} ({sub.code})
                            </option>
                          ))}
                      </select>
                    </label>
                    <label className="block w-24 text-sm">
                      <span className="text-slate-600">Coeff.</span>
                      <input
                        type="number"
                        min={0}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                        value={newSeriesSubject.coefficient}
                        disabled={seriesSubjectsBusy}
                        onChange={(e) =>
                          setNewSeriesSubject((s) => ({
                            ...s,
                            coefficient: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </label>
                    <label className="block w-24 text-sm">
                      <span className="text-slate-600">H/sem.</span>
                      <input
                        type="number"
                        min={0}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                        value={newSeriesSubject.weeklyHours}
                        disabled={seriesSubjectsBusy}
                        onChange={(e) =>
                          setNewSeriesSubject((s) => ({
                            ...s,
                            weeklyHours: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      disabled={
                        seriesSubjectsBusy ||
                        !newSeriesSubject.subjectId ||
                        subjectsCatalog.filter(
                          (sub) =>
                            !seriesSubjectsModal?.seriesSubjects?.some(
                              (l) => l.subject.id === sub.id,
                            ),
                        ).length === 0
                      }
                      onClick={() => void addSubjectToSeries()}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      Ajouter
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </BaseModal>

      <BaseModal
        title={roomModal?.mode === 'edit' ? 'Modifier la salle' : 'Nouvelle salle'}
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
              Enregistrer
            </button>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">Code</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono"
              value={roomForm.roomCode}
              onChange={(e) => setRoomForm((f) => ({ ...f, roomCode: e.target.value }))}
              placeholder="Ex. S01"
              disabled={roomModal?.mode === 'edit'}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Nom</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={roomForm.roomName}
              onChange={(e) => setRoomForm((f) => ({ ...f, roomName: e.target.value }))}
              placeholder="Ex. Salle 01"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Type</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={roomForm.roomType}
              onChange={(e) => setRoomForm((f) => ({ ...f, roomType: e.target.value }))}
            >
              <option value="CLASSROOM">Salle de classe</option>
              <option value="LAB">Laboratoire</option>
              <option value="IT">Informatique</option>
              <option value="EXAM">Examen</option>
              <option value="OTHER">Autre</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Capacité (optionnel)</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={roomForm.capacity}
              onChange={(e) => setRoomForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </label>
          <p className="text-xs text-slate-500 sm:col-span-2">
            Les salles sont filtrées sur l’année scolaire active.
          </p>
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
              disabled={dupRunning || dupFrom === dupTo || !dupConfirmed}
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
        <label className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <input
            type="checkbox"
            className="mt-1"
            checked={dupConfirmed}
            onChange={(e) => setDupConfirmed(e.target.checked)}
          />
          <span>
            Je confirme que l’année cible est <strong>vide</strong> (aucun niveau/cycle/classe déjà créé),
            et que je veux lancer la duplication.
          </span>
        </label>
      </BaseModal>
    </div>
  );
}
