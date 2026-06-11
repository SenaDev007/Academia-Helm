'use client';

/**
 * AcademiaLoader
 *
 * Écran de chargement premium avec le logo Academia Helm animé.
 * Animation élégante : pulse lumineux sur le logo + barre de progression dorée.
 * Utilisable comme composant de loading pour toute la plateforme.
 */

import Image from 'next/image';
import { BRAND } from '@/lib/brand';

interface AcademiaLoaderProps {
  /** Mode compact pour les transitions inline (pas plein écran) */
  inline?: boolean;
  /** Message personnalisé sous le logo */
  message?: string;
}

export default function AcademiaLoader({ inline = false, message }: AcademiaLoaderProps) {
  if (inline) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="relative">
          <div className="academia-loader-ring-sm" />
          <Image
            src={BRAND.logoPath}
            alt={BRAND.name}
            width={32}
            height={32}
            className="academia-loader-logo-sm"
            priority
          />
        </div>
        <span className="ml-3 text-sm text-slate-500">{message ?? 'Chargement…'}</span>
        <style>{`
          .academia-loader-ring-sm {
            position: absolute; inset: -4px;
            border-radius: 50%;
            border: 2px solid rgba(245, 179, 53, 0.15);
            border-top-color: #f5b335;
            animation: academia-spin 0.8s linear infinite;
          }
          .academia-loader-logo-sm {
            animation: academia-breathe 1.6s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0b2f73]">
      {/* Particules d'ambiance */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="academia-loader-orb academia-loader-orb-1" />
        <div className="academia-loader-orb academia-loader-orb-2" />
      </div>

      {/* Logo animé */}
      <div className="relative academia-loader-container">
        {/* Anneau lumineux rotatif */}
        <div className="academia-loader-ring" />

        {/* Halo ambre */}
        <div className="academia-loader-halo" />

        {/* Logo */}
        <Image
          src={BRAND.logoPath}
          alt={BRAND.name}
          width={72}
          height={72}
          className="relative z-10 academia-loader-logo"
          priority
        />
      </div>

      {/* Nom de marque */}
      <div className="mt-6 text-center academia-loader-text">
        <h1 className="text-xl font-bold text-white tracking-tight">
          {BRAND.name.split(' ')[0]}
          <span className="text-[#f5b335] ml-1.5">{BRAND.name.split(' ')[1]}</span>
        </h1>
        <p className="text-[11px] text-blue-200/60 mt-0.5 tracking-widest uppercase font-medium">
          {BRAND.subtitle}
        </p>
      </div>

      {/* Barre de progression */}
      <div className="mt-8 w-48 h-[3px] rounded-full bg-white/10 overflow-hidden">
        <div className="academia-loader-progress" />
      </div>

      {/* Message */}
      <p className="mt-4 text-[11px] text-blue-200/50 tracking-wide">
        {message ?? 'Chargement…'}
      </p>

      <style>{`
        @keyframes academia-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes academia-breathe {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes academia-halo-pulse {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.35); opacity: 0.08; }
        }
        @keyframes academia-progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        @keyframes academia-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes academia-float {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.18; }
          33% { transform: translate(20px, -30px) scale(1.1); opacity: 0.12; }
          66% { transform: translate(-15px, 15px) scale(0.95); opacity: 0.22; }
        }

        .academia-loader-container {
          position: relative;
          width: 88px; height: 88px;
          display: flex; align-items: center; justify-content: center;
        }
        .academia-loader-ring {
          position: absolute; inset: 0;
          border-radius: 50%;
          border: 2.5px solid rgba(245, 179, 53, 0.1);
          border-top-color: #f5b335;
          animation: academia-spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .academia-loader-halo {
          position: absolute; inset: -16px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(245,179,53,0.18) 0%, transparent 70%);
          animation: academia-halo-pulse 2s ease-in-out infinite;
        }
        .academia-loader-logo {
          animation: academia-breathe 2.4s ease-in-out infinite;
          border-radius: 16px;
        }

        .academia-loader-text {
          animation: academia-fade-up 0.6s ease-out 0.2s both;
        }

        .academia-loader-progress {
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, #f5b335, transparent);
          border-radius: 9999px;
          animation: academia-progress 1.8s ease-in-out infinite;
        }

        .academia-loader-orb {
          position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none;
        }
        .academia-loader-orb-1 {
          width: 280px; height: 280px;
          background: rgba(245, 179, 53, 0.12);
          top: -10%; left: -8%;
          animation: academia-float 8s ease-in-out infinite;
        }
        .academia-loader-orb-2 {
          width: 200px; height: 200px;
          background: rgba(29, 79, 165, 0.2);
          bottom: -5%; right: -5%;
          animation: academia-float 10s ease-in-out infinite reverse;
        }
      `}</style>
    </div>
  );
}
