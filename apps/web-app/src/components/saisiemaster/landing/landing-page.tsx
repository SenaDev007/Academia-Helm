"use client";

import { useRef, useState } from "react";
import { Navbar } from "./navbar";
import { Hero } from "./hero";
import { UploadZone } from "./upload-zone";
import { HowItWorks } from "./how-it-works";
import { AcademiaHelmCta } from "./academia-helm-cta";
import { Testimonials } from "./testimonials";
import { Footer } from "./footer";
import { FeedbackModal } from "@/components/saisiemaster/editor/feedback-modal";
import {
  useSaisieMasterStore,
  selectIsAuthenticated,
} from "@/lib/saisiemaster/store";

export function LandingPage() {
  const uploadRef = useRef<HTMLDivElement>(null);
  const setView = useSaisieMasterStore((s) => s.setView);
  const setAuthView = useSaisieMasterStore((s) => s.setAuthView);
  const isAuthenticated = useSaisieMasterStore(selectIsAuthenticated);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const scrollToUpload = () => {
    if (!isAuthenticated) {
      // Not authed → trigger the auth flow first (signup mode by default).
      setAuthView("signup");
      return;
    }
    uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleResume = () => {
    setView("editor");
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      <Navbar onStart={scrollToUpload} />
      <main className="flex-1">
        <Hero onUploadClick={scrollToUpload} />

        <section id="demarrer" className="py-16 sm:py-24 bg-card border-y border-border">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#008751]">
                Démarrage
              </span>
              <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                Importez votre template EducMaster
              </h2>
              <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto">
                Téléchargez le fichier Excel depuis EducMaster correspondant à votre
                classe, puis déposez-le ci-dessous pour commencer la saisie.
              </p>
            </div>

            {/* ⭐ ResumeBanner supprimé — il s'affichait même quand l'utilisateur
                était déconnecté (basé sur localStorage), ce qui créait une
                confusion. L'utilisateur ne doit pas voir "Reprise possible"
                sur la landing publique. */}

            <div ref={uploadRef} className="scroll-mt-32">
              <UploadZone />
            </div>
          </div>
        </section>

        <HowItWorks />
        {/* Section "Features" retirée — la section Academia Helm CTA ci-dessous
            présente déjà les modules complémentaires. */}

        {/* Section marketing Academia Helm — ~25% de la landing */}
        <AcademiaHelmCta />

        {/* Section témoignages utilisateurs */}
        <Testimonials onGiveFeedback={() => setFeedbackOpen(true)} />

        {/* ⭐ Section "À propos" supprimée sur demande utilisateur —
            le contenu institutionnel est déjà couvert par la section
            Démarrage et la section témoignages. */}
      </main>
      <Footer />

      {/* Modal de témoignage (utilisateur authentifié) */}
      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
