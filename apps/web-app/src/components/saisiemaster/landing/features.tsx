"use client";

import {
  Keyboard,
  Calculator,
  ShieldCheck,
  Save,
  LayoutGrid,
  Palette,
  FileDown,
  Eye,
} from "lucide-react";

const FEATURES = [
  {
    icon: LayoutGrid,
    title: "Tableau interactif intelligent",
    description:
      "En-têtes figés, colonnes groupées par matière, sous-colonnes Note obtenue / Note perfectionnement visibles d'un coup d'œil. Conçu pour la lisibilité.",
    color: "#008751",
  },
  {
    icon: Keyboard,
    title: "Saisie clavier fluide",
    description:
      "Navigation Tab/Entrée/Flèches, validation à la volée, passage automatique à la cellule suivante. Saisissez 30 élèves en moins de 5 minutes.",
    color: "#0b3b6b",
  },
  {
    icon: Calculator,
    title: "Calculs automatiques",
    description:
      "Moyennes par élève et par matière calculées en temps réel. Statistiques de complétion visibles à chaque instant (X% de cellules remplies).",
    color: "#fcd116",
  },
  {
    icon: ShieldCheck,
    title: "Validation intelligente",
    description:
      "Notes obtenues limitées à /18 (ou /20), notes de perfectionnement /02. Alertes colorées en cas de dépassement ou d'incohérence.",
    color: "#e31b23",
  },
  {
    icon: Save,
    title: "Auto-save localStorage",
    description:
      "Vos saisies sont sauvegardées automatiquement dans votre navigateur. En cas de fermeture accidentelle, reprenez exactement où vous étiez.",
    color: "#008751",
  },
  {
    icon: FileDown,
    title: "Export 100% conforme",
    description:
      "Le fichier généré respecte strictement le format EducMaster : cellules fusionnées, en-têtes à 2 lignes, matricules préservés. Import direct, sans retouche.",
    color: "#0b3b6b",
  },
  {
    icon: Eye,
    title: "Multi-classes",
    description:
      "Si votre template contient plusieurs feuilles (CI, CP, CE1…), basculez entre elles instantanément via un sélecteur dédié.",
    color: "#fcd116",
  },
  {
    icon: Palette,
    title: "Design béninois",
    description:
      "Interface professionnelle aux couleurs nationales du Bénin (vert, jaune, rouge) et à l'identité visuelle d'EducMaster. Mode clair/sombre.",
    color: "#e31b23",
  },
];

export function Features() {
  return (
    <section id="fonctionnalites" className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#008751]">
            Fonctionnalités
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Tout ce qu&apos;il faut pour saisir vite et bien
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Une suite d&apos;outils pensés par et pour les acteurs du système
            éducatif béninois, avec un seul objectif : vous faire gagner du temps
            sans compromettre la conformité.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-[#008751]/40 hover:shadow-md hover:-translate-y-0.5"
              >
                <div
                  className="grid place-items-center h-10 w-10 rounded-lg mb-3 transition-transform group-hover:scale-110"
                  style={{
                    background: `${f.color}15`,
                    color: f.color,
                  }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground text-sm mb-1.5">
                  {f.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {f.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
