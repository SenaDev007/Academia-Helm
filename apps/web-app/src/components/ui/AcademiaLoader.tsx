'use client';

/**
 * AcademiaLoader — v3 Real Progress
 *
 * Écran de chargement premium Academia Helm.
 * DEUX modes :
 * - inline (route transitions) : Logo animé + nom de page, PAS de pourcentage fictif.
 *   Next.js remplace automatiquement loading.tsx quand la page est prête.
 * - fullscreen (PostLoginFlow) : Logo animé + progression RÉELLE basée sur les étapes.
 *
 * Palette : Navy (#0b2f73), Blue (#1d4fa5), Gold (#f5b335)
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
          <Image
            src={BRAND.logoPath}
            alt={BRAND.name}
            width={28}
            height={28}
            className="academia-loader-logo-sm relative z-10 rounded-lg"
            priority
          />
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
          .academia-loader-logo-sm {
            animation: academiaPulse 2s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  // ── Mode fullscreen : pour PostLoginFlow (progression réelle)
  const realProgress = typeof progress === 'number' ? progress : 0;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0b2f73]">
      {/* Orbes d'ambiance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="academia-loader-orb academia-loader-orb-1" />
        <div className="academia-loader-orb academia-loader-orb-2" />
        <div className="academia-loader-orb academia-loader-orb-3" />
      </div>

      {/* Logo avec halo premium */}
      <div className="relative academia-loader-container">
        <div className="academia-loader-halo" />
        <div className="academia-loader-ring" />
        <div className="academia-loader-ring-outer" />
        <Image
          src={BRAND.logoPath}
          alt={BRAND.name}
          width={68}
          height={68}
          className="relative z-10 academia-loader-logo rounded-2xl"
          priority
        />
      </div>

      {/* Nom de marque */}
      <div className="mt-8 text-center academia-loader-text">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {BRAND.name.split(' ')[0]}
          <span className="text-[#f5b335] ml-1.5">{BRAND.name.split(' ')[1]}</span>
        </h1>
        <p className="text-[10px] text-blue-200/45 tracking-[0.25em] uppercase font-medium mt-1">
          {BRAND.subtitle}
        </p>
      </div>

      {/* Message de l'étape réelle */}
      <div className="mt-6 text-center academia-loader-step">
        <p className="text-sm font-medium text-white/90">
          {message || 'Chargement…'}
        </p>
        {step && (
          <p className="text-[10px] text-blue-200/40 mt-1 tracking-wider uppercase">
            {step}
          </p>
        )}
      </div>

      {/* Barre de progression RÉELLE — pas de pourcentage fictif */}
      <div className="mt-8 w-52">
        <div className="h-[3px] rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${realProgress}%`,
              background: 'linear-gradient(90deg, #1d4fa5, #f5b335)',
            }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[9px] text-blue-200/30 uppercase tracking-wider">Progression</span>
          <span className="text-[11px] text-[#f5b335] font-semibold tabular-nums">{Math.round(realProgress)}%</span>
        </div>
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
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.4); opacity: 0.06; }
        }
        @keyframes academiaFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes academiaFloatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.15; }
          33% { transform: translate(25px, -35px) scale(1.1); opacity: 0.1; }
          66% { transform: translate(-20px, 20px) scale(0.95); opacity: 0.2; }
        }

        .academia-loader-container {
          position: relative;
          width: 84px; height: 84px;
          display: flex; align-items: center; justify-content: center;
        }
        .academia-loader-ring {
          position: absolute; inset: 0;
          border-radius: 50%;
          border: 2.5px solid rgba(245, 179, 53, 0.08);
          border-top-color: #f5b335;
          animation: academiaOrbitSpin 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .academia-loader-ring-outer {
          position: absolute; inset: -10px;
          border-radius: 50%;
          border: 1.5px solid rgba(29, 79, 165, 0.1);
          border-bottom-color: rgba(29, 79, 165, 0.5);
          animation: academiaOrbitReverse 2.5s linear infinite;
        }
        .academia-loader-halo {
          position: absolute; inset: -20px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(245,179,53,0.15) 0%, transparent 70%);
          animation: academiaHaloPulse 2.5s ease-in-out infinite;
        }
        .academia-loader-logo {
          animation: academiaPulse 2.8s ease-in-out infinite;
        }
        .academia-loader-text {
          animation: academiaFadeUp 0.6s ease-out 0.15s both;
        }
        .academia-loader-step {
          animation: academiaFadeUp 0.5s ease-out 0.3s both;
        }
        .academia-loader-orb {
          position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none;
        }
        .academia-loader-orb-1 {
          width: 280px; height: 280px;
          background: rgba(245, 179, 53, 0.1);
          top: -8%; left: -6%;
          animation: academiaFloatOrb 9s ease-in-out infinite;
        }
        .academia-loader-orb-2 {
          width: 220px; height: 220px;
          background: rgba(29, 79, 165, 0.15);
          bottom: -4%; right: -4%;
          animation: academiaFloatOrb 12s ease-in-out infinite reverse;
        }
        .academia-loader-orb-3 {
          width: 160px; height: 160px;
          background: rgba(245, 179, 53, 0.06);
          top: 35%; right: 15%;
          animation: academiaFloatOrb 7s ease-in-out infinite 2s;
        }
      `}</style>
    </div>
  );
}
