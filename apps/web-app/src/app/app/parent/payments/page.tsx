"use client";

/**
 * Parent Portal — Paiements
 * Solde total (dû/payé/restant) + historique des paiements + reçus + paiement en ligne FedaPay.
 */

import { useState, useEffect, useCallback } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import {
  CreditCard, Loader2, Download, CheckCircle2, Clock,
  TrendingUp, TrendingDown, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { openFedaPayCheckout } from "@/lib/parent/fedapay-checkout";

export default function ParentPaymentsPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string>("");

  // Charger les enfants d'abord
  const [children, setChildren] = useState<any[]>([]);

  useEffect(() => {
    if (!academicYear?.id || !user?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/parent/children?parentId=${user.id}&academicYearId=${academicYear.id}`, { credentials: "include" });
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setChildren(list);
        if (list.length > 0) setSelectedStudent(list[0].id);
      } catch { setChildren([]); }
    })();
  }, [user?.id, academicYear?.id]);

  const loadPayments = useCallback(async () => {
    if (!academicYear?.id || !selectedStudent) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/parent/payments/${selectedStudent}?academicYearId=${academicYear.id}`,
        { credentials: "include" }
      );
      const data = await res.json();
      setData(data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedStudent, academicYear?.id]);

  useEffect(() => {
    if (selectedStudent) loadPayments();
  }, [loadPayments, selectedStudent]);

  const formatXOF = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
  };

  // Trouver l'enfant sélectionné pour récupérer le studentAccountId
  const selectedChild = children.find((c) => c.id === selectedStudent);

  // ── Lancer le paiement FedaPay ──
  const handlePayNow = async () => {
    const studentAccountId = selectedChild?.account?.id;
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
    if (!data || data.totalRemaining <= 0) {
      toast.info("Scolarité déjà à jour");
      return;
    }

    setPaying(true);
    try {
      const result = await openFedaPayCheckout({
        amount: data.totalRemaining,
        studentAccountId,
        academicYearId: academicYear.id,
        studentFirstName: selectedChild?.firstName,
        studentLastName: selectedChild?.lastName,
        studentMatricule: selectedChild?.matricule,
      });

      if (result.success) {
        toast.success("Paiement confirmé", {
          description: `Reçu ${result.receiptNumber} généré. Référence : ${result.reference}.`,
        });
        // Recharger les données pour afficher le nouveau solde
        setTimeout(() => loadPayments(), 1500);
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

  const downloadReceipt = async (paymentId: string) => {
    setDownloadingId(paymentId);
    try {
      const res = await fetch(`/api/parent/receipts/${paymentId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      // Pour l'instant on affiche les infos — le PDF sera généré plus tard
      toast.success("Reçu récupéré", {
        description: `Reçu N°${data.receiptNumber || data.paymentId} — ${formatXOF(data.amount)}`,
      });
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setDownloadingId(null);
    }
  };

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
          onChange={(e) => setSelectedStudent(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium min-w-[200px]"
        >
          {children.map((c) => (
            <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
          ))}
        </select>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : !data ? (
        <div className="text-center py-12">
          <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Aucune donnée financière disponible</p>
        </div>
      ) : (
        <>
          {/* Cards solde */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5 text-blue-600" />
                <span className="text-xs font-semibold text-slate-500 uppercase">Total dû</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{formatXOF(data.totalDue)}</p>
            </div>
            <div className="bg-white rounded-xl border border-emerald-200 p-5 bg-emerald-50/50">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700 uppercase">Total payé</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700">{formatXOF(data.totalPaid)}</p>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-5 bg-red-50/50">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <span className="text-xs font-semibold text-red-700 uppercase">Restant à payer</span>
              </div>
              <p className="text-2xl font-bold text-red-700">{formatXOF(data.totalRemaining)}</p>
            </div>
          </div>

          {/* Bouton payer */}
          {data.totalRemaining > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-900">Payer les frais de scolarité</p>
                <p className="text-sm text-blue-700">Restant : {formatXOF(data.totalRemaining)}</p>
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

          {/* Historique des paiements */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 uppercase mb-3">Historique des paiements</h3>
            {data.payments && data.payments.length > 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700">Frais</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-700">Montant</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-700">Méthode</th>
                      <th className="text-center px-4 py-3 font-semibold text-slate-700">Reçu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((p: any) => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-600">
                          {new Date(p.paymentDate).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{p.feeName || "Scolarité"}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatXOF(p.amount)}</td>
                        <td className="px-4 py-3 text-center text-slate-500">
                          {p.paymentMethod || "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => downloadReceipt(p.id)}
                            disabled={downloadingId === p.id}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                          >
                            {downloadingId === p.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
                            Reçu
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Aucun paiement enregistré pour cette année.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
