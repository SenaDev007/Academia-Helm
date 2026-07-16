'use client';

/**
 * ============================================================================
 * TENANT HEADER — Navbar institutionnelle conforme CDC Academia Helm
 * ============================================================================
 *
 * Conforme au cahier des charges « Site institutionnel multi-tenant » :
 *   - Fixe, sticky au scroll
 *   - Transparente sur le Hero (rgba navy 0)
 *   - Devient opaque (fond navy) après 80px de scroll
 *   - Logo établissement + nom
 *   - Menu : Accueil, À propos, Programmes, Admissions, Vie scolaire, Actualités, Contact
 *   - Bouton CTA principal « Portail » (or) qui renvoie vers /portal du tenant
 *
 * Utilisé sur toutes les pages du site institutionnel de l'école :
 *   - / (InstitutionalWebsite)
 *   - /jobs (TenantCareersPage)
 *   - /portal (TenantPortalSelectionPage)
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LogoCircle from '@/components/ui/LogoCircle';

interface TenantHeaderProps {
  schoolName: string;
  schoolAcronym?: string | null;
  schoolLogo?: string | null;
  schoolSlogan?: string | null;
  colors: { primary: string; secondary: string; accent: string; dark: string };
  activeNav?: string;
  /** When true (default), navbar is transparent at top of page and becomes opaque after scroll. */
  transparentAtTop?: boolean;
  /** Custom nav links (defaults to CDC menu). */
  navLinks?: Array<{ label: string; href: string }>;
  /** Path to the tenant portal selection page (default: '/portal'). */
  portalHref?: string;
}

const CDC_NAV_LINKS = [
  { label: 'Accueil', href: '/#hero' },
  { label: 'À propos', href: '/#a-propos' },
  { label: 'Programmes', href: '/#programmes' },
  { label: 'Admissions', href: '/#admissions' },
  { label: 'Vie scolaire', href: '/#vie-scolaire' },
  { label: 'Actualités', href: '/#actualites' },
  { label: 'Contact', href: '/#contact' },
];

export default function TenantHeader({
  schoolName,
  schoolAcronym,
  schoolLogo,
  schoolSlogan,
  colors,
  activeNav = 'Accueil',
  transparentAtTop = true,
  navLinks = CDC_NAV_LINKS,
  portalHref = '/portal',
}: TenantHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // CDC 3.1 — Navbar transparente sur le Hero, devient opaque après 80px de scroll
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const displayName = schoolAcronym || schoolName;
  const isOpaque = scrolled || !transparentAtTop;

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    if (href.startsWith('/#')) {
      const anchor = href.slice(1);
      if (window.location.pathname !== '/') {
        window.location.href = href;
      } else {
        document.querySelector(anchor)?.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (href.startsWith('#')) {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.href = href;
    }
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: isOpaque
          ? `linear-gradient(135deg, ${colors.primary} 0%, ${colors.dark} 100%)`
          : 'transparent',
        backdropFilter: isOpaque ? 'blur(12px)' : 'none',
        boxShadow: isOpaque ? '0 4px 24px rgba(0,0,0,0.18)' : 'none',
      }}
    >
      {/* Liseré or signature Academia Helm */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`,
          opacity: isOpaque ? 1 : 0.5,
        }}
        aria-hidden
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo + nom établissement */}
          <Link href="/" className="flex items-center gap-3 shrink-0 group">
            <LogoCircle logoUrl={schoolLogo} alt={schoolName} size={40} />
            <div className="hidden sm:block leading-tight">
              <h1
                className="text-sm md:text-base font-bold tracking-tight transition-colors"
                style={{ color: '#FFFFFF' }}
              >
                {displayName}
              </h1>
              {schoolAcronym && schoolName !== schoolAcronym ? (
                <p
                  className="text-[10px] truncate max-w-[200px]"
                  style={{ color: `${colors.accent}cc` }}
                >
                  {schoolName}
                </p>
              ) : !schoolAcronym && schoolSlogan ? (
                <p
                  className="text-[10px] truncate max-w-[200px]"
                  style={{ color: `${colors.accent}cc` }}
                >
                  {schoolSlogan}
                </p>
              ) : null}
            </div>
          </Link>

          {/* Menu desktop — 7 items CDC */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = activeNav === link.label;
              return (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="relative px-3 py-2 text-sm font-medium transition-colors rounded-lg group"
                  style={{ color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.85)' }}
                >
                  {link.label}
                  {/* Underline or au survol */}
                  <span
                    className="absolute left-3 right-3 -bottom-0.5 h-0.5 rounded-full transition-all duration-200"
                    style={{
                      background: colors.accent,
                      transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
                      transformOrigin: 'left',
                    }}
                  />
                </button>
              );
            })}
          </nav>

          {/* CTA Portail (or) + bouton mobile */}
          <div className="flex items-center gap-2">
            <Link
              href={portalHref}
              className="hidden md:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow-md hover:scale-105"
              style={{
                background: `linear-gradient(135deg, ${colors.accent}, #e09e1f)`,
                color: colors.primary,
              }}
            >
              Portail <ArrowRight size={14} />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Menu mobile animé */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="lg:hidden overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.dark} 100%)`,
            }}
          >
            <div className="px-4 py-3 space-y-1 border-t border-white/10">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className="block w-full text-left px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-white/10 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.9)' }}
                >
                  {link.label}
                </button>
              ))}
              <Link
                href={portalHref}
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-center px-4 py-3 mt-2 text-sm font-bold rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${colors.accent}, #e09e1f)`,
                  color: colors.primary,
                }}
              >
                Portail
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
