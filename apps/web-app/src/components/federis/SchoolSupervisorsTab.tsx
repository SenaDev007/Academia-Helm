/**
 * SchoolSupervisorsTab — « Gestion des surveillants » (portail école Helm)
 * ═══════════════════════════════════════════════════════════════════════════
 * Section du module « Patronats & Examens » (/app/federis) — 2026-09-29.
 *
 * Workflow côté établissement (en lien avec Academia Federis) :
 *   1. DEMANDES REÇUES — le patronat (Federis) demande à l'école de présenter
 *      ses enseignants comme surveillants pour un examen national.
 *   2. SÉLECTION — l'école sélectionne ses enseignants depuis SA base de
 *      données (Teacher) et envoie la liste officielle au patronat
 *      (POST /federis/school/supervisors/requests/:id/submit — notification
 *      de l'équipe du patronat). La sélection peut être renvoyée tant que la
 *      demande est ouverte.
 *   3. AFFECTATIONS REÇUES — après validation de la répartition par centre et
 *      par salle par le patronat, l'école voit chaque enseignant affecté
 *      (centre + salle) et TRANSMET la notification à l'UI de l'enseignant
 *      (bouton par enseignant ou « Notifier tous »).
 *
 * API : /federis/school/supervisors/** (FederisSchoolSupervisorsController).
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';

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
  } | null;
}

interface SchoolAssignment {
  id: string;
  firstName: string;
  lastName: string;
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

export function SchoolSupervisorsTab() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/federis/school/supervisors', { timeout: 20000 });
      setOverview(res.data ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger les demandes de surveillants.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
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
          `${selectionTarget.patronatName}.`,
      );
      setSelectionTarget(null);
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

  return (
    <div className="space-y-8">
      {/* En-tête de section */}
      <div className="bg-white p-6 lg:p-8 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center">
              <AppIcon name="scolarite" size="dashboard" className="text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Gestion des surveillants</h2>
          </div>
          <p className="text-gray-500 font-medium max-w-2xl text-sm">
            Les patronats scolaires (Academia Federis) sollicitent vos enseignants pour
            l&apos;organisation des examens nationaux : surveillance des épreuves, correction
            des copies et secrétariat (saisie des notes). Sélectionnez vos enseignants,
            envoyez la liste officielle, puis transmettez les affectations dans leur
            interface.
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

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-sm font-bold text-gray-400">
          Chargement…
        </div>
      ) : (
        <>
          {/* ════════════════════════════════════════════════════════════════
              1. DEMANDES REÇUES DES PATRONATS
             ════════════════════════════════════════════════════════════════ */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Demandes reçues des patronats rattachés
            </h3>
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
                        {` • Reçue le ${new Date(request.createdAt).toLocaleDateString('fr-FR')}`}
                        {request.deadline
                          ? ` • Répondre avant le ${new Date(request.deadline).toLocaleDateString('fr-FR')}`
                          : ''}
                      </p>
                      {request.message && (
                        <p className="text-xs text-gray-500 mt-2 max-w-xl leading-relaxed">
                          {request.message}
                        </p>
                      )}
                    </div>
                  </div>
                  {request.status === 'OPEN' && (
                    <button
                      type="button"
                      onClick={() => void openSelection(request)}
                      className={cn(
                        'px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase shadow-lg transition-all flex-shrink-0',
                        request.mySubmission
                          ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                          : 'bg-blue-900 text-white hover:bg-blue-800',
                      )}
                    >
                      {request.mySubmission ? 'Modifier la sélection' : 'Sélectionner mes enseignants'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════
              2. AFFECTATIONS REÇUES (après répartition du patronat)
             ════════════════════════════════════════════════════════════════ */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Affectations reçues — transmission aux enseignants
            </h3>
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
                          {` • Affecté le ${new Date(a.assignedDate).toLocaleDateString('fr-FR')}`}
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
        </>
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

export default SchoolSupervisorsTab;
