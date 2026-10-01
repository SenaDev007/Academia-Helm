/**
 * FederisGradeRegistryTab — Registre des notes (module Notes et Moyennes)
 *
 * Reproduction du registre Helm (RegistreTable) pour les examens nationaux :
 * grille LECTURE SEULE avec les mêmes calculs que la saisie (totaux,
 * moyennes, rangs, seuil), mode anonyme, recherche — PLUS le
 * « Récapitulatif de l'évaluation » Helm : effectif, ayant composé, admis
 * au seuil de 10/20, taux de réussite, moyennes — globalement ET par centre.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import {
  type GSubject,
  type GCandidateRow,
  appreciationFor,
  candidateDisplayName,
  fmtNote,
} from '@/lib/federis/grade-computations';

const PAGE_SIZE = 30;

interface RegistryData {
  exam: { id: string; code: string; name: string; examType: string; isPrimary: boolean };
  subjects: GSubject[];
  session: { allSubmitted: boolean; locked: boolean };
  stats: {
    totalCandidates: number;
    composed: number;
    passed: number;
    failed: number;
    successRate: number | null;
    generalAverage: number | null;
    bestAverage: number | null;
    worstAverage: number | null;
  };
  perCenter: Array<{
    centerCode: string;
    centerName: string;
    candidates: number;
    composed: number;
    passed: number;
    successRate: number | null;
    average: number | null;
  }>;
  candidates: GCandidateRow[];
}

export default function FederisGradeRegistryTab({
  examId,
  subjectsVersion,
}: {
  examId: string;
  subjectsVersion: number;
}) {
  const [data, setData] = useState<RegistryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/federis/exams/${examId}/grades/registry`, { timeout: 30000 });
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger le registre des notes.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load, subjectsVersion]);

  useEffect(() => {
    setPage(0);
  }, [search, examId]);

  const isPrimary = data?.exam.isPrimary ?? false;
  const subjects = data?.subjects ?? [];
  const candidates = data?.candidates ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        `${c.lastName} ${c.firstName}`.toLowerCase().includes(q) ||
        c.matricule?.toLowerCase().includes(q) ||
        (c.anonymatCode ?? '').toLowerCase().includes(q) ||
        (c.tableNumber ?? '').includes(q) ||
        (c.centerCode ?? '').toLowerCase().includes(q) ||
        (c.school ?? '').toLowerCase().includes(q),
    );
  }, [candidates, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  if (loading && !data) {
    return <div className="fed-card px-6 py-10 text-center text-sm font-bold text-slate-400">Chargement du registre…</div>;
  }
  if (error && !data) {
    return <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">{error}</div>;
  }
  if (!data) return null;

  if (subjects.length === 0) {
    return (
      <div className="fed-card px-8 py-14 text-center">
        <p className="text-sm font-bold text-slate-700">Aucune matière définie pour cet examen</p>
        <p className="text-xs text-slate-500 mt-2">Le registre des notes sera disponible après la définition des épreuves et la saisie des notes.</p>
      </div>
    );
  }

  const stats = data.stats;

  return (
    <div className="space-y-5">
      {/* Récapitulatif de l'examen (pattern « Récapitulatif de l'évaluation » Helm) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="fed-card px-4 py-4 text-center">
          <p className="text-xl font-bold text-gray-900">{stats.totalCandidates}</p>
          <p className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">Inscrits</p>
        </div>
        <div className="fed-card px-4 py-4 text-center">
          <p className="text-xl font-bold text-blue-900">{stats.composed}</p>
          <p className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">Ayant composé</p>
        </div>
        <div className="fed-card px-4 py-4 text-center">
          <p className="text-xl font-bold text-emerald-700">{stats.passed}</p>
          <p className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">Seuil ≥ 10</p>
        </div>
        <div className="fed-card px-4 py-4 text-center">
          <p className="text-xl font-bold text-red-600">{stats.failed}</p>
          <p className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">Sous le seuil</p>
        </div>
        <div className="fed-card px-4 py-4 text-center">
          <p className="text-xl font-bold text-gold-600">{stats.successRate !== null ? `${stats.successRate.toFixed(1).replace('.', ',')} %` : '—'}</p>
          <p className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">Taux de réussite</p>
        </div>
        <div className="fed-card px-4 py-4 text-center">
          <p className="text-xl font-bold text-blue-900">{fmtNote(stats.generalAverage)}</p>
          <p className="text-[9px] font-bold text-gray-500 uppercase mt-0.5">Moyenne générale</p>
        </div>
      </div>

      {/* Répartition par centre */}
      {data.perCenter.length > 0 && (
        <div className="fed-card overflow-hidden">
          <div className="px-6 py-4 border-b border-blue-50">
            <h3 className="text-sm font-bold text-blue-900 uppercase">Récapitulatif par centre d&apos;examen</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-[#f7f9fc]">
                <tr>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Centre</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Inscrits</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Ayant composé</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Seuil ≥ 10</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Taux</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Moyenne du centre</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {data.perCenter.map((c) => (
                  <tr key={`${c.centerCode}-${c.centerName}`} className="hover:bg-[#f7f9fc]">
                    <td className="px-6 py-3">
                      <span className="text-xs font-bold text-blue-900">{c.centerName}</span>
                      <span className="ml-2 text-[9px] font-bold text-slate-400 uppercase">{c.centerCode}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-600">{c.candidates}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-blue-900">{c.composed}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-emerald-700">{c.passed}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-gold-600">
                      {c.successRate !== null ? `${c.successRate.toFixed(1).replace('.', ',')} %` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-slate-700">{fmtNote(c.average)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Barre du registre */}
      <div className="fed-card px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-blue-900 uppercase flex-1">
          Registre des notes — {data.exam.code}
          <span className="ml-3 text-[10px] text-slate-400 normal-case font-semibold">
            {isPrimary ? 'modèle primaire (sans coefficients)' : 'modèle secondaire (avec coefficients)'}
          </span>
        </h3>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (nom, matricule, anonymat, centre…)"
          className="fed-input-light px-5 py-2.5 text-xs font-bold w-full sm:w-72"
        />
        <button
          onClick={() => setAnonymous((v) => !v)}
          className={cn(
            'px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase border transition-all',
            anonymous
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400 hover:text-amber-700',
          )}
        >
          {anonymous ? 'Anonymat affiché' : 'Afficher les anonymats'}
        </button>
      </div>

      {/* Registre — lecture seule */}
      <div className="fed-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-[#f7f9fc]">
              <tr>
                <th className="px-3 py-3 text-left text-[9px] font-bold text-slate-400 uppercase min-w-[190px]">Candidat</th>
                <th className="px-2 py-3 text-center text-[9px] font-bold text-slate-400 uppercase">Sexe</th>
                <th className="px-2 py-3 text-left text-[9px] font-bold text-slate-400 uppercase min-w-[120px]">École</th>
                {subjects.map((s) => (
                  <th key={s.id} className="px-2 py-3 text-center border-l border-slate-200">
                    <div className="text-[9px] font-bold text-blue-900 uppercase">{s.code}</div>
                    <div className="text-[8px] font-semibold text-slate-400">
                      /{s.maxScore}
                      {!isPrimary && <span className="text-amber-600"> · c{String(s.coefficient).replace('.', ',')}</span>}
                    </div>
                  </th>
                ))}
                <th className="px-2 py-3 text-center text-[9px] font-bold text-slate-400 uppercase border-l-2 border-slate-200">Total</th>
                {!isPrimary && <th className="px-2 py-3 text-center text-[9px] font-bold text-slate-400 uppercase">Σ note×coef</th>}
                <th className="px-2 py-3 text-center text-[9px] font-bold text-blue-900 uppercase">Moyenne</th>
                <th className="px-2 py-3 text-center text-[9px] font-bold text-slate-400 uppercase">Rang</th>
                <th className="px-2 py-3 text-center text-[9px] font-bold text-slate-400 uppercase min-w-[76px]">Décision*</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={5 + subjects.length + (isPrimary ? 3 : 4)} className="px-6 py-10 text-center text-sm font-bold text-slate-400">
                    Aucun candidat ne correspond à la recherche.
                  </td>
                </tr>
              ) : (
                pageRows.map((c, idx) => {
                  const comp = c.computed;
                  const names = candidateDisplayName(c, anonymous);
                  const avg = comp?.finalAverage ?? null;
                  return (
                    <tr key={c.id} className={cn('hover:bg-[#f7f9fc]', idx % 2 === 1 && 'bg-slate-50/40')}>
                      <td className="px-3 py-2">
                        <div className={cn('text-xs font-bold', anonymous ? 'font-mono text-amber-700' : 'text-blue-900')}>{names.main}</div>
                        <div className="text-[8px] font-bold text-slate-400 uppercase">{names.sub}{c.tableNumber ? ` · table ${c.tableNumber}` : ''}</div>
                      </td>
                      <td className="px-2 py-2 text-center text-[10px] font-bold text-slate-500">
                        {c.gender === 'FEMALE' || c.gender === 'F' ? 'F' : c.gender === 'MALE' || c.gender === 'M' ? 'M' : '—'}
                      </td>
                      <td className="px-2 py-2 text-[10px] font-semibold text-slate-600 max-w-[120px] truncate" title={c.school}>{c.school}</td>
                      {subjects.map((s) => {
                        const cell = c.scores?.[s.id];
                        if (cell?.isAbsent) {
                          return (
                            <td key={s.id} className="px-2 py-2 text-center border-l border-slate-100 bg-red-50/60">
                              <span className="text-[8px] font-black text-red-500">ABS</span>
                            </td>
                          );
                        }
                        const score = cell?.score ?? null;
                        return (
                          <td key={s.id} className="px-2 py-2 text-center border-l border-slate-100">
                            <span className={cn('text-xs font-bold', score === null ? 'text-slate-300' : score >= (s.maxScore ?? 20) / 2 ? 'text-emerald-700' : 'text-red-600')}>
                              {score === null ? '—' : fmtNote(score)}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center border-l-2 border-slate-200 text-xs font-bold text-slate-700">
                        {comp && comp.nbEval > 0 ? fmtNote(comp.total) : '—'}
                      </td>
                      {!isPrimary && (
                        <td className="px-2 py-2 text-center text-xs font-bold text-emerald-700">
                          {comp && comp.nbEval > 0 ? fmtNote(comp.totalNotesCoef) : '—'}
                        </td>
                      )}
                      <td className="px-2 py-2 text-center">
                        {avg !== null ? (
                          <span className={cn(
                            'inline-block text-xs font-black px-2.5 py-1 rounded-lg',
                            avg >= 10 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700',
                          )}>
                            {fmtNote(avg)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-bold">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center text-xs font-bold text-slate-600">{c.rank ? `${c.rank}e` : '—'}</td>
                      <td className="px-2 py-2 text-center">
                        {avg !== null ? (
                          <span className={cn(
                            'text-[9px] font-black uppercase px-2 py-1 rounded',
                            avg >= 10 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600',
                          )}>
                            {avg >= 10 ? 'Admis*' : 'Ajourné*'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[9px] font-bold">—</span>
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
            *Décision provisoire au seuil de 10/20 — la décision officielle relève du jury (module Délibérations).
            {' '}Appréciations : {appreciationFor(16)} · {appreciationFor(14)} · {appreciationFor(12)} · {appreciationFor(10)} · {appreciationFor(8)} · {appreciationFor(0)}.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-600 disabled:opacity-40"
            >
              Précédent
            </button>
            <span className="text-[10px] font-bold text-slate-500 uppercase">Page {safePage + 1} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-600 disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
