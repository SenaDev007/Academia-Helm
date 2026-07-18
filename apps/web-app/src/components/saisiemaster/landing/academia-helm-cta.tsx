"use client";

import {
  Wallet,
  Users,
  ClipboardCheck,
  MessageSquare,
  Briefcase,
  Globe,
  ArrowRight,
} from "lucide-react";

/**
 * Section marketing "Découvrez Academia Helm".
 *
 * Présente la plateforme mère Academia Helm aux utilisateurs de SaisieMaster,
 * en mettant en avant 6 modules complémentaires et un CTA "Démo gratuite".
 * Accent visuel : couleurs nationales du Bénin (vert #008751, jaune #FCD116, rouge #E31B23).
 */

interface AcademiaFeature {
  icon: typeof Wallet;
  emoji: string;
  title: string;
  description: string;
  /** Couleur d'accent issue du drapeau béninois. */
  accent: string;
  /** Fond pastel associé à l'accent. */
  bg: string;
}

const FEATURES: AcademiaFeature[] = [
  {
    icon: Wallet,
    emoji: "📊",
    title: "Gestion financière",
    description:
      "Suivi des frais de scolarité, encaissements, dépenses, multi-caisses.",
    accent: "#008751",
    bg: "rgba(0, 135, 81, 0.08)",
  },
  {
    icon: Users,
    emoji: "👥",
    title: "Gestion des élèves",
    description:
      "Inscriptions, dossiers, cartes scolaires, transferts.",
    accent: "#0D6EFD",
    bg: "rgba(13, 110, 253, 0.08)",
  },
  {
    icon: ClipboardCheck,
    emoji: "📝",
    title: "Examens & Bulletins",
    description:
      "Saisie des notes, calcul des moyennes, bulletins PDF.",
    accent: "#FCD116",
    bg: "rgba(252, 209, 22, 0.14)",
  },
  {
    icon: MessageSquare,
    emoji: "💬",
    title: "Communication",
    description:
      "SMS, emails, WhatsApp aux parents.",
    accent: "#E31B23",
    bg: "rgba(227, 27, 35, 0.08)",
  },
  {
    icon: Briefcase,
    emoji: "👨‍🏫",
    title: "RH & Personnel",
    description:
      "Contrats, paie, absences, congés.",
    accent: "#008751",
    bg: "rgba(0, 135, 81, 0.08)",
  },
  {
    icon: Globe,
    emoji: "🏫",
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
                    className="grid place-items-center h-12 w-12 rounded-xl text-2xl"
                    style={{ background: feature.bg }}
                    aria-hidden
                  >
                    <span>{feature.emoji}</span>
                  </div>
                  <Icon
                    className="h-5 w-5 opacity-70 group-hover:opacity-100 transition-opacity"
                    style={{ color: feature.accent }}
                  />
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

        {/* CTA */}
        <div className="mt-12 text-center">
          <a
            href="https://academiahelm.com/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#008751] hover:bg-[#008751]/90 px-7 py-3.5 text-base font-semibold text-white shadow-md hover:shadow-lg transition-all duration-200"
          >
            Demander une démo gratuite
            <ArrowRight className="h-5 w-5" />
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            Academia Helm — La plateforme complète de gestion scolaire au Bénin
          </p>
        </div>
      </div>
    </section>
  );
}
