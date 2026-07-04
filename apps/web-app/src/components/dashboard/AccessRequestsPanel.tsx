'use client';

/**
 * AccessRequestsPanel — Panneau de gestion des demandes d'accès PLATFORM_OWNER
 *
 * Affiché dans le dashboard du directeur/promoteur.
 * Permet d'approuver, refuser ou révoquer les demandes d'accès.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Check,
  X,
  Ban,
  Clock,
  Loader2,
  AlertCircle,
  User,
  Mail,
} from 'lucide-react';

interface AccessRequest {
  id: string;
  tenantId: string;
  platformOwnerId: string;
  portalType: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';
  requestedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  platformOwner: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  reviewer?: { firstName: string; lastName: string } | null;
}

const NAVY = '#0b2f73';
const GOLD = '#f5b335';

export default function AccessRequestsPanel() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/access-requests');
      if (!res.ok) throw new Error('Erreur lors du chargement');
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'revoke') => {
    setActionLoading(`${id}-${action}`);
    try {
      const res = await fetch(`/api/access-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Erreur');
      }
      // Recharger la liste
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { label: 'En attente', color: '#f59e0b', bg: '#fef3c7' };
      case 'APPROVED':
        return { label: 'Approuvé', color: '#16a34a', bg: '#dcfce7' };
      case 'REJECTED':
        return { label: 'Refusé', color: '#dc2626', bg: '#fee2e2' };
      case 'REVOKED':
        return { label: 'Révoqué', color: '#6b7280', bg: '#f3f4f6' };
      default:
        return { label: status, color: '#64748b', bg: '#f1f5f9' };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: NAVY }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="text-sm text-slate-500">Aucune demande d'accès pour le moment</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {requests.map((req) => {
          const badge = getStatusBadge(req.status);
          const isLoadingThis = actionLoading?.startsWith(req.id);

          return (
            <motion.div
              key={req.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                {/* User info */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: `${NAVY}10` }}
                  >
                    <User className="w-5 h-5" style={{ color: NAVY }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm" style={{ color: NAVY }}>
                      {req.platformOwner.firstName} {req.platformOwner.lastName}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" />
                      {req.platformOwner.email}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(req.requestedAt)}
                    </p>
                  </div>
                </div>

                {/* Status badge */}
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide flex-shrink-0"
                  style={{ background: badge.bg, color: badge.color }}
                >
                  {badge.label}
                </span>
              </div>

              {/* Actions */}
              {req.status === 'PENDING' && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleAction(req.id, 'approve')}
                    disabled={isLoadingThis}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 min-h-[36px]"
                    style={{ background: '#16a34a' }}
                  >
                    {isLoadingThis === `${req.id}-approve` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Approuver
                  </button>
                  <button
                    onClick={() => handleAction(req.id, 'reject')}
                    disabled={isLoadingThis}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 min-h-[36px]"
                    style={{ background: '#dc2626' }}
                  >
                    {isLoadingThis === `${req.id}-reject` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                    Refuser
                  </button>
                </div>
              )}

              {req.status === 'APPROVED' && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleAction(req.id, 'revoke')}
                    disabled={isLoadingThis}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 min-h-[36px]"
                  >
                    {isLoadingThis === `${req.id}-revoke` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Ban className="w-3.5 h-3.5" />
                    )}
                    Révoquer l'accès
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
