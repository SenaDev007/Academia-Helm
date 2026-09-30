/**
 * FederisPublicResultsClient — ⭐ T26 (2026-10-01)
 * Portail PUBLIC PROVISOIRE de consultation des résultats (parents)
 * ═══════════════════════════════════════════════════════════════════════════
 * Page servie sur /federis/resultats/:token (sans compte, sans connexion) —
 * le token fait foi (généré par le patronat à la publication des résultats,
 * durée de vie paramétrable, révocable à tout moment).
 *
 *   1. Écran d'accueil  : examen, session, patronat, stats, expiration du lien ;
 *   2. Recherche        : UN champ unique — nom de l'élève, matricule OU
 *                         numéro de table (insensible casse/accents) ;
 *   3. Fiche résultat   : état civil utile, notes par matière, moyenne, rang,
 *                         mention, DÉCISION FINALE (Admis / Ajourné) et, pour
 *                         le CEP, les décisions « Admis au CEP » + « Admis en
 *                         6ème » (moyenne des matières étoilées ≥ 10/20).
 *
 * Mobile-first (les parents consultent depuis un téléphone) — aux couleurs
 * institutionnelles Federis (navy / or).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Clock,
  Award,
  Users,
  TrendingUp,
  ArrowLeft,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { fmtNote } from '@/lib/federis/grade-computations';

// ─── Types (réponses API publiques) ─────────────────────────────────────────

interface PublicInfo {
  link: { expiresAt: string; durationHours: number | null };
  exam: {
    code: string;
    name: string;
    examType: string;
    level: string;
    session: string | null;
    academicYearLabel: string | null;
  };
  patronat: {
    name: string;
    abbreviation: string | null;
    territoryName: string | null;
    country: string | null;
  };
  stats: { totalCandidates: number; admitted: number; failed: number; successRate: number | null };
}

interface ResultLine {
  code: string;
  name: string;
  score: number | null;
  isAbsent: boolean;
  coefficient: number;
  maxScore: number;
  cm: number | null;
  cp: number | null;
  perfectionnement: boolean;
}

interface LookupCandidate {
  matricule: string;
  tableNumber: string | null;
  fullName: string;
  gender: string | null;
  school: string;
  centerName: string | null;
  average: number | null;
  rank: number | null;
  nbEval: number;
  mention: string | null;
  decision: 'ADMIS' | 'AJOURNE' | null;
  decisionLabel: string | null;
  cepAdmission: {
    admisCep: boolean;
    admisSixieme: boolean;
    moyenneEtoiles: number | null;
    matieresEtoiles: number;
  } | null;
  lines: ResultLine[];
}

interface LookupResponse {
  exam: { code: string; name: string; examType: string; session: string | null };
  total: number;
  truncated: boolean;
  results: LookupCandidate[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDateFr(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function extractApiError(err: any, fallback: string): string {
  const msg = err?.response?.data?.message;
  return (Array.isArray(msg) ? msg.join(' ') : msg) ?? fallback;
}

// ─── Composant ──────────────────────────────────────────────────────────────

export default function FederisPublicResultsClient({ token }: { token: string }) {
  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  const [term, setTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<LookupResponse | null>(null);
  const [selected, setSelected] = useState<LookupCandidate | null>(null);

  // ── 1. Chargement des infos du lien ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get(`/federis/public/results/${token}`, {
          timeout: 30000,
        });
        if (!cancelled) setInfo(res.data);
      } catch (err: any) {
        if (!cancelled) setLoadError(extractApiError(err, 'Lien de consultation introuvable.'));
      } finally {
        if (!cancelled) setLoadingInfo(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // ── 2. Recherche d'un élève ──────────────────────────────────────────────
  const runSearch = useCallback(async () => {
    const q = term.trim();
    if (q.length < 2) {
      setSearchError('Indiquez au moins 2 caractères : nom, matricule ou numéro de table.');
      return;
    }
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    try {
      const res = await apiClient.get(`/federis/public/results/${token}/lookup`, {
        params: { q },
        timeout: 30000,
      });
      setLookup(res.data);
    } catch (err: any) {
      setLookup(null);
      setSearchError(extractApiError(err, 'Recherche impossible — réessayez.'));
    } finally {
      setSearching(false);
    }
  }, [term, token]);

  // ── Écrans d'état ────────────────────────────────────────────────────────

  if (loadingInfo) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 px-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-900" />
        <p className="text-sm font-bold text-slate-500">
          Vérification du lien de consultation…
        </p>
      </div>
    );
  }

  if (loadError || !info) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-5 px-4 py-16">
        <span className="w-20 h-20 rounded-3xl bg-red-50 border border-red-100 flex items-center justify-center">
          <ShieldOff className="w-10 h-10 text-red-500" />
        </span>
        <div className="text-center max-w-md space-y-2">
          <h1 className="text-xl font-black text-slate-900">Lien indisponible</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            {loadError ??
              'Ce lien de consultation est introuvable. Vérifiez l’adresse saisie ou contactez le patronat organisateur.'}
          </p>
          <p className="text-[11px] text-slate-400">
            Academia Federis — consultation officielle des résultats d’examens
          </p>
        </div>
      </div>
    );
  }

  const isCep = info.exam.examType === 'CEP';
  const admitted = selected?.decision === 'ADMIS';

  // ── Écran principal ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-white pb-16">
      {/* ── Bandeau institutionnel ── */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-amber-400/95 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6 text-blue-900" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                Academia Federis
              </p>
              <p className="text-sm font-bold leading-tight">
                {info.patronat.name}
                {info.patronat.territoryName ? ` — ${info.patronat.territoryName}` : ''}
              </p>
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black leading-tight">
              Consultation des résultats
            </h1>
            <p className="text-sm text-blue-100 mt-1.5 font-semibold">
              {info.exam.name}
              {info.exam.session ? ` · ${info.exam.session}` : ''}
              {info.exam.academicYearLabel ? ` · ${info.exam.academicYearLabel}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-blue-100/90">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>
              Résultats officiellement publiés — lien de consultation valable jusqu’au{' '}
              <b className="text-white">{fmtDateFr(info.link.expiresAt)}</b>
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 -mt-5 space-y-6">
        {/* ── Statistiques de la session ── */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-3 py-3.5 text-center">
            <Users className="w-4 h-4 text-slate-400 mx-auto mb-1.5" />
            <p className="text-lg sm:text-xl font-black text-slate-900">
              {info.stats.totalCandidates}
            </p>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">
              Candidats
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm px-3 py-3.5 text-center">
            <Award className="w-4 h-4 text-emerald-500 mx-auto mb-1.5" />
            <p className="text-lg sm:text-xl font-black text-emerald-700">
              {info.stats.admitted}
            </p>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">
              Admis(e)s
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-100 shadow-sm px-3 py-3.5 text-center">
            <TrendingUp className="w-4 h-4 text-amber-500 mx-auto mb-1.5" />
            <p className="text-lg sm:text-xl font-black text-blue-900">
              {info.stats.successRate != null ? `${fmtNote(info.stats.successRate)} %` : '—'}
            </p>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">
              Taux de réussite
            </p>
          </div>
        </div>

        {/* ── Fiche résultat d'un candidat ── */}
        {selected ? (
          <CandidateSheet
            candidate={selected}
            isCep={isCep}
            onBack={() => setSelected(null)}
          />
        ) : (
          <>
            {/* ── Formulaire de recherche ── */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-5 sm:p-7 space-y-4">
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Vérifier le résultat d’un candidat
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Saisissez le <b>nom de l’élève</b>, son <b>matricule</b> ou son{' '}
                  <b>numéro de table</b> — la recherche ignore la casse et les accents.
                </p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void runSearch();
                }}
                className="flex flex-col sm:flex-row gap-2.5"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    placeholder="ex. KORA Aline, 26C0001234 ou 045"
                    autoFocus
                    maxLength={120}
                    className="w-full rounded-xl border border-slate-300 pl-10 pr-3.5 py-3 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="rounded-xl bg-blue-900 px-6 py-3 text-xs font-black uppercase tracking-wide text-white hover:bg-blue-800 disabled:opacity-50 inline-flex items-center justify-center gap-2 shrink-0 transition-colors"
                >
                  {searching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  {searching ? 'Recherche…' : 'Rechercher'}
                </button>
              </form>
              {searchError && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs font-semibold text-amber-800">
                  {searchError}
                </div>
              )}
            </div>

            {/* ── Résultats de recherche ── */}
            {lookup && (
              <div className="space-y-3">
                {lookup.results.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm px-6 py-10 text-center">
                    <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-700">
                      Aucun candidat ne correspond à cette recherche.
                    </p>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Vérifiez l’orthographe du nom, ou essayez le matricule / numéro de
                      table figurant sur la convocation.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      {lookup.total} candidat(s) trouvé(s)
                      {lookup.truncated ? ' — affichage limité aux 20 premiers, précisez la recherche' : ''}
                    </p>
                    {lookup.results.map((c) => (
                      <button
                        key={c.matricule}
                        onClick={() => setSelected(c)}
                        className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-blue-900/40 hover:shadow-md transition-all px-4 sm:px-5 py-4 flex items-center gap-4"
                      >
                        <span
                          className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                            c.decision === 'ADMIS'
                              ? 'bg-emerald-50 text-emerald-600'
                              : c.decision === 'AJOURNE'
                                ? 'bg-red-50 text-red-500'
                                : 'bg-slate-100 text-slate-400',
                          )}
                        >
                          {c.decision === 'ADMIS' ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : c.decision === 'AJOURNE' ? (
                            <XCircle className="w-5 h-5" />
                          ) : (
                            <Info className="w-5 h-5" />
                          )}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-black text-slate-900 truncate">
                            {c.fullName}
                          </span>
                          <span className="block text-[11px] text-slate-500 font-semibold truncate">
                            Matricule {c.matricule}
                            {c.tableNumber ? ` · Table ${c.tableNumber}` : ''}
                            {c.school && c.school !== '—' ? ` · ${c.school}` : ''}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'px-3 py-1.5 rounded-full text-[9px] font-black uppercase shrink-0',
                            c.decision === 'ADMIS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : c.decision === 'AJOURNE'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {c.decision === 'ADMIS'
                            ? 'Admis(e)'
                            : c.decision === 'AJOURNE'
                              ? 'Ajourné(e)'
                              : 'À préciser'}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Pied institutionnel ── */}
        <p className="text-center text-[10px] text-slate-400 leading-relaxed pt-2">
          Résultats officiels publiés par {info.patronat.name} — consultation fournie par
          Academia Federis (Academia Helm). En cas d’écart, seul le relevé officiel délivré
          par le patronat fait foi.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Fiche résultat complète d'un candidat
// ═══════════════════════════════════════════════════════════════════════════

function CandidateSheet({
  candidate,
  isCep,
  onBack,
}: {
  candidate: LookupCandidate;
  isCep: boolean;
  onBack: () => void;
}) {
  const admitted = candidate.decision === 'ADMIS';
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
      {/* Bandeau décision */}
      <div
        className={cn(
          'px-5 sm:px-7 py-6 space-y-3',
          admitted
            ? 'bg-gradient-to-r from-emerald-600 to-emerald-500'
            : 'bg-gradient-to-r from-red-600 to-red-500',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
              Décision du jury
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight mt-1">
              {admitted ? 'Admis(e)' : 'Ajourné(e)'}
            </h2>
            {candidate.decisionLabel && (
              <p className="text-xs text-white/90 font-semibold mt-1">
                {candidate.decisionLabel}
              </p>
            )}
          </div>
          {admitted ? (
            <ShieldCheck className="w-10 h-10 text-white/90 shrink-0" />
          ) : (
            <XCircle className="w-10 h-10 text-white/90 shrink-0" />
          )}
        </div>
      </div>

      <div className="p-5 sm:p-7 space-y-6">
        {/* Identité */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SheetField label="Nom et prénoms" value={candidate.fullName} wide />
          <SheetField label="Matricule" value={candidate.matricule} mono />
          <SheetField
            label="N° de table"
            value={candidate.tableNumber ?? '—'}
            mono
          />
          <SheetField label="École de provenance" value={candidate.school} wide />
          {candidate.centerName && (
            <SheetField label="Centre d’examen" value={candidate.centerName} wide />
          )}
        </div>

        {/* Résumé */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 px-3 py-3 text-center">
            <p className="text-xl font-black text-blue-900">
              {candidate.average != null ? fmtNote(candidate.average) : '—'}
            </p>
            <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">
              Moyenne /20
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 px-3 py-3 text-center">
            <p className="text-xl font-black text-blue-900">
              {candidate.rank ?? '—'}
              <span className="text-xs font-bold text-slate-400">
                {candidate.rank ? 'ᵉ' : ''}
              </span>
            </p>
            <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Rang</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 px-3 py-3 text-center">
            <p className="text-[13px] font-black text-blue-900 leading-tight mt-1">
              {candidate.mention ?? '—'}
            </p>
            <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Mention</p>
          </div>
        </div>

        {/* ⭐ CEP — décisions officielles (admission CEP + entrée en 6ème) */}
        {isCep && candidate.cepAdmission && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 space-y-2.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-blue-900">
              Décisions officielles du CEP
            </p>
            <div className="flex flex-wrap gap-2">
              <DecisionPill
                ok={candidate.cepAdmission.admisCep}
                labelOk="Admis(e) au CEP"
                labelKo="Non admis(e) au CEP"
              />
              <DecisionPill
                ok={candidate.cepAdmission.admisSixieme}
                labelOk="Admis(e) en 6ème"
                labelKo="Non admis(e) en 6ème"
              />
            </div>
            {candidate.cepAdmission.moyenneEtoiles != null && (
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Moyenne des matières marquées d’un astérisque (*) :{' '}
                <b className="text-blue-900">
                  {fmtNote(candidate.cepAdmission.moyenneEtoiles)}/20
                </b>{' '}
                — admission en 6ème si cette moyenne est au moins égale à 10/20.
              </p>
            )}
          </div>
        )}

        {/* Notes par matière */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">
            Notes par matière
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3.5 py-2.5 text-left text-[9px] font-black text-slate-400 uppercase">
                    Matière
                  </th>
                  <th className="px-3 py-2.5 text-center text-[9px] font-black text-slate-400 uppercase">
                    {isCep ? 'Note /20' : 'Coef.'}
                  </th>
                  <th className="px-3 py-2.5 text-center text-[9px] font-black text-slate-400 uppercase">
                    {isCep ? 'Détail' : 'Note /20'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {candidate.lines.map((l) => (
                  <tr key={l.code} className={l.isAbsent ? 'bg-slate-50/60' : ''}>
                    <td className="px-3.5 py-2.5">
                      <span className="text-xs font-bold text-slate-800">
                        {l.name}
                        {l.perfectionnement ? ' *' : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isCep ? (
                        <span
                          className={cn(
                            'text-xs font-black',
                            l.isAbsent ? 'text-slate-400' : 'text-slate-800',
                          )}
                        >
                          {l.isAbsent ? 'ABS' : fmtNote(l.score)}
                        </span>
                      ) : (
                        <span className="text-xs font-black text-slate-500">
                          ×{fmtNote(l.coefficient)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isCep ? (
                        <span className="text-[10px] font-semibold text-slate-500">
                          {l.isAbsent
                            ? '—'
                            : `${fmtNote(l.cm)} + ${fmtNote(l.cp)} (perf.)`}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'text-xs font-black',
                            l.isAbsent ? 'text-slate-400' : 'text-slate-800',
                          )}
                        >
                          {l.isAbsent ? 'ABS' : fmtNote(l.score)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isCep && (
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              Au CEP, la note /20 d’une matière se décompose en note obtenue (CM /18) et
              note de perfectionnement (CP /2) ; les matières marquées d’un astérisque (*)
              déterminent l’admission en 6ème.
            </p>
          )}
        </div>

        <button
          onClick={onBack}
          className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-xs font-black uppercase tracking-wide text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Nouvelle recherche
        </button>
      </div>
    </div>
  );
}

function SheetField({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={cn('min-w-0', wide && 'col-span-2')}>
      <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          'text-sm font-bold text-slate-900 mt-0.5 truncate',
          mono && 'font-mono text-xs',
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function DecisionPill({ ok, labelOk, labelKo }: { ok: boolean; labelOk: string; labelKo: string }) {
  return (
    <span
      className={cn(
        'px-3 py-1.5 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1.5',
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700',
      )}
    >
      {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {ok ? labelOk : labelKo}
    </span>
  );
}
