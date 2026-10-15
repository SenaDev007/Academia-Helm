'use client';

/**
 * ============================================================================
 * HELM ENSEIGNANT — PARAMÈTRES
 * ============================================================================
 *
 * Quatre onglets :
 *   1. Niveaux & classes    : activation/désactivation Maternelle / Primaire /
 *      Secondaire → POST /teacher-portal/levels (re-provisionnement auto des
 *      classes + matières)
 *   2. Identité des documents : en-têtes / pieds de page de TOUS les documents
 *      générés (cahiers, fiches, bulletins) — GET/POST /api/settings/identity
 *   3. Abonnement            : état de l'abonnement Helm Enseignant
 *   4. Inviter mon promoteur : boucle de croissance B2B
 */

import { useCallback, useEffect, useState } from 'react';
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
        (data.levels || []).map((l: any) => ({
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
      const activeCodes = levels.filter((l) => l.isActive).map((l) => l.code);
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
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Abonnement Helm Enseignant</h2>
            <p className="mt-1 text-sm text-slate-500">
              Votre abonnement personnel, financé par vos propres fonds.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            {subscription ? (
              <div className="space-y-2 text-sm">
                <p className="text-slate-600">
                  Formule : <span className="font-semibold text-slate-900">{subscription.plan}</span>{' '}
                  ({subscription.billingCycle === 'ANNUAL' ? 'annuel' : 'mensuel'})
                </p>
                <p className="text-slate-600">
                  Statut :{' '}
                  <span className="font-semibold text-teal-700">{subscription.status}</span>
                </p>
                {subscription.currentPeriodEnd && (
                  <p className="text-slate-600">
                    Renouvellement le :{' '}
                    <span className="font-semibold text-slate-900">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString('fr-FR')}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">Période d’essai active</p>
                  <p className="mt-1">
                    Le paiement (2 000 – 5 000 FCFA / mois) sera activé prochainement via FeexPay.
                    Votre espace reste pleinement fonctionnel pendant cette période.
                  </p>
                </div>
              </div>
            )}
          </div>
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
