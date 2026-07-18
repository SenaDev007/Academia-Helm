"use client";

import { Logo } from "@/components/saisiemaster/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  FileSpreadsheet,
  Shield,
  Zap,
  Sparkles,
} from "lucide-react";

interface HeroProps {
  onUploadClick: () => void;
}

export function Hero({ onUploadClick }: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      {/* Image de fond + overlay dégradé pour la lisibilité du texte */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url("/images/Background-SaisieMaster-hero.png")' }}
        aria-hidden
      />
      {/* Overlay dégradé : assombrit légèrement le fond pour que le texte blanc/lisible ressorte,
          tout en conservant l'esprit lumineux du hero. */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-white/90 via-white/75 to-white/60 dark:from-black/70 dark:via-black/55 dark:to-black/40"
        aria-hidden
      />
      {/* Halos colorés Bénin par-dessus */}
      <div
        className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#008751]/15 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#fcd116]/20 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Colonne gauche — pitch */}
          <div className="space-y-6 saisie-fade-in">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-[#008751]/30 bg-[#008751]/5 text-[#008751] gap-1.5"
              >
                <Sparkles className="h-3 w-3" />
                Conforme EducMaster
              </Badge>
              <Badge variant="outline" className="gap-1.5">
                <Shield className="h-3 w-3" />
                100% local — vos données restent chez vous
              </Badge>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
              Saisissez les notes de vos élèves en{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-[#008751]">toute fluidité</span>
                <span className="absolute bottom-1 left-0 right-0 h-3 bg-[#fcd116]/60 -z-0" />
              </span>
              <br />
              et exportez au format{" "}
              <span className="text-[#0b3b6b]">EducMaster</span>.
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Importez le template Excel téléchargé depuis la plateforme EducMaster,
              remplissez les notes par classe et par matière grâce à une interface
              pensée pour les enseignants, puis téléchargez un fichier prêt à être
              réimporté — sans altérer le format officiel.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                size="lg"
                onClick={onUploadClick}
                className="h-12 px-6 text-base shadow-md hover:shadow-lg transition-shadow"
              >
                <FileSpreadsheet className="h-5 w-5" />
                Importer un template
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-6 text-base" asChild>
                <a href="#fonctionnement">Voir comment ça marche</a>
              </Button>
            </div>

            <div className="flex items-center gap-6 pt-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#fcd116]" />
                <span>Installation instantanée</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#008751]" />
                <span>Aucune donnée envoyée</span>
              </div>
            </div>
          </div>

          {/* Colonne droite — mockup visuel */}
          <div className="relative saisie-fade-in" style={{ animationDelay: "120ms" }}>
            <HeroMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Mockup visuel d'une grille de saisie (non fonctionnel, purement décoratif). */
function HeroMockup() {
  const students = [
    { matricule: "2210426012748", nom: "BADJAGOU", prenoms: "Amandine" },
    { matricule: "2200426012749", nom: "BAGAN", prenoms: "Maroufatou" },
    { matricule: "1190426011827", nom: "BAH-GUESSERE", prenoms: "Fakile" },
  ];
  const subjects = ["Dictée", "Math", "Expression écr.", "EPS"];

  return (
    <div className="relative">
      {/* Carte flottante — en-tête */}
      <div className="absolute -top-6 -left-6 z-20 rounded-xl bg-card border border-border shadow-xl px-4 py-3 hidden sm:block">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#008751]" />
          <span className="text-xs font-medium text-muted-foreground">
            Classe CI — 7 élèves
          </span>
        </div>
      </div>

      {/* Carte flottante — stats */}
      <div className="absolute -bottom-6 -right-6 z-20 rounded-xl bg-card border border-border shadow-xl px-4 py-3 hidden sm:block">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center h-8 w-8 rounded-lg bg-[#fcd116]/20">
            <span className="text-xs font-bold text-[#008751]">85%</span>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Saisie
            </p>
            <p className="text-xs font-medium">12 / 14 cellules</p>
          </div>
        </div>
      </div>

      {/* Tableau principal */}
      <div className="relative z-10 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="h-1 w-full saisiemaster-tricolor" />
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <Logo size="sm" />
          <Badge variant="secondary" className="text-[10px]">
            Aperçu
          </Badge>
        </div>
        <div className="overflow-x-auto saisiemaster-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left font-medium px-3 py-2 text-xs text-muted-foreground">
                  Matricule
                </th>
                <th className="text-left font-medium px-3 py-2 text-xs text-muted-foreground">
                  Nom
                </th>
                {subjects.map((s) => (
                  <th
                    key={s}
                    className="text-center font-medium px-3 py-2 text-xs text-muted-foreground"
                  >
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((stu, idx) => (
                <tr key={stu.matricule} className={idx % 2 === 0 ? "bg-card" : "bg-muted/30"}>
                  <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">
                    {stu.matricule.slice(0, 10)}…
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium">
                    {stu.nom}
                    <span className="block text-[10px] text-muted-foreground font-normal">
                      {stu.prenoms}
                    </span>
                  </td>
                  {subjects.map((s, sIdx) => {
                    const value = [14, 16, 12, 18][sIdx];
                    return (
                      <td key={s} className="px-3 py-2.5 text-center">
                        <span
                          className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-md text-xs font-medium border"
                          style={{
                            backgroundColor:
                              value >= 14 ? "rgba(0,135,81,0.08)" : "rgba(252,209,22,0.12)",
                            borderColor:
                              value >= 14 ? "rgba(0,135,81,0.3)" : "rgba(252,209,22,0.4)",
                            color: value >= 14 ? "#008751" : "#8a6d0b",
                          }}
                        >
                          {value}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
