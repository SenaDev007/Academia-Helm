/**
 * FederisGradeSheetTab — Saisie des notes (module Notes et Moyennes, Federis)
 *
 * Reproduction du GradingSheet d'Academia Helm, adaptée aux examens nationaux :
 *   - CEP          → tableau du PRIMAIRE : une note /20 par épreuve, SANS
 *                    coefficient (total, moyenne simple, seuil 10/20) ;
 *   - BEPC/BAC/CAP → tableau du SECONDAIRE AVEC COEFFICIENTS : note × coef,
 *                    total des coefficients, total des notes coefficient,
 *                    moyenne pondérée Σ(note×coef)/Σ(coef).
 *
 * Fonctionnalités (pattern Helm) :
 *   - Grille candidats × matières avec calculs LIVE (moyennes, rangs denses) ;
 *   - Mode ANONYME : les noms sont masqués, seuls les codes d'anonymat
 *     s'affichent (post-composition — les correcteurs ne voient pas les
 *     identités) ;
 *   - Marquage ABS par épreuve (exclu des calculs) ;
 *   - Verrous : résultats publiés / session soumise (réouverture possible) ;
 *   - Recherche + pagination, statistiques de remplissage.
 */

'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import {
  type GSubject,
  type GCandidateRow,
  type GCell,
  computeTotals,
  denseRanks,
  appreciationFor,
  candidateDisplayName,
  isPrimaryExam,
  CEP_CM_MAX,
  CEP_CP_MAX,
  cepNote,
  withCepDetail,
} from '@/lib/federis/grade-computations';

const PAGE_SIZE = 25;

interface SheetData {
  exam: { id: string; code: string; name: string; examType: string; level: string; isPrimary: boolean };
  /** ⭐ Règles de calcul effectives (Paramètres) — seuils + modèle de calcul. */
  rules?: {
    passMark: number;
    rescueMark: number;
    averageModel: 'simple' | 'ponderee';
    isCustom: boolean;
    averageModelCustom?: boolean;
  } | null;
  subjects: GSubject[];
  session: { draftCount: number; submittedCount: number; allSubmitted: boolean; locked: boolean; editable: boolean };
  filling: { gradedCells: number; totalCells: number; absentCells: number; fullyGraded: number };
  candidates: GCandidateRow[];
}

export default function FederisGradeSheetTab({
  examId,
  canWrite,
  subjectsVersion,
  onManageSubjects,
}: {
  examId: string;
  canWrite: boolean;
  subjectsVersion: number;
  onManageSubjects: () => void;
}) {
  const [data, setData] = useState<SheetData | null>(null);
  const [cells, setCells] = useState<Record<string, Record<string, GCell>>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  // ⭐ 2026-10-01 — Règle épreuve préparée : marquage manuel en cours
  const [markingSubjectId, setMarkingSubjectId] = useState<string | null>(null);

  // ── Chargement de la grille ─────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/federis/exams/${examId}/grades/sheet`, { timeout: 30000 });
      const sheet: SheetData = res.data;
      setData(sheet);
      const isCep = isPrimaryExam(sheet.exam?.examType);
      const next: Record<string, Record<string, GCell>> = {};
      for (const c of sheet.candidates ?? []) {
        const row: Record<string, GCell> = {};
        for (const [subjectId, cell] of Object.entries(c.scores ?? {})) {
          // ⭐ CEP : scission des notes héritées en CM (/18) + CP (/2).
          row[subjectId] = isCep ? withCepDetail(cell) : cell;
        }
        next[c.id] = row;
      }
      setCells(next);
      setDirty(new Set());
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger la grille de saisie.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load, subjectsVersion]);

  const isPrimary = data?.exam.isPrimary ?? false;
  // ⭐ Modèle de calcul EFFECTIF (règles de calcul — source de vérité si
  //    personnalisée, sinon défaut backend : CEP simple, autres pondérée).
  //    Indépendant du template d'affichage (isPrimary).
  const useSimpleAverage = data?.rules?.averageModel
    ? data.rules.averageModel === 'simple'
    : isPrimary;
  const passMark = data?.rules?.passMark ?? 10;
  const subjects = data?.subjects ?? [];
  const candidates = data?.candidates ?? [];
  const editable = canWrite && (data?.session.editable ?? false);

  // ── Calculs LIVE (tous les candidats → rangs globaux corrects) ──────────
  const computedAll = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeTotals>>();
    for (const c of candidates) {
      map.set(c.id, computeTotals(cells[c.id] ?? {}, subjects, useSimpleAverage));
    }
    const ranks = denseRanks(
      candidates.map((c) => ({ id: c.id, value: map.get(c.id)?.finalAverage ?? null })),
    );
    return { map, ranks };
  }, [candidates, cells, subjects, useSimpleAverage]);

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
        (c.school ?? '').toLowerCase().includes(q) ||
        cellHit
      );
    });
  }, [candidates, search, subjects, cells]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [search, examId]);

  // ── Édition d'une cellule ───────────────────────────────────────────────
  const setCell = (candidateId: string, subjectId: string, patch: Partial<GCell>) => {
    setCells((prev) => {
      const row = { ...(prev[candidateId] ?? {}) };
      const before = row[subjectId] ?? { score: null, isAbsent: false };
      row[subjectId] = { ...before, ...patch };
      return { ...prev, [candidateId]: row };
    });
    setDirty((prev) => new Set(prev).add(`${candidateId}|${subjectId}`));
  };

  const handleScore = (candidateId: string, subject: GSubject, raw: string) => {
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
  // Même règle que le module Examen Helm (primaire) : le CP (perfectionnement)
  // n'est saisissable que si le CM atteint la note minimale exigée.
  const handleCm = (candidateId: string, subject: GSubject, raw: string) => {
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

  const handleCp = (candidateId: string, subject: GSubject, raw: string) => {
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

  const toggleAbsent = (candidateId: string, subjectId: string, current: GCell | undefined) => {
    setCell(candidateId, subjectId, { isAbsent: !(current?.isAbsent ?? false) });
  };

  // ── Enregistrement des cellules modifiées ───────────────────────────────
  const save = async (): Promise<boolean> => {
    if (dirty.size === 0) return true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const grades = [...dirty].map((key) => {
        const [candidateId, subjectId] = key.split('|');
        const cell = cells[candidateId]?.[subjectId] ?? { score: null, isAbsent: false };
        // ⭐ CEP : CM + CP transmis au backend (note /20 = somme).
        if (isPrimary && !cell.isAbsent && cell.cm != null) {
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
      const res = await apiClient.post(`/federis/exams/${examId}/grades/bulk`, { grades }, { timeout: 60000 });
      setNotice(res.data?.message ?? 'Notes enregistrées.');
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
    setSaving(true);
    setError(null);
    try {
      // Sauvegarde des modifications en attente avant soumission — si elle
      // échoue, la soumission est abandonnée (jamais de demi-état).
      const saved = dirty.size > 0 ? await save() : true;
      if (!saved) return;
      const res = await apiClient.post(`/federis/exams/${examId}/grades/submit`, {}, { timeout: 60000 });
      setNotice(res.data?.message ?? 'Saisie soumise.');
      setConfirmSubmit(false);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Soumission impossible.');
    } finally {
      setSaving(false);
    }
  };

  const reopen = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.post(`/federis/exams/${examId}/grades/reopen`, {}, { timeout: 60000 });
      setNotice(res.data?.message ?? 'Session rouverte.');
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Réouverture impossible.');
    } finally {
      setSaving(false);
    }
  };

  // ── ⭐ RÈGLE ÉPREUVE PRÉPARÉE — marquage manuel ──────────────────────
  // L'épreuve a été produite hors application (traitement de texte, ronéo) :
  // le patronat la marque « déjà préparée » pour débloquer la saisie.
  const markPrepared = async (subjectId: string, unmark = false) => {
    setMarkingSubjectId(subjectId);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post(
        `/federis/exams/${examId}/subjects/${subjectId}/${unmark ? 'unmark-prepared' : 'mark-prepared'}`,
        {},
        { timeout: 20000 },
      );
      setNotice(
        unmark
          ? `Marquage retiré — ${res.data?.name ?? 'matière'}${res.data?.epreuvePrepared ? ' (épreuve toujours présente dans le module)' : ''}.`
          : `« ${res.data?.name ?? 'Matière'} » marquée comme déjà préparée — la saisie des notes est débloquée.`,
      );
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Action impossible.');
    } finally {
      setMarkingSubjectId(null);
    }
  };

  // ── Rendu ───────────────────────────────────────────────────────────────
  if (loading && !data) {
    return <div className="fed-card px-6 py-10 text-center text-sm font-bold text-slate-400">Chargement de la grille…</div>;
  }
  if (error && !data) {
    return <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">{error}</div>;
  }
  if (!data) return null;

  if (subjects.length === 0) {
    return (
      <div className="fed-card px-8 py-14 text-center">
        <p className="text-sm font-bold text-slate-700">Aucune matière pour cet examen</p>
        <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
          Définissez d&apos;abord les épreuves (matières, coefficients, barèmes) — initialisez le jeu
          officiel du type d&apos;examen ou ajoutez vos matières manuellement.
        </p>
        {canWrite && (
          <button onClick={onManageSubjects} className="fed-btn-navy mt-5 px-6 py-3 text-[10px] font-bold uppercase">
            Gérer les matières et coefficients
          </button>
        )}
      </div>
    );
  }

  const step = isPrimary ? 0.5 : 0.25;
  const fillPct = data.filling.totalCells > 0
    ? Math.round((data.filling.gradedCells / data.filling.totalCells) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Bannière modèle (primaire / secondaire) */}
      <div className="fed-card px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Modèle de saisie</p>
          <p className="text-sm font-bold text-blue-900 mt-0.5">
            {isPrimary
              ? 'Tableau du primaire — CM /18 + CP /2 (perfectionnement) = note /20, sans coefficient (CEP)'
              : 'Tableau du secondaire — notes /20 avec coefficients (BEPC / BAC / CAP)'}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            {useSimpleAverage
              ? `Moyenne retenue = SIMPLE : Σ notes / nb matières évaluées · Seuil d'admission : ${String(passMark).replace('.', ',')}/20`
              : `Moyenne retenue = PONDÉRÉE : Σ(Note × Coefficient) / Σ(Coefficients) · Seuil d'admission : ${String(passMark).replace('.', ',')}/20 · Les absents sont exclus`}
            {data?.rules?.averageModelCustom ? ' · modèle personnalisé (Paramètres → Règles de calcul)' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-[#f7f9fc] border border-blue-100 rounded-xl px-4 py-2 text-center">
            <p className="text-lg font-bold text-blue-900">{fillPct}%</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Remplissage</p>
          </div>
          <div className="bg-[#f7f9fc] border border-blue-100 rounded-xl px-4 py-2 text-center">
            <p className="text-lg font-bold text-blue-900">{data.filling.gradedCells}/{data.filling.totalCells}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase">Notes saisies</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 text-center">
            <p className="text-lg font-bold text-amber-700">{data.filling.absentCells}</p>
            <p className="text-[9px] font-bold text-amber-600 uppercase">Absents</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2 text-center">
            <p className="text-lg font-bold text-emerald-700">{data.filling.fullyGraded}</p>
            <p className="text-[9px] font-bold text-emerald-600 uppercase">Dossiers complets</p>
          </div>
        </div>
      </div>

      {/* Verrous */}
      {data.session.locked && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
          Résultats publiés — la saisie des notes est définitivement verrouillée (lecture seule).
        </div>
      )}
      {!data.session.locked && data.session.allSubmitted && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm font-semibold text-amber-800">
            Saisie soumise ({data.session.submittedCount} notes verrouillées) — modifiable après réouverture.
          </p>
          {canWrite && (
            <button onClick={reopen} disabled={saving} className="fed-btn-gold px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50">
              Rouvrir la saisie
            </button>
          )}
        </div>
      )}

      {/* ⭐ RÈGLE ÉPREUVE PRÉPARÉE — matières verrouillées + marquage */}
      {(() => {
        const unprepared = subjects.filter((s) => !s.epreuvePrepared);
        const manual = subjects.filter((s) => s.epreuvePrepared && s.preparedSource === 'manual');
        if (unprepared.length === 0 && manual.length === 0) return null;
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 space-y-3">
            {unprepared.length > 0 && (
              <div>
                <p className="text-xs font-bold text-amber-900">
                  Règle « épreuve préparée » — la saisie est verrouillée pour {unprepared.length} matière(s) :
                </p>
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {unprepared.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 bg-white border border-amber-200 rounded-xl pl-3 pr-1.5 py-1.5"
                      title="Préparez l'épreuve dans le module Épreuves et documents, ou marquez-la comme déjà préparée (épreuve produite hors application) pour débloquer la saisie."
                    >
                      <span className="text-[11px] font-bold text-amber-800">🔒 {s.name}</span>
                      {canWrite ? (
                        <button
                          onClick={() => void markPrepared(s.id)}
                          disabled={markingSubjectId !== null}
                          className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                          {markingSubjectId === s.id ? '…' : 'Marquer comme déjà préparée'}
                        </button>
                      ) : (
                        <span className="text-[9px] font-semibold text-amber-600">épreuve non préparée</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {manual.length > 0 && canWrite && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold text-amber-700">
                  Marquées « déjà préparées » (hors application) :
                </span>
                {manual.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => void markPrepared(s.id, true)}
                    disabled={markingSubjectId !== null}
                    className="px-2.5 py-1 rounded-lg text-[9px] font-bold bg-white border border-amber-200 text-amber-700 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                    title="Retirer le marquage manuel"
                  >
                    {s.name} ✕
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Barre d'actions */}
      <div className="fed-card px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (nom, matricule, anonymat, n° de table, école, note…)"
          className="fed-input-light px-5 py-2.5 text-xs font-bold flex-1 min-w-[220px]"
        />
        <button
          onClick={() => setAnonymous((v) => !v)}
          className={cn(
            'px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase border transition-all',
            anonymous
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400 hover:text-amber-700',
          )}
          title="Masquer les identités — saisie par code d'anonymat (post-composition)"
        >
          {anonymous ? 'Mode anonyme actif' : 'Mode anonyme'}
        </button>
        {canWrite && editable && (
          <>
            <button
              onClick={save}
              disabled={saving || dirty.size === 0}
              className="fed-btn-navy px-6 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : dirty.size > 0 ? `Enregistrer (${dirty.size})` : 'Enregistrer'}
            </button>
            <button
              onClick={() => setConfirmSubmit(true)}
              disabled={saving || data.filling.gradedCells === 0}
              className="fed-btn-gold px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50"
              title="Verrouiller la saisie jusqu'à réouverture"
            >
              Soumettre la saisie
            </button>
          </>
        )}
      </div>

      {/* Confirmation de soumission (inline — pas de window.confirm) */}
      {confirmSubmit && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-6 py-5 space-y-3">
          <p className="text-sm font-bold text-amber-900">Soumettre la saisie des notes ?</p>
          <p className="text-xs text-amber-800 leading-relaxed">
            Toutes les notes enregistrées seront verrouillées (statut SOUMIS). Toute modification
            exigera une réouverture de la session. Les résultats déjà publiés ne peuvent plus être modifiés.
          </p>
          <div className="flex gap-2">
            <button onClick={submit} disabled={saving} className="fed-btn-gold px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50">
              {saving ? 'Soumission…' : 'Confirmer la soumission'}
            </button>
            <button onClick={() => setConfirmSubmit(false)} className="px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-600">
              Annuler
            </button>
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">{error}</div>}
      {notice && <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 text-sm font-semibold text-emerald-800">{notice}</div>}

      {/* Grille de saisie */}
      <div className="fed-card overflow-hidden">
        <div className="p-6 border-b border-blue-50 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-sm font-bold text-blue-900 uppercase">
            Saisie des notes — {data.exam.code}
            <span className="ml-3 text-[10px] text-slate-400 normal-case font-semibold">
              {candidates.length} candidat(s) × {subjects.length} matière(s)
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-600 disabled:opacity-40"
            >
              Précédent
            </button>
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              Page {safePage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-600 disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-[#f7f9fc]">
              <tr>
                <th rowSpan={isPrimary ? 2 : 1} className="px-3 py-3 text-left text-[9px] font-bold text-slate-400 uppercase sticky left-0 bg-[#f7f9fc] z-10 min-w-[200px]">Candidat</th>
                <th rowSpan={isPrimary ? 2 : 1} className="px-2 py-3 text-center text-[9px] font-bold text-slate-400 uppercase">Sexe</th>
                <th rowSpan={isPrimary ? 2 : 1} className="px-2 py-3 text-left text-[9px] font-bold text-slate-400 uppercase min-w-[130px]">École de provenance</th>
                <th rowSpan={isPrimary ? 2 : 1} className="px-2 py-3 text-center text-[9px] font-bold text-slate-400 uppercase min-w-[90px]">Centre · Salle · Table</th>
                {subjects.map((s) => (
                  <th
                    key={s.id}
                    colSpan={isPrimary ? 3 : 1}
                    className={cn(
                      'px-2 py-3 text-center border-l border-slate-200',
                      !s.epreuvePrepared && 'bg-amber-50/70',
                    )}
                  >
                    <div
                      className={cn(
                        'text-[9px] font-bold uppercase leading-tight max-w-[110px]',
                        s.epreuvePrepared ? 'text-blue-900' : 'text-amber-700',
                      )}
                      title={
                        s.epreuvePrepared
                          ? s.preparedSource === 'manual'
                            ? `${s.name} — épreuve marquée « déjà préparée » (hors application)`
                            : `${s.name} — épreuve préparée (module Épreuves et documents)`
                          : `${s.name} — épreuve NON préparée : saisie verrouillée (voir le bandeau ci-dessus)`
                      }
                    >
                      {s.code}
                      {s.perfectionnement ? ' *' : ''}
                      {!s.epreuvePrepared && ' 🔒'}
                    </div>
                    <div className="text-[8px] font-semibold text-slate-400">
                      {isPrimary ? (
                        <span>min. {String(s.passingScore ?? 10).replace('.', ',')}</span>
                      ) : (
                        <>
                          /{s.maxScore}
                          <span className="text-amber-600"> · coef {s.coefficient}</span>
                        </>
                      )}
                    </div>
                  </th>
                ))}
                <th rowSpan={isPrimary ? 2 : 1} className="px-2 py-3 text-center text-[9px] font-bold text-slate-400 uppercase border-l-2 border-slate-200">Total</th>
                {!isPrimary && (
                  <>
                    <th className="px-2 py-3 text-center text-[9px] font-bold text-slate-400 uppercase">Σ coef</th>
                    <th className="px-2 py-3 text-center text-[9px] font-bold text-slate-400 uppercase">Σ note×coef</th>
                  </>
                )}
                <th rowSpan={isPrimary ? 2 : 1} className="px-2 py-3 text-center text-[9px] font-bold text-blue-900 uppercase">Moyenne</th>
                <th rowSpan={isPrimary ? 2 : 1} className="px-2 py-3 text-center text-[9px] font-bold text-slate-400 uppercase">Rang</th>
                <th rowSpan={isPrimary ? 2 : 1} className="px-2 py-3 text-center text-[9px] font-bold text-slate-400 uppercase min-w-[80px]">
                  {isPrimary ? `Seuil ${String(passMark).replace('.', ',')}/20` : 'Appréciation'}
                </th>
              </tr>
              {isPrimary && (
                <tr className="bg-[#f0f4fa]">
                  {subjects.flatMap((s) => [
                    <th key={`${s.id}-cm`} className="px-1 py-1 text-center text-[8px] font-bold text-blue-900 border-l border-slate-200">CM<br />/18</th>,
                    <th key={`${s.id}-cp`} className="px-1 py-1 text-center text-[8px] font-bold text-amber-700">CP<br />/2</th>,
                    <th key={`${s.id}-note`} className="px-1 py-1 text-center text-[8px] font-bold text-emerald-700">Note<br />/20</th>,
                  ])}
                </tr>
              )}
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={(isPrimary ? subjects.length * 3 + 9 : subjects.length + 11)} className="px-6 py-10 text-center text-sm font-bold text-slate-400">
                    Aucun candidat ne correspond à la recherche.
                  </td>
                </tr>
              ) : (
                pageRows.map((c, idx) => {
                  const comp = computedAll.map.get(c.id);
                  const names = candidateDisplayName(c, anonymous);
                  const rank = computedAll.ranks.get(c.id) ?? null;
                  return (
                    <tr key={c.id} className={cn('hover:bg-[#f7f9fc]', idx % 2 === 1 && 'bg-slate-50/40')}>
                      <td className="px-3 py-2 sticky left-0 bg-inherit z-10">
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-[9px] font-bold text-slate-300">{safePage * PAGE_SIZE + idx + 1}</span>
                          <div>
                            <div className={cn('text-xs font-bold', anonymous ? 'font-mono text-amber-700' : 'text-blue-900')}>{names.main}</div>
                            <div className="text-[8px] font-bold text-slate-400 uppercase">{names.sub}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center text-[10px] font-bold text-slate-500">
                        {c.gender === 'FEMALE' || c.gender === 'F' ? 'F' : c.gender === 'MALE' || c.gender === 'M' ? 'M' : '—'}
                      </td>
                      <td className="px-2 py-2 text-[10px] font-semibold text-slate-600 max-w-[130px] truncate" title={c.school}>{c.school}</td>
                      <td className="px-2 py-2 text-center text-[9px] font-bold text-slate-500 whitespace-nowrap">
                        {c.centerCode ?? '—'} · {c.roomCode ?? '—'} · {c.tableNumber ?? '—'}
                      </td>
                      {subjects.map((s) => {
                        const cell = cells[c.id]?.[s.id];
                        const absent = cell?.isAbsent === true;
                        // ⭐ Règle épreuve préparée : matière verrouillée
                        const subjectLocked = !s.epreuvePrepared;
                        const minRequise = s.passingScore ?? 10;

                        // ── CEP : CM (/18) + CP (/2) = Note (/20) ──
                        if (isPrimary) {
                          const cm = absent ? null : cell?.cm ?? null;
                          const cp = absent ? null : cell?.cp ?? null;
                          const note = cepNote(cell);
                          const cpEnabled = !absent && !subjectLocked && cm !== null && cm >= minRequise;
                          return (
                            <Fragment key={s.id}>
                              <td
                                key={`${s.id}-cm`}
                                className={cn(
                                  'px-1 py-1.5 border-l border-slate-100',
                                  absent && 'bg-red-50/60',
                                  subjectLocked && !absent && 'bg-amber-50/40',
                                )}
                              >
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step={0.25}
                                  min={0}
                                  max={CEP_CM_MAX}
                                  disabled={!editable || absent || subjectLocked}
                                  value={cm ?? ''}
                                  onChange={(e) => handleCm(c.id, s, e.target.value)}
                                  placeholder="—"
                                  className={cn(
                                    'w-12 text-center text-xs font-bold rounded-lg border px-1 py-1.5 outline-none transition-colors',
                                    absent
                                      ? 'border-red-200 bg-red-50 text-red-400'
                                      : subjectLocked
                                        ? 'border-amber-100 bg-amber-50/60 text-slate-300 cursor-not-allowed'
                                        : cm != null && cm >= minRequise
                                          ? 'border-blue-200 bg-blue-50/60 text-blue-900 focus:border-blue-600'
                                          : 'border-slate-200 bg-white text-slate-800 focus:border-blue-600',
                                    !editable && !absent && !subjectLocked && 'opacity-70 cursor-not-allowed',
                                  )}
                                  title={absent ? 'Absent' : subjectLocked ? `${s.name} — épreuve non préparée` : `${s.name} — CM sur 18 (note de base)`}
                                />
                              </td>
                              <td
                                key={`${s.id}-cp`}
                                className={cn('px-1 py-1.5', absent && 'bg-red-50/60', subjectLocked && !absent && 'bg-amber-50/40')}
                              >
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step={0.25}
                                  min={0}
                                  max={CEP_CP_MAX}
                                  disabled={!editable || !cpEnabled}
                                  value={cp ?? ''}
                                  onChange={(e) => handleCp(c.id, s, e.target.value)}
                                  placeholder="—"
                                  className={cn(
                                    'w-12 text-center text-xs font-bold rounded-lg border px-1 py-1.5 outline-none transition-colors',
                                    absent
                                      ? 'border-red-200 bg-red-50 text-red-400'
                                      : subjectLocked
                                        ? 'border-amber-100 bg-amber-50/60 text-slate-300 cursor-not-allowed'
                                        : cpEnabled
                                          ? 'border-amber-200 bg-amber-50/70 text-amber-800 focus:border-amber-500'
                                          : 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed',
                                    !editable && cpEnabled && 'opacity-70 cursor-not-allowed',
                                  )}
                                  title={
                                    absent
                                      ? 'Absent'
                                      : !cpEnabled
                                        ? `CP (perfectionnement) — réservé aux CM ≥ ${String(minRequise).replace('.', ',')}/18`
                                        : `${s.name} — CP sur 2 (perfectionnement${s.perfectionnement ? ' — matière étoilée ★' : ''})`
                                  }
                                />
                              </td>
                              <td
                                key={`${s.id}-note`}
                                className={cn('px-1 py-1.5', absent && 'bg-red-50/60', subjectLocked && !absent && 'bg-amber-50/40')}
                              >
                                <div className="flex items-center gap-1 justify-center">
                                  <span
                                    className={cn(
                                      'inline-block min-w-[2.2rem] text-center text-xs font-black px-1.5 py-1.5 rounded-lg',
                                      absent
                                        ? 'bg-red-50 text-red-400'
                                        : note != null
                                          ? note >= (s.maxScore ?? 20) / 2
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-red-100 text-red-700'
                                          : 'bg-slate-50 text-slate-300',
                                    )}
                                  >
                                    {absent ? 'ABS' : note != null ? String(note).replace('.', ',') : '—'}
                                  </span>
                                  {editable && !subjectLocked && (
                                    <button
                                      onClick={() => toggleAbsent(c.id, s.id, cell)}
                                      className={cn(
                                        'w-5 h-5 rounded text-[8px] font-black transition-colors',
                                        absent
                                          ? 'bg-red-500 text-white'
                                          : 'bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600',
                                      )}
                                      title={absent ? `Présent — ${s.code}` : `Marquer ABSENT — ${s.code} (exclu des calculs)`}
                                    >
                                      A
                                    </button>
                                  )}
                                </div>
                              </td>
                            </Fragment>
                          );
                        }

                        // ── BEPC / BAC / CAP : note /20 unique ──
                        return (
                          <td
                            key={s.id}
                            className={cn(
                              'px-1.5 py-1.5 border-l border-slate-100',
                              absent && 'bg-red-50/60',
                              subjectLocked && !absent && 'bg-amber-50/40',
                            )}
                          >
                            <div className="flex items-center gap-1 justify-center">
                              <input
                                type="number"
                                inputMode="decimal"
                                step={step}
                                min={0}
                                max={s.maxScore}
                                disabled={!editable || absent || subjectLocked}
                                value={absent ? '' : cell?.score ?? ''}
                                onChange={(e) => handleScore(c.id, s, e.target.value)}
                                placeholder="—"
                                className={cn(
                                  'w-14 text-center text-xs font-bold rounded-lg border px-1 py-1.5 outline-none transition-colors',
                                  absent
                                    ? 'border-red-200 bg-red-50 text-red-400'
                                    : subjectLocked
                                      ? 'border-amber-100 bg-amber-50/60 text-slate-300 cursor-not-allowed'
                                      : cell?.score != null && cell.score >= (s.maxScore ?? 20) / 2
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 focus:border-emerald-500'
                                        : 'border-slate-200 bg-white text-slate-800 focus:border-blue-600',
                                  !editable && !absent && !subjectLocked && 'opacity-70 cursor-not-allowed',
                                )}
                                title={
                                  absent
                                    ? 'Absent'
                                    : subjectLocked
                                      ? `${s.name} — épreuve non préparée : saisie verrouillée`
                                      : editable
                                        ? `${s.name} — note sur ${s.maxScore}`
                                        : 'Saisie verrouillée'
                                }
                              />
                              {editable && !subjectLocked && (
                                <button
                                  onClick={() => toggleAbsent(c.id, s.id, cell)}
                                  className={cn(
                                    'w-5 h-5 rounded text-[8px] font-black transition-colors',
                                    absent
                                      ? 'bg-red-500 text-white'
                                      : 'bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-600',
                                  )}
                                  title={absent ? `Présent — ${s.code}` : `Marquer ABSENT — ${s.code} (exclu des calculs)`}
                                >
                                  A
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center border-l-2 border-slate-200 text-xs font-bold text-slate-700">
                        {comp ? (comp.nbEval > 0 ? comp.total : '—') : '—'}
                      </td>
                      {!isPrimary && (
                        <>
                          <td className="px-2 py-2 text-center text-xs font-bold text-amber-700">
                            {comp && comp.nbEval > 0 ? comp.totalCoef : '—'}
                          </td>
                          <td className="px-2 py-2 text-center text-xs font-bold text-emerald-700">
                            {comp && comp.nbEval > 0 ? comp.totalNotesCoef : '—'}
                          </td>
                        </>
                      )}
                      <td className="px-2 py-2 text-center">
                        {comp?.finalAverage != null ? (
                          <span className={cn(
                            'inline-block text-xs font-black px-2.5 py-1 rounded-lg',
                            comp.finalAverage >= passMark ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700',
                          )}>
                            {comp.finalAverage.toFixed(2).replace('.', ',')}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-bold">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center text-xs font-bold text-slate-600">{rank ? `${rank}e` : '—'}</td>
                      <td className="px-2 py-2 text-center text-[9px] font-bold">
                        {isPrimary ? (
                          comp?.finalAverage != null ? (
                            <span className={comp.finalAverage >= passMark ? 'text-emerald-700' : 'text-red-600'}>
                              {comp.finalAverage >= passMark ? 'OUI' : 'NON'}
                            </span>
                          ) : '—'
                        ) : (
                          <span className="text-slate-500">{appreciationFor(comp?.finalAverage ?? null)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-blue-50 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[10px] text-slate-400 font-semibold">
            {useSimpleAverage
              ? `A = absent (exclu du total) · Moyenne retenue = Σ notes / matières évaluées · Seuil : ${String(passMark).replace('.', ',')}/20 · Rangs ex æquo sur l\u2019ensemble de l\u2019examen`
              : `A = absent (exclu des totaux) · Moyenne retenue = Σ(Note × Coefficient) / Σ(Coefficients) · Seuil : ${String(passMark).replace('.', ',')}/20 · Rangs ex æquo sur l\u2019ensemble de l\u2019examen`}
          </p>
          <p className="text-[10px] text-slate-400 font-bold uppercase">
            {filtered.length} candidat(s) affiché(s) · page {safePage + 1}/{totalPages}
          </p>
        </div>
      </div>
    </div>
  );
}
