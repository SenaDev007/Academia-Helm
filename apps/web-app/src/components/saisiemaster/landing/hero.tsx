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
          bg-cover pour que l'image prenne TOUTE la largeur du hero.
          La hauteur du conteneur est augmentée ci-dessous pour que toute
          l'image soit visible sans crop vertical. */}
      <div
        className="absolute inset-0 hidden sm:block bg-cover bg-top"
        style={{
          backgroundImage: 'url("/images/Background-SaisieMaster-hero.png")',
          backgroundColor: '#0B3B6B',
        }}
        aria-hidden
      />
      {/* Image de fond — mobile (853x1844, ratio ~0.46:1 portrait)
          bg-cover pour prendre toute la largeur. */}
      <div
        className="absolute inset-0 sm:hidden bg-cover bg-top"
        style={{
          backgroundImage: 'url("/images/Background-SaisieMaster-hero-mobile.png")',
          backgroundColor: '#0B3B6B',
        }}
        aria-hidden
      />

      {/* ⭐ Conteneur — hauteur augmentée pour que l'image (bg-cover) soit
          entièrement visible. Comme l'image desktop fait 1717x916 (ratio
          1.88:1), pour qu'elle couvre toute la largeur d'un écran 1920px
          sans être cropée verticalement, il faut ~1020px de hauteur.
          On prend min-h-[1020px] sur desktop.
          Mobile : l'image 853x1844 (ratio 0.46) couvre toute la largeur
          d'un écran 375px → ~810px de hauteur nécessaire. On prend
          min-h-[820px] mobile. */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-h-[820px] sm:min-h-[1020px] flex items-end justify-center pb-12 sm:pb-16">
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
