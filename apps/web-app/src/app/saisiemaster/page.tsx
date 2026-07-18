"use client";

import { useEffect, useRef } from "react";
import { LandingPage } from "@/components/saisiemaster/landing/landing-page";
import { EditorPage } from "@/components/saisiemaster/editor/editor-page";
import { useSaisieMasterStore, restoreFromStorage } from "@/lib/saisiemaster/store";

export default function SaisieMasterPage() {
  const view = useSaisieMasterStore((s) => s.view);
  const setView = useSaisieMasterStore((s) => s.setView);
  const classes = useSaisieMasterStore((s) => s.classes);
  const hasRestoredRef = useRef(false);

  // Restauration auto au montage (si session précédente en localStorage)
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    const restored = restoreFromStorage();
    if (restored && restored.classes.length > 0) {
      // On ne restaure que les données, pas la vue — l'utilisateur choisit
      useSaisieMasterStore.setState({
        classes: restored.classes,
        activeClassIndex: Math.min(
          restored.activeClassIndex,
          restored.classes.length - 1,
        ),
      });
    }
  }, []);

  // Gestion du scroll lors du changement de vue
  useEffect(() => {
    if (view === "editor") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [view]);

  // Si on est sur la vue éditeur mais qu'il n'y a plus de classes, retour landing
  useEffect(() => {
    if (view === "editor" && classes.length === 0) {
      setView("landing");
    }
  }, [view, classes.length, setView]);

  if (view === "editor" && classes.length > 0) {
    return <EditorPage onHome={() => setView("landing")} />;
  }

  return <LandingPage />;
}
