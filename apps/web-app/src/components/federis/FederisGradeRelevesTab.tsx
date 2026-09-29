/**
 * FederisGradeRelevesTab — Relevés de notes (module Notes et Moyennes)
 *
 * Le « bulletin » d'Academia Helm, renommé RELEVÉ DE NOTES dans Federis :
 *   - CEP          → modèle du PRIMAIRE (Champs de formation, note min.,
 *                    note /20, maîtrise min., seuil réussite, appréciation,
 *                    synthèse + décision provisoire) ;
 *   - BEPC/BAC/CAP → modèle du SECONDAIRE avec coefficients (Discipline,
 *                    Note /20, Coefficient, Note coefficient, Rang,
 *                    Appréciation, Signature, totaux Σcoef / Σnote×coef,
 *                    moyenne pondérée, mention, décision).
 *
 * Aperçu fidèle au PDF backend (A4 paysage) + téléchargements :
 *   GET /federis/exams/:examId/pdf/releve/:candidateId (un candidat)
 *   GET /federis/exams/:examId/pdf/releves             (tous les candidats)
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { fmtNote, formatRankFr } from '@/lib/federis/grade-computations';

interface ReleveLine {
  subjectId: string;
  code: string;
  name: string;
  coefficient: number;
  maxScore: number;
  score: number | null;
  isAbsent: boolean;
  noteCoef: number | null;
  rankInSubject: number | null;
  appreciation: string;
}

interface Releve {
  academicYearLabel: string | null;
  examName: string;
  examCode: string;
  level: string;
  bestAverage: number | null;
  worstAverage: number | null;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    matricule: string;
    anonymatCode: string | null;
    gender: string | null;
    school: string;
    centerCode: string | null;
    centerName: string | null;
    roomCode: string | null;
    tableNumber: string | null;
  };
  lines: ReleveLine[];
  computed: {
    total: number;
    nbEval: number;
    totalCoef: number;
    totalNotesCoef: number;
    finalAverage: number | null;
  } | null;
  rank: number | null;
  totalCandidates: number;
  mention: string;
  decision: string;
  decisionNote: string;
}

interface RelevesData {
  exam: { id: string; code: string; name: string; examType: string; isPrimary: boolean };
  /** ⭐ Règles de calcul effectives (seuils + modèle — Paramètres). */
  rules?: {
    passMark: number;
    rescueMark: number;
    averageModel: 'simple' | 'ponderee';
    isCustom: boolean;
    averageModelCustom?: boolean;
  } | null;
  academicYearLabel: string | null;
  stats: { composed: number; totalCandidates: number };
  releves: Releve[];
}

/** Téléchargement authentifié (blob) — pattern FederisCandidatesPage. */
async function downloadFile(url: string, filename: string, timeout = 120000): Promise<void> {
  const res = await apiClient.get(url, { responseType: 'blob', timeout });
  const blob = new Blob([res.data], { type: 'application/pdf' });
  const objectUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export default function FederisGradeRelevesTab({
  examId,
  subjectsVersion,
}: {
  examId: string;
  subjectsVersion: number;
}) {
  const [data, setData] = useState<RelevesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<'all' | string | null>(null);
  // ⭐ Distribution des relevés aux écoles (2026-09-30)
  const [dispatching, setDispatching] = useState(false);
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/federis/exams/${examId}/grades/releves`, { timeout: 30000 });
      setData(res.data);
      setSelectedId((prev) => prev ?? res.data?.releves?.[0]?.candidate?.id ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger les relevés.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    setSelectedId(null);
    void load();
  }, [load, subjectsVersion]);

  const isPrimary = data?.exam.isPrimary ?? false;
  const releves = data?.releves ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return releves;
    return releves.filter(
      (r) =>
        `${r.candidate.lastName} ${r.candidate.firstName}`.toLowerCase().includes(q) ||
        r.candidate.matricule?.toLowerCase().includes(q) ||
        (r.candidate.anonymatCode ?? '').toLowerCase().includes(q) ||
        (r.candidate.tableNumber ?? '').includes(q) ||
        (r.candidate.school ?? '').toLowerCase().includes(q),
    );
  }, [releves, search]);

  const selected = releves.find((r) => r.candidate.id === selectedId) ?? filtered[0] ?? null;

  const downloadOne = async (r: Releve) => {
    setDownloading(r.candidate.id);
    setError(null);
    setNotice(null);
    try {
      await downloadFile(
        `/federis/exams/${examId}/pdf/releve/${r.candidate.id}`,
        `Releve_${r.examCode}_${r.candidate.matricule}.pdf`,
      );
      setNotice('Relevé PDF généré (backend) — téléchargement lancé.');
    } catch (err: any) {
      let msg = err?.response?.data?.message ?? err?.message ?? 'Téléchargement impossible.';
      if (err?.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await err.response.data.text());
          msg = parsed?.message ?? msg;
        } catch {
          /* garde le brut */
        }
      }
      setError(Array.isArray(msg) ? msg.join(' ') : String(msg));
    } finally {
      setDownloading(null);
    }
  };

  const downloadAll = async () => {
    if (!data?.exam) return;
    setDownloading('all');
    setError(null);
    setNotice(null);
    try {
      await downloadFile(
        `/federis/exams/${examId}/pdf/releves`,
        `Releves_Notes_${data.exam.code}.pdf`,
        300000,
      );
      setNotice(`Tous les relevés (${releves.length}) générés — téléchargement lancé.`);
    } catch (err: any) {
      let msg = err?.response?.data?.message ?? err?.message ?? 'Téléchargement impossible.';
      if (err?.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await err.response.data.text());
          msg = parsed?.message ?? msg;
        } catch {
          /* garde le brut */
        }
      }
      setError(Array.isArray(msg) ? msg.join(' ') : String(msg));
    } finally {
      setDownloading(null);
    }
  };

  /** ⭐ Distribution intelligente : chaque relevé part à l'école du candidat. */
  const dispatchToSchools = async () => {
    if (!data?.exam) return;
    if (
      !window.confirm(
        'Envoyer les relevés de notes aux écoles ? Chaque école rattachée recevra les relevés ' +
          'des candidats qu\u2019elle a présentés (module Délibération → distribution) et sera notifiée immédiatement.',
      )
    ) {
      return;
    }
    setDispatching(true);
    setDispatchError(null);
    setDispatchNotice(null);
    try {
      const res = await apiClient.post(`/federis/exams/${examId}/releves/dispatch`, {}, { timeout: 60000 });
      setDispatchNotice(res.data?.message ?? 'Relevés envoyés aux écoles.');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setDispatchError(
        (Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Envoi impossible — l\u2019examen doit être délibéré.',
      );
    } finally {
      setDispatching(false);
    }
  };

  if (loading && !data) {
    return <div className="fed-card px-6 py-10 text-center text-sm font-bold text-slate-400">Chargement des relevés…</div>;
  }
  if (error && !data) {
    return <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">{error}</div>;
  }
  if (!data) return null;

  if (releves.length === 0 || (data.releves[0]?.lines ?? []).length === 0) {
    return (
      <div className="fed-card px-8 py-14 text-center">
        <p className="text-sm font-bold text-slate-700">Aucun relevé à afficher</p>
        <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto">
          Les relevés de notes apparaissent dès que les matières sont définies et les notes saisies
          (onglet « Saisie des notes »).
        </p>
      </div>
    );
  }

  const female = selected?.candidate.gender === 'FEMALE' || selected?.candidate.gender === 'F';

  return (
    <div className="space-y-5">
      {/* Barre d'actions */}
      <div className="fed-card px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-blue-900 uppercase flex-1">
          Relevés de notes — {data.exam.code}
          <span className="ml-3 text-[10px] text-slate-400 normal-case font-semibold">
            {isPrimary ? 'modèle primaire (CEP — sans coefficients)' : 'modèle secondaire (avec coefficients)'}
          </span>
        </h3>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un candidat…"
          className="fed-input-light px-5 py-2.5 text-xs font-bold w-full sm:w-64"
        />
        <button
          onClick={downloadAll}
          disabled={downloading !== null || dispatching}
          className="fed-btn-navy px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50"
        >
          {downloading === 'all' ? 'Génération…' : `Tous les relevés PDF (${releves.length})`}
        </button>
        {/* ⭐ Distribution : chaque relevé part à l'école du candidat (2026-09-30) */}
        <button
          onClick={dispatchToSchools}
          disabled={downloading !== null || dispatching}
          title="Chaque école rattachée reçoit les relevés des candidats qu'elle a présentés et est notifiée"
          className="fed-btn-gold px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50"
        >
          {dispatching ? 'Envoi en cours…' : 'Envoyer aux écoles'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">{error}</div>}
      {notice && <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 text-sm font-semibold text-emerald-800">{notice}</div>}
      {dispatchError && <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">{dispatchError}</div>}
      {dispatchNotice && <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 text-sm font-semibold text-emerald-800">{dispatchNotice}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-5 items-start">
        {/* Liste des candidats (triée par rang) */}
        <div className="fed-card overflow-hidden max-h-[800px] flex flex-col">
          <div className="px-5 py-3 border-b border-blue-50 shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Candidats (par rang)</p>
          </div>
          <div className="overflow-y-auto divide-y divide-slate-100">
            {filtered.map((r) => {
              const avg = r.computed?.finalAverage ?? null;
              const active = selected?.candidate.id === r.candidate.id;
              return (
                <button
                  key={r.candidate.id}
                  onClick={() => setSelectedId(r.candidate.id)}
                  className={cn(
                    'w-full text-left px-5 py-3 flex items-center gap-3 transition-colors',
                    active ? 'bg-blue-900/[0.06] border-l-4 border-blue-900' : 'hover:bg-[#f7f9fc] border-l-4 border-transparent',
                  )}
                >
                  <span className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0',
                    r.rank === 1 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500',
                  )}>
                    {r.rank ?? '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-blue-900 truncate">
                      {r.candidate.lastName} {r.candidate.firstName}
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase truncate">
                      {r.candidate.matricule} · {r.candidate.anonymatCode ?? 'sans anonymat'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn('text-xs font-black', avg !== null && avg >= (data?.rules?.passMark ?? 10) ? 'text-emerald-700' : 'text-red-600')}>
                      {avg !== null ? fmtNote(avg) : '—'}
                    </div>
                    <div className="text-[8px] font-bold text-slate-400 uppercase">{r.decision}</div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-5 py-8 text-center text-xs font-bold text-slate-400">Aucun candidat trouvé.</p>
            )}
          </div>
        </div>

        {/* Aperçu du relevé (fidèle au PDF backend — A4 paysage) */}
        {selected && (
          <div className="space-y-4">
            <div className="fed-card px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-blue-900">
                  Aperçu — {selected.candidate.lastName} {selected.candidate.firstName}
                </p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  {isPrimary ? 'Modèle primaire' : 'Modèle secondaire avec coefficients'} · A4 paysage (identique au PDF)
                </p>
              </div>
              <button
                onClick={() => downloadOne(selected)}
                disabled={downloading !== null}
                className="fed-btn-gold px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50"
              >
                {downloading === selected.candidate.id ? 'Génération…' : 'Télécharger le relevé PDF'}
              </button>
            </div>

            {/* Feuille A4 paysage simulée */}
            <div className="bg-white border-2 border-slate-200 rounded-lg shadow-sm p-5 overflow-x-auto">
              {isPrimary ? (
                <ReleveCepPreview releve={selected} passMark={data?.rules?.passMark ?? 10} />
              ) : (
                <ReleveSecondairePreview
                  releve={selected}
                  female={female}
                  passMark={data?.rules?.passMark ?? 10}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Aperçu — modèle PRIMAIRE (CEP) : reproduction du BulletinPrimairePage1 Helm
// ═══════════════════════════════════════════════════════════════════════════

function ReleveCepPreview({ releve, passMark = 10 }: { releve: Releve; passMark?: number }) {
  const c = releve.candidate;
  const comp = releve.computed;
  const moyenne = comp?.finalAverage ?? null;
  const seuilAtteint = moyenne !== null && moyenne >= passMark;

  return (
    <div className="min-w-[820px]">
      <div className="text-center mb-3">
        <h4 className="text-xs font-bold text-slate-900 uppercase">Relevé de notes — {releve.examName}</h4>
        <p className="text-[9px] text-slate-500 font-semibold mt-0.5">
          {releve.academicYearLabel ?? '—'} · Session {releve.examCode} · Modèle primaire (sans coefficients)
        </p>
      </div>

      {/* Infos candidat */}
      <div className="rounded-lg overflow-hidden mb-3" style={{ border: '1px solid #0A2A5E' }}>
        <table className="w-full border-collapse text-[10px]">
          <tbody>
            <tr>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold w-1/4">
                Nom et prénoms : <span className="font-bold text-slate-900 uppercase">{c.lastName} {c.firstName}</span>
              </td>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold w-1/4">
                Matricule : <span className="font-bold text-slate-900">{c.matricule}</span>
              </td>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold w-1/4">
                Anonymat : <span className="font-bold text-slate-900 font-mono">{c.anonymatCode ?? '—'}</span>
              </td>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold w-1/4">
                N° de table : <span className="font-bold text-slate-900">{c.tableNumber ?? '—'}</span>
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold">
                École : <span className="font-bold text-slate-900">{c.school}</span>
              </td>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold" colSpan={2}>
                Centre : <span className="font-bold text-slate-900">{c.centerName ?? '—'}</span>
              </td>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold">
                Rang : <span className="font-bold text-slate-900">
                  {releve.rank ? `${releve.rank}e / ${releve.totalCandidates}` : '—'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tableau primaire — Champs de formation */}
      <div className="text-center mb-1">
        <h5 className="text-[10px] font-bold text-slate-900 uppercase">I — Connaissance et Habiletés</h5>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: '2px solid #0A2A5E' }}>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="text-white" style={{ backgroundColor: '#0A2A5E' }}>
              <th rowSpan={2} className="border px-2 py-1 font-bold uppercase text-left min-w-[160px]" style={{ borderColor: '#0D3B85' }}>Champs de formation</th>
              <th rowSpan={2} className="border px-2 py-1 font-bold uppercase text-center w-14" style={{ borderColor: '#0D3B85' }}>Note min.</th>
              <th rowSpan={2} className="border px-2 py-1 font-bold uppercase text-center w-16" style={{ borderColor: '#0D3B85' }}>Note /20</th>
              <th colSpan={2} className="border px-2 py-1 font-bold uppercase text-center" style={{ borderColor: '#0D3B85' }}>Maîtrise min.</th>
              <th colSpan={2} className="border px-2 py-1 font-bold uppercase text-center" style={{ borderColor: '#0D3B85' }}>Seuil réussite</th>
              <th rowSpan={2} className="border px-2 py-1 font-bold uppercase text-center min-w-[80px]" style={{ borderColor: '#0D3B85' }}>Appréciation</th>
            </tr>
            <tr className="text-white" style={{ backgroundColor: '#114FC4' }}>
              <th className="border px-1 py-0.5 font-bold text-center text-[8px] w-9" style={{ borderColor: '#114FC4' }}>Oui</th>
              <th className="border px-1 py-0.5 font-bold text-center text-[8px] w-9" style={{ borderColor: '#114FC4' }}>Non</th>
              <th className="border px-1 py-0.5 font-bold text-center text-[8px] w-9" style={{ borderColor: '#114FC4' }}>Oui</th>
              <th className="border px-1 py-0.5 font-bold text-center text-[8px] w-9" style={{ borderColor: '#114FC4' }}>Non</th>
            </tr>
          </thead>
          <tbody>
            {releve.lines.map((line, idx) => {
              const seuil = line.maxScore !== 20 ? line.maxScore / 2 : 10;
              const reached = line.score !== null && line.score >= seuil;
              return (
                <tr key={line.subjectId} className={cn(idx % 2 === 1 && 'bg-slate-50/60')}>
                  <td className="border border-slate-300 px-2 py-0.5 font-medium text-slate-900 whitespace-nowrap">{line.name}</td>
                  <td className="border border-slate-300 px-2 py-0.5 text-center text-slate-400 text-[9px]">{String(seuil).replace('.', ',')}</td>
                  <td className="border border-slate-300 px-2 py-0.5 text-center font-bold">
                    {line.isAbsent ? (
                      <span className="text-red-500 text-[8px] font-black">ABS</span>
                    ) : line.score !== null ? (
                      <span className={line.score >= seuil ? 'text-emerald-700' : 'text-red-600'}>{fmtNote(line.score)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="border border-slate-300 px-2 py-0.5 text-center">{!line.isAbsent && reached ? '✓' : ''}</td>
                  <td className="border border-slate-300 px-2 py-0.5 text-center">{!line.isAbsent && !reached && line.score !== null ? '✓' : ''}</td>
                  <td className="border border-slate-300 px-2 py-0.5 text-center">{!line.isAbsent && reached ? '✓' : ''}</td>
                  <td className="border border-slate-300 px-2 py-0.5 text-center">{!line.isAbsent && !reached && line.score !== null ? '✓' : ''}</td>
                  <td className="border border-slate-300 px-2 py-0.5 text-center text-slate-600 text-[9px]">{line.appreciation}</td>
                </tr>
              );
            })}
            <tr className="bg-slate-200 font-bold">
              <td className="border border-slate-300 px-2 py-0.5 uppercase text-slate-900" colSpan={2}>Total général</td>
              <td className="border border-slate-300 px-2 py-0.5 text-center text-blue-700">{comp ? fmtNote(comp.total) : '—'}</td>
              <td className="border border-slate-300 px-2 py-0.5 text-center" colSpan={4}></td>
              <td className="border border-slate-300 px-2 py-0.5 text-center bg-blue-100 text-blue-900 text-[9px]">{releve.mention}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Synthèse (modèle primaire Helm) */}
      <div className="mt-2 space-y-1 text-[10px] text-slate-700">
        <div className="flex justify-between bg-slate-50 px-2 py-1 rounded">
          <span>Moyenne obtenue par le candidat :</span>
          <strong className="text-blue-700">{moyenne !== null ? `${fmtNote(moyenne)}/20` : '—'}</strong>
        </div>
        <div className="flex justify-between bg-slate-50 px-2 py-1 rounded">
          <span>Plus forte moyenne de l&apos;examen :</span>
          <strong>{releve.bestAverage !== null ? `${fmtNote(releve.bestAverage)}/20` : '—'}</strong>
        </div>
        <div className="flex justify-between bg-slate-50 px-2 py-1 rounded">
          <span>Plus faible moyenne de l&apos;examen :</span>
          <strong>{releve.worstAverage !== null ? `${fmtNote(releve.worstAverage)}/20` : '—'}</strong>
        </div>
        <div className="flex justify-between bg-slate-50 px-2 py-1 rounded">
          <span>Seuil de réussite globale fixé à :</span>
          <strong>10/20</strong>
        </div>
        <div className="flex justify-between bg-blue-50 px-2 py-1 rounded font-bold">
          <span>Seuil de réussite globale atteint :</span>
          <span className={seuilAtteint ? 'text-emerald-700' : 'text-red-600'}>{seuilAtteint ? 'OUI' : 'NON'}</span>
        </div>
        <div className={cn(
          'flex justify-between px-2 py-1.5 rounded font-bold',
          seuilAtteint ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700',
        )}>
          <span>Décision provisoire (jury de délibération) :</span>
          <span>{releve.decision}</span>
        </div>
        <p className="text-[8px] text-slate-400 italic pt-1">{releve.decisionNote}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Aperçu — modèle SECONDAIRE avec coefficients : reproduction du
// BulletinSecondairePage1 Helm (Discipline, Note, Coefficient, Note
// coefficient, Rang, Appréciation, Signature + totaux + moyenne pondérée)
// ═══════════════════════════════════════════════════════════════════════════

function ReleveSecondairePreview({ releve, female, passMark = 10 }: { releve: Releve; female: boolean; passMark?: number }) {
  const c = releve.candidate;
  const comp = releve.computed;
  const moyenne = comp?.finalAverage ?? null;
  const ok = moyenne !== null && moyenne >= passMark;
  const navy = '#0A2A5E';
  const navyAlt = '#0D3B85';

  return (
    <div className="min-w-[820px]">
      {/* En-tête d'informations (modèle CEG Helm) */}
      <div className="rounded-lg overflow-hidden mb-3" style={{ border: `1px solid ${navy}` }}>
        <table className="w-full border-collapse text-[10px]">
          <tbody>
            <tr>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold w-1/3">
                Année scolaire : <span className="font-bold text-slate-900">{releve.academicYearLabel ?? '—'}</span>
              </td>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold w-1/3">
                Examen : <span className="font-bold text-slate-900">{releve.examName}</span>
              </td>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold w-1/3">
                Session / Niveau : <span className="font-bold text-slate-900">{releve.examCode} · {releve.level}</span>
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold">
                Nom et prénoms : <span className="font-bold text-slate-900 uppercase">{c.lastName} {c.firstName}</span>
              </td>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold">
                Matricule : <span className="font-bold text-slate-900">{c.matricule}</span>
                {' '}· Anonymat : <span className="font-bold text-slate-900 font-mono">{c.anonymatCode ?? '—'}</span>
                {' '}· N° table : <span className="font-bold text-slate-900">{c.tableNumber ?? '—'}</span>
              </td>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold">
                Rang : <span className="font-bold text-slate-900">
                  {releve.rank ? `${formatRankFr(releve.rank, female)} / ${releve.totalCandidates}` : '—'}
                </span>
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold">
                École de provenance : <span className="font-bold text-slate-900">{c.school}</span>
              </td>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold">
                Centre : <span className="font-bold text-slate-900">{c.centerName ?? '—'}</span>
                {' '}· Salle : <span className="font-bold text-slate-900">{c.roomCode ?? '—'}</span>
              </td>
              <td className="border border-slate-300 px-2 py-1 bg-slate-50 font-semibold">
                Effectif : <span className="font-bold text-slate-900">{releve.totalCandidates}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tableau secondaire avec coefficients */}
      <div className="rounded-lg overflow-hidden" style={{ border: `2px solid ${navy}` }}>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="text-white" style={{ backgroundColor: navy }}>
              <th className="border px-2 py-1 font-bold uppercase text-left min-w-[170px]" style={{ borderColor: navyAlt }}>Discipline</th>
              <th className="border px-2 py-1 font-bold uppercase text-center w-16" style={{ borderColor: navyAlt }}>Note /20</th>
              <th className="border px-2 py-1 font-bold uppercase text-center w-16" style={{ borderColor: navyAlt }}>Coefficient</th>
              <th className="border px-2 py-1 font-bold uppercase text-center w-20" style={{ borderColor: navyAlt, backgroundColor: navyAlt }}>Note coefficient</th>
              <th className="border px-2 py-1 font-bold uppercase text-center w-12" style={{ borderColor: navyAlt }}>Rang</th>
              <th className="border px-2 py-1 font-bold uppercase text-center min-w-[80px]" style={{ borderColor: navyAlt }}>Appréciation</th>
              <th className="border px-2 py-1 font-bold uppercase text-center w-20" style={{ borderColor: navyAlt }}>Signature</th>
            </tr>
          </thead>
          <tbody>
            {releve.lines.map((line, idx) => {
              const lineOk = line.score !== null && line.score >= 10;
              return (
                <tr key={line.subjectId} className={cn(idx % 2 === 1 && 'bg-slate-50/60')}>
                  <td className="border border-slate-300 px-2 py-0.5 font-medium text-slate-900 whitespace-nowrap">{line.name}</td>
                  <td className="border border-slate-300 px-2 py-0.5 text-center font-bold">
                    {line.isAbsent ? (
                      <span className="text-red-500 text-[8px] font-black">ABS</span>
                    ) : line.score !== null ? (
                      <span className={lineOk ? 'text-slate-900' : 'text-red-600'}>{fmtNote(line.score)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="border border-slate-300 px-2 py-0.5 text-center font-bold text-amber-700 bg-amber-50">
                    {String(line.coefficient).replace('.', ',')}
                  </td>
                  <td className={cn(
                    'border border-slate-300 px-2 py-0.5 text-center font-bold bg-blue-50/50',
                    line.isAbsent || line.noteCoef === null ? 'text-slate-400' : lineOk ? 'text-emerald-700' : 'text-red-600',
                  )}>
                    {line.isAbsent ? <span className="text-red-500 text-[8px] font-black">ABS</span> : fmtNote(line.noteCoef)}
                  </td>
                  <td className="border border-slate-300 px-2 py-0.5 text-center font-bold text-slate-700">
                    {line.rankInSubject ? formatRankFr(line.rankInSubject, female) : '—'}
                  </td>
                  <td className="border border-slate-300 px-2 py-0.5 text-center text-slate-600 text-[9px]">{line.appreciation}</td>
                  <td className="border border-slate-300 h-7" />
                </tr>
              );
            })}
            <tr className="bg-slate-200 font-bold">
              <td className="border border-slate-300 px-2 py-0.5 text-right uppercase text-slate-700 text-[9px]" colSpan={3}>Total des coefficients</td>
              <td className="border border-slate-300 px-2 py-0.5 text-center text-amber-700">{comp ? String(comp.totalCoef).replace('.', ',') : '—'}</td>
              <td className="border border-slate-300 px-2 py-0.5 text-center text-slate-800 text-[9px]" colSpan={3}>—</td>
            </tr>
            <tr className="bg-slate-200 font-bold">
              <td className="border border-slate-300 px-2 py-0.5 text-right uppercase text-slate-700 text-[9px]" colSpan={3}>Total des notes (Σ note × coef)</td>
              <td className="border border-slate-300 px-2 py-0.5 text-center text-emerald-700">{comp ? fmtNote(comp.totalNotesCoef) : '—'}</td>
              <td className="border border-slate-300 px-2 py-0.5 text-center text-slate-800 text-[9px]" colSpan={3}>—</td>
            </tr>
            <tr className="bg-blue-100 font-bold">
              <td className="border border-slate-300 px-2 py-0.5 text-right uppercase text-slate-900 text-[9px]" colSpan={3}>Moyenne de l&apos;examen</td>
              <td className={cn('border border-slate-300 px-2 py-0.5 text-center text-blue-800 text-xs', !ok && 'text-red-700')}>
                {moyenne !== null ? fmtNote(moyenne) : '—'}
              </td>
              <td className="border border-slate-300 px-2 py-0.5 text-center text-slate-800 text-[9px]" colSpan={2}>
                Mention : <span className="text-blue-900">{releve.mention}</span>
              </td>
              <td className={cn(
                'border border-slate-300 px-2 py-0.5 text-center text-[9px] font-black uppercase rounded',
                ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
              )}>
                {releve.decision}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[8px] text-slate-400 mt-1.5 italic">
        Note coefficient = Note × Coefficient · Moyenne de l&apos;examen = Σ(Note × Coefficient) / Σ(Coefficients) ·
        {' '}Les notes ABS sont exclues des calculs · {releve.decisionNote}
      </p>
    </div>
  );
}
