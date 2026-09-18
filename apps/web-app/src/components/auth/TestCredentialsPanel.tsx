/**
 * ============================================================================
 * PANNEAU « COMPTES DE TEST » — TENANT ACADEMIA HELM UNIQUEMENT
 * ============================================================================
 *
 * Affiche les identifiants de test du tenant dédié Academia Helm directement
 * sur l'interface de connexion, pour permettre au promoteur de choisir le
 * rôle à tester d'un clic :
 *   - variant « login »   : sur la page /login, liste filtrée selon le
 *                           portail courant (École / Enseignant / Parent),
 *                           bouton « Utiliser » qui pré-remplit le formulaire ;
 *   - variant « selector »: sur la page de sélection de portail de l'école,
 *                           tous les comptes groupés par portail, le clic
 *                           mémorise le compte (sessionStorage) et redirige
 *                           vers /login pré-rempli.
 *
 * ⚠️ Le panneau ne s'affiche QUE si l'école courante est le tenant de test
 * Academia Helm (cf. lib/auth/test-credentials.ts — isTestCredentialsTenant).
 * Les vraies écoles ne voient jamais ces identifiants.
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { FlaskConical, ChevronDown, ChevronRight, Copy, Check, LogIn } from 'lucide-react';
import {
  getTestAccounts,
  isTestCredentialsTenant,
  setTestCredentialPrefill,
  type TestAccount,
  type TestCredentialPortal,
} from '@/lib/auth/test-credentials';

const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

/** Libellés des groupes de portails (variant « selector ») */
const PORTAL_GROUP_LABELS: Record<TestCredentialPortal, string> = {
  school: 'Portail École — Direction & administration',
  teacher: 'Portail Enseignant — Pédagogie & suivi',
  parent: 'Portail Parent / Élève — Suivi & communication',
};

interface TestCredentialsPanelProps {
  /** Portail courant (variant « login ») : filtre les comptes affichés */
  portal?: TestCredentialPortal;
  /** Variante d'affichage : liste filtrée (login) ou tous groupés (selector) */
  variant?: 'login' | 'selector';
  /** Clé de tenant (slug / UUID) issue de l'URL ou du sous-domaine */
  tenantKey?: string | null;
  /** Nom de l'école (fallback de détection si le slug est absent) */
  schoolName?: string | null;
  /** Appelé au clic sur « Utiliser » (variant « login ») : remplit le formulaire */
  onUseAccount?: (account: TestAccount) => void;
}

/** Une ligne = un compte de test */
function AccountRow({
  account,
  onUse,
}: {
  account: TestAccount;
  onUse: (account: TestAccount) => void;
}) {
  const [copiedField, setCopiedField] = useState<'identifier' | 'password' | null>(null);

  const copyValue = async (value: string, field: 'identifier' | 'password') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1600);
    } catch {
      // clipboard indisponible — silencieux, la valeur reste affichée
    }
  };

  return (
    <div
      className="rounded-xl border border-amber-200/80 bg-amber-50/40 px-3 py-2.5"
      data-testid={`test-account-${account.portal}-${account.identifier}`}
    >
      {/* Rôle + nom */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-slate-900">{account.roleLabel}</p>
          <p className="truncate text-[11px] text-slate-500">{account.name}</p>
        </div>
        <button
          type="button"
          onClick={() => onUse(account)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2"
          style={{ background: `linear-gradient(135deg, ${NAVY}, ${BLUE})` }}
          aria-label={`Utiliser le compte de test ${account.roleLabel}`}
        >
          <LogIn className="h-3 w-3" />
          Utiliser
        </button>
      </div>

      {/* Identifiant + mot de passe */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {account.identifierLabel}
        </span>
        <code
          className="cursor-pointer select-all rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800 ring-1 ring-slate-200 transition-colors hover:ring-amber-300"
          onClick={() => copyValue(account.identifier, 'identifier')}
          title="Cliquer pour copier"
        >
          {account.identifier}
        </code>
        {copiedField === 'identifier' ? (
          <Check className="h-3 w-3 text-emerald-500" aria-hidden />
        ) : (
          <Copy className="h-3 w-3 text-slate-300" aria-hidden />
        )}

        {account.password && (
          <>
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Mdp
            </span>
            <code
              className="cursor-pointer select-all rounded-md bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800 ring-1 ring-slate-200 transition-colors hover:ring-amber-300"
              onClick={() => copyValue(account.password, 'password')}
              title="Cliquer pour copier"
            >
              {account.password}
            </code>
            {copiedField === 'password' ? (
              <Check className="h-3 w-3 text-emerald-500" aria-hidden />
            ) : (
              <Copy className="h-3 w-3 text-slate-300" aria-hidden />
            )}
          </>
        )}
      </div>

      {/* Note éventuelle (double casquette, email alternatif parent…) */}
      {account.note && (
        <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{account.note}</p>
      )}
    </div>
  );
}

export default function TestCredentialsPanel({
  portal,
  variant = 'login',
  tenantKey,
  schoolName,
  onUseAccount,
}: TestCredentialsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  // ⛔ Portail de test uniquement — invisibles pour les vraies écoles
  if (!isTestCredentialsTenant(tenantKey) && !isTestCredentialsTenant(schoolName)) {
    return null;
  }

  const accounts = variant === 'login' ? getTestAccounts(portal) : getTestAccounts();
  if (accounts.length === 0) return null;

  // Comportement du clic « Utiliser » :
  //  - variant « login » avec handler → remplit le formulaire courant ;
  //  - variant « selector » (ou sans handler) → mémorise le compte et
  //    redirige vers /login du portail concerné, pré-rempli.
  const handleUse = (account: TestAccount) => {
    if (onUseAccount) {
      onUseAccount(account);
      return;
    }
    setTestCredentialPrefill(account);
    const params = new URLSearchParams();
    params.set('portal', account.portal);
    const slug = tenantKey && isTestCredentialsTenant(tenantKey) ? tenantKey : 'academia-helm';
    params.set('tenant', slug);
    if (isTestCredentialsTenant(schoolName) && schoolName) {
      params.set('school_name', schoolName);
    }
    window.location.href = `/login?${params.toString()}`;
  };

  // Comptes groupés par portail (variant « selector »)
  const groups: Array<{ key: TestCredentialPortal; label: string; items: TestAccount[] }> = (
    ['school', 'teacher', 'parent'] as TestCredentialPortal[]
  )
    .map((key) => ({
      key,
      label: PORTAL_GROUP_LABELS[key],
      items: accounts.filter((account) => account.portal === key),
    }))
    .filter((group) => group.items.length > 0);

  const grouped = variant === 'selector';

  return (
    <div
      className="mt-4 rounded-2xl border-2 border-amber-300/70 bg-white shadow-sm"
      data-testid="test-credentials-panel"
    >
      {/* ── En-tête cliquable (replier/déplier) ── */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-amber-300"
        aria-expanded={!collapsed}
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'rgba(245, 179, 53, 0.16)' }}
        >
          <FlaskConical className="h-4 w-4" style={{ color: '#b45309' }} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-900">
            Comptes de test — Academia Helm
          </span>
          <span className="block text-[11px] text-slate-500">
            Réservés aux vérifications sur ce tenant de test. Cliquez sur « Utiliser » pour
            pré-remplir la connexion.
          </span>
        </span>
        {collapsed ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        )}
      </button>

      {/* ── Liste des comptes ── */}
      {!collapsed && (
        <div className="space-y-3 border-t border-amber-200/60 px-4 pb-4 pt-3">
          {grouped ? (
            groups.map((group) => (
              <div key={group.key}>
                <p
                  className="mb-1.5 text-[11px] font-bold uppercase tracking-wide"
                  style={{ color: '#b45309' }}
                >
                  {group.label}
                </p>
                <div className="space-y-2">
                  {group.items.map((account) => (
                    <AccountRow key={`${account.portal}-${account.identifier}`} account={account} onUse={handleUse} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <AccountRow key={`${account.portal}-${account.identifier}`} account={account} onUse={handleUse} />
              ))}
            </div>
          )}

          <p className="pt-0.5 text-[10px] leading-relaxed text-slate-400">
            Tenant de test autonome (clone de l&apos;école CSPEB) — emails non délivrables
            @academia-helm.test, aucune donnée réelle n&apos;est impactée par les tests.
          </p>
        </div>
      )}
    </div>
  );
}
