"use client";

/**
 * ============================================================================
 * PARENT PORTAL — Composant partagé : Historique des paiements
 * ============================================================================
 *
 * Tableau identique à celui du module Finance / onglet Encaissements
 * (StudentAccountsContent.tsx — section "Historique des encaissements").
 *
 * Source de données : financeService.getStudentAccountDetails(studentAccountId)
 * → account.transactions (50 dernières FinanceTransaction, tri desc createdAt)
 *
 * Pour chaque transaction, le parent peut :
 *   👁️  Visualiser le reçu PDF (modal preview)
 *   ⬇️  Télécharger le reçu PDF (download direct)
 *   ✉️  Renvoyer par email (au parent lui-même ou autre tuteur)
 *   💬  Envoyer par WhatsApp (lien wa.me ou API auto)
 *   📱  Renvoyer par SMS
 *
 * Le PDF reçu est EXACTEMENT le même que celui de l'admin :
 *   GET /api/finance/transactions/:id/receipt.pdf (Puppeteer HTML→PDF)
 *   → avec QR code de vérification, imputations par frais, arriérés, multi-action
 * ============================================================================
 */

import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye, Download, Clock, MoreVertical, Mail, MessageSquare, Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { financeService } from "@/services/finance.service";
import { cn } from "@/lib/utils";

// ── Traduction des méthodes de paiement (identique admin) ──
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  MOBILE_MONEY: "Mobile Money",
  WIRE: "Virement",
  FEDAPAY: "Fedapay",
  FEEXPAY: "FeexPay",
  CARD: "Carte bancaire",
  BANK_TRANSFER: "Virement bancaire",
  ONLINE: "Paiement en ligne",
};

// ── Formatage montant (identique admin) ──
function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0 FCFA";
  return new Intl.NumberFormat("fr-FR").format(num) + " FCFA";
}

interface Transaction {
  id: string;
  receiptNumber?: string;
  amount: number | string;
  paymentMethod?: string;
  createdAt?: string;
  reference?: string;
  status?: string;
  notes?: string;
}

interface ParentPaymentHistoryProps {
  transactions: Transaction[];
  loading?: boolean;
  /** Pour différencier l'affichage si nécessaire */
  emptyMessage?: string;
}

export function ParentPaymentHistory({
  transactions,
  loading,
  emptyMessage = "Aucun paiement enregistré pour cette année.",
}: ParentPaymentHistoryProps) {
  const [whatsappMenuId, setWhatsappMenuId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Actions sur une transaction ──

  // 1. Visualiser le reçu PDF (fetch → blob → modal preview)
  const handlePreview = async (t: Transaction) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(financeService.getReceiptPdfUrl(t.id), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewDoc({
        url,
        fileName: `recu-${t.receiptNumber || t.id}.pdf`,
      });
    } catch (e: any) {
      toast.error("Erreur", { description: "Impossible de charger le reçu" });
    } finally {
      setPreviewLoading(false);
    }
  };

  // 2. Renvoyer par email
  const handleResendEmail = async (t: Transaction) => {
    try {
      const r = await financeService.resendReceipt(t.id, ["email"]);
      const s = r?.channels?.email;
      if (s?.status === "skipped") {
        toast.error("Contact manquant", { description: s.reason });
      } else if (s?.status === "failed") {
        toast.error("Échec d'envoi", { description: s.error || "Échec de l'envoi" });
      } else {
        toast.success("Reçu envoyé", {
          description: `Email envoyé${s?.to ? ` à ${s.to}` : ""}`,
        });
      }
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  // 3. WhatsApp — Lien wa.me (manuel)
  const handleWhatsAppLink = async (t: Transaction) => {
    setWhatsappMenuId(null);
    try {
      const data = await financeService.getWhatsAppLink(t.id);
      if (data?.url) {
        window.open(data.url, "_blank");
        toast.success("WhatsApp ouvert", {
          description: "Cliquez sur Envoyer dans WhatsApp.",
        });
      } else {
        toast.error("Pas de téléphone", {
          description: "Aucun numéro de parent trouvé.",
        });
      }
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  // 4. WhatsApp — Envoi auto (API)
  const handleWhatsAppAuto = async (t: Transaction) => {
    setWhatsappMenuId(null);
    try {
      const r = await financeService.resendReceipt(t.id, ["whatsapp"]);
      const s = r?.channels?.whatsapp;
      if (s?.status === "skipped") {
        toast.error("Contact manquant", { description: s.reason });
      } else if (s?.status === "failed") {
        toast.error("Échec d'envoi", { description: s.error || "Échec de l'envoi" });
      } else {
        toast.success("Reçu envoyé", {
          description: `WhatsApp envoyé${s?.to ? ` à ${s.to}` : ""}`,
        });
      }
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  // 5. SMS
  const handleResendSms = async (t: Transaction) => {
    try {
      const r = await financeService.resendReceipt(t.id, ["sms"]);
      const s = r?.channels?.sms;
      if (s?.status === "skipped") {
        toast.error("Contact manquant", { description: s.reason });
      } else if (s?.status === "failed") {
        toast.error("Échec d'envoi", { description: s.error || "Échec de l'envoi" });
      } else {
        toast.success("Reçu envoyé", {
          description: `SMS envoyé${s?.to ? ` à ${s.to}` : ""}`,
        });
      }
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    }
  };

  // ── Render ──

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2 animate-pulse" />
        <p className="text-sm text-slate-500">Chargement de l'historique...</p>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="whitespace-nowrap">N° reçu</TableHead>
              <TableHead className="text-right whitespace-nowrap">Montant</TableHead>
              <TableHead className="whitespace-nowrap">Mode</TableHead>
              <TableHead className="whitespace-nowrap">Date</TableHead>
              <TableHead className="whitespace-nowrap">Heure</TableHead>
              <TableHead className="whitespace-nowrap">Référence</TableHead>
              <TableHead className="whitespace-nowrap text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id} className="hover:bg-slate-50">
                <TableCell className="font-mono text-xs whitespace-nowrap">
                  {t.receiptNumber || "—"}
                </TableCell>
                <TableCell className="text-right font-semibold text-emerald-700 whitespace-nowrap">
                  {formatCurrency(t.amount)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant="outline">
                    {PAYMENT_METHOD_LABELS[t.paymentMethod || ""] || t.paymentMethod || "—"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {t.createdAt
                    ? new Date(t.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "—"}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {t.createdAt
                    ? new Date(t.createdAt).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </TableCell>
                <TableCell
                  className="text-xs text-slate-500 whitespace-nowrap"
                  title={t.reference || ""}
                >
                  {t.reference || "—"}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-1 justify-center">
                    {/* 1. Visualiser */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                      onClick={() => handlePreview(t)}
                      disabled={previewLoading}
                      title="Visualiser le reçu"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-600" />
                    </Button>

                    {/* 2. Télécharger (lien direct, même que admin) */}
                    <a
                      href={financeService.getReceiptPdfUrl(t.id)}
                      download={`recu-${t.receiptNumber || t.id}.pdf`}
                      title="Télécharger le reçu PDF"
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-indigo-100 hover:shadow-sm cursor-pointer transition-all duration-150"
                    >
                      <Download className="h-3.5 w-3.5 text-slate-600" />
                    </a>

                    {/* 3. Email */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                      onClick={() => handleResendEmail(t)}
                      title="Envoyer par email"
                    >
                      <Mail className="h-3.5 w-3.5 text-slate-600" />
                    </Button>

                    {/* 4. WhatsApp (dropdown 2 options) */}
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                        onClick={() =>
                          setWhatsappMenuId(whatsappMenuId === t.id ? null : t.id)
                        }
                        title="Envoyer par WhatsApp"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-slate-600" />
                      </Button>
                      {whatsappMenuId === t.id && (
                        <div className="absolute right-0 top-8 z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[180px]">
                          <button
                            className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-center gap-2"
                            onClick={() => handleWhatsAppLink(t)}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Envoi rapide (lien)
                          </button>
                          <button
                            className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 flex items-center gap-2"
                            onClick={() => handleWhatsAppAuto(t)}
                          >
                            <MessageSquare className="h-3.5 w-3.5 opacity-60" />
                            Envoi auto (API)
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 5. SMS */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-indigo-100 hover:shadow-sm transition-all duration-150"
                      onClick={() => handleResendSms(t)}
                      title="Envoyer par SMS"
                    >
                      <Smartphone className="h-3.5 w-3.5 text-slate-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modal de preview PDF (reçu) */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
          onClick={() => {
            URL.revokeObjectURL(previewDoc.url);
            setPreviewDoc(null);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">{previewDoc.fileName}</h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewDoc.url}
                  download={previewDoc.fileName}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
                >
                  <Download className="h-3 w-3" />
                  Télécharger
                </a>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(previewDoc.url);
                    setPreviewDoc(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Fermer
                </button>
              </div>
            </div>
            <iframe
              src={previewDoc.url}
              className="flex-1 w-full"
              title="Aperçu du reçu"
            />
          </div>
        </div>
      )}
    </>
  );
}
