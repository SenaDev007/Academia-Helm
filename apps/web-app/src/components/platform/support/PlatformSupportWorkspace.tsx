'use client';

import { useState, useCallback } from 'react';
import {
  HelpCircle,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
  MessageSquare,
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

export default function PlatformSupportWorkspace() {
  const { data, loading, error, refetch } = usePlatformData<SupportData>('/support/tickets');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const handleUpdateStatus = useCallback(async (ticketId: string, newStatus: string) => {
    setActionLoading(ticketId);
    setActionError(null);
    try {
      const res = await fetch(`/api/platform/support/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Erreur ${res.status}`);
      }
      refetch();
    } catch (err: any) {
      setActionError(err.message || 'Erreur');
    } finally {
      setActionLoading(null);
    }
  }, [refetch]);

  const handleReply = useCallback(async (ticketId: string) => {
    if (!replyText.trim()) return;
    setActionLoading(ticketId);
    setActionError(null);
    try {
      const res = await fetch(`/api/platform/support/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Erreur ${res.status}`);
      }
      setReplyText('');
      setSelectedTicket(null);
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
        <h1 className="text-2xl font-bold text-slate-900">Support & Tickets</h1>
        <p className="text-slate-500">Tickets de support des écoles</p>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionError}</span>
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
                    {data.tickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{t.id}</td>
                        <td className="px-6 py-4 font-bold text-slate-900">{t.school}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{t.subject}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            t.priority === 'URGENT' ? 'bg-rose-100 text-rose-700' :
                            t.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' :
                            t.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>{t.priority}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            t.status === 'OPEN' ? 'bg-amber-100 text-amber-700' :
                            t.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                            t.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>{t.status.replace('_', ' ')}</span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-600">{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            {/* Reply button */}
                            <button
                              onClick={() => setSelectedTicket(selectedTicket === t.id ? null : t.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                              title="Répondre"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> Répondre
                            </button>
                            {/* Close/Resolve button */}
                            {t.status !== 'CLOSED' && t.status !== 'RESOLVED' && (
                              <button
                                onClick={() => handleUpdateStatus(t.id, 'RESOLVED')}
                                disabled={actionLoading === t.id}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition disabled:opacity-50"
                                title="Marquer résolu"
                              >
                                {actionLoading === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            {/* Close button */}
                            {t.status !== 'CLOSED' && (
                              <button
                                onClick={() => handleUpdateStatus(t.id, 'CLOSED')}
                                disabled={actionLoading === t.id}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-50 text-slate-500 hover:bg-slate-100 transition disabled:opacity-50"
                                title="Clôturer"
                              >
                                {actionLoading === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                          {/* Reply textarea */}
                          {selectedTicket === t.id && (
                            <div className="mt-2 space-y-2">
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Tapez votre réponse..."
                                rows={2}
                                className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500"
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleReply(t.id)}
                                  disabled={actionLoading === t.id || !replyText.trim()}
                                  className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {actionLoading === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Envoyer'}
                                </button>
                                <button
                                  onClick={() => { setSelectedTicket(null); setReplyText(''); }}
                                  className="px-2 py-1 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
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
