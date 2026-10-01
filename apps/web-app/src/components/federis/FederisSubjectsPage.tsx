/**
 * FederisSubjectsPage — Module « Matières » (Academia Federis)
 *
 * Catalogue des matières D'EXAMEN du patronat, par type (CEP | BEPC | BAC |
 * CAP) et par série (BAC : A1, A2, C, D…). Reproduction du système de
 * création de matières du module Pédagogie Helm (Matières et programmes —
 * SubjectsWorkspace : tableau + formulaire + panneau de suggestions du jeu
 * officiel + sélection multiple avec suppression en lot + confirmation),
 * contextualisée aux examens nationaux Federis.
 *
 * CE MODULE ALIMENTE TOUT LE WORKFLOW :
 *   - au LANCEMENT d'une campagne (Examens nationaux → REGISTRATION_OPEN /
 *     IN_PROGRESS), les matières du catalogue sont attachées automatiquement ;
 *   - le SIGNAL « épreuves à préparer » passe à l'orange tant qu'une matière
 *     d'un examen lancé n'a pas son épreuve (module Épreuves) — vert dès que
 *     tout est préparé (bandeau readiness ci-dessous, synchronisable) ;
 *   - le module Notes et Moyennes affiche ces matières (grille de saisie).
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { canWrite } from '@/lib/patronat/permissions';
import { FedPage, FedCountUp } from '@/components/federis/federis-motion';
// ⭐ Durées intelligentes (2026-09-30) : au-delà de 60 min, conversion en
//    heures en DIRECT (affichage « 2h » sur l'épreuve, minutes en infobulle)
import {
  durationInputHint,
  catalogDurationCell,
} from '@/lib/federis/duration';

// ── Types ───────────────────────────────────────────────────────────────────

interface SubjectRow {
  id: string;
  examType: string;
  examTypeLabel: string;
  series: string;
  code: string;
  name: string;
  description: string | null;
  coefficient: number;
  maxScore: number;
  duration: number | null;
  order: number;
  isActive: boolean;
  papersCount: number;
}

interface OfficialSubject {
  code: string;
  name: string;
  coefficient: number;
  maxScore?: number;
  duration?: number;
}

interface SubjectsPayload {
  academicYearLabel: string | null;
  canManage: boolean;
  types: Array<{ examType: string; label: string; count: number; series: Array<{ series: string; count: number }> }>;
  subjects: SubjectRow[];
  official: Record<string, Record<string, OfficialSubject[]>>;
  bacSeries: string[];
}

interface ReadinessSubject {
  subjectId: string;
  sourceSubjectId: string | null;
  code: string;
  name: string;
  series: string;
  hasPaper: boolean;
}

interface ReadinessExam {
  examId: string;
  code: string;
  name: string;
  examType: string;
  status: string;
  showSeries: boolean;
  subjectsCount: number;
  missingCount: number;
  ready: boolean;
  subjects: ReadinessSubject[];
  missing: ReadinessSubject[];
  catalogUnattached: Array<{ id: string; code: string; name: string; series: string }>;
}

interface ReadinessPayload {
  launchedExams: number;
  totalSubjects: number;
  totalMissing: number;
  allReady: boolean;
  exams: ReadinessExam[];
}

interface FederisSubjectsPageProps {
  tenantId?: string;
  userRole?: string | null;
}

const EXAM_TYPES: Array<{ type: 'CEP' | 'BEPC' | 'BAC' | 'CAP'; label: string }> = [
  { type: 'CEP', label: 'CEP' },
  { type: 'BEPC', label: 'BEPC' },
  { type: 'BAC', label: 'Baccalauréat' },
  { type: 'CAP', label: 'CAP' },
];

const EMPTY_FORM = {
  code: '',
  name: '',
  series: '',
  coefficient: '1',
  maxScore: '20',
  duration: '',
  description: '',
};

export default function FederisSubjectsPage({ userRole }: FederisSubjectsPageProps) {
  // ── Données ─────────────────────────────────────────────────────────────
  const [data, setData] = useState<SubjectsPayload | null>(null);
  const [readiness, setReadiness] = useState<ReadinessPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // ── Filtres ─────────────────────────────────────────────────────────────
  const [activeType, setActiveType] = useState<string>('CEP');
  const [activeSeries, setActiveSeries] = useState<string>('__ALL__');
  const [search, setSearch] = useState('');

  // ── Formulaire (pattern FormModal Helm) ─────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Suggestions du jeu officiel (pattern panneau Helm) ──────────────────
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionSeries, setSuggestionSeries] = useState<string>('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // ⭐ Paramétrage par matière sélectionnée (pattern Helm « matière programme ») :
  //    une fois les matières cochées, les champs Coefficient / Barème / Durée
  //    apparaissent pour CHAQUE matière — entièrement modifiables (aucun
  //    coefficient imposé, le catalogue n'est qu'un point de départ).
  const [pickedConfig, setPickedConfig] = useState<
    Record<string, { coefficient: string; maxScore: string; duration: string }>
  >({});

  /** Valeurs initiales d'une matière suggérée (coefficient neutre 1, /20). */
  const initConfigFor = (s: OfficialSubject) => ({
    coefficient: String(s.coefficient ?? 1).replace('.', ','),
    maxScore: String(s.maxScore ?? 20).replace('.', ','),
    duration: s.duration ? String(s.duration) : '',
  });

  // ── Sélection multiple + confirmation (pattern Helm) ────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<SubjectRow | 'MANY' | null>(null);

  const fallbackCanManage = canWrite(userRole, 'exam_org');
  const canManage = data?.canManage ?? fallbackCanManage;

  // ── Chargement ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subjectsRes, readinessRes] = await Promise.all([
        apiClient.get('/federis/subjects', { timeout: 20000 }),
        apiClient.get('/federis/subjects/readiness', { timeout: 20000 }).catch(() => null),
      ]);
      setData(subjectsRes.data ?? null);
      if (readinessRes?.data) setReadiness(readinessRes.data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger les matières.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setActiveSeries('__ALL__');
    setSelected(new Set());
    setSuggestionsOpen(false);
    setSuggestionSeries(activeType === 'BAC' ? 'A1' : '');
    // ⭐ Réinitialise aussi le paramétrage des suggestions (changement de type)
    setPicked(new Set());
    setPickedConfig({});
  }, [activeType]);

  // ── Vue filtrée ─────────────────────────────────────────────────────────
  const subjects = data?.subjects ?? [];
  const filtered = useMemo(() => {
    let rows = subjects.filter((s) => s.examType === activeType);
    if (activeType === 'BAC' || activeType === 'CAP') {
      if (activeSeries !== '__ALL__') rows = rows.filter((s) => s.series === activeSeries);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [subjects, activeType, activeSeries, search]);

  const typeMeta = data?.types.find((t) => t.examType === activeType);
  const seriesChips = typeMeta?.series ?? [];
  const showSeries = activeType === 'BAC' || activeType === 'CAP';

  // ── Readiness du type actif (signal épreuves) ───────────────────────────
  const readinessForType = useMemo(() => {
    if (!readiness) return null;
    const exams = readiness.exams.filter((e) => e.examType === activeType);
    return {
      exams,
      missingSubjects: exams.reduce((sum, e) => sum + e.missingCount, 0),
      unattached: exams.reduce((sum, e) => sum + e.catalogUnattached.length, 0),
    };
  }, [readiness, activeType]);

  /** Statut d'une matière du catalogue dans les examens lancés (vert/orange/neutre). */
  const subjectSignal = useCallback(
    (subject: SubjectRow): { state: 'ready' | 'missing' | 'idle'; exams: number } => {
      if (!readinessForType || readinessForType.exams.length === 0) {
        return { state: 'idle', exams: 0 };
      }
      let used = 0;
      let allReady = true;
      for (const exam of readinessForType.exams) {
        const attached = exam.subjects.find((s) => s.sourceSubjectId === subject.id);
        if (attached) {
          used += 1;
          if (!attached.hasPaper) allReady = false;
        }
      }
      if (used === 0) return { state: 'idle', exams: 0 };
      return { state: allReady ? 'ready' : 'missing', exams: used };
    },
    [readinessForType],
  );

  // ── Actions ─────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, series: activeType === 'BAC' ? 'A1' : '' });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (s: SubjectRow) => {
    setEditingId(s.id);
    setForm({
      code: s.code,
      name: s.name,
      series: s.series,
      coefficient: String(s.coefficient).replace('.', ','),
      maxScore: String(s.maxScore).replace('.', ','),
      duration: s.duration ? String(s.duration) : '',
      description: s.description ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  };

  const submitForm = async () => {
    setWorking(true);
    setFormError(null);
    try {
      const payload = {
        examType: activeType,
        series: showSeries ? form.series.trim() : '',
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        coefficient: Number(form.coefficient.replace(',', '.')) || 1,
        maxScore: Number(form.maxScore.replace(',', '.')) || 20,
        duration: form.duration ? Number(form.duration) : undefined,
        description: form.description.trim() || undefined,
      };
      if (!payload.code || !payload.name) {
        throw { response: { data: { message: 'Code et intitulé obligatoires.' } } };
      }
      if (editingId) {
        const res = await apiClient.patch(`/federis/subjects/${editingId}`, payload, { timeout: 20000 });
        setNotice(res.data?.name ? `Matière « ${res.data.name} » mise à jour.` : 'Matière mise à jour.');
      } else {
        const res = await apiClient.post('/federis/subjects', payload, { timeout: 20000 });
        if (res.data?.duplicated) {
          setNotice(res.data?.message ?? 'Cette matière existe déjà.');
        } else {
          setNotice(`Matière « ${payload.name} » ajoutée au catalogue ${activeType}.`);
        }
      }
      setFormOpen(false);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setFormError(Array.isArray(msg) ? msg.join(' ') : msg ?? 'Enregistrement impossible.');
    } finally {
      setWorking(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setWorking(true);
    setError(null);
    try {
      if (confirmDelete === 'MANY') {
        let deleted = 0;
        const errors: string[] = [];
        for (const id of selected) {
          try {
            await apiClient.delete(`/federis/subjects/${id}`, { timeout: 20000 });
            deleted += 1;
          } catch (err: any) {
            const msg = err?.response?.data?.message;
            errors.push(String(Array.isArray(msg) ? msg.join(' ') : msg ?? 'erreur'));
          }
        }
        setNotice(
          deleted > 0
            ? `${deleted} matière(s) supprimée(s)${errors.length ? ` — ${errors.length} échec(s)` : ''}.`
            : 'Aucune matière supprimée.',
        );
        if (errors.length > 0) setError(errors.slice(0, 3).join(' '));
        setSelected(new Set());
      } else {
        const res = await apiClient.delete(`/federis/subjects/${confirmDelete.id}`, { timeout: 20000 });
        setNotice(res.data?.message ?? 'Matière supprimée.');
      }
      setConfirmDelete(null);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Suppression impossible.');
    } finally {
      setWorking(false);
    }
  };

  const initOfficial = async () => {
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post(
        '/federis/subjects/init',
        activeType === 'BAC' ? { examType: activeType, series: suggestionSeries || undefined } : { examType: activeType },
        { timeout: 30000 },
      );
      setNotice(res.data?.message ?? 'Matières suggérées ajoutées.');
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Initialisation impossible.');
    } finally {
      setWorking(false);
    }
  };

  const addSuggestions = async () => {
    if (picked.size === 0) return;
    setWorking(true);
    setError(null);
    try {
      const seriesKey = activeType === 'BAC' ? suggestionSeries : '';
      const official = data?.official?.[activeType]?.[seriesKey] ?? [];
      // ⭐ Envoie le paramétrage SAISI par matière (coefficient / barème / durée)
      //    — les valeurs du catalogue ne sont que des points de départ modifiables.
      const rows = official
        .filter((s) => picked.has(s.code))
        .map((s) => {
          const cfg = pickedConfig[s.code] ?? initConfigFor(s);
          return {
            series: seriesKey,
            code: s.code,
            name: s.name,
            coefficient: Number(cfg.coefficient.replace(',', '.')) || 1,
            maxScore: Number(cfg.maxScore.replace(',', '.')) || 20,
            duration: cfg.duration ? Number(cfg.duration) : undefined,
          };
        });
      const res = await apiClient.post(
        '/federis/subjects/bulk',
        {
          examType: activeType,
          rows,
        },
        { timeout: 30000 },
      );
      setNotice(res.data?.message ?? 'Matières ajoutées.');
      setPicked(new Set());
      setPickedConfig({});
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Ajout en lot impossible.');
    } finally {
      setWorking(false);
    }
  };

  const syncExam = async (examId: string) => {
    setWorking(true);
    setError(null);
    try {
      const res = await apiClient.post(`/federis/exams/${examId}/subjects/sync`, {}, { timeout: 30000 });
      setNotice(res.data?.message ?? 'Catalogue synchronisé.');
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Synchronisation impossible.');
    } finally {
      setWorking(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const officialSuggestions =
    data?.official?.[activeType]?.[activeType === 'BAC' ? suggestionSeries : ''] ?? [];

  // ⭐ Suggestions encore disponibles (non déjà présentes au catalogue) —
  //    base du bouton « Tout sélectionner » (pattern Helm SubjectsWorkspace).
  const seriesKeyForSuggestions = activeType === 'BAC' ? suggestionSeries : '';
  const availableSuggestions = officialSuggestions.filter(
    (s) =>
      !subjects.some(
        (x) => x.examType === activeType && x.series === seriesKeyForSuggestions && x.code === s.code,
      ),
  );

  /** Coche / décoche une matière + initialise son paramétrage au besoin. */
  const togglePicked = (s: OfficialSubject) => {
    const willPick = !picked.has(s.code);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(s.code)) next.delete(s.code);
      else next.add(s.code);
      return next;
    });
    if (willPick) {
      setPickedConfig((cfg) => (cfg[s.code] ? cfg : { ...cfg, [s.code]: initConfigFor(s) }));
    }
  };

  /** Tout sélectionner / Tout désélectionner (pattern Helm). */
  const toggleAllPicked = () => {
    if (availableSuggestions.length > 0 && picked.size === availableSuggestions.length) {
      setPicked(new Set());
    } else {
      setPicked(new Set(availableSuggestions.map((s) => s.code)));
      setPickedConfig((cfg) => {
        const next = { ...cfg };
        for (const s of availableSuggestions) {
          next[s.code] = next[s.code] ?? initConfigFor(s);
        }
        return next;
      });
    }
  };

  // ── Rendu ───────────────────────────────────────────────────────────────
  return (
    <FedPage className="space-y-7">
      {/* En-tête — style Helm */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="fed-badge mb-2">Module matières</div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Matières des examens</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Matières à examiner pour chaque examen, avec coefficients et barèmes.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="fed-card px-6 py-4 text-center">
            <p className="text-2xl font-bold text-gray-900"><FedCountUp value={subjects.length} /></p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Matières</p>
          </div>
          <div className="fed-card px-6 py-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              <FedCountUp value={subjects.reduce((sum, s) => sum + s.papersCount, 0)} />
            </p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Épreuves liées</p>
          </div>
          {readiness && (
            <div className={cn(
              'fed-card px-6 py-4 text-center',
              readiness.allReady ? 'ring-1 ring-emerald-200' : 'ring-1 ring-amber-200',
            )}>
              <p className={cn('text-2xl font-bold', readiness.allReady ? 'text-emerald-700' : 'text-amber-600')}>
                {readiness.allReady ? '✓' : readiness.totalMissing}
              </p>
              <p className="text-xs font-medium text-gray-500 mt-0.5">
                {readiness.allReady ? 'Tout prêt' : 'Épreuves à préparer'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ⭐ Signal « épreuves à préparer » (examens lancés) */}
      {readiness && readiness.launchedExams > 0 && (
        <div className={cn(
          'rounded-xl px-6 py-5 border space-y-4',
          readiness.allReady
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200',
        )}>
          <div className="flex items-start gap-3">
            <AppIcon
              name={readiness.allReady ? 'success' : 'warning'}
              size="menu"
              className={readiness.allReady ? 'text-emerald-600 mt-0.5' : 'text-amber-600 mt-0.5'}
            />
            <div className="flex-1">
              <p className={cn('text-sm font-bold', readiness.allReady ? 'text-emerald-900' : 'text-amber-900')}>
                {readiness.allReady
                  ? 'Toutes les épreuves des examens lancés sont préparées — tout est au vert.'
                  : `${readiness.totalMissing} épreuve(s) à préparer sur ${readiness.launchedExams} examen(s) officiellement lancé(s).`}
              </p>
              <p className="text-xs mt-1 text-slate-600 font-medium">
                Les matières attachées à un examen lancé doivent avoir leur épreuve dans le module
                Épreuves et documents — le signal passe au vert dès que chaque matière est couverte.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {readiness.exams.map((exam) => (
              <div key={exam.examId} className={cn(
                'rounded-xl px-4 py-3 border bg-white/70 space-y-2',
                exam.ready ? 'border-emerald-200' : 'border-amber-200',
              )}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-blue-900 truncate">
                      {exam.code} — {exam.name}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {exam.subjectsCount} matière(s) · {exam.ready ? 'épreuves complètes' : `${exam.missingCount} sans épreuve`}
                    </p>
                  </div>
                  <span className={cn(
                    'shrink-0 text-[9px] font-black uppercase px-2.5 py-1 rounded',
                    exam.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                  )}>
                    {exam.ready ? 'Vert' : 'À préparer'}
                  </span>
                </div>
                {!exam.ready && (
                  <p className="text-[10px] font-semibold text-amber-800 leading-relaxed">
                    À préparer : {exam.missing.slice(0, 6).map((m) => m.name).join(', ')}
                    {exam.missing.length > 6 ? `… (+${exam.missing.length - 6})` : ''}
                  </p>
                )}
                {exam.catalogUnattached.length > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold text-slate-500">
                      {exam.catalogUnattached.length} matière(s) du catalogue non rattachée(s)
                    </p>
                    {canManage && (
                      <button
                        onClick={() => syncExam(exam.examId)}
                        disabled={working}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase fed-btn-navy disabled:opacity-50"
                      >
                        Synchroniser
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 text-sm font-semibold text-emerald-800">{notice}</div>
      )}

      {/* ⭐ Onglets de type : CEP | BEPC | BAC | CAP */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Type d'examen">
        {EXAM_TYPES.map((t) => {
          const meta = data?.types.find((x) => x.examType === t.type);
          const isActive = activeType === t.type;
          return (
            <button
              key={t.type}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveType(t.type)}
              className={cn(
                'px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide border transition-all',
                isActive
                  ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-900/40 hover:text-blue-900',
              )}
            >
              {t.label}
              <span className={cn(
                'ml-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold',
                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
              )}>
                {meta?.count ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Chips de série (BAC / CAP) */}
      {showSeries && seriesChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Série / filière</span>
          <button
            onClick={() => setActiveSeries('__ALL__')}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-[10px] font-bold border transition-all',
              activeSeries === '__ALL__'
                ? 'bg-blue-50 border-blue-300 text-blue-900'
                : 'bg-white border-slate-200 text-slate-500 hover:border-blue-200',
            )}
          >
            Toutes ({typeMeta?.count ?? 0})
          </button>
          {seriesChips.map((s) => (
            <button
              key={s.series || '__COMMON__'}
              onClick={() => setActiveSeries(s.series)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-[10px] font-bold border transition-all',
                activeSeries === s.series
                  ? 'bg-blue-50 border-blue-300 text-blue-900'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-blue-200',
              )}
            >
              {s.series || 'Tronc commun'} ({s.count})
            </button>
          ))}
        </div>
      )}

      {/* Barre d'actions */}
      <div className="fed-card px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une matière (nom, code)…"
          className="fed-input-light px-5 py-2.5 text-xs font-bold flex-1 min-w-[200px]"
        />
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openCreate}
              className="fed-btn-navy px-5 py-2.5 text-[10px] font-bold uppercase"
            >
              Nouvelle matière
            </button>
            <button
              onClick={() => setSuggestionsOpen((v) => !v)}
              className="px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-white border border-blue-900/20 text-blue-900 hover:bg-blue-50 transition-colors"
            >
              {suggestionsOpen ? 'Fermer les suggestions' : 'Matières suggérées'}
            </button>
          </div>
        )}
      </div>

      {/* ⭐ Panneau de suggestions du jeu officiel (pattern Helm « matière programme ») */}
      {canManage && suggestionsOpen && (
        <div className="fed-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-blue-900 uppercase">
                Matières suggérées — {EXAM_TYPES.find((t) => t.type === activeType)?.label}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Sélectionnez les matières à examiner, puis paramétrez librement coefficient,
                barème et durée de chacune — exactement comme dans Academia Helm (module
                Pédagogie → Matières et programmes).
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeType === 'BAC' && (
                <select
                  value={suggestionSeries}
                  onChange={(e) => {
                    setSuggestionSeries(e.target.value);
                    setPicked(new Set());
                    setPickedConfig({});
                  }}
                  className="fed-input-light px-4 py-2 text-xs font-bold !w-auto"
                >
                  {(data?.bacSeries ?? ['A1', 'A2', 'C', 'D']).map((s) => (
                    <option key={s} value={s}>Série {s}</option>
                  ))}
                </select>
              )}
              {availableSuggestions.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllPicked}
                  className="px-4 py-2 rounded-xl text-[10px] font-bold uppercase bg-white border border-blue-900/20 text-blue-900 hover:bg-blue-50 transition-colors"
                >
                  {picked.size === availableSuggestions.length && picked.size > 0
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'}
                </button>
              )}
            </div>
          </div>
          {officialSuggestions.length === 0 ? (
            <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              Aucune matière suggérée pour cette sélection — ajoutez vos matières manuellement.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {officialSuggestions.map((s) => {
                  const alreadyExists = subjects.some(
                    (x) => x.examType === activeType && x.series === seriesKeyForSuggestions && x.code === s.code,
                  );
                  const isPicked = picked.has(s.code);
                  return (
                    <label
                      key={s.code}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all',
                        isPicked ? 'border-blue-900 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300',
                        alreadyExists && 'opacity-50 pointer-events-none',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isPicked}
                        disabled={alreadyExists}
                        onChange={() => togglePicked(s)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-blue-900 truncate">{s.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">
                          {s.code}
                          {alreadyExists ? ' · déjà présente' : ' · à paramétrer'}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* ⭐ Paramétrage par matière sélectionnée — les champs apparaissent
                  dès la sélection (coefficient / barème / durée modifiables). */}
              {picked.size > 0 && (
                <div className="border-t border-blue-100 pt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-blue-900 uppercase">
                      Paramétrage des {picked.size} matière(s) sélectionnée(s)
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      Coefficient · Barème · Durée
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-[#f7f9fc]">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase">Matière</th>
                          <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase w-28">Coefficient</th>
                          <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase w-28">Barème</th>
                          <th className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400 uppercase w-32">Durée (min)</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {officialSuggestions
                          .filter((s) => picked.has(s.code))
                          .map((s) => {
                            const cfg =
                              pickedConfig[s.code] ?? initConfigFor(s);
                            return (
                              <tr key={s.code}>
                                <td className="px-4 py-2.5">
                                  <p className="text-xs font-bold text-blue-900">{s.name}</p>
                                  <p className="text-[9px] font-bold text-slate-400 uppercase">{s.code}</p>
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={cfg.coefficient}
                                    onChange={(e) =>
                                      setPickedConfig((prev) => ({
                                        ...prev,
                                        [s.code]: { ...cfg, coefficient: e.target.value },
                                      }))
                                    }
                                    className="fed-input-light !px-3 !py-2 text-xs font-bold text-center !w-20"
                                    placeholder="1"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={cfg.maxScore}
                                    onChange={(e) =>
                                      setPickedConfig((prev) => ({
                                        ...prev,
                                        [s.code]: { ...cfg, maxScore: e.target.value },
                                      }))
                                    }
                                    className="fed-input-light !px-3 !py-2 text-xs font-bold text-center !w-20"
                                    placeholder="20"
                                  />
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <input
                                    type="number"
                                    min={1}
                                    value={cfg.duration}
                                    onChange={(e) =>
                                      setPickedConfig((prev) => ({
                                        ...prev,
                                        [s.code]: { ...cfg, duration: e.target.value },
                                      }))
                                    }
                                    className="fed-input-light !px-3 !py-2 text-xs font-bold text-center !w-24"
                                    placeholder="—"
                                  />
                                  {/* ⭐ Conversion en direct : 120 → « = 2h » */}
                                  {durationInputHint(cfg.duration) && (
                                    <div
                                      className="text-[9px] font-bold text-emerald-700 mt-1 whitespace-nowrap"
                                      title="Durée convertie automatiquement en heures sur l'épreuve"
                                    >
                                      = {durationInputHint(cfg.duration)}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                    💡 Les valeurs pré-remplies (coefficient 1, barème /20) ne sont que des points
                    de départ : ajustez chaque matière selon votre règlement d'examen avant
                    d'ajouter la sélection au catalogue.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={addSuggestions}
                  disabled={working || picked.size === 0}
                  className="fed-btn-gold px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50"
                >
                  Ajouter la sélection ({picked.size})
                </button>
                <button
                  onClick={initOfficial}
                  disabled={working}
                  className="px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  title="Ajouter TOUTES les matières suggérées en une fois (les codes existants sont ignorés)"
                >
                  Tout ajouter d'un coup
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Barre de suppression en lot (pattern Helm) */}
      {selected.size > 0 && canManage && (
        <div className="sticky top-[72px] z-20 flex items-center justify-between gap-3 rounded-xl bg-blue-900 px-6 py-3 shadow-lg">
          <p className="text-xs font-bold text-white">{selected.size} matière(s) sélectionnée(s)</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase bg-white/10 text-white hover:bg-white/20"
            >
              Annuler
            </button>
            <button
              onClick={() => setConfirmDelete('MANY')}
              disabled={working}
              className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
            >
              Supprimer la sélection
            </button>
          </div>
        </div>
      )}

      {/* ⭐ Tableau du catalogue (pattern SubjectsWorkspace Helm) */}
      <div className="fed-card overflow-hidden">
        <div className="px-6 py-4 border-b border-blue-50 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-blue-900 uppercase">
            Catalogue — {EXAM_TYPES.find((t) => t.type === activeType)?.label}
            {showSeries && activeSeries !== '__ALL__' && (
              <span className="ml-2 text-[10px] text-slate-400 normal-case font-semibold">
                série {activeSeries || 'tronc commun'}
              </span>
            )}
            <span className="ml-3 text-[10px] text-slate-400 normal-case font-semibold">
              {data?.academicYearLabel ?? ''}
            </span>
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase">
            {filtered.length} matière(s)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-[#f7f9fc]">
              <tr>
                {canManage && (
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every((s) => selected.has(s.id))}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(filtered.map((s) => s.id)) : new Set())
                      }
                      className="w-4 h-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                      title="Tout sélectionner"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Matière</th>
                {showSeries && (
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Série</th>
                )}
                <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Coefficient</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Barème</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Durée</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Épreuves</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Statut</th>
                {canManage && (
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-sm font-bold text-slate-400">
                    Chargement du catalogue…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <AppIcon name="bookOpen" size="menu" className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-500">
                      Aucune matière pour {EXAM_TYPES.find((t) => t.type === activeType)?.label}
                      {showSeries && activeSeries !== '__ALL__' ? ` — série ${activeSeries}` : ''}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {canManage
                        ? 'Ajoutez vos matières manuellement ou ouvrez les matières suggérées.'
                        : 'Aucune matière paramétrée pour ce type d\u2019examen.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const signal = subjectSignal(s);
                  return (
                    <tr key={s.id} className={cn('hover:bg-[#f7f9fc]', selected.has(s.id) && 'bg-blue-50/50')}>
                      {canManage && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(s.id)}
                            onChange={() => toggleSelected(s.id)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="inline-block bg-blue-50 border border-blue-100 text-blue-900 font-mono font-bold text-[10px] px-2.5 py-1 rounded-lg">
                          {s.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-blue-900">{s.name}</p>
                        {s.description && (
                          <p className="text-[10px] text-slate-400 max-w-xs truncate">{s.description}</p>
                        )}
                      </td>
                      {showSeries && (
                        <td className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase">
                          {s.series || 'Commun'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-black text-amber-700">
                          {String(s.coefficient).replace('.', ',')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-bold text-slate-600">
                        /{String(s.maxScore).replace('.', ',')}
                      </td>
                      <td className="px-4 py-3 text-center text-xs font-semibold text-slate-500">
                        {/* ⭐ Durée en heures dès 60 min (infobulle = minutes
                            d'origine) — s'affiche ainsi sur l'épreuve. */}
                        {s.duration ? (
                          <span
                            className="whitespace-nowrap"
                            title={catalogDurationCell(s.duration).title}
                          >
                            {catalogDurationCell(s.duration).label}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.papersCount > 0 ? (
                          <span className="inline-block bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-lg">
                            {s.papersCount} épreuve(s)
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs font-bold">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {signal.state === 'idle' ? (
                          <span className="text-[9px] font-bold text-slate-300 uppercase">Hors campagne</span>
                        ) : signal.state === 'ready' ? (
                          <span className="inline-block bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase px-2.5 py-1 rounded">
                            Épreuve prête
                          </span>
                        ) : (
                          <span className="inline-block bg-amber-100 text-amber-700 text-[9px] font-black uppercase px-2.5 py-1 rounded">
                            À préparer
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEdit(s)}
                              className="p-2 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-900 transition-colors"
                              title="Modifier"
                            >
                              <AppIcon name="edit" size="menu" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(s)}
                              className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Supprimer"
                            >
                              <AppIcon name="delete" size="menu" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ⭐ Formulaire création / édition (pattern FormModal Helm) */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-blue-950/50 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-blue-900 uppercase">
                {editingId ? 'Modifier la matière' : `Nouvelle matière — ${EXAM_TYPES.find((t) => t.type === activeType)?.label}`}
              </h3>
              <button onClick={() => setFormOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <AppIcon name="close" size="menu" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs font-semibold text-red-800">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Code *</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    disabled={!!editingId}
                    placeholder="MATH"
                    className="fed-input-light px-4 py-3 font-mono font-bold uppercase"
                  />
                </div>
                {showSeries && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                      Série / filière
                    </label>
                    <input
                      list="federis-series-suggestions"
                      value={form.series}
                      onChange={(e) => setForm({ ...form, series: e.target.value.toUpperCase() })}
                      placeholder="A1, A2, C, D…"
                      className="fed-input-light px-4 py-3 font-bold uppercase"
                    />
                    <datalist id="federis-series-suggestions">
                      {(data?.bacSeries ?? []).map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Intitulé *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Mathématiques"
                  className="fed-input-light px-4 py-3 font-semibold"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Coefficient</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.coefficient}
                    onChange={(e) => setForm({ ...form, coefficient: e.target.value })}
                    className="fed-input-light px-4 py-3 font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Barème</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.maxScore}
                    onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
                    className="fed-input-light px-4 py-3 font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Durée (min)</label>
                  <input
                    type="number"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    placeholder="120"
                    className="fed-input-light px-4 py-3 font-bold text-center"
                  />
                  {/* ⭐ Conversion en direct : au-delà de 60 min, la durée
                      s'affichera en heures sur l'épreuve (120 → 2h). */}
                  {durationInputHint(form.duration) && (
                    <p className="text-[10px] font-bold text-emerald-700 mt-1.5">
                      Soit {durationInputHint(form.duration)} sur l'épreuve
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder="Précisions éventuelles (optionnel)"
                  className="fed-input-light px-4 py-3 text-sm"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setFormOpen(false)}
                className="px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-600"
              >
                Annuler
              </button>
              <button
                onClick={submitForm}
                disabled={working}
                className="fed-btn-navy px-6 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50"
              >
                {working ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Ajouter au catalogue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ Confirmation de suppression (pattern ConfirmModal Helm — pas de window.confirm) */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-blue-950/50 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-red-700 uppercase">Confirmer la suppression</h3>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-700 leading-relaxed">
                {confirmDelete === 'MANY'
                  ? `Supprimer ${selected.size} matière(s) du catalogue ? Les épreuves liées conserveront leur intitulé, et les matières déjà attachées à un examen lancé ne sont pas touchées.`
                  : confirmDelete.papersCount > 0
                    ? `Supprimer « ${confirmDelete.name} » ? ${confirmDelete.papersCount} épreuve(s) liée(s) conserveront leur intitulé (détachées). Les matières déjà attachées à un examen lancé ne sont pas touchées.`
                    : `Supprimer « ${confirmDelete.name} » du catalogue ?`}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-600"
              >
                Annuler
              </button>
              <button
                onClick={doDelete}
                disabled={working}
                className="px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {working ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FedPage>
  );
}
