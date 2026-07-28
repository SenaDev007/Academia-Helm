"use client";

/**
 * ============================================================================
 * PARENT PORTAL — Bandeau de succès post-paiement
 * ============================================================================
 *
 * Reproduit fidèlement le bandeau de succès de NewPaymentModal.tsx (admin).
 * Affiché après qu'un parent a effectué un paiement via FedaPay.
 *
 * Contenu :
 *   ✓ Icône CheckCircle (emerald)
 *   - Titre "Paiement enregistré avec succès"
 *   - N° reçu (font-mono) + Date/heure
 *   - Boutons :
 *     • Télécharger PDF (window.open receipt.pdf)
 *     • Email (renvoyer à soi-même)
 *     • WhatsApp (lien wa.me)
 *     • SMS
 *     • Fermer
 *
 * Le PDF généré est EXACTEMENT le même que celui de l'admin :
 *   GET /api/finance/transactions/:id/receipt.pdf (Puppeteer backend)
 * ============================================================================
 */

import { useState } from "react";
import {
  CheckCircle2, Download, Mail, MessageSquare, Smartphone, X,
} from "lucide-react";
import { toast } from "sonner";
import { financeService } from "@/services/finance.service";

interface PaymentSuccessBannerProps {
  /** ID de la FinanceTransaction créée */
  transactionId: string;
  /** Numéro du reçu (ex: CSPEB-R-25-00001) */
  receiptNumber?: string;
  /** Date ISO de création (format ISO string) */
  createdAt?: string;
  /** Callback quand le parent ferme le bandeau */
  onClose?: () => void;
}

export function PaymentSuccessBanner({
  transactionId,
  receiptNumber,
  createdAt,
  onClose,
}: PaymentSuccessBannerProps) {
  const [sending, setSending] = useState<"email" | "whatsapp" | "sms" | null>(null);

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  // Télécharger le reçu PDF (même URL que admin)
  const handleDownloadPdf = () => {
    window.open(financeService.getReceiptPdfUrl(transactionId), "_blank");
  };

  // Renvoyer le reçu par email
  const handleEmail = async () => {
    setSending("email");
    try {
      const r = await financeService.resendReceipt(transactionId, ["email"]);
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
    } finally {
      setSending(null);
    }
  };

  // WhatsApp : ouvrir wa.me avec lien pré-rempli
  const handleWhatsApp = async () => {
    setSending("whatsapp");
    try {
      const data = await financeService.getWhatsAppLink(transactionId);
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
    } finally {
      setSending(null);
    }
  };

  // SMS
  const handleSms = async () => {
    setSending("sms");
    try {
      const r = await financeService.resendReceipt(transactionId, ["sms"]);
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
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="mb-4 p-4 rounded-lg bg-emerald-50 border border-emerald-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-900">
              Paiement enregistré avec succès
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-sm">
              <div>
                <span className="text-emerald-700">N° reçu : </span>
                <span className="font-mono font-bold text-emerald-900">
                  {receiptNumber || transactionId}
                </span>
              </div>
              <div>
                <span className="text-emerald-700">Date/heure : </span>
                <span className="text-emerald-900">{formatDate(createdAt)}</span>
              </div>
            </div>

            {/* Boutons d'action (même que admin) */}
            <div className="flex flex-wrap gap-2 pt-3 mt-2 border-t border-emerald-200">
              <button
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger PDF
              </button>
              <button
                onClick={handleEmail}
                disabled={sending === "email"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </button>
              <button
                onClick={handleWhatsApp}
                disabled={sending === "whatsapp"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                WhatsApp
              </button>
              <button
                onClick={handleSms}
                disabled={sending === "sms"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <Smartphone className="h-3.5 w-3.5" />
                SMS
              </button>
            </div>
          </div>
        </div>

        {/* Bouton fermer */}
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-emerald-100 transition-colors flex-shrink-0"
          aria-label="Fermer le bandeau"
        >
          <X className="h-4 w-4 text-emerald-700" />
        </button>
      </div>
    </div>
  );
}
