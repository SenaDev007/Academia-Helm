/**
 * Educational Particles Component
 * 
 * Animated particles for hero section with educational theme
 * Professional and luxurious design with smooth CSS animations
 */

'use client';

import { useMemo } from 'react';
import { GraduationCap, BookOpen, Sparkles, Award } from 'lucide-react';

interface ParticleConfig {
  icon: typeof GraduationCap;
  name: string;
  weight: number;
}

const particleTypes: ParticleConfig[] = [
  { icon: GraduationCap, name: 'graduation', weight: 3 },
  { icon: BookOpen, name: 'book', weight: 4 },
  { icon: Sparkles, name: 'sparkle', weight: 2 },
  { icon: Award, name: 'award', weight: 1 },
];

// Generate weighted random particle type
function getRandomParticleType(): ParticleConfig {
  const totalWeight = particleTypes.reduce((sum, p) => sum + p.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const particle of particleTypes) {
    random -= particle.weight;
    if (random <= 0) return particle;
  }
  
  return particleTypes[0];
}

export default function EducationalParticles() {
  // Generate particles with unique configurations
  const particles = useMemo(() => {
    return Array.from({ length: 30 }).map((_, i) => {
      const type = getRandomParticleType();
      const size = 16 + Math.random() * 12; // 16-28px (slightly larger)
      const duration = 30 + Math.random() * 20; // 30-50s (slower movement)
      const delay = Math.random() * 5; // 0-5s
      const opacity = 0.4 + Math.random() * 0.3; // 0.4-0.7 (more visible)
      
      // Spread particles evenly across the viewport
      // Distribute starting positions more evenly
      const row = Math.floor(i / 6); // 5 rows (0-4)
      const col = i % 6; // 6 columns (0-5)
      const baseStartX = (col / 5) * 120 - 20; // Spread from -20% to 100%
      const baseStartY = (row / 4) * 120 - 20; // Spread from -20% to 100%
      
      // Add some randomness to avoid perfect grid
      const startX = baseStartX + (Math.random() - 0.5) * 15;
      const startY = baseStartY + (Math.random() - 0.5) * 15;
      
      // Directional movement - particles move diagonally from top-left to bottom-right
      // Each particle has a slightly different angle for natural spread
      const angle = 135 + (Math.random() - 0.5) * 30; // 120-150 degrees (wider spread)
      const distance = 150 + Math.random() * 50; // 150-200% movement distance
      const endX = startX + Math.cos((angle * Math.PI) / 180) * distance;
      const endY = startY + Math.sin((angle * Math.PI) / 180) * distance;
      
      return {
        id: i,
        type,
        size,
        startX,
        startY,
        endX,
        endY,
        duration,
        delay,
        opacity,
      };
    });
  }, []);

  return (
    <div
      className="absolute inset-0 z-[1] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((particle) => {
        const ParticleIcon = particle.type.icon;
        
        return (
          <div
            key={particle.id}
            className="absolute particle-float"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              opacity: particle.opacity,
              '--duration': `${particle.duration}s`,
              '--delay': `${particle.delay}s`,
              '--start-x': `${particle.startX}%`,
              '--start-y': `${particle.startY}%`,
              '--end-x': `${particle.endX}%`,
              '--end-y': `${particle.endY}%`,
            } as React.CSSProperties}
          >
            <ParticleIcon
              className="w-full h-full text-white/70 particle-rotate"
              strokeWidth={1.5}
              style={{
                filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.4))',
                '--rotation-duration': `${particle.duration * 2}s`,
              } as React.CSSProperties}
            />
          </div>
        );
      })}
    </div>
  );
}

