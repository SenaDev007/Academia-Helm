'use client';

import React, { useState, useMemo } from 'react';
import {
  History as HistoryIcon,
  Search,
  Filter,
  Download,
  Smartphone,
  Mail,
  MessageSquare,
  Globe,
  CheckCircle2,
  XCircle,
  Eye,
  Calendar,
  AlertCircle,
  Clock,
  MailOpen,
  Reply,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useEmailLogs, useEmailLogStats, type EmailLog } from '@/hooks/useEmailLogs';

// ─── Helpers ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  RECRUTEMENT: 'Recrutement',
  PEDAGOGIE: 'Pédagogie',
  FINANCE: 'Finance',
  ADMINISTRATIF: 'Administratif',
  COMMUNICATION: 'Communication',
  SYSTEM: 'Système',
};

const CATEGORY_COLORS: Record<string, string> = {
  RECRUTEMENT: 'bg-blue-50 text-blue-700 border-blue-200',
  PEDAGOGIE: 'bg-purple-50 text-purple-700 border-purple-200',
  FINANCE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ADMINISTRATIF: 'bg-amber-50 text-amber-700 border-amber-200',
  COMMUNICATION: 'bg-pink-50 text-pink-700 border-pink-200',
  SYSTEM: 'bg-slate-100 text-slate-700 border-slate-300',
};

const SUB_CATEGORY_LABELS: Record<string, string> = {
  candidature_recue: 'Candidature reçue',
  entretien_planifie: 'Entretien programmé',
  test_planifie: 'Test programmé',
  resultat_entretien: 'Résultat entretien',
  resultat_test: 'Résultat test',
  embauche: 'Embauche',
  contrat_signe: 'Contrat signé',
  candidature_rejetee: 'Candidature rejetée',
};

function getStatusBadge(status: string) {
  switch (status) {
    case 'SENT':
      return (
        <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 w-fit">
          <CheckCircle2 size={10} /> Envoyé
        </span>
      );
    case 'DELIVERED':
      return (
        <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 w-fit">
          <CheckCircle2 size={10} /> Livré
        </span>
      );
    case 'OPENED':
      return (
        <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 w-fit">
          <MailOpen size={10} /> Ouvert
        </span>
      );
    case 'CLICKED':
      return (
        <span className="text-blue-700 bg-blue-100 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 w-fit">
          <Eye size={10} /> Cliqué
        </span>
      );
    case 'BOUNCED':
      return (
        <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 w-fit">
          <AlertCircle size={10} /> Rejeté
        </span>
      );
    case 'FAILED':
      return (
        <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 w-fit">
          <XCircle size={10} /> Échec
        </span>
      );
    case 'PENDING':
      return (
        <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 w-fit">
          <Clock size={10} /> En attente
        </span>
      );
    default:
      return (
        <span className="text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg text-[10px] font-bold">
          {status}
        </span>
      );
  }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Composant principal ─────────────────────────────────────────────────

export default function CommunicationHistoryPage() {
  // Filtres UI
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const pageSize = 25;

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Le tenantId est récupéré automatiquement depuis le cookie x-tenant-id
  // par le hook useEmailLogs (pas besoin de le passer ici)
  const { data, isLoading, error, refetch } = useEmailLogs({
    initialFilters: {
      page,
      pageSize,
      search: debouncedSearch || undefined,
      category: categoryFilter || undefined,
      status: statusFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    },
  });

  const { data: stats } = useEmailLogStats(dateFrom || undefined, dateTo || undefined);

  const logs = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 0;

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-6 bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-slate-200">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <HistoryIcon size={32} />
            </div>
            <div>
              <h3 className="text-3xl font-black tracking-tight">Traçabilité & Historique</h3>
              <p className="text-slate-400 font-medium">
                Archive complète et catégorisée de tous les emails envoyés par l'établissement.
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all"
          >
            <Download size={18} /> Actualiser
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total envoyés"
              value={stats.total}
              color="bg-slate-50 text-slate-700 border-slate-200"
            />
            <StatCard
              label="Taux d'ouverture"
              value={`${stats.openRate.toFixed(1)}%`}
              color="bg-blue-50 text-blue-700 border-blue-200"
            />
            <StatCard
              label="Taux de réponse"
              value={`${stats.replyRate.toFixed(1)}%`}
              color="bg-emerald-50 text-emerald-700 border-emerald-200"
            />
            <StatCard
              label="Taux de rejet"
              value={`${stats.bounceRate.toFixed(1)}%`}
              color="bg-rose-50 text-rose-700 border-rose-200"
            />
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher par destinataire, sujet, contenu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs"
            >
              <option value="">Toutes catégories</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs"
            >
              <option value="">Tous statuts</option>
              <option value="PENDING">En attente</option>
              <option value="SENT">Envoyé</option>
              <option value="DELIVERED">Livré</option>
              <option value="OPENED">Ouvert</option>
              <option value="CLICKED">Cliqué</option>
              <option value="BOUNCED">Rejeté</option>
              <option value="FAILED">Échec</option>
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 flex items-center justify-center gap-3 text-slate-400">
              <Loader2 className="animate-spin" size={24} />
              <span className="text-sm font-medium">Chargement de l'historique...</span>
            </div>
          ) : error ? (
            <div className="p-12 text-center text-rose-500">
              <p className="font-bold mb-2">Erreur de chargement</p>
              <p className="text-xs">{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Mail size={48} className="mx-auto mb-4 opacity-30" />
              <p className="font-bold mb-1">Aucun email dans l'historique</p>
              <p className="text-xs">
                Les emails envoyés par le système apparaîtront ici automatiquement.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-left border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Catégorie
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Destinataire
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Objet
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                        Statut
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Date
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                        Réponses
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-sm">
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLogId(log.id)}
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {log.category && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border w-fit ${
                                  CATEGORY_COLORS[log.category] || 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {CATEGORY_LABELS[log.category] || log.category}
                              </span>
                            )}
                            {log.subCategory && (
                              <span className="text-[10px] text-slate-400">
                                {SUB_CATEGORY_LABELS[log.subCategory] || log.subCategory}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-700 text-xs">
                            {log.recipientName || log.recipient}
                          </div>
                          <div className="text-[10px] text-slate-400">{log.recipient}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-xs font-medium max-w-md truncate">
                          {log.subject}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">{getStatusBadge(log.status)}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-400 text-[10px] font-mono">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {log._count?.replies > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                              <Reply size={10} /> {log._count.replies}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[10px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {total > 0
                    ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} sur ${total} emails`
                    : 'Aucun email'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-2 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-white transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold px-3">
                    Page {page} / {Math.max(1, totalPages)}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-2 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-white transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal détail (si sélectionné) */}
        {selectedLogId && (
          <EmailLogDetailModal
            logId={selectedLogId}
            onClose={() => setSelectedLogId(null)}
          />
        )}
      </div>
    </ModuleContentArea>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className={`p-4 rounded-2xl border ${color}`}>
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</div>
      <div className="text-2xl font-black mt-1">{value}</div>
    </div>
  );
}

function EmailLogDetailModal({
  logId,
  onClose,
}: {
  logId: string;
  onClose: () => void;
}) {
  const [log, setLog] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchLog = async () => {
      setIsLoading(true);
      try {
        // tenantId est automatiquement inclus via le cookie x-tenant-id par le proxy
        const res = await fetch(`/api/communication/email-logs/${logId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setLog(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLog();
  }, [logId]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex items-center justify-between">
          <h3 className="text-xl font-black">Détail de l'email</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <XCircle size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <Loader2 className="animate-spin mx-auto text-slate-400" size={32} />
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-500">
            <p className="text-sm">{error}</p>
          </div>
        ) : log ? (
          <div className="p-6 space-y-4">
            {/* En-tête */}
            <div className="space-y-1">
              <div className="text-xs text-slate-400">Sujet</div>
              <div className="text-lg font-bold text-slate-800">{log.subject}</div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Destinataire
                </div>
                <div className="font-bold text-slate-700">
                  {log.recipientName || log.recipient}
                </div>
                <div className="text-slate-500">{log.recipient}</div>
              </div>
              <div>
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Expéditeur
                </div>
                <div className="font-bold text-slate-700">{log.fromName || '—'}</div>
                <div className="text-slate-500">{log.fromEmail || '—'}</div>
              </div>
              <div>
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Catégorie
                </div>
                <div className="flex flex-wrap gap-2">
                  {log.category && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        CATEGORY_COLORS[log.category] || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {CATEGORY_LABELS[log.category] || log.category}
                    </span>
                  )}
                  {log.subCategory && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                      {SUB_CATEGORY_LABELS[log.subCategory] || log.subCategory}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Statut
                </div>
                {getStatusBadge(log.status)}
              </div>
              <div>
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Date d'envoi
                </div>
                <div className="font-mono text-slate-700">
                  {log.sentAt ? formatDate(log.sentAt) : 'En attente'}
                </div>
              </div>
              <div>
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Provider / ID
                </div>
                <div className="font-mono text-[10px] text-slate-500 break-all">
                  {log.provider || '—'} / {log.providerId || '—'}
                </div>
              </div>
              <div>
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Reply-to (tracking)
                </div>
                <div className="font-mono text-[10px] text-slate-500 break-all">
                  {log.replyTo || 'Désactivé'}
                </div>
              </div>
              <div>
                <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Thread ID
                </div>
                <div className="font-mono text-[10px] text-slate-500 break-all">
                  {log.threadId || '—'}
                </div>
              </div>
            </div>

            {/* Tracking events */}
            {(log.openCount > 0 || log.clickCount > 0 || log.deliveredAt || log.bouncedAt) && (
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Événements de tracking
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {log.deliveredAt && (
                    <div>
                      <div className="text-slate-400 text-[10px]">Livré le</div>
                      <div className="font-bold">{formatDate(log.deliveredAt)}</div>
                    </div>
                  )}
                  {log.openedAt && (
                    <div>
                      <div className="text-slate-400 text-[10px]">Ouvert le</div>
                      <div className="font-bold">{formatDate(log.openedAt)}</div>
                      <div className="text-[10px] text-slate-500">{log.openCount} fois</div>
                    </div>
                  )}
                  {log.clickedAt && (
                    <div>
                      <div className="text-slate-400 text-[10px]">Cliqué le</div>
                      <div className="font-bold">{formatDate(log.clickedAt)}</div>
                      <div className="text-[10px] text-slate-500">{log.clickCount} fois</div>
                    </div>
                  )}
                  {log.bouncedAt && (
                    <div>
                      <div className="text-rose-400 text-[10px]">Rejeté le</div>
                      <div className="font-bold text-rose-700">{formatDate(log.bouncedAt)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Erreur */}
            {log.errorMessage && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-1">
                  Message d'erreur
                </div>
                <div className="text-xs text-rose-700 font-mono">{log.errorMessage}</div>
              </div>
            )}

            {/* Contenu HTML rendu */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Contenu de l'email
              </div>
              <div
                className="border border-slate-200 rounded-xl overflow-hidden bg-white"
                style={{ maxHeight: '400px', overflowY: 'auto' }}
              >
                <iframe
                  srcDoc={log.content}
                  className="w-full"
                  style={{ minHeight: '300px', border: 'none' }}
                  sandbox="allow-same-origin"
                  title="Email content"
                />
              </div>
            </div>

            {/* Réponses reçues */}
            {log.replies && log.replies.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Réponses reçues ({log.replies.length})
                </div>
                <div className="space-y-2">
                  {log.replies.map((reply: any) => (
                    <div key={reply.id} className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-xs font-bold text-blue-700">
                          De: {reply.fromName || reply.fromEmail}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {formatDate(reply.receivedAt)}
                        </div>
                      </div>
                      <div className="text-xs text-slate-700 font-medium mb-1">{reply.subject}</div>
                      <div className="text-xs text-slate-600 whitespace-pre-wrap">
                        {reply.textContent || '(HTML seulement)'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
