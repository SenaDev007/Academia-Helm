/**
 * FederisEpreuvesPage — Épreuves officielles (module « Épreuves et documents »)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ 2026-09-29 (refonte) — le module ne contient UNIQUEMENT que les épreuves :
 *    le sous-onglet « Catalogue » a été déplacé vers le module
 *    « Banque d'épreuves » (FederisQuestionBankPage — onglet Catalogue).
 *    Lien croisé : le catalogue ouvre l'éditeur d'une épreuve via
 *    /documents?edit=<id> (paramètre lu au montage → openEdit).
 *
 * Création des épreuves avec les MÊMES champs enrichis que les fiches
 * pédagogiques / épreuves enseignants d'Academia Helm (RichTextEditor :
 * images, diagrammes, symboles maths, opérations posées, fractions,
 * tableaux, calligraphie, formes Word…) :
 *   - En-tête RÉUTILISABLE du patronat (une fois défini, appliqué à
 *     toutes les épreuves) + en-tête ponctuel par épreuve ;
 *   - Corps : Situation d'évaluation → Tâche → sections LIBRES
 *     (Problème 1/2/3, Exercices… — libre arbitre selon la matière,
 *     AUCUN modèle standard imposé) ;
 *   - Clé / grille de correction (pages séparées du PDF) ;
 *   - PDF généré 100 % côté BACKEND (Puppeteer — pattern Helm).
 *
 * Isolation territoriale : chaque patronat ne voit QUE ses épreuves
 * (le patronat national dispose de la vue d'ensemble de son réseau).
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { canWrite } from '@/lib/patronat/permissions';
import { FedPage } from '@/components/federis/federis-motion';
// ⭐ Durées intelligentes (2026-09-30) : saisie en minutes → conversion en
//    heures en direct (120 → 2h) — la durée s'affiche en heures sur l'épreuve
import {
  minutesToHoursLabel,
  durationInputHint,
  normalizeDurationText,
} from '@/lib/federis/duration';

interface FederisEpreuvesPageProps {
  tenantId?: string;
  /** User.role de la session — repli si l'API ne répond pas */
  userRole?: string | null;
}

// ── Types (réponses API) ────────────────────────────────────────────────────

interface EpreuveSection {
  id: string;
  title: string;
  content: string;
}

interface EpreuveListItem {
  id: string;
  academicYearId: string;
  academicYearLabel: string | null;
  examCategory: string;
  examCategoryLabel: string;
  subject: string | null;
  title: string;
  sessionLabel: string | null;
  durationLabel: string | null;
  status: string;
  statusLabel: string;
  hasCorrection: boolean;
  sectionsCount: number;
  updatedAt: string;
}

interface EpreuveDetail extends EpreuveListItem {
  maxScoreLabel: string | null;
  coefficient: string | null;
  subjectId: string | null;
  showIdentityFields: boolean;
  customHeader: string;
  situation: string;
  tache: string;
  sections: EpreuveSection[];
  cleCorrection: string;
  grilleCorrection: string;
  footerText: string;
  canManage?: boolean;
}

interface ListResponse {
  academicYears: { id: string; label: string; name: string; isActive: boolean }[];
  activeYearId: string | null;
  canManage: boolean;
  epreuves: EpreuveListItem[];
}

// ⭐ Module Matières (2026-09-29) — catalogue des matières d'examen (le
//    champ Matière de l'éditeur puise dedans) + signal « épreuves à
//    préparer » pour les examens officiellement lancés (orange → vert).
interface SubjectOption {
  id: string;
  examType: string;
  series: string;
  code: string;
  name: string;
  /** ⭐ Durée paramétrée dans le module Matières (minutes) — pré-remplit le
   *    champ Durée de l'épreuve au format heures (120 → « 2h »). */
  duration: number | null;
}

interface ReadinessMissing {
  subjectId: string;
  code: string;
  name: string;
  series: string;
  hasPaper: boolean;
}

interface ReadinessData {
  launchedExams: number;
  totalMissing: number;
  allReady: boolean;
  exams: Array<{
    examId: string;
    code: string;
    name: string;
    examType: string;
    ready: boolean;
    subjectsCount: number;
    missingCount: number;
    missing: ReadinessMissing[];
  }>;
}

const CATEGORIES = [
  { code: 'CEP', label: 'CEP', full: 'CEP — Certificat d\u2019Études Primaires' },
  { code: 'BEPC', label: 'BEPC', full: 'BEPC — Brevet du Premier Cycle' },
  { code: 'BAC', label: 'Baccalauréat', full: 'Baccalauréat' },
  { code: 'CAP', label: 'CAP', full: 'CAP — Certificat d\u2019Aptitude Professionnelle' },
];

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  VALIDATED: 'bg-green-100 text-green-800',
  LOCKED: 'bg-slate-200 text-slate-700',
};

const EMPTY_FORM = {
  title: '',
  examCategory: 'CEP',
  subject: '',
  // ⭐ Lien exact vers la matière du catalogue (module Matières)
  subjectId: '' as string | null,
  sessionLabel: '',
  durationLabel: '',
  maxScoreLabel: '',
  coefficient: '',
  showIdentityFields: true,
  customHeader: '',
  situation: '',
  tache: '',
  sections: [] as EpreuveSection[],
  cleCorrection: '',
  grilleCorrection: '',
  footerText: '',
};

type EditorState =
  | { mode: 'closed' }
  | { mode: 'new' }
  | { mode: 'edit'; id: string; status: string };

export default function FederisEpreuvesPage({ userRole }: FederisEpreuvesPageProps) {
  // ── Données liste ───────────────────────────────────────────────────────
  const [list, setList] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Module Matières — catalogue + signal « épreuves à préparer » ──────
  const [subjectsCatalog, setSubjectsCatalog] = useState<SubjectOption[]>([]);
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);

  // ── En-tête réutilisable du patronat ────────────────────────────────────
  const [headerHtml, setHeaderHtml] = useState('');
  const [headerOpen, setHeaderOpen] = useState(false);
  const [headerSavedAt, setHeaderSavedAt] = useState<string | null>(null);
  const [headerSaving, setHeaderSaving] = useState(false);

  // ── Éditeur ─────────────────────────────────────────────────────────────
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [showCustomHeader, setShowCustomHeader] = useState(false);
  const dirtyRef = useRef(false);

  const fallbackCanManage = canWrite(userRole, 'exam_org');
  const canManage = list?.canManage ?? fallbackCanManage;

  // ── Chargement initial ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/federis/patronat/epreuves', { timeout: 30000 });
      setList(res.data ?? null);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ?? 'Impossible de charger les épreuves.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHeader = useCallback(async () => {
    try {
      const res = await apiClient.get('/federis/patronat/epreuves/header', { timeout: 15000 });
      setHeaderHtml(res.data?.header ?? '');
    } catch {
      /* silencieux — l'en-tête est optionnel */
    }
  }, []);

  // ⭐ Module Matières — catalogue (champ Matière) + signal « épreuves à
  //    préparer » (bandeau) ; échec silencieux : le module reste utilisable.
  const loadSubjectsContext = useCallback(async () => {
    try {
      const [subjectsRes, readinessRes] = await Promise.all([
        apiClient.get('/federis/subjects', { timeout: 20000 }).catch(() => null),
        apiClient.get('/federis/subjects/readiness', { timeout: 20000 }).catch(() => null),
      ]);
      if (subjectsRes?.data?.subjects) {
        setSubjectsCatalog(
          (subjectsRes.data.subjects as any[])
            .filter((s: any) => s.isActive !== false)
            .map((s: any) => ({
              id: s.id,
              examType: s.examType,
              series: s.series ?? '',
              code: s.code,
              name: s.name,
              duration: typeof s.duration === 'number' ? s.duration : null,
            })),
        );
      }
      if (readinessRes?.data) setReadiness(readinessRes.data);
    } catch {
      /* silencieux */
    }
  }, []);

  useEffect(() => {
    void load();
    void loadHeader();
    void loadSubjectsContext();
  }, [load, loadHeader, loadSubjectsContext]);

  // ── En-tête réutilisable : enregistrement ───────────────────────────────
  const saveHeader = async () => {
    setHeaderSaving(true);
    try {
      await apiClient.put(
        '/federis/patronat/epreuves/header',
        { header: headerHtml },
        { timeout: 30000 },
      );
      setHeaderSavedAt(
        new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      );
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Enregistrement de l\u2019en-tête impossible.');
    } finally {
      setHeaderSaving(false);
    }
  };

  // ── Éditeur : ouverture / fermeture ─────────────────────────────────────
  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditor({ mode: 'new' });
    setFormError(null);
    setSavedAt(null);
    setShowCorrection(false);
    setShowCustomHeader(false);
    dirtyRef.current = false;
  };

  const openEdit = async (id: string) => {
    setEditor({ mode: 'edit', id, status: 'DRAFT' });
    setFormError(null);
    setSavedAt(null);
    setShowCorrection(false);
    setShowCustomHeader(false);
    try {
      const res = await apiClient.get(`/federis/patronat/epreuves/${id}`, { timeout: 30000 });
      const d: EpreuveDetail = res.data;
      setForm({
        title: d.title ?? '',
        examCategory: d.examCategory ?? 'CEP',
        subject: d.subject ?? '',
        subjectId: d.subjectId ?? null,
        sessionLabel: d.sessionLabel ?? '',
        durationLabel: d.durationLabel ?? '',
        maxScoreLabel: d.maxScoreLabel ?? '',
        coefficient: d.coefficient ?? '',
        showIdentityFields: d.showIdentityFields !== false,
        customHeader: d.customHeader ?? '',
        situation: d.situation ?? '',
        tache: d.tache ?? '',
        sections: Array.isArray(d.sections) ? d.sections : [],
        cleCorrection: d.cleCorrection ?? '',
        grilleCorrection: d.grilleCorrection ?? '',
        footerText: d.footerText ?? '',
      });
      setShowCorrection(!!(d.cleCorrection || d.grilleCorrection));
      setShowCustomHeader(!!d.customHeader);
      setEditor({ mode: 'edit', id, status: d.status });
      dirtyRef.current = false;
    } catch (err: any) {
      setFormError(err?.response?.data?.message ?? 'Chargement de l\u2019épreuve impossible.');
      setEditor({ mode: 'closed' });
    }
  };

  const closeEditor = () => {
    setEditor({ mode: 'closed' });
    setFormError(null);
    setNotice(null);
  };

  // ── Lien croisé Banque d'épreuves → Éditeur ────────────────────────────
  // Le catalogue (module « Banque d'épreuves ») ouvre une épreuve via
  // /documents?edit=<id> : on lit le paramètre au montage et on ouvre
  // directement l'éditeur.
  useEffect(() => {
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (editId) void openEdit(editId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Éditeur : enregistrement (création / mise à jour) ───────────────────
  const buildPayload = () => ({
    title: form.title.trim() || 'Épreuve sans titre',
    examCategory: form.examCategory,
    subject: form.subject || null,
    // ⭐ Lien exact vers la matière du catalogue (module Matières)
    subjectId: form.subjectId || null,
    sessionLabel: form.sessionLabel || null,
    durationLabel: form.durationLabel || null,
    maxScoreLabel: form.maxScoreLabel || null,
    coefficient: form.coefficient || null,
    showIdentityFields: form.showIdentityFields,
    customHeader: form.customHeader || null,
    situation: form.situation || null,
    tache: form.tache || null,
    sections: form.sections,
    cleCorrection: form.cleCorrection || null,
    grilleCorrection: form.grilleCorrection || null,
    footerText: form.footerText || null,
  });

  const save = useCallback(
    async (silent = false): Promise<string | null> => {
      if (!silent) setSaving(true);
      try {
        if (editor.mode === 'new') {
          const res = await apiClient.post(
            '/federis/patronat/epreuves',
            buildPayload(),
            { timeout: 60000 },
          );
          const id = res.data?.id as string;
          setEditor({ mode: 'edit', id, status: res.data?.status ?? 'DRAFT' });
          setSavedAt(
            new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          );
          dirtyRef.current = false;
          await load();
          // ⭐ Le signal « épreuves à préparer » peut passer au vert
          void loadSubjectsContext();
          if (!silent) setNotice('Épreuve créée — les modifications sont désormais enregistrées automatiquement.');
          return id;
        }
        if (editor.mode === 'edit') {
          await apiClient.patch(
            `/federis/patronat/epreuves/${editor.id}`,
            buildPayload(),
            { timeout: 60000 },
          );
          setSavedAt(
            new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          );
          dirtyRef.current = false;
          await load();
          return editor.id;
        }
        return null;
      } catch (err: any) {
        const msg = err?.response?.data?.message;
        setFormError(
          (Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Enregistrement impossible.',
        );
        return null;
      } finally {
        if (!silent) setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, form, load, loadSubjectsContext],
  );

  // ── Autosave (10 s — pattern fiches pédagogiques Helm) ──────────────────
  useEffect(() => {
    if (editor.mode !== 'edit') return;
    const t = setInterval(() => {
      if (dirtyRef.current) void save(true);
    }, 10_000);
    return () => clearInterval(t);
  }, [editor.mode, save]);

  const markDirty = () => {
    dirtyRef.current = true;
  };

  // ── Statut (valider / verrouiller) ──────────────────────────────────────
  const changeStatus = async (status: 'VALIDATED' | 'LOCKED') => {
    if (editor.mode !== 'edit') return;
    try {
      // Sauvegarde les dernières modifications avant transition
      await save(true);
      await apiClient.patch(
        `/federis/patronat/epreuves/${editor.id}`,
        { status },
        { timeout: 30000 },
      );
      setEditor({ ...editor, status });
      await load();
      setNotice(
        status === 'VALIDATED'
          ? 'Épreuve validée.'
          : 'Épreuve verrouillée — immuable (sécurité des sujets avant impression).',
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setFormError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Transition impossible.');
    }
  };

  // ── Suppression ─────────────────────────────────────────────────────────
  const remove = async (id: string) => {
    if (!window.confirm('Supprimer définitivement cette épreuve ?')) return;
    try {
      await apiClient.delete(`/federis/patronat/epreuves/${id}`, { timeout: 30000 });
      if (editor.mode === 'edit' && editor.id === id) closeEditor();
      await load();
      setNotice('Épreuve supprimée.');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError((Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Suppression impossible.');
    }
  };

  // ── PDF (génération 100 % backend, téléchargement blob) ─────────────────
  /** Sauvegarde les modifications en cours puis génère le PDF. */
  const saveAndDownload = async (id: string, label: string) => {
    if (editor.mode === 'edit' && editor.id === id && dirtyRef.current) {
      const savedId = await save(true);
      if (!savedId) return; // l'erreur est déjà affichée par save()
    }
    await downloadPdf(id, label);
  };

  const downloadPdf = async (id: string, label: string) => {
    setDownloading(id);
    setNotice(null);
    try {
      const res = await apiClient.get(`/federis/patronat/epreuves/${id}/pdf`, {
        responseType: 'blob',
        timeout: 120000,
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `epreuve-${label}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setNotice(`Téléchargement de « ${label} » lancé.`);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      let text: string | null = null;
      if (err?.response?.data instanceof Blob) {
        try {
          text = (await err.response.data.text()).slice(0, 300);
          const parsed = JSON.parse(text);
          text = parsed?.message ?? text;
        } catch {
          /* garde le brut */
        }
      }
      setError(
        text ??
          (Array.isArray(msg) ? msg.join(' ') : msg) ??
          'Génération du PDF impossible.',
      );
    } finally {
      setDownloading(null);
    }
  };

  // ── Sections libres (libre arbitre — aucun modèle standard) ─────────────
  const addSection = (kind: 'Problème' | 'Exercice' | 'Section') => {
    const n = form.sections.filter((s) => s.title.startsWith(kind)).length + 1;
    setForm({
      ...form,
      sections: [
        ...form.sections,
        { id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: `${kind} ${n}`, content: '' },
      ],
    });
    markDirty();
  };

  const updateSection = (id: string, patch: Partial<EpreuveSection>) => {
    setForm({
      ...form,
      sections: form.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
    markDirty();
  };

  const removeSection = (id: string) => {
    setForm({ ...form, sections: form.sections.filter((s) => s.id !== id) });
    markDirty();
  };

  const moveSection = (id: string, dir: -1 | 1) => {
    const idx = form.sections.findIndex((s) => s.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= form.sections.length) return;
    const sections = [...form.sections];
    [sections[idx], sections[target]] = [sections[target], sections[idx]];
    setForm({ ...form, sections });
    markDirty();
  };

  // ═════════════════════════════ RENDU ═══════════════════════════════════

  const editorOpen = editor.mode !== 'closed';
  const locked = editor.mode === 'edit' && editor.status === 'LOCKED';

  return (
    <FedPage className="space-y-6">
      {/* En-tête du module */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="fed-badge mb-3">Épreuves officielles</div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900 tracking-tight">
            Épreuves et documents
          </h1>
          <p className="text-slate-500 font-medium mt-1 text-sm">
            Créez vos épreuves officielles (CEP, BEPC, Baccalauréat, CAP) avec la
            mise en forme enrichie d&apos;Academia Helm — le catalogue par année
            scolaire est disponible dans la Banque d&apos;épreuves.
          </p>
        </div>
        {canManage && !editorOpen && (
          <button onClick={openNew} className="fed-btn-gold px-4 py-2.5 text-sm">
            <AppIcon name="add" size="submenu" />
            Nouvelle épreuve
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-3 text-sm font-semibold text-green-800">
          {notice}
        </div>
      )}

      {/* ⭐ Module Matières — signal « épreuves à préparer » (examens lancés) :
          orange tant qu'une matière d'un examen lancé n'a pas son épreuve,
          vert dès que tout est préparé. */}
      {readiness && readiness.launchedExams > 0 && !editorOpen && (
        <div
          className={cn(
            'rounded-xl px-6 py-5 border space-y-3',
            readiness.allReady
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-amber-50 border-amber-200',
          )}
        >
          <div className="flex items-start gap-3">
            <AppIcon
              name={readiness.allReady ? 'success' : 'warning'}
              size="menu"
              className={cn(
                'mt-0.5',
                readiness.allReady ? 'text-emerald-600' : 'text-amber-600',
              )}
            />
            <div className="flex-1">
              <p
                className={cn(
                  'text-sm font-bold',
                  readiness.allReady ? 'text-emerald-900' : 'text-amber-900',
                )}
              >
                {readiness.allReady
                  ? 'Toutes les épreuves des examens lancés sont préparées — tout est au vert.'
                  : `${readiness.totalMissing} épreuve(s) à préparer sur ${readiness.launchedExams} examen(s) officiellement lancé(s).`}
              </p>
              <p className="text-xs mt-1 text-slate-600 font-medium">
                Les matières des examens lancés sont définies dans le module Matières —
                préparez l&apos;épreuve de chaque matière ci-dessous pour passer au vert.
              </p>
            </div>
            {canManage && !readiness.allReady && (
              <button onClick={openNew} className="fed-btn-gold px-4 py-2.5 text-xs shrink-0">
                Préparer une épreuve
              </button>
            )}
          </div>
          {!readiness.allReady && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {readiness.exams
                .filter((e) => !e.ready)
                .map((exam) => (
                  <div
                    key={exam.examId}
                    className="rounded-xl px-4 py-3 border border-amber-200 bg-white/70"
                  >
                    <p className="text-xs font-bold text-blue-900">
                      {exam.code} — {exam.name}
                    </p>
                    <p className="text-[10px] font-semibold text-amber-800 mt-1 leading-relaxed">
                      À préparer :{' '}
                      {exam.missing
                        .slice(0, 6)
                        .map((m) => m.name)
                        .join(', ')}
                      {exam.missing.length > 6 ? `… (+${exam.missing.length - 6})` : ''}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ÉDITEUR (création / modification d'une épreuve)
         ════════════════════════════════════════════════════════════════════ */}
      {editorOpen && (
        <div className="space-y-5">
          {/* Barre d'état de l'éditeur */}
          <div className="fed-card px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors"
              >
                <AppIcon name="close" size="submenu" />
                Fermer
              </button>
              <div>
                <h2 className="text-sm font-bold text-blue-900">
                  {editor.mode === 'new' ? 'Nouvelle épreuve' : 'Modifier l\u2019épreuve'}
                </h2>
                {editor.mode === 'edit' && (
                  <span
                    className={cn(
                      'inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase',
                      STATUS_STYLES[editor.status] ?? 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {editor.status === 'DRAFT'
                      ? 'Brouillon'
                      : editor.status === 'VALIDATED'
                        ? 'Validée'
                        : 'Verrouillée (immuable)'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {savedAt && (
                <span className="text-[10px] font-semibold text-slate-400">
                  Enregistré à {savedAt}
                </span>
              )}
              {canManage && (
                <div className="flex items-center gap-2">
                  {editor.mode === 'edit' && !locked && (
                    <>
                      {editor.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => changeStatus('VALIDATED')}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors"
                        >
                          Valider
                        </button>
                      )}
                      {editor.status === 'VALIDATED' && (
                        <button
                          type="button"
                          onClick={() => changeStatus('LOCKED')}
                          className="px-3 py-2 bg-blue-900 text-white rounded-lg text-xs font-semibold hover:bg-blue-800 transition-colors"
                          title="Verrouiller définitivement (sécurité des sujets avant impression)"
                        >
                          Verrouiller
                        </button>
                      )}
                    </>
                  )}
                  {editor.mode === 'edit' && (
                    <button
                      type="button"
                      onClick={() => remove(editor.id)}
                      className="px-3 py-2 bg-red-50 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
              {formError}
            </div>
          )}

          {locked && (
            <div className="bg-slate-100 border border-slate-200 rounded-xl px-6 py-4 text-sm font-semibold text-slate-700">
              Cette épreuve est verrouillée : elle est immuable (sécurité des sujets
              avant impression). Consultez le PDF ou dupliquez le contenu dans une
              nouvelle épreuve.
            </div>
          )}

          {/* Champs généraux */}
          <div className="fed-card p-6 space-y-5">
            <h3 className="text-xs font-bold text-blue-900 uppercase">Informations générales</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                  Titre de l&apos;épreuve *
                </label>
                <input
                  value={form.title}
                  onChange={(e) => {
                    setForm({ ...form, title: e.target.value });
                    markDirty();
                  }}
                  disabled={locked}
                  placeholder="Épreuve de Mathématiques — BEPC 2027"
                  className="fed-input-light px-4 py-3 font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                  Examen *
                </label>
                <select
                  value={form.examCategory}
                  onChange={(e) => {
                    setForm({ ...form, examCategory: e.target.value });
                    markDirty();
                  }}
                  disabled={locked}
                  className="fed-input-light px-4 py-3 font-semibold"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.full}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                  Matière
                </label>
                {/* ⭐ Module Matières — la matière est choisie dans le CATALOGUE
                    du type d'examen (lien exact subjectId → signal vert) ;
                    l'ancienne valeur texte est conservée si elle n'y figure
                    pas (épreuves antérieures au module). */}
                {(() => {
                  const options = subjectsCatalog.filter(
                    (s) => s.examType === form.examCategory,
                  );
                  const currentId =
                    form.subjectId && options.some((o) => o.id === form.subjectId)
                      ? form.subjectId
                      : form.subject
                        ? '__custom__'
                        : '';
                  return (
                    <select
                      value={currentId}
                      disabled={locked}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || v === '__custom__') {
                          setForm({ ...form, subjectId: null });
                        } else {
                          const opt = options.find((o) => o.id === v);
                          // ⭐ Pré-remplissage intelligent de la durée : si la
                          //    matière sélectionnée a une durée paramétrée
                          //    (module Matières) et que le champ est vide, on
                          //    l'insère au format heures (120 min → « 2h »).
                          const prefillDuration =
                            opt?.duration && !form.durationLabel.trim()
                              ? minutesToHoursLabel(opt.duration)
                              : form.durationLabel;
                          setForm({
                            ...form,
                            subjectId: v,
                            subject: opt ? opt.name : form.subject,
                            durationLabel: prefillDuration,
                          });
                        }
                        markDirty();
                      }}
                      className="fed-input-light px-4 py-3 font-semibold"
                    >
                      <option value="">— Aucune —</option>
                      {options.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.series ? ` (${s.series})` : ''} · {s.code}
                        </option>
                      ))}
                      {currentId === '__custom__' && (
                        <option value="__custom__">{form.subject} (hors catalogue)</option>
                      )}
                    </select>
                  );
                })()}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                  Session
                </label>
                <input
                  value={form.sessionLabel}
                  onChange={(e) => {
                    setForm({ ...form, sessionLabel: e.target.value });
                    markDirty();
                  }}
                  disabled={locked}
                  placeholder="Session normale 2027"
                  className="fed-input-light px-4 py-3 font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                  Durée
                </label>
                <input
                  value={form.durationLabel}
                  onChange={(e) => {
                    setForm({ ...form, durationLabel: e.target.value });
                    markDirty();
                  }}
                  onBlur={(e) => {
                    // ⭐ Conversion intelligente au blur : « 120 » (minutes)
                    //    devient « 2h », « 45 » devient « 45 min » ; une
                    //    valeur déjà horaire (« 1h30 ») est conservée.
                    const normalized = normalizeDurationText(e.target.value);
                    if (normalized !== e.target.value) {
                      setForm({ ...form, durationLabel: normalized });
                      markDirty();
                    }
                  }}
                  disabled={locked}
                  placeholder="2h · 1h30 · ou 120 (minutes)"
                  className="fed-input-light px-4 py-3 font-semibold"
                />
                {/* ⭐ Conversion en direct : 120 → « = 2h » dès la saisie */}
                {durationInputHint(form.durationLabel) && (
                  <p className="text-[10px] font-bold text-emerald-700 mt-1.5">
                    = {durationInputHint(form.durationLabel)} sur l&apos;épreuve
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                  Barème
                </label>
                <input
                  value={form.maxScoreLabel}
                  onChange={(e) => {
                    setForm({ ...form, maxScoreLabel: e.target.value });
                    markDirty();
                  }}
                  disabled={locked}
                  placeholder="20 pts"
                  className="fed-input-light px-4 py-3 font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                  Coefficient
                </label>
                <input
                  value={form.coefficient}
                  onChange={(e) => {
                    setForm({ ...form, coefficient: e.target.value });
                    markDirty();
                  }}
                  disabled={locked}
                  placeholder="3"
                  className="fed-input-light px-4 py-3 font-semibold"
                />
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.showIdentityFields}
                onChange={(e) => {
                  setForm({ ...form, showIdentityFields: e.target.checked });
                  markDirty();
                }}
                disabled={locked}
                className="w-4 h-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
              />
              <span className="text-xs font-semibold text-slate-600">
                Afficher les champs « Nom / Prénoms » (pointillés) sur l&apos;épreuve
              </span>
            </label>
          </div>

          {/* En-tête ponctuel (surcharge de l'en-tête patronat) */}
          <div className="fed-card p-6">
            <button
              type="button"
              onClick={() => setShowCustomHeader((v) => !v)}
              className="flex items-center justify-between w-full text-left"
            >
              <div>
                <h3 className="text-xs font-bold text-blue-900 uppercase">
                  En-tête spécifique à cette épreuve (optionnel)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Par défaut, l&apos;en-tête réutilisable du patronat est appliqué —
                  définissez-le une fois dans l&apos;onglet « Épreuves ».
                </p>
              </div>
              <span className="text-[10px] font-bold text-blue-800 uppercase flex-shrink-0 ml-4">
                {showCustomHeader ? 'Masquer' : 'Personnaliser'}
              </span>
            </button>
            {showCustomHeader && (
              <div className="mt-4">
                <RichTextEditor
                  value={form.customHeader}
                  onChange={(html) => {
                    setForm({ ...form, customHeader: html });
                    markDirty();
                  }}
                  disabled={locked}
                  enableMedia
                  placeholder="En-tête spécifique (logo, coordonnées, mentions officielles…) — remplace l'en-tête du patronat pour cette épreuve uniquement"
                  minHeight="120px"
                  maxHeight="none"
                />
              </div>
            )}
          </div>

          {/* Corps de l'épreuve */}
          <div className="fed-card p-6 space-y-5">
            <div>
              <h3 className="text-xs font-bold text-blue-900 uppercase">Corps de l&apos;épreuve</h3>
              <p className="text-xs text-slate-400 mt-1">
                Structurez librement : situation d&apos;évaluation, tâche, puis
                Problèmes / Exercices / sections selon la matière (libre arbitre —
                aucun modèle standard imposé).
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Situation d&apos;évaluation (contexte)
              </label>
              <RichTextEditor
                value={form.situation}
                onChange={(html) => {
                  setForm({ ...form, situation: html });
                  markDirty();
                }}
                disabled={locked}
                enableMedia
                placeholder="Contexte de l'épreuve (BEPC / Baccalauréat / CAP)…"
                minHeight="140px"
                maxHeight="none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Tâche
              </label>
              <RichTextEditor
                value={form.tache}
                onChange={(html) => {
                  setForm({ ...form, tache: html });
                  markDirty();
                }}
                disabled={locked}
                enableMedia
                placeholder="Tâche demandée au candidat…"
                minHeight="100px"
                maxHeight="none"
              />
            </div>

            {/* Sections libres */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase">
                  Problèmes / Exercices / Sections libres
                </label>
                {!locked && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addSection('Problème')}
                      className="px-3 py-1.5 bg-blue-50 text-blue-800 rounded-lg text-[11px] font-semibold hover:bg-blue-100 transition-colors"
                    >
                      + Problème
                    </button>
                    <button
                      type="button"
                      onClick={() => addSection('Exercice')}
                      className="px-3 py-1.5 bg-blue-50 text-blue-800 rounded-lg text-[11px] font-semibold hover:bg-blue-100 transition-colors"
                    >
                      + Exercice
                    </button>
                    <button
                      type="button"
                      onClick={() => addSection('Section')}
                      className="px-3 py-1.5 bg-blue-50 text-blue-800 rounded-lg text-[11px] font-semibold hover:bg-blue-100 transition-colors"
                    >
                      + Section libre
                    </button>
                  </div>
                )}
              </div>

              {form.sections.length === 0 && (
                <p className="text-xs text-slate-400 italic">
                  Aucune section — ajoutez des « Problèmes » (épreuves de mathématiques :
                  Problème 1, 2, 3…), des « Exercices » ou des sections libres intitulées
                  à votre guise.
                </p>
              )}

              {form.sections.map((s, i) => (
                <div key={s.id} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-[#f7f9fc]">
                  <div className="flex items-center gap-2">
                    <input
                      value={s.title}
                      onChange={(e) => updateSection(s.id, { title: e.target.value })}
                      disabled={locked}
                      className="fed-input-light px-3 py-2 text-sm font-bold flex-1"
                      placeholder="Intitulé (Problème 1, Exercice 2, Partie A…)"
                    />
                    {!locked && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => moveSection(s.id, -1)}
                          disabled={i === 0}
                          className="p-1.5 bg-white border border-slate-200 rounded text-slate-500 hover:text-blue-900 disabled:opacity-30"
                          title="Monter"
                        >
                          <AppIcon name="chevronUp" size="submenu" className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(s.id, 1)}
                          disabled={i === form.sections.length - 1}
                          className="p-1.5 bg-white border border-slate-200 rounded text-slate-500 hover:text-blue-900 disabled:opacity-30"
                          title="Descendre"
                        >
                          <AppIcon name="chevronUp" size="submenu" className="w-3 h-3 rotate-180" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSection(s.id)}
                          className="p-1.5 bg-red-50 border border-red-200 rounded text-red-600 hover:bg-red-100"
                          title="Supprimer la section"
                        >
                          <AppIcon name="close" size="submenu" className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  <RichTextEditor
                    value={s.content}
                    onChange={(html) => updateSection(s.id, { content: html })}
                    disabled={locked}
                    enableMedia
                    placeholder="Contenu de la section (énoncé, questions, figures, tableaux…)"
                    minHeight="120px"
                    maxHeight="none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Correction (documents organisateur — pages séparées du PDF) */}
          <div className="fed-card p-6">
            <button
              type="button"
              onClick={() => setShowCorrection((v) => !v)}
              className="flex items-center justify-between w-full text-left"
            >
              <div>
                <h3 className="text-xs font-bold text-blue-900 uppercase">
                  Correction (document organisateur — pages séparées)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  La clé et la grille de correction sont générées sur des pages
                  séparées du PDF, jamais mêlées au sujet distribué aux candidats.
                </p>
              </div>
              <span className="text-[10px] font-bold text-blue-800 uppercase flex-shrink-0 ml-4">
                {showCorrection ? 'Masquer' : 'Afficher'}
              </span>
            </button>
            {showCorrection && (
              <div className="mt-4 space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                    Clé de correction
                  </label>
                  <RichTextEditor
                    value={form.cleCorrection}
                    onChange={(html) => {
                      setForm({ ...form, cleCorrection: html });
                      markDirty();
                    }}
                    disabled={locked}
                    enableMedia
                    placeholder="Réponses attendues, barème détaillé…"
                    minHeight="120px"
                    maxHeight="none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                    Grille de correction
                  </label>
                  <RichTextEditor
                    value={form.grilleCorrection}
                    onChange={(html) => {
                      setForm({ ...form, grilleCorrection: html });
                      markDirty();
                    }}
                    disabled={locked}
                    enableMedia
                    placeholder="Grille critériée (tableaux, critères, points…)"
                    minHeight="120px"
                    maxHeight="none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pied de page */}
          <div className="fed-card p-6">
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
              Pied de page de l&apos;épreuve
            </label>
            <input
              value={form.footerText}
              onChange={(e) => {
                setForm({ ...form, footerText: e.target.value });
                markDirty();
              }}
              disabled={locked}
              placeholder="Ex : « Le candidat traitera les trois problèmes — Aucun document n'est autorisé »"
              className="fed-input-light px-4 py-3"
            />
            <p className="text-[10px] text-slate-400 mt-2">
              Affiché au bas de l&apos;épreuve, au-dessus de la pagination automatique
              (nom du patronat · Academia Federis · page X/Y).
            </p>
          </div>

          {/* Actions */}
          {!locked && (
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="fed-btn-gold px-6 py-3 text-sm disabled:opacity-50"
              >
                {saving ? 'Enregistrement…' : editor.mode === 'new' ? 'Créer l\u2019épreuve' : 'Enregistrer'}
              </button>
              {editor.mode === 'edit' && (
                <button
                  type="button"
                  onClick={() => void saveAndDownload(editor.id, form.subject || form.title)}
                  disabled={downloading !== null}
                  className="fed-btn-navy px-6 py-3 text-sm disabled:opacity-50"
                >
                  {downloading !== null ? 'Génération…' : 'Générer le PDF'}
                </button>
              )}
            </div>
          )}
          {locked && editor.mode === 'edit' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => downloadPdf(editor.id, form.subject || form.title)}
                disabled={downloading !== null}
                className="fed-btn-gold px-6 py-3 text-sm disabled:opacity-50"
              >
                {downloading !== null ? 'Génération…' : 'Générer le PDF'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          LISTE DES ÉPREUVES + EN-TÊTE RÉUTILISABLE
         ════════════════════════════════════════════════════════════════════ */}
      {!editorOpen && (
        <div className="space-y-5">
          {/* En-tête réutilisable du patronat */}
          <div className="fed-card p-6">
            <button
              type="button"
              onClick={() => setHeaderOpen((v) => !v)}
              className="flex items-center justify-between w-full text-left"
            >
              <div>
                <h2 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                  <AppIcon name="exams" size="submenu" className="text-blue-900" />
                  En-tête réutilisable des épreuves
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Définissez une fois l&apos;en-tête de votre patronat (logo, mentions
                  officielles, coordonnées) — il est appliqué automatiquement à toutes
                  vos épreuves (sauf en-tête spécifique).
                </p>
              </div>
              <span className="text-[10px] font-bold text-blue-800 uppercase flex-shrink-0 ml-4">
                {headerOpen ? 'Masquer' : headerHtml ? 'Défini — modifier' : 'Définir'}
              </span>
            </button>
            {headerOpen && (
              <div className="mt-4 space-y-3">
                <RichTextEditor
                  value={headerHtml}
                  onChange={setHeaderHtml}
                  disabled={!canManage}
                  enableMedia
                  placeholder="En-tête officiel du patronat (ex : RÉPUBLIQUE DU BÉNIN / Patronat des Établissements Scolaires Privés du Borgou / logo / coordonnées…)"
                  minHeight="160px"
                  maxHeight="none"
                />
                {canManage && (
                  <div className="flex items-center justify-end gap-3">
                    {headerSavedAt && (
                      <span className="text-[10px] font-semibold text-slate-400">
                        Enregistré à {headerSavedAt}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void saveHeader()}
                      disabled={headerSaving}
                      className="fed-btn-gold px-5 py-2 text-xs disabled:opacity-50"
                    >
                      {headerSaving ? 'Enregistrement…' : 'Enregistrer l\u2019en-tête'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Liste des épreuves */}
          <div className="fed-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-[#f7f9fc]">
                  <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Épreuve</th>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Examen</th>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Année</th>
                    <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Statut</th>
                    <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Sections</th>
                    <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm font-bold text-slate-400">
                        Chargement…
                      </td>
                    </tr>
                  ) : (list?.epreuves ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm font-bold text-slate-400">
                        Aucune épreuve pour le moment.
                        {canManage ? ' Créez votre première épreuve officielle.' : ''}
                      </td>
                    </tr>
                  ) : (
                    (list?.epreuves ?? []).map((e) => (
                      <tr key={e.id} className="hover:bg-[#f7f9fc]">
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-blue-900">{e.title}</div>
                          <div className="text-[10px] font-semibold text-slate-400">
                            {[e.subject, e.sessionLabel, e.durationLabel].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-blue-800">
                          {e.examCategoryLabel}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                          {e.academicYearLabel ?? '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              'px-2.5 py-1 rounded text-[9px] font-bold uppercase inline-block',
                              STATUS_STYLES[e.status] ?? 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {e.statusLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-bold text-blue-900">
                          {e.sectionsCount}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void openEdit(e.id)}
                              className="px-3 py-1.5 bg-blue-50 rounded-lg text-[11px] font-semibold text-blue-800 hover:bg-blue-800 hover:text-white transition-colors"
                            >
                              Ouvrir
                            </button>
                            <button
                              type="button"
                              onClick={() => void downloadPdf(e.id, e.subject || e.title)}
                              disabled={downloading !== null}
                              className="px-3 py-1.5 bg-blue-50 rounded-lg text-[11px] font-semibold text-blue-800 hover:bg-blue-800 hover:text-white transition-colors disabled:opacity-50"
                            >
                              {downloading === e.id ? '…' : 'PDF'}
                            </button>
                            {canManage && e.status !== 'LOCKED' && (
                              <button
                                type="button"
                                onClick={() => void remove(e.id)}
                                className="px-3 py-1.5 bg-red-50 rounded-lg text-[11px] font-semibold text-red-700 hover:bg-red-100 transition-colors"
                              >
                                Supprimer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </FedPage>
  );
}
