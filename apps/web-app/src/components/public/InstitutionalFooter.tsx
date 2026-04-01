'use client';

/**
 * Institutional Footer Component
 * 
 * Footer moderne, professionnel et captivant pour Academia Helm
 * Design premium institutionnel avec médias sociaux et informations éditeur
 */

import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { bgColor, textColor, typo } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

function SocialIcon({ name }: { name: 'Facebook' | 'LinkedIn' | 'X' | 'YouTube' }) {
  if (name === 'Facebook') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
        <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073c0 6.025 4.388 11.02 10.125 11.927V15.56H7.078v-3.487h3.047V9.414c0-3.007 1.792-4.669 4.533-4.669 1.313 0 2.686.236 2.686.236v2.953h-1.514c-1.491 0-1.956.93-1.956 1.885v2.254h3.328l-.532 3.487h-2.796V24C19.612 23.093 24 18.098 24 12.073z" />
      </svg>
    );
  }
  if (name === 'LinkedIn') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
        <path d="M20.447 20.452H16.89v-5.569c0-1.328-.025-3.037-1.851-3.037-1.854 0-2.136 1.446-2.136 2.939v5.667H9.346V9h3.415v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.603 0 4.268 2.372 4.268 5.455v6.286zM5.337 7.433a2.063 2.063 0 1 1 0-4.126 2.063 2.063 0 0 1 0 4.126zM7.119 20.452H3.553V9H7.12v11.452z" />
      </svg>
    );
  }
  if (name === 'YouTube') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
        <path d="M23.498 6.186a2.997 2.997 0 0 0-2.11-2.12C19.503 3.5 12 3.5 12 3.5s-7.504 0-9.388.565a2.997 2.997 0 0 0-2.11 2.12A31.21 31.21 0 0 0 0 12a31.21 31.21 0 0 0 .502 5.814 2.997 2.997 0 0 0 2.11 2.12C4.496 20.5 12 20.5 12 20.5s7.503 0 9.388-.565a2.997 2.997 0 0 0 2.11-2.12A31.21 31.21 0 0 0 24 12a31.21 31.21 0 0 0-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
      <path d="M18.244 2H21l-6.56 7.496L22.15 22H16.11l-4.73-6.186L5.97 22H3.21l7.014-8.013L1.85 2h6.194l4.274 5.648L18.244 2zm-.967 18.35h1.53L7.206 3.565H5.564L17.277 20.35z" />
    </svg>
  );
}

export default function InstitutionalFooter() {
  const currentYear = new Date().getFullYear();
  const { scrollYProgress } = useScroll();
  const cinematicProgress = useSpring(scrollYProgress, {
    stiffness: 70,
    damping: 24,
    mass: 0.35,
  });
  const glowOpacity = useTransform(cinematicProgress, [0, 1], [0.1, 0.22]);
  const sheenX = useTransform(cinematicProgress, [0, 1], ['-12%', '12%']);
  const footerY = useTransform(cinematicProgress, [0, 1], [0, -2]);

  const socialContainer = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.09,
        delayChildren: 0.12,
      },
    },
  };
  const socialItem = {
    hidden: { opacity: 0, y: 16, scale: 0.9, filter: 'blur(5px)' },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: { duration: 0.36, ease: 'easeOut' },
    },
  };

  const socialLinks = [
    {
      name: 'Facebook',
      href: 'https://facebook.com/academiahub',
      icon: 'facebook' as const,
      brandColor: '#1877F2', // Couleur officielle Facebook
    },
    {
      name: 'LinkedIn',
      href: 'https://linkedin.com/company/academiahub',
      icon: 'linkedin' as const,
      brandColor: '#0077B5', // Couleur officielle LinkedIn
    },
    {
      name: 'X',
      href: 'https://twitter.com/academiahub',
      icon: 'twitter' as const,
      brandColor: '#000000', // Couleur officielle X
    },
    {
      name: 'YouTube',
      href: 'https://youtube.com/@academiahub',
      icon: 'youtube' as const,
      brandColor: '#FF0000', // Couleur officielle YouTube
    },
  ];

  return (
    <motion.footer
      style={{ y: footerY }}
      className={cn(bgColor('sidebar'), textColor('inverse'), 'relative overflow-hidden border-t border-blue-800')}
    >
      <motion.div
        style={{ opacity: glowOpacity }}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(245,179,53,0.35),transparent_48%)]"
      />
      <motion.div
        style={{ x: sheenX, opacity: glowOpacity }}
        className="pointer-events-none absolute -inset-x-10 top-0 h-full bg-[linear-gradient(110deg,transparent_0%,rgba(255,255,255,0.04)_35%,transparent_70%)]"
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="py-10 sm:py-12 md:py-16 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4">
              <div className="flex items-center space-x-1 mb-4 sm:mb-5">
                <Image
                  src="/images/logo-Academia Hub.png"
                  alt="Academia Helm - Plateforme de pilotage éducatif"
                  width={40}
                  height={40}
                  className="h-10 md:h-11 w-auto"
                  loading="lazy"
                  sizes="(max-width: 768px) 32px, 40px"
                />
                <div className={`font-bold leading-none`}>
                  <span className="text-base sm:text-lg md:text-xl text-white block">Academia</span>
                  <span className="text-[10px] sm:text-xs md:text-sm text-amber-300 block -mt-1.5">Helm</span>
                </div>
              </div>
              <p className={`${typo('body-small')} text-white/90 mb-4 sm:mb-5 leading-relaxed max-w-md text-[12px] sm:text-sm`}>
                La plateforme de pilotage éducatif nouvelle génération. Prenez le gouvernail de votre institution.
              </p>

              <motion.div
                variants={socialContainer}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.6 }}
                className="flex items-center justify-start gap-2 flex-nowrap overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {socialLinks.map((social) => (
                  <motion.a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    variants={socialItem}
                    whileHover={{
                      y: -5,
                      scale: 1.12,
                      rotate: -3,
                      boxShadow: '0 14px 30px rgba(0, 0, 0, 0.35)',
                    }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'relative overflow-hidden w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-xl shrink-0',
                      'flex items-center justify-center',
                      'transition-all duration-300',
                      'group text-white'
                    )}
                    style={{ backgroundColor: social.brandColor }}
                    aria-label={`Suivez-nous sur ${social.name}`}
                  >
                    <span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.45),transparent_55%)]" />
                    <SocialIcon name={social.name as 'Facebook' | 'LinkedIn' | 'X' | 'YouTube'} />
                  </motion.a>
                ))}
              </motion.div>
            </div>

            <div className="lg:col-span-3">
              <h3 className={`text-lg sm:text-xl text-white mb-4 sm:mb-5 font-semibold`}>Produit</h3>
              <ul className="space-y-2 sm:space-y-3">
                {[
                  { label: 'Fonctionnalités', href: '/modules' },
                  { label: 'Blog & ressources', href: '/blog' },
                  { label: 'Tarification', href: '/#tarification' },
                  { label: 'Sécurité', href: '/securite' },
                  { label: 'Mode offline', href: '/#offline' },
                  { label: 'ORION (IA)', href: '/orion' },
                ].map((item) => (
                  <li key={item.label}>
                    <motion.div whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                    <Link
                      href={item.href}
                      prefetch={true}
                      className={cn(
                        typo('base'),
                        'text-white/70 hover:text-white',
                        'transition-colors duration-300',
                        'flex items-center space-x-2 group'
                      )}
                    >
                      <span className="w-1.5 h-1.5 bg-white/50 rounded-full group-hover:bg-gold-500 transition-colors" />
                      <span>{item.label}</span>
                    </Link>
                    </motion.div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-2">
              <h3 className={`text-lg sm:text-xl text-white mb-4 sm:mb-5 font-semibold`}>Légal</h3>
              <ul className="space-y-2 sm:space-y-3">
                {[
                  { label: 'Conditions générales', href: '/legal/cgu' },
                  { label: 'Politique de confidentialité', href: '/legal/privacy' },
                  { label: 'Mentions légales', href: '/legal/mentions' },
                  { label: 'CGV', href: '/legal/cgv' },
                ].map((item) => (
                  <li key={item.label}>
                    <motion.div whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                    <Link
                      href={item.href}
                      prefetch={true}
                      className={cn(
                        typo('base'),
                        'text-white/70 hover:text-white',
                        'transition-colors duration-300',
                        'flex items-center space-x-2 group'
                      )}
                    >
                      <span className="w-1.5 h-1.5 bg-white/50 rounded-full group-hover:bg-gold-500 transition-colors" />
                      <span>{item.label}</span>
                    </Link>
                    </motion.div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-3">
              <h3 className={`text-lg sm:text-xl text-white mb-4 sm:mb-5 font-semibold`}>Contact</h3>
              <div className="space-y-1.5 sm:space-y-2 mb-5 sm:mb-6">
                <p className={cn(typo('base'), 'text-white font-medium')}>Support</p>
                <a href="mailto:support@academiahub.com" className={cn(typo('body-small'), 'text-white/70 hover:text-gold-500 transition-colors')}>
                  support@academiahub.com
                </a>
                <p className={cn(typo('body-small'), 'text-white/70')}>Zone d&apos;operation: Afrique de l&apos;Ouest</p>
              </div>

              <div className="pt-6 border-t border-blue-800">
                <p className={cn(typo('caption'), 'text-white mb-2')}>Édité par</p>
                <div className="flex items-center space-x-2">
                  <div className="relative w-8 h-8 flex items-center justify-center">
                    <Image
                      src="/images/YEHI OR logo.PNG"
                      alt="YEHI OR Tech"
                      width={32}
                      height={32}
                      className="h-full w-auto object-contain"
                      loading="lazy"
                      sizes="32px"
                    />
                  </div>
                  <span className={cn(typo('base'), 'text-white font-semibold')}>
                    YEHI OR Tech
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={cn('py-4 sm:py-5 border-t border-navy-800', 'flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4')}>
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6 text-center md:text-left">
            <p className={cn(typo('caption'), 'text-white text-center md:text-left')}>
              © 2021-{currentYear} Academia Helm — Plateforme de pilotage éducatif.
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1">
              <span className={cn(typo('caption'), 'text-white')}>Conforme</span>
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                <span className={cn(typo('caption'), 'text-white')}>RGPD</span>
                <span className="w-1 h-1 bg-white/60 rounded-full" />
                <span className={cn(typo('caption'), 'text-white')}>Standards internationaux</span>
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5">
            <motion.span
              animate={{ scale: [1, 1.18, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-block h-2 w-2 rounded-full bg-emerald-400"
            />
            <span className={cn(typo('caption'), 'text-white')}>Service certifie et securise</span>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}
