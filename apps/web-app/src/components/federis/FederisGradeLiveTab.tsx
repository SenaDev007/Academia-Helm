/**
 * FederisGradeLiveTab — Suivi TEMPS RÉEL de la saisie (module Notes et Moyennes)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ 2026-10-01 — Le patronat suit EN DIRECT la saisie des notes déléguée aux
 * enseignants affectés au poste de SECRÉTARIAT (comptes provisoires créés à
 * l'affectation — module Centres, salles & Surveillants) :
 *
 *   - Par secrétaire : centre + salle attribués, notes saisies / total,
 *     statut (à commencer / en cours / soumis), dernière activité ;
 *   - Compteurs globaux : candidats, matières ouvertes, notes saisies /
 *     soumises — les soumissions sont « mises au propre » en temps réel ;
 *   - Activité récente nominative (qui a saisi quoi, quand) ;
 *   - Gestion des comptes provisoires : geler / réactiver / réinitialiser le
 *     mot de passe / supprimer (réservée au coordonnateur et organisateur).
 *
 * Rafraîchissement automatique toutes les 10 s (onglet visible) — pattern
 * polling SchoolSupervisorsTab (aucun WebSocket côté Federis).
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import AppIcon from '@/components/ui/AppIcon';
import { canWrite } from '@/lib/patronat/permissions';

const POLL_INTERVAL_MS = 10000;

interface LiveAssignment {
  id: string;
  teacherName: string;
  phone: string | null;
  schoolTenantId: string | null;
  center: { id: string; code: string; name: string } | null;
  room: { id: string; code: string; name: string } | null;
  scopeCandidates: number;
  cellsTotal: number;
  cellsEntered: number;
  cellsSubmitted: number;
  lastActivityAt: string | null;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';
  account: { login: string; status: string; createdAt: string | null } | null;
}

interface LiveData {
  exam: { id: string; code: string; name: string; examType: string; status: string };
  subjects: Array<{ id: string; code: string; name: string; epreuvePrepared: boolean }>;
  assignments: LiveAssignment[];
  recentActivity: Array<{
    candidateName: string;
    tableNumber: string | null;
    subjectName: string;
    score: number;
    isAbsent: boolean;
    status: string;
    by: string;
    at: string;
  }>;
  global: {
    candidates: number;
    subjectsPrepared: number;
    cellsTotal: number;
    cellsEntered: number;
    cellsSubmitted: number;
    secretaries: number;
  };
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  NOT_STARTED: { label: 'À commencer', cls: 'bg-slate-100 text-slate-600' },
  IN_PROGRESS: { label: 'En cours', cls: 'bg-blue-50 text-blue-800' },
  SUBMITTED: { label: 'Soumis', cls: 'bg-emerald-50 text-emerald-700' },
};

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(iso).toLocaleDateString('fr-FR');
}

export default function FederisGradeLiveTab({
  examId,
  userRole,
}: {
  examId: string;
  userRole?: string | null;
}) {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetCredential, setResetCredential] = useState<{ login: string; password: string } | null>(null);
  const [live, setLive] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canManage = canWrite(userRole, 'exam_org');

  // ── Chargement (silencieux après le premier) ─────────────────────────────
  const load = useCallback(
    async (silent = false) => {
      if (!examId) return;
      if (!silent) setLoading(true);
      try {
        const res = await apiClient.get(`/federis/exams/${examId}/grades/live`, { timeout: 20000 });
        setData(res.data ?? null);
        setError(null);
      } catch (err: any) {
        if (!silent) setError(err?.response?.data?.message ?? 'Suivi indisponible.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [examId],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  // ── Polling 10 s (onglet visible uniquement) ─────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!live) return;
    timerRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [live, load]);

  // ── Actions de gestion des comptes provisoires ──────────────────────────
  const manageAccount = async (
    supervisorId: string,
    action: 'freeze' | 'reactivate' | 'reset-password' | 'delete' | 'provision',
  ) => {
    if (
      action === 'delete' &&
      !window.confirm(
        'Supprimer ce compte provisoire ? Les notes déjà saisies sont conservées (anonymisées).',
      )
    )
      return;
    setBusyId(supervisorId);
    setError(null);
    setNotice(null);
    try {
      if (action === 'provision') {
        const res = await apiClient.post(
          `/federis/supervisors/${supervisorId}/provision-account`,
          {},
          { timeout: 20000 },
        );
        if (res.data?.tempPassword) {
          setResetCredential({ login: res.data.login, password: res.data.tempPassword });
        } else {
          setNotice(`Compte déjà actif — ${res.data?.login ?? ''}.`);
        }
      } else if (action === 'reset-password') {
        const res = await apiClient.post(
          `/federis/supervisors/${supervisorId}/account/reset-password`,
          {},
          { timeout: 20000 },
        );
        setResetCredential({ login: res.data?.login ?? '', password: res.data?.tempPassword ?? '' });
      } else {
        await apiClient.post(
          `/federis/supervisors/${supervisorId}/account/${action}`,
          {},
          { timeout: 20000 },
        );
        setNotice(
          action === 'freeze'
            ? 'Compte gelé — le secrétaire ne peut plus se connecter.'
            : action === 'reactivate'
              ? 'Compte réactivé.'
              : 'Compte provisoire supprimé.',
        );
      }
      await load(true);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const copyCredentials = (login: string, password: string) => {
    const text = `Identifiant : ${login}\nMot de passe : ${password}\nConnexion : ${window.location.origin}/federis/login`;
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    setNotice('Identifiants copiés — transmettez-les au secrétaire.');
  };

  if (loading && !data) {
    return (
      <div className="fed-card px-6 py-10 text-center text-sm font-bold text-slate-400">
        Chargement du suivi temps réel…
      </div>
    );
  }
  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const unprepared = (data.subjects ?? []).filter((s) => !s.epreuvePrepared);

  return (
    <div className="space-y-5">
      {/* ── Bandeau global + bascule live ─────────────────────────────── */}
      <div className="fed-card px-6 py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-blue-900 uppercase flex items-center gap-2">
            <AppIcon name="grades" size="submenu" className="text-blue-900" />
            Suivi temps réel — saisie des secrétaires
            <span className="ml-1 text-[10px] font-semibold text-slate-400 normal-case">
              {data.exam.code} · {data.global.secretaries} secrétaire(s)
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Les enseignants affectés au poste de secrétariat saisissent les notes depuis leur
            interface dédiée (compte provisoire). Les soumissions sont mises au propre en temps réel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLive((v) => !v)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase border transition-all flex-shrink-0',
            live
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-white border-slate-200 text-slate-500',
          )}
        >
          <span className={cn('w-2 h-2 rounded-full', live ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300')} />
          {live ? 'Direct · 10 s' : 'En pause'}
        </button>
      </div>

      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {/* Identifiants régénérés (affichés UNE fois) */}
      {resetCredential && (
        <div className="bg-blue-900 text-white rounded-xl px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase">Nouveaux identifiants du secrétaire</p>
            <p className="text-[11px] mt-1 font-mono">
              {resetCredential.login} · {resetCredential.password}
            </p>
            <p className="text-[10px] text-blue-200 mt-1">
              Copiez-les maintenant — le mot de passe ne sera plus affiché.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => copyCredentials(resetCredential.login, resetCredential.password)}
              className="px-4 py-2 rounded-xl bg-white text-blue-900 text-[10px] font-bold uppercase"
            >
              Copier
            </button>
            <button
              type="button"
              onClick={() => setResetCredential(null)}
              className="px-4 py-2 rounded-xl bg-blue-800 text-white text-[10px] font-bold uppercase"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ⭐ Rappel : matières verrouillées (règle épreuve préparée) */}
      {unprepared.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-3.5 text-xs font-semibold text-amber-800">
          {unprepared.length} matière(s) encore verrouillée(s) (épreuve non préparée) :{' '}
          {unprepared.map((s) => s.name).join(', ')} — la saisie de ces matières est bloquée pour
          tout le monde, y compris les secrétaires.
        </div>
      )}

      {/* ── Compteurs globaux ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="fed-card px-5 py-4 text-center">
          <p className="text-xl font-bold text-blue-900">{data.global.candidates}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Candidats</p>
        </div>
        <div className="fed-card px-5 py-4 text-center">
          <p className="text-xl font-bold text-blue-900">
            {data.global.subjectsPrepared}/{data.subjects.length}
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Matières ouvertes</p>
        </div>
        <div className="fed-card px-5 py-4 text-center">
          <p className="text-xl font-bold text-blue-900">
            {data.global.cellsEntered}
            <span className="text-sm text-slate-400 font-semibold">/{data.global.cellsTotal}</span>
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Notes saisies</p>
        </div>
        <div className="fed-card px-5 py-4 text-center">
          <p className="text-xl font-bold text-emerald-600">{data.global.cellsSubmitted}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Notes soumises</p>
        </div>
      </div>

      {/* ── Aucun secrétaire affecté ──────────────────────────────────── */}
      {data.assignments.length === 0 ? (
        <div className="fed-card px-8 py-12 text-center">
          <AppIcon name="scolarite" size="menu" className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700 mt-3">Aucun secrétaire de saisie affecté</p>
          <p className="text-xs text-slate-500 max-w-lg mx-auto mt-1.5">
            Affectez des enseignants au poste de SECRÉTARIAT (avec leur centre et salle de saisie)
            dans le module « Centres, salles &amp; Surveillants » — leur compte provisoire sera créé
            automatiquement et cette interface affichera leur progression en direct.
          </p>
        </div>
      ) : (
        <div className="fed-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-[#f7f9fc]">
                <tr className="text-left">
                  {['Secrétaire', 'Périmètre de saisie', 'Progression', 'Statut', 'Dernière activité', 'Compte', ''].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.assignments.map((a) => {
                  const pct =
                    a.cellsTotal > 0 ? Math.round((a.cellsEntered / a.cellsTotal) * 100) : 0;
                  const st = STATUS_LABELS[a.status] ?? STATUS_LABELS.NOT_STARTED;
                  return (
                    <tr key={a.id} className="hover:bg-[#f7f9fc]">
                      <td className="px-4 py-3">
                        <div className="text-xs font-bold text-blue-900">{a.teacherName}</div>
                        <div className="text-[10px] text-slate-400">{a.phone ?? '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-600">
                        {a.center ? `${a.center.code} — ${a.center.name}` : 'Centre non défini'}
                        {a.room ? (
                          <span className="text-slate-400"> · Salle {a.room.code}</span>
                        ) : (
                          <span className="text-slate-400"> · Toutes salles</span>
                        )}
                        <div className="text-[10px] text-slate-400">
                          {a.scopeCandidates} candidat(s)
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                a.status === 'SUBMITTED' ? 'bg-emerald-500' : 'bg-blue-900',
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">
                            {a.cellsEntered}/{a.cellsTotal}
                          </span>
                        </div>
                        {a.cellsSubmitted > 0 && (
                          <div className="text-[9px] font-bold text-emerald-600 mt-1">
                            {a.cellsSubmitted} soumise(s)
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[9px] font-bold uppercase',
                            st.cls,
                          )}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[10px] font-semibold text-slate-500">
                        {timeAgo(a.lastActivityAt)}
                      </td>
                      <td className="px-4 py-3">
                        {a.account ? (
                          <div>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded text-[9px] font-bold uppercase',
                                a.account.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : a.account.status === 'suspended'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-slate-100 text-slate-500',
                              )}
                            >
                              {a.account.status === 'active'
                                ? 'Actif'
                                : a.account.status === 'suspended'
                                  ? 'Gelé'
                                  : 'Supprimé'}
                            </span>
                            <div
                              className="text-[9px] text-slate-400 font-mono mt-1 max-w-[150px] truncate"
                              title={a.account.login}
                            >
                              {a.account.login}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">Aucun</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {canManage && (
                          <div className="flex items-center justify-end gap-1">
                            {!a.account && (
                              <button
                                type="button"
                                onClick={() => void manageAccount(a.id, 'provision')}
                                disabled={busyId === a.id}
                                className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase bg-blue-900 text-white disabled:opacity-50"
                                title="Créer le compte provisoire de saisie"
                              >
                                Provisionner
                              </button>
                            )}
                            {a.account?.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => void manageAccount(a.id, 'freeze')}
                                disabled={busyId === a.id}
                                className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                title="Geler le compte (fin de saisie)"
                              >
                                Geler
                              </button>
                            )}
                            {a.account?.status === 'suspended' && (
                              <button
                                type="button"
                                onClick={() => void manageAccount(a.id, 'reactivate')}
                                disabled={busyId === a.id}
                                className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                Réactiver
                              </button>
                            )}
                            {a.account && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void manageAccount(a.id, 'reset-password')}
                                  disabled={busyId === a.id}
                                  className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                                  title="Générer un nouveau mot de passe"
                                >
                                  MDP
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void manageAccount(a.id, 'delete')}
                                  disabled={busyId === a.id}
                                  className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  title="Supprimer le compte provisoire"
                                >
                                  <AppIcon name="delete" size="submenu" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Activité récente ──────────────────────────────────────────── */}
      {data.recentActivity.length > 0 && (
        <div className="fed-card overflow-hidden">
          <div className="px-6 py-4 border-b border-blue-50 flex items-center justify-between">
            <h4 className="text-xs font-bold text-blue-900 uppercase">Activité récente</h4>
            <span className="text-[10px] text-slate-400 font-semibold">
              20 dernières notes saisies ou soumises
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentActivity.map((r, i) => (
              <div key={i} className="px-6 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-xs font-bold text-blue-900 truncate">{r.candidateName}</span>
                  <span className="text-[10px] text-slate-400 ml-2">
                    {r.tableNumber ? `Table ${r.tableNumber} · ` : ''}
                    {r.subjectName}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className={cn(
                      'text-xs font-black',
                      r.isAbsent ? 'text-red-500' : r.score >= 10 ? 'text-emerald-600' : 'text-red-600',
                    )}
                  >
                    {r.isAbsent ? 'ABS' : String(r.score).replace('.', ',')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold w-32 truncate">{r.by}</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded text-[8px] font-bold uppercase',
                      r.status === 'SUBMITTED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-blue-50 text-blue-700',
                    )}
                  >
                    {r.status === 'SUBMITTED' ? 'Soumis' : 'Brouillon'}
                  </span>
                  <span className="text-[10px] text-slate-400 w-20 text-right">
                    {timeAgo(r.at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
