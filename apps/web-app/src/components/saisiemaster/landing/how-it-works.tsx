"use client";

import {
  Download,
  Upload,
  PencilLine,
  FileCheck2,
} from "lucide-react";

const STEPS = [
  {
    icon: Download,
    title: "Téléchargez le template",
    description:
      "Connectez-vous à EducMaster, téléchargez le fichier Excel de saisie des notes correspondant à votre classe. Chaque école dispose de son template pré-rempli avec la liste des élèves.",
    color: "#0b3b6b",
    bg: "rgba(11, 59, 107, 0.08)",
  },
  {
    icon: Upload,
    title: "Importez dans SaisieMaster",
    description:
      "Glissez-déposez le fichier .xlsx dans SaisieMaster. L'application détecte automatiquement la classe, la liste des élèves, les matières et la structure des colonnes (note obtenue, note de perfectionnement).",
    color: "#008751",
    bg: "rgba(0, 135, 81, 0.08)",
  },
  {
    icon: PencilLine,
    title: "Saisissez les notes",
    description:
      "Remplissez les notes dans un tableau interactif pensé pour les enseignants : navigation clavier fluide, validation automatique (Note obtenue /18, Note perfectionnement /02), moyennes en temps réel, auto-save.",
    color: "#fcd116",
    bg: "rgba(252, 209, 22, 0.15)",
  },
  {
    icon: FileCheck2,
    title: "Exportez au format EducMaster",
    description:
      "Téléchargez le fichier final, identique au template d'origine (cellules fusionnées, en-têtes préservés). Il ne vous reste qu'à le réimporter dans EducMaster — aucune retouche nécessaire.",
    color: "#e31b23",
    bg: "rgba(227, 27, 35, 0.08)",
  },
];

export function HowItWorks() {
  return (
    <section id="fonctionnement" className="py-16 sm:py-24 bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#008751]">
            Processus
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            De EducMaster à EducMaster, en 4 étapes
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Un parcours pensé pour les directeurs d'école et les enseignants —
            simple, rapide et sans risque d'altération du format officiel.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="relative rounded-2xl border border-border bg-background p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="absolute -top-3 -right-3 grid place-items-center h-8 w-8 rounded-full bg-foreground text-background text-xs font-bold">
                  {idx + 1}
                </div>
                <div
                  className="grid place-items-center h-12 w-12 rounded-xl mb-4"
                  style={{ background: step.bg }}
                >
                  <Icon className="h-6 w-6" style={{ color: step.color }} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
