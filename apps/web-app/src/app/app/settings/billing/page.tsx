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
  Languages,
  X,
} from 'lucide-react';

// Helper: récupère le tenantId depuis le cookie `x-tenant-id`
function getTenantIdFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)x-tenant-id=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

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

interface BilingualStatus {
  enabled: boolean;
  billingCycle: string;
  monthlyAddon: number;
  yearlyAddon: number;
  subscriptionStatus: string;
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
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [bilingualStatus, setBilingualStatus] = useState<BilingualStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRenewing, setIsRenewing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // État pour la section bilingue
  const [bilingualModalOpen, setBilingualModalOpen] = useState(false);
  const [bilingualAction, setBilingualAction] = useState<'activate' | 'deactivate' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'MOBILE_MONEY' | 'CARD'>('MOBILE_MONEY');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isProcessingBilingual, setIsProcessingBilingual] = useState(false);
  const [bilingualMessage, setBilingualMessage] = useState<string | null>(null);

  useEffect(() => {
    const tid = getTenantIdFromCookie();
    setCurrentTenantId(tid);
    if (!tid) {
      setIsLoading(false);
      return;
    }
    Promise.all([
      fetch(`/api/billing/subscription-status/${tid}`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`/api/billing/bilingual-status/${tid}`, { cache: 'no-store' }).then((r) => r.json()),
    ])
      .then(([subData, bilingualData]) => {
        setSubStatus(subData);
        setBilingualStatus(bilingualData);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const refreshBilingualStatus = async () => {
    if (!currentTenantId) return;
    try {
      const res = await fetch(`/api/billing/bilingual-status/${currentTenantId}`, { cache: 'no-store' });
      const data = await res.json();
      setBilingualStatus(data);
    } catch {
      // ignore
    }
  };

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

  // Ouvrir la modal d'activation bilingue
  const handleOpenActivateBilingual = () => {
    setBilingualAction('activate');
    setBilingualMessage(null);
    setBilingualModalOpen(true);
  };

  // Ouvrir la modal de désactivation bilingue
  const handleOpenDeactivateBilingual = () => {
    setBilingualAction('deactivate');
    setBilingualMessage(null);
    setBilingualModalOpen(true);
  };

  // Confirmer l'activation bilingue avec paiement
  const handleConfirmBilingual = async () => {
    if (!currentTenantId) return;
    if (bilingualAction === 'activate' && paymentMethod === 'MOBILE_MONEY' && !phoneNumber) {
      setBilingualMessage('Numéro de téléphone requis pour Mobile Money');
      return;
    }
    if (bilingualAction === 'activate' && !customerEmail) {
      setBilingualMessage('Email client requis');
      return;
    }

    setIsProcessingBilingual(true);
    setBilingualMessage(null);

    try {
      if (bilingualAction === 'activate') {
        // 1. Initier le paiement
        const res = await fetch(`/api/billing/bilingual/activate/${currentTenantId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethod,
            phone: paymentMethod === 'MOBILE_MONEY' ? phoneNumber : undefined,
            customer: { email: customerEmail },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Erreur lors du paiement');
        }

        // 2. Si paiement carte → rediriger vers paymentUrl
        if (paymentMethod === 'CARD' && data.paymentUrl) {
          window.location.href = data.paymentUrl;
          return;
        }

        // 3. Si Mobile Money → confirmer immédiatement (simulé)
        // En production, le webhook FeexPay confirmera automatiquement
        const confirmRes = await fetch(`/api/billing/bilingual/confirm/${currentTenantId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: data.reference }),
        });
        const confirmData = await confirmRes.json();
        if (confirmData.success) {
          setBilingualMessage('✅ Option bilingue activée avec succès !');
          await refreshBilingualStatus();
          setTimeout(() => setBilingualModalOpen(false), 2000);
        } else {
          throw new Error(confirmData.message || 'Confirmation échouée');
        }
      } else if (bilingualAction === 'deactivate') {
        // Désactivation — pas de paiement
        const res = await fetch(`/api/billing/bilingual/deactivate/${currentTenantId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Désactivation volontaire depuis les paramètres' }),
        });
        const data = await res.json();
        if (data.success) {
          setBilingualMessage('✅ Option bilingue désactivée. La souscription bilingue est arrêtée.');
          await refreshBilingualStatus();
          setTimeout(() => setBilingualModalOpen(false), 2000);
        } else {
          throw new Error(data.message || 'Erreur lors de la désactivation');
        }
      }
    } catch (err: any) {
      setBilingualMessage(err.message);
    } finally {
      setIsProcessingBilingual(false);
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

      {/* Option bilingue */}
      {bilingualStatus && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Languages className="w-5 h-5 text-gold-600" />
                Option bilingue (Français + Anglais)
              </h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                bilingualStatus.enabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}>
                {bilingualStatus.enabled ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-slate-400 font-medium">Tarif mensuel</span>
                <p className="font-bold text-slate-700">
                  {bilingualStatus.monthlyAddon.toLocaleString('fr-FR')} FCFA / mois
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Tarif annuel</span>
                <p className="font-bold text-slate-700">
                  {bilingualStatus.yearlyAddon.toLocaleString('fr-FR')} FCFA / an
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              L'option bilingue active les parcours académiques en Français et en Anglais pour votre école.
              Les modules concernés (matières, classes, évaluations) pourront être configurés dans les deux langues.
              {bilingualStatus.enabled
                ? ' Désactivez à tout moment — la souscription s\'arrête immédiatement.'
                : ' Activez maintenant avec paiement sécurisé via FeexPay.'}
            </p>

            {bilingualStatus.enabled ? (
              <button
                onClick={handleOpenDeactivateBilingual}
                className="w-full sm:w-auto bg-rose-50 text-rose-700 border border-rose-200 px-6 py-3 rounded-xl font-bold text-sm hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Désactiver l'option bilingue
              </button>
            ) : (
              <button
                onClick={handleOpenActivateBilingual}
                disabled={bilingualStatus.subscriptionStatus === 'NONE'}
                className="w-full sm:w-auto bg-gold-600 text-blue-900 px-6 py-3 rounded-xl font-bold text-sm hover:bg-gold-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
              >
                <Languages className="w-4 h-4" />
                Activer l'option bilingue
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {bilingualStatus.subscriptionStatus === 'NONE' && (
              <p className="text-xs text-amber-600 mt-2">
                Souscrivez d'abord à un plan d'abonnement pour activer l'option bilingue.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modal bilingue */}
      {bilingualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Languages className="w-5 h-5 text-gold-600" />
                {bilingualAction === 'activate' ? 'Activer l\'option bilingue' : 'Désactiver l\'option bilingue'}
              </h3>
              <button
                onClick={() => setBilingualModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bilingualAction === 'activate' && bilingualStatus && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <p className="text-sm text-slate-700">
                    Vous allez activer l'option bilingue pour{' '}
                    <strong>
                      {(bilingualStatus.billingCycle === 'YEARLY'
                        ? bilingualStatus.yearlyAddon
                        : bilingualStatus.monthlyAddon
                      ).toLocaleString('fr-FR')} FCFA
                    </strong>{' '}
                    {bilingualStatus.billingCycle === 'YEARLY' ? '/ an' : '/ mois'}.
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Cycle de facturation actuel : {bilingualStatus.billingCycle === 'YEARLY' ? 'Annuel' : 'Mensuel'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Méthode de paiement</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('MOBILE_MONEY')}
                      className={`p-3 border-2 rounded-xl text-sm font-semibold transition-all ${
                        paymentMethod === 'MOBILE_MONEY'
                          ? 'border-gold-600 bg-gold-50 text-blue-900'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      Mobile Money
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('CARD')}
                      className={`p-3 border-2 rounded-xl text-sm font-semibold transition-all ${
                        paymentMethod === 'CARD'
                          ? 'border-gold-600 bg-gold-50 text-blue-900'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      Carte bancaire
                    </button>
                  </div>
                </div>

                {paymentMethod === 'MOBILE_MONEY' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Numéro de téléphone <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="ex: 229XXXXXXXX"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-gold-500 focus:border-gold-500 text-sm"
                  />
                </div>
              </div>
            )}

            {bilingualAction === 'deactivate' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-slate-700">
                  Vous allez désactiver l'option bilingue. La souscription bilingue s'arrêtera immédiatement.
                  Les parcours académiques en Anglais seront masqués (mais les données existantes seront préservées).
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Aucun remboursement ne sera effectué pour le cycle en cours.
                </p>
              </div>
            )}

            {bilingualMessage && (
              <div className={`mt-4 p-3 rounded-xl text-sm font-medium ${
                bilingualMessage.startsWith('✅')
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}>
                {bilingualMessage}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setBilingualModalOpen(false)}
                disabled={isProcessingBilingual}
                className="flex-1 bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmBilingual}
                disabled={isProcessingBilingual}
                className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                  bilingualAction === 'activate'
                    ? 'bg-gold-600 text-blue-900 hover:bg-gold-500'
                    : 'bg-rose-600 text-white hover:bg-rose-500'
                }`}
              >
                {isProcessingBilingual ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : bilingualAction === 'activate' ? (
                  <>
                    <Zap className="w-4 h-4" />
                    Payer et activer
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    Confirmer la désactivation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
