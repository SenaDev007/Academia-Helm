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
      {/* Image de fond — desktop/tablette */}
      <div
        className="absolute inset-0 bg-cover bg-top hidden sm:block"
        style={{
          backgroundImage: 'url("/images/Background-SaisieMaster-hero.png")',
        }}
        aria-hidden
      />
      {/* Image de fond — mobile (image dédiée pour le responsiv) */}
      <div
        className="absolute inset-0 bg-cover bg-top sm:hidden"
        style={{
          backgroundImage: 'url("/images/Background-SaisieMaster-hero-mobile.png")',
        }}
        aria-hidden
      />

      {/* Conteneur — hauteur plus grande pour voir l'image en entier.
          min-h-[900px] sur desktop, min-h-[760px] sur mobile.
          bg-top pour ancrer l'image en haut et révéler le bas. */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-h-[760px] sm:min-h-[900px] flex items-end justify-center pb-16 sm:pb-20">
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
