/**
 * Logo SaisieMaster — image officielle de la marque.
 *
 * Affiche le logo SaisieMaster (fichier PNG) avec une hauteur responsive.
 * Si une `className` est fournie, elle est utilisée telle quelle (ex: "h-8").
 * Sinon, on applique une hauteur par défaut cohérente avec l'ancien size="md".
 *
 * Les props `size` et `showText` sont conservées pour rétro-compatibilité
 * mais n'ont plus d'effet visuel : le logo est désormais une image unique.
 */

import { cn } from "@/lib/saisiemaster/utils";

interface LogoProps {
  /** Conservé pour rétro-compatibilité — n'a plus d'effet visuel. */
  size?: "sm" | "md" | "lg";
  /** Conservé pour rétro-compatibilité — n'a plus d'effet visuel. */
  showText?: boolean;
  /** Classe CSS optionnelle (ex: "h-8", "h-10 w-auto"). */
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <img
      src="/images/Logo-SaisieMaster.png"
      alt="SaisieMaster"
      className={cn("h-8 w-auto", className)}
    />
  );
}
