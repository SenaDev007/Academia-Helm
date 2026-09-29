/**
 * FederisSettingsPage — Paramètres du patronat (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ VRAIES DONNÉES PERSISTÉES (2026-09-28) — remplace les onglets mock :
 *   - Identité & Logo : GET/PATCH /federis/patronat/identity — nom, sigle,
 *     logo (ImagePicker → /api/media/optimize), coordonnées. Le nom + le logo
 *     personnalisent l'en-tête / pied de page de la landing page publique du
 *     sous-domaine du patronat.
 *   - Abonnement & paiement : GET /federis/patronat/subscription — montants
 *     réels (barème national supérieur au territorial), factures persistées,
 *     renouvellement vers /checkout.
 *   - Équipe : renvoie vers la page Équipe & Comptes (CRUD réel).
 *   - Audit : GET /audit-logs (journal réel des actions patronat).
 *   - Années scolaires : inchangé (déjà persisté).
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { ImagePicker } from '@/components/cms/visual/ImagePicker';
import { federisLink } from '@/lib/federis/useFederisPath';
import type { User } from '@/types';
import { CalendarDays, Save, Loader2, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import * as settingsService from '@/services/settings.service';

type Tab = 'identity' | 'matricule' | 'academic-year' | 'subscription' | 'team' | 'audit';

interface MatriculeSettings {
  format: string | null;
  defaultFormat: string;
  isDefault: boolean;
  tokens: Array<{ token: string; description: string }>;
  preview: string;
  canManage: boolean;
}

interface PatronatIdentity {
  id: string;
  name: string;
  abbreviation?: string | null;
  logo?: string | null;
  legalName?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  address?: string | null;
  website?: string | null;
  orgLevel?: string | null;
  territoryName?: string | null;
  country?: { name: string; code: string } | null;
  territorialLevel?: { label: string } | null;
}

interface SubscriptionData {
  plan: string;
  planLabel: string;
  amountXOF: number;
  orgLevel: string | null;
  patronatName: string;
  status: string;
  period: string;
  startedAt?: string | null;
  expiresAt?: string | null;
  quotas: { maxSchools: number; maxCandidates: number; maxActiveCampaigns: number };
  invoices: Array<{
    id: string;
    number: string;
    amount: number;
    currency: string;
    status: string;
    type: string;
    dueDate: string;
    createdAt: string;
    paymentsCount: number;
  }>;
}

interface AuditEntry {
  id: string;
  action: string;
  resource?: string;
  createdAt: string;
  newData?: unknown;
}

const SUBSCRIPTION_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Actif', className: 'bg-green-100 text-green-800' },
  PENDING_PAYMENT: { label: 'Paiement requis', className: 'bg-amber-100 text-amber-800' },
  EXPIRED: { label: 'Expiré', className: 'bg-red-100 text-red-700' },
};

export default function FederisSettingsPage({ tenantId, user }: { tenantId: string; user: User }) {
  const confirmDialog = useConfirmDialog();
  const [activeTab, setActiveTab] = useState<Tab>('identity');

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'identity', label: 'Identité & Logo', icon: 'building' },
    { id: 'matricule', label: 'Matricule & Anonymat', icon: 'idcard' },
    { id: 'academic-year', label: 'Années Scolaires', icon: 'calendar' },
    { id: 'subscription', label: 'Abonnement & paiement', icon: 'finance' },
    { id: 'team', label: 'Équipe & Comptes', icon: 'user' },
    { id: 'audit', label: 'Audit logs', icon: 'document' },
  ];

  // ── Identité (vraies données) ──────────────────────────────────────
  const [identity, setIdentity] = useState<PatronatIdentity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityErrors, setIdentityErrors] = useState<Record<string, string>>({});
  const [identityNotice, setIdentityNotice] = useState<string | null>(null);

  const loadIdentity = useCallback(async () => {
    setIdentityLoading(true);
    try {
      const res = await apiClient.get('/federis/patronat/identity', { timeout: 20000 });
      setIdentity(res.data ?? null);
    } catch {
      setIdentity(null);
    } finally {
      setIdentityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'identity') void loadIdentity();
  }, [activeTab, loadIdentity]);

  // ── Matricule & Anonymat (2026-09-29 — format de génération) ──────
  const [matricule, setMatricule] = useState<MatriculeSettings | null>(null);
  const [matriculeDraft, setMatriculeDraft] = useState('');
  const [matriculeLoading, setMatriculeLoading] = useState(true);
  const [matriculeSaving, setMatriculeSaving] = useState(false);
  const [matriculeNotice, setMatriculeNotice] = useState<string | null>(null);
  const [matriculeError, setMatriculeError] = useState<string | null>(null);

  const loadMatricule = useCallback(async () => {
    setMatriculeLoading(true);
    try {
      const res = await apiClient.get('/federis/settings/matricule', { timeout: 20000 });
      setMatricule(res.data ?? null);
      setMatriculeDraft(res.data?.format ?? '');
    } catch (err: any) {
      setMatricule(null);
      setMatriculeError(
        (Array.isArray(err?.response?.data?.message)
          ? err.response.data.message.join(' ')
          : err?.response?.data?.message) ?? 'Impossible de charger le format de matricule.',
      );
    } finally {
      setMatriculeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'matricule') void loadMatricule();
  }, [activeTab, loadMatricule]);

  /** Aperçu local (même moteur de jetons que le backend). */
  const matriculePreview = useMemo(() => {
    const format = matriculeDraft.trim() || matricule?.defaultFormat || '{EXAM}-{ANNEE}-{SEQ:5}';
    const year = new Date().getFullYear();
    return format.replace(
      /\{(EXAM|EXAMTYPE|ANNEE|ANNEE2|SEQ(?::\d+)?|PATRONAT)\}/g,
      (_m: string, token: string) => {
        switch (token) {
          case 'EXAM':
            return 'BAC26';
          case 'EXAMTYPE':
            return 'BAC';
          case 'ANNEE':
            return String(year);
          case 'ANNEE2':
            return String(year).slice(-2);
          case 'PATRONAT':
            return 'PNEPB';
          default: {
            const width = token.startsWith('SEQ:') ? parseInt(token.slice(4), 10) : NaN;
            return Number.isFinite(width) && width > 0
              ? String(42).padStart(width, '0')
              : '42';
          }
        }
      },
    );
  }, [matriculeDraft, matricule]);

  /** Jeton {SEQ} présent ? (validation locale — le backend revalide) */
  const matriculeDraftValid = useMemo(
    () => /\{SEQ(:\d+)?\}/.test(matriculeDraft.trim()) || matriculeDraft.trim() === '',
    [matriculeDraft],
  );

  const handleSaveMatricule = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!matricule) return;
    setMatriculeSaving(true);
    setMatriculeNotice(null);
    setMatriculeError(null);
    try {
      const res = await apiClient.put(
        '/federis/settings/matricule',
        { format: matriculeDraft.trim() || null },
        { timeout: 20000 },
      );
      setMatricule(res.data ?? null);
      setMatriculeDraft(res.data?.format ?? '');
      setMatriculeNotice(
        res.data?.isDefault
          ? 'Format réinitialisé au défaut — les prochains matricules suivront ce modèle.'
          : 'Format enregistré — les prochains matricules générés suivront ce modèle.',
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setMatriculeError(
        (Array.isArray(msg) ? msg.join(' ') : msg) ?? 'Enregistrement impossible.',
      );
    } finally {
      setMatriculeSaving(false);
    }
  };

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity) return;
    const errs: Record<string, string> = {};
    if (!identity.name || identity.name.trim().length < 2)
      errs.name = 'Le nom du patronat est requis (2 caractères minimum)';
    if (identity.primaryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.primaryEmail.trim()))
      errs.primaryEmail = 'Adresse électronique invalide';
    setIdentityErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIdentitySaving(true);
    setIdentityNotice(null);
    try {
      await apiClient.patch(
        '/federis/patronat/identity',
        {
          name: identity.name.trim(),
          ...(identity.abbreviation?.trim() ? { abbreviation: identity.abbreviation.trim() } : { abbreviation: null }),
          logo: identity.logo ?? null,
          ...(identity.primaryEmail?.trim() ? { primaryEmail: identity.primaryEmail.trim().toLowerCase() } : { primaryEmail: null }),
          ...(identity.primaryPhone?.trim() ? { primaryPhone: identity.primaryPhone.trim() } : { primaryPhone: null }),
          ...(identity.address?.trim() ? { address: identity.address.trim() } : { address: null }),
          ...(identity.website?.trim() ? { website: identity.website.trim() } : { website: null }),
        },
        { timeout: 30000 },
      );
      setIdentityNotice('Identité enregistrée — la landing page de votre sous-domaine est à jour.');
      await loadIdentity();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Enregistrement impossible.";
      setIdentityErrors({ submit: Array.isArray(msg) ? msg.join(' ') : String(msg) });
    } finally {
      setIdentitySaving(false);
    }
  };

  // ── Abonnement (vraies données) ────────────────────────────────────
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const loadSubscription = useCallback(async () => {
    setSubscriptionLoading(true);
    try {
      const res = await apiClient.get('/federis/patronat/subscription', { timeout: 20000 });
      setSubscription(res.data ?? null);
    } catch {
      setSubscription(null);
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'subscription') void loadSubscription();
  }, [activeTab, loadSubscription]);

  // ── Audit (vraies données) ─────────────────────────────────────────
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await apiClient.get('/audit-logs', { timeout: 20000 });
      const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      setAuditEntries(list.slice(0, 30));
    } catch {
      setAuditEntries([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') void loadAudit();
  }, [activeTab, loadAudit]);

  // ── Années scolaires (existant — déjà persisté) ────────────────────
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [activeAcademicYear, setActiveAcademicYear] = useState<any>(null);
  const [academicYearBusy, setAcademicYearBusy] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (activeTab === 'academic-year') {
      loadAcademicYears();
    }
  }, [activeTab]);

  const loadAcademicYears = async () => {
    try {
      const [years, active] = await Promise.all([
        settingsService.getAcademicYears(tenantId),
        settingsService.getActiveAcademicYear(tenantId),
      ]);
      setAcademicYears(years || []);
      setActiveAcademicYear(active || null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateNextAcademicYear = async () => {
    try {
      setAcademicYearBusy(true);
      await settingsService.generateNextAcademicYear(tenantId);
      setToast({ type: 'success', message: 'Nouvelle année scolaire générée.' });
      await loadAcademicYears();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Erreur' });
    } finally {
      setAcademicYearBusy(false);
    }
  };

  const handleActivateAcademicYear = async (id: string) => {
    const ok = await confirmDialog.info(
      "Cette année scolaire deviendra l'année active. Voulez-vous continuer ?",
      "Activer l'année scolaire",
    );
    if (!ok) return;
    try {
      setAcademicYearBusy(true);
      await settingsService.activateAcademicYear(id, tenantId);
      setToast({ type: 'success', message: 'Année scolaire activée.' });
      await loadAcademicYears();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Erreur' });
    } finally {
      setAcademicYearBusy(false);
    }
  };

  const handleCloseAcademicYear = async (id: string) => {
    const ok = await confirmDialog.warning(
      'Cette année scolaire passera en lecture seule. Cette action est irréversible. Voulez-vous continuer ?',
      "Clôturer l'année scolaire",
    );
    if (!ok) return;
    try {
      setAcademicYearBusy(true);
      await settingsService.closeAcademicYear(id, tenantId);
      setToast({ type: 'success', message: 'Année clôturée.' });
      await loadAcademicYears();
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Erreur' });
    } finally {
      setAcademicYearBusy(false);
    }
  };

  return (
    <>
      {confirmDialog.dialog}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-blue-900 tracking-tight">
            Paramètres
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Identité publique, années scolaires, abonnement et traçabilité de votre patronat.
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="flex space-x-8 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === tab.id
                    ? 'border-blue-700 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {/* ══════════ IDENTITÉ & LOGO (vraies données) ══════════ */}
          {activeTab === 'identity' && (
            <form onSubmit={handleSaveIdentity} className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Identité du patronat</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Ces informations personnalisent la page d&apos;accueil publique de votre
                  sous-domaine (en-tête et pied de page) ainsi que l&apos;en-tête de vos documents
                  officiels.
                </p>
              </div>

              {identityLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-10 bg-gray-100 rounded-md" />
                  <div className="h-10 bg-gray-100 rounded-md" />
                  <div className="h-40 bg-gray-100 rounded-xl" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Nom du patronat <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={identity?.name ?? ''}
                        onChange={(e) =>
                          setIdentity(identity ? { ...identity, name: e.target.value } : identity)
                        }
                        className={cn(
                          'w-full px-4 py-2 border rounded-md',
                          identityErrors.name ? 'border-red-400' : 'border-gray-300',
                        )}
                        placeholder="Ex : Patronat National des Écoles Privées"
                      />
                      {identityErrors.name && (
                        <p className="mt-1 text-sm text-red-600">{identityErrors.name}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-400">
                        Affiché dans l&apos;en-tête / pied de page de votre landing page publique.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sigle / abréviation
                      </label>
                      <input
                        type="text"
                        value={identity?.abbreviation ?? ''}
                        onChange={(e) =>
                          setIdentity(
                            identity ? { ...identity, abbreviation: e.target.value } : identity,
                          )
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-md"
                        placeholder="Ex : PNEP"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email institutionnel
                      </label>
                      <input
                        type="email"
                        value={identity?.primaryEmail ?? ''}
                        onChange={(e) =>
                          setIdentity(
                            identity ? { ...identity, primaryEmail: e.target.value } : identity,
                          )
                        }
                        className={cn(
                          'w-full px-4 py-2 border rounded-md',
                          identityErrors.primaryEmail ? 'border-red-400' : 'border-gray-300',
                        )}
                        placeholder="contact@patronat.org"
                      />
                      {identityErrors.primaryEmail && (
                        <p className="mt-1 text-sm text-red-600">{identityErrors.primaryEmail}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Téléphone
                      </label>
                      <input
                        type="tel"
                        value={identity?.primaryPhone ?? ''}
                        onChange={(e) =>
                          setIdentity(
                            identity ? { ...identity, primaryPhone: e.target.value } : identity,
                          )
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-md"
                        placeholder="+229 …"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
                      <input
                        type="text"
                        value={identity?.address ?? ''}
                        onChange={(e) =>
                          setIdentity(identity ? { ...identity, address: e.target.value } : identity)
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-md"
                        placeholder="Cotonou, Bénin"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Site web
                      </label>
                      <input
                        type="url"
                        value={identity?.website ?? ''}
                        onChange={(e) =>
                          setIdentity(identity ? { ...identity, website: e.target.value } : identity)
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-md"
                        placeholder="https://…"
                      />
                    </div>
                  </div>

                  {/* Logo configurables — ImagePicker (pattern Helm CMS) */}
                  <div className="max-w-xs">
                    <ImagePicker
                      value={identity?.logo ?? null}
                      onChange={(logo) => setIdentity(identity ? { ...identity, logo } : identity)}
                      label="Logo du patronat"
                      aspect="square"
                      hint="Affiché dans l'en-tête de votre landing page publique (sinon logo Academia Federis). PNG, JPG, WEBP — 8 Mo max."
                    />
                  </div>

                  {identity?.orgLevel && (
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-xs font-semibold">
                        {identity.orgLevel === 'NATIONAL'
                          ? 'Patronat national'
                          : identity.territorialLevel?.label ?? 'Patronat territorial'}
                        {identity.territoryName ? ` — ${identity.territoryName}` : ''}
                      </span>
                      {identity.country && (
                        <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold">
                          {identity.country.name}
                        </span>
                      )}
                    </div>
                  )}

                  {identityErrors.submit && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-md flex items-start space-x-2">
                      <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                      <span className="text-sm text-red-700">{identityErrors.submit}</span>
                    </div>
                  )}
                  {identityNotice && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-md flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-800">{identityNotice}</span>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={identitySaving}
                      className="px-6 py-2 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {identitySaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {identitySaving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* ══════════ MATRICULE & ANONYMAT (2026-09-29) ══════════ */}
          {activeTab === 'matricule' && (
            <form onSubmit={handleSaveMatricule} className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Matricule &amp; anonymat des candidats</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Définissez librement le modèle de génération des matricules candidats.
                  Si vous ne définissez rien, le backend applique le format par défaut
                  établi. Les anonymats (codes de saisie des notes) sont générés dans le
                  module Candidats.
                </p>
              </div>

              {matriculeLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-10 bg-gray-100 rounded-md" />
                  <div className="h-24 bg-gray-100 rounded-xl" />
                </div>
              ) : !matricule ? (
                <div className="flex items-start space-x-3 bg-red-50 border border-red-200 rounded-lg p-4">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      {matriculeError ?? 'Format de matricule indisponible.'}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Format actuel */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <p className="text-[10px] font-bold uppercase text-blue-700">
                        Format appliqué actuellement
                      </p>
                      <p className="mt-1.5 font-mono font-bold text-blue-900 text-sm break-all">
                        {matricule.format ?? matricule.defaultFormat}
                      </p>
                      <span
                        className={cn(
                          'inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase',
                          matricule.isDefault
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-emerald-100 text-emerald-700',
                        )}
                      >
                        {matricule.isDefault ? 'Défaut (aucune personnalisation)' : 'Personnalisé'}
                      </span>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <p className="text-[10px] font-bold uppercase text-slate-500">
                        Format par défaut du système
                      </p>
                      <p className="mt-1.5 font-mono font-bold text-slate-700 text-sm break-all">
                        {matricule.defaultFormat}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Exemple : BAC26-2026-00042
                      </p>
                    </div>
                  </div>

                  {/* Éditeur de modèle */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Votre modèle de matricule{' '}
                      <span className="text-gray-400 font-normal">
                        (vide = format par défaut)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={matriculeDraft}
                      onChange={(e) => setMatriculeDraft(e.target.value)}
                      disabled={!matricule.canManage}
                      maxLength={60}
                      className={cn(
                        'w-full px-4 py-2.5 border rounded-md font-mono font-semibold',
                        matriculeDraftValid ? 'border-gray-300' : 'border-red-400',
                      )}
                      placeholder={matricule.defaultFormat}
                    />
                    {!matriculeDraftValid && (
                      <p className="mt-1 text-sm text-red-600">
                        Le jeton {'{SEQ}'} (ou {'{SEQ:n}'}) est obligatoire pour garantir
                        l&apos;unicité des matricules.
                      </p>
                    )}

                    {/* Aperçu en direct */}
                    <div className="mt-3 flex items-center gap-3 bg-white border border-blue-900/15 rounded-lg px-4 py-3">
                      <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">
                        Aperçu (candidat n° 42)
                      </span>
                      <span className="font-mono font-bold text-blue-900 break-all">
                        {matriculePreview}
                      </span>
                    </div>

                    {/* Jetons disponibles */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(matricule.tokens ?? []).map((t) => (
                        <button
                          key={t.token}
                          type="button"
                          disabled={!matricule.canManage}
                          onClick={() => setMatriculeDraft((d) => `${d}${t.token}`)}
                          className="flex items-start gap-2.5 text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-700/40 hover:bg-blue-50/50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                        >
                          <code className="text-[11px] font-bold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                            {t.token}
                          </code>
                          <span className="text-[11px] text-gray-600">{t.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {matriculeError && (
                    <div className="flex items-start space-x-3 bg-red-50 border border-red-200 rounded-lg p-4">
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <p className="text-sm font-semibold text-red-800">{matriculeError}</p>
                    </div>
                  )}
                  {matriculeNotice && (
                    <div className="flex items-start space-x-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <p className="text-sm font-semibold text-emerald-800">{matriculeNotice}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={matriculeSaving || !matricule.canManage || !matriculeDraftValid}
                      className="px-4 py-2 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 disabled:opacity-50 flex items-center space-x-2"
                    >
                      {matriculeSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>Enregistrer le format</span>
                    </button>
                    {(matricule.format || matriculeDraft.trim()) && (
                      <button
                        type="button"
                        disabled={matriculeSaving || !matricule.canManage}
                        onClick={() => {
                          setMatriculeDraft('');
                          setMatriculeNotice(null);
                          setMatriculeError(null);
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md font-semibold hover:bg-gray-50 disabled:opacity-50"
                      >
                        Revenir au format par défaut
                      </button>
                    )}
                    {!matricule.canManage && (
                      <p className="text-xs text-gray-500">
                        La modification du format est réservée au coordonnateur, à
                        l&apos;organisateur et au secrétaire.
                      </p>
                    )}
                  </div>

                  {/* Note anonymats */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <CalendarDays className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      <b>Anonymats :</b> indépendants du matricule, ils sont générés par examen
                      dans le module Candidats (bouton « Générer les anonymats ») sous la forme
                      <span className="font-mono font-bold"> 26B00001</span> — année sur 2 chiffres +
                      initiale de l&apos;examen + séquence. Ils masquent l&apos;identité des candidats
                      pour la saisie des notes et toute la correction.
                    </p>
                  </div>
                </>
              )}
            </form>
          )}

          {/* ══════════ ANNÉES SCOLAIRES (déjà persisté) ══════════ */}
          {activeTab === 'academic-year' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Gestion des Années Scolaires
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Configurez le cycle académique de votre réseau patronal.
                  </p>
                </div>
                <button
                  onClick={handleGenerateNextAcademicYear}
                  disabled={academicYearBusy}
                  className="px-4 py-2 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 disabled:opacity-50 flex items-center space-x-2"
                >
                  {academicYearBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CalendarDays className="w-4 h-4" />
                  )}
                  <span>Générer la prochaine année</span>
                </button>
              </div>

              {toast && (
                <div
                  className={cn(
                    'p-4 rounded-md flex items-center space-x-2',
                    toast.type === 'success'
                      ? 'bg-green-50 text-green-800'
                      : 'bg-red-50 text-red-800',
                  )}
                >
                  {toast.type === 'success' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span>{toast.message}</span>
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                          Année
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                          Statut
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                          Dates
                        </th>
                        <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {academicYears.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                            Aucune année scolaire configurée.
                          </td>
                        </tr>
                      ) : (
                        academicYears.map((year) => (
                          <tr key={year.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-gray-900">{year.name}</td>
                            <td className="px-6 py-4">
                              <span
                                className={cn(
                                  'px-2.5 py-1 text-xs font-medium rounded-full',
                                  year.status === 'ACTIVE'
                                    ? 'bg-green-100 text-green-800'
                                    : year.status === 'ARCHIVED'
                                      ? 'bg-gray-100 text-gray-800'
                                      : 'bg-blue-100 text-blue-800',
                                )}
                              >
                                {year.status === 'ACTIVE'
                                  ? 'Active'
                                  : year.status === 'ARCHIVED'
                                    ? 'Archivée'
                                    : 'Planifiée'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {year.startDate
                                ? new Date(year.startDate).toLocaleDateString('fr-FR')
                                : '—'}
                              {' au '}
                              {year.endDate
                                ? new Date(year.endDate).toLocaleDateString('fr-FR')
                                : '—'}
                            </td>
                            <td className="px-6 py-4 text-right space-x-3">
                              {year.status !== 'ACTIVE' && year.status !== 'ARCHIVED' && (
                                <button
                                  onClick={() => handleActivateAcademicYear(year.id)}
                                  disabled={academicYearBusy}
                                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                                >
                                  Activer
                                </button>
                              )}
                              {year.status === 'ACTIVE' && (
                                <button
                                  onClick={() => handleCloseAcademicYear(year.id)}
                                  disabled={academicYearBusy}
                                  className="text-sm font-medium text-red-600 hover:text-red-800"
                                >
                                  Clôturer
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ ABONNEMENT (vraies données) ══════════ */}
          {activeTab === 'subscription' && (
            <div className="space-y-6">
              {subscriptionLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-24 bg-gray-100 rounded-lg" />
                  <div className="h-10 bg-gray-100 rounded-md" />
                </div>
              ) : subscription ? (
                <>
                  <div className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Abonnement {subscription.planLabel}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {subscription.amountXOF.toLocaleString('fr-FR')} F CFA /{' '}
                          {subscription.period === 'SCHOOL_YEAR' ? 'année scolaire' : subscription.period}
                          {subscription.orgLevel === 'NATIONAL'
                            ? ' — barème patronat national'
                            : ' — barème territorial / départemental'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'px-3 py-1 rounded-full text-sm font-medium',
                          SUBSCRIPTION_STATUS_LABELS[subscription.status]?.className ??
                            'bg-gray-100 text-gray-800',
                        )}
                      >
                        {SUBSCRIPTION_STATUS_LABELS[subscription.status]?.label ??
                          subscription.status}
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4 text-sm text-gray-600">
                      <p>
                        Écoles membres :{' '}
                        <span className="font-semibold text-gray-900">
                          {subscription.quotas?.maxSchools ?? '—'}
                        </span>
                      </p>
                      <p>
                        Candidatures / an :{' '}
                        <span className="font-semibold text-gray-900">
                          {subscription.quotas?.maxCandidates?.toLocaleString('fr-FR') ?? '—'}
                        </span>
                      </p>
                      <p>
                        Échéance :{' '}
                        <span className="font-semibold text-gray-900">
                          {subscription.expiresAt
                            ? new Date(subscription.expiresAt).toLocaleDateString('fr-FR')
                            : '—'}
                        </span>
                      </p>
                    </div>
                    <div className="mt-6">
                      <Link
                        href={federisLink('/checkout')}
                        className="px-6 py-2 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 inline-flex items-center gap-2 text-sm"
                      >
                        {subscription.status === 'ACTIVE' ? 'Renouveler / changer de plan' : 'Activer notre abonnement'}
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Historique des factures
                    </h3>
                    <div className="space-y-2">
                      {subscription.invoices?.length === 0 && (
                        <p className="text-sm text-gray-500">
                          Aucune facture pour le moment — activez votre abonnement pour générer la
                          première.
                        </p>
                      )}
                      {subscription.invoices?.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-gray-900">
                              Facture {inv.number}{' '}
                              <span className="text-xs text-gray-400">({inv.type})</span>
                            </p>
                            <p className="text-sm text-gray-600">
                              {new Date(inv.createdAt).toLocaleDateString('fr-FR')}
                              {inv.dueDate
                                ? ` · échéance ${new Date(inv.dueDate).toLocaleDateString('fr-FR')}`
                                : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              {inv.amount.toLocaleString('fr-FR')} {inv.currency}
                            </p>
                            <span
                              className={cn(
                                'text-xs font-semibold',
                                inv.status === 'PAID'
                                  ? 'text-green-600'
                                  : inv.status === 'UNPAID'
                                    ? 'text-amber-600'
                                    : 'text-gray-500',
                              )}
                            >
                              {inv.status === 'PAID'
                                ? 'Payée'
                                : inv.status === 'UNPAID'
                                  ? 'Impayée'
                                  : inv.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  Abonnement indisponible — reconnectez-vous et réessayez.
                </p>
              )}
            </div>
          )}

          {/* ══════════ ÉQUIPE (redirection vers la page réelle) ══════════ */}
          {activeTab === 'team' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Équipe & Comptes</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Les comptes des membres du patronat (secrétaire, trésorier, organisateur, chargé
                  de mission) sont gérés depuis la page dédiée — création, fonction, activation et
                  réinitialisation de mot de passe.
                </p>
              </div>
              <Link
                href={federisLink('/team')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 text-sm"
              >
                Ouvrir Équipe &amp; Comptes
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* ══════════ AUDIT (vraies données) ══════════ */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Audit logs</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Journal des actions enregistrées sur votre espace patronat (30 dernières).
                </p>
              </div>
              {auditLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-16 bg-gray-100 rounded-lg" />
                  <div className="h-16 bg-gray-100 rounded-lg" />
                  <div className="h-16 bg-gray-100 rounded-lg" />
                </div>
              ) : auditEntries.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Aucune action enregistrée pour le moment.
                </p>
              ) : (
                <div className="space-y-2">
                  {auditEntries.map((entry) => (
                    <div key={entry.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {entry.action.replaceAll('_', ' ')}
                        </p>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.createdAt).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      {entry.resource && (
                        <p className="text-sm text-gray-600">Ressource : {entry.resource}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
