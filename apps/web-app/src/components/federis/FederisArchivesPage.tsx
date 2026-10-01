/**
 * FederisArchivesPage — Module Archives (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ ARCHIVAGE DE FIN D'ANNÉE (2026-10-01 — demande promoteur) :
 *
 * Grand module d'archivage : un DOSSIER par année scolaire. En ouvrant le
 * dossier d'une année passée (ex. 2025-2026), on retrouve MODULE PAR MODULE
 * toutes les informations de l'année : écoles rattachées, matières, examens
 * nationaux, centres et salles, candidats, épreuves et documents, notes et
 * moyennes, délibération et relevés, rapports statistiques — en lecture
 * seule, avec téléchargement des exports officiels (Excel, PV, stats).
 *
 * Les modules actifs (hors archives) continuent de ne présenter QUE les
 * données de l'année courante — aucun mélange.
 *
 * ⭐ AGRÉGATION NATIONALE : le patronat national retrouve l'archive de tout
 *    son réseau (chaque département identifié par un badge).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { FedPage } from '@/components/federis/federis-motion';
import { getExamStatusLabel, getExamStatusStyles } from '@/hooks/useFederisExams';

interface YearFolder {
  id: string;
  label: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  counts: {
    exams: number;
    candidates: number;
    centers: number;
    subjects: number;
    papers: number;
    schools: number;
  };
}

interface ArchiveDetail {
  year: {
    id: string;
    label: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
  };
  isNational: boolean;
  counts: {
    exams: number;
    candidates: number;
    centers: number;
    subjects: number;
    papers: number;
    schools: number;
    supervisors: number;
    results: number;
  };
  exams: Array<{
    id: string;
    code: string;
    name: string;
    examType: string;
    status: string;
    startDate: string;
    endDate: string;
    department: { name: string; territoryName: string | null } | null;
    centersCount: number;
    candidatesCount: number;
    subjectsCount: number;
    resultsCount: number;
    deliberation: {
      status: string;
      deliberatedAt: string;
      passedCount: number;
      failedCount: number;
      successRate: number;
    } | null;
  }>;
  subjects: Array<{
    id: string;
    name: string;
    code: string;
    examType: string;
    series: string | null;
    coefficient: number | null;
  }>;
  papers: Array<{
    id: string;
    title: string;
    subject: string | null;
    examCategory: string;
    status: string;
    updatedAt: string;
  }>;
  schools: Array<{
    id: string;
    name: string;
    status: string;
    department: { name: string; territoryName: string | null } | null;
    candidatesCount: number;
  }>;
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Petite tuile de compteur (module). */
function CountTile({
  icon,
  label,
  value,
}: {
  icon: Parameters<typeof AppIcon>[0]['name'];
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
        <AppIcon name={icon} size="menu" className="text-blue-800" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-blue-900 leading-tight">{value}</p>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate">
          {label}
        </p>
      </div>
    </div>
  );
}

export default function FederisArchivesPage() {
  const [folders, setFolders] = useState<YearFolder[]>([]);
  const [currentYear, setCurrentYear] = useState<{ id: string; label: string } | null>(null);
  const [isNational, setIsNational] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<ArchiveDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/federis/archives', { timeout: 30000 });
      setFolders(res.data?.years ?? []);
      setCurrentYear(res.data?.currentYear ?? null);
      setIsNational(Boolean(res.data?.isNational));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger les archives.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openYear = useCallback(async (yearId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await apiClient.get(`/federis/archives/${yearId}`, { timeout: 30000 });
      setDetail(res.data);
    } catch (err: any) {
      setDetailError(err?.response?.data?.message ?? 'Impossible d\u2019ouvrir ce dossier.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  /** Téléchargement d'un export officiel (Excel) — blob → fichier. */
  const downloadExport = useCallback(async (examId: string, kind: string, filename: string) => {
    const key = `${examId}-${kind}`;
    setDownloading(key);
    try {
      const res = await apiClient.get(`/federis/exams/${examId}/excel/${kind}`, {
        timeout: 60000,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Erreur silencieuse : le fichier n'existe peut-être pas pour cet examen
    } finally {
      setDownloading(null);
    }
  }, []);

  // ── Vue détail d'une année ───────────────────────────────────────────────
  if (detail || detailLoading || detailError) {
    return (
      <FedPage className="space-y-6">
        <button
          type="button"
          onClick={() => {
            setDetail(null);
            setDetailError(null);
          }}
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-800 hover:text-blue-900"
        >
          <AppIcon name="chevronLeft" size="menu" /> Tous les dossiers d&apos;archives
        </button>

        {detailLoading && (
          <div className="fed-card p-10 space-y-4 animate-pulse">
            <div className="h-8 w-72 bg-slate-200 rounded" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl" />
              ))}
            </div>
          </div>
        )}
        {detailError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
            {detailError}
          </div>
        )}

        {detail && (
          <>
            {/* En-tête du dossier */}
            <div className="fed-card p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-900 rounded-xl flex items-center justify-center shrink-0">
                  <AppIcon name="library" size="dashboard" className="text-gold-400" />
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold text-blue-900">{detail.year.label}</h1>
                    <span
                      className={cn(
                        'text-[10px] font-bold uppercase px-2.5 py-1 rounded-full',
                        detail.year.isCurrent
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {detail.year.isCurrent ? 'Année courante' : 'Année archivée'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {fmtDate(detail.year.startDate)} → {fmtDate(detail.year.endDate)} · Consultation
                    en lecture seule {detail.isNational ? '· réseau national (tous les départements)' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Tuiles de compteurs par module */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
              <CountTile icon="exams" label="Examens" value={detail.counts.exams} />
              <CountTile icon="scolarite" label="Candidats" value={detail.counts.candidates.toLocaleString('fr-FR')} />
              <CountTile icon="classes" label="Centres" value={detail.counts.centers} />
              <CountTile icon="bookOpen" label="Matières" value={detail.counts.subjects} />
              <CountTile icon="classes" label="Écoles" value={detail.counts.schools} />
              <CountTile icon="document" label="Épreuves" value={detail.counts.papers} />
              <CountTile icon="grades" label="Notes saisies" value={detail.counts.results.toLocaleString('fr-FR')} />
              <CountTile icon="students" label="Surveillants" value={detail.counts.supervisors} />
            </div>

            {/* Examens nationaux de l'année */}
            <section className="fed-card overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-blue-900">Examens nationaux</h2>
                <span className="text-xs text-slate-400 font-medium">
                  Téléchargez les listes et rapports officiels par examen
                </span>
              </div>
              {detail.exams.length === 0 ? (
                <p className="px-6 py-10 text-sm text-slate-400 text-center">
                  Aucun examen cette année-là.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#f7f9fc] text-left text-xs text-slate-500 uppercase tracking-wide">
                        <th className="px-6 py-3 font-semibold">Examen</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        {detail.isNational && <th className="px-4 py-3 font-semibold">Département</th>}
                        <th className="px-4 py-3 font-semibold">Statut</th>
                        <th className="px-4 py-3 font-semibold text-center">Centres</th>
                        <th className="px-4 py-3 font-semibold text-center">Candidats</th>
                        <th className="px-4 py-3 font-semibold">Délibération</th>
                        <th className="px-4 py-3 font-semibold text-right">Documents</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.exams.map((exam) => (
                        <tr key={exam.id} className="border-t border-slate-100">
                          <td className="px-6 py-3.5">
                            <div className="font-medium text-blue-900">{exam.name}</div>
                            <div className="text-xs text-slate-400">
                              {exam.code} · {fmtDate(exam.startDate)}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-slate-600">{exam.examType}</td>
                          {detail.isNational && (
                            <td className="px-4 py-3.5 text-slate-600">
                              {exam.department?.territoryName ?? exam.department?.name ?? '—'}
                            </td>
                          )}
                          <td className="px-4 py-3.5">
                            <span
                              className={cn(
                                'px-2.5 py-1 rounded-full text-[9px] font-bold uppercase',
                                getExamStatusStyles(exam.status),
                              )}
                            >
                              {getExamStatusLabel(exam.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center text-slate-700">{exam.centersCount}</td>
                          <td className="px-4 py-3.5 text-center text-slate-700">
                            {exam.candidatesCount.toLocaleString('fr-FR')}
                          </td>
                          <td className="px-4 py-3.5">
                            {exam.deliberation ? (
                              <div>
                                <span
                                  className={cn(
                                    'px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                                    exam.deliberation.status === 'PUBLISHED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-100 text-slate-600',
                                  )}
                                >
                                  {exam.deliberation.status === 'PUBLISHED' ? 'Publiée' : exam.deliberation.status}
                                </span>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {exam.deliberation.passedCount} admis ·{' '}
                                  {exam.deliberation.failedCount} refusés ·{' '}
                                  {Math.round(exam.deliberation.successRate)}% de réussite
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() =>
                                  void downloadExport(exam.id, 'candidats', `${exam.code}-candidats.xlsx`)
                                }
                                disabled={downloading === `${exam.id}-candidats`}
                                className="text-[10px] font-semibold text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 transition-colors disabled:opacity-50"
                              >
                                Candidats
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void downloadExport(exam.id, 'centres', `${exam.code}-centres.xlsx`)
                                }
                                disabled={downloading === `${exam.id}-centres`}
                                className="text-[10px] font-semibold text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 transition-colors disabled:opacity-50"
                              >
                                Centres
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void downloadExport(exam.id, 'surveillants', `${exam.code}-surveillants.xlsx`)
                                }
                                disabled={downloading === `${exam.id}-surveillants`}
                                className="text-[10px] font-semibold text-blue-800 hover:bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 transition-colors disabled:opacity-50"
                              >
                                Surveillants
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Grille : matières / écoles / épreuves */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Matières */}
              <section className="fed-card overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="text-base font-bold text-blue-900">Matières</h2>
                  <p className="text-xs text-slate-400">{detail.subjects.length} matière(s) au programme</p>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                  {detail.subjects.length === 0 ? (
                    <p className="px-6 py-6 text-sm text-slate-400">Aucune matière.</p>
                  ) : (
                    detail.subjects.map((s) => (
                      <div key={s.id} className="flex items-center justify-between px-6 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-slate-800">{s.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {s.examType} {s.series ? `· ${s.series}` : ''}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          coef. {s.coefficient ?? '—'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Écoles rattachées */}
              <section className="fed-card overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="text-base font-bold text-blue-900">Écoles rattachées</h2>
                  <p className="text-xs text-slate-400">
                    {detail.schools.length} école(s) — {detail.schools.filter((s) => s.status === 'JOINED').length} validée(s)
                  </p>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                  {detail.schools.length === 0 ? (
                    <p className="px-6 py-6 text-sm text-slate-400">Aucune école rattachée.</p>
                  ) : (
                    detail.schools.map((s) => (
                      <div key={s.id} className="flex items-center justify-between px-6 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                          <p className="text-[11px] text-slate-400">
                            {s.department?.territoryName ?? s.department?.name ?? '—'}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">
                          {s.candidatesCount} cand.
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Épreuves et documents */}
              <section className="fed-card overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="text-base font-bold text-blue-900">Épreuves et documents</h2>
                  <p className="text-xs text-slate-400">{detail.papers.length} épreuve(s) constituée(s)</p>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                  {detail.papers.length === 0 ? (
                    <p className="px-6 py-6 text-sm text-slate-400">Aucune épreuve.</p>
                  ) : (
                    detail.papers.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-6 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{p.title}</p>
                          <p className="text-[11px] text-slate-400">
                            {p.subject ?? p.examCategory} · {fmtDate(p.updatedAt)}
                          </p>
                        </div>
                        {p.status === 'LOCKED' && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded uppercase shrink-0">
                            Verrouillée
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </FedPage>
    );
  }

  // ── Vue dossiers d'années ────────────────────────────────────────────────
  return (
    <FedPage className="space-y-8">
      {/* En-tête */}
      <div className="fed-card p-10 relative overflow-hidden">
        <div className="relative z-10">
          <div className="fed-badge mb-4">Analyse rétrospective</div>
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-blue-800 rounded-lg flex items-center justify-center">
              <AppIcon name="library" size="dashboard" className="text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-blue-900 tracking-tight">Archives</h1>
          </div>
          <p className="text-slate-500 font-medium max-w-2xl text-sm">
            Toutes les données des années scolaires passées, organisées en dossiers. Ouvrez une
            année pour retrouver module par module ses écoles, matières, examens, centres,
            candidats, épreuves, notes, délibérations — et télécharger les documents officiels.
            Les modules actifs n&apos;affichent, eux, que l&apos;année courante.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="fed-card p-8 h-44 animate-pulse" />
          ))}
        </div>
      ) : folders.length === 0 ? (
        <div className="fed-card px-6 py-16 text-center">
          <AppIcon name="library" size="dashboard" className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            Aucune année archivable pour l&apos;instant — les dossiers apparaîtront ici dès la
            première campagne d&apos;examens enregistrée
            {currentYear ? ` (année courante : ${currentYear.label})` : ''}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => void openYear(folder.id)}
              className="fed-card p-6 text-left hover:shadow-lg hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                      folder.isCurrent ? 'bg-blue-900' : 'bg-slate-200',
                    )}
                  >
                    <AppIcon
                      name="library"
                      size="dashboard"
                      className={folder.isCurrent ? 'text-gold-400' : 'text-slate-500'}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-blue-900 group-hover:text-blue-800 leading-tight">
                      {folder.label.replace('Année scolaire', '').trim() || folder.label}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {fmtDate(folder.startDate)} → {fmtDate(folder.endDate)}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-[9px] font-bold uppercase px-2 py-1 rounded-full shrink-0',
                    folder.isCurrent
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {folder.isCurrent ? 'Année courante' : 'Archivée'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Examens', value: folder.counts.exams },
                  { label: 'Candidats', value: folder.counts.candidates },
                  { label: 'Écoles', value: folder.counts.schools },
                  { label: 'Épreuves', value: folder.counts.papers },
                ].map((c) => (
                  <div key={c.label} className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-2 text-center">
                    <p className="text-base font-bold text-blue-900 leading-tight">
                      {c.value.toLocaleString('fr-FR')}
                    </p>
                    <p className="text-[9px] font-semibold text-slate-400 uppercase">{c.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs font-semibold text-blue-800 group-hover:text-blue-700 flex items-center gap-1.5">
                Ouvrir le dossier <AppIcon name="chevronLeft" size="menu" className="rotate-180" />
              </p>
            </button>
          ))}
        </div>
      )}
    </FedPage>
  );
}
