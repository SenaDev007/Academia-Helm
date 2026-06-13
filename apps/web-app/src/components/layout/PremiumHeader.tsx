/**
 * Premium Header Component
 * 
 * Header moderne, professionnel et attrayant pour les pages publiques.
 * Design premium institutionnel avec animations subtiles.
 * 
 * Sur un sous-domaine tenant : affiche le logo et nom de l'école.
 * Sur le domaine principal : affiche le branding Academia Helm.
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { bgColor, textColor } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';
import { useSchoolBranding, type SchoolBrandingData } from '@/hooks/useSchoolBranding';

/**
 * Vérifie si l'utilisateur est authentifié en lisant le cookie non-httpOnly.
 * Le cookie `academia_token` est accessible côté client (requis pour Axios).
 */
function useIsAuthenticated(): boolean {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    try {
      const hasToken = document.cookie
        .split(';')
        .some((c) => c.trim().startsWith('academia_token='));
      setIsAuthenticated(hasToken);
    } catch {
      // Cookie indisponible (SSR, etc.)
    }
  }, []);

  return isAuthenticated;
}

interface PremiumHeaderProps {
  /** Branding de l'école (résolu côté serveur sur le sous-domaine) */
  schoolBranding?: SchoolBrandingData | null;
}

export default function PremiumHeader({ schoolBranding: serverBranding }: PremiumHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const isAuthenticated = useIsAuthenticated();
  const ariaExpanded = isMenuOpen ? 'true' : 'false';

  // Résoudre le branding de l'école : priorité au serverBranding, sinon hook client
  const resolvedBranding = useSchoolBranding(serverBranding);
  const schoolBranding = serverBranding || resolvedBranding;

  // Sur un sous-domaine avec branding d'école, on adapte le header
  const isSchoolContext = !!schoolBranding;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (path: string) => {
    if (path.includes('#')) return false;
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const menuItems: Array<{ path: string; label: string; isInstitutional?: boolean }> = isSchoolContext
    ? [
        // Menu contextuel sur sous-domaine d'école
        { path: '/school-portal', label: 'Portails' },
        { path: '/login', label: 'Connexion' },
        { path: '/public/pre-enrollment', label: 'Pré-inscription' },
      ]
    : [
        // Menu complet sur domaine principal
        { path: '/', label: 'Accueil' },
        { path: '/modules', label: 'Modules' },
        { path: '/blog', label: 'Blog' },
        { path: '/#tarification', label: 'Tarification' },
        { path: '/jobs', label: 'Recrutement' },
        { path: '/federis', label: 'Academia Federis', isInstitutional: true },
        { path: '/contact', label: 'Contact' },
      ];

  // Couleur du header sur sous-domaine école
  const headerBg = isSchoolContext && schoolBranding?.primaryColor
    ? schoolBranding.primaryColor
    : '#0b2f73';
  const headerAccent = isSchoolContext && schoolBranding?.secondaryColor
    ? schoolBranding.secondaryColor
    : '#f5b335';

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-[--header-bg]/92 backdrop-blur-md shadow-xl border-b border-amber-300/30'
          : 'border-b shadow-sm'
      )}
      style={{
        backgroundColor: isScrolled ? undefined : headerBg,
        borderColor: isSchoolContext ? `${headerAccent}30` : '#144798',
        ['--header-bg' as string]: headerBg,
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between h-14 md:h-16 flex-nowrap px-4 sm:px-6 lg:px-8">
          {/* Logo + Nom */}
          <Link 
            href={isSchoolContext ? '/school-portal' : '/'}
            prefetch={true}
            className="flex items-center space-x-1 group transition-transform duration-200 hover:scale-105 flex-shrink-0"
          >
            <div className="relative">
              {schoolBranding?.logoUrl ? (
                <Image
                  src={schoolBranding.logoUrl}
                  alt={schoolBranding.name}
                  width={40}
                  height={40}
                  className="h-10 md:h-11 w-auto rounded-full object-cover transition-opacity duration-200 group-hover:opacity-90"
                  priority
                  sizes="(max-width: 768px) 32px, 40px"
                />
              ) : (
                <Image
                  src="/images/logo-Academia Hub.png"
                  alt={`${BRAND.name} - ${BRAND.subtitle}`}
                  width={40}
                  height={40}
                  className="h-10 md:h-11 w-auto transition-opacity duration-200 group-hover:opacity-90"
                  priority
                  sizes="(max-width: 768px) 32px, 40px"
                />
              )}
            </div>
            <div className="font-bold leading-none">
              {isSchoolContext ? (
                <>
                  <span className="text-base sm:text-lg md:text-xl block text-white truncate max-w-[180px] sm:max-w-[240px] md:max-w-none">
                    {schoolBranding?.name || BRAND.name}
                  </span>
                  {schoolBranding?.slogan && (
                    <span className="text-[9px] sm:text-[10px] md:text-xs block -mt-1.5 text-amber-300/70 truncate max-w-[180px] sm:max-w-[240px] md:max-w-none">
                      {schoolBranding.slogan}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-base sm:text-lg md:text-xl block text-white">Academia</span>
                  <span className="text-[10px] sm:text-xs md:text-sm block -mt-1.5 text-amber-300">Helm</span>
                </>
              )}
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-3 flex-nowrap flex-shrink-0">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                prefetch={true}
                className={cn(
                  'relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  item.isInstitutional
                    ? 'text-amber-300 font-semibold border border-amber-300/40 hover:border-amber-300/70 hover:bg-white/10'
                    : isActive(item.path)
                    ? 'text-white bg-white/15'
                    : 'text-blue-100 hover:text-white hover:bg-white/10'
                )}
              >
                {item.label}
                {isActive(item.path) && !item.isInstitutional && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-amber-300 rounded-full" />
                )}
              </Link>
            ))}
            <div className="ml-8 pl-8 border-l border-white/20 flex-shrink-0 flex items-center space-x-3">
              {isSchoolContext ? (
                <Link
                  href="/login"
                  prefetch={true}
                  className={cn(
                    'px-6 py-2.5 rounded-md min-h-[44px]',
                    'font-semibold transition-all duration-200',
                    'shadow-sm hover:shadow-md transform hover:-translate-y-0.5',
                    'inline-flex items-center space-x-2 text-white',
                    'border border-white/30 hover:bg-white/10'
                  )}
                >
                  <span>Se connecter</span>
                  <AppIcon name="login" size="submenu" className="text-white" />
                </Link>
              ) : isAuthenticated ? (
                <Link
                  href="/app"
                  prefetch={true}
                  className={cn(
                    'bg-[#f5b335] text-[#0b2f73] px-6 py-2.5 rounded-md min-h-[44px]',
                    'font-semibold hover:bg-[#f7c359] transition-all duration-200',
                    'shadow-sm hover:shadow-md transform hover:-translate-y-0.5',
                    'inline-flex items-center space-x-2'
                  )}
                >
                  <span>Retourner à l&apos;application</span>
                  <AppIcon name="dashboard" size="submenu" className="text-[#0b2f73]" />
                </Link>
              ) : (
                <Link
                  href="/portal"
                  prefetch={true}
                  className={cn(
                    'bg-[#f5b335] text-[#0b2f73] px-6 py-2.5 rounded-md min-h-[44px]',
                    'font-semibold hover:bg-[#f7c359] transition-all duration-200',
                    'shadow-sm hover:shadow-md transform hover:-translate-y-0.5',
                    'inline-flex items-center space-x-2'
                  )}
                >
                  <span>Accéder à un portail</span>
                  <AppIcon name="login" size="submenu" className="text-[#0b2f73]" />
                </Link>
              )}
            </div>
          </nav>

          {/* Mobile Menu Button — zone tap 44px min (spec responsive) */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                'p-2.5 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center',
                'text-white',
                'hover:bg-white/10 transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-[#0b2f73]'
              )}
              aria-label="Toggle menu"
              aria-expanded={ariaExpanded}
            >
              {isMenuOpen ? (
                <AppIcon name="close" size="menu" className="text-blue-900" />
              ) : (
                <AppIcon name="menu" size="menu" className="text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

          {/* Mobile Menu */}
      <div
        className={cn(
          'lg:hidden overflow-hidden transition-all duration-300 ease-in-out',
          isMenuOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="border-t border-white/20 shadow-lg" style={{ backgroundColor: headerBg }}>
          <nav className="flex flex-col px-4 py-4 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  'px-4 py-3 rounded-lg text-base font-medium transition-all duration-200',
                  item.isInstitutional
                    ? 'text-amber-300 font-semibold border border-amber-300/40 bg-white/10 hover:bg-white/20'
                    : isActive(item.path)
                    ? 'text-white bg-white/15 font-semibold'
                    : 'text-blue-100 hover:text-white hover:bg-white/10'
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 mt-4 border-t border-gray-200 space-y-2">
              {isSchoolContext ? (
                <Link
                  href="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    'text-white w-full py-3 rounded-md min-h-[44px]',
                    'font-semibold transition-all duration-200',
                    'shadow-sm hover:shadow-md',
                    'inline-flex items-center justify-center space-x-2',
                    'border border-white/30 hover:bg-white/10'
                  )}
                >
                  <span>Se connecter</span>
                  <AppIcon name="login" size="submenu" className="text-white" />
                </Link>
              ) : isAuthenticated ? (
                <Link
                  href="/app"
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    'bg-[#f5b335] text-[#0b2f73] w-full py-3 rounded-md min-h-[44px]',
                    'font-semibold hover:bg-[#f7c359] transition-all duration-200',
                    'shadow-sm hover:shadow-md',
                    'inline-flex items-center justify-center space-x-2'
                  )}
                >
                  <span>Retourner à l&apos;application</span>
                  <AppIcon name="dashboard" size="submenu" className="text-[#0b2f73]" />
                </Link>
              ) : (
                <Link
                  href="/portal"
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    'bg-[#f5b335] text-[#0b2f73] w-full py-3 rounded-md min-h-[44px]',
                    'font-semibold hover:bg-[#f7c359] transition-all duration-200',
                    'shadow-sm hover:shadow-md',
                    'inline-flex items-center justify-center space-x-2'
                  )}
                >
                  <span>Accéder à un portail</span>
                  <AppIcon name="login" size="submenu" className="text-[#0b2f73]" />
                </Link>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
