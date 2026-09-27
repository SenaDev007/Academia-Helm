/**
 * FederisHeader - Header Premium Institutionnel (refonte WinAgro-inspired)
 *
 * Header marketing pour Academia Federis (landing, login, register, checkout).
 * ADN WinAgro transposé sur la palette Federis (navy + or, police Inter) :
 *   - Navbar fixe « scroll-aware » : transparente → verre dépoli + ombre
 *   - Logo cerclé d'un anneau conique rotatif or/bleu (fed-logo-beam)
 *   - Liens de navigation en pilules avec soulignement or animé au survol
 *   - CTA principal or avec pulsation infinie + balayage lumineux (shimmer)
 *
 * Navigation :
 *   Fonctionnalités · Organisation des examens · Offres
 *   CTA secondaire : Se connecter — CTA principal : Créer un espace patronat
 */

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
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
    { path: federisPath('/') + '#offres', label: 'Offres' },
  ];

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        isScrolled
          ? 'fed-glass shadow-lg border-b border-blue-200/70 py-1'
          : 'bg-white/95 backdrop-blur-sm border-b border-transparent py-2',
      )}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between h-20 flex-nowrap px-4 sm:px-6 lg:px-8">
          {/* Zone Gauche — Identité avec anneau lumineux rotatif (ADN WinAgro) */}
          <Link
            href={federisPath('/')}
            prefetch={true}
            className="flex items-center space-x-3 group transition-opacity duration-200 hover:opacity-90 flex-shrink-0"
          >
            <div className="fed-logo-beam w-14 h-14 flex items-center justify-center p-1 shadow-md">
              <Image
                src="/images/logo-Academia Hub.webp"
                alt="Academia Federis — par Academia Helm"
                width={44}
                height={44}
                className="h-11 w-11 object-contain rounded-full transition-transform duration-500 group-hover:scale-105"
                priority
                sizes="(max-width: 768px) 40px, 44px"
              />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-black text-[#0b1d3a] leading-tight tracking-wide">
                Academia Federis
              </div>
              <div className="text-[10px] font-bold text-[#1e3a8a] uppercase tracking-widest">
                Par Academia Helm
              </div>
            </div>
          </Link>

          {/* Zone Centrale — Navigation Desktop en pilules (ADN WinAgro) */}
          <nav className="hidden lg:flex items-center space-x-1 flex-nowrap flex-shrink-0">
            {menuItems.map((item) => (
              <Link
                key={item.label}
                href={item.path}
                prefetch={true}
                className="relative px-4 py-2 rounded-full text-sm font-bold text-slate-600 hover:text-[#0b1d3a] hover:bg-[#eff6ff] transition-all duration-200 group"
              >
                {item.label}
                {/* Liseré or animé au survol (ADN WinAgro) */}
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-[3px] w-0 group-hover:w-6 rounded-full bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] transition-all duration-300" />
              </Link>
            ))}
          </nav>

          {/* Zone Droite — Actions CTA avec pulsation + shimmer (ADN WinAgro) */}
          <div className="hidden lg:flex items-center space-x-3 flex-shrink-0">
            <Link
              href={federisPath('/login')}
              prefetch={true}
              className={cn(
                'px-5 py-2.5 rounded-full text-sm font-bold',
                'text-[#0b1d3a] hover:text-[#1e3a8a]',
                'border border-blue-200 hover:border-[#1e3a8a]/40 hover:bg-[#eff6ff]',
                'transition-all duration-200',
              )}
            >
              Se connecter
            </Link>
            <motion.div
              whileHover={{ scale: 1.05, boxShadow: '0px 10px 25px rgba(245, 158, 11, 0.4)' }}
              whileTap={{ scale: 0.97 }}
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ scale: { repeat: Infinity, duration: 2.5, ease: 'easeInOut' } }}
            >
              <Link
                href={federisPath('/register')}
                prefetch={true}
                className="fed-btn-gold fed-btn-shimmer px-6 py-2.5 text-sm"
              >
                Créer un espace patronat
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Link>
            </motion.div>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                'p-2.5 rounded-full',
                'text-[#0b1d3a]',
                'hover:bg-[#eff6ff] transition-colors duration-200',
                'focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] focus:ring-offset-2',
              )}
              aria-label="Ouvrir le menu"
              aria-expanded={isMenuOpen ? 'true' : 'false'}
            >
              {isMenuOpen ? (
                <AppIcon name="close" size="menu" className="text-[#0b1d3a]" />
              ) : (
                <AppIcon name="menu" size="menu" className="text-[#0b1d3a]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu — tiroir animé (ADN WinAgro) */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="lg:hidden overflow-hidden"
          >
            <div className="bg-white border-t border-blue-100 shadow-2xl">
              <nav className="flex flex-col px-4 py-4 space-y-1">
                {menuItems.map((item, idx) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.06, duration: 0.25 }}
                  >
                    <Link
                      href={item.path}
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-4 py-3 rounded-xl text-base font-bold text-[#0b1d3a] hover:bg-[#eff6ff] hover:text-[#1e3a8a] transition-all duration-200"
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
                <div className="pt-4 mt-4 border-t border-blue-100 space-y-3">
                  <Link
                    href={federisPath('/login')}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      'w-full py-3 rounded-full text-base font-bold',
                      'text-[#0b1d3a] border border-blue-200',
                      'hover:bg-[#eff6ff] transition-all duration-200',
                      'inline-flex items-center justify-center',
                    )}
                  >
                    Se connecter
                  </Link>
                  <motion.div whileTap={{ scale: 0.97 }}>
                    <Link
                      href={federisPath('/register')}
                      onClick={() => setIsMenuOpen(false)}
                      className="fed-btn-gold fed-btn-shimmer w-full py-3 text-base"
                    >
                      Créer un espace patronat
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </motion.div>
                </div>
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
