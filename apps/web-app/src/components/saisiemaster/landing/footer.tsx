"use client";

import { LogoWithHalo } from "@/components/saisiemaster/brand/logo-with-halo";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-card">
      <div className="h-1 w-full saisiemaster-tricolor" aria-hidden />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-3">
            {/* ⭐ Logo agrandi avec halo tricolore animé */}
            <LogoWithHalo size="lg" />
            <p className="text-sm text-muted-foreground max-w-xs">
              Saisie intelligente des notes scolaires au Bénin. Conforme au format
              officiel EducMaster du gouvernement.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Ressources</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#fonctionnement" className="hover:text-foreground transition-colors">
                  Comment ça marche
                </a>
              </li>
              <li>
                <a href="#temoignages" className="hover:text-foreground transition-colors">
                  Témoignages
                </a>
              </li>
              <li>
                <a href="#a-propos" className="hover:text-foreground transition-colors">
                  À propos
                </a>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Conformité</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Format EducMaster officiel</li>
              <li>Couleurs nationales du Bénin</li>
              <li>Données 100% locales (aucun envoi serveur)</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground">
          <p className="flex items-center">
            Copyright 2026 SaisieMaster — YEHI OR Tech
            <img
              src="/images/logo YEHI OR Tech 4.png"
              alt="YEHI OR Tech"
              className="h-10 inline-block ml-2"
            />
          </p>
          <p className="text-[11px]">
            Non affilié à EducMaster — Outil indépendant de saisie
          </p>
        </div>
      </div>
    </footer>
  );
}
