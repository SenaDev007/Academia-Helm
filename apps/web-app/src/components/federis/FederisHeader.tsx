/**
 * FederisHeader - Header Premium Institutionnel
 *
 * Header marketing pour Academia Federis (landing, login, register, checkout).
 * Navigation conforme à la proposition de copywriting :
 *   Fonctionnalités · Organisation des examens · Sécurité et traçabilité · Offres
 *   CTA secondaire : Se connecter — CTA principal : Créer un espace patronat
 *
 * Design : sobre, institutionnel, orienté conversion B2B.
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { useFederisPath } from '@/lib/federis/useFederisPath';

export default function FederisHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { path: federisPath } = useFederisPath();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Ancres de la page d'accueil (cahier des charges — navigation recommandée)
  const menuItems = [
    { path: federisPath('/') + '#fonctionnalites', label: 'Fonctionnalités' },
    { path: federisPath('/') + '#processus', label: 'Organisation des examens' },
    { path: federisPath('/') + '#securite', label: 'Sécurité et traçabilité' },
    { path: federisPath('/') + '#offres', label: 'Offres' },
  ];

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
          {/* Zone Gauche - Identité : Academia Federis, par Academia Helm */}
          <Link
            href={federisPath('/')}
            prefetch={true}
            className="flex items-center space-x-3 group transition-opacity duration-200 hover:opacity-90 flex-shrink-0"
          >
            <div className="relative">
              <Image
                src="/images/logo-Academia Hub.webp"
                alt="Academia Federis — par Academia Helm"
                width={48}
                height={48}
                className="h-12 w-auto transition-opacity duration-200"
                priority
                sizes="(max-width: 768px) 40px, 48px"
              />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-gray-900 leading-tight">
                Academia Federis
              </div>
              <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                Par Academia Helm
              </div>
            </div>
          </Link>

          {/* Zone Centrale - Navigation Desktop */}
          <nav className="hidden lg:flex items-center space-x-1 flex-nowrap flex-shrink-0">
            {menuItems.map((item) => (
              <Link
                key={item.label}
                href={item.path}
                prefetch={true}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:text-blue-900 hover:bg-gray-50 transition-all duration-200"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Zone Droite - Actions CTA */}
          <div className="hidden lg:flex items-center space-x-3 flex-shrink-0">
            <Link
              href="/contact?subject=demo-federis"
              prefetch={true}
              className="px-4 py-2.5 rounded-md text-sm font-semibold text-gray-700 hover:text-blue-900 transition-all duration-200"
            >
              Demander une démonstration
            </Link>
            <Link
              href={federisPath('/login')}
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
              href={federisPath('/register')}
              prefetch={true}
              className={cn(
                'px-6 py-2.5 rounded-md text-sm font-semibold',
                'bg-blue-800 text-white',
                'hover:bg-blue-900',
                'transition-all duration-200',
                'shadow-md hover:shadow-lg',
                'inline-flex items-center gap-2'
              )}
            >
              Créer un espace patronat
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
              aria-label="Ouvrir le menu"
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
          isMenuOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="bg-white border-t border-gray-200 shadow-lg">
          <nav className="flex flex-col px-4 py-4 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.label}
                href={item.path}
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:text-blue-900 hover:bg-gray-50 transition-all duration-200"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/contact?subject=demo-federis"
              onClick={() => setIsMenuOpen(false)}
              className="px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:text-blue-900 hover:bg-gray-50 transition-all duration-200"
            >
              Demander une démonstration
            </Link>
            <div className="pt-4 mt-4 border-t border-gray-200 space-y-2">
              <Link
                href={federisPath('/login')}
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
                href={federisPath('/register')}
                onClick={() => setIsMenuOpen(false)}
                className={cn(
                  'w-full py-3 rounded-md text-base font-semibold',
                  'bg-blue-800 text-white',
                  'hover:bg-blue-900 transition-all duration-200',
                  'inline-flex items-center justify-center gap-2'
                )}
              >
                Créer un espace patronat
                <AppIcon name="arrowRight" size="submenu" className="text-white" />
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
