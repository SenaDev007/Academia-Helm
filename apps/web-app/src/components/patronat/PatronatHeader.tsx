/**
 * PatronatHeader - Header Premium Institutionnel
 * 
 * Header marketing pour le module Patronat & Examens Nationaux
 * Utilisé uniquement sur les pages marketing : /patronat, /patronat/*
 * (pas sur l'application connectée)
 * 
 * Design : sobre, institutionnel, orienté conversion B2B
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

export default function PatronatHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const menuItems = [
    { path: '/patronat-examens#fonctionnalites', label: 'Fonctionnalités' },
    { path: '/patronat-examens#processus', label: 'Processus Examens' },
    { path: '/patronat-examens#banque-epreuves', label: 'Banque d\'épreuves' },
    { path: '/patronat-examens#securite', label: 'Sécurité & Conformité' },
    { path: '/patronat-examens#tarification', label: 'Tarification Patronat' },
  ];

  const isActive = (path: string) => {
    if (path.includes('#')) {
      const [basePath] = path.split('#');
      return pathname === basePath;
    }
    return pathname === path || pathname.startsWith(path);
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'bg-white/98 backdrop-blur-sm shadow-md border-b border-gray-200'
          : 'bg-white border-b border-gray-100 shadow-sm'
      )}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between h-20 flex-nowrap px-4 sm:px-6 lg:px-8">
          {/* Zone Gauche - Identité */}
          <Link
            href="/admin-login"
            prefetch={true}
            className="flex items-center space-x-3 group transition-opacity duration-200 hover:opacity-90 flex-shrink-0"
          >
            <div className="relative">
              <Image
                src="/images/logo-Academia Helm.png"
                alt="Academia Helm - Connexion Super Admin"
                width={48}
                height={48}
                className="h-12 w-auto transition-opacity duration-200"
                priority
                sizes="(max-width: 768px) 40px, 48px"
              />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-gray-900 leading-tight">
                Patronat & Examens Nationaux
              </div>
            </div>
          </Link>

          {/* Zone Centrale - Navigation Desktop */}
          <nav className="hidden lg:flex items-center space-x-1 flex-nowrap flex-shrink-0">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                prefetch={true}
                className={cn(
                  'relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive(item.path)
                    ? 'text-blue-900 bg-blue-50'
                    : 'text-gray-700 hover:text-blue-900 hover:bg-gray-50'
                )}
              >
                {item.label}
                {isActive(item.path) && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-900 rounded-full" />
                )}
              </Link>
            ))}
          </nav>

          {/* Zone Droite - Actions CTA */}
          <div className="hidden lg:flex items-center space-x-3 flex-shrink-0">
            <Link
              href="/patronat/login"
              prefetch={true}
              className={cn(
                'px-5 py-2.5 rounded-md text-sm font-semibold',
                'text-gray-700 hover:text-gray-900',
                'border border-gray-300 hover:border-gray-400',
                'transition-all duration-200',
                'shadow-sm hover:shadow'
              )}
            >
              Se connecter
            </Link>
            <Link
              href="/patronat/register"
              prefetch={true}
              className={cn(
                'px-6 py-2.5 rounded-md text-sm font-semibold',
                'bg-blue-700 text-white',
                'hover:bg-blue-800',
                'transition-all duration-200',
                'shadow-md hover:shadow-lg',
                'inline-flex items-center gap-2'
              )}
            >
              Créer un compte Patronat
              <AppIcon name="arrowRight" size="submenu" className="text-white" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                'p-2.5 rounded-lg',
                'text-gray-700',
                'hover:bg-gray-100 transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2'
              )}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen ? 'true' : 'false'}
            >
              {isMenuOpen ? (
                <AppIcon name="close" size="menu" className="text-gray-900" />
              ) : (
                <AppIcon name="menu" size="menu" className="text-gray-900" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          'lg:hidden overflow-hidden transition-all duration-300 ease-in-out',
          isMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="bg-white border-t border-gray-200 shadow-lg">
          <nav className="flex flex-col px-4 py-4 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  'px-4 py-3 rounded-lg text-base font-medium transition-all duration-200',
                  isActive(item.path)
                    ? 'text-blue-900 bg-blue-50 font-semibold'
                    : 'text-gray-700 hover:text-blue-900 hover:bg-gray-50'
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-4 mt-4 border-t border-gray-200 space-y-2">
              <Link
                href="/patronat/login"
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  'w-full py-3 rounded-md text-base font-semibold',
                  'text-gray-700 border border-gray-300',
                  'hover:bg-gray-50 transition-all duration-200',
                  'inline-flex items-center justify-center'
                )}
              >
                Se connecter
              </Link>
              <Link
                href="/patronat/register"
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  'w-full py-3 rounded-md text-base font-semibold',
                  'bg-blue-700 text-white',
                  'hover:bg-blue-800 transition-all duration-200',
                  'inline-flex items-center justify-center gap-2'
                )}
              >
                Créer un compte Patronat
                <AppIcon name="arrowRight" size="submenu" className="text-white" />
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}

