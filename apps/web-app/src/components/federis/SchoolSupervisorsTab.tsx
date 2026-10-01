/**
 * SchoolSupervisorsTab — « Gestion des surveillants / Correction » (portail école Helm)
 * ═══════════════════════════════════════════════════════════════════════════
 * Section du module « Patronats & Examens » (/app/federis) — 2026-09-29,
 * refondue le 2026-09-30 (retours utilisateur) :
 *
 *   1. DEMANDES REÇUES — le patronat (Federis) demande à l'école de présenter
 *      ses enseignants. ⭐ La note circulaire est désormais présentée comme
 *      une VÉRITABLE LETTRE PROFESSIONNELLE (en-tête, objet, sections,
 *      signature) — plus de texte « en vrac ».
 *   2. ENSEIGNANTS ENVOYÉS — ⭐ sous-onglet dédié : l'école voit QUels
 *      enseignants elle a transmis au patronat, par demande, avec le statut
 *      de chacun (« en attente d'affectation » ou « affecté » et à quel
 *      poste) en attendant la liste des affectations du patronat.
 *   3. AFFECTATIONS REÇUES — après la répartition par le patronat, chaque
 *      enseignant est visible (poste, centre, salle) et l'école TRANSMET la
 *      notification à l'UI de l'enseignant (bouton par enseignant ou
 *      « Notifier tous »).
 *
 * Workflow complet : POST /federis/school/supervisors/requests/:id/submit —
 * la sélection peut être renvoyée tant que la demande est ouverte.
 *
 * API : /federis/school/supervisors/** (FederisSchoolSupervisorsController).
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import {
  parseCircularNote,
  circularNoteExcerpt,
  type ParsedCircularNote,
} from '@/lib/federis/circular-note-parser';

// ── Types (réponses API) ────────────────────────────────────────────────────

interface SchoolTeacher {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string | null;
  phone: string | null;
  email: string | null;
  subject: string | null;
}

/** ⭐ 2026-09-30 — enseignant détaillé de la soumission (sous-onglet
 *    « Enseignants envoyés ») : l'API retourne désormais la liste nominative. */
interface SubmittedTeacher {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string | null;
  phone: string | null;
  subject: string | null;
}

interface SchoolRequest {
  id: string;
  patronatName: string;
  title: string;
  message: string | null;
  examLabel: string | null;
  status: string;
  deadline: string | null;
  createdAt: string;
  mySubmission: {
    id: string;
    submittedAt: string;
    teachersCount: number;
    teacherIds: string[];
    /** ⭐ 2026-09-30 — liste nominative des enseignants envoyés. */
    teachers?: SubmittedTeacher[];
  } | null;
}

interface SchoolAssignment {
  id: string;
  firstName: string;
  lastName: string;
  /** ⭐ 2026-09-30 — identifiant de l'enseignant : rapprochement fiable
   *  « enseignant envoyé ↔ affectation reçue » (le nom seul casse si
   *  l'école renvoie sa liste avec une autre orthographe). */
  teacherId?: string | null;
  phone: string | null;
  email: string | null;
  exam: { id: string; code: string; name: string } | null;
  center: { id: string; code: string; name: string; address: string | null } | null;
  room: { id: string; code: string; name: string } | null;
  /** ⭐ 2026-10-01 — poste : SURVEILLANCE | CORRECTION | SECRETARIAT. */
  post: string | null;
  postLabel: string | null;
  requestId: string | null;
  teacherNotifiedAt: string | null;
  assignedDate: string;
}

interface OverviewResponse {
  patronatsCount: number;
  requests: SchoolRequest[];
  assignments: SchoolAssignment[];
}

/** Clé de rapprochement enseignant ↔ affectation (identité normalisée :
 *  casse, accents et espaces superflus neutralisés). */
function personKey(firstName?: string | null, lastName?: string | null): string {
  const norm = (v?: string | null) =>
    (v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  return `${norm(firstName)}|${norm(lastName)}`;
}

const frDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR') : '';

const frLongDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

export function SchoolSupervisorsTab() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ⭐ 2026-09-30 — SOUS-ONGLETS : Demandes reçues | Enseignants envoyés |
  //    Affectations reçues (l'école suit ses envois en attendant les
  //    affectations du patronat).
  const [subTab, setSubTab] = useState<'demandes' | 'envoyes' | 'affectations'>('demandes');

  // ⭐ Lettre professionnelle — demande dont la note est ouverte en lecture.
  const [noteRequest, setNoteRequest] = useState<SchoolRequest | null>(null);

  // ── Sélection des enseignants (modale) ──────────────────────────────────
  const [selectionTarget, setSelectionTarget] = useState<SchoolRequest | null>(null);
  const [teachers, setTeachers] = useState<SchoolTeacher[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // ── Notifications enseignants ───────────────────────────────────────────
  const [notifyingId, setNotifyingId] = useState<string | null>(null);
  const [notifyingAll, setNotifyingAll] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.get('/federis/school/supervisors', { timeout: 20000 });
      setOverview(res.data ?? null);
      if (!silent) setError(null);
    } catch (err: any) {
      // Rechargement silencieux : on conserve les données déjà affichées
      if (!silent) {
        setError(err?.response?.data?.message ?? 'Impossible de charger les demandes de surveillants.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ⭐ 2026-09-30 — FRAÎCHEUR DES DONNÉES : les affectations du patronat
  //    arrivent à tout moment. Avant, la vue n'était chargée qu'au montage
  //    → « En attente d'affectation par le patronat » et « Affectations
  //    reçues » incomplètes tant que la page n'était pas rechargée. On
  //    recharge maintenant : au changement de sous-onglet, au retour de
  //    focus sur l'onglet, et périodiquement (45 s) si l'onglet est visible.
  useEffect(() => {
    void load({ silent: true });
  }, [subTab, load]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void load({ silent: true });
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const interval = setInterval(refresh, 45000);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(interval);
    };
  }, [load]);

  // ── Ouverture de la sélection d'enseignants ─────────────────────────────
  const openSelection = async (request: SchoolRequest) => {
    setSelectionTarget(request);
    setError(null);
    // Pré-sélectionne la liste déjà envoyée (si renvoi)
    setSelectedTeacherIds(new Set(request.mySubmission?.teacherIds ?? []));
    setTeacherSearch('');
    setTeachersLoading(true);
    try {
      const res = await apiClient.get('/federis/school/supervisors/teachers', {
        timeout: 20000,
      });
      setTeachers(res.data?.teachers ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger vos enseignants.');
      setSelectionTarget(null);
    } finally {
      setTeachersLoading(false);
    }
  };

  const filteredTeachers = useMemo(() => {
    if (!teacherSearch.trim()) return teachers;
    const q = teacherSearch.trim().toLowerCase();
    return teachers.filter((t) =>
      `${t.firstName} ${t.lastName} ${t.matricule ?? ''} ${t.subject ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [teachers, teacherSearch]);

  const toggleTeacher = (id: string) => {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Envoi de la liste au patronat ───────────────────────────────────────
  const submitSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectionTarget || selectedTeacherIds.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.post(
        `/federis/school/supervisors/requests/${selectionTarget.id}/submit`,
        { teacherIds: Array.from(selectedTeacherIds) },
        { timeout: 30000 },
      );
      setNotice(
        `Liste de ${res.data?.teachersCount ?? 0} enseignant(s) envoyée au patronat ` +
          `${selectionTarget.patronatName}. Suivez leur statut dans l'onglet « Enseignants envoyés ».`,
      );
      setSelectionTarget(null);
      setSubTab('envoyes');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Envoi impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Transmission des affectations aux enseignants ───────────────────────
  const notifyTeacher = async (assignment: SchoolAssignment) => {
    setNotifyingId(assignment.id);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post(
        `/federis/school/supervisors/assignments/${assignment.id}/notify-teacher`,
        {},
        { timeout: 20000 },
      );
      setNotice(
        res.data?.notified
          ? `${res.data?.teacherName} a été notifié(e) dans son interface enseignant.`
          : `${res.data?.teacherName} : aucun compte utilisateur rattaché (email absent) — l'enseignant n'a pas pu être notifié(e) automatiquement.`,
      );
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Notification impossible.');
    } finally {
      setNotifyingId(null);
    }
  };

  const notifyAll = async () => {
    setNotifyingAll(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post(
        '/federis/school/supervisors/assignments/notify-all',
        {},
        { timeout: 30000 },
      );
      setNotice(
        `${res.data?.notified ?? 0} enseignant(s) notifié(s) dans leur interface` +
          (res.data?.withoutAccount ? ` — ${res.data.withoutAccount} sans compte utilisateur.` : '.'),
      );
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Notifications impossibles.');
    } finally {
      setNotifyingAll(false);
    }
  };

  const openRequests = (overview?.requests ?? []).filter(
    (r) => r.status === 'OPEN' && !r.mySubmission,
  );
  const pendingAssignments = (overview?.assignments ?? []).filter((a) => !a.teacherNotifiedAt);

  // ⭐ Demandes avec liste d'enseignants déjà envoyée (sous-onglet « envoyés »)
  const submittedRequests = (overview?.requests ?? []).filter((r) => r.mySubmission);

  // ⭐ Rapprochement enseignant envoyé ↔ affectation reçue — par
  //    teacherId (fiable) PUIS par identité de secours (anciennes données
  //    sans teacherId ou orthographe modifiée lors d'un renvoi de liste).
  const assignmentLookup = useMemo(() => {
    const byTeacher = new Map<string, SchoolAssignment>();
    const byName = new Map<string, SchoolAssignment>();
    for (const a of overview?.assignments ?? []) {
      if (!a.requestId) continue;
      if (a.teacherId) byTeacher.set(`${a.requestId}::${a.teacherId}`, a);
      byName.set(`${a.requestId}::${personKey(a.firstName, a.lastName)}`, a);
    }
    return { byTeacher, byName };
  }, [overview?.assignments]);

  const findAssignment = (
    requestId: string,
    teacherId?: string,
    firstName?: string,
    lastName?: string,
  ): SchoolAssignment | undefined =>
    (teacherId ? assignmentLookup.byTeacher.get(`${requestId}::${teacherId}`) : undefined) ??
    assignmentLookup.byName.get(`${requestId}::${personKey(firstName, lastName)}`);

  const totalSubmittedTeachers = submittedRequests.reduce(
    (s, r) => s + (r.mySubmission?.teachersCount ?? 0),
    0,
  );
  const assignmentsCount = (overview?.assignments ?? []).length;

  return (
    <div className="space-y-8">
      {/* En-tête de section */}
      <div className="bg-white p-6 lg:p-8 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center">
              <AppIcon name="scolarite" size="dashboard" className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              Gestion des surveillants / Correction
            </h2>
          </div>
          <p className="text-gray-500 font-medium max-w-2xl text-sm">
            Les patronats scolaires (Academia Federis) sollicitent vos enseignants pour
            l&apos;organisation des examens nationaux : surveillance des épreuves, correction
            des copies et secrétariat (saisie des notes). Lisez la note circulaire,
            sélectionnez vos enseignants, suivez vos envois puis transmettez les
            affectations dans leur interface.
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {openRequests.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 text-center">
              <p className="text-xl font-bold text-amber-700">{openRequests.length}</p>
              <p className="text-[9px] font-bold text-amber-600 uppercase">Demande(s) en attente</p>
            </div>
          )}
          {pendingAssignments.length > 0 && (
            <button
              type="button"
              onClick={() => void notifyAll()}
              disabled={notifyingAll}
              className="px-5 py-3 bg-blue-900 text-white rounded-xl text-[10px] font-bold uppercase shadow-lg hover:bg-blue-800 transition-all disabled:opacity-50"
            >
              {notifyingAll ? 'Envoi…' : `Notifier les ${pendingAssignments.length} enseignant(s)`}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-800">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4 text-sm font-semibold text-emerald-800">{notice}</div>
      )}

      {/* ⭐ SOUS-ONGLETS : Demandes reçues | Enseignants envoyés | Affectations */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(
          [
            { key: 'demandes', label: 'Demandes reçues' },
            { key: 'envoyes', label: `Enseignants envoyés${totalSubmittedTeachers > 0 ? ` (${totalSubmittedTeachers})` : ''}` },
            // ⭐ 2026-09-30 — compteur d'affectations reçues (tous postes :
            // surveillance, correction et secrétariat)
            {
              key: 'affectations',
              label: `Affectations reçues${assignmentsCount > 0 ? ` (${assignmentsCount})` : ''}`,
            },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            className={cn(
              'px-5 py-2 rounded-lg text-xs transition-all',
              subTab === t.key
                ? 'bg-white shadow-sm text-blue-900 font-bold'
                : 'text-slate-500 font-semibold hover:text-blue-900',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-sm font-bold text-gray-400">
          Chargement…
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════════════════════════
              SOUS-ONGLET 1 — DEMANDES REÇUES (note circulaire en lettre)
             ══════════════════════════════════════════════════════════════ */}
          {subTab === 'demandes' && (
            <div className="space-y-4">
              {(overview?.requests ?? []).length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
                  <AppIcon name="scolarite" size="dashboard" className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm font-bold text-gray-400 mt-2">Aucune demande de surveillants</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Lorsqu&apos;un patronat sollicitera vos enseignants comme surveillants, la
                    demande apparaîtra ici.
                  </p>
                </div>
              ) : (
                (overview?.requests ?? []).map((request) => (
                  <div
                    key={request.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
                  >
                    <div className="flex items-start gap-5 min-w-0">
                      <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <AppIcon name="network" size="dashboard" className="text-blue-900" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h4 className="text-base font-bold text-gray-900">{request.title}</h4>
                          <span
                            className={cn(
                              'text-[9px] font-bold uppercase px-2.5 py-1 rounded',
                              request.status === 'OPEN'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-200 text-gray-600',
                            )}
                          >
                            {request.status === 'OPEN' ? 'Ouverte' : 'Clôturée'}
                          </span>
                          {request.mySubmission && (
                            <span className="text-[9px] font-bold uppercase px-2.5 py-1 rounded bg-green-100 text-green-800">
                              Liste envoyée — {request.mySubmission.teachersCount} enseignant(s)
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-1.5">
                          {request.patronatName}
                          {request.examLabel ? ` • ${request.examLabel}` : ''}
                          {` • Reçue le ${frDate(request.createdAt)}`}
                          {request.deadline
                            ? ` • Répondre avant le ${frDate(request.deadline)}`
                            : ''}
                        </p>
                        {/* ⭐ Aperçu de la note — le texte intégral s'ouvre en
                            lettre professionnelle (modale). */}
                        <p className="text-xs text-gray-500 mt-2 max-w-xl leading-relaxed italic">
                          {circularNoteExcerpt(request.message, 180)}
                          {request.message && request.message.length > 180 ? '…' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {request.message && (
                        <button
                          type="button"
                          onClick={() => setNoteRequest(request)}
                          className="px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase border border-blue-100 bg-blue-50 text-blue-900 hover:bg-blue-100 transition-all"
                        >
                          Lire la note circulaire
                        </button>
                      )}
                      {request.status === 'OPEN' && (
                        <button
                          type="button"
                          onClick={() => void openSelection(request)}
                          className={cn(
                            'px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase shadow-lg transition-all',
                            request.mySubmission
                              ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                              : 'bg-blue-900 text-white hover:bg-blue-800',
                          )}
                        >
                          {request.mySubmission ? 'Modifier la sélection' : 'Sélectionner mes enseignants'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SOUS-ONGLET 2 — ENSEIGNANTS ENVOYÉS (vue de suivi par demande)
             ══════════════════════════════════════════════════════════════ */}
          {subTab === 'envoyes' && (
            <div className="space-y-5">
              {submittedRequests.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
                  <AppIcon name="students" size="dashboard" className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-sm font-bold text-gray-400 mt-2">Aucune liste envoyée pour le moment</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Sélectionnez vos enseignants depuis une demande ouverte — vous suivrez ici
                    leur statut en attendant les affectations du patronat.
                  </p>
                </div>
              ) : (
                submittedRequests.map((request) => {
                  const submission = request.mySubmission!;
                  const sentTeachers = submission.teachers ?? [];
                  return (
                    <div key={request.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      {/* En-tête de la demande */}
                      <div className="p-5 lg:p-6 bg-gray-50/70 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 truncate">
                            {request.title}
                          </h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                            {request.patronatName}
                            {request.examLabel ? ` • ${request.examLabel}` : ''}
                            {` • Liste envoyée le ${frDate(submission.submittedAt)}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[9px] font-bold uppercase px-2.5 py-1 rounded bg-blue-100 text-blue-800">
                            {submission.teachersCount} enseignant(s) présenté(s)
                          </span>
                          {request.status === 'OPEN' && (
                            <button
                              type="button"
                              onClick={() => void openSelection(request)}
                              className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
                            >
                              Modifier
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Liste nominative des enseignants envoyés */}
                      <div className="divide-y divide-gray-50">
                        {sentTeachers.length === 0 ? (
                          <p className="px-6 py-4 text-xs font-bold text-gray-400">
                            {submission.teachersCount} enseignant(s) envoyé(s) — détail
                            nominatif indisponible (envoi antérieur).
                          </p>
                        ) : (
                          sentTeachers.map((t) => {
                            const assignment = findAssignment(
                              request.id,
                              t.id,
                              t.firstName,
                              t.lastName,
                            );
                            return (
                              <div
                                key={`${request.id}-${t.id}`}
                                className="px-5 lg:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-4 min-w-0">
                                  <div
                                    className={cn(
                                      'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0',
                                      assignment
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-amber-50 text-amber-700',
                                    )}
                                  >
                                    {t.firstName?.[0]}
                                    {t.lastName?.[0]}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-900">
                                      {t.firstName} {t.lastName}
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-semibold">
                                      {[t.subject, t.matricule, t.phone].filter(Boolean).join(' · ') || '—'}
                                    </p>
                                  </div>
                                </div>
                                {/* Statut : en attente d'affectation OU affecté */}
                                {assignment ? (
                                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                                    <span
                                      className={cn(
                                        'text-[9px] font-bold uppercase px-2 py-1 rounded',
                                        assignment.post === 'CORRECTION'
                                          ? 'bg-indigo-100 text-indigo-700'
                                          : assignment.post === 'SECRETARIAT'
                                            ? 'bg-teal-100 text-teal-700'
                                            : 'bg-blue-100 text-blue-800',
                                      )}
                                    >
                                      {assignment.post === 'CORRECTION'
                                        ? 'Affecté — Correction des épreuves'
                                        : assignment.post === 'SECRETARIAT'
                                          ? 'Affecté — Secrétariat (saisie des notes)'
                                          : 'Affecté — Surveillance'}
                                    </span>
                                    {assignment.center && (
                                      <span className="text-[9px] font-bold text-gray-500 uppercase">
                                        {assignment.center.name}
                                        {assignment.room ? ` • ${assignment.room.name}` : ''}
                                      </span>
                                    )}
                                    {assignment.teacherNotifiedAt && (
                                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-green-100 text-green-700">
                                        Notifié
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[9px] font-bold uppercase px-2.5 py-1 rounded bg-amber-50 text-amber-700 border border-amber-100 shrink-0">
                                    En attente d&apos;affectation par le patronat
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SOUS-ONGLET 3 — AFFECTATIONS REÇUES (transmission aux enseignants)
             ══════════════════════════════════════════════════════════════ */}
          {subTab === 'affectations' && (
            <div className="space-y-4">
              {(overview?.assignments ?? []).length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
                  <p className="text-sm font-bold text-gray-400">Aucune affectation pour le moment</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Dès que le patronat valide la répartition de vos enseignants entre les
                    postes (surveillance, correction, secrétariat), leurs affectations
                    apparaîtront ici.
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-50">
                  {(overview?.assignments ?? []).map((a) => (
                    <div
                      key={a.id}
                      className="p-5 lg:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4 min-w-0">
                        <div
                          className={cn(
                            'w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0',
                            a.post === 'CORRECTION'
                              ? 'bg-indigo-50 text-indigo-700'
                              : a.post === 'SECRETARIAT'
                                ? 'bg-teal-50 text-teal-700'
                                : 'bg-blue-50 text-blue-900',
                          )}
                        >
                          {a.firstName?.[0]}
                          {a.lastName?.[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                            <span>
                              {a.firstName} {a.lastName}
                            </span>
                            {/* ⭐ Poste : surveillance / correction / secrétariat */}
                            <span
                              className={cn(
                                'text-[9px] font-bold uppercase px-2 py-0.5 rounded',
                                a.post === 'CORRECTION'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : a.post === 'SECRETARIAT'
                                    ? 'bg-teal-100 text-teal-700'
                                    : 'bg-blue-100 text-blue-800',
                              )}
                            >
                              {a.post === 'CORRECTION'
                                ? 'Correction des épreuves'
                                : a.post === 'SECRETARIAT'
                                  ? 'Secrétariat — saisie des notes'
                                  : 'Surveillance'}
                            </span>
                            {a.teacherNotifiedAt && (
                              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-green-100 text-green-700">
                                Notifié
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                            {a.exam ? `${a.exam.name} (${a.exam.code})` : 'Examen'}
                            {a.post === 'CORRECTION' || a.post === 'SECRETARIAT'
                              ? ' • Affectation confirmée par le patronat'
                              : a.center
                                ? ` • Centre : ${a.center.name}${a.center.address ? ` — ${a.center.address}` : ''}`
                                : ''}
                            {a.post !== 'CORRECTION' && a.post !== 'SECRETARIAT' && a.room
                              ? ` • Salle : ${a.room.name}`
                              : ''}
                            {` • Affecté le ${frDate(a.assignedDate)}`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void notifyTeacher(a)}
                        disabled={notifyingId === a.id}
                        className={cn(
                          'px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase transition-all flex-shrink-0 disabled:opacity-50',
                          a.teacherNotifiedAt
                            ? 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            : 'bg-blue-900 text-white shadow-lg hover:bg-blue-800',
                        )}
                      >
                        {notifyingId === a.id
                          ? '…'
                          : a.teacherNotifiedAt
                            ? 'Renvoyer la notification'
                            : 'Notifier l\u2019enseignant'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODALE — NOTE CIRCULAIRE EN LETTRE PROFESSIONNELLE
          En-tête émetteur + date + objet, corps structuré (sections, listes),
          formule de clôture et bloc signature — plus de texte « en vrac ».
         ════════════════════════════════════════════════════════════════════ */}
      {noteRequest && (
        <CircularNoteLetterModal
          request={noteRequest}
          onClose={() => setNoteRequest(null)}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODALE — Sélection des enseignants de l'école
         ════════════════════════════════════════════════════════════════════ */}
      {selectionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitSelection}
            className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[88vh] flex flex-col"
          >
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                Sélection des enseignants à présenter
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-1">
                {selectionTarget.patronatName} — {selectionTarget.title}
                {selectionTarget.examLabel ? ` (${selectionTarget.examLabel})` : ''}. Les
                enseignants sélectionnés seront présentés au patronat, qui les répartira
                entre la surveillance des épreuves, la correction des copies et le
                secrétariat (saisie des notes).
              </p>
            </div>

            <div className="px-6 pt-4">
              <input
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                placeholder="Rechercher un enseignant (nom, matricule, matière)…"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900"
              />
              <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">
                {selectedTeacherIds.size} sélectionné(s) sur {teachers.length} enseignant(s) actifs
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-3">
              {teachersLoading ? (
                <p className="text-sm font-bold text-gray-400 text-center py-8">
                  Chargement de vos enseignants…
                </p>
              ) : filteredTeachers.length === 0 ? (
                <p className="text-sm font-bold text-gray-400 text-center py-8">
                  Aucun enseignant actif trouvé dans votre base.
                </p>
              ) : (
                <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
                  {filteredTeachers.map((t) => {
                    const checked = selectedTeacherIds.has(t.id);
                    return (
                      <label
                        key={t.id}
                        className={cn(
                          'flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors',
                          checked ? 'bg-blue-50/60' : 'hover:bg-gray-50',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTeacher(t.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-900 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-gray-900">
                            {t.firstName} {t.lastName}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {[t.subject, t.matricule, t.phone, t.email]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectionTarget(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting || selectedTeacherIds.size === 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase bg-blue-900 text-white hover:bg-blue-800 transition-all disabled:opacity-50"
              >
                {submitting
                  ? 'Envoi…'
                  : `Envoyer la liste (${selectedTeacherIds.size}) au patronat`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MODALE — LETTRE PROFESSIONNELLE (rendu de la note circulaire)
// ════════════════════════════════════════════════════════════════════════════

function CircularNoteLetterModal({
  request,
  onClose,
}: {
  request: SchoolRequest;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const parsed: ParsedCircularNote = useMemo(
    () => parseCircularNote(request.message),
    [request.message],
  );

  const copyNote = async () => {
    try {
      await navigator.clipboard.writeText(request.message ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* presse-papiers indisponible — non bloquant */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4 sm:my-8 flex flex-col max-h-[92vh]">
        {/* Barre d'action de la modale */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-900 truncate">
              Note circulaire — {request.patronatName}
            </h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase">
              {request.examLabel ?? 'Examen national'} • Reçue le {frDate(request.createdAt)}
              {request.deadline ? ` • Répondre avant le ${frDate(request.deadline)}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void copyNote()}
              className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
            >
              {copied ? 'Copiée ✓' : 'Copier le texte'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase bg-blue-900 text-white hover:bg-blue-800 transition-all"
            >
              Fermer
            </button>
          </div>
        </div>

        {/* ── LA LETTRE — papier administratif structuré ── */}
        <div className="flex-1 overflow-y-auto bg-gray-50 px-4 sm:px-8 py-6">
          <article className="mx-auto max-w-3xl bg-white border border-gray-200 rounded-lg shadow-sm px-6 sm:px-12 py-10 sm:py-12 text-gray-800">
            {/* En-tête émetteur / destinataire / date */}
            <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-gray-200">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-blue-900">
                  Academia Federis
                </p>
                <p className="text-base font-bold text-gray-900 leading-snug mt-1">
                  {request.patronatName}
                </p>
                <p className="text-xs text-gray-500 font-medium mt-1">
                  Organisation des examens nationaux
                </p>
              </div>
              <div className="text-xs text-gray-500 font-medium sm:text-right leading-relaxed">
                <p>{request.title}</p>
                <p>Aux Chefs d&apos;établissement rattachés</p>
                <p className="mt-1 text-gray-400">Le {frLongDate(request.createdAt)}</p>
              </div>
            </header>

            {/* Référence + Objet */}
            <div className="py-6">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Réf. {request.id.slice(0, 8).toUpperCase()}
                {request.examLabel ? ` — ${request.examLabel}` : ''}
              </p>
              {parsed.object && (
                <p className="mt-3 text-sm leading-relaxed">
                  <span className="font-bold uppercase text-gray-900">Objet : </span>
                  <span className="font-semibold">{parsed.object}</span>
                </p>
              )}
            </div>

            {/* Corps : appel + sections structurées */}
            <div className="space-y-5 text-sm leading-relaxed">
              {parsed.salutation && (
                <p className="font-semibold text-gray-800">{parsed.salutation}</p>
              )}

              {parsed.sections.map((section, i) => (
                <div key={i} className="space-y-3">
                  {section.title && (
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-blue-900 border-b border-blue-100 pb-1.5">
                      {section.title}
                    </h4>
                  )}
                  <div className="space-y-3">
                    {section.blocks.map((block, j) => {
                      if (block.type === 'bullet') {
                        return (
                          <p key={j} className="flex gap-2.5 leading-relaxed">
                            <span className="text-blue-900 font-bold flex-shrink-0">—</span>
                            <span>{block.text}</span>
                          </p>
                        );
                      }
                      if (block.type === 'numbered') {
                        return (
                          <p key={j} className="flex gap-2.5 leading-relaxed">
                            <span className="font-bold text-blue-900 flex-shrink-0">
                              {block.index}.
                            </span>
                            <span>{block.text}</span>
                          </p>
                        );
                      }
                      return (
                        <p key={j} className="leading-relaxed text-justify">
                          {block.text}
                        </p>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Formule de clôture */}
              {parsed.closing && (
                <p className="leading-relaxed text-justify">{parsed.closing}</p>
              )}
            </div>

            {/* Signature */}
            {parsed.signature ? (
              <footer className="mt-10 pt-6 border-t border-gray-200 flex flex-col items-end text-right">
                <p className="text-sm font-semibold text-gray-700 italic">
                  {parsed.signature.forLabel}
                </p>
                <p className="text-sm font-bold text-gray-900 mt-2">
                  {parsed.signature.role}
                </p>
                {parsed.signature.name && (
                  <p className="text-sm font-bold uppercase tracking-wide text-blue-900 mt-0.5">
                    {parsed.signature.name}
                  </p>
                )}
              </footer>
            ) : (
              <footer className="mt-10 pt-6 border-t border-gray-200 text-right">
                <p className="text-sm font-semibold text-gray-700 italic">
                  Le Patronat du département
                </p>
              </footer>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}

export default SchoolSupervisorsTab;
