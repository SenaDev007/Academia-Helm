/**
 * ============================================================================
 * MODAL « COMPTES DE TEST » — TENANT ACADEMIA HELM UNIQUEMENT
 * ============================================================================
 *
 * Modal (au lieu d'un panneau intégré à la page login) qui s'ouvre
 * automatiquement quand l'utilisateur clique sur un champ de saisie (email,
 * mot de passe, identifiant enseignant, téléphone parent) de la page de
 * login, UNIQUEMENT pour le tenant de test « Academia Helm ».
 *
 * Avantages vs l'ancien panneau intégré :
 *   - Ne plus allonger la page login (l'ancien panneau était长 et peu
 *     professionnel, surtout avec 14 comptes de test).
 *   - Affichage contextuel : l'utilisateur voit les comptes quand il en a
 *     besoin (au moment de saisir ses identifiants), pas avant.
 *   - Bouton « Utiliser » qui pré-remplit le formulaire en un clic.
 *
 * ⚠️ Le modal ne s'affiche QUE si l'école courante est le tenant de test
 * Academia Helm (cf. lib/auth/test-credentials.ts — isTestCredentialsTenant).
 * Les vraies écoles ne voient jamais ces identifiants.
 * ============================================================================
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { FlaskConical, X, Search, LogIn, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import {
  getTestAccounts,
  isTestCredentialsTenant,
  type TestAccount,
  type TestCredentialPortal,
} from '@/lib/auth/test-credentials';

const NAVY = '#0b2f73';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';

/** Libellés des groupes de portails */
const PORTAL_GROUP_LABELS: Record<TestCredentialPortal, string> = {
  school: 'Portail École — Direction & administration',
  teacher: 'Portail Enseignant — Pédagogie & suivi',
  parent: 'Portail Parent / Élève — Suivi & communication',
};

interface TestCredentialsModalProps {
  /** Portail courant : filtre les comptes affichés */
  portal?: TestCredentialPortal;
  /** Clé de tenant (slug / UUID) issue de l'URL ou du sous-domaine */
  tenantKey?: string | null;
  /** Nom de l'école (fallback de détection si le slug est absent) */
  schoolName?: string | null;
  /** `true` si le modal est ouvert (contrôlé par le parent) */
  isOpen: boolean;
  /** Appelé pour fermer le modal (parent) */
  onClose: () => void;
  /** Appelé au clic sur « Utiliser » : remplit le formulaire */
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
      // clipboard indisponible — silencieux
    }
  };

  return (
    <div
      className="rounded-xl border border-amber-200/80 bg-amber-50/40 px-3 py-2.5 transition-colors hover:border-amber-300 hover:bg-amber-50/70"
      data-testid={`test-account-${account.portal}-${account.identifier}`}
    >
      {/* Rôle + nom + bouton Utiliser */}
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

      {/* Note éventuelle */}
      {account.note && (
        <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{account.note}</p>
      )}
    </div>
  );
}

export default function TestCredentialsModal({
  portal,
  tenantKey,
  schoolName,
  isOpen,
  onClose,
  onUseAccount,
}: TestCredentialsModalProps) {
  // ⛔ Tenant de test uniquement — invisibles pour les vraies écoles
  if (!isTestCredentialsTenant(tenantKey) && !isTestCredentialsTenant(schoolName)) {
    return null;
  }

  // Filtrer les comptes par portail (si fourni), sinon tous groupés
  const accounts = portal ? getTestAccounts(portal) : getTestAccounts();
  if (accounts.length === 0) return null;

  // Grouper par portail (pour la variante groupée quand pas de portail fourni)
  const groups: Array<{ key: TestCredentialPortal; label: string; items: TestAccount[] }> = (
    ['school', 'teacher', 'parent'] as TestCredentialPortal[]
  )
    .map((key) => ({
      key,
      label: PORTAL_GROUP_LABELS[key],
      items: accounts.filter((account) => account.portal === key),
    }))
    .filter((group) => group.items.length > 0);

  const grouped = !portal; // si pas de portail fourni → grouper pour montrer tous les comptes

  const handleUse = (account: TestAccount) => {
    if (onUseAccount) {
      onUseAccount(account);
    }
    onClose(); // fermer le modal après sélection
  };

  // Échap pour fermer
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="test-credentials-modal-title"
      data-testid="test-credentials-modal"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal — max-h pour qu'il tienne dans l'écran même avec 14 comptes */}
      <div
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ animation: 'testModalIn 200ms ease-out' }}
      >
        <style jsx>{`
          @keyframes testModalIn {
            from { opacity: 0; transform: scale(0.96) translateY(8px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        {/* En-tête */}
        <div
          className="flex items-start gap-3 px-5 py-4 border-b border-amber-200/70"
          style={{ background: 'linear-gradient(135deg, rgba(245,179,53,0.10), rgba(11,47,115,0.05))' }}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'rgba(245, 179, 53, 0.18)' }}
          >
            <FlaskConical className="h-5 w-5" style={{ color: '#b45309' }} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="test-credentials-modal-title" className="text-base font-bold text-slate-900">
              Comptes de test — Academia Helm
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sélectionnez un compte pour pré-remplir le formulaire de connexion.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corps — scrollable si beaucoup de comptes */}
        <div className="max-h-[calc(90vh-130px)] overflow-y-auto px-5 py-4 space-y-3">
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
                    <AccountRow
                      key={`${account.portal}-${account.identifier}`}
                      account={account}
                      onUse={handleUse}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <AccountRow
                  key={`${account.portal}-${account.identifier}`}
                  account={account}
                  onUse={handleUse}
                />
              ))}
            </div>
          )}

          <p className="pt-1 text-[10px] leading-relaxed text-slate-400">
            Tenant de test autonome — emails non délivrables
            @academia-helm.test, aucune donnée réelle n&apos;est impactée par les tests.
          </p>
        </div>

        {/* Pied — bouton Fermer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
