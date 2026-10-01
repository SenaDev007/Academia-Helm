/**
 * FederisSaisiePage — UI « Saisie des notes » des SECRÉTAIRES d'examen
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ 2026-10-01 — Interface dédiée des enseignants affectés au poste de
 * SECRÉTARIAT (compte provisoire PATRONAT_SAISIE_NOTES) :
 *
 *   - Le secrétaire voit SON poste (secrétariat — saisie des notes), l'examen
 *     concerné (CEP/BEPC/BAC/CAP + session + année scolaire), le CENTRE et la
 *     SALLE attribués par le patronat ;
 *   - La grille liste les CANDIDATS de son périmètre (centre + salle) × les
 *     matières de l'examen — la RÈGLE ÉPREUVE PRÉPARÉE verrouille les
 *     matières dont l'épreuve n'est pas préparée (le patronat débloque) ;
 *   - Enregistrer (brouillon) puis SOUMETTRE (verrou — le patronat suit la
 *     progression en temps réel et met au propre à la soumission).
 */

'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import AppIcon from '@/components/ui/AppIcon';
import {
  isPrimaryExam,
  CEP_CM_MAX,
  CEP_CP_MAX,
  cepNote,
  withCepDetail,
} from '@/lib/federis/grade-computations';

const PAGE_SIZE = 25;

const EXAM_TYPE_LABELS: Record<string, string> = {
  CEP: 'CEP',
  BEPC: 'BEPC',
  BAC: 'BAC',
  CAP: 'CAP',
};

interface SaisieCell {
  score: number | null;
  isAbsent: boolean;
  status?: string;
  /** ⭐ CEP — détail CM (/18) + CP (/2), note /20 = CM + CP. */
  cm?: number | null;
  cp?: number | null;
}

interface SaisieSubject {
  id: string;
  code: string;
  name: string;
  coefficient: number;
  maxScore: number;
  epreuvePrepared: boolean;
  preparedSource: 'paper' | 'manual' | null;
  /** ⭐ CEP — note minimale exigée (porte du CP) + matière étoilée. */
  passingScore?: number | null;
  perfectionnement?: boolean;
}

interface SaisieCandidate {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
  anonymatCode: string | null;
  tableNumber: string | null;
  scores: Record<string, SaisieCell>;
}

interface SaisieAssignment {
  id: string;
  assignedDate: string;
  exam: {
    id: string;
    code: string;
    name: string;
    examType: string;
    status: string;
    academicYearLabel: string | null;
  };
  center: { id: string; code: string; name: string } | null;
  room: { id: string; code: string; name: string } | null;
  scopeLabel: string | null;
  subjects: SaisieSubject[];
  candidates: SaisieCandidate[];
  progress: {
    candidates: number;
    subjectsPrepared: number;
    cellsTotal: number;
    cellsEntered: number;
    cellsSubmitted: number;
    submitted: boolean;
    lastActivityAt: string | null;
  };
}

interface SaisieMe {
  me: {
    name: string | null;
    login: string | null;
    role: string;
    functionLabel: string;
  };
  assignments: SaisieAssignment[];
}

export default function FederisSaisiePage({ userRole }: { userRole?: string | null }) {
  const [data, setData] = useState<SaisieMe | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cells, setCells] = useState<Record<string, Record<string, SaisieCell>>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  // ── Chargement de mes affectations ───────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/federis/saisie/me', { timeout: 30000 });
      const payload: SaisieMe = res.data;
      setData(payload);
      if (!activeId && payload.assignments?.length) {
        setActiveId(payload.assignments[0].id);
      }
      const next: Record<string, Record<string, SaisieCell>> = {};
      for (const a of payload.assignments ?? []) {
        // ⭐ CEP : scission des notes héritées en CM (/18) + CP (/2).
        const isCep = isPrimaryExam(a.exam?.examType);
        for (const c of a.candidates ?? []) {
          const row: Record<string, SaisieCell> = {};
          for (const [subjectId, cell] of Object.entries(c.scores ?? {})) {
            row[subjectId] = isCep ? (withCepDetail(cell) as SaisieCell) : cell;
          }
          next[c.id] = row;
        }
      }
      setCells(next);
      setDirty(new Set());
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger vos affectations de saisie.');
    } finally {
      setLoading(false);
    }
  }, [activeId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assignment = useMemo(
    () => data?.assignments?.find((a) => a.id === activeId) ?? data?.assignments?.[0] ?? null,
    [data, activeId],
  );

  const subjects = assignment?.subjects ?? [];
  const candidates = assignment?.candidates ?? [];
  const submitted = assignment?.progress.submitted ?? false;
  const examLocked = assignment?.exam.status === 'RESULTS_PUBLISHED';
  const editable = !submitted && !examLocked;

  const unpreparedSubjects = subjects.filter((s) => !s.epreuvePrepared);

  // ── Filtre + pagination ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => {
      const cellHit = subjects.some((s) => {
        const cell = cells[c.id]?.[s.id];
        return cell?.isAbsent === true || String(cell?.score ?? '').includes(q);
      });
      return (
        `${c.lastName} ${c.firstName}`.toLowerCase().includes(q) ||
        c.matricule?.toLowerCase().includes(q) ||
        (c.anonymatCode ?? '').toLowerCase().includes(q) ||
        (c.tableNumber ?? '').includes(q) ||
        cellHit
      );
    });
  }, [candidates, search, subjects, cells]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
    // ⭐ Changement d'affectation : les cellules modifiées non enregistrées
    //    sont purgées (elles ne concernent pas le même périmètre — jamais de
    //    sauvegarde croisée entre deux affectations).
    setDirty(new Set());
  }, [search, activeId]);

  // ── Édition d'une cellule ───────────────────────────────────────────────
  const setCell = (candidateId: string, subjectId: string, patch: Partial<SaisieCell>) => {
    setCells((prev) => {
      const row = { ...(prev[candidateId] ?? {}) };
      const before = row[subjectId] ?? { score: null, isAbsent: false };
      row[subjectId] = { ...before, ...patch };
      return { ...prev, [candidateId]: row };
    });
    setDirty((prev) => new Set(prev).add(`${candidateId}|${subjectId}`));
  };

  const handleScore = (candidateId: string, subject: SaisieSubject, raw: string) => {
    if (raw === '') {
      setCell(candidateId, subject.id, { score: null });
      return;
    }
    const value = Number(raw.replace(',', '.'));
    if (Number.isNaN(value)) return;
    setCell(candidateId, subject.id, {
      score: Math.max(0, Math.min(value, subject.maxScore ?? 20)),
      isAbsent: false,
    });
  };

  // ── ⭐ CEP — saisie CM (/18) + CP (/2) = note (/20) ───────────────────
  const isCepExam = isPrimaryExam(assignment?.exam?.examType);

  const handleCm = (candidateId: string, subject: SaisieSubject, raw: string) => {
    if (raw === '') {
      setCell(candidateId, subject.id, { score: null, cm: null, cp: null });
      return;
    }
    const value = Number(raw.replace(',', '.'));
    if (Number.isNaN(value)) return;
    const cm = Math.max(0, Math.min(value, CEP_CM_MAX));
    const minRequise = subject.passingScore ?? 10;
    const existingCp = cells[candidateId]?.[subject.id]?.cp ?? 0;
    const cp = cm >= minRequise ? Math.max(0, Math.min(existingCp, CEP_CP_MAX)) : 0;
    setCell(candidateId, subject.id, {
      score: Math.round((cm + cp) * 100) / 100,
      cm,
      cp,
      isAbsent: false,
    });
  };

  const handleCp = (candidateId: string, subject: SaisieSubject, raw: string) => {
    const cell = cells[candidateId]?.[subject.id];
    const cm = cell?.cm ?? null;
    const minRequise = subject.passingScore ?? 10;
    if (cm === null || cm < minRequise) return; // CP réservé aux CM ≥ min
    if (raw === '') {
      setCell(candidateId, subject.id, { cp: 0, score: cm });
      return;
    }
    const value = Number(raw.replace(',', '.'));
    if (Number.isNaN(value)) return;
    const cp = Math.max(0, Math.min(value, CEP_CP_MAX));
    setCell(candidateId, subject.id, {
      score: Math.round((cm + cp) * 100) / 100,
      cp,
      isAbsent: false,
    });
  };

  // ── Enregistrer / Soumettre ─────────────────────────────────────────────
  const save = async (): Promise<boolean> => {
    if (!assignment || dirty.size === 0) return true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const grades = [...dirty].map((key) => {
        const [candidateId, subjectId] = key.split('|');
        const cell = cells[candidateId]?.[subjectId] ?? { score: null, isAbsent: false };
        // ⭐ CEP : CM + CP transmis au backend (note /20 = somme).
        if (isCepExam && !cell.isAbsent && cell.cm != null) {
          return {
            candidateId,
            subjectId,
            cm: cell.cm,
            cp: cell.cp ?? 0,
            score: Math.round((cell.cm + (cell.cp ?? 0)) * 100) / 100,
            isAbsent: false,
          };
        }
        return {
          candidateId,
          subjectId,
          score: cell.isAbsent ? 0 : cell.score,
          isAbsent: cell.isAbsent === true,
        };
      });
      const res = await apiClient.post(
        `/federis/saisie/assignments/${assignment.id}/grades/bulk`,
        { grades },
        { timeout: 60000 },
      );
      const saved = res.data?.saved ?? 0;
      setNotice(`Notes enregistrées (${saved} saisie(s)).`);
      await load();
      return true;
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Enregistrement impossible.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!assignment) return;
    setSaving(true);
    setError(null);
    try {
      const saved = dirty.size > 0 ? await save() : true;
      if (!saved) return;
      const res = await apiClient.post(
        `/federis/saisie/assignments/${assignment.id}/submit`,
        {},
        { timeout: 60000 },
      );
      setNotice(
        `Saisie soumise (${res.data?.submitted ?? 0} note(s)) — le patronat a été notifié et met au propre vos saisies.`,
      );
      setConfirmSubmit(false);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Soumission impossible.');
    } finally {
      setSaving(false);
    }
  };

  // ── Rendu ───────────────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="fed-card px-6 py-10 text-center text-sm font-bold text-slate-400">
        Chargement de votre espace de saisie…
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Bandeau identité (compte provisoire) ─────────────────────────── */}
      <div className="fed-card px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center">
              <AppIcon name="grades" size="submenu" className="text-teal-700" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-blue-900 uppercase">
                Saisie des notes — Secrétariat
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {data?.me?.name ? `${data.me.name} · ` : ''}
                Compte provisoire — {data?.me?.functionLabel ?? 'Secrétaire de saisie'}
              </p>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Connexion : {data?.me?.login ?? '—'}
          </div>
        </div>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* ── Aucune affectation ───────────────────────────────────────────── */}
      {!assignment ? (
        <div className="fed-card px-8 py-14 text-center">
          <AppIcon name="grades" size="menu" className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700 mt-3">Aucune affectation de saisie pour le moment</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Votre patronat vous affectera à un centre (et éventuellement une salle) pour la saisie
            des notes d&apos;un examen — votre interface se remplira automatiquement.
          </p>
        </div>
      ) : (
        <>
          {/* ── Sélecteur d'affectation (plusieurs examens/centres) ──────── */}
          {(data?.assignments?.length ?? 0) > 1 && (
            <div className="flex flex-wrap gap-2">
              {data!.assignments.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setActiveId(a.id)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-bold border transition-all',
                    a.id === assignment.id
                      ? 'bg-blue-900 text-white border-blue-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-900/40',
                  )}
                >
                  {EXAM_TYPE_LABELS[a.exam.examType] ?? a.exam.examType} · {a.center?.code ?? '—'}
                  {a.room ? ` · ${a.room.code}` : ''}
                </button>
              ))}
            </div>
          )}

          {/* ── Carte examen / périmètre ─────────────────────────────────── */}
          <div className="fed-card p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-900 text-white text-[10px] font-bold uppercase">
                    {EXAM_TYPE_LABELS[assignment.exam.examType] ?? assignment.exam.examType}
                  </span>
                  <span className="text-sm font-bold text-blue-900">{assignment.exam.name}</span>
                  {assignment.exam.academicYearLabel && (
                    <span className="text-[11px] text-slate-400 font-semibold">
                      · Session {assignment.exam.academicYearLabel}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <AppIcon name="classes" size="submenu" className="text-slate-400" />
                    <span className="font-bold text-slate-700">{assignment.scopeLabel ?? 'Périmètre non défini'}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <AppIcon name="scolarite" size="submenu" className="text-slate-400" />
                    {assignment.progress.candidates} candidat(s) à saisir
                  </span>
                </div>
              </div>

              {/* Progression */}
              <div className="flex-shrink-0 w-full lg:w-72">
                <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
                  <span className="text-slate-500 uppercase">Progression</span>
                  <span className="text-blue-900">
                    {assignment.progress.cellsEntered}/{assignment.progress.cellsTotal} notes
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      submitted ? 'bg-emerald-500' : 'bg-blue-900',
                    )}
                    style={{
                      width: `${
                        assignment.progress.cellsTotal > 0
                          ? Math.min(100, Math.round((assignment.progress.cellsEntered / assignment.progress.cellsTotal) * 100))
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-semibold mt-1.5">
                  {submitted
                    ? 'Saisie soumise — verrouillée (réouverture par le patronat)'
                    : examLocked
                      ? 'Résultats publiés — saisie verrouillée'
                      : `${assignment.progress.subjectsPrepared} matière(s) ouverte(s) à la saisie`}
                </p>
              </div>
            </div>

            {/* ⭐ Règle épreuve préparée — matières verrouillées */}
            {unpreparedSubjects.length > 0 && (
              <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
                <p className="text-xs font-bold text-amber-800 flex items-center gap-2">
                  <AppIcon name="warning" size="submenu" />
                  {unpreparedSubjects.length} matière(s) verrouillée(s) — épreuve non préparée
                </p>
                <p className="text-[11px] text-amber-700 mt-1">
                  {unpreparedSubjects.map((s) => s.name).join(', ')} — le patronat doit préparer
                  l&apos;épreuve (ou la marquer « déjà préparée ») pour ouvrir la saisie de ces matières.
                </p>
              </div>
            )}
          </div>

          {/* ── Barre d'actions ──────────────────────────────────────────── */}
          <div className="fed-card px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un candidat (nom, matricule, n° de table, anonymat)…"
              className="fed-input-light px-4 py-2.5 text-sm flex-1"
            />
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !editable || dirty.size === 0}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-white border border-blue-900/20 text-blue-900 hover:bg-blue-50 disabled:opacity-40"
              >
                {saving ? 'Enregistrement…' : `Enregistrer${dirty.size > 0 ? ` (${dirty.size})` : ''}`}
              </button>
              {submitted ? (
                <span className="px-4 py-2.5 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl">
                  Soumis ✓
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmSubmit(true)}
                  disabled={saving || !editable || assignment.progress.cellsEntered === 0}
                  className="fed-btn-gold px-5 py-2.5 text-xs disabled:opacity-40"
                >
                  Soumettre la saisie
                </button>
              )}
            </div>
          </div>

          {/* ── Grille candidats × matières ──────────────────────────────── */}
          <div className="fed-card p-0 overflow-hidden">
            {subjects.length === 0 || candidates.length === 0 ? (
              <div className="px-8 py-12 text-center">
                <p className="text-sm font-bold text-slate-700">
                  {candidates.length === 0
                    ? 'Aucun candidat dans votre périmètre'
                    : 'Aucune matière pour cet examen'}
                </p>
                <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
                  {candidates.length === 0
                    ? 'Aucun candidat n\'est rattaché au centre / à la salle qui vous a été attribué(e).'
                    : 'Le patronat n\'a pas encore défini les matières de cet examen.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-[#f7f9fc]">
                    <tr className="text-left">
                      <th rowSpan={isCepExam ? 2 : 1} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase sticky left-0 bg-[#f7f9fc] z-10">
                        Candidat
                      </th>
                      {subjects.map((s) => (
                        <th key={s.id} colSpan={isCepExam ? 3 : 1} className="px-3 py-3 text-center min-w-[110px]">
                          <div
                            className={cn(
                              'text-[11px] font-bold',
                              s.epreuvePrepared ? 'text-slate-600' : 'text-amber-700',
                            )}
                            title={
                              s.epreuvePrepared
                                ? s.preparedSource === 'manual'
                                  ? 'Épreuve marquée « déjà préparée » par le patronat'
                                  : 'Épreuve préparée dans le module Épreuves et documents'
                                : 'Épreuve non préparée — saisie verrouillée'
                            }
                          >
                            {s.name}
                            {s.perfectionnement && isCepExam ? ' *' : ''}
                            {!s.epreuvePrepared && ' 🔒'}
                          </div>
                          <div className="text-[9px] text-slate-400 font-semibold mt-0.5">
                            {isCepExam
                              ? `min. ${String(s.passingScore ?? 10).replace('.', ',')}`
                              : `/${s.maxScore ?? 20}${s.coefficient && s.coefficient !== 1 ? ` · coef ${s.coefficient}` : ''}`}
                          </div>
                        </th>
                      ))}
                    </tr>
                    {isCepExam && (
                      <tr className="bg-[#f0f4fa]">
                        {subjects.flatMap((s) => [
                          <th key={`${s.id}-cm`} className="px-1 py-1 text-center text-[9px] font-bold text-blue-900">CM /18</th>,
                          <th key={`${s.id}-cp`} className="px-1 py-1 text-center text-[9px] font-bold text-amber-700">CP /2</th>,
                          <th key={`${s.id}-note`} className="px-1 py-1 text-center text-[9px] font-bold text-emerald-700">Note /20</th>,
                        ])}
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {pageRows.map((c) => (
                      <tr key={c.id} className="hover:bg-[#f7f9fc]">
                        <td className="px-4 py-2.5 sticky left-0 bg-white z-10 min-w-[200px]">
                          <div className="text-xs font-bold text-blue-900">
                            {c.lastName} {c.firstName}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {[
                              c.tableNumber ? `Table ${c.tableNumber}` : null,
                              c.anonymatCode,
                              c.matricule,
                            ]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </div>
                        </td>
                        {subjects.map((s) => {
                          const cell = cells[c.id]?.[s.id];
                          const locked = !s.epreuvePrepared || !editable;

                          // ── CEP : CM (/18) + CP (/2) = Note (/20) ──
                          if (isCepExam) {
                            const absent = cell?.isAbsent === true;
                            const minRequise = s.passingScore ?? 10;
                            const cm = absent ? null : cell?.cm ?? null;
                            const cp = absent ? null : cell?.cp ?? null;
                            const note = cepNote(cell);
                            const cpEnabled = !absent && !locked && cm !== null && cm >= minRequise;
                            return (
                              <Fragment key={s.id}>
                                <td className={cn('px-1.5 py-2.5 text-center', absent && 'bg-red-50/60')}>
                                  <input
                                    value={cm ?? ''}
                                    onChange={(e) => handleCm(c.id, s, e.target.value)}
                                    disabled={locked || absent}
                                    inputMode="decimal"
                                    placeholder="—"
                                    className={cn(
                                      'w-12 px-1 py-1.5 text-center text-sm font-bold rounded-lg border transition-colors',
                                      locked
                                        ? 'bg-amber-50/60 border-amber-100 text-slate-300 cursor-not-allowed'
                                        : 'bg-white border-slate-200 text-blue-900 focus:border-blue-600 focus:outline-none',
                                      cm != null && !locked && (cm >= minRequise ? ' text-blue-900' : ' text-slate-800'),
                                    )}
                                    title={locked ? 'Matière verrouillée (épreuve non préparée ou saisie soumise)' : `${s.name} — CM sur 18`}
                                  />
                                </td>
                                <td className={cn('px-1.5 py-2.5 text-center', absent && 'bg-red-50/60')}>
                                  <input
                                    value={cp ?? ''}
                                    onChange={(e) => handleCp(c.id, s, e.target.value)}
                                    disabled={!cpEnabled}
                                    inputMode="decimal"
                                    placeholder="—"
                                    className={cn(
                                      'w-12 px-1 py-1.5 text-center text-sm font-bold rounded-lg border transition-colors',
                                      cpEnabled
                                        ? 'bg-amber-50/70 border-amber-200 text-amber-800 focus:border-amber-500 focus:outline-none'
                                        : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed',
                                    )}
                                    title={
                                      cpEnabled
                                        ? `${s.name} — CP sur 2 (perfectionnement${s.perfectionnement ? ' — matière étoilée ★' : ''})`
                                        : `CP réservé aux CM ≥ ${String(minRequise).replace('.', ',')}/18`
                                    }
                                  />
                                </td>
                                <td className={cn('px-1.5 py-2.5 text-center', absent && 'bg-red-50/60')}>
                                  <div className="flex items-center justify-center gap-1">
                                    <span
                                      className={cn(
                                        'inline-block min-w-[2.4rem] text-center text-sm font-black px-1.5 py-1.5 rounded-lg',
                                        absent
                                          ? 'bg-red-50 text-red-500 text-[10px]'
                                          : note != null
                                            ? note >= 10
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : 'bg-red-100 text-red-700'
                                            : 'bg-slate-50 text-slate-300',
                                      )}
                                    >
                                      {absent ? 'ABS' : note != null ? String(note).replace('.', ',') : '—'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setCell(c.id, s.id, {
                                          isAbsent: !(cell?.isAbsent ?? false),
                                          score: !(cell?.isAbsent ?? false) ? 0 : null,
                                          cm: !(cell?.isAbsent ?? false) ? 0 : null,
                                          cp: !(cell?.isAbsent ?? false) ? 0 : null,
                                        })
                                      }
                                      disabled={locked}
                                      className={cn(
                                        'px-1.5 py-1 rounded text-[9px] font-bold border transition-colors',
                                        cell?.isAbsent
                                          ? 'bg-red-50 border-red-200 text-red-700'
                                          : 'bg-white border-slate-200 text-slate-400 hover:text-red-600',
                                        locked && 'opacity-30 cursor-not-allowed',
                                      )}
                                      title="Marquer absent (exclu des calculs)"
                                    >
                                      ABS
                                    </button>
                                  </div>
                                </td>
                              </Fragment>
                            );
                          }

                          // ── BEPC / BAC / CAP : note /20 unique ──
                          return (
                            <td key={s.id} className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  value={cell?.isAbsent ? '' : (cell?.score ?? '')}
                                  onChange={(e) => handleScore(c.id, s, e.target.value)}
                                  disabled={locked || cell?.isAbsent === true}
                                  inputMode="decimal"
                                  placeholder="—"
                                  className={cn(
                                    'w-16 px-2 py-1.5 text-center text-sm font-bold rounded-lg border transition-colors',
                                    locked
                                      ? 'bg-amber-50/60 border-amber-100 text-slate-300 cursor-not-allowed'
                                      : 'bg-white border-slate-200 text-blue-900 focus:border-blue-600 focus:outline-none',
                                    cell?.score != null &&
                                      !locked &&
                                      (cell.score >= 10
                                        ? ' text-emerald-700'
                                        : ' text-red-600'),
                                  )}
                                  title={
                                    locked
                                      ? 'Matière verrouillée (épreuve non préparée ou saisie soumise)'
                                      : undefined
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCell(c.id, s.id, {
                                      isAbsent: !(cell?.isAbsent ?? false),
                                      score: !(cell?.isAbsent ?? false) ? 0 : null,
                                    })
                                  }
                                  disabled={locked}
                                  className={cn(
                                    'px-1.5 py-1 rounded text-[9px] font-bold border transition-colors',
                                    cell?.isAbsent
                                      ? 'bg-red-50 border-red-200 text-red-700'
                                      : 'bg-white border-slate-200 text-slate-400 hover:text-red-600',
                                    locked && 'opacity-30 cursor-not-allowed',
                                  )}
                                  title="Marquer absent (exclu des calculs)"
                                >
                                  ABS
                                </button>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(filtered.length > PAGE_SIZE) && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400 font-semibold">
                  {filtered.length} candidat(s) · page {safePage + 1}/{totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="px-3 py-1.5 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage >= totalPages - 1}
                    className="px-3 py-1.5 text-[10px] font-bold rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Confirmation de soumission ───────────────────────────────────── */}
      {confirmSubmit && assignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-blue-900 uppercase">Soumettre la saisie ?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Vous allez soumettre les notes saisies pour les{' '}
              <b>{assignment.progress.candidates} candidats</b> de votre périmètre
              ({assignment.scopeLabel}). Après soumission, vos saisies sont verrouillées et mises
              au propre par le patronat — toute correction exigera une réouverture par le patronat.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSubmit(false)}
                className="px-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 text-slate-600"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving}
                className="fed-btn-gold px-5 py-2.5 text-xs disabled:opacity-40"
              >
                {saving ? 'Soumission…' : 'Confirmer la soumission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
