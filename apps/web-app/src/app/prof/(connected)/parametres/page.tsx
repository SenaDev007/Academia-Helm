'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — PARAMÈTRES
 * ============================================================================
 *
 * Quatre onglets :
 *   1. Niveaux & classes    : activation/désactivation Maternelle / Primaire
 *      → POST /teacher-portal/levels (re-provisionnement auto des
 *      classes + matières) — SECONDAIRE masqué depuis le 2026-10-16
 *   2. Identité des documents : en-têtes / pieds de page de TOUS les documents
 *      générés (cahiers, fiches, bulletins) — GET/POST /api/settings/identity
 *   3. Abonnement            : état de l'abonnement Helm Enseignant
 *   4. Inviter mon promoteur : boucle de croissance B2B
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Circle,
  School,
  FileText,
  CreditCard,
  Users,
  Save,
  RefreshCw,
  Mail,
  CalendarClock,
  Timer,
  ShieldCheck,
} from 'lucide-react';
import apiClient from '@/lib/api/client';
import { useAppSession } from '@/contexts/AppSessionContext';

type LevelCode = 'MATERNELLE' | 'PRIMAIRE' | 'SECONDAIRE';

interface LevelState {
  code: LevelCode;
  name: string;
  label: string;
  isActive: boolean;
}

/**
 * ⭐ 2026-10-16 — SECONDAIRE masqué dans l'application enseignant : le niveau
 * n'est plus proposé (landing, inscription, paramètres). On le filtre de
 * l'affichage — les tenants existants qui l'auraient activé conservent leurs
 * données, mais il n'est plus activable depuis l'interface.
 */
const HIDDEN_LEVEL_CODES: LevelCode[] = ['SECONDAIRE'];

interface IdentityForm {
  schoolName: string;
  slogan: string;
  address: string;
  phonePrimary: string;
  email: string;
}

const TABS = [
  { id: 'niveaux', label: 'Niveaux & classes', icon: School },
  { id: 'identite', label: 'Identité des documents', icon: FileText },
  { id: 'abonnement', label: 'Abonnement', icon: CreditCard },
  { id: 'promoteur', label: 'Inviter mon promoteur', icon: Users },
] as const;

type TabId = (typeof TABS)[number]['id'];

const LEVEL_DESCRIPTIONS: Record<LevelCode, string> = {
  MATERNELLE: 'Maternelle 1 et 2 — 17 matières (langage, pré-lecture, pré-mathématique…)',
  PRIMAIRE: 'CI à CM2 — 9 matières (lecture, expression écrite, mathématiques, EST…)',
  SECONDAIRE: '6ème à la Terminale, toutes séries — 10 matières',
};

export default function ProfParametresPage() {
  const searchParams = useSearchParams();
  const { user, tenant } = useAppSession();
  // Niveaux masqués mais ACTIFS côté serveur (ex. SECONDAIRE activé avant le
  // retrait de l'offre) : conservés tels quels lors des sauvegardes pour ne
  // jamais désactiver silencieusement un niveau en cours d'utilisation.
  const hiddenActiveLevelsRef = useRef<LevelCode[]>([]);
  const [tab, setTab] = useState<TabId>((searchParams.get('tab') as TabId) || 'niveaux');
  const [levels, setLevels] = useState<LevelState[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(true);
  const [levelsSaving, setLevelsSaving] = useState(false);
  const [levelsMessage, setLevelsMessage] = useState<string | null>(null);
  const [levelsError, setLevelsError] = useState<string | null>(null);

  const [identity, setIdentity] = useState<IdentityForm>({
    schoolName: '',
    slogan: '',
    address: '',
    phonePrimary: '',
    email: '',
  });
  const [identityLoading, setIdentityLoading] = useState(true);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityMessage, setIdentityMessage] = useState<string | null>(null);

  const [subscription, setSubscription] = useState<any>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSchool, setInviteSchool] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; message: string } | null>(null);

  // ── Chargement initial : profil de l'espace ──
  const loadProfile = useCallback(async () => {
    try {
      const response = await apiClient.get('/teacher-portal/profile', { timeout: 15000 });
      const data = response.data;
      setLevels(
        (data.levels || [])
          .filter((l: any) => {
            if (HIDDEN_LEVEL_CODES.includes(l.code as LevelCode)) {
              if (l.isActive) hiddenActiveLevelsRef.current = [...new Set([...hiddenActiveLevelsRef.current, l.code as LevelCode])];
              return false;
            }
            return true;
          })
          .map((l: any) => ({
            code: l.code as LevelCode,
            name: l.name,
            label: l.label,
            isActive: l.isActive,
          })),
      );
      setSubscription(data.subscription);
      if (data.identity) {
        setIdentity({
          schoolName: data.identity.schoolName || '',
          slogan: data.identity.slogan || '',
          address: data.identity.address || '',
          phonePrimary: data.identity.phonePrimary || '',
          email: data.identity.email || '',
        });
      }
    } catch {
      setLevelsError('Impossible de charger vos paramètres.');
    } finally {
      setLevelsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    // Identité documentaire — lecture directe de la version active
    (async () => {
      try {
        const response = await fetch('/api/settings/identity', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data && typeof data === 'object' && data.schoolName) {
            setIdentity((prev) => ({
              ...prev,
              schoolName: data.schoolName || prev.schoolName,
              slogan: data.slogan || prev.slogan,
              address: data.address || prev.address,
              phonePrimary: data.phonePrimary || prev.phonePrimary,
              email: data.email || prev.email,
            }));
          }
        }
      } catch {
        // silencieux — fallback sur le profil
      } finally {
        setIdentityLoading(false);
      }
    })();
  }, [loadProfile]);

  // ── Activation / désactivation d'un niveau ──
  const toggleLevel = async (code: LevelCode) => {
    if (levelsSaving) return;
    const next = levels.map((l) => (l.code === code ? { ...l, isActive: !l.isActive } : l));
    if (next.every((l) => !l.isActive)) {
      setLevelsError('Au moins un niveau doit rester activé.');
      return;
    }
    setLevels(next);
  };

  const saveLevels = async () => {
    setLevelsSaving(true);
    setLevelsMessage(null);
    setLevelsError(null);
    try {
      const activeCodes = [
        ...levels.filter((l) => l.isActive).map((l) => l.code),
        // Niveaux masqués déjà actifs : inchangés (pas de désactivation silencieuse)
        ...hiddenActiveLevelsRef.current,
      ];
      await apiClient.post('/teacher-portal/levels', { levels: activeCodes }, { timeout: 60000 });
      setLevelsMessage(
        'Niveaux mis à jour — les classes et matières ont été réinstallées pour votre espace.',
      );
      await loadProfile();
    } catch (e: any) {
      setLevelsError(e?.response?.data?.message || 'Échec de la mise à jour des niveaux.');
      await loadProfile();
    } finally {
      setLevelsSaving(false);
    }
  };

  // ── Identité documentaire ──
  const saveIdentity = async () => {
    setIdentitySaving(true);
    setIdentityMessage(null);
    try {
      const response = await fetch('/api/settings/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          schoolName: identity.schoolName.trim() || 'Espace enseignant',
          slogan: identity.slogan.trim() || undefined,
          address: identity.address.trim() || undefined,
          phonePrimary: identity.phonePrimary.trim() || undefined,
          email: identity.email.trim() || undefined,
          changeReason: 'Mise à jour depuis Helm Enseignant',
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Échec de l’enregistrement de l’identité.');
      }
      setIdentityMessage(
        'Identité enregistrée — vos prochains documents utiliseront ces en-têtes.',
      );
    } catch (e: any) {
      setIdentityMessage(null);
      setLevelsError(e?.message || 'Erreur d’enregistrement.');
    } finally {
      setIdentitySaving(false);
    }
  };

  // ── Invitation promoteur ──
  const sendInvite = async () => {
    if (!inviteEmail.trim() || inviteSending) return;
    setInviteSending(true);
    setInviteResult(null);
    try {
      const response = await apiClient.post(
        '/teacher-portal/invite-promoter',
        {
          promoterEmail: inviteEmail.trim(),
          schoolName: inviteSchool.trim() || undefined,
        },
        { timeout: 20000 },
      );
      setInviteResult({
        ok: true,
        message:
          response.data?.message ||
          'Invitation envoyée. Vous pouvez aussi partager ce lien avec votre promoteur.',
      });
      if (response.data?.inviteLink) {
        setInviteResult((prev) =>
          prev ? { ...prev, message: `${prev.message} Lien : ${response.data.inviteLink}` } : prev,
        );
      }
    } catch (e: any) {
      setInviteResult({
        ok: false,
        message: e?.response?.data?.message || 'Échec de l’envoi de l’invitation.',
      });
    } finally {
      setInviteSending(false);
    }
  };

  if (levelsLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Chargement de vos paramètres…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ── Onglets ── */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-teal-50 text-teal-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Onglet : Niveaux & classes ── */}
      {tab === 'niveaux' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Niveaux de votre espace</h2>
            <p className="mt-1 text-sm text-slate-500">
              Activez ou désactivez un niveau : le système installe (ou retire) automatiquement
              toutes les classes et matières correspondantes.
            </p>
          </div>

          <div className="space-y-3">
            {levels.map((level) => (
              <button
                key={level.code}
                onClick={() => toggleLevel(level.code)}
                disabled={levelsSaving}
                className={`w-full rounded-xl border-2 p-4 text-left transition-all disabled:opacity-60 ${
                  level.isActive
                    ? 'border-teal-500 bg-teal-50/60'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Niveau {level.label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {LEVEL_DESCRIPTIONS[level.code]}
                    </p>
                  </div>
                  {level.isActive ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-slate-300" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {levelsMessage && (
            <div className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {levelsMessage}
            </div>
          )}
          {levelsError && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {levelsError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={saveLevels}
              disabled={levelsSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {levelsSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {levelsSaving ? 'Réinstallation en cours…' : 'Enregistrer les niveaux'}
            </button>
          </div>
        </div>
      )}

      {/* ── Onglet : Identité des documents ── */}
      {tab === 'identite' && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Identité de vos documents</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ces informations composent les en-têtes et pieds de page de tous vos documents
              imprimables : cahier journal, fiches pédagogiques, bulletins…
            </p>
          </div>

          {identityLoading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement…
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Nom affiché (en-tête principal)
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                  placeholder={tenant?.name || 'Espace de …'}
                  value={identity.schoolName}
                  onChange={(e) => setIdentity({ ...identity, schoolName: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Exemple : votre nom, ou « {user?.firstName} {user?.lastName} — Enseignant »
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Devise / slogan (optionnel)
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                  placeholder="Ex : Le savoir bâtit la nation"
                  value={identity.slogan}
                  onChange={(e) => setIdentity({ ...identity, slogan: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Téléphone (pied de page)
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                  placeholder="+229 …"
                  value={identity.phonePrimary}
                  onChange={(e) => setIdentity({ ...identity, phonePrimary: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Adresse (optionnel)
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                  placeholder="Quartier, ville…"
                  value={identity.address}
                  onChange={(e) => setIdentity({ ...identity, address: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email (pied de page)
                </label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                  placeholder={user?.email || 'vous@example.com'}
                  value={identity.email}
                  onChange={(e) => setIdentity({ ...identity, email: e.target.value })}
                />
              </div>
            </div>
          )}

          {identityMessage && (
            <div className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {identityMessage}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={saveIdentity}
              disabled={identitySaving}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {identitySaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Enregistrer l’identité
            </button>
          </div>
        </div>
      )}

      {/* ── Onglet : Abonnement ── */}
      {tab === 'abonnement' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Abonnement Helm Enseignant</h2>
            <p className="mt-1 text-sm text-slate-500">
              Votre abonnement personnel — 2 000 FCFA / mois, résiliable à tout moment.
            </p>
          </div>

          {subscription ? (
            <AbonnementPanel subscription={subscription} />
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Compteur non activé</p>
                  <p className="mt-1">
                    Activez votre abonnement mensuel (2 000 FCFA / mois) pour démarrer votre
                    compteur de 30 jours. Le paiement est sécurisé — vous recevrez un rappel par
                    email 7 jours puis 24 heures avant l’expiration, et votre espace reste
                    accessible 7 jours de grâce après l’expiration.
                  </p>
                </div>
              </div>
              <a
                href="/prof/checkout"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 sm:w-auto sm:px-8"
              >
                <CreditCard className="h-4 w-4" />
                Activer mon abonnement — 2 000 FCFA / mois
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── Onglet : Inviter mon promoteur ── */}
      {tab === 'promoteur' && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Inviter mon promoteur</h2>
            <p className="mt-1 text-sm text-slate-500">
              Vous préparez déjà vos classes avec Helm Enseignant ? Faites découvrir Academia Helm
              au promoteur de votre école — inscriptions, frais de scolarité, notes, bulletins,
              communication parents, toute l’école sur une seule plateforme.
            </p>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Email du promoteur
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-teal-500 focus:outline-none"
                  placeholder="promoteur@ecole.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Nom de l’école (optionnel)
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none"
                placeholder="Ex : CSP Sainte Rita"
                value={inviteSchool}
                onChange={(e) => setInviteSchool(e.target.value)}
              />
            </div>
          </div>

          {inviteResult && (
            <div
              className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
                inviteResult.ok
                  ? 'border-teal-200 bg-teal-50 text-teal-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              {inviteResult.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              {inviteResult.message}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={sendInvite}
              disabled={inviteSending || !inviteEmail.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {inviteSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              Envoyer l’invitation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ⭐ Panneau Abonnement — compteur activé + décompte en temps réel.
 *
 * États affichés :
 *   - ACTIVE        : compteur vert, jours restants, date d'expiration, CTA renouvellement ;
 *   - GRACE_PERIOD  : bandeau ambre (7 jours de grâce) + CTA renouvellement ;
 *   - SUSPENDED     : bandeau rouge (compte inactif) + CTA réactivation ;
 *   - TRIALING      : compteur non encore activé + CTA activation.
 */
function AbonnementPanel({ subscription }: { subscription: any }) {
  const status = String(subscription?.status ?? '').toUpperCase();
  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;
  const graceEnd = subscription?.gracePeriodEnd
    ? new Date(subscription.gracePeriodEnd)
    : null;
  const lastPayment = subscription?.lastPaymentDate
    ? new Date(subscription.lastPaymentDate)
    : null;
  const periodStart = subscription?.currentPeriodStart
    ? new Date(subscription.currentPeriodStart)
    : null;

  const formatDate = (d: Date | null) =>
    d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const daysRemaining = Number(subscription?.daysRemaining ?? 0);
  const isSuspended = status === 'SUSPENDED' || status === 'BLOCKED';
  const isGrace = status === 'GRACE_PERIOD';
  const isActive = status === 'ACTIVE' || status === 'TRIALING';

  const statusBadge = isSuspended ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
      <AlertCircle className="h-3.5 w-3.5" />
      Compte inactif
    </span>
  ) : isGrace ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
      <Timer className="h-3.5 w-3.5" />
      Période de grâce
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Compteur activé
    </span>
  );

  return (
    <div className="space-y-4">
      {/* Bandeau d'état */}
      {isSuspended && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Compte inactif — réactivation requise</p>
            <p className="mt-1">
              Votre abonnement a expiré et la période de grâce de 7 jours est terminée. Réglez
              votre mensualité pour réactiver votre espace : un nouveau compteur de 30 jours
              démarrera immédiatement et vos données sont intégralement conservées.
            </p>
          </div>
        </div>
      )}
      {isGrace && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Timer className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Période de grâce en cours</p>
            <p className="mt-1">
              Votre abonnement a expiré, mais votre espace reste pleinement accessible jusqu’au{' '}
              <strong>{formatDate(graceEnd)}</strong>. Renouvelez dès maintenant pour éviter
              l’inactivation de votre compte.
            </p>
          </div>
        </div>
      )}

      {/* Carte du compteur */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">
            Formule : Helm Enseignant — Mensuel
          </p>
          {statusBadge}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Mensualité</p>
            <p className="mt-1.5 text-xl font-extrabold text-slate-900">
              {(Number(subscription?.monthlyAmount) || 2000).toLocaleString('fr-FR')} FCFA
            </p>
            <p className="mt-0.5 text-xs text-slate-500">par mois (30 jours)</p>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Jours restants
            </p>
            <p
              className={`mt-1.5 text-xl font-extrabold ${
                isSuspended ? 'text-red-600' : daysRemaining <= 7 ? 'text-amber-600' : 'text-teal-600'
              }`}
            >
              {isSuspended ? 0 : daysRemaining}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {isSuspended ? 'compte inactif' : 'sur 30 jours'}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 text-center shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {isSuspended ? 'Dernière validité' : 'Valide jusqu’au'}
            </p>
            <p className="mt-1.5 text-sm font-bold text-slate-900">{formatDate(periodEnd)}</p>
            {lastPayment && (
              <p className="mt-0.5 text-xs text-slate-500">
                Dernier paiement : {formatDate(lastPayment)}
              </p>
            )}
          </div>
        </div>

        {isActive && periodStart && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <CalendarClock className="h-3.5 w-3.5" />
            Décompte enregistré depuis le {formatDate(periodStart)} — renouvellement possible à
            tout moment, sans jour perdu.
          </p>
        )}
      </div>

      {/* Rappel du cycle de vie */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500">
        <p className="flex items-center gap-1.5 font-semibold text-slate-700">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
          Rappels automatiques avant expiration
        </p>
        <p className="mt-1">
          Un email vous est envoyé 7 jours puis 24 heures avant l’expiration de vos 30 jours.
          Après expiration, votre espace reste accessible 7 jours supplémentaires (période de
          grâce). Au-delà, le compte devient inactif — un simple paiement le réactive, vos
          données étant conservées.
        </p>
      </div>

      {/* CTA renouvellement / réactivation */}
      <a
        href="/prof/checkout?renew=1"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 sm:w-auto sm:px-8"
      >
        <CreditCard className="h-4 w-4" />
        {isSuspended
          ? 'Réactiver mon compte — 2 000 FCFA'
          : isGrace
            ? 'Renouveler et sécuriser mon accès — 2 000 FCFA'
            : 'Renouveler maintenant (+30 jours) — 2 000 FCFA'}
      </a>
    </div>
  );
}
