'use client';

/**
 * ============================================================================
 * ParentFinancePanel — Volet finances détaillé pour le parent
 * ============================================================================
 *
 * Affiche de façon transparente :
 *   1. Frais d'inscription ou de réinscription (selon enrollmentType)
 *   2. Frais de scolarité (avec personnalisation/override si applicable)
 *   3. Autres frais (cantine, examen, transport...)
 *   4. Réductions appliquées (motif, montant original → personnalisé)
 *   5. Arriérés par année scolaire (année + montant restant + total)
 *   6. Total dû, total payé, restant à payer
 *   7. Widget de paiement FedaPay avec MONTANT PERSONNALALISÉ
 *      (le parent saisit le montant qu'il veut payer, pas la totalité)
 *   8. Historique des transactions
 * ============================================================================
 */

import { useState } from 'react';
import {
  Wallet, Loader2, AlertCircle, CheckCircle2, Clock, FileText,
  TrendingDown, Info, CreditCard, ChevronDown, ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParentFinanceBreakdown } from '@/lib/query/parent-hooks';
import { useModuleContext } from '@/hooks/useModuleContext';
import { openFedaPayCheckout } from '@/lib/parent/fedapay-checkout';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ParentFinancePanelProps {
  studentId: string;
  studentFirstName?: string;
  studentLastName?: string;
  studentMatricule?: string;
}

const AH = {
  navy: '#0A2A5E',
  navyLight: '#103E91',
  gold: '#F5B335',
  emerald: '#10B981',
  red: '#EF4444',
  amber: '#F59E0B',
  gray: '#6B7280',
};

export default function ParentFinancePanel({
  studentId,
  studentFirstName,
  studentLastName,
  studentMatricule,
}: ParentFinancePanelProps) {
  const { academicYear } = useModuleContext();
  const { data: finance, isLoading, error, refetch } = useParentFinanceBreakdown(
    studentId,
    academicYear?.id,
  );

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showArrears, setShowArrears] = useState(false);

  const handlePay = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Veuillez saisir un montant valide');
      return;
    }

    if (!finance?.accountId) {
      toast.error('Compte élève introuvable');
      return;
    }

    if (amount > Number(finance.totals.balance)) {
      toast.error(`Le montant ne peut pas dépasser le restant à payer (${formatMoney(finance.totals.balance)})`);
      return;
    }

    setPaying(true);
    try {
      const result = await openFedaPayCheckout({
        amount,
        studentAccountId: finance.accountId,
        academicYearId: academicYear!.id,
        studentFirstName,
        studentLastName,
        studentMatricule,
      });

      if (result.success) {
        toast.success('Paiement confirmé', {
          description: `Reçu ${result.receiptNumber}`,
        });
        setPaymentAmount('');
        refetch();
      } else if (result.error) {
        toast.error('Paiement échoué', { description: result.error });
      }
    } catch (err: any) {
      toast.error('Erreur de paiement', { description: err.message });
    } finally {
      setPaying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: AH.navy }} />
        <span className="ml-3 text-sm text-gray-600">Chargement des informations financières…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-500" />
        <span className="text-sm text-red-700">
          Erreur lors du chargement des données financières.
        </span>
        <button onClick={() => refetch()} className="ml-auto text-xs text-red-600 underline">
          Réessayer
        </button>
      </div>
    );
  }

  if (!finance || !finance.hasAccount) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Aucune information financière disponible pour cet élève.</p>
      </div>
    );
  }

  const { breakdowns = [], feeArrears = [], transactions = [], totals, enrollmentType, isNewStudent } = finance;

  return (
    <div className="space-y-4">
      {/* ─── En-tête : type d'élève ─── */}
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: `linear-gradient(135deg, ${AH.navy}08, ${AH.navyLight}05)` }}
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: AH.navy, color: 'white' }}
        >
          <Info className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {isNewStudent ? 'Nouvel élève' : 'Ancien élève'}
          </p>
          <p className="text-xs text-gray-500">
            {isNewStudent
              ? "Frais d'inscription applicables (nouvelle inscription)"
              : 'Frais de réinscription applicables (élève existant)'}
          </p>
        </div>
      </div>

      {/* ─── Section 1 : Détail des frais ─── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <FileText className="w-4 h-4" style={{ color: AH.navy }} />
          <h3 className="font-semibold text-sm text-gray-900">Détail des frais</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {breakdowns.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Aucun frais configuré pour cette année scolaire.
            </div>
          ) : (
            breakdowns.map((b: any) => (
              <div key={b.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-900">{b.feeName}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
                        style={{
                          background: getFeeTypeColor(b.feeType, AH),
                          color: 'white',
                        }}
                      >
                        {b.feeTypeLabel}
                      </span>
                      {b.isMandatory && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                          Obligatoire
                        </span>
                      )}
                    </div>

                    {/* Personnalisation / Override */}
                    {b.hasOverride && (
                      <div
                        className="mt-2 rounded-lg p-2 flex items-start gap-2"
                        style={{ background: `${AH.gold}10`, border: `1px solid ${AH.gold}30` }}
                      >
                        <TrendingDown className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: AH.gold }} />
                        <div className="text-xs">
                          <p className="font-medium text-gray-700">
                            Personnalisation appliquée
                          </p>
                          <p className="text-gray-500">
                            Montant original : <span className="line-through">{formatMoney(b.originalAmount)}</span>
                            {' → '}
                            <span className="font-semibold" style={{ color: AH.gold }}>
                              {formatMoney(b.overrideAmount || b.adjustedAmount)}
                            </span>
                          </p>
                          {b.overrideReason && (
                            <p className="text-gray-500 mt-0.5">
                              <strong>Motif :</strong> {b.overrideReason}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Progression du paiement */}
                    {b.paidAmount > 0 && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (Number(b.paidAmount) / Number(b.adjustedAmount)) * 100)}%`,
                              background: AH.emerald,
                            }}
                          />
                        </div>
                        <span className="text-gray-500 whitespace-nowrap">
                          {formatMoney(b.paidAmount)} / {formatMoney(b.adjustedAmount)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Montant restant */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">Restant</p>
                    <p
                      className="font-bold text-sm"
                      style={{ color: Number(b.remainingAmount) > 0 ? AH.red : AH.emerald }}
                    >
                      {formatMoney(b.remainingAmount)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── Section 2 : Arriérés ─── */}
      {feeArrears.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
          <button
            onClick={() => setShowArrears(!showArrears)}
            className="w-full px-4 py-3 flex items-center gap-2 hover:bg-gray-50"
          >
            <AlertCircle className="w-4 h-4 text-red-500" />
            <h3 className="font-semibold text-sm text-gray-900 flex-1 text-left">
              Arriérés ({feeArrears.length} année{feeArrears.length > 1 ? 's' : ''})
            </h3>
            <span className="text-sm font-bold text-red-600">
              {formatMoney(finance.actualArrears)}
            </span>
            {showArrears ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          <AnimatePresence>
            {showArrears && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-red-100"
              >
                <div className="divide-y divide-red-50">
                  {feeArrears.map((a: any) => (
                    <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.academicYearName}</p>
                        <p className="text-xs text-gray-400">
                          dû : {formatMoney(a.totalDue)} · payé : {formatMoney(a.totalPaid)}
                        </p>
                        {a.notes && <p className="text-xs text-gray-400 mt-0.5">{a.notes}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Restant</p>
                        <p className="font-bold text-sm text-red-600">{formatMoney(a.balanceDue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-red-700">Total arriérés</span>
                  <span className="font-bold text-red-700">{formatMoney(finance.actualArrears)}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ─── Section 3 : Récapitulatif ─── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Wallet className="w-4 h-4" style={{ color: AH.navy }} />
          <h3 className="font-semibold text-sm text-gray-900">Récapitulatif</h3>
        </div>
        <div className="px-4 py-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total frais annuels</span>
            <span className="font-medium text-gray-900">{formatMoney(totals.totalDue)}</span>
          </div>
          {finance.actualArrears > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">+ Arriérés années précédentes</span>
              <span className="font-medium text-red-600">{formatMoney(finance.actualArrears)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">- Total payé</span>
            <span className="font-medium text-emerald-600">{formatMoney(totals.totalPaid)}</span>
          </div>
          <div className="border-t border-gray-100 pt-2 flex justify-between">
            <span className="font-semibold text-gray-900">Restant à payer</span>
            <span className="font-bold text-lg" style={{ color: AH.red }}>
              {formatMoney(totals.balance)}
            </span>
          </div>
          {totals.isBlocked && (
            <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-700">
                Le compte est bloqué. Contactez l'administration.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Section 4 : Paiement en ligne (montant personnalisé) ─── */}
      {Number(totals.balance) > 0 && (
        <div className="bg-white rounded-xl border-2 overflow-hidden" style={{ borderColor: AH.navy + '30' }}>
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ background: `linear-gradient(135deg, ${AH.navy}, ${AH.navyLight})` }}
          >
            <CreditCard className="w-4 h-4 text-white" />
            <h3 className="font-semibold text-sm text-white">Paiement en ligne</h3>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Montant à payer (FCFA)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={Number(totals.balance)}
                  step={1000}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder={String(Math.floor(Number(totals.balance)))}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setPaymentAmount(String(Math.floor(Number(totals.balance))))}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-600 hover:bg-gray-50"
                  title="Solder la totalité"
                >
                  Tout
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Saisissez le montant que vous souhaitez payer. Paiement sécurisé via FedaPay.
              </p>
            </div>

            {/* Aperçu allocation FIFO */}
            {paymentAmount && parseFloat(paymentAmount) > 0 && (
              <FifoPreview
                amount={parseFloat(paymentAmount)}
                breakdowns={breakdowns}
                arrears={feeArrears}
              />
            )}

            <button
              onClick={handlePay}
              disabled={paying || !paymentAmount || parseFloat(paymentAmount) <= 0}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: `linear-gradient(135deg, ${AH.navy}, ${AH.navyLight})` }}
            >
              {paying ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Traitement…
                </span>
              ) : (
                `Payer ${paymentAmount ? formatMoney(parseFloat(paymentAmount)) : ''}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* ─── Section 5 : Historique des paiements ─── */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-4 py-3 flex items-center gap-2 hover:bg-gray-50"
          >
            <Clock className="w-4 h-4" style={{ color: AH.navy }} />
            <h3 className="font-semibold text-sm text-gray-900 flex-1 text-left">
              Historique des paiements ({transactions.length})
            </h3>
            {showHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-gray-100"
              >
                <div className="divide-y divide-gray-50">
                  {transactions.map((t: any) => (
                    <div key={t.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: `${AH.emerald}15` }}
                        >
                          <CheckCircle2 className="w-4 h-4" style={{ color: AH.emerald }} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatMoney(t.amount)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {format(new Date(t.date), 'dd MMM yyyy', { locale: fr })} · {t.paymentMethod}
                          </p>
                        </div>
                      </div>
                      {t.receiptNumber && (
                        <span className="text-xs text-gray-400 font-mono">{t.receiptNumber}</span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ─── Sous-composant : Aperçu allocation FIFO ────────────────────────────────

function FifoPreview({ amount, breakdowns, arrears }: { amount: number; breakdowns: any[]; arrears: any[] }) {
  const priorityOrder = ['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'OTHER'];
  const sortedBreakdowns = [...breakdowns].sort((a, b) =>
    priorityOrder.indexOf(a.feeType) - priorityOrder.indexOf(b.feeType),
  );

  let remaining = amount;
  const allocations: Array<{ label: string; amount: number }> = [];

  // 1. Arriérés d'abord (plus ancien d'abord)
  for (const a of arrears) {
    if (remaining <= 0) break;
    const allocation = Math.min(remaining, Number(a.balanceDue));
    allocations.push({
      label: `Arriéré ${a.academicYearName}`,
      amount: allocation,
    });
    remaining -= allocation;
  }

  // 2. Frais par priorité
  for (const b of sortedBreakdowns) {
    if (remaining <= 0) break;
    const allocation = Math.min(remaining, Number(b.remainingAmount));
    if (allocation > 0) {
      allocations.push({
        label: b.feeName,
        amount: allocation,
      });
      remaining -= allocation;
    }
  }

  if (allocations.length === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
      <p className="text-xs font-medium text-blue-700 mb-1.5">Répartition du paiement :</p>
      <div className="space-y-1">
        {allocations.map((a, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-blue-600">{a.label}</span>
            <span className="font-medium text-blue-800">{formatMoney(a.amount)}</span>
          </div>
        ))}
        {remaining > 0 && (
          <div className="flex justify-between text-xs pt-1 border-t border-blue-200">
            <span className="text-gray-500">Excédent</span>
            <span className="font-medium text-gray-600">{formatMoney(remaining)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMoney(amount: number | string): string {
  const n = Number(amount) || 0;
  return n.toLocaleString('fr-FR') + ' FCFA';
}

function getFeeTypeColor(feeType: string, ah: any): string {
  switch (feeType) {
    case 'INSCRIPTION':
    case 'REINSCRIPTION':
      return ah.gold;
    case 'TUITION':
      return ah.navy;
    case 'CANTEEN':
      return '#8B5CF6';
    case 'EXAMEN':
      return '#EC4899';
    default:
      return ah.gray;
  }
}
