'use client';

/**
 * FeexPayCheckout — Composant de paiement FeexPay
 *
 * Remplace FedaPayCheckout. Permet à l'utilisateur de payer via :
 *   - Mobile Money (MTN, Moov, Orange) — notification sur le téléphone
 *   - Carte bancaire (Visa, Mastercard) — redirect vers la page de paiement
 *
 * Props :
 *   - amount: montant en FCFA
 *   - email: email du client
 *   - firstName, lastName: nom du client
 *   - phoneNumber: numéro de téléphone (pour Mobile Money)
 *   - description: description du paiement
 *   - metadata: données supplémentaires (type, tenantId, etc.)
 *   - onSuccess: callback en cas de succès
 *   - onError: callback en cas d'erreur
 */

import { useState } from 'react';
import { Loader2, CreditCard, Smartphone, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

interface FeexPayCheckoutProps {
  amount: number;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  description?: string;
  metadata?: Record<string, any>;
  onSuccess?: (reference: string) => void;
  onError?: (error: string) => void;
}

type PaymentMethod = 'MOBILE_MONEY' | 'CARD';
type Operator = 'MTN' | 'MOOV' | 'ORANGE';

export default function FeexPayCheckout({
  amount,
  email,
  firstName,
  lastName,
  phoneNumber,
  description,
  metadata,
  onSuccess,
  onError,
}: FeexPayCheckoutProps) {
  const [method, setMethod] = useState<PaymentMethod>('MOBILE_MONEY');
  const [operator, setOperator] = useState<Operator>('MTN');
  const [phone, setPhone] = useState(phoneNumber || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const formatAmount = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA';

  const handlePay = async () => {
    if (method === 'MOBILE_MONEY' && !phone) {
      setMessage('Veuillez saisir votre numéro de téléphone');
      return;
    }

    setIsProcessing(true);
    setStatus('pending');
    setMessage(null);

    try {
      const response = await fetch('/api/billing/feexpay/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          method,
          phoneNumber: method === 'MOBILE_MONEY' ? phone : undefined,
          operator: method === 'MOBILE_MONEY' ? operator : undefined,
          email,
          firstName,
          lastName,
          description,
          metadata,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setReference(data.reference || null);
        if (method === 'CARD' && data.paymentUrl) {
          // Pour la carte : rediriger vers la page de paiement
          window.location.href = data.paymentUrl;
        } else {
          // Pour Mobile Money : la notification arrive sur le téléphone
          setMessage('📱 Une notification de paiement a été envoyée sur votre téléphone. Veuillez confirmer le paiement.');
          setStatus('pending');
          // Polling du statut pendant 2 minutes
          if (data.reference) {
            pollStatus(data.reference);
          }
        }
      } else {
        setStatus('error');
        setMessage(data.message || 'Erreur lors de l\'initialisation du paiement');
        onError?.(data.message || 'Erreur');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message);
      onError?.(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const pollStatus = async (ref: string) => {
    let attempts = 0;
    const maxAttempts = 24; // 2 minutes (5s × 24)
    const interval = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setStatus('idle');
        setMessage('Le délai d\'attente est dépassé. Veuillez vérifier votre téléphone ou réessayer.');
        return;
      }

      try {
        const response = await fetch(`/api/billing/feexpay/status/${ref}`);
        const data = await response.json();
        if (data.status === 'SUCCESSFUL') {
          clearInterval(interval);
          setStatus('success');
          setMessage('✅ Paiement réussi !');
          onSuccess?.(ref);
        } else if (data.status === 'FAILED') {
          clearInterval(interval);
          setStatus('error');
          setMessage('❌ Paiement échoué. Veuillez réessayer.');
          onError?.('Paiement échoué');
        }
      } catch {
        // Ignorer les erreurs de polling
      }
    }, 5000);
  };

  if (status === 'success') {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Paiement réussi !</h3>
        <p className="text-sm text-slate-500">
          {message}
        </p>
        {reference && (
          <p className="text-xs text-slate-400 mt-2">Référence : {reference}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Montant */}
      <div className="bg-slate-50 rounded-xl p-4 text-center">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Montant à payer</p>
        <p className="text-3xl font-black text-blue-900 mt-1">{formatAmount(amount)}</p>
        {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-xl text-sm flex items-start gap-2 ${
          status === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {status === 'error' ? <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <Loader2 className="w-4 h-4 flex-shrink-0 mt-0.5 animate-spin" />}
          <span>{message}</span>
        </div>
      )}

      {/* Choix du mode de paiement */}
      {status !== 'pending' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMethod('MOBILE_MONEY')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                method === 'MOBILE_MONEY'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Smartphone className={`w-6 h-6 ${method === 'MOBILE_MONEY' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className={`text-sm font-bold ${method === 'MOBILE_MONEY' ? 'text-blue-900' : 'text-slate-500'}`}>
                Mobile Money
              </span>
            </button>
            <button
              onClick={() => setMethod('CARD')}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                method === 'CARD'
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <CreditCard className={`w-6 h-6 ${method === 'CARD' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className={`text-sm font-bold ${method === 'CARD' ? 'text-blue-900' : 'text-slate-500'}`}>
                Carte bancaire
              </span>
            </button>
          </div>

          {/* Mobile Money : choix opérateur + numéro */}
          {method === 'MOBILE_MONEY' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Opérateur</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['MTN', 'MOOV', 'ORANGE'] as Operator[]).map((op) => (
                    <button
                      key={op}
                      onClick={() => setOperator(op)}
                      className={`py-2 rounded-lg text-sm font-bold transition-all ${
                        operator === op
                          ? op === 'MTN' ? 'bg-yellow-400 text-black' : op === 'MOOV' ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Numéro de téléphone</label>
                <input
                  type="tel"
                  placeholder="ex: 2290161231487"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Vous recevrez une notification sur ce numéro pour confirmer le paiement.
                </p>
              </div>
            </div>
          )}

          {/* Bouton payer */}
          <button
            onClick={handlePay}
            disabled={isProcessing || (method === 'MOBILE_MONEY' && !phone)}
            className="w-full bg-gradient-to-r from-gold-600 to-gold-500 text-blue-900 py-4 rounded-xl font-bold text-base hover:from-gold-500 hover:to-gold-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            {isProcessing ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Traitement...</>
            ) : (
              <>Payer {formatAmount(amount)} <ArrowRight className="w-5 h-5" /></>
            )}
          </button>
        </>
      )}

      {/* Pending : spinner */}
      {status === 'pending' && !message && (
        <div className="text-center py-8">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-600">Traitement du paiement...</p>
        </div>
      )}
    </div>
  );
}
