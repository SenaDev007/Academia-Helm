/**
 * Logo SaisieMaster — combinaison d'une icône (livre + stylo stylisé)
 * et du nom de marque, avec touches tricolores du Bénin.
 */

import { cn } from "@/lib/saisiemaster/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const dims = {
    sm: { box: "h-7 w-7", icon: 16, text: "text-base" },
    md: { box: "h-9 w-9", icon: 20, text: "text-lg" },
    lg: { box: "h-12 w-12", icon: 28, text: "text-2xl" },
  }[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "relative grid place-items-center rounded-lg shadow-sm overflow-hidden",
          dims.box,
        )}
        aria-hidden
      >
        {/* Fond vert Bénin */}
        <div className="absolute inset-0 bg-[#008751]" />
        {/* Bande tricolore verticale à gauche */}
        <div className="absolute inset-y-0 left-0 w-1/4 saisiemaster-tricolor-vertical opacity-90" />
        {/* Icône stylisée : livre ouvert */}
        <svg
          width={dims.icon}
          height={dims.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="relative z-10 drop-shadow-sm"
        >
          <path d="M3 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H3z" />
          <path d="M21 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z" />
        </svg>
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              "font-bold tracking-tight text-foreground",
              dims.text,
            )}
          >
            Saisie<span className="text-[#008751]">Master</span>
          </span>
          {size === "lg" && (
            <span className="text-[11px] text-muted-foreground tracking-wide mt-0.5">
              Notes EducMaster
            </span>
          )}
        </div>
      )}
    </div>
  );
}
