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
      {/* Image de fond — couvre toute la section */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url("/images/Background-SaisieMaster-hero.png")' }}
        aria-hidden
      />

      {/* Contenu — uniquement les boutons, tout le reste est dans l'image de fond */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
        <div className="flex flex-col items-center justify-center gap-4 pt-8">
          <div className="flex flex-wrap items-center justify-center gap-3">
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
      </div>
    </section>
  );
}
