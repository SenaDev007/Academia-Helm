'use client';

/**
 * ============================================================================
 * Demandes de déverrouillage — Page admin/direction
 * ============================================================================
 *
 * Affiche les demandes de déverrouillage de notes faites par les enseignants.
 * Le directeur/promoteur peut approuver ou rejeter chaque demande.
 *
 * Endpoint: GET /api/institutional-exams/evaluations/unlock-requests
 * Approve: PATCH /api/institutional-exams/evaluations/unlock-requests/:id/approve
 * Reject:  PATCH /api/institutional-exams/evaluations/unlock-requests/:id/reject
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Lock, Unlock, Check, X, Clock, User, RefreshCw,
  AlertCircle, Loader2, MessageSquare,
} from 'lucide-react';
import apiClient from '@/lib/api/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface UnlockRequest {
  id: string;
  evaluationId: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedById: string;
  requesterFirstName?: string;
  requesterLastName?: string;
  reviewedById?: string;
  reviewerFirstName?: string;
  reviewerLastName?: string;
  reviewComment?: string;
  reviewedAt?: string;
  createdAt: string;
  evaluationTypeName?: string;
  className?: string;
  subjectName?: string;
}

const STATUS_CONFIG = {
  PENDING: { label: 'En attente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  APPROVED: { label: 'Approuvée', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Check },
  REJECTED: { label: 'Rejetée', color: 'bg-red-100 text-red-700 border-red-200', icon: X },
};

export default function UnlockRequestsPage() {
  const [requests, setRequests] = useState<UnlockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'ALL' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState<Record<string, string>>({});

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(
        `/institutional-exams/evaluations/unlock-requests?status=${filter}`,
      );
      const data = res.data;
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erreur:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const comment = reviewComment[requestId];
      await apiClient.patch(
        `/institutional-exams/evaluations/unlock-requests/${requestId}/approve`,
        { reviewComment: comment || undefined },
      );
      toast.success('Demande approuvée', {
        description: 'L\'enseignant peut maintenant modifier les notes.',
      });
      setReviewComment({ ...reviewComment, [requestId]: '' });
      loadRequests();
    } catch (err: any) {
      toast.error('Erreur', { description: err.response?.data?.message || err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    const comment = reviewComment[requestId];
    if (!comment || comment.trim().length < 5) {
      toast.error('Veuillez saisir un motif de rejet');
      return;
    }
    setActionLoading(requestId);
    try {
      await apiClient.patch(
        `/institutional-exams/evaluations/unlock-requests/${requestId}/reject`,
        { reviewComment: comment },
      );
      toast.success('Demande rejetée');
      setReviewComment({ ...reviewComment, [requestId]: '' });
      loadRequests();
    } catch (err: any) {
      toast.error('Erreur', { description: err.response?.data?.message || err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Lock className="w-6 h-6 text-amber-600" />
            Demandes de déverrouillage
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {pendingCount > 0
              ? `${pendingCount} demande(s) en attente de validation`
              : 'Aucune demande en attente'}
          </p>
        </div>
        <button
          onClick={loadRequests}
          className="p-2 hover:bg-gray-100 rounded-lg"
          title="Rafraîchir"
        >
          <RefreshCw className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {(['PENDING', 'ALL', 'APPROVED', 'REJECTED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f === 'PENDING' ? 'En attente' :
             f === 'ALL' ? 'Toutes' :
             f === 'APPROVED' ? 'Approuvées' : 'Rejetées'}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Check className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucune demande dans cette catégorie</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const statusCfg = STATUS_CONFIG[req.status];
            const StatusIcon = statusCfg.icon;
            return (
              <div
                key={req.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                {/* En-tête carte */}
                <div className="px-4 py-3 flex items-start justify-between gap-3 border-b border-gray-100">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${statusCfg.color}`}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">
                          {req.evaluationTypeName || 'Évaluation'}
                        </span>
                        {req.className && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                            {req.className}
                          </span>
                        )}
                        {req.subjectName && (
                          <span className="text-xs px-2 py-0.5 rounded bg-purple-50 text-purple-700">
                            {req.subjectName}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded border ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                        <User className="w-3 h-3" />
                        Demandé par {req.requesterFirstName || ''} {req.requesterLastName || 'Enseignant'}
                        {' · '}
                        {format(new Date(req.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Motif de la demande */}
                <div className="px-4 py-3">
                  <div className="flex items-start gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500 mb-1">Motif de la demande</p>
                      <p className="text-sm text-gray-700">{req.reason}</p>
                    </div>
                  </div>

                  {/* Commentaire de review (si déjà traité) */}
                  {req.reviewComment && req.status !== 'PENDING' && (
                    <div className="mt-2 p-2 rounded-lg bg-gray-50">
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        Réponse de {req.reviewerFirstName || ''} {req.reviewerLastName || 'Administration'} :
                      </p>
                      <p className="text-sm text-gray-600">{req.reviewComment}</p>
                    </div>
                  )}

                  {/* Actions (si PENDING) */}
                  {req.status === 'PENDING' && (
                    <div className="mt-3 space-y-2">
                      <input
                        type="text"
                        value={reviewComment[req.id] || ''}
                        onChange={(e) => setReviewComment({ ...reviewComment, [req.id]: e.target.value })}
                        placeholder="Commentaire (optionnel pour approbation, obligatoire pour rejet)"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={actionLoading === req.id}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {actionLoading === req.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                          Approuver & Déverrouiller
                        </button>
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={actionLoading === req.id}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                          Rejeter
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
