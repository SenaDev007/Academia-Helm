"use client";

/**
 * ============================================================================
 * SchoolEmailTab — Onglet Paramètres → E-mail
 * ============================================================================
 *
 * ⭐ 2026-11-26 (retour promoteur) — DEUX évolutions majeures :
 *
 * 1. SMTP DÉSACTIVÉ — les ports SMTP sortants n'étant pas joignables depuis
 *    notre hébergement actuel, la voie SMTP est GRISÉE avec un badge
 *    « Non disponible pour le moment ». Seule la connexion Google (API Gmail
 *    via HTTPS) est active. Aucun texte technique d'infrastructure n'est
 *    exposé à l'école.
 *
 * 2. DOUBLE IDENTITÉ PAR NIVEAU SCOLAIRE — les écoles combinées
 *    (maternelle/primaire + secondaire, cf. onglet Identité) configurent
 *    UNE connexion Google PAR niveau :
 *      • « Maternel & Primaire » — adresse d'envoi de ce côté de l'école ;
 *      • « Secondaire » — sa propre adresse (dynamique : n'apparaît que si
 *        le niveau secondaire est activé dans Paramètres > Structure).
 *    Le routage des envois est AUTOMATIQUE : la classe de l'élève (reçus,
 *    relances, bulletins) ou le niveau du personnel (RH) détermine l'adresse
 *    utilisée. Sans connexion secondaire configurée, tout part de la
 *    connexion principale (repli transparent).
 *
 * Contenu :
 *   1. Bandeau(x) de statut par niveau : Non configuré / Actif / Expiré /
 *      Erreur + dernière vérification + Déconnecter (modal personnalisé).
 *   2. Choix du mode : Google (actif) / SMTP (grisé — non disponible).
 *   3. Formulaire par niveau : nom affiché, adresse d'envoi, Reply-To.
 *   4. « Connecter Google » (OAuth2 PKCE) + « Envoyer un e-mail test ».
 *   5. Compteur global du jour : X envoyés sur 490 + remise à zéro.
 *   6. Journal des 50 derniers envois : date, module, destinataire, statut.
 *   7. Guide pas à pas intégré pour le directeur.
 *
 * Endpoints (BFF → api-server /school-email/*) :
 *   GET  /api/school-email          → { settings, secondarySettings,
 *                                       secondaryEnabled, usage }
 *   POST /api/school-email/google/start → consentement (levelCategory)
 *   POST /api/school-email/test     → e-mail de test (levelCategory)
 *   GET  /api/school-email/log      → { entries }
 *   POST /api/school-email/disconnect → supprime les secrets (levelCategory)
 * ============================================================================
 */

import { useState, useEffect, useCallback, type SVGProps } from "react";
import {
  Mail, Loader2, Send, PlugZap, CheckCircle2, AlertTriangle,
  XCircle, Clock, HelpCircle, ShieldCheck,
  RefreshCw, Inbox, LogOut, Chrome, Baby, GraduationCap, Ban,
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

/** Niveau d'identité — clé de toute la configuration par niveau. */
type LevelKey = "primary" | "secondary";

const LEVEL_META: Record<
  LevelKey,
  { label: string; levelCategory: "MATERNAL_PRIMARY" | "SECONDARY"; icon: typeof Mail; accent: string; hint: string }
> = {
  primary: {
    label: "Maternel & Primaire",
    levelCategory: "MATERNAL_PRIMARY",
    icon: Baby,
    accent: "emerald",
    hint: "Messages des classes de maternelle et de primaire, et du personnel rattaché à ce niveau.",
  },
  secondary: {
    label: "Secondaire",
    levelCategory: "SECONDARY",
    icon: GraduationCap,
    accent: "blue",
    hint: "Messages des classes du secondaire et du personnel du secondaire (adresse propre au niveau).",
  },
};

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

interface LevelForm {
  fromName: string;
  fromEmail: string;
  replyTo: string;
}

const EMPTY_FORM: LevelForm = { fromName: "", fromEmail: "", replyTo: "" };

// ─── Composant principal ────────────────────────────────────────────────────

export function SchoolEmailTab() {
  const { user, tenant } = useAppSession();

  const [loading, setLoading] = useState(true);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  // ⭐ Double identité : vues par niveau + drapeau école mixte.
  const [secondaryEnabled, setSecondaryEnabled] = useState(false);
  const [views, setViews] = useState<Record<LevelKey, SchoolEmailSettingsView | null>>({
    primary: null,
    secondary: null,
  });

  const [usage, setUsage] = useState<SchoolEmailUsageView | null>(null);
  const [logEntries, setLogEntries] = useState<EmailSendLogEntry[]>([]);

  // Formulaire PAR niveau (les secrets ne sont JAMAIS chargés).
  const [forms, setForms] = useState<Record<LevelKey, LevelForm>>({
    primary: { ...EMPTY_FORM },
    secondary: { ...EMPTY_FORM },
  });

  // Actions en cours PAR niveau.
  const [googleConnecting, setGoogleConnecting] = useState<LevelKey | null>(null);
  const [testing, setTesting] = useState<LevelKey | null>(null);
  const [disconnecting, setDisconnecting] = useState<LevelKey | null>(null);
  // ⭐ Modal de déconnexion personnalisé (niveau ciblé).
  const [confirmDisconnect, setConfirmDisconnect] = useState<LevelKey | null>(null);

  const [showGuide, setShowGuide] = useState(false);

  // ─── Chargement initial ────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, logRes] = await Promise.all([
        fetch("/api/school-email", { credentials: "include", cache: "no-store" }),
        fetch("/api/school-email/log", { credentials: "include", cache: "no-store" }),
      ]);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setGoogleAvailable(Boolean(data.googleOauthAvailable));
        setSecondaryEnabled(Boolean(data.secondaryEnabled));
        setViews({
          primary: data.settings || null,
          secondary: data.secondarySettings || null,
        });
        setUsage(data.usage);

        // Pré-remplissage par niveau : réglages existants > nom de l'école
        // (le secondaire retombe côté API sur l'identité du niveau de l'onglet
        // Identité — on laisse le champ vide pour ne pas deviner).
        const primary = data.settings;
        const secondary = data.secondarySettings;
        setForms({
          primary: {
            fromName: primary?.fromName || tenant?.name || "",
            fromEmail: primary?.fromEmail || "",
            replyTo: primary?.replyTo || primary?.fromEmail || "",
          },
          secondary: {
            fromName: secondary?.fromName || "",
            fromEmail: secondary?.fromEmail || "",
            replyTo: secondary?.replyTo || secondary?.fromEmail || "",
          },
        });
        if (data.secondaryEnabled && !secondary?.configured) setShowGuide(true);
        else if (!primary?.configured) setShowGuide(true);
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
      toast.success("Compte Google connecté — les e-mails de ce niveau partent désormais via Google OAuth2.", { duration: 8000 });
    } else if (google === "erreur") {
      const motif = params.get("motif");
      let msg = "La connexion Google a échoué.";
      try { if (motif) msg = decodeURIComponent(motif); } catch { /* brut */ }
      toast.error(msg, { duration: 10000 });
    }
    if (google) {
      params.delete("google");
      params.delete("motif");
      params.delete("tenant");
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

  // ─── Connexion Google OAuth2 (par niveau) ────────────────────────────
  const connectGoogle = async (level: LevelKey): Promise<void> => {
    const meta = LEVEL_META[level];
    const form = forms[level];
    if (!form.fromName.trim()) {
      toast.error(`Le nom affiché de l'expéditeur est requis (${meta.label}).`);
      return;
    }
    setGoogleConnecting(level);
    try {
      const res = await fetch("/api/school-email/google/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromName: form.fromName.trim(),
          ...(form.fromEmail.trim() ? { fromEmail: form.fromEmail.trim() } : {}),
          ...(form.replyTo.trim() ? { replyTo: form.replyTo.trim() } : {}),
          // ⭐ Double identité — le state OAuth transporte le niveau visé.
          levelCategory: meta.levelCategory,
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
      setGoogleConnecting(null);
    }
  };

  // ─── E-mail de test (par niveau) ─────────────────────────────────────
  const sendTest = async (level: LevelKey): Promise<void> => {
    const email = (user as any)?.email;
    if (!email) {
      toast.error("Aucune adresse e-mail sur votre compte utilisateur.");
      return;
    }
    setTesting(level);
    try {
      const res = await fetch("/api/school-email/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelCategory: LEVEL_META[level].levelCategory }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success(data.message || `E-mail de test envoyé à ${email}.`, { duration: 8000 });
      } else if (res.status === 403) {
        toast.error(data?.message || "Limite de 5 e-mails de test par heure atteinte.");
      } else {
        toast.error(data?.message || data?.error || "Échec de l'envoi du test.", { duration: 8000 });
      }
      // Rafraîchit le compteur + les statuts
      const sres = await fetch("/api/school-email", { credentials: "include", cache: "no-store" });
      if (sres.ok) {
        const d = await sres.json();
        setUsage(d.usage);
        setViews({ primary: d.settings || null, secondary: d.secondarySettings || null });
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau pendant l'envoi du test.");
    } finally {
      setTesting(null);
    }
  };

  // ─── Déconnexion (par niveau, modal personnalisé) ──────────────────────
  const disconnect = async (level: LevelKey) => {
    setDisconnecting(level);
    try {
      const res = await fetch("/api/school-email/disconnect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelCategory: LEVEL_META[level].levelCategory }),
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
      setDisconnecting(null);
      setConfirmDisconnect(null);
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

  const levels: LevelKey[] = secondaryEnabled ? ["primary", "secondary"] : ["primary"];

  return (
    <div className="space-y-6">

      {/* ═══ Bandeau double identité (écoles combinées) ═════════════════ */}
      {secondaryEnabled && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 flex items-start gap-3 text-violet-900">
          <div className="rounded-lg bg-violet-100 p-2 shrink-0 mt-0.5">
            <GraduationCap className="h-5 w-5 text-violet-700" />
          </div>
          <div className="text-sm">
            <strong>Double identité détectée — une adresse d&apos;envoi par niveau.</strong>
            <p className="mt-1 text-violet-800/90 leading-relaxed">
              Votre établissement combine maternelle/primaire et secondaire : configurez une connexion Google
              pour chaque niveau ci-dessous. Les e-mails partent ensuite automatiquement de la bonne adresse —
              les messages liés aux classes du secondaire (reçus, relances, convocations) utilisent l&apos;adresse
              du secondaire, ceux des classes de maternelle/primaire utilisent la première adresse. Le personnel
              suit la même règle (niveau de sa fiche). Tant que la connexion du secondaire n&apos;est pas
              configurée, tout part de la connexion « Maternel &amp; Primaire ».
            </p>
          </div>
        </div>
      )}

      {/* ═══ 1. Bandeaux de statut par niveau ═══════════════════════════ */}
      {levels.map((level) => {
        const meta = LEVEL_META[level];
        const view = views[level];
        const st = STATUS_META[view?.status || "non_configure"];
        const StatusIcon = st.icon;
        const LevelIcon = meta.icon;
        const testDisabled =
          testing !== null || !view?.configured || (usage?.testCountLastHour ?? 0) >= 5;
        const form = forms[level];
        const isSecondary = level === "secondary";

        return (
          <div key={level} className="space-y-4">
            <div className={cn("rounded-lg border p-4 flex flex-wrap items-center gap-3", st.color)}>
              <LevelIcon className="h-5 w-5 shrink-0" />
              <div className="flex-1 min-w-[220px]">
                <div className="font-semibold">
                  <span className={isSecondary ? "text-[#1A2BA6]" : "text-emerald-700"}>{meta.label}</span>
                  {" — "}
                  {st.label}
                </div>
                <div className="text-xs opacity-80">
                  {view?.configured
                    ? `${view.fromName} — ${view.fromEmail} · Google OAuth2`
                    : `Aucune adresse d'envoi configurée pour le niveau ${meta.label.toLowerCase()}.`}
                  {view?.lastVerifiedAt && ` · Dernière vérification : ${fmtDate(view.lastVerifiedAt)}`}
                </div>
                {view?.lastError && (
                  <div className="text-xs mt-1 bg-white/60 rounded px-2 py-1 border border-red-200 text-red-700">
                    {view.lastError}
                  </div>
                )}
              </div>
              {view?.configured && (
                <button
                  onClick={() => setConfirmDisconnect(level)}
                  disabled={disconnecting !== null}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                >
                  {disconnecting === level ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  Déconnecter
                </button>
              )}
            </div>

            {/* ── Formulaire du niveau (Google actif / SMTP grisé) ── */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
              <div className="font-medium text-gray-800 flex items-center gap-2">
                <Chrome className="h-4 w-4 text-blue-600" />
                Connexion Google — {meta.label}
                {view?.mode === "google_oauth" && view?.configured && (
                  <span className="ml-auto text-[10px] uppercase tracking-wide bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                    Connecté
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-500 -mt-2">{meta.hint}</p>

              {view?.mode === "google_oauth" && view?.configured && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    Compte actuellement connecté : <strong>{view.fromEmail}</strong>. Cliquer à nouveau sur
                    « Connecter Google » remplace le jeton (utile après un changement de compte ou une révocation).
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  Vous serez redirigé vers Google pour autoriser l&apos;envoi des e-mails de ce niveau
                  depuis son compte Gmail. L&apos;autorisation peut être révoquée à tout moment, depuis
                  votre compte Google ou avec le bouton « Déconnecter ».
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom affiché de l&apos;expéditeur <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.fromName}
                    onChange={(e) => setForms({ ...forms, [level]: { ...form, fromName: e.target.value } })}
                    placeholder={isSecondary ? "Ex : Lycée Mon Avenir Plus" : "Ex : Complexe Scolaire Mon Avenir Plus"}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Tel qu&apos;il apparaîtra chez les destinaires : « Nom &lt;adresse&gt; ».</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse d&apos;envoi (Gmail du niveau) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.fromEmail}
                    onChange={(e) => setForms({ ...forms, [level]: { ...form, fromEmail: e.target.value } })}
                    placeholder={isSecondary ? "secondaire.ecole@gmail.com" : "ecole@gmail.com"}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Facultatif — pré-sélectionne le compte Google au moment de l&apos;autorisation. L&apos;adresse
                    réellement autorisée devient l&apos;adresse d&apos;envoi.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse de réponse (Reply-To)</label>
                  <input
                    type="email"
                    value={form.replyTo}
                    onChange={(e) => setForms({ ...forms, [level]: { ...form, replyTo: e.target.value } })}
                    placeholder={form.fromEmail || "ecole@gmail.com"}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Par défaut la même adresse — modifiable.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => connectGoogle(level)}
                  disabled={googleConnecting !== null || !googleAvailable}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {googleConnecting === level ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
                  {view?.mode === "google_oauth" ? "Reconnecter Google" : "Connecter Google"}
                </button>

                <button
                  onClick={() => sendTest(level)}
                  disabled={testDisabled}
                  title={
                    !view?.configured
                      ? "Connectez d'abord le compte Google du niveau"
                      : (usage?.testCountLastHour ?? 0) >= 5
                        ? "Limite de 5 essais par heure"
                        : `Enverra un test à ${(user as any)?.email || "votre adresse"}`
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {testing === level ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer un e-mail test
                </button>
              </div>

              <p className="mt-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Si Google affiche « Google n&apos;a pas validé cette application » : cliquez sur{" "}
                <strong>Paramètres avancés</strong> (lien discret en bas de la page Google), puis sur{" "}
                <strong>Continuer vers Academia Helm (non sécurisé)</strong>. C&apos;est un écran normal
                en attendant la vérification de l&apos;application par Google — vos e-mails restent protégés.
              </p>
            </div>
          </div>
        );
      })}

      {/* ═══ Modal personnalisé de confirmation de déconnexion ═══════════ */}
      {confirmDisconnect && (() => {
        const level = confirmDisconnect;
        const meta = LEVEL_META[level];
        const view = views[level];
        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => !disconnecting && setConfirmDisconnect(null)}
          >
            <div
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-6 py-5 text-white" style={{ background: "#dc2626" }}>
                <div className="rounded-lg bg-white/15 p-2"><LogOut className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-base font-bold">
                    Déconnecter l&apos;e-mail {meta.label === "Maternel & Primaire" ? "Maternel & Primaire" : "du Secondaire"}
                  </h3>
                  <p className="text-xs text-white/70">Cette action interrompt l&apos;envoi des e-mails de ce niveau</p>
                </div>
              </div>
              <div className="p-6 space-y-3 text-sm text-slate-700">
                <p>
                  Le compte <strong>{view?.fromEmail || "de ce niveau"}</strong> (connexion Google) sera déconnecté
                  et la configuration enregistrée pour le niveau <strong>{meta.label}</strong> sera supprimée.
                  {level === "secondary" && " La connexion « Maternel & Primaire » reste intacte."}
                </p>
                <ul className="space-y-2 rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    Les e-mails de ce niveau (reçus, relances, convocations, communications au personnel) ne partiront plus.
                    {level === "secondary" && " En attendant une reconnexion, ils repartiront de la connexion « Maternel & Primaire »."}
                  </li>
                  <li className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    L&apos;autorisation Google pourra être rétablie à tout moment via « Connecter Google ».
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    Aucune donnée de l&apos;école (élèves, finances, RH…) n&apos;est affectée.
                  </li>
                </ul>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  onClick={() => setConfirmDisconnect(null)}
                  disabled={disconnecting !== null}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={() => disconnect(level)}
                  disabled={disconnecting !== null}
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition"
                  style={{ backgroundColor: "#dc2626" }}
                >
                  {disconnecting === level ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  Déconnecter
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══ 2. Choix du mode de connexion — Google actif / SMTP grisé ══ */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="font-medium text-gray-800 mb-3">Mode de connexion</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Google OAuth2 — seule voie active */}
          <div className="rounded-lg border-2 border-blue-500 bg-blue-50/50 p-4">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <Chrome className="h-4 w-4 text-blue-600" /> Google (OAuth2)
              <span className="ml-auto text-[10px] uppercase tracking-wide bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                Actif
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Connexion en un clic, sans mot de passe — l&apos;école autorise son compte Gmail et Academia Helm
              envoie en son nom (portée « envoyer des e-mails » uniquement).
            </p>
          </div>

          {/* SMTP — grisé, non disponible pour le moment */}
          <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-4 opacity-70 select-none cursor-not-allowed">
            <div className="flex items-center gap-2 font-semibold text-gray-500">
              <KeyRoundIcon className="h-4 w-4 text-gray-400" /> SMTP avec mot de passe d&apos;application
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
                <Ban className="h-3 w-3" /> Non disponible pour le moment
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              La connexion SMTP est momentanément indisponible sur la plateforme. Utilisez la connexion
              Google ci-dessus — sécurisée et fiable dans tous les environnements.
            </p>
            {/* Champs associés grisés (aperçu non éditable) */}
            <div className="mt-3 grid grid-cols-2 gap-2 opacity-60 pointer-events-none">
              <div className="rounded-md bg-gray-100 border border-gray-200 px-2 py-1.5 text-[11px] text-gray-400">
                Serveur SMTP
              </div>
              <div className="rounded-md bg-gray-100 border border-gray-200 px-2 py-1.5 text-[11px] text-gray-400">
                Port (587 / 465 / 2525)
              </div>
              <div className="rounded-md bg-gray-100 border border-gray-200 px-2 py-1.5 text-[11px] text-gray-400 col-span-2">
                Identifiant SMTP
              </div>
              <div className="rounded-md bg-gray-100 border border-gray-200 px-2 py-1.5 text-[11px] text-gray-400 col-span-2">
                Mot de passe d&apos;application
              </div>
            </div>
          </div>
        </div>
      </div>

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

      {/* ═══ 5. Compteur du jour (GLOBAL à l'école) ═════════════════════ */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 font-medium text-gray-800">
            <Inbox className="h-4 w-4 text-blue-600" /> Envois du jour — tous niveaux (fenêtre glissante 24 h)
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

      {/* ═══ 7. Guide pas à pas pour le directeur ════════════════════════ */}
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
                <Chrome className="h-4 w-4" /> Connexion Google (recommandée — sans mot de passe)
              </div>
              <ol className="space-y-2 list-decimal list-inside text-blue-900/90">
                <li>Vérifiez le <strong>nom affiché</strong> du niveau concerné ci-dessus, puis cliquez <strong>Connecter Google</strong>.</li>
                <li>Sur la page Google qui s&apos;ouvre, sélectionnez le compte Gmail du niveau (l&apos;adresse du secondaire pour la connexion « Secondaire »).</li>
                <li>Si Google affiche l&apos;avertissement « Google n&apos;a pas validé cette application » : cliquez sur <strong>Paramètres avancés</strong> (lien discret en bas de la page), puis sur <strong>Continuer vers Academia Helm (non sécurisé)</strong> — écran normal en attendant la vérification de l&apos;application par Google.</li>
                <li>Validez « Envoyer des e-mails en votre nom ». Vous revenez automatiquement ici — le statut du niveau passe à <strong>Actif</strong>.</li>
                {secondaryEnabled && (
                  <li>
                    École à double identité : <strong>répétez l&apos;opération pour chaque niveau</strong> (une adresse
                    Gmail par niveau) — les envois sont ensuite routés automatiquement selon la classe de l&apos;élève
                    ou le niveau du personnel.
                  </li>
                )}
              </ol>
              <p className="text-xs text-blue-900/70">
                Fonctionne même si le compte n&apos;a pas de validation en deux étapes ni de mot de passe
                d&apos;application (y compris Google Workspace). L&apos;autorisation se révoque depuis le compte
                Google → Sécurité → Applications tierces.
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-500 flex items-start gap-2">
              <Ban className="h-4 w-4 shrink-0 mt-0.5 text-gray-400" />
              <div>
                <strong className="text-gray-600">SMTP avec mot de passe d&apos;application :</strong> cette voie est
                momentanément indisponible sur la plateforme. Elle reviendra dans un prochain mise à jour —
                la connexion Google ci-dessus offre le même résultat sans aucune manipulation supplémentaire.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ 6. Journal des 50 derniers envois ═══════════════════════════ */}
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
        partent depuis {secondaryEnabled ? "l'adresse du niveau concerné" : "cette adresse Gmail"} — avec un plafond
        de {usage?.dailyCap ?? 490} destinataires par 24 h et un débit de 20 envois/minute, conformément aux limites
        Gmail. Les e-mails système d&apos;Academia Helm (réinitialisation de mot de passe, invitations) continuent de
        passer par la plateforme.
      </div>
    </div>
  );
}

/** Icône clé SMTP (locale — évite un import conditionnel dans le JSX). */
function KeyRoundIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
      <path d="m21 2-9.6 9.6" />
      <circle cx="7.5" cy="15.5" r="5.5" />
    </svg>
  );
}
