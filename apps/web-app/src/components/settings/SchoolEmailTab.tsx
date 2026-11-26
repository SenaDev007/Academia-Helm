"use client";

/**
 * ============================================================================
 * SchoolEmailTab — Onglet Paramètres → E-mail (tâche 181)
 * ============================================================================
 *
 * Cahier des charges « Academia Helm : envoi d'e-mails via le Gmail de chaque
 * école » — Phase 1 (SMTP avec mot de passe d'application).
 *
 * Contenu (CDC section 2) :
 *   1. Bandeau de statut : Non configuré / Actif / Expiré / Erreur + dernière
 *      vérification.
 *   2. Choix du mode : Google OAuth2 (grisé « Bientôt disponible » — phase 2)
 *      ou SMTP.
 *   3. Formulaire commun : nom affiché, adresse d'envoi, Reply-To.
 *   4. Formulaire SMTP : serveur, port (587 STARTTLS / 465 SSL), identifiant,
 *      mot de passe d'application (champ masqué — JAMAIS renvoyé après
 *      enregistrement, affiché « •••• »).
 *   5. Bouton « Envoyer un e-mail test » → adresse de l'utilisateur connecté.
 *   6. Compteur du jour : X envoyés sur 490 + prochaine remise à zéro.
 *   7. Journal des 50 derniers envois : date, module, destinataire, statut.
 *   8. Bouton Déconnecter : supprime tous les secrets.
 *   9. Guide pas à pas intégré pour le directeur (+ avertissement Workspace).
 *
 * Endpoints (BFF → api-server /school-email/*) :
 *   GET  /api/school-email          → { settings, usage }
 *   PUT  /api/school-email          → enregistre la configuration SMTP
 *   POST /api/school-email/test     → e-mail de test (wait)
 *   GET  /api/school-email/log      → { entries }
 *   POST /api/school-email/disconnect → supprime les secrets
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  Mail, Loader2, Save, Send, PlugZap, CheckCircle2, AlertTriangle,
  XCircle, Clock, HelpCircle, ShieldCheck, KeyRound, ExternalLink,
  RefreshCw, Inbox, LogOut, Chrome,
} from "lucide-react";
import { toast } from "sonner";
import { useAppSession } from "@/contexts/AppSessionContext";

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

// ─── Types (miroir des vues du service central) ─────────────────────────────

interface SchoolEmailSettingsView {
  configured: boolean;
  mode: "smtp" | "google_oauth" | "aucun";
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  secretSet: boolean;
  status: "non_configure" | "actif" | "expire" | "erreur";
  lastError: string | null;
  lastVerifiedAt: string | null;
  dailyCap: number;
}

interface SchoolEmailUsageView {
  sent24h: number;
  dailyCap: number;
  windowResetsAt: string | null;
  deferredCount: number;
  testCountLastHour: number;
}

interface EmailSendLogEntry {
  id: string;
  module: string;
  category: string;
  recipient: string;
  subject: string;
  provider: string;
  status: string;
  errorCode: string | null;
  createdAt: string;
}

// ─── Aides visuelles ────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Mail }> = {
  non_configure: { label: "Non configuré", color: "bg-gray-100 text-gray-700 border-gray-200", icon: Mail },
  actif: { label: "Actif", color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  expire: { label: "Expiré", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  erreur: { label: "Erreur", color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
};

const SEND_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-blue-100 text-blue-700" },
  envoye: { label: "Envoyé", color: "bg-green-100 text-green-700" },
  reporte: { label: "Reporté", color: "bg-amber-100 text-amber-700" },
  echec: { label: "Échec", color: "bg-red-100 text-red-700" },
};

const MODULE_LABELS: Record<string, string> = {
  pedagogie: "Pédagogie",
  eleves: "Élève",
  finance: "Finance",
  examens: "Examen",
  rh: "Personnel RH",
  communication: "Communication",
  settings: "Paramètres",
  test: "Test",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

// ─── Composant principal ────────────────────────────────────────────────────

export function SchoolEmailTab() {
  const { user, tenant } = useAppSession();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  // ⭐ Modal de déconnexion personnalisé (fin du window.confirm générique).
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Tâche 183 (Phase 2) — Google OAuth2
  const [modeChoice, setModeChoice] = useState<"smtp" | "google">("smtp");
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  const [settings, setSettings] = useState<SchoolEmailSettingsView | null>(null);
  const [usage, setUsage] = useState<SchoolEmailUsageView | null>(null);
  const [logEntries, setLogEntries] = useState<EmailSendLogEntry[]>([]);

  // Formulaire (les secrets ne sont JAMAIS chargés — secretSet: boolean)
  const [form, setForm] = useState({
    fromName: "",
    fromEmail: "",
    replyTo: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
  });

  // ─── Chargement initial ────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, logRes] = await Promise.all([
        fetch("/api/school-email", { credentials: "include", cache: "no-store" }),
        fetch("/api/school-email/log", { credentials: "include", cache: "no-store" }),
      ]);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setSettings(data.settings);
        setUsage(data.usage);
        setGoogleAvailable(Boolean(data.googleOauthAvailable));
        // ⭐ 2026-11-26 — non configuré OU connexion SMTP en erreur : proposer
        // Google d'abord. La connexion Google (API Gmail via HTTPS) est la voie
        // la plus fiable ; le SMTP direct reste disponible (587/465, ou 2525
        // pour les relais professionnels compatibles avec tout hébergement).
        setModeChoice(
          data.settings?.mode === "google_oauth"
            ? "google"
            : data.settings?.configured && data.settings?.status !== "erreur"
              ? "smtp"
              : data.googleOauthAvailable
                ? "google"
                : "smtp",
        );
        if (data.settings?.configured) {
          setForm((f) => ({
            ...f,
            fromName: data.settings.fromName || "",
            fromEmail: data.settings.fromEmail || "",
            replyTo: data.settings.replyTo || data.settings.fromEmail || "",
            smtpHost: data.settings.smtpHost || "smtp.gmail.com",
            smtpPort: data.settings.smtpPort || 587,
            smtpUser: data.settings.smtpUser || data.settings.fromEmail || "",
            smtpPassword: "", // jamais pré-rempli (secret chiffré côté serveur)
          }));
          if (data.settings.status !== "actif") setShowGuide(true);
        } else {
          // Pré-remplissage intelligent : nom de l'école par défaut
          setForm((f) => ({ ...f, fromName: tenant?.name || "" }));
          setShowGuide(true);
        }
      }
      if (logRes.ok) {
        const logData = await logRes.json();
        setLogEntries(Array.isArray(logData.entries) ? logData.entries : []);
      }
    } catch (err) {
      console.error("Failed to load school email settings:", err);
      toast.error("Impossible de charger la configuration e-mail.");
    } finally {
      setLoading(false);
    }
  }, [tenant?.name]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ─── Retour du consentement Google (redirection du callback) ─────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    if (google === "ok") {
      toast.success("Compte Google connecté — l'école envoie désormais ses e-mails via Google OAuth2.", { duration: 8000 });
    } else if (google === "erreur") {
      const motif = params.get("motif");
      let msg = "La connexion Google a échoué.";
      try { if (motif) msg = decodeURIComponent(motif); } catch { /* brut */ }
      toast.error(msg, { duration: 10000 });
    }
    if (google) {
      params.delete("google");
      params.delete("motif");
      const qs = params.toString();
      window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
  }, []);

  // ─── Rafraîchissement du compteur toutes les 60 s (léger) ──────────────
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch("/api/school-email", { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setUsage(data.usage);
        }
      } catch {
        /* silencieux */
      }
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  // ─── Enregistrement de la configuration ────────────────────────────────
  const saveConfig = async (): Promise<void> => {
    if (!form.fromName.trim()) {
      toast.error("Le nom affiché de l'expéditeur est requis.");
      return;
    }
    if (!form.fromEmail.trim()) {
      toast.error("L'adresse Gmail de l'école est requise.");
      return;
    }
    if (!settings?.secretSet && !form.smtpPassword.trim()) {
      toast.error("Le mot de passe d'application est requis pour une première configuration.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/school-email", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "smtp",
          fromName: form.fromName.trim(),
          fromEmail: form.fromEmail.trim(),
          replyTo: form.replyTo.trim() || form.fromEmail.trim(),
          smtpHost: form.smtpHost.trim() || "smtp.gmail.com",
          smtpPort: Number(form.smtpPort) || 587,
          smtpUser: form.smtpUser.trim() || form.fromEmail.trim(),
          // Champ absent (vide) = conserver le secret existant
          ...(form.smtpPassword.trim() ? { smtpPassword: form.smtpPassword.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSettings(data.settings);
        setForm((f) => ({ ...f, smtpPassword: "" }));
        if (data.verified) {
          toast.success("Connexion e-mail enregistrée et vérifiée — statut Actif.");
        } else {
          toast.error(data.verifyError || "Enregistré, mais la vérification de connexion a échoué.", { duration: 8000 });
        }
      } else {
        toast.error(data?.message || data?.error || "Échec de l'enregistrement.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau pendant l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Connexion Google OAuth2 (tâche 183 — phase 2) ──────────────────
  const connectGoogle = async (): Promise<void> => {
    if (!form.fromName.trim()) {
      toast.error("Le nom affiché de l'expéditeur est requis.");
      return;
    }
    setGoogleConnecting(true);
    try {
      const res = await fetch("/api/school-email/google/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromName: form.fromName.trim(),
          ...(form.fromEmail.trim() ? { fromEmail: form.fromEmail.trim() } : {}),
          ...(form.replyTo.trim() ? { replyTo: form.replyTo.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.authUrl) {
        window.location.href = data.authUrl; // consentement Google, puis retour automatique
        return;
      }
      toast.error(data?.message || data?.error || "Impossible de démarrer la connexion Google.");
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau pendant le démarrage de la connexion Google.");
    } finally {
      setGoogleConnecting(false);
    }
  };

  // ─── E-mail de test ────────────────────────────────────────────────────
  const sendTest = async (): Promise<void> => {
    const email = (user as any)?.email;
    if (!email) {
      toast.error("Aucune adresse e-mail sur votre compte utilisateur.");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/school-email/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(data.message || `E-mail de test envoyé à ${email}.`, { duration: 8000 });
      } else if (res.status === 403) {
        toast.error(data?.message || "Limite de 5 e-mails de test par heure atteinte.");
      } else {
        toast.error(data?.message || data?.error || "Échec de l'envoi du test.", { duration: 8000 });
      }
      // Rafraîchit le compteur d'essais
      const sres = await fetch("/api/school-email", { credentials: "include", cache: "no-store" });
      if (sres.ok) {
        const d = await sres.json();
        setUsage(d.usage);
        setSettings(d.settings);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau pendant l'envoi du test.");
    } finally {
      setTesting(false);
    }
  };

  // ─── Déconnexion ───────────────────────────────────────────────────────
  // ⭐ La confirmation passe par un MODAL personnalisé (confirmDisconnectOpen)
  //    — fin du window.confirm générique du navigateur.
  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/school-email/disconnect", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        toast.success("Déconnecté — secrets supprimés.");
        await loadAll();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.message || data?.error || "Échec de la déconnexion.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau pendant la déconnexion.");
    } finally {
      setDisconnecting(false);
      setConfirmDisconnectOpen(false);
    }
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Chargement de la configuration e-mail…
      </div>
    );
  }

  const st = STATUS_META[settings?.status || "non_configure"];
  const StatusIcon = st.icon;
  const testDisabled = testing || !settings?.configured || (usage?.testCountLastHour ?? 0) >= 5;

  return (
    <div className="space-y-6">

      {/* ═══ 1. Bandeau de statut ═════════════════════════════════════════ */}
      <div className={cn("rounded-lg border p-4 flex flex-wrap items-center gap-3", st.color)}>
        <StatusIcon className="h-5 w-5 shrink-0" />
        <div className="flex-1 min-w-[200px]">
          <div className="font-semibold">Connexion e-mail : {st.label}</div>
          <div className="text-xs opacity-80">
            {settings?.configured
              ? `${settings.fromName} — ${settings.fromEmail} · ${settings.mode === "google_oauth" ? "Google OAuth2" : "SMTP"}`
              : "Aucune adresse d'envoi configurée pour cette école."}
            {settings?.lastVerifiedAt && ` · Dernière vérification : ${fmtDate(settings.lastVerifiedAt)}`}
          </div>
          {settings?.lastError && (
            <div className="text-xs mt-1 bg-white/60 rounded px-2 py-1 border border-red-200 text-red-700">
              {settings.lastError}
            </div>
          )}
        </div>
        {settings?.configured && (
          <button
            onClick={() => setConfirmDisconnectOpen(true)}
            disabled={disconnecting}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
          >
            {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Déconnecter
          </button>
        )}
      </div>

      {/* ═══ Modal personnalisé de confirmation de déconnexion ═══════════ */}
      {confirmDisconnectOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !disconnecting && setConfirmDisconnectOpen(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-6 py-5 text-white" style={{ background: "#dc2626" }}>
              <div className="rounded-lg bg-white/15 p-2"><LogOut className="h-5 w-5" /></div>
              <div>
                <h3 className="text-base font-bold">Déconnecter l&apos;e-mail de l&apos;école</h3>
                <p className="text-xs text-white/70">Cette action interrompt l&apos;envoi des e-mails</p>
              </div>
            </div>
            <div className="p-6 space-y-3 text-sm text-slate-700">
              <p>
                Le compte <strong>{settings?.fromEmail || "de l'école"}</strong>{" "}
                ({settings?.mode === "google_oauth" ? "connexion Google" : "connexion SMTP"}) sera déconnecté
                et la configuration enregistrée sera supprimée.
              </p>
              <ul className="space-y-2 rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  Les e-mails des modules (bulletins, reçus, relances, convocations) ne partiront plus.
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  {settings?.mode === "google_oauth"
                    ? "L'autorisation Google pourra être rétablie à tout moment via « Connecter Google »."
                    : "Le mot de passe d'application devra être ressaisi pour réactiver l'envoi."}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  Aucune donnée de l&apos;école (élèves, finances, RH…) n&apos;est affectée.
                </li>
              </ul>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setConfirmDisconnectOpen(false)}
                disabled={disconnecting}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition"
                style={{ backgroundColor: "#dc2626" }}
              >
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                Déconnecter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Alerte plafond : messages reportés ══════════════════════════ */}
      {(usage?.deferredCount ?? 0) > 0 && usage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 text-amber-800">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <strong>{usage.deferredCount} message(s) en file « Reporté »</strong> — le plafond de{" "}
            {usage.dailyCap} destinataires / 24 h est atteint. Les envois repartiront automatiquement
            {usage.windowResetsAt ? ` dès ${fmtDate(usage.windowResetsAt)}` : " dès que la fenêtre se libère"}.
          </div>
        </div>
      )}

      {/* ═══ 6. Compteur du jour ═════════════════════════════════════════ */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 font-medium text-gray-800">
            <Inbox className="h-4 w-4 text-blue-600" /> Envois du jour (fenêtre glissante 24 h)
          </div>
          <button onClick={loadAll} className="text-gray-400 hover:text-gray-600" title="Rafraîchir">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">{usage?.sent24h ?? 0}</span>
          <span className="text-gray-500">sur {usage?.dailyCap ?? 490} destinataires</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              (usage?.sent24h ?? 0) >= (usage?.dailyCap ?? 490) * 0.9 ? "bg-red-500" : "bg-blue-500",
            )}
            style={{ width: `${Math.min(100, ((usage?.sent24h ?? 0) / (usage?.dailyCap ?? 490)) * 100)}%` }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {usage?.windowResetsAt
            ? `Remise à zéro progressive à partir du ${fmtDate(usage.windowResetsAt)} (fenêtre glissante, comme Gmail).`
            : "Aucun envoi sur les dernières 24 h."}
          {" · "}Essais de test cette heure : {usage?.testCountLastHour ?? 0}/5.
        </div>
      </div>

      {/* ═══ 2. Choix du mode de connexion ══════════════════════════════ */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="font-medium text-gray-800 mb-3">Mode de connexion</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Google OAuth2 (tâche 183 — recommandé) */}
          <button
            type="button"
            disabled={!googleAvailable}
            onClick={() => setModeChoice("google")}
            className={cn(
              "rounded-lg border-2 p-4 text-left transition-all",
              googleAvailable
                ? modeChoice === "google"
                  ? "border-blue-500 bg-blue-50/50 cursor-pointer"
                  : "border-gray-200 hover:border-blue-300 cursor-pointer"
                : "border-gray-200 opacity-60 cursor-not-allowed select-none",
            )}
          >
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <Chrome className="h-4 w-4 text-blue-600" /> Google (OAuth2)
              {settings?.mode === "google_oauth" ? (
                <span className="ml-auto text-[10px] uppercase tracking-wide bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                  Connecté
                </span>
              ) : googleAvailable ? (
                <span className="ml-auto text-[10px] uppercase tracking-wide bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                  Recommandé
                </span>
              ) : (
                <span className="ml-auto text-[10px] uppercase tracking-wide bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">
                  Non disponible
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {googleAvailable
                ? "Connexion en un clic, sans mot de passe — l'école autorise son compte Gmail et Academia Helm envoie en son nom (portée « envoyer des e-mails » uniquement)."
                : "Non activé sur la plateforme pour le moment — YEHI OR Tech doit configurer le client Google."}
            </p>
          </button>

          {/* SMTP (Phase 1 — mot de passe d'application) */}
          <button
            type="button"
            onClick={() => setModeChoice("smtp")}
            className={cn(
              "rounded-lg border-2 p-4 text-left transition-all",
              modeChoice === "smtp"
                ? "border-blue-500 bg-blue-50/50 cursor-pointer"
                : "border-gray-200 hover:border-blue-300 cursor-pointer",
            )}
          >
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <KeyRound className="h-4 w-4 text-blue-600" /> SMTP avec mot de passe d'application
              {settings?.mode === "google_oauth" && modeChoice === "smtp" && (
                <span className="ml-auto text-[10px] uppercase tracking-wide bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                  Retour arrière
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {settings?.mode === "google_oauth"
                ? "Revenir au SMTP — le mot de passe d'application devra être ressaisi (il est remplacé par le jeton Google)."
                : "Fonctionne avec tout compte Gmail muni de la validation en deux étapes, ou avec un serveur SMTP professionnel (ports 587, 465 ou 2525). La connexion Google reste la voie la plus simple et la plus fiable."}
            </p>
          </button>
        </div>
      </div>

      {/* ═══ 3 + 4. Formulaire commun + mode choisi ═════════════════════════════ */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <div className="font-medium text-gray-800">
          {modeChoice === "google" ? "Connexion Google de l'école" : "Configuration SMTP de l'école"}
        </div>

        {modeChoice === "google" && settings?.mode === "google_oauth" && settings?.configured && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              Compte actuellement connecté : <strong>{settings.fromEmail}</strong>. Cliquer à nouveau sur
              « Connecter Google » remplace le jeton (utile après un changement de compte ou une révocation).
            </div>
          </div>
        )}

        {modeChoice === "google" && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              Vous serez redirigé vers Google pour autoriser l&apos;envoi des e-mails de l&apos;école
              depuis son compte Gmail. L&apos;autorisation peut être révoquée à tout moment, depuis
              votre compte Google ou avec le bouton « Déconnecter ».
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom affiché de l&apos;expéditeur <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.fromName}
              onChange={(e) => setForm({ ...form, fromName: e.target.value })}
              placeholder="Ex : Complexe Scolaire Mon Avenir Plus"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Tel qu&apos;il apparaîtra chez les destinaires : « Nom &lt;adresse&gt; ».</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresse d&apos;envoi (Gmail de l&apos;école) <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.fromEmail}
              onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
              placeholder="ecole@gmail.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {modeChoice === "google"
                ? "Facultatif — pré-sélectionne le compte Google au moment de l'autorisation. L'adresse réellement autorisée devient l'adresse d'envoi."
                : "Gmail impose que l'adresse d'envoi soit celle du compte authentifié."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse de réponse (Reply-To)</label>
            <input
              type="email"
              value={form.replyTo}
              onChange={(e) => setForm({ ...form, replyTo: e.target.value })}
              placeholder={form.fromEmail || "ecole@gmail.com"}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Par défaut la même adresse — modifiable.</p>
          </div>

          {modeChoice === "smtp" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Serveur SMTP</label>
                  <input
                    type="text"
                    value={form.smtpHost}
                    onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                  <select
                    value={form.smtpPort}
                    onChange={(e) => setForm({ ...form, smtpPort: Number(e.target.value) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={587}>587 (STARTTLS — défaut)</option>
                    <option value={465}>465 (SSL)</option>
                    <option value={2525}>2525 (relais SMTP professionnel)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Identifiant SMTP</label>
                <input
                  type="text"
                  value={form.smtpUser}
                  onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                  placeholder={form.fromEmail || "ecole@gmail.com"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">En général l&apos;adresse Gmail elle-même.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe d&apos;application{" "}
                  {settings?.secretSet && <span className="text-green-600 font-normal">(enregistré : ••••)</span>}
                </label>
                <input
                  type="password"
                  value={form.smtpPassword}
                  onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })}
                  placeholder={settings?.secretSet ? "•••• (laisser vide pour conserver)" : "16 caractères générés par Google"}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Protégé côté serveur — jamais réaffiché après l&apos;enregistrement.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {modeChoice === "google" ? (
            <button
              onClick={connectGoogle}
              disabled={googleConnecting || !googleAvailable}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
              {settings?.mode === "google_oauth" ? "Reconnecter Google" : "Connecter Google"}
            </button>
          ) : (
            <button
              onClick={saveConfig}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer et vérifier
            </button>
          )}

          {/* 5. Bouton test — vers l'adresse de l'utilisateur connecté */}
          <button
            onClick={sendTest}
            disabled={testDisabled}
            title={
              !settings?.configured
                ? "Enregistrez d'abord la configuration"
                : (usage?.testCountLastHour ?? 0) >= 5
                  ? "Limite de 5 essais par heure"
                  : `Enverra un test à ${(user as any)?.email || "votre adresse"}`
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer un e-mail test
          </button>
        </div>

        {modeChoice === "google" && (
          <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Si Google affiche « Google n&apos;a pas validé cette application » : cliquez sur{" "}
            <strong>Paramètres avancés</strong> (lien discret en bas de la page Google), puis sur{" "}
            <strong>Continuer vers Academia Helm (non sécurisé)</strong>. C&apos;est un écran normal
            en attendant la vérification de l&apos;application par Google — vos e-mails restent protégés.
          </p>
        )}
      </div>

      {/* ═══ 9. Guide pas à pas pour le directeur ════════════════════════ */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center gap-2 p-4 text-left font-medium text-gray-800 hover:bg-gray-50 rounded-lg"
        >
          <HelpCircle className="h-4 w-4 text-blue-600" />
          Guide : connecter le Gmail de l&apos;école
          <span className="ml-auto text-gray-400 text-sm">{showGuide ? "Masquer" : "Afficher"}</span>
        </button>
        {showGuide && (
          <div className="px-4 pb-4 space-y-4 text-sm text-gray-700">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
              <div className="font-semibold text-blue-900 flex items-center gap-2">
                <Chrome className="h-4 w-4" /> Méthode recommandée — Google OAuth2 (sans mot de passe)
              </div>
              <ol className="space-y-2 list-decimal list-inside text-blue-900/90">
                <li>Sélectionnez le mode <strong>Google (OAuth2)</strong> ci-dessus, vérifiez le nom affiché de l&apos;école, puis cliquez <strong>Connecter Google</strong>.</li>
                <li>Sur la page Google qui s&apos;ouvre, sélectionnez le compte Gmail de l&apos;école.</li>
                <li>Si Google affiche l&apos;avertissement « Google n&apos;a pas validé cette application » : cliquez sur <strong>Paramètres avancés</strong> (lien discret en bas de la page), puis sur <strong>Continuer vers Academia Helm (non sécurisé)</strong> — écran normal en attendant la vérification de l&apos;application par Google.</li>
                <li>Validez « Envoyer des e-mails en votre nom ». Vous revenez automatiquement ici — le statut passe à <strong>Actif</strong>.</li>
              </ol>
              <p className="text-xs text-blue-900/70">
                Fonctionne même si le compte n&apos;a pas de validation en deux étapes ni de mot de passe d&apos;application
                (y compris Google Workspace). L&apos;autorisation se révoque depuis le compte Google → Sécurité → Applications tierces.
              </p>
            </div>

            <div className="font-medium text-gray-800">Variante — SMTP avec mot de passe d&apos;application</div>
            <ol className="space-y-3 list-decimal list-inside">
              <li>
                <strong>Activez la validation en deux étapes</strong> sur le compte Google de l&apos;école
                (obligatoire pour créer un mot de passe d&apos;application) :{" "}
                <a
                  href="https://myaccount.google.com/security"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline inline-flex items-center gap-1"
                >
                  myaccount.google.com/security <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                Ouvrez la page des <strong>mots de passe d&apos;application</strong> :{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline inline-flex items-center gap-1"
                >
                  myaccount.google.com/apppasswords <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                Créez un mot de passe nommé <strong>« Academia Helm »</strong> — Google affiche un code
                de 16 caractères (ex : <code className="bg-gray-100 rounded px-1">abcd efgh ijkl mnop</code>).
              </li>
              <li>
                Copiez ce code dans le champ <strong>Mot de passe d&apos;application</strong> ci-dessus,
                puis cliquez <strong>Enregistrer et vérifier</strong>. Utilisez enfin
                <strong> Envoyer un e-mail test</strong> pour confirmer.
              </li>
            </ol>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800 text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>Attention — Google Workspace :</strong> certains comptes Google Workspace
                (domaine professionnel de l&apos;école) interdisent les mots de passe d&apos;application.
                Demandez alors à l&apos;administrateur Workspace de votre école de les autoriser
                (Console d&apos;administration → Sécurité → Contrôle des accès → Mots de passe des applications).
                La connexion Google (OAuth2) ci-dessus supprime cette contrainte.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ 7. Journal des 50 derniers envois ═══════════════════════════ */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-gray-100 font-medium text-gray-800">
          <PlugZap className="h-4 w-4 text-blue-600" /> Journal des 50 derniers envois
        </div>
        {logEntries.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Aucun envoi enregistré pour le moment.
            Les e-mails des modules (messagerie, bulletins, relances, convocations, RH…) apparaîtront ici.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Module</th>
                  <th className="px-4 py-2 font-medium">Destinataire</th>
                  <th className="px-4 py-2 font-medium">Objet</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {logEntries.map((e) => {
                  const meta = SEND_STATUS_META[e.status] || { label: e.status, color: "bg-gray-100 text-gray-700" };
                  return (
                    <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{MODULE_LABELS[e.module] || e.module}</td>
                      <td className="px-4 py-2">{e.recipient}</td>
                      <td className="px-4 py-2 text-gray-600 max-w-[240px] truncate" title={e.subject}>{e.subject}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", meta.color)}>
                          {meta.label}
                        </span>
                        {e.errorCode && <span className="ml-1 text-[10px] text-gray-400">{e.errorCode}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rappel pédagogique */}
      <div className="text-xs text-gray-500 leading-relaxed">
        Une fois la connexion active, tous les e-mails de votre école (messagerie pédagogique, dossiers élèves,
        reçus et relances de scolarité, convocations et bulletins d&apos;examens, communications au personnel)
        partent depuis cette adresse Gmail — avec un plafond de {usage?.dailyCap ?? 490} destinataires par 24 h
        et un débit de 20 envois/minute, conformément aux limites Gmail. Les e-mails système d&apos;Academia Helm
        (réinitialisation de mot de passe, invitations) continuent de passer par la plateforme.
      </div>
    </div>
  );
}
