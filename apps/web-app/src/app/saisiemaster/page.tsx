"use client";

import { useEffect, useRef, useState } from "react";
import { LandingPage } from "@/components/saisiemaster/landing/landing-page";
import { EditorPage } from "@/components/saisiemaster/editor/editor-page";
import { AuthScreen } from "@/components/saisiemaster/auth/auth-screen";
import {
  useSaisieMasterStore,
  restoreFromStorage,
  selectIsAuthenticated,
} from "@/lib/saisiemaster/store";
import type { Prospect } from "@/lib/saisiemaster/api";

export default function SaisieMasterPage() {
  const view = useSaisieMasterStore((s) => s.view);
  const setView = useSaisieMasterStore((s) => s.setView);
  const classes = useSaisieMasterStore((s) => s.classes);
  const isAuthenticated = useSaisieMasterStore(selectIsAuthenticated);
  const hydrateAuth = useSaisieMasterStore((s) => s.hydrateAuth);
  const setAuth = useSaisieMasterStore((s) => s.setAuth);
  const hasRestoredRef = useRef(false);

  // ⭐ Délai minimum pour garantir que le loading page reste visible
  // au moins 2 secondes (même durée que le loader Academia Helm).
  // Sans cela, le loading disparaît trop vite car la page est 100%
  // client-side (pas de requête serveur à attendre).
  const [minLoadElapsed, setMinLoadElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinLoadElapsed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Hydrate auth from localStorage + restore any saved classes (auto-save).
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    hydrateAuth();

    const restored = restoreFromStorage();
    if (restored && restored.classes.length > 0) {
      useSaisieMasterStore.setState({
        classes: restored.classes,
        activeClassIndex: Math.min(
          restored.activeClassIndex,
          restored.classes.length - 1,
        ),
        view:
          useSaisieMasterStore.getState().prospect && restored.classes.length > 0
            ? "editor"
            : "landing",
      });
    }
  }, [hydrateAuth]);

  // Gestion du scroll lors du changement de vue
  useEffect(() => {
    if (view === "editor" || view === "auth") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [view]);

  // Si on est sur la vue éditeur mais qu'il n'y a plus de classes, retour landing
  useEffect(() => {
    if (view === "editor" && classes.length === 0) {
      setView("landing");
    }
  }, [view, classes.length, setView]);

  // --- Auth flow ---
  const handleAuthSuccess = (prospect: Prospect, token: string) => {
    setAuth(prospect, token);
    if (classes.length > 0) {
      setView("editor");
    } else {
      setView("landing");
    }
  };

  // ⭐ Ne rien rendre tant que le délai minimum n'est pas écoulé
  // → le loading.tsx (SaisieMasterLoader) reste visible pendant 2s
  if (!minLoadElapsed) {
    return null;
  }

  if (view === "auth" && !isAuthenticated) {
    return <AuthScreen onSuccess={handleAuthSuccess} />;
  }

  if (view === "editor" && classes.length > 0) {
    return <EditorPage onHome={() => setView("landing")} />;
  }

  return <LandingPage />;
}
