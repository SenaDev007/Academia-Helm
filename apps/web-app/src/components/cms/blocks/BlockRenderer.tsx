'use client';

/**
 * ============================================================================
 * BlockRenderer — Rend toutes les variantes de composants CMS
 * ============================================================================
 *
 * Un seul composant qui switch sur `variant.componentKey` et rend la variante
 * correspondante. Toutes les variantes utilisent les CSS vars du thème
 * (via hsl(var(--xxx))) — elles s'adaptent donc automatiquement au thème
 * choisi par l'utilisateur.
 *
 * Si `colorOverrides` est fourni, on injecte les variables CSS override
 * sur le wrapper div, ce qui surcharge localement les valeurs du thème.
 * ============================================================================
 */

import { ReactNode } from 'react';
import {
  GraduationCap, ArrowRight, Menu, Search, Phone, Mail, MapPin,
  Facebook, Twitter, Instagram, Youtube, Play, ChevronLeft, ChevronRight,
  Star, Quote, Check, X,
} from 'lucide-react';
import type { ColorOverride, BlockVariant } from '@/lib/themes/blocks.config';

interface Props {
  variant: BlockVariant;
  colorOverrides?: ColorOverride;
  size?: 'sm' | 'lg';
  schoolName?: string;
}

// Helper pour construire le style override
function buildOverrideStyle(overrides?: ColorOverride): Record<string, string> {
  if (!overrides) return {};
  const style: Record<string, string> = {};
  if (overrides.primary)     style['--primary']     = overrides.primary;
  if (overrides.accent)      style['--accent']      = overrides.accent;
  if (overrides.background)  style['--background']  = overrides.background;
  if (overrides.foreground)  style['--foreground']  = overrides.foreground;
  return style;
}

const WRAPPER_STYLE: React.CSSProperties = {
  background: 'hsl(var(--background))',
  color: 'hsl(var(--foreground))',
  fontFamily: 'var(--font-sans)',
  borderRadius: 'var(--radius)',
};

export function BlockRenderer({ variant, colorOverrides, size = 'sm', schoolName = 'Mon École' }: Props) {
  const isLg = size === 'lg';
  const overrideStyle = buildOverrideStyle(colorOverrides);
  const wrapperStyle = { ...WRAPPER_STYLE, ...overrideStyle } as React.CSSProperties;

  const renderVariant = (): ReactNode => {
    switch (variant.componentKey) {

      // ═══════════════════════════════════════════════════════════════════
      //  NAVBAR
      // ═══════════════════════════════════════════════════════════════════

      case 'NavbarClassic':
        return (
          <header className="flex items-center justify-between px-4 py-3 border-b" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                <GraduationCap className={isLg ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
              </div>
              <span className="font-bold" style={{ fontSize: isLg ? '0.95rem' : '0.75rem' }}>{schoolName}</span>
            </div>
            <div className="flex items-center gap-4">
              {['Accueil', 'À propos', 'Admissions', 'Contact'].map((item) => (
                <span key={item} className="hidden sm:block" style={{ fontSize: isLg ? '0.8rem' : '0.65rem', color: 'hsl(var(--muted-foreground))' }}>{item}</span>
              ))}
              <button className="font-semibold" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', padding: isLg ? '0.4rem 0.9rem' : '0.3rem 0.7rem', borderRadius: 'var(--radius)', fontSize: isLg ? '0.75rem' : '0.65rem' }}>Pré-inscription</button>
            </div>
          </header>
        );

      case 'NavbarCentered':
        return (
          <header className="flex flex-col items-center py-4 border-b gap-3" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                <GraduationCap className={isLg ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
              </div>
              <span className="font-bold" style={{ fontSize: isLg ? '1rem' : '0.8rem' }}>{schoolName}</span>
            </div>
            <div className="flex items-center gap-5">
              {['Accueil', 'À propos', 'Admissions', 'Vie scolaire', 'Contact'].map((item) => (
                <span key={item} style={{ fontSize: isLg ? '0.8rem' : '0.65rem', color: 'hsl(var(--muted-foreground))' }}>{item}</span>
              ))}
            </div>
          </header>
        );

      case 'NavbarTransparent':
        return (
          <header className="flex items-center justify-between px-4 py-3 absolute top-0 left-0 right-0 z-10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}>
                <GraduationCap className={isLg ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
              </div>
              <span className="font-bold text-white" style={{ fontSize: isLg ? '0.95rem' : '0.75rem' }}>{schoolName}</span>
            </div>
            <div className="flex items-center gap-4">
              {['Accueil', 'À propos', 'Contact'].map((item) => (
                <span key={item} className="text-white/90" style={{ fontSize: isLg ? '0.8rem' : '0.65rem' }}>{item}</span>
              ))}
            </div>
          </header>
        );

      case 'NavbarSplit':
        return (
          <header className="grid grid-cols-3 items-center px-4 py-3 border-b" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
            <div className="flex items-center gap-3">
              {['Accueil', 'À propos'].map((item) => (
                <span key={item} style={{ fontSize: isLg ? '0.8rem' : '0.65rem', color: 'hsl(var(--muted-foreground))' }}>{item}</span>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                <GraduationCap className={isLg ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
              </div>
              <span className="font-bold" style={{ fontSize: isLg ? '0.95rem' : '0.75rem' }}>{schoolName}</span>
            </div>
            <div className="flex items-center justify-end">
              <button className="font-semibold" style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))', padding: isLg ? '0.4rem 0.9rem' : '0.3rem 0.7rem', borderRadius: 'var(--radius)', fontSize: isLg ? '0.75rem' : '0.65rem' }}>Inscription</button>
            </div>
          </header>
        );

      case 'NavbarMinimal':
        return (
          <header className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                <GraduationCap className={isLg ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
              </div>
              <span className="font-bold" style={{ fontSize: isLg ? '0.95rem' : '0.75rem' }}>{schoolName}</span>
            </div>
            <button className="p-1.5 rounded" style={{ color: 'hsl(var(--foreground))' }}>
              <Menu className={isLg ? 'w-5 h-5' : 'w-4 h-4'} />
            </button>
          </header>
        );

      // ═══════════════════════════════════════════════════════════════════
      //  HERO
      // ═══════════════════════════════════════════════════════════════════

      case 'HeroCentered':
        return (
          <section className="px-4 py-8 flex flex-col items-center text-center" style={{ background: 'hsl(var(--background))' }}>
            <h1 className="font-bold leading-tight" style={{ fontSize: isLg ? '1.8rem' : '1.1rem', color: 'hsl(var(--foreground))', letterSpacing: 'var(--letter-spacing)' }}>
              Excellence éducative depuis 1995
            </h1>
            <p className="mt-2 max-w-md" style={{ fontSize: isLg ? '0.9rem' : '0.7rem', color: 'hsl(var(--muted-foreground))' }}>
              Une école où chaque enfant grandit, apprend et s'épanouit dans un cadre bienveillant.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <button className="font-semibold flex items-center gap-1.5" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', padding: isLg ? '0.6rem 1.2rem' : '0.4rem 0.8rem', borderRadius: 'var(--radius)', fontSize: isLg ? '0.85rem' : '0.65rem' }}>
                Pré-inscription <ArrowRight className={isLg ? 'w-4 h-4' : 'w-3 h-3'} />
              </button>
              <button className="font-semibold border" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))', padding: isLg ? '0.6rem 1.2rem' : '0.4rem 0.8rem', borderRadius: 'var(--radius)', fontSize: isLg ? '0.85rem' : '0.65rem' }}>
                En savoir plus
              </button>
            </div>
          </section>
        );

      case 'HeroSplit':
        return (
          <section className="grid grid-cols-2 gap-3 px-4 py-6" style={{ background: 'hsl(var(--background))' }}>
            <div className="flex flex-col justify-center">
              <h1 className="font-bold leading-tight" style={{ fontSize: isLg ? '1.5rem' : '0.95rem', color: 'hsl(var(--foreground))' }}>
                Excellence éducative
              </h1>
              <p className="mt-2" style={{ fontSize: isLg ? '0.8rem' : '0.65rem', color: 'hsl(var(--muted-foreground))' }}>
                Une école bienveillante pour vos enfants.
              </p>
              <button className="mt-3 font-semibold self-start" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', padding: isLg ? '0.5rem 1rem' : '0.35rem 0.75rem', borderRadius: 'var(--radius)', fontSize: isLg ? '0.8rem' : '0.65rem' }}>
                S'inscrire
              </button>
            </div>
            <div className="rounded-lg" style={{ background: `linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--accent) / 0.3))`, minHeight: isLg ? '200px' : '120px' }} />
          </section>
        );

      case 'HeroFullscreen':
        return (
          <section className="relative px-4 py-12 flex flex-col items-center justify-center text-center text-white" style={{ background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent) / 0.7))`, minHeight: isLg ? '320px' : '200px' }}>
            <h1 className="font-bold leading-tight" style={{ fontSize: isLg ? '2rem' : '1.3rem' }}>
              Excellence éducative
            </h1>
            <p className="mt-2 max-w-md" style={{ fontSize: isLg ? '0.9rem' : '0.7rem' }}>
              Une école où chaque enfant s'épanouit.
            </p>
            <button className="mt-4 font-semibold" style={{ background: 'white', color: 'hsl(var(--primary))', padding: isLg ? '0.6rem 1.2rem' : '0.4rem 0.8rem', borderRadius: 'var(--radius)', fontSize: isLg ? '0.85rem' : '0.65rem' }}>
              Découvrir
            </button>
          </section>
        );

      case 'HeroGradient':
        return (
          <section className="px-4 py-10 flex flex-col items-center text-center" style={{ background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))`, color: 'hsl(var(--primary-foreground))' }}>
            <h1 className="font-bold" style={{ fontSize: isLg ? '1.8rem' : '1.1rem' }}>
              Excellence éducative
            </h1>
            <p className="mt-2" style={{ fontSize: isLg ? '0.9rem' : '0.7rem', opacity: 0.9 }}>
              Une école bienveillante.
            </p>
          </section>
        );

      case 'HeroVideoBg':
        return (
          <section className="relative px-4 py-12 flex flex-col items-center text-center text-white" style={{ background: 'hsl(var(--sidebar))', minHeight: isLg ? '280px' : '180px' }}>
            <div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(45deg, hsl(var(--primary)), hsl(var(--accent)))` }} />
            <div className="relative">
              <h1 className="font-bold" style={{ fontSize: isLg ? '1.6rem' : '1rem' }}>Excellence éducative</h1>
              <p className="mt-2" style={{ fontSize: isLg ? '0.85rem' : '0.7rem' }}>Découvrez notre école en vidéo</p>
              <button className="mt-3 inline-flex items-center gap-1.5 font-semibold" style={{ background: 'white', color: 'hsl(var(--primary))', padding: isLg ? '0.5rem 1rem' : '0.35rem 0.75rem', borderRadius: '9999px', fontSize: isLg ? '0.8rem' : '0.65rem' }}>
                <Play className={isLg ? 'w-3.5 h-3.5' : 'w-3 h-3'} /> Regarder
              </button>
            </div>
          </section>
        );

      case 'HeroTyping':
        return (
          <section className="px-4 py-10 flex flex-col items-center text-center" style={{ background: 'hsl(var(--background))' }}>
            <h1 className="font-bold" style={{ fontSize: isLg ? '1.7rem' : '1.05rem', color: 'hsl(var(--foreground))' }}>
              Une école <span style={{ color: 'hsl(var(--accent))' }}>excellente</span>
            </h1>
            <p className="mt-2" style={{ fontSize: isLg ? '0.85rem' : '0.7rem', color: 'hsl(var(--muted-foreground))' }}>
              pour vos enfants
            </p>
          </section>
        );

      // ═══════════════════════════════════════════════════════════════════
      //  FOOTER
      // ═══════════════════════════════════════════════════════════════════

      case 'FooterSimple':
        return (
          <footer className="flex items-center justify-between px-4 py-3 border-t" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
            <span style={{ fontSize: isLg ? '0.8rem' : '0.65rem', color: 'hsl(var(--muted-foreground))' }}>© 2026 {schoolName}</span>
            <span style={{ fontSize: isLg ? '0.8rem' : '0.65rem', color: 'hsl(var(--muted-foreground))' }}>Tous droits réservés</span>
          </footer>
        );

      case 'FooterMultiCol':
        return (
          <footer className="grid grid-cols-4 gap-3 px-4 py-4 border-t" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
            {[
              { title: 'À propos', items: ['Notre histoire', 'Mission', 'Équipe'] },
              { title: 'Liens', items: ['Admissions', 'Cours', 'Calendrier'] },
              { title: 'Contact', items: ['Email', 'Téléphone', 'Adresse'] },
              { title: 'Suivez-nous', items: ['Facebook', 'Instagram', 'YouTube'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-bold mb-1" style={{ fontSize: isLg ? '0.75rem' : '0.65rem', color: 'hsl(var(--foreground))' }}>{col.title}</h4>
                {col.items.map((item) => (
                  <div key={item} style={{ fontSize: isLg ? '0.7rem' : '0.6rem', color: 'hsl(var(--muted-foreground))' }}>{item}</div>
                ))}
              </div>
            ))}
          </footer>
        );

      case 'FooterCta':
        return (
          <footer style={{ background: 'hsl(var(--card))' }}>
            <div className="px-4 py-4 text-center" style={{ background: `linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--accent) / 0.1))` }}>
              <h3 className="font-bold" style={{ fontSize: isLg ? '0.95rem' : '0.75rem', color: 'hsl(var(--foreground))' }}>Prêt à nous rejoindre ?</h3>
              <button className="mt-2 font-semibold" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', padding: isLg ? '0.4rem 0.9rem' : '0.3rem 0.7rem', borderRadius: 'var(--radius)', fontSize: isLg ? '0.75rem' : '0.65rem' }}>Pré-inscription</button>
            </div>
            <div className="px-4 py-2 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
              <span style={{ fontSize: isLg ? '0.7rem' : '0.6rem', color: 'hsl(var(--muted-foreground))' }}>© 2026 {schoolName}</span>
            </div>
          </footer>
        );

      case 'FooterNewsletter':
        return (
          <footer className="px-4 py-4 border-t" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
            <div className="flex items-center gap-2 mb-3">
              <input type="email" placeholder="Votre email" className="flex-1 px-2 py-1 rounded border" style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))', fontSize: isLg ? '0.75rem' : '0.65rem' }} />
              <button className="font-semibold" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', padding: isLg ? '0.4rem 0.8rem' : '0.3rem 0.6rem', borderRadius: 'var(--radius)', fontSize: isLg ? '0.75rem' : '0.65rem' }}>S'abonner</button>
            </div>
            <span style={{ fontSize: isLg ? '0.7rem' : '0.6rem', color: 'hsl(var(--muted-foreground))' }}>© 2026 {schoolName} · Tous droits réservés</span>
          </footer>
        );

      case 'FooterDark':
        return (
          <footer className="px-4 py-4" style={{ background: 'hsl(var(--sidebar))', color: 'hsl(var(--sidebar-foreground))' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: 'hsl(var(--accent))' }}>
                  <GraduationCap className={isLg ? 'w-3 h-3' : 'w-2.5 h-2.5'} />
                </div>
                <span className="font-bold" style={{ fontSize: isLg ? '0.8rem' : '0.7rem' }}>{schoolName}</span>
              </div>
              <div className="flex gap-2">
                {[Facebook, Instagram, Youtube].map((Icon, i) => (
                  <Icon key={i} className={isLg ? 'w-3.5 h-3.5' : 'w-3 h-3'} style={{ color: 'hsl(var(--sidebar-foreground))', opacity: 0.7 }} />
                ))}
              </div>
            </div>
            <span style={{ fontSize: isLg ? '0.7rem' : '0.6rem', opacity: 0.6 }}>© 2026 {schoolName}</span>
          </footer>
        );

      // ═══════════════════════════════════════════════════════════════════
      //  BORDER
      // ═══════════════════════════════════════════════════════════════════

      case 'BorderSolid':
        return <div className="px-4 py-6"><div style={{ borderTop: `2px solid hsl(var(--primary))` }} /></div>;

      case 'BorderGradient':
        return <div className="px-4 py-6"><div style={{ height: '2px', background: `linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))` }} /></div>;

      case 'BorderDashed':
        return <div className="px-4 py-6"><div style={{ borderTop: `2px dashed hsl(var(--accent))` }} /></div>;

      case 'BorderDouble':
        return <div className="px-4 py-6"><div style={{ borderTop: `4px double hsl(var(--primary))` }} /></div>;

      case 'BorderGlow':
        return (
          <div className="px-4 py-6">
            <div style={{ borderTop: `1px solid hsl(var(--accent))`, boxShadow: `0 0 8px hsl(var(--accent) / 0.6)` }} />
          </div>
        );

      case 'BorderRounded':
        return (
          <div className="px-4 py-6">
            <div style={{ height: '6px', background: 'hsl(var(--primary))', borderRadius: '9999px' }} />
          </div>
        );

      // ═══════════════════════════════════════════════════════════════════
      //  TESTIMONIAL
      // ═══════════════════════════════════════════════════════════════════

      case 'TestimonialCard':
        return (
          <div className="p-3 rounded-lg border" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
            <Quote className="w-4 h-4 mb-1" style={{ color: 'hsl(var(--accent))' }} />
            <p className="italic" style={{ fontSize: isLg ? '0.8rem' : '0.65rem', color: 'hsl(var(--card-foreground))' }}>« Mon enfant s'épanouit ici. »</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full" style={{ background: 'hsl(var(--primary))' }} />
              <div>
                <div className="font-semibold" style={{ fontSize: isLg ? '0.7rem' : '0.6rem' }}>Marie A.</div>
                <div style={{ fontSize: isLg ? '0.65rem' : '0.55rem', color: 'hsl(var(--muted-foreground))' }}>Parent d'élève</div>
              </div>
            </div>
          </div>
        );

      case 'TestimonialQuote':
        return (
          <div className="px-4 py-6 text-center">
            <Quote className="w-5 h-5 mx-auto mb-2" style={{ color: 'hsl(var(--accent))' }} />
            <p className="italic font-medium" style={{ fontSize: isLg ? '1rem' : '0.8rem', color: 'hsl(var(--foreground))' }}>
              « Une école exceptionnelle où chaque enfant est accompagné. »
            </p>
            <p className="mt-2" style={{ fontSize: isLg ? '0.75rem' : '0.65rem', color: 'hsl(var(--muted-foreground))' }}>— Marie A., Parent</p>
          </div>
        );

      case 'TestimonialGrid':
        return (
          <div className="grid grid-cols-3 gap-2 px-4 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-2 rounded border" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
                <div className="flex gap-0.5 mb-1">
                  {[1,2,3,4,5].map(s => <Star key={s} className="w-2.5 h-2.5" style={{ color: 'hsl(var(--accent))', fill: 'hsl(var(--accent))' }} />)}
                </div>
                <p className="italic" style={{ fontSize: isLg ? '0.65rem' : '0.55rem', color: 'hsl(var(--card-foreground))' }}>« Excellent ! »</p>
                <p className="mt-1 font-semibold" style={{ fontSize: isLg ? '0.6rem' : '0.5rem' }}>Parent {i}</p>
              </div>
            ))}
          </div>
        );

      case 'TestimonialSlider':
        return (
          <div className="px-4 py-4">
            <div className="flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" style={{ color: 'hsl(var(--muted-foreground))' }} />
              <div className="flex-1 p-3 rounded border text-center" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
                <p className="italic" style={{ fontSize: isLg ? '0.8rem' : '0.65rem', color: 'hsl(var(--card-foreground))' }}>« Témoignage 1 sur 3 »</p>
                <p className="mt-1" style={{ fontSize: isLg ? '0.7rem' : '0.55rem', color: 'hsl(var(--muted-foreground))' }}>— Parent</p>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: 'hsl(var(--muted-foreground))' }} />
            </div>
          </div>
        );

      case 'TestimonialVideo':
        return (
          <div className="px-4 py-4">
            <div className="relative rounded-lg overflow-hidden" style={{ background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))`, minHeight: isLg ? '120px' : '80px' }}>
              <Play className="absolute inset-0 m-auto w-8 h-8 text-white" />
            </div>
            <p className="mt-2 font-semibold" style={{ fontSize: isLg ? '0.75rem' : '0.65rem', color: 'hsl(var(--foreground))' }}>Témoignage vidéo de M. Dupont</p>
          </div>
        );

      // ═══════════════════════════════════════════════════════════════════
      //  TEXT
      // ═══════════════════════════════════════════════════════════════════

      case 'TextHeadingXl':
        return (
          <div className="px-4 py-4">
            <h1 className="font-bold" style={{ fontSize: isLg ? '2rem' : '1.3rem', fontFamily: 'var(--font-serif)', color: 'hsl(var(--foreground))', letterSpacing: 'var(--letter-spacing)' }}>
              Excellence éducative
            </h1>
          </div>
        );

      case 'TextHeadingAccent':
        return (
          <div className="px-4 py-4">
            <h2 className="font-bold" style={{ fontSize: isLg ? '1.4rem' : '0.95rem', color: 'hsl(var(--foreground))' }}>
              Une école <span style={{ color: 'hsl(var(--accent))' }}>exceptionnelle</span> pour vos enfants
            </h2>
          </div>
        );

      case 'TextParagraph':
        return (
          <div className="px-4 py-3">
            <p style={{ fontSize: isLg ? '0.85rem' : '0.7rem', color: 'hsl(var(--muted-foreground))', textAlign: 'justify', lineHeight: 1.6 }}>
              Notre établissement accompagne chaque élève avec bienveillance. Nous croyons que chaque enfant a un potentiel unique à révéler.
            </p>
          </div>
        );

      case 'TextLead':
        return (
          <div className="px-4 py-3">
            <p className="font-medium" style={{ fontSize: isLg ? '1rem' : '0.8rem', color: 'hsl(var(--foreground))', lineHeight: 1.5 }}>
              Bienvenue dans notre école — un lieu d'apprentissage, d'épanouissement et de découvertes.
            </p>
          </div>
        );

      case 'TextListStyled':
        return (
          <div className="px-4 py-3 space-y-1.5">
            {['Encadrement personnalisé', 'Pédagogie active', 'Activités extra-scolaires'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5" style={{ color: 'hsl(var(--accent))' }} />
                <span style={{ fontSize: isLg ? '0.8rem' : '0.65rem', color: 'hsl(var(--foreground))' }}>{item}</span>
              </div>
            ))}
          </div>
        );

      case 'TextBlockquote':
        return (
          <div className="px-4 py-3">
            <blockquote className="pl-3 italic" style={{ borderLeft: `3px solid hsl(var(--accent))`, fontSize: isLg ? '0.85rem' : '0.7rem', color: 'hsl(var(--foreground))' }}>
              L'éducation est l'arme la plus puissante qu'on puisse utiliser pour changer le monde.
            </blockquote>
          </div>
        );

      // ═══════════════════════════════════════════════════════════════════
      //  IMAGE
      // ═══════════════════════════════════════════════════════════════════

      case 'ImageSingle':
        return (
          <div className="px-4 py-3">
            <div className="rounded-lg" style={{ background: `linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--accent) / 0.3))`, height: isLg ? '160px' : '100px' }} />
            <p className="mt-1 text-center" style={{ fontSize: isLg ? '0.7rem' : '0.6rem', color: 'hsl(var(--muted-foreground))' }}>Légende de l'image</p>
          </div>
        );

      case 'ImageGrid3':
        return (
          <div className="grid grid-cols-3 gap-1.5 px-4 py-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded" style={{ background: `linear-gradient(135deg, hsl(var(--primary) / ${0.2 + i * 0.1}), hsl(var(--accent) / ${0.2 + i * 0.1}))`, height: isLg ? '80px' : '50px' }} />
            ))}
          </div>
        );

      case 'ImageMosaic':
        return (
          <div className="px-4 py-3 grid grid-cols-3 gap-1.5" style={{ gridTemplateRows: 'auto auto' }}>
            <div className="col-span-2 row-span-2 rounded" style={{ background: `linear-gradient(135deg, hsl(var(--primary) / 0.3), hsl(var(--accent) / 0.3))`, minHeight: isLg ? '120px' : '80px' }} />
            <div className="rounded" style={{ background: `hsl(var(--accent) / 0.3)`, minHeight: isLg ? '58px' : '38px' }} />
            <div className="rounded" style={{ background: `hsl(var(--primary) / 0.3)`, minHeight: isLg ? '58px' : '38px' }} />
          </div>
        );

      case 'ImageBeforeAfter':
        return (
          <div className="px-4 py-3">
            <div className="relative rounded-lg overflow-hidden" style={{ height: isLg ? '140px' : '90px' }}>
              <div className="absolute inset-0" style={{ background: 'hsl(var(--muted))' }} />
              <div className="absolute inset-y-0 left-0 w-1/2" style={{ background: `linear-gradient(135deg, hsl(var(--primary) / 0.5), hsl(var(--accent) / 0.5))` }} />
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white" />
            </div>
          </div>
        );

      case 'ImageGallery':
        return (
          <div className="grid grid-cols-4 gap-1 px-4 py-3">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="rounded" style={{ background: `hsl(var(--primary) / ${0.1 + (i % 4) * 0.1})`, aspectRatio: '1' }} />
            ))}
          </div>
        );

      // ═══════════════════════════════════════════════════════════════════
      //  VIDEO
      // ═══════════════════════════════════════════════════════════════════

      case 'VideoEmbed':
        return (
          <div className="px-4 py-3">
            <div className="relative rounded-lg overflow-hidden" style={{ background: 'hsl(var(--sidebar))', height: isLg ? '140px' : '90px' }}>
              <Play className="absolute inset-0 m-auto w-8 h-8 text-white" />
            </div>
          </div>
        );

      case 'VideoBgSection':
        return (
          <section className="relative px-4 py-10 flex items-center justify-center text-white" style={{ background: 'hsl(var(--sidebar))', minHeight: isLg ? '160px' : '100px' }}>
            <div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(45deg, hsl(var(--primary)), hsl(var(--accent)))` }} />
            <div className="relative text-center">
              <Play className="mx-auto w-8 h-8" />
              <p className="mt-1" style={{ fontSize: isLg ? '0.8rem' : '0.65rem' }}>Découvrez notre école</p>
            </div>
          </section>
        );

      case 'VideoModal':
        return (
          <div className="px-4 py-4 text-center">
            <button className="inline-flex items-center gap-1.5 font-semibold" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', padding: isLg ? '0.5rem 1rem' : '0.35rem 0.75rem', borderRadius: 'var(--radius)', fontSize: isLg ? '0.8rem' : '0.65rem' }}>
              <Play className={isLg ? 'w-3.5 h-3.5' : 'w-3 h-3'} /> Voir la vidéo
            </button>
          </div>
        );

      case 'VideoPlaylist':
        return (
          <div className="px-4 py-3 space-y-1.5">
            {['Vidéo 1 — Présentation', 'Vidéo 2 — Témoignages', 'Vidéo 3 — Campus'].map((title, i) => (
              <div key={i} className="flex items-center gap-2 p-1.5 rounded" style={{ background: 'hsl(var(--card))' }}>
                <div className="rounded" style={{ background: `hsl(var(--primary) / 0.3)`, width: isLg ? '40px' : '30px', height: isLg ? '28px' : '20px' }} />
                <span style={{ fontSize: isLg ? '0.7rem' : '0.6rem', color: 'hsl(var(--card-foreground))' }}>{title}</span>
              </div>
            ))}
          </div>
        );

      default:
        return <div className="p-4 text-sm text-slate-500">Variante inconnue : {variant.componentKey}</div>;
    }
  };

  return (
    <div style={wrapperStyle}>
      {renderVariant()}
    </div>
  );
}
