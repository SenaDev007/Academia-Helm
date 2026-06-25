'use client';

/**
 * ============================================================================
 * TENANT HEADER — Header partagé du site institutionnel
 * ============================================================================
 *
 * Utilisé sur toutes les pages du site institutionnel de l'école :
 *   - / (InstitutionalWebsite)
 *   - /jobs (TenantCareersPage)
 *
 * Affiche le logo, l'acronyme, la navigation NotchNav et le bouton Portails.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronRight, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LogoCircle from '@/components/ui/LogoCircle';
import { NotchNav } from '@/components/ui/notch-nav';

interface TenantHeaderProps {
  schoolName: string;
  schoolAcronym?: string | null;
  schoolLogo?: string | null;
  schoolSlogan?: string | null;
  colors: { primary: string; secondary: string; accent: string; dark: string };
  activeNav?: string;
}

export default function TenantHeader({
  schoolName, schoolAcronym, schoolLogo, schoolSlogan, colors, activeNav = 'Accueil',
}: TenantHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const displayName = schoolAcronym || schoolName;

  const navLinks = [
    { label: 'Accueil', href: '/' },
    { label: 'Présentation', href: '/#presentation' },
    { label: 'Actualités', href: '/#actualites' },
    { label: 'Agenda', href: '/#agenda' },
    { label: 'Recrutement', href: '/jobs' },
    { label: 'Contact', href: '/#contact' },
  ];

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled
          ? `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`
          : 'rgba(11, 47, 115, 0.95)',
        backdropFilter: 'blur(12px)',
        boxShadow: scrolled ? '0 4px 20px rgba(0,0,0,0.15)' : 'none',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)` }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <LogoCircle logoUrl={schoolLogo} alt={schoolName} size={36} />
            <div className="hidden sm:block">
              <h1 className="text-sm md:text-base font-bold text-white leading-tight">{displayName}</h1>
              {schoolAcronym && schoolName !== schoolAcronym && (
                <p className="text-[10px] text-amber-300/70 leading-tight truncate max-w-[180px]">{schoolName}</p>
              )}
              {!schoolAcronym && schoolSlogan && (
                <p className="text-[10px] text-amber-300/80 leading-tight">{schoolSlogan}</p>
              )}
            </div>
          </Link>

          <div className="hidden lg:block">
            <NotchNav
              items={navLinks.map(l => ({ value: l.label, label: l.label, href: l.href }))}
              defaultValue={activeNav}
              onNavigate={(href) => {
                if (href.startsWith('/#')) {
                  window.location.href = href;
                } else if (href.startsWith('#')) {
                  document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  window.location.href = href;
                }
              }}
              ariaLabel="Navigation école"
            />
          </div>

          <div className="flex items-center gap-2">
            <Link href="/#portails"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-[#0b2f73] bg-[#f5b335] hover:bg-[#e09e1f] transition-all shadow-sm hover:shadow-md">
              Portails <ArrowRight size={14} />
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-white">
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="lg:hidden overflow-hidden border-t border-white/10">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-sm font-medium text-blue-100/80 hover:bg-white/10 rounded-lg">
                  {link.label}
                </Link>
              ))}
              <Link href="/#portails" onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-left px-3 py-2 text-sm font-bold text-[#0b2f73] bg-[#f5b335] rounded-lg">
                Portails
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
