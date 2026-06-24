/**
 * Floating Educational Particles
 *
 * Lightweight CSS-animated floating lucide icons with educational theme.
 * Used by AcademiaLoader (fullscreen), LoadingScreen (post-login),
 * SessionLockScreen, LogoutLoadingScreen, LogoutConfirmationModal.
 *
 * Icons: GraduationCap, BookOpen, Award, Sparkles, FlaskConical,
 *        Palette, Music, Calculator, Globe
 *
 * CSS animations (eduParticleFloat, eduParticleRotate) are defined in globals.css
 * so they work during SSR before hydration.
 *
 * Variant prop controls icon color for visibility on any background:
 *   - 'light' : white + gold icons (for dark/navy backgrounds)
 *   - 'dark'  : navy + blue icons (for light/white backgrounds)
 *   - 'mixed' : alternating light + dark (for backgrounds with both zones)
 */

'use client';

import { useMemo } from 'react';
import { GraduationCap, BookOpen, Award, Sparkles, FlaskConical, Palette, Music, Calculator, Globe } from 'lucide-react';

const EDU_ICONS = [GraduationCap, BookOpen, Award, Sparkles, FlaskConical, Palette, Music, Calculator, Globe];

// Color palettes per variant
const LIGHT_COLORS = ['#ffffff', '#f5b335', '#FFD700', '#f0f4ff']; // white, gold, light gold, ice
const DARK_COLORS = ['#0b2f73', '#1d4fa5', '#1A2BA6', '#15378a']; // navy, blue, indigo, deep blue

export type ParticleVariant = 'light' | 'dark' | 'mixed';

interface FloatingEduParticlesProps {
  count?: number;
  /** Opacity multiplier (default 1.0) */
  opacityMultiplier?: number;
  /** Color variant for background visibility (default 'light') */
  variant?: ParticleVariant;
}

export default function FloatingEduParticles({ count = 20, opacityMultiplier = 1.0, variant = 'light' }: FloatingEduParticlesProps) {
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

      return { id: i, Icon, size, duration, delay, opacity, startX, startY, endX, endY, color };
    });
  }, [count, opacityMultiplier, variant]);

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
              className="w-full h-full"
              strokeWidth={1.2}
              style={{
                color: p.color,
                animation: `eduParticleRotate ${p.duration * 1.5}s linear ${p.delay}s infinite`,
                filter: variant === 'light'
                  ? 'drop-shadow(0 0 6px rgba(245, 179, 53, 0.15))'
                  : 'drop-shadow(0 0 4px rgba(11, 47, 115, 0.10))',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
