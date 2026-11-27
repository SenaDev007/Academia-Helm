'use client';

/**
 * ============================================================================
 * FOOTER 4 COLONNES — Footer institutionnel conforme CDC Academia Helm
 * ============================================================================
 *
 * Conforme au cahier des charges « Site institutionnel multi-tenant » § 3.10 :
 *   - Colonne 1 : Logo, nom, baseline, réseaux sociaux
 *   - Colonne 2 : Navigation (miroir de la navbar)
 *   - Colonne 3 : Portails — boutons « Portail École », « Portail Enseignant »,
 *     « Portail Parent » qui renvoient vers /login?portal=...&tenant=...
 *   - Colonne 4 : Légal (mentions, confidentialité, CGU)
 *   - Ligne de bas : © Année, nom établissement — Propulsé par Academia Helm
 *
 * Palette Helm : Navy, Blue, Gold, fond sombre (#091f4a)
 * ============================================================================
 */

import {
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Globe,
  Building2,
  GraduationCap,
  Users,
  ArrowRight,
  FileText,
  Shield,
  Scale,
} from 'lucide-react';
import Link from 'next/link';
import LogoCircle from '@/components/ui/LogoCircle';
import { HELM_DEFAULT, type TenantColors } from '@/lib/tenant/tenant-colors-core';
import { persistPortalSchoolBrand } from '@/lib/tenant/public-brand';

interface FooterProps {
  schoolName: string;
  schoolLogo?: string | null;
  schoolAcronym?: string | null;
  schoolSlogan?: string | null;
  schoolAddress?: string | null;
  schoolCity?: string | null;
  schoolPhone?: string | null;
  schoolEmail?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  footerAboutText?: string | null;
  footerCopyrightText?: string | null;
  socialLinks?: Record<string, string> | null;
  navLinks?: Array<{ label: string; href: string }>;
  /** Tenant slug — used to build portal links (/login?portal=...&tenant=slug). */
  tenantSlug?: string | null;
  /** ⭐ 2026-11-27 — Palette de marque de l'école (logo/thème/CMS) : le
   *  footer suit désormais la même palette dynamique que le header
   * (demande promoteur — « le footer n'est pas pris en compte »). */
  colors?: TenantColors | null;
}

const SOCIAL_ICONS: Record<string, any> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  twitter: Globe,
  youtube: Globe,
  whatsapp: Phone,
  telegram: Globe,
};

const PORTAL_BUTTONS = [
  {
    type: 'SCHOOL',
    label: 'Portail École',
    description: 'Direction & administration',
    Icon: Building2,
  },
  {
    type: 'TEACHER',
    label: 'Portail Enseignant',
    description: 'Pédagogie & suivi',
    Icon: GraduationCap,
  },
  {
    type: 'PARENT',
    label: 'Portail Parent',
    description: 'Suivi & communication',
    Icon: Users,
  },
];

export default function TenantFooter({
  schoolName,
  schoolLogo,
  schoolAcronym,
  schoolSlogan,
  schoolAddress,
  schoolCity,
  schoolPhone,
  schoolEmail,
  contactEmail,
  contactPhone,
  contactAddress,
  footerAboutText,
  footerCopyrightText,
  socialLinks,
  navLinks = [],
  tenantSlug,
  colors,
}: FooterProps) {
  // ⭐ 2026-11-27 — Palette effective : celle de l'ÉCOLE (comme le header),
  // charte Helm en repli. Fond = dégradé primary → dark, accents = accent.
  const c: TenantColors = colors || HELM_DEFAULT;
  const ACCENT = c.accent;
  const displayName = schoolAcronym || schoolName;
  const aboutText = footerAboutText || schoolSlogan || '';
  const email = contactEmail || schoolEmail || '';
  const phone = contactPhone || schoolPhone || '';
  const address = contactAddress || schoolAddress || '';
  const city = schoolCity || '';

  const socialEntries = socialLinks
    ? Object.entries(socialLinks).filter(([, url]) => url && typeof url === 'string' && url.trim())
    : [];

  const buildPortalUrl = (portalType: string) => {
    const params = new URLSearchParams({
      portal: portalType.toLowerCase(),
    });
    if (tenantSlug) {
      params.set('tenant', tenantSlug);
      params.set('school_name', schoolName);
    }
    return `/login?${params.toString()}`;
  };

  // ⭐ 2026-11-27 — Persistance du branding (logo + palette) avant de suivre
  // un lien portail : la page /login et son écran de chargement s'affichent
  // INSTANTANÉMENT aux couleurs de l'école (même sur le domaine principal).
  const persistBrandBeforePortal = () => {
    if (!tenantSlug) return;
    persistPortalSchoolBrand({
      name: schoolName,
      slug: tenantSlug,
      logoUrl: schoolLogo || null,
      city: schoolCity || null,
      phone: schoolPhone || null,
      address: schoolAddress || null,
      slogan: schoolSlogan || null,
      schoolAcronym: schoolAcronym || null,
      brandColors: colors || null,
    });
  };

  const legalLinks = [
    { label: 'Mentions légales', href: '/legal/mentions', Icon: FileText },
    { label: 'Politique de confidentialité', href: '/legal/confidentialite', Icon: Shield },
    { label: 'CGU', href: '/legal/cgu', Icon: Scale },
  ];

  return (
    <footer className="mt-16 w-full" style={{ background: `linear-gradient(180deg, ${c.dark} 0%, ${c.primary} 190%)` }}>
      {/* Règles hover dynamiques — la couleur d'accent vient de la palette de
          l'école : impossible en Tailwind statique, d'où ce bloc scoped. */}
      <style>{`
        .tf-hover-accent:hover { color: ${ACCENT}; }
        .tf-hover-accent-border:hover { border-color: ${ACCENT}55; }
        .tf-hover-portal:hover { background-color: ${ACCENT}1f; border-color: ${ACCENT}55; }
        .tf-hover-portal .tf-portal-arrow { color: ${ACCENT}; }
      `}</style>
      {/* Liseré accent haut de footer (rappel de la navbar) */}
      <div
        className="h-[3px] w-full"
        style={{ background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }}
        aria-hidden
      />
      <div className="mx-auto max-w-7xl px-4 pt-14 pb-6 sm:px-6 lg:px-8 lg:pt-20">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* ═══ Colonne 1 : Logo, nom, baseline, réseaux sociaux ═══ */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <LogoCircle logoUrl={schoolLogo} alt={schoolName} size={40} />
              <div>
                <h3 className="text-white font-bold text-base">{displayName}</h3>
                {schoolAcronym && schoolName !== schoolAcronym && (
                  <p className="text-[10px]" style={{ color: `${ACCENT}99` }}>{schoolName}</p>
                )}
              </div>
            </div>

            {aboutText && (
              <p className="text-sm text-slate-400/80 leading-relaxed max-w-md mb-4">
                {aboutText}
              </p>
            )}

            {/* Coordonnées condensées */}
            <ul className="space-y-2 text-xs">
              {email && (
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-2 text-slate-400/70 hover:text-white transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: `${ACCENT}cc` }} />
                    <span className="truncate">{email}</span>
                  </a>
                </li>
              )}
              {phone && (
                <li>
                  <a
                    href={`tel:${phone}`}
                    className="flex items-center gap-2 text-slate-400/70 hover:text-white transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: `${ACCENT}cc` }} />
                    <span>{phone}</span>
                  </a>
                </li>
              )}
              {address && (
                <li className="flex items-start gap-2 text-slate-400/70">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: `${ACCENT}cc` }} />
                  <address className="not-italic">
                    {address}
                    {city ? `, ${city}` : ''}
                  </address>
                </li>
              )}
            </ul>

            {socialEntries.length > 0 && (
              <ul className="mt-5 flex gap-3">
                {socialEntries.map(([platform, url]) => {
                  const Icon = SOCIAL_ICONS[platform] || Globe;
                  return (
                    <li key={platform}>
                      <a
                        href={url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = `${ACCENT}26`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                        title={platform}
                      >
                        <span className="sr-only">{platform}</span>
                        <Icon className="h-4 w-4" style={{ color: `${ACCENT}cc` }} />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ═══ Colonne 2 : Navigation (miroir de la navbar) ═══ */}
          <div>
            <p className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
              Navigation
            </p>
            <ul className="space-y-3 text-sm">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="tf-hover-accent text-slate-400/70 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ═══ Colonne 3 : Portails (3 boutons) ═══ */}
          <div>
            <p className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
              Portails
            </p>
            <ul className="space-y-3">
              {PORTAL_BUTTONS.map(({ type, label, description, Icon }) => (
                <li key={type}>
                  <Link
                    href={buildPortalUrl(type)}
                    onClick={persistBrandBeforePortal}
                    className="tf-hover-portal group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/10 transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: `${ACCENT}26` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: ACCENT }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="text-[10px] text-slate-400/70 truncate">{description}</p>
                    </div>
                    <ArrowRight className="tf-portal-arrow h-3.5 w-3.5 text-slate-500 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ═══ Colonne 4 : Légal ═══ */}
          <div>
            <p className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
              Légal
            </p>
            <ul className="space-y-3 text-sm">
              {legalLinks.map(({ label, href, Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center gap-2 text-slate-400/70 hover:text-white transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: `${ACCENT}99` }} />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ═══ Ligne de bas de page : © Année, nom établissement — Propulsé par Academia Helm ═══ */}
        <div className="mt-12 border-t border-white/10 pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500 text-center sm:text-left">
              {footerCopyrightText ||
                `© ${new Date().getFullYear()} ${schoolName}. Tous droits réservés.`}
            </p>
            <p className="text-xs flex items-center gap-1.5 text-slate-500">
              Propulsé par{' '}
              <span className="font-bold" style={{ color: ACCENT }}>Academia Helm</span>
              <span className="text-slate-600">—</span>
              <a
                href="https://yehiortech.com"
                target="_blank"
                rel="noopener noreferrer"
                className="tf-hover-accent transition-colors"
              >
                YEHI OR Tech
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
