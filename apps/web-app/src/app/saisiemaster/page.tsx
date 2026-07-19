"use client";

import { useEffect, useRef, useState } from "react";
import { LandingPage } from "@/components/saisiemaster/landing/landing-page";
import { EditorPage } from "@/components/saisiemaster/editor/editor-page";
import { AuthScreen } from "@/components/saisiemaster/auth/auth-screen";
import SaisieMasterLoader from "@/components/saisiemaster/SaisieMasterLoader";
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
  // au moins 5 secondes (même durée que le loader Academia Helm).
  // Sans cela, le loading disparaît trop vite car la page est 100%
  // client-side (pas de requête serveur à attendre).
  //
  // ⚠️ En Next.js App Router, le fichier loading.tsx ne s'affiche QUE
  // pendant le suspense de la page. Comme cette page est "use client" et
  // ne fait pas de requête serveur, loading.tsx est démonté presque
  // immédiatement. Pour garder le loader visible 5s, on l'affiche
  // DIRECTEMENT dans la page (au lieu de retourner null).
  const [minLoadElapsed, setMinLoadElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinLoadElapsed(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Hydrate auth from localStorage + restore any saved classes (auto-save).
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    // Hydrate auth first (synchronous — reads from localStorage).
    hydrateAuth();
    const isAuth =
      useSaisieMasterStore.getState().prospect !== null &&
      useSaisieMasterStore.getState().token !== null;

    // Restore any saved classes from localStorage.
    const restored = restoreFromStorage();
    const hasRestoredClasses = !!(restored && restored.classes.length > 0);
    if (hasRestoredClasses) {
      useSaisieMasterStore.setState({
        classes: restored!.classes,
        activeClassIndex: Math.min(
          restored!.activeClassIndex,
          restored!.classes.length - 1,
        ),
      });
    }

    // ⭐ Utilisateur authentifié → TOUJOURS aller à l'éditeur (l'application
    // proprement dite), jamais sur la landing page marketing.
    //   - Si des classes sont restaurées → vue "notes" (saisie directe)
    //   - Sinon → vue "classes" (UI d'import pour charger un template)
    if (isAuth) {
      useSaisieMasterStore.setState({
        view: "editor",
        editorView: hasRestoredClasses ? "notes" : "classes",
      });
    }
  }, [hydrateAuth]);

  // Gestion du scroll lors du changement de vue
  useEffect(() => {
    if (view === "editor" || view === "auth") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [view]);

  // ⭐ L'utilisateur authentifié peut ALLER sur la landing page S'IL LE
  // SOUHAITE explicitement (bouton Home). L'auto-redirect a été supprimé
  // car il empêchait le bouton Home de fonctionner — l'utilisateur
  // cliquait sur Home, view passait à "landing", puis l'effet le
  // renvoyait immédiatement à "editor".
  // L'initial routing au montage est déjà géré par l'effet de restauration
  // ci-dessus (qui envoie les users authentifiés vers l'éditeur au load).

  // --- Auth flow ---
  // ⭐ Après une connexion réussie, on envoie TOUJOURS l'utilisateur dans
  // l'application (éditeur). S'il n'a pas encore de classes, on bascule
  // directement sur la vue "classes" qui contient l'UI d'import.
  const handleAuthSuccess = (prospect: Prospect, token: string) => {
    setAuth(prospect, token);
    const hasClasses = useSaisieMasterStore.getState().classes.length > 0;
    useSaisieMasterStore.setState({
      view: "editor",
      editorView: hasClasses ? "notes" : "classes",
    });
  };

  // ⭐ Tant que le délai minimum n'est pas écoulé, on affiche le loader
  // DIRECTEMENT (et non `null`) car loading.tsx est déjà démonté.
  if (!minLoadElapsed) {
    return <SaisieMasterLoader />;
  }

  if (view === "auth" && !isAuthenticated) {
    return <AuthScreen onSuccess={handleAuthSuccess} />;
  }

  // ⭐ Utilisateur authentifié → éditeur (l'application), peu importe qu'il
  // ait ou non des classes. L'éditeur gère les deux cas :
  //   - avec classes  → vue "notes" (saisie)
  //   - sans classes  → vue "classes" (import)
  if (view === "editor" && isAuthenticated) {
    return <EditorPage onHome={() => setView("landing")} />;
  }

  // Utilisateur non authentifié → landing page marketing.
  return <LandingPage />;
}
