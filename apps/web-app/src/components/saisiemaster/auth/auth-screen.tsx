"use client";

/**
 * SaisieMaster — Auth screen
 *
 * Wraps the SignupForm / LoginForm in a centered layout with the SaisieMaster
 * branding and the Benin tricolor ribbon. Switches between the two modes.
 *
 * The top navbar is solid white (bg-white) so it remains visible in both
 * light/dark themes — no white-on-white issue.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { SignupForm } from "./signup-form";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/saisiemaster/brand/logo";
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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#fafaf7] to-[#f3f7f4]">
      {/* Top bar — solid white background so it's visible in any theme */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="font-semibold text-foreground hidden sm:inline">
              SaisieMaster
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2 text-foreground hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Retour</span>
            <span className="sm:hidden">Retour</span>
          </Button>
        </div>
        <div className="h-0.5 w-full saisiemaster-tricolor" aria-hidden />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md space-y-6">
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
