"use client";

import { cn } from "@/lib/saisiemaster/utils";

interface LogoWithHaloProps {
  /** Taille du logo (le halo fait 1.55× cette taille). */
  size?: "sm" | "md" | "lg" | "xl";
  /** Classe optionnelle (marges, positionnement). */
  className?: string;
  /** Si true, utilise le logo SaisieMaster. Sinon, logo SaisieMaster par défaut. */
  src?: string;
  /** Alt text. */
  alt?: string;
}

/**
 * Logo SaisieMaster avec halo circulaire animé aux 3 couleurs du Bénin.
 *
 * Le halo tourne autour du logo en conic-gradient (vert → jaune → rouge),
 * avec une légère pulsation jaune floutée pour un effet vivant.
 *
 * Utilisé dans la navbar et le footer de la landing page SaisieMaster.
 *
 * Animations définies inline (this component is self-contained, no globals.css
 * dependency) — référence les keyframes `saisiemasterHaloSpin` et
 * `saisiemasterHaloPulse` qui sont injectées via une balise <style>.
 */
export function LogoWithHalo({
  size = "md",
  className,
  src = "/images/Logo-SaisieMaster.webp",
  alt = "SaisieMaster",
}: LogoWithHaloProps) {
  const dim =
    size === "xl" ? "64px" : size === "lg" ? "52px" : size === "md" ? "44px" : "36px";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      {/* Halo extérieur — conic-gradient tricolore qui tourne */}
      <div
        className="absolute rounded-full"
        style={{
          width: `calc(${dim} * 1.55)`,
          height: `calc(${dim} * 1.55)`,
          left: `calc((${dim} - ${dim} * 1.55) / 2)`,
          top: `calc((${dim} - ${dim} * 1.55) / 2)`,
          background:
            "conic-gradient(from 0deg, #008751 0deg 120deg, #FCD116 120deg 240deg, #E31B23 240deg 360deg)",
          animation: "saisiemasterHaloSpin 6s linear infinite",
          maskImage: "radial-gradient(transparent 56%, black 58%, black 100%)",
          WebkitMaskImage: "radial-gradient(transparent 56%, black 58%, black 100%)",
          opacity: 0.85,
        }}
        aria-hidden
      />

      {/* Halo de pulsation (couleur jaune, flou) */}
      <div
        className="absolute rounded-full bg-[#FCD116]/20 blur-md"
        style={{
          width: `calc(${dim} * 1.35)`,
          height: `calc(${dim} * 1.35)`,
          left: `calc((${dim} - ${dim} * 1.35) / 2)`,
          top: `calc((${dim} - ${dim} * 1.35) / 2)`,
          animation: "saisiemasterHaloPulse 3s ease-in-out infinite",
        }}
        aria-hidden
      />

      {/* Logo central — cercle blanc avec image */}
      <div
        className="relative rounded-full overflow-hidden border-2 border-white shadow-md bg-white flex items-center justify-center"
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
        @keyframes saisiemasterHaloPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
