/**
 * Logo SaisieMaster — image officielle de la marque.
 *
 * Affiche le logo SaisieMaster (fichier PNG) dans un cadre circulaire
 * avec une bordure verte subtile. La taille du cadre dépend de la prop
 * `size` :
 *   - "sm" → 36px (navbar compact)
 *   - "md" → 44px (footer, défaut)
 *   - "lg" → 56px (pages éditoriales)
 *
 * Si une `className` est fournie, elle est fusionnée (mais le cadre
 * circulaire reste prioritaire sur les dimensions via `size`).
 */

import { cn } from "@/lib/saisiemaster/utils";

interface LogoProps {
  /** Taille du cadre circulaire. */
  size?: "sm" | "md" | "lg";
  /** Conservé pour rétro-compatibilité — n'a plus d'effet visuel. */
  showText?: boolean;
  /** Classe CSS optionnelle (ex: pour des overrides de marges). */
  className?: string;
}

export function Logo({ size = "md", className }: LogoProps) {
  const dim =
    size === "lg" ? "56px" : size === "md" ? "44px" : "36px";

  return (
    <div
      className={cn(
        "rounded-full overflow-hidden border-2 border-[#008751]/20 flex items-center justify-center bg-white",
        className,
      )}
      style={{ width: dim, height: dim }}
      aria-label="SaisieMaster"
    >
      <img
        src="/images/Logo-SaisieMaster.webp"
        alt="SaisieMaster"
        className="w-full h-full object-cover"
      />
    </div>
  );
}
