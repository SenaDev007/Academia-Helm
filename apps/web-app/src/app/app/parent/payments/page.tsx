"use client";

/**
 * ============================================================================
 * PORTAIL PARENT — Paiements [/app/parent/payments]
 * ============================================================================
 *
 * ⚠️ IMPORTANT — Alignement avec module Finance admin :
 *
 * Cette page utilise EXACTEMENT le même workflow que l'onglet "Encaissements"
 * du module Finance admin :
 *   - Solde : financeService.getStudentAccountDetails(studentAccountId)
 *     → account.totalDue / totalPaid / balance / status / breakdowns
 *   - Historique : account.transactions (50 dernières FinanceTransaction)
 *     → affiché via le composant partagé <ParentPaymentHistory />
 *   - Reçu PDF : GET /api/finance/transactions/:id/receipt.pdf (Puppeteer backend)
 *     → SAME PDF que admin (avec QR code, imputations, arriérés, multi-action)
 *   - Paiement FedaPay : openFedaPayCheckout() → POST /api/finance/transactions
 *     → SAME endpoint que admin
 *   - Post-paiement : bandeau succès <PaymentSuccessBanner /> (same que admin)
 *
 * Aucune divergence avec l'admin : mêmes données, mêmes reçus, mêmes actions.
 * Quand l'école encaisse via Module Finance, le parent voit la transaction
 * ici en temps réel (et inversement).
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import {
  CreditCard, Loader2, CheckCircle2, Clock,
  TrendingUp, TrendingDown, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { financeService } from "@/services/finance.service";
import { openFedaPayCheckout } from "@/lib/parent/fedapay-checkout";
import { ParentPaymentHistory } from "@/components/parent/ParentPaymentHistory";
import { PaymentSuccessBanner } from "@/components/parent/PaymentSuccessBanner";

interface LastReceipt {
  transactionId: string;
  receiptNumber?: string;
  createdAt?: string;
}

export default function ParentPaymentsPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<LastReceipt | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string>("");

  // Charger les enfants d'abord (pour récupérer le studentAccountId)
  const [children, setChildren] = useState<any[]>([]);

  useEffect(() => {
    if (!academicYear?.id || !user?.id) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/parent/children?parentId=${user.id}&academicYearId=${academicYear.id}`,
          { credentials: "include" }
        );
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setChildren(list);
        if (list.length > 0) setSelectedStudent(list[0].id);
      } catch {
        setChildren([]);
      }
    })();
  }, [user?.id, academicYear?.id]);

  // Trouver l'enfant sélectionné pour récupérer le studentAccountId
  const selectedChild = children.find((c) => c.id === selectedStudent);
  const studentAccountId = selectedChild?.account?.id;

  // ── Charger le compte élève + transactions (même endpoint que admin) ──
  const loadAccount = useCallback(async () => {
    if (!studentAccountId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // ⭐ Même appel que StudentAccountsContent.tsx (admin)
      const acc = await financeService.getStudentAccountDetails(studentAccountId);
      setAccount(acc);
    } catch (err: any) {
      console.error("loadAccount error:", err);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [studentAccountId]);

  useEffect(() => {
    if (studentAccountId) loadAccount();
  }, [loadAccount, studentAccountId]);

  const formatXOF = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "0 FCFA";
    return new Intl.NumberFormat("fr-FR").format(num) + " FCFA";
  };

  // ── Lancer le paiement FedaPay (même flux que admin) ──
  const handlePayNow = async () => {
    if (!studentAccountId) {
      toast.error("Compte élève introuvable", {
        description: "Impossible de déterminer le compte à débiter. Contactez l'administration.",
      });
      return;
    }
    if (!academicYear?.id) {
      toast.error("Année scolaire introuvable");
      return;
    }
    const balance = Number(account?.balance ?? 0);
    if (balance <= 0) {
      toast.info("Scolarité déjà à jour");
      return;
    }

    setPaying(true);
    try {
      const result = await openFedaPayCheckout({
        amount: balance,
        studentAccountId,
        academicYearId: academicYear.id,
        studentFirstName: selectedChild?.firstName,
        studentLastName: selectedChild?.lastName,
        studentMatricule: selectedChild?.matricule,
      });

      if (result.success) {
        // ⭐ Afficher le bandeau de succès (même que admin)
        setLastReceipt({
          transactionId: result.transactionId || "",
          receiptNumber: result.receiptNumber,
          createdAt: new Date().toISOString(),
        });
        toast.success("Paiement confirmé", {
          description: `Reçu ${result.receiptNumber} généré. Référence : ${result.reference}.`,
        });
        // Recharger le compte pour afficher le nouveau solde + la transaction
        loadAccount();
      } else if (result.error) {
        if (result.error.includes("annulé")) {
          toast.info("Paiement annulé");
        } else {
          toast.error("Échec du paiement", { description: result.error });
        }
      }
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setPaying(false);
    }
  };

  // ── Données pour l'affichage ──
  const totalDue = Number(account?.totalDue ?? 0);
  const totalPaid = Number(account?.totalPaid ?? 0);
  const balance = Number(account?.balance ?? 0);
  const transactions = account?.transactions || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-bold text-slate-900">Paiements</h2>
      </div>

      {/* Sélecteur d'enfant */}
      {children.length > 1 && (
        <select
          value={selectedStudent}
          onChange={(e) => {
            setSelectedStudent(e.target.value);
            setLastReceipt(null); // reset bandeau succès si on change d'enfant
          }}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]"
        >
          {children.map((c) => (
            <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
          ))}
        </select>
      )}

      {/* Bandeau succès post-paiement (même que admin) */}
      {lastReceipt && (
        <PaymentSuccessBanner
          transactionId={lastReceipt.transactionId}
          receiptNumber={lastReceipt.receiptNumber}
          createdAt={lastReceipt.createdAt}
          onClose={() => setLastReceipt(null)}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : !account ? (
        <div className="text-center py-12">
          <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Aucune donnée financière disponible</p>
        </div>
      ) : (
        <>
          {/* Cards solde (même info que admin) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-semibold text-slate-500 uppercase">Total dû</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{formatXOF(totalDue)}</p>
            </div>
            <div className="bg-white rounded-xl border border-emerald-200 p-5 bg-emerald-50/50">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700 uppercase">Total payé</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">{formatXOF(totalPaid)}</p>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-5 bg-red-50/50">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <span className="text-xs font-semibold text-red-700 uppercase">Restant à payer</span>
              </div>
              <p className="text-2xl font-bold text-red-700">{formatXOF(balance)}</p>
            </div>
          </div>

          {/* Bouton payer (même flux FedaPay que admin) */}
          {balance > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-900">Payer les frais de scolarité</p>
                <p className="text-sm text-blue-700">Restant : {formatXOF(balance)}</p>
                <p className="text-xs text-blue-500 mt-0.5">
                  Paiement sécurisé via FedaPay (Mobile Money / Carte bancaire)
                </p>
              </div>
              <button
                onClick={handlePayNow}
                disabled={paying}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Paiement en cours...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Payer maintenant
                  </>
                )}
              </button>
            </div>
          )}

          {/* Historique des paiements — COMPOSANT PARTAGÉ (même table que admin) */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase mb-3">
              Historique des paiements
            </h3>
            <ParentPaymentHistory transactions={transactions} />
          </div>
        </>
      )}
    </div>
  );
}
