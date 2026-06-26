'use client';

/**
 * ============================================================================
 * ThemePreviewCard — Mini-page de preview façon 21st.dev
 * ============================================================================
 *
 * Affiche un aperçu visuel d'un thème sous forme de mini-page :
 *   - Header (logo placeholder + menu)
 *   - Hero (titre + sous-titre + 2 boutons)
 *   - Bandeau de chiffres clés (3 chiffres)
 *   - Section "cards" (2 cartes avec titre + texte + bouton)
 *   - Footer
 *
 * Toutes les couleurs et typographies viennent du thème injecté via
 * ThemeScope (le parent doit wrapper ce composant dans <ThemeScope>).
 *
 * Variantes :
 *   - size='sm' : petite vignette pour la galerie (300x400)
 *   - size='lg' : grande preview pour le modal plein écran
 * ============================================================================
 */

import { GraduationCap, ArrowRight, Users, BookOpen, Award } from 'lucide-react';

interface Props {
  size?: 'sm' | 'lg';
  schoolName?: string;
}

export function ThemePreviewCard({ size = 'sm', schoolName = 'Mon École' }: Props) {
  const isLg = size === 'lg';

  return (
    <div
      className="w-full flex flex-col overflow-hidden"
      style={{
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        fontFamily: 'var(--font-sans)',
        borderRadius: isLg ? 'calc(var(--radius) * 1.5)' : 'var(--radius)',
      }}
    >
      {/* === Header === */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          background: 'hsl(var(--card))',
          borderColor: 'hsl(var(--border))',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            <GraduationCap className={isLg ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          </div>
          <span
            className="font-bold"
            style={{ fontSize: isLg ? '0.95rem' : '0.75rem' }}
          >
            {schoolName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {['Accueil', 'À propos', 'Contact'].map((item) => (
            <span
              key={item}
              className="hidden sm:block"
              style={{
                fontSize: isLg ? '0.8rem' : '0.65rem',
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </header>

      {/* === Hero === */}
      <section
        className="px-4 py-5 flex flex-col items-center text-center"
        style={{
          background: `linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--accent) / 0.05))`,
        }}
      >
        <h1
          className="font-bold leading-tight"
          style={{
            fontSize: isLg ? '1.6rem' : '1rem',
            color: 'hsl(var(--foreground))',
            letterSpacing: 'var(--letter-spacing)',
          }}
        >
          Excellence éducative depuis 1995
        </h1>
        <p
          className="mt-2 max-w-md"
          style={{
            fontSize: isLg ? '0.85rem' : '0.7rem',
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          Une école où chaque enfant grandit, apprend et s'épanouit dans un cadre bienveillant.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            className="font-semibold flex items-center gap-1.5 transition hover:opacity-90"
            style={{
              background: 'hsl(var(--primary))',
              color: 'hsl(var(--primary-foreground))',
              padding: isLg ? '0.5rem 1rem' : '0.35rem 0.75rem',
              fontSize: isLg ? '0.8rem' : '0.65rem',
              borderRadius: 'var(--radius)',
            }}
          >
            Pré-inscription
            <ArrowRight className={isLg ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
          </button>
          <button
            className="font-semibold border transition hover:bg-opacity-50"
            style={{
              borderColor: 'hsl(var(--border))',
              color: 'hsl(var(--foreground))',
              padding: isLg ? '0.5rem 1rem' : '0.35rem 0.75rem',
              fontSize: isLg ? '0.8rem' : '0.65rem',
              borderRadius: 'var(--radius)',
            }}
          >
            En savoir plus
          </button>
        </div>
      </section>

      {/* === Bandeau chiffres clés === */}
      <section
        className="grid grid-cols-3 px-4 py-3 border-b"
        style={{ borderColor: 'hsl(var(--border))' }}
      >
        {[
          { icon: Users, value: '500', label: 'Élèves' },
          { icon: BookOpen, value: '30', label: 'Professeurs' },
          { icon: Award, value: '95%', label: 'Réussite' },
        ].map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex flex-col items-center text-center">
            <Icon
              className={isLg ? 'w-4 h-4 mb-1' : 'w-3 h-3 mb-0.5'}
              style={{ color: 'hsl(var(--accent))' }}
            />
            <span
              className="font-bold"
              style={{
                fontSize: isLg ? '1rem' : '0.75rem',
                color: 'hsl(var(--primary))',
              }}
            >
              {value}
            </span>
            <span
              style={{
                fontSize: isLg ? '0.7rem' : '0.55rem',
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </section>

      {/* === Cards section === */}
      <section className="px-4 py-4 flex-1">
        <div className="grid grid-cols-2 gap-2">
          {[
            { title: 'Maternelle', text: 'Éveil et découvertes' },
            { title: 'Primaire', text: 'Fondamentaux solides' },
          ].map((card) => (
            <div
              key={card.title}
              className="p-3 rounded-lg border"
              style={{
                background: 'hsl(var(--card))',
                borderColor: 'hsl(var(--border))',
                borderRadius: 'var(--radius)',
              }}
            >
              <h3
                className="font-bold mb-1"
                style={{
                  fontSize: isLg ? '0.85rem' : '0.7rem',
                  color: 'hsl(var(--card-foreground))',
                }}
              >
                {card.title}
              </h3>
              <p
                style={{
                  fontSize: isLg ? '0.7rem' : '0.6rem',
                  color: 'hsl(var(--muted-foreground))',
                  lineHeight: 1.3,
                }}
              >
                {card.text}
              </p>
              <div
                className="mt-2 inline-flex items-center gap-1 font-semibold"
                style={{
                  color: 'hsl(var(--accent))',
                  fontSize: isLg ? '0.7rem' : '0.6rem',
                }}
              >
                Découvrir
                <ArrowRight className={isLg ? 'w-3 h-3' : 'w-2.5 h-2.5'} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* === Footer === */}
      <footer
        className="px-4 py-2 border-t text-center"
        style={{
          background: 'hsl(var(--sidebar))',
          borderColor: 'hsl(var(--sidebar-border))',
          color: 'hsl(var(--sidebar-foreground))',
          fontSize: isLg ? '0.7rem' : '0.6rem',
        }}
      >
        © 2026 {schoolName} · Tous droits réservés
      </footer>
    </div>
  );
}
