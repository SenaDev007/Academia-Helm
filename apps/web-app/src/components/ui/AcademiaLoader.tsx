'use client';

/**
 * AcademiaLoader — v4 Clean Premium
 *
 * Écran de chargement premium Academia Helm.
 * DEUX modes :
 * - inline (route transitions) : Logo animé + nom de page, PAS de pourcentage fictif.
 *   Next.js remplace automatiquement loading.tsx quand la page est prête.
 * - fullscreen (PostLoginFlow) : Logo circulaire + progression RÉELLE.
 *
 * Palette : Royal Blue (#1A237E), Blue (#3F51B5), Gold (#f5b335)
 */

import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { BRAND } from '@/lib/brand';
import { getPageDisplayName } from '@/lib/loading/page-names';

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
        <style>{`
          .academia-loader-ring-sm {
            position: absolute; inset: -5px;
            border-radius: 50%;
            border: 2px solid rgba(245, 179, 53, 0.12);
            border-top-color: #f5b335;
            animation: academiaOrbit 0.9s linear infinite;
          }
        `}</style>
      </div>
    );
  }

  // ── Mode fullscreen : pour PostLoginFlow (progression réelle)
  const realProgress = typeof progress === 'number' ? progress : 0;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1A237E]">
      {/* Orbes d'ambiance subtiles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="academia-loader-orb academia-loader-orb-1" />
        <div className="academia-loader-orb academia-loader-orb-2" />
      </div>

      {/* Logo circulaire avec bordure */}
      <div className="relative academia-loader-container">
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
      <div className="mt-7 text-center academia-loader-text">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {BRAND.name.split(' ')[0]}
          <span className="text-[#f5b335] ml-1.5">{BRAND.name.split(' ')[1]}</span>
        </h1>
        <p className="text-[10px] text-blue-200/45 tracking-[0.25em] uppercase font-medium mt-0.5">
          {BRAND.subtitle}
        </p>
      </div>

      {/* Message de l'étape réelle */}
      <div className="mt-5 text-center academia-loader-step">
        <p className="text-sm font-medium text-white/90">
          {message || 'Chargement…'}
        </p>
        {step && (
          <p className="text-[10px] text-blue-200/40 mt-0.5 tracking-wider uppercase">
            {step}
          </p>
        )}
      </div>

      {/* Barre de progression RÉELLE — épaisse et visible */}
      <div className="mt-6 w-56">
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
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

      {/* Dots animés */}
      <div className="flex items-center space-x-2.5 mt-6">
        <div className="h-1.5 w-1.5 rounded-full bg-[#3F51B5]/70 academia-loader-dot" style={{ animationDelay: '0ms' }} />
        <div className="h-2 w-2 rounded-full bg-[#3F51B5] academia-loader-dot" style={{ animationDelay: '120ms' }} />
        <div className="h-1.5 w-1.5 rounded-full bg-[#f5b335] academia-loader-dot" style={{ animationDelay: '240ms' }} />
      </div>

      <style>{`
        @keyframes academiaOrbitSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes academiaOrbitReverse {
          to { transform: rotate(-360deg); }
        }
        @keyframes academiaPulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes academiaHaloPulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.35); opacity: 0.05; }
        }
        @keyframes academiaFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes academiaFloatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.1; }
          33% { transform: translate(25px, -35px) scale(1.1); opacity: 0.06; }
          66% { transform: translate(-20px, 20px) scale(0.95); opacity: 0.15; }
        }
        @keyframes academiaDotBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        .academia-loader-container {
          position: relative;
          width: 84px; height: 84px;
          display: flex; align-items: center; justify-content: center;
        }
        .academia-loader-ring {
          position: absolute; inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-top-color: #f5b335;
          animation: academiaOrbitSpin 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .academia-loader-ring-outer {
          position: absolute; inset: -10px;
          border-radius: 50%;
          border: 1.5px solid rgba(63, 81, 181, 0.1);
          border-bottom-color: rgba(63, 81, 181, 0.5);
          animation: academiaOrbitReverse 2.5s linear infinite;
        }
        .academia-loader-halo {
          position: absolute; inset: -20px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(245,179,53,0.12) 0%, transparent 70%);
          animation: academiaHaloPulse 3s ease-in-out infinite;
        }
        .academia-loader-logo-circle {
          position: relative; z-index: 10;
          width: 56px; height: 56px;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
          border: 2px solid rgba(255,255,255,0.25);
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(4px);
          animation: academiaPulse 2.8s ease-in-out infinite;
        }
        .academia-loader-text {
          animation: academiaFadeUp 0.6s ease-out 0.15s both;
        }
        .academia-loader-step {
          animation: academiaFadeUp 0.5s ease-out 0.3s both;
        }
        .academia-loader-orb {
          position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none;
        }
        .academia-loader-orb-1 {
          width: 240px; height: 240px;
          background: rgba(245, 179, 53, 0.07);
          top: -8%; left: -6%;
          animation: academiaFloatOrb 10s ease-in-out infinite;
        }
        .academia-loader-orb-2 {
          width: 200px; height: 200px;
          background: rgba(63, 81, 181, 0.1);
          bottom: -4%; right: -4%;
          animation: academiaFloatOrb 13s ease-in-out infinite reverse;
        }
        .academia-loader-dot {
          animation: academiaDotBounce 0.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
