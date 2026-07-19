"use client";

/**
 * SaisieMasterLoader — Écran de chargement personnalisé SaisieMaster
 *
 * Palette : Couleurs nationales du Bénin (vert #008751, jaune #FCD116, rouge #E31B23)
 * + ton EducMaster (bleu state #0B3B6B)
 *
 * Animations définies dans globals.css (saisiemaster) pour éviter le FOUC.
 */

import { Logo } from "@/components/saisiemaster/brand/logo";

export default function SaisieMasterLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0B3B6B]">
      {/* Particules subtiles — halos colorés Bénin */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute -top-20 -left-10 w-48 h-48 bg-[#008751]/10 rounded-full blur-[90px]" style={{ animation: "saisiemasterPulse 6s ease-in-out infinite" }} />
        <div className="absolute -bottom-24 -right-12 w-56 h-56 bg-[#FCD116]/10 rounded-full blur-[100px]" style={{ animation: "saisiemasterPulse 8s ease-in-out infinite reverse" }} />
        <div className="absolute top-1/3 right-1/4 w-32 h-32 bg-[#E31B23]/8 rounded-full blur-[80px]" style={{ animation: "saisiemasterPulse 7s ease-in-out infinite" }} />
      </div>

      {/* Logo circulaire avec anneaux */}
      <div className="relative" style={{ zIndex: 10 }}>
        {/* Halo */}
        <div className="absolute inset-0 -m-4 rounded-full bg-[#FCD116]/8 blur-lg" style={{ animation: "saisiemasterPulse 3s ease-in-out infinite" }} />
        {/* Anneau extérieur tricolore */}
        <div
          className="absolute inset-0 -m-3 rounded-full"
          style={{
            background: "conic-gradient(#008751 0deg 120deg, #FCD116 120deg 240deg, #E31B23 240deg 360deg)",
            animation: "saisiemasterSpin 1.5s linear infinite",
            maskImage: "radial-gradient(transparent 60%, black 62%)",
            WebkitMaskImage: "radial-gradient(transparent 60%, black 62%)",
          }}
        />
        {/* Anneau intérieur */}
        <div className="absolute inset-0 -m-1.5 rounded-full border-2 border-white/10 border-t-[#FCD116]" style={{ animation: "saisiemasterSpin 1.2s linear infinite reverse" }} />
        {/* Logo */}
        <div className="relative z-10">
          <Logo size="lg" />
        </div>
      </div>

      {/* Nom de marque */}
      <div className="mt-7 text-center" style={{ zIndex: 10 }}>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Saisie<span className="text-[#FCD116]">Master</span>
        </h1>
        <p className="text-[10px] text-blue-200/45 tracking-[0.25em] uppercase font-medium mt-0.5">
          Saisie fluide des notes
        </p>
      </div>

      {/* Message de chargement */}
      <div className="mt-5 text-center" style={{ zIndex: 10 }}>
        <p className="text-sm font-medium text-white/80">Chargement en cours…</p>
      </div>

      {/* Barre de progression */}
      <div className="mt-6 w-48" style={{ zIndex: 10 }}>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: "100%",
              background: "linear-gradient(90deg, #008751, #FCD116, #E31B23)",
              animation: "saisiemasterLoaderBar 2s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* Dots animés */}
      <div className="flex items-center space-x-2.5 mt-6" style={{ zIndex: 10 }}>
        <div className="h-1.5 w-1.5 rounded-full bg-[#008751]/70" style={{ animation: "saisiemasterBounce 0.7s ease-in-out infinite", animationDelay: "0ms" }} />
        <div className="h-2 w-2 rounded-full bg-[#FCD116]" style={{ animation: "saisiemasterBounce 0.7s ease-in-out infinite", animationDelay: "120ms" }} />
        <div className="h-1.5 w-1.5 rounded-full bg-[#E31B23]" style={{ animation: "saisiemasterBounce 0.7s ease-in-out infinite", animationDelay: "240ms" }} />
      </div>

      {/* Styles inline (au cas où globals.css n'est pas encore chargé) */}
      <style>{`
        @keyframes saisiemasterPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes saisiemasterSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes saisiemasterLoaderBar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        @keyframes saisiemasterBounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
