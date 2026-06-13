'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/brand';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { useScroll } from '@/components/ui/use-scroll';
import { LimelightNav, type NavItem } from '@/components/ui/limelight-nav';
import {
  Home,
  LayoutGrid,
  BookOpen,
  CreditCard,
  Briefcase,
  GraduationCap,
  Mail,
} from 'lucide-react';

/**
 * Header Premium Academia Helm avec effet Limelight
 * 
 * Structure :
 * - Header sticky avec backdrop-blur au scroll
 * - Logo Academia Helm + wordmark
 * - Navigation desktop : LimelightNav (icônes + effet projecteur doré)
 * - CTA doré : "Accéder à un portail" / "Retourner à l'application"
 * - Menu mobile : portal overlay avec animation zoom-in
 */

// --- Vérification auth (cookie non-httpOnly) ---
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

// --- Icône Wordmark Academia Helm ---
const AcademiaHelmWordmark = (props: React.ComponentProps<'svg'>) => (
  <svg viewBox="0 0 200 32" fill="currentColor" {...props}>
    {/* Academia */}
    <text
      x="0"
      y="22"
      fontFamily="system-ui, sans-serif"
      fontWeight="800"
      fontSize="22"
      fill="white"
    >
      Academia
    </text>
    {/* Helm */}
    <text
      x="120"
      y="22"
      fontFamily="system-ui, sans-serif"
      fontWeight="800"
      fontSize="22"
      fill="#f5b335"
    >
      Helm
    </text>
  </svg>
);

// --- Éléments de navigation avec icônes Lucide ---
const desktopNavItems: NavItem[] = [
  {
    id: 'accueil',
    icon: <Home />,
    label: 'Accueil',
    onClick: () => {
      window.location.href = '/';
    },
  },
  {
    id: 'modules',
    icon: <LayoutGrid />,
    label: 'Modules',
    onClick: () => {
      window.location.href = '/modules';
    },
  },
  {
    id: 'blog',
    icon: <BookOpen />,
    label: 'Blog',
    onClick: () => {
      window.location.href = '/blog';
    },
  },
  {
    id: 'tarification',
    icon: <CreditCard />,
    label: 'Tarification',
    onClick: () => {
      window.location.href = '/#tarification';
    },
  },
  {
    id: 'recrutement',
    icon: <Briefcase />,
    label: 'Recrutement',
    onClick: () => {
      window.location.href = '/jobs';
    },
  },
  {
    id: 'federis',
    icon: <GraduationCap />,
    label: 'Academia Federis',
    onClick: () => {
      window.location.href = '/federis';
    },
  },
  {
    id: 'contact',
    icon: <Mail />,
    label: 'Contact',
    onClick: () => {
      window.location.href = '/contact';
    },
  },
];

// --- Liens mobile (labels textuels) ---
const mobileLinks = [
  { label: 'Accueil', href: '/' },
  { label: 'Modules', href: '/modules' },
  { label: 'Blog', href: '/blog' },
  { label: 'Tarification', href: '/#tarification' },
  { label: 'Recrutement', href: '/jobs' },
  { label: 'Academia Federis', href: '/federis', isInstitutional: true },
  { label: 'Contact', href: '/contact' },
];

export function Header() {
  const [open, setOpen] = React.useState(false);
  const scrolled = useScroll(10);
  const isAuthenticated = useIsAuthenticated();

  // Bloquer le scroll quand le menu mobile est ouvert
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Déterminer l'index actif pour le limelight
  const getActiveIndex = () => {
    if (typeof window === 'undefined') return 0;
    const path = window.location.pathname;
    if (path === '/') return 0;
    if (path.startsWith('/modules')) return 1;
    if (path.startsWith('/blog')) return 2;
    if (path.includes('tarification') || path === '/') return 3;
    if (path.startsWith('/jobs')) return 4;
    if (path.startsWith('/federis')) return 5;
    if (path.startsWith('/contact')) return 6;
    return 0;
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'bg-[#0b2f73]/92 backdrop-blur-lg shadow-xl border-b border-amber-300/20'
          : 'bg-[#0b2f73] border-b border-[#144798] shadow-sm',
      )}
    >
      <nav className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo + Wordmark */}
        <Link
          href="/"
          prefetch={true}
          className="flex items-center space-x-1 group transition-transform duration-200 hover:scale-105 flex-shrink-0"
        >
          <div className="relative">
            <Image
              src="/images/logo-Academia Hub.png"
              alt={`${BRAND.name} - ${BRAND.subtitle}`}
              width={40}
              height={40}
              className="h-10 md:h-11 w-auto transition-opacity duration-200 group-hover:opacity-90"
              priority
              sizes="(max-width: 768px) 32px, 40px"
            />
          </div>
          <div className="font-bold leading-none">
            <span className="text-base sm:text-lg md:text-xl block text-white">Academia</span>
            <span className="text-[10px] sm:text-xs md:text-sm block -mt-1.5 text-amber-300">Helm</span>
          </div>
        </Link>

        {/* Desktop Navigation — LimelightNav + CTA */}
        <div className="hidden md:flex items-center gap-4">
          <LimelightNav
            items={desktopNavItems}
            defaultActiveIndex={getActiveIndex()}
            className="bg-transparent border-0"
            limelightClassName="shadow-[0_50px_15px_rgba(245,179,53,0.35)]"
          />
          
          {/* CTA Bouton doré */}
          <div className="ml-4 pl-4 border-l border-white/20 flex-shrink-0">
            {isAuthenticated ? (
              <Link
                href="/app"
                prefetch={true}
                className={cn(
                  'bg-[#f5b335] text-[#0b2f73] px-5 py-2 rounded-md min-h-[40px]',
                  'font-semibold hover:bg-[#f7c359] transition-all duration-200',
                  'shadow-sm hover:shadow-md transform hover:-translate-y-0.5',
                  'inline-flex items-center space-x-2 text-sm',
                )}
              >
                <span>Retourner à l&apos;application</span>
              </Link>
            ) : (
              <Link
                href="/portal"
                prefetch={true}
                className={cn(
                  'bg-[#f5b335] text-[#0b2f73] px-5 py-2 rounded-md min-h-[40px]',
                  'font-semibold hover:bg-[#f7c359] transition-all duration-200',
                  'shadow-sm hover:shadow-md transform hover:-translate-y-0.5',
                  'inline-flex items-center space-x-2 text-sm',
                )}
              >
                <span>Accéder à un portail</span>
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'p-2.5 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center',
            'text-white',
            'hover:bg-white/10 transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-[#0b2f73]',
            'md:hidden',
          )}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label="Toggle menu"
        >
          <MenuToggleIcon open={open} className="size-5" duration={300} />
        </button>
      </nav>

      {/* Mobile Menu — Portal */}
      <MobileMenu open={open}>
        <div className="grid gap-y-1">
          {mobileLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                'px-4 py-3 rounded-lg text-base font-medium transition-all duration-200',
                link.isInstitutional
                  ? 'text-amber-300 font-semibold border border-amber-300/40 bg-white/10 hover:bg-white/20'
                  : 'text-blue-100 hover:text-white hover:bg-white/10',
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-white/20">
          {isAuthenticated ? (
            <Link
              href="/app"
              onClick={() => setOpen(false)}
              className={cn(
                'bg-[#f5b335] text-[#0b2f73] w-full py-3 rounded-md min-h-[44px]',
                'font-semibold hover:bg-[#f7c359] transition-all duration-200',
                'shadow-sm hover:shadow-md',
                'inline-flex items-center justify-center space-x-2',
              )}
            >
              <span>Retourner à l&apos;application</span>
            </Link>
          ) : (
            <Link
              href="/portal"
              onClick={() => setOpen(false)}
              className={cn(
                'bg-[#f5b335] text-[#0b2f73] w-full py-3 rounded-md min-h-[44px]',
                'font-semibold hover:bg-[#f7c359] transition-all duration-200',
                'shadow-sm hover:shadow-md',
                'inline-flex items-center justify-center space-x-2',
              )}
            >
              <span>Accéder à un portail</span>
            </Link>
          )}
        </div>
      </MobileMenu>
    </header>
  );
}

// --- Mobile Menu Portal ---
type MobileMenuProps = React.ComponentProps<'div'> & {
  open: boolean;
};

function MobileMenu({ open, children, className, ...props }: MobileMenuProps) {
  if (!open || typeof window === 'undefined') return null;

  return createPortal(
    <div
      id="mobile-menu"
      className={cn(
        'bg-[#0b2f73]/95 supports-[backdrop-filter]:bg-[#0b2f73]/80 backdrop-blur-lg',
        'fixed top-14 right-0 bottom-0 left-0 z-40 flex flex-col overflow-hidden border-y md:hidden',
      )}
    >
      <div
        data-slot={open ? 'open' : 'closed'}
        className={cn(
          'data-[slot=open]:animate-in data-[slot=open]:zoom-in-97 ease-out',
          'size-full p-4',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
