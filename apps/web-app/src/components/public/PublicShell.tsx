/**
 * ============================================================================
 * PUBLIC SHELL — Cadre visuel unifié pour toutes les pages publiques Helm
 * ============================================================================
 *
 * Applique l'identité Helm (palette Navy/Blue/Gold) aux pages publiques :
 *   - Header bleu (gradient NAVY → BLUE) avec logo école + badge Sécurisé
 *   - Body blanc centré
 *   - Footer bleu avec mention Academia Helm
 *
 * Utilisé par :
 *   - /sign/contract/[token]
 *   - /test/[token]
 *   - /upload-documents/[token]
 *   - /staff-card/[token]
 *
 * Palette Academia Helm exclusive :
 *   Navy  #0b2f73  |  Blue  #1d4fa5  |  Gold  #f5b335
 * ============================================================================
 */

import { ReactNode } from 'react';
import { ShieldCheck, Home } from 'lucide-react';

export const HELM_NAVY = '#0b2f73';
export const HELM_BLUE = '#1d4fa5';
export const HELM_GOLD = '#f5b335';

export interface PublicShellProps {
  /** Nom de l'établissement (affiché dans le header bleu) */
  schoolName?: string;
  /** URL du logo école (affiché à gauche dans le header bleu) */
  schoolLogoUrl?: string | null;
  /** Sous-titre court sous le nom école (ex: "Signature électronique de contrat") */
  subtitle?: string;
  /** Badge optionnel à droite du header (ex: "Sécurisé"). Défaut: shield "Sécurisé" */
  badge?: ReactNode;
  /** Largeur max du contenu (Tailwind class). Défaut: max-w-3xl */
  maxWidthClass?: string;
  /** Contenu de la page */
  children: ReactNode;
  /** Désactiver le footer (par défaut: false) */
  hideFooter?: boolean;
}

export function PublicShell({
  schoolName,
  schoolLogoUrl,
  subtitle,
  badge,
  maxWidthClass = 'max-w-3xl',
  children,
  hideFooter = false,
}: PublicShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* ── Header bleu Helm ── */}
      <header
        className="relative sticky top-0 z-30 shadow-md"
        style={{ background: `linear-gradient(135deg, ${HELM_NAVY} 0%, ${HELM_BLUE} 100%)` }}
      >
        {/* Halo décoratif */}
        <div
          className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-20 blur-3xl"
          style={{ background: HELM_GOLD }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-12 left-1/3 h-24 w-24 rounded-full opacity-15 blur-3xl"
          style={{ background: '#ffffff' }}
          aria-hidden
        />

        <div className={`relative mx-auto ${maxWidthClass} px-4 sm:px-6 py-4 flex items-center justify-between gap-4`}>
          {/* Logo + Nom école */}
          <div className="flex items-center gap-3 min-w-0">
            {schoolLogoUrl && (
              <img
                src={schoolLogoUrl}
                alt={schoolName || 'Établissement'}
                className="h-10 w-10 rounded-xl object-contain bg-white/95 p-0.5 border border-white/30 shadow-sm flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="font-bold text-white text-sm sm:text-base truncate">
                {schoolName || 'Academia Helm'}
              </div>
              {subtitle && (
                <div className="text-[11px] sm:text-xs text-blue-100 truncate">{subtitle}</div>
              )}
            </div>
          </div>

          {/* Badge droit */}
          {badge !== undefined ? (
            badge
          ) : (
            <div
              className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold px-3 py-1.5 rounded-full"
              style={{
                color: HELM_GOLD,
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.25)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Sécurisé
            </div>
          )}
        </div>
        {/* Liseré doré en bas du header */}
        <div className="h-0.5 w-full" style={{ background: `linear-gradient(to right, transparent, ${HELM_GOLD}, transparent)` }} />
      </header>

      {/* ── Body blanc ── */}
      <main className={`flex-1 mx-auto ${maxWidthClass} w-full px-4 sm:px-6 py-6 sm:py-8`}>
        {children}
      </main>

      {/* ── Footer bleu Helm ── */}
      {!hideFooter && (
        <footer
          className="mt-auto"
          style={{ background: `linear-gradient(135deg, ${HELM_NAVY} 0%, ${HELM_BLUE} 100%)` }}
        >
          <div className={`mx-auto ${maxWidthClass} px-4 sm:px-6 py-5 text-center`}>
            <p className="text-xs text-blue-100">
              <span className="font-bold text-white">Academia Helm</span> — Plateforme de pilotage éducatif
            </p>
            <p className="mt-1 text-[10px] text-blue-200">
              En cas de problème, contactez votre établissement.
            </p>
            <a
              href="https://www.academiahelm.com"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-colors"
              style={{
                background: 'rgba(255,255,255,0.10)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              <Home className="h-3 w-3" /> Aller à l&apos;accueil
            </a>
          </div>
        </footer>
      )}
    </div>
  );
}

/**
 * Composant carte blanche standard pour le contenu.
 * Style cohérent avec le shell (border slate, ombre douce, en-tête bleu optionnel).
 */
export function PublicCard({
  children,
  title,
  icon,
  accentColor = HELM_NAVY,
}: {
  children: ReactNode;
  title?: ReactNode;
  icon?: ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {title && (
        <div
          className="p-4 sm:p-5 text-white flex items-center gap-2"
          style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${HELM_BLUE} 100%)` }}
        >
          {icon}
          <h2 className="text-base sm:text-lg font-bold">{title}</h2>
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}
