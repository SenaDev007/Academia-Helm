/**
 * SchoolDeliberationView — Délibération et relevés de notes (réception école)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ 2026-09-30 — Sous-onglet « Délibération et relevés de notes » de l'onglet
 * « Examens nationaux » (module Examen, Academia Helm).
 *
 * Le patronat (Academia Federis) délibère, publie puis distribue les relevés :
 * chaque école retrouve ici les décisions du jury pour SES candidats et
 * consulte / télécharge leurs relevés de notes.
 *
 *   • Sous-sous-onglets CEP | BEPC | BAC | CAP (seuls les types avec classes
 *     éligibles s'affichent — pilotés par la page parente) ;
 *   • Par campagne : liste des ADMISSIBLES + liste des ajournés (colonnes
 *     matricule / nom prénom / moyenne / décision du jury — pattern Promotion
 *     & Redoublement Helm) ;
 *   • Clic sur un candidat → relevé de notes VISUALISÉ dans l'interface
 *     (modèle primaire CEP sans coefficients / modèle secondaire avec
 *     coefficients) + téléchargement PDF officiel (généré backend).
 *
 * API :
 *   GET /federis/school/national-exams/:examType/results
 *   GET /federis/school/national-exams/:examType/releve/:candidateId?examId=
 *   GET /federis/school/national-exams/:examType/releve/:candidateId/pdf?examId=
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Landmark,
  Loader2,
  RefreshCw,
  Award,
  Users,
  FileDown,
  X,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api/client';
import { fmtNote, formatRankFr } from '@/lib/federis/grade-computations';

export type SchoolExamType = 'CEP' | 'BEPC' | 'BAC' | 'CAP';

// ─── Types (réponses API) ────────────────────────────────────────────────────

interface SchoolBoardRow {
  candidateId: string;
  matricule: string;
  fullName: string;
  school: string;
  centerName: string | null;
  moyenne: number | null;
  rank: number | null;
  mention: string | null;
  decision: 'ADMIS' | 'AJOURNE' | 'EN_ATTENTE' | 'NON_DELIBERE';
  decisionLabel: string;
  releveDispatched: boolean;
}

interface SchoolExamResults {
  exam: {
    id: string;
    code: string;
    name: string;
    examType: string;
    level: string;
    status: string;
    isPrimary: boolean;
  };
  patronatName: string;
  academicYearLabel: string | null;
  deliberation: {
    juryName: string | null;
    status: string;
    deliberatedAt: string;
    publication: { publishedAt: string; admitted: number; failed: number } | null;
  } | null;
  rules: { passMark: number; rescueMark: number };
  stats: { total: number; admissibles: number; ajournes: number; releves: number };
  dispatchedAt: string | null;
  relevesDispatched: number;
  admissibles: SchoolBoardRow[];
  ajournes: SchoolBoardRow[];
}

interface ResultsResponse {
  examType: string;
  label: string;
  fullLabel: string;
  message?: string;
  exams: SchoolExamResults[];
}

interface ReleveLine {
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

interface SchoolReleveData {
  releve: {
    academicYearLabel: string | null;
    examName: string;
    examCode: string;
    examType: string;
    level: string;
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
  } | null;
  dispatchedAt: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  CEP: 'CEP',
  BEPC: 'BEPC',
  BAC: 'Baccalauréat',
  CAP: 'CAP (filières techniques)',
};

// ─── Composant principal ─────────────────────────────────────────────────────

export default function SchoolDeliberationView({
  availableTypes,
}: {
  availableTypes: SchoolExamType[];
}) {
  // ⭐ FIX 2026-10-01 « Cannot read properties of undefined (reading 'length') » :
  //    la prop et les réponses API sont défendues PARTOUT — une réponse
  //    inattendue (clé absente, forme différente, cache offline) affiche
  //    l'état vide au lieu de faire planter le module entier.
  const types: SchoolExamType[] = Array.isArray(availableTypes) ? availableTypes : [];
  const [type, setType] = useState<SchoolExamType | null>(types[0] ?? null);
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Candidat sélectionné (visualisation du relevé)
  const [selected, setSelected] = useState<{ examId: string; row: SchoolBoardRow } | null>(null);

  useEffect(() => {
    setType((prev) => (prev && types.includes(prev) ? prev : types[0] ?? null));
  }, [types]);

  const load = useCallback(
    async (t: SchoolExamType | null) => {
      if (!t) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get(`/federis/school/national-exams/${t}/results`, {
          timeout: 30000,
        });
        setData(res.data);
      } catch (err: any) {
        setError(
          (Array.isArray(err?.response?.data?.message)
            ? err.response.data.message.join(' ')
            : err?.response?.data?.message) ?? 'Impossible de charger les résultats.',
        );
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setSelected(null);
    void load(type);
  }, [type, load]);

  if (types.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
        <Landmark className="w-10 h-10 text-slate-300 mx-auto" />
        <p className="font-bold text-slate-700">Aucun examen national disponible</p>
        <p className="text-sm text-slate-500 max-w-lg mx-auto">
          Aucune classe éligible (CM2, 3ème, Terminale, Terminale CAP) n&apos;existe dans votre
          structure pour cette année scolaire.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Sous-sous-onglets CEP / BEPC / BAC / CAP */}
      <div className="flex flex-wrap items-center gap-2">
        {types.map((t) => {
          const isActive = t === type;
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all',
                isActive
                  ? 'bg-blue-900 text-white border-blue-900 shadow-md shadow-blue-900/20'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-blue-900/30 hover:text-blue-900',
              )}
            >
              <Landmark className="w-4 h-4" />
              {TYPE_LABELS[t] ?? t}
            </button>
          );
        })}
        <Button variant="ghost" size="sm" onClick={() => load(type)} disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-blue-900" />
        </div>
      ) : !data || (data.exams ?? []).length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
          <Clock className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700">
            Aucun résultat {type ? TYPE_LABELS[type] : ''} pour le moment
          </p>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            {data?.message ??
              "Les résultats de vos candidats apparaîtront ici dès que le patronat aura délibéré puis distribué les relevés de notes aux écoles."}
          </p>
        </div>
      ) : (
        <>
          {(data.exams ?? []).map((examResult) => (
            <div
              key={examResult.exam.id}
              className="rounded-xl border border-slate-200 bg-white overflow-hidden"
            >
              {/* En-tête de campagne */}
              <div className="border-b border-slate-100 px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3 flex-wrap bg-slate-50/70">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-blue-900">
                      {examResult.exam.code} — {examResult.exam.name}
                    </h3>
                    {examResult.exam.status === 'RESULTS_PUBLISHED' ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Résultats publiés
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0">
                        <Clock className="w-3 h-3 mr-1" /> Délibération en cours
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Organisé par <b>{examResult.patronatName ?? 'le patronat'}</b>
                    {examResult.deliberation?.juryName ? ` · jury « ${examResult.deliberation.juryName} »` : ''}
                    {examResult.deliberation?.publication?.publishedAt
                      ? ` · publié le ${new Date(examResult.deliberation.publication.publishedAt).toLocaleDateString('fr-FR')}`
                      : ''}
                    {examResult.relevesDispatched > 0 ? (
                      <span className="text-emerald-700 font-bold">
                        {' '}
                        · {examResult.relevesDispatched} relevé(s) reçu(s)
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex gap-2 text-center">
                  <div className="rounded-lg bg-white border border-slate-200 px-3 py-2">
                    <p className="text-lg font-black text-slate-800">{examResult.stats?.total ?? 0}</p>
                    <p className="text-[9px] font-bold uppercase text-slate-500">Candidats</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                    <p className="text-lg font-black text-emerald-700">
                      {examResult.stats?.admissibles ?? 0}
                    </p>
                    <p className="text-[9px] font-bold uppercase text-emerald-700">Admissibles</p>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    <p className="text-lg font-black text-red-600">{examResult.stats?.ajournes ?? 0}</p>
                    <p className="text-[9px] font-bold uppercase text-red-600">Ajournés</p>
                  </div>
                </div>
              </div>

              {/* Deux tableaux 50/50 */}
              <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-slate-100">
                {/* Admissibles */}
                <div>
                  <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <p className="text-xs font-bold uppercase text-emerald-800">
                      Admissibles ({(examResult.admissibles ?? []).length})
                    </p>
                  </div>
                  <SchoolResultTable
                    rows={examResult.admissibles ?? []}
                    tone="emerald"
                    examId={examResult.exam.id}
                    onSelect={setSelected}
                    selectedCandidateId={selected?.row.candidateId ?? null}
                  />
                </div>
                {/* Ajournés */}
                <div>
                  <div className="bg-red-50 border-b border-red-100 px-4 py-2.5 flex items-center gap-2">
                    <Users className="w-4 h-4 text-red-500" />
                    <p className="text-xs font-bold uppercase text-red-700">
                      Ajournés ({(examResult.ajournes ?? []).length})
                    </p>
                  </div>
                  <SchoolResultTable
                    rows={examResult.ajournes ?? []}
                    tone="red"
                    examId={examResult.exam.id}
                    onSelect={setSelected}
                    selectedCandidateId={selected?.row.candidateId ?? null}
                  />
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Panneau de visualisation du relevé de notes */}
      {selected && (
        <SchoolRelevePanel
          examType={type ?? 'CEP'}
          examId={selected.examId}
          row={selected.row}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tableau des résultats d'une campagne (admissibles / ajournés)
// ═══════════════════════════════════════════════════════════════════════════

function SchoolResultTable({
  rows,
  tone,
  examId,
  onSelect,
  selectedCandidateId,
}: {
  rows: SchoolBoardRow[];
  tone: 'emerald' | 'red';
  examId: string;
  onSelect: (selection: { examId: string; row: SchoolBoardRow }) => void;
  selectedCandidateId: string | null;
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="text-xs font-bold text-slate-400">Aucun candidat dans cette liste.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50 sticky top-0 z-10">
          <tr>
            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase">Matricule</th>
            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase">Nom prénom</th>
            <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase">Moyenne</th>
            <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase">Décision du jury</th>
            <th className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-500 uppercase">Relevé</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((r, idx) => {
            const isAdmis = r.decision === 'ADMIS';
            return (
              <tr
                key={r.candidateId}
                className={cn(
                  idx % 2 === 1 ? 'bg-slate-50/60' : '',
                  selectedCandidateId === r.candidateId && 'bg-blue-50',
                )}
              >
                <td className="px-3 py-2">
                  <span className="font-mono text-[11px] font-bold text-slate-600">{r.matricule}</span>
                </td>
                <td className="px-3 py-2">
                  <p className="text-xs font-bold text-blue-900 truncate max-w-[180px]">{r.fullName}</p>
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={cn(
                      'text-xs font-black',
                      r.moyenne === null
                        ? 'text-slate-400'
                        : isAdmis
                          ? 'text-emerald-700'
                          : 'text-red-600',
                    )}
                  >
                    {r.moyenne === null ? '—' : fmtNote(r.moyenne)}
                  </span>
                  {r.mention && (
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{r.mention}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[9px] font-bold uppercase',
                      isAdmis
                        ? 'bg-emerald-100 text-emerald-800'
                        : r.decision === 'EN_ATTENTE'
                          ? 'bg-amber-100 text-amber-800'
                          : r.decision === 'NON_DELIBERE'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-red-100 text-red-700',
                    )}
                  >
                    {r.decisionLabel}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  {r.releveDispatched ? (
                    <button
                      onClick={() => onSelect({ examId, row: r })}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase bg-blue-900 text-white hover:bg-blue-800"
                    >
                      <FileText className="w-3 h-3" />
                      Voir
                    </button>
                  ) : (
                    <span className="text-[9px] font-bold text-slate-400 uppercase">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Visualisation du relevé de notes d'un candidat (dans l'interface) + PDF
// ═══════════════════════════════════════════════════════════════════════════

function SchoolRelevePanel({
  examType,
  examId,
  row,
  onClose,
}: {
  examType: SchoolExamType;
  examId: string;
  row: SchoolBoardRow;
  onClose: () => void;
}) {
  const [data, setData] = useState<SchoolReleveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get(
          `/federis/school/national-exams/${examType}/releve/${row.candidateId}`,
          { params: { examId }, timeout: 30000 },
        );
        if (!cancelled) setData(res.data);
      } catch (err: any) {
        if (!cancelled) {
          setError(
            (Array.isArray(err?.response?.data?.message)
              ? err.response.data.message.join(' ')
              : err?.response?.data?.message) ?? 'Relevé indisponible.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examType, examId, row.candidateId]);

  const downloadPdf = async () => {
    setDownloading(true);
    setError(null);
    try {
      const res = await apiClient.get(
        `/federis/school/national-exams/${examType}/releve/${row.candidateId}/pdf`,
        { params: { examId }, responseType: 'blob', timeout: 120000 },
      );
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `Releve_Notes_${row.matricule}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objectUrl);
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
      setDownloading(false);
    }
  };

  const releve = data?.releve ?? null;
  const isPrimary = releve?.examType === 'CEP';
  const female = releve?.candidate.gender === 'FEMALE' || releve?.candidate.gender === 'F';
  const average = releve?.computed?.finalAverage ?? null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* En-tête du panneau */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-3 bg-slate-50">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-blue-900 truncate">
              Relevé de notes — {row.fullName}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {releve?.examName ?? '…'}
              {data?.dispatchedAt
                ? ` · reçu de ${releve?.candidate.school ?? 'votre école'} le ${new Date(data.dispatchedAt).toLocaleDateString('fr-FR')}`
                : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={downloadPdf}
              disabled={downloading || loading || !releve}
              className="bg-blue-900 hover:bg-blue-800 text-white font-bold"
              size="sm"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 mr-1.5" />
              )}
              Télécharger le PDF
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-200 text-slate-500"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corps */}
        <div className="overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-7 h-7 animate-spin text-blue-900" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
              {error}
            </div>
          ) : releve ? (
            <div className="space-y-5">
              {/* Identité du candidat */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InfoCell label="Nom et prénoms" value={`${releve.candidate.lastName} ${releve.candidate.firstName}`} />
                <InfoCell label="Matricule" value={releve.candidate.matricule} mono />
                <InfoCell label="Centre" value={releve.candidate.centerName ?? '—'} />
                <InfoCell label="N° de table" value={releve.candidate.tableNumber ?? '—'} />
              </div>

              {/* Notes */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-blue-900">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[10px] font-bold text-white uppercase">
                        {isPrimary ? 'Champs de formation' : 'Discipline'}
                      </th>
                      {!isPrimary && (
                        <>
                          <th className="px-3 py-2.5 text-center text-[10px] font-bold text-white uppercase">Coef</th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-bold text-white uppercase">Note × coef</th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-bold text-white uppercase">Rang</th>
                        </>
                      )}
                      <th className="px-3 py-2.5 text-center text-[10px] font-bold text-white uppercase">Note /20</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-bold text-white uppercase">Appréciation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(releve.lines ?? []).map((line) => (
                      <tr key={line.code}>
                        <td className="px-4 py-2 text-xs font-semibold text-slate-800">{line.name}</td>
                        {!isPrimary && (
                          <>
                            <td className="px-3 py-2 text-center text-xs font-bold text-slate-600">
                              {line.coefficient}
                            </td>
                            <td className="px-3 py-2 text-center text-xs font-bold text-slate-600">
                              {line.isAbsent ? 'ABS' : fmtNote(line.noteCoef)}
                            </td>
                            <td className="px-3 py-2 text-center text-xs font-bold text-slate-600">
                              {formatRankFr(line.rankInSubject)}
                            </td>
                          </>
                        )}
                        <td className="px-3 py-2 text-center">
                          {line.isAbsent ? (
                            <span className="text-xs font-black text-red-500">ABS</span>
                          ) : (
                            <span
                              className={cn(
                                'text-xs font-black',
                                (line.score ?? 0) >= 10 ? 'text-emerald-700' : 'text-red-600',
                              )}
                            >
                              {fmtNote(line.score)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center text-[11px] text-slate-600">
                          {line.appreciation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Synthèse */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InfoCell
                  label="Moyenne"
                  value={average !== null ? `${fmtNote(average)} / 20` : '—'}
                  strong
                />
                <InfoCell
                  label="Rang"
                  value={
                    releve.rank ? `${formatRankFr(releve.rank, female)} / ${releve.totalCandidates}` : '—'
                  }
                />
                <InfoCell label="Mention" value={releve.mention} />
                <InfoCell label="Décision" value={releve.decision} strong />
              </div>

              {isPrimary ? (
                <p className="text-[11px] text-slate-500 text-center">
                  Relevé du modèle primaire — moyenne simple sur {releve.computed?.nbEval ?? 0}{' '}
                  épreuve(s), sans coefficients (identique au PDF officiel).
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 text-center">
                  Σ coefficients {fmtNote(releve.computed?.totalCoef)} · Σ notes coefficient{' '}
                  {fmtNote(releve.computed?.totalNotesCoef)} — moyenne pondérée (identique au PDF
                  officiel).
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Relevé indisponible pour ce candidat.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCell({
  label,
  value,
  mono,
  strong,
}: {
  label: string;
  value: string;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[9px] font-bold uppercase text-slate-400">{label}</p>
      <p
        className={cn(
          'text-xs mt-0.5 truncate',
          mono && 'font-mono',
          strong ? 'font-black text-blue-900' : 'font-bold text-slate-800',
        )}
      >
        {value}
      </p>
    </div>
  );
}
