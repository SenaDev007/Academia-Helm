/**
 * FederisGradeRelevesTab — Relevés de notes (⭐ 2026-10-01 : déplacé du module
 * Notes et Moyennes VERS le module Délibération — sous-onglet « Relevé de
 * notes » de chaque type d'examen CEP | BEPC | BAC | CAP, car l'envoi aux
 * écoles exige que la délibération du jury ait été lancée : les deux étapes
 * vivent désormais dans le MÊME module).
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
 * ⭐ « Envoyer aux écoles » : modale de confirmation PROFESSIONNELLE
 *    (FederisConfirmModal — remplace le window.confirm générique).
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { fmtNote } from '@/lib/federis/grade-computations';
import FederisConfirmModal from '@/components/federis/federis-confirm-modal';

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
  /** ⭐ 2026-10-01 — CEP : CM (/18), CP (/2), minimale exigée, étoile. */
  cm: number | null;
  cp: number | null;
  passingScore: number;
  perfectionnement: boolean;
  /** ⭐ BEPC / BAC / CAP — matière du groupe Français (BILAN). */
  francais: boolean;
}

interface Releve {
  academicYearLabel: string | null;
  examName: string;
  examCode: string;
  level: string;
  session: string | null;
  officialTitle: { main: string; sub: string } | null;
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
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    registrationNumber: string;
    candidatureNature: string;
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
  /** ⭐ CEP — décision du jury officielle. */
  cepAdmission: {
    matieresNotees: number;
    matieresReussies: number;
    matieresRequises: number;
    admisCep: boolean;
    admisSixieme: boolean;
    /** ⭐ Moyenne des matières étoilées (*) — base de la décision 6ème. */
    moyenneEtoiles: number | null;
    /** Matières étoilées effectivement notées. */
    matieresEtoiles: number;
  } | null;
  /** ⭐ BEPC / BAC / CAP — sous-totaux BILAN. */
  bilan: {
    hasFrancais: boolean;
    totalFrancais: number | null;
    totalEcrit: number | null;
    totalFinal: number | null;
    moyenne: number | null;
  } | null;
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
  /** ⭐ En-tête patronat du relevé officiel (bloc ministériel remplacé). */
  patronat: {
    name: string;
    abbreviation: string | null;
    territoryName: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    country: string | null;
    coordinatorName: string | null;
    place: string;
  } | null;
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
  onNeedDeliberation,
  deliberationReady,
}: {
  examId: string;
  subjectsVersion: number;
  /** ⭐ Renvoi vers l'onglet Délibération du module (l'envoi des relevés
   *    exige que la délibération du jury ait été lancée). */
  onNeedDeliberation?: () => void;
  /** ⭐ true si une délibération existe déjà pour l'examen — sinon bannière
   *    d'avertissement proactive (l'envoi aux écoles sera refusé). */
  deliberationReady?: boolean;
}) {
  const [data, setData] = useState<RelevesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<'all' | string | null>(null);
  // ⭐ Distribution des relevés aux écoles (2026-09-30) — modale professionnelle
  //    de confirmation au lieu du window.confirm générique (2026-10-01).
  const [confirmDispatch, setConfirmDispatch] = useState(false);
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

  /** ⭐ Distribution intelligente : chaque relevé part à l'école du candidat.
   *    Confirmation via modale professionnelle (FederisConfirmModal). */
  const dispatchToSchools = async () => {
    if (!data?.exam) return;
    setDispatching(true);
    setDispatchError(null);
    setDispatchNotice(null);
    try {
      const res = await apiClient.post(`/federis/exams/${examId}/releves/dispatch`, {}, { timeout: 60000 });
      setDispatchNotice(res.data?.message ?? 'Relevés envoyés aux écoles.');
      setConfirmDispatch(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setDispatchError(
        (Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Envoi impossible — l\u2019examen doit être délibéré.',
      );
      setConfirmDispatch(false);
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

  return (
    <div className="space-y-5">
      {/* ⭐ Bannière proactive : la délibération du jury n'a pas été lancée —
          l'envoi aux écoles sera refusé par le backend (règle officielle). */}
      {onNeedDeliberation && deliberationReady === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <Send className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-amber-800">
              La délibération du jury n&apos;a pas encore été lancée pour cet examen
            </p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              Les relevés peuvent être consultés et téléchargés, mais l&apos;envoi aux écoles
              exige que la délibération ait été lancée au préalable (même module).
            </p>
          </div>
          <button
            onClick={onNeedDeliberation}
            className="shrink-0 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-blue-900 text-white hover:bg-blue-800 inline-flex items-center gap-2"
          >
            Ouvrir la délibération
          </button>
        </div>
      )}

      {/* Barre d'actions */}
      <div className="fed-card px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-blue-900 uppercase flex-1">
          Relevés de notes — {data.exam.code}
          <span className="ml-3 text-[10px] text-slate-400 normal-case font-semibold">
            {isPrimary ? 'modèle officiel CEP (CM/18 + CP/2 + perfectionnement)' : 'modèle officiel BEPC/BAC/CAP (coefficients + bilan)'}
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
        {/* ⭐ Distribution : chaque relevé part à l'école du candidat (2026-09-30)
            — confirmation via modale professionnelle (2026-10-01) */}
        <button
          onClick={() => {
            setDispatchError(null);
            setConfirmDispatch(true);
          }}
          disabled={downloading !== null || dispatching}
          title="Chaque école rattachée reçoit les relevés des candidats qu'elle a présentés et est notifiée"
          className="fed-btn-gold px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50"
        >
          {dispatching ? 'Envoi en cours…' : 'Envoyer aux écoles'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">{error}</div>}
      {notice && <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 text-sm font-semibold text-emerald-800">{notice}</div>}
      {dispatchError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="flex-1">{dispatchError}</span>
          {/* ⭐ Renvoi direct vers l'onglet Délibération (même module) : l'envoi
              exige que la délibération du jury ait été lancée. */}
          {onNeedDeliberation && (
            <button
              onClick={onNeedDeliberation}
              className="shrink-0 px-4 py-2 rounded-xl text-[10px] font-bold uppercase bg-blue-900 text-white hover:bg-blue-800 inline-flex items-center gap-2"
            >
              <Send className="w-3.5 h-3.5" />
              Ouvrir la délibération
            </button>
          )}
        </div>
      )}
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

        {/* Aperçu du relevé (fidèle au PDF backend — A4 portrait) */}
        {selected && (
          <div className="space-y-4">
            <div className="fed-card px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-blue-900">
                  Aperçu — {selected.candidate.lastName} {selected.candidate.firstName}
                </p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  {isPrimary ? 'Modèle officiel CEP' : 'Modèle officiel BEPC / BAC / CAP'} · A4 portrait (identique au PDF)
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

            {/* Feuille A4 portrait simulée — relevé officiel */}
            <div className="bg-white border-2 border-slate-200 rounded-lg shadow-sm p-5 sm:p-8 overflow-x-auto">
              {isPrimary ? (
                <ReleveCepPreview releve={selected} patronat={data?.patronat ?? null} />
              ) : (
                <ReleveSecondairePreview
                  releve={selected}
                  patronat={data?.patronat ?? null}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ⭐ Modale professionnelle « Envoyer aux écoles » (remplace le
          window.confirm générique) — données clés, prérequis de délibération. */}
      <FederisConfirmModal
        open={confirmDispatch}
        title="Envoyer les relevés de notes aux écoles ?"
        message={
          <>
            Chaque école rattachée recevra les relevés de notes des candidats qu&apos;elle a
            présentés et sera notifiée immédiatement dans son espace Academia Helm.
          </>
        }
        icon={Send}
        tone="gold"
        details={[
          { label: 'Examen', value: `${data.exam.code} — ${data.exam.name}` },
          { label: 'Candidats concernés', value: releves.length },
          {
            label: 'Écoles destinataires',
            value: new Set(releves.map((r) => r.candidate.school).filter(Boolean)).size,
          },
        ]}
        note={
          <>
            L&apos;envoi exige que la <b>délibération du jury</b> ait été lancée (onglet
            « Délibération » de ce module). Un nouvel envoi actualise les documents déjà
            distribués (décisions à jour).
          </>
        }
        confirmLabel="Envoyer aux écoles"
        cancelLabel="Annuler"
        loading={dispatching}
        onConfirm={dispatchToSchools}
        onCancel={() => setConfirmDispatch(false)}
      />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// ⭐ 2026-10-01 — APERÇUS OFFICIELS (fidèles aux PDF générés par le backend)
// CEP : en-tête patronat + MATIÈRE | CEP{NOTE OBTENUE, NOTE MINIMALE EXIGÉE} |
//       NOTE DE PERFECTIONNEMENT OBTENUE + décision du jury + signature.
// BEPC/BAC/CAP : MATIÈRES | COEF. | NOTE/20 | NOTE COEF. | BILAN.
// ═══════════════════════════════════════════════════════════════════════════

interface PatronatHeader {
  name: string;
  abbreviation: string | null;
  territoryName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  coordinatorName: string | null;
  place: string;
}

/** Note officielle : 2 décimales avec zéro de tête (00.00, 01.25, 12.50). */
function fmtOfficial(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const v = Math.round(n * 100) / 100;
  return (v < 10 && v >= 0 ? '0' : '') + Math.abs(v).toFixed(2);
}

function fmtBilan(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return (Math.round(n * 100) / 100).toFixed(2);
}

function fmtNaissance(dob: string | null | undefined, place: string | null | undefined): string {
  if (!dob) return place ? `à ${place}` : '—';
  const d = new Date(dob);
  const date = Number.isNaN(d.getTime())
    ? String(dob)
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return place ? `${date} à ${place}` : date;
}

function genderShort(g: string | null | undefined): string {
  return g === 'F' || g === 'FEMALE' ? 'F' : g ? 'M' : '—';
}

function genderLong(g: string | null | undefined): string {
  return g === 'F' || g === 'FEMALE' ? 'Féminin' : g ? 'Masculin' : '—';
}

/** Bloc organisation (patronat) — remplace le bloc ministériel. */
function OrgBlock({ patronat, compact = false }: { patronat: PatronatHeader | null; compact?: boolean }) {
  const name = (patronat?.name ?? 'Patronat').toUpperCase();
  const territory = patronat?.territoryName
    ? `Département ${patronat.territoryName}`
    : patronat?.country ?? '';
  return (
    <div className="text-left">
      <div className="text-[9px] font-bold uppercase leading-snug">{name}</div>
      <div className="text-[8px] text-slate-500 my-0.5">------------------</div>
      {territory ? (
        <>
          <div className="text-[9px] font-bold uppercase leading-snug">{territory}</div>
          <div className="text-[8px] text-slate-500 my-0.5">------------------</div>
        </>
      ) : null}
      {!compact ? (
        <div className="text-[9px] font-bold uppercase leading-snug">Coordination des Examens et Concours</div>
      ) : null}
    </div>
  );
}

/** Bloc date + signature (coordonnateur du patronat). */
function SignatureBlock({ patronat }: { patronat: PatronatHeader | null }) {
  const place = patronat?.place || patronat?.territoryName || '';
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="w-[42%] ml-auto mt-6 text-center">
      <div className="text-[10px] font-bold">{place}{place ? ', ' : ''}le {date}</div>
      <div className="text-[10px] font-bold uppercase mt-1">Le Coordonnateur du Patronat</div>
      <div className="h-12" />
      <div className="text-[10px] font-bold uppercase border-t border-black mx-4 pt-1">
        {(patronat?.coordinatorName ?? '').toUpperCase()}
      </div>
    </div>
  );
}

const civilTd = 'px-2 py-1 align-top border-black';
const civilLbl = 'w-[32%] text-[8px] font-bold uppercase tracking-wide';
const civilVal = 'text-[10px] font-bold';

/** Ligne d'état civil — filets internes 1px (droite + bas), dernier rang sans
 *  bas : le cadre arrondi du tableau (border-separate) fournit les bords. */
function CivilRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <tr>
      <td className={cn(civilTd, 'border-r', !last && 'border-b')}><span className={civilLbl}>{label}</span></td>
      <td className={cn(civilTd, !last && 'border-b')}><span className={civilVal}>{value}</span></td>
    </tr>
  );
}

/** État civil du candidat — tableau à coins arrondis (6px), identique au PDF. */
function CivilTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <table className="w-full mb-4 border-separate border-spacing-0 rounded-md overflow-hidden border border-black">
      <tbody>
        {rows.map(([label, value], i) => (
          <CivilRow key={label} label={label} value={value} last={i === rows.length - 1} />
        ))}
      </tbody>
    </table>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Aperçu — RELEVÉ OFFICIEL DU CEP
// ═══════════════════════════════════════════════════════════════════════════

function ReleveCepPreview({ releve, patronat }: { releve: Releve; patronat: PatronatHeader | null }) {
  const c = releve.candidate;
  const adm = releve.cepAdmission;
  const nbMatieres = releve.lines.length;
  const title = releve.officialTitle ?? { main: "CERTIFICAT D'ÉTUDES PRIMAIRES", sub: '(C.E.P.)' };

  return (
    <div className="min-w-[680px] max-w-[760px] mx-auto text-black" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      {/* En-tête officiel : patronat (gauche) + titres (centre) */}
      <table className="w-full border-collapse mb-2">
        <tbody>
          <tr>
            <td className="w-[34%] align-top px-1"><OrgBlock patronat={patronat} /></td>
            <td className="w-[46%] align-top text-center px-1">
              <div className="text-[16px] font-bold tracking-wide">RELEVE DE NOTES</div>
              <div className="text-[14px] font-bold mt-1">{title.main}</div>
              <div className="text-[12px] font-bold">{title.sub}</div>
              <div className="text-[10px] font-bold mt-2">{releve.session ?? ''}</div>
            </td>
            <td className="w-[20%]" />
          </tr>
        </tbody>
      </table>
      <div className="text-[10px] font-bold mb-3">
        N° {c.registrationNumber ?? c.matricule}/{releve.examCode}
      </div>

      {/* État civil — coins arrondis */}
      <CivilTable
        rows={[
          ['NOM', c.lastName.toUpperCase()],
          ['PRÉNOMS', c.firstName || '—'],
          ['SEXE', genderShort(c.gender)],
          ['MATRICULE', c.matricule],
          ['DATE ET LIEU DE NAISSANCE', fmtNaissance(c.dateOfBirth, c.placeOfBirth)],
          ['CENTRE DE COMPOSITION', c.centerName ?? '—'],
          ["NUMÉRO D'INSCRIPTION", c.registrationNumber ?? c.matricule],
          ['NATURE DE LA CANDIDATURE', c.candidatureNature ?? 'Officiel'],
        ]}
      />

      {/* Tableau officiel CEP — coins arrondis (8px), cadre 2px, filets 1px */}
      <table className="w-full border-separate border-spacing-0 rounded-lg overflow-hidden border-2 border-black">
        <thead>
          <tr>
            <th rowSpan={2} className="border-r border-b border-black px-2 py-1.5 text-[10px] font-bold uppercase text-left">Matière</th>
            <th colSpan={2} className="border-r border-b border-black px-2 py-1.5 text-[10px] font-bold uppercase">CEP</th>
            <th rowSpan={2} className="border-b border-black px-2 py-1.5 text-[10px] font-bold uppercase w-[18%]">Note de perfection-<br />nement obtenue</th>
          </tr>
          <tr>
            <th className="border-r border-b border-black px-2 py-1 text-[9px] font-bold uppercase">Note obtenue</th>
            <th className="border-r border-b border-black px-2 py-1 text-[9px] font-bold uppercase">Note minimale exigée</th>
          </tr>
        </thead>
        <tbody>
          {releve.lines.map((line, i) => {
            const minReq = line.passingScore ?? 10;
            const ok = line.score !== null && line.score >= minReq;
            const rowB = i < releve.lines.length - 1 ? 'border-b' : '';
            return (
              <tr key={line.subjectId}>
                <td className={cn('border-r border-black px-2 py-1 text-[10px] font-bold', rowB)}>
                  {line.name}{line.perfectionnement ? ' *' : ''}
                </td>
                <td className={cn('border-r border-black px-2 py-1 text-center text-[11px] font-bold', ok ? 'text-emerald-700' : 'text-red-700', rowB)}>
                  {line.isAbsent ? <span className="text-red-600 text-[9px]">ABS</span> : fmtOfficial(line.cm ?? line.score)}
                </td>
                <td className={cn('border-r border-black px-2 py-1 text-center text-[10px]', rowB)}>
                  {String(minReq).replace('.', ',')}
                </td>
                <td className={cn('border-black px-2 py-1 text-center text-[11px] font-bold', line.cp != null && line.cp > 0 ? 'text-emerald-700' : '', rowB)}>
                  {line.isAbsent ? <span className="text-red-600 text-[9px]">ABS</span> : fmtOfficial(line.cp)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Décision du jury — coins arrondis (6px) */}
      <table className="w-[78%] mx-auto mt-5 border-separate border-spacing-0 rounded-md overflow-hidden border-2 border-black">
        <tbody>
          <tr>
            <th colSpan={2} className="border-b border-black px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest">Décision du jury</th>
          </tr>
          <tr>
            <td className="border-r border-b border-black px-3 py-1 text-[10px] font-bold">CERTIFICAT D'ÉTUDES PRIMAIRES</td>
            <td className={cn('px-3 py-1 text-center text-[11px] font-bold uppercase', adm?.admisCep ? 'text-emerald-700' : 'text-red-700')}>
              {adm?.admisCep ? 'Admis' : 'Ajourné(e)'}
            </td>
          </tr>
          <tr>
            <td className="border-r border-black px-3 py-1 text-[10px] font-bold">ENTRÉE EN SIXIÈME</td>
            <td
              title={
                adm?.moyenneEtoiles != null
                  ? `Moyenne des matières * : ${String(adm.moyenneEtoiles).replace('.', ',')}/20 (admission ≥ 10/20)`
                  : undefined
              }
              className={cn('px-3 py-1 text-center text-[11px] font-bold uppercase', adm?.admisSixieme ? 'text-emerald-700' : 'text-red-700')}
            >
              {adm?.admisSixieme ? 'Admis' : 'Ajourné(e)'}
            </td>
          </tr>
        </tbody>
      </table>

      <SignatureBlock patronat={patronat} />

      <div className="border-t border-black mt-4 pt-2 space-y-1">
        <p className="text-[8px] text-justify leading-snug">
          Est déclaré(e) admis(e) au CEP tout(e) candidat(e) ayant obtenu la note minimale exigée dans au moins {adm?.matieresRequises ?? 6} des {nbMatieres || 9} matières.
        </p>
        <p className="text-[8px] text-justify leading-snug">
          Est déclaré(e) admis(e) à l'entrée en 6ème tout(e) candidat(e) ayant obtenu une moyenne au moins égale à dix (10) sur 20 dans les trois (03) matières marquées d'un astérisque (*).
        </p>
        <p className="text-[8px] text-justify leading-snug">
          La note de perfectionnement n'est attribuée que quand le (la) candidat(e) a obtenu la note minimale exigée.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Aperçu — RELEVÉ OFFICIEL BEPC / BAC / CAP (MATIÈRES | COEF. | NOTE/20 |
// NOTE COEF. | BILAN)
// ═══════════════════════════════════════════════════════════════════════════

function ReleveSecondairePreview({ releve, patronat }: { releve: Releve; patronat: PatronatHeader | null }) {
  const c = releve.candidate;
  const bilan = releve.bilan;
  const title = releve.officialTitle ?? { main: releve.examName, sub: '' };
  const lines = releve.lines;

  // Entrées BILAN empilées (modèle officiel).
  const bilanEntries: Array<{ label: string; value: string }> = [];
  if (bilan?.hasFrancais) {
    bilanEntries.push({ label: 'Total Français', value: fmtBilan(bilan.totalFrancais) });
  }
  bilanEntries.push({ label: 'Total Écrit', value: fmtBilan(bilan?.totalEcrit ?? null) });
  bilanEntries.push({ label: 'Total Final', value: fmtBilan(bilan?.totalFinal ?? null) });
  bilanEntries.push({ label: 'Moyenne', value: fmtBilan(bilan?.moyenne ?? null) });

  const lastFrenchIdx = lines.reduce((acc, l, i) => (l.francais ? i : acc), -1);
  const startRow = Math.max(0, Math.min(lastFrenchIdx + 1, Math.max(0, lines.length - bilanEntries.length)));
  const bilanByRow = new Map<number, { label: string; value: string }>();
  bilanEntries.forEach((e, i) => bilanByRow.set(startRow + i, e));

  return (
    <div className="min-w-[680px] max-w-[760px] mx-auto text-black" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      {/* En-tête officiel : patronat (gauche) + titres (centre) + session (droite) */}
      <table className="w-full border-collapse mb-2">
        <tbody>
          <tr>
            <td className="w-[30%] align-top px-1"><OrgBlock patronat={patronat} compact /></td>
            <td className="w-[48%] align-middle text-center px-1">
              <div className="text-[16px] font-bold tracking-wide">RELEVÉ DE NOTES</div>
              <div className="text-[9px] italic mt-0.5">Tenant lieu d'attestation provisoire valable 12 mois</div>
              <div className="text-[13px] font-bold mt-1">
                {title.main} {title.sub ? <span className="text-[11px]">{title.sub}</span> : null}
              </div>
            </td>
            <td className="w-[22%] align-middle text-right px-1 text-[10px] font-bold">
              {releve.session ?? ''}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="text-[10px] font-bold mb-3">
        N° {c.registrationNumber ?? c.matricule}/{releve.examCode}
      </div>

      {/* État civil — coins arrondis */}
      <CivilTable
        rows={[
          ['NOM', c.lastName.toUpperCase()],
          ['PRÉNOMS', c.firstName || '—'],
          ['SEXE', genderLong(c.gender)],
          ['MATRICULE', c.matricule],
          ['DATE ET LIEU DE NAISSANCE', fmtNaissance(c.dateOfBirth, c.placeOfBirth)],
          ['CENTRE DE COMPOSITION', c.centerName ?? '—'],
          ["NUMÉRO D'INSCRIPTION", c.registrationNumber ?? c.matricule],
        ]}
      />

      {/* Tableau officiel secondaire — coins arrondis (8px), cadre 2px, filets 1px */}
      <table className="w-full border-separate border-spacing-0 rounded-lg overflow-hidden border-2 border-black">
        <thead>
          <tr>
            <th className="border-r border-b border-black px-2 py-1.5 text-[10px] font-bold uppercase text-left">Matières</th>
            <th className="border-r border-b border-black px-2 py-1.5 text-[10px] font-bold uppercase w-[9%]">Coef.</th>
            <th className="border-r border-b border-black px-2 py-1.5 text-[10px] font-bold uppercase w-[12%]">Note/20</th>
            <th className="border-r border-b border-black px-2 py-1.5 text-[10px] font-bold uppercase w-[14%]">Note coef.</th>
            <th className="border-b border-black px-2 py-1.5 text-[10px] font-bold uppercase w-[20%]">Bilan</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const bilanCell = bilanByRow.get(i);
            const rowB = i < lines.length - 1 ? 'border-b' : '';
            return (
              <tr key={line.subjectId}>
                <td className={cn('border-r border-black px-2 py-1 text-[10px] font-bold', rowB)}>{line.name}</td>
                <td className={cn('border-r border-black px-2 py-1 text-center text-[10px] font-bold', rowB)}>
                  {String(line.coefficient ?? 1).replace('.', ',')}
                </td>
                <td className={cn('border-r border-black px-2 py-1 text-center text-[11px] font-bold', rowB)}>
                  {line.isAbsent ? <span className="text-red-600 text-[9px]">ABS</span> : fmtOfficial(line.score)}
                </td>
                <td className={cn('border-r border-black px-2 py-1 text-center text-[11px] font-bold', rowB)}>
                  {line.isAbsent ? <span className="text-red-600 text-[9px]">ABS</span> : fmtOfficial(line.noteCoef)}
                </td>
                <td className={cn('px-2 py-1 text-center border-black', rowB)}>
                  {bilanCell ? (
                    <div>
                      <div className="text-[8px] font-bold uppercase">{bilanCell.label}</div>
                      <div className="text-[12px] font-bold">{bilanCell.value}</div>
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Décision du jury — coins arrondis (6px) */}
      <table className="w-[78%] mx-auto mt-5 border-separate border-spacing-0 rounded-md overflow-hidden border-2 border-black">
        <tbody>
          <tr>
            <th colSpan={2} className="border-b border-black px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest">Décision du jury</th>
          </tr>
          <tr>
            <td className="border-r border-black px-3 py-1 text-[10px] font-bold">MOYENNE : {fmtBilan(bilan?.moyenne ?? releve.computed?.finalAverage ?? null)}/20</td>
            <td className={cn('px-3 py-1 text-center text-[11px] font-bold uppercase', releve.decision === 'ADMIS' ? 'text-emerald-700' : 'text-red-700')}>
              {releve.decision === 'ADMIS' ? 'Admis' : 'Ajourné(e)'}
            </td>
          </tr>
        </tbody>
      </table>

      <SignatureBlock patronat={patronat} />
    </div>
  );
}
