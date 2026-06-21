'use client';

/**
 * ============================================================================
 * REVIEWS MODERATION WORKSPACE
 * ============================================================================
 *
 * Back-office pour les administrateurs plateforme (admin.academiahelm.com).
 * Permet de modérer les avis déposés via le formulaire public (sans tenantId
 * → PENDING). Les avis déposés depuis l'app tenant sont auto-approuvés et
 * n'apparaissent pas dans la file de modération.
 *
 * Fonctions :
 *  - Vue d'ensemble : compteurs par statut (PENDING / APPROVED / REJECTED / ARCHIVED)
 *  - File de modération : liste des avis PENDING avec actions Approve / Reject
 *  - Vue globale : tous les avis avec filtre par statut + actions (feature / archive / delete)
 *  - Aucune donnée mock : tout vient de /api/platform/reviews/* → NestJS /platform/reviews/*
 * ============================================================================
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Star,
  CheckCircle2,
  XCircle,
  Archive,
  Trash2,
  Sparkles,
  RefreshCw,
  Filter,
  Clock,
  Building2,
  User,
  AlertCircle,
} from 'lucide-react';
import { usePlatformData } from '@/hooks/usePlatformData';
import { PlatformLoading, PlatformError, PlatformEmpty } from '../PlatformStates';
import ConfirmModal from '@/components/platform/ConfirmModal';

// ─── Types ──────────────────────────────────────────────────────────────────

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
type ReviewSource = 'IN_APP' | 'MANUAL' | 'IMPORT';

interface ReviewItem {
  id: string;
  authorName: string;
  authorRole?: string | null;
  schoolName: string;
  city?: string | null;
  photoUrl?: string | null;
  rating: number;
  comment: string;
  status?: ReviewStatus;
  featured?: boolean;
  source?: ReviewSource;
  createdAt: string;
  publishedAt?: string | null;
  tenantId?: string | null;
}

interface ReviewStats {
  PENDING: number;
  APPROVED: number;
  REJECTED: number;
  ARCHIVED: number;
  [key: string]: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: 'En attente',
  APPROVED: 'Approuvé',
  REJECTED: 'Rejeté',
  ARCHIVED: 'Archivé',
};

const STATUS_COLORS: Record<ReviewStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-100 text-rose-700 border-rose-200',
  ARCHIVED: 'bg-slate-100 text-slate-600 border-slate-200',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
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

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div
      className="flex shrink-0 gap-0.5"
      aria-label={`${rating} sur 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          fill={i < rating ? '#C9A84C' : 'none'}
          stroke={i < rating ? '#C9A84C' : '#CBD5E1'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ReviewsModerationWorkspace() {
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'ALL'>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const statsQ = usePlatformData<ReviewStats>('/reviews/stats');
  const pendingQ = usePlatformData<ReviewItem[]>('/reviews/pending');
  const allQ = usePlatformData<ReviewItem[]>(
    statusFilter === 'ALL' ? '/reviews/all' : `/reviews/all?status=${statusFilter}`,
  );

  // Refetch when reloadKey changes
  useEffect(() => {
    statsQ.refetch();
    if (tab === 'pending') pendingQ.refetch();
    else allQ.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const callApi = async (method: 'PATCH' | 'DELETE', path: string, body?: any) => {
    const res = await fetch(`/api/platform${path}`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.message || err?.error || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const handleAction = async (
    id: string,
    action: 'approve' | 'reject' | 'archive' | 'delete' | 'feature' | 'unfeature',
  ) => {
    setActionError(null);
    setActionLoading(`${id}:${action}`);
    try {
      if (action === 'delete') {
        await callApi('DELETE', `/reviews/${id}`);
      } else if (action === 'feature' || action === 'unfeature') {
        // Fetch current review to preserve status
        await callApi('PATCH', `/reviews/${id}/status`, {
          featured: action === 'feature',
        });
      } else {
        const status: ReviewStatus =
          action === 'approve' ? 'APPROVED' :
          action === 'reject' ? 'REJECTED' :
          'ARCHIVED';
        await callApi('PATCH', `/reviews/${id}/status`, { status });
      }
      reload();
    } catch (e: any) {
      setActionError(e?.message || 'Erreur lors de l\'action');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const stats = statsQ.data;
  const pending = pendingQ.data ?? [];
  const all = allQ.data ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-8 py-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600">
              <Star className="h-3.5 w-3.5" />
              Modération des avis
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              Avis & Témoignages
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Modérez les avis déposés depuis le formulaire public. Les avis
              déposés depuis l'application par les établissements sont
              automatiquement approuvés.
            </p>
          </div>
          <button
            onClick={reload}
            disabled={statsQ.loading || pendingQ.loading || allQ.loading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${statsQ.loading || pendingQ.loading || allQ.loading ? 'animate-spin' : ''}`}
            />
            Actualiser
          </button>
        </div>

        {/* Stats counters */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED'] as ReviewStatus[]).map((s) => (
            <div
              key={s}
              className={`rounded-xl border bg-white p-3.5 ${tab === 'pending' && s === 'PENDING' ? 'ring-2 ring-amber-300' : ''}`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {STATUS_LABELS[s]}
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {stats?.[s] ?? '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="px-8 py-6">
        {actionError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {actionError}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-5 flex items-center gap-2 border-b border-slate-200">
          <button
            onClick={() => setTab('pending')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === 'pending'
                ? 'border-b-2 border-indigo-600 text-indigo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="h-4 w-4" />
            File de modération
            {stats?.PENDING ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                {stats.PENDING}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => setTab('all')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === 'all'
                ? 'border-b-2 border-indigo-600 text-indigo-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Filter className="h-4 w-4" />
            Tous les avis
          </button>
        </div>

        {/* Status filter for "all" tab */}
        {tab === 'all' && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {s === 'ALL' ? 'Tous' : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {tab === 'pending' ? (
          pendingQ.loading ? (
            <PlatformLoading label="Chargement de la file de modération..." />
          ) : pendingQ.error ? (
            <PlatformError message={pendingQ.error} onRetry={pendingQ.refetch} />
          ) : pending.length === 0 ? (
            <PlatformEmpty
              title="Aucun avis en attente"
              description="Tous les avis déposés depuis le formulaire public ont été modérés. Les avis déposés depuis l'application par les établissements sont automatiquement approuvés."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pending.map((r) => (
                <PendingCard
                  key={r.id}
                  review={r}
                  onAction={(a) => handleAction(r.id, a)}
                  loading={actionLoading === `${r.id}:${actionLoading?.split(':')[1]}`}
                />
              ))}
            </div>
          )
        ) : allQ.loading ? (
          <PlatformLoading label="Chargement des avis..." />
        ) : allQ.error ? (
          <PlatformError message={allQ.error} onRetry={allQ.refetch} />
        ) : all.length === 0 ? (
          <PlatformEmpty
            title="Aucun avis"
            description={`Aucun avis avec le statut « ${statusFilter === 'ALL' ? 'Tous' : STATUS_LABELS[statusFilter as ReviewStatus]} ».`}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {all.map((r) => (
              <AllCard
                key={r.id}
                review={r}
                onAction={(a) => handleAction(r.id, a)}
                loading={!!actionLoading && actionLoading.startsWith(r.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cards ──────────────────────────────────────────────────────────────────

function ReviewCardBase({
  review,
  children,
}: {
  review: ReviewItem;
  children: React.ReactNode;
}) {
  const isSchoolReview = Boolean(review.tenantId);
  const promoterLine = [review.authorRole, review.schoolName, review.city]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {/* Avatar */}
          {review.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={review.photoUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-xs font-bold text-white">
              {review.authorName?.trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('') || '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="max-w-full truncate text-sm font-bold text-slate-900">
                {review.authorName}
              </p>
              {isSchoolReview ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                  <Building2 className="h-2.5 w-2.5" />
                  École
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                  <User className="h-2.5 w-2.5" />
                  Public
                </span>
              )}
            </div>
            <p
              className="mt-0.5 max-w-full whitespace-nowrap overflow-hidden text-ellipsis text-xs text-slate-500"
              title={promoterLine}
            >
              {promoterLine}
            </p>
          </div>
        </div>
        <Stars rating={review.rating} />
      </div>

      {/* Comment */}
      <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-700">
        “{review.comment}”
      </p>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span>{formatDate(review.createdAt)}</span>
        {review.featured && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            <Sparkles className="h-2.5 w-2.5" />
            Mis en avant
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

function PendingCard({
  review,
  onAction,
  loading,
}: {
  review: ReviewItem;
  onAction: (a: 'approve' | 'reject' | 'archive') => void;
  loading: boolean;
}) {
  return (
    <ReviewCardBase review={review}>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <button
          onClick={() => onAction('approve')}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Approuver
        </button>
        <button
          onClick={() => onAction('reject')}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          <XCircle className="h-3.5 w-3.5" />
          Rejeter
        </button>
        <button
          onClick={() => onAction('archive')}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-50"
        >
          <Archive className="h-3.5 w-3.5" />
          Archiver
        </button>
      </div>
    </ReviewCardBase>
  );
}

function AllCard({
  review,
  onAction,
  loading,
}: {
  review: ReviewItem;
  onAction: (
    a: 'approve' | 'reject' | 'archive' | 'delete' | 'feature' | 'unfeature',
  ) => void;
  loading: boolean;
}) {
  const status = review.status || 'PENDING';
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  return (
    <>
    <ReviewCardBase review={review}>
      {/* Status badge */}
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_COLORS[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
        {status !== 'APPROVED' && (
          <button
            onClick={() => onAction('approve')}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-3 w-3" />
            Approuver
          </button>
        )}
        {status !== 'REJECTED' && (
          <button
            onClick={() => onAction('reject')}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            <XCircle className="h-3 w-3" />
            Rejeter
          </button>
        )}
        {status !== 'ARCHIVED' && (
          <button
            onClick={() => onAction('archive')}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-50"
          >
            <Archive className="h-3 w-3" />
            Archiver
          </button>
        )}
        {review.featured ? (
          <button
            onClick={() => onAction('unfeature')}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3" />
            Retirer mis en avant
          </button>
        ) : (
          <button
            onClick={() => onAction('feature')}
            disabled={loading}
            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3" />
            Mettre en avant
          </button>
        )}
        <button
          onClick={() => {
            setConfirmModal({
              open: true,
              title: 'Supprimer cet avis',
              message: 'Supprimer définitivement cet avis ? Cette action est irréversible.',
              onConfirm: () => {
                setConfirmModal((prev) => ({ ...prev, open: false }));
                onAction('delete');
              },
            });
          }}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" />
          Supprimer
        </button>
      </div>
    </ReviewCardBase>

      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        confirmLabel="Supprimer"
        variant="danger"
      />
    </>
  );
}
