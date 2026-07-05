'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2, ArrowLeft, CheckCircle2, Smartphone, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';

export default function ParentPayFeesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentInitiated, setPaymentInitiated] = useState<{ reference: string; amount: number } | null>(null);

  useEffect(() => {
    // TODO: Récupérer les enfants du parent connecté depuis l'API
    // Pour l'instant, on simule avec un fetch vers /api/portal/parent/children
    fetch('/api/portal/parent/children', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        setChildren(Array.isArray(data) ? data : []);
      })
      .catch(() => setChildren([]))
      .finally(() => setLoading(false));
  }, []);

  const selectedChild = children.find((c) => c.id === selectedChildId);
  const amountNum = parseFloat(amount);

  const handlePay = async () => {
    if (!selectedChildId || !amountNum || amountNum <= 0 || !phone.trim()) {
      toast({ title: 'Champs manquants', description: 'Sélectionnez un enfant, saisissez le montant et votre numéro.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/finance/payments/feexpay/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          studentAccountId: selectedChild?.studentAccountId,
          studentName: selectedChild ? `${selectedChild.firstName} ${selectedChild.lastName}` : 'Élève',
          amount: amountNum,
          phone: phone.trim(),
          academicYearId: selectedChild?.academicYearId,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setPaymentInitiated({ reference: data.reference, amount: amountNum });
        toast({
          title: '📱 Paiement initié',
          description: `Vous allez recevoir une notification sur le ${phone} pour confirmer le paiement.`,
        });
      } else {
        toast({ title: 'Erreur', description: data.message || 'Échec du paiement.', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Si le paiement est initié, afficher l'écran de confirmation
  if (paymentInitiated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <Smartphone className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Paiement initié !</h2>
          <p className="text-sm text-slate-600 mb-4">
            Une notification a été envoyée sur votre téléphone <strong>{phone}</strong>.
            Confirmez le paiement de <strong>{formatCurrency(paymentInitiated.amount)} FCFA</strong> sur votre téléphone.
          </p>
          <div className="bg-slate-50 rounded-lg p-3 mb-4">
            <p className="text-xs text-slate-500">Référence</p>
            <p className="font-mono text-sm font-bold text-indigo-600">{paymentInitiated.reference}</p>
          </div>
          <Button onClick={() => router.push('/portal/parent')} className="w-full bg-indigo-600 hover:bg-indigo-700">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            J'ai confirmé le paiement
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-6">
        <div className="max-w-md mx-auto">
          <button onClick={() => router.push('/portal/parent')} className="flex items-center gap-1 text-sm text-white/80 hover:text-white mb-3">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            Payer la scolarité
          </h1>
          <p className="text-sm text-white/80 mt-1">Payez en toute sécurité via Mobile Money</p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto p-6 space-y-5">
        {/* Sélection enfant */}
        <div>
          <Label className="text-sm font-semibold">Enfant</Label>
          {children.length === 0 ? (
            <div className="mt-2 p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
              <AlertCircle className="w-5 h-5 mx-auto text-amber-500 mb-2" />
              <p className="text-sm text-amber-800">Aucun enfant associé à votre compte. Contactez l'école.</p>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChildId(child.id)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedChildId === child.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{child.firstName} {child.lastName}</p>
                      <p className="text-xs text-slate-500">{child.className || '—'} · Solde : {formatCurrency(child.balance || 0)} FCFA</p>
                    </div>
                    {selectedChildId === child.id && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Montant */}
        <div>
          <Label className="text-sm font-semibold">Montant à payer (FCFA)</Label>
          <Input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="ex: 43000"
            className="mt-1 text-lg font-semibold"
          />
          {selectedChild && Number(selectedChild.balance) > 0 && (
            <button
              onClick={() => setAmount(String(selectedChild.balance))}
              className="text-xs text-indigo-600 hover:underline mt-1"
            >
              Solder le reste ({formatCurrency(selectedChild.balance)} FCFA)
            </button>
          )}
        </div>

        {/* Numéro de téléphone */}
        <div>
          <Label className="text-sm font-semibold">Votre numéro Mobile Money</Label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="ex: 0197123456"
            className="mt-1"
          />
          <p className="text-xs text-slate-500 mt-1">
            Vous recevrez une notification sur ce numéro pour confirmer le paiement.
            MTN, Moov, Celtiis sont supportés.
          </p>
        </div>

        {/* Info FeexPay */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Smartphone className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-800">
              Le paiement est traité par <strong>FeexPay</strong> (partenaire certifié).
              L'argent va directement sur le compte de l'école. Vos données sont sécurisées.
            </p>
          </div>
        </div>

        {/* Bouton payer */}
        <Button
          onClick={handlePay}
          disabled={submitting || !selectedChildId || !amountNum || !phone.trim()}
          className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-base font-bold py-3"
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Traitement...</>
          ) : (
            <><CreditCard className="w-5 h-5 mr-2" />Payer {amountNum ? formatCurrency(amountNum) + ' FCFA' : ''}</>
          )}
        </Button>
      </div>
    </div>
  );
}
