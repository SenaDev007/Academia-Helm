/**
 * FederisDeliberationsPage — Délibération du jury & publication des résultats
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ REFONTE 2026-09-30 (cahier des charges utilisateur) :
 *
 *   Le module n'est PLUS un espace de saisie des notes ni de simulation de
 *   seuils — la saisie vit dans « Notes et Moyennes », les seuils dans
 *   « Paramètres — Règles de calcul » (source de vérité : défauts backend
 *   10/20 et 9,5/20 tant qu'aucune règle n'est définie).
 *
 *   1. Sélection du TYPE D'EXAMEN : CEP | BEPC | BAC | CAP (jamais de
 *      mélange — pattern module Candidats / Notes et Moyennes), puis
 *      campagne de ce type ;
 *   2. ⭐ 2026-10-01 — DEUX SOUS-ONGLETS PAR TYPE D'EXAMEN : « Délibération »
 *      et « Relevé de notes » (déplacé du module Notes et Moyennes) : l'envoi
 *      des relevés exige que la délibération du jury ait été lancée → les
 *      deux étapes vivent dans le MÊME module (règle : le relevé du CEP
 *      reste au CEP, celui du BEPC au BEPC, etc.) ;
 *   3. Sous-onglet DÉLIBÉRATION — DEUX TABLEAUX, chacun occupe la moitié de
 *      l'interface :
 *        · GAUCHE  : Liste des admissibles (moyenne ≥ seuil d'admission) ;
 *        · DROITE  : Candidats ajournés (sous le seuil — cas du jury,
 *                    sans note) ;
 *      Colonnes : matricule / nom prénom / moyenne / décision du jury
 *      (pattern Promotion & Redoublement Helm) ;
 *   4. Workflow du jury : lancer la délibération (nom du jury) → trancher
 *      les cas limites → clôturer → publier (coordonnateur) ;
 *   5. Documents & distribution :
 *        · « Générer la liste PDF » — liste officielle backend (admissibles
 *          + ajournés, décision du jury, bandeau provisoire avant
 *          publication) ;
 *        · « Envoyer les relevés de notes » — chaque relevé est distribué à
 *          l'école du candidat (les écoles consultent dans Examen →
 *          Examens nationaux → Délibération et relevés de notes).
 *
 * API : GET  /federis/exams/:examId/deliberation/board
 *       POST /federis/exams/:examId/deliberation            (juryName)
 *       POST /federis/deliberations/:id/cases/:caseId       (APPROVED|REJECTED)
 *       POST /federis/deliberations/:id/close
 *       POST /federis/deliberations/:id/publish
 *       POST /federis/exams/:examId/releves/dispatch
 *       GET  /federis/exams/:examId/pdf/deliberation
 *       GET  /federis/exams/:examId/grades/releves   (sous-onglet Relevé de notes)
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Gavel,
  Loader2,
  Search,
  Send,
  FileDown,
  Lock,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Scale,
  ShieldCheck,
  Award,
  Users,
  X,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { canWrite, normalizePatronatRole } from '@/lib/patronat/permissions';
import { useFederisExams, EXAM_STATUS_LABELS } from '@/hooks/useFederisExams';
import { federisMirror } from '@/lib/federis/federis-mirror.service';
import { FedPage, FedCountUp, FedSectionTitle } from '@/components/federis/federis-motion';
// ⭐ 2026-10-01 — sous-onglet « Relevé de notes » (déplacé du module Notes et
//    Moyennes) + modale de confirmation professionnelle (window.confirm →)
import FederisGradeRelevesTab from '@/components/federis/FederisGradeRelevesTab';
import FederisConfirmModal from '@/components/federis/federis-confirm-modal';

// ─── Types (réponses API) ────────────────────────────────────────────────────

type ExamType = 'CEP' | 'BEPC' | 'BAC' | 'CAP';

interface BoardRow {
  candidateId: string;
  matricule: string;
  fullName: string;
  school: string;
  centerName: string | null;
  moyenne: number | null;
  rank: number | null;
  nbEval: number;
  complete: boolean;
  mention: string | null;
  decision: 'ADMIS' | 'AJOURNE' | 'EN_ATTENTE' | 'NON_DELIBERE';
  decisionLabel: string;
  source: 'PUBLIE' | 'JURY' | 'CAS_JURY' | 'PROJECTION';
  caseId: string | null;
  caseDecision: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  caseReason: string | null;
  releveDispatched: boolean;
}

interface DeliberationCase {
  id: string;
  reason: string;
  decision: 'PENDING' | 'APPROVED' | 'REJECTED';
  comments: string | null;
  candidate: { id: string; matricule: string; firstName: string; lastName: string };
  average: number | null;
}

interface DeliberationInfo {
  id: string;
  juryName: string | null;
  deliberatedAt: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PUBLISHED' | string;
  passedCount: number;
  failedCount: number;
  successRate: number;
  thresholds: { passMark: number; rescueMark: number } | null;
  publication: { publishedAt: string; publishedBy: string; admitted: number; failed: number } | null;
  pendingCases: number;
  cases: DeliberationCase[];
}

interface BoardData {
  exam: {
    id: string;
    code: string;
    name: string;
    examType: string;
    level: string;
    status: string;
    isPrimary: boolean;
  };
  academicYearLabel: string | null;
  rules: {
    passMark: number;
    rescueMark: number;
    isCustom: boolean;
    averageModel: 'simple' | 'ponderee';
    /** Le modèle de calcul vient d'une règle personnalisée (source de vérité). */
    averageModelCustom?: boolean;
  };
  session: { draftCount: number; submittedCount: number; allSubmitted: boolean; locked: boolean };
  filling: { gradedCells: number; totalCells: number; absentCells: number; fullyGraded: number };
  subjectsCount: number;
  stats: {
    totalCandidates: number;
    admissibles: number;
    ajournes: number;
    enAttente: number;
    nonDeliberes: number;
    successRate: number | null;
  };
  deliberation: DeliberationInfo | null;
  dispatch: { dispatchedCount: number; lastDispatchAt: string | null; schoolsCount: number };
  admissibles: BoardRow[];
  ajournes: BoardRow[];
}

const EXAM_TYPES: Array<{ type: ExamType; label: string }> = [
  { type: 'CEP', label: 'CEP' },
  { type: 'BEPC', label: 'BEPC' },
  { type: 'BAC', label: 'Baccalauréat' },
  { type: 'CAP', label: 'CAP' },
];

/** ⭐ 2026-10-01 — Sous-onglets du module Délibération (par type d'examen) :
 *    la délibération du jury et les relevés de notes vivent dans le MÊME
 *    module car l'envoi des relevés exige une délibération préalable. */
type ModuleTab = 'deliberation' | 'releves';

const MODULE_TABS: Array<{ key: ModuleTab; label: string }> = [
  { key: 'deliberation', label: 'Délibération' },
  { key: 'releves', label: 'Relevé de notes' },
];

const TYPE_MODEL_LABEL: Record<string, string> = {
  CEP: 'Moyenne simple — primaire (sans coefficients)',
  BEPC: 'Moyenne pondérée — secondaire (avec coefficients)',
  BAC: 'Moyenne pondérée — secondaire (avec coefficients)',
  CAP: 'Moyenne pondérée — secondaire (avec coefficients)',
};

/** Libellé du modèle de calcul EFFECTIF d'un type : règles du board si
 *  chargées (source de vérité le cas échéant), sinon défaut structurel. */
function effectiveModelLabel(
  activeType: string | null,
  board: BoardData | null,
): string {
  if (board && activeType && board.rules?.averageModel) {
    return board.rules.averageModel === 'simple'
      ? 'Moyenne simple — Σ notes / nombre d\u2019épreuves'
      : 'Moyenne pondérée — Σ(note × coef) / Σ coef';
  }
  return activeType ? (TYPE_MODEL_LABEL[activeType] ?? '') : '';
}

/** Couleur de pastille selon la provenance de la décision. */
function decisionPill(row: BoardRow): { label: string; className: string } {
  switch (row.decision) {
    case 'ADMIS':
      return {
        label: row.source === 'PROJECTION' ? 'Admis (projeté)' : 'Admis',
        className: 'bg-emerald-100 text-emerald-800',
      };
    case 'AJOURNE':
      return {
        label: row.decisionLabel,
        className: 'bg-red-100 text-red-700',
      };
    case 'EN_ATTENTE':
      return { label: 'Cas du jury', className: 'bg-amber-100 text-amber-800' };
    default:
      return { label: 'À délibérer', className: 'bg-slate-100 text-slate-500' };
  }
}

function fmtNote(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',');
}

/** Téléchargement authentifié (blob) — pattern FederisGradeRelevesTab. */
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

// ─── Composant principal ─────────────────────────────────────────────────────

export default function FederisDeliberationsPage({
  userRole,
}: {
  tenantId?: string;
  userRole?: string | null;
}) {
  const { exams, examId, setExamId, loading: examsLoading } = useFederisExams();

  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  // Recherche dans chaque tableau
  const [searchAdm, setSearchAdm] = useState('');
  const [searchAjo, setSearchAjo] = useState('');

  // ⭐ Sous-onglet actif : Délibération | Relevé de notes (reset par campagne)
  const [moduleTab, setModuleTab] = useState<ModuleTab>('deliberation');

  // Modale de lancement (nom du jury)
  const [runOpen, setRunOpen] = useState(false);
  const [juryName, setJuryName] = useState('');
  const [runError, setRunError] = useState<string | null>(null);

  // ⭐ Confirmations professionnelles (remplacent les window.confirm génériques)
  const [confirmDispatch, setConfirmDispatch] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  // Panneau des cas limites
  const [casesOpen, setCasesOpen] = useState(false);
  const [caseComments, setCaseComments] = useState<Record<string, string>>({});

  const fn = normalizePatronatRole(userRole);
  const canDeliberate = canWrite(userRole, 'candidates'); // coordonnateur / secrétaire / organisateur
  const canPublish = fn === 'COORDONNATEUR';

  // ── Chargement du tableau de délibération ────────────────────────────────
  const load = useCallback(
    async (silent = false) => {
      if (!examId) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get(`/federis/exams/${examId}/deliberation/board`, {
          timeout: 30000,
        });
        setBoard(res.data);
        // Miroir offline (repli hors connexion)
        void federisMirror
          .saveSnapshot(`deliberation:${examId}`, res.data)
          .catch(() => undefined);
      } catch (err: any) {
        // Repli miroir hors connexion
        try {
          const mirrored = await federisMirror.loadSnapshot<BoardData>(`deliberation:${examId}`);
          if (mirrored?.data) {
            setBoard(mirrored.data);
            setNotice('Mode hors connexion — données miroir (dernière consultation).');
            return;
          }
        } catch {
          /* pas de miroir */
        }
        setError(
          (Array.isArray(err?.response?.data?.message)
            ? err.response.data.message.join(' ')
            : err?.response?.data?.message) ?? 'Impossible de charger la délibération.',
        );
      } finally {
        setLoading(false);
      }
    },
    [examId],
  );

  useEffect(() => {
    setNotice(null);
    setCasesOpen(false);
    setRunOpen(false);
    setModuleTab('deliberation');
    void load();
  }, [load]);

  useEffect(() => {
    if (board?.deliberation && board.deliberation.pendingCases > 0) setCasesOpen(true);
  }, [board?.deliberation?.id, board?.deliberation?.pendingCases]);

  // ── Catégorisation par type (pattern FederisGradesPage) ──────────────────
  const examsByType = useMemo(() => {
    const map = new Map<string, typeof exams>();
    for (const ex of exams) {
      const key = ex.examType ?? 'CEP';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ex);
    }
    return map;
  }, [exams]);

  const selectedExam = exams.find((e) => e.id === examId) ?? null;
  const activeType = selectedExam?.examType ?? null;
  const activeTypeExams = activeType ? (examsByType.get(activeType) ?? []) : [];
  const visibleTypes = EXAM_TYPES.filter((t) => (examsByType.get(t.type) ?? []).length > 0);
  const typeCount = (type: string) =>
    (examsByType.get(type) ?? []).reduce((sum, ex) => sum + (ex.candidatesCount ?? 0), 0);
  const switchType = (type: string) => {
    const first = (examsByType.get(type) ?? [])[0];
    if (first) setExamId(first.id);
  };

  // ── Filtrage des tableaux ────────────────────────────────────────────────
  const filterRows = (rows: BoardRow[], q: string) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.fullName.toLowerCase().includes(needle) ||
        r.matricule?.toLowerCase().includes(needle) ||
        (r.school ?? '').toLowerCase().includes(needle),
    );
  };
  const admissibles = useMemo(
    () => filterRows(board?.admissibles ?? [], searchAdm),
    [board?.admissibles, searchAdm],
  );
  const ajournes = useMemo(
    () => filterRows(board?.ajournes ?? [], searchAjo),
    [board?.ajournes, searchAjo],
  );

  // ── Actions du workflow ──────────────────────────────────────────────────

  const runDeliberation = async () => {
    if (!examId || !juryName.trim()) {
      setRunError('Le nom du jury est obligatoire.');
      return;
    }
    setWorking('run');
    setRunError(null);
    try {
      const res = await apiClient.post(
        `/federis/exams/${examId}/deliberation`,
        { juryName: juryName.trim() },
        { timeout: 30000 },
      );
      setNotice(
        res.data?.message ??
          `Délibération lancée par le jury « ${res.data?.juryName ?? juryName} ».`,
      );
      setRunOpen(false);
      setJuryName('');
      await load(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setRunError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Lancement impossible.');
    } finally {
      setWorking(null);
    }
  };

  const decideCase = async (deliberationId: string, kase: DeliberationCase, decision: 'APPROVED' | 'REJECTED') => {
    setWorking(`case-${kase.id}`);
    setError(null);
    setNotice(null);
    try {
      await apiClient.post(
        `/federis/deliberations/${deliberationId}/cases/${kase.id}`,
        { decision, comments: caseComments[kase.id]?.trim() || undefined },
        { timeout: 20000 },
      );
      setNotice(
        `${kase.candidate.firstName} ${kase.candidate.lastName} — ${
          decision === 'APPROVED' ? 'admis(e) par le jury' : 'ajourné(e) par le jury'
        }.`,
      );
      await load(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Décision impossible.');
    } finally {
      setWorking(null);
    }
  };

  const closeDeliberation = async () => {
    if (!board?.deliberation) return;
    setWorking('close');
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post(
        `/federis/deliberations/${board.deliberation.id}/close`,
        {},
        { timeout: 20000 },
      );
      setNotice(
        `Délibération clôturée — ${res.data?.passedCount ?? 0} admis(e)s, ${res.data?.failedCount ?? 0} ajourné(e)s, taux de réussite ${fmtNote(res.data?.successRate)} %.`,
      );
      await load(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Clôture impossible.');
    } finally {
      setWorking(null);
    }
  };

  const publishResults = async () => {
    if (!board?.deliberation) return;
    setWorking('publish');
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post(
        `/federis/deliberations/${board.deliberation.id}/publish`,
        {},
        { timeout: 30000 },
      );
      setNotice(
        `Résultats publiés — ${res.data?.admitted ?? 0} admis(e)s, ${res.data?.failed ?? 0} ajourné(e)s. ` +
          (res.data?.message ?? 'Pensez à envoyer les relevés de notes aux écoles.'),
      );
      setConfirmPublish(false);
      await load(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Publication impossible.');
      setConfirmPublish(false);
    } finally {
      setWorking(null);
    }
  };

  const dispatchReleves = async () => {
    if (!examId) return;
    setWorking('dispatch');
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post(
        `/federis/exams/${examId}/releves/dispatch`,
        {},
        { timeout: 60000 },
      );
      setNotice(res.data?.message ?? 'Relevés envoyés aux écoles.');
      setConfirmDispatch(false);
      await load(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Envoi impossible.');
      setConfirmDispatch(false);
    } finally {
      setWorking(null);
    }
  };

  const downloadPdf = async () => {
    if (!examId || !board) return;
    setWorking('pdf');
    setError(null);
    setNotice(null);
    try {
      await downloadFile(
        `/federis/exams/${examId}/pdf/deliberation`,
        `Liste_Deliberation_${board.exam.code}.pdf`,
      );
      setNotice('Liste de délibération générée (backend) — téléchargement lancé.');
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
      setWorking(null);
    }
  };

  // ── État du workflow pour l'affichage ────────────────────────────────────
  const d = board?.deliberation ?? null;
  const examStatus = board?.exam.status ?? '';
  const hasNotes = (board?.filling.gradedCells ?? 0) + (board?.filling.absentCells ?? 0) > 0;
  const pendingCases = d?.pendingCases ?? 0;
  const workflowStep: 'saisie' | 'pret' | 'en_cours' | 'cloturee' | 'publiee' =
    examStatus === 'RESULTS_PUBLISHED'
      ? 'publiee'
      : d?.status === 'PUBLISHED'
        ? 'publiee'
        : d?.status === 'IN_PROGRESS'
          ? 'en_cours'
          : d?.status === 'COMPLETED'
            ? 'cloturee'
            : hasNotes
              ? 'pret'
              : 'saisie';

  const WORKFLOW_LABELS: Record<string, { label: string; className: string }> = {
    saisie: { label: 'Notes en cours de saisie', className: 'bg-slate-100 text-slate-600' },
    pret: { label: 'Prêt à délibérer', className: 'bg-blue-100 text-blue-800' },
    en_cours: { label: 'Délibération en cours — cas à trancher', className: 'bg-amber-100 text-amber-800' },
    cloturee: { label: 'Délibération clôturée — publication possible', className: 'bg-indigo-100 text-indigo-800' },
    publiee: { label: 'Résultats publiés', className: 'bg-emerald-100 text-emerald-800' },
  };
  const workflow = WORKFLOW_LABELS[workflowStep];

  // ═════════════════════════════════════════════════════════════════════════
  // Rendu
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <FedPage className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="fed-badge mb-2">Module délibération</div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Délibération</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Délibération du jury, publication officielle des résultats et <strong>relevés de
            notes</strong> — chaque examen (CEP, BEPC, Baccalauréat, CAP) réunit ses deux
            sous-onglets : délibérez, publiez, puis envoyez les relevés aux écoles depuis le
            même module. La saisie des notes se fait dans <strong>Notes et Moyennes</strong> ;
            les seuils d&apos;admission et de rachat sont pilotés dans{' '}
            <strong>Paramètres → Règles de calcul</strong>.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="fed-card px-6 py-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              <FedCountUp value={board?.stats.totalCandidates ?? 0} />
            </p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Candidats</p>
          </div>
          <div className="fed-card px-6 py-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">
              <FedCountUp value={board?.stats.admissibles ?? 0} />
            </p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Admissibles</p>
          </div>
          <div className="fed-card px-6 py-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              <FedCountUp value={board?.stats.ajournes ?? 0} />
            </p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Ajournés</p>
          </div>
          <div className="fed-card px-6 py-4 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {board?.stats.successRate != null ? (
                <FedCountUp value={board.stats.successRate} suffix=" %" />
              ) : (
                '—'
              )}
            </p>
            <p className="text-xs font-medium text-gray-500 mt-0.5">Taux de réussite</p>
          </div>
        </div>
      </div>

      {/* Sélection du type d'examen */}
      {examsLoading ? (
        <div className="fed-card px-6 py-4 text-sm font-bold text-slate-400">
          Chargement des campagnes…
        </div>
      ) : visibleTypes.length === 0 ? (
        <div className="fed-card px-6 py-8 text-center">
          <p className="text-sm font-bold text-slate-500">
            Aucun examen — créez d&apos;abord une campagne dans le module Examens nationaux.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Type d'examen">
          {visibleTypes.map((t) => {
            const isActive = activeType === t.type;
            return (
              <button
                key={t.type}
                role="tab"
                aria-selected={isActive}
                onClick={() => switchType(t.type)}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide border transition-all',
                  isActive
                    ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-900/40 hover:text-blue-900',
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'ml-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold',
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                  )}
                >
                  {typeCount(t.type)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sélecteur de campagne */}
      {examId && (
        <div className="fed-card px-6 py-4 flex flex-col lg:flex-row lg:items-center gap-4 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Campagne</span>
          {activeTypeExams.length === 1 ? (
            <span className="text-sm font-bold text-blue-900">
              {selectedExam?.code} — {selectedExam?.name}
            </span>
          ) : (
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="fed-input-light flex-1 !w-auto font-bold px-4 py-2.5"
            >
              {activeTypeExams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.code} — {exam.name} ({EXAM_STATUS_LABELS[exam.status] ?? exam.status})
                </option>
              ))}
            </select>
          )}
          {activeType && (
            <span className="text-[9px] font-black uppercase tracking-wide bg-blue-50 text-blue-900 border border-blue-100 px-3 py-1.5 rounded-lg">
              {effectiveModelLabel(activeType, board)}
            </span>
          )}
          <span className={cn('px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase', workflow.className)}>
            {workflow.label}
          </span>
        </div>
      )}

      {/* ⭐ Sous-onglets du module : Délibération | Relevé de notes
          (pattern FederisGradesPage — reset au changement de campagne) */}
      {examId && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sections du module délibération">
          {MODULE_TABS.map((t) => {
            const isActive = moduleTab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setModuleTab(t.key)}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide border transition-all',
                  isActive
                    ? 'bg-white text-blue-900 border-blue-900 shadow-sm'
                    : 'bg-white/60 text-slate-500 border-slate-200 hover:border-blue-900/40 hover:text-blue-900',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Bandeau règles + actions (sous-onglet Délibération) */}
      {moduleTab === 'deliberation' && board && (
        <div className="fed-card px-6 py-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 flex-wrap">
            <Scale className="w-5 h-5 text-blue-900 shrink-0" />
            <p className="text-xs text-slate-600 flex-1 min-w-[240px]">
              Seuils appliqués : <b>admission ≥ {fmtNote(board.rules.passMark)}/20</b> ·{' '}
              <b>rachat ≥ {fmtNote(board.rules.rescueMark)}/20</b> —{' '}
              {board.rules.isCustom ? (
                <span className="font-bold text-emerald-700">
                  règle personnalisée (Paramètres → Règles de calcul) = source de vérité
                </span>
              ) : (
                <span>
                  défauts du backend (personnalisables dans Paramètres → Règles de calcul)
                </span>
              )}
              {board.rules.averageModelCustom ? (
                <span>
                  {' · modèle de calcul : '}
                  <span className="font-bold text-emerald-700">
                    {board.rules.averageModel === 'simple' ? 'moyenne simple' : 'moyenne pondérée'}
                    (source de vérité)
                  </span>
                </span>
              ) : board.rules.averageModel === 'simple' ? (
                ' · moyenne simple (primaire)'
              ) : (
                ' · moyenne pondérée par coefficients'
              )}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {/* Étape : lancer la délibération */}
              {(workflowStep === 'pret' || workflowStep === 'saisie') && canDeliberate && (
                <button
                  onClick={() => {
                    setRunOpen(true);
                    setRunError(null);
                  }}
                  disabled={!hasNotes || working !== null}
                  title={
                    hasNotes
                      ? 'Lancer la délibération du jury (les seuils des règles de calcul sont appliqués)'
                      : 'Aucune note saisie — complétez la saisie dans Notes et Moyennes'
                  }
                  className="fed-btn-navy px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <PlayCircle className="w-4 h-4" />
                  Lancer la délibération
                </button>
              )}

              {/* Cas à trancher (badge sur le panneau) */}
              {d && pendingCases > 0 && canDeliberate && (
                <button
                  onClick={() => setCasesOpen((v) => !v)}
                  className="px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-amber-500 text-white hover:bg-amber-600 inline-flex items-center gap-2"
                >
                  <Gavel className="w-4 h-4" />
                  Cas limites ({pendingCases})
                </button>
              )}

              {/* Clôturer */}
              {d?.status === 'IN_PROGRESS' && pendingCases === 0 && canDeliberate && (
                <button
                  onClick={closeDeliberation}
                  disabled={working !== null}
                  className="px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {working === 'close' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Clôturer
                </button>
              )}

              {/* Publier — confirmation via modale professionnelle */}
              {d?.status === 'COMPLETED' && canPublish && (
                <button
                  onClick={() => setConfirmPublish(true)}
                  disabled={working !== null}
                  className="px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {working === 'publish' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  Publier les résultats
                </button>
              )}

              {/* PDF liste de délibération */}
              {(workflowStep === 'en_cours' || workflowStep === 'cloturee' || workflowStep === 'publiee') && (
                <button
                  onClick={downloadPdf}
                  disabled={working !== null}
                  className="px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-white border border-blue-900/25 text-blue-900 hover:bg-blue-50 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {working === 'pdf' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                  Liste PDF
                </button>
              )}

              {/* Envoyer les relevés de notes aux écoles — confirmation via
                  modale professionnelle */}
              {(workflowStep === 'cloturee' || workflowStep === 'publiee' || examStatus === 'DELIBERATED') &&
                canDeliberate && (
                  <button
                    onClick={() => setConfirmDispatch(true)}
                    disabled={working !== null}
                    title="Distribue le relevé de notes de chaque candidat à son école de provenance"
                    className="fed-btn-gold px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {working === 'dispatch' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Envoyer les relevés
                  </button>
                )}
            </div>
          </div>

          {/* Distribution des relevés */}
          {board.dispatch.dispatchedCount > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
              <Send className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-800 font-semibold">
                {board.dispatch.dispatchedCount} relevé(s) déjà envoyé(s) à{' '}
                {board.dispatch.schoolsCount} école(s)
                {board.dispatch.lastDispatchAt
                  ? ` — dernier envoi le ${new Date(board.dispatch.lastDispatchAt).toLocaleDateString('fr-FR')}`
                  : ''}
                . Un nouvel envoi actualise les documents (décisions à jour).
              </p>
            </div>
          )}

          {/* Session de saisie (renvoi vers Notes et Moyennes) */}
          {!hasNotes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Aucune note saisie pour cette campagne — la saisie se fait dans le module{' '}
                <b>Notes et Moyennes</b> (onglet « Saisie des notes »), puis la délibération peut
                être lancée ici.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm font-semibold text-red-800">
              {error}
            </div>
          )}
          {notice && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 text-sm font-semibold text-emerald-800">
              {notice}
            </div>
          )}
        </div>
      )}

      {/* Panneau des cas limites (sous-onglet Délibération) */}
      {moduleTab === 'deliberation' && d && casesOpen && (d.cases ?? []).length > 0 && (
        <div className="fed-card p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <FedSectionTitle
              title="Cas limites du jury"
              subtitle={`Moyennes comprises entre le seuil de rachat (${fmtNote(d.thresholds?.rescueMark ?? board?.rules.rescueMark)}) et la moyenne d'admission (${fmtNote(d.thresholds?.passMark ?? board?.rules.passMark)}) — jury « ${d.juryName ?? '—'} »`}
            />
            <button
              onClick={() => setCasesOpen(false)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-[#f7f9fc]">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Candidat</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Moyenne</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Motif</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Décision du jury</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {d.cases.map((kase) => (
                  <tr key={kase.id} className={kase.decision === 'PENDING' ? '' : 'bg-slate-50/60'}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-blue-900">
                        {kase.candidate.lastName} {kase.candidate.firstName}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{kase.candidate.matricule}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-black text-amber-700">{fmtNote(kase.average)}/20</span>
                    </td>
                    <td className="px-4 py-3 max-w-[280px]">
                      <p className="text-[11px] text-slate-600">{kase.reason}</p>
                      {kase.decision !== 'PENDING' && kase.comments && (
                        <p className="text-[10px] text-slate-500 mt-1 italic">« {kase.comments} »</p>
                      )}
                      {kase.decision === 'PENDING' && (
                        <input
                          type="text"
                          value={caseComments[kase.id] ?? ''}
                          onChange={(e) =>
                            setCaseComments((prev) => ({ ...prev, [kase.id]: e.target.value }))
                          }
                          placeholder="Motif de la décision (optionnel)…"
                          className="fed-input-light px-3 py-1.5 text-[11px] !w-64 mt-1.5"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {kase.decision === 'PENDING' ? (
                        canDeliberate ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => decideCase(d.id, kase, 'APPROVED')}
                              disabled={working !== null}
                              className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                              {working === `case-${kase.id}` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3" />
                              )}
                              Admettre
                            </button>
                            <button
                              onClick={() => decideCase(d.id, kase, 'REJECTED')}
                              disabled={working !== null}
                              className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                              {working === `case-${kase.id}` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              Ajourner
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 uppercase">En attente</span>
                        )
                      ) : kase.decision === 'APPROVED' ? (
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">
                          Admis (jury)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase bg-red-100 text-red-700">
                          Ajourné (jury)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chargement / erreur du board (sous-onglet Délibération) */}
      {moduleTab === 'deliberation' && loading && !board && (
        <div className="fed-card px-6 py-10 text-center text-sm font-bold text-slate-400">
          Chargement de la délibération…
        </div>
      )}
      {moduleTab === 'deliberation' && error && !board && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* ⭐ DEUX TABLEAUX — chacun occupe la moitié de l'interface
          (sous-onglet Délibération) */}
      {moduleTab === 'deliberation' && board && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
          {/* ── GAUCHE : Liste des admissibles ── */}
          <div className="fed-card overflow-hidden">
            <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <Award className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-emerald-800 uppercase">
                  Liste des admissibles
                </h3>
                <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                  Moyenne ≥ {fmtNote(board.rules.passMark)}/20 ·{' '}
                  {board.stats.admissibles} candidat(s)
                </p>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchAdm}
                  onChange={(e) => setSearchAdm(e.target.value)}
                  placeholder="Rechercher…"
                  className="fed-input-light pl-8 pr-3 py-2 text-[11px] font-bold !w-44"
                />
              </div>
            </div>
            <DecisionTable rows={admissibles} tone="emerald" />
          </div>

          {/* ── DROITE : Candidats ajournés ── */}
          <div className="fed-card overflow-hidden">
            <div className="bg-red-50 border-b border-red-100 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <Users className="w-5 h-5 text-red-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-red-700 uppercase">Candidats ajournés</h3>
                <p className="text-[10px] text-red-600 font-semibold mt-0.5">
                  Sous le seuil d&apos;admission ({fmtNote(board.rules.passMark)}/20) —{' '}
                  {board.ajournes.length} candidat(s)
                  {board.stats.enAttente > 0 ? ` dont ${board.stats.enAttente} cas du jury` : ''}
                </p>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchAjo}
                  onChange={(e) => setSearchAjo(e.target.value)}
                  placeholder="Rechercher…"
                  className="fed-input-light pl-8 pr-3 py-2 text-[11px] font-bold !w-44"
                />
              </div>
            </div>
            <DecisionTable rows={ajournes} tone="red" />
          </div>
        </div>
      )}

      {/* ⭐ Sous-onglet RELEVÉ DE NOTES — déplacé du module Notes et Moyennes :
          aperçu officiel par candidat + PDF + envoi aux écoles (la décision
          d'envoi échoue tant que la délibération n'est pas lancée → bouton de
          renvoi « Ouvrir la délibération » vers le sous-onglet Délibération). */}
      {moduleTab === 'releves' && examId && (
        <FederisGradeRelevesTab
          key={`releves-${examId}`}
          examId={examId}
          subjectsVersion={0}
          onNeedDeliberation={() => setModuleTab('deliberation')}
          deliberationReady={board ? !!board.deliberation : undefined}
        />
      )}

      {/* Modale de lancement de la délibération (sous-onglet Délibération) */}
      {moduleTab === 'deliberation' && runOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setRunOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-blue-900">Lancer la délibération</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Jury « {board?.exam.code} » · seuils : admission{' '}
                  {fmtNote(board?.rules.passMark)}/20, rachat {fmtNote(board?.rules.rescueMark)}/20
                  {board?.rules.isCustom ? ' (règle personnalisée)' : ' (défauts backend)'}
                </p>
              </div>
              <button
                onClick={() => setRunOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">
                Nom officiel du jury
              </label>
              <input
                type="text"
                value={juryName}
                onChange={(e) => setJuryName(e.target.value)}
                autoFocus
                maxLength={190}
                placeholder="ex : Jury national BEPC 2026 — Session principale"
                className="fed-input-light px-4 py-2.5 text-sm font-bold w-full"
              />
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-[11px] text-blue-900 leading-relaxed">
                La délibération applique les <b>règles de calcul</b> en vigueur : moyenne ≥{' '}
                {fmtNote(board?.rules.passMark)}/20 → <b>admis</b> ; entre{' '}
                {fmtNote(board?.rules.rescueMark)} et {fmtNote(board?.rules.passMark)} →{' '}
                <b>cas limite</b> à trancher ; en dessous → <b>ajourné</b>. Les notes sont
                verrouillées (VALIDATED) et l&apos;examen passe en « Délibéré ».
              </p>
            </div>

            {runError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-semibold text-red-800">
                {runError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setRunOpen(false)}
                className="px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase bg-white border border-slate-200 text-slate-600"
              >
                Annuler
              </button>
              <button
                onClick={runDeliberation}
                disabled={working !== null || !juryName.trim()}
                className="fed-btn-navy px-5 py-2.5 text-[10px] font-bold uppercase disabled:opacity-50 inline-flex items-center gap-2"
              >
                {working === 'run' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Gavel className="w-4 h-4" />
                )}
                Délibérer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⭐ Modale professionnelle « Envoyer les relevés de notes aux écoles »
          (remplace le window.confirm générique) — données clés du board. */}
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
        details={
          board
            ? [
                { label: 'Examen', value: `${board.exam.code} — ${board.exam.name}` },
                { label: 'Candidats', value: board.stats.totalCandidates },
                { label: 'Admissibles', value: board.stats.admissibles },
                { label: 'Écoles destinataires', value: board.dispatch.schoolsCount },
              ]
            : undefined
        }
        note={
          <>
            Un nouvel envoi actualise les documents déjà distribués (décisions à jour).
            Le détail et l&apos;aperçu de chaque relevé se trouvent dans le sous-onglet
            « Relevé de notes » de ce module.
          </>
        }
        confirmLabel="Envoyer aux écoles"
        cancelLabel="Annuler"
        loading={working === 'dispatch'}
        onConfirm={dispatchReleves}
        onCancel={() => setConfirmDispatch(false)}
      />

      {/* ⭐ Modale professionnelle « Publier les résultats » (remplace le
          window.confirm générique) — avertissement d'irréversibilité. */}
      <FederisConfirmModal
        open={confirmPublish}
        title="Publier officiellement les résultats ?"
        message={
          <>
            La liste de délibération devient officielle pour l&apos;examen{' '}
            <b>{board?.exam.code}</b> : les parents et les écoles sont notifiés et les
            relevés peuvent être envoyés.
          </>
        }
        icon={ShieldCheck}
        tone="emerald"
        details={
          board
            ? [
                { label: 'Admis(e)s', value: board.stats.admissibles },
                { label: 'Ajourné(e)s', value: board.stats.ajournes },
                {
                  label: 'Taux de réussite',
                  value: board.stats.successRate != null ? `${fmtNote(board.stats.successRate)} %` : '—',
                },
              ]
            : undefined
        }
        warning={
          <>
            Action <b>officielle et irréversible</b> : les notes sont définitivement
            verrouillées et l&apos;examen passe en « Résultats publiés ».
          </>
        }
        note="Pensez ensuite à envoyer les relevés de notes aux écoles."
        confirmLabel="Publier les résultats"
        cancelLabel="Annuler"
        loading={working === 'publish'}
        onConfirm={publishResults}
        onCancel={() => setConfirmPublish(false)}
      />
    </FedPage>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tableau de décision (pattern Promotion & Redoublement Helm :
// matricule / nom prénom / moyenne / décision du jury — zébrures, pastilles)
// ═══════════════════════════════════════════════════════════════════════════

function DecisionTable({ rows, tone }: { rows: BoardRow[]; tone: 'emerald' | 'red' }) {
  if (rows.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-xs font-bold text-slate-400">Aucun candidat dans cette liste.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-[#f7f9fc] sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Matricule</th>
            <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Nom prénom</th>
            <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Moyenne</th>
            <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Décision du jury</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {rows.map((r, idx) => {
            const pill = decisionPill(r);
            return (
              <tr key={r.candidateId} className={idx % 2 === 1 ? 'bg-slate-50/60' : ''}>
                <td className="px-4 py-2.5">
                  <span className="font-mono text-[11px] font-bold text-slate-600">{r.matricule}</span>
                </td>
                <td className="px-4 py-2.5">
                  <p className="text-xs font-bold text-blue-900 truncate max-w-[220px]">{r.fullName}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase truncate max-w-[220px]">
                    {r.school}
                    {r.releveDispatched ? ' · relevé envoyé' : ''}
                  </p>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span
                    className={cn(
                      'text-xs font-black',
                      r.moyenne === null
                        ? 'text-slate-400'
                        : tone === 'emerald'
                          ? 'text-emerald-700'
                          : r.moyenne >= 10
                            ? 'text-emerald-600'
                            : 'text-red-600',
                    )}
                  >
                    {r.moyenne === null ? '—' : fmtNote(r.moyenne)}
                  </span>
                  {r.mention && (
                    <p className="text-[9px] font-bold text-slate-400 uppercase">{r.mention}</p>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={cn('px-2.5 py-1 rounded-full text-[9px] font-bold uppercase', pill.className)}>
                    {pill.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
