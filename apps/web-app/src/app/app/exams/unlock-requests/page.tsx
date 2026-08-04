'use client';

/**
 * ============================================================================
 * MODULE EXAMENS — Demandes de déverrouillage
 * ============================================================================
 *
 * Affiche les demandes de déverrouillage de notes faites par les enseignants.
 * Le directeur/promoteur peut approuver ou rejeter chaque demande.
 *
 * S'intègre dans le ModuleContainer (même pattern que validation/page.tsx).
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Lock, Unlock, Check, X, Clock, User, Users, BookOpen, RefreshCw,
  AlertCircle, Loader2, MessageSquare, ShieldCheck,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules } from '../layout';
import apiClient from '@/lib/api/client';
import { toastSuccess, toastError } from '@/lib/toast/toast-helpers';
import { cn } from '@/lib/utils';
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
  studentIds?: string[];
  subjectIds?: string[];
  studentNames?: string;
  subjectNames?: string;
}

const STATUS_CONFIG = {
  PENDING: { label: 'En attente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  APPROVED: { label: 'Approuvée', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Check },
  REJECTED: { label: 'Rejetée', color: 'bg-red-100 text-red-700 border-red-200', icon: X },
};

export default function UnlockRequestsPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
  const [requests, setRequests] = useState<UnlockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'PENDING' | 'ALL' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState<Record<string, string>>({});

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      // ✅ Send schoolLevelId to filter by current level (maternelle/primaire/secondaire)
      const activeLevel = (availableLevels || []).find(
        (l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL'
      );
      const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;

      const params = new URLSearchParams({ status: filter });
      if (schoolLevelUuid) params.set('schoolLevelId', schoolLevelUuid);

      const res = await apiClient.get(
        `/institutional-exams/unlock-requests?${params.toString()}`,
      );
      const data = res.data;
      setRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Erreur:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [filter, scopeLevel, availableLevels]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId);
    try {
      const comment = reviewComment[requestId];
      await apiClient.patch(
        `/institutional-exams/unlock-requests/${requestId}/approve`,
        { reviewComment: comment || undefined },
      );
      toastSuccess('Demande approuvée', 'L\'enseignant peut maintenant modifier les notes.');
      setReviewComment({ ...reviewComment, [requestId]: '' });
      loadRequests();
    } catch (err: any) {
      toastError('Erreur', err.response?.data?.message || err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    const comment = reviewComment[requestId];
    if (!comment || comment.trim().length < 5) {
      toastError('Motif requis', 'Veuillez saisir un motif de rejet');
      return;
    }
    setActionLoading(requestId);
    try {
      await apiClient.patch(
        `/institutional-exams/unlock-requests/${requestId}/reject`,
        { reviewComment: comment },
      );
      toastSuccess('Demande rejetée', '');
      setReviewComment({ ...reviewComment, [requestId]: '' });
      loadRequests();
    } catch (err: any) {
      toastError('Erreur', err.response?.data?.message || err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'PENDING').length;

  // ✅ Group requests by className for better organization
  const groupedByClass = useMemo(() => {
    const groups: Record<string, UnlockRequest[]> = {};
    for (const req of requests) {
      const cn = req.className || 'Sans classe';
      if (!groups[cn]) groups[cn] = [];
      groups[cn].push(req);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [requests]);

  return (
    <ModuleContainer
      subModules={{ modules: scopedSubModules, activeModuleId: 'unlock-requests' }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-4">
            {/* En-tête + info */}
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
              <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-blue-900">Demandes de déverrouillage</h4>
                <p className="text-xs text-blue-700">
                  Lorsqu'un enseignant demande à modifier des notes déjà soumises, la demande apparaît ici.
                  Approuvez pour déverrouiller l'évaluation et permettre la correction.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={loadRequests} disabled={loading}>
                <RefreshCw className={cn('w-4 h-4 mr-1', loading && 'animate-spin')} />
                Actualiser
              </Button>
            </div>

            {/* Filtres */}
            <div className="flex gap-2">
              {(['PENDING', 'ALL', 'APPROVED', 'REJECTED'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  )}
                >
                  {f === 'PENDING' ? 'En attente' :
                   f === 'ALL' ? 'Toutes' :
                   f === 'APPROVED' ? 'Approuvées' : 'Rejetées'}
                </button>
              ))}
            </div>

            {/* Liste */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-3 text-sm text-gray-500">Chargement…</span>
              </div>
            ) : requests.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
                <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Aucune demande dans cette catégorie</p>
                <p className="text-sm text-gray-400 mt-1">
                  {filter === 'PENDING'
                    ? 'Les demandes de déverrouillage des enseignants apparaîtront ici.'
                    : 'Aucune demande avec ce statut.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedByClass.map(([className, classRequests]) => (
                  <div key={className} className="space-y-2">
                    {/* Class header */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-100">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-sm text-blue-900">{className}</span>
                      <Badge variant="outline" className="text-xs border-blue-200 text-blue-600">
                        {classRequests.length} demande{classRequests.length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    {/* Requests for this class */}
                    {classRequests.map((req) => {
                  const statusCfg = STATUS_CONFIG[req.status];
                  const StatusIcon = statusCfg.icon;
                  return (
                    <div
                      key={req.id}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
                    >
                      {/* En-tête carte */}
                      <div className="px-4 py-3 flex items-start justify-between gap-3 border-b border-gray-100">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', statusCfg.color)}>
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
                              <span className={cn('text-xs px-2 py-0.5 rounded border', statusCfg.color)}>
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

                      {/* Contenu de la demande */}
                      <div className="px-4 py-3">
                        {/* Élèves concernés */}
                        <div className="flex items-start gap-2 mb-2">
                          <Users className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-500 mb-0.5">Élèves concernés</p>
                            <p className="text-sm text-gray-700">
                              {req.studentNames || 'Tous les élèves'}
                              {req.studentIds && req.studentIds.length > 0 && (
                                <span className="text-xs text-gray-400 ml-1">({req.studentIds.length})</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Matières concernées */}
                        <div className="flex items-start gap-2 mb-3">
                          <BookOpen className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-500 mb-0.5">Matières concernées</p>
                            <p className="text-sm text-gray-700">
                              {req.subjectNames || req.subjectName || 'Toutes les matières'}
                            </p>
                          </div>
                        </div>

                        {/* Motif de la demande */}
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
                ))}
              </div>
            )}
          </div>
        ),
      }}
    />
  );
}
