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
          sans zoom ni crop. */}
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
        {/* ⭐ Boutons OVERLAY sur l'image (en bas, centrés) */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center pb-6 sm:pb-8 px-4">
          <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-3xl">
            <Button
              size="lg"
              onClick={onUploadClick}
              className="h-12 px-6 text-base shadow-xl hover:shadow-2xl transition-shadow bg-[#0D6EFD] hover:bg-[#0D6EFD]/90 text-white"
            >
              <FileSpreadsheet className="h-5 w-5" />
              Importer un template
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-6 text-base bg-white/95 backdrop-blur shadow-lg" asChild>
              <a href="#fonctionnement">Voir comment ça marche</a>
            </Button>
          </div>
        </div>
      </div>

      {/* ⭐ Image de fond — mobile (853x1844, ratio 0.4625:1 portrait) */}
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
        {/* ⭐ Boutons OVERLAY sur l'image (en bas, centrés) */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-center pb-6 px-4">
          <div className="flex flex-wrap items-center justify-center gap-3 w-full">
            <Button
              size="lg"
              onClick={onUploadClick}
              className="h-12 px-5 text-base shadow-xl hover:shadow-2xl transition-shadow bg-[#0D6EFD] hover:bg-[#0D6EFD]/90 text-white"
            >
              <FileSpreadsheet className="h-5 w-5" />
              Importer un template
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-5 text-base bg-white/95 backdrop-blur shadow-lg" asChild>
              <a href="#fonctionnement">Voir comment ça marche</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
