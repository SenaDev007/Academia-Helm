'use client';
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { useScroll } from '@/components/ui/use-scroll';
import LogoCircle from '@/components/ui/LogoCircle';
import { DoorOpen, ArrowRight } from 'lucide-react';

// ── Keyframe injectée pour la pulsation dorée du bouton portail ──
if (typeof document !== 'undefined' && !document.getElementById('portal-pulse-style')) {
  const style = document.createElement('style');
  style.id = 'portal-pulse-style';
  style.textContent = `
    @keyframes portalPulse {
      0%, 100% {
        box-shadow: 0 0 0 0 rgba(245, 179, 53, 0.5);
      }
      50% {
        box-shadow: 0 0 12px 4px rgba(245, 179, 53, 0.35);
      }
    }
    @keyframes portalIconGlow {
      0%, 100% {
        filter: drop-shadow(0 0 2px rgba(245, 179, 53, 0.3));
      }
      50% {
        filter: drop-shadow(0 0 8px rgba(245, 179, 53, 0.7));
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Header Premium Academia Helm avec effet Limelight sur les libellés texte
 * 
 * Navigation desktop : libellés texte avec projecteur doré au survol/actif
 * CTA doré : "Accéder à un portail" / "Retourner à l'application"
 * Menu mobile : portal overlay avec animation
 */

// --- Vérification si l'utilisateur vient de l'application ---
// On détecte le paramètre ?from_app=true dans l'URL (ajouté par le bouton
// "Visiter le site" dans l'app) et on le persiste en sessionStorage.
// On sauvegarde aussi l'URL d'origine de l'application pour pouvoir
// y retourner via le bouton "Retourner à l'application".
// Ainsi, l'icône DoorOpen est affichée par défaut, et ArrowRight ne s'affiche
// QUE lorsque l'utilisateur navigue depuis l'application vers le site public.
function useCameFromApp(): { cameFromApp: boolean; appReturnUrl: string } {
  const [cameFromApp, setCameFromApp] = useState(false);
  const [appReturnUrl, setAppReturnUrl] = useState('/app');
  useEffect(() => {
    try {
      // 1. Vérifier le paramètre URL ?from_app=true
      const params = new URLSearchParams(window.location.search);
      if (params.get('from_app') === 'true') {
        sessionStorage.setItem('academia_from_app', 'true');
        // Sauvegarder l'URL de retour si fournie
        const returnUrl = params.get('return_url');
        if (returnUrl) {
          sessionStorage.setItem('academia_app_return_url', returnUrl);
          setAppReturnUrl(returnUrl);
        } else {
          // Construire l'URL de retour à partir du referer ou du sous-domaine actuel
          const savedUrl = sessionStorage.getItem('academia_app_return_url') || '/app';
          setAppReturnUrl(savedUrl);
        }
        // Nettoyer l'URL sans recharger la page
        params.delete('from_app');
        params.delete('return_url');
        const cleanUrl = params.toString()
          ? `${window.location.pathname}?${params.toString()}`
          : window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
      // 2. Vérifier le flag en sessionStorage
      const isFromApp = sessionStorage.getItem('academia_from_app') === 'true';
      setCameFromApp(isFromApp);
      if (isFromApp) {
        const savedUrl = sessionStorage.getItem('academia_app_return_url') || '/app';
        setAppReturnUrl(savedUrl);
      }
    } catch {
      // sessionStorage indisponible (SSR, etc.)
    }
  }, []);
  return { cameFromApp, appReturnUrl };
}

// --- Items de navigation avec libellés texte ---
const navItems = [
  { label: 'Accueil', href: '/', isInstitutional: false },
  { label: 'Modules', href: '/modules', isInstitutional: false },
  { label: 'Blog', href: '/blog', isInstitutional: false },
  { label: 'Tarification', href: '/tarification', isInstitutional: false },
  { label: 'Recrutement', href: '/jobs', isInstitutional: false },
  { label: 'Academia Federis', href: '/federis', isInstitutional: true },
  { label: 'Contact', href: '/contact', isInstitutional: false },
];

// --- Composant Limelight pour libellés texte ---
function LimelightTextNav({ items }: { items: typeof navItems }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const limelightRef = useRef<HTMLDivElement | null>(null);

  // Déterminer l'index actif selon la route
  useEffect(() => {
    const path = window.location.pathname;
    const idx = items.findIndex((item) => {
      if (item.href.includes('#')) return false;
      if (item.href === '/') return path === '/';
      return path.startsWith(item.href);
    });
    if (idx >= 0) setActiveIndex(idx);
  }, [items]);

  // Positionner le limelight sur l'item actif ou survolé
  useLayoutEffect(() => {
    const targetIndex = hoveredIndex !== null ? hoveredIndex : activeIndex;
    const limelight = limelightRef.current;
    const targetItem = itemRefs.current[targetIndex];

    if (limelight && targetItem) {
      const newLeft = targetItem.offsetLeft + targetItem.offsetWidth / 2 - limelight.offsetWidth / 2;
      limelight.style.left = `${newLeft}px`;

      if (!isReady) {
        setTimeout(() => setIsReady(true), 50);
      }
    }
  }, [activeIndex, hoveredIndex, isReady, items]);

  return (
    <nav className="relative inline-flex items-center h-14">
      {items.map((item, index) => (
        <Link
          key={item.label}
          ref={(el) => { itemRefs.current[index] = el; }}
          href={item.href}
          prefetch={true}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={() => setActiveIndex(index)}
          className={cn(
            'relative z-20 flex h-full items-center justify-center px-3 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap',
            item.isInstitutional
              ? 'text-amber-300 font-semibold border border-amber-300/40 hover:border-amber-300/70 hover:bg-white/10 rounded-md mx-1'
              : (activeIndex === index || hoveredIndex === index)
                ? 'text-white'
                : 'text-blue-200/70 hover:text-white hover:bg-white/5',
          )}
        >
          {item.label}
        </Link>
      ))}

      {/* Limelight — trait lumineux doré + cône de lumière */}
      <div
        ref={limelightRef}
        className={cn(
          'absolute top-0 z-10 w-11 h-[5px] rounded-full',
          'bg-[#f5b335]',
          'shadow-[0_50px_15px_rgba(245,179,53,0.35)]',
          isReady ? 'transition-[left] duration-400 ease-in-out' : '',
        )}
        style={{ left: '-999px' }}
      >
        {/* Cône de lumière descendant */}
        <div
          className="absolute left-[-30%] top-[5px] w-[160%] h-14 pointer-events-none"
          style={{
            clipPath: 'polygon(5% 100%, 25% 0, 75% 0, 95% 100%)',
            background: 'linear-gradient(to bottom, rgba(245, 179, 53, 0.2), transparent)',
          }}
        />
      </div>
    </nav>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const scrolled = useScroll(10);
  const { cameFromApp, appReturnUrl } = useCameFromApp();

  // Bloquer le scroll quand le menu mobile est ouvert
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

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
          className="flex items-center space-x-2 group transition-transform duration-200 hover:scale-105 flex-shrink-0"
        >
          <LogoCircle size={38} animated={false} />
          <span className="font-bold text-base sm:text-lg md:text-xl text-white whitespace-nowrap">
            Academia<span className="text-amber-300 ml-1">Helm</span>
          </span>
        </Link>

        {/* Desktop Navigation — Libellés texte avec Limelight + CTA */}
        <div className="hidden lg:flex items-center gap-4">
          <LimelightTextNav items={navItems} />

          {/* Icône portail / Retour app */}
          <div className="ml-4 pl-4 border-l border-white/20 flex-shrink-0">
            {cameFromApp ? (
              <Link
                href={appReturnUrl}
                prefetch={true}
                aria-label="Retourner à l'application"
                className={cn(
                  'bg-[#f5b335] text-[#0b2f73] p-2.5 rounded-md min-h-[40px] min-w-[40px]',
                  'hover:bg-[#f7c359] transition-all duration-200',
                  'shadow-sm hover:shadow-md transform hover:-translate-y-0.5',
                  'inline-flex items-center justify-center',
                )}
              >
                <ArrowRight className="w-5 h-5" />
              </Link>
            ) : (
              <Link
                href="/portal"
                prefetch={true}
                aria-label="Accéder au portail"
                className={cn(
                  'text-amber-300 hover:text-amber-200',
                  'transition-all duration-200',
                  'hover:scale-110',
                  'inline-flex items-center justify-center',
                  'rounded-full p-2',
                )}
                style={{ animation: 'portalPulse 2s ease-in-out infinite' }}
              >
                <DoorOpen className="w-7 h-7" style={{ animation: 'portalIconGlow 2s ease-in-out infinite' }} />
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
            'lg:hidden',
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
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                'px-4 py-3 rounded-lg text-base font-medium transition-all duration-200',
                item.isInstitutional
                  ? 'text-amber-300 font-semibold border border-amber-300/40 bg-white/10 hover:bg-white/20'
                  : 'text-blue-100 hover:text-white hover:bg-white/10',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center justify-center pt-4 mt-4 border-t border-white/20">
          {cameFromApp ? (
            <Link
              href={appReturnUrl}
              onClick={() => setOpen(false)}
              aria-label="Retourner à l'application"
              className={cn(
                'bg-[#f5b335] text-[#0b2f73] p-2.5 rounded-md min-h-[44px] min-w-[44px]',
                'hover:bg-[#f7c359] transition-all duration-200',
                'shadow-sm hover:shadow-md transform hover:-translate-y-0.5',
                'inline-flex items-center justify-center',
              )}
            >
              <ArrowRight className="w-6 h-6" />
            </Link>
          ) : (
            <Link
              href="/portal"
              onClick={() => setOpen(false)}
              aria-label="Accéder au portail"
              className={cn(
                'text-amber-300 hover:text-amber-200',
                'transition-all duration-200',
                'hover:scale-110',
                'inline-flex items-center justify-center',
                'rounded-full p-2.5',
              )}
              style={{ animation: 'portalPulse 2s ease-in-out infinite' }}
            >
              <DoorOpen className="w-7 h-7" style={{ animation: 'portalIconGlow 2s ease-in-out infinite' }} />
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
        'fixed top-14 right-0 bottom-0 left-0 z-40 flex flex-col overflow-hidden border-y lg:hidden',
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
