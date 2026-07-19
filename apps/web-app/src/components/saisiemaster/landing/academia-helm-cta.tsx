"use client";

/**
 * Section marketing "Découvrez Academia Helm".
 *
 * Présente la plateforme mère Academia Helm aux utilisateurs de SaisieMaster,
 * en mettant en avant 6 modules complémentaires.
 *
 * ⭐ Nouveautés :
 *  - Logo Academia Helm en filigrane (watermark) au-dessus des cartes
 *  - Les 2 boutons CTA ("Découvrir Academia Helm" et "Demander une démo
 *    gratuite") ont été supprimés sur demande utilisateur.
 *
 * Accent visuel : couleurs nationales du Bénin (vert #008751, jaune #FCD116, rouge #E31B23).
 */

import {
  BarChart3,
  Users,
  ClipboardCheck,
  MessageSquare,
  GraduationCap,
  Building2,
  ExternalLink,
} from "lucide-react";

interface AcademiaFeature {
  /** Icône Lucide représentant le module. */
  icon: typeof BarChart3;
  title: string;
  description: string;
  /** Couleur d'accent issue du drapeau béninois. */
  accent: string;
  /** Fond pastel associé à l'accent. */
  bg: string;
}

const FEATURES: AcademiaFeature[] = [
  {
    icon: BarChart3,
    title: "Gestion financière",
    description:
      "Suivi des frais de scolarité, encaissements, dépenses, multi-caisses.",
    accent: "#008751",
    bg: "rgba(0, 135, 81, 0.08)",
  },
  {
    icon: Users,
    title: "Gestion des élèves",
    description:
      "Inscriptions, dossiers, cartes scolaires, transferts.",
    accent: "#0D6EFD",
    bg: "rgba(13, 110, 253, 0.08)",
  },
  {
    icon: ClipboardCheck,
    title: "Examens & Bulletins",
    description:
      "Saisie des notes, calcul des moyennes, bulletins PDF.",
    accent: "#FCD116",
    bg: "rgba(252, 209, 22, 0.14)",
  },
  {
    icon: MessageSquare,
    title: "Communication",
    description:
      "SMS, emails, WhatsApp aux parents.",
    accent: "#E31B23",
    bg: "rgba(227, 27, 35, 0.08)",
  },
  {
    icon: GraduationCap,
    title: "RH & Personnel",
    description:
      "Contrats, paie, absences, congés.",
    accent: "#008751",
    bg: "rgba(0, 135, 81, 0.08)",
  },
  {
    icon: Building2,
    title: "Site institutionnel",
    description:
      "Site web personnalisé pour votre école.",
    accent: "#0D6EFD",
    bg: "rgba(13, 110, 253, 0.08)",
  },
];

export function AcademiaHelmCta() {
  return (
    <section
      id="academia-helm"
      className="relative py-16 sm:py-24 bg-background overflow-hidden"
    >
      {/* Bande tricolore Bénin en haut de la section */}
      <div className="h-1 w-full saisiemaster-tricolor" aria-hidden />

      {/* Halos décoratifs aux couleurs du Bénin */}
      <div
        className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-[#008751]/10 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#fcd116]/15 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute top-1/3 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#e31b23]/8 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ⭐ Logo Academia Helm en filigrane (watermark) au-dessus des cartes */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            {/* Halo lumineux derrière le logo */}
            <div
              className="absolute inset-0 -m-6 rounded-full bg-[#0D1F6E]/8 blur-2xl"
              aria-hidden
            />
            <img
              src="https://www.academiahelm.com/images/logo-Academia%20Hub.png"
              alt="Academia Helm"
              className="relative h-20 sm:h-24 w-auto opacity-30 hover:opacity-50 transition-opacity duration-500 object-contain"
              style={{
                filter: "grayscale(20%)",
              }}
              aria-hidden
            />
          </div>
        </div>

        {/* En-tête */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#008751]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#e31b23]" />
            Découvrez Academia Helm
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#fcd116]" />
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-tight">
            Besoin de plus qu&apos;une simple{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-[#008751]">saisie de notes</span>
              <span className="absolute bottom-1 left-0 right-0 h-3 bg-[#fcd116]/60 -z-0" />
            </span>{" "}
            ?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">
            <span className="font-semibold text-foreground">Academia Helm</span>{" "}
            gère <span className="font-semibold">TOUT</span> votre établissement
            scolaire
          </p>
        </div>

        {/* Grille des 6 fonctionnalités */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* Bande colorée en haut de la carte */}
                <div
                  className="absolute inset-x-0 top-0 h-1 rounded-t-2xl"
                  style={{ backgroundColor: feature.accent }}
                  aria-hidden
                />
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="grid place-items-center h-12 w-12 rounded-xl"
                    style={{ background: feature.bg }}
                    aria-hidden
                  >
                    <Icon
                      className="h-6 w-6 transition-transform group-hover:scale-110"
                      style={{ color: feature.accent }}
                    />
                  </div>
                </div>
                <h3 className="font-semibold text-foreground mb-2 text-lg">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* ⭐ Bouton "Découvrir Academia Helm" restauré avec la palette
            Academia Helm (navy #0D1F6E + accent doré #F5A623).
            Seul "Demander une démo gratuite" a été supprimé. */}
        <div className="mt-12 text-center space-y-4">
          <a
            href="https://academiahelm.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200"
            style={{
              background: "linear-gradient(135deg, #0D1F6E 0%, #1A3A8F 100%)",
              color: "#ffffff",
              border: "2px solid #F5A623",
            }}
          >
            Découvrir Academia Helm
            <ExternalLink className="h-5 w-5" style={{ color: "#F5A623" }} />
          </a>

          <p className="mt-3 text-xs text-muted-foreground">
            Academia Helm — La plateforme complète de gestion scolaire au Bénin
          </p>
        </div>
      </div>
    </section>
  );
}
