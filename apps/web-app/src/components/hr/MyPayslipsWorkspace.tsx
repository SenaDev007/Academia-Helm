"use client";

/**
 * ============================================================================
 * MyPayslipsWorkspace — Module « Ma Paie » self-service du personnel
 * ============================================================================
 *
 * ⭐ 22/11/2026 — SELF-SERVICE PAIE (retour promoteur) : « lorsque la paie est
 * effectuée, il faut que le personnel puisse chacun recevoir sa fiche de paie
 * ou bien son état de paiement dans son UI, qu'il soit notifié à chaque mois
 * de la paie, accompagné de la fiche de paie ou de l'état de paiement en PDF
 * qu'il peut lui-même télécharger. »
 *
 * Rendu par :
 *   - /app/my-paie (page partagée de TOUS les portails administratifs :
 *     directeur, secrétaire, secrétaire-comptable, comptable, surveillant,
 *     censeur — voir admin-portal-map.ts) ;
 *   - /app/teacher/paie (portail enseignant).
 *
 *   - Liste MES documents de paie émis (fiches de paie FP pour les salariés,
 *     états de paiement EP pour les prestataires), période décroissante ;
 *     les montants viennent du SNAPSHOT FIGÉ à l'émission (jamais recalculés).
 *   - Télécharge le PDF archivé TEL QU'ÉMIS (contrôle d'intégrité SHA-256
 *     côté serveur) avec le nom de fichier professionnel
 *     « Fiche de paie / État de paiement <Prénom NOM> <Période>.pdf ».
 *   - La cloche de notifications signale CHAQUE émission mensuelle
 *     (InAppNotification PAYROLL_DOCUMENT_ISSUED → clic → cette page).
 *
 * Le Staff est résolu CÔTÉ SERVEUR par l'email de l'utilisateur connecté
 * (anti-usurpation — même règle que my-history / my-presence) : un membre
 * du personnel ne voit et ne télécharge QUE SES documents.
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, Wallet, FileDown, RefreshCw, BadgeCheck, Receipt, FileText,
  AlertTriangle, Info, CalendarDays, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useL } from "@/lib/i18n/bilingual";

const cn = (...c: (string | boolean | undefined | null)[]) => c.filter(Boolean).join(" ");

const NAVY = "#0b2f73";
const BLUE = "#1d4fa5";

interface MyPayslipDoc {
  id: string;
  documentType: "FICHE_DE_PAIE" | "ETAT_DE_PAIEMENT" | string;
  documentNumber: string;
  periodYear: number;
  periodMonth: number;
  periodLabel: string;
  statutContractuel?: string | null;
  net: number;
  gross?: number;
  issuedAt: string;
  issuedByName?: string | null;
  hasFile?: boolean;
}

interface MyPayslipsPayload {
  staff: { id: string; firstName?: string; lastName?: string; position?: string | null };
  documents: MyPayslipDoc[];
}

const fmtFcfa = (n?: number) =>
  n == null || isNaN(n) ? "—" : `${Number(n).toLocaleString("fr-FR")} FCFA`;

const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "—";

export function MyPayslipsWorkspace() {
  const L = useL();
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<MyPayslipsPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hr/payroll/documents/my-payslips", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `Erreur ${res.status}`);
      }
      const data = (await res.json()) as MyPayslipsPayload;
      setPayload(data);
    } catch (err: any) {
      setError(err?.message || "Impossible de charger vos documents de paie.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const documents = useMemo(() => payload?.documents ?? [], [payload]);
  const staffName = useMemo(
    () => `${payload?.staff?.firstName ?? ""} ${payload?.staff?.lastName ?? ""}`.trim(),
    [payload],
  );

  const currentYear = new Date().getFullYear();
  const yearDocs = useMemo(
    () => documents.filter((d) => d.periodYear === currentYear),
    [documents, currentYear],
  );
  const yearNet = useMemo(
    () => yearDocs.reduce((sum, d) => sum + (Number(d.net) || 0), 0),
    [yearDocs],
  );

  /** Télécharge le PDF archivé tel qu'émis (nom de fichier professionnel). */
  const download = useCallback(
    async (doc: MyPayslipDoc) => {
      setDownloadingId(doc.id);
      try {
        const res = await fetch(
          `/api/hr/payroll/documents/my-payslips/${doc.id}/download`,
          { credentials: "include" },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || body?.error || `Erreur ${res.status}`);
        }
        const blob = await res.blob();

        // Nom de fichier — priorité au Content-Disposition du serveur
        // (« Fiche de paie <Prénom NOM> <Période>.pdf », RFC 5987 filename*).
        let fileName = `${doc.documentNumber}.pdf`;
        const disposition = res.headers.get("Content-Disposition") || "";
        const starMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (starMatch?.[1]) {
          fileName = decodeURIComponent(starMatch[1].replace(/^"|"$/g, ""));
        } else {
          const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
          if (plainMatch?.[1]) fileName = plainMatch[1];
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(L("Téléchargement lancé", "Download started"), {
          description: fileName,
        });
      } catch (err: any) {
        toast.error(err?.message || "Le téléchargement a échoué.");
      } finally {
        setDownloadingId(null);
      }
    },
    [L],
  );

  // ─── États de chargement ───────────────────────────────────────────────────

  if (loading && !payload) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: BLUE }} />
          <p className="text-sm text-slate-500">
            {L("Chargement de vos documents de paie…", "Loading your payroll documents…")}
          </p>
        </div>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="max-w-xl mx-auto mt-8 p-5 rounded-2xl border border-amber-200 bg-amber-50/70 space-y-2">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-bold text-amber-800">
              {L("Vos documents de paie sont indisponibles", "Your payroll documents are unavailable")}
            </p>
            <p className="text-xs text-amber-700 leading-relaxed">{error}</p>
            <p className="text-[11px] text-amber-600 leading-relaxed">
              {L(
                "Si vous venez d'être recruté(e), votre compte doit être rattaché à votre fiche de personnel (même adresse email). Contactez le service RH de votre établissement.",
                "If you have just been hired, your account must be linked to your staff record (same email address). Please contact your school's HR office.",
              )}
            </p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" /> {L("Réessayer", "Retry")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── En-tête + statistiques ────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Bandeau titre */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div
          className="px-5 py-4 text-white flex items-center gap-3"
          style={{ background: `linear-gradient(135deg, ${NAVY} 0%, ${BLUE} 100%)` }}
        >
          <div className="rounded-xl bg-white/15 p-2.5">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-tight">
              {L("Ma Paie", "My Payroll")}
            </h2>
            <p className="text-[11.5px] text-white/75 leading-relaxed">
              {staffName
                ? L(
                    `${staffName} — vos fiches de paie et états de paiement émis, téléchargeables en PDF`,
                    `${staffName} — your issued payslips and payment statements, downloadable as PDF`,
                  )
                : L(
                    "Vos fiches de paie et états de paiement émis, téléchargeables en PDF",
                    "Your issued payslips and payment statements, downloadable as PDF",
                  )}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg p-2 hover:bg-white/15 transition disabled:opacity-40"
            title={L("Rafraîchir", "Refresh")}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div className="p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              {L("Documents émis", "Issued documents")}
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1">{documents.length}</p>
            <p className="text-[10.5px] text-slate-400 mt-0.5">
              {L("au total, toutes périodes", "total, all periods")}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              {L(`Exercice ${currentYear}`, `FY ${currentYear}`)}
            </p>
            <p className="text-xl font-bold text-slate-900 mt-1">{yearDocs.length}</p>
            <p className="text-[10.5px] text-slate-400 mt-0.5">
              {L("documents sur l'exercice en cours", "documents in the current fiscal year")}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              {L("Net cumulé", "Cumulative net")}
            </p>
            <p className="text-xl font-bold text-emerald-700 mt-1">{fmtFcfa(yearNet)}</p>
            <p className="text-[10.5px] text-slate-400 mt-0.5">
              {L(`sur l'exercice ${currentYear}`, `for FY ${currentYear}`)}
            </p>
          </div>
        </div>
      </div>

      {/* Aide : d'où viennent ces documents */}
      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-600 leading-relaxed">
          {L(
            "Chaque fois que le service RH émet votre paie du mois, vous recevez une notification (cloche) et le document apparaît ici : fiche de paie pour les salariés, état de paiement pour les prestataires. Le PDF est l'original archivé — scellé et infalsifiable (SHA-256).",
            "Each time the HR office issues your monthly payroll, you get a notification (bell) and the document appears here: payslip for salaried staff, payment statement for service providers. The PDF is the archived original — sealed and tamper-proof (SHA-256).",
          )}
        </p>
      </div>

      {/* Liste des documents */}
      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
            <FileText className="h-6 w-6 text-slate-400" />
          </div>
          <p className="mt-3 text-sm font-bold text-slate-700">
            {L("Aucun document de paie pour l'instant", "No payroll documents yet")}
          </p>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            {L(
              "Vos fiches de paie / états de paiement apparaîtront ici dès que le service RH les aura émis pour une période de paie.",
              "Your payslips / payment statements will appear here as soon as the HR office issues them for a payroll period.",
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const isFiche = doc.documentType === "FICHE_DE_PAIE";
            const docLabel = isFiche
              ? L("Fiche de paie", "Payslip")
              : L("État de paiement", "Payment statement");
            const DocIcon = isFiche ? FileText : Receipt;
            return (
              <div
                key={doc.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-3">
                  {/* Icône type */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      isFiche ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600",
                    )}
                  >
                    <DocIcon className="h-5 w-5" />
                  </div>

                  {/* Période + numéro */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        <CalendarDays className="inline h-3.5 w-3.5 mr-1 -mt-0.5 text-slate-400" />
                        {doc.periodLabel}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          isFiche
                            ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                            : "bg-amber-50 text-amber-700 border-amber-100",
                        )}
                      >
                        {docLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-500 border border-slate-200">
                        <BadgeCheck className="h-3 w-3" />
                        {doc.documentNumber}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {L("Émis le", "Issued on")} {fmtDate(doc.issuedAt)}
                      {doc.issuedByName ? ` • ${L("par", "by")} ${doc.issuedByName}` : ""}
                    </p>
                  </div>

                  {/* Net + téléchargement */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {L("Net à payer", "Net pay")}
                      </p>
                      <p className="text-base font-bold text-emerald-700 whitespace-nowrap">
                        {fmtFcfa(doc.net)}
                      </p>
                    </div>
                    <button
                      onClick={() => download(doc)}
                      disabled={downloadingId === doc.id}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition whitespace-nowrap"
                      style={{ backgroundColor: BLUE }}
                    >
                      {downloadingId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4" />
                      )}
                      {L("Télécharger PDF", "Download PDF")}
                    </button>
                  </div>
                </div>

                {/* Empreinte d'intégrité */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  <p className="text-[10px] text-slate-400">
                    {L(
                      "Document original archivé et scellé (SHA-256) — tel qu'émis par votre établissement.",
                      "Archived original sealed with SHA-256 — exactly as issued by your school.",
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
