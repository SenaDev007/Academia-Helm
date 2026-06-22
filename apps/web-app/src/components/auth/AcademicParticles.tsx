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

interface Particle {
  icon: typeof GraduationCap;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  drift: number;
}

export default function AcademicParticles() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Générer les particules une seule fois (mémoïsation via useRef)
  const particlesRef = useRef<Particle[]>([]);
  if (particlesRef.current.length === 0) {
    const count = 24; // nombre de particules
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        icon: ICONS[i % ICONS.length],
        x: Math.random() * 100, // position horizontale (%)
        y: Math.random() * 100, // position verticale (%)
        size: 16 + Math.random() * 32, // taille (px)
        opacity: 0.03 + Math.random() * 0.08, // opacité (très léger)
        duration: 15 + Math.random() * 25, // durée animation (s)
        delay: Math.random() * 10, // délai (s)
        drift: (Math.random() - 0.5) * 60, // dérive horizontale (px)
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
              className="text-[#1A2BA6]"
              style={{
                width: `${p.size}px`,
                height: `${p.size}px`,
                opacity: p.opacity,
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
