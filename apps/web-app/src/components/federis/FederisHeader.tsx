/**
 * FederisHeader - Header Institutionnel (style Academia Helm)
 *
 * Header pour Academia Federis (landing, login, register, checkout).
 * Aligné sur le design Academia Helm : navbar blanche OPAQUE avec bordure
 * inférieure, liens simples, CTA sobres (plus d'effet de transparence au
 * scroll ni de pulsation/shimmer).
 *
 * Navigation :
 *   Fonctionnalités · Organisation des examens · Offres
 *   CTA secondaire : Se connecter — CTA principal : Créer un espace patronat
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import AppIcon from '@/components/ui/AppIcon';
import { useFederisPath } from '@/lib/federis/useFederisPath';

export default function FederisHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { path: federisPath } = useFederisPath();

  // Ancres de la page d'accueil (cahier des charges — navigation recommandée)
  const menuItems = [
    { path: federisPath('/') + '#fonctionnalites', label: 'Fonctionnalités' },
    { path: federisPath('/') + '#processus', label: 'Organisation des examens' },
    { path: federisPath('/') + '#offres', label: 'Offres' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      {/* Ligne dorée institutionnelle (pattern Helm) */}
      <div className="h-[2px] bg-gradient-to-r from-blue-900 via-gold-500 to-blue-900" />

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between h-16 flex-nowrap px-4 sm:px-6 lg:px-8">
          {/* Zone Gauche — Identité (pattern Helm) */}
          <Link
            href={federisPath('/')}
            prefetch={true}
            className="flex items-center space-x-2.5 group transition-opacity duration-200 hover:opacity-90 flex-shrink-0"
          >
            <div className="relative">
              <Image
                src="/images/logo-Academia Hub.webp"
                alt="Academia Federis — par Academia Helm"
                width={38}
                height={38}
                className="h-9 w-9 object-contain rounded-xl ring-1 ring-gray-100"
                priority
                sizes="(max-width: 768px) 36px, 38px"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
            </div>
            <div className="hidden sm:block">
              <div className="text-[13px] font-bold text-blue-900 leading-tight">
                Academia Federis
              </div>
              <div className="text-[11px] text-gray-400 font-medium leading-tight">
                Par Academia Helm
              </div>
            </div>
          </Link>

          {/* Zone Centrale — Navigation Desktop (pattern Helm) */}
          <nav className="hidden lg:flex items-center space-x-1 flex-nowrap flex-shrink-0">
            {menuItems.map((item) => (
              <Link
                key={item.label}
                href={item.path}
                prefetch={true}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Zone Droite — Actions CTA (pattern Helm) */}
          <div className="hidden lg:flex items-center space-x-3 flex-shrink-0">
            <Link
              href={federisPath('/login')}
              prefetch={true}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              Se connecter
            </Link>
            <Link
              href={federisPath('/register')}
              prefetch={true}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-800 text-white hover:bg-blue-900 transition-colors inline-flex items-center gap-1.5"
            >
              Créer un espace patronat
              <ArrowRight className="w-4 h-4 shrink-0" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2.5 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              aria-label="Ouvrir le menu"
              aria-expanded={isMenuOpen ? 'true' : 'false'}
            >
              {isMenuOpen ? (
                <AppIcon name="close" size="menu" />
              ) : (
                <AppIcon name="menu" size="menu" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu — tiroir simple */}
      {isMenuOpen && (
        <div className="lg:hidden overflow-hidden">
          <div className="bg-white border-t border-gray-200">
            <nav className="flex flex-col px-4 py-4 space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              <div className="pt-4 mt-4 border-t border-gray-100 space-y-3">
                <Link
                  href={federisPath('/login')}
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors inline-flex items-center justify-center"
                >
                  Se connecter
                </Link>
                <Link
                  href={federisPath('/register')}
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold bg-blue-800 text-white hover:bg-blue-900 transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  Créer un espace patronat
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
