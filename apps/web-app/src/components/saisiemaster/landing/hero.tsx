"use client";

import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  FileSpreadsheet,
} from "lucide-react";

interface HeroProps {
  onUploadClick: () => void;
}

export function Hero({ onUploadClick }: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Image de fond — desktop/tablette (1717x916, ratio ~1.88:1)
          bg-contain pour afficher TOUTE l'image sans crop.
          bg-top pour ancrer en haut. */}
      <div
        className="absolute inset-0 hidden sm:block bg-no-repeat bg-contain bg-top"
        style={{
          backgroundImage: 'url("/images/Background-SaisieMaster-hero.png")',
          backgroundColor: '#0B3B6B',
        }}
        aria-hidden
      />
      {/* Image de fond — mobile (853x1844, ratio ~0.46:1 portrait)
          bg-contain pour afficher toute l'image sans crop. */}
      <div
        className="absolute inset-0 sm:hidden bg-no-repeat bg-contain bg-top"
        style={{
          backgroundImage: 'url("/images/Background-SaisieMaster-hero-mobile.png")',
          backgroundColor: '#0B3B6B',
        }}
        aria-hidden
      />

      {/* Conteneur — hauteur calculée pour englober toute l'image.
          Desktop: ratio 1.88:1 → pour 100vw on a ~53vh d'image.
          On prend min-h-[80vh] pour garantir que toute l'image + boutons tiennent.
          Mobile: ratio 0.46:1 (très portrait) → image fait ~2.16× la largeur
          en hauteur, soit sur 375px = ~810px. On prend min-h-[85vh]. */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-h-[85vh] sm:min-h-[80vh] flex items-end justify-center pb-12 sm:pb-16">
        <div className="flex flex-wrap items-center justify-center gap-3 w-full">
          <Button
            size="lg"
            onClick={onUploadClick}
            className="h-12 px-6 text-base shadow-md hover:shadow-lg transition-shadow"
          >
            <FileSpreadsheet className="h-5 w-5" />
            Importer un template
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-6 text-base bg-white/80 backdrop-blur" asChild>
            <a href="#fonctionnement">Voir comment ça marche</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
