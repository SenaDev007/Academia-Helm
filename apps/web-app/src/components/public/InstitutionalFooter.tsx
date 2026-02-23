/**
 * Institutional Footer Component
 * 
 * Footer moderne, professionnel et captivant pour Academia Helm
 * Design premium institutionnel avec médias sociaux et informations éditeur
 */

import Link from 'next/link';
import Image from 'next/image';
import AppIcon from '@/components/ui/AppIcon';
import { bgColor, textColor, typo, radius } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

export default function InstitutionalFooter() {
  const currentYear = new Date().getFullYear();

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
    <footer className={cn(bgColor('sidebar'), textColor('inverse'), 'border-t border-blue-800')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Brand & Description */}
            <div className="lg:col-span-1">
              <div className="flex items-center space-x-1 mb-6">
                <Image
                  src="/images/logo-Academia Hub.png"
                  alt="Academia Helm - Plateforme de pilotage éducatif"
                  width={52}
                  height={52}
                  className="h-14 w-auto"
                  loading="lazy"
                  sizes="(max-width: 768px) 40px, 52px"
                />
                <div className={`font-bold leading-none`}>
                  <span className="text-xl md:text-2xl text-white block">Academia</span>
                  <span className="text-xs md:text-sm text-white block -mt-2">Helm</span>
                </div>
              </div>
              <p className={`${typo('body-small')} text-white mb-6 leading-relaxed`}>
                La plateforme de pilotage éducatif nouvelle génération. Prenez le gouvernail de votre institution.
              </p>
              
              {/* Social Media Links */}
              <div className="flex items-center space-x-3">
                <span className={`${typo('caption')} text-white mr-2 whitespace-nowrap`}>Suivez-nous :</span>
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'w-10 h-10 rounded-lg',
                      'flex items-center justify-center',
                      'transition-all duration-200',
                      'hover:scale-110 hover:shadow-lg',
                      'group'
                    )}
                    style={{ backgroundColor: social.brandColor }}
                    aria-label={`Suivez-nous sur ${social.name}`}
                  >
                    <AppIcon 
                      name={social.icon} 
                      size="submenu" 
                      className="text-white transition-colors" 
                    />
                  </a>
                ))}
              </div>
            </div>

            {/* Produit */}
            <div>
              <h3 className={`text-xl md:text-2xl text-white mb-6 font-semibold`}>Produit</h3>
              <ul className="space-y-3">
                {[
                  { label: 'Fonctionnalités', href: '/modules' },
                  { label: 'Tarification', href: '/#tarification' },
                  { label: 'Sécurité', href: '/securite' },
                  { label: 'Mode offline', href: '/#offline' },
                  { label: 'ORION (IA)', href: '/orion' },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      prefetch={true}
                      className={cn(
                        typo('base'),
                        'text-white/70 hover:text-white',
                        'transition-colors duration-200',
                        'flex items-center space-x-2 group'
                      )}
                    >
                      <span className="w-1.5 h-1.5 bg-white/50 rounded-full group-hover:bg-gold-500 transition-colors" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Légal */}
            <div>
              <h3 className={`text-xl md:text-2xl text-white mb-6 font-semibold`}>Légal</h3>
              <ul className="space-y-3">
                {[
                  { label: 'Conditions générales', href: '/legal/cgu' },
                  { label: 'Politique de confidentialité', href: '/legal/privacy' },
                  { label: 'Mentions légales', href: '/legal/mentions' },
                  { label: 'CGV', href: '/legal/cgv' },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      prefetch={true}
                      className={cn(
                        typo('base'),
                        'text-white/70 hover:text-white',
                        'transition-colors duration-200',
                        'flex items-center space-x-2 group'
                      )}
                    >
                      <span className="w-1.5 h-1.5 bg-white/50 rounded-full group-hover:bg-gold-500 transition-colors" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact & Éditeur */}
            <div>
              <h3 className={`text-xl md:text-2xl text-white mb-6 font-semibold`}>Contact</h3>
              <ul className="space-y-4 mb-6">
                <li className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-blue-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AppIcon name="communication" size="submenu" className="text-gold-500" />
                  </div>
                  <div>
                    <p className={`${typo('base')} text-white font-medium mb-1`}>Support</p>
                    <a
                      href="mailto:support@academiahub.com"
                      className={cn(
                        typo('body-small'),
                        'text-white/70 hover:text-gold-500 transition-colors'
                      )}
                    >
                      support@academiahub.com
                    </a>
                  </div>
                </li>
                <li className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-blue-800 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AppIcon name="settings" size="submenu" className="text-gold-500" />
                  </div>
                  <div>
                    <p className={`${typo('base')} text-white font-medium mb-1`}>Zone d'opération</p>
                    <p className={cn(typo('body-small'), 'text-white/70')}>
                      Afrique de l'Ouest
                    </p>
                  </div>
                </li>
              </ul>

              {/* Éditeur */}
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

        {/* Bottom Bar */}
        <div className={cn(
          'py-6 border-t border-navy-800',
          'flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0'
        )}>
          <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
            <p className={cn(typo('caption'), 'text-white text-center md:text-left')}>
              © 2021-{currentYear} Academia Helm — Plateforme de pilotage éducatif.
            </p>
            <div className="flex items-center space-x-4">
              <span className={cn(typo('caption'), 'text-white')}>Conforme</span>
              <div className="flex items-center space-x-2">
                <span className={cn(typo('caption'), 'text-white')}>RGPD</span>
                <span className="w-1 h-1 bg-white/60 rounded-full" />
                <span className={cn(typo('caption'), 'text-white')}>Standards internationaux</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <AppIcon name="success" size="submenu" className="text-green-400" />
            <span className={cn(typo('caption'), 'text-white')}>
              Service certifié et sécurisé
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
