'use client';

/**
 * ============================================================================
 * FOOTER 4 COLONNES — Footer institutionnel pour les sites tenants
 * ============================================================================
 *
 * Footer à 4 colonnes avec logo, description, réseaux sociaux,
 * liens de navigation et coordonnées de contact.
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
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import LogoCircle from '@/components/ui/LogoCircle';

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
}: FooterProps) {
  const displayName = schoolAcronym || schoolName;
  const aboutText = footerAboutText || schoolSlogan || '';
  const email = contactEmail || schoolEmail || '';
  const phone = contactPhone || schoolPhone || '';
  const address = contactAddress || schoolAddress || '';
  const city = schoolCity || '';

  const socialEntries = socialLinks
    ? Object.entries(socialLinks).filter(([, url]) => url && typeof url === 'string' && url.trim())
    : [];

  const contactInfo = [
    { icon: Mail, text: email, href: email ? `mailto:${email}` : undefined },
    { icon: Phone, text: phone, href: phone ? `tel:${phone}` : undefined },
    { icon: MapPin, text: address ? `${address}${city ? `, ${city}` : ''}` : '', isAddress: true },
  ].filter(c => c.text);

  return (
    <footer className="bg-[#091f4a] text-slate-400 mt-16 w-full">
      <div className="mx-auto max-w-7xl px-4 pt-14 pb-6 sm:px-6 lg:px-8 lg:pt-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* Colonne 1: Logo + Description + Réseaux */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <LogoCircle logoUrl={schoolLogo} alt={schoolName} size={36} />
              <div>
                <h3 className="text-white font-bold text-base">{displayName}</h3>
                {schoolAcronym && schoolName !== schoolAcronym && (
                  <p className="text-[10px] text-amber-300/60">{schoolName}</p>
                )}
              </div>
            </div>

            {aboutText && (
              <p className="text-sm text-slate-400/80 leading-relaxed max-w-md">
                {aboutText}
              </p>
            )}

            {socialEntries.length > 0 && (
              <ul className="mt-6 flex gap-4">
                {socialEntries.map(([platform, url]) => {
                  const Icon = SOCIAL_ICONS[platform] || Globe;
                  return (
                    <li key={platform}>
                      <a
                        href={url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-400 hover:text-amber-300 transition-colors"
                        title={platform}
                      >
                        <span className="sr-only">{platform}</span>
                        <Icon className="h-5 w-5" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Colonnes 2-3-4: Navigation + Contact */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:col-span-2">
            {/* Navigation */}
            {navLinks.length > 0 && (
              <div className="text-center sm:text-left">
                <p className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Navigation</p>
                <ul className="space-y-3 text-sm">
                  {navLinks.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-slate-400/70 hover:text-white transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link href="/#portails" className="text-slate-400/70 hover:text-white transition-colors">
                      Portails
                    </Link>
                  </li>
                </ul>
              </div>
            )}

            {/* Liens rapides */}
            <div className="text-center sm:text-left">
              <p className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Liens rapides</p>
              <ul className="space-y-3 text-sm">
                <li><Link href="/#presentation" className="text-slate-400/70 hover:text-white transition-colors">Présentation</Link></li>
                <li><Link href="/#actualites" className="text-slate-400/70 hover:text-white transition-colors">Actualités</Link></li>
                <li><Link href="/#agenda" className="text-slate-400/70 hover:text-white transition-colors">Agenda</Link></li>
                <li><Link href="/#galerie" className="text-slate-400/70 hover:text-white transition-colors">Galerie</Link></li>
                <li><Link href="/jobs" className="text-slate-400/70 hover:text-white transition-colors">Recrutement</Link></li>
              </ul>
            </div>

            {/* Contact */}
            {contactInfo.length > 0 && (
              <div className="text-center sm:text-left">
                <p className="text-white font-semibold text-sm uppercase tracking-wider mb-4">Contact</p>
                <ul className="space-y-3 text-sm">
                  {contactInfo.map(({ icon: Icon, text, href, isAddress }) => (
                    <li key={text}>
                      <a
                        href={href || '#'}
                        className="flex items-center justify-center gap-2 sm:justify-start text-slate-400/70 hover:text-white transition-colors"
                      >
                        <Icon className="h-4 w-4 text-amber-400/80 shrink-0" />
                        {isAddress ? (
                          <address className="not-italic flex-1">{text}</address>
                        ) : (
                          <span className="flex-1">{text}</span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t border-white/10 pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {footerCopyrightText || `© ${new Date().getFullYear()} ${schoolName}. Tous droits réservés.`}
            </p>
            <p className="text-xs flex items-center gap-1.5 text-slate-500">
              Propulsé par <span className="font-bold text-amber-400">Academia Helm</span>
              <span className="text-slate-600">—</span>
              <a href="https://yehiortech.com" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">
                YEHI OR Tech
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
