/**
 * Premium Header Component
 * 
 * Header moderne, professionnel et attrayant pour les pages publiques
 * Design premium institutionnel avec animations subtiles
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

export default function PremiumHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const ariaExpanded = isMenuOpen ? 'true' : 'false';

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path);
  };

  const menuItems: Array<{ path: string; label: string; isInstitutional?: boolean }> = [
    { path: '/', label: 'Accueil' },
    { path: '/modules', label: 'Modules' },
    { path: '/#tarification', label: 'Tarification' },
    { path: '/patronat-examens', label: 'Patronat & Examens', isInstitutional: true },
    { path: '/securite', label: 'Sécurité & Méthode' },
    { path: '/contact', label: 'Contact' },
  ];

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-100'
          : 'bg-white border-b border-gray-200 shadow-sm'
      )}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between h-20 flex-nowrap px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link 
            href="/admin-login"
            prefetch={true}
            className="flex items-center space-x-1 group transition-transform duration-200 hover:scale-105 flex-shrink-0"
          >
            <div className="relative">
                    <Image
                      src="/images/logo-Academia Hub.png"
                      alt={`${BRAND.name} - ${BRAND.subtitle}`}
                      width={52}
                      height={52}
                      className="h-14 w-auto transition-opacity duration-200 group-hover:opacity-90"
                      priority
                      sizes="(max-width: 768px) 40px, 52px"
                    />
            </div>
            <div className={`${textColor('primary')} font-bold leading-none`}>
              <span className="text-xl md:text-2xl block">Academia</span>
              <span className="text-xs md:text-sm block -mt-2">Helm</span>
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
                    ? 'text-blue-800 font-semibold border border-blue-200 hover:border-blue-300 hover:bg-blue-50'
                    : isActive(item.path)
                    ? 'text-blue-900 bg-cloud'
                    : 'text-graphite-700 hover:text-blue-900 hover:bg-cloud'
                )}
              >
                {item.label}
                {isActive(item.path) && !item.isInstitutional && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-900 rounded-full" />
                )}
              </Link>
            ))}
            <div className="ml-8 pl-8 border-l border-gray-200 flex-shrink-0 flex items-center space-x-3">
              <Link
                href="/portal"
                prefetch={true}
                className={cn(
                  'bg-blue-600 text-white px-6 py-2.5 rounded-md',
                  'font-semibold hover:bg-blue-700 transition-all duration-200',
                  'shadow-sm hover:shadow-md transform hover:-translate-y-0.5',
                  'inline-flex items-center space-x-2'
                )}
              >
                <span>Accéder à un portail</span>
                <AppIcon name="login" size="submenu" className="text-white" />
              </Link>
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                'p-2.5 rounded-lg',
                textColor('primary'),
                'hover:bg-gray-100 transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2'
              )}
              aria-label="Toggle menu"
              aria-expanded={ariaExpanded}
            >
              {isMenuOpen ? (
                <AppIcon name="close" size="menu" className="text-blue-900" />
              ) : (
                <AppIcon name="menu" size="menu" className="text-blue-900" />
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
        <div className={cn(bgColor('card'), 'border-t border-gray-200 shadow-lg')}>
          <nav className="flex flex-col px-4 py-4 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  'px-4 py-3 rounded-lg text-base font-medium transition-all duration-200',
                  item.isInstitutional
                    ? 'text-blue-800 font-semibold border border-blue-200 bg-blue-50 hover:bg-blue-100'
                    : isActive(item.path)
                    ? 'text-blue-900 bg-cloud font-semibold'
                    : 'text-graphite-700 hover:text-blue-900 hover:bg-cloud'
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 mt-4 border-t border-gray-200 space-y-2">
              <Link
                href="/portal"
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  'bg-blue-600 text-white w-full py-3 rounded-md',
                  'font-semibold hover:bg-blue-700 transition-all duration-200',
                  'shadow-sm hover:shadow-md',
                  'inline-flex items-center justify-center space-x-2'
                )}
              >
                <span>Accéder à un portail</span>
                <AppIcon name="login" size="submenu" className="text-white" />
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
