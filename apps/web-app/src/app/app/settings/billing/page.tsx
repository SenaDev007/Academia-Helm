/**
 * Page Facturation & Abonnement
 *
 * Route : /app/settings/billing
 *
 * Affiche :
 *   - Le statut d'abonnement actuel (ACTIVE, GRACE_PERIOD, SUSPENDED, BLOCKED)
 *   - Le plan, la date d'expiration, le montant
 *   - Un bouton "Renouveler" qui initie le paiement (FedaPay)
 *   - L'historique de facturation
 */

'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Clock,
  Loader2,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { useTenantContext } from '@/components/context/TenantContext';

interface SubscriptionStatus {
  status: string;
  currentPeriodEnd?: string;
  plan?: string;
  billingCycle?: string;
  expiredAt?: string;
  gracePeriodEnd?: string;
  suspendedAt?: string;
  blockedAt?: string;
  reactivationFee?: number;
}

function formatDate(date?: string): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: 'Actif',
    TRIALING: 'Période d\'essai',
    GRACE_PERIOD: 'Période de grâce',
    SUSPENDED: 'Suspendu',
    BLOCKED: 'Bloqué',
    CANCELLED: 'Annulé',
    NONE: 'Aucun abonnement',
  };
  return labels[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    TRIALING: 'bg-blue-50 text-blue-700 border-blue-200',
    GRACE_PERIOD: 'bg-amber-50 text-amber-700 border-amber-200',
    SUSPENDED: 'bg-rose-50 text-rose-700 border-rose-200',
    BLOCKED: 'bg-red-50 text-red-700 border-red-200',
    CANCELLED: 'bg-slate-50 text-slate-700 border-slate-200',
    NONE: 'bg-slate-50 text-slate-500 border-slate-200',
  };
  return colors[status] || 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function BillingPage() {
  const { currentTenantId } = useTenantContext() as any;
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRenewing, setIsRenewing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTenantId) return;
    fetch(`/api/billing/subscription-status/${currentTenantId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        setSubStatus(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [currentTenantId]);

  const handleRenew = async () => {
    setIsRenewing(true);
    setMessage(null);
    try {
      // TODO: intégrer FedaPay pour le paiement réel
      // Pour l'instant, simulation de paiement
      const res = await fetch(`/api/billing/renew/${currentTenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 19900, paymentReference: 'sim-' + Date.now() }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ Abonnement renouvelé avec succès !');
        // Recharger le statut
        fetch(`/api/billing/subscription-status/${currentTenantId}`, { cache: 'no-store' })
          .then((r) => r.json())
          .then(setSubStatus);
      } else {
        setMessage(data.message || 'Erreur lors du renouvellement');
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setIsRenewing(false);
    }
  };

  const handleReactivate = async () => {
    setIsRenewing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/billing/reactivate/${currentTenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference: 'react-' + Date.now() }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('✅ Compte réactivé avec succès !');
        fetch(`/api/billing/subscription-status/${currentTenantId}`, { cache: 'no-store' })
          .then((r) => r.json())
          .then(setSubStatus);
      } else {
        setMessage(data.message || 'Erreur lors de la réactivation');
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setIsRenewing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const status = subStatus?.status || 'NONE';
  const isBlocked = status === 'BLOCKED';
  const needsRenewal = ['GRACE_PERIOD', 'SUSPENDED', 'BLOCKED', 'NONE'].includes(status);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-blue-600" />
          Facturation & Abonnement
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Gérez votre abonnement Academia Helm et consultez votre historique de facturation.
        </p>
      </div>

      {/* Statut d'abonnement */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800">Statut de l'abonnement</h2>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(status)}`}>
              {getStatusLabel(status)}
            </span>
          </div>

          {status !== 'NONE' && subStatus && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400 font-medium">Plan</span>
                <p className="font-bold text-slate-700">{subStatus.plan || '—'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Cycle de facturation</span>
                <p className="font-bold text-slate-700">{subStatus.billingCycle === 'ANNUAL' ? 'Annuel' : 'Mensuel'}</p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Expire le</span>
                <p className="font-bold text-slate-700">{formatDate(subStatus.currentPeriodEnd)}</p>
              </div>
              {subStatus.expiredAt && (
                <div>
                  <span className="text-slate-400 font-medium">Expiré le</span>
                  <p className="font-bold text-amber-600">{formatDate(subStatus.expiredAt)}</p>
                </div>
              )}
              {subStatus.gracePeriodEnd && (
                <div>
                  <span className="text-slate-400 font-medium">Fin de grâce</span>
                  <p className="font-bold text-amber-600">{formatDate(subStatus.gracePeriodEnd)}</p>
                </div>
              )}
              {subStatus.suspendedAt && (
                <div>
                  <span className="text-slate-400 font-medium">Suspendu le</span>
                  <p className="font-bold text-rose-600">{formatDate(subStatus.suspendedAt)}</p>
                </div>
              )}
              {subStatus.blockedAt && (
                <div>
                  <span className="text-slate-400 font-medium">Bloqué le</span>
                  <p className="font-bold text-red-600">{formatDate(subStatus.blockedAt)}</p>
                </div>
              )}
            </div>
          )}

          {status === 'NONE' && (
            <p className="text-sm text-slate-500">
              Aucun abonnement actif. Souscrivez à un plan pour commencer à utiliser Academia Helm.
            </p>
          )}
        </div>

        {/* Actions */}
        {needsRenewal && (
          <div className="border-t border-slate-100 p-6 bg-slate-50">
            {message && (
              <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${
                message.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}>
                {message}
              </div>
            )}

            {isBlocked ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">Compte bloqué</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Votre compte a été bloqué. Pour le réactiver, des frais de{' '}
                      <strong>{(subStatus?.reactivationFee || 5000).toLocaleString('fr-FR')} FCFA</strong> sont applicables.
                      Vos données sont préservées.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReactivate}
                  disabled={isRenewing}
                  className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRenewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Réactiver mon compte ({(subStatus?.reactivationFee || 5000).toLocaleString('fr-FR')} FCFA)
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {status === 'GRACE_PERIOD' ? 'Abonnement expiré — Période de grâce' : 'Abonnement suspendu'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Renouvelez maintenant pour retrouver un accès complet à tous les modules.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRenew}
                  disabled={isRenewing}
                  className="w-full sm:w-auto bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRenewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Renouveler mon abonnement <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {status === 'ACTIVE' && (
          <div className="border-t border-slate-100 p-6 bg-emerald-50">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <p className="text-sm font-bold text-emerald-700">
                Votre abonnement est actif jusqu'au {formatDate(subStatus?.currentPeriodEnd)}.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
