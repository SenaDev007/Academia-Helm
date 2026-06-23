'use client';

/**
 * Page de réactivation — /reactivate
 *
 * Affichée quand le compte est BLOQUED. L'utilisateur ne peut plus accéder
 * à /app/* — il est redirigé ici.
 *
 * Pour réactiver : paiement de 5 000 FCFA (FedaPay).
 */

import { useState, useEffect } from 'react';
import { Lock, AlertTriangle, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function ReactivatePage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [subStatus, setSubStatus] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Récupérer tenantId depuis le cookie
    const match = document.cookie.match(/x-tenant-id=([^;]+)/);
    if (match) {
      const tid = decodeURIComponent(match[1]);
      setTenantId(tid);
      fetch(`/api/billing/subscription-status/${tid}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then(setSubStatus)
        .catch(() => {});
    }
  }, []);

  const handleReactivate = async () => {
    if (!tenantId) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch(`/api/billing/reactivate/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference: 'react-' + Date.now() }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          window.location.href = '/app';
        }, 3000);
      } else {
        setError(data.message || 'Erreur lors de la réactivation');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-emerald-200 p-8 text-center">
          <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Compte réactivé !</h1>
          <p className="text-sm text-slate-600 mb-6">
            Votre compte a été réactivé avec succès. Vous allez être redirigé vers votre espace.
          </p>
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  const fee = subStatus?.reactivationFee || 5000;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1d3f] via-[#0b2f73] to-[#071d49] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-6">
          <Image
            src="/images/logo-Academia Hub.png"
            alt="Academia Helm"
            width={56}
            height={56}
            className="w-14 h-14 object-contain mx-auto"
          />
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Icône */}
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-2xl flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-red-600" strokeWidth={2.5} />
          </div>

          <h1 className="text-xl font-black text-slate-900 text-center mb-2">Compte bloqué</h1>
          <p className="text-sm text-slate-500 text-center mb-6">
            Votre abonnement Academia Helm a expiré et votre compte a été bloqué.
            Vos données sont préservées. Pour réactiver votre accès, veuillez régler les frais de réactivation.
          </p>

          {/* Frais */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-center">
            <p className="text-xs text-amber-600 font-bold uppercase tracking-wider mb-1">Frais de réactivation</p>
            <p className="text-3xl font-black text-amber-900">
              {fee.toLocaleString('fr-FR')} <span className="text-lg">FCFA</span>
            </p>
            <p className="text-xs text-amber-600 mt-1">Paiement unique — Accès immédiat</p>
          </div>

          {/* Info */}
          <div className="bg-slate-50 rounded-xl p-3 mb-6 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600">
              Après réactivation, vous devrez également renouveler votre abonnement mensuel ou annuel
              pour continuer à utiliser la plateforme.
            </p>
          </div>

          {/* Erreur */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* Bouton */}
          <button
            onClick={handleReactivate}
            disabled={isProcessing || !tenantId}
            className="w-full bg-[#0b2f73] text-white py-4 rounded-xl font-black text-sm hover:bg-[#144798] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Réactiver mon compte <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Footer */}
          <div className="mt-6 text-center">
            <Link href="/login" className="text-xs text-slate-400 hover:text-slate-600">
              ← Retour à la connexion
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-white/50 mt-6">
          Academia Helm — Vos données sont en sécurité
        </p>
      </div>
    </div>
  );
}
