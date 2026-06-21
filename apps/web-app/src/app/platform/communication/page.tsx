'use client';

/**
 * ============================================================================
 * COMMUNICATION & EMAILS — Page back-office
 * ============================================================================
 *
 * Affiche les logs d'emails agrégés cross-tenant depuis
 *   GET /api/platform/communication/logs?page=&limit=&search=&category=&status=
 *
 * Fonctionnalités :
 *   - Barre de recherche (subject / recipient / recipientName / fromEmail)
 *   - Filtre par catégorie (RECRUTEMENT / PEDAGOGIE / FINANCE / ADMINISTRATIF /
 *     COMMUNICATION / SYSTEM)
 *   - Filtre par statut (PENDING / SENT / DELIVERED / BOUNCED / FAILED / OPENED /
 *     CLICKED)
 *   - Tableau : date, expéditeur, destinataire, sujet, catégorie, statut
 *   - Stats agrégées (total, par statut, par catégorie)
 *
 * Si l'endpoint backend n'est pas encore déployé (erreur 404 / 500), un message
 * d'information explique que les logs seront disponibles après le déploiement.
 *
 * Palette AH : blue-900 (titres), amber-500/600 (or, accents), red-600 (erreurs).
 * ============================================================================
 */

import { useState, useMemo } from 'react';
import {
  Search,
  AlertCircle,
  RefreshCw,
  Mail,
  Inbox,
  Filter,
  ServerCrash,
} from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '@/components/platform/PlatformStates';

interface EmailLog {
  id: string;
  date: string;
  from: string;
  fromName?: string | null;
  to: string;
  toName?: string | null;
  subject: string;
  category: string;
  subCategory?: string | null;
  module?: string | null;
  status: string;
  provider?: string | null;
  errorMessage?: string | null;
  sentAt?: string | null;
  tenantId: string;
  tenantName: string;
  tenantSlug?: string | null;
  threadId?: string | null;
}

interface CommunicationData {
  logs: EmailLog[];
  stats: {
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const CATEGORIES = [
  { value: 'ALL', label: 'Toutes catégories' },
  { value: 'RECRUTEMENT', label: 'Recrutement' },
  { value: 'PEDAGOGIE', label: 'Pédagogie' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'ADMINISTRATIF', label: 'Administratif' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'SYSTEM', label: 'Système' },
];

const STATUSES = [
  { value: 'ALL', label: 'Tous statuts' },
  { value: 'PENDING', label: 'En attente' },
  { value: 'SENT', label: 'Envoyé' },
  { value: 'DELIVERED', label: 'Livré' },
  { value: 'OPENED', label: 'Ouvert' },
  { value: 'CLICKED', label: 'Cliqué' },
  { value: 'BOUNCED', label: 'Rebond' },
  { value: 'FAILED', label: 'Échec' },
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'SENT':
    case 'DELIVERED':
      return 'bg-emerald-100 text-emerald-700';
    case 'OPENED':
    case 'CLICKED':
      return 'bg-sky-100 text-sky-700';
    case 'PENDING':
      return 'bg-amber-100 text-amber-700';
    case 'BOUNCED':
      return 'bg-orange-100 text-orange-700';
    case 'FAILED':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'En attente';
    case 'SENT':
      return 'Envoyé';
    case 'DELIVERED':
      return 'Livré';
    case 'OPENED':
      return 'Ouvert';
    case 'CLICKED':
      return 'Cliqué';
    case 'BOUNCED':
      return 'Rebond';
    case 'FAILED':
      return 'Échec';
    default:
      return status || '—';
  }
}

function categoryBadgeClass(category: string): string {
  switch (category) {
    case 'RECRUTEMENT':
      return 'bg-violet-100 text-violet-700';
    case 'PEDAGOGIE':
      return 'bg-sky-100 text-sky-700';
    case 'FINANCE':
      return 'bg-emerald-100 text-emerald-700';
    case 'ADMINISTRATIF':
      return 'bg-amber-100 text-amber-700';
    case 'COMMUNICATION':
      return 'bg-blue-100 text-blue-700';
    case 'SYSTEM':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function formatDate(iso: string): string {
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

export default function CommunicationPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const path = useMemo(() => {
    const params = new URLSearchParams({
      page: '1',
      limit: '100',
      category: categoryFilter,
      status: statusFilter,
    });
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    return `/communication/logs?${params.toString()}`;
  }, [searchTerm, categoryFilter, statusFilter]);

  const { data, loading, error, refetch } = usePlatformData<CommunicationData>(path);

  // Détection du cas "endpoint non déployé" : erreur 404 ou message explicite
  const endpointMissing = !loading && !!error && /404|not found|introuvable|cannot|invalid/i.test(error);

  const logs = data?.logs || [];

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Communication &amp; Emails</h1>
          <p className="text-slate-500">
            Logs d'emails agrégés sur tous les établissements
          </p>
        </div>
        <button
          onClick={refetch}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Rafraîchir
        </button>
      </div>

      {/* Stats banner */}
      {data?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Mail className="w-5 h-5" />}
            label="Total"
            value={String(data.stats.total)}
            accent="blue-900"
          />
          <StatCard
            icon={<Inbox className="w-5 h-5" />}
            label="Envoyés / Livrés"
            value={String(
              (data.stats.byStatus.SENT || 0) + (data.stats.byStatus.DELIVERED || 0),
            )}
            accent="emerald"
          />
          <StatCard
            icon={<Mail className="w-5 h-5" />}
            label="Ouverts"
            value={String(
              (data.stats.byStatus.OPENED || 0) + (data.stats.byStatus.CLICKED || 0),
            )}
            accent="sky"
          />
          <StatCard
            icon={<AlertCircle className="w-5 h-5" />}
            label="Échecs / Rebonds"
            value={String(
              (data.stats.byStatus.FAILED || 0) + (data.stats.byStatus.BOUNCED || 0),
            )}
            accent="red"
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher (sujet, destinataire, expéditeur)..."
            className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20"
            aria-label="Filtrer par catégorie"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20"
            aria-label="Filtrer par statut"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* States */}
      {loading ? (
        <PlatformLoading label="Chargement des logs…" />
      ) : endpointMissing ? (
        <EndpointNotDeployedState />
      ) : error ? (
        <PlatformError message={error} onRetry={refetch} />
      ) : logs.length === 0 ? (
        <PlatformEmpty
          title="Aucun log"
          description="Aucun email ne correspond à votre recherche. Ajustez les filtres ou réessayez plus tard."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 text-xs text-slate-500">
            {logs.length} log(s) affiché(s)
            {data?.pagination?.total != null && data.pagination.total > logs.length && (
              <span className="ml-1 text-slate-400">
                (sur {data.pagination.total} au total)
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">De</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">À</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Sujet</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Catégorie</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Établissement</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs text-slate-600 whitespace-nowrap">
                      {formatDate(log.date)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-700">
                      <div className="font-medium">{log.fromName || log.from}</div>
                      {log.fromName && (
                        <div className="text-slate-400 text-[10px]">{log.from}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-700">
                      <div className="font-medium">{log.toName || log.to}</div>
                      {log.toName && <div className="text-slate-400 text-[10px]">{log.to}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-900 max-w-xs">
                      <div className="truncate" title={log.subject}>
                        {log.subject}
                      </div>
                      {log.errorMessage && (
                        <div className="text-[10px] text-red-600 mt-0.5 truncate" title={log.errorMessage}>
                          ⚠ {log.errorMessage}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${categoryBadgeClass(
                          log.category,
                        )}`}
                      >
                        {log.category}
                      </span>
                      {log.subCategory && (
                        <div className="text-[10px] text-slate-400 mt-0.5">{log.subCategory}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-700">
                      {log.tenantName}
                      {log.tenantSlug && (
                        <div className="text-slate-400 text-[10px] font-mono">{log.tenantSlug}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${statusBadgeClass(
                          log.status,
                        )}`}
                      >
                        {statusLabel(log.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'emerald' | 'sky' | 'amber' | 'blue-900' | 'red';
}) {
  const accentMap = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    'blue-900': 'bg-blue-50 text-blue-900 border-blue-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  } as const;
  return (
    <div className={`p-4 rounded-2xl border ${accentMap[accent]}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center">
          {icon}
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      </div>
      <p className="mt-2 text-xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function EndpointNotDeployedState() {
  return (
    <div className="flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <ServerCrash className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-blue-900 mb-1">Communication &amp; Emails</h2>
        <p className="text-sm text-slate-500">
          Les logs de communication seront disponibles après le déploiement de l&apos;API.
        </p>
        <p className="text-xs text-slate-400 mt-3">
          Endpoint attendu : <code className="font-mono">GET /api/platform/communication/logs</code>
        </p>
      </div>
    </div>
  );
}
