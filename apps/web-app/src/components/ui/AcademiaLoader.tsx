'use client';

/**
 * AcademiaLoader — v6 Global CSS + Educational Particles
 *
 * Écran de chargement premium Academia Helm.
 * DEUX modes :
 * - inline (route transitions) : Logo animé + nom de page, PAS de pourcentage fictif.
 *   Next.js remplace automatiquement loading.tsx quand la page est prête.
 * - fullscreen (PostLoginFlow) : Logo circulaire + progression RÉELLE +
 *   particules éducatives flottantes (GraduationCap, BookOpen, Award, etc.)
 *
 * ⚠️ All CSS animations are defined in globals.css so they are available
 * immediately during SSR — before JS hydration. This prevents the static
 * blue screen with no animation on initial page load.
 *
 * Palette : Royal Blue (#1A237E), Blue (#3F51B5), Gold (#f5b335)
 */

import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { BRAND } from '@/lib/brand';
import { getPageDisplayName } from '@/lib/loading/page-names';
import FloatingEduParticles from './FloatingEduParticles';

interface AcademiaLoaderProps {
  /** Mode compact pour les transitions inline (pas plein écran, pas de %) */
  inline?: boolean;
  /** Message personnalisé */
  message?: string;
  /** Progression réelle 0-100 (uniquement pour le mode fullscreen) */
  progress?: number;
  /** Étape actuelle (uniquement pour le mode fullscreen) */
  step?: string;
}

export default function AcademiaLoader({ inline = false, message, progress, step }: AcademiaLoaderProps) {
  const pathname = usePathname();
  const pageName = message ?? getPageDisplayName(pathname);

  // ── Mode inline : pour loading.tsx (route transitions)
  // Pas de pourcentage — Next.js remplace automatiquement quand la page est prête
  if (inline) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="relative">
          <div className="academia-loader-ring-sm" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Image
              src={BRAND.logoPath}
              alt={BRAND.name}
              width={24}
              height={24}
              className="relative z-10 rounded-full"
              priority
            />
          </div>
        </div>
        <span className="ml-3 text-sm text-slate-500 font-medium">{pageName}</span>
      </div>
    );
  }

  // ── Mode fullscreen : pour PostLoginFlow (progression réelle)
  const realProgress = typeof progress === 'number' ? progress : 0;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1A237E]">
      {/* Particules éducatives flottantes — toujours visibles, derrière le contenu */}
      <FloatingEduParticles count={30} opacityMultiplier={2.0} />

      {/* Orbes d'ambiance subtiles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div className="academia-loader-orb academia-loader-orb-1" />
        <div className="academia-loader-orb academia-loader-orb-2" />
      </div>

      {/* Logo circulaire avec bordure — z-index au-dessus des particules */}
      <div className="relative academia-loader-container" style={{ zIndex: 10 }}>
        <div className="academia-loader-halo" />
        <div className="academia-loader-ring" />
        <div className="academia-loader-ring-outer" />
        <div className="academia-loader-logo-circle">
          <Image
            src={BRAND.logoPath}
            alt={BRAND.name}
            width={48}
            height={48}
            className="rounded-full"
            priority
          />
        </div>
      </div>

      {/* Nom de marque */}
      <div className="mt-7 text-center academia-loader-text relative" style={{ zIndex: 10 }}>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {BRAND.name.split(' ')[0]}
          <span className="text-[#f5b335] ml-1.5">{BRAND.name.split(' ')[1]}</span>
        </h1>
        <p className="text-[10px] text-blue-200/45 tracking-[0.25em] uppercase font-medium mt-0.5">
          {BRAND.subtitle}
        </p>
      </div>

      {/* Message de l'étape réelle */}
      <div className="mt-5 text-center academia-loader-step relative" style={{ zIndex: 10 }}>
        <p className="text-sm font-medium text-white/90">
          {message || 'Chargement…'}
        </p>
        {step && (
          <p className="text-[10px] text-blue-200/40 mt-0.5 tracking-wider uppercase">
            {step}
          </p>
        )}
      </div>

      {/* Barre de progression RÉELLE — seulement si progress est passé */}
      {typeof progress === 'number' && (
        <div className="mt-6 w-56 relative" style={{ zIndex: 10 }}>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${realProgress}%`,
                background: 'linear-gradient(90deg, #3F51B5, #f5b335)',
              }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[9px] text-blue-200/35 uppercase tracking-wider font-medium">Progression</span>
            <span className="text-[11px] text-[#f5b335] font-bold tabular-nums">{Math.round(realProgress)}%</span>
          </div>
        </div>
      )}

      {/* Dots animés */}
      <div className="flex items-center space-x-2.5 mt-6 relative" style={{ zIndex: 10 }}>
        <div className="h-1.5 w-1.5 rounded-full bg-[#3F51B5]/70 academia-loader-dot" style={{ animationDelay: '0ms' }} />
        <div className="h-2 w-2 rounded-full bg-[#3F51B5] academia-loader-dot" style={{ animationDelay: '120ms' }} />
        <div className="h-1.5 w-1.5 rounded-full bg-[#f5b335] academia-loader-dot" style={{ animationDelay: '240ms' }} />
      </div>
    </div>
  );
}
