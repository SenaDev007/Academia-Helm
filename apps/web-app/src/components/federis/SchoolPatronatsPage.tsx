/**
 * SchoolPatronatsPage — Patronats & Examens fédérés (portail école Helm)
 *
 * Validation par l'ÉTABLISSEMENT des demandes de rattachement émises par les
 * patronats scolaires (Academia Federis) :
 *   - PENDING → Valider (JOINED) / Refuser (REJECTED, motif)
 *   - JOINED  → Suspendre (le patronat perd l'accès aux données de l'école)
 *
 * Pattern Helm PedagogicalDirectorController / AccessRequestsController :
 * workflow PENDING → approuvé / refusé réservé à la direction et au
 * secrétariat (garde finale côté API federis-school.service).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';

interface PatronatInfo {
  id?: string;
  name: string;
  orgLevel?: string;
  territoryName?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface PatronatLink {
  id: string;
  patronat: PatronatInfo;
  academicYear: string | null;
  status: string;
  statusLabel: string;
  accessLevel: string;
  requestedAt: string;
  joinedAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  candidatesCount: number;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  JOINED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-700',
  SUSPENDED: 'bg-gray-200 text-gray-600',
};

export function SchoolPatronatsPage() {
  const [links, setLinks] = useState<PatronatLink[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Motifs (refus / suspension)
  const [reasonTarget, setReasonTarget] = useState<{ link: PatronatLink; action: 'reject' | 'suspend' } | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/federis/school/patronats', { timeout: 20000 });
      setLinks(res.data?.patronats ?? []);
      setPendingCount(res.data?.pendingCount ?? 0);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Impossible de charger les patronats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (link: PatronatLink) => {
    setBusyId(link.id);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post(`/federis/school/patronats/${link.id}/approve`, {}, { timeout: 20000 });
      setNotice(res.data?.message ?? 'Rattachement validé.');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Validation impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const submitReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonTarget) return;
    setSubmitting(true);
    setError(null);
    try {
      const endpoint =
        reasonTarget.action === 'reject'
          ? `/federis/school/patronats/${reasonTarget.link.id}/reject`
          : `/federis/school/patronats/${reasonTarget.link.id}/suspend`;
      const res = await apiClient.post(endpoint, { reason: reason || undefined }, { timeout: 20000 });
      setNotice(res.data?.message ?? 'Demande traitée.');
      setReasonTarget(null);
      setReason('');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Action impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="bg-white p-6 lg:p-8 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center">
              <AppIcon name="network" size="dashboard" className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Patronats &amp; Examens fédérés
            </h1>
          </div>
          <p className="text-gray-500 font-medium max-w-2xl">
            Les patronats scolaires (Academia Federis) vous demandent le rattachement de votre
            établissement pour organiser les examens nationaux — CEP, BEPC, BAC. Validez ou
            refusez chaque demande : votre accord conditionne l&apos;inscription de vos élèves.
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="shrink-0 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
            <p className="text-[10px] font-bold text-amber-600 uppercase">
              En attente
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-800">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4 text-sm font-semibold text-emerald-800">{notice}</div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center text-sm font-bold text-gray-400">
          Chargement des demandes…
        </div>
      ) : links.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <p className="text-sm font-bold text-gray-400 mb-2">Aucune demande de rattachement</p>
          <p className="text-xs text-gray-400">
            Lorsqu&apos;un patronat sollicitera le rattachement de votre établissement, la demande
            apparaîtra ici pour validation.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-50">
          {links.map((link) => (
            <div key={link.id} className="p-6 lg:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:bg-gray-50/60 transition-all">
              <div className="flex items-start gap-5">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center font-bold text-blue-900 text-lg shadow-sm shrink-0">
                  {link.patronat.name?.[0]?.toUpperCase() ?? 'P'}
                </div>
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h4 className="text-base font-bold text-gray-900">{link.patronat.name}</h4>
                    <span className={cn('text-[9px] font-bold uppercase px-2.5 py-1 rounded', STATUS_STYLES[link.status] ?? 'bg-gray-100 text-gray-600')}>
                      {link.statusLabel}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mt-1.5">
                    {link.patronat.orgLevel === 'NATIONAL' ? 'Patronat national' : 'Patronat territorial'}
                    {link.patronat.territoryName ? ` — ${link.patronat.territoryName}` : ''}
                    {link.patronat.country ? ` • ${link.patronat.country}` : ''}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">
                    {link.patronat.email ?? '—'}
                    {link.patronat.phone ? ` • ${link.patronat.phone}` : ''}
                    {` • Demande du ${new Date(link.requestedAt).toLocaleDateString('fr-FR')}`}
                    {link.academicYear ? ` • ${link.academicYear}` : ''}
                  </p>
                  {link.status === 'JOINED' && (
                    <p className="text-[10px] font-bold text-green-600 uppercase mt-1">
                      {link.candidatesCount} candidat(s) inscrit(s) via ce patronat
                    </p>
                  )}
                  {link.status === 'SUSPENDED' && link.suspendedReason && (
                    <p className="text-[10px] font-bold text-gray-500 mt-1">Motif : {link.suspendedReason}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {link.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => approve(link)}
                      disabled={busyId === link.id}
                      className="px-5 py-2.5 bg-blue-900 text-white rounded-xl text-[10px] font-bold uppercase shadow-lg hover:bg-blue-800 transition-all disabled:opacity-50"
                    >
                      {busyId === link.id ? '…' : 'Valider'}
                    </button>
                    <button
                      onClick={() => setReasonTarget({ link, action: 'reject' })}
                      className="px-5 py-2.5 bg-red-50 text-red-700 rounded-xl text-[10px] font-bold uppercase hover:bg-red-100 transition-all"
                    >
                      Refuser
                    </button>
                  </>
                )}
                {link.status === 'JOINED' && (
                  <button
                    onClick={() => setReasonTarget({ link, action: 'suspend' })}
                    className="px-5 py-2.5 bg-gray-50 text-gray-600 rounded-xl text-[10px] font-bold uppercase hover:bg-gray-100 transition-all"
                  >
                    Suspendre
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modale motif (refus / suspension) */}
      {reasonTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitReason} className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md space-y-5">
            <h3 className="text-lg font-semibold text-gray-900">
              {reasonTarget.action === 'reject' ? 'Refuser la demande' : 'Suspendre le rattachement'}
            </h3>
            <p className="text-sm text-gray-500 font-medium">
              {reasonTarget.action === 'reject'
                ? `La demande du patronat « ${reasonTarget.link.patronat.name} » sera refusée.`
                : `Le patronat « ${reasonTarget.link.patronat.name} » perdra l'accès aux données de votre établissement.`}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-900 resize-none"
              placeholder="Motif (optionnel, conservé à des fins de traçabilité)"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReasonTarget(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  'px-5 py-2.5 rounded-xl text-xs font-bold uppercase transition-all disabled:opacity-50',
                  reasonTarget.action === 'reject'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-blue-900 text-white hover:bg-blue-800',
                )}
              >
                {submitting ? '…' : reasonTarget.action === 'reject' ? 'Refuser' : 'Suspendre'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default SchoolPatronatsPage;
