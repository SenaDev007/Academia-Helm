'use client';

/**
 * ============================================================================
 * ACADEMIC PARTICLES — Animation de particules d'icônes lucides
 * ============================================================================
 *
 * Background animé avec des icônes lucides académiques qui flottent
 * lentement. Remplace les images de background statiques.
 *
 * Icônes utilisées (toutes liées au domaine académique) :
 * GraduationCap, BookOpen, Lightbulb, Beaker, FlaskConical, Palette,
 * Music, Calculator, Globe, Languages, Microscope, Atom
 *
 * Variant prop contrôle la couleur des icônes pour la visibilité sur
 * n'importe quel fond :
 *   - 'light' : icônes blanches + dorées (pour fonds sombres/navy)
 *   - 'dark'  : icônes navy + bleues (pour fonds clairs/blancs)
 *   - 'mixed' : alternance light + dark (pour fonds mixtes)
 * ============================================================================
 */

import { useEffect, useRef } from 'react';
import {
  GraduationCap, BookOpen, Lightbulb, Beaker, FlaskConical,
  Palette, Music, Calculator, Globe, Languages, Atom, PenTool,
} from 'lucide-react';

const ICONS = [
  GraduationCap, BookOpen, Lightbulb, Beaker, FlaskConical,
  Palette, Music, Calculator, Globe, Languages, Atom, PenTool,
];

// Color palettes per variant
const LIGHT_COLORS = ['#ffffff', '#f5b335', '#FFD700', '#f0f4ff'];
const DARK_COLORS = ['#0b2f73', '#1d4fa5', '#1A2BA6', '#15378a'];

export type AcademicParticleVariant = 'light' | 'dark' | 'mixed';

interface Particle {
  icon: typeof GraduationCap;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  drift: number;
  color: string;
}

interface AcademicParticlesProps {
  variant?: AcademicParticleVariant;
}

export default function AcademicParticles({ variant = 'dark' }: AcademicParticlesProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Générer les particules une seule fois (mémoïsation via useRef)
  const particlesRef = useRef<Particle[]>([]);
  if (particlesRef.current.length === 0) {
    const count = 24; // nombre de particules
    for (let i = 0; i < count; i++) {
      // Resolve color based on variant
      let color: string;
      if (variant === 'light') {
        color = LIGHT_COLORS[i % LIGHT_COLORS.length];
      } else if (variant === 'dark') {
        color = DARK_COLORS[i % DARK_COLORS.length];
      } else {
        // mixed: alternate between light and dark palettes
        color = i % 2 === 0
          ? LIGHT_COLORS[i % LIGHT_COLORS.length]
          : DARK_COLORS[i % DARK_COLORS.length];
      }

      particlesRef.current.push({
        icon: ICONS[i % ICONS.length],
        x: Math.random() * 100, // position horizontale (%)
        y: Math.random() * 100, // position verticale (%)
        size: 16 + Math.random() * 32, // taille (px)
        opacity: 0.05 + Math.random() * 0.10, // opacité (visible on both bg)
        duration: 15 + Math.random() * 25, // durée animation (s)
        delay: Math.random() * 10, // délai (s)
        drift: (Math.random() - 0.5) * 60, // dérive horizontale (px)
        color,
      });
    }
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {particlesRef.current.map((p, i) => {
        const Icon = p.icon;
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              animation: `particleFloat ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            }}
          >
            <Icon
              style={{
                width: `${p.size}px`,
                height: `${p.size}px`,
                opacity: p.opacity,
                color: p.color,
              }}
            />
          </div>
        );
      })}
      <style jsx>{`
        @keyframes particleFloat {
          0% {
            transform: translateY(0) translateX(0) rotate(0deg);
          }
          50% {
            transform: translateY(-30px) translateX(20px) rotate(15deg);
          }
          100% {
            transform: translateY(-60px) translateX(-15px) rotate(-10deg);
          }
        }
      `}</style>
    </div>
  );
}
