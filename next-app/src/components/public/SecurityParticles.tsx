'use client';

import { useMemo } from 'react';
import AppIcon from '@/components/ui/AppIcon';

export default function SecurityParticles() {
  const { wifiParticles, shieldParticles } = useMemo(() => {
    // Particules de connexion internet (signaux wifi, ondes)
    const wifiParticles = Array.from({ length: 15 }).map((_, i) => {
      const angle = (i / 15) * 360;
      const radius = 100 + Math.random() * 150; // Distance du centre
      const x = 50 + Math.cos((angle * Math.PI) / 180) * (radius / 10);
      const y = 50 + Math.sin((angle * Math.PI) / 180) * (radius / 10);
      
      return {
        id: `wifi-${i}`,
        x: x + (Math.random() - 0.5) * 20, // Variation aléatoire
        y: y + (Math.random() - 0.5) * 20,
        delay: i * 0.3,
        size: 8 + Math.random() * 12, // 8-20px
        duration: 4 + Math.random() * 3, // 4-7s
        type: Math.random() > 0.5 ? 'wifi' : 'signal', // Type de particule
      };
    });

    // Particules de protection (boucliers, cadenas)
    const shieldParticles = Array.from({ length: 12 }).map((_, i) => {
      const angle = (i / 12) * 360;
      const radius = 120 + Math.random() * 180;
      const x = 50 + Math.cos((angle * Math.PI) / 180) * (radius / 10);
      const y = 50 + Math.sin((angle * Math.PI) / 180) * (radius / 10);
      
      return {
        id: `shield-${i}`,
        x: x + (Math.random() - 0.5) * 25,
        y: y + (Math.random() - 0.5) * 25,
        delay: i * 0.4,
        size: 10 + Math.random() * 14, // 10-24px
        duration: 5 + Math.random() * 4, // 5-9s
        type: Math.random() > 0.5 ? 'shield' : 'lock', // Type de particule
      };
    });

    return { wifiParticles, shieldParticles };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-60">
      {/* Particules de connexion internet */}
      {wifiParticles.map((particle) => (
        <div
          key={particle.id}
          className="absolute security-particle-wifi"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            transform: 'translate(-50%, -50%)',
            '--particle-duration': `${particle.duration}s`,
            '--particle-delay': `${particle.delay}s`,
          } as React.CSSProperties}
        >
          {particle.type === 'wifi' ? (
            <div className="w-full h-full relative">
              {/* Signal wifi animé */}
              <div className="absolute inset-0 rounded-full border-2 border-blue-600/80 security-particle-pulse shadow-lg shadow-blue-500/30"></div>
              <div className="absolute inset-0 rounded-full border border-blue-700/60 security-particle-pulse shadow-md shadow-blue-500/20" style={{ animationDelay: '0.2s' }}></div>
              <div className="absolute inset-0 rounded-full border border-blue-800/40 security-particle-pulse shadow-sm shadow-blue-500/10" style={{ animationDelay: '0.4s' }}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 bg-blue-600 rounded-full shadow-lg shadow-blue-500/50"></div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full relative">
              {/* Ondes de signal */}
              <div className="absolute inset-0 rounded-full border-2 border-blue-600/70 security-particle-ripple shadow-lg shadow-blue-500/30"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <AppIcon name="wifiOff" size="submenu" className="text-blue-600 drop-shadow-lg" />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Particules de protection */}
      {shieldParticles.map((particle) => (
        <div
          key={particle.id}
          className="absolute security-particle-shield"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            transform: 'translate(-50%, -50%)',
            '--particle-duration': `${particle.duration}s`,
            '--particle-delay': `${particle.delay}s`,
          } as React.CSSProperties}
        >
          {particle.type === 'shield' ? (
            <div className="w-full h-full relative">
              {/* Bouclier animé */}
              <div className="absolute inset-0 flex items-center justify-center">
                <AppIcon name="shieldCheck" size="menu" className="text-green-600 drop-shadow-lg" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-green-600/70 security-particle-rotate shadow-lg shadow-green-500/30"></div>
              <div className="absolute inset-0 rounded-full border border-green-700/50 security-particle-rotate shadow-md shadow-green-500/20" style={{ animationDelay: '0.5s' }}></div>
            </div>
          ) : (
            <div className="w-full h-full relative">
              {/* Cadenas animé */}
              <div className="absolute inset-0 flex items-center justify-center">
                <AppIcon name="lock" size="menu" className="text-green-600 drop-shadow-lg" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-green-600/70 security-particle-pulse shadow-lg shadow-green-500/30"></div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

