"use client";

/**
 * SaisieMaster — Auth screen
 *
 * Wraps the SignupForm / LoginForm in a centered layout with the SaisieMaster
 * branding and the Benin tricolor ribbon. Switches between the two modes.
 *
 * ⭐ Utilise la même Navbar que la landing page (cohérence visuelle).
 *    Le bouton "Retour" est placé SOUS la navbar (en haut du contenu) plutôt
 *    que dans un header séparé.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { SignupForm } from "./signup-form";
import { LoginForm } from "./login-form";
import { Navbar } from "@/components/saisiemaster/landing/navbar";
import { useSaisieMasterStore } from "@/lib/saisiemaster/store";
import type { Prospect } from "@/lib/saisiemaster/api";

interface AuthScreenProps {
  onSuccess: (prospect: Prospect, token: string) => void;
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  // On mount, read the initial mode requested by the navbar (login/signup).
  // Defaults to "signup" if not set.
  const initialMode = useSaisieMasterStore((s) => s.authInitialMode);
  const setView = useSaisieMasterStore((s) => s.setView);

  const [mode, setMode] = useState<"signup" | "login">(initialMode);
  const [prefillEmail, setPrefillEmail] = useState("");

  const handleBack = () => {
    setView("landing");
  };

  // La navbar appelle onStart quand on clique sur "Commencer". En mode auth,
  // on ne fait rien (on est déjà sur l'écran d'auth).
  const noopStart = () => {};

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#fafaf7] to-[#f3f7f4]">
      {/* ⭐ Même navbar que la landing page (cohérence visuelle) */}
      <Navbar onStart={noopStart} />

      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md sm:max-w-lg space-y-6">
          {/* Bouton Retour — placé au-dessus du formulaire, sous la navbar */}
          <div className="flex justify-start">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-2 text-foreground hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à l&apos;accueil
            </Button>
          </div>

          {/* Hero text */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {mode === "signup"
                ? "Saisissez vos notes EducMaster"
                : "Retrouvez vos saisies"}
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {mode === "signup"
                ? "Outil gratuit pour les directeurs d'école au Bénin. Importez votre template, remplissez les notes, exportez au format officiel."
                : "Reprenez là où vous vous êtes arrêté. Vos saisies sont sauvegardées automatiquement."}
            </p>
          </div>

          {/* Form */}
          {mode === "signup" ? (
            <SignupForm
              defaultEmail={prefillEmail}
              onSuccess={onSuccess}
              onSwitchToLogin={() => setMode("login")}
            />
          ) : (
            <LoginForm
              onSuccess={onSuccess}
              onSwitchToSignup={() => {
                setPrefillEmail("");
                setMode("signup");
              }}
            />
          )}

          {/* Trust signals */}
          <p className="text-center text-xs text-muted-foreground px-4">
            Vos données restent privées. Elles ne sont jamais partagées avec
            des tiers et servent uniquement à faciliter votre saisie de notes.
          </p>
        </div>
      </main>
    </div>
  );
}
