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
      {/* ⭐ Image de fond — desktop/tablette (1717x916, ratio 1.875:1)
          Utilise aspect-ratio pour que la hauteur s'adapte automatiquement
          au ratio de l'image. L'image est affichée EN ENTIER (bg-contain)
          sans zoom ni crop.

          Pour 100vw de large :
          - 1920px → 1024px de hauteur (1920/1.875)
          - 1280px → 683px de hauteur

          On ajoute un padding-bottom pour les boutons en plus de l'image. */}
      <div
        className="relative w-full hidden sm:block"
        style={{ aspectRatio: '1717 / 916' }}
      >
        <div
          className="absolute inset-0 bg-contain bg-top bg-no-repeat"
          style={{
            backgroundImage: 'url("/images/Background-SaisieMaster-hero.png")',
            backgroundColor: '#0B3B6B',
          }}
          aria-hidden
        />
      </div>

      {/* ⭐ Image de fond — mobile (853x1844, ratio 0.4625:1 portrait)
          ratio très portrait → la hauteur fait ~2.16× la largeur.
          Pour 375px de large → ~810px de hauteur. */}
      <div
        className="relative w-full sm:hidden"
        style={{ aspectRatio: '853 / 1844' }}
      >
        <div
          className="absolute inset-0 bg-contain bg-top bg-no-repeat"
          style={{
            backgroundImage: 'url("/images/Background-SaisieMaster-hero-mobile.png")',
            backgroundColor: '#0B3B6B',
          }}
          aria-hidden
        />
      </div>

      {/* Boutons d'action — positionnés en absolu par-dessus l'image,
          en bas du hero. On utilise un conteneur relatif avec padding
          pour les positionner au-dessus du bas de l'image. */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center pb-8 sm:pb-12 px-4">
        <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-7xl">
          <Button
            size="lg"
            onClick={onUploadClick}
            className="h-12 px-6 text-base shadow-md hover:shadow-lg transition-shadow bg-[#0D6EFD] hover:bg-[#0D6EFD]/90 text-white"
          >
            <FileSpreadsheet className="h-5 w-5" />
            Importer un template
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-6 text-base bg-white/90 backdrop-blur" asChild>
            <a href="#fonctionnement">Voir comment ça marche</a>
          </Button>
        </div>
      </div>
    </section>
  );
}
