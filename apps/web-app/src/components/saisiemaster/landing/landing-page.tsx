"use client";

import { useRef } from "react";
import { Navbar } from "./navbar";
import { Hero } from "./hero";
import { UploadZone } from "./upload-zone";
import { HowItWorks } from "./how-it-works";
import { AcademiaHelmCta } from "./academia-helm-cta";
import { Footer } from "./footer";
import { ResumeBanner } from "./resume-banner";
import {
  useSaisieMasterStore,
  selectIsAuthenticated,
} from "@/lib/saisiemaster/store";

export function LandingPage() {
  const uploadRef = useRef<HTMLDivElement>(null);
  const setView = useSaisieMasterStore((s) => s.setView);
  const setAuthView = useSaisieMasterStore((s) => s.setAuthView);
  const isAuthenticated = useSaisieMasterStore(selectIsAuthenticated);

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

            <ResumeBanner onResume={handleResume} />

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

        {/* Section À propos / FAQ légère */}
        <section id="a-propos" className="py-16 sm:py-24 bg-card border-t border-border">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#008751]">
                À propos
              </span>
              <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                Un outil indépendant, au service des écoles béninoises
              </h2>
            </div>

            <div className="prose prose-sm sm:prose-base max-w-none text-muted-foreground space-y-4">
              <p>
                SaisieMaster est une application web indépendante conçue pour
                faciliter la tâche des directeurs d&apos;école et enseignants qui
                doivent remplir le template Excel officiel EducMaster du
                gouvernement béninois. Elle n&apos;est pas affiliée à EducMaster :
                c&apos;est un outil complémentaire qui préserve strictement le
                format d&apos;import/export exigé par la plateforme.
              </p>
              <p>
                Vos saisies sont automatiquement sauvegardées sur votre compte
                gratuit SaisieMaster pour que vous puissiez les reprendre à tout
                moment, sur n&apos;importe quel appareil. Vos listes d&apos;élèves
                et leurs notes restent strictement privées.
              </p>
              <p>
                L&apos;interface adopte les couleurs nationales du Bénin (vert, jaune,
                rouge) en hommage au contexte éducatif du pays, et reprend les codes
                visuels d&apos;EducMaster pour une intégration cohérente.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
