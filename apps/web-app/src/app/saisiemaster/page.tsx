"use client";

import { useEffect, useRef, useState } from "react";
import { LandingPage } from "@/components/saisiemaster/landing/landing-page";
import { EditorPage } from "@/components/saisiemaster/editor/editor-page";
import { AuthScreen } from "@/components/saisiemaster/auth/auth-screen";
import SaisieMasterLoader from "@/components/saisiemaster/SaisieMasterLoader";
import {
  useSaisieMasterStore,
  restoreFromStorage,
  restoreFromBackend,
  mergeClasses,
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
  const [backendRestoreDone, setBackendRestoreDone] = useState(false);

  // ⭐ Délai minimum pour garantir que le loading page reste visible
  // au moins 2.5 secondes (au lieu de 5s qui était trop long).
  const [minLoadElapsed, setMinLoadElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinLoadElapsed(true), 2500);
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

    // ⭐ FIX: Pour les utilisateurs authentifiés, on tente d'abord la
    //    restauration depuis le backend Neon (authoritative source — permet
    //    de retrouver les données saisies sur un AUTRE appareil).
    //    Fallback localStorage uniquement si le backend échoue ou est vide.
    //
    //    IMPORTANT : on charge d'abord les données localStorage pour afficher
    //    immédiatement l'éditeur (UX réactive), puis on tente le backend en
    //    arrière-plan et on remplace si le backend a des données plus récentes.
    const restoredLocal = restoreFromStorage();
    const hasRestoredClasses = !!(restoredLocal && restoredLocal.classes.length > 0);
    if (hasRestoredClasses) {
      useSaisieMasterStore.setState({
        classes: restoredLocal!.classes,
        activeClassIndex: Math.min(
          restoredLocal!.activeClassIndex,
          restoredLocal!.classes.length - 1,
        ),
      });
    }

    // ⭐ Utilisateur authentifié → TOUJOURS aller à l'éditeur
    if (isAuth) {
      useSaisieMasterStore.setState({
        view: "editor",
        editorView: hasRestoredClasses ? "notes" : "classes",
      });

      // ⭐ Tenter la restauration backend en arrière-plan
      //    On FUSIONNE les données locales avec les données backend :
      //    pour chaque classe, on garde celle qui a le plus de notes.
      //    Cela évite d'écraser les données locales fraîches avec des données
      //    backend potentiellement obsolètes (ou inversement).
      (async () => {
        try {
          console.log("[saisiemaster] 🔍 Restoring from backend (Neon)...");
          const backendData = await restoreFromBackend();
          if (backendData && backendData.classes.length > 0) {
            // ⭐ Fusionner local + backend
            const localClasses = restoredLocal?.classes || [];
            const merged = mergeClasses(localClasses, backendData.classes);
            console.log(
              `[saisiemaster] ✅ Merged: local=${localClasses.length}, backend=${backendData.classes.length}, merged=${merged.length}`,
            );
            useSaisieMasterStore.setState({
              classes: merged,
              activeClassIndex: Math.min(
                restoredLocal?.activeClassIndex || 0,
                Math.max(merged.length - 1, 0),
              ),
              editorView: "notes",
            });
            // Mettre à jour aussi le localStorage
            try {
              window.localStorage.setItem(
                "saisiemaster:autosave",
                JSON.stringify({
                  classes: merged,
                  activeClassIndex: restoredLocal?.activeClassIndex || 0,
                  savedAt: backendData.savedAt,
                }),
              );
            } catch {}
            console.log("[saisiemaster] ✅ State replaced with merged data");
          } else {
            console.log("[saisiemaster] ℹ️ Backend returned no sessions — keeping local data");
          }
        } catch (e) {
          console.warn("[saisiemaster] ❌ Backend restore failed at mount:", e);
        } finally {
          setBackendRestoreDone(true);
        }
      })();
    } else {
      setBackendRestoreDone(true);
    }
  }, [hydrateAuth]);

  // Gestion du scroll lors du changement de vue
  useEffect(() => {
    if (view === "editor" || view === "auth") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [view]);

  // --- Auth flow ---
  // ⭐ Après une connexion réussie, on envoie TOUJOURS l'utilisateur dans
  // l'application (éditeur). S'il n'a pas encore de classes, on bascule
  // directement sur la vue "classes" qui contient l'UI d'import.
  // ⭐ FIX: On tente AUSSI la restauration backend après login — c'est crucial
  //    pour que l'utilisateur retrouve ses données depuis n'importe quel appareil.
  const handleAuthSuccess = async (prospect: Prospect, token: string) => {
    setAuth(prospect, token);
    // Vérifier localStorage d'abord (rapide)
    const restoredLocal = restoreFromStorage();
    const hasClassesLocal = !!(restoredLocal && restoredLocal.classes.length > 0);
    if (hasClassesLocal) {
      useSaisieMasterStore.setState({
        classes: restoredLocal!.classes,
        activeClassIndex: Math.min(
          restoredLocal!.activeClassIndex,
          restoredLocal!.classes.length - 1,
        ),
        view: "editor",
        editorView: "notes",
      });
    } else {
      useSaisieMasterStore.setState({
        view: "editor",
        editorView: "classes",
      });
    }

    // ⭐ Tenter la restauration backend — FUSIONNER avec local
    try {
      console.log("[saisiemaster] 🔍 Restoring from backend after login...");
      const backendData = await restoreFromBackend();
      if (backendData && backendData.classes.length > 0) {
        const localClasses = restoredLocal?.classes || [];
        const merged = mergeClasses(localClasses, backendData.classes);
        console.log(
          `[saisiemaster] ✅ Merged after login: local=${localClasses.length}, backend=${backendData.classes.length}, merged=${merged.length}`,
        );
        useSaisieMasterStore.setState({
          classes: merged,
          activeClassIndex: Math.min(
            restoredLocal?.activeClassIndex || 0,
            Math.max(merged.length - 1, 0),
          ),
          view: "editor",
          editorView: "notes",
        });
        try {
          window.localStorage.setItem(
            "saisiemaster:autosave",
            JSON.stringify({
              classes: merged,
              activeClassIndex: restoredLocal?.activeClassIndex || 0,
              savedAt: backendData.savedAt,
            }),
          );
        } catch {}
        console.log("[saisiemaster] ✅ State replaced with merged data after login");
      } else {
        console.log("[saisiemaster] ℹ️ Backend returned no sessions after login — starting fresh");
      }
    } catch (e) {
      console.warn("[saisiemaster] ❌ Backend restore after login failed:", e);
    }
  };

  // ⭐ Tant que le délai minimum n'est pas écoulé, on affiche le loader
  if (!minLoadElapsed) {
    return <SaisieMasterLoader />;
  }

  if (view === "auth" && !isAuthenticated) {
    return <AuthScreen onSuccess={handleAuthSuccess} />;
  }

  // ⭐ Utilisateur authentifié → éditeur (l'application)
  if (view === "editor" && isAuthenticated) {
    return <EditorPage onHome={() => setView("landing")} />;
  }

  // ⭐ Si l'utilisateur est authentifié mais sur la landing page, on l'envoie
  // quand même vers l'éditeur
  if (isAuthenticated && view !== "landing") {
    return <EditorPage onHome={() => setView("landing")} />;
  }

  // Utilisateur non authentifié → landing page marketing.
  return <LandingPage />;
}
