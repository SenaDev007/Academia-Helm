"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookOpen, LogOut, User as UserIcon, History, LogIn } from "lucide-react";
import { useSaisieMasterStore, selectIsAuthenticated } from "@/lib/saisiemaster/store";

interface NavbarProps {
  /** Called when the user clicks the "Commencer" CTA. */
  onStart: () => void;
}

export function Navbar({ onStart }: NavbarProps) {
  const isAuthenticated = useSaisieMasterStore(selectIsAuthenticated);
  const prospect = useSaisieMasterStore((s) => s.prospect);
  const setView = useSaisieMasterStore((s) => s.setView);
  const setAuthView = useSaisieMasterStore((s) => s.setAuthView);
  const logout = useSaisieMasterStore((s) => s.logout);

  const handleStart = () => {
    if (isAuthenticated) {
      // Already authed → scroll to upload section.
      const el = document.getElementById("demarrer");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      // Not authed → trigger auth flow (signup mode).
      setAuthView("signup");
    }
  };

  const handleLogin = () => {
    // Open the auth screen directly in login mode.
    setAuthView("login");
  };

  const handleLogout = () => {
    logout();
    setView("landing");
  };

  const handleMesSaisies = () => {
    setView("editor");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <img src="/images/Logo-SaisieMaster.png" alt="SaisieMaster" className="h-8 w-auto" />

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <a href="#fonctionnement" className="hover:text-foreground transition-colors">
            Fonctionnement
          </a>
          <a href="#fonctionnalites" className="hover:text-foreground transition-colors">
            Fonctionnalités
          </a>
          <a href="#a-propos" className="hover:text-foreground transition-colors">
            À propos
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated && prospect ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#008751]/10 text-[#008751] text-xs font-semibold">
                    {prospect.firstName.charAt(0).toUpperCase()}
                    {prospect.lastName.charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden sm:inline font-medium">
                    {prospect.firstName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="font-medium">{prospect.firstName} {prospect.lastName}</span>
                  <span className="text-xs font-normal text-muted-foreground truncate">
                    {prospect.email}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {prospect.schoolName}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleMesSaisies} className="cursor-pointer">
                  <History className="h-4 w-4 mr-2" />
                  Mes saisies
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-[#e31b23] focus:text-[#e31b23]"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleLogin}
                className="gap-2"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Se connecter</span>
                <span className="sm:hidden">Connexion</span>
              </Button>
              <Button
                size="sm"
                onClick={handleStart}
                className="bg-[#008751] hover:bg-[#008751]/90 text-white"
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Commencer gratuitement</span>
                <span className="sm:hidden">Commencer</span>
              </Button>
            </>
          )}
        </div>
      </div>
      {/* Bande tricolore Bénin en bas du header */}
      <div className="h-0.5 w-full saisiemaster-tricolor" aria-hidden />
    </header>
  );
}
