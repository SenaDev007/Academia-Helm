/**
 * ============================================================================
 * OnboardingAnimation — Icônes Lucide scolaires flottantes
 * ============================================================================
 *
 * Animation professionnelle avec des icônes Lucide ayant rapport avec l'école
 * (livre, diplôme, crayon, globe, calculatrice, etc.) qui flottent doucement
 * dans le hero de la page /signup.
 *
 * Palette Academia Helm (navy, gold, crimson) avec opacité subtile.
 * ============================================================================
 */

'use client';

import { useEffect, useRef } from 'react';
import {
  BookOpen, GraduationCap, Pencil, Globe2, Calculator,
  FlaskConical, Music, Palette, Languages, Brain,
  Microscope, Ruler, PenTool, Lightbulb, Atom,
} from 'lucide-react';

interface FloatingIcon {
  Icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
  delay: number;
  duration: number;
}

const COLORS = {
  navy: '#0A2A5E',
  navyLight: '#1E40AF',
  gold: '#D4A030',
  goldLight: '#F2C94C',
  crimson: '#B91C1C',
  teal: '#0D9488',
  indigo: '#4F46E5',
};

const ICONS = [
  BookOpen, GraduationCap, Pencil, Globe2, Calculator,
  FlaskConical, Music, Palette, Languages, Brain,
  Microscope, Ruler, PenTool, Lightbulb, Atom,
];

export default function OnboardingAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);

  // ⭐ Générer les icônes flottantes de façon déterministe (pas de Math.random
  // au render pour éviter les re-rendus). On utilise un seed fixe.
  const floatingIcons: FloatingIcon[] = (() => {
    const icons: FloatingIcon[] = [];
    const colors = [COLORS.gold, COLORS.goldLight, COLORS.navyLight, COLORS.crimson, COLORS.teal, COLORS.indigo];
    const seed = 42; // seed fixe pour positions stables

    // Pseudo-random déterministe
    let s = seed;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    const count = 18;
    for (let i = 0; i < count; i++) {
      icons.push({
        Icon: ICONS[i % ICONS.length],
        x: rand() * 100, // percentage
        y: rand() * 100,
        size: 18 + rand() * 22,
        color: colors[i % colors.length],
        opacity: 0.08 + rand() * 0.15,
        delay: rand() * 6,
        duration: 8 + rand() * 8,
      });
    }
    return icons;
  })();

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* Fond dégradé subtil */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(10, 42, 94, 0.04) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(242, 201, 76, 0.03) 0%, transparent 60%)',
        }}
      />

      {/* Icônes Lucide flottantes */}
      {floatingIcons.map((item, i) => {
        const { Icon } = item;
        return (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              animation: `float-gentle ${item.duration}s ease-in-out ${item.delay}s infinite`,
            }}
          >
            <Icon
              size={item.size}
              style={{
                color: item.color,
                opacity: item.opacity,
              }}
            />
          </div>
        );
      })}

      {/* Styles pour l'animation float-gentle */}
      <style jsx>{`
        @keyframes float-gentle {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(8px, -12px) rotate(5deg);
          }
          50% {
            transform: translate(-4px, -8px) rotate(-3deg);
          }
          75% {
            transform: translate(-8px, 6px) rotate(2deg);
          }
        }
      `}</style>
    </div>
  );
}
