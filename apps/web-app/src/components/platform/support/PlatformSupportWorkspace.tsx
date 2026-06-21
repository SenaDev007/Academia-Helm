'use client';

import { useState, useCallback } from 'react';
import {
  HelpCircle,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  AlertCircle,
  MessageSquare,
  Send,
} from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';

interface SupportData {
  summary: { open: number; inProgress: number; urgent: number; resolved24h: number };
  tickets: Array<{
    id: string; school: string; subject: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
    date: string;
  }>;
  note?: string;
}

const STATUS_OPTIONS: Array<{ value: string; label: string; cls: string }> = [
  { value: 'OPEN', label: 'Ouvert', cls: 'bg-amber-100 text-amber-700' },
  { value: 'IN_PROGRESS', label: 'En cours', cls: 'bg-blue-100 text-blue-700' },
  { value: 'RESOLVED', label: 'Résolu', cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'CLOSED', label: 'Fermé', cls: 'bg-slate-100 text-slate-700' },
];

const PRIORITY_OPTIONS: Array<{ value: string; label: string; cls: string }> = [
  { value: 'LOW', label: 'Basse', cls: 'bg-slate-100 text-slate-700' },
  { value: 'MEDIUM', label: 'Moyenne', cls: 'bg-blue-100 text-blue-700' },
  { value: 'HIGH', label: 'Haute', cls: 'bg-amber-100 text-amber-700' },
  { value: 'URGENT', label: 'Urgente', cls: 'bg-rose-100 text-rose-700' },
];

export default function PlatformSupportWorkspace() {
  const { data, loading, error, refetch } = usePlatformData<SupportData>('/support/tickets');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleUpdateTicket = useCallback(async (
    ticketId: string,
    patch: { status?: string; priority?: string; assignedTo?: string },
  ) => {
    setActionLoading(ticketId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/platform/support/tickets/${ticketId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Erreur ${res.status}`);
      }
      setActionSuccess('Ticket mis à jour.');
      setTimeout(() => setActionSuccess(null), 1200);
      refetch();
    } catch (err: any) {
      setActionError(err.message || 'Erreur');
    } finally {
      setActionLoading(null);
    }
  }, [refetch]);

  const handleReply = useCallback(async (ticketId: string) => {
    if (!replyText.trim()) return;
    setActionLoading(`reply-${ticketId}`);
    setActionError(null);
    try {
      const res = await fetch(`/api/platform/support/tickets/${ticketId}/reply`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Erreur ${res.status}`);
      }
      setReplyText('');
      setSelectedTicket(null);
      setActionSuccess('Réponse envoyée.');
      setTimeout(() => setActionSuccess(null), 1200);
      refetch();
    } catch (err: any) {
      setActionError(err.message || 'Erreur');
    } finally {
      setActionLoading(null);
    }
  }, [replyText, refetch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-blue-900">Support & Tickets</h1>
        <p className="text-slate-500">Tickets de support des écoles</p>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {loading ? <PlatformLoading label="Chargement des tickets…" /> :
       error ? <PlatformError message={error} onRetry={refetch} /> :
       !data ? <PlatformEmpty /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><HelpCircle className="w-5 h-5" /></div>
                <span className="text-xs font-medium text-slate-500">Ouverts</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{data.summary.open}</div>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Clock className="w-5 h-5" /></div>
                <span className="text-xs font-medium text-slate-500">En cours</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{data.summary.inProgress}</div>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><ShieldAlert className="w-5 h-5" /></div>
                <span className="text-xs font-medium text-slate-500">Urgents</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{data.summary.urgent}</div>
            </div>
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="w-5 h-5" /></div>
                <span className="text-xs font-medium text-slate-500">Résolus 24h</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{data.summary.resolved24h}</div>
            </div>
          </div>

          {data.note && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
              {data.note}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {data.tickets.length === 0 ? <PlatformEmpty title="Aucun ticket" description="Aucun ticket de support n'a encore été créé." /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">ID</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">École</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Sujet</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Priorité</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.tickets.map((t) => {
                      const statusOpt = STATUS_OPTIONS.find((s) => s.value === t.status) || STATUS_OPTIONS[0];
                      const prioOpt = PRIORITY_OPTIONS.find((p) => p.value === t.priority) || PRIORITY_OPTIONS[0];
                      const rowLoading = actionLoading === t.id;
                      const replyLoading = actionLoading === `reply-${t.id}`;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors align-top">
                          <td className="px-6 py-4 text-xs font-mono text-slate-500">{t.id}</td>
                          <td className="px-6 py-4 font-bold text-slate-900">{t.school}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">{t.subject}</td>
                          <td className="px-6 py-4">
                            <select
                              value={t.priority}
                              onChange={(e) => handleUpdateTicket(t.id, { priority: e.target.value })}
                              disabled={rowLoading}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border-0 cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${prioOpt.cls}`}
                              title="Modifier la priorité"
                            >
                              {PRIORITY_OPTIONS.map((p) => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={t.status}
                              onChange={(e) => handleUpdateTicket(t.id, { status: e.target.value })}
                              disabled={rowLoading}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border-0 cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${statusOpt.cls}`}
                              title="Modifier le statut"
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-600">{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              {/* Reply button */}
                              <button
                                onClick={() => { setSelectedTicket(selectedTicket === t.id ? null : t.id); setReplyText(''); }}
                                disabled={replyLoading || rowLoading}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-50"
                                title="Répondre"
                              >
                                {replyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                                Répondre
                              </button>
                            </div>
                            {/* Reply textarea */}
                            {selectedTicket === t.id && (
                              <div className="mt-2 space-y-2">
                                <textarea
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder="Tapez votre réponse..."
                                  rows={2}
                                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-amber-500"
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleReply(t.id)}
                                    disabled={replyLoading || !replyText.trim()}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50"
                                  >
                                    {replyLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                    Envoyer
                                  </button>
                                  <button
                                    onClick={() => { setSelectedTicket(null); setReplyText(''); }}
                                    disabled={replyLoading}
                                    className="px-2 py-1 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
