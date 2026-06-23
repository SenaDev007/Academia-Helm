/**
 * Floating Educational Particles
 *
 * Lightweight CSS-animated floating lucide icons with educational theme.
 * Used by AcademiaLoader (fullscreen) and LoadingScreen (post-login).
 *
 * Icons: GraduationCap, BookOpen, Award, Sparkles, FlaskConical,
 *        Palette, Music, Calculator, Globe
 *
 * CSS animations (eduParticleFloat, eduParticleRotate) are defined in globals.css
 * so they work during SSR before hydration.
 */

'use client';

import { useMemo } from 'react';
import { GraduationCap, BookOpen, Award, Sparkles, FlaskConical, Palette, Music, Calculator, Globe } from 'lucide-react';

const EDU_ICONS = [GraduationCap, BookOpen, Award, Sparkles, FlaskConical, Palette, Music, Calculator, Globe];

interface FloatingEduParticlesProps {
  count?: number;
  /** Opacity multiplier (default 1.0) */
  opacityMultiplier?: number;
}

export default function FloatingEduParticles({ count = 20, opacityMultiplier = 1.0 }: FloatingEduParticlesProps) {
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const Icon = EDU_ICONS[i % EDU_ICONS.length];
      const size = 14 + Math.random() * 18; // 14-32px
      const duration = 20 + Math.random() * 15; // 20-35s
      const delay = Math.random() * 8; // 0-8s
      const opacity = (0.08 + Math.random() * 0.12) * opacityMultiplier; // 0.08-0.20
      const startX = Math.random() * 100;
      const startY = Math.random() * 100;
      const drift = 30 + Math.random() * 40; // 30-70% drift
      const angle = Math.random() * 360;
      const endX = startX + Math.cos((angle * Math.PI) / 180) * drift;
      const endY = startY + Math.sin((angle * Math.PI) / 180) * drift;
      return { id: i, Icon, size, duration, delay, opacity, startX, startY, endX, endY };
    });
  }, [count, opacityMultiplier]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 1 }} aria-hidden="true">
      {particles.map((p) => {
        const Icon = p.Icon;
        return (
          <div
            key={p.id}
            className="absolute"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              left: `${p.startX}%`,
              top: `${p.startY}%`,
              animation: `eduParticleFloat ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
              '--end-x': `${p.endX - p.startX}%`,
              '--end-y': `${p.endY - p.startY}%`,
            } as React.CSSProperties}
          >
            <Icon
              className="w-full h-full text-white"
              strokeWidth={1.2}
              style={{
                animation: `eduParticleRotate ${p.duration * 1.5}s linear ${p.delay}s infinite`,
                filter: 'drop-shadow(0 0 6px rgba(245, 179, 53, 0.15))',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
