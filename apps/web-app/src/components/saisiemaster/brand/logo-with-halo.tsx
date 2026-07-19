"use client";

import { cn } from "@/lib/saisiemaster/utils";

interface LogoWithHaloProps {
  /** Taille du logo (le halo fait 1.15× cette taille — discret). */
  size?: "sm" | "md" | "lg" | "xl";
  /** Classe optionnelle (marges, positionnement). */
  className?: string;
  /** Si true, utilise le logo SaisieMaster. Sinon, logo SaisieMaster par défaut. */
  src?: string;
  /** Alt text. */
  alt?: string;
}

/**
 * Logo SaisieMaster avec halo tricolore LÉGER.
 *
 * Le halo est un anneau fin (1.15× la taille du logo) en conic-gradient
 * (vert → jaune → rouge) qui tourne lentement. Pas de pulsation, pas de
 * halo flou — un effet discret et professionnel.
 *
 * Utilisé dans la navbar et le footer de la landing page SaisieMaster.
 */
export function LogoWithHalo({
  size = "md",
  className,
  src = "/images/Logo-SaisieMaster.png",
  alt = "SaisieMaster",
}: LogoWithHaloProps) {
  const dim =
    size === "xl" ? "64px" : size === "lg" ? "52px" : size === "md" ? "44px" : "36px";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      {/* Halo — anneau fin tricolore qui tourne lentement */}
      <div
        className="absolute rounded-full"
        style={{
          width: `calc(${dim} * 1.18)`,
          height: `calc(${dim} * 1.18)`,
          left: `calc((${dim} - ${dim} * 1.18) / 2)`,
          top: `calc((${dim} - ${dim} * 1.18) / 2)`,
          background:
            "conic-gradient(from 0deg, #008751 0deg 120deg, #FCD116 120deg 240deg, #E31B23 240deg 360deg)",
          animation: "saisiemasterHaloSpin 8s linear infinite",
          maskImage: "radial-gradient(transparent 70%, black 72%, black 100%)",
          WebkitMaskImage: "radial-gradient(transparent 70%, black 72%, black 100%)",
          opacity: 0.6,
        }}
        aria-hidden
      />

      {/* Logo central — cercle blanc avec image */}
      <div
        className="relative rounded-full overflow-hidden border-2 border-white shadow-sm bg-white flex items-center justify-center"
        style={{ width: dim, height: dim, zIndex: 2 }}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Keyframes inline (self-contained) */}
      <style>{`
        @keyframes saisiemasterHaloSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
