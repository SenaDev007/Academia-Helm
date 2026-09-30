/**
 * FederisSupervisorsTab — Onglet « Gestion des surveillants »
 * (module « Centres, salles & Surveillants » — Academia Federis, 2026-09-29)
 * ═══════════════════════════════════════════════════════════════════════════
 * Workflow complet patronat ↔ écoles rattachées :
 *
 *   1. DEMANDES — le patronat demande aux écoles rattachées de présenter
 *      leurs enseignants comme surveillants pour l'examen sélectionné
 *      (notification des directions des écoles).
 *   2. LISTES REÇUES — par école (clic sur une école → liste de ses
 *      enseignants) + RÉCAPITULATIF GLOBAL (toutes écoles confondues).
 *   3. RÉPARTITION — sélection d'enseignants → centre + salle de
 *      composition → validation (ExamSupervisor + notification des écoles).
 *   4. REGISTRE — surveillants affectés (nominations écoles + saisie
 *      manuelle), modification du centre/salle, retrait.
 *
 * API : /federis/supervisors/** (FederisSupervisorsController).
 * Écritures : coordonnateur + organisateur (canWrite 'exam_org', garde API).
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { canWrite } from '@/lib/patronat/permissions';
// ⭐ Générateur de note circulaire (objet + message orientés CEP/BEPC/BAC/CAP)
import { buildSurveillanceRequestDraft } from '@/lib/federis/surveillance-request-template';

// ── Types (réponses API) ────────────────────────────────────────────────────

interface SupervisorRequestItem {
  id: string;
  title: string;
  message: string | null;
  examId: string | null;
  examLabel: string | null;
  status: string;
  deadline: string | null;
  createdAt: string;
  respondedCount: number;
  teachersProposed: number;
  supervisorsAssigned: number;
}

interface RequestsResponse {
  canManage: boolean;
  schoolsCount: number;
  requests: SupervisorRequestItem[];
}

interface RecapTeacher {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string | null;
  phone: string | null;
  email: string | null;
  subject: string | null;
  submissionId: string;
  schoolTenantId: string;
  schoolName: string;
  assigned: {
    centerId: string | null;
    roomId: string | null;
    center: { id: string; name: string; code: string } | null;
    room: { id: string; name: string; code: string } | null;
  } | null;
}

interface SchoolSubmissionsEntry {
  schoolTenantId: string;
  schoolName: string;
  responded: boolean;
  submissionId: string | null;
  submittedAt: string | null;
  teachers: RecapTeacher[];
}

interface AssignmentCenter {
  id: string;
  code: string;
  name: string;
  address: string | null;
  rooms: { id: string; code: string; name: string; capacity: number }[];
}

interface SubmissionsResponse {
  canManage: boolean;
  request: {
    id: string;
    title: string;
    message: string | null;
    examId: string | null;
    examLabel: string | null;
    status: string;
    deadline: string | null;
    createdAt: string;
  };
  schoolsCount: number;
  bySchool: SchoolSubmissionsEntry[];
  recap: RecapTeacher[];
  centers: AssignmentCenter[];
}

interface RegistrySupervisor {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  source: string;
  teacherNotifiedAt: string | null;
  assignedDate: string;
  schoolName: string | null;
  center: { id: string; code: string; name: string } | null;
  room: { id: string; code: string; name: string } | null;
  exam: { id: string; code: string; name: string; examType: string } | null;
}

interface RegistryResponse {
  canManage: boolean;
  supervisors: RegistrySupervisor[];
}

interface FederisSupervisorsTabProps {
  /** Examen sélectionné dans la page (sélecteur partagé). */
  examId: string | null;
  /** Libellé d'affichage de l'examen (optionnel). */
  examLabel?: string | null;
  /** ⭐ Objet examen complet (code, nom, type, dates) — auto-génération de la
   *  note circulaire (objet + message orientés CEP/BEPC/BAC/CAP). */
  exam?: {
    id: string;
    code: string;
    name: string;
    examType: string;
    level: string;
    status: string;
    startDate: string;
    endDate: string;
  } | null;
  userRole?: string | null;
}

const EMPTY_REQUEST_FORM = {
  title: '',
  message: '',
  deadline: '',
};

const EMPTY_MANUAL_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  centerId: '',
  roomId: '',
};

export default function FederisSupervisorsTab({
  examId,
  examLabel,
  exam,
  userRole,
}: FederisSupervisorsTabProps) {
  // ── Demandes ────────────────────────────────────────────────────────────
  const [requestsData, setRequestsData] = useState<RequestsResponse | null>(null);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState(EMPTY_REQUEST_FORM);
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  // ⭐ Le patronat a-t-il modifié le brouillon auto-généré ? Si oui, on ne
  //    l'écrase plus (ni au changement d'examen, ni à la date limite) — ses
  //    corrections (nombres, disponibilités) priment sur la génération.
  const [requestFormTouched, setRequestFormTouched] = useState(false);

  // ── Détail d'une demande (listes reçues + répartition) ──────────────────
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubmissionsResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'bySchool' | 'recap'>('bySchool');
  const [openSchoolTenantId, setOpenSchoolTenantId] = useState<string | null>(null);

  // ── Répartition (sélection → centre + salle → validation) ───────────────
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
  const [assignCenterId, setAssignCenterId] = useState('');
  const [assignRoomId, setAssignRoomId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // ── Registre ────────────────────────────────────────────────────────────
  const [registry, setRegistry] = useState<RegistryResponse | null>(null);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL_FORM);
  const [creatingManual, setCreatingManual] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fallbackCanManage = canWrite(userRole, 'exam_org');
  const canManage = requestsData?.canManage ?? fallbackCanManage;

  // ── Chargement des demandes ─────────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/federis/supervisors/requests', { timeout: 20000 });
      setRequestsData(res.data ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger les demandes.');
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  // ── ⭐ AUTO-REMPLISSAGE DE LA DEMANDE (note circulaire, 2026-09-30) ────────
  //
  // Dès que le système connaît l'examen (nom + type + dates), le formulaire
  // de demande est pré-rempli avec un objet ET un message administratifs
  // professionnels, orientés selon le type d'examen (CEP / BEPC / BAC / CAP).
  // Le patronat n'a plus qu'à corriger les nombres attendus et les
  // disponibilités — jamais à rédiger la note de zéro.
  //
  // Régénération : à l'ouverture du formulaire, et si l'examen change (tant
  // que le patronat n'a pas touché au brouillon). Un bouton « Régénérer »
  // permet ensuite de repartir du brouillon proposé par le système.
  useEffect(() => {
    if (!showRequestForm || !exam) return;
    if (requestFormTouched) return;
    const draft = buildSurveillanceRequestDraft(exam, {
      deadline: requestForm.deadline || null,
    });
    setRequestForm((prev) => ({
      ...prev,
      title: draft.title,
      message: draft.message,
    }));
    // ⭐ Dépend aussi de la date limite : tant que le brouillon n'est pas
    //    personnalisé, poser la date limite réinjecte la phrase « au plus
    //    tard le … » dans la note.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRequestForm, exam?.id, requestFormTouched, requestForm.deadline]);

  /** Ouvre / ferme le formulaire de demande — à la ré-ouverture, le brouillon
   *  système est reconstruit (les corrections précédentes sont abandonnées). */
  const toggleRequestForm = () => {
    if (showRequestForm) {
      setShowRequestForm(false);
    } else {
      // Ré-ouverture → le patronat repart du brouillon proposé
      setRequestFormTouched(false);
      setShowRequestForm(true);
    }
  };

  /** Reconstruit le brouillon système (bouton « Régénérer »). */
  const regenerateDraft = () => {
    if (!exam) return;
    const draft = buildSurveillanceRequestDraft(exam, {
      deadline: requestForm.deadline || null,
    });
    setRequestForm((prev) => ({
      ...prev,
      title: draft.title,
      message: draft.message,
    }));
    setRequestFormTouched(false);
  };

  // ── Chargement du registre (par examen sélectionné) ─────────────────────
  const loadRegistry = useCallback(async () => {
    if (!examId) {
      setRegistry(null);
      return;
    }
    setRegistryLoading(true);
    try {
      const res = await apiClient.get('/federis/supervisors', {
        params: { examId },
        timeout: 20000,
      });
      setRegistry(res.data ?? null);
    } catch {
      setRegistry(null);
    } finally {
      setRegistryLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void loadRegistry();
  }, [loadRegistry]);

  // ── Chargement du détail d'une demande ──────────────────────────────────
  const loadDetail = useCallback(async (requestId: string) => {
    setDetailLoading(true);
    try {
      const res = await apiClient.get(
        `/federis/supervisors/requests/${requestId}/submissions`,
        { timeout: 20000 },
      );
      setDetail(res.data ?? null);
      // Ouvre la première école ayant répondu
      const first = (res.data?.bySchool ?? []).find((s) => s.responded);
      setOpenSchoolTenantId(first?.schoolTenantId ?? null);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger les listes reçues.');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRequestId) void loadDetail(selectedRequestId);
    else setDetail(null);
  }, [selectedRequestId, loadDetail]);

  // Réinitialise la sélection quand le détail change
  useEffect(() => {
    setSelectedTeacherIds(new Set());
    setAssignCenterId('');
    setAssignRoomId('');
  }, [selectedRequestId, detail]);

  // ── Création d'une demande aux écoles ───────────────────────────────────
  const createRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examId) {
      setError('Sélectionnez un examen (la répartition se fait par centre et par salle de l\u2019examen).');
      return;
    }
    setCreatingRequest(true);
    setError(null);
    try {
      const res = await apiClient.post(
        '/federis/supervisors/requests',
        {
          title: requestForm.title,
          message: requestForm.message || undefined,
          examId,
          deadline: requestForm.deadline || undefined,
        },
        { timeout: 20000 },
      );
      setNotice(
        `Demande envoyée à ${res.data?.schoolsCount ?? 0} école(s) rattachée(s) — ${res.data?.notifiedSchools ?? 0} notifiée(s).`,
      );
      setShowRequestForm(false);
      setRequestForm(EMPTY_REQUEST_FORM);
      setRequestFormTouched(false);
      await loadRequests();
      if (res.data?.request?.id) setSelectedRequestId(res.data.request.id);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Création impossible.');
    } finally {
      setCreatingRequest(false);
    }
  };

  const toggleRequestStatus = async (request: SupervisorRequestItem) => {
    setBusyRequestId(request.id);
    setError(null);
    setNotice(null);
    try {
      const next = request.status === 'OPEN' ? 'CLOSED' : 'OPEN';
      await apiClient.patch(
        `/federis/supervisors/requests/${request.id}`,
        { status: next },
        { timeout: 20000 },
      );
      setNotice(next === 'CLOSED' ? 'Demande clôturée.' : 'Demande rouverte.');
      await loadRequests();
      if (selectedRequestId === request.id) await loadDetail(request.id);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Action impossible.');
    } finally {
      setBusyRequestId(null);
    }
  };

  // ── Sélection des enseignants pour la répartition ───────────────────────
  const toggleTeacher = (teacherId: string) => {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) next.delete(teacherId);
      else next.add(teacherId);
      return next;
    });
  };

  const selectedRooms = useMemo(() => {
    const center = (detail?.centers ?? []).find((c) => c.id === assignCenterId);
    return center?.rooms ?? [];
  }, [detail, assignCenterId]);

  // ── Validation de la répartition ────────────────────────────────────────
  const validateAssignment = async () => {
    if (!selectedRequestId || selectedTeacherIds.size === 0 || !assignCenterId) return;
    setAssigning(true);
    setError(null);
    setNotice(null);
    try {
      // Construit les affectations depuis le récap (submissionId par enseignant)
      const assignments = (detail?.recap ?? [])
        .filter((t) => selectedTeacherIds.has(t.id))
        .map((t) => ({
          submissionId: t.submissionId,
          teacherId: t.id,
          centerId: assignCenterId,
          roomId: assignRoomId || undefined,
        }));
      const res = await apiClient.post(
        `/federis/supervisors/requests/${selectedRequestId}/assignments`,
        { assignments },
        { timeout: 30000 },
      );
      setNotice(
        `Répartition validée — ${res.data?.created ?? 0} affectation(s) créée(s), ` +
          `${res.data?.notifiedSchools ?? 0} école(s) notifiée(s).`,
      );
      setSelectedTeacherIds(new Set());
      setAssignCenterId('');
      setAssignRoomId('');
      await Promise.all([loadDetail(selectedRequestId), loadRegistry(), loadRequests()]);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Validation impossible.');
    } finally {
      setAssigning(false);
    }
  };

  // ── Création manuelle d'un surveillant ──────────────────────────────────
  const createManualSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examId) return;
    setCreatingManual(true);
    setError(null);
    try {
      await apiClient.post(
        '/federis/supervisors',
        {
          firstName: manualForm.firstName,
          lastName: manualForm.lastName,
          phone: manualForm.phone || undefined,
          email: manualForm.email || undefined,
          examId,
          centerId: manualForm.centerId || undefined,
          roomId: manualForm.roomId || undefined,
        },
        { timeout: 20000 },
      );
      setNotice(`Surveillant ${manualForm.firstName} ${manualForm.lastName} affecté.`);
      setShowManualForm(false);
      setManualForm(EMPTY_MANUAL_FORM);
      await loadRegistry();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Création impossible.');
    } finally {
      setCreatingManual(false);
    }
  };

  const removeSupervisor = async (supervisor: RegistrySupervisor) => {
    if (!window.confirm(`Retirer ${supervisor.firstName} ${supervisor.lastName} du registre ?`)) return;
    setError(null);
    try {
      await apiClient.delete(`/federis/supervisors/${supervisor.id}`, { timeout: 20000 });
      setNotice('Surveillant retiré du registre.');
      await loadRegistry();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Suppression impossible.');
    }
  };

  // Registre filtré sur l'examen sélectionné
  const registrySupervisors = useMemo(() => {
    const all = registry?.supervisors ?? [];
    return examId ? all.filter((s) => s.exam?.id === examId) : all;
  }, [registry, examId]);

  const respondedSchools = (detail?.bySchool ?? []).filter((s) => s.responded).length;
  const pendingNotifyCount = registrySupervisors.filter(
    (s) => s.schoolName && !s.teacherNotifiedAt,
  ).length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 text-sm font-semibold text-emerald-800">{notice}</div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          1. DEMANDES AUX ÉCOLES RATTACHÉES
         ════════════════════════════════════════════════════════════════════ */}
      <div className="fed-card p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-sm font-bold text-blue-900 uppercase flex items-center gap-2">
              <AppIcon name="network" size="submenu" className="text-blue-900" />
              Demandes aux écoles rattachées
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Sollicitez vos écoles (JOINED) : elles sélectionnent leurs enseignants comme
              surveillants et vous renvoient leur liste{examLabel ? ` — examen ${examLabel}` : ''}.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={toggleRequestForm}
              disabled={!examId}
              className="fed-btn-gold px-4 py-2.5 text-sm disabled:opacity-40 flex-shrink-0"
            >
              <AppIcon name={showRequestForm ? 'close' : 'add'} size="submenu" />
              {showRequestForm ? 'Annuler' : 'Demander aux écoles'}
            </button>
          )}
        </div>

        {/* Formulaire de demande — ⭐ note circulaire AUTO-GÉNÉRÉE dès que
            l'examen est connu (objet + message orientés CEP/BEPC/BAC/CAP).
            Le patronat ne corrige que les nombres attendus et les
            disponibilités — le brouillon est une véritable note administrative. */}
        {showRequestForm && canManage && (
          <form onSubmit={createRequest} className="border border-slate-200 rounded-xl p-6 space-y-5 mb-6 bg-[#f7f9fc]">
            {/* Bandeau brouillon auto-généré */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <AppIcon name="sparkles" size="submenu" className="text-blue-800 mt-0.5 shrink-0" />
                <p className="text-[11px] leading-relaxed text-blue-900 font-semibold">
                  Note circulaire auto-générée à partir de l'examen
                  «&nbsp;{exam?.name ?? examLabel}&nbsp;» — objet, structure administrative,
                  effectif attendu, critères et modalités. Corrigez simplement les nombres
                  et disponibilités si nécessaire.
                </p>
              </div>
              <button
                type="button"
                onClick={regenerateDraft}
                disabled={!exam}
                title="Reconstruire la note circulaire proposée par le système (vos modifications seront perdues)"
                className="shrink-0 px-4 py-2 rounded-lg text-[10px] font-bold uppercase bg-white border border-blue-200 text-blue-900 hover:bg-blue-100 transition-colors disabled:opacity-40"
              >
                Régénérer
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                  Objet de la demande <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  maxLength={190}
                  value={requestForm.title}
                  onChange={(e) => {
                    setRequestForm({ ...requestForm, title: e.target.value });
                    setRequestFormTouched(true);
                  }}
                  placeholder="Ex : Désignation d'enseignants surveillants — Examen blanc CEP 2027"
                  className="fed-input-light px-4 py-3 font-semibold"
                />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">
                    Message aux écoles (note circulaire)
                  </label>
                  <span
                    className={cn(
                      'text-[10px] font-bold tabular-nums',
                      requestForm.message.length > 1900 ? 'text-red-600' : 'text-slate-400',
                    )}
                  >
                    {requestForm.message.length} / 2000
                  </span>
                </div>
                <textarea
                  value={requestForm.message}
                  onChange={(e) => {
                    setRequestForm({ ...requestForm, message: e.target.value });
                    setRequestFormTouched(true);
                  }}
                  rows={16}
                  maxLength={2000}
                  placeholder="Effectif attendu par école, critères (disponibilité, expérience des examens…), modalités de réponse…"
                  className="fed-input-light px-4 py-3 font-medium resize-y leading-relaxed"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                  Examen concerné
                </label>
                <input
                  disabled
                  value={examLabel ?? 'Sélectionnez un examen ci-dessus'}
                  className="fed-input-light px-4 py-3 font-semibold !bg-slate-100"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  La répartition se fait par centre et par salle de cet examen.
                </p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                  Date limite de réponse
                </label>
                <input
                  type="date"
                  value={requestForm.deadline}
                  onChange={(e) => setRequestForm({ ...requestForm, deadline: e.target.value })}
                  className="fed-input-light px-4 py-3 font-semibold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Reprendue dans la note (« au plus tard le … ») tant que le brouillon n'est pas personnalisé.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={creatingRequest} className="fed-btn-gold px-6 py-2.5 text-sm disabled:opacity-50">
                {creatingRequest ? 'Envoi…' : 'Envoyer la demande aux écoles'}
              </button>
            </div>
          </form>
        )}

        {/* Liste des demandes */}
        {requestsLoading ? (
          <p className="text-sm font-bold text-slate-400 text-center py-6">Chargement des demandes…</p>
        ) : (requestsData?.requests ?? []).length === 0 ? (
          <div className="text-center py-8">
            <AppIcon name="network" size="submenu" className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 mt-2">Aucune demande</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Lancez une demande : vos {requestsData?.schoolsCount ?? 0} école(s) rattachée(s)
              pourront sélectionner leurs enseignants comme surveillants depuis Academia Helm.
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
            {(requestsData?.requests ?? []).map((request) => (
              <div
                key={request.id}
                className={cn(
                  'p-4 lg:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-colors',
                  selectedRequestId === request.id ? 'bg-blue-50/60' : 'hover:bg-[#f7f9fc]',
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    setSelectedRequestId(selectedRequestId === request.id ? null : request.id)
                  }
                  className="flex items-start gap-4 text-left flex-1 min-w-0"
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                      request.status === 'OPEN'
                        ? 'bg-amber-50'
                        : 'bg-slate-100',
                    )}
                  >
                    <span
                      className={cn(
                        'w-3 h-3 rounded-full',
                        request.status === 'OPEN' ? 'bg-amber-500' : 'bg-slate-400',
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-blue-900">{request.title}</span>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[9px] font-bold uppercase',
                          request.status === 'OPEN'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-600',
                        )}
                      >
                        {request.status === 'OPEN' ? 'Ouverte' : 'Clôturée'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {request.examLabel ?? '—'} · {request.respondedCount}/
                      {requestsData?.schoolsCount ?? 0} école(s) ont répondu ·{' '}
                      {request.teachersProposed} enseignant(s) proposé(s) ·{' '}
                      {request.supervisorsAssigned} affecté(s)
                      {request.deadline
                        ? ` · limite ${new Date(request.deadline).toLocaleDateString('fr-FR')}`
                        : ''}
                    </p>
                  </div>
                </button>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => void toggleRequestStatus(request)}
                    disabled={busyRequestId === request.id}
                    className="px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-[11px] font-bold hover:bg-slate-100 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {busyRequestId === request.id
                      ? '…'
                      : request.status === 'OPEN'
                        ? 'Clôturer'
                        : 'Rouvrir'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          2. LISTES REÇUES PAR ÉCOLE + RÉCAPITULATIF + RÉPARTITION
         ════════════════════════════════════════════════════════════════════ */}
      {selectedRequestId && (
        <div className="fed-card p-6 lg:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-blue-900 uppercase flex items-center gap-2">
                <AppIcon name="students" size="submenu" className="text-blue-900" />
                Listes reçues — {detail?.request.title ?? '…'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {respondedSchools}/{detail?.schoolsCount ?? 0} école(s) ont répondu ·{' '}
                {detail?.recap.length ?? 0} enseignant(s) proposé(s) au total
              </p>
            </div>
            {/* Bascule Par école / Récapitulatif */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('bySchool')}
                className={cn(
                  'px-4 py-2 rounded-lg text-xs transition-all',
                  viewMode === 'bySchool'
                    ? 'bg-white shadow-sm text-blue-900 font-bold'
                    : 'text-slate-500 font-semibold hover:text-blue-900',
                )}
              >
                Par école
              </button>
              <button
                type="button"
                onClick={() => setViewMode('recap')}
                className={cn(
                  'px-4 py-2 rounded-lg text-xs transition-all',
                  viewMode === 'recap'
                    ? 'bg-white shadow-sm text-blue-900 font-bold'
                    : 'text-slate-500 font-semibold hover:text-blue-900',
                )}
              >
                Récapitulatif global
              </button>
            </div>
          </div>

          {detailLoading ? (
            <p className="text-sm font-bold text-slate-400 text-center py-6">
              Chargement des listes…
            </p>
          ) : viewMode === 'bySchool' ? (
            <div className="space-y-3">
              {(detail?.bySchool ?? []).map((school) => (
                <div key={school.schoolTenantId} className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSchoolTenantId(
                        openSchoolTenantId === school.schoolTenantId ? null : school.schoolTenantId,
                      )
                    }
                    className="w-full flex items-center justify-between px-5 py-4 bg-[#f7f9fc] hover:bg-blue-50/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center font-bold text-blue-900 text-sm flex-shrink-0">
                        {school.schoolName?.[0]?.toUpperCase() ?? 'É'}
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="text-sm font-bold text-blue-900 truncate">{school.schoolName}</div>
                        <div className="text-[10px] text-slate-400">
                          {school.responded
                            ? `${school.teachers.length} enseignant(s) proposé(s)`
                            : 'Pas encore de réponse'}
                        </div>
                      </div>
                    </div>
                    {school.responded && (
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 text-xs font-bold flex-shrink-0">
                        {school.teachers.length}
                      </span>
                    )}
                  </button>
                  {openSchoolTenantId === school.schoolTenantId && school.responded && (
                    <div className="divide-y divide-slate-100">
                      {school.teachers.map((t) => (
                        <TeacherRow
                          key={t.id}
                          teacher={t}
                          showSchool={false}
                          selectable={canManage && detail?.request.status === 'OPEN'}
                          selected={selectedTeacherIds.has(t.id)}
                          onToggle={() => toggleTeacher(t.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Récapitulatif global — toutes les écoles confondues */
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
              {(detail?.recap ?? []).length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-slate-400">
                  Aucun enseignant proposé pour le moment.
                </p>
              ) : (
                (detail?.recap ?? []).map((t) => (
                  <TeacherRow
                    key={`${t.schoolTenantId}-${t.id}`}
                    teacher={t}
                    showSchool
                    selectable={canManage && detail?.request.status === 'OPEN'}
                    selected={selectedTeacherIds.has(t.id)}
                    onToggle={() => toggleTeacher(t.id)}
                  />
                ))
              )}
            </div>
          )}

          {/* Barre de répartition : sélection → centre → salle → validation */}
          {canManage && (
            <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-5 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                <div className="flex-shrink-0">
                  <p className="text-xs font-bold text-blue-900 uppercase">Répartition</p>
                  <p className="text-[11px] text-slate-500">
                    {selectedTeacherIds.size} enseignant(s) sélectionné(s)
                  </p>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                    Centre d&apos;accueil
                  </label>
                  <select
                    value={assignCenterId}
                    onChange={(e) => {
                      setAssignCenterId(e.target.value);
                      setAssignRoomId('');
                    }}
                    className="fed-input-light px-4 py-2.5 font-semibold w-full"
                  >
                    <option value="">— Choisir un centre —</option>
                    {(detail?.centers ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                    Salle de composition
                  </label>
                  <select
                    value={assignRoomId}
                    onChange={(e) => setAssignRoomId(e.target.value)}
                    disabled={!assignCenterId}
                    className="fed-input-light px-4 py-2.5 font-semibold w-full disabled:opacity-50"
                  >
                    <option value="">— Toute salle / non défini —</option>
                    {selectedRooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} — {r.name} ({r.capacity} places)
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => void validateAssignment()}
                  disabled={
                    assigning ||
                    selectedTeacherIds.size === 0 ||
                    !assignCenterId ||
                    detail?.request.status !== 'OPEN'
                  }
                  className="fed-btn-gold px-6 py-2.5 text-sm disabled:opacity-40 flex-shrink-0"
                >
                  {assigning ? 'Validation…' : 'Valider la répartition'}
                </button>
              </div>
              {(detail?.centers ?? []).length === 0 && (
                <p className="text-[11px] text-amber-700 font-semibold">
                  Aucun centre actif pour cet examen — créez d&apos;abord vos centres et salles
                  dans l&apos;onglet « Centres et salles ».
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          3. REGISTRE DES SURVEILLANTS AFFECTÉS
         ════════════════════════════════════════════════════════════════════ */}
      <div className="fed-card p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-sm font-bold text-blue-900 uppercase flex items-center gap-2">
              <AppIcon name="scolarite" size="submenu" className="text-blue-900" />
              Registre des surveillants {examLabel ? `— ${examLabel}` : ''}
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Nominations reçues des écoles (répartition validée) et saisies manuelles.
              {pendingNotifyCount > 0
                ? ` ${pendingNotifyCount} affectation(s) en attente de transmission aux enseignants par leur école.`
                : ''}
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowManualForm((v) => !v)}
              disabled={!examId}
              className="fed-btn-gold px-4 py-2.5 text-sm disabled:opacity-40 flex-shrink-0"
            >
              <AppIcon name={showManualForm ? 'close' : 'add'} size="submenu" />
              {showManualForm ? 'Annuler' : 'Ajouter un surveillant'}
            </button>
          )}
        </div>

        {/* Formulaire de création manuelle */}
        {showManualForm && canManage && examId && (
          <form onSubmit={createManualSupervisor} className="border border-slate-200 rounded-xl p-6 space-y-5 mb-6 bg-[#f7f9fc]">
            <h3 className="text-xs font-bold text-blue-900 uppercase">Surveillant — saisie manuelle</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Prénom *</label>
                <input required value={manualForm.firstName}
                  onChange={(e) => setManualForm({ ...manualForm, firstName: e.target.value })}
                  placeholder="Prénom" className="fed-input-light px-4 py-3 font-semibold" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Nom *</label>
                <input required value={manualForm.lastName}
                  onChange={(e) => setManualForm({ ...manualForm, lastName: e.target.value })}
                  placeholder="Nom" className="fed-input-light px-4 py-3 font-semibold" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Téléphone</label>
                <input value={manualForm.phone}
                  onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                  placeholder="+229…" className="fed-input-light px-4 py-3 font-semibold" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Email</label>
                <input type="email" value={manualForm.email}
                  onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })}
                  placeholder="…" className="fed-input-light px-4 py-3 font-semibold" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Centre</label>
                <select value={manualForm.centerId}
                  onChange={(e) => setManualForm({ ...manualForm, centerId: e.target.value, roomId: '' })}
                  className="fed-input-light px-4 py-3 font-semibold">
                  <option value="">— Aucun —</option>
                  {(detail?.centers ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Salle</label>
                <select value={manualForm.roomId}
                  onChange={(e) => setManualForm({ ...manualForm, roomId: e.target.value })}
                  disabled={!manualForm.centerId}
                  className="fed-input-light px-4 py-3 font-semibold disabled:opacity-50">
                  <option value="">— Aucune —</option>
                  {(detail?.centers ?? [])
                    .find((c) => c.id === manualForm.centerId)
                    ?.rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={creatingManual} className="fed-btn-gold px-6 py-2.5 text-sm disabled:opacity-50">
                {creatingManual ? 'Création…' : 'Affecter au registre'}
              </button>
            </div>
          </form>
        )}

        {/* Tableau du registre */}
        {registryLoading ? (
          <p className="text-sm font-bold text-slate-400 text-center py-6">Chargement du registre…</p>
        ) : registrySupervisors.length === 0 ? (
          <div className="text-center py-8">
            <AppIcon name="scolarite" size="submenu" className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700 mt-2">Aucun surveillant affecté</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Validez la répartition des enseignants proposés par les écoles, ou ajoutez un
              surveillant manuellement.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr className="text-left">
                  {['Surveillant', 'École d\u2019origine', 'Centre', 'Salle', 'Examen', 'Origine', 'Transmission', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registrySupervisors.map((s) => (
                  <tr key={s.id} className="hover:bg-[#f7f9fc]">
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-blue-900">
                        {s.firstName} {s.lastName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {[s.phone, s.email].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                      {s.schoolName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                      {s.center ? `${s.center.code} — ${s.center.name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                      {s.room ? s.room.name : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                      {s.exam?.code ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[9px] font-bold uppercase',
                          s.source === 'SCHOOL_NOMINATION'
                            ? 'bg-blue-50 text-blue-800'
                            : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        {s.source === 'SCHOOL_NOMINATION' ? 'École' : 'Manuel'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.schoolName ? (
                        s.teacherNotifiedAt ? (
                          <span className="text-[10px] font-bold text-green-700 uppercase">
                            Transmise
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-600 uppercase">
                            En attente école
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => void removeSupervisor(s)}
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                          title="Retirer du registre"
                        >
                          <AppIcon name="delete" size="submenu" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ligne enseignant (listes reçues / récapitulatif) ────────────────────────

function TeacherRow({
  teacher,
  showSchool,
  selectable,
  selected,
  onToggle,
}: {
  teacher: RecapTeacher;
  showSchool: boolean;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-3 transition-colors',
        selected ? 'bg-blue-50/70' : 'hover:bg-[#f7f9fc]',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {selectable ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="w-4 h-4 rounded border-slate-300 text-blue-900 flex-shrink-0"
          />
        ) : (
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center font-bold text-blue-900 text-xs flex-shrink-0">
            {teacher.firstName?.[0]}
            {teacher.lastName?.[0]}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-bold text-blue-900 truncate">
            {teacher.firstName} {teacher.lastName}
            {showSchool && (
              <span className="font-semibold text-slate-400"> — {teacher.schoolName}</span>
            )}
          </div>
          <div className="text-[10px] text-slate-400">
            {[
              teacher.subject,
              teacher.matricule,
              teacher.phone,
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          </div>
        </div>
      </div>
      {teacher.assigned ? (
        <span className="text-[10px] font-bold text-green-700 uppercase flex-shrink-0 text-right">
          Affecté
          {teacher.assigned.center ? ` · ${teacher.assigned.center.code}` : ''}
          {teacher.assigned.room ? ` · ${teacher.assigned.room.name}` : ''}
        </span>
      ) : selectable ? (
        <span className="text-[10px] font-bold text-slate-300 uppercase flex-shrink-0">
          à répartir
        </span>
      ) : null}
    </div>
  );
}

