'use client';

/**
 * SubscriptionBanner — Bandeau animé qui s'affiche quand l'abonnement est
 * en GRACE_PERIOD, SUSPENDED ou BLOCKED.
 *
 * - GRACE_PERIOD : bandeau orange "Votre abonnement a expiré. Vous avez X jours
 *   de grâce pour renouveler."
 * - SUSPENDED : bandeau rouge animé défilant "Abonnement suspendu — Mode lecture seule"
 *   + bouton "Renouveler"
 * - BLOCKED : n'affiche pas de bandeau (la page de blocage prend le relais)
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, Lock, Clock, ArrowRight, X } from 'lucide-react';
import Link from 'next/link';

interface SubscriptionBannerProps {
  tenantId?: string;
}

interface SubscriptionStatus {
  status: string;
  currentPeriodEnd?: string;
  gracePeriodEnd?: string;
  suspendedAt?: string;
  reactivationFee?: number;
}

export function SubscriptionBanner({ tenantId }: SubscriptionBannerProps) {
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/billing/subscription-status/${tenantId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.status && data.status !== 'NONE' && data.status !== 'ACTIVE' && data.status !== 'TRIALING') {
          setSubStatus(data);
        }
      })
      .catch(() => {});
  }, [tenantId]);

  if (!subStatus || dismissed) return null;

  // GRACE_PERIOD — bandeau orange
  if (subStatus.status === 'GRACE_PERIOD') {
    const daysLeft = subStatus.gracePeriodEnd
      ? Math.ceil((new Date(subStatus.gracePeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;
    return (
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 shadow-lg z-50 relative">
        <div className="flex items-center gap-2.5 text-sm font-bold">
          <Clock className="w-4 h-4 flex-shrink-0 animate-pulse" />
          <span>
            ⏰ Votre abonnement a expiré. Il vous reste{' '}
            <span className="underline">{daysLeft} jour{daysLeft > 1 ? 's' : ''}</span> de grâce pour renouveler.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/settings/billing"
            className="bg-white text-orange-600 px-3 py-1 rounded-lg text-xs font-black hover:scale-105 transition-transform whitespace-nowrap"
          >
            Renouveler <ArrowRight className="w-3 h-3 inline" />
          </Link>
          <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // SUSPENDED — bandeau rouge animé défilant
  if (subStatus.status === 'SUSPENDED') {
    const daysSinceSuspension = subStatus.suspendedAt
      ? Math.ceil((Date.now() - new Date(subStatus.suspendedAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const daysUntilBlock = 30 - daysSinceSuspension;

    return (
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 text-white relative overflow-hidden z-50">
        {/* Animation défilement */}
        <div className="flex whitespace-nowrap py-2.5 animate-[scroll_20s_linear_infinite]">
          <div className="flex items-center gap-8 px-4 text-sm font-bold">
            <span className="flex items-center gap-2">
              <Lock className="w-4 h-4 flex-shrink-0" />
              🔒 ABONNEMENT SUSPENDU — MODE LECTURE SEULE
            </span>
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Blocage dans {daysUntilBlock} jour{daysUntilBlock > 1 ? 's' : ''} sans renouvellement
            </span>
            <span className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              🔒 ABONNEMENT SUSPENDU — MODE LECTURE SEULE
            </span>
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Blocage dans {daysUntilBlock} jour{daysUntilBlock > 1 ? 's' : ''} sans renouvellement
            </span>
          </div>
        </div>
        {/* Bouton renouveler fixe à droite */}
        <div className="absolute top-0 right-0 bottom-0 bg-red-700/90 backdrop-blur-sm flex items-center pr-3 pl-6 shadow-lg">
          <Link
            href="/app/settings/billing"
            className="bg-white text-red-600 px-4 py-1.5 rounded-lg text-xs font-black hover:scale-105 transition-transform whitespace-nowrap flex items-center gap-1.5"
          >
            Renouveler maintenant <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <style jsx>{`
          @keyframes scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
        `}</style>
      </div>
    );
  }

  return null;
}
