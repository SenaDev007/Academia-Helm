/**
 * FederisDeliberationsPage — Workflow délibération → publication → notifications
 * ═══════════════════════════════════════════════════════════════════════════
 * REFONTE DESIGN WinAgro-inspired + workflow réel complet (2026-09-27) :
 *
 *   1. Saisie des notes      — collage par lot (matricule;matière;note) avec
 *                              couverture par matière (ExamResult DRAFT)
 *   2. Simulation            — seuils admission/rachat, distribution + mentions
 *   3. Délibération (jury)   — lancement, cas limites à trancher, clôture
 *   4. Publication           — validation finale (coordonnateur) + notifications
 *                              parents + consultation des résultats publiés
 *
 * Miroir offline : chaque chargement est miroiré (IndexedDB/SQLite) et servi
 * en repli hors connexion avec bandeau « Miroir ».
 *
 * Rôles : délibération = coordonnateur/secrétaire/organisateur ;
 * publication = coordonnateur uniquement (gardes API + UI).
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  Gavel,
  CheckCircle2,
  XCircle,
  Loader2,
  Upload,
  PlayCircle,
  Send,
  Lock,
  RefreshCw,
  Database,
  Award,
  AlertTriangle,
  FileCheck2,
} from 'lucide-react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { useFederisExams } from '@/hooks/useFederisExams';
import { federisMirror, MIRROR_KEYS } from '@/lib/federis/federis-mirror.service';
import {
  FedPage,
  FedSectionTitle,
  FedCountUp,
} from '@/components/federis/federis-motion';

// ── Types ───────────────────────────────────────────────────────────────────

interface DeliberationSubject {
  id: string;
  code: string;
  name: string;
  coefficient: number;
  maxScore: number;
  passingScore: number | null;
}

interface DeliberationCaseItem {
  id: string;
  reason: string;
  decision: string;
  comments: string | null;
  candidate: { id: string; matricule: string; firstName: string; lastName: string };
  average: number | null;
}

interface DeliberationItem {
  id: string;
  juryName: string | null;
  deliberatedAt: string;
  status: string;
  totalCandidates: number;
  passedCount: number;
  failedCount: number;
  successRate: number;
  thresholds: { passMark: number; rescueMark: number } | null;
  publication: { publishedAt: string; publishedBy: string } | null;
  pendingCases: number;
  cases: DeliberationCaseItem[];
}

interface DeliberationState {
  exam: { id: string; code: string; name: string; level: string; status: string; candidatesCount: number };
  subjects: DeliberationSubject[];
  readiness: {
    totalCandidates: number;
    complete: number;
    partial: number;
    missing: number;
    resultsEntered: number;
    totalExpected: number;
  };
  deliberations: DeliberationItem[];
}

interface SimulationResult {
  thresholds: { passMark: number; rescueMark: number };
  distribution: {
    admitted: number;
    rescuePending: number;
    failed: number;
    incomplete: number;
    total: number;
    decided: number;
  };
  successRate: number;
  mentions: Record<string, number>;
  rescueSample: { matricule: string; name: string; average: number }[];
}

interface ResultsState {
  exam: { id: string; code: string; name: string; status: string };
  published: boolean;
  candidates: {
    matricule: string;
    name: string;
    scores: { subject: string; code: string; score: number; coefficient: number }[];
    status: string;
    finalDecision: string | null;
    finalAverage: number | null;
    mention: string | null;
  }[];
}

type TabKey = 'notes' | 'simulation' | 'jury' | 'results';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Clôturée',
  PUBLISHED: 'Publiée',
};

// ── Composant ───────────────────────────────────────────────────────────────

export default function FederisDeliberationsPage() {
  const { exams, examId, setExamId, selectedExam, loading: examsLoading } = useFederisExams();
  const [tab, setTab] = useState<TabKey>('notes');
  const [state, setState] = useState<DeliberationState | null>(null);
  const [fromMirror, setFromMirror] = useState(false);
  const [mirrorAt, setMirrorAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Saisie des notes
  const [scoresText, setScoresText] = useState('');

  // Simulation
  const [passMark, setPassMark] = useState(10);
  const [rescueMark, setRescueMark] = useState(9.5);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);

  // Délibération
  const [juryName, setJuryName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [caseComments, setCaseComments] = useState<Record<string, string>>({});

  // Résultats
  const [results, setResults] = useState<ResultsState | null>(null);

  // ── Chargement de l'état (avec miroir offline) ────────────────────────────
  const load = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/federis/exams/${examId}/deliberation`, { timeout: 25000 });
      setState(res.data);
      setFromMirror(false);
      setMirrorAt(new Date().toISOString());
      // ⭐ Miroir offline — snapshot après chaque chargement réussi
      await federisMirror.saveSnapshot(MIRROR_KEYS.deliberation(examId), res.data);
    } catch (err: any) {
      // ⭐ Repli miroir (IndexedDB/SQLite) si l'API est injoignable
      const entry = await federisMirror.loadSnapshot<DeliberationState>(
        MIRROR_KEYS.deliberation(examId),
      );
      if (entry) {
        setState(entry.data);
        setFromMirror(true);
        setMirrorAt(entry.syncedAt);
      } else {
        setError(err?.response?.data?.message ?? 'Impossible de charger la délibération.');
      }
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Chargement des résultats (onglet résultats, avec miroir) ─────────────
  const loadResults = useCallback(async () => {
    if (!examId) return;
    try {
      const res = await apiClient.get(`/federis/exams/${examId}/results`, { timeout: 25000 });
      setResults(res.data);
      await federisMirror.saveSnapshot(MIRROR_KEYS.results(examId), res.data);
    } catch {
      const entry = await federisMirror.loadSnapshot<ResultsState>(MIRROR_KEYS.results(examId));
      if (entry) setResults(entry.data);
    }
  }, [examId]);

  useEffect(() => {
    if (tab === 'results') void loadResults();
  }, [tab, loadResults]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const runAction = async (key: string, fn: () => Promise<any>, okMsg: string) => {
    setBusy(key);
    setActionMsg(null);
    try {
      await fn();
      setActionMsg({ type: 'ok', text: okMsg });
      await load();
    } catch (err: any) {
      setActionMsg({
        type: 'err',
        text: err?.response?.data?.message ?? 'L\u2019opération a échoué.',
      });
    } finally {
      setBusy(null);
    }
  };

  const submitScores = () =>
    runAction(
      'scores',
      async () => {
        // Analyse des lignes « matricule;matière;note » (séparateurs ; , ou tab)
        const rows = scoresText
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .map((line) => {
            const parts = line.split(/[;,\t]/).map((p) => p.trim());
            return {
              matricule: parts[0] ?? '',
              subjectCode: parts[1] ?? '',
              score: Number(parts[2]),
            };
          })
          .filter((r) => r.matricule && r.subjectCode && !Number.isNaN(r.score));
        if (rows.length === 0) throw new Error('Aucune ligne valide détectée.');
        return apiClient.post(`/federis/exams/${examId}/results/bulk`, { rows });
      },
      'Notes enregistrées avec succès.',
    ).then(() => setScoresText(''));

  const runSimulation = async () => {
    setSimulating(true);
    setActionMsg(null);
    try {
      const res = await apiClient.post(
        `/federis/exams/${examId}/deliberation/simulate`,
        { passMark, rescueMark },
        { timeout: 25000 },
      );
      setSimulation(res.data);
    } catch (err: any) {
      setActionMsg({
        type: 'err',
        text: err?.response?.data?.message ?? 'Simulation impossible.',
      });
    } finally {
      setSimulating(false);
    }
  };

  const latestDeliberation = state?.deliberations?.[0] ?? null;
  const readinessPct =
    state && state.readiness.totalExpected > 0
      ? Math.round((state.readiness.resultsEntered / state.readiness.totalExpected) * 100)
      : 0;

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'notes', label: 'Saisie des notes', icon: <ClipboardList className="w-4 h-4" /> },
    { key: 'simulation', label: 'Simulation', icon: <PlayCircle className="w-4 h-4" /> },
    {
      key: 'jury',
      label: 'Délibération & Jury',
      icon: <Gavel className="w-4 h-4" />,
      badge: latestDeliberation?.pendingCases ?? 0,
    },
    { key: 'results', label: 'Résultats & Publication', icon: <FileCheck2 className="w-4 h-4" /> },
  ];

  return (
    <FedPage className="space-y-8">
      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="fed-badge mb-3">Module délibérations</div>
          <h1 className="text-2xl md:text-3xl font-black text-[#0b1d3a] tracking-tight">
            Délibérations & Rachat
          </h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            Saisissez les notes, simulez les seuils, délibérez puis publiez les résultats officiels.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sélecteur d'examen */}
          <select
            value={examId ?? ''}
            onChange={(e) => setExamId(e.target.value)}
            className="fed-input-light !w-auto font-bold cursor-pointer"
          >
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code} — {e.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => void load()}
            className="p-2.5 rounded-full bg-white border border-blue-100 text-[#1e3a8a] hover:bg-[#eff6ff] transition-colors shadow-sm"
            title="Rafraîchir"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Bandeau miroir offline */}
      <AnimatePresence>
        {fromMirror && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2.5 bg-[#eff6ff] border border-blue-200 rounded-2xl px-4 py-3"
          >
            <Database className="w-4 h-4 text-[#1e3a8a] shrink-0" />
            <p className="text-xs font-bold text-[#0b1d3a]">
              Mode hors connexion — données servies depuis le miroir offline
              {mirrorAt ? ` (synchronisé à ${new Date(mirrorAt).toLocaleTimeString('fr-FR')})` : ''}.
              Les actions d&rsquo;écriture reprendront au retour de la connexion.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message d'action */}
      <AnimatePresence>
        {actionMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              'flex items-center gap-2.5 rounded-2xl px-4 py-3 border',
              actionMsg.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800',
            )}
          >
            {actionMsg.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <p className="text-sm font-bold">{actionMsg.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {examsLoading || (loading && !state) ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#1e3a8a]" />
        </div>
      ) : error && !state ? (
        <div className="fed-card p-10 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-600">{error}</p>
        </div>
      ) : !selectedExam || !state ? (
        <div className="fed-card p-10 text-center">
          <Gavel className="w-10 h-10 text-[#1e3a8a] mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-600">
            Sélectionnez un examen pour accéder aux délibérations.
          </p>
        </div>
      ) : (
        <>
          {/* ── KPI de préparation (compteurs animés — ADN Stats WinAgro) ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              whileHover={{ y: -6 }}
              className="fed-card p-5 fed-card-shimmer"
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Candidats inscrits
              </p>
              <p className="text-3xl font-black text-[#0b1d3a]">
                <FedCountUp value={state.readiness.totalCandidates} />
              </p>
            </motion.div>
            <motion.div whileHover={{ y: -6 }} className="fed-card p-5 fed-card-shimmer">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Dossiers complets
              </p>
              <p className="text-3xl font-black text-emerald-600">
                <FedCountUp value={state.readiness.complete} />
              </p>
            </motion.div>
            <motion.div whileHover={{ y: -6 }} className="fed-card p-5 fed-card-shimmer">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Notes saisies
              </p>
              <p className="text-3xl font-black text-[#1e3a8a]">
                <FedCountUp value={state.readiness.resultsEntered} />
                <span className="text-sm text-slate-400 font-bold">
                  {' '}/ {state.readiness.totalExpected}
                </span>
              </p>
              {/* Barre de progression or */}
              <div className="mt-2 h-1.5 bg-blue-50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${readinessPct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] rounded-full"
                />
              </div>
            </motion.div>
            <motion.div whileHover={{ y: -6 }} className="fed-card p-5 fed-card-shimmer">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Statut examen
              </p>
              <p className="text-sm font-black text-[#0b1d3a] leading-tight">
                {state.exam.status === 'RESULTS_PUBLISHED'
                  ? 'Résultats publiés'
                  : state.exam.status === 'DELIBERATED'
                    ? 'Délibéré'
                    : state.exam.status === 'IN_PROGRESS'
                      ? 'Épreuves en cours'
                      : state.exam.status}
              </p>
            </motion.div>
          </div>

          {/* ── Onglets (liseré or — ADN tabs backoffice WinAgro) ────────── */}
          <div className="flex border-b border-blue-100 overflow-x-auto fed-scroll whitespace-nowrap">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'fed-tab inline-flex items-center gap-2',
                  tab === t.key && 'fed-tab-active',
                )}
              >
                <span className={cn(tab === t.key ? 'text-[#1e3a8a]' : 'text-slate-400')}>
                  {t.icon}
                </span>
                {t.label}
                {t.badge ? (
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-[10px] font-black text-[#0b1d3a] flex items-center justify-center">
                    {t.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* ═══ ONGLET 1 : SAISIE DES NOTES ═══════════════════════════════ */}
          {tab === 'notes' && (
            <div className="grid lg:grid-cols-12 gap-6">
              {/* Formulaire de saisie par lot */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-7 fed-card p-6"
              >
                <h3 className="text-sm font-black text-[#0b1d3a] uppercase tracking-widest mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gradient-to-r from-[#fbbf24] to-[#f59e0b]" />
                  Saisie des notes par lot
                </h3>
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Collez une ligne par note au format{' '}
                  <code className="px-1.5 py-0.5 bg-[#eff6ff] rounded text-[#1e3a8a] font-bold">
                    matricule ; code-matière ; note
                  </code>{' '}
                  (séparateurs ; , ou tabulation — export Excel/CSV directement collable).
                  Les notes sont enregistrées en brouillon puis verrouillées à la délibération.
                </p>
                <textarea
                  value={scoresText}
                  onChange={(e) => setScoresText(e.target.value)}
                  rows={10}
                  placeholder={'EXAM-2026-00001 ; MATH ; 14.5\nEXAM-2026-00001 ; FR ; 11\nEXAM-2026-00002 ; MATH ; 8.25'}
                  className="fed-input-light font-mono text-xs !rounded-xl mb-4"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-400 font-semibold">
                    {scoresText.split(/\r?\n/).filter((l) => l.trim()).length} ligne(s) détectée(s)
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={submitScores}
                    disabled={busy === 'scores' || !scoresText.trim()}
                    className="fed-btn-navy px-6 py-3 text-sm disabled:opacity-50"
                  >
                    {busy === 'scores' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    Enregistrer les notes
                  </motion.button>
                </div>
              </motion.div>

              {/* Matières + couverture */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="lg:col-span-5 fed-card p-6"
              >
                <h3 className="text-sm font-black text-[#0b1d3a] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#1e3a8a]" />
                  Matières de l&rsquo;examen
                </h3>
                {state.subjects.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    Aucune matière définie pour cet examen.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {state.subjects.map((s, i) => (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.04 }}
                        className="flex items-center justify-between bg-[#f7f9fc] border border-blue-100 rounded-xl px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-[#0b1d3a]">{s.name}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {s.code} · coef. {s.coefficient} · /{s.maxScore}
                          </p>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-[#eff6ff] text-[#1e3a8a] font-black text-xs flex items-center justify-center">
                          ×{s.coefficient}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
                <div className="mt-5 pt-4 border-t border-blue-50 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-black text-emerald-600">{state.readiness.complete}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Complets</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-amber-500">{state.readiness.partial}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Partiels</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-400">{state.readiness.missing}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sans notes</p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* ═══ ONGLET 2 : SIMULATION ═════════════════════════════════════ */}
          {tab === 'simulation' && (
            <div className="grid lg:grid-cols-12 gap-6">
              {/* Seuils */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-5 space-y-6"
              >
                <div className="fed-card p-6">
                  <h3 className="text-sm font-black text-[#0b1d3a] uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gradient-to-r from-[#fbbf24] to-[#f59e0b]" />
                    Critères d&rsquo;admission
                  </h3>
                  <div className="space-y-7">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider">
                          Moyenne d&rsquo;admission
                        </label>
                        <span className="text-xl font-black text-[#0b1d3a] bg-[#eff6ff] px-3 py-1 rounded-xl">
                          {passMark.toFixed(1)}/20
                        </span>
                      </div>
                      <input
                        type="range" min="8" max="14" step="0.5"
                        value={passMark}
                        onChange={(e) => setPassMark(parseFloat(e.target.value))}
                        className="w-full h-2 bg-blue-50 rounded-lg appearance-none cursor-pointer accent-[#1e3a8a]"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider">
                          Seuil de rachat (cas limites)
                        </label>
                        <span className="text-xl font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-xl">
                          {rescueMark.toFixed(1)}/20
                        </span>
                      </div>
                      <input
                        type="range" min="7" max="13" step="0.5"
                        value={rescueMark}
                        onChange={(e) => setRescueMark(parseFloat(e.target.value))}
                        className="w-full h-2 bg-amber-50 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={runSimulation}
                      disabled={simulating}
                      className="fed-btn-gold fed-btn-shimmer w-full py-4 text-sm disabled:opacity-50"
                    >
                      {simulating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <PlayCircle className="w-4 h-4" />
                      )}
                      Lancer la simulation
                    </motion.button>
                  </div>
                </div>

                {/* Échantillon des cas limites */}
                {simulation && simulation.rescueSample.length > 0 && (
                  <div className="fed-card p-6">
                    <h4 className="text-xs font-black text-[#0b1d3a] uppercase tracking-widest mb-3">
                      Aperçu des cas limites
                    </h4>
                    <div className="space-y-1.5 max-h-56 overflow-y-auto fed-scroll">
                      {simulation.rescueSample.map((r) => (
                        <div
                          key={r.matricule}
                          className="flex items-center justify-between text-xs bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2"
                        >
                          <span className="font-bold text-[#0b1d3a]">{r.name}</span>
                          <span className="font-black text-amber-600">{r.average}/20</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Distribution */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="lg:col-span-7"
              >
                <div className="fed-card-dark p-7 h-full">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <Award className="w-4 h-4 text-[#fbbf24]" />
                      Distribution simulée
                    </h3>
                    {simulation && (
                      <span className="fed-badge fed-badge-amber">
                        Réussite ≈ {simulation.successRate}%
                      </span>
                    )}
                  </div>
                  {!simulation ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <PlayCircle className="w-12 h-12 text-blue-100/20 mb-4" />
                      <p className="text-sm text-blue-100/50 font-semibold max-w-xs">
                        Réglez les seuils puis lancez la simulation pour visualiser la distribution
                        des résultats sans aucune écriture.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {[
                        { label: 'Admis', value: simulation.distribution.admitted, color: 'from-emerald-400 to-emerald-500', text: 'text-emerald-300' },
                        { label: 'Cas limites (rachat)', value: simulation.distribution.rescuePending, color: 'from-amber-300 to-amber-500', text: 'text-amber-300' },
                        { label: 'Ajournés', value: simulation.distribution.failed, color: 'from-red-400 to-red-500', text: 'text-red-300' },
                        { label: 'Dossiers incomplets', value: simulation.distribution.incomplete, color: 'from-slate-400 to-slate-500', text: 'text-slate-300' },
                      ].map((row, i) => {
                        const pct =
                          simulation.distribution.total > 0
                            ? Math.round((row.value / simulation.distribution.total) * 100)
                            : 0;
                        return (
                          <div key={row.label}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-blue-100/70">{row.label}</span>
                              <span className={cn('text-sm font-black', row.text)}>
                                {row.value}
                                <span className="text-[10px] text-blue-100/40 font-bold"> ({pct}%)</span>
                              </span>
                            </div>
                            <div className="h-2.5 bg-white/8 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.7, delay: i * 0.1, ease: 'easeOut' }}
                                className={cn('h-full rounded-full bg-gradient-to-r', row.color)}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {/* Mentions */}
                      <div className="pt-4 border-t border-white/10">
                        <p className="text-[10px] font-black text-blue-100/40 uppercase tracking-widest mb-3">
                          Mentions (admis)
                        </p>
                        <div className="grid grid-cols-5 gap-2 text-center">
                          {Object.entries(simulation.mentions).map(([mention, count]) => (
                            <div key={mention} className="bg-white/5 rounded-xl px-2 py-2.5">
                              <p className="text-base font-black text-[#fbbf24]">{count}</p>
                              <p className="text-[8px] font-bold text-blue-100/50 uppercase tracking-wide leading-tight">
                                {mention}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {/* ═══ ONGLET 3 : DÉLIBÉRATION & JURY ════════════════════════════ */}
          {tab === 'jury' && (
            <div className="space-y-6">
              {/* Lancement de délibération */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="fed-card p-6"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
                  <div className="flex-1">
                    <h3 className="text-sm font-black text-[#0b1d3a] uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Gavel className="w-4 h-4 text-[#1e3a8a]" />
                      Convoquer le jury de délibération
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      La délibération calcule les moyennes pondérées, prononce les admissions,
                      ouvre les cas limites (rachat) et verrouille les notes. Seuls les candidats
                      avec un dossier de notes complet sont délibérés.
                    </p>
                    <input
                      value={juryName}
                      onChange={(e) => setJuryName(e.target.value)}
                      placeholder="Nom du jury (ex. Jury n°1 — CEPD 2027)"
                      className="fed-input-light !rounded-xl"
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() =>
                      runAction(
                        'run',
                        () =>
                          apiClient.post(`/federis/exams/${examId}/deliberation`, {
                            juryName,
                            passMark,
                            rescueMark,
                          }),
                        'Délibération enregistrée — les cas limites attendent la décision du jury.',
                      )
                    }
                    disabled={
                      busy === 'run' ||
                      !juryName.trim() ||
                      state.readiness.complete === 0 ||
                      state.exam.status === 'RESULTS_PUBLISHED'
                    }
                    className="fed-btn-gold fed-btn-shimmer px-8 py-3.5 text-sm disabled:opacity-40 shrink-0"
                  >
                    {busy === 'run' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Gavel className="w-4 h-4" />
                    )}
                    Délibérer
                  </motion.button>
                </div>
              </motion.div>

              {/* Délibérations existantes */}
              {state.deliberations.map((d, di) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: di * 0.06 }}
                  className="fed-card p-6"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1e3a8a] to-[#0b1d3a] flex items-center justify-center shadow-md">
                        <Gavel className="w-5 h-5 text-[#fbbf24]" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-[#0b1d3a]">
                          {d.juryName ?? 'Jury'}
                        </h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {new Date(d.deliberatedAt).toLocaleString('fr-FR')} ·{' '}
                          {d.thresholds
                            ? `admission ≥ ${d.thresholds.passMark}/20 · rachat ≥ ${d.thresholds.rescueMark}/20`
                            : 'seuils n/a'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full',
                          d.status === 'PUBLISHED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : d.status === 'COMPLETED'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700 animate-pulse',
                        )}
                      >
                        {STATUS_LABELS[d.status] ?? d.status}
                      </span>
                      <div className="flex gap-4 text-center">
                        <div>
                          <p className="text-lg font-black text-emerald-600">{d.passedCount}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Admis</p>
                        </div>
                        <div>
                          <p className="text-lg font-black text-red-500">{d.failedCount}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ajournés</p>
                        </div>
                        <div>
                          <p className="text-lg font-black text-[#1e3a8a]">{Math.round(d.successRate)}%</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Réussite</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cas limites à trancher */}
                  {d.cases.length > 0 && (
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Cas limites soumis au jury ({d.cases.filter((c) => c.decision === 'PENDING').length} en attente)
                      </p>
                      {d.cases.map((c) => (
                        <div
                          key={c.id}
                          className={cn(
                            'flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl px-4 py-3 border transition-all',
                            c.decision === 'PENDING'
                              ? 'bg-amber-50/70 border-amber-200'
                              : c.decision === 'APPROVED'
                                ? 'bg-emerald-50/70 border-emerald-200'
                                : 'bg-red-50/60 border-red-200',
                          )}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0',
                                c.decision === 'PENDING'
                                  ? 'bg-amber-100 text-amber-700'
                                  : c.decision === 'APPROVED'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-red-100 text-red-600',
                              )}
                            >
                              {c.average ?? '—'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#0b1d3a] truncate">
                                {c.candidate.firstName} {c.candidate.lastName}
                                <span className="ml-2 text-[10px] font-black text-slate-400 uppercase">
                                  {c.candidate.matricule}
                                </span>
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">{c.reason}</p>
                              {c.decision !== 'PENDING' && c.comments && (
                                <p className="text-[11px] italic text-slate-400 mt-0.5">
                                  « {c.comments} »
                                </p>
                              )}
                            </div>
                          </div>
                          {c.decision === 'PENDING' && d.status === 'IN_PROGRESS' ? (
                            <div className="flex items-center gap-2 shrink-0">
                              <input
                                value={caseComments[c.id] ?? ''}
                                onChange={(e) =>
                                  setCaseComments((prev) => ({ ...prev, [c.id]: e.target.value }))
                                }
                                placeholder="Motif (optionnel)"
                                className="fed-input-light !rounded-lg !py-2 text-xs !w-40"
                              />
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  runAction(
                                    `case-${c.id}`,
                                    () =>
                                      apiClient.post(
                                        `/federis/deliberations/${d.id}/cases/${c.id}`,
                                        {
                                          decision: 'APPROVED',
                                          comments: caseComments[c.id] || undefined,
                                        },
                                      ),
                                    'Cas approuvé — candidat admis sur délibération.',
                                  )
                                }
                                disabled={busy === `case-${c.id}`}
                                className="px-4 py-2 rounded-full bg-emerald-500 text-white text-xs font-black hover:bg-emerald-600 transition-colors flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Admettre
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() =>
                                  runAction(
                                    `case-${c.id}`,
                                    () =>
                                      apiClient.post(
                                        `/federis/deliberations/${d.id}/cases/${c.id}`,
                                        {
                                          decision: 'REJECTED',
                                          comments: caseComments[c.id] || undefined,
                                        },
                                      ),
                                    'Cas rejeté — candidat ajourné.',
                                  )
                                }
                                disabled={busy === `case-${c.id}`}
                                className="px-4 py-2 rounded-full bg-red-500 text-white text-xs font-black hover:bg-red-600 transition-colors flex items-center gap-1.5"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Ajourné
                              </motion.button>
                            </div>
                          ) : (
                            <span
                              className={cn(
                                'text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shrink-0',
                                c.decision === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-600',
                              )}
                            >
                              {c.decision === 'APPROVED' ? 'Admis' : 'Ajourné'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions clôture / publication */}
                  <div className="mt-5 pt-4 border-t border-blue-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-400 font-semibold">
                      {d.status === 'IN_PROGRESS' &&
                        'Tranchez tous les cas limites avant de clôturer la délibération.'}
                      {d.status === 'COMPLETED' &&
                        !d.publication &&
                        'Délibération clôturée — prête pour la publication officielle (coordonnateur).'}
                      {d.publication &&
                        `Publiée le ${new Date(d.publication.publishedAt).toLocaleString('fr-FR')}.`}
                    </p>
                    <div className="flex gap-3">
                      {d.status === 'IN_PROGRESS' && (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() =>
                            runAction(
                              'close',
                              () =>
                                apiClient.post(`/federis/deliberations/${d.id}/close`),
                              'Délibération clôturée.',
                            )
                          }
                          disabled={busy === 'close' || d.pendingCases > 0}
                          className="fed-btn-navy px-6 py-2.5 text-xs disabled:opacity-40"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          Clôturer
                        </motion.button>
                      )}
                      {d.status === 'COMPLETED' && !d.publication && (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() =>
                            runAction(
                              'publish',
                              () =>
                                apiClient.post(`/federis/deliberations/${d.id}/publish`),
                              'Résultats publiés — parents et écoles notifiés via Academia Helm.',
                            )
                          }
                          disabled={busy === 'publish'}
                          className="fed-btn-gold fed-btn-shimmer px-6 py-2.5 text-xs"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Publier les résultats
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}

              {state.deliberations.length === 0 && (
                <div className="fed-card p-12 text-center">
                  <Gavel className="w-12 h-12 text-blue-200 mx-auto mb-4" />
                  <p className="text-sm font-bold text-slate-500">
                    Aucune délibération pour cet examen — saisissez les notes puis convoquez le jury.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ═══ ONGLET 4 : RÉSULTATS & PUBLICATION ════════════════════════ */}
          {tab === 'results' && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {!results ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-7 h-7 animate-spin text-[#1e3a8a]" />
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full',
                          results.published
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {results.published ? 'Résultats officiels publiés' : 'Non publiés'}
                      </span>
                    </div>
                    <button
                      onClick={() => void loadResults()}
                      className="p-2 rounded-full bg-white border border-blue-100 text-[#1e3a8a] hover:bg-[#eff6ff] transition-colors shadow-sm"
                      title="Rafraîchir les résultats"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Table des résultats */}
                  <div className="fed-card overflow-hidden">
                    <div className="overflow-x-auto fed-scroll">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#0b1d3a] text-white text-left">
                            <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest">
                              Candidat
                            </th>
                            <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest">
                              Matricule
                            </th>
                            <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest">
                              Notes
                            </th>
                            <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest">
                              Moyenne
                            </th>
                            <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest">
                              Décision
                            </th>
                            <th className="px-4 py-3.5 text-[10px] font-black uppercase tracking-widest">
                              Mention
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.candidates.map((c, i) => (
                            <motion.tr
                              key={c.matricule}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: Math.min(i * 0.02, 0.4) }}
                              className={cn(
                                'border-b border-blue-50 last:border-0 hover:bg-[#eff6ff]/50 transition-colors',
                                i % 2 === 1 && 'bg-[#f7f9fc]/60',
                              )}
                            >
                              <td className="px-4 py-3 font-bold text-[#0b1d3a]">{c.name}</td>
                              <td className="px-4 py-3 text-xs font-mono text-slate-500">
                                {c.matricule}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {c.scores.slice(0, 4).map((s) => (
                                    <span
                                      key={s.code}
                                      title={`${s.subject} (coef. ${s.coefficient})`}
                                      className="px-1.5 py-0.5 rounded bg-blue-50 text-[#1e3a8a] text-[10px] font-black"
                                    >
                                      {s.code} {s.score}
                                    </span>
                                  ))}
                                  {c.scores.length > 4 && (
                                    <span className="text-[10px] font-bold text-slate-400 self-center">
                                      +{c.scores.length - 4}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-black text-[#0b1d3a]">
                                {c.finalAverage !== null ? `${c.finalAverage}/20` : '—'}
                              </td>
                              <td className="px-4 py-3">
                                {c.finalDecision ? (
                                  <span
                                    className={cn(
                                      'text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full',
                                      c.finalDecision === 'ADMIS'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-red-100 text-red-600',
                                    )}
                                  >
                                    {c.finalDecision === 'ADMIS' ? 'Admis' : 'Ajourné'}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">En attente</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {c.mention ? (
                                  <span className="text-xs font-bold text-amber-600">{c.mention}</span>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {results.candidates.length === 0 && (
                    <div className="fed-card p-12 text-center">
                      <FileCheck2 className="w-12 h-12 text-blue-200 mx-auto mb-4" />
                      <p className="text-sm font-bold text-slate-500">
                        Aucun résultat enregistré pour cet examen.
                      </p>
                    </div>
                  )}

                  {/* Note notifications parents */}
                  {results.published && (
                    <div className="fed-card-dark p-5 flex items-start gap-3">
                      <Send className="w-4 h-4 text-[#fbbf24] mt-0.5 shrink-0" />
                      <p className="text-xs text-blue-100/70 leading-relaxed">
                        Les résultats officiels ont été publiés : les parents des candidats rattachés
                        à des écoles Academia Helm ont été notifiés (notification in-app + push), de
                        même que les équipes de direction des écoles concernées. Ce tableau reste
                        consultable hors connexion grâce au miroir offline.
                      </p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </>
      )}
    </FedPage>
  );
}
