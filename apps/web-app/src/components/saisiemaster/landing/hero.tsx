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
      {/* Image de fond — couvre toute la section.
          On utilise min-h-[600px] pour garantir une hauteur minimale
          qui laisse l'image de fond pleinement visible, sans être écrasée
          par le padding vertical. */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url("/images/Background-SaisieMaster-hero.png")',
          minHeight: 600,
        }}
        aria-hidden
      />

      {/* Conteneur flex qui pousse les CTA tout en bas du hero.
          min-h-[600px] garantit la pleine hauteur de l'image. */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 min-h-[600px] flex items-end justify-center pb-10 sm:pb-14">
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
